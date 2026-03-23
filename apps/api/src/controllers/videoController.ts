import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { prisma } from "../lib/prisma";
import { stripe } from "../lib/stripe";
import { syncMuxAssetOnDemand, createSignedPlaybackToken } from "../services/mux/muxService";
import { checkAccess } from "../services/access/accessService";
import type { Prisma } from "@prisma/client";

type DbClient = Prisma.TransactionClient;

/**
 * When a CHANNEL_ADMIN or CREATOR_ADMIN lists videos with a Bearer token,
 * restrict results to videos they manage. SUPER_ADMIN and unauthenticated
 * requests are unchanged (public catalog).
 */
function staffVideoListScope(
  user: NonNullable<Request["user"]>,
): Prisma.VideoWhereInput | null {
  const isSuper = user.roles.some((r) => r.key === "SUPER_ADMIN");
  if (isSuper) return null;

  const hasChannelAdmin = user.roles.some((r) => r.key === "CHANNEL_ADMIN");
  const hasCreatorAdmin = user.roles.some((r) => r.key === "CREATOR_ADMIN");
  if (!hasChannelAdmin && !hasCreatorAdmin) return null;

  const channelIds = [
    ...new Set(
      user.roles
        .filter((r) => r.key === "CHANNEL_ADMIN" && r.channelId)
        .map((r) => r.channelId!),
    ),
  ];
  const creatorProfileIds = [
    ...new Set(
      user.roles
        .filter((r) => r.key === "CREATOR_ADMIN" && r.creatorProfileId)
        .map((r) => r.creatorProfileId!),
    ),
  ];

  const or: Prisma.VideoWhereInput[] = [];
  if (channelIds.length) or.push({ channelId: { in: channelIds } });
  if (creatorProfileIds.length)
    or.push({ creatorProfileId: { in: creatorProfileIds } });
  if (or.length === 0) return null;
  return { OR: or };
}

/** Categories on a video (many-to-many via VideoCategory). */
const videoCategoryInclude = {
  categoryLinks: {
    include: { category: { select: { id: true, name: true, slug: true } } },
  },
} as const;

function normalizeCategoryIdsFromBody(body: Record<string, unknown>): string[] | undefined {
  if (Array.isArray(body.categoryIds)) {
    return [
      ...new Set(
        body.categoryIds.filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    ];
  }
  if (body.categoryId !== undefined) {
    const single = body.categoryId as string | null;
    return single ? [single] : [];
  }
  return undefined;
}

async function setVideoCategories(
  tx: DbClient,
  videoId: string,
  channelId: string,
  categoryIds: string[],
) {
  const unique = [...new Set(categoryIds)];
  if (unique.length > 0) {
    const count = await tx.category.count({
      where: { id: { in: unique }, channelId },
    });
    if (count !== unique.length) {
      throw ApiError.badRequest("One or more categories are invalid for this channel");
    }
  }
  await tx.videoCategory.deleteMany({ where: { videoId } });
  if (unique.length > 0) {
    await tx.videoCategory.createMany({
      data: unique.map((categoryId) => ({ videoId, categoryId })),
      skipDuplicates: true,
    });
  }
}

/** If `VideoCategory` table is missing or DB is out of sync, don’t fail the whole request. */
async function setVideoCategoriesSafe(
  tx: DbClient,
  videoId: string,
  channelId: string,
  categoryIds: string[],
) {
  try {
    await setVideoCategories(tx, videoId, channelId, categoryIds);
  } catch (err) {
    console.warn(
      "[videos] Skipping category assignment (is the VideoCategory migration applied?).",
      err,
    );
  }
}

/** Single-video API include — optional category join for resilience when join table is missing. */
function buildVideoSingleInclude(includeCategories: boolean): Prisma.VideoInclude {
  return {
    channel: { select: { id: true, slug: true, name: true } },
    creatorProfile: { select: { id: true, slug: true, displayName: true } },
    ...(includeCategories ? videoCategoryInclude : {}),
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
  };
}

function attachCategoriesToVideo(video: Record<string, unknown>) {
  const links =
    (video.categoryLinks as { category: { id: string; name: string; slug: string } }[] | undefined) ??
    [];
  const { categoryLinks, ...rest } = video;
  return addComputedFields({
    ...rest,
    categories: links.map((l) => l.category),
  });
}

function addComputedFields(video: Record<string, unknown>) {
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

/** Express may type `req.params.id` as `string | string[]` — normalize for Prisma. */
function routeParamString(param: string | string[] | undefined): string {
  if (param == null) return "";
  return typeof param === "string" ? param : String(param[0] ?? "");
}

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
    forAdmin,
    categoryId,
  } = req.query;

  const take = Math.min(Number(limit) || 20, 250);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  let where: Prisma.VideoWhereInput = {};
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
  if (categoryId) {
    where.categoryLinks = { some: { categoryId: categoryId as string } };
  }

  const adminListRequest =
    forAdmin === "true" || forAdmin === "1";
  const staffScope =
    adminListRequest && req.user
      ? staffVideoListScope(req.user)
      : null;
  if (staffScope) {
    const parts: Prisma.VideoWhereInput[] = [];
    if (Object.keys(where).length > 0) parts.push(where);
    parts.push(staffScope);
    where = parts.length === 1 ? staffScope : { AND: parts };
  }

  const allowedSortFields = ["createdAt", "title", "publishedAt", "durationSeconds"];
  const sortField = allowedSortFields.includes(sortBy as string)
    ? (sortBy as string)
    : "createdAt";

  const baseInclude = {
    channel: { select: { id: true, slug: true, name: true } },
    creatorProfile: { select: { id: true, slug: true, displayName: true } },
    thumbnailAssets: { where: { type: "POSTER" as const }, take: 1 },
    videoAssets: {
      select: { id: true, assetStatus: true, durationSeconds: true, muxPlaybackId: true },
      take: 1,
      orderBy: { createdAt: "desc" as const },
    },
  };

  const [videos, total] = await (async () => {
    try {
      return await Promise.all([
        prisma.video.findMany({
          where,
          skip,
          take,
          orderBy: { [sortField]: order === "asc" ? "asc" : "desc" },
          include: { ...baseInclude, ...videoCategoryInclude },
        }),
        prisma.video.count({ where }),
      ]);
    } catch {
      return await Promise.all([
        prisma.video.findMany({
          where,
          skip,
          take,
          orderBy: { [sortField]: order === "asc" ? "asc" : "desc" },
          include: baseInclude,
        }),
        prisma.video.count({ where }),
      ]);
    }
  })();

  res.json({
    status: "success",
    data: videos.map((v) => attachCategoriesToVideo(v as unknown as Record<string, unknown>)),
    meta: { page: Number(page) || 1, limit: take, total },
  });
});

export const getByIdOrSlug = asyncHandler(
  async (req: Request, res: Response) => {
    const raw = req.params.idOrSlug;
    const idOrSlug = typeof raw === "string" ? raw : String(raw?.[0] ?? "");
    const where = { OR: [{ id: idOrSlug }, { slug: idOrSlug }] };

    const video = await (async () => {
      try {
        return await prisma.video.findFirst({
          where,
          include: buildVideoSingleInclude(true),
        });
      } catch (err) {
        console.warn("[videos] getByIdOrSlug: retry without VideoCategory join", err);
        return await prisma.video.findFirst({
          where,
          include: buildVideoSingleInclude(false),
        });
      }
    })();

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

    const access = await checkAccess(req.user?.id ?? null, video.id);
    const payload = attachCategoriesToVideo(
      video as unknown as Record<string, unknown>,
    ) as Record<string, unknown>;

    res.json({
      status: "success",
      data: {
        ...payload,
        playbackAllowed: access.allowed,
      },
    });
  }
);

export const create = asyncHandler(async (req: Request, res: Response) => {
  const {
    slug,
    channelId,
    creatorProfileId,
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

  const categoryIdsForCreate = normalizeCategoryIdsFromBody(req.body) ?? [];

  const video = await prisma.$transaction(async (tx) => {
    const created = await tx.video.create({
      data: {
        slug,
        channelId,
        creatorProfileId: creatorProfileId || null,
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
      await tx.videoAccessRule.create({
        data: { videoId: created.id, accessType: "RENTAL", channelId },
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
      await tx.videoAccessRule.create({
        data: { videoId: created.id, accessType: "PURCHASE", channelId },
      });
    }

    return created;
  });

  await setVideoCategoriesSafe(prisma as unknown as DbClient, video.id, channelId, categoryIdsForCreate);

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

  let full;
  try {
    full = await prisma.video.findUnique({
      where: { id: video.id },
      include: {
        channel: { select: { id: true, slug: true, name: true } },
        ...videoCategoryInclude,
        tagAssignments: { include: { tag: true } },
        rentalOptions: true,
        purchaseOptions: true,
      },
    });
  } catch (err) {
    console.warn("[videos] create response: reload without categories", err);
    full = await prisma.video.findUnique({
      where: { id: video.id },
      include: {
        channel: { select: { id: true, slug: true, name: true } },
        tagAssignments: { include: { tag: true } },
        rentalOptions: true,
        purchaseOptions: true,
      },
    });
  }

  res.status(201).json({
    status: "success",
    data: full ? attachCategoriesToVideo(full as unknown as Record<string, unknown>) : full,
  });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const id = routeParamString(req.params.id);
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
    prerollAd,
    midrollAd,
    allowDownload,
    previewText,
    creatorProfileId,
    slug,
    channelId,
    tagIds,
    rentalOptions,
    purchaseOptions,
    subscriptionGated,
    subscriptionPlanId,
    thumbnailUrl,
  } = req.body;
  const effectiveHasPrerollAds = hasPrerollAds !== undefined ? hasPrerollAds : prerollAd;
  const effectiveHasMidrollAds = hasMidrollAds !== undefined ? hasMidrollAds : midrollAd;

  const video = await prisma.video.findUnique({ where: { id } });
  if (!video) throw ApiError.notFound("Video not found");

  const categoryIdsUpdate = normalizeCategoryIdsFromBody(req.body);

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
        ...(effectiveHasPrerollAds !== undefined && { hasPrerollAds: effectiveHasPrerollAds }),
        ...(effectiveHasMidrollAds !== undefined && { hasMidrollAds: effectiveHasMidrollAds }),
        ...(allowDownload !== undefined && { allowDownload }),
        ...(previewText !== undefined && { previewText }),
        ...(creatorProfileId !== undefined && { creatorProfileId }),
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

    if (subscriptionGated !== undefined) {
      await tx.videoAccessRule.deleteMany({ where: { videoId: id, accessType: "SUBSCRIPTION" } });
      if (subscriptionGated && subscriptionPlanId) {
        await tx.videoAccessRule.create({
          data: { videoId: id, accessType: "SUBSCRIPTION", subscriptionPlanId, channelId: result.channelId },
        });
      }
    }

    if (rentalOptions !== undefined) {
      await deactivateOptionPrices(id);
      await tx.rentalOption.deleteMany({ where: { videoId: id } });
      await tx.videoAccessRule.deleteMany({ where: { videoId: id, accessType: "RENTAL" } });
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
        await tx.videoAccessRule.create({
          data: { videoId: id, accessType: "RENTAL", channelId: result.channelId },
        });
      }
    }

    if (purchaseOptions !== undefined) {
      const purchases = await tx.purchaseOption.findMany({ where: { videoId: id } });
      for (const p of purchases) {
        if (p.stripePriceId) await stripe.prices.update(p.stripePriceId, { active: false }).catch(() => {});
      }
      await tx.purchaseOption.deleteMany({ where: { videoId: id } });
      await tx.videoAccessRule.deleteMany({ where: { videoId: id, accessType: "PURCHASE" } });
      if (purchaseOptions.length) {
        await tx.purchaseOption.createMany({
          data: purchaseOptions.map((p: any) => ({
            videoId: id,
            name: p.name || "Purchase",
            price: Number(p.price) || 0,
            currency: p.currency || "usd",
          })),
        });
        await tx.videoAccessRule.create({
          data: { videoId: id, accessType: "PURCHASE", channelId: result.channelId },
        });
      }
    }

    return result;
  });

  if (categoryIdsUpdate !== undefined) {
    await setVideoCategoriesSafe(prisma as unknown as DbClient, id, updated.channelId, categoryIdsUpdate);
  }

  if (thumbnailUrl !== undefined) {
    await prisma.thumbnailAsset.deleteMany({ where: { videoId: id, type: "POSTER" } });
    if (thumbnailUrl) {
      await prisma.thumbnailAsset.create({
        data: { videoId: id, type: "POSTER", imageUrl: thumbnailUrl },
      });
    }
  }

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

  let full;
  try {
    full = await prisma.video.findUnique({
      where: { id },
      include: {
        channel: { select: { id: true, slug: true, name: true } },
        ...videoCategoryInclude,
        tagAssignments: { include: { tag: true } },
        rentalOptions: true,
        purchaseOptions: true,
        videoAssets: { orderBy: { createdAt: "desc" } },
        videoAccessRules: true,
      },
    });
  } catch (err) {
    console.warn("[videos] update response: reload without categories", err);
    full = await prisma.video.findUnique({
      where: { id },
      include: {
        channel: { select: { id: true, slug: true, name: true } },
        tagAssignments: { include: { tag: true } },
        rentalOptions: true,
        purchaseOptions: true,
        videoAssets: { orderBy: { createdAt: "desc" } },
        videoAccessRules: true,
      },
    });
  }

  res.json({
    status: "success",
    data: full ? attachCategoriesToVideo(full as unknown as Record<string, unknown>) : full,
  });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const id = routeParamString(req.params.id);

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
  const id = routeParamString(req.params.id);

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
  const id = routeParamString(req.params.id);
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
  const id = routeParamString(req.params.id);

  const source = await (async () => {
    try {
      return await prisma.video.findUnique({
        where: { id },
        include: {
          tagAssignments: true,
          videoAccessRules: true,
          categoryLinks: { select: { categoryId: true } },
        },
      });
    } catch (err) {
      console.warn("[videos] duplicate: load source without categoryLinks", err);
      return await prisma.video.findUnique({
        where: { id },
        include: {
          tagAssignments: true,
          videoAccessRules: true,
        },
      });
    }
  })();
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

  const catLinks = (source as { categoryLinks?: { categoryId: string }[] }).categoryLinks;
  if (catLinks?.length) {
    try {
      await prisma.videoCategory.createMany({
        data: catLinks.map((l) => ({
          videoId: duplicated.id,
          categoryId: l.categoryId,
        })),
        skipDuplicates: true,
      });
    } catch (err) {
      console.warn("[videos] duplicate: skip copying categories", err);
    }
  }

  res.status(201).json({ status: "success", data: duplicated });
});

/** Mux playback id + optional signed JWT for in-admin preview (no subscription / watch session). */
export const getAdminPreviewPlayback = asyncHandler(
  async (req: Request, res: Response) => {
    const id = routeParamString(req.params.id);
    const user = req.user;
    if (!user) throw ApiError.unauthorized();

    const video = await prisma.video.findUnique({
      where: { id },
      select: { id: true, channelId: true, title: true },
    });
    if (!video) throw ApiError.notFound("Video not found");

    const isSuperAdmin = user.roles.some((r) => r.key === "SUPER_ADMIN");
    const canChannelAdmin = user.roles.some(
      (r) => r.key === "CHANNEL_ADMIN" && r.channelId === video.channelId,
    );
    if (!isSuperAdmin && !canChannelAdmin) {
      throw ApiError.forbidden("You cannot preview this video");
    }

    const asset = await prisma.videoAsset.findFirst({
      where: { videoId: id, assetStatus: "READY" },
      orderBy: { createdAt: "desc" },
      select: { muxPlaybackId: true, playbackPolicy: true },
    });
    if (!asset?.muxPlaybackId) {
      throw ApiError.badRequest(
        "No ready playback asset yet. Wait for processing or upload a file.",
      );
    }

    let token: string | null = null;
    if (asset.playbackPolicy === "SIGNED") {
      token = createSignedPlaybackToken(asset.muxPlaybackId, user.id);
    }

    res.json({
      status: "success",
      data: {
        playbackId: asset.muxPlaybackId,
        token,
      },
    });
  },
);

export const setTrailer = asyncHandler(async (req: Request, res: Response) => {
  const id = routeParamString(req.params.id);
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
