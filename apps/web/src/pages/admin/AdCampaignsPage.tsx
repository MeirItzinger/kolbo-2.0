import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Megaphone,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  MapPin,
  Film,
  AlertTriangle,
} from "lucide-react";
import {
  adminListAdCampaigns,
  adminApproveAdCampaign,
  adminRejectAdCampaign,
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
import type { CampaignStatus, AdCampaign } from "@/types";

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

const statusFilterOptions: { value: string; label: string }[] = [
  { value: "", label: "All Statuses" },
  { value: "PENDING_REVIEW", label: "Pending Review" },
  { value: "APPROVED", label: "Approved" },
  { value: "ACTIVE", label: "Active" },
  { value: "REJECTED", label: "Rejected" },
  { value: "DRAFT", label: "Draft" },
  { value: "COMPLETED", label: "Completed" },
];

export default function AdminAdCampaignsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("PENDING_REVIEW");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdCampaign | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["admin", "ad-campaigns", statusFilter],
    queryFn: () =>
      adminListAdCampaigns(statusFilter ? { status: statusFilter } : undefined),
  });

  const approveMutation = useMutation({
    mutationFn: adminApproveAdCampaign,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "ad-campaigns"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      adminRejectAdCampaign(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "ad-campaigns"] });
      setRejectTarget(null);
      setRejectReason("");
    },
  });

  const selectClass =
    "flex h-10 w-full rounded-md border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Ad Campaigns</h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={selectClass + " w-48"}
        >
          {statusFilterOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : !campaigns?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Megaphone className="mx-auto mb-4 h-12 w-12 text-surface-600" />
            <p className="text-lg font-medium text-white">No campaigns found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const isExpanded = expandedId === c.id;
            return (
              <Card key={c.id}>
                <div
                  className="flex cursor-pointer items-center justify-between px-5 py-4"
                  onClick={() =>
                    setExpandedId(isExpanded ? null : c.id)
                  }
                >
                  <div className="flex items-center gap-4">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-surface-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-surface-400" />
                    )}
                    <div>
                      <h3 className="font-semibold text-white">{c.name}</h3>
                      <p className="text-sm text-surface-400">
                        {c.advertiser?.companyName ?? "Unknown"} &middot;{" "}
                        {c.advertiser?.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-surface-400">
                      {formatCurrency(Number(c.totalBudget))}
                    </span>
                    <Badge variant={statusVariant[c.status]}>
                      {c.status.replace(/_/g, " ")}
                    </Badge>
                    {c.status === "PENDING_REVIEW" && (
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => approveMutation.mutate(c.id)}
                          disabled={approveMutation.isPending}
                        >
                          <CheckCircle className="h-4 w-4 text-green-400" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setRejectTarget(c)}
                        >
                          <XCircle className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-surface-800 px-5 pb-4 pt-3">
                    <div className="grid gap-4 text-sm sm:grid-cols-3">
                      <div>
                        <span className="text-surface-500">Daily Max</span>
                        <p className="font-medium text-white">
                          {formatCurrency(Number(c.dailyMaxSpend))}
                        </p>
                      </div>
                      <div>
                        <span className="text-surface-500">Age Range</span>
                        <p className="text-white">
                          {c.targetAgeMin ?? "Any"} &ndash;{" "}
                          {c.targetAgeMax ?? "Any"}
                        </p>
                      </div>
                      <div>
                        <span className="text-surface-500">Creatives</span>
                        <p className="text-white">
                          {c.creatives?.length ?? 0} video
                          {(c.creatives?.length ?? 0) !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    {c.geoTargets && c.geoTargets.length > 0 && (
                      <div className="mt-3">
                        <span className="text-xs text-surface-500">
                          Locations:
                        </span>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {c.geoTargets.map((gt) => (
                            <Badge
                              key={gt.id}
                              variant="outline"
                              className="gap-1"
                            >
                              <MapPin className="h-3 w-3" />
                              {gt.type === "CITY" ? "City" : "Zip"}: {gt.value}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {c.creatives && c.creatives.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {c.creatives.map((cr) => (
                          <div
                            key={cr.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            <Film className="h-4 w-4 text-surface-500" />
                            <span className="text-surface-300">
                              {cr.fileName || "Video"}
                            </span>
                            <Badge
                              variant={
                                cr.assetStatus === "READY"
                                  ? "success"
                                  : cr.assetStatus === "ERRORED"
                                    ? "destructive"
                                    : "warning"
                              }
                            >
                              {cr.assetStatus}
                            </Badge>
                            {cr.muxPlaybackId && (
                              <span className="text-xs text-surface-500">
                                Playback: {cr.muxPlaybackId}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="mx-4 w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Reject Campaign
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-surface-300">
                Rejecting{" "}
                <strong className="text-white">{rejectTarget.name}</strong> by{" "}
                {rejectTarget.advertiser?.companyName}.
              </p>
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-300">
                  Reason (optional)
                </label>
                <Input
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Video quality too low"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setRejectTarget(null);
                    setRejectReason("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={rejectMutation.isPending}
                  onClick={() =>
                    rejectMutation.mutate({
                      id: rejectTarget.id,
                      reason: rejectReason || undefined,
                    })
                  }
                >
                  {rejectMutation.isPending ? (
                    <Spinner size="sm" />
                  ) : (
                    "Reject"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
