import { useState, useEffect, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronLeft, Save, Upload, X } from "lucide-react";
import { adminGetChannel, adminUpdateChannel, uploadImage } from "@/api/admin";
import { resolveUploadedAssetUrl } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import type { VideoAccessType } from "@/types";

const ACCESS_TYPE_OPTIONS: { value: VideoAccessType; label: string }[] = [
  { value: "FREE", label: "Free" },
  { value: "FREE_WITH_ADS", label: "Free with Ads" },
  { value: "SUBSCRIPTION", label: "Subscription" },
  { value: "RENTAL", label: "Rental" },
  { value: "PURCHASE", label: "Purchase" },
];

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional(),
  logoUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  isActive: z.boolean(),
});

type FormData = z.infer<typeof schema>;

export default function AdminChannelEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const logoFileRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState("");

  const channelQuery = useQuery({
    queryKey: ["admin", "channel", id],
    queryFn: () => adminGetChannel(id!),
    enabled: !!id,
  });

  const channel = channelQuery.data;

  const [selectedAccessTypes, setSelectedAccessTypes] = useState<VideoAccessType[]>([]);

  useEffect(() => {
    if (channel?.allowedAccessTypes) {
      setSelectedAccessTypes(channel.allowedAccessTypes);
    }
  }, [channel]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: channel
      ? {
          name: channel.name,
          slug: channel.slug,
          description: channel.description ?? "",
          logoUrl: channel.logoUrl
            ? resolveUploadedAssetUrl(channel.logoUrl)
            : "",
          isActive: channel.isActive,
        }
      : undefined,
  });

  const logoUrl = watch("logoUrl");

  const onLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploadError("");
    setLogoUploading(true);
    try {
      const { url } = await uploadImage(file);
      setValue("logoUrl", resolveUploadedAssetUrl(url), { shouldValidate: true });
    } catch (err: unknown) {
      setLogoUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLogoUploading(false);
      e.target.value = "";
    }
  };

  const clearLogo = () => {
    setValue("logoUrl", "", { shouldValidate: true });
    if (logoFileRef.current) logoFileRef.current.value = "";
  };

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      adminUpdateChannel(id!, {
        ...data,
        logoUrl: data.logoUrl?.trim() ? data.logoUrl.trim() : null,
        allowedAccessTypes: selectedAccessTypes,
      } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "channels"] });
      qc.invalidateQueries({ queryKey: ["admin", "channel", id] });
      navigate("/admin/channels");
    },
  });

  const toggleAccessType = (type: VideoAccessType) => {
    setSelectedAccessTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  if (channelQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg text-surface-400">Channel not found.</p>
        <Button className="mt-4" asChild>
          <Link to="/admin/channels">Back to Channels</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/admin/channels">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-white">Edit Channel</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Channel Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit((data) => updateMutation.mutate(data))}
            className="space-y-4"
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">
                Name
              </label>
              <Input {...register("name")} />
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
              <Input {...register("slug")} />
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
                rows={4}
                className="flex w-full rounded-md border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-50 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">
                Channel image
              </label>
              <p className="mb-2 text-xs text-surface-500">
                Shown on the public channel page next to the title and Subscribe
                button.
              </p>
              <input
                ref={logoFileRef}
                type="file"
                accept="image/*"
                onChange={onLogoFile}
                className="hidden"
              />
              <input type="hidden" {...register("logoUrl")} />
              {errors.logoUrl && (
                <p className="mb-1 text-xs text-destructive">
                  {errors.logoUrl.message}
                </p>
              )}
              {logoUrl ? (
                <div className="relative mt-1 inline-block">
                  <img
                    src={logoUrl}
                    alt="Channel preview"
                    className="h-28 w-28 rounded-2xl border border-surface-700 object-cover"
                  />
                  {logoUploading && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50">
                      <Spinner size="sm" />
                    </div>
                  )}
                  {!logoUploading && (
                    <button
                      type="button"
                      onClick={clearLogo}
                      className="absolute -right-2 -top-2 rounded-full bg-surface-800 p-1 text-surface-200 ring-1 ring-surface-600 hover:bg-surface-700"
                      aria-label="Remove image"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => logoFileRef.current?.click()}
                  disabled={logoUploading}
                  className="mt-1 flex w-full max-w-sm items-center justify-center gap-2 rounded-lg border-2 border-dashed border-surface-700 bg-surface-900/50 px-4 py-8 text-sm text-surface-400 transition-colors hover:border-primary-500/50 hover:text-surface-300 disabled:opacity-50"
                >
                  {logoUploading ? (
                    <Spinner size="sm" />
                  ) : (
                    <>
                      <Upload className="h-5 w-5" />
                      Click to upload channel image
                    </>
                  )}
                </button>
              )}
              {logoUrl && !logoUploading && (
                <button
                  type="button"
                  onClick={() => logoFileRef.current?.click()}
                  className="mt-2 text-xs text-primary-400 hover:underline"
                >
                  Replace image
                </button>
              )}
              {logoUploadError && (
                <p className="mt-1 text-xs text-destructive">{logoUploadError}</p>
              )}
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-surface-300">
                Allowed Video Types
              </label>
              <p className="mb-3 text-xs text-surface-500">
                Select which types of videos creators on this channel can
                publish
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
                    <span className="text-sm text-surface-200">
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                {...register("isActive")}
                className="h-4 w-4 rounded border-surface-700 bg-surface-900 text-primary-600 focus:ring-primary-500"
              />
              <label
                htmlFor="isActive"
                className="text-sm font-medium text-surface-300"
              >
                Active
              </label>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" asChild>
                <Link to="/admin/channels">Cancel</Link>
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <Spinner size="sm" />
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
