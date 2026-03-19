import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { prisma } from "../lib/prisma";
import {
  cancelSubscriptionAtPeriodEnd,
  reactivateSubscription,
} from "../services/stripe/stripeService";

export const getSubscriptions = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const [channelSubs, bundleSubs] = await Promise.all([
      prisma.userSubscription.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: {
          subscriptionPlan: {
            select: { id: true, name: true },
          },
          priceVariant: {
            select: {
              id: true,
              billingInterval: true,
              price: true,
              concurrencyTier: true,
              adTier: true,
            },
          },
          channel: { select: { id: true, slug: true, name: true, logoUrl: true } },
        },
      }),
      prisma.userBundleSubscription.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: {
          bundle: {
            select: {
              id: true,
              slug: true,
              name: true,
              billingInterval: true,
              price: true,
            },
          },
        },
      }),
    ]);

    res.json({
      status: "success",
      data: { channelSubscriptions: channelSubs, bundleSubscriptions: bundleSubs },
    });
  }
);

export const cancelSubscription = asyncHandler(
  async (req: Request, res: Response) => {
    const { stripeSubscriptionId } = req.body;

    if (!stripeSubscriptionId) {
      throw ApiError.badRequest("stripeSubscriptionId is required");
    }

    const userSub = await prisma.userSubscription.findFirst({
      where: { userId: req.user!.id, stripeSubscriptionId },
    });

    const bundleSub = userSub
      ? null
      : await prisma.userBundleSubscription.findFirst({
          where: { userId: req.user!.id, stripeSubscriptionId },
        });

    if (!userSub && !bundleSub) {
      throw ApiError.notFound("Subscription not found");
    }

    await cancelSubscriptionAtPeriodEnd(stripeSubscriptionId);

    res.json({
      status: "success",
      message: "Subscription will be cancelled at end of current period",
    });
  }
);

export const reactivateUserSubscription = asyncHandler(
  async (req: Request, res: Response) => {
    const { stripeSubscriptionId } = req.body;

    if (!stripeSubscriptionId) {
      throw ApiError.badRequest("stripeSubscriptionId is required");
    }

    const userSub = await prisma.userSubscription.findFirst({
      where: { userId: req.user!.id, stripeSubscriptionId },
    });

    const bundleSub = userSub
      ? null
      : await prisma.userBundleSubscription.findFirst({
          where: { userId: req.user!.id, stripeSubscriptionId },
        });

    if (!userSub && !bundleSub) {
      throw ApiError.notFound("Subscription not found");
    }

    await reactivateSubscription(stripeSubscriptionId);

    res.json({ status: "success", message: "Subscription reactivated" });
  }
);

export const getPurchases = asyncHandler(
  async (req: Request, res: Response) => {
    const purchases = await prisma.userPurchase.findMany({
      where: { userId: req.user!.id },
      orderBy: { purchasedAt: "desc" },
      include: {
        video: {
          select: {
            id: true,
            slug: true,
            title: true,
            thumbnailAssets: { where: { type: "POSTER" }, take: 1 },
          },
        },
        purchaseOption: { select: { id: true, name: true, price: true } },
      },
    });

    res.json({ status: "success", data: purchases });
  }
);

export const getRentals = asyncHandler(async (req: Request, res: Response) => {
  const rentals = await prisma.userRental.findMany({
    where: { userId: req.user!.id },
    orderBy: { purchasedAt: "desc" },
    include: {
      video: {
        select: {
          id: true,
          slug: true,
          title: true,
          thumbnailAssets: { where: { type: "POSTER" }, take: 1 },
        },
      },
      rentalOption: {
        select: { id: true, name: true, price: true, rentalHours: true },
      },
    },
  });

  res.json({ status: "success", data: rentals });
});

export const getPaymentMethods = asyncHandler(
  async (req: Request, res: Response) => {
    const methods = await prisma.paymentMethod.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
    });

    res.json({ status: "success", data: methods });
  }
);

export const getDevices = asyncHandler(async (req: Request, res: Response) => {
  const devices = await prisma.device.findMany({
    where: { userId: req.user!.id },
    orderBy: { lastSeenAt: "desc" },
  });

  res.json({ status: "success", data: devices });
});

export const getWatchHistory = asyncHandler(
  async (req: Request, res: Response) => {
    const { profileId, page = "1", limit = "20" } = req.query;
    const take = Math.min(Number(limit) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const where: Record<string, unknown> = { userId: req.user!.id };
    if (profileId) where.profileId = profileId as string;

    const [history, total] = await Promise.all([
      prisma.watchHistory.findMany({
        where,
        skip,
        take,
        orderBy: { lastWatchedAt: "desc" },
        include: {
          video: {
            select: {
              id: true,
              slug: true,
              title: true,
              durationSeconds: true,
              thumbnailAssets: { where: { type: "POSTER" }, take: 1 },
              channel: { select: { id: true, slug: true, name: true } },
            },
          },
        },
      }),
      prisma.watchHistory.count({ where }),
    ]);

    res.json({
      status: "success",
      data: history,
      meta: { page: Number(page) || 1, limit: take, total },
    });
  }
);
