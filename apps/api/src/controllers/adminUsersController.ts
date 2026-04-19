import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { prisma } from "../lib/prisma";
import * as authService from "../services/auth/authService";
import type { InviteContext } from "../services/auth/authService";

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  isActive: true,
  emailVerifiedAt: true,
  mustChangePassword: true,
  lastPasswordChangedAt: true,
  passwordHash: true,
  createdAt: true,
  updatedAt: true,
  roles: {
    include: {
      role: true,
      channel: { select: { id: true, slug: true, name: true } },
      creatorProfile: { select: { id: true, slug: true, displayName: true } },
    },
  },
} satisfies Prisma.UserSelect;

function shape(user: Prisma.UserGetPayload<{ select: typeof userSelect }>) {
  const { passwordHash, ...rest } = user;
  return {
    ...rest,
    hasPassword: !!passwordHash,
  };
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { page = "1", limit = "20", search, role, active } = req.query;
  const take = Math.min(Number(limit) || 20, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const where: Prisma.UserWhereInput = {};
  if (active !== undefined) where.isActive = active === "true";

  if (typeof search === "string" && search.trim()) {
    const q = search.trim();
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
    ];
  }

  if (typeof role === "string" && role.trim()) {
    where.roles = { some: { role: { key: role as Prisma.EnumRoleKeyFilter["equals"] } } };
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: userSelect,
    }),
    prisma.user.count({ where }),
  ]);

  res.json({
    status: "success",
    data: users.map(shape),
    meta: { page: Number(page) || 1, limit: take, total },
  });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: userSelect,
  });
  if (!user) throw ApiError.notFound("User not found");
  res.json({ status: "success", data: shape(user) });
});

export const patch = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { firstName, lastName, isActive } = req.body;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw ApiError.notFound("User not found");

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(isActive !== undefined && { isActive }),
    },
    select: userSelect,
  });

  res.json({ status: "success", data: shape(updated) });
});

export const invite = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { sendEmail = true, context } = (req.body ?? {}) as {
    sendEmail?: boolean;
    context?: InviteContext;
  };

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw ApiError.notFound("User not found");

  const result = await authService.sendInviteToUser({
    userId: id,
    context: context ?? null,
    createdById: req.user?.id,
    inviterName: req.user?.email,
    sendEmail,
  });

  res.json({ status: "success", data: result });
});

export const passwordReset = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { sendEmail = true } = (req.body ?? {}) as { sendEmail?: boolean };

  const result = await authService.sendPasswordResetToUser({
    userId: id,
    sendEmail,
  });

  res.json({ status: "success", data: result });
});

export const revokeSessions = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await authService.revokeAllSessions(id);
  res.json({ status: "success", ...result });
});
