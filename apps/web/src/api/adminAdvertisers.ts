import { api } from "./client";
import type { AdvertiserWithCampaigns, AdCampaign } from "@/types";

function unwrap<T>(data: { data?: T } | T): T {
  return (data as any)?.data ?? data;
}

export async function adminGetAdvertiserPlatformSettings(): Promise<{
  defaultPricePerViewUsd: string;
}> {
  const { data } = await api.get("/admin/advertisers/settings");
  return unwrap(data);
}

export async function adminUpdateAdvertiserPlatformSettings(payload: {
  defaultPricePerViewUsd: string | number;
}): Promise<{ defaultPricePerViewUsd: string }> {
  const { data } = await api.patch("/admin/advertisers/settings", payload);
  return unwrap(data);
}

export async function adminListAdvertisersWithCampaigns(): Promise<
  AdvertiserWithCampaigns[]
> {
  const { data } = await api.get("/admin/advertisers");
  return unwrap(data);
}

export async function adminPatchAdCampaign(
  campaignId: string,
  payload: { pricePerViewUsd: string | number | null },
): Promise<AdCampaign> {
  const { data } = await api.patch(`/admin/ad-campaigns/${campaignId}`, payload);
  return unwrap(data);
}
