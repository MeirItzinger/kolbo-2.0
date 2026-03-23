import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export interface RecordAdViewPayload {
  videoId: string;
  campaignId: string;
  creativeId: string;
  idempotencyKey: string;
}

export interface RecordAdViewResult {
  success: boolean;
  duplicate?: boolean;
  paymentIntentId?: string | null;
  chargedAmountCents?: number;
  amountUsd?: string;
  status?: string;
  errorMessage?: string | null;
}

export async function recordAdViewCharge(
  payload: RecordAdViewPayload
): Promise<RecordAdViewResult> {
  const { data } = await axios.post(`${API_BASE}/playback/ad-view`, payload);
  return data?.data ?? data;
}
