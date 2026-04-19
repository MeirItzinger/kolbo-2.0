import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { prisma } from "../lib/prisma";
import { stripe } from "../lib/stripe";
import { env } from "../config/env";
import * as authService from "../services/auth/authService";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { page = "1", limit = "20", channelId, active } = req.query;
  const take = Math.min(Number(limit) || 20, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const where: Record<string, unknown> = {};
  if (active !== undefined) where.isActive = active === "true";
  if (channelId) {
    where.channelCreators = {
      some: { channelId: channelId as string, status: "APPROVED" },
    };
  }

  const [creators, total] = await Promise.all([
    prisma.creatorProfile.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        channelCreators: {
          include: { channel: { select: { id: true, slug: true, name: true } } },
        },
        _count: { select: { videos: true } },
      },
    }),
    prisma.creatorProfile.count({ where }),
  ]);

  res.json({
    status: "success",
    data: creators,
    meta: { page: Number(page) || 1, limit: take, total },
  });
});

export const getByIdOrSlug = asyncHandler(
  async (req: Request, res: Response) => {
    const { idOrSlug } = req.params;

    const creator = await prisma.creatorProfile.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: {
        channelCreators: {
          where: { status: "APPROVED" },
          include: { channel: { select: { id: true, slug: true, name: true } } },
        },
        _count: { select: { videos: true } },
      },
    });

    if (!creator) throw ApiError.notFound("Creator not found");

    res.json({ status: "success", data: creator });
  }
);

export const create = asyncHandler(async (req: Request, res: Response) => {
  const {
    slug,
    displayName,
    bio,
    avatarUrl,
    channelId,
    revSharePercent,
    admin,
  } = req.body;

  const existing = await prisma.creatorProfile.findUnique({ where: { slug } });
  if (existing) throw ApiError.conflict("A creator with this slug already exists");

  if (!admin || typeof admin.email !== "string" || !admin.email.trim()) {
    throw ApiError.badRequest("admin.email is required to provision a creator admin");
  }

  // CHANNEL_ADMIN callers can only create creators within their own channel.
  const isSuperAdmin = req.user?.roles.some((r) => r.key === "SUPER_ADMIN");
  if (!isSuperAdmin) {
    if (!channelId) {
      throw ApiError.badRequest("channelId is required");
    }
    const ok = req.user?.roles.some(
      (r) => r.key === "CHANNEL_ADMIN" && r.channelId === channelId
    );
    if (!ok) {
      throw ApiError.forbidden("You do not have admin access to this channel");
    }
  }

  const nameParts = displayName.trim().split(/\s+/);
  const fallbackFirstName = nameParts[0] ?? displayName;
  const fallbackLastName = nameParts.slice(1).join(" ") || "";
  const adminEmail = admin.email.toLowerCase().trim();
  const adminFirstName = (admin.firstName ?? "").toString().trim() || fallbackFirstName;
  const adminLastName = (admin.lastName ?? "").toString().trim() || fallbackLastName;
  const sendEmail = admin.sendEmail !== false;

  const creatorAdminRole = await prisma.role.findUnique({
    where: { key: "CREATOR_ADMIN" },
  });
  if (!creatorAdminRole) throw ApiError.notFound("CREATOR_ADMIN role not found");

  const { profile, user } = await prisma.$transaction(async (tx) => {
    const createdProfile = await tx.creatorProfile.create({
      data: {
        slug,
        displayName,
        bio,
        avatarUrl,
        ...(revSharePercent !== undefined && revSharePercent !== "" && {
          revSharePercent: Number(revSharePercent),
        }),
      },
    });

    if (channelId) {
      await tx.channelCreator.create({
        data: {
          channelId,
          creatorProfileId: createdProfile.id,
          status: "APPROVED",
          approvedAt: new Date(),
        },
      });
    }

    const existingUser = await tx.user.findUnique({
      where: { email: adminEmail },
    });

    const adminUser =
      existingUser ??
      (await tx.user.create({
        data: {
          email: adminEmail,
          passwordHash: null,
          firstName: adminFirstName,
          lastName: adminLastName,
          emailVerifiedAt: null,
          isActive: true,
        },
      }));

    const existingRole = await tx.userRole.findFirst({
      where: {
        userId: adminUser.id,
        roleId: creatorAdminRole.id,
        creatorProfileId: createdProfile.id,
      },
    });
    if (!existingRole) {
      await tx.userRole.create({
        data: {
          userId: adminUser.id,
          roleId: creatorAdminRole.id,
          creatorProfileId: createdProfile.id,
        },
      });
    }

    return { profile: createdProfile, user: adminUser };
  });

  let inviteUrl: string | undefined;
  let emailed = false;
  if (!user.passwordHash) {
    const result = await authService.sendInviteToUser({
      userId: user.id,
      context: {
        kind: "creator-admin",
        creatorProfileId: profile.id,
        creatorName: profile.displayName,
      },
      createdById: req.user?.id,
      inviterName: req.user?.email,
      sendEmail,
    });
    inviteUrl = result.inviteUrl;
    emailed = result.emailed;
  }

  res.status(201).json({
    status: "success",
    data: {
      ...profile,
      admin: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        inviteUrl,
        invitedByEmail: emailed,
        alreadyHadAccount: !!user.passwordHash,
      },
    },
  });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { displayName, bio, avatarUrl, isActive, revSharePercent } = req.body;

  const creator = await prisma.creatorProfile.findUnique({ where: { id } });
  if (!creator) throw ApiError.notFound("Creator not found");

  const updated = await prisma.creatorProfile.update({
    where: { id },
    data: {
      ...(displayName !== undefined && { displayName }),
      ...(bio !== undefined && { bio }),
      ...(avatarUrl !== undefined && { avatarUrl }),
      ...(isActive !== undefined && { isActive }),
      ...(revSharePercent !== undefined && {
        revSharePercent: revSharePercent === null || revSharePercent === "" ? null : Number(revSharePercent),
      }),
    },
  });

  res.json({ status: "success", data: updated });
});

export const createConnectOnboardingLink = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { returnUrl, refreshUrl } = req.body;

  const creator = await prisma.creatorProfile.findUnique({ where: { id } });
  if (!creator) throw ApiError.notFound("Creator not found");

  let accountId = creator.stripeConnectAccountId;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      capabilities: { transfers: { requested: true } },
      metadata: { creatorProfileId: id, creatorSlug: creator.slug },
    });
    accountId = account.id;
    await prisma.creatorProfile.update({
      where: { id },
      data: { stripeConnectAccountId: accountId },
    });
  }

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl ?? `${env.CLIENT_URL}/admin/creators`,
    return_url: returnUrl ?? `${env.CLIENT_URL}/admin/creators`,
    type: "account_onboarding",
  });

  res.json({ status: "success", data: { url: accountLink.url, accountId } });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const creator = await prisma.creatorProfile.findUnique({ where: { id } });
  if (!creator) throw ApiError.notFound("Creator not found");

  await prisma.creatorProfile.delete({ where: { id } });

  res.json({ status: "success", message: "Creator deleted" });
});
