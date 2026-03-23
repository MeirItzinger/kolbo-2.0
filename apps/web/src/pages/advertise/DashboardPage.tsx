import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Megaphone, Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { listCampaigns } from "@/api/advertiser";
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
  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["advertiser", "campaigns"],
    queryFn: listCampaigns,
  });

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
            return (
              <Link
                key={c.id}
                to={`/advertise/campaigns/${c.id}`}
                className="block"
              >
                <Card className="transition-colors hover:border-surface-600">
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-600/20">
                        <Megaphone className="h-5 w-5 text-amber-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{c.name}</h3>
                        <p className="text-sm text-surface-400">
                          Budget: {formatCurrency(Number(c.totalBudget))} &middot; Daily
                          max: {formatCurrency(Number(c.dailyMaxSpend))}
                          {c.creatives?.length
                            ? ` \u00B7 ${c.creatives.length} creative${c.creatives.length !== 1 ? "s" : ""}`
                            : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {c.status === "REJECTED" && c.rejectionReason && (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      )}
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
