import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { stripe } from "../lib/stripe";
import { env } from "../config/env";
import * as stripeService from "../services/stripe/stripeService";
import { handleWebhookEvent } from "../services/stripe/stripeWebhookService";
import { prisma } from "../lib/prisma";

export const createCheckoutForSubscription = asyncHandler(
  async (req: Request, res: Response) => {
    const { variantId, successUrl, cancelUrl, discountCode } = req.body;

    if (!variantId || !successUrl || !cancelUrl) {
      throw ApiError.badRequest("variantId, successUrl, and cancelUrl are required");
    }

    const session = await stripeService.createCheckoutSessionForSubscription(
      req.user!.id,
      variantId,
      successUrl,
      cancelUrl,
      discountCode
    );

    res.json({ status: "success", data: { sessionId: session.id, url: session.url } });
  }
);

export const createCheckoutForMultiSubscription = asyncHandler(
  async (req: Request, res: Response) => {
    const { items, successUrl, cancelUrl, discountCode } = req.body;

    if (!items || !Array.isArray(items) || !items.length || !successUrl || !cancelUrl) {
      throw ApiError.badRequest("items (non-empty array), successUrl, and cancelUrl are required");
    }

    const session = await stripeService.createCheckoutSessionForMultiSubscription(
      req.user!.id,
      items,
      successUrl,
      cancelUrl,
      discountCode
    );

    res.json({ status: "success", data: { sessionId: session.id, url: session.url } });
  }
);

export const createCheckoutForBundle = asyncHandler(
  async (req: Request, res: Response) => {
    const { bundleId, successUrl, cancelUrl, discountCode } = req.body;

    if (!bundleId || !successUrl || !cancelUrl) {
      throw ApiError.badRequest("bundleId, successUrl, and cancelUrl are required");
    }

    const session = await stripeService.createCheckoutSessionForBundle(
      req.user!.id,
      bundleId,
      successUrl,
      cancelUrl,
      discountCode
    );

    res.json({ status: "success", data: { sessionId: session.id, url: session.url } });
  }
);

export const createCheckoutForRental = asyncHandler(
  async (req: Request, res: Response) => {
    const { rentalOptionId, successUrl, cancelUrl } = req.body;

    if (!rentalOptionId || !successUrl || !cancelUrl) {
      throw ApiError.badRequest(
        "rentalOptionId, successUrl, and cancelUrl are required"
      );
    }

    const session = await stripeService.createCheckoutSessionForRental(
      req.user!.id,
      rentalOptionId,
      successUrl,
      cancelUrl
    );

    res.json({ status: "success", data: { sessionId: session.id, url: session.url } });
  }
);

export const createCheckoutForPurchase = asyncHandler(
  async (req: Request, res: Response) => {
    const { purchaseOptionId, successUrl, cancelUrl } = req.body;

    if (!purchaseOptionId || !successUrl || !cancelUrl) {
      throw ApiError.badRequest(
        "purchaseOptionId, successUrl, and cancelUrl are required"
      );
    }

    const session = await stripeService.createCheckoutSessionForPurchase(
      req.user!.id,
      purchaseOptionId,
      successUrl,
      cancelUrl
    );

    res.json({ status: "success", data: { sessionId: session.id, url: session.url } });
  }
);

export const verifySession = asyncHandler(
  async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === "paid" || session.status === "complete") {
      await handleWebhookEvent({
        type: "checkout.session.completed",
        data: { object: session },
      } as any);

      // Also process the invoice so invoice numbers appear in Sales
      const stripeSubscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;

      if (stripeSubscriptionId) {
        try {
          const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
          const latestInvoiceId =
            typeof subscription.latest_invoice === "string"
              ? subscription.latest_invoice
              : subscription.latest_invoice?.id;

          if (latestInvoiceId) {
            const invoice = await stripe.invoices.retrieve(latestInvoiceId);
            if (invoice.status === "paid") {
              await handleWebhookEvent({
                type: "invoice.paid",
                data: { object: invoice },
              } as any);

              // Revenue share: transfer creator's cut
              const meta = session.metadata ?? {};
              const channelId = meta.channelId;
              const amountPaidCents = invoice.amount_paid;

              if (channelId && amountPaidCents > 0) {
                const creators = await prisma.creatorProfile.findMany({
                  where: {
                    channelCreators: { some: { channelId, status: "APPROVED" } },
                    stripeConnectAccountId: { not: null },
                    revSharePercent: { not: null, gt: 0 },
                  },
                });
                for (const creator of creators) {
                  const transferCents = Math.floor(
                    amountPaidCents * (creator.revSharePercent! / 100)
                  );
                  if (transferCents > 0) {
                    await stripe.transfers.create({
                      amount: transferCents,
                      currency: invoice.currency ?? "usd",
                      destination: creator.stripeConnectAccountId!,
                      transfer_group: `sub_${stripeSubscriptionId}`,
                      metadata: {
                        creatorProfileId: creator.id,
                        channelId,
                        stripeSubscriptionId,
                        revSharePercent: String(creator.revSharePercent),
                      },
                    });
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error("[revshare] transfer error:", err);
          // Non-fatal: invoice/transfer failed, subscription still active
        }
      }
    }

    res.json({
      status: "success",
      data: {
        paymentStatus: session.payment_status,
        sessionStatus: session.status,
      },
    });
  }
);

export const handleWebhook = asyncHandler(
  async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"];
    if (!sig) throw ApiError.badRequest("Missing stripe-signature header");

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      throw ApiError.badRequest(`Webhook signature verification failed: ${message}`);
    }

    await handleWebhookEvent(event);

    res.json({ received: true });
  }
);
