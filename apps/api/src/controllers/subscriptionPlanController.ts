import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { prisma } from "../lib/prisma";
import { stripe } from "../lib/stripe";
import type Stripe from "stripe";

function intervalToStripe(billingInterval: string): { interval: Stripe.PriceCreateParams.Recurring.Interval; interval_count: number } {
  switch (billingInterval) {
    case "YEARLY":
      return { interval: "year", interval_count: 1 };
    case "MONTHLY":
    default:
      return { interval: "month", interval_count: 1 };
  }
}

function variantLabel(v: { billingInterval: string; concurrencyTier: string; adTier: string }): string {
  const parts = [
    v.billingInterval === "YEARLY" ? "Yearly" : "Monthly",
    v.concurrencyTier.replace("STREAMS_", "") + " streams",
  ];
  if (v.adTier === "WITH_ADS") parts.push("with ads");
  return parts.join(" · ");
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { channelId, active } = req.query;

  const where: Record<string, unknown> = {};
  if (channelId) where.channelId = channelId as string;
  if (active !== undefined) where.isActive = active === "true";

  const plans = await prisma.subscriptionPlan.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      channel: { select: { id: true, slug: true, name: true } },
      priceVariants: { orderBy: { price: "asc" } },
    },
  });

  res.json({ status: "success", data: plans });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { channelId, name, description, variants } = req.body;

  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) throw ApiError.notFound("Channel not found");

  const stripeProduct = await stripe.products.create({
    name: `${channel.name} – ${name}`,
    description: description || undefined,
    metadata: { channelId, channelSlug: channel.slug },
  });

  const variantData: Array<{
    billingInterval: string;
    concurrencyTier: string;
    adTier: string;
    price: number;
    currency: string;
    stripePriceId: string;
  }> = [];

  for (const v of variants ?? []) {
    const { interval, interval_count } = intervalToStripe(v.billingInterval);
    const stripePrice = await stripe.prices.create({
      product: stripeProduct.id,
      unit_amount: Math.round(Number(v.price) * 100),
      currency: v.currency || "usd",
      recurring: { interval, interval_count },
      nickname: variantLabel(v),
      metadata: {
        concurrencyTier: v.concurrencyTier || "STREAMS_3",
        adTier: v.adTier || "WITHOUT_ADS",
      },
    });

    variantData.push({
      billingInterval: v.billingInterval,
      concurrencyTier: v.concurrencyTier || "STREAMS_3",
      adTier: v.adTier || "WITHOUT_ADS",
      price: v.price,
      currency: v.currency || "usd",
      stripePriceId: stripePrice.id,
    });
  }

  const plan = await prisma.subscriptionPlan.create({
    data: {
      channelId,
      name,
      description,
      stripeProductId: stripeProduct.id,
      priceVariants: { create: variantData },
    },
    include: {
      priceVariants: { orderBy: { price: "asc" } },
      channel: { select: { id: true, slug: true, name: true } },
    },
  });

  res.status(201).json({ status: "success", data: plan });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, isActive, variants } = req.body;

  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id },
    include: { channel: true },
  });
  if (!plan) throw ApiError.notFound("Subscription plan not found");

  if (plan.stripeProductId && (name || description)) {
    await stripe.products.update(plan.stripeProductId, {
      ...(name && { name: `${plan.channel.name} – ${name}` }),
      ...(description !== undefined && { description: description || "" }),
    });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedPlan = await tx.subscriptionPlan.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    if (variants) {
      for (const v of variants) {
        if (v.id) {
          if (v.price !== undefined && v.stripePriceId && plan.stripeProductId) {
            await stripe.prices.update(v.stripePriceId, { active: false });

            const existing = await tx.planPriceVariant.findUnique({ where: { id: v.id } });
            if (existing) {
              const { interval, interval_count } = intervalToStripe(existing.billingInterval);
              const newStripePrice = await stripe.prices.create({
                product: plan.stripeProductId,
                unit_amount: Math.round(Number(v.price) * 100),
                currency: existing.currency,
                recurring: { interval, interval_count },
                nickname: variantLabel({
                  billingInterval: existing.billingInterval,
                  concurrencyTier: existing.concurrencyTier,
                  adTier: existing.adTier,
                }),
                metadata: {
                  concurrencyTier: existing.concurrencyTier,
                  adTier: existing.adTier,
                },
              });
              v.stripePriceId = newStripePrice.id;
            }
          }

          await tx.planPriceVariant.update({
            where: { id: v.id },
            data: {
              ...(v.price !== undefined && { price: v.price }),
              ...(v.isActive !== undefined && { isActive: v.isActive }),
              ...(v.stripePriceId !== undefined && { stripePriceId: v.stripePriceId }),
            },
          });
        } else {
          let stripePriceId: string | undefined;
          if (plan.stripeProductId) {
            const { interval, interval_count } = intervalToStripe(v.billingInterval);
            const stripePrice = await stripe.prices.create({
              product: plan.stripeProductId,
              unit_amount: Math.round(Number(v.price) * 100),
              currency: v.currency || "usd",
              recurring: { interval, interval_count },
              nickname: variantLabel(v),
              metadata: {
                concurrencyTier: v.concurrencyTier || "STREAMS_3",
                adTier: v.adTier || "WITHOUT_ADS",
              },
            });
            stripePriceId = stripePrice.id;
          }

          await tx.planPriceVariant.create({
            data: {
              planId: id,
              billingInterval: v.billingInterval,
              concurrencyTier: v.concurrencyTier || "STREAMS_3",
              adTier: v.adTier || "WITHOUT_ADS",
              price: v.price,
              currency: v.currency || "usd",
              stripePriceId,
            },
          });
        }
      }
    }

    return tx.subscriptionPlan.findUnique({
      where: { id },
      include: {
        priceVariants: { orderBy: { price: "asc" } },
        channel: { select: { id: true, slug: true, name: true } },
      },
    });
  });

  res.json({ status: "success", data: updated });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id },
    include: { priceVariants: true },
  });
  if (!plan) throw ApiError.notFound("Subscription plan not found");

  if (plan.stripeProductId) {
    for (const v of plan.priceVariants) {
      if (v.stripePriceId) {
        await stripe.prices.update(v.stripePriceId, { active: false }).catch(() => {});
      }
    }
    await stripe.products.update(plan.stripeProductId, { active: false }).catch(() => {});
  }

  await prisma.subscriptionPlan.delete({ where: { id } });
  res.json({ status: "success", message: "Plan deleted" });
});

export const bulkRemove = asyncHandler(async (req: Request, res: Response) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    throw ApiError.badRequest("ids must be a non-empty array");
  }

  const plans = await prisma.subscriptionPlan.findMany({
    where: { id: { in: ids } },
    include: { priceVariants: true },
  });

  for (const plan of plans) {
    if (plan.stripeProductId) {
      for (const v of plan.priceVariants) {
        if (v.stripePriceId) {
          await stripe.prices.update(v.stripePriceId, { active: false }).catch(() => {});
        }
      }
      await stripe.products.update(plan.stripeProductId, { active: false }).catch(() => {});
    }
  }

  const { count } = await prisma.subscriptionPlan.deleteMany({
    where: { id: { in: ids } },
  });

  res.json({ status: "success", message: `${count} plan(s) deleted` });
});
