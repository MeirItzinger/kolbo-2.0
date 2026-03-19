import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Pencil,
  Trash2,
  FolderOpen,
  AlertTriangle,
  GripVertical,
} from "lucide-react";
import {
  adminListCategories,
  adminCreateCategory,
  adminUpdateCategory,
  adminDeleteCategory,
  adminReorderCategories,
  adminGetChannel,
  adminListChannels,
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
import type { Category } from "@/types";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  isActive: z.boolean().default(true),
});

type CategoryFormData = z.infer<typeof categorySchema>;

export default function AdminCategoriesPage() {
  const { user, hasRole } = useAuth();
  const isSuperAdmin = hasRole("SUPER_ADMIN");
  const channelAdminChannelId = !isSuperAdmin
    ? user?.roles.find((r) => r.role?.key === "CHANNEL_ADMIN")?.channelId ?? ""
    : "";

  const [selectedChannelId, setSelectedChannelId] = useState(channelAdminChannelId);

  const channelsQuery = useQuery({
    queryKey: ["admin", "channels", "list"],
    queryFn: () => adminListChannels({ perPage: 100 }),
    enabled: isSuperAdmin,
  });

  const channels = channelsQuery.data?.data ?? [];

  if (!channelAdminChannelId && !isSuperAdmin) {
    return (
      <div className="py-12 text-center text-surface-400">
        Categories are managed per channel.
      </div>
    );
  }

  const effectiveChannelId = isSuperAdmin ? selectedChannelId : channelAdminChannelId;

  return (
    <div className="space-y-6">
      {isSuperAdmin && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-surface-300">Channel</label>
          <select
            value={selectedChannelId}
            onChange={(e) => setSelectedChannelId(e.target.value)}
            className="h-10 rounded-md border border-surface-700 bg-surface-900 px-3 text-sm text-surface-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Select a channel…</option>
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>{ch.name}</option>
            ))}
          </select>
        </div>
      )}

      {effectiveChannelId ? (
        <CategoriesInner key={effectiveChannelId} channelId={effectiveChannelId} />
      ) : (
        <div className="py-12 text-center text-surface-400">
          Select a channel to manage its categories.
        </div>
      )}
    </div>
  );
}

function CategoriesInner({ channelId }: { channelId: string }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const channelQuery = useQuery({
    queryKey: ["admin", "channel", channelId],
    queryFn: () => adminGetChannel(channelId),
    enabled: !!channelId,
  });

  const categoriesQuery = useQuery({
    queryKey: ["admin", "categories", channelId],
    queryFn: () => adminListCategories(channelId),
    enabled: !!channelId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminDeleteCategory(channelId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "categories", channelId] });
      setDeleteTarget(null);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => adminReorderCategories(channelId, ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "categories", channelId] });
    },
  });

  const categories = categoriesQuery.data ?? [];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = categories.findIndex((c) => c.id === active.id);
    const newIdx = categories.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(categories, oldIdx, newIdx);

    qc.setQueryData(
      ["admin", "categories", channelId],
      reordered,
    );
    reorderMutation.mutate(reordered.map((c) => c.id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Categories</h1>
          {channelQuery.data && (
            <p className="mt-1 text-sm text-surface-400">{channelQuery.data.name}</p>
          )}
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add Category
        </Button>
      </div>

      {categoriesQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : categories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="mx-auto mb-4 h-12 w-12 text-surface-600" />
            <p className="text-lg font-medium text-white">No categories yet</p>
            <p className="mt-1 text-sm text-surface-400">
              Create categories to organize your videos into rows.
            </p>
          </CardContent>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={categories.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {categories.map((cat) => (
                <SortableCategoryRow
                  key={cat.id}
                  category={cat}
                  onEdit={() => {
                    setEditing(cat);
                    setShowForm(true);
                  }}
                  onDelete={() => setDeleteTarget(cat)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {showForm && (
        <CategoryFormDialog
          channelId={channelId}
          category={editing}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="mx-4 w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Delete Category
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-surface-300">
                Delete{" "}
                <strong className="text-white">{deleteTarget.name}</strong>?
                Videos in this category will become uncategorized.
              </p>
              <div className="flex justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setDeleteTarget(null)}
                >
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

function SortableCategoryRow({
  category,
  onEdit,
  onDelete,
}: {
  category: Category;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const videoCount = category._count?.videos ?? 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border border-surface-700 bg-surface-800/50 px-4 py-3"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-surface-500 hover:text-surface-300"
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="flex-1">
        <span className="font-medium text-white">{category.name}</span>
        <span className="ml-3 text-xs text-surface-500">{category.slug}</span>
      </div>
      <Badge variant="outline">{videoCount} video{videoCount !== 1 ? "s" : ""}</Badge>
      <Badge variant={category.isActive ? "success" : "secondary"}>
        {category.isActive ? "Active" : "Inactive"}
      </Badge>
      <Button variant="ghost" size="icon" onClick={onEdit}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={onDelete}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

function CategoryFormDialog({
  channelId,
  category,
  onClose,
}: {
  channelId: string;
  category: Category | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!category;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: category
      ? { name: category.name, slug: category.slug, isActive: category.isActive }
      : { isActive: true },
  });

  const watchName = watch("name");

  const createMutation = useMutation({
    mutationFn: (data: CategoryFormData) =>
      adminCreateCategory(channelId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "categories", channelId] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: CategoryFormData) =>
      adminUpdateCategory(channelId, category!.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "categories", channelId] });
      onClose();
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (data: CategoryFormData) => {
    if (isEdit) updateMutation.mutate(data);
    else createMutation.mutate(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="mx-4 w-full max-w-md">
        <CardHeader>
          <CardTitle>{isEdit ? "Edit" : "Create"} Category</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">
                Name
              </label>
              <Input
                {...register("name")}
                placeholder="e.g. Parsha"
                onChange={(e) => {
                  register("name").onChange(e);
                  if (!isEdit) {
                    setValue("slug", slugify(e.target.value));
                  }
                }}
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
              <Input {...register("slug")} placeholder="parsha" />
              {errors.slug && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.slug.message}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="catActive"
                {...register("isActive")}
                className="h-4 w-4 rounded border-surface-700 bg-surface-900 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="catActive" className="text-sm text-surface-300">
                Active
              </label>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <Spinner size="sm" />
                ) : isEdit ? (
                  "Save"
                ) : (
                  "Create"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
