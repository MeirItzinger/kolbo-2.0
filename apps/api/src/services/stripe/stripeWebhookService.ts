import Stripe from "stripe";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/apiError";
import type { SubscriptionStatus } from "@prisma/client";

export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutSessionCompleted(
        event.data.object as Stripe.Checkout.Session
      );
      break;
    case "customer.subscription.created":
      await handleSubscriptionCreated(
        event.data.object as Stripe.Subscription
      );
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(
        event.data.object as Stripe.Subscription
      );
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(
        event.data.object as Stripe.Subscription
      );
      break;
    case "invoice.paid":
      await handleInvoicePaid(event.data.object as Stripe.Invoice);
      break;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      break;
    case "payment_intent.succeeded":
      await handlePaymentIntentSucceeded(
        event.data.object as Stripe.PaymentIntent
      );
      break;
    case "payment_intent.payment_failed":
      await handlePaymentIntentFailed(
        event.data.object as Stripe.PaymentIntent
      );
      break;
    default:
      break;
  }
}

async function resolveUserId(
  stripeCustomerId: string | null | undefined
): Promise<string | null> {
  if (!stripeCustomerId) return null;
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId },
    select: { id: true },
  });
  return user?.id ?? null;
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const meta = session.metadata ?? {};
  const type = meta.type;

  if (!type) return;

  switch (type) {
    case "subscription":
      await fulfillSubscription(session, meta);
      break;
    case "multi_subscription":
      await fulfillMultiSubscription(session, meta);
      break;
    case "bundle":
      await fulfillBundle(session, meta);
      break;
    case "rental":
      await fulfillRental(session, meta);
      break;
    case "purchase":
      await fulfillPurchase(session, meta);
      break;
  }
}

async function fulfillSubscription(
  session: Stripe.Checkout.Session,
  meta: Record<string, string>
): Promise<void> {
  const { userId, planId, channelId, variantId } = meta;
  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!userId || !planId || !channelId || !stripeSubscriptionId) return;

  const existing = await prisma.userSubscription.findFirst({
    where: { stripeSubscriptionId },
  });
  if (existing) {
    // subscription.created may have inserted this row first without priceVariantId;
    // backfill so WITH_ADS tier and preroll adMode resolve correctly.
    if (variantId && !existing.priceVariantId) {
      await prisma.userSubscription.update({
        where: { id: existing.id },
        data: { priceVariantId: variantId },
      });
    }
    return;
  }

  await prisma.userSubscription.create({
    data: {
      userId,
      channelId,
      subscriptionPlanId: planId,
      priceVariantId: variantId ?? null,
      stripeSubscriptionId,
      stripePriceId: meta.stripePriceId ?? null,
      stripeCheckoutSessionId: session.id,
      status: "ACTIVE",
      currentPeriodStart: new Date(),
    },
  });
}

async function fulfillMultiSubscription(
  session: Stripe.Checkout.Session,
  meta: Record<string, string>
): Promise<void> {
  const { userId } = meta;
  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!userId || !stripeSubscriptionId) return;

  let items: Array<{ p: string; v: string; c: string }>;
  try {
    items = JSON.parse(meta.items);
  } catch {
    return;
  }

  for (const item of items) {
    const existing = await prisma.userSubscription.findFirst({
      where: {
        userId,
        subscriptionPlanId: item.p,
        stripeSubscriptionId,
      },
    });
    if (existing) continue;

    const variant = await prisma.planPriceVariant.findUnique({
      where: { id: item.v },
      select: { stripePriceId: true },
    });

    await prisma.userSubscription.create({
      data: {
        userId,
        channelId: item.c,
        subscriptionPlanId: item.p,
        priceVariantId: item.v,
        stripeSubscriptionId,
        stripePriceId: variant?.stripePriceId ?? null,
        stripeCheckoutSessionId: session.id,
        status: "ACTIVE",
        currentPeriodStart: new Date(),
      },
    });
  }
}

async function fulfillBundle(
  session: Stripe.Checkout.Session,
  meta: Record<string, string>
): Promise<void> {
  const { userId, bundleId } = meta;
  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!userId || !bundleId || !stripeSubscriptionId) return;

  const existing = await prisma.userBundleSubscription.findFirst({
    where: { stripeSubscriptionId },
  });
  if (existing) return;

  await prisma.userBundleSubscription.create({
    data: {
      userId,
      bundleId,
      stripeSubscriptionId,
      stripePriceId: meta.stripePriceId ?? null,
      stripeCheckoutSessionId: session.id,
      status: "ACTIVE",
      currentPeriodStart: new Date(),
    },
  });
}

async function fulfillRental(
  session: Stripe.Checkout.Session,
  meta: Record<string, string>
): Promise<void> {
  const { userId, rentalOptionId, videoId, rentalHours } = meta;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  if (!userId || !rentalOptionId || !videoId) return;

  const existing = await prisma.userRental.findFirst({
    where: { stripeCheckoutSessionId: session.id },
  });
  if (existing) return;

  const hours = parseInt(rentalHours, 10) || 48;
  const now = new Date();

  await prisma.userRental.create({
    data: {
      userId,
      videoId,
      rentalOptionId,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId ?? null,
      purchasedAt: now,
      accessStartsAt: now,
      accessEndsAt: new Date(now.getTime() + hours * 60 * 60 * 1000),
      status: "ACTIVE",
    },
  });
}

async function fulfillPurchase(
  session: Stripe.Checkout.Session,
  meta: Record<string, string>
): Promise<void> {
  const { userId, purchaseOptionId, videoId } = meta;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  if (!userId || !purchaseOptionId || !videoId) return;

  const existing = await prisma.userPurchase.findFirst({
    where: {
      userId,
      videoId,
      purchaseOptionId,
    },
  });
  if (existing) return;

  await prisma.userPurchase.create({
    data: {
      userId,
      videoId,
      purchaseOptionId,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId ?? null,
      purchasedAt: new Date(),
      status: "ACTIVE",
    },
  });
}

function mapStripeStatusToPrisma(
  stripeStatus: string
): SubscriptionStatus {
  const mapping: Record<string, SubscriptionStatus> = {
    active: "ACTIVE",
    past_due: "PAST_DUE",
    canceled: "CANCELED",
    unpaid: "PAST_DUE",
    incomplete: "INCOMPLETE",
    incomplete_expired: "EXPIRED",
    trialing: "TRIALING",
    paused: "CANCELED",
  };
  return mapping[stripeStatus] ?? "INCOMPLETE";
}

async function handleSubscriptionCreated(
  subscription: Stripe.Subscription
): Promise<void> {
  const meta = subscription.metadata ?? {};
  const status = mapStripeStatusToPrisma(subscription.status);

  if (meta.type === "subscription" && meta.userId && meta.planId && meta.channelId) {
    const variantId = meta.variantId ?? null;
    await prisma.userSubscription.upsert({
      where: { userId_subscriptionPlanId: { userId: meta.userId, subscriptionPlanId: meta.planId } },
      update: {
        stripeSubscriptionId: subscription.id,
        status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        ...(variantId ? { priceVariantId: variantId } : {}),
      },
      create: {
        userId: meta.userId,
        channelId: meta.channelId,
        subscriptionPlanId: meta.planId,
        priceVariantId: variantId,
        stripeSubscriptionId: subscription.id,
        status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });
  } else if (meta.type === "bundle" && meta.userId && meta.bundleId) {
    await prisma.userBundleSubscription.upsert({
      where: { stripeSubscriptionId: subscription.id },
      update: {
        status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
      create: {
        userId: meta.userId,
        bundleId: meta.bundleId,
        stripeSubscriptionId: subscription.id,
        status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });
  }
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  const status = mapStripeStatusToPrisma(subscription.status);
  const data = {
    status,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000)
      : null,
  };

  const updatedCount = await prisma.userSubscription.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data,
  });

  if (updatedCount.count > 0) {
    const v = subscription.metadata?.variantId;
    if (v) {
      await prisma.userSubscription.updateMany({
        where: {
          stripeSubscriptionId: subscription.id,
          priceVariantId: null,
        },
        data: { priceVariantId: v },
      });
    }
    return;
  }

  const bundleSub = await prisma.userBundleSubscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (bundleSub) {
    await prisma.userBundleSubscription.update({
      where: { stripeSubscriptionId: subscription.id },
      data,
    });
  }
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const cancelData = {
    status: "CANCELED" as SubscriptionStatus,
    canceledAt: new Date(),
    cancelAtPeriodEnd: false,
  };

  const updatedCount = await prisma.userSubscription.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: cancelData,
  });

  if (updatedCount.count > 0) return;

  const bundleSub = await prisma.userBundleSubscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (bundleSub) {
    await prisma.userBundleSubscription.update({
      where: { stripeSubscriptionId: subscription.id },
      data: cancelData,
    });
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id;

  const existing = await prisma.invoiceLog.findFirst({
    where: { stripeInvoiceId: invoice.id, eventType: "invoice.paid" },
  });
  if (existing) return;

  const userId = await resolveUserId(customerId ?? null);

  await prisma.invoiceLog.create({
    data: {
      userId,
      stripeCustomerId: customerId ?? null,
      stripeInvoiceId: invoice.id,
      stripeSubscriptionId: subscriptionId ?? null,
      stripePaymentIntentId:
        typeof invoice.payment_intent === "string"
          ? invoice.payment_intent
          : invoice.payment_intent?.id ?? null,
      eventType: "invoice.paid",
      amount: invoice.amount_paid ? invoice.amount_paid / 100 : null,
      currency: invoice.currency ?? null,
      rawPayloadJson: JSON.parse(JSON.stringify(invoice)),
    },
  });
}

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id;

  const existing = await prisma.invoiceLog.findFirst({
    where: {
      stripeInvoiceId: invoice.id,
      eventType: "invoice.payment_failed",
    },
  });
  if (existing) return;

  const userId = await resolveUserId(customerId ?? null);

  await prisma.invoiceLog.create({
    data: {
      userId,
      stripeCustomerId: customerId ?? null,
      stripeInvoiceId: invoice.id,
      stripeSubscriptionId: subscriptionId ?? null,
      stripePaymentIntentId:
        typeof invoice.payment_intent === "string"
          ? invoice.payment_intent
          : invoice.payment_intent?.id ?? null,
      eventType: "invoice.payment_failed",
      amount: invoice.amount_due ? invoice.amount_due / 100 : null,
      currency: invoice.currency ?? null,
      rawPayloadJson: JSON.parse(JSON.stringify(invoice)),
    },
  });
}

async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  const customerId =
    typeof paymentIntent.customer === "string"
      ? paymentIntent.customer
      : paymentIntent.customer?.id;

  const existing = await prisma.invoiceLog.findFirst({
    where: {
      stripePaymentIntentId: paymentIntent.id,
      eventType: "payment_intent.succeeded",
    },
  });
  if (existing) return;

  const userId = await resolveUserId(customerId ?? null);

  await prisma.invoiceLog.create({
    data: {
      userId,
      stripeCustomerId: customerId ?? null,
      stripePaymentIntentId: paymentIntent.id,
      eventType: "payment_intent.succeeded",
      amount: paymentIntent.amount ? paymentIntent.amount / 100 : null,
      currency: paymentIntent.currency ?? null,
      rawPayloadJson: JSON.parse(JSON.stringify(paymentIntent)),
    },
  });
}

async function handlePaymentIntentFailed(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  const customerId =
    typeof paymentIntent.customer === "string"
      ? paymentIntent.customer
      : paymentIntent.customer?.id;

  const existing = await prisma.invoiceLog.findFirst({
    where: {
      stripePaymentIntentId: paymentIntent.id,
      eventType: "payment_intent.payment_failed",
    },
  });
  if (existing) return;

  const userId = await resolveUserId(customerId ?? null);

  await prisma.invoiceLog.create({
    data: {
      userId,
      stripeCustomerId: customerId ?? null,
      stripePaymentIntentId: paymentIntent.id,
      eventType: "payment_intent.payment_failed",
      amount: paymentIntent.amount ? paymentIntent.amount / 100 : null,
      currency: paymentIntent.currency ?? null,
      rawPayloadJson: JSON.parse(JSON.stringify(paymentIntent)),
    },
  });
}
