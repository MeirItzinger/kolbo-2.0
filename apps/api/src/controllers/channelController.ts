import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { prisma } from "../lib/prisma";
import * as authService from "../services/auth/authService";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { page = "1", limit = "20", active } = req.query;
  const take = Math.min(Number(limit) || 20, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const where: Record<string, unknown> = {};
  if (active !== undefined) where.isActive = active === "true";

  const [channels, total] = await Promise.all([
    prisma.channel.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        subscriptionPlans: {
          where: { isActive: true },
          include: { priceVariants: { where: { isActive: true }, orderBy: { price: "asc" } } },
        },
        _count: { select: { videos: true, subscriptionPlans: true } },
      },
    }),
    prisma.channel.count({ where }),
  ]);

  res.json({
    status: "success",
    data: channels,
    meta: { page: Number(page) || 1, limit: take, total },
  });
});

export const getByIdOrSlug = asyncHandler(
  async (req: Request, res: Response) => {
    const { idOrSlug } = req.params;

    const channel = await prisma.channel.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: {
        subscriptionPlans: {
          where: { isActive: true },
          include: { priceVariants: { where: { isActive: true }, orderBy: { price: "asc" } } },
        },
        _count: { select: { videos: true } },
      },
    });

    if (!channel) throw ApiError.notFound("Channel not found");

    res.json({ status: "success", data: channel });
  }
);

export const create = asyncHandler(async (req: Request, res: Response) => {
  const {
    slug,
    name,
    description,
    shortDescription,
    logoUrl,
    bannerUrl,
    defaultCurrency,
    allowedAccessTypes,
    admin,
  } = req.body;

  const existing = await prisma.channel.findUnique({ where: { slug } });
  if (existing) throw ApiError.conflict("A channel with this slug already exists");

  if (!admin || typeof admin.email !== "string" || !admin.email.trim()) {
    throw ApiError.badRequest("admin.email is required to provision a channel admin");
  }

  const adminEmail = admin.email.toLowerCase().trim();
  const adminFirstName = (admin.firstName ?? "").toString().trim() || name;
  const adminLastName = (admin.lastName ?? "").toString().trim() || "Admin";
  const sendEmail = admin.sendEmail !== false;

  const channelAdminRole = await prisma.role.findUnique({
    where: { key: "CHANNEL_ADMIN" },
  });
  if (!channelAdminRole) {
    throw ApiError.internal("CHANNEL_ADMIN role is not configured");
  }

  const channel = await prisma.channel.create({
    data: {
      slug,
      name,
      description,
      shortDescription,
      logoUrl,
      bannerUrl,
      defaultCurrency,
      ...(allowedAccessTypes !== undefined && { allowedAccessTypes }),
    },
  });

  const adminUser = await prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { email: adminEmail },
    });

    const user =
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
        userId: user.id,
        roleId: channelAdminRole.id,
        channelId: channel.id,
      },
    });
    if (!existingRole) {
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: channelAdminRole.id,
          channelId: channel.id,
        },
      });
    }

    const existingChannelAdmin = await tx.channelAdmin.findUnique({
      where: { channelId_userId: { channelId: channel.id, userId: user.id } },
    });
    if (!existingChannelAdmin) {
      await tx.channelAdmin.create({
        data: { channelId: channel.id, userId: user.id },
      });
    }

    return user;
  });

  // Only invite if the user has not already set a password (i.e. brand-new account
  // or one that was provisioned but never accepted). Existing real users keep their pw.
  let inviteUrl: string | undefined;
  let emailed = false;
  if (!adminUser.passwordHash) {
    const result = await authService.sendInviteToUser({
      userId: adminUser.id,
      context: {
        kind: "channel-admin",
        channelId: channel.id,
        channelName: channel.name,
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
      ...channel,
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        inviteUrl,
        invitedByEmail: emailed,
        alreadyHadAccount: !!adminUser.passwordHash,
      },
    },
  });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, shortDescription, logoUrl, bannerUrl, isActive, defaultCurrency, allowedAccessTypes } =
    req.body;

  const channel = await prisma.channel.findUnique({ where: { id } });
  if (!channel) throw ApiError.notFound("Channel not found");

  const updated = await prisma.channel.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(shortDescription !== undefined && { shortDescription }),
      ...(logoUrl !== undefined && { logoUrl }),
      ...(bannerUrl !== undefined && { bannerUrl }),
      ...(isActive !== undefined && { isActive }),
      ...(defaultCurrency !== undefined && { defaultCurrency }),
      ...(allowedAccessTypes !== undefined && { allowedAccessTypes }),
    },
  });

  res.json({ status: "success", data: updated });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const channel = await prisma.channel.findUnique({ where: { id } });
  if (!channel) throw ApiError.notFound("Channel not found");

  await prisma.channel.delete({ where: { id } });

  res.json({ status: "success", message: "Channel deleted" });
});
