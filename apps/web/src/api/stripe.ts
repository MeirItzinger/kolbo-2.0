import type { CheckoutSessionResponse, DiscountValidation } from "@/types";
import { api } from "./client";

export async function createCheckoutSubscription(payload: {
  variantId: string;
  successUrl: string;
  cancelUrl: string;
  discountCode?: string;
}): Promise<CheckoutSessionResponse> {
  const { data } = await api.post("/stripe/checkout/subscription", payload);
  return data.data ?? data;
}

export async function createCheckoutMultiSubscription(payload: {
  items: Array<{ planId: string; variantId: string; channelId: string }>;
  successUrl: string;
  cancelUrl: string;
  discountCode?: string;
}): Promise<CheckoutSessionResponse> {
  const { data } = await api.post("/stripe/checkout/subscriptions", payload);
  return data.data ?? data;
}

export async function createCheckoutBundle(payload: {
  bundleId: string;
  successUrl: string;
  cancelUrl: string;
  discountCode?: string;
}): Promise<CheckoutSessionResponse> {
  const { data } = await api.post("/stripe/checkout/bundle", payload);
  return data.data ?? data;
}

export async function createCheckoutRental(payload: {
  rentalOptionId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<CheckoutSessionResponse> {
  const { data } = await api.post("/stripe/checkout/rental", payload);
  return data.data ?? data;
}

export async function createCheckoutPurchase(payload: {
  purchaseOptionId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<CheckoutSessionResponse> {
  const { data } = await api.post("/stripe/checkout/purchase", payload);
  return data.data ?? data;
}

export async function validateDiscount(payload: {
  code: string;
  channelId: string;
}): Promise<DiscountValidation> {
  const { data } = await api.post("/discount-codes/validate", payload);
  return data.data ?? data;
}
