import type { Category } from "@/types";
import { api } from "./client";

export async function listCategories(): Promise<Category[]> {
  const { data } = await api.get("/categories");
  return data.data ?? data;
}
