import type { Channel, Category } from "@/types";
import { api } from "./client";

export async function listChannels(params?: {
  page?: number;
  perPage?: number;
  limit?: number;
  search?: string;
  active?: boolean;
}): Promise<{ data: Channel[]; meta: { page: number; limit: number; total: number } }> {
  const { perPage, ...rest } = params ?? {};
  const { data } = await api.get("/channels", {
    params: { ...rest, ...(perPage ? { limit: perPage } : {}) },
  });
  return data?.data ? data : { data: data?.data ?? data, meta: data?.meta };
}

export async function getChannel(idOrSlug: string): Promise<Channel> {
  const { data } = await api.get(`/channels/${idOrSlug}`);
  return data.data ?? data;
}

export async function getChannelPageElements(channelId: string) {
  const { data } = await api.get(`/channels/${channelId}/page-elements`);
  return data.data ?? data;
}

export async function getChannelCategories(channelId: string): Promise<Category[]> {
  const { data } = await api.get(`/channels/${channelId}/categories`);
  return data.data ?? data;
}
