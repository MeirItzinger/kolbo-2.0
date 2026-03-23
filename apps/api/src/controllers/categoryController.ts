import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { prisma } from "../lib/prisma";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { channelId } = req.params;

  try {
    const categories = await prisma.category.findMany({
      where: { channelId },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { videoLinks: true } } },
    });
    return res.json({ status: "success", data: categories });
  } catch (err) {
    console.warn("[categories] list: retry without VideoCategory count", err);
    const categories = await prisma.category.findMany({
      where: { channelId },
      orderBy: { sortOrder: "asc" },
    });
    return res.json({
      status: "success",
      data: categories.map((c) => ({ ...c, _count: { videoLinks: 0 } })),
    });
  }
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { channelId } = req.params;
  const { name, slug, sortOrder, isActive } = req.body;

  if (!name || !slug) throw ApiError.badRequest("Name and slug are required");

  const existing = await prisma.category.findUnique({
    where: { channelId_slug: { channelId, slug } },
  });
  if (existing) throw ApiError.conflict("A category with this slug already exists in this channel");

  const maxSort = await prisma.category.aggregate({
    where: { channelId },
    _max: { sortOrder: true },
  });

  let category;
  try {
    category = await prisma.category.create({
      data: {
        channelId,
        name,
        slug,
        sortOrder: sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
        isActive: isActive ?? true,
      },
      include: { _count: { select: { videoLinks: true } } },
    });
  } catch (err) {
    console.warn("[categories] create: reload without video count", err);
    category = await prisma.category.create({
      data: {
        channelId,
        name,
        slug,
        sortOrder: sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
        isActive: isActive ?? true,
      },
    });
    category = { ...category, _count: { videoLinks: 0 } };
  }

  res.status(201).json({ status: "success", data: category });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { channelId, id } = req.params;
  const { name, slug, sortOrder, isActive } = req.body;

  const category = await prisma.category.findFirst({
    where: { id, channelId },
  });
  if (!category) throw ApiError.notFound("Category not found");

  if (slug && slug !== category.slug) {
    const dup = await prisma.category.findUnique({
      where: { channelId_slug: { channelId, slug } },
    });
    if (dup) throw ApiError.conflict("A category with this slug already exists in this channel");
  }

  let updated;
  try {
    updated = await prisma.category.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(slug !== undefined && { slug }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { _count: { select: { videoLinks: true } } },
    });
  } catch (err) {
    console.warn("[categories] update: reload without video count", err);
    updated = await prisma.category.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(slug !== undefined && { slug }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    updated = { ...updated, _count: { videoLinks: 0 } };
  }

  res.json({ status: "success", data: updated });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const { channelId, id } = req.params;

  const category = await prisma.category.findFirst({
    where: { id, channelId },
  });
  if (!category) throw ApiError.notFound("Category not found");

  try {
    await prisma.videoCategory.deleteMany({ where: { categoryId: id } });
  } catch (err) {
    console.warn("[categories] delete: skip VideoCategory cleanup", err);
  }

  await prisma.category.delete({ where: { id } });

  res.json({ status: "success", message: "Category deleted" });
});

export const reorder = asyncHandler(async (req: Request, res: Response) => {
  const { channelId } = req.params;
  const { ids } = req.body;

  if (!Array.isArray(ids)) throw ApiError.badRequest("ids must be an array");

  await prisma.$transaction(
    ids.map((id: string, idx: number) =>
      prisma.category.update({
        where: { id },
        data: { sortOrder: idx },
      }),
    ),
  );

  res.json({ status: "success" });
});
