import type {
  Channel,
  Category,
  CreatorProfile,
  Video,
  ContentRow,
  LandingHero,
  HomepageElement,
  SubscriptionPlan,
  Bundle,
  DirectUploadResponse,
  PaginatedResponse,
  SalesTransaction,
} from "@/types";
import { api } from "./client";

function unwrap<T>(data: any): T {
  return data?.data ?? data;
}

// ── Channels ───────────────────────────────────────────────────────

export async function adminListChannels(params?: {
  page?: number;
  perPage?: number;
}): Promise<PaginatedResponse<Channel>> {
  const { data } = await api.get("/channels", { params });
  return data;
}

export async function adminGetChannel(id: string): Promise<Channel> {
  const { data } = await api.get(`/channels/${id}`);
  return unwrap(data);
}

export async function adminCreateChannel(
  payload: Partial<Channel>,
): Promise<Channel> {
  const { data } = await api.post("/channels", payload);
  return unwrap(data);
}

export async function adminUpdateChannel(
  id: string,
  payload: Partial<Channel>,
): Promise<Channel> {
  const { data } = await api.patch(`/channels/${id}`, payload);
  return unwrap(data);
}

export async function adminDeleteChannel(id: string): Promise<void> {
  await api.delete(`/channels/${id}`);
}

// ── Creators ───────────────────────────────────────────────────────

export async function adminListCreators(params?: {
  channelId?: string;
  page?: number;
  perPage?: number;
}): Promise<PaginatedResponse<CreatorProfile>> {
  const { data } = await api.get("/creators", { params });
  return data;
}

export async function adminCreateCreator(
  payload: Partial<CreatorProfile>,
): Promise<CreatorProfile> {
  const { data } = await api.post("/creators", payload);
  return unwrap(data);
}

export async function adminUpdateCreator(
  id: string,
  payload: Partial<CreatorProfile>,
): Promise<CreatorProfile> {
  const { data } = await api.patch(`/creators/${id}`, payload);
  return unwrap(data);
}

export async function adminDeleteCreator(id: string): Promise<void> {
  await api.delete(`/creators/${id}`);
}

// ── Videos ─────────────────────────────────────────────────────────

export async function adminListVideos(params?: {
  channelId?: string;
  creatorProfileId?: string;
  status?: string;
  page?: number;
  perPage?: number;
}): Promise<PaginatedResponse<Video>> {
  const { data } = await api.get("/videos", { params });
  return data;
}

export async function adminGetVideo(id: string): Promise<Video> {
  const { data } = await api.get(`/videos/${id}`);
  return unwrap(data);
}

export async function adminCreateVideo(payload: Partial<Video>): Promise<Video> {
  const { data } = await api.post("/videos", payload);
  return unwrap(data);
}

export async function adminUpdateVideo(
  id: string,
  payload: Partial<Video>,
): Promise<Video> {
  const { data } = await api.patch(`/videos/${id}`, payload);
  return unwrap(data);
}

export async function adminDeleteVideo(id: string): Promise<void> {
  await api.delete(`/videos/${id}`);
}

export async function adminBulkDeleteVideos(ids: string[]): Promise<void> {
  await api.post("/videos/bulk-delete", { ids });
}

// ── Content Rows ───────────────────────────────────────────────────

export async function adminListContentRows(params?: {
  channelId?: string;
}): Promise<ContentRow[]> {
  const { data } = await api.get("/content-rows", { params });
  return unwrap(data);
}

export async function adminCreateContentRow(
  payload: Partial<ContentRow>,
): Promise<ContentRow> {
  const { data } = await api.post("/content-rows", payload);
  return unwrap(data);
}

export async function adminUpdateContentRow(
  id: string,
  payload: Partial<ContentRow>,
): Promise<ContentRow> {
  const { data } = await api.patch(`/content-rows/${id}`, payload);
  return unwrap(data);
}

export async function adminDeleteContentRow(id: string): Promise<void> {
  await api.delete(`/content-rows/${id}`);
}

// ── Landing Heroes ─────────────────────────────────────────────────

export async function adminListHeroes(params?: {
  channelId?: string;
}): Promise<LandingHero[]> {
  const { data } = await api.get("/landing-heroes", { params });
  return unwrap(data);
}

export async function adminCreateHero(
  payload: Partial<LandingHero>,
): Promise<LandingHero> {
  const { data } = await api.post("/landing-heroes", payload);
  return unwrap(data);
}

export async function adminUpdateHero(
  id: string,
  payload: Partial<LandingHero>,
): Promise<LandingHero> {
  const { data } = await api.patch(`/landing-heroes/${id}`, payload);
  return unwrap(data);
}

export async function adminDeleteHero(id: string): Promise<void> {
  await api.delete(`/landing-heroes/${id}`);
}

// ── Subscription Plans ─────────────────────────────────────────────

export async function adminListPlans(params?: {
  channelId?: string;
}): Promise<SubscriptionPlan[]> {
  const { data } = await api.get("/subscription-plans", { params });
  return unwrap(data);
}

export async function adminCreatePlan(
  payload: Partial<SubscriptionPlan>,
): Promise<SubscriptionPlan> {
  const { data } = await api.post("/subscription-plans", payload);
  return unwrap(data);
}

export async function adminUpdatePlan(
  id: string,
  payload: Partial<SubscriptionPlan>,
): Promise<SubscriptionPlan> {
  const { data } = await api.patch(`/subscription-plans/${id}`, payload);
  return unwrap(data);
}

export async function adminDeletePlan(id: string): Promise<void> {
  await api.delete(`/subscription-plans/${id}`);
}

export async function adminBulkDeletePlans(ids: string[]): Promise<void> {
  await api.post("/subscription-plans/bulk-delete", { ids });
}

// ── Bundles ────────────────────────────────────────────────────────

export async function adminListBundles(params?: {
  channelId?: string;
}): Promise<Bundle[]> {
  const { data } = await api.get("/bundles", { params });
  return unwrap(data);
}

export async function adminCreateBundle(
  payload: Partial<Bundle>,
): Promise<Bundle> {
  const { data } = await api.post("/bundles", payload);
  return unwrap(data);
}

export async function adminUpdateBundle(
  id: string,
  payload: Partial<Bundle>,
): Promise<Bundle> {
  const { data } = await api.patch(`/bundles/${id}`, payload);
  return unwrap(data);
}

export async function adminDeleteBundle(id: string): Promise<void> {
  await api.delete(`/bundles/${id}`);
}

// ── Homepage Elements ──────────────────────────────────────────────

export async function adminListHomepageElements(): Promise<HomepageElement[]> {
  const { data } = await api.get("/homepage-elements");
  return unwrap(data);
}

export async function adminCreateHomepageElement(
  payload: Partial<HomepageElement>,
): Promise<HomepageElement> {
  const { data } = await api.post("/homepage-elements", payload);
  return unwrap(data);
}

export async function adminUpdateHomepageElement(
  id: string,
  payload: Partial<HomepageElement> & { items?: { videoId: string; sortOrder: number }[] },
): Promise<HomepageElement> {
  const { data } = await api.patch(`/homepage-elements/${id}`, payload);
  return unwrap(data);
}

export async function adminDeleteHomepageElement(id: string): Promise<void> {
  await api.delete(`/homepage-elements/${id}`);
}

export async function adminReorderHomepageElements(
  ids: string[],
): Promise<void> {
  await api.post("/homepage-elements/reorder", { ids });
}

// ── Channel Page Elements ─────────────────────────────────────────

export async function adminListChannelPageElements(channelId: string): Promise<HomepageElement[]> {
  const { data } = await api.get(`/channels/${channelId}/page-elements`);
  return unwrap(data);
}

export async function adminCreateChannelPageElement(
  channelId: string,
  payload: Partial<HomepageElement>,
): Promise<HomepageElement> {
  const { data } = await api.post(`/channels/${channelId}/page-elements`, payload);
  return unwrap(data);
}

export async function adminUpdateChannelPageElement(
  channelId: string,
  id: string,
  payload: Partial<HomepageElement> & { items?: { videoId: string; sortOrder: number }[] },
): Promise<HomepageElement> {
  const { data } = await api.patch(`/channels/${channelId}/page-elements/${id}`, payload);
  return unwrap(data);
}

export async function adminDeleteChannelPageElement(channelId: string, id: string): Promise<void> {
  await api.delete(`/channels/${channelId}/page-elements/${id}`);
}

export async function adminReorderChannelPageElements(channelId: string, ids: string[]): Promise<void> {
  await api.post(`/channels/${channelId}/page-elements/reorder`, { ids });
}

// ── Categories ────────────────────────────────────────────────────

export async function adminListCategories(channelId: string): Promise<Category[]> {
  const { data } = await api.get(`/channels/${channelId}/categories`);
  return unwrap(data);
}

export async function adminCreateCategory(
  channelId: string,
  payload: { name: string; slug: string; sortOrder?: number; isActive?: boolean },
): Promise<Category> {
  const { data } = await api.post(`/channels/${channelId}/categories`, payload);
  return unwrap(data);
}

export async function adminUpdateCategory(
  channelId: string,
  id: string,
  payload: Partial<{ name: string; slug: string; sortOrder: number; isActive: boolean }>,
): Promise<Category> {
  const { data } = await api.patch(`/channels/${channelId}/categories/${id}`, payload);
  return unwrap(data);
}

export async function adminDeleteCategory(channelId: string, id: string): Promise<void> {
  await api.delete(`/channels/${channelId}/categories/${id}`);
}

export async function adminReorderCategories(channelId: string, ids: string[]): Promise<void> {
  await api.post(`/channels/${channelId}/categories/reorder`, { ids });
}

// ── Sales ──────────────────────────────────────────────────────────

export async function adminListSales(params?: {
  page?: number;
  perPage?: number;
  type?: string;
  search?: string;
}): Promise<PaginatedResponse<SalesTransaction>> {
  const { data } = await api.get("/sales", { params });
  return data;
}

export async function adminListSalesByChannel(
  channelId: string,
  params?: {
    page?: number;
    perPage?: number;
    type?: string;
    search?: string;
  }
): Promise<PaginatedResponse<SalesTransaction>> {
  const { data } = await api.get(`/channels/${channelId}/sales`, { params });
  return data;
}

// ── Uploads ────────────────────────────────────────────────────────

export async function createDirectUpload(payload: {
  videoId: string;
}): Promise<DirectUploadResponse> {
  const { data } = await api.post("/mux/direct-upload", payload);
  return unwrap(data);
}

export async function uploadImage(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post("/uploads/image", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return unwrap(data);
}
