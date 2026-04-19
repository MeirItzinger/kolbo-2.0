import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Users, AlertTriangle, ExternalLink } from "lucide-react";
import {
  adminListCreators,
  adminCreateCreator,
  adminUpdateCreator,
  adminDeleteCreator,
  adminListChannels,
  adminGetChannel,
  adminCreateConnectOnboardingLink,
  type AdminProvisionInfo,
  type CreatorWithAdmin,
} from "@/api/admin";
import { InviteLinkDialog } from "./ChannelsPage";
import { useAuth } from "@/hooks/useAuth";
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
import { slugify } from "@/lib/utils";
import type { CreatorProfile } from "@/types";

const creatorBaseSchema = z.object({
  channelId: z.string().optional(),
  displayName: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  bio: z.string().optional(),
  avatarUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  revSharePercent: z.coerce.number().min(0).max(100).optional().or(z.literal("")),
});

const creatorCreateSchema = creatorBaseSchema.extend({
  adminEmail: z.string().email("Valid email required"),
  adminFirstName: z.string().optional(),
  adminLastName: z.string().optional(),
  adminSendEmail: z.boolean().optional(),
});

const creatorEditSchema = creatorBaseSchema.extend({
  adminEmail: z.string().optional(),
  adminFirstName: z.string().optional(),
  adminLastName: z.string().optional(),
  adminSendEmail: z.boolean().optional(),
});

type CreatorFormData = z.infer<typeof creatorCreateSchema>;

export default function AdminCreatorsPage() {
  const { user, hasRole } = useAuth();
  const isSuperAdmin = hasRole("SUPER_ADMIN");
  const channelAdminChannelId = !isSuperAdmin
    ? user?.roles.find((r) => r.role?.key === "CHANNEL_ADMIN" && r.channelId)?.channelId ?? ""
    : "";

  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CreatorProfile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CreatorProfile | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [provisioned, setProvisioned] = useState<{
    creatorName: string;
    admin: AdminProvisionInfo;
  } | null>(null);

  async function handleConnectStripe(creatorId: string) {
    setConnectingId(creatorId);
    try {
      const { url } = await adminCreateConnectOnboardingLink(creatorId);
      window.location.href = url;
    } catch (e) {
      console.error(e);
      setConnectingId(null);
    }
  }

  const creatorsQuery = useQuery({
    queryKey: ["admin", "creators", channelAdminChannelId],
    queryFn: () =>
      adminListCreators({
        perPage: 100,
        ...(channelAdminChannelId ? { channelId: channelAdminChannelId } : {}),
      }),
  });

  const channelsQuery = useQuery({
    queryKey: ["admin", "channels", "list"],
    queryFn: () => adminListChannels({ perPage: 100 }),
    enabled: isSuperAdmin,
  });

  const channelDetailQuery = useQuery({
    queryKey: ["admin", "channel", channelAdminChannelId],
    queryFn: () => adminGetChannel(channelAdminChannelId),
    enabled: !!channelAdminChannelId,
  });

  const creators = creatorsQuery.data?.data ?? [];
  const channels = isSuperAdmin
    ? (channelsQuery.data?.data ?? [])
    : channelDetailQuery.data
      ? [{ id: channelDetailQuery.data.id, name: channelDetailQuery.data.name }]
      : [];

  const deleteMutation = useMutation({
    mutationFn: adminDeleteCreator,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "creators"] });
      setDeleteTarget(null);
    },
  });

  const creatorChannels = (cr: any) => {
    if (cr.channelCreators?.length) {
      return cr.channelCreators.map((cc: any) => cc.channel?.name ?? cc.channelId).join(", ");
    }
    return "—";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Creators</h1>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="h-4 w-4" />
          Add Creator
        </Button>
      </div>

      {creatorsQuery.isLoading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : creators.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-surface-600" />
            <p className="text-lg font-medium text-white">No creators yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-surface-800">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-800 bg-surface-900">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-400">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-400">Slug</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-400">Channel</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-surface-400">Rev Share</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-surface-400">Stripe Connect</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-surface-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800">
              {creators.map((cr: any) => (
                <tr key={cr.id} className="bg-surface-900/50 hover:bg-surface-900">
                  <td className="px-4 py-3 font-medium text-white">{cr.displayName}</td>
                  <td className="px-4 py-3 text-sm text-surface-400">{cr.slug}</td>
                  <td className="px-4 py-3 text-sm text-surface-400">{creatorChannels(cr)}</td>
                  <td className="px-4 py-3 text-center text-sm">
                    {cr.revSharePercent != null
                      ? <Badge variant="secondary">{cr.revSharePercent}%</Badge>
                      : <span className="text-surface-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {cr.stripeConnectAccountId ? (
                      <Badge variant="success">Connected</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={connectingId === cr.id}
                        onClick={() => handleConnectStripe(cr.id)}
                      >
                        <ExternalLink className="h-3 w-3" />
                        {connectingId === cr.id ? "Redirecting…" : "Connect Stripe"}
                      </Button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(cr); setShowForm(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(cr)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <CreatorFormDialog
          channels={channels}
          creator={editing}
          lockedChannelId={channelAdminChannelId || undefined}
          channelName={channelDetailQuery.data?.name}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onCreated={(creator) => {
            setShowForm(false);
            setEditing(null);
            if (creator.admin) {
              setProvisioned({
                creatorName: creator.displayName,
                admin: creator.admin,
              });
            }
          }}
        />
      )}

      {provisioned && (
        <InviteLinkDialog
          title={`${provisioned.creatorName} created`}
          subtitle={
            provisioned.admin.alreadyHadAccount
              ? `${provisioned.admin.email} already has a Kolbo account, so no invite was needed. They are now a creator admin.`
              : provisioned.admin.invitedByEmail
                ? `An invite email has been sent to ${provisioned.admin.email}. You can also share the link below.`
                : `Share this invite link with ${provisioned.admin.email}. The link is valid for 7 days.`
          }
          inviteUrl={provisioned.admin.inviteUrl}
          onClose={() => setProvisioned(null)}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="mx-4 w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />Delete Creator
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-surface-300">
                Delete <strong className="text-white">{deleteTarget.displayName}</strong>? This cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
                <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleteTarget.id)}>
                  {deleteMutation.isPending ? <Spinner size="sm" /> : "Delete"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function CreatorFormDialog({
  channels,
  creator,
  lockedChannelId,
  channelName,
  onClose,
  onCreated,
}: {
  channels: { id: string; name: string }[];
  creator: CreatorProfile | null;
  lockedChannelId?: string;
  channelName?: string;
  onClose: () => void;
  onCreated: (creator: CreatorWithAdmin) => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!creator;

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<CreatorFormData>({
    resolver: zodResolver(isEdit ? creatorEditSchema : creatorCreateSchema),
    defaultValues: creator
      ? {
          channelId: (creator as any).channelCreators?.[0]?.channelId ?? "",
          displayName: creator.displayName,
          slug: creator.slug,
          bio: creator.bio ?? "",
          avatarUrl: (creator as any).avatarUrl ?? "",
          revSharePercent: (creator as any).revSharePercent ?? "",
          adminEmail: "",
          adminFirstName: "",
          adminLastName: "",
          adminSendEmail: true,
        }
      : {
          channelId: lockedChannelId ?? "",
          adminEmail: "",
          adminFirstName: "",
          adminLastName: "",
          adminSendEmail: true,
        },
  });

  const createMutation = useMutation({
    mutationFn: adminCreateCreator,
    onSuccess: (creator) => {
      qc.invalidateQueries({ queryKey: ["admin", "creators"] });
      onCreated(creator);
    },
    onError: (err: any) => alert(err?.response?.data?.message ?? "Failed to create creator"),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Omit<CreatorFormData, "adminEmail" | "adminFirstName" | "adminLastName" | "adminSendEmail">) =>
      adminUpdateCreator(creator!.id, data as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "creators"] }); onClose(); },
    onError: (err: any) => alert(err?.response?.data?.message ?? "Failed to update creator"),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (data: CreatorFormData) => {
    if (isEdit) {
      const { adminEmail, adminFirstName, adminLastName, adminSendEmail, ...rest } = data;
      updateMutation.mutate(rest);
    } else {
      const { adminEmail, adminFirstName, adminLastName, adminSendEmail, ...rest } = data;
      createMutation.mutate({
        ...rest,
        admin: {
          email: adminEmail.trim(),
          firstName: adminFirstName?.trim() || undefined,
          lastName: adminLastName?.trim() || undefined,
          sendEmail: adminSendEmail !== false,
        },
      } as any);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="mx-4 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>{isEdit ? "Edit" : "Create"} Creator</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">Channel</label>
              {lockedChannelId ? (
                <>
                  <input type="hidden" {...register("channelId")} />
                  <div className="flex h-10 w-full items-center rounded-md border border-surface-700 bg-surface-800 px-3 text-sm text-surface-300">
                    {channelName ?? "Loading..."}
                  </div>
                </>
              ) : (
                <select
                  {...register("channelId")}
                  className="flex h-10 w-full rounded-md border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">No channel</option>
                  {channels.map((ch) => (
                    <option key={ch.id} value={ch.id}>{ch.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">Display Name</label>
              <Input
                {...register("displayName", { onChange: (e) => !isEdit && setValue("slug", slugify(e.target.value)) })}
                placeholder="Creator name"
              />
              {errors.displayName && <p className="mt-1 text-xs text-destructive">{errors.displayName.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">Slug</label>
              <Input {...register("slug")} placeholder="creator-slug" />
              {errors.slug && <p className="mt-1 text-xs text-destructive">{errors.slug.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">Bio</label>
              <textarea
                {...register("bio")}
                rows={3}
                className="flex w-full rounded-md border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-50 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Optional bio"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">Avatar URL</label>
              <Input {...register("avatarUrl")} placeholder="https://..." />
              {errors.avatarUrl && <p className="mt-1 text-xs text-destructive">{errors.avatarUrl.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">
                Revenue Share %
              </label>
              <p className="mb-1 text-xs text-surface-500">
                Percentage of each subscription payment transferred to this creator via Stripe Connect. Leave blank for no revshare.
              </p>
              <Input
                {...register("revSharePercent")}
                type="number"
                min="0"
                max="100"
                placeholder="e.g. 70"
              />
              {errors.revSharePercent && <p className="mt-1 text-xs text-destructive">{errors.revSharePercent.message}</p>}
            </div>
            {!isEdit && (
              <div className="space-y-3 rounded-lg border border-surface-800 bg-surface-900/40 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Creator admin</h3>
                  <p className="mt-0.5 text-xs text-surface-500">
                    We'll send an invite link so they can set their own password.
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-surface-300">
                    Admin email
                  </label>
                  <Input
                    type="email"
                    placeholder="creator@example.com"
                    {...register("adminEmail")}
                  />
                  {errors.adminEmail && (
                    <p className="mt-1 text-xs text-destructive">
                      {errors.adminEmail.message}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-surface-300">
                      First name (optional)
                    </label>
                    <Input {...register("adminFirstName")} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-surface-300">
                      Last name (optional)
                    </label>
                    <Input {...register("adminLastName")} />
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-3 rounded-md border border-surface-800 bg-surface-900/50 px-3 py-2.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-surface-600 bg-surface-900 text-primary-600 focus:ring-primary-500"
                    defaultChecked
                    {...register("adminSendEmail")}
                  />
                  <span className="text-sm text-surface-200">Send invite email</span>
                </label>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Spinner size="sm" /> : isEdit ? "Save" : "Create"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
