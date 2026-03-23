import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { prisma } from "../lib/prisma";

function addVideoComputedFields(video: Record<string, unknown>) {
  const thumbnailAssets = video.thumbnailAssets as { imageUrl: string }[] | undefined;
  const videoAssets = video.videoAssets as { muxPlaybackId?: string | null; durationSeconds?: number | null }[] | undefined;
  const uploadedThumb = thumbnailAssets?.[0]?.imageUrl ?? null;
  const muxPlaybackId = videoAssets?.[0]?.muxPlaybackId ?? null;
  const muxThumb = muxPlaybackId
    ? `https://image.mux.com/${muxPlaybackId}/thumbnail.jpg?width=640&height=360&fit_mode=smartcrop`
    : null;
  return {
    ...video,
    thumbnailUrl: uploadedThumb ?? muxThumb,
    duration: (video.durationSeconds as number | null) ?? videoAssets?.[0]?.durationSeconds ?? null,
  };
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { channelId, scopeType, active } = req.query;

  const where: Record<string, unknown> = {};
  if (channelId) where.channelId = channelId as string;
  if (scopeType) where.scopeType = scopeType as string;
  if (active !== undefined) where.isActive = active === "true";

  const rows = await prisma.contentRow.findMany({
    where,
    orderBy: { sortOrder: "asc" },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          video: {
            select: {
              id: true,
              slug: true,
              title: true,
              status: true,
              durationSeconds: true,
              isFree: true,
              thumbnailAssets: { where: { type: "POSTER" }, take: 1 },
              videoAssets: {
                select: { muxPlaybackId: true, durationSeconds: true },
                take: 1,
                orderBy: { createdAt: "desc" as const },
              },
            },
          },
          channel: { select: { id: true, slug: true, name: true } },
          thumbnailAsset: true,
        },
      },
    },
  });

  const enriched = rows.map((row) => ({
    ...row,
    items: row.items.map((item) => ({
      ...item,
      video: item.video ? addVideoComputedFields(item.video) : null,
    })),
  }));

  res.json({ status: "success", data: enriched });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const row = await prisma.contentRow.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          video: {
            select: { id: true, slug: true, title: true, status: true },
          },
          channel: { select: { id: true, slug: true, name: true } },
          thumbnailAsset: true,
        },
      },
    },
  });

  if (!row) throw ApiError.notFound("Content row not found");

  res.json({ status: "success", data: row });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { scopeType, channelId, title, subtitle, sortOrder, isActive, items } =
    req.body;

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.contentRow.create({
      data: {
        scopeType,
        channelId: channelId || null,
        title,
        subtitle,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
      },
    });

    if (items?.length) {
      await tx.contentRowItem.createMany({
        data: items.map(
          (
            item: { videoId?: string; channelId?: string; thumbnailAssetId?: string; sortOrder?: number },
            index: number
          ) => ({
            contentRowId: created.id,
            videoId: item.videoId || null,
            channelId: item.channelId || null,
            thumbnailAssetId: item.thumbnailAssetId || null,
            sortOrder: item.sortOrder ?? index,
          })
        ),
      });
    }

    return created;
  });

  const full = await prisma.contentRow.findUnique({
    where: { id: row.id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  res.status(201).json({ status: "success", data: full });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, subtitle, sortOrder, isActive, items } = req.body;

  const row = await prisma.contentRow.findUnique({ where: { id } });
  if (!row) throw ApiError.notFound("Content row not found");

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.contentRow.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(subtitle !== undefined && { subtitle }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    if (items !== undefined) {
      await tx.contentRowItem.deleteMany({ where: { contentRowId: id } });
      if (items.length) {
        await tx.contentRowItem.createMany({
          data: items.map(
            (
              item: { videoId?: string; channelId?: string; thumbnailAssetId?: string; sortOrder?: number },
              index: number
            ) => ({
              contentRowId: id,
              videoId: item.videoId || null,
              channelId: item.channelId || null,
              thumbnailAssetId: item.thumbnailAssetId || null,
              sortOrder: item.sortOrder ?? index,
            })
          ),
        });
      }
    }

    return result;
  });

  const full = await prisma.contentRow.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  res.json({ status: "success", data: full });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const row = await prisma.contentRow.findUnique({ where: { id } });
  if (!row) throw ApiError.notFound("Content row not found");

  await prisma.contentRow.delete({ where: { id } });

  res.json({ status: "success", message: "Content row deleted" });
});
