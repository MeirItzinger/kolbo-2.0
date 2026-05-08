import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { stripe } from "../../lib/stripe";
import { env } from "../../config/env";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../lib/jwt";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendInviteEmail,
} from "../../lib/email";
import { ApiError } from "../../utils/apiError";
import { ensureDefaultProfile } from "../profile/profileService";

const SALT_ROUNDS = 12;
const EMAIL_TOKEN_EXPIRY_HOURS = 24;
const PASSWORD_RESET_EXPIRY_HOURS = 1;
const INVITE_TOKEN_EXPIRY_DAYS = 7;
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export type InviteContext =
  | { kind: "channel-admin"; channelId: string; channelName?: string }
  | { kind: "creator-admin"; creatorProfileId: string; creatorName?: string }
  | { kind: "user"; reason?: string };

function inviteContextLabel(context: InviteContext | null | undefined): string | undefined {
  if (!context) return undefined;
  if (context.kind === "channel-admin") {
    return context.channelName ? `admin of ${context.channelName}` : "channel admin";
  }
  if (context.kind === "creator-admin") {
    return context.creatorName ? `${context.creatorName} (creator)` : "creator";
  }
  return undefined;
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function signup(
  email: string,
  password: string,
  firstName: string,
  lastName: string
) {
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    throw ApiError.conflict("A user with this email already exists");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const userRole = await prisma.role.findUnique({
    where: { key: "USER" },
  });
  if (!userRole) {
    throw ApiError.internal("Default USER role not configured");
  }

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName,
        lastName,
      },
    });

    await tx.userRole.create({
      data: { userId: created.id, roleId: userRole.id },
    });

    const stripeCustomer = await stripe.customers.create({
      email: normalizedEmail,
      name: `${firstName} ${lastName}`,
      metadata: { userId: created.id },
    });

    const updatedUser = await tx.user.update({
      where: { id: created.id },
      data: { stripeCustomerId: stripeCustomer.id },
    });

    // Netflix-style default: every new account starts with one profile.
    await ensureDefaultProfile(created.id, firstName, tx);

    if (process.env.NODE_ENV === "production") {
      const rawToken = generateToken();
      await tx.emailVerificationToken.create({
        data: {
          userId: created.id,
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(
            Date.now() + EMAIL_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000
          ),
        },
      });
      await sendVerificationEmail(normalizedEmail, rawToken);
    } else {
      await tx.user.update({
        where: { id: created.id },
        data: { emailVerifiedAt: new Date() },
      });
    }

    return updatedUser;
  });

  const accessToken = signAccessToken({ sub: user.id, email: user.email });
  const refreshToken = signRefreshToken({ sub: user.id, email: user.email });
  const refreshTokenHash = hashToken(refreshToken);

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash,
      expiresAt: new Date(
        Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
      ),
    },
  });

  const roles = await prisma.userRole.findMany({
    where: { userId: user.id },
    include: { role: true },
  });

  return {
    accessToken,
    refreshToken,
    sessionId: session.id,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: roles.map((ur) => ({
        role: { key: ur.role.key, name: ur.role.name },
        channelId: ur.channelId,
        creatorProfileId: ur.creatorProfileId,
      })),
    },
  };
}

export async function login(email: string, password: string) {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { roles: { include: { role: true } } },
  });

  if (!user) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  if (!user.isActive) {
    throw ApiError.forbidden("Your account has been deactivated");
  }

  if (!user.passwordHash) {
    throw ApiError.unauthorized(
      "This account has not set a password yet. Please use your invite link or request a password reset."
    );
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  if (!user.emailVerifiedAt) {
    throw ApiError.forbidden(
      "Please verify your email before logging in"
    );
  }

  // Backfill: legacy accounts created before profiles existed.
  await ensureDefaultProfile(user.id, user.firstName);

  const accessToken = signAccessToken({ sub: user.id, email: user.email });
  const refreshToken = signRefreshToken({ sub: user.id, email: user.email });
  const refreshTokenHash = hashToken(refreshToken);

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash,
      expiresAt: new Date(
        Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
      ),
    },
  });

  return {
    accessToken,
    refreshToken,
    sessionId: session.id,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles.map((ur) => ({
        role: { key: ur.role.key, name: ur.role.name },
        channelId: ur.channelId,
        creatorProfileId: ur.creatorProfileId,
      })),
    },
  };
}

export async function logout(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw ApiError.notFound("Session not found");
  }

  await prisma.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
}

export async function refreshTokens(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }

  const tokenHash = hashToken(refreshToken);

  const session = await prisma.session.findFirst({
    where: {
      userId: payload.sub,
      refreshTokenHash: tokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!session) {
    throw ApiError.unauthorized("Session not found or has been revoked");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
  });
  if (!user || !user.isActive) {
    throw ApiError.unauthorized("User account is inactive");
  }

  const newAccessToken = signAccessToken({ sub: user.id, email: user.email });
  const newRefreshToken = signRefreshToken({ sub: user.id, email: user.email });
  const newRefreshTokenHash = hashToken(newRefreshToken);

  await prisma.session.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: newRefreshTokenHash,
      expiresAt: new Date(
        Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
      ),
    },
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    sessionId: session.id,
  };
}

export async function verifyEmail(token: string) {
  const tokenHash = hashToken(token);

  const record = await prisma.emailVerificationToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!record) {
    throw ApiError.badRequest("Invalid or expired verification token");
  }

  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    }),
  ]);

  return { message: "Email verified successfully" };
}

export async function resendVerification(email: string) {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    return { message: "If that email exists, a verification link has been sent" };
  }

  if (user.emailVerifiedAt) {
    return { message: "If that email exists, a verification link has been sent" };
  }

  await prisma.emailVerificationToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { expiresAt: new Date() },
  });

  const rawToken = generateToken();
  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(
        Date.now() + EMAIL_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000
      ),
    },
  });

  await sendVerificationEmail(normalizedEmail, rawToken);

  return { message: "If that email exists, a verification link has been sent" };
}

export async function forgotPassword(email: string) {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    return { message: "If that email exists, a password reset link has been sent" };
  }

  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { expiresAt: new Date() },
  });

  const rawToken = generateToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(
        Date.now() + PASSWORD_RESET_EXPIRY_HOURS * 60 * 60 * 1000
      ),
    },
  });

  await sendPasswordResetEmail(normalizedEmail, rawToken);

  return { message: "If that email exists, a password reset link has been sent" };
}

export async function resetPassword(token: string, newPassword: string) {
  const tokenHash = hashToken(token);

  const record = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!record) {
    throw ApiError.badRequest("Invalid or expired reset token");
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.$transaction([
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.session.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  return { message: "Password reset successfully" };
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  currentSessionId?: string
) {
  if (!newPassword || newPassword.length < 8) {
    throw ApiError.badRequest("New password must be at least 8 characters");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw ApiError.notFound("User not found");
  }

  if (user.passwordHash) {
    const valid = await bcrypt.compare(currentPassword ?? "", user.passwordHash);
    if (!valid) {
      throw ApiError.unauthorized("Current password is incorrect");
    }
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: false,
        lastPasswordChangedAt: new Date(),
      },
    }),
    prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    }),
  ]);

  return { message: "Password updated" };
}

/**
 * Issue a fresh InviteToken for `userId`. Expires any active invites for that user first.
 * Returns the raw token string (only shown once) and the canonical invite URL.
 */
export async function issueInviteForUser(
  userId: string,
  context: InviteContext | null,
  createdById?: string
): Promise<{ token: string; inviteUrl: string; expiresAt: Date }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw ApiError.notFound("User not found");
  }

  await prisma.inviteToken.updateMany({
    where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
    data: { expiresAt: new Date() },
  });

  const rawToken = generateToken();
  const expiresAt = new Date(
    Date.now() + INVITE_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  );

  await prisma.inviteToken.create({
    data: {
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt,
      createdById: createdById ?? null,
      context: (context as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    },
  });

  return {
    token: rawToken,
    inviteUrl: `${env.CLIENT_URL}/accept-invite?token=${rawToken}`,
    expiresAt,
  };
}

export async function sendInviteToUser(args: {
  userId: string;
  context: InviteContext | null;
  createdById?: string;
  inviterName?: string;
  sendEmail: boolean;
}): Promise<{ inviteUrl: string; expiresAt: Date; emailed: boolean }> {
  const user = await prisma.user.findUnique({ where: { id: args.userId } });
  if (!user) throw ApiError.notFound("User not found");

  const { inviteUrl, expiresAt } = await issueInviteForUser(
    args.userId,
    args.context,
    args.createdById
  );

  let emailed = false;
  if (args.sendEmail) {
    try {
      await sendInviteEmail({
        to: user.email,
        inviteUrl,
        inviterName: args.inviterName,
        contextLabel: inviteContextLabel(args.context),
      });
      emailed = true;
    } catch (err) {
      // Don't fail the whole flow if Resend errors; admin can copy the link.
      console.error("[invite] failed to send email", err);
    }
  }

  return { inviteUrl, expiresAt, emailed };
}

export async function getInvite(token: string) {
  const tokenHash = hashToken(token);
  const record = await prisma.inviteToken.findFirst({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    include: {
      user: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
    },
  });

  if (!record) {
    throw ApiError.badRequest("Invalid or expired invite token");
  }

  const context = (record.context ?? null) as InviteContext | null;

  return {
    email: record.user.email,
    firstName: record.user.firstName,
    lastName: record.user.lastName,
    contextLabel: inviteContextLabel(context),
    expiresAt: record.expiresAt,
  };
}

export async function acceptInvite(
  token: string,
  password: string,
  firstName?: string,
  lastName?: string
) {
  if (!password || password.length < 8) {
    throw ApiError.badRequest("Password must be at least 8 characters");
  }

  const tokenHash = hashToken(token);
  const record = await prisma.inviteToken.findFirst({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
  });

  if (!record) {
    throw ApiError.badRequest("Invalid or expired invite token");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: record.userId },
      data: {
        passwordHash,
        emailVerifiedAt: new Date(),
        mustChangePassword: false,
        lastPasswordChangedAt: new Date(),
        isActive: true,
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
      },
      include: { roles: { include: { role: true } } },
    });

    await tx.inviteToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    // Invalidate any other open invites for this user.
    await tx.inviteToken.updateMany({
      where: {
        userId: record.userId,
        id: { not: record.id },
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { expiresAt: new Date() },
    });

    await ensureDefaultProfile(updated.id, updated.firstName, tx);

    return updated;
  });

  const accessToken = signAccessToken({ sub: user.id, email: user.email });
  const refreshToken = signRefreshToken({ sub: user.id, email: user.email });
  const refreshTokenHash = hashToken(refreshToken);

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash,
      expiresAt: new Date(
        Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
      ),
    },
  });

  return {
    accessToken,
    refreshToken,
    sessionId: session.id,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles.map((ur) => ({
        role: { key: ur.role.key, name: ur.role.name },
        channelId: ur.channelId,
        creatorProfileId: ur.creatorProfileId,
      })),
    },
  };
}

/**
 * Issue a password reset token for a given user (admin-initiated).
 * Returns the raw token + URL. Caller decides whether to email it.
 */
export async function issuePasswordResetForUser(
  userId: string
): Promise<{ token: string; resetUrl: string; expiresAt: Date }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound("User not found");

  await prisma.passwordResetToken.updateMany({
    where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
    data: { expiresAt: new Date() },
  });

  const rawToken = generateToken();
  const expiresAt = new Date(
    Date.now() + PASSWORD_RESET_EXPIRY_HOURS * 60 * 60 * 1000
  );

  await prisma.passwordResetToken.create({
    data: { userId, tokenHash: hashToken(rawToken), expiresAt },
  });

  return {
    token: rawToken,
    resetUrl: `${env.CLIENT_URL}/reset-password?token=${rawToken}`,
    expiresAt,
  };
}

export async function sendPasswordResetToUser(args: {
  userId: string;
  sendEmail: boolean;
}): Promise<{ resetUrl: string; expiresAt: Date; emailed: boolean }> {
  const user = await prisma.user.findUnique({ where: { id: args.userId } });
  if (!user) throw ApiError.notFound("User not found");

  const { token, resetUrl, expiresAt } = await issuePasswordResetForUser(
    args.userId
  );

  let emailed = false;
  if (args.sendEmail) {
    try {
      await sendPasswordResetEmail(user.email, token);
      emailed = true;
    } catch (err) {
      console.error("[password-reset] failed to send email", err);
    }
  }

  return { resetUrl, expiresAt, emailed };
}

export async function revokeAllSessions(userId: string) {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return { message: "All sessions revoked" };
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      emailVerifiedAt: true,
      stripeCustomerId: true,
      isActive: true,
      requirePinForPurchases: true,
      createdAt: true,
      roles: {
        include: {
          role: true,
          channel: { select: { id: true, slug: true, name: true } },
          creatorProfile: { select: { id: true, slug: true, displayName: true } },
        },
      },
      profiles: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          isKidsProfile: true,
        },
      },
    },
  });

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  if (user.profiles.length === 0) {
    const created = await ensureDefaultProfile(user.id, user.firstName);
    if (created) {
      user.profiles = [
        {
          id: created.id,
          name: created.name,
          avatarUrl: created.avatarUrl ?? null,
          isKidsProfile: created.isKidsProfile,
        },
      ];
    }
  }

  return user;
}
