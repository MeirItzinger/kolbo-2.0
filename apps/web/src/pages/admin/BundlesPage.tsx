import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Package, AlertTriangle } from "lucide-react";
import {
  adminListBundles,
  adminCreateBundle,
  adminUpdateBundle,
  adminDeleteBundle,
  adminListChannels,
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
import { formatCurrency } from "@/lib/utils";
import type { Bundle } from "@/types";

const bundleSchema = z.object({
  channelId: z.string().min(1, "Channel is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.coerce.number().min(0),
  isActive: z.boolean().default(true),
});

type BundleFormData = z.infer<typeof bundleSchema>;

export default function AdminBundlesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Bundle | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Bundle | null>(null);

  const bundlesQuery = useQuery({
    queryKey: ["admin", "bundles"],
    queryFn: () => adminListBundles(),
  });

  const channelsQuery = useQuery({
    queryKey: ["admin", "channels", "list"],
    queryFn: () => adminListChannels({ perPage: 100 }),
  });

  const bundles = bundlesQuery.data ?? [];
  const channels = channelsQuery.data?.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: adminDeleteBundle,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "bundles"] });
      setDeleteTarget(null);
    },
  });

  const channelName = (id: string) =>
    channels.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Bundles</h1>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="h-4 w-4" />
          Create Bundle
        </Button>
      </div>

      {bundlesQuery.isLoading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : bundles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="mx-auto mb-4 h-12 w-12 text-surface-600" />
            <p className="text-lg font-medium text-white">No bundles yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-surface-800">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-800 bg-surface-900">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-400">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-400">Channel</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-400">Videos</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-400">Price</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-400">Active</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-surface-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800">
              {bundles.map((bundle) => (
                <tr key={bundle.id} className="bg-surface-900/50 hover:bg-surface-900">
                  <td className="px-4 py-3 font-medium text-white">{bundle.name}</td>
                  <td className="px-4 py-3 text-sm text-surface-400">{channelName(bundle.channelId)}</td>
                  <td className="px-4 py-3 text-sm text-surface-400">{bundle.videoIds.length}</td>
                  <td className="px-4 py-3 text-sm text-surface-300">{formatCurrency(bundle.price)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={bundle.isActive ? "success" : "secondary"}>
                      {bundle.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(bundle); setShowForm(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(bundle)}>
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
        <BundleFormDialog
          channels={channels}
          bundle={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="mx-4 w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />Delete Bundle
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-surface-300">
                Delete <strong className="text-white">{deleteTarget.name}</strong>?
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

function BundleFormDialog({
  channels,
  bundle,
  onClose,
}: {
  channels: { id: string; name: string }[];
  bundle: Bundle | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!bundle;

  const { register, handleSubmit, formState: { errors } } = useForm<BundleFormData>({
    resolver: zodResolver(bundleSchema),
    defaultValues: bundle
      ? { channelId: bundle.channelId, name: bundle.name, description: bundle.description ?? "", price: bundle.price, isActive: bundle.isActive }
      : { isActive: true },
  });

  const createMutation = useMutation({
    mutationFn: adminCreateBundle,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "bundles"] }); onClose(); },
  });

  const updateMutation = useMutation({
    mutationFn: (data: BundleFormData) => adminUpdateBundle(bundle!.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "bundles"] }); onClose(); },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (data: BundleFormData) => {
    if (isEdit) updateMutation.mutate(data);
    else createMutation.mutate(data as any);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="mx-4 w-full max-w-lg">
        <CardHeader>
          <CardTitle>{isEdit ? "Edit" : "Create"} Bundle</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">Channel</label>
              <select {...register("channelId")} className="flex h-10 w-full rounded-md border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">Select channel</option>
                {channels.map((ch) => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
              </select>
              {errors.channelId && <p className="mt-1 text-xs text-destructive">{errors.channelId.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">Name</label>
              <Input {...register("name")} placeholder="Bundle name" />
              {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">Description</label>
              <Input {...register("description")} placeholder="Optional description" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">Price</label>
              <Input type="number" step="0.01" {...register("price")} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="bundleActive" {...register("isActive")} className="h-4 w-4 rounded border-surface-700 bg-surface-900 text-primary-600 focus:ring-primary-500" />
              <label htmlFor="bundleActive" className="text-sm text-surface-300">Active</label>
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
