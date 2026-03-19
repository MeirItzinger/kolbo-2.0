import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { prisma } from "../lib/prisma";
import { stripe } from "../lib/stripe";
import { syncMuxAssetOnDemand } from "../services/mux/muxService";
import type { Prisma } from "@prisma/client";

async function ensureVideoStripeProduct(videoId: string, videoTitle: string): Promise<string> {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { stripeProductId: true },
  });

  if (video?.stripeProductId) {
    await stripe.products.update(video.stripeProductId, { name: videoTitle }).catch(() => {});
    return video.stripeProductId;
  }

  const product = await stripe.products.create({
    name: videoTitle,
    metadata: { type: "video", videoId },
  });

  await prisma.video.update({
    where: { id: videoId },
    data: { stripeProductId: product.id },
  });

  return product.id;
}

async function syncOptionPrices(
  stripeProductId: string,
  rentals: Array<{ id: string; name: string; price: number; rentalHours: number; currency: string }>,
  purchases: Array<{ id: string; name: string; price: number; currency: string }>
) {
  for (const r of rentals) {
    const stripePrice = await stripe.prices.create({
      product: stripeProductId,
      unit_amount: Math.round(r.price * 100),
      currency: r.currency,
      nickname: `${r.name} (${r.rentalHours}hr rental)`,
      metadata: { type: "rental", rentalOptionId: r.id, rentalHours: String(r.rentalHours) },
    });
    await prisma.rentalOption.update({
      where: { id: r.id },
      data: { stripePriceId: stripePrice.id },
    });
  }

  for (const p of purchases) {
    const stripePrice = await stripe.prices.create({
      product: stripeProductId,
      unit_amount: Math.round(p.price * 100),
      currency: p.currency,
      nickname: p.name,
      metadata: { type: "purchase", purchaseOptionId: p.id },
    });
    await prisma.purchaseOption.update({
      where: { id: p.id },
      data: { stripePriceId: stripePrice.id },
    });
  }
}

async function deactivateOptionPrices(videoId: string) {
  const rentals = await prisma.rentalOption.findMany({ where: { videoId } });
  for (const r of rentals) {
    if (r.stripePriceId) await stripe.prices.update(r.stripePriceId, { active: false }).catch(() => {});
  }
  const purchases = await prisma.purchaseOption.findMany({ where: { videoId } });
  for (const p of purchases) {
    if (p.stripePriceId) await stripe.prices.update(p.stripePriceId, { active: false }).catch(() => {});
  }
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = "1",
    limit = "20",
    channelId,
    creatorProfileId,
    status,
    visibility,
    isFree,
    search,
    sortBy = "createdAt",
    order = "desc",
  } = req.query;

  const take = Math.min(Number(limit) || 20, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const where: Prisma.VideoWhereInput = {};
  if (channelId) where.channelId = channelId as string;
  if (creatorProfileId) where.creatorProfileId = creatorProfileId as string;
  if (status) where.status = status as any;
  if (visibility) where.visibility = visibility as any;
  if (isFree !== undefined) where.isFree = isFree === "true";
  if (search) {
    where.OR = [
      { title: { contains: search as string, mode: "insensitive" } },
      { description: { contains: search as string, mode: "insensitive" } },
    ];
  }

  const allowedSortFields = ["createdAt", "title", "publishedAt", "durationSeconds"];
  const sortField = allowedSortFields.includes(sortBy as string)
    ? (sortBy as string)
    : "createdAt";

  const [videos, total] = await Promise.all([
    prisma.video.findMany({
      where,
      skip,
      take,
      orderBy: { [sortField]: order === "asc" ? "asc" : "desc" },
      include: {
        channel: { select: { id: true, slug: true, name: true } },
        creatorProfile: { select: { id: true, slug: true, displayName: true } },
        category: { select: { id: true, name: true, slug: true } },
        thumbnailAssets: { where: { type: "POSTER" }, take: 1 },
        videoAssets: {
          select: { id: true, assetStatus: true, durationSeconds: true },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.video.count({ where }),
  ]);

  res.json({
    status: "success",
    data: videos,
    meta: { page: Number(page) || 1, limit: take, total },
  });
});

export const getByIdOrSlug = asyncHandler(
  async (req: Request, res: Response) => {
    const { idOrSlug } = req.params;

    const video = await prisma.video.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: {
        channel: { select: { id: true, slug: true, name: true } },
        creatorProfile: { select: { id: true, slug: true, displayName: true } },
        category: { select: { id: true, name: true, slug: true } },
        videoAssets: { orderBy: { createdAt: "desc" } },
        thumbnailAssets: true,
        tagAssignments: { include: { tag: true } },
        videoAccessRules: {
          include: {
            subscriptionPlan: {
              select: {
                id: true,
                name: true,
                priceVariants: { where: { isActive: true }, orderBy: { price: "asc" }, take: 1 },
              },
            },
            bundle: { select: { id: true, name: true } },
            rentalOption: { select: { id: true, name: true, price: true, rentalHours: true } },
            purchaseOption: { select: { id: true, name: true, price: true } },
          },
        },
        rentalOptions: { where: { isActive: true } },
        purchaseOptions: { where: { isActive: true } },
      },
    });

    if (!video) throw ApiError.notFound("Video not found");

    const staleAsset = video.videoAssets.find(
      (a) => a.assetStatus !== "READY" && a.muxUploadId
    );
    if (staleAsset?.muxUploadId) {
      const synced = await syncMuxAssetOnDemand(staleAsset.muxUploadId);
      if (synced) {
        const refreshed = await prisma.videoAsset.findUnique({
          where: { id: staleAsset.id },
        });
        if (refreshed) {
          const idx = video.videoAssets.findIndex((a) => a.id === staleAsset.id);
          if (idx !== -1) video.videoAssets[idx] = refreshed;
        }
      }
    }

    res.json({ status: "success", data: video });
  }
);

export const create = asyncHandler(async (req: Request, res: Response) => {
  const {
    slug,
    channelId,
    creatorProfileId,
    categoryId,
    title,
    description,
    shortDescription,
    visibility,
    isFree,
    freeWithAds,
    cheaperWithAdsAllowed,
    hasPrerollAds,
    hasMidrollAds,
    allowDownload,
    previewText,
    tagIds,
  } = req.body;

  const existingSlug = await prisma.video.findUnique({ where: { slug } });
  if (existingSlug) throw ApiError.conflict("A video with this slug already exists");

  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) throw ApiError.notFound("Channel not found");

  const { rentalOptions, purchaseOptions } = req.body;

  const video = await prisma.$transaction(async (tx) => {
    const created = await tx.video.create({
      data: {
        slug,
        channelId,
        creatorProfileId: creatorProfileId || null,
        categoryId: categoryId || null,
        title,
        description,
        shortDescription,
        visibility: visibility || "PUBLIC",
        isFree: isFree || false,
        freeWithAds: freeWithAds || false,
        cheaperWithAdsAllowed: cheaperWithAdsAllowed || false,
        hasPrerollAds: hasPrerollAds || false,
        hasMidrollAds: hasMidrollAds || false,
        allowDownload: allowDownload || false,
        previewText,
        createdByUserId: req.user!.id,
        status: "DRAFT",
      },
    });

    if (tagIds?.length) {
      await tx.videoTagAssignment.createMany({
        data: tagIds.map((tagId: string) => ({
          videoId: created.id,
          tagId,
        })),
        skipDuplicates: true,
      });
    }

    if (rentalOptions?.length) {
      await tx.rentalOption.createMany({
        data: rentalOptions.map((r: any) => ({
          videoId: created.id,
          name: r.name || "Rental",
          rentalHours: Number(r.rentalHours) || 48,
          price: Number(r.price) || 0,
          currency: r.currency || "usd",
        })),
      });
    }

    if (purchaseOptions?.length) {
      await tx.purchaseOption.createMany({
        data: purchaseOptions.map((p: any) => ({
          videoId: created.id,
          name: p.name || "Purchase",
          price: Number(p.price) || 0,
          currency: p.currency || "usd",
        })),
      });
    }

    return created;
  });

  const createdRentals = await prisma.rentalOption.findMany({ where: { videoId: video.id } });
  const createdPurchases = await prisma.purchaseOption.findMany({ where: { videoId: video.id } });

  if (createdRentals.length || createdPurchases.length) {
    const productId = await ensureVideoStripeProduct(video.id, title);
    await syncOptionPrices(
      productId,
      createdRentals.map((r) => ({
        id: r.id, name: r.name, price: Number(r.price), rentalHours: r.rentalHours, currency: r.currency,
      })),
      createdPurchases.map((p) => ({
        id: p.id, name: p.name, price: Number(p.price), currency: p.currency,
      }))
    );
  }

  const full = await prisma.video.findUnique({
    where: { id: video.id },
    include: {
      channel: { select: { id: true, slug: true, name: true } },
      tagAssignments: { include: { tag: true } },
      rentalOptions: true,
      purchaseOptions: true,
    },
  });

  res.status(201).json({ status: "success", data: full });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    title,
    description,
    shortDescription,
    status,
    visibility,
    isFree,
    freeWithAds,
    cheaperWithAdsAllowed,
    hasPrerollAds,
    hasMidrollAds,
    allowDownload,
    previewText,
    creatorProfileId,
    categoryId,
    slug,
    channelId,
    tagIds,
    rentalOptions,
    purchaseOptions,
  } = req.body;

  const video = await prisma.video.findUnique({ where: { id } });
  if (!video) throw ApiError.notFound("Video not found");

  const publishedAt =
    status === "PUBLISHED" && video.status !== "PUBLISHED"
      ? new Date()
      : status !== "PUBLISHED" && video.status === "PUBLISHED"
        ? null
        : undefined;

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.video.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(slug !== undefined && { slug }),
        ...(description !== undefined && { description }),
        ...(shortDescription !== undefined && { shortDescription }),
        ...(status !== undefined && { status }),
        ...(publishedAt !== undefined && { publishedAt }),
        ...(visibility !== undefined && { visibility }),
        ...(channelId !== undefined && { channelId }),
        ...(isFree !== undefined && { isFree }),
        ...(freeWithAds !== undefined && { freeWithAds }),
        ...(cheaperWithAdsAllowed !== undefined && { cheaperWithAdsAllowed }),
        ...(hasPrerollAds !== undefined && { hasPrerollAds }),
        ...(hasMidrollAds !== undefined && { hasMidrollAds }),
        ...(allowDownload !== undefined && { allowDownload }),
        ...(previewText !== undefined && { previewText }),
        ...(creatorProfileId !== undefined && { creatorProfileId }),
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
        updatedByUserId: req.user!.id,
      },
    });

    if (tagIds !== undefined) {
      await tx.videoTagAssignment.deleteMany({ where: { videoId: id } });
      if (tagIds.length) {
        await tx.videoTagAssignment.createMany({
          data: tagIds.map((tagId: string) => ({ videoId: id, tagId })),
          skipDuplicates: true,
        });
      }
    }

    if (rentalOptions !== undefined) {
      await deactivateOptionPrices(id);
      await tx.rentalOption.deleteMany({ where: { videoId: id } });
      if (rentalOptions.length) {
        await tx.rentalOption.createMany({
          data: rentalOptions.map((r: any) => ({
            videoId: id,
            name: r.name || "Rental",
            rentalHours: Number(r.rentalHours) || 48,
            price: Number(r.price) || 0,
            currency: r.currency || "usd",
          })),
        });
      }
    }

    if (purchaseOptions !== undefined && rentalOptions === undefined) {
      const purchases = await tx.purchaseOption.findMany({ where: { videoId: id } });
      for (const p of purchases) {
        if (p.stripePriceId) await stripe.prices.update(p.stripePriceId, { active: false }).catch(() => {});
      }
      await tx.purchaseOption.deleteMany({ where: { videoId: id } });
      if (purchaseOptions.length) {
        await tx.purchaseOption.createMany({
          data: purchaseOptions.map((p: any) => ({
            videoId: id,
            name: p.name || "Purchase",
            price: Number(p.price) || 0,
            currency: p.currency || "usd",
          })),
        });
      }
    }

    return result;
  });

  const videoTitle = title ?? video.title;
  const hasNewRentals = rentalOptions !== undefined && rentalOptions.length;
  const hasNewPurchases = purchaseOptions !== undefined && purchaseOptions.length;

  if (hasNewRentals || hasNewPurchases) {
    const productId = await ensureVideoStripeProduct(id, videoTitle);
    const newRentals = hasNewRentals
      ? await prisma.rentalOption.findMany({ where: { videoId: id } })
      : [];
    const newPurchases = hasNewPurchases
      ? await prisma.purchaseOption.findMany({ where: { videoId: id } })
      : [];
    await syncOptionPrices(
      productId,
      newRentals.map((r) => ({
        id: r.id, name: r.name, price: Number(r.price), rentalHours: r.rentalHours, currency: r.currency,
      })),
      newPurchases.map((p) => ({
        id: p.id, name: p.name, price: Number(p.price), currency: p.currency,
      }))
    );
  }

  const full = await prisma.video.findUnique({
    where: { id },
    include: {
      channel: { select: { id: true, slug: true, name: true } },
      tagAssignments: { include: { tag: true } },
      rentalOptions: true,
      purchaseOptions: true,
      videoAssets: { orderBy: { createdAt: "desc" } },
    },
  });

  res.json({ status: "success", data: full });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const video = await prisma.video.findUnique({ where: { id } });
  if (!video) throw ApiError.notFound("Video not found");

  await prisma.video.delete({ where: { id } });

  res.json({ status: "success", message: "Video deleted" });
});

export const bulkRemove = asyncHandler(async (req: Request, res: Response) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    throw ApiError.badRequest("ids must be a non-empty array");
  }

  const { count } = await prisma.video.deleteMany({
    where: { id: { in: ids } },
  });

  res.json({ status: "success", message: `${count} video(s) deleted` });
});

export const publish = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const video = await prisma.video.findUnique({
    where: { id },
    include: {
      videoAssets: { where: { assetStatus: "READY" }, take: 1 },
    },
  });
  if (!video) throw ApiError.notFound("Video not found");

  if (!video.videoAssets.length) {
    throw ApiError.badRequest("Cannot publish a video without a ready asset");
  }

  const updated = await prisma.video.update({
    where: { id },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
      updatedByUserId: req.user!.id,
    },
  });

  res.json({ status: "success", data: updated });
});

export const schedule = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { publishAt } = req.body;

  const video = await prisma.video.findUnique({ where: { id } });
  if (!video) throw ApiError.notFound("Video not found");

  const scheduledDate = new Date(publishAt);
  if (scheduledDate <= new Date()) {
    throw ApiError.badRequest("Scheduled date must be in the future");
  }

  await prisma.$transaction([
    prisma.video.update({
      where: { id },
      data: {
        status: "SCHEDULED",
        scheduledPublishAt: scheduledDate,
        updatedByUserId: req.user!.id,
      },
    }),
    prisma.scheduledPublication.create({
      data: {
        videoId: id,
        publishAt: scheduledDate,
        status: "PENDING",
      },
    }),
  ]);

  const updated = await prisma.video.findUnique({ where: { id } });

  res.json({ status: "success", data: updated });
});

export const duplicate = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const source = await prisma.video.findUnique({
    where: { id },
    include: {
      tagAssignments: true,
      videoAccessRules: true,
    },
  });
  if (!source) throw ApiError.notFound("Video not found");

  const newSlug = `${source.slug}-copy-${Date.now()}`;

  const duplicated = await prisma.$transaction(async (tx) => {
    const created = await tx.video.create({
      data: {
        slug: newSlug,
        channelId: source.channelId,
        creatorProfileId: source.creatorProfileId,
        title: `${source.title} (Copy)`,
        description: source.description,
        shortDescription: source.shortDescription,
        visibility: "PRIVATE",
        isFree: source.isFree,
        freeWithAds: source.freeWithAds,
        cheaperWithAdsAllowed: source.cheaperWithAdsAllowed,
        hasPrerollAds: source.hasPrerollAds,
        hasMidrollAds: source.hasMidrollAds,
        allowDownload: source.allowDownload,
        previewText: source.previewText,
        createdByUserId: req.user!.id,
        status: "DRAFT",
      },
    });

    if (source.tagAssignments.length) {
      await tx.videoTagAssignment.createMany({
        data: source.tagAssignments.map((ta) => ({
          videoId: created.id,
          tagId: ta.tagId,
        })),
      });
    }

    if (source.videoAccessRules.length) {
      await tx.videoAccessRule.createMany({
        data: source.videoAccessRules.map((rule) => ({
          videoId: created.id,
          accessType: rule.accessType,
          subscriptionPlanId: rule.subscriptionPlanId,
          bundleId: rule.bundleId,
          rentalOptionId: rule.rentalOptionId,
          purchaseOptionId: rule.purchaseOptionId,
          channelId: rule.channelId,
        })),
      });
    }

    return created;
  });

  res.status(201).json({ status: "success", data: duplicated });
});

export const setTrailer = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { trailerVideoId } = req.body;

  const video = await prisma.video.findUnique({ where: { id } });
  if (!video) throw ApiError.notFound("Video not found");

  if (trailerVideoId) {
    const trailer = await prisma.video.findUnique({
      where: { id: trailerVideoId },
    });
    if (!trailer) throw ApiError.notFound("Trailer video not found");
    if (trailerVideoId === id) {
      throw ApiError.badRequest("A video cannot be its own trailer");
    }
  }

  const updated = await prisma.video.update({
    where: { id },
    data: {
      trailerVideoId: trailerVideoId || null,
      updatedByUserId: req.user!.id,
    },
  });

  res.json({ status: "success", data: updated });
});
