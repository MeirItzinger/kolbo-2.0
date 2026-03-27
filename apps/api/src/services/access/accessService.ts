import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/apiError";
import { validateUscreenAccessToken } from "./uscreenAuthService";
import type {
  AccessSourceType,
  AdTier,
  ConcurrencyTier,
  PlaybackPolicy,
  VideoAccessType,
} from "@prisma/client";

export interface AccessCheckResult {
  allowed: boolean;
  reason: string;
  accessType: VideoAccessType | null;
  adMode: "none" | "preroll" | "midroll" | "preroll_midroll" | "full_ads";
  maxConcurrentStreams: number;
  playbackPolicy: PlaybackPolicy;
  tokenRequired: boolean;
}

export interface CheckAccessOptions {
  uscreenAccessToken?: string | null;
}

const HEARTBEAT_TIMEOUT_MS = 90_000;

function concurrencyTierToMax(tier: ConcurrencyTier): number {
  const map: Record<ConcurrencyTier, number> = {
    STREAMS_1: 1,
    STREAMS_3: 3,
    STREAMS_5: 5,
  };
  return map[tier] ?? 1;
}

function resolveAdMode(
  video: { hasPrerollAds: boolean; hasMidrollAds: boolean },
  adTier: AdTier | null
): AccessCheckResult["adMode"] {
  if (adTier === "WITHOUT_ADS") return "none";

  const pre = video.hasPrerollAds;
  const mid = video.hasMidrollAds;

  if (pre && mid) return "preroll_midroll";
  if (pre) return "preroll";
  if (mid) return "midroll";
  return "full_ads";
}

/**
 * Ad tier and concurrency live on PlanPriceVariant, not SubscriptionPlan.
 * When `priceVariant` is null (e.g. webhook race left priceVariantId empty),
 * fall back to matching the subscription's stripePriceId against variants,
 * and auto-repair the missing FK so subsequent lookups are instant.
 */
async function subscriptionVariantFields(sub: {
  id: string;
  priceVariant: { adTier: AdTier; concurrencyTier: ConcurrencyTier } | null;
  stripePriceId: string | null;
  subscriptionPlanId: string;
}): Promise<{ adTier: AdTier; concurrencyTier: ConcurrencyTier }> {
  if (sub.priceVariant) {
    return {
      adTier: sub.priceVariant.adTier,
      concurrencyTier: sub.priceVariant.concurrencyTier,
    };
  }

  // Attempt recovery: match by Stripe price ID, then by single active variant
  let variant: { id: string; adTier: AdTier; concurrencyTier: ConcurrencyTier } | null = null;

  if (sub.stripePriceId) {
    variant = await prisma.planPriceVariant.findFirst({
      where: {
        planId: sub.subscriptionPlanId,
        stripePriceId: sub.stripePriceId,
        isActive: true,
      },
      select: { id: true, adTier: true, concurrencyTier: true },
    });
  }

  if (!variant) {
    const activeVariants = await prisma.planPriceVariant.findMany({
      where: { planId: sub.subscriptionPlanId, isActive: true },
      select: { id: true, adTier: true, concurrencyTier: true },
    });
    if (activeVariants.length === 1) {
      variant = activeVariants[0];
    }
  }

  if (variant) {
    // Auto-repair so this lookup doesn't repeat
    prisma.userSubscription
      .update({ where: { id: sub.id }, data: { priceVariantId: variant.id } })
      .catch(() => {});
    return { adTier: variant.adTier, concurrencyTier: variant.concurrencyTier };
  }

  return { adTier: "WITHOUT_ADS", concurrencyTier: "STREAMS_3" };
}

export async function checkAccess(
  userId: string | null,
  videoId: string,
  userRoles?: Array<{ key: string; channelId?: string }>,
  options?: CheckAccessOptions
): Promise<AccessCheckResult> {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    include: {
      videoAssets: {
        where: { assetStatus: "READY" },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
      videoAccessRules: {
        include: {
          subscriptionPlan: true,
          bundle: true,
          rentalOption: true,
          purchaseOption: true,
        },
      },
    },
  });

  if (!video) {
    throw ApiError.notFound("Video not found");
  }

  if (video.status !== "PUBLISHED") {
    throw ApiError.forbidden("This video is not available for playback");
  }

  const asset = video.videoAssets[0];
  if (!asset) {
    throw ApiError.badRequest("No playable asset found for this video");
  }

  const baseResult: Pick<AccessCheckResult, "playbackPolicy" | "tokenRequired"> = {
    playbackPolicy: asset.playbackPolicy,
    tokenRequired: asset.playbackPolicy === "SIGNED",
  };
  const uscreenToken = options?.uscreenAccessToken?.trim() || null;
  let uscreenValidationPromise:
    | Promise<Awaited<ReturnType<typeof validateUscreenAccessToken>>>
    | null = null;
  const getUscreenValidation = async () => {
    if (!uscreenToken) return { valid: false };
    if (!uscreenValidationPromise) {
      uscreenValidationPromise = validateUscreenAccessToken(uscreenToken);
    }
    return uscreenValidationPromise;
  };

  const videoChannel = await prisma.channel.findUnique({
    where: { id: video.channelId },
    select: { slug: true },
  });

  const isUscreenAllowedForChannel =
    (videoChannel?.slug ?? "").trim().toLowerCase() === "toveedo";

  const uscreenAllowedResult = (): AccessCheckResult => ({
    allowed: true,
    reason: "Toveedo membership",
    accessType: "SUBSCRIPTION",
    adMode: "none",
    maxConcurrentStreams: 3,
    ...baseResult,
  });

  // 1. Free access
  if (video.isFree) {
    return {
      allowed: true,
      reason: "Free content",
      accessType: "FREE",
      adMode: "none",
      maxConcurrentStreams: 5,
      ...baseResult,
    };
  }

  // 2. Free with ads
  if (video.freeWithAds) {
    return {
      allowed: true,
      reason: "Free with ads",
      accessType: "FREE_WITH_ADS",
      adMode: resolveAdMode(video, "WITH_ADS"),
      maxConcurrentStreams: 3,
      ...baseResult,
    };
  }

  if (!userId) {
    const uscreen = await getUscreenValidation();
    if (uscreen.valid && isUscreenAllowedForChannel) {
      return uscreenAllowedResult();
    }
    return {
      allowed: false,
      reason: "Authentication required to view this content",
      accessType: null,
      adMode: "none",
      maxConcurrentStreams: 0,
      ...baseResult,
    };
  }

  // Admin bypass: SUPER_ADMIN can play anything; CHANNEL_ADMIN can play
  // videos belonging to their channel.
  if (userRoles) {
    const isSuperAdmin = userRoles.some((r) => r.key === "SUPER_ADMIN");
    const isChannelAdmin = userRoles.some(
      (r) => r.key === "CHANNEL_ADMIN" && r.channelId === video.channelId
    );
    if (isSuperAdmin || isChannelAdmin) {
      return {
        allowed: true,
        reason: isSuperAdmin ? "Super admin" : "Channel admin",
        accessType: "FREE",
        adMode: "none",
        maxConcurrentStreams: 5,
        ...baseResult,
      };
    }
  }

  const accessRules = video.videoAccessRules;

  // 3. Subscription access
  const subRules = accessRules.filter(
    (r) => r.accessType === "SUBSCRIPTION" && r.subscriptionPlan
  );
  if (subRules.length > 0) {
    const planIds = subRules.map((r) => r.subscriptionPlanId!);
    const activeSub = await prisma.userSubscription.findFirst({
      where: {
        userId,
        subscriptionPlanId: { in: planIds },
        status: { in: ["ACTIVE", "TRIALING"] },
      },
      include: { subscriptionPlan: true, priceVariant: true },
    });

    if (activeSub) {
      const plan = activeSub.subscriptionPlan;
      const { adTier, concurrencyTier } =
        await subscriptionVariantFields(activeSub);
      return {
        allowed: true,
        reason: `Subscription: ${plan.name}`,
        accessType: "SUBSCRIPTION",
        adMode: resolveAdMode(video, adTier),
        maxConcurrentStreams: concurrencyTierToMax(concurrencyTier),
        ...baseResult,
      };
    }
  }

  // 4. Bundle access
  const bundleRules = accessRules.filter(
    (r) => r.accessType === "BUNDLE" && r.bundleId
  );
  if (bundleRules.length > 0) {
    const bundleIds = bundleRules.map((r) => r.bundleId!);
    const activeBundleSub = await prisma.userBundleSubscription.findFirst({
      where: {
        userId,
        bundleId: { in: bundleIds },
        status: { in: ["ACTIVE", "TRIALING"] },
      },
      include: { bundle: true },
    });

    if (activeBundleSub) {
      const bundle = activeBundleSub.bundle;
      return {
        allowed: true,
        reason: `Bundle: ${bundle.name}`,
        accessType: "BUNDLE",
        adMode: resolveAdMode(video, bundle.adTier),
        maxConcurrentStreams: concurrencyTierToMax(bundle.concurrencyTier),
        ...baseResult,
      };
    }
  }

  // Channel-level subscription/bundle checks only apply when the video is not
  // explicitly gated as rental/purchase-only. If every access rule requires
  // payment (RENTAL or PURCHASE), subscribers must still pay.
  const hasPaywallOnlyRules =
    accessRules.length > 0 &&
    accessRules.every((r) => r.accessType === "RENTAL" || r.accessType === "PURCHASE");

  if (!hasPaywallOnlyRules) {
    // Also check channel-level subscriptions (if user has a sub to the video's channel)
    const channelSub = await prisma.userSubscription.findFirst({
      where: {
        userId,
        channelId: video.channelId,
        status: { in: ["ACTIVE", "TRIALING"] },
      },
      include: { subscriptionPlan: true, priceVariant: true },
    });

    if (channelSub) {
      const plan = channelSub.subscriptionPlan;
      const { adTier, concurrencyTier } =
        await subscriptionVariantFields(channelSub);
      return {
        allowed: true,
        reason: `Channel subscription: ${plan.name}`,
        accessType: "SUBSCRIPTION",
        adMode: resolveAdMode(video, adTier),
        maxConcurrentStreams: concurrencyTierToMax(concurrencyTier),
        ...baseResult,
      };
    }

    // Also check bundles that include the channel
    const bundleChannels = await prisma.bundleChannel.findMany({
      where: { channelId: video.channelId },
      select: { bundleId: true },
    });

    if (bundleChannels.length > 0) {
      const channelBundleIds = bundleChannels.map((bc) => bc.bundleId);
      const channelBundleSub = await prisma.userBundleSubscription.findFirst({
        where: {
          userId,
          bundleId: { in: channelBundleIds },
          status: { in: ["ACTIVE", "TRIALING"] },
        },
        include: { bundle: true },
      });

      if (channelBundleSub) {
        const bundle = channelBundleSub.bundle;
        return {
          allowed: true,
          reason: `Bundle: ${bundle.name}`,
          accessType: "BUNDLE",
          adMode: resolveAdMode(video, bundle.adTier),
          maxConcurrentStreams: concurrencyTierToMax(bundle.concurrencyTier),
          ...baseResult,
        };
      }
    }
  }

  // 5. Rental access
  const activeRental = await prisma.userRental.findFirst({
    where: {
      userId,
      videoId,
      status: "ACTIVE",
      accessEndsAt: { gt: new Date() },
    },
    include: { rentalOption: true },
  });

  if (activeRental) {
    return {
      allowed: true,
      reason: `Rental: ${activeRental.rentalOption.name}`,
      accessType: "RENTAL",
      adMode: "none",
      maxConcurrentStreams: concurrencyTierToMax(
        activeRental.rentalOption.concurrencyTier
      ),
      ...baseResult,
    };
  }

  // 6. Purchase access
  const activePurchase = await prisma.userPurchase.findFirst({
    where: {
      userId,
      videoId,
      status: "ACTIVE",
    },
    include: { purchaseOption: true },
  });

  if (activePurchase) {
    return {
      allowed: true,
      reason: `Purchased: ${activePurchase.purchaseOption.name}`,
      accessType: "PURCHASE",
      adMode: "none",
      maxConcurrentStreams: concurrencyTierToMax(
        activePurchase.purchaseOption.concurrencyTier
      ),
      ...baseResult,
    };
  }

  // Toveedo / Uscreen fallback — only grants access for videos in the toveedo channel
  const uscreen = await getUscreenValidation();
  if (uscreen.valid && isUscreenAllowedForChannel) {
    return uscreenAllowedResult();
  }

  return {
    allowed: false,
    reason: "No active entitlement found for this video",
    accessType: null,
    adMode: "none",
    maxConcurrentStreams: 0,
    ...baseResult,
  };
}

export async function checkConcurrency(
  userId: string,
  maxStreams: number
): Promise<{ allowed: boolean; activeCount: number }> {
  const cutoff = new Date(Date.now() - HEARTBEAT_TIMEOUT_MS);

  const activeCount = await prisma.watchSession.count({
    where: {
      userId,
      endedAt: null,
      lastHeartbeatAt: { gte: cutoff },
    },
  });

  return {
    allowed: activeCount < maxStreams,
    activeCount,
  };
}

export async function createWatchSession(
  userId: string,
  videoId: string,
  profileId?: string,
  deviceId?: string,
  accessSourceType: AccessSourceType = "FREE"
) {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    include: {
      videoAssets: {
        where: { assetStatus: "READY" },
        take: 1,
        orderBy: { createdAt: "desc" },
        select: { muxPlaybackId: true },
      },
    },
  });

  if (!video) {
    throw ApiError.notFound("Video not found");
  }

  const session = await prisma.watchSession.create({
    data: {
      userId,
      videoId,
      profileId: profileId ?? null,
      deviceId: deviceId ?? null,
      accessSourceType,
      muxPlaybackId: video.videoAssets[0]?.muxPlaybackId ?? null,
      startedAt: new Date(),
      lastHeartbeatAt: new Date(),
    },
  });

  return session;
}

export async function heartbeat(sessionId: string): Promise<void> {
  const session = await prisma.watchSession.findUnique({
    where: { id: sessionId },
    select: { id: true, endedAt: true },
  });

  if (!session) {
    throw ApiError.notFound("Watch session not found");
  }

  if (session.endedAt) {
    throw ApiError.badRequest("Session has already ended");
  }

  await prisma.watchSession.update({
    where: { id: sessionId },
    data: { lastHeartbeatAt: new Date() },
  });
}

export async function endSession(sessionId: string): Promise<void> {
  const session = await prisma.watchSession.findUnique({
    where: { id: sessionId },
    select: { id: true, endedAt: true, startedAt: true },
  });

  if (!session) {
    throw ApiError.notFound("Watch session not found");
  }

  if (session.endedAt) return;

  const now = new Date();
  const playbackSeconds = Math.round(
    (now.getTime() - session.startedAt.getTime()) / 1000
  );

  await prisma.watchSession.update({
    where: { id: sessionId },
    data: {
      endedAt: now,
      playbackSeconds,
    },
  });
}
