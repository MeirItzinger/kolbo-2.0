import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { prisma } from "../lib/prisma";

interface SaleRow {
  id: string;
  stripeInvoiceId: string | null;
  invoiceNumber: string | null;
  eventType: string;
  amount: number | null;
  currency: string | null;
  createdAt: Date;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
  type: string;
  description: string;
  channelName: string | null;
  bundleName: string | null;
  videoTitle: string | null;
  status: string;
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(req.query.perPage as string) || 25));
  const search = (req.query.search as string | undefined)?.trim().toLowerCase();
  const typeFilter = req.query.type as string | undefined;

  const [invoiceLogs, subscriptions, bundleSubs, rentals, purchases] =
    await Promise.all([
      prisma.invoiceLog.findMany({
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.userSubscription.findMany({
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          channel: { select: { name: true } },
          subscriptionPlan: {
            select: { name: true },
          },
          priceVariant: {
            select: { price: true, currency: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.userBundleSubscription.findMany({
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          bundle: { select: { name: true, price: true, currency: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.userRental.findMany({
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          video: { select: { title: true } },
          rentalOption: { select: { name: true, price: true, currency: true } },
        },
        orderBy: { purchasedAt: "desc" },
      }),
      prisma.userPurchase.findMany({
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          video: { select: { title: true } },
          purchaseOption: {
            select: { name: true, price: true, currency: true },
          },
        },
        orderBy: { purchasedAt: "desc" },
      }),
    ]);

  const invoiceSubIds = new Set(
    invoiceLogs
      .map((l) => l.stripeSubscriptionId)
      .filter(Boolean)
  );
  const invoicePiIds = new Set(
    invoiceLogs
      .map((l) => l.stripePaymentIntentId)
      .filter(Boolean)
  );

  const rows: SaleRow[] = [];

  for (const log of invoiceLogs) {
    const isFailed = log.eventType.includes("failed");
    let type = "other";
    let description = "";
    let channelName: string | null = null;
    let bundleName: string | null = null;
    let videoTitle: string | null = null;

    if (log.stripeSubscriptionId) {
      const sub = subscriptions.find(
        (s) => s.stripeSubscriptionId === log.stripeSubscriptionId
      );
      if (sub) {
        type = "subscription";
        channelName = sub.channel.name;
        description = sub.subscriptionPlan.name;
      } else {
        const bsub = bundleSubs.find(
          (b) => b.stripeSubscriptionId === log.stripeSubscriptionId
        );
        if (bsub) {
          type = "bundle";
          bundleName = bsub.bundle.name;
          description = bsub.bundle.name;
        }
      }
    }

    if (log.stripePaymentIntentId && type === "other") {
      const rental = rentals.find(
        (r) => r.stripePaymentIntentId === log.stripePaymentIntentId
      );
      if (rental) {
        type = "rental";
        videoTitle = rental.video.title;
        description = `Rental: ${rental.video.title}`;
      } else {
        const purchase = purchases.find(
          (p) => p.stripePaymentIntentId === log.stripePaymentIntentId
        );
        if (purchase) {
          type = "purchase";
          videoTitle = purchase.video.title;
          description = `Purchase: ${purchase.video.title}`;
        }
      }
    }

    const raw = log.rawPayloadJson as any;
    const invoiceNumber =
      raw?.number ?? raw?.data?.object?.number ?? null;

    rows.push({
      id: `inv_${log.id}`,
      stripeInvoiceId: log.stripeInvoiceId,
      invoiceNumber,
      eventType: log.eventType,
      amount: log.amount ? Number(log.amount) : null,
      currency: log.currency,
      createdAt: log.createdAt,
      user: log.user,
      type,
      description,
      channelName,
      bundleName,
      videoTitle,
      status: isFailed ? "failed" : "paid",
    });
  }

  for (const sub of subscriptions) {
    if (sub.stripeSubscriptionId && invoiceSubIds.has(sub.stripeSubscriptionId))
      continue;

    rows.push({
      id: `sub_${sub.id}`,
      stripeInvoiceId: null,
      invoiceNumber: null,
      eventType: "checkout.session.completed",
      amount: sub.priceVariant?.price
        ? Number(sub.priceVariant.price)
        : null,
      currency: sub.priceVariant?.currency ?? "usd",
      createdAt: sub.createdAt,
      user: sub.user,
      type: "subscription",
      description: sub.subscriptionPlan.name,
      channelName: sub.channel.name,
      bundleName: null,
      videoTitle: null,
      status: sub.status === "ACTIVE" ? "paid" : sub.status.toLowerCase(),
    });
  }

  for (const bsub of bundleSubs) {
    if (
      bsub.stripeSubscriptionId &&
      invoiceSubIds.has(bsub.stripeSubscriptionId)
    )
      continue;

    rows.push({
      id: `bsub_${bsub.id}`,
      stripeInvoiceId: null,
      invoiceNumber: null,
      eventType: "checkout.session.completed",
      amount: bsub.bundle.price ? Number(bsub.bundle.price) : null,
      currency: bsub.bundle.currency ?? "usd",
      createdAt: bsub.createdAt,
      user: bsub.user,
      type: "bundle",
      description: bsub.bundle.name,
      channelName: null,
      bundleName: bsub.bundle.name,
      videoTitle: null,
      status: bsub.status === "ACTIVE" ? "paid" : bsub.status.toLowerCase(),
    });
  }

  for (const rental of rentals) {
    if (
      rental.stripePaymentIntentId &&
      invoicePiIds.has(rental.stripePaymentIntentId)
    )
      continue;

    rows.push({
      id: `rent_${rental.id}`,
      stripeInvoiceId: null,
      invoiceNumber: null,
      eventType: "checkout.session.completed",
      amount: rental.rentalOption.price
        ? Number(rental.rentalOption.price)
        : null,
      currency: rental.rentalOption.currency ?? "usd",
      createdAt: rental.purchasedAt,
      user: rental.user,
      type: "rental",
      description: `Rental: ${rental.video.title}`,
      channelName: null,
      bundleName: null,
      videoTitle: rental.video.title,
      status: rental.status === "ACTIVE" ? "paid" : rental.status.toLowerCase(),
    });
  }

  for (const purchase of purchases) {
    if (
      purchase.stripePaymentIntentId &&
      invoicePiIds.has(purchase.stripePaymentIntentId)
    )
      continue;

    rows.push({
      id: `pur_${purchase.id}`,
      stripeInvoiceId: null,
      invoiceNumber: null,
      eventType: "checkout.session.completed",
      amount: purchase.purchaseOption.price
        ? Number(purchase.purchaseOption.price)
        : null,
      currency: purchase.purchaseOption.currency ?? "usd",
      createdAt: purchase.purchasedAt,
      user: purchase.user,
      type: "purchase",
      description: `Purchase: ${purchase.video.title}`,
      channelName: null,
      bundleName: null,
      videoTitle: purchase.video.title,
      status:
        purchase.status === "ACTIVE" ? "paid" : purchase.status.toLowerCase(),
    });
  }

  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  let filtered = rows;

  if (typeFilter) {
    filtered = filtered.filter((r) => r.type === typeFilter);
  }

  if (search) {
    filtered = filtered.filter((r) => {
      const userName =
        `${r.user?.firstName ?? ""} ${r.user?.lastName ?? ""}`.toLowerCase();
      const userEmail = (r.user?.email ?? "").toLowerCase();
      const inv = (r.invoiceNumber ?? r.stripeInvoiceId ?? "").toLowerCase();
      return (
        userName.includes(search) ||
        userEmail.includes(search) ||
        inv.includes(search)
      );
    });
  }

  const total = filtered.length;
  const totalPages = Math.ceil(total / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  res.json({
    data: paginated,
    meta: { page, perPage, total, totalPages },
  });
});

/** Channel-scoped sales: only subscriptions to this channel + rentals/purchases of videos in this channel */
export const listByChannel = asyncHandler(async (req: Request, res: Response) => {
  const channelId = req.params.channelId;
  if (!channelId) {
    return res.status(400).json({ status: "error", message: "channelId required" });
  }

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(req.query.perPage as string) || 25));
  const search = (req.query.search as string | undefined)?.trim().toLowerCase();
  const typeFilter = req.query.type as string | undefined;

  const [subscriptions, rentals, purchases] = await Promise.all([
    prisma.userSubscription.findMany({
      where: { channelId },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        channel: { select: { name: true } },
        subscriptionPlan: { select: { name: true } },
        priceVariant: { select: { price: true, currency: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.userRental.findMany({
      where: { video: { channelId } },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        video: { select: { title: true } },
        rentalOption: { select: { name: true, price: true, currency: true } },
      },
      orderBy: { purchasedAt: "desc" },
    }),
    prisma.userPurchase.findMany({
      where: { video: { channelId } },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        video: { select: { title: true } },
        purchaseOption: {
          select: { name: true, price: true, currency: true },
        },
      },
      orderBy: { purchasedAt: "desc" },
    }),
  ]);

  const rows: SaleRow[] = [];

  for (const sub of subscriptions) {
    rows.push({
      id: `sub_${sub.id}`,
      stripeInvoiceId: null,
      invoiceNumber: null,
      eventType: "checkout.session.completed",
      amount: sub.priceVariant?.price ? Number(sub.priceVariant.price) : null,
      currency: sub.priceVariant?.currency ?? "usd",
      createdAt: sub.createdAt,
      user: sub.user,
      type: "subscription",
      description: sub.subscriptionPlan.name,
      channelName: sub.channel.name,
      bundleName: null,
      videoTitle: null,
      status: sub.status === "ACTIVE" ? "paid" : sub.status.toLowerCase(),
    });
  }

  for (const rental of rentals) {
    rows.push({
      id: `rent_${rental.id}`,
      stripeInvoiceId: null,
      invoiceNumber: null,
      eventType: "checkout.session.completed",
      amount: rental.rentalOption.price ? Number(rental.rentalOption.price) : null,
      currency: rental.rentalOption.currency ?? "usd",
      createdAt: rental.purchasedAt,
      user: rental.user,
      type: "rental",
      description: `Rental: ${rental.video.title}`,
      channelName: null,
      bundleName: null,
      videoTitle: rental.video.title,
      status: rental.status === "ACTIVE" ? "paid" : rental.status.toLowerCase(),
    });
  }

  for (const purchase of purchases) {
    rows.push({
      id: `pur_${purchase.id}`,
      stripeInvoiceId: null,
      invoiceNumber: null,
      eventType: "checkout.session.completed",
      amount: purchase.purchaseOption.price ? Number(purchase.purchaseOption.price) : null,
      currency: purchase.purchaseOption.currency ?? "usd",
      createdAt: purchase.purchasedAt,
      user: purchase.user,
      type: "purchase",
      description: `Purchase: ${purchase.video.title}`,
      channelName: null,
      bundleName: null,
      videoTitle: purchase.video.title,
      status: purchase.status === "ACTIVE" ? "paid" : purchase.status.toLowerCase(),
    });
  }

  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  let filtered = rows;
  if (typeFilter) filtered = filtered.filter((r) => r.type === typeFilter);
  if (search) {
    filtered = filtered.filter((r) => {
      const userName = `${r.user?.firstName ?? ""} ${r.user?.lastName ?? ""}`.toLowerCase();
      const userEmail = (r.user?.email ?? "").toLowerCase();
      const inv = (r.invoiceNumber ?? r.stripeInvoiceId ?? "").toLowerCase();
      return userName.includes(search) || userEmail.includes(search) || inv.includes(search);
    });
  }

  const total = filtered.length;
  const totalPages = Math.ceil(total / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  res.json({
    data: paginated,
    meta: { page, perPage, total, totalPages },
  });
});
