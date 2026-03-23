import { useState, useRef, useCallback, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ChevronLeft,
  Save,
  Upload,
  Copy,
  ExternalLink,
  Film,
  X,
  Plus,
  Trash2,
} from "lucide-react";
import {
  adminGetVideo,
  adminGetVideoPreviewPlayback,
  adminCreateVideo,
  adminUpdateVideo,
  adminListChannels,
  adminListCreators,
  adminListPlans,
  adminGetChannel,
  adminListCategories,
  createDirectUpload,
  uploadImage,
} from "@/api/admin";
import { VideoPlayer } from "@/features/player/VideoPlayer";
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

const rentalSchema = z.object({
  name: z.string().min(1, "Name is required"),
  price: z.string().min(1, "Price is required"),
  rentalHours: z.string().min(1, "Duration is required"),
});

const purchaseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  price: z.string().min(1, "Price is required"),
});

const videoSchema = z.object({
  channelId: z.string().min(1, "Channel is required"),
  creatorProfileId: z.string().optional().default(""),
  categoryIds: z.array(z.string()).default([]),
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  status: z.string().default("draft"),
  isFree: z.boolean().default(false),
  freeWithAds: z.boolean().default(false),
  subscriptionGated: z.boolean().default(true),
  rentalEnabled: z.boolean().default(false),
  purchaseEnabled: z.boolean().default(false),
  prerollAd: z.boolean().default(false),
  midrollAd: z.boolean().default(false),
  tags: z.string().optional(),
  subscriptionPlanId: z.string().optional(),
  scheduledAt: z.string().optional(),
  rentalOptions: z.array(rentalSchema).optional(),
  purchaseOptions: z.array(purchaseSchema).optional(),
});

type VideoFormData = z.infer<typeof videoSchema>;

export default function AdminVideoEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isNew = id === "new";

  const videoQuery = useQuery({
    queryKey: ["admin", "video", id],
    queryFn: () => adminGetVideo(id!),
    enabled: !isNew && !!id,
  });

  const channelsQuery = useQuery({
    queryKey: ["admin", "channels", "list"],
    queryFn: () => adminListChannels({ perPage: 100 }),
  });

  const creatorsQuery = useQuery({
    queryKey: ["admin", "creators", "list"],
    queryFn: () => adminListCreators({ perPage: 100 }),
  });

  const plansQuery = useQuery({
    queryKey: ["admin", "plans", "list"],
    queryFn: () => adminListPlans(),
  });

  const { user, hasRole } = useAuth();
  const isSuperAdmin = hasRole("SUPER_ADMIN");
  const channelAdminChannelId = !isSuperAdmin
    ? user?.roles.find((r) => r.role?.key === "CHANNEL_ADMIN")?.channelId ?? ""
    : "";

  const channelDetailQuery = useQuery({
    queryKey: ["admin", "channel", channelAdminChannelId],
    queryFn: () => adminGetChannel(channelAdminChannelId),
    enabled: !!channelAdminChannelId,
  });

  const video = videoQuery.data;
  const channels = channelsQuery.data?.data ?? [];
  const creators = creatorsQuery.data?.data ?? [];
  const plans = Array.isArray(plansQuery.data) ? plansQuery.data : (plansQuery.data as any)?.data ?? [];
  const channelAllowedTypes = channelDetailQuery.data?.allowedAccessTypes;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<VideoFormData>({
    resolver: zodResolver(videoSchema),
    values: video
      ? {
          channelId: video.channelId ?? "",
          creatorProfileId: video.creatorProfileId ?? "",
          categoryIds: (video.categories ?? []).map((c) => c.id),
          title: video.title ?? "",
          slug: video.slug ?? "",
          description: video.description ?? "",
          shortDescription: video.shortDescription ?? "",
          status: video.status ?? "draft",
          isFree: video.isFree ?? false,
          freeWithAds: video.freeWithAds ?? false,
          subscriptionGated: video.videoAccessRules?.some((r: any) => r.accessType === "SUBSCRIPTION") ?? false,
          rentalEnabled: (video.rentalOptions?.length ?? 0) > 0,
          purchaseEnabled: (video.purchaseOptions?.length ?? 0) > 0,
          prerollAd: video.hasPrerollAds ?? false,
          midrollAd: video.hasMidrollAds ?? false,
          tags: (video.tagAssignments ?? []).map((ta: any) => ta.tag?.name ?? "").filter(Boolean).join(", "),
          subscriptionPlanId: video.videoAccessRules?.find((r: any) => r.accessType === "SUBSCRIPTION")?.subscriptionPlanId ?? "",
          scheduledAt: video.scheduledPublishAt ?? "",
          rentalOptions: (video.rentalOptions ?? []).map((r: any) => ({
            name: r.name ?? "",
            price: String(r.price ?? ""),
            rentalHours: String(r.rentalHours ?? ""),
          })),
          purchaseOptions: (video.purchaseOptions ?? []).map((p: any) => ({
            name: p.name ?? "",
            price: String(p.price ?? ""),
          })),
        }
      : {
          status: "draft",
          subscriptionGated: true,
          rentalOptions: [],
          purchaseOptions: [],
          categoryIds: [],
        },
  });

  const rentalFields = useFieldArray({ control, name: "rentalOptions" });
  const purchaseFields = useFieldArray({ control, name: "purchaseOptions" });

  const watchChannelId = watch("channelId");
  const effectiveChannelIdForCategories = channelAdminChannelId || watchChannelId;
  const categoriesQuery = useQuery({
    queryKey: ["admin", "categories", effectiveChannelIdForCategories],
    queryFn: () => adminListCategories(effectiveChannelIdForCategories),
    enabled: !!effectiveChannelIdForCategories,
  });
  const categories = categoriesQuery.data ?? [];
  const watchRentalEnabled = watch("rentalEnabled");
  const watchPurchaseEnabled = watch("purchaseEnabled");
  const watchFreeWithAds = watch("freeWithAds");
  const watchSubscriptionGated = watch("subscriptionGated");
  const filteredCreators = creators.filter(
    (c: any) => {
      if (!watchChannelId) return true;
      if (c.channelCreators) return c.channelCreators.some((cc: any) => cc.channelId === watchChannelId);
      return true;
    },
  );
  const channelPlans = watchChannelId
    ? plans.filter((p: any) => p.channelId === watchChannelId)
    : [];
  const filteredPlans = channelPlans.length > 0 ? channelPlans : plans;

  useEffect(() => {
    if (channelAdminChannelId) {
      setValue("channelId", channelAdminChannelId);
    }
  }, [channelAdminChannelId, setValue]);

  useEffect(() => {
    if (video?.creatorProfileId && creators.length > 0) {
      setValue("creatorProfileId", video.creatorProfileId);
    }
  }, [video, creators, setValue]);

  const [submitError, setSubmitError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: adminCreateVideo,
    onSuccess: (data) => {
      setSubmitError(null);
      qc.invalidateQueries({ queryKey: ["admin", "videos"] });
      navigate(`/admin/videos/${data.id}`);
    },
    onError: (err: any) => {
      setSubmitError(err?.response?.data?.message ?? err?.message ?? "Failed to create video");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: any) => adminUpdateVideo(id!, payload),
    onSuccess: () => {
      setSubmitError(null);
      qc.invalidateQueries({ queryKey: ["admin", "videos"] });
      qc.invalidateQueries({ queryKey: ["admin", "video", id] });
    },
    onError: (err: any) => {
      setSubmitError(err?.response?.data?.message ?? err?.message ?? "Failed to update video");
    },
  });

  const onSubmit = (data: VideoFormData) => {
    setSubmitError(null);
    const payload: any = {
      ...data,
      categoryIds: data.categoryIds ?? [],
      tags: data.tags?.split(",").map((t) => t.trim()).filter(Boolean) ?? [],
      rentalOptions: data.rentalEnabled ? (data.rentalOptions ?? []) : [],
      purchaseOptions: data.purchaseEnabled ? (data.purchaseOptions ?? []) : [],
    };
    if (isNew) createMutation.mutate(payload);
    else updateMutation.mutate(payload);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      console.log("Form validation errors:", errors);
    }
  }, [errors]);

  const handleDuplicate = () => {
    if (!video) return;
    navigate("/admin/videos/new");
  };

  if (!isNew && videoQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/videos">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold text-white">
            {isNew ? "Create Video" : "Edit Video"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && video && (
            <>
              <Button variant="outline" size="sm" onClick={handleDuplicate}>
                <Copy className="h-4 w-4" />
                Duplicate
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/videos/${video.slug}`} target="_blank">
                  <ExternalLink className="h-4 w-4" />
                  View on Site
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit, (validationErrors) => {
        const messages = Object.entries(validationErrors)
          .map(([key, err]) => {
            if (err?.message) return `${key}: ${err.message}`;
            if (Array.isArray(err)) {
              return err.map((e, i) =>
                e ? Object.entries(e).map(([k, v]: any) => `${key}[${i}].${k}: ${v?.message}`).join(", ") : null
              ).filter(Boolean).join("; ");
            }
            return key;
          })
          .join(", ");
        setSubmitError(`Validation failed: ${messages}`);
      })} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main form */}
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-surface-300">Channel</label>
                    {!isSuperAdmin && channelAdminChannelId ? (
                      <>
                        <input type="hidden" {...register("channelId")} />
                        <div className="flex h-10 w-full items-center rounded-md border border-surface-700 bg-surface-800 px-3 text-sm text-surface-300">
                          {channelDetailQuery.data?.name ?? "Loading..."}
                        </div>
                      </>
                    ) : (
                      <select
                        {...register("channelId")}
                        className="flex h-10 w-full rounded-md border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="">Select channel</option>
                        {channels.map((ch) => (
                          <option key={ch.id} value={ch.id}>{ch.name}</option>
                        ))}
                      </select>
                    )}
                    {errors.channelId && <p className="mt-1 text-xs text-destructive">{errors.channelId.message}</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-surface-300">Creator</label>
                    <select
                      {...register("creatorProfileId")}
                      className="flex h-10 w-full rounded-md border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Select creator</option>
                      {filteredCreators.map((cr: any) => (
                        <option key={cr.id} value={cr.id}>{cr.displayName ?? cr.name}</option>
                      ))}
                    </select>
                    {errors.creatorProfileId && <p className="mt-1 text-xs text-destructive">{errors.creatorProfileId.message}</p>}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-surface-300">Categories</label>
                  <p className="mb-2 text-xs text-surface-500">
                    Select one or more categories for this video.
                  </p>
                  <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-surface-700 bg-surface-900 p-2">
                    {categories.length === 0 ? (
                      <p className="px-2 py-2 text-sm text-surface-500">
                        No categories for this channel yet.
                      </p>
                    ) : (
                      categories.map((cat: Category) => {
                        const selected = watch("categoryIds") ?? [];
                        return (
                          <label
                            key={cat.id}
                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-surface-800"
                          >
                            <input
                              type="checkbox"
                              checked={selected.includes(cat.id)}
                              onChange={(e) => {
                                const cur = watch("categoryIds") ?? [];
                                if (e.target.checked) {
                                  setValue("categoryIds", [...cur, cat.id], { shouldDirty: true });
                                } else {
                                  setValue(
                                    "categoryIds",
                                    cur.filter((id) => id !== cat.id),
                                    { shouldDirty: true },
                                  );
                                }
                              }}
                              className="h-4 w-4 rounded border-surface-600 bg-surface-950 text-primary-600"
                            />
                            <span className="text-sm text-surface-200">{cat.name}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-surface-300">Title</label>
                  <Input
                    {...register("title", {
                      onChange: (e) => isNew && setValue("slug", slugify(e.target.value)),
                    })}
                    placeholder="Video title"
                  />
                  {errors.title && <p className="mt-1 text-xs text-destructive">{errors.title.message}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-surface-300">Slug</label>
                  <Input {...register("slug")} placeholder="video-slug" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-surface-300">Description</label>
                  <textarea
                    {...register("description")}
                    rows={4}
                    className="flex w-full rounded-md border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-50 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Full description"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-surface-300">Short Description</label>
                  <Input {...register("shortDescription")} placeholder="Brief summary" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-surface-300">Tags (comma-separated)</label>
                  <Input {...register("tags")} placeholder="tag1, tag2, tag3" />
                </div>
              </CardContent>
            </Card>

            {/* Upload section */}
            <Card>
              <CardHeader>
                <CardTitle>Video File</CardTitle>
              </CardHeader>
              <CardContent>
                {!isNew && video?.videoAssets?.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 rounded-lg border border-surface-800 bg-surface-800/50 p-3">
                      <Film className="h-5 w-5 text-surface-400" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">Current asset</p>
                        <p className="text-xs text-surface-400">
                          Status: {video.videoAssets[0].assetStatus}
                          {video.videoAssets[0].aspectRatio && ` · ${video.videoAssets[0].aspectRatio}`}
                        </p>
                      </div>
                      <Badge variant={video.videoAssets[0].assetStatus === "READY" ? "success" : "warning"}>
                        {video.videoAssets[0].assetStatus}
                      </Badge>
                    </div>
                    <UploadSection videoId={video.id} label="Replace File" />
                  </div>
                ) : isNew ? (
                  <p className="text-sm text-surface-400">
                    Save the video first, then upload the file.
                  </p>
                ) : (
                  <UploadSection videoId={id!} label="Upload File" />
                )}
              </CardContent>
            </Card>

            {!isNew && video?.id && (
              <Card>
                <CardHeader>
                  <CardTitle>Thumbnail</CardTitle>
                </CardHeader>
                <CardContent>
                  <ThumbnailUploadSection
                    videoId={video.id}
                    currentUrl={(video as any).thumbnailAssets?.[0]?.imageUrl ?? null}
                  />
                </CardContent>
              </Card>
            )}

            {!isNew && video?.id && (
              <Card>
                <CardHeader>
                  <CardTitle>Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <AdminVideoPreview videoId={video.id} title={video.title ?? "Video"} />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Publishing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-surface-300">Status</label>
                  <select
                    {...register("status")}
                    className="flex h-10 w-full rounded-md border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {(["DRAFT", "UNPUBLISHED", "PUBLISHED", "SCHEDULED", "PROCESSING", "ARCHIVED"]).map((s) => (
                      <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-surface-300">Schedule (optional)</label>
                  <Input type="datetime-local" {...register("scheduledAt")} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Access & Gating</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {([
                  { name: "isFree" as const, label: "Free", accessKey: "FREE" },
                  { name: "freeWithAds" as const, label: "Free with Ads", accessKey: "FREE_WITH_ADS" },
                  { name: "subscriptionGated" as const, label: "Subscription", accessKey: "SUBSCRIPTION" },
                  { name: "rentalEnabled" as const, label: "Rental", accessKey: "RENTAL" },
                  { name: "purchaseEnabled" as const, label: "Purchase", accessKey: "PURCHASE" },
                ] as const).filter(({ accessKey }) =>
                  !channelAllowedTypes || channelAllowedTypes.includes(accessKey),
                ).map(({ name, label }) => (
                  <div key={name} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={name}
                      {...register(name)}
                      className="h-4 w-4 rounded border-surface-700 bg-surface-900 text-primary-600 focus:ring-primary-500"
                    />
                    <label htmlFor={name} className="text-sm text-surface-300">
                      {label}
                    </label>
                  </div>
                ))}
              </CardContent>
            </Card>

            {watchRentalEnabled && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Rental Options</CardTitle>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => rentalFields.append({ name: "Rental", price: "", rentalHours: "48" })}
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {rentalFields.fields.length === 0 && (
                    <p className="text-sm text-surface-500">
                      No rental options. Click "Add" to create one.
                    </p>
                  )}
                  {rentalFields.fields.map((field, idx) => (
                    <div key={field.id} className="space-y-2 rounded-lg border border-surface-700 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium uppercase text-surface-400">
                          Rental {idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => rentalFields.remove(idx)}
                          className="text-surface-500 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-surface-400">Name</label>
                        <Input
                          {...register(`rentalOptions.${idx}.name`)}
                          placeholder="e.g. 48-hour rental"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="mb-1 block text-xs text-surface-400">Price ($)</label>
                          <Input
                            {...register(`rentalOptions.${idx}.price`)}
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="4.99"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-surface-400">Hours</label>
                          <Input
                            {...register(`rentalOptions.${idx}.rentalHours`)}
                            type="number"
                            min="1"
                            placeholder="48"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {watchPurchaseEnabled && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Purchase Options</CardTitle>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => purchaseFields.append({ name: "Buy to Own", price: "" })}
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {purchaseFields.fields.length === 0 && (
                    <p className="text-sm text-surface-500">
                      No purchase options. Click "Add" to create one.
                    </p>
                  )}
                  {purchaseFields.fields.map((field, idx) => (
                    <div key={field.id} className="space-y-2 rounded-lg border border-surface-700 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium uppercase text-surface-400">
                          Option {idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => purchaseFields.remove(idx)}
                          className="text-surface-500 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-surface-400">Name</label>
                        <Input
                          {...register(`purchaseOptions.${idx}.name`)}
                          placeholder="e.g. Buy to Own"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-surface-400">Price ($)</label>
                        <Input
                          {...register(`purchaseOptions.${idx}.price`)}
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="14.99"
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {watchFreeWithAds && (
              <Card>
                <CardHeader>
                  <CardTitle>Ads</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { name: "prerollAd" as const, label: "Pre-roll Ad" },
                    { name: "midrollAd" as const, label: "Mid-roll Ad" },
                  ].map(({ name, label }) => (
                    <div key={name} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={name}
                        {...register(name)}
                        className="h-4 w-4 rounded border-surface-700 bg-surface-900 text-primary-600 focus:ring-primary-500"
                      />
                      <label htmlFor={name} className="text-sm text-surface-300">
                        {label}
                      </label>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {watchSubscriptionGated && (!channelAllowedTypes || channelAllowedTypes.includes("SUBSCRIPTION")) && (
              <Card>
                <CardHeader>
                  <CardTitle>Subscription Plan</CardTitle>
                </CardHeader>
                <CardContent>
                  <select
                    {...register("subscriptionPlanId")}
                    className="flex h-10 w-full rounded-md border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">None</option>
                    {filteredPlans.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {submitError && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            {submitError}
          </div>
        )}

        {/* Save bar */}
        <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-surface-800 bg-surface-950/95 px-4 py-4 backdrop-blur-sm sm:-mx-6 sm:px-6">
          <Button variant="ghost" asChild>
            <Link to="/admin/videos">Cancel</Link>
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <Spinner size="sm" />
            ) : (
              <>
                <Save className="h-4 w-4" />
                {isNew ? "Create Video" : "Save Changes"}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function resolveImageUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const apiOrigin = (import.meta.env.VITE_API_URL || "http://localhost:4000/api").replace(/\/api$/, "");
  return `${apiOrigin}${url}`;
}

function ThumbnailUploadSection({
  videoId,
  currentUrl,
}: {
  videoId: string;
  currentUrl: string | null;
}) {
  const [preview, setPreview] = useState<string | null>(resolveImageUrl(currentUrl));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const handleFile = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const { url } = await uploadImage(file);
      await adminUpdateVideo(videoId, { thumbnailUrl: url } as any);
      setPreview(url);
      qc.invalidateQueries({ queryKey: ["admin", "video", videoId] });
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      {preview && (
        <div className="relative aspect-video w-full max-w-sm overflow-hidden rounded-lg border border-surface-700 bg-surface-800">
          <img src={preview} alt="Thumbnail" className="h-full w-full object-cover" />
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
      >
        {uploading ? <Spinner size="sm" /> : <Upload className="h-4 w-4" />}
        {preview ? "Replace Thumbnail" : "Upload Thumbnail"}
      </Button>
      {error && (
        <p className="flex items-center gap-1 text-sm text-destructive">
          <X className="h-4 w-4" />
          {error}
        </p>
      )}
    </div>
  );
}

function AdminVideoPreview({ videoId, title }: { videoId: string; title: string }) {
  const previewQuery = useQuery({
    queryKey: ["admin", "video", videoId, "preview-playback"],
    queryFn: () => adminGetVideoPreviewPlayback(videoId),
    enabled: !!videoId,
    retry: false,
  });

  if (previewQuery.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (previewQuery.isError) {
    const msg =
      (previewQuery.error as { response?: { data?: { message?: string } } })?.response?.data
        ?.message ??
      (previewQuery.error as Error)?.message ??
      "Could not load preview.";
    return <p className="text-sm text-surface-500">{msg}</p>;
  }

  const { playbackId, token } = previewQuery.data!;

  return (
    <div className="space-y-2">
      <p className="text-xs text-surface-500">
        Admin-only preview. Site visitors still follow subscriptions, rentals, and purchases.
      </p>
      <div className="aspect-video w-full max-w-4xl overflow-hidden rounded-lg border border-surface-700 bg-black">
        <VideoPlayer
          playbackId={playbackId}
          token={token ?? undefined}
          title={title}
          autoPlay={false}
          className="h-full w-full"
        />
      </div>
    </div>
  );
}

function UploadSection({
  videoId,
  label,
}: {
  videoId: string;
  label: string;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const handleUpload = useCallback(
    async (file: File) => {
      setError(null);
      setProgress(0);
      try {
        const { uploadUrl } = await createDirectUpload({ videoId });
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
          });
          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`Upload failed: ${xhr.status}`));
          });
          xhr.addEventListener("error", () => reject(new Error("Upload failed")));
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type);
          xhr.send(file);
        });
        setProgress(100);
        qc.invalidateQueries({ queryKey: ["admin", "video", videoId] });
      } catch (err: any) {
        setError(err.message ?? "Upload failed");
        setProgress(null);
      }
    },
    [videoId, qc],
  );

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
        }}
      />
      {progress !== null ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-surface-300">
              {progress < 100 ? "Uploading..." : "Upload complete"}
            </span>
            <span className="font-medium text-white">{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-800">
            <div
              className="h-full rounded-full bg-primary-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          {progress === 100 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setProgress(null); fileInputRef.current?.click(); }}
            >
              Upload Another
            </Button>
          )}
        </div>
      ) : (
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          {label}
        </Button>
      )}
      {error && (
        <p className="flex items-center gap-1 text-sm text-destructive">
          <X className="h-4 w-4" />
          {error}
        </p>
      )}
    </div>
  );
}
