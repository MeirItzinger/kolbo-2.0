import type { Video, PaginatedResponse } from "@/types";
import { api } from "./client";

export async function listVideos(params?: {
  page?: number;
  perPage?: number;
  channelId?: string;
  creatorProfileId?: string;
  status?: string;
  search?: string;
  categoryId?: string;
}): Promise<{ data: Video[]; meta: { page: number; limit: number; total: number } }> {
  const { perPage, ...rest } = params ?? {};
  const { data } = await api.get("/videos", {
    params: { ...rest, ...(perPage ? { limit: perPage } : {}) },
  });
  return data;
}

export async function getVideo(slugOrId: string): Promise<Video> {
  const { data } = await api.get(`/videos/${slugOrId}`);
  return data?.data ?? data;
}
