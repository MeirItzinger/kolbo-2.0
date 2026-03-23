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

export const list = asyncHandler(async (_req: Request, res: Response) => {
  const elements = await prisma.homepageElement.findMany({
    where: { channelId: null },
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
              channel: { select: { id: true, slug: true, name: true } },
              thumbnailAssets: { where: { type: "POSTER" }, take: 1 },
              videoAssets: {
                select: { muxPlaybackId: true, durationSeconds: true },
                take: 1,
                orderBy: { createdAt: "desc" as const },
              },
            },
          },
        },
      },
    },
  });

  const enriched = elements.map((el) => ({
    ...el,
    items: el.items.map((item) => ({
      ...item,
      video: item.video ? addVideoComputedFields(item.video as unknown as Record<string, unknown>) : null,
    })),
  }));

  res.json({ status: "success", data: enriched });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const element = await prisma.homepageElement.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          video: {
            select: { id: true, slug: true, title: true, status: true },
          },
        },
      },
    },
  });

  if (!element) throw ApiError.notFound("Homepage element not found");

  res.json({ status: "success", data: element });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { type, title, subtitle, imageUrl, text, sortOrder, isActive, items } =
    req.body;

  if (!type) throw ApiError.badRequest("type is required");

  const maxOrder = await prisma.homepageElement.aggregate({
    _max: { sortOrder: true },
  });
  const nextOrder = sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1;

  const element = await prisma.$transaction(async (tx) => {
    const created = await tx.homepageElement.create({
      data: {
        type,
        title: title || null,
        subtitle: subtitle || null,
        imageUrl: imageUrl || null,
        text: text || null,
        sortOrder: nextOrder,
        isActive: isActive ?? true,
      },
    });

    if (items?.length) {
      await tx.homepageElementItem.createMany({
        data: items.map(
          (
            item: { videoId?: string; sortOrder?: number },
            index: number,
          ) => ({
            homepageElementId: created.id,
            videoId: item.videoId || null,
            sortOrder: item.sortOrder ?? index,
          }),
        ),
      });
    }

    return created;
  });

  const full = await prisma.homepageElement.findUnique({
    where: { id: element.id },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          video: {
            select: { id: true, slug: true, title: true, status: true },
          },
        },
      },
    },
  });

  res.status(201).json({ status: "success", data: full });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, subtitle, imageUrl, text, sortOrder, isActive, items } =
    req.body;

  const element = await prisma.homepageElement.findUnique({ where: { id } });
  if (!element) throw ApiError.notFound("Homepage element not found");

  await prisma.$transaction(async (tx) => {
    await tx.homepageElement.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title || null }),
        ...(subtitle !== undefined && { subtitle: subtitle || null }),
        ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
        ...(text !== undefined && { text: text || null }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    if (items !== undefined) {
      await tx.homepageElementItem.deleteMany({
        where: { homepageElementId: id },
      });
      if (items.length) {
        await tx.homepageElementItem.createMany({
          data: items.map(
            (
              item: { videoId?: string; sortOrder?: number },
              index: number,
            ) => ({
              homepageElementId: id,
              videoId: item.videoId || null,
              sortOrder: item.sortOrder ?? index,
            }),
          ),
        });
      }
    }
  });

  const full = await prisma.homepageElement.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          video: {
            select: { id: true, slug: true, title: true, status: true },
          },
        },
      },
    },
  });

  res.json({ status: "success", data: full });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const element = await prisma.homepageElement.findUnique({ where: { id } });
  if (!element) throw ApiError.notFound("Homepage element not found");

  await prisma.homepageElement.delete({ where: { id } });

  res.json({ status: "success", message: "Homepage element deleted" });
});

export const reorder = asyncHandler(async (req: Request, res: Response) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    throw ApiError.badRequest("ids array is required");
  }

  await prisma.$transaction(
    ids.map((id: string, index: number) =>
      prisma.homepageElement.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );

  res.json({ status: "success", message: "Reordered" });
});
