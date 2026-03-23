import { Request, Response } from "express";
import type Stripe from "stripe";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { prisma } from "../lib/prisma";
import { stripe } from "../lib/stripe";

function stripeCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): string | null {
  if (!customer) return null;
  if (typeof customer === "string") return customer;
  if ("deleted" in customer && customer.deleted) return null;
  if ("id" in customer) return customer.id;
  return null;
}

export const createSetupIntent = asyncHandler(
  async (req: Request, res: Response) => {
    const advertiser = await prisma.advertiser.findUnique({
      where: { id: req.advertiser!.id },
    });

    if (!advertiser?.stripeCustomerId) {
      throw ApiError.badRequest("No Stripe customer on file");
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: advertiser.stripeCustomerId,
      payment_method_types: ["card"],
    });

    res.json({
      status: "success",
      data: { clientSecret: setupIntent.client_secret },
    });
  }
);

export const listPaymentMethods = asyncHandler(
  async (req: Request, res: Response) => {
    const advertiser = await prisma.advertiser.findUnique({
      where: { id: req.advertiser!.id },
    });

    if (!advertiser?.stripeCustomerId) {
      return res.json({ status: "success", data: [] });
    }

    const methods = await stripe.paymentMethods.list({
      customer: advertiser.stripeCustomerId,
      type: "card",
    });

    const data = methods.data.map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand ?? null,
      last4: pm.card?.last4 ?? null,
      expMonth: pm.card?.exp_month ?? null,
      expYear: pm.card?.exp_year ?? null,
    }));

    res.json({ status: "success", data });
  }
);

export const completeSetup = asyncHandler(
  async (req: Request, res: Response) => {
    const { setupIntentId } = req.body as { setupIntentId?: string };
    if (!setupIntentId) {
      throw ApiError.badRequest("setupIntentId is required");
    }

    const advertiser = await prisma.advertiser.findUnique({
      where: { id: req.advertiser!.id },
    });

    if (!advertiser?.stripeCustomerId) {
      throw ApiError.badRequest("No Stripe customer on file");
    }

    const si = await stripe.setupIntents.retrieve(setupIntentId);
    const siCustomerId = stripeCustomerId(si.customer);
    if (
      !siCustomerId ||
      siCustomerId !== advertiser.stripeCustomerId
    ) {
      throw ApiError.forbidden("Invalid setup intent for this account");
    }
    if (si.status !== "succeeded") {
      throw ApiError.badRequest(
        `Card setup not complete (status: ${si.status})`
      );
    }

    const pmId =
      typeof si.payment_method === "string"
        ? si.payment_method
        : si.payment_method?.id;
    if (!pmId) {
      throw ApiError.badRequest("No payment method attached to setup intent");
    }

    await stripe.customers.update(advertiser.stripeCustomerId, {
      invoice_settings: { default_payment_method: pmId },
    });

    res.json({
      status: "success",
      data: { defaultPaymentMethodId: pmId },
    });
  }
);

export const removePaymentMethod = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const advertiser = await prisma.advertiser.findUnique({
      where: { id: req.advertiser!.id },
    });

    if (!advertiser?.stripeCustomerId) {
      throw ApiError.badRequest("No Stripe customer on file");
    }

    const pm = await stripe.paymentMethods.retrieve(id);
    const pmCustomerId = stripeCustomerId(pm.customer);
    if (pmCustomerId !== advertiser.stripeCustomerId) {
      throw ApiError.forbidden("Not your payment method");
    }

    await stripe.paymentMethods.detach(id);
    res.json({ status: "success", message: "Payment method removed" });
  }
);
