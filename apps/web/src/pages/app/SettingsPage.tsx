import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Settings as SettingsIcon, Lock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { Spinner } from "@/components/ui/Spinner";
import {
  getAccountSettings,
  updateAccountSettings,
  type AccountSettings,
} from "@/api/settings";

const SETTINGS_KEY = ["account", "settings"] as const;

export default function SettingsPage() {
  const qc = useQueryClient();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const { data, isLoading } = useQuery<AccountSettings>({
    queryKey: SETTINGS_KEY,
    queryFn: getAccountSettings,
  });

  const mutation = useMutation({
    mutationFn: (patch: Partial<AccountSettings>) => updateAccountSettings(patch),
    onSuccess: (next) => {
      qc.setQueryData(SETTINGS_KEY, next);
      qc.invalidateQueries({ queryKey: ["auth", "me"] });
      setSavedAt(Date.now());
    },
  });

  useEffect(() => {
    if (!savedAt) return;
    const id = window.setTimeout(() => setSavedAt(null), 2500);
    return () => window.clearTimeout(id);
  }, [savedAt]);

  const requirePinForPurchases = data?.requirePinForPurchases ?? false;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        {savedAt && (
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Saved
          </span>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-primary-400" />
            Household preferences
          </CardTitle>
          <CardDescription>
            Control how purchases and subscriptions are protected across
            everyone using this account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Spinner />
          ) : (
            <div className="flex items-start justify-between gap-4 rounded-lg border border-surface-800 bg-surface-900/60 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-800">
                  <Lock className="h-4 w-4 text-primary-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-white">
                    Require a PIN before purchases
                  </p>
                  <p className="mt-1 text-sm text-surface-400">
                    When enabled, anyone using this account must enter your
                    parental PIN before completing a subscription, rental, or
                    purchase. Set your PIN from the Security settings page.
                  </p>
                </div>
              </div>
              <Switch
                aria-label="Require a PIN before purchases"
                checked={requirePinForPurchases}
                disabled={mutation.isPending}
                onCheckedChange={(next) =>
                  mutation.mutate({ requirePinForPurchases: next })
                }
              />
            </div>
          )}

          {mutation.isError && (
            <p className="mt-3 text-sm text-red-400">
              Couldn't save that change. Please try again.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
