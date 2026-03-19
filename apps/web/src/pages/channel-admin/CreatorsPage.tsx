import { useState } from "react";
import { useParams } from "react-router-dom";
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
} from "@/api/admin";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  bio: z.string().optional(),
});

type CreatorFormData = z.infer<typeof creatorSchema>;

export default function ChannelAdminCreatorsPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CreatorProfile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CreatorProfile | null>(null);

  const creatorsQuery = useQuery({
    queryKey: ["channel-admin", channelId, "creators"],
    queryFn: () => adminListCreators({ channelId, perPage: 100 }),
    enabled: !!channelId,
  });

  const creators = creatorsQuery.data?.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: adminDeleteCreator,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channel-admin", channelId, "creators"] });
      setDeleteTarget(null);
    },
  });

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
        <div className="space-y-3">
          {creators.map((cr) => (
            <Card key={cr.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-white">{cr.name}</p>
                  <p className="text-sm text-surface-400">{cr.slug}</p>
                  {cr.bio && <p className="mt-1 text-sm text-surface-500">{cr.bio}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(cr); setShowForm(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(cr)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <CreatorFormDialog
          channelId={channelId!}
          creator={editing}
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

function CreatorFormDialog({
  channelId,
  creator,
  onClose,
}: {
  channelId: string;
  creator: CreatorProfile | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!creator;

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<CreatorFormData>({
    resolver: zodResolver(creatorSchema),
    defaultValues: creator
      ? { name: creator.name, slug: creator.slug, bio: creator.bio ?? "" }
      : {},
  });

  const createMutation = useMutation({
    mutationFn: (data: CreatorFormData) => adminCreateCreator({ ...data, channelId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["channel-admin", channelId, "creators"] }); onClose(); },
  });

  const updateMutation = useMutation({
    mutationFn: (data: CreatorFormData) => adminUpdateCreator(creator!.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["channel-admin", channelId, "creators"] }); onClose(); },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (data: CreatorFormData) => {
    if (isEdit) updateMutation.mutate(data);
    else createMutation.mutate(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="mx-4 w-full max-w-lg">
        <CardHeader><CardTitle>{isEdit ? "Edit" : "Add"} Creator</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">Name</label>
              <Input
                {...register("name", { onChange: (e) => !isEdit && setValue("slug", slugify(e.target.value)) })}
                placeholder="Creator name"
              />
              {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
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
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Spinner size="sm" /> : isEdit ? "Save" : "Add"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
