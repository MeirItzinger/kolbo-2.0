import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Upload,
  XCircle,
  Send,
  MapPin,
  Users,
  DollarSign,
  Film,
  Tv,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  getCampaign,
  submitCampaign,
  getAdUploadUrl,
  deleteAdCreative,
  updateAdCreative,
} from "@/api/advertiser";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils";
import type {
  CampaignStatus,
  AdCreativeStatus,
  AdCreative,
} from "@/types";

const statusVariant: Record<CampaignStatus, "default" | "success" | "warning" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  PENDING_REVIEW: "warning",
  APPROVED: "success",
  ACTIVE: "success",
  PAUSED: "outline",
  REJECTED: "destructive",
  COMPLETED: "secondary",
  CANCELLED: "secondary",
};

const creativeStatusLabel: Record<AdCreativeStatus, string> = {
  CREATED: "Uploading...",
  UPLOADED: "Processing...",
  PROCESSING: "Processing...",
  READY: "Ready",
  ERRORED: "Error",
};

function CreativeRow({
  campaignId,
  creative,
  canEdit,
}: {
  campaignId: string;
  creative: AdCreative;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [label, setLabel] = useState(creative.fileName ?? "");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setLabel(creative.fileName ?? "");
  }, [creative.id, creative.fileName]);

  const patchMutation = useMutation({
    mutationFn: () =>
      updateAdCreative(campaignId, creative.id, {
        fileName: label.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["advertiser", "campaigns", campaignId] });
      setEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteAdCreative(campaignId, creative.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["advertiser", "campaigns", campaignId] });
    },
  });

  const handleDelete = () => {
    if (
      !confirm(
        "Remove this video ad? You can upload a new file afterward. Billing history for past impressions is kept."
      )
    ) {
      return;
    }
    deleteMutation.mutate();
  };

  return (
    <div className="rounded-lg border border-surface-700 bg-surface-800/50 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Film className="mt-0.5 h-5 w-5 shrink-0 text-surface-500" />
          <div className="min-w-0 flex-1">
            {canEdit && editing ? (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Display name (optional)"
                  className="max-w-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={patchMutation.isPending}
                  onClick={() => patchMutation.mutate()}
                >
                  {patchMutation.isPending ? <Spinner size="sm" /> : "Save"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setLabel(creative.fileName ?? "");
                    setEditing(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium text-white">
                  {creative.fileName?.trim() || "Video ad"}
                </p>
                {creative.durationSeconds != null && (
                  <p className="text-xs text-surface-400">
                    {Math.floor(creative.durationSeconds / 60)}:
                    {String(creative.durationSeconds % 60).padStart(2, "0")}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <Badge
            variant={
              creative.assetStatus === "READY"
                ? "success"
                : creative.assetStatus === "ERRORED"
                  ? "destructive"
                  : "warning"
            }
          >
            {creativeStatusLabel[creative.assetStatus]}
          </Badge>
          {canEdit && !editing && (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setEditing(true)}
              >
                <Pencil className="mr-1 h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
                disabled={deleteMutation.isPending}
                onClick={handleDelete}
              >
                {deleteMutation.isPending ? (
                  <Spinner size="sm" />
                ) : (
                  <>
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Remove
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
      {canEdit && (
        <p className="mt-2 text-xs text-surface-500">
          Edit updates the label only. Remove this ad to upload a different video
          file, then use &ldquo;Upload Video Ad&rdquo;.
        </p>
      )}
    </div>
  );
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: campaign, isLoading } = useQuery({
    queryKey: ["advertiser", "campaigns", id],
    queryFn: () => getCampaign(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const c = query.state.data;
      const hasPending = c?.creatives?.some(
        (cr) =>
          cr.assetStatus === "CREATED" ||
          cr.assetStatus === "UPLOADED" ||
          cr.assetStatus === "PROCESSING"
      );
      return hasPending ? 5000 : false;
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => submitCampaign(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["advertiser", "campaigns", id] });
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setUploading(true);
    try {
      const { uploadUrl } = await getAdUploadUrl(id, file.name);
      await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      qc.invalidateQueries({ queryKey: ["advertiser", "campaigns", id] });
    } catch {
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <p className="py-12 text-center text-surface-400">Campaign not found.</p>
    );
  }

  const canEdit = ["DRAFT", "REJECTED"].includes(campaign.status);
  const readyCreatives =
    campaign.creatives?.filter((c) => c.assetStatus === "READY") ?? [];
  const canSubmit = canEdit && readyCreatives.length > 0;

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate("/advertise/dashboard")}
        className="flex items-center gap-1 text-sm text-surface-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{campaign.name}</h1>
          <Badge variant={statusVariant[campaign.status]} className="mt-2">
            {campaign.status.replace(/_/g, " ")}
          </Badge>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Spinner size="sm" />
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload Video Ad
                </>
              )}
            </Button>
          )}
          {canSubmit && (
            <Button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? (
                <Spinner size="sm" />
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit for Review
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      {campaign.status === "REJECTED" && campaign.rejectionReason && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-start gap-3 py-4">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Campaign Rejected</p>
              <p className="mt-1 text-sm text-surface-300">
                {campaign.rejectionReason}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Budget */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4 text-amber-400" />
              Budget
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-surface-400">Total Budget</span>
              <span className="font-medium text-white">
                {formatCurrency(Number(campaign.totalBudget))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-400">Daily Max Spend</span>
              <span className="font-medium text-white">
                {formatCurrency(Number(campaign.dailyMaxSpend))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-400">Total Spent</span>
              <span className="font-medium text-white">
                {formatCurrency(Number(campaign.totalSpent))}
              </span>
            </div>
            {campaign.startDate && (
              <div className="flex justify-between">
                <span className="text-surface-400">Start Date</span>
                <span className="text-white">
                  {new Date(campaign.startDate).toLocaleDateString()}
                </span>
              </div>
            )}
            {campaign.endDate && (
              <div className="flex justify-between">
                <span className="text-surface-400">End Date</span>
                <span className="text-white">
                  {new Date(campaign.endDate).toLocaleDateString()}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Targeting */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-amber-400" />
              Targeting
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {(campaign.targetAgeMin || campaign.targetAgeMax) && (
              <div>
                <span className="text-surface-400">Age Range: </span>
                <span className="text-white">
                  {campaign.targetAgeMin ?? "Any"} &ndash;{" "}
                  {campaign.targetAgeMax ?? "Any"}
                </span>
              </div>
            )}
            {campaign.geoTargets && campaign.geoTargets.length > 0 ? (
              <div>
                <span className="mb-2 block text-surface-400">Locations:</span>
                <div className="flex flex-wrap gap-2">
                  {campaign.geoTargets.map((gt) => (
                    <Badge key={gt.id} variant="outline" className="gap-1">
                      <MapPin className="h-3 w-3" />
                      <span className="text-xs text-surface-500">
                        {gt.type === "CITY" ? "City" : "Zip"}:
                      </span>{" "}
                      {gt.value}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-surface-500">No geographic targeting set.</p>
            )}

            <div className="border-t border-surface-800 pt-3">
              <span className="mb-2 flex items-center gap-1.5 text-surface-400">
                <Tv className="h-3.5 w-3.5" />
                Channels:
              </span>
              {campaign.channelTargets && campaign.channelTargets.length > 0 ? (
                <ul className="space-y-2">
                  {campaign.channelTargets.map((ct) => (
                    <li key={ct.id}>
                      {ct.channel?.slug ? (
                        <Link
                          to={`/channels/${ct.channel.slug}`}
                          className="flex items-center gap-2 text-sm text-primary-400 hover:text-primary-300"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {ct.channel.logoUrl ? (
                            <img
                              src={ct.channel.logoUrl}
                              alt=""
                              className="h-8 w-8 rounded-md object-cover"
                            />
                          ) : (
                            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-800">
                              <Tv className="h-4 w-4 text-surface-500" />
                            </span>
                          )}
                          <span className="font-medium text-white">
                            {ct.channel.name}
                          </span>
                        </Link>
                      ) : (
                        <span className="text-sm text-surface-400">
                          Channel {ct.channelId}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-surface-500">
                  All ad-eligible channels — your ad can run on any channel that
                  accepts preroll ads (no channel restriction).
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Creatives */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Film className="h-4 w-4 text-amber-400" />
            Video Ads ({campaign.creatives?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!campaign.creatives?.length ? (
            <p className="py-4 text-center text-sm text-surface-400">
              No video ads uploaded yet.
              {canEdit && " Click \"Upload Video Ad\" to get started."}
            </p>
          ) : (
            <div className="space-y-3">
              {campaign.creatives.map((cr) => (
                <CreativeRow
                  key={cr.id}
                  campaignId={campaign.id}
                  creative={cr}
                  canEdit={canEdit}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
