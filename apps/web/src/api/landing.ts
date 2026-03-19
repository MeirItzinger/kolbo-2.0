import type { LandingHero, ContentRow, HomepageElement } from "@/types";
import { api } from "./client";

export async function getLandingHeroes(): Promise<LandingHero[]> {
  const { data } = await api.get("/landing-heroes", { params: { active: true } });
  return data.data ?? data;
}

export async function getContentRows(params?: {
  channelId?: string;
}): Promise<ContentRow[]> {
  const { data } = await api.get("/content-rows", { params });
  return data.data ?? data;
}

export async function getHomepageElements(): Promise<HomepageElement[]> {
  const { data } = await api.get("/homepage-elements");
  return data.data ?? data;
}

export async function getChannelContentRows(
  channelSlug: string,
): Promise<ContentRow[]> {
  const { data } = await api.get("/content-rows", {
    params: { channelId: channelSlug },
  });
  return data.data ?? data;
}
