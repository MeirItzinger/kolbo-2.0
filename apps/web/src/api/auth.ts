import type { User } from "@/types";
import { api } from "./client";

interface LoginResponse {
  accessToken: string;
  refreshToken?: string;
  sessionId: string;
  user: User;
}

export async function signup(payload: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<LoginResponse> {
  const { data } = await api.post("/auth/signup", payload);
  return data.data ?? data;
}

export async function login(payload: {
  email: string;
  password: string;
}): Promise<LoginResponse> {
  const { data } = await api.post("/auth/login", payload);
  return data.data ?? data;
}

export async function logout(): Promise<void> {
  await api.post("/auth/logout");
}

export async function refresh(refreshToken: string): Promise<LoginResponse> {
  const { data } = await api.post("/auth/refresh", { refreshToken });
  return data.data ?? data;
}

export async function verifyEmail(token: string): Promise<void> {
  await api.post("/auth/verify-email", { token });
}

export async function resendVerification(email: string): Promise<void> {
  await api.post("/auth/resend-verification", { email });
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post("/auth/forgot-password", { email });
}

export async function resetPassword(payload: {
  token: string;
  password: string;
}): Promise<void> {
  await api.post("/auth/reset-password", payload);
}

export async function getMe(): Promise<User> {
  const { data } = await api.get("/auth/me");
  return data.data ?? data;
}
