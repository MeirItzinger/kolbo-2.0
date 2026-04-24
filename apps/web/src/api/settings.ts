import { api } from "./client";

export interface AccountSettings {
  requirePinForPurchases: boolean;
}

export async function getAccountSettings(): Promise<AccountSettings> {
  const { data } = await api.get("/account/settings");
  return data?.data ?? { requirePinForPurchases: false };
}

export async function updateAccountSettings(
  patch: Partial<AccountSettings>,
): Promise<AccountSettings> {
  const { data } = await api.patch("/account/settings", patch);
  return data?.data ?? { requirePinForPurchases: false };
}
