import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Users, AlertTriangle } from "lucide-react";
import {
  adminListCreators,
  adminCreateCreator,
  adminUpdateCreator,
  adminDeleteCreator,
  adminListChannels,
  adminGetChannel,
} from "@/api/admin";
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

const creatorSchema = z.object({
  channelId: z.string().optional(),
  displayName: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  bio: z.string().optional(),
  avatarUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

type CreatorFormData = z.infer<typeof creatorSchema>;

export default function AdminCreatorsPage() {
  const { user, hasRole } = useAuth();
  const isSuperAdmin = hasRole("SUPER_ADMIN");
  const channelAdminChannelId = !isSuperAdmin
    ? user?.roles.find((r) => r.role?.key === "CHANNEL_ADMIN")?.channelId ?? ""
    : "";

  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CreatorProfile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CreatorProfile | null>(null);

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
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-surface-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800">
              {creators.map((cr: any) => (
                <tr key={cr.id} className="bg-surface-900/50 hover:bg-surface-900">
                  <td className="px-4 py-3 font-medium text-white">{cr.displayName}</td>
                  <td className="px-4 py-3 text-sm text-surface-400">{cr.slug}</td>
                  <td className="px-4 py-3 text-sm text-surface-400">{creatorChannels(cr)}</td>
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
}: {
  channels: { id: string; name: string }[];
  creator: CreatorProfile | null;
  lockedChannelId?: string;
  channelName?: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!creator;

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<CreatorFormData>({
    resolver: zodResolver(creatorSchema),
    defaultValues: creator
      ? {
          channelId: (creator as any).channelCreators?.[0]?.channelId ?? "",
          displayName: creator.displayName,
          slug: creator.slug,
          bio: creator.bio ?? "",
          avatarUrl: (creator as any).avatarUrl ?? "",
        }
      : {
          channelId: lockedChannelId ?? "",
        },
  });

  const createMutation = useMutation({
    mutationFn: adminCreateCreator,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "creators"] }); onClose(); },
  });

  const updateMutation = useMutation({
    mutationFn: (data: CreatorFormData) => adminUpdateCreator(creator!.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "creators"] }); onClose(); },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (data: CreatorFormData) => {
    if (isEdit) updateMutation.mutate(data);
    else createMutation.mutate(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="mx-4 w-full max-w-lg">
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
