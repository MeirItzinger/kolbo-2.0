import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Trash2,
  Tag,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useSignup } from "@/pages/auth/SignupPage";
import { useAuth } from "@/hooks/useAuth";
import { validateDiscount, createCheckoutMultiSubscription } from "@/api/stripe";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils";
import type { DiscountValidation } from "@/types";

function intervalLabel(bi: string) {
  return bi === "YEARLY" ? "yr" : "mo";
}

export function Review() {
  const {
    state,
    removePlan,
    removeBundle,
    prev,
  } = useSignup();
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [discountCode, setDiscountCode] = useState("");
  const [discount, setDiscount] = useState<DiscountValidation | null>(null);
  const [keepCard, setKeepCard] = useState(true);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const subtotal =
    state.selectedPlans.reduce(
      (sum, sp) => sum + Number(sp.variant.price),
      0,
    ) +
    state.selectedBundles.reduce((sum, sb) => sum + Number(sb.bundle.price), 0);

  const discountAmount = discount
    ? discount.discount?.discountType === "PERCENT"
      ? subtotal * (Number(discount.discount.amount) / 100)
      : Number(discount.discount?.amount ?? 0)
    : 0;

  const total = Math.max(0, subtotal - discountAmount);

  const validateMutation = useMutation({
    mutationFn: (code: string) =>
      validateDiscount({
        code,
        channelId: state.selectedPlans[0]?.channel.id ?? "",
      }),
    onSuccess: (data) => {
      if (data.valid) {
        setDiscount(data);
      }
    },
  });

  const signupMutation = useMutation({
    mutationFn: async () => {
      if (!state.account) throw new Error("Account data missing");
      await signup(state.account);

      if (state.selectedPlans.length > 0) {
        const items = state.selectedPlans.map((sp) => ({
          planId: sp.plan.id,
          variantId: sp.variant.id,
          channelId: sp.channel.id,
        }));

        const origin = window.location.origin;
        const result = await createCheckoutMultiSubscription({
          items,
          successUrl: `${origin}/checkout/success?type=subscription&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${origin}/signup`,
          discountCode: discount?.discount?.code,
        });

        if (result.url) {
          window.location.href = result.url;
          return;
        }
      }
    },
    onSuccess: () => {
      if (state.selectedPlans.length === 0) {
        navigate("/explore", { replace: true });
      }
    },
    onError: (err: any) => {
      setServerError(
        err?.response?.data?.message ?? "Signup failed. Please try again.",
      );
    },
  });

  const handleApplyDiscount = () => {
    if (!discountCode.trim()) return;
    validateMutation.mutate(discountCode.trim());
  };

  const handleComplete = () => {
    if (!agreeTerms) return;
    setServerError(null);
    signupMutation.mutate();
  };

  const hasItems =
    state.selectedPlans.length > 0 || state.selectedBundles.length > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="border-surface-800">
        <CardHeader>
          <CardTitle>Order Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Account info */}
          <div className="rounded-lg bg-surface-800/50 p-4">
            <h4 className="mb-1 text-sm font-medium text-surface-300">
              Account
            </h4>
            <p className="text-sm text-white">
              {state.account?.firstName} {state.account?.lastName}
            </p>
            <p className="text-sm text-surface-400">{state.account?.email}</p>
          </div>

          {/* Selected channels */}
          {state.selectedPlans.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-surface-300">
                Channel Subscriptions
              </h4>
              <div className="space-y-2">
                {state.selectedPlans.map((sp) => {
                  const streams = sp.variant.concurrencyTier.replace("STREAMS_", "");
                  const ads = sp.variant.adTier === "WITH_ADS" ? " · Ads" : "";
                  return (
                    <div
                      key={sp.plan.id}
                      className="flex items-center justify-between rounded-lg border border-surface-700 bg-surface-800 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-white">
                          {sp.channel.name}
                        </p>
                        <p className="text-xs text-surface-400">
                          {sp.plan.name} · {sp.variant.billingInterval === "YEARLY" ? "Yearly" : "Monthly"} · {streams} stream{streams !== "1" ? "s" : ""}{ads}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-white">
                          {formatCurrency(Number(sp.variant.price))}/{intervalLabel(sp.variant.billingInterval)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removePlan(sp.plan.id)}
                          className="text-surface-500 transition-colors hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selected bundles */}
          {state.selectedBundles.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-surface-300">
                Bundles
              </h4>
              <div className="space-y-2">
                {state.selectedBundles.map((sb) => (
                  <div
                    key={sb.bundle.id}
                    className="flex items-center justify-between rounded-lg border border-surface-700 bg-surface-800 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">
                        {sb.bundle.name}
                      </p>
                      <p className="text-xs text-surface-400">
                        {sb.channel.name} &middot; {sb.bundle.videoIds.length}{" "}
                        videos
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-white">
                        {formatCurrency(Number(sb.bundle.price))}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeBundle(sb.bundle.id)}
                        className="text-surface-500 transition-colors hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!hasItems && (
            <p className="py-4 text-center text-sm text-surface-500">
              No items selected. You can add channels after signing up.
            </p>
          )}

          {/* Discount code */}
          <div>
            <h4 className="mb-2 text-sm font-medium text-surface-300">
              Discount Code
            </h4>
            <div className="flex gap-2">
              <Input
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
                placeholder="Enter code"
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleApplyDiscount}
                disabled={validateMutation.isPending || !discountCode.trim()}
              >
                {validateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Tag className="h-4 w-4" />
                )}
                Apply
              </Button>
            </div>
            {discount && (
              <div className="mt-2 flex items-center gap-2 text-sm text-primary-400">
                <CheckCircle className="h-4 w-4" />
                {discount.discount?.discountType === "PERCENT"
                  ? `${discount.discount.amount}% off applied`
                  : `${formatCurrency(Number(discount.discount?.amount ?? 0))} off applied`}
              </div>
            )}
            {validateMutation.isError && (
              <p className="mt-2 text-xs text-destructive">
                Invalid discount code
              </p>
            )}
          </div>

          {/* Pricing breakdown */}
          <div className="space-y-2 border-t border-surface-800 pt-4">
            <div className="flex justify-between text-sm">
              <span className="text-surface-400">Subtotal</span>
              <span className="text-surface-200">
                {formatCurrency(subtotal)}
              </span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-primary-400">Discount</span>
                <span className="text-primary-400">
                  -{formatCurrency(discountAmount)}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-surface-800 pt-2 text-lg font-semibold">
              <span className="text-white">Total</span>
              <span className="text-white">{formatCurrency(total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Terms & payment */}
      <Card className="border-surface-800">
        <CardContent className="space-y-4 pt-6">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={keepCard}
              onChange={(e) => setKeepCard(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-surface-600 bg-surface-800 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-surface-300">
              Keep my card on file for future purchases
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-surface-600 bg-surface-800 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-surface-300">
              I agree to the{" "}
              <a
                href="#"
                className="text-primary-400 underline hover:text-primary-300"
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="#"
                className="text-primary-400 underline hover:text-primary-300"
              >
                Privacy Policy
              </a>
            </span>
          </label>
        </CardContent>
      </Card>

      {serverError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {serverError}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={prev}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <Button
          size="lg"
          onClick={handleComplete}
          disabled={!agreeTerms || signupMutation.isPending}
        >
          {signupMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {state.selectedPlans.length > 0
                ? "Redirecting to payment…"
                : "Creating account…"}
            </>
          ) : state.selectedPlans.length > 0 ? (
            "Sign Up & Pay"
          ) : (
            "Complete Signup"
          )}
        </Button>
      </div>
    </div>
  );
}
