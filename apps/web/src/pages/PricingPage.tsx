import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Tv, ArrowLeft } from "lucide-react";
import { getChannel } from "@/api/channels";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { cn, formatCurrency } from "@/lib/utils";
import type { SubscriptionPlan, PlanPriceVariant } from "@/types";

type Interval = "MONTHLY" | "YEARLY";
type StreamTier = "STREAMS_3" | "STREAMS_5";

export default function PricingPage() {
  const { channelSlug } = useParams<{ channelSlug: string }>();
  const { isAuthenticated } = useAuth();
  const [interval, setInterval] = useState<Interval>("MONTHLY");
  const [streamTier, setStreamTier] = useState<StreamTier>("STREAMS_3");

  const channelQuery = useQuery({
    queryKey: ["channel", channelSlug],
    queryFn: () => getChannel(channelSlug!),
    enabled: !!channelSlug,
  });

  const channel = channelQuery.data;
  const plans: SubscriptionPlan[] = (channel?.subscriptionPlans ?? []).filter(
    (p: SubscriptionPlan) => p.isActive,
  );

  const hasYearly = plans.some((p) =>
    (p.priceVariants ?? []).some((v) => v.billingInterval === "YEARLY"),
  );

  function findVariant(plan: SubscriptionPlan): PlanPriceVariant | undefined {
    return (plan.priceVariants ?? []).find(
      (v) =>
        v.isActive &&
        v.billingInterval === interval &&
        v.concurrencyTier === streamTier &&
        v.adTier === "WITHOUT_ADS",
    );
  }

  if (channelQuery.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <Tv className="mb-4 h-12 w-12 text-surface-600" />
        <h2 className="mb-2 text-xl font-semibold text-white">Channel not found</h2>
        <Button asChild>
          <Link to="/explore">Browse Channels</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/channels/${channel.slug}`}>
            <ArrowLeft className="h-4 w-4" />
            Back to {channel.name}
          </Link>
        </Button>
      </div>

      <div className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-800">
          {channel.logoUrl ? (
            <img src={channel.logoUrl} alt={channel.name} className="h-full w-full rounded-2xl object-cover" />
          ) : (
            <Tv className="h-8 w-8 text-surface-500" />
          )}
        </div>
        <h1 className="text-3xl font-bold text-white">{channel.name} Plans</h1>
        {channel.description && (
          <p className="mt-2 text-surface-400">{channel.description}</p>
        )}
      </div>

      {/* Controls */}
      <div className="mb-8 flex flex-wrap items-center justify-center gap-4">
        {/* Interval toggle */}
        {hasYearly && (
          <div className="flex rounded-lg border border-surface-700 bg-surface-800">
            <button
              type="button"
              onClick={() => setInterval("MONTHLY")}
              className={cn(
                "rounded-l-lg px-6 py-2 text-sm font-medium transition-colors",
                interval === "MONTHLY"
                  ? "bg-primary-600 text-white"
                  : "text-surface-400 hover:text-white",
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setInterval("YEARLY")}
              className={cn(
                "rounded-r-lg px-6 py-2 text-sm font-medium transition-colors",
                interval === "YEARLY"
                  ? "bg-primary-600 text-white"
                  : "text-surface-400 hover:text-white",
              )}
            >
              Yearly
              <Badge variant="success" className="ml-2 text-[10px]">Save</Badge>
            </button>
          </div>
        )}

        {/* Streams toggle */}
        <div className="flex rounded-lg border border-surface-700 bg-surface-800">
          <button
            type="button"
            onClick={() => setStreamTier("STREAMS_3")}
            className={cn(
              "rounded-l-lg px-5 py-2 text-sm font-medium transition-colors",
              streamTier === "STREAMS_3"
                ? "bg-primary-600 text-white"
                : "text-surface-400 hover:text-white",
            )}
          >
            3 Streams
          </button>
          <button
            type="button"
            onClick={() => setStreamTier("STREAMS_5")}
            className={cn(
              "rounded-r-lg px-5 py-2 text-sm font-medium transition-colors",
              streamTier === "STREAMS_5"
                ? "bg-primary-600 text-white"
                : "text-surface-400 hover:text-white",
            )}
          >
            5 Streams
          </button>
        </div>
      </div>

      {plans.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-surface-400">No plans available for this channel yet.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan, i) => {
            const variant = findVariant(plan);
            const price = variant ? Number(variant.price) : null;
            const isPopular = i === Math.floor(plans.length / 2);

            return (
              <div
                key={plan.id}
                className={cn(
                  "relative rounded-2xl border bg-surface-900 p-6 transition-all",
                  isPopular
                    ? "border-primary-500 ring-1 ring-primary-500/30"
                    : "border-surface-800 hover:border-surface-600",
                )}
              >
                {isPopular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    Most Popular
                  </Badge>
                )}
                <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                {plan.description && (
                  <p className="mt-1 text-sm text-surface-400">{plan.description}</p>
                )}
                <div className="mt-4">
                  {price != null ? (
                    <>
                      <span className="text-4xl font-bold text-white">
                        {formatCurrency(price)}
                      </span>
                      <span className="text-surface-400">
                        /{interval === "YEARLY" ? "yr" : "mo"}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-surface-500">
                      Not available for this configuration
                    </span>
                  )}
                </div>
                <Button
                  className="mt-6 w-full"
                  variant={isPopular ? "default" : "outline"}
                  asChild={isAuthenticated}
                  disabled={!isAuthenticated || price == null}
                >
                  {isAuthenticated ? (
                    <Link to="/signup">Subscribe</Link>
                  ) : (
                    "Sign in to Subscribe"
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
