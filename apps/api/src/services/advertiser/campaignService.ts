import { prisma } from "../../lib/prisma";
import { mux } from "../../lib/mux";
import { ApiError } from "../../utils/apiError";
import { assertAdvertiserHasChargeableCard } from "./advertiserBilling";

interface GeoTargetInput {
  type: "CITY" | "ZIP_CODE";
  value: string;
}

interface CreateCampaignInput {
  name: string;
  totalBudget: number;
  dailyMaxSpend: number;
  targetAgeMin?: number;
  targetAgeMax?: number;
  startDate?: string;
  endDate?: string;
  geoTargets?: GeoTargetInput[];
  channelIds?: string[];
}

/**
 * Channels where ads can run: published videos with direct ad slots
 * (free with ads / preroll / midroll), OR published videos gated by a
 * subscription plan that has an active "with ads" (cheaper) price variant.
 */
export async function getAdEligibleChannels() {
  const channels = await prisma.channel.findMany({
    where: {
      isActive: true,
      OR: [
        {
          videos: {
            some: {
              status: "PUBLISHED",
              OR: [
                { freeWithAds: true },
                { hasPrerollAds: true },
                { hasMidrollAds: true },
              ],
            },
          },
        },
        {
          subscriptionPlans: {
            some: {
              isActive: true,
              priceVariants: {
                some: { adTier: "WITH_ADS", isActive: true },
              },
              videoAccessRules: {
                some: {
                  accessType: "SUBSCRIPTION",
                  video: { status: "PUBLISHED" },
                },
              },
            },
          },
        },
      ],
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      logoUrl: true,
    },
  });

  const withCounts = await Promise.all(
    channels.map(async (ch) => {
      const videos = await prisma.video.count({
        where: {
          channelId: ch.id,
          status: "PUBLISHED",
          OR: [
            { freeWithAds: true },
            { hasPrerollAds: true },
            { hasMidrollAds: true },
            {
              videoAccessRules: {
                some: {
                  accessType: "SUBSCRIPTION",
                  subscriptionPlan: {
                    channelId: ch.id,
                    isActive: true,
                    priceVariants: {
                      some: { adTier: "WITH_ADS", isActive: true },
                    },
                  },
                },
              },
            },
          ],
        },
      });
      return { ...ch, _count: { videos } };
    }),
  );

  return withCounts.filter((c) => c._count.videos > 0);
}

export async function createCampaign(
  advertiserId: string,
  input: CreateCampaignInput
) {
  await assertAdvertiserHasChargeableCard(advertiserId);

  const campaign = await prisma.adCampaign.create({
    data: {
      advertiserId,
      name: input.name,
      totalBudget: input.totalBudget,
      dailyMaxSpend: input.dailyMaxSpend,
      targetAgeMin: input.targetAgeMin ?? null,
      targetAgeMax: input.targetAgeMax ?? null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      geoTargets: input.geoTargets?.length
        ? {
            create: input.geoTargets.map((gt) => ({
              type: gt.type,
              value: gt.value.trim(),
            })),
          }
        : undefined,
      channelTargets: input.channelIds?.length
        ? {
            create: input.channelIds.map((channelId) => ({ channelId })),
          }
        : undefined,
    },
    include: {
      geoTargets: true,
      channelTargets: { include: { channel: { select: { id: true, slug: true, name: true, logoUrl: true } } } },
      creatives: true,
    },
  });

  return campaign;
}

export async function updateCampaign(
  campaignId: string,
  advertiserId: string,
  input: Partial<CreateCampaignInput>
) {
  const campaign = await prisma.adCampaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) throw ApiError.notFound("Campaign not found");
  if (campaign.advertiserId !== advertiserId)
    throw ApiError.forbidden("Not your campaign");
  if (!["DRAFT", "REJECTED"].includes(campaign.status))
    throw ApiError.badRequest("Can only edit DRAFT or REJECTED campaigns");

  if (input.geoTargets) {
    await prisma.adGeoTarget.deleteMany({ where: { campaignId } });
    await prisma.adGeoTarget.createMany({
      data: input.geoTargets.map((gt) => ({
        campaignId,
        type: gt.type,
        value: gt.value.trim(),
      })),
    });
  }

  if (input.channelIds) {
    await prisma.adCampaignChannel.deleteMany({ where: { campaignId } });
    if (input.channelIds.length > 0) {
      await prisma.adCampaignChannel.createMany({
        data: input.channelIds.map((channelId) => ({ campaignId, channelId })),
      });
    }
  }

  const updated = await prisma.adCampaign.update({
    where: { id: campaignId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.totalBudget !== undefined && {
        totalBudget: input.totalBudget,
      }),
      ...(input.dailyMaxSpend !== undefined && {
        dailyMaxSpend: input.dailyMaxSpend,
      }),
      ...(input.targetAgeMin !== undefined && {
        targetAgeMin: input.targetAgeMin,
      }),
      ...(input.targetAgeMax !== undefined && {
        targetAgeMax: input.targetAgeMax,
      }),
      ...(input.startDate !== undefined && {
        startDate: input.startDate ? new Date(input.startDate) : null,
      }),
      ...(input.endDate !== undefined && {
        endDate: input.endDate ? new Date(input.endDate) : null,
      }),
      status: "DRAFT",
      rejectionReason: null,
    },
    include: {
      geoTargets: true,
      channelTargets: { include: { channel: { select: { id: true, slug: true, name: true, logoUrl: true } } } },
      creatives: true,
    },
  });

  return updated;
}

const channelTargetInclude = {
  include: { channel: { select: { id: true, slug: true, name: true, logoUrl: true } } },
} as const;

export async function listCampaigns(advertiserId: string) {
  return prisma.adCampaign.findMany({
    where: { advertiserId },
    orderBy: { createdAt: "desc" },
    include: {
      geoTargets: true,
      channelTargets: channelTargetInclude,
      creatives: true,
      _count: { select: { dailyCharges: true } },
    },
  });
}

export async function getCampaign(campaignId: string, advertiserId: string) {
  const campaign = await prisma.adCampaign.findUnique({
    where: { id: campaignId },
    include: {
      geoTargets: true,
      channelTargets: channelTargetInclude,
      creatives: true,
      dailyCharges: { orderBy: { date: "desc" }, take: 30 },
    },
  });

  if (!campaign) throw ApiError.notFound("Campaign not found");
  if (campaign.advertiserId !== advertiserId)
    throw ApiError.forbidden("Not your campaign");

  return campaign;
}

export async function submitForReview(
  campaignId: string,
  advertiserId: string
) {
  const campaign = await prisma.adCampaign.findUnique({
    where: { id: campaignId },
    include: { creatives: true },
  });

  if (!campaign) throw ApiError.notFound("Campaign not found");
  if (campaign.advertiserId !== advertiserId)
    throw ApiError.forbidden("Not your campaign");
  if (!["DRAFT", "REJECTED"].includes(campaign.status))
    throw ApiError.badRequest("Can only submit DRAFT or REJECTED campaigns");

  const readyCreatives = campaign.creatives.filter(
    (c) => c.assetStatus === "READY"
  );
  if (readyCreatives.length === 0) {
    throw ApiError.badRequest(
      "Upload at least one video ad before submitting"
    );
  }

  return prisma.adCampaign.update({
    where: { id: campaignId },
    data: { status: "PENDING_REVIEW", rejectionReason: null },
    include: { geoTargets: true, channelTargets: channelTargetInclude, creatives: true },
  });
}

export async function createAdUpload(
  campaignId: string,
  advertiserId: string,
  corsOrigin: string,
  fileName?: string
) {
  const campaign = await prisma.adCampaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) throw ApiError.notFound("Campaign not found");
  if (campaign.advertiserId !== advertiserId)
    throw ApiError.forbidden("Not your campaign");
  if (!["DRAFT", "REJECTED"].includes(campaign.status))
    throw ApiError.badRequest(
      "Can only upload creatives for DRAFT or REJECTED campaigns"
    );

  const upload = await mux.video.uploads.create({
    cors_origin: corsOrigin,
    new_asset_settings: {
      playback_policy: ["public"],
      video_quality: "basic",
    },
  });

  const creative = await prisma.adCreative.create({
    data: {
      campaignId,
      muxUploadId: upload.id,
      assetStatus: "CREATED",
      fileName: fileName || null,
    },
  });

  pollAdUpload(upload.id, creative.id).catch(() => {});

  return {
    uploadUrl: upload.url,
    uploadId: upload.id,
    creativeId: creative.id,
  };
}

async function pollAdUpload(muxUploadId: string, creativeId: string) {
  const MAX_ATTEMPTS = 120;
  const INTERVAL_MS = 5000;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, INTERVAL_MS));

    try {
      const upload = await mux.video.uploads.retrieve(muxUploadId);

      if (upload.asset_id) {
        const asset = await mux.video.assets.retrieve(upload.asset_id);
        const playbackId = asset.playback_ids?.[0]?.id ?? null;

        await prisma.adCreative.update({
          where: { id: creativeId },
          data: {
            muxAssetId: asset.id,
            muxPlaybackId: playbackId,
            assetStatus:
              asset.status === "ready"
                ? "READY"
                : asset.status === "errored"
                  ? "ERRORED"
                  : "PROCESSING",
            durationSeconds: asset.duration
              ? Math.round(asset.duration)
              : null,
          },
        });

        if (asset.status === "ready" || asset.status === "errored") return;
      }
    } catch {
      // continue polling
    }
  }
}
