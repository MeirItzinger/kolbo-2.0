import { api } from "./client";
import type { Profile } from "@/types";

export interface ProfileInput {
  name: string;
  avatarUrl?: string | null;
  maturitySettings?: string | null;
  isKidsProfile?: boolean;
}

export async function listProfiles(): Promise<Profile[]> {
  const { data } = await api.get("/profiles");
  return data?.data ?? [];
}

export async function getProfile(id: string): Promise<Profile> {
  const { data } = await api.get(`/profiles/${id}`);
  return data.data;
}

export async function createProfile(input: ProfileInput): Promise<Profile> {
  const { data } = await api.post("/profiles", input);
  return data.data;
}

export async function updateProfile(
  id: string,
  patch: Partial<ProfileInput>,
): Promise<Profile> {
  const { data } = await api.patch(`/profiles/${id}`, patch);
  return data.data;
}

export async function deleteProfile(id: string): Promise<void> {
  await api.delete(`/profiles/${id}`);
}

export async function uploadAvatar(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/uploads/avatar", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data.url as string;
}
