import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users as UsersIcon,
  Search,
  Mail,
  KeyRound,
  LogOut,
  UserX,
  UserCheck,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  adminListUsers,
  adminInviteUser,
  adminSendPasswordReset,
  adminRevokeSessions,
  adminUpdateUser,
  type AdminUser,
  type InviteResult,
  type PasswordResetResult,
} from "@/api/adminUsers";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { formatDate } from "@/lib/utils";
import { InviteLinkDialog } from "./ChannelsPage";

const PAGE_SIZE = 20;

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All roles" },
  { value: "SUPER_ADMIN", label: "Super admin" },
  { value: "CHANNEL_ADMIN", label: "Channel admin" },
  { value: "CREATOR_ADMIN", label: "Creator admin" },
  { value: "USER", label: "User" },
];

const ACTIVE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Any status" },
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
];

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [role, setRole] = useState("");
  const [active, setActive] = useState("");
  const [invite, setInvite] = useState<{
    user: AdminUser;
    result: InviteResult;
  } | null>(null);
  const [reset, setReset] = useState<{
    user: AdminUser;
    result: PasswordResetResult;
  } | null>(null);
  const [confirm, setConfirm] = useState<{
    kind: "revoke" | "deactivate" | "activate";
    user: AdminUser;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
    setTimeout(() => setDebounced(value), 250);
  }

  const usersQuery = useQuery({
    queryKey: ["admin", "users", { page, debounced, role, active }],
    queryFn: () =>
      adminListUsers({
        page,
        limit: PAGE_SIZE,
        search: debounced || undefined,
        role: role || undefined,
        active: active === "" ? undefined : active === "true",
      }),
  });

  const inviteMutation = useMutation({
    mutationFn: (user: AdminUser) =>
      adminInviteUser(user.id, { sendEmail: true }).then((result) => ({
        user,
        result,
      })),
    onSuccess: ({ user, result }) => setInvite({ user, result }),
    onError: (err: any) =>
      setActionError(err?.response?.data?.message ?? "Could not send invite."),
  });

  const resetMutation = useMutation({
    mutationFn: (user: AdminUser) =>
      adminSendPasswordReset(user.id, { sendEmail: true }).then((result) => ({
        user,
        result,
      })),
    onSuccess: ({ user, result }) => setReset({ user, result }),
    onError: (err: any) =>
      setActionError(
        err?.response?.data?.message ?? "Could not send password reset.",
      ),
  });

  const revokeMutation = useMutation({
    mutationFn: (user: AdminUser) => adminRevokeSessions(user.id),
    onSuccess: () => {
      setConfirm(null);
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (err: any) =>
      setActionError(
        err?.response?.data?.message ?? "Could not revoke sessions.",
      ),
  });

  const setActiveMutation = useMutation({
    mutationFn: ({ user, isActive }: { user: AdminUser; isActive: boolean }) =>
      adminUpdateUser(user.id, { isActive }),
    onSuccess: () => {
      setConfirm(null);
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (err: any) =>
      setActionError(
        err?.response?.data?.message ?? "Could not update user status.",
      ),
  });

  const users = usersQuery.data?.data ?? [];
  const total = usersQuery.data?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-sm text-surface-400">
            Manage platform users, send invites, and reset passwords.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
              <Input
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by name or email"
                className="pl-9"
              />
            </div>
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-md border border-surface-700 bg-surface-900 px-3 text-sm text-surface-100"
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={active}
              onChange={(e) => {
                setActive(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-md border border-surface-700 bg-surface-900 px-3 text-sm text-surface-100"
            >
              {ACTIVE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {actionError && (
        <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>{actionError}</span>
          <button
            type="button"
            className="text-xs underline"
            onClick={() => setActionError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {usersQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <UsersIcon className="mx-auto mb-4 h-12 w-12 text-surface-600" />
            <p className="text-lg font-medium text-white">No users found</p>
            <p className="mt-1 text-surface-400">
              Try adjusting your filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-surface-800">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-800 bg-surface-900">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-400">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-400">
                  Roles
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-400">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-400">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-surface-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800">
              {users.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  onInvite={() => {
                    setActionError(null);
                    inviteMutation.mutate(u);
                  }}
                  onReset={() => {
                    setActionError(null);
                    resetMutation.mutate(u);
                  }}
                  onRevoke={() =>
                    setConfirm({ kind: "revoke", user: u })
                  }
                  onToggleActive={() =>
                    setConfirm({
                      kind: u.isActive ? "deactivate" : "activate",
                      user: u,
                    })
                  }
                  busy={
                    inviteMutation.isPending ||
                    resetMutation.isPending ||
                    revokeMutation.isPending ||
                    setActiveMutation.isPending
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-surface-400">
            Page {page} of {totalPages} · {total} total
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {invite && (
        <InviteLinkDialog
          title={`Invite sent to ${invite.user.email}`}
          subtitle={
            invite.result.emailed
              ? `An invite email has been sent. You can also share the link below.`
              : `Email delivery is disabled. Share the link below with ${invite.user.email}.`
          }
          inviteUrl={invite.result.inviteUrl}
          onClose={() => setInvite(null)}
        />
      )}

      {reset && (
        <InviteLinkDialog
          title={`Password reset sent to ${reset.user.email}`}
          subtitle={
            reset.result.emailed
              ? `A password reset email has been sent. You can also share the link below.`
              : `Email delivery is disabled. Share the link below with ${reset.user.email}.`
          }
          inviteUrl={reset.result.resetUrl}
          onClose={() => setReset(null)}
        />
      )}

      {confirm && (
        <ConfirmDialog
          confirm={confirm}
          busy={revokeMutation.isPending || setActiveMutation.isPending}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setActionError(null);
            if (confirm.kind === "revoke") {
              revokeMutation.mutate(confirm.user);
            } else {
              setActiveMutation.mutate({
                user: confirm.user,
                isActive: confirm.kind === "activate",
              });
            }
          }}
        />
      )}
    </div>
  );
}

function UserRow({
  user,
  onInvite,
  onReset,
  onRevoke,
  onToggleActive,
  busy,
}: {
  user: AdminUser;
  onInvite: () => void;
  onReset: () => void;
  onRevoke: () => void;
  onToggleActive: () => void;
  busy: boolean;
}) {
  const roleLabels = user.roles
    .map((r) => {
      const base = r.role.name || r.role.key;
      const scope =
        r.channel?.name ?? r.creatorProfile?.displayName ?? null;
      return scope ? `${base} (${scope})` : base;
    })
    .filter(Boolean);

  return (
    <tr className="bg-surface-900/50 align-top hover:bg-surface-900">
      <td className="px-4 py-3">
        <div className="font-medium text-white">
          {user.firstName} {user.lastName}
        </div>
        <div className="text-xs text-surface-400">{user.email}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {!user.hasPassword && (
            <Badge variant="warning">No password set</Badge>
          )}
          {user.mustChangePassword && (
            <Badge variant="warning">Must change password</Badge>
          )}
          {!user.emailVerifiedAt && (
            <Badge variant="secondary">Email unverified</Badge>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        {roleLabels.length === 0 ? (
          <span className="text-xs text-surface-500">No roles</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {roleLabels.map((label, i) => (
              <Badge key={`${user.id}-role-${i}`} variant="secondary">
                {label}
              </Badge>
            ))}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <Badge variant={user.isActive ? "success" : "secondary"}>
          {user.isActive ? "Active" : "Inactive"}
        </Badge>
      </td>
      <td className="px-4 py-3 text-sm text-surface-400">
        {formatDate(user.createdAt)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={onInvite}
            title="Send invite link (sets initial password)"
          >
            <Mail className="mr-1.5 h-4 w-4" />
            Invite
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={onReset}
            title="Send password reset link"
          >
            <KeyRound className="mr-1.5 h-4 w-4" />
            Reset
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={onRevoke}
            title="Sign user out everywhere"
          >
            <LogOut className="mr-1.5 h-4 w-4" />
            Revoke
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={onToggleActive}
            title={user.isActive ? "Deactivate user" : "Activate user"}
          >
            {user.isActive ? (
              <>
                <UserX className="mr-1.5 h-4 w-4 text-destructive" />
                Deactivate
              </>
            ) : (
              <>
                <UserCheck className="mr-1.5 h-4 w-4 text-primary-400" />
                Activate
              </>
            )}
          </Button>
        </div>
      </td>
    </tr>
  );
}

function ConfirmDialog({
  confirm,
  busy,
  onCancel,
  onConfirm,
}: {
  confirm: { kind: "revoke" | "deactivate" | "activate"; user: AdminUser };
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titles: Record<typeof confirm.kind, string> = {
    revoke: "Revoke all sessions",
    deactivate: "Deactivate user",
    activate: "Activate user",
  };
  const messages: Record<typeof confirm.kind, string> = {
    revoke: `This will sign ${confirm.user.email} out of every device immediately. They can sign back in with their existing password.`,
    deactivate: `${confirm.user.email} will no longer be able to sign in. You can reactivate them at any time.`,
    activate: `${confirm.user.email} will regain the ability to sign in.`,
  };
  const buttonLabels: Record<typeof confirm.kind, string> = {
    revoke: "Revoke sessions",
    deactivate: "Deactivate",
    activate: "Activate",
  };
  const destructive = confirm.kind !== "activate";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="mx-4 w-full max-w-md">
        <CardHeader>
          <CardTitle
            className={`flex items-center gap-2 ${destructive ? "text-destructive" : "text-primary-400"}`}
          >
            <AlertTriangle className="h-5 w-5" />
            {titles[confirm.kind]}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-surface-300">{messages[confirm.kind]}</p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant={destructive ? "destructive" : "default"}
              onClick={onConfirm}
              disabled={busy}
            >
              {busy ? <Spinner size="sm" /> : buttonLabels[confirm.kind]}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
