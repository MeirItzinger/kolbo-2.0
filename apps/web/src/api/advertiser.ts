import axios from "axios";
import type {
  Advertiser,
  AdCampaign,
  AdCreative,
  AdvertiserPaymentMethod,
} from "@/types";

const ADV_TOKEN_KEY = "kolbo_adv_access_token";
const ADV_REFRESH_KEY = "kolbo_adv_refresh_token";

export const advApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

advApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(ADV_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

advApi.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }
    original._retry = true;

    if (!refreshPromise) {
      refreshPromise = refreshAdvToken().finally(() => {
        refreshPromise = null;
      });
    }

    try {
      const newToken = await refreshPromise;
      original.headers.Authorization = `Bearer ${newToken}`;
      return advApi(original);
    } catch {
      clearAdvTokens();
      window.location.href = "/advertise/login";
      return Promise.reject(error);
    }
  }
);

async function refreshAdvToken(): Promise<string> {
  const refreshToken = localStorage.getItem(ADV_REFRESH_KEY);
  if (!refreshToken) throw new Error("No refresh token");
  const { data } = await axios.post(
    `${import.meta.env.VITE_API_URL || "/api"}/advertiser/auth/refresh`,
    { refreshToken }
  );
  const result = data.data ?? data;
  setAdvTokens(result.accessToken, result.refreshToken);
  return result.accessToken;
}

export function setAdvTokens(access: string, refresh: string) {
  localStorage.setItem(ADV_TOKEN_KEY, access);
  localStorage.setItem(ADV_REFRESH_KEY, refresh);
}

export function clearAdvTokens() {
  localStorage.removeItem(ADV_TOKEN_KEY);
  localStorage.removeItem(ADV_REFRESH_KEY);
}

export function getAdvAccessToken(): string | null {
  return localStorage.getItem(ADV_TOKEN_KEY);
}

function unwrap<T>(data: { data?: T; status?: string }): T {
  return (data as any).data ?? data;
}

// ── Auth ──

interface AdvLoginResponse {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  advertiser: Advertiser;
}

export async function advertiserSignup(payload: {
  email: string;
  password: string;
  companyName: string;
  contactName: string;
  phone?: string;
}): Promise<AdvLoginResponse> {
  const { data } = await advApi.post("/advertiser/auth/signup", payload);
  return unwrap(data);
}

export async function advertiserLogin(payload: {
  email: string;
  password: string;
}): Promise<AdvLoginResponse> {
  const { data } = await advApi.post("/advertiser/auth/login", payload);
  return unwrap(data);
}

export async function advertiserLogout(): Promise<void> {
  await advApi.post("/advertiser/auth/logout");
}

export async function getAdvertiserMe(): Promise<Advertiser> {
  const { data } = await advApi.get("/advertiser/auth/me");
  return unwrap(data);
}

// ── Ad-eligible channels ──

export interface AdEligibleChannel {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  _count: { videos: number };
}

export async function getAdEligibleChannels(): Promise<AdEligibleChannel[]> {
  const { data } = await advApi.get("/advertiser/campaigns/ad-eligible-channels");
  return unwrap(data);
}

// ── Campaigns ──

export async function listCampaigns(): Promise<AdCampaign[]> {
  const { data } = await advApi.get("/advertiser/campaigns");
  return unwrap(data);
}

export async function getCampaign(id: string): Promise<AdCampaign> {
  const { data } = await advApi.get(`/advertiser/campaigns/${id}`);
  return unwrap(data);
}

export async function createCampaign(payload: {
  name: string;
  totalBudget: number;
  dailyMaxSpend: number;
  targetAgeMin?: number;
  targetAgeMax?: number;
  startDate?: string;
  endDate?: string;
  geoTargets?: { type: "CITY" | "ZIP_CODE"; value: string }[];
  channelIds?: string[];
}): Promise<AdCampaign> {
  const { data } = await advApi.post("/advertiser/campaigns", payload);
  return unwrap(data);
}

export async function updateCampaign(
  id: string,
  payload: Record<string, unknown>
): Promise<AdCampaign> {
  const { data } = await advApi.patch(`/advertiser/campaigns/${id}`, payload);
  return unwrap(data);
}

export async function deleteCampaign(id: string): Promise<void> {
  await advApi.delete(`/advertiser/campaigns/${id}`);
}

export async function submitCampaign(id: string): Promise<AdCampaign> {
  const { data } = await advApi.post(`/advertiser/campaigns/${id}/submit`);
  return unwrap(data);
}

export async function getAdUploadUrl(
  campaignId: string,
  fileName?: string
): Promise<{ uploadUrl: string; uploadId: string; creativeId: string }> {
  const { data } = await advApi.post(
    `/advertiser/campaigns/${campaignId}/upload`,
    { fileName }
  );
  return unwrap(data);
}

export async function deleteAdCreative(
  campaignId: string,
  creativeId: string
): Promise<void> {
  await advApi.delete(
    `/advertiser/campaigns/${campaignId}/creatives/${creativeId}`
  );
}

export async function updateAdCreative(
  campaignId: string,
  creativeId: string,
  payload: { fileName: string | null }
): Promise<AdCreative> {
  const { data } = await advApi.patch(
    `/advertiser/campaigns/${campaignId}/creatives/${creativeId}`,
    payload
  );
  return unwrap(data);
}

// ── Payment Methods ──

export async function createAdvSetupIntent(): Promise<{
  clientSecret: string;
}> {
  const { data } = await advApi.post(
    "/advertiser/payment-methods/setup-intent"
  );
  return unwrap(data);
}

export async function listAdvPaymentMethods(): Promise<
  AdvertiserPaymentMethod[]
> {
  const { data } = await advApi.get("/advertiser/payment-methods");
  return unwrap(data);
}

export async function removeAdvPaymentMethod(id: string): Promise<void> {
  await advApi.delete(`/advertiser/payment-methods/${id}`);
}

export async function completeAdvSetupIntent(setupIntentId: string): Promise<void> {
  await advApi.post("/advertiser/payment-methods/complete-setup", {
    setupIntentId,
  });
}

// ── Admin (uses regular user/admin auth, not advertiser auth) ──

import { api } from "./client";

export async function adminListAdCampaigns(params?: {
  status?: string;
}): Promise<AdCampaign[]> {
  const { data } = await api.get("/admin/ad-campaigns", { params });
  return unwrap(data);
}

export async function adminGetAdCampaign(id: string): Promise<AdCampaign> {
  const { data } = await api.get(`/admin/ad-campaigns/${id}`);
  return unwrap(data);
}

export async function adminApproveAdCampaign(
  id: string
): Promise<AdCampaign> {
  const { data } = await api.post(`/admin/ad-campaigns/${id}/approve`);
  return unwrap(data);
}

export async function adminRejectAdCampaign(
  id: string,
  reason?: string
): Promise<AdCampaign> {
  const { data } = await api.post(`/admin/ad-campaigns/${id}/reject`, {
    reason,
  });
  return unwrap(data);
}
