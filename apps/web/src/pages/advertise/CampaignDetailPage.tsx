import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Upload,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  MapPin,
  Users,
  DollarSign,
  Film,
} from "lucide-react";
import {
  getCampaign,
  submitCampaign,
  getAdUploadUrl,
} from "@/api/advertiser";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils";
import type { CampaignStatus, AdCreativeStatus } from "@/types";

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
                <div
                  key={cr.id}
                  className="flex items-center justify-between rounded-lg border border-surface-700 bg-surface-800/50 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Film className="h-5 w-5 text-surface-500" />
                    <div>
                      <p className="text-sm font-medium text-white">
                        {cr.fileName || "Video Ad"}
                      </p>
                      {cr.durationSeconds && (
                        <p className="text-xs text-surface-400">
                          {Math.floor(cr.durationSeconds / 60)}:
                          {String(cr.durationSeconds % 60).padStart(2, "0")}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant={
                      cr.assetStatus === "READY"
                        ? "success"
                        : cr.assetStatus === "ERRORED"
                          ? "destructive"
                          : "warning"
                    }
                  >
                    {creativeStatusLabel[cr.assetStatus]}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
