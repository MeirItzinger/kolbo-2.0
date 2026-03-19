import Stripe from "stripe";
import { prisma } from "../../lib/prisma";
import { stripe } from "../../lib/stripe";
import { ApiError } from "../../utils/apiError";

export async function createCustomer(
  userId: string,
  email: string,
  name: string
): Promise<Stripe.Customer> {
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { userId },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer;
}

async function resolveStripeCustomerId(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true, email: true, firstName: true, lastName: true },
  });

  if (!user) throw ApiError.notFound("User not found");

  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await createCustomer(
    userId,
    user.email,
    `${user.firstName} ${user.lastName}`
  );
  return customer.id;
}

export async function createCheckoutSessionForSubscription(
  userId: string,
  variantId: string,
  successUrl: string,
  cancelUrl: string,
  discountCode?: string
): Promise<Stripe.Checkout.Session> {
  const variant = await prisma.planPriceVariant.findUnique({
    where: { id: variantId },
    include: {
      plan: { include: { channel: true } },
    },
  });

  if (!variant || !variant.isActive) {
    throw ApiError.notFound("Price variant not found or inactive");
  }
  if (!variant.stripePriceId) {
    throw ApiError.badRequest("Price variant is not configured for billing");
  }
  if (!variant.plan.isActive) {
    throw ApiError.badRequest("Subscription plan is inactive");
  }

  const existingSub = await prisma.userSubscription.findFirst({
    where: {
      userId,
      subscriptionPlanId: variant.planId,
      status: { in: ["ACTIVE", "TRIALING"] },
    },
  });
  if (existingSub) {
    throw ApiError.conflict("You already have an active subscription to this plan");
  }

  const customerId = await resolveStripeCustomerId(userId);

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: variant.stripePriceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      type: "subscription",
      userId,
      planId: variant.planId,
      variantId: variant.id,
      channelId: variant.plan.channelId,
    },
    subscription_data: {
      metadata: {
        type: "subscription",
        userId,
        planId: variant.planId,
        variantId: variant.id,
        channelId: variant.plan.channelId,
      },
    },
  };

  if (discountCode) {
    const discount = await validateDiscountCode(discountCode);
    if (discount.stripePromotionCodeId) {
      sessionParams.discounts = [
        { promotion_code: discount.stripePromotionCodeId },
      ];
    }
  }

  return stripe.checkout.sessions.create(sessionParams);
}

interface MultiSubItem {
  planId: string;
  variantId: string;
  channelId: string;
}

export async function createCheckoutSessionForMultiSubscription(
  userId: string,
  items: MultiSubItem[],
  successUrl: string,
  cancelUrl: string,
  discountCode?: string
): Promise<Stripe.Checkout.Session> {
  if (!items.length) throw ApiError.badRequest("At least one plan is required");

  const variantIds = items.map((i) => i.variantId);
  const variants = await prisma.planPriceVariant.findMany({
    where: { id: { in: variantIds }, isActive: true },
    include: { plan: { include: { channel: true } } },
  });

  if (variants.length !== items.length) {
    throw ApiError.notFound("One or more price variants not found or inactive");
  }

  const missingPrice = variants.find((v) => !v.stripePriceId);
  if (missingPrice) {
    throw ApiError.badRequest(
      `Plan "${missingPrice.plan.name}" is not configured for billing`
    );
  }

  const customerId = await resolveStripeCustomerId(userId);

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = variants.map(
    (v) => ({ price: v.stripePriceId!, quantity: 1 })
  );

  const itemsMeta = items.map((i) => ({
    p: i.planId,
    v: i.variantId,
    c: i.channelId,
  }));

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    customer: customerId,
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      type: "multi_subscription",
      userId,
      items: JSON.stringify(itemsMeta),
    },
    subscription_data: {
      metadata: {
        type: "multi_subscription",
        userId,
        items: JSON.stringify(itemsMeta),
      },
    },
  };

  if (discountCode) {
    const discount = await validateDiscountCode(discountCode);
    if (discount.stripePromotionCodeId) {
      sessionParams.discounts = [
        { promotion_code: discount.stripePromotionCodeId },
      ];
    }
  }

  return stripe.checkout.sessions.create(sessionParams);
}

export async function createCheckoutSessionForBundle(
  userId: string,
  bundleId: string,
  successUrl: string,
  cancelUrl: string,
  discountCode?: string
): Promise<Stripe.Checkout.Session> {
  const bundle = await prisma.bundle.findUnique({
    where: { id: bundleId },
  });

  if (!bundle || !bundle.isActive) {
    throw ApiError.notFound("Bundle not found or inactive");
  }
  if (!bundle.stripePriceId) {
    throw ApiError.badRequest("Bundle is not configured for billing");
  }

  const existingSub = await prisma.userBundleSubscription.findFirst({
    where: {
      userId,
      bundleId,
      status: { in: ["ACTIVE", "TRIALING"] },
    },
  });
  if (existingSub) {
    throw ApiError.conflict("You already have an active subscription to this bundle");
  }

  const customerId = await resolveStripeCustomerId(userId);

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: bundle.stripePriceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      type: "bundle",
      userId,
      bundleId,
    },
    subscription_data: {
      metadata: {
        type: "bundle",
        userId,
        bundleId,
      },
    },
  };

  if (discountCode) {
    const discount = await validateDiscountCode(discountCode);
    if (discount.stripePromotionCodeId) {
      sessionParams.discounts = [
        { promotion_code: discount.stripePromotionCodeId },
      ];
    }
  }

  return stripe.checkout.sessions.create(sessionParams);
}

export async function createCheckoutSessionForRental(
  userId: string,
  rentalOptionId: string,
  successUrl: string,
  cancelUrl: string
): Promise<Stripe.Checkout.Session> {
  const option = await prisma.rentalOption.findUnique({
    where: { id: rentalOptionId },
    include: { video: { select: { id: true, title: true } } },
  });

  if (!option || !option.isActive) {
    throw ApiError.notFound("Rental option not found or inactive");
  }
  if (!option.stripePriceId) {
    throw ApiError.badRequest("Rental option is not configured for billing");
  }

  const existingRental = await prisma.userRental.findFirst({
    where: {
      userId,
      videoId: option.videoId,
      status: "ACTIVE",
      accessEndsAt: { gt: new Date() },
    },
  });
  if (existingRental) {
    throw ApiError.conflict("You already have an active rental for this video");
  }

  const customerId = await resolveStripeCustomerId(userId);

  return stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [{ price: option.stripePriceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      type: "rental",
      userId,
      rentalOptionId,
      videoId: option.videoId,
      rentalHours: String(option.rentalHours),
    },
  });
}

export async function createCheckoutSessionForPurchase(
  userId: string,
  purchaseOptionId: string,
  successUrl: string,
  cancelUrl: string
): Promise<Stripe.Checkout.Session> {
  const option = await prisma.purchaseOption.findUnique({
    where: { id: purchaseOptionId },
    include: { video: { select: { id: true, title: true } } },
  });

  if (!option || !option.isActive) {
    throw ApiError.notFound("Purchase option not found or inactive");
  }
  if (!option.stripePriceId) {
    throw ApiError.badRequest("Purchase option is not configured for billing");
  }

  const existingPurchase = await prisma.userPurchase.findFirst({
    where: {
      userId,
      videoId: option.videoId,
      status: "ACTIVE",
    },
  });
  if (existingPurchase) {
    throw ApiError.conflict("You have already purchased this video");
  }

  const customerId = await resolveStripeCustomerId(userId);

  return stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [{ price: option.stripePriceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      type: "purchase",
      userId,
      purchaseOptionId,
      videoId: option.videoId,
    },
  });
}

export async function cancelSubscriptionAtPeriodEnd(
  stripeSubscriptionId: string
): Promise<Stripe.Subscription> {
  const sub = await stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  await prisma.userSubscription.updateMany({
    where: { stripeSubscriptionId },
    data: { cancelAtPeriodEnd: true, canceledAt: new Date() },
  });

  await prisma.userBundleSubscription.updateMany({
    where: { stripeSubscriptionId },
    data: { cancelAtPeriodEnd: true, canceledAt: new Date() },
  });

  return sub;
}

export async function reactivateSubscription(
  stripeSubscriptionId: string
): Promise<Stripe.Subscription> {
  const sub = await stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: false,
  });

  await prisma.userSubscription.updateMany({
    where: { stripeSubscriptionId },
    data: { cancelAtPeriodEnd: false, canceledAt: null },
  });

  await prisma.userBundleSubscription.updateMany({
    where: { stripeSubscriptionId },
    data: { cancelAtPeriodEnd: false, canceledAt: null },
  });

  return sub;
}

export async function getCustomerBillingHistory(
  stripeCustomerId: string
): Promise<{
  invoices: Stripe.Invoice[];
  hasMore: boolean;
}> {
  const result = await stripe.invoices.list({
    customer: stripeCustomerId,
    limit: 24,
    expand: ["data.subscription"],
  });

  return {
    invoices: result.data,
    hasMore: result.has_more,
  };
}

export async function validateDiscountCode(code: string) {
  const discount = await prisma.discountCode.findUnique({
    where: { code: code.toUpperCase().trim() },
    include: { channels: true },
  });

  if (!discount) {
    throw ApiError.notFound("Discount code not found");
  }

  if (!discount.isActive) {
    throw ApiError.badRequest("This discount code is no longer active");
  }

  const now = new Date();
  if (discount.activeFrom && now < discount.activeFrom) {
    throw ApiError.badRequest("This discount code is not yet active");
  }
  if (discount.activeTo && now > discount.activeTo) {
    throw ApiError.badRequest("This discount code has expired");
  }

  if (
    discount.maxRedemptions !== null &&
    discount.redemptionCount >= discount.maxRedemptions
  ) {
    throw ApiError.badRequest("This discount code has reached its redemption limit");
  }

  return {
    id: discount.id,
    code: discount.code,
    discountType: discount.discountType,
    amount: discount.amount,
    durationType: discount.durationType,
    durationInMonths: discount.durationInMonths,
    stripeCouponId: discount.stripeCouponId,
    stripePromotionCodeId: discount.stripePromotionCodeId,
    channelIds: discount.channels.map((dc) => dc.channelId),
  };
}
