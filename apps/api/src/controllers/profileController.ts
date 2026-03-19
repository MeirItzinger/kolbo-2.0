import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { prisma } from "../lib/prisma";

const MAX_PROFILES_PER_USER = 5;

export const list = asyncHandler(async (req: Request, res: Response) => {
  const profiles = await prisma.profile.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "asc" },
  });

  res.json({ status: "success", data: profiles });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { name, avatarUrl, maturitySettings, isKidsProfile } = req.body;

  const count = await prisma.profile.count({
    where: { userId: req.user!.id },
  });

  if (count >= MAX_PROFILES_PER_USER) {
    throw ApiError.badRequest(
      `Maximum of ${MAX_PROFILES_PER_USER} profiles allowed`
    );
  }

  const profile = await prisma.profile.create({
    data: {
      userId: req.user!.id,
      name,
      avatarUrl,
      maturitySettings,
      isKidsProfile: isKidsProfile || false,
    },
  });

  res.status(201).json({ status: "success", data: profile });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, avatarUrl, maturitySettings, isKidsProfile } = req.body;

  const profile = await prisma.profile.findFirst({
    where: { id, userId: req.user!.id },
  });

  if (!profile) throw ApiError.notFound("Profile not found");

  const updated = await prisma.profile.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(avatarUrl !== undefined && { avatarUrl }),
      ...(maturitySettings !== undefined && { maturitySettings }),
      ...(isKidsProfile !== undefined && { isKidsProfile }),
    },
  });

  res.json({ status: "success", data: updated });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const profile = await prisma.profile.findFirst({
    where: { id, userId: req.user!.id },
  });

  if (!profile) throw ApiError.notFound("Profile not found");

  await prisma.profile.delete({ where: { id } });

  res.json({ status: "success", message: "Profile deleted" });
});
