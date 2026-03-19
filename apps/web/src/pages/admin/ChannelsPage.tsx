import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Tv, AlertTriangle, LayoutDashboard } from "lucide-react";
import {
  adminListChannels,
  adminCreateChannel,
  adminDeleteChannel,
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
import { slugify } from "@/lib/utils";
import type { Channel, VideoAccessType } from "@/types";

const ACCESS_TYPE_OPTIONS: { value: VideoAccessType; label: string }[] = [
  { value: "FREE", label: "Free" },
  { value: "FREE_WITH_ADS", label: "Free with Ads" },
  { value: "SUBSCRIPTION", label: "Subscription" },
  { value: "RENTAL", label: "Rental" },
  { value: "PURCHASE", label: "Purchase" },
];

const channelSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  logoUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  bannerUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  defaultCurrency: z.string().optional(),
});

type ChannelFormData = z.infer<typeof channelSchema>;

export default function AdminChannelsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Channel | null>(null);

  const channelsQuery = useQuery({
    queryKey: ["admin", "channels"],
    queryFn: () => adminListChannels({ perPage: 100 }),
  });

  const channels = channelsQuery.data?.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: adminDeleteChannel,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "channels"] });
      setDeleteTarget(null);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Channels</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          Create Channel
        </Button>
      </div>

      {channelsQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : channels.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Tv className="mx-auto mb-4 h-12 w-12 text-surface-600" />
            <p className="text-lg font-medium text-white">No channels yet</p>
            <p className="mt-1 text-surface-400">
              Create your first channel to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-surface-800">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-800 bg-surface-900">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-400">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-400">
                  Slug
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-400">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-400">
                  Plans
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-surface-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800">
              {channels.map((ch) => (
                <tr key={ch.id} className="bg-surface-900/50 hover:bg-surface-900">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {ch.logoUrl ? (
                        <img
                          src={ch.logoUrl}
                          alt={ch.name}
                          className="h-8 w-8 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-800">
                          <Tv className="h-4 w-4 text-surface-500" />
                        </div>
                      )}
                      <span className="font-medium text-white">{ch.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-surface-400">
                    {ch.slug}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={ch.isActive ? "success" : "secondary"}>
                      {ch.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-surface-400">
                    {ch.subscriptionPlans?.length ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/channel-admin/${ch.id}`}>
                          <LayoutDashboard className="mr-1.5 h-4 w-4" />
                          Dashboard
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/admin/channels/${ch.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(ch)}
                      >
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

      {/* Create dialog */}
      {showCreate && (
        <CreateChannelDialog onClose={() => setShowCreate(false)} />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="mx-4 w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Delete Channel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-surface-300">
                Are you sure you want to delete{" "}
                <strong className="text-white">{deleteTarget.name}</strong>?
                This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(deleteTarget.id)}
                >
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

function CreateChannelDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [selectedAccessTypes, setSelectedAccessTypes] = useState<VideoAccessType[]>(
    ACCESS_TYPE_OPTIONS.map((o) => o.value),
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ChannelFormData>({
    resolver: zodResolver(channelSchema),
  });

  const createMutation = useMutation({
    mutationFn: adminCreateChannel,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "channels"] });
      onClose();
    },
  });

  const nameValue = watch("name");

  const toggleAccessType = (type: VideoAccessType) => {
    setSelectedAccessTypes((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type],
    );
  };

  const onSubmit = (data: ChannelFormData) => {
    createMutation.mutate({
      ...data,
      allowedAccessTypes: selectedAccessTypes,
    } as any);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="mx-4 w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>Create Channel</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">
                Name
              </label>
              <Input
                {...register("name", {
                  onChange: (e) =>
                    setValue("slug", slugify(e.target.value)),
                })}
                placeholder="Channel name"
              />
              {errors.name && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">
                Slug
              </label>
              <Input {...register("slug")} placeholder="channel-slug" />
              {errors.slug && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.slug.message}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">
                Description
              </label>
              <textarea
                {...register("description")}
                rows={3}
                className="flex w-full rounded-md border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-50 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Optional description"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-surface-300">
                Allowed Video Types
              </label>
              <p className="mb-3 text-xs text-surface-500">
                Select which types of videos creators on this channel can publish
              </p>
              <div className="space-y-2">
                {ACCESS_TYPE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-surface-800 bg-surface-900/50 px-3 py-2.5 transition-colors hover:bg-surface-800/80"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAccessTypes.includes(opt.value)}
                      onChange={() => toggleAccessType(opt.value)}
                      className="h-4 w-4 rounded border-surface-600 bg-surface-900 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-surface-200">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Spinner size="sm" /> : "Create"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
