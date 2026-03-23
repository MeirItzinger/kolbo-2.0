import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Megaphone, AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { listCampaigns, deleteCampaign } from "@/api/advertiser";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Card, CardContent } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils";
import type { CampaignStatus } from "@/types";

const statusConfig: Record<
  CampaignStatus,
  { label: string; variant: "default" | "success" | "warning" | "secondary" | "destructive" | "outline" }
> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  PENDING_REVIEW: { label: "Pending Review", variant: "warning" },
  APPROVED: { label: "Approved", variant: "success" },
  ACTIVE: { label: "Active", variant: "success" },
  PAUSED: { label: "Paused", variant: "outline" },
  REJECTED: { label: "Rejected", variant: "destructive" },
  COMPLETED: { label: "Completed", variant: "secondary" },
  CANCELLED: { label: "Cancelled", variant: "secondary" },
};

export default function AdvertiserDashboardPage() {
  const qc = useQueryClient();
  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["advertiser", "campaigns"],
    queryFn: listCampaigns,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCampaign,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["advertiser", "campaigns"] });
    },
  });

  const handleDelete = (campaignId: string, name: string) => {
    if (
      !confirm(
        `Delete campaign "${name}"? This cannot be undone for draft, rejected, or pending-review campaigns.`
      )
    ) {
      return;
    }
    deleteMutation.mutate(campaignId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">My Campaigns</h1>
        <Button asChild>
          <Link to="/advertise/campaigns/new">
            <Plus className="h-4 w-4" />
            New Campaign
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : !campaigns?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Megaphone className="mx-auto mb-4 h-12 w-12 text-surface-600" />
            <p className="text-lg font-medium text-white">No campaigns yet</p>
            <p className="mt-1 text-sm text-surface-400">
              Create your first ad campaign to start reaching viewers.
            </p>
            <Button className="mt-6" asChild>
              <Link to="/advertise/campaigns/new">Create Campaign</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const cfg = statusConfig[c.status];
            const canEditSettings =
              c.status === "DRAFT" || c.status === "REJECTED";
            const canDelete =
              c.status === "DRAFT" ||
              c.status === "REJECTED" ||
              c.status === "PENDING_REVIEW";
            return (
              <Card
                key={c.id}
                className="transition-colors hover:border-surface-600"
              >
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <Link
                    to={`/advertise/campaigns/${c.id}`}
                    className="flex min-w-0 flex-1 items-center gap-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-600/20">
                      <Megaphone className="h-5 w-5 text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-white">{c.name}</h3>
                      <p className="text-sm text-surface-400">
                        Budget: {formatCurrency(Number(c.totalBudget))} &middot;
                        Daily max:{" "}
                        {formatCurrency(Number(c.dailyMaxSpend))}
                        {c.creatives?.length
                          ? ` \u00B7 ${c.creatives.length} creative${c.creatives.length !== 1 ? "s" : ""}`
                          : ""}
                      </p>
                    </div>
                  </Link>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    {c.status === "REJECTED" && c.rejectionReason && (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    )}
                    {canEditSettings && (
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/advertise/campaigns/${c.id}/edit`}>
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          Edit
                        </Link>
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-destructive/40 text-destructive hover:bg-destructive/10"
                        disabled={deleteMutation.isPending}
                        onClick={() => handleDelete(c.id, c.name)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Delete
                      </Button>
                    )}
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
