import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { prisma } from "../lib/prisma";

const elementInclude = {
  items: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      video: {
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          durationSeconds: true,
          channel: { select: { id: true, slug: true, name: true } },
          thumbnailAssets: { where: { type: "POSTER" as const }, take: 1 },
          videoAssets: {
            select: { muxPlaybackId: true, durationSeconds: true },
            take: 1,
            orderBy: { createdAt: "desc" as const },
          },
        },
      },
    },
  },
};

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

function enrichElements(elements: any[]) {
  return elements.map((el) => ({
    ...el,
    items: (el.items ?? []).map((item: any) => ({
      ...item,
      video: item.video ? addVideoComputedFields(item.video) : null,
    })),
  }));
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { channelId } = req.params;

  const elements = await prisma.homepageElement.findMany({
    where: { channelId },
    orderBy: { sortOrder: "asc" },
    include: elementInclude,
  });

  res.json({ status: "success", data: enrichElements(elements) });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { channelId } = req.params;
  const { type, title, subtitle, imageUrl, text, sortOrder, isActive, items } =
    req.body;

  if (!type) throw ApiError.badRequest("type is required");

  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) throw ApiError.notFound("Channel not found");

  const maxOrder = await prisma.homepageElement.aggregate({
    where: { channelId },
    _max: { sortOrder: true },
  });
  const nextOrder = sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1;

  const element = await prisma.$transaction(async (tx) => {
    const created = await tx.homepageElement.create({
      data: {
        type,
        channelId,
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
          (item: { videoId?: string; sortOrder?: number }, index: number) => ({
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
    include: elementInclude,
  });

  res.status(201).json({ status: "success", data: full });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { channelId, id } = req.params;
  const { title, subtitle, imageUrl, text, sortOrder, isActive, items } =
    req.body;

  const element = await prisma.homepageElement.findFirst({
    where: { id, channelId },
  });
  if (!element) throw ApiError.notFound("Channel page element not found");

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
            (item: { videoId?: string; sortOrder?: number }, index: number) => ({
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
    include: elementInclude,
  });

  res.json({ status: "success", data: full });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const { channelId, id } = req.params;

  const element = await prisma.homepageElement.findFirst({
    where: { id, channelId },
  });
  if (!element) throw ApiError.notFound("Channel page element not found");

  await prisma.homepageElement.delete({ where: { id } });

  res.json({ status: "success", message: "Channel page element deleted" });
});

export const reorder = asyncHandler(async (req: Request, res: Response) => {
  const { channelId } = req.params;
  const { ids, items } = req.body;

  // Unified reorder: accepts { items: [{ kind: "element"|"category", id }] }
  // Falls back to legacy { ids: string[] } for backward compat.
  if (Array.isArray(items) && items.length > 0) {
    const ops: ReturnType<typeof prisma.homepageElement.update>[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i] as { kind: string; id: string };
      if (item.kind === "category") {
        ops.push(
          prisma.category.update({
            where: { id: item.id },
            data: { sortOrder: i },
          }) as any,
        );
      } else {
        ops.push(
          prisma.homepageElement.update({
            where: { id: item.id },
            data: { sortOrder: i },
          }),
        );
      }
    }
    await prisma.$transaction(ops);
    return res.json({ status: "success", message: "Reordered" });
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    throw ApiError.badRequest("ids or items array is required");
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
