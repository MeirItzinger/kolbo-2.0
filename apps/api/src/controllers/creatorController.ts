import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { prisma } from "../lib/prisma";

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
  const { slug, displayName, bio, avatarUrl, channelId } = req.body;

  const existing = await prisma.creatorProfile.findUnique({ where: { slug } });
  if (existing) throw ApiError.conflict("A creator with this slug already exists");

  const creator = await prisma.$transaction(async (tx) => {
    const profile = await tx.creatorProfile.create({
      data: { slug, displayName, bio, avatarUrl },
    });

    if (channelId) {
      await tx.channelCreator.create({
        data: {
          channelId,
          creatorProfileId: profile.id,
          status: "APPROVED",
          approvedAt: new Date(),
        },
      });
    }

    return profile;
  });

  res.status(201).json({ status: "success", data: creator });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { displayName, bio, avatarUrl, isActive } = req.body;

  const creator = await prisma.creatorProfile.findUnique({ where: { id } });
  if (!creator) throw ApiError.notFound("Creator not found");

  const updated = await prisma.creatorProfile.update({
    where: { id },
    data: {
      ...(displayName !== undefined && { displayName }),
      ...(bio !== undefined && { bio }),
      ...(avatarUrl !== undefined && { avatarUrl }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  res.json({ status: "success", data: updated });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const creator = await prisma.creatorProfile.findUnique({ where: { id } });
  if (!creator) throw ApiError.notFound("Creator not found");

  await prisma.creatorProfile.delete({ where: { id } });

  res.json({ status: "success", message: "Creator deleted" });
});
