import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Pencil,
  Trash2,
  Rows3,
  GripVertical,
  AlertTriangle,
  Film,
  X,
} from "lucide-react";
import {
  adminListContentRows,
  adminCreateContentRow,
  adminUpdateContentRow,
  adminDeleteContentRow,
  adminListChannels,
  adminListVideos,
} from "@/api/admin";
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
import type { ContentRow, Video } from "@/types";

const rowSchema = z.object({
  scopeType: z.string().min(1, "Scope is required"),
  channelId: z.string().optional().default(""),
  title: z.string().min(1, "Title is required"),
  subtitle: z.string().optional().default(""),
  sortOrder: z.coerce.number().default(0),
  isActive: z.boolean().default(true),
});

type RowFormData = z.infer<typeof rowSchema>;

export default function AdminContentRowsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ContentRow | null>(null);
  const [managingVideos, setManagingVideos] = useState<ContentRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContentRow | null>(null);

  const rowsQuery = useQuery({
    queryKey: ["admin", "content-rows"],
    queryFn: () => adminListContentRows(),
  });

  const channelsQuery = useQuery({
    queryKey: ["admin", "channels", "list"],
    queryFn: () => adminListChannels({ perPage: 100 }),
  });

  const rows: ContentRow[] = (() => {
    const d = rowsQuery.data;
    if (Array.isArray(d)) return d;
    if (d && typeof d === "object" && "data" in d) return (d as any).data ?? [];
    return [];
  })();
  const channels = channelsQuery.data?.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: adminDeleteContentRow,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "content-rows"] });
      setDeleteTarget(null);
    },
  });

  const channelName = (id: string | null) =>
    id ? channels.find((c) => c.id === id)?.name ?? id : "Platform";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Content Rows</h1>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="h-4 w-4" />
          Create Row
        </Button>
      </div>

      {rowsQuery.isLoading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Rows3 className="mx-auto mb-4 h-12 w-12 text-surface-600" />
            <p className="text-lg font-medium text-white">No content rows yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <GripVertical className="h-5 w-5 text-surface-600" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white">{row.title}</p>
                      <Badge variant="secondary">{row.scopeType}</Badge>
                      <Badge variant={row.isActive ? "success" : "secondary"}>
                        {row.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-sm text-surface-400">
                      {channelName(row.channelId)} &middot; Order: {row.sortOrder} &middot;{" "}
                      {row.items?.length ?? 0} items
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setManagingVideos(row)}>
                    <Film className="h-4 w-4" />
                    Videos
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(row); setShowForm(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(row)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <RowFormDialog
          channels={channels}
          row={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {managingVideos && (
        <ManageRowVideos
          row={managingVideos}
          onClose={() => setManagingVideos(null)}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="mx-4 w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />Delete Row
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-surface-300">
                Delete <strong className="text-white">{deleteTarget.title}</strong>?
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

function RowFormDialog({
  channels,
  row,
  onClose,
}: {
  channels: { id: string; name: string }[];
  row: ContentRow | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!row;

  const { register, handleSubmit, watch, formState: { errors } } = useForm<RowFormData>({
    resolver: zodResolver(rowSchema),
    defaultValues: row
      ? {
          scopeType: row.scopeType ?? "CHANNEL",
          channelId: row.channelId ?? "",
          title: row.title,
          subtitle: row.subtitle ?? "",
          sortOrder: row.sortOrder,
          isActive: row.isActive,
        }
      : { scopeType: "CHANNEL", isActive: true, sortOrder: 0 },
  });

  const watchScope = watch("scopeType");

  const createMutation = useMutation({
    mutationFn: adminCreateContentRow,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "content-rows"] }); onClose(); },
  });

  const updateMutation = useMutation({
    mutationFn: (data: RowFormData) => adminUpdateContentRow(row!.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "content-rows"] }); onClose(); },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (data: RowFormData) => {
    const payload = {
      ...data,
      channelId: data.scopeType === "CHANNEL" ? data.channelId : null,
    };
    if (isEdit) updateMutation.mutate(payload as any);
    else createMutation.mutate(payload as any);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="mx-4 w-full max-w-lg">
        <CardHeader>
          <CardTitle>{isEdit ? "Edit" : "Create"} Content Row</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">Scope</label>
              <select
                {...register("scopeType")}
                className="flex h-10 w-full rounded-md border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="CHANNEL">Channel</option>
                <option value="PLATFORM">Platform</option>
              </select>
            </div>
            {watchScope === "CHANNEL" && (
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-300">Channel</label>
                <select
                  {...register("channelId")}
                  className="flex h-10 w-full rounded-md border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select channel</option>
                  {channels.map((ch) => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                </select>
                {errors.channelId && <p className="mt-1 text-xs text-destructive">{errors.channelId.message}</p>}
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">Title</label>
              <Input {...register("title")} placeholder="Row title" />
              {errors.title && <p className="mt-1 text-xs text-destructive">{errors.title.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">Subtitle (optional)</label>
              <Input {...register("subtitle")} placeholder="Optional subtitle" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">Sort Order</label>
              <Input type="number" {...register("sortOrder")} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="rowActive" {...register("isActive")} className="h-4 w-4 rounded border-surface-700 bg-surface-900 text-primary-600 focus:ring-primary-500" />
              <label htmlFor="rowActive" className="text-sm text-surface-300">Active</label>
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

function ManageRowVideos({
  row,
  onClose,
}: {
  row: ContentRow;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const initialVideoIds = (row.items ?? [])
    .filter((item) => item.videoId)
    .map((item) => item.videoId!);
  const [videoIds, setVideoIds] = useState<string[]>(initialVideoIds);
  const [search, setSearch] = useState("");

  const videosQuery = useQuery({
    queryKey: ["admin", "videos", "picker", row.channelId],
    queryFn: () => adminListVideos({ channelId: row.channelId ?? undefined, perPage: 100 }),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      adminUpdateContentRow(row.id, {
        items: videoIds.map((vid, i) => ({ videoId: vid, sortOrder: i })),
      } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "content-rows"] });
      onClose();
    },
  });

  const allVideos: Video[] = videosQuery.data?.data ?? [];
  const availableVideos = allVideos.filter(
    (v) => !videoIds.includes(v.id) && v.title.toLowerCase().includes(search.toLowerCase()),
  );

  const removeVideo = (id: string) =>
    setVideoIds((prev) => prev.filter((vid) => vid !== id));

  const addVideo = (id: string) =>
    setVideoIds((prev) => [...prev, id]);

  const selectedVideos = videoIds
    .map((id) => allVideos.find((v) => v.id === id))
    .filter(Boolean) as Video[];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="mx-4 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <CardHeader>
          <CardTitle>Manage Videos - {row.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-medium text-surface-300">
              Current Videos ({selectedVideos.length})
            </h3>
            {selectedVideos.length === 0 ? (
              <p className="text-sm text-surface-500">No videos in this row.</p>
            ) : (
              <div className="space-y-1">
                {selectedVideos.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center gap-3 rounded-lg border border-surface-800 bg-surface-800/50 px-3 py-2"
                  >
                    <GripVertical className="h-4 w-4 text-surface-600" />
                    <span className="flex-1 text-sm text-white">{v.title}</span>
                    <button type="button" onClick={() => removeVideo(v.id)}>
                      <X className="h-4 w-4 text-surface-500 hover:text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-surface-300">Add Videos</h3>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search videos..."
              className="mb-2"
            />
            {videosQuery.isLoading ? (
              <Spinner />
            ) : (
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {availableVideos.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => addVideo(v.id)}
                    className="flex w-full items-center gap-3 rounded-lg border border-surface-800 px-3 py-2 text-left text-sm text-surface-300 transition-colors hover:border-surface-600 hover:text-white"
                  >
                    <Plus className="h-4 w-4 text-surface-500" />
                    {v.title}
                  </button>
                ))}
                {availableVideos.length === 0 && (
                  <p className="text-sm text-surface-500">No more videos to add.</p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate()}
            >
              {updateMutation.isPending ? <Spinner size="sm" /> : "Save Order"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
