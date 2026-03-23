import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ImageIcon,
  Rows3,
  Type,
  Minus,
  GripVertical,
  Play,
  X,
  AlertTriangle,
  Upload,
} from "lucide-react";
import {
  adminListChannelPageElements,
  adminCreateChannelPageElement,
  adminUpdateChannelPageElement,
  adminDeleteChannelPageElement,
  adminReorderChannelPageUnified,
  adminListVideos,
  adminListCategories,
  uploadImage,
} from "@/api/admin";
import { resolveUploadedAssetUrl } from "@/api/client";
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
import { LayoutGrid } from "lucide-react";
import type { HomepageElement, HomepageElementType, Video, Category } from "@/types";

type ChannelElementType = Exclude<HomepageElementType, "CHANNEL_ROW">;

const ELEMENT_LABELS: Record<ChannelElementType, string> = {
  HERO: "Hero Banner",
  CONTENT_ROW: "Content Row",
  TEXT_DIVIDER: "Text Divider",
  LINE_DIVIDER: "Line Divider",
};

const ELEMENT_ICONS: Record<ChannelElementType, typeof Rows3> = {
  HERO: ImageIcon,
  CONTENT_ROW: Rows3,
  TEXT_DIVIDER: Type,
  LINE_DIVIDER: Minus,
};

export default function ChannelPageBuilderPage() {
  const { user, hasRole } = useAuth();
  const isSuperAdmin = hasRole("SUPER_ADMIN");
  const channelId = !isSuperAdmin
    ? user?.roles.find((r) => r.role?.key === "CHANNEL_ADMIN")?.channelId ?? ""
    : "";

  if (!channelId) {
    return (
      <div className="py-16 text-center">
        <p className="text-surface-400">No channel associated with your account.</p>
      </div>
    );
  }

  return <ChannelPageBuilderInner channelId={channelId} />;
}

type UnifiedItem =
  | { kind: "element"; id: string; sortOrder: number; data: HomepageElement }
  | { kind: "category"; id: string; sortOrder: number; data: Category };

function ChannelPageBuilderInner({ channelId }: { channelId: string }) {
  const qc = useQueryClient();
  const [createDropdownOpen, setCreateDropdownOpen] = useState(false);
  const [editingElement, setEditingElement] = useState<HomepageElement | null>(null);
  const [creatingType, setCreatingType] = useState<ChannelElementType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HomepageElement | null>(null);
  const [managingVideos, setManagingVideos] = useState<HomepageElement | null>(null);

  const elementsQuery = useQuery({
    queryKey: ["admin", "channel-page-elements", channelId],
    queryFn: () => adminListChannelPageElements(channelId),
  });

  const categoriesQuery = useQuery({
    queryKey: ["admin", "categories", channelId],
    queryFn: () => adminListCategories(channelId),
  });

  const elements: HomepageElement[] = (() => {
    const d = elementsQuery.data;
    if (Array.isArray(d)) return d;
    if (d && typeof d === "object" && "data" in d) return (d as any).data ?? [];
    return [];
  })();

  const categories: Category[] = (() => {
    const d = categoriesQuery.data;
    if (Array.isArray(d)) return d.filter((c) => c.isActive);
    return [];
  })();

  const unifiedItems: UnifiedItem[] = [
    ...elements.map((el): UnifiedItem => ({
      kind: "element",
      id: el.id,
      sortOrder: el.sortOrder ?? 0,
      data: el,
    })),
    ...categories.map((cat): UnifiedItem => ({
      kind: "category",
      id: cat.id,
      sortOrder: cat.sortOrder ?? 0,
      data: cat,
    })),
  ].sort((a, b) => a.sortOrder - b.sortOrder);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminDeleteChannelPageElement(channelId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "channel-page-elements", channelId] });
      setDeleteTarget(null);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (items: { kind: "element" | "category"; id: string }[]) =>
      adminReorderChannelPageUnified(channelId, items),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "channel-page-elements", channelId] });
      qc.invalidateQueries({ queryKey: ["admin", "categories", channelId] });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = unifiedItems.findIndex((e) => e.id === active.id);
    const newIndex = unifiedItems.findIndex((e) => e.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(unifiedItems, oldIndex, newIndex);
    reorderMutation.mutate(
      reordered.map((item) => ({ kind: item.kind, id: item.id })),
    );
  };

  const handleCreate = (type: ChannelElementType) => {
    setCreateDropdownOpen(false);
    if (type === "LINE_DIVIDER") {
      adminCreateChannelPageElement(channelId, { type } as any).then(() => {
        qc.invalidateQueries({ queryKey: ["admin", "channel-page-elements", channelId] });
      });
    } else {
      setCreatingType(type);
    }
  };

  const isLoading = elementsQuery.isLoading || categoriesQuery.isLoading;

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Channel Page Builder
          </h1>
          <p className="mt-2 max-w-xl text-base leading-relaxed text-surface-400">
            Drag blocks to set order on your public channel page. Previews below
            are larger so you can see what viewers will get.
          </p>
        </div>
        <div className="relative shrink-0">
          <Button
            size="lg"
            className="px-6"
            onClick={() => setCreateDropdownOpen(!createDropdownOpen)}
          >
            <Plus className="h-5 w-5" />
            Create block
            <ChevronDown className="ml-1 h-4 w-4" />
          </Button>
          {createDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setCreateDropdownOpen(false)}
              />
              <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-surface-600 bg-surface-900 py-2 shadow-2xl ring-1 ring-black/40">
                {(["CONTENT_ROW", "HERO", "TEXT_DIVIDER", "LINE_DIVIDER"] as ChannelElementType[]).map((type) => {
                  const Icon = ELEMENT_ICONS[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleCreate(type)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-base text-surface-200 transition-colors hover:bg-surface-800 hover:text-white"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-800">
                        <Icon className="h-5 w-5 text-primary-400" />
                      </span>
                      {ELEMENT_LABELS[type]}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : unifiedItems.length === 0 ? (
        <Card className="overflow-hidden rounded-2xl border-surface-700 bg-surface-900/50">
          <CardContent className="py-20 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-surface-800 ring-1 ring-surface-700">
              <Rows3 className="h-10 w-10 text-primary-400/80" />
            </div>
            <p className="text-xl font-semibold text-white">
              Your channel page is empty
            </p>
            <p className="mx-auto mt-2 max-w-sm text-base text-surface-400">
              Use <span className="text-surface-200">Create block</span> to add
              heroes, rows, and dividers. Category rows from your library appear
              here automatically.
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
            items={unifiedItems.map((e) => e.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {unifiedItems.map((item) =>
                item.kind === "category" ? (
                  <SortableCategoryPreview
                    key={item.id}
                    category={item.data as Category}
                  />
                ) : (
                  <SortableElementPreview
                    key={item.id}
                    element={item.data as HomepageElement}
                    onEdit={() => {
                      const el = item.data as HomepageElement;
                      if (el.type === "CONTENT_ROW") {
                        setManagingVideos(el);
                      } else {
                        setEditingElement(el);
                      }
                    }}
                    onDelete={() => setDeleteTarget(item.data as HomepageElement)}
                  />
                ),
              )}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {creatingType && creatingType !== "CONTENT_ROW" && (
        <ElementFormDialog
          key={`create-${creatingType}`}
          channelId={channelId}
          type={creatingType}
          element={null}
          onClose={() => setCreatingType(null)}
        />
      )}

      {creatingType === "CONTENT_ROW" && (
        <ContentRowFormDialog
          channelId={channelId}
          element={null}
          onClose={() => setCreatingType(null)}
        />
      )}

      {editingElement && editingElement.type !== "CONTENT_ROW" && (
        <ElementFormDialog
          key={editingElement.id}
          channelId={channelId}
          type={editingElement.type as ChannelElementType}
          element={editingElement}
          onClose={() => setEditingElement(null)}
        />
      )}

      {managingVideos && (
        <ContentRowFormDialog
          channelId={channelId}
          element={managingVideos}
          onClose={() => setManagingVideos(null)}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="mx-4 w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Delete Element
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-surface-300">
                Delete this{" "}
                <strong className="text-white">
                  {ELEMENT_LABELS[deleteTarget.type as ChannelElementType] ?? deleteTarget.type}
                </strong>
                {deleteTarget.title && (
                  <>
                    {" "}
                    — &quot;{deleteTarget.title}&quot;
                  </>
                )}
                ?
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

function SortableElementPreview({
  element,
  onEdit,
  onDelete,
}: {
  element: HomepageElement;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: element.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: isDragging ? ("relative" as const) : undefined,
  };

  const Icon = ELEMENT_ICONS[element.type as ChannelElementType] ?? Rows3;

  const renderPreview = () => {
    switch (element.type) {
      case "HERO":
        return <HeroPreview element={element} />;
      case "CONTENT_ROW":
        return <ContentRowPreview element={element} />;
      case "TEXT_DIVIDER":
        return <TextDividerPreview element={element} />;
      case "LINE_DIVIDER":
        return <LineDividerPreview />;
      default:
        return null;
    }
  };

  const canEdit = element.type !== "LINE_DIVIDER";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group overflow-hidden rounded-2xl border border-surface-600/80 bg-surface-900/60 shadow-lg shadow-black/25 ring-1 ring-white/5 transition-shadow hover:ring-white/10 ${
        isDragging
          ? "scale-[1.01] opacity-95 shadow-2xl shadow-primary-900/40 ring-2 ring-primary-500/50"
          : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-surface-700/80 bg-surface-800/40 px-4 py-3.5 sm:px-5">
        <button
          type="button"
          className="cursor-grab touch-none rounded-lg bg-surface-800 p-2.5 text-surface-400 transition-colors hover:bg-surface-700 hover:text-white active:cursor-grabbing"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-800 ring-1 ring-surface-600/60">
          <Icon className="h-5 w-5 text-primary-400" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-surface-500">
            {ELEMENT_LABELS[element.type as ChannelElementType] ?? element.type}
          </p>
          {element.title ? (
            <p className="mt-0.5 truncate text-lg font-medium text-white">
              {element.title}
            </p>
          ) : (
            <p className="mt-0.5 text-base text-surface-500 italic">
              No title set
            </p>
          )}
        </div>
        <Badge
          variant={element.isActive ? "success" : "secondary"}
          className="shrink-0 px-2.5 py-0.5 text-xs"
        >
          {element.isActive ? "Active" : "Inactive"}
        </Badge>
        {canEdit && (
          <Button
            variant="secondary"
            size="default"
            className="h-10 shrink-0 gap-2 px-4"
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 text-surface-400 hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>

      <div className="bg-surface-950/80">{renderPreview()}</div>
    </div>
  );
}

function SortableCategoryPreview({ category }: { category: Category }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: isDragging ? ("relative" as const) : undefined,
  };

  const videoCount =
    category._count?.videoLinks ?? category._count?.videos ?? 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group overflow-hidden rounded-2xl border border-surface-600/80 bg-surface-900/60 shadow-lg shadow-black/25 ring-1 ring-white/5 transition-shadow hover:ring-white/10 ${
        isDragging
          ? "scale-[1.01] opacity-95 shadow-2xl shadow-primary-900/40 ring-2 ring-primary-500/50"
          : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-surface-700/80 bg-surface-800/40 px-4 py-3.5 sm:px-5">
        <button
          type="button"
          className="cursor-grab touch-none rounded-lg bg-surface-800 p-2.5 text-surface-400 transition-colors hover:bg-surface-700 hover:text-white active:cursor-grabbing"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-950/50 ring-1 ring-emerald-800/40">
          <LayoutGrid className="h-5 w-5 text-emerald-400" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-surface-500">
            Category row
          </p>
          <p className="mt-0.5 text-lg font-medium text-white">{category.name}</p>
        </div>
        <span className="text-base text-surface-400">
          {videoCount} video{videoCount !== 1 ? "s" : ""}
        </span>
        <Badge variant="outline" className="shrink-0 px-2.5 py-0.5 text-xs">
          From categories
        </Badge>
      </div>
      <div className="flex items-center gap-3 border-t border-surface-800/60 bg-surface-950/60 px-4 py-2.5 sm:px-5">
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-hidden opacity-70">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-9 w-14 shrink-0 rounded-md bg-surface-800 ring-1 ring-surface-700/80"
            />
          ))}
        </div>
        <span className="shrink-0 text-xs text-surface-500">Channel layout</span>
      </div>
    </div>
  );
}

function HeroPreview({ element }: { element: HomepageElement }) {
  const linkedVideo = (element.items ?? [])
    .map((i) => i.video)
    .find((v): v is Video => !!v);

  return (
    <div className="relative min-h-[200px] overflow-hidden sm:min-h-[220px]">
      {element.imageUrl ? (
        <img
          src={resolveUploadedAssetUrl(element.imageUrl)}
          alt={element.title ?? ""}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900/50 via-surface-900 to-surface-950" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-surface-950/60 to-transparent" />
      <div className="relative flex min-h-[200px] items-end px-6 pb-5 pt-14 sm:min-h-[220px] sm:px-7 sm:pb-6 sm:pt-16">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            {element.title || "Untitled Hero"}
          </h3>
          {element.subtitle && (
            <p className="mt-1.5 max-w-xl text-sm text-surface-200 sm:text-base">
              {element.subtitle}
            </p>
          )}
          {linkedVideo && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/20">
              <Play className="h-3.5 w-3.5" />
              Plays: {linkedVideo.title}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ContentRowPreview({ element }: { element: HomepageElement }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const videos = (element.items ?? [])
    .map((item) => item.video)
    .filter((v): v is Video => !!v);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: dir === "left" ? -320 : 320,
      behavior: "smooth",
    });
  };

  const thumb = (v: Video) =>
    (v as Video & { thumbnailUrl?: string }).thumbnailUrl ??
    v.thumbnailAssets?.[0]?.imageUrl;

  return (
    <div className="px-5 py-4 sm:px-6 sm:py-5">
      <h3 className="mb-3 text-base font-semibold text-white sm:text-lg">
        {element.title || "Untitled Row"}
      </h3>
      {videos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-surface-600 bg-surface-900/50 py-6 text-center sm:py-7">
          <Play className="mx-auto mb-2 h-8 w-8 text-surface-600" />
          <p className="text-sm text-surface-400">
            No videos yet — click Edit to add videos.
          </p>
        </div>
      ) : (
        <div className="group/scroll relative">
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto pb-2 pt-0.5 scrollbar-none"
          >
            {videos.map((video) => (
              <div key={video.id} className="w-[220px] shrink-0 sm:w-[260px]">
                <div className="relative aspect-video overflow-hidden rounded-xl bg-surface-800 ring-1 ring-surface-700">
                  {thumb(video) ? (
                    <img
                      src={thumb(video)!}
                      alt={video.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-surface-800/80">
                      <Play className="h-10 w-10 text-surface-600" />
                    </div>
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-surface-200">
                  {video.title}
                </p>
              </div>
            ))}
          </div>
          {videos.length > 2 && (
            <>
              <button
                type="button"
                onClick={() => scroll("left")}
                className="absolute left-1 top-[42%] z-10 -translate-y-1/2 rounded-full bg-black/70 p-2 text-white opacity-0 shadow-lg transition-opacity group-hover/scroll:opacity-100"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => scroll("right")}
                className="absolute right-1 top-[42%] z-10 -translate-y-1/2 rounded-full bg-black/70 p-2 text-white opacity-0 shadow-lg transition-opacity group-hover/scroll:opacity-100"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TextDividerPreview({ element }: { element: HomepageElement }) {
  return (
    <div className="px-6 py-6 text-center sm:px-8 sm:py-7">
      <p className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
        {element.text || "Text goes here"}
      </p>
    </div>
  );
}

function LineDividerPreview() {
  return (
    <div className="px-6 py-4 sm:px-8 sm:py-5">
      <hr className="border-t-2 border-surface-600" />
    </div>
  );
}

const heroSchema = z.object({
  title: z.string().min(1, "Title is required"),
  subtitle: z.string().optional().default(""),
  imageUrl: z.string().optional().default(""),
  isActive: z.boolean().default(true),
});

const textDividerSchema = z.object({
  text: z.string().min(1, "Text is required"),
  isActive: z.boolean().default(true),
});

function ElementFormDialog({
  channelId,
  type,
  element,
  onClose,
}: {
  channelId: string;
  type: ChannelElementType;
  element: HomepageElement | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!element;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [imageUrl, setImageUrl] = useState(element?.imageUrl ?? "");
  const [imagePreview, setImagePreview] = useState(
    element?.imageUrl ? resolveUploadedAssetUrl(element.imageUrl) : "",
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [heroVideoId, setHeroVideoId] = useState(
    () => element?.items?.find((i) => i.videoId)?.videoId ?? "",
  );

  const heroVideosQuery = useQuery({
    queryKey: ["admin", "videos", "hero-picker", channelId],
    queryFn: () => adminListVideos({ channelId, perPage: 250 }),
    enabled: type === "HERO",
  });

  const schema = type === "HERO" ? heroSchema : textDividerSchema;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: element
      ? {
          title: element.title ?? "",
          subtitle: element.subtitle ?? "",
          imageUrl: element.imageUrl ?? "",
          text: element.text ?? "",
          isActive: element.isActive,
        }
      : { title: "", subtitle: "", imageUrl: "", text: "", isActive: true },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImagePreview(URL.createObjectURL(file));
    setUploadError("");
    setUploading(true);
    try {
      const result = await uploadImage(file);
      setImageUrl(resolveUploadedAssetUrl(result.url));
    } catch (err: any) {
      setUploadError(err?.message ?? "Upload failed");
      setImagePreview("");
      setImageUrl("");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = () => {
    setImageUrl("");
    setImagePreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      adminCreateChannelPageElement(channelId, { ...data, type }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "channel-page-elements", channelId] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) =>
      adminUpdateChannelPageElement(channelId, element!.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "channel-page-elements", channelId] });
      onClose();
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const heroVideos: Video[] = heroVideosQuery.data?.data ?? [];

  const onSubmit = (data: any) => {
    const payload: Record<string, unknown> = { ...data, imageUrl };
    if (type === "HERO") {
      payload.items = heroVideoId
        ? [{ videoId: heroVideoId, sortOrder: 0 }]
        : [];
    }
    if (isEdit) updateMutation.mutate(payload);
    else createMutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="mx-4 w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>
            {isEdit ? "Edit" : "Create"} {ELEMENT_LABELS[type]}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {type === "HERO" && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-surface-300">
                    Title
                  </label>
                  <Input {...register("title")} placeholder="Title" />
                  {(errors as any).title && (
                    <p className="mt-1 text-xs text-destructive">
                      {(errors as any).title.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-surface-300">
                    Subtitle
                  </label>
                  <Input
                    {...register("subtitle")}
                    placeholder="Optional subtitle"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-surface-300">
                    Play button video
                  </label>
                  <p className="mb-2 text-xs text-surface-500">
                    Optional. Viewers see a play control on the hero that opens
                    this video.
                  </p>
                  {heroVideosQuery.isLoading ? (
                    <Spinner size="sm" />
                  ) : (
                    <select
                      className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white"
                      value={heroVideoId}
                      onChange={(e) => setHeroVideoId(e.target.value)}
                    >
                      <option value="">None</option>
                      {heroVideos.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-surface-300">
                    Image
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {imagePreview ? (
                    <div className="relative mt-1 overflow-hidden rounded-lg border border-surface-700">
                      <img
                        src={imagePreview}
                        alt="Hero preview"
                        className="h-40 w-full object-cover"
                      />
                      {uploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <Spinner size="sm" />
                          <span className="ml-2 text-sm text-white">
                            Uploading...
                          </span>
                        </div>
                      )}
                      {!uploading && (
                        <button
                          type="button"
                          onClick={removeImage}
                          className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white transition-colors hover:bg-black/80"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-surface-700 bg-surface-900/50 px-4 py-8 text-sm text-surface-400 transition-colors hover:border-primary-500/50 hover:text-surface-300"
                    >
                      <Upload className="h-5 w-5" />
                      Click to upload an image
                    </button>
                  )}
                  {uploadError && (
                    <p className="mt-1 text-xs text-destructive">
                      {uploadError}
                    </p>
                  )}
                </div>
              </>
            )}

            {type === "TEXT_DIVIDER" && (
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-300">
                  Text
                </label>
                <Input {...register("text")} placeholder="Divider text" />
                {(errors as any).text && (
                  <p className="mt-1 text-xs text-destructive">
                    {(errors as any).text.message}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="elActive"
                {...register("isActive")}
                className="h-4 w-4 rounded border-surface-700 bg-surface-900 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="elActive" className="text-sm text-surface-300">
                Active
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || uploading}>
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

function ContentRowFormDialog({
  channelId,
  element,
  onClose,
}: {
  channelId: string;
  element: HomepageElement | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!element;

  const initialVideoIds = (element?.items ?? [])
    .filter((item) => item.videoId)
    .map((item) => item.videoId!);

  const [title, setTitle] = useState(element?.title ?? "");
  const [isActive, setIsActive] = useState(element?.isActive ?? true);
  const [videoIds, setVideoIds] = useState<string[]>(initialVideoIds);
  const [search, setSearch] = useState("");
  const [titleError, setTitleError] = useState("");

  const videosQuery = useQuery({
    queryKey: ["admin", "videos", "channel-picker", channelId],
    queryFn: () => adminListVideos({ channelId, perPage: 250 }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => adminCreateChannelPageElement(channelId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "channel-page-elements", channelId] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: any) =>
      adminUpdateChannelPageElement(channelId, element!.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "channel-page-elements", channelId] });
      onClose();
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const allVideos: Video[] = videosQuery.data?.data ?? [];
  const availableVideos = allVideos.filter(
    (v) =>
      !videoIds.includes(v.id) &&
      v.title.toLowerCase().includes(search.toLowerCase()),
  );

  const removeVideo = (id: string) =>
    setVideoIds((prev) => prev.filter((vid) => vid !== id));

  const addVideo = (id: string) => setVideoIds((prev) => [...prev, id]);

  const selectedVideos = videoIds
    .map((id) => allVideos.find((v) => v.id === id))
    .filter(Boolean) as Video[];

  const handleSave = () => {
    if (!title.trim()) {
      setTitleError("Title is required");
      return;
    }
    setTitleError("");

    const items = videoIds.map((vid, i) => ({ videoId: vid, sortOrder: i }));
    const payload = { title, isActive, items, type: "CONTENT_ROW" as const };

    if (isEdit) updateMutation.mutate(payload);
    else createMutation.mutate(payload as any);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="mx-4 flex w-full max-w-2xl max-h-[80vh] flex-col overflow-hidden">
        <CardHeader>
          <CardTitle>{isEdit ? "Edit" : "Create"} Content Row</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 space-y-4 overflow-y-auto">
          <div>
            <label className="mb-1 block text-sm font-medium text-surface-300">
              Row Title
            </label>
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleError) setTitleError("");
              }}
              placeholder="Row title"
            />
            {titleError && (
              <p className="mt-1 text-xs text-destructive">{titleError}</p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-surface-300">
              Select Videos
            </label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your channel videos..."
              className="mb-2"
            />
            {videosQuery.isLoading ? (
              <Spinner />
            ) : (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-surface-800 bg-surface-900/50 p-2">
                {availableVideos.length === 0 ? (
                  <p className="py-2 text-center text-sm text-surface-500">
                    {search ? "No matching videos" : "All videos selected"}
                  </p>
                ) : (
                  availableVideos.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => addVideo(v.id)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-surface-300 transition-colors hover:bg-surface-800 hover:text-white"
                    >
                      <Plus className="h-4 w-4 shrink-0 text-surface-500" />
                      {v.title}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {selectedVideos.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-surface-300">
                Selected ({selectedVideos.length})
              </h3>
              <div className="space-y-1">
                {selectedVideos.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center gap-3 rounded-lg border border-surface-800 bg-surface-800/50 px-3 py-2"
                  >
                    <GripVertical className="h-4 w-4 text-surface-600" />
                    <span className="flex-1 text-sm text-white">
                      {v.title}
                    </span>
                    <button type="button" onClick={() => removeVideo(v.id)}>
                      <X className="h-4 w-4 text-surface-500 hover:text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="rowActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-surface-700 bg-surface-900 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="rowActive" className="text-sm text-surface-300">
              Active
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={isPending} onClick={handleSave}>
              {isPending ? (
                <Spinner size="sm" />
              ) : isEdit ? (
                "Save"
              ) : (
                "Create"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
