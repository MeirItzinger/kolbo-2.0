import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { prisma } from "../lib/prisma";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { active } = req.query;

  const where: Record<string, unknown> = {};
  if (active !== undefined) where.isActive = active === "true";

  const heroes = await prisma.landingHero.findMany({
    where,
    orderBy: { sortOrder: "asc" },
    include: {
      channel: { select: { id: true, slug: true, name: true } },
      video: { select: { id: true, slug: true, title: true } },
    },
  });

  res.json({ status: "success", data: heroes });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const hero = await prisma.landingHero.findUnique({
    where: { id },
    include: {
      channel: { select: { id: true, slug: true, name: true } },
      video: { select: { id: true, slug: true, title: true } },
    },
  });

  if (!hero) throw ApiError.notFound("Landing hero not found");

  res.json({ status: "success", data: hero });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const {
    title,
    subtitle,
    imageUrl,
    destinationType,
    channelId,
    videoId,
    externalUrl,
    sortOrder,
    isActive,
  } = req.body;

  const hero = await prisma.landingHero.create({
    data: {
      title,
      subtitle,
      imageUrl,
      destinationType,
      channelId: channelId || null,
      videoId: videoId || null,
      externalUrl: externalUrl || null,
      sortOrder: sortOrder ?? 0,
      isActive: isActive ?? true,
    },
  });

  res.status(201).json({ status: "success", data: hero });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    title,
    subtitle,
    imageUrl,
    destinationType,
    channelId,
    videoId,
    externalUrl,
    sortOrder,
    isActive,
  } = req.body;

  const hero = await prisma.landingHero.findUnique({ where: { id } });
  if (!hero) throw ApiError.notFound("Landing hero not found");

  const updated = await prisma.landingHero.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(subtitle !== undefined && { subtitle }),
      ...(imageUrl !== undefined && { imageUrl }),
      ...(destinationType !== undefined && { destinationType }),
      ...(channelId !== undefined && { channelId: channelId || null }),
      ...(videoId !== undefined && { videoId: videoId || null }),
      ...(externalUrl !== undefined && { externalUrl: externalUrl || null }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  res.json({ status: "success", data: updated });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const hero = await prisma.landingHero.findUnique({ where: { id } });
  if (!hero) throw ApiError.notFound("Landing hero not found");

  await prisma.landingHero.delete({ where: { id } });

  res.json({ status: "success", message: "Landing hero deleted" });
});
