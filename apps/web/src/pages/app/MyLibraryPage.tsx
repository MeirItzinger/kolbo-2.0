import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Library, Film, Play } from "lucide-react";
import { getWatchHistory, getPurchases, getRentals } from "@/api/account";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { cn, formatDate } from "@/lib/utils";

type Tab = "continue" | "purchases" | "rentals";

export default function MyLibraryPage() {
  const [activeTab, setActiveTab] = useState<Tab>("continue");

  const historyQuery = useQuery({
    queryKey: ["account", "watch-history"],
    queryFn: () => getWatchHistory({ perPage: 20 }),
  });

  const purchasesQuery = useQuery({
    queryKey: ["account", "purchases"],
    queryFn: () => getPurchases({ perPage: 50 }),
  });

  const rentalsQuery = useQuery({
    queryKey: ["account", "rentals"],
    queryFn: () => getRentals({ perPage: 50 }),
  });

  const continueItems = (historyQuery.data?.data ?? []).filter(
    (h) => !h.completed,
  );
  const purchases = purchasesQuery.data?.data ?? [];
  const rentals = rentalsQuery.data?.data ?? [];

  const isLoading =
    historyQuery.isLoading ||
    purchasesQuery.isLoading ||
    rentalsQuery.isLoading;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "continue", label: "Continue Watching", count: continueItems.length },
    { key: "purchases", label: "Purchases", count: purchases.length },
    { key: "rentals", label: "Rentals", count: rentals.length },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold text-white">My Library</h1>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg border border-surface-800 bg-surface-900 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "bg-surface-800 text-white"
                : "text-surface-400 hover:text-surface-200",
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {tab.count}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {activeTab === "continue" &&
            (continueItems.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {continueItems.map((h) => {
                  const video = h.video;
                  const pct =
                    video?.duration && video.duration > 0
                      ? Math.min(
                          (h.progressSeconds / video.duration) * 100,
                          100,
                        )
                      : 0;
                  return (
                    <Link
                      key={h.id}
                      to={video ? `/watch/${video.slug}` : "#"}
                      className="group rounded-xl border border-surface-800 bg-surface-900 transition-all hover:border-surface-600"
                    >
                      <div className="relative aspect-video overflow-hidden rounded-t-xl bg-surface-800">
                        {video?.thumbnailUrl ? (
                          <img
                            src={video.thumbnailUrl}
                            alt={video.title}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Play className="h-8 w-8 text-surface-600" />
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-surface-700">
                          <div
                            className="h-full bg-primary-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <div className="p-3">
                        <h3 className="line-clamp-1 text-sm font-medium text-surface-200 group-hover:text-white">
                          {video?.title ?? "Video"}
                        </h3>
                        <p className="mt-0.5 text-xs text-surface-500">
                          {formatDate(h.lastWatchedAt)}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={Film}
                title="Nothing to continue"
                subtitle="Start watching something and pick up where you left off."
              />
            ))}

          {activeTab === "purchases" &&
            (purchases.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {purchases.map((p) => (
                  <Link
                    key={p.id}
                    to={p.video ? `/watch/${p.video.slug}` : "#"}
                    className="group rounded-xl border border-surface-800 bg-surface-900 transition-all hover:border-surface-600"
                  >
                    <div className="relative aspect-video overflow-hidden rounded-t-xl bg-surface-800">
                      {p.video?.thumbnailUrl ? (
                        <img
                          src={p.video.thumbnailUrl}
                          alt={p.video.title}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Play className="h-8 w-8 text-surface-600" />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="line-clamp-1 text-sm font-medium text-surface-200 group-hover:text-white">
                        {p.video?.title ?? "Video"}
                      </h3>
                      <p className="mt-0.5 text-xs text-surface-500">
                        Purchased {formatDate(p.createdAt)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Library}
                title="No purchases"
                subtitle="Videos you buy will appear here."
              />
            ))}

          {activeTab === "rentals" &&
            (rentals.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {rentals.map((r) => {
                  const active =
                    r.expiresAt && new Date(r.expiresAt) > new Date();
                  return (
                    <Link
                      key={r.id}
                      to={r.video && active ? `/watch/${r.video.slug}` : "#"}
                      className={cn(
                        "group rounded-xl border border-surface-800 bg-surface-900 transition-all",
                        active
                          ? "hover:border-surface-600"
                          : "opacity-60",
                      )}
                    >
                      <div className="relative aspect-video overflow-hidden rounded-t-xl bg-surface-800">
                        {r.video?.thumbnailUrl ? (
                          <img
                            src={r.video.thumbnailUrl}
                            alt={r.video.title}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Play className="h-8 w-8 text-surface-600" />
                          </div>
                        )}
                        <Badge
                          variant={active ? "success" : "secondary"}
                          className="absolute right-2 top-2 text-[10px]"
                        >
                          {active ? "Active" : "Expired"}
                        </Badge>
                      </div>
                      <div className="p-3">
                        <h3 className="line-clamp-1 text-sm font-medium text-surface-200 group-hover:text-white">
                          {r.video?.title ?? "Video"}
                        </h3>
                        <p className="mt-0.5 text-xs text-surface-500">
                          {active && r.expiresAt
                            ? `Expires ${formatDate(r.expiresAt)}`
                            : "Expired"}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={Library}
                title="No rentals"
                subtitle="Videos you rent will appear here."
              />
            ))}
        </>
      )}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Film;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="py-20 text-center">
      <Icon className="mx-auto mb-4 h-12 w-12 text-surface-600" />
      <p className="mb-2 text-lg font-medium text-white">{title}</p>
      <p className="mb-6 text-surface-400">{subtitle}</p>
      <Button asChild>
        <Link to="/explore">Browse Content</Link>
      </Button>
    </div>
  );
}
