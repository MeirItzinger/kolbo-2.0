import { Prisma, type CampaignStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { stripe } from "../../lib/stripe";
import { ApiError } from "../../utils/apiError";
import { env } from "../../config/env";

function prerollCampaignStatuses(): CampaignStatus[] {
  const base: CampaignStatus[] = ["APPROVED", "ACTIVE"];
  if (env.adAllowDraftCampaignPreroll) {
    return ["DRAFT", ...base];
  }
  return base;
}

const SETTINGS_ID = "singleton";
const USD_MIN_CHARGE_CENTS = 50;

/**
 * Pick a preroll creative for this video. Caller must ensure playback access
 * allows a preroll (e.g. adMode is preroll, preroll_midroll, or full_ads).
 * Campaigns with no channel targets run on all channels; otherwise the video's
 * channel must be in the campaign's channelTargets.
 */
export async function findPrerollCreativeForVideo(videoId: string) {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { id: true, channelId: true },
  });

  if (!video) return null;

  const eligible = await prisma.adCreative.findMany({
    where: {
      assetStatus: "READY",
      muxPlaybackId: { not: null },
      campaign: {
        status: { in: prerollCampaignStatuses() },
        AND: [
          {
            OR: [
              { startDate: null },
              { startDate: { lte: new Date() } },
            ],
          },
          {
            OR: [
              { endDate: null },
              { endDate: { gte: new Date() } },
            ],
          },
          {
            OR: [
              { channelTargets: { none: {} } },
              { channelTargets: { some: { channelId: video.channelId } } },
            ],
          },
        ],
      },
    },
    include: {
      campaign: {
        include: {
          advertiser: true,
        },
      },
    },
  });

  if (eligible.length === 0) {
    if (env.isDev) {
      const readyCount = await prisma.adCreative.count({
        where: { assetStatus: "READY", muxPlaybackId: { not: null } },
      });
      console.warn(
        `[ad-select] no preroll creative for video ${videoId} (channel ${video.channelId}). ` +
          `READY creatives with playback: ${readyCount}. ` +
          `Campaigns must be APPROVED or ACTIVE (or set AD_ALLOW_DRAFT_PREROLL=true for DRAFT in dev). ` +
          `If the campaign has channel targets, this channel must be included.`
      );
    }
    return null;
  }
  const picked = eligible[Math.floor(Math.random() * eligible.length)];
  console.log(
    `[ad-select] ${eligible.length} eligible creative(s), picked ${picked.id} ` +
    `(campaign ${picked.campaignId}, advertiser ${picked.campaign.advertiser.email})`
  );
  return picked;
}

async function resolvePricePerViewUsd(
  campaign: { pricePerViewUsd: Prisma.Decimal | null }
): Promise<Prisma.Decimal> {
  if (campaign.pricePerViewUsd != null) {
    return campaign.pricePerViewUsd;
  }
  const settings = await prisma.advertiserPlatformSettings.findUnique({
    where: { id: SETTINGS_ID },
  });
  return settings?.defaultPricePerViewUsd ?? new Prisma.Decimal("0.01");
}

async function pickPaymentMethodId(customerId: string): Promise<string> {
  const customer = await stripe.customers.retrieve(customerId, {
    expand: ["invoice_settings.default_payment_method"],
  });
  if (typeof customer === "string" || customer.deleted) {
    throw ApiError.badRequest("Invalid Stripe customer");
  }
  const dpm = customer.invoice_settings?.default_payment_method;
  if (dpm) {
    if (typeof dpm === "string") return dpm;
    return dpm.id;
  }
  const list = await stripe.paymentMethods.list({
    customer: customerId,
    type: "card",
    limit: 1,
  });
  const id = list.data[0]?.id;
  if (!id) {
    throw ApiError.badRequest("Advertiser has no saved card to charge");
  }
  return id;
}

export interface ChargeAdViewInput {
  videoId: string;
  campaignId: string;
  creativeId: string;
  idempotencyKey?: string;
}

export interface ChargeAdViewResult {
  success: boolean;
  duplicate?: boolean;
  paymentIntentId?: string | null;
  chargedAmountCents?: number;
  amountUsd?: string;
  status?: string;
  errorMessage?: string | null;
}

export async function chargeAdView(
  input: ChargeAdViewInput
): Promise<ChargeAdViewResult> {
  const { videoId, campaignId, creativeId, idempotencyKey } = input;

  if (idempotencyKey) {
    const existing = await prisma.adImpressionCharge.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return {
        success: existing.status === "succeeded",
        duplicate: true,
        paymentIntentId: existing.stripePaymentIntentId,
        chargedAmountCents: existing.chargedAmountCents,
        amountUsd: existing.amountUsd.toString(),
        status: existing.status,
        errorMessage: existing.errorMessage,
      };
    }
  }

  const creative = await prisma.adCreative.findUnique({
    where: { id: creativeId },
    include: {
      campaign: {
        include: { advertiser: true },
      },
    },
  });

  if (!creative || creative.campaignId !== campaignId) {
    throw ApiError.badRequest("Creative not found or does not match campaign");
  }

  if (!prerollCampaignStatuses().includes(creative.campaign.status)) {
    throw ApiError.badRequest("Campaign is not active");
  }

  const advertiser = creative.campaign.advertiser;
  if (!advertiser.stripeCustomerId) {
    throw ApiError.badRequest("Advertiser billing not configured");
  }

  const ppv = await resolvePricePerViewUsd(creative.campaign);
  const ppvNumber = Number(ppv.toString());
  const rawCents = Math.round(ppvNumber * 100);
  const chargeCents = Math.max(rawCents, USD_MIN_CHARGE_CENTS);

  const paymentMethodId = await pickPaymentMethodId(advertiser.stripeCustomerId);

  let recordPending;
  try {
    recordPending = await prisma.adImpressionCharge.create({
      data: {
        campaignId,
        creativeId,
        contentVideoId: videoId,
        amountUsd: ppv,
        chargedAmountCents: chargeCents,
        currency: "usd",
        status: "pending",
        idempotencyKey: idempotencyKey ?? null,
      },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002" &&
      idempotencyKey
    ) {
      const dup = await prisma.adImpressionCharge.findUnique({
        where: { idempotencyKey },
      });
      if (dup) {
        return {
          success: dup.status === "succeeded",
          duplicate: true,
          paymentIntentId: dup.stripePaymentIntentId,
          chargedAmountCents: dup.chargedAmountCents,
          amountUsd: dup.amountUsd.toString(),
          status: dup.status,
          errorMessage: dup.errorMessage,
        };
      }
    }
    throw e;
  }

  try {
    const pi = await stripe.paymentIntents.create(
      {
        amount: chargeCents,
        currency: "usd",
        customer: advertiser.stripeCustomerId,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        metadata: {
          type: "ad_impression",
          campaignId,
          creativeId,
          contentVideoId: videoId,
          impressionChargeId: recordPending.id,
        },
      },
      idempotencyKey
        ? { idempotencyKey: `adview-${idempotencyKey}` }
        : undefined
    );

    const succeeded = pi.status === "succeeded";

    await prisma.adImpressionCharge.update({
      where: { id: recordPending.id },
      data: {
        stripePaymentIntentId: pi.id,
        status: succeeded ? "succeeded" : pi.status,
        errorMessage:
          succeeded || !pi.last_payment_error
            ? null
            : pi.last_payment_error.message ?? pi.status,
      },
    });

    if (succeeded) {
      const chargedUsd = new Prisma.Decimal(chargeCents).div(new Prisma.Decimal(100));
      await prisma.adCampaign.update({
        where: { id: campaignId },
        data: {
          totalSpent: { increment: chargedUsd },
        },
      });
    }

    return {
      success: succeeded,
      paymentIntentId: pi.id,
      chargedAmountCents: chargeCents,
      amountUsd: ppv.toString(),
      status: pi.status,
      errorMessage: succeeded
        ? null
        : pi.last_payment_error?.message ?? pi.status,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Payment failed";
    await prisma.adImpressionCharge.update({
      where: { id: recordPending.id },
      data: {
        status: "failed",
        errorMessage: message,
      },
    });
    return {
      success: false,
      status: "failed",
      errorMessage: message,
      chargedAmountCents: chargeCents,
      amountUsd: ppv.toString(),
    };
  }
}
