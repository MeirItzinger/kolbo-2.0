import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { prisma } from "../lib/prisma";

const MAX_PROFILES_PER_USER = 5;
const PIN_SALT_ROUNDS = 10;

export const list = asyncHandler(async (req: Request, res: Response) => {
  const profiles = await prisma.profile.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "asc" },
  });

  res.json({ status: "success", data: profiles });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const profile = await prisma.profile.findFirst({
    where: { id, userId: req.user!.id },
  });

  if (!profile) throw ApiError.notFound("Profile not found");

  res.json({ status: "success", data: profile });
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
  const { name, avatarUrl, maturitySettings, isKidsProfile, parentalControls } = req.body;

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
      ...(parentalControls !== undefined && { parentalControls }),
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

  const count = await prisma.profile.count({
    where: { userId: req.user!.id },
  });

  if (count <= 1) {
    throw ApiError.badRequest("Cannot delete the last profile");
  }

  await prisma.profile.delete({ where: { id } });

  res.json({ status: "success", message: "Profile deleted" });
});

export const setPin = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { pin } = req.body;

  if (!pin || !/^\d{4}$/.test(pin)) {
    throw ApiError.badRequest("PIN must be exactly 4 digits");
  }

  const profile = await prisma.profile.findFirst({
    where: { id, userId: req.user!.id },
  });

  if (!profile) throw ApiError.notFound("Profile not found");

  const pinHash = await bcrypt.hash(pin, PIN_SALT_ROUNDS);

  const updated = await prisma.profile.update({
    where: { id },
    data: { pinHash, isLocked: true },
  });

  res.json({ status: "success", data: { id: updated.id, isLocked: updated.isLocked } });
});

export const verifyPin = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { pin } = req.body;

  if (!pin || !/^\d{4}$/.test(pin)) {
    throw ApiError.badRequest("PIN must be exactly 4 digits");
  }

  const profile = await prisma.profile.findFirst({
    where: { id, userId: req.user!.id },
  });

  if (!profile) throw ApiError.notFound("Profile not found");
  if (!profile.pinHash) throw ApiError.badRequest("No PIN set for this profile");

  const isValid = await bcrypt.compare(pin, profile.pinHash);

  if (!isValid) {
    throw ApiError.unauthorized("Incorrect PIN");
  }

  res.json({ status: "success", message: "PIN verified" });
});

export const clearPin = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const profile = await prisma.profile.findFirst({
    where: { id, userId: req.user!.id },
  });

  if (!profile) throw ApiError.notFound("Profile not found");

  await prisma.profile.update({
    where: { id },
    data: { pinHash: null, isLocked: false },
  });

  res.json({ status: "success", message: "PIN removed" });
});

export const updateParentalControls = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { parentalControls } = req.body;

  const profile = await prisma.profile.findFirst({
    where: { id, userId: req.user!.id },
  });

  if (!profile) throw ApiError.notFound("Profile not found");

  const updated = await prisma.profile.update({
    where: { id },
    data: { parentalControls },
  });

  res.json({ status: "success", data: updated });
});
