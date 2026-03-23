import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../../lib/prisma";
import { stripe } from "../../lib/stripe";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../lib/jwt";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../../lib/email";
import { ApiError } from "../../utils/apiError";

const SALT_ROUNDS = 12;
const EMAIL_TOKEN_EXPIRY_HOURS = 24;
const PASSWORD_RESET_EXPIRY_HOURS = 1;
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

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

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  if (!user.emailVerifiedAt) {
    throw ApiError.forbidden(
      "Please verify your email before logging in"
    );
  }

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

  return user;
}
