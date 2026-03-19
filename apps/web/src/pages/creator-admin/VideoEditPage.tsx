import { useState, useRef, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronLeft, Save, Upload, Film, X } from "lucide-react";
import {
  adminGetVideo,
  adminCreateVideo,
  adminUpdateVideo,
  createDirectUpload,
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

const videoSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional(),
  tags: z.string().optional(),
});

type VideoFormData = z.infer<typeof videoSchema>;

export default function CreatorAdminVideoEditPage() {
  const { creatorId, id } = useParams<{ creatorId: string; id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isNew = id === "new";

  const videoQuery = useQuery({
    queryKey: ["creator-admin", creatorId, "video", id],
    queryFn: () => adminGetVideo(id!),
    enabled: !isNew && !!id,
  });

  const video = videoQuery.data;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<VideoFormData>({
    resolver: zodResolver(videoSchema),
    values: video
      ? {
          title: video.title,
          slug: video.slug,
          description: video.description ?? "",
          tags: video.tags.join(", "),
        }
      : undefined,
  });

  const createMutation = useMutation({
    mutationFn: (data: VideoFormData) =>
      adminCreateVideo({
        ...data,
        creatorProfileId: creatorId,
        channelId: video?.channelId ?? "",
        tags: data.tags?.split(",").map((t) => t.trim()).filter(Boolean) ?? [],
        status: "draft",
      } as any),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["creator-admin", creatorId, "videos"] });
      navigate(`../${data.id}`, { relative: "path" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: VideoFormData) =>
      adminUpdateVideo(id!, {
        ...data,
        tags: data.tags?.split(",").map((t) => t.trim()).filter(Boolean) ?? [],
      } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["creator-admin", creatorId, "video", id] });
      qc.invalidateQueries({ queryKey: ["creator-admin", creatorId, "videos"] });
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (data: VideoFormData) => {
    if (isNew) createMutation.mutate(data);
    else updateMutation.mutate(data);
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
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/creator-admin/${creatorId}/videos`}>
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-white">
          {isNew ? "Upload Video" : "Edit Video"}
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
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
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">Tags (comma-separated)</label>
              <Input {...register("tags")} placeholder="tag1, tag2" />
            </div>
          </CardContent>
        </Card>

        {/* Upload section */}
        {!isNew && (
          <Card>
            <CardHeader><CardTitle>Video File</CardTitle></CardHeader>
            <CardContent>
              {video?.asset ? (
                <div className="flex items-center gap-3 rounded-lg border border-surface-800 bg-surface-800/50 p-3">
                  <Film className="h-5 w-5 text-surface-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">Current asset</p>
                    <p className="text-xs text-surface-400">Status: {video.asset.status}</p>
                  </div>
                  <Badge variant={video.asset.status === "ready" ? "success" : "warning"}>
                    {video.asset.status}
                  </Badge>
                </div>
              ) : (
                <UploadSection videoId={id!} />
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="ghost" asChild>
            <Link to={`/creator-admin/${creatorId}/videos`}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? <Spinner size="sm" /> : (
              <><Save className="h-4 w-4" />{isNew ? "Create" : "Save"}</>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function UploadSection({ videoId }: { videoId: string }) {
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
        qc.invalidateQueries({ queryKey: ["creator-admin"] });
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
            <span className="text-surface-300">{progress < 100 ? "Uploading..." : "Complete"}</span>
            <span className="font-medium text-white">{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-800">
            <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-4 w-4" />Upload Video File
        </Button>
      )}
      {error && (
        <p className="flex items-center gap-1 text-sm text-destructive">
          <X className="h-4 w-4" />{error}
        </p>
      )}
    </div>
  );
}
