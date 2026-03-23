import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../../lib/prisma";
import { stripe } from "../../lib/stripe";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../lib/jwt";
import { ApiError } from "../../utils/apiError";

const SALT_ROUNDS = 12;
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function signup(
  email: string,
  password: string,
  companyName: string,
  contactName: string,
  phone?: string
) {
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await prisma.advertiser.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    throw ApiError.conflict("An advertiser with this email already exists");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const advertiser = await prisma.$transaction(async (tx) => {
    const created = await tx.advertiser.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        companyName,
        contactName,
        phone: phone || null,
        emailVerifiedAt: process.env.NODE_ENV !== "production" ? new Date() : null,
      },
    });

    const stripeCustomer = await stripe.customers.create({
      email: normalizedEmail,
      name: companyName,
      metadata: { advertiserId: created.id, type: "advertiser" },
    });

    return tx.advertiser.update({
      where: { id: created.id },
      data: { stripeCustomerId: stripeCustomer.id },
    });
  });

  const accessToken = signAccessToken({
    sub: advertiser.id,
    email: advertiser.email,
    type: "advertiser",
  });
  const refreshToken = signRefreshToken({
    sub: advertiser.id,
    email: advertiser.email,
    type: "advertiser",
  });
  const refreshTokenHash = hashToken(refreshToken);

  const session = await prisma.advertiserSession.create({
    data: {
      advertiserId: advertiser.id,
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
    advertiser: {
      id: advertiser.id,
      email: advertiser.email,
      companyName: advertiser.companyName,
      contactName: advertiser.contactName,
      phone: advertiser.phone,
    },
  };
}

export async function login(email: string, password: string) {
  const normalizedEmail = email.toLowerCase().trim();

  const advertiser = await prisma.advertiser.findUnique({
    where: { email: normalizedEmail },
  });

  if (!advertiser) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  if (!advertiser.isActive) {
    throw ApiError.forbidden("Your account has been deactivated");
  }

  const valid = await bcrypt.compare(password, advertiser.passwordHash);
  if (!valid) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  if (!advertiser.emailVerifiedAt) {
    throw ApiError.forbidden("Please verify your email before logging in");
  }

  const accessToken = signAccessToken({
    sub: advertiser.id,
    email: advertiser.email,
    type: "advertiser",
  });
  const refreshToken = signRefreshToken({
    sub: advertiser.id,
    email: advertiser.email,
    type: "advertiser",
  });
  const refreshTokenHash = hashToken(refreshToken);

  const session = await prisma.advertiserSession.create({
    data: {
      advertiserId: advertiser.id,
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
    advertiser: {
      id: advertiser.id,
      email: advertiser.email,
      companyName: advertiser.companyName,
      contactName: advertiser.contactName,
      phone: advertiser.phone,
    },
  };
}

export async function logout(sessionId: string) {
  const session = await prisma.advertiserSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw ApiError.notFound("Session not found");
  }

  await prisma.advertiserSession.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
}

export async function logoutAll(advertiserId: string) {
  await prisma.advertiserSession.updateMany({
    where: { advertiserId, revokedAt: null },
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

  if (payload.type !== "advertiser") {
    throw ApiError.unauthorized("Invalid token type");
  }

  const tokenHash = hashToken(refreshToken);

  const session = await prisma.advertiserSession.findFirst({
    where: {
      advertiserId: payload.sub,
      refreshTokenHash: tokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!session) {
    throw ApiError.unauthorized("Session not found or has been revoked");
  }

  const advertiser = await prisma.advertiser.findUnique({
    where: { id: payload.sub },
  });
  if (!advertiser || !advertiser.isActive) {
    throw ApiError.unauthorized("Advertiser account is inactive");
  }

  const newAccessToken = signAccessToken({
    sub: advertiser.id,
    email: advertiser.email,
    type: "advertiser",
  });
  const newRefreshToken = signRefreshToken({
    sub: advertiser.id,
    email: advertiser.email,
    type: "advertiser",
  });
  const newRefreshTokenHash = hashToken(newRefreshToken);

  await prisma.advertiserSession.update({
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

export async function getCurrentAdvertiser(advertiserId: string) {
  const advertiser = await prisma.advertiser.findUnique({
    where: { id: advertiserId },
    select: {
      id: true,
      email: true,
      companyName: true,
      contactName: true,
      phone: true,
      stripeCustomerId: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (!advertiser) {
    throw ApiError.notFound("Advertiser not found");
  }

  return advertiser;
}
