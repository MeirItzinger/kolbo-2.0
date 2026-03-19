import { useState } from "react";
import { useParams } from "react-router-dom";
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
} from "lucide-react";
import {
  adminListContentRows,
  adminCreateContentRow,
  adminUpdateContentRow,
  adminDeleteContentRow,
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
import type { ContentRow, ContentRowType } from "@/types";

const rowSchema = z.object({
  title: z.string().min(1, "Title is required"),
  type: z.string().min(1, "Type is required"),
  sortOrder: z.coerce.number().default(0),
  isActive: z.boolean().default(true),
});

type RowFormData = z.infer<typeof rowSchema>;

const rowTypes: ContentRowType[] = [
  "featured",
  "continue_watching",
  "new_releases",
  "popular",
  "curated",
];

export default function ChannelAdminContentPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ContentRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContentRow | null>(null);

  const rowsQuery = useQuery({
    queryKey: ["channel-admin", channelId, "content-rows"],
    queryFn: () => adminListContentRows({ channelId }),
    enabled: !!channelId,
  });

  const rows = rowsQuery.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: adminDeleteContentRow,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channel-admin", channelId, "content-rows"] });
      setDeleteTarget(null);
    },
  });

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
                      <Badge variant="secondary">{row.type.replace(/_/g, " ")}</Badge>
                    </div>
                    <p className="text-sm text-surface-400">
                      Order: {row.sortOrder} &middot; {row.videoIds.length} videos
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
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
          channelId={channelId!}
          row={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
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
  channelId,
  row,
  onClose,
}: {
  channelId: string;
  row: ContentRow | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!row;

  const { register, handleSubmit, formState: { errors } } = useForm<RowFormData>({
    resolver: zodResolver(rowSchema),
    defaultValues: row
      ? { title: row.title, type: row.type, sortOrder: row.sortOrder, isActive: row.isActive }
      : { isActive: true, sortOrder: 0 },
  });

  const createMutation = useMutation({
    mutationFn: (data: RowFormData) =>
      adminCreateContentRow({ ...data, channelId } as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["channel-admin", channelId, "content-rows"] }); onClose(); },
  });

  const updateMutation = useMutation({
    mutationFn: (data: RowFormData) => adminUpdateContentRow(row!.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["channel-admin", channelId, "content-rows"] }); onClose(); },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (data: RowFormData) => {
    if (isEdit) updateMutation.mutate(data);
    else createMutation.mutate(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="mx-4 w-full max-w-lg">
        <CardHeader><CardTitle>{isEdit ? "Edit" : "Create"} Content Row</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">Title</label>
              <Input {...register("title")} placeholder="Row title" />
              {errors.title && <p className="mt-1 text-xs text-destructive">{errors.title.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">Type</label>
              <select {...register("type")} className="flex h-10 w-full rounded-md border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">Select type</option>
                {rowTypes.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">Sort Order</label>
              <Input type="number" {...register("sortOrder")} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="chRowActive" {...register("isActive")} className="h-4 w-4 rounded border-surface-700 bg-surface-900 text-primary-600 focus:ring-primary-500" />
              <label htmlFor="chRowActive" className="text-sm text-surface-300">Active</label>
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
