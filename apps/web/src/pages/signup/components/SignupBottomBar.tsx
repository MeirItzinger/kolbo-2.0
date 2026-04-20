import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils";
import type { SelectedBundle, SelectedPlan } from "@/pages/auth/SignupPage";
import { monthlyEquivalent } from "../utils/variants";

interface Props {
  plans: SelectedPlan[];
  bundles: SelectedBundle[];
  onBack: () => void;
  onContinue: () => void;
}

export function SignupBottomBar({
  plans,
  bundles,
  onBack,
  onContinue,
}: Props) {
  const itemCount = plans.length + bundles.length;
  const subscriptionMonthly = plans.reduce(
    (s, sp) => s + monthlyEquivalent(sp.variant),
    0,
  );
  const oneTime = bundles.reduce((s, sb) => s + Number(sb.bundle.price), 0);
  const hasSubs = plans.length > 0;
  const hasBundles = bundles.length > 0;

  return (
    <div className="sticky bottom-0 z-30 -mx-4 mt-6 border-t border-surface-800 bg-surface-950/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </Button>

        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-xs text-surface-400">
            {itemCount === 0
              ? "Nothing selected"
              : `${itemCount} item${itemCount === 1 ? "" : "s"} selected`}
          </p>
          {itemCount > 0 && (
            <p className="truncate text-sm font-semibold text-white tabular-nums">
              {hasSubs && (
                <span>
                  {formatCurrency(subscriptionMonthly)}
                  <span className="ml-0.5 text-xs font-normal text-surface-400">
                    /mo
                  </span>
                </span>
              )}
              {hasSubs && hasBundles && (
                <span className="mx-2 text-surface-600">+</span>
              )}
              {hasBundles && (
                <span>
                  {formatCurrency(oneTime)}
                  <span className="ml-0.5 text-xs font-normal text-surface-400">
                    one-time
                  </span>
                </span>
              )}
            </p>
          )}
        </div>

        <Button
          type="button"
          onClick={onContinue}
          disabled={itemCount === 0}
          className="shrink-0"
        >
          <span className="hidden sm:inline">Review order</span>
          <span className="sm:hidden">Review</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
