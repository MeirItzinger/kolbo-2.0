import type {
  UserSubscription,
  UserPurchase,
  PaymentMethod,
  Device,
  WatchHistory,
  PaginatedResponse,
} from "@/types";
import { api } from "./client";

export async function getSubscriptions(): Promise<{ channelSubscriptions: any[]; bundleSubscriptions: any[] }> {
  const { data } = await api.get("/account/subscriptions");
  return data?.data ?? { channelSubscriptions: [], bundleSubscriptions: [] };
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await api.post(`/account/subscriptions/${subscriptionId}/cancel`);
}

export async function getPurchases(params?: {
  page?: number;
  perPage?: number;
}): Promise<PaginatedResponse<UserPurchase>> {
  const { data } = await api.get("/account/purchases", { params });
  return data;
}

export async function getRentals(params?: {
  page?: number;
  perPage?: number;
}): Promise<PaginatedResponse<UserPurchase>> {
  const { data } = await api.get("/account/rentals", { params });
  return data;
}

export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  const { data } = await api.get("/account/payment-methods");
  return data;
}

export async function getDevices(): Promise<Device[]> {
  const { data } = await api.get("/account/devices");
  return data;
}

export async function getWatchHistory(params?: {
  page?: number;
  perPage?: number;
}): Promise<PaginatedResponse<WatchHistory>> {
  const { data } = await api.get("/account/watch-history", { params });
  return data;
}

export interface AccountSettings {
  requirePinForPurchases: boolean;
  hasParentalPin: boolean;
}

export async function getAccountSettings(): Promise<AccountSettings> {
  const { data } = await api.get("/account/settings");
  return data.data ?? data;
}

export async function updateAccountSettings(
  settings: Partial<Pick<AccountSettings, 'requirePinForPurchases'>>
): Promise<void> {
  await api.patch("/account/settings", settings);
}

export async function setParentalPin(pin: string): Promise<void> {
  await api.post("/account/parental-pin", { pin });
}

export async function verifyParentalPin(pin: string): Promise<void> {
  await api.post("/account/parental-pin/verify", { pin });
}

export async function clearParentalPin(): Promise<void> {
  await api.delete("/account/parental-pin");
}
