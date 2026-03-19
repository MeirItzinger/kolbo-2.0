import { Request, Response } from "express";
import { hashSync } from "bcryptjs";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { prisma } from "../lib/prisma";

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
  const { slug, name, description, shortDescription, logoUrl, bannerUrl, defaultCurrency, allowedAccessTypes } =
    req.body;

  const existing = await prisma.channel.findUnique({ where: { slug } });
  if (existing) throw ApiError.conflict("A channel with this slug already exists");

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

  const adminEmail = `admin@${slug.replace(/\s+/g, "").toLowerCase()}.com`;
  const adminPassword = name.replace(/\s+/g, "").toLowerCase() + "yechi";

  const channelAdminRole = await prisma.role.findUnique({
    where: { key: "CHANNEL_ADMIN" },
  });

  if (channelAdminRole) {
    const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });

    const adminUser = existingUser ?? await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: hashSync(adminPassword, 12),
        firstName: name,
        lastName: "Admin",
        emailVerifiedAt: new Date(),
        isActive: true,
      },
    });

    await prisma.userRole.create({
      data: {
        userId: adminUser.id,
        roleId: channelAdminRole.id,
        channelId: channel.id,
      },
    });

    await prisma.channelAdmin.create({
      data: {
        channelId: channel.id,
        userId: adminUser.id,
      },
    });
  }

  res.status(201).json({ status: "success", data: channel });
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
