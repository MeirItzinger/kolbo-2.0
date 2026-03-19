import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tv, AlertTriangle, ChevronLeft } from "lucide-react";
import { getSubscriptions, cancelSubscription } from "@/api/account";
import { listChannels } from "@/api/channels";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

export default function SubscriptionsPage() {
  const qc = useQueryClient();
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);

  const subsQuery = useQuery({
    queryKey: ["account", "subscriptions"],
    queryFn: getSubscriptions,
  });

  const channelsQuery = useQuery({
    queryKey: ["channels", "all"],
    queryFn: () => listChannels({ perPage: 50 }),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account", "subscriptions"] });
      setCancelTarget(null);
    },
  });

  const subscriptions = subsQuery.data ?? [];
  const channels = channelsQuery.data?.data ?? [];

  const subscribedChannelIds = new Set(subscriptions.map((s) => s.channelId));
  const unsubscribedChannels = channels.filter(
    (ch) => !subscribedChannelIds.has(ch.id),
  );

  const statusVariant = (status: string) => {
    switch (status) {
      case "active":
      case "trialing":
        return "success" as const;
      case "past_due":
        return "warning" as const;
      case "canceled":
        return "destructive" as const;
      default:
        return "secondary" as const;
    }
  };

  if (subsQuery.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/account">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-white">Subscriptions</h1>
      </div>

      {/* Active subscriptions */}
      {subscriptions.length > 0 ? (
        <div className="mb-10 space-y-4">
          <h2 className="text-lg font-semibold text-white">
            Your Subscriptions
          </h2>
          {subscriptions.map((sub) => (
            <Card key={sub.id}>
              <CardContent className="flex items-center justify-between p-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-800">
                    <Tv className="h-6 w-6 text-surface-500" />
                  </div>
                  <div>
                    <p className="font-medium text-white">
                      {sub.channel?.name ?? "Channel"}
                    </p>
                    <p className="text-sm text-surface-400">
                      {sub.plan?.name ?? "Plan"} &middot;{" "}
                      {formatCurrency(sub.plan?.priceMonthly ?? 0)}/mo
                    </p>
                    <p className="text-xs text-surface-500">
                      Renews {formatDate(sub.currentPeriodEnd)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={statusVariant(sub.status)}>{sub.status}</Badge>
                  {(sub.status === "active" || sub.status === "trialing") &&
                    !sub.cancelAtPeriodEnd && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setCancelTarget(sub.id)}
                      >
                        Cancel
                      </Button>
                    )}
                  {sub.cancelAtPeriodEnd && (
                    <span className="text-xs text-warning">
                      Cancels {formatDate(sub.currentPeriodEnd)}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="mb-10">
          <CardContent className="py-12 text-center">
            <Tv className="mx-auto mb-4 h-12 w-12 text-surface-600" />
            <p className="mb-2 text-lg font-medium text-white">
              No subscriptions yet
            </p>
            <p className="mb-6 text-surface-400">
              Subscribe to channels to start watching.
            </p>
            <Button asChild>
              <Link to="/explore">Browse Channels</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Available channels to add */}
      {unsubscribedChannels.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-white">
            Add More Channels
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {unsubscribedChannels.map((ch) => {
              const cheapest = ch.subscriptionPlans
                ?.filter((p) => p.isActive)
                .reduce<(typeof ch.subscriptionPlans)[0] | null>(
                  (min, p) =>
                    !min || p.priceMonthly < min.priceMonthly ? p : min,
                  null,
                );
              return (
                <Link
                  key={ch.id}
                  to={`/channels/${ch.slug}`}
                  className={cn(
                    "rounded-xl border border-surface-800 bg-surface-900 p-4 transition-all hover:border-surface-600",
                  )}
                >
                  <div className="flex items-center gap-3">
                    {ch.logoUrl ? (
                      <img
                        src={ch.logoUrl}
                        alt={ch.name}
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-800">
                        <Tv className="h-5 w-5 text-surface-500" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-white">{ch.name}</p>
                      {cheapest && (
                        <p className="text-sm text-surface-400">
                          from {formatCurrency(cheapest.priceMonthly)}/mo
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Cancel confirmation dialog */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="mx-4 w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Cancel Subscription
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-surface-300">
                Are you sure you want to cancel this subscription? You&apos;ll
                retain access until the end of your current billing period.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setCancelTarget(null)}>
                  Keep Subscription
                </Button>
                <Button
                  variant="destructive"
                  disabled={cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate(cancelTarget)}
                >
                  {cancelMutation.isPending ? (
                    <Spinner size="sm" />
                  ) : (
                    "Yes, Cancel"
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
