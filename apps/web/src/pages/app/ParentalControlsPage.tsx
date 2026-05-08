import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CheckCircle2, Lock, ShieldCheck, ChevronDown } from "lucide-react";
import {
  clearGrace,
  getParentalPinStatus,
  verifyParentalPin,
} from "@/api/pin";
import { PinPrompt } from "@/components/pin/PinPrompt";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { Spinner } from "@/components/ui/Spinner";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { listProfiles } from "@/api/profiles";
import {
  getParentalControls,
  MATURITY_RATINGS,
  updateParentalControls,
  type MaturityRating,
  type ParentalControls,
} from "@/api/parentalControls";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import type { Profile } from "@/types";

const PROFILES_KEY = ["profiles", "list"] as const;

function controlsKey(profileId: string) {
  return ["profiles", profileId, "parental-controls"] as const;
}

export default function ParentalControlsPage() {
  const qc = useQueryClient();
  const { activeProfile, setActiveProfile } = useActiveProfile();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    () => activeProfile?.id ?? null,
  );
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pinPromptOpen, setPinPromptOpen] = useState(false);
  // Parental controls are sensitive: never auto-unlock from a cached grace
  // token (which may have come from a purchase flow or a prior visit). The
  // editor only opens after an explicit PIN entry on this page, and re-locks
  // when the user leaves the tab or hits "Lock now".
  const [unlockedAt, setUnlockedAt] = useState<number | null>(null);

  const pinStatusQuery = useQuery({
    queryKey: ["account", "parental-pin", "status"],
    queryFn: getParentalPinStatus,
  });
  const pinIsSet = !!pinStatusQuery.data?.isSet;
  const pinStatusLoaded = pinStatusQuery.isSuccess;
  // Default to LOCKED until we've confirmed there's no PIN set. This avoids
  // the brief loading window flashing the editor open.
  const isLocked = !pinStatusLoaded || (pinIsSet && unlockedAt === null);

  function lockNow() {
    setUnlockedAt(null);
    clearGrace("parental");
  }

  useEffect(() => {
    if (pinStatusLoaded && !pinIsSet) {
      setUnlockedAt((v) => v ?? Date.now());
    }
  }, [pinStatusLoaded, pinIsSet]);

  useEffect(() => {
    if (!pinIsSet || unlockedAt === null) return;
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        setUnlockedAt(null);
        clearGrace("parental");
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [pinIsSet, unlockedAt]);

  useEffect(() => {
    return () => {
      if (pinIsSet) clearGrace("parental");
    };
  }, [pinIsSet]);

  const { data: profiles = [], isLoading: profilesLoading } = useQuery<
    Profile[]
  >({
    queryKey: PROFILES_KEY,
    queryFn: listProfiles,
  });

  useEffect(() => {
    if (selectedProfileId) return;
    if (activeProfile && profiles.some((p) => p.id === activeProfile.id)) {
      setSelectedProfileId(activeProfile.id);
      return;
    }
    if (profiles.length > 0) {
      setSelectedProfileId(profiles[0].id);
    }
  }, [profiles, selectedProfileId, activeProfile]);

  const profile = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId],
  );

  const controlsQuery = useQuery<ParentalControls>({
    queryKey: selectedProfileId ? controlsKey(selectedProfileId) : ["controls", "noop"],
    queryFn: () => getParentalControls(selectedProfileId!),
    enabled: !!selectedProfileId,
  });

  const mutation = useMutation({
    mutationFn: (patch: Partial<ParentalControls>) =>
      updateParentalControls(selectedProfileId!, patch),
    onSuccess: (next) => {
      if (!selectedProfileId) return;
      qc.setQueryData(controlsKey(selectedProfileId), next);
      setSavedAt(Date.now());
    },
  });

  useEffect(() => {
    if (!savedAt) return;
    const id = window.setTimeout(() => setSavedAt(null), 2500);
    return () => window.clearTimeout(id);
  }, [savedAt]);

  const controls = controlsQuery.data;

  function patch(p: Partial<ParentalControls>) {
    if (!selectedProfileId) return;
    mutation.mutate(p);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Parental controls</h1>
          <p className="mt-1 text-sm text-surface-400">
            Limit what each profile can watch and purchase. Changes save
            automatically.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {savedAt && (
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Saved
            </span>
          )}
          {pinIsSet && unlockedAt !== null && (
            <Button
              size="sm"
              variant="outline"
              onClick={lockNow}
              className="gap-1.5"
            >
              <Lock className="h-3.5 w-3.5" />
              Lock now
            </Button>
          )}
        </div>
      </div>

      {pinIsSet && unlockedAt !== null && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-700/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-100">
          <ShieldCheck className="h-3.5 w-3.5" />
          Unlocked for this session — re-locks automatically when you leave or
          switch tabs.
        </div>
      )}

      {isLocked ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-600/15">
              <Lock className="h-6 w-6 text-primary-400" />
            </div>
            <div>
              <p className="text-base font-medium text-white">
                Parental controls are PIN-protected
              </p>
              <p className="mt-1 text-sm text-surface-400">
                Enter your parental PIN to make changes.
              </p>
            </div>
            <Button onClick={() => setPinPromptOpen(true)}>
              Enter PIN
            </Button>
          </CardContent>
        </Card>
      ) : profilesLoading ? (
        <Spinner />
      ) : profiles.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <p className="text-surface-400">
              You haven't created any profiles yet.
            </p>
            <Button asChild>
              <Link to="/account/profiles">Create a profile</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="mb-6">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-surface-500">
                  Editing controls for
                </p>
                <p className="text-base font-medium text-white">
                  {profile?.name ?? "—"}
                  {profile && activeProfile?.id === profile.id && (
                    <span className="ml-2 rounded bg-primary-600/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-300">
                      Currently watching
                    </span>
                  )}
                </p>
              </div>
              <div className="relative">
                <select
                  value={selectedProfileId ?? ""}
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                  className="appearance-none rounded-md border border-surface-700 bg-surface-900 py-2 pl-3 pr-9 text-sm text-white focus:border-primary-500 focus:outline-none"
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.isKidsProfile ? " (Kids)" : ""}
                      {activeProfile?.id === p.id ? " · watching" : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
              </div>
            </CardContent>
          </Card>

          {profile && activeProfile && profile.id !== activeProfile.id && (
            <Card className="mb-6 border-amber-700/40 bg-amber-500/5">
              <CardContent className="flex flex-col gap-3 py-3 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Heads up — you're editing{" "}
                  <span className="font-semibold">{profile.name}</span> but
                  you're currently watching as{" "}
                  <span className="font-semibold">{activeProfile.name}</span>.
                  Limits set here only apply once{" "}
                  <span className="font-semibold">{profile.name}</span> is the
                  active profile.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveProfile(profile)}
                >
                  Watch as {profile.name}
                </Button>
              </CardContent>
            </Card>
          )}

          {controlsQuery.isLoading || !controls ? (
            <Spinner />
          ) : (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary-400" />
                    Maturity
                  </CardTitle>
                  <CardDescription>
                    The highest rating this profile is allowed to watch.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {MATURITY_RATINGS.map((opt) => {
                      const active = controls.maxMaturityRating === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            patch({ maxMaturityRating: opt.value as MaturityRating })
                          }
                          className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                            active
                              ? "border-primary-500 bg-primary-600/10 text-white"
                              : "border-surface-800 bg-surface-900 text-surface-300 hover:border-surface-600"
                          }`}
                        >
                          <p className="font-semibold">{opt.value}</p>
                          <p className="mt-0.5 text-xs text-surface-400">
                            {opt.label.split("—")[1]?.trim()}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Daily watch-time limit</CardTitle>
                  <CardDescription>
                    Cap how many minutes per day this profile can watch. Leave
                    blank for unlimited.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min={0}
                      max={24 * 60}
                      value={controls.dailyTimeLimitMinutes ?? ""}
                      placeholder="Unlimited"
                      onChange={(e) => {
                        const v = e.target.value;
                        patch({
                          dailyTimeLimitMinutes:
                            v === "" ? null : Math.max(0, Number(v)),
                        });
                      }}
                      className="w-32"
                    />
                    <span className="text-sm text-surface-400">minutes / day</span>
                  </div>
                  {selectedProfileId && (
                    <TodaysWatchUsage
                      profileId={selectedProfileId}
                      limitMinutes={controls.dailyTimeLimitMinutes ?? null}
                    />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Allowed hours</CardTitle>
                  <CardDescription>
                    Restrict viewing to a window during the day (24-hour clock).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-surface-300">
                      <Switch
                        checked={controls.allowedHours !== null}
                        onCheckedChange={(on) =>
                          patch({
                            allowedHours: on ? { start: 7, end: 21 } : null,
                          })
                        }
                      />
                      Restrict
                    </label>
                    {controls.allowedHours && (
                      <>
                        <Input
                          type="number"
                          min={0}
                          max={24}
                          value={controls.allowedHours.start}
                          onChange={(e) =>
                            patch({
                              allowedHours: {
                                start: Math.min(
                                  23,
                                  Math.max(0, Number(e.target.value) || 0),
                                ),
                                end: controls.allowedHours!.end,
                              },
                            })
                          }
                          className="w-24"
                        />
                        <span className="text-sm text-surface-400">to</span>
                        <Input
                          type="number"
                          min={1}
                          max={24}
                          value={controls.allowedHours.end}
                          onChange={(e) =>
                            patch({
                              allowedHours: {
                                start: controls.allowedHours!.start,
                                end: Math.min(
                                  24,
                                  Math.max(1, Number(e.target.value) || 1),
                                ),
                              },
                            })
                          }
                          className="w-24"
                        />
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Purchases</CardTitle>
                  <CardDescription>
                    Whether this profile can buy or rent on its own. Household
                    purchase protection still applies if enabled in settings.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <label className="flex items-center justify-between">
                    <span className="text-sm text-surface-200">
                      Allow purchases
                    </span>
                    <Switch
                      checked={controls.allowPurchases}
                      onCheckedChange={(v) => patch({ allowPurchases: v })}
                    />
                  </label>
                </CardContent>
              </Card>

              {mutation.isError && (
                <p className="text-sm text-red-400">
                  Couldn't save that change. Please try again.
                </p>
              )}
            </div>
          )}
        </>
      )}

      <PinPrompt
        open={pinPromptOpen}
        title="Enter parental PIN"
        description="Confirm your PIN to edit parental controls."
        onClose={() => setPinPromptOpen(false)}
        onVerify={async (pin) => {
          await verifyParentalPin(pin);
          setUnlockedAt(Date.now());
          setPinPromptOpen(false);
          return true;
        }}
        footer={
          <Link
            to="/account/security?reset=parental"
            className="text-xs text-surface-400 hover:text-white"
          >
            Forgot PIN?
          </Link>
        }
      />
    </div>
  );
}

function TodaysWatchUsage({
  profileId,
  limitMinutes,
}: {
  profileId: string;
  limitMinutes: number | null;
}) {
  const [, force] = useState(0);
  const key = useMemo(() => {
    const d = new Date();
    return `kolbo_watch_seconds_${profileId}_${d.getFullYear()}-${String(
      d.getMonth() + 1,
    ).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, [profileId]);

  const usedSeconds = (() => {
    if (typeof localStorage === "undefined") return 0;
    const raw = localStorage.getItem(key);
    const n = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  })();
  const usedMinutes = Math.floor(usedSeconds / 60);
  const usedSecondsRem = usedSeconds % 60;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-surface-800 bg-surface-900/40 px-3 py-2">
      <span className="text-sm text-surface-300">
        Used today on this device:{" "}
        <span className="font-semibold text-white">
          {usedMinutes}m {usedSecondsRem}s
        </span>
        {limitMinutes != null && limitMinutes > 0 && (
          <span className="text-surface-400"> / {limitMinutes}m</span>
        )}
      </span>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          if (typeof localStorage !== "undefined")
            localStorage.removeItem(key);
          force((n) => n + 1);
        }}
      >
        Reset today
      </Button>
    </div>
  );
}
