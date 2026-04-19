import { api } from "./client";

export interface AdminUsersListResponse {
  data: AdminUser[];
  meta: { page: number; limit: number; total: number };
}

export interface AdminUserRoleAssignment {
  id: string;
  channelId: string | null;
  creatorProfileId: string | null;
  role: { id: string; key: string; name: string };
  channel: { id: string; slug: string; name: string } | null;
  creatorProfile: { id: string; slug: string; displayName: string } | null;
}

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  emailVerifiedAt: string | null;
  mustChangePassword: boolean;
  lastPasswordChangedAt: string | null;
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
  roles: AdminUserRoleAssignment[];
}

export interface InviteResult {
  inviteUrl: string;
  expiresAt: string;
  emailed: boolean;
}

export interface PasswordResetResult {
  resetUrl: string;
  expiresAt: string;
  emailed: boolean;
}

export async function adminListUsers(params?: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  active?: boolean;
}): Promise<AdminUsersListResponse> {
  const { data } = await api.get("/admin/users", { params });
  return { data: data.data ?? [], meta: data.meta };
}

export async function adminGetUser(id: string): Promise<AdminUser> {
  const { data } = await api.get(`/admin/users/${id}`);
  return data.data ?? data;
}

export async function adminUpdateUser(
  id: string,
  payload: { firstName?: string; lastName?: string; isActive?: boolean }
): Promise<AdminUser> {
  const { data } = await api.patch(`/admin/users/${id}`, payload);
  return data.data ?? data;
}

export async function adminInviteUser(
  id: string,
  payload?: { sendEmail?: boolean }
): Promise<InviteResult> {
  const { data } = await api.post(`/admin/users/${id}/invite`, payload ?? {});
  return data.data ?? data;
}

export async function adminSendPasswordReset(
  id: string,
  payload?: { sendEmail?: boolean }
): Promise<PasswordResetResult> {
  const { data } = await api.post(
    `/admin/users/${id}/password-reset`,
    payload ?? {}
  );
  return data.data ?? data;
}

export async function adminRevokeSessions(id: string): Promise<void> {
  await api.post(`/admin/users/${id}/revoke-sessions`);
}
