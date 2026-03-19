import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { stripe } from "../lib/stripe";
import { env } from "../config/env";
import * as stripeService from "../services/stripe/stripeService";
import { handleWebhookEvent } from "../services/stripe/stripeWebhookService";

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
      const { handleWebhookEvent: processEvent } = await import(
        "../services/stripe/stripeWebhookService"
      );
      await processEvent({
        type: "checkout.session.completed",
        data: { object: session },
      } as any);
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
