import type { CheckoutSessionResponse, DiscountValidation } from "@/types";
import { api } from "./client";

export async function createCheckoutSubscription(payload: {
  variantId: string;
  successUrl: string;
  cancelUrl: string;
  discountCode?: string;
  profileId?: string | null;
}): Promise<CheckoutSessionResponse> {
  const { data } = await api.post("/stripe/checkout/subscription", payload);
  return data.data ?? data;
}

export async function createCheckoutMultiSubscription(payload: {
  items: Array<{ planId: string; variantId: string; channelId: string }>;
  successUrl: string;
  cancelUrl: string;
  discountCode?: string;
  profileId?: string | null;
}): Promise<CheckoutSessionResponse> {
  const { data } = await api.post("/stripe/checkout/subscriptions", payload);
  return data.data ?? data;
}

export async function createCheckoutBundle(payload: {
  bundleId: string;
  successUrl: string;
  cancelUrl: string;
  discountCode?: string;
  profileId?: string | null;
}): Promise<CheckoutSessionResponse> {
  const { data } = await api.post("/stripe/checkout/bundle", payload);
  return data.data ?? data;
}

export async function createCheckoutRental(payload: {
  rentalOptionId: string;
  successUrl: string;
  cancelUrl: string;
  profileId?: string | null;
}): Promise<CheckoutSessionResponse> {
  const { data } = await api.post("/stripe/checkout/rental", payload);
  return data.data ?? data;
}

export async function createCheckoutPurchase(payload: {
  purchaseOptionId: string;
  successUrl: string;
  cancelUrl: string;
  profileId?: string | null;
}): Promise<CheckoutSessionResponse> {
  const { data } = await api.post("/stripe/checkout/purchase", payload);
  return data.data ?? data;
}

export interface PurchasesBlockedDetails {
  profileName?: string;
}

export interface PurchasesBlockedResponse {
  status: "error";
  code: "PARENTAL_BLOCKED";
  reason: "PURCHASES";
  message: string;
  details: PurchasesBlockedDetails;
}

export function isPurchasesBlockedError(
  err: unknown,
): err is { response: { status: 403; data: PurchasesBlockedResponse } } {
  const maybe = err as
    | { response?: { status?: number; data?: { code?: string; reason?: string } } }
    | undefined;
  return (
    !!maybe?.response &&
    maybe.response.status === 403 &&
    maybe.response.data?.code === "PARENTAL_BLOCKED" &&
    maybe.response.data?.reason === "PURCHASES"
  );
}

export async function validateDiscount(payload: {
  code: string;
  channelId: string;
}): Promise<DiscountValidation> {
  const { data } = await api.post("/discount-codes/validate", payload);
  return data.data ?? data;
}
