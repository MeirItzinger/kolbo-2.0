import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Film,
  MapPin,
  Save,
  DollarSign,
} from "lucide-react";
import {
  adminGetAdvertiserPlatformSettings,
  adminUpdateAdvertiserPlatformSettings,
  adminListAdvertisersWithCampaigns,
  adminPatchAdCampaign,
} from "@/api/adminAdvertisers";
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
import type { AdvertiserWithCampaigns, AdCampaign, CampaignStatus } from "@/types";

const statusVariant: Record<
  CampaignStatus,
  "default" | "success" | "warning" | "secondary" | "destructive" | "outline"
> = {
  DRAFT: "secondary",
  PENDING_REVIEW: "warning",
  APPROVED: "success",
  ACTIVE: "success",
  PAUSED: "outline",
  REJECTED: "destructive",
  COMPLETED: "secondary",
  CANCELLED: "secondary",
};

function numOrStr(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function formatPpv(
  override: string | number | null | undefined,
  defaultUsd: string,
): string {
  if (override !== null && override !== undefined && override !== "") {
    const n = Number(override);
    if (!Number.isNaN(n)) return `$${n.toFixed(6).replace(/\.?0+$/, "")} / view`;
  }
  const d = Number(defaultUsd);
  if (Number.isNaN(d)) return `${defaultUsd} / view (default)`;
  return `$${d.toFixed(6).replace(/\.?0+$/, "")} / view (default)`;
}

export default function AdvertisersPage() {
  const qc = useQueryClient();
  const [expandedAdvertiserId, setExpandedAdvertiserId] = useState<string | null>(
    null,
  );
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(
    null,
  );
  const [defaultPpvInput, setDefaultPpvInput] = useState("");
  const [campaignPpvDrafts, setCampaignPpvDrafts] = useState<
    Record<string, string>
  >({});

  const settingsQuery = useQuery({
    queryKey: ["admin", "advertisers", "settings"],
    queryFn: adminGetAdvertiserPlatformSettings,
  });

  const advertisersQuery = useQuery({
    queryKey: ["admin", "advertisers", "list"],
    queryFn: adminListAdvertisersWithCampaigns,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: adminUpdateAdvertiserPlatformSettings,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "advertisers", "settings"] });
    },
  });

  const patchCampaignMutation = useMutation({
    mutationFn: ({
      id,
      pricePerViewUsd,
    }: {
      id: string;
      pricePerViewUsd: string | number | null;
    }) => adminPatchAdCampaign(id, { pricePerViewUsd }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "advertisers", "list"] });
      qc.invalidateQueries({ queryKey: ["admin", "ad-campaigns"] });
    },
  });

  const defaultUsd = settingsQuery.data?.defaultPricePerViewUsd ?? "0.01";

  useEffect(() => {
    if (settingsQuery.data?.defaultPricePerViewUsd != null) {
      setDefaultPpvInput(String(settingsQuery.data.defaultPricePerViewUsd));
    }
  }, [settingsQuery.data?.defaultPricePerViewUsd]);

  const handleSaveDefault = () => {
    const v = defaultPpvInput.trim();
    if (!v) return;
    updateSettingsMutation.mutate({ defaultPricePerViewUsd: v });
  };

  const advertisers = advertisersQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Advertisers</h1>
        <p className="mt-1 text-sm text-surface-400">
          Accounts that run ad campaigns, full campaign details, and price per
          view (platform default or per-campaign override).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5 text-primary-400" />
            Default price per view (USD)
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          {settingsQuery.isLoading ? (
            <Spinner />
          ) : (
            <>
              <div className="min-w-[200px] flex-1">
                <label className="mb-1 block text-xs font-medium text-surface-400">
                  Applied when a campaign has no override
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.01"
                  value={defaultPpvInput}
                  onChange={(e) => setDefaultPpvInput(e.target.value)}
                />
              </div>
              <Button
                type="button"
                onClick={handleSaveDefault}
                disabled={updateSettingsMutation.isPending}
              >
                {updateSettingsMutation.isPending ? (
                  <Spinner size="sm" />
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save default
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {advertisersQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : advertisers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-surface-500">
            No advertiser accounts yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {advertisers.map((adv: AdvertiserWithCampaigns) => {
            const open = expandedAdvertiserId === adv.id;
            const campaignCount =
              adv._count?.campaigns ?? adv.campaigns?.length ?? 0;
            return (
              <Card key={adv.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-5 py-4 text-left"
                  onClick={() =>
                    setExpandedAdvertiserId(open ? null : adv.id)
                  }
                >
                  <div className="flex items-center gap-3">
                    {open ? (
                      <ChevronDown className="h-4 w-4 text-surface-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-surface-400" />
                    )}
                    <Building2 className="h-5 w-5 text-surface-500" />
                    <div>
                      <p className="font-semibold text-white">
                        {adv.companyName}
                      </p>
                      <p className="text-sm text-surface-400">
                        {adv.contactName} · {adv.email}
                        {adv.phone ? ` · ${adv.phone}` : ""}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {campaignCount} campaign{campaignCount !== 1 ? "s" : ""}
                  </Badge>
                </button>

                {open && (
                  <div className="border-t border-surface-800 px-5 pb-4 pt-2">
                    <dl className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-surface-500">Advertiser ID</dt>
                        <dd className="font-mono text-xs text-surface-300">
                          {adv.id}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-surface-500">Stripe customer</dt>
                        <dd className="text-surface-300">
                          {adv.stripeCustomerId ?? "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-surface-500">Joined</dt>
                        <dd className="text-surface-300">
                          {new Date(adv.createdAt).toLocaleString()}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-surface-500">Active</dt>
                        <dd className="text-surface-300">
                          {adv.isActive ? "Yes" : "No"}
                        </dd>
                      </div>
                    </dl>

                    <h4 className="mb-2 text-sm font-semibold text-white">
                      Campaigns
                    </h4>
                    <div className="space-y-2">
                      {(adv.campaigns ?? []).map((c: AdCampaign) => {
                        const cOpen = expandedCampaignId === c.id;
                        const draftKey = c.id;
                        const draft =
                          campaignPpvDrafts[draftKey] ??
                          numOrStr(c.pricePerViewUsd);
                        return (
                          <div
                            key={c.id}
                            className="rounded-lg border border-surface-800 bg-surface-900/50"
                          >
                            <button
                              type="button"
                              className="flex w-full items-center justify-between px-4 py-3 text-left"
                              onClick={() =>
                                setExpandedCampaignId(cOpen ? null : c.id)
                              }
                            >
                              <div className="flex items-center gap-2">
                                {cOpen ? (
                                  <ChevronDown className="h-4 w-4 shrink-0 text-surface-500" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 shrink-0 text-surface-500" />
                                )}
                                <span className="font-medium text-white">
                                  {c.name}
                                </span>
                              </div>
                              <Badge variant={statusVariant[c.status]}>
                                {c.status.replace(/_/g, " ")}
                              </Badge>
                            </button>

                            {cOpen && (
                              <div className="space-y-3 border-t border-surface-800 px-4 py-3 text-sm">
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                  <div>
                                    <span className="text-surface-500">
                                      Total budget
                                    </span>
                                    <p className="font-medium text-white">
                                      {formatCurrency(Number(c.totalBudget))}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-surface-500">
                                      Daily max
                                    </span>
                                    <p className="font-medium text-white">
                                      {formatCurrency(
                                        Number(c.dailyMaxSpend),
                                      )}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-surface-500">
                                      Total spent
                                    </span>
                                    <p className="font-medium text-white">
                                      {formatCurrency(Number(c.totalSpent))}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-surface-500">
                                      Age range
                                    </span>
                                    <p className="text-white">
                                      {c.targetAgeMin ?? "Any"} –{" "}
                                      {c.targetAgeMax ?? "Any"}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-surface-500">
                                      Start / end
                                    </span>
                                    <p className="text-white">
                                      {c.startDate
                                        ? new Date(
                                            c.startDate,
                                          ).toLocaleDateString()
                                        : "—"}{" "}
                                      →{" "}
                                      {c.endDate
                                        ? new Date(
                                            c.endDate,
                                          ).toLocaleDateString()
                                        : "—"}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-surface-500">
                                      Campaign ID
                                    </span>
                                    <p className="break-all font-mono text-xs text-surface-400">
                                      {c.id}
                                    </p>
                                  </div>
                                </div>

                                {c.rejectionReason && (
                                  <p className="text-destructive">
                                    Rejection: {c.rejectionReason}
                                  </p>
                                )}

                                <div className="rounded-md border border-surface-700 p-3">
                                  <p className="mb-2 text-xs font-medium text-surface-400">
                                    Price per view (USD)
                                  </p>
                                  <p className="mb-2 text-xs text-surface-500">
                                    Effective:{" "}
                                    <span className="text-surface-200">
                                      {formatPpv(
                                        c.pricePerViewUsd,
                                        defaultUsd,
                                      )}
                                    </span>
                                  </p>
                                  <div className="flex flex-wrap items-end gap-2">
                                    <Input
                                      className="max-w-[220px]"
                                      placeholder="Override (empty = use default)"
                                      value={draft}
                                      onChange={(e) =>
                                        setCampaignPpvDrafts((prev) => ({
                                          ...prev,
                                          [draftKey]: e.target.value,
                                        }))
                                      }
                                    />
                                    <Button
                                      type="button"
                                      size="sm"
                                      disabled={patchCampaignMutation.isPending}
                                      onClick={() => {
                                        const raw = draft.trim();
                                        patchCampaignMutation.mutate({
                                          id: c.id,
                                          pricePerViewUsd:
                                            raw === "" ? null : raw,
                                        });
                                      }}
                                    >
                                      Save rate
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        patchCampaignMutation.mutate({
                                          id: c.id,
                                          pricePerViewUsd: null,
                                        });
                                        setCampaignPpvDrafts((prev) => {
                                          const next = { ...prev };
                                          delete next[draftKey];
                                          return next;
                                        });
                                      }}
                                    >
                                      Use default
                                    </Button>
                                  </div>
                                </div>

                                <div>
                                  <p className="mb-1 flex items-center gap-1 text-xs font-medium text-surface-400">
                                    <MapPin className="h-3 w-3" /> Geo targets
                                  </p>
                                  {c.geoTargets && c.geoTargets.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {c.geoTargets.map((g) => (
                                        <Badge
                                          key={g.id}
                                          variant="outline"
                                          className="text-xs"
                                        >
                                          {g.type}: {g.value}
                                        </Badge>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-surface-500">
                                      None set
                                    </p>
                                  )}
                                </div>

                                <div>
                                  <p className="mb-1 flex items-center gap-1 text-xs font-medium text-surface-400">
                                    <Film className="h-3 w-3" /> Creatives
                                  </p>
                                  {c.creatives && c.creatives.length > 0 ? (
                                    <ul className="space-y-1 text-surface-300">
                                      {c.creatives.map((cr) => (
                                        <li
                                          key={cr.id}
                                          className="flex flex-wrap items-center gap-2 text-xs"
                                        >
                                          <span>
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
                                            <span className="text-surface-500">
                                              playback: {cr.muxPlaybackId}
                                            </span>
                                          )}
                                          {cr.durationSeconds != null && (
                                            <span className="text-surface-500">
                                              {Math.floor(
                                                cr.durationSeconds / 60,
                                              )}
                                              :
                                              {String(
                                                cr.durationSeconds % 60,
                                              ).padStart(2, "0")}
                                            </span>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="text-surface-500">None</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
