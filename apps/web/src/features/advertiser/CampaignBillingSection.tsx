import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import {
  createAdvSetupIntent,
  listAdvPaymentMethods,
  completeAdvSetupIntent,
} from "@/api/advertiser";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { CreditCard } from "lucide-react";

/** Vite injects env at build time; strip spaces / wrapping quotes from .env */
function normalizePublishableKey(raw: unknown): string {
  if (raw == null) return "";
  return String(raw)
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .trim();
}

const pk = normalizePublishableKey(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
const stripePromise = pk ? loadStripe(pk) : null;

/** Soft check — only for warning text, never blocks the card form */
function publishableKeyLooksSuspicious(key: string): boolean {
  if (!key) return true;
  if (key.includes("xxxx")) return true;
  if (!key.startsWith("pk_test_") && !key.startsWith("pk_live_")) return true;
  return false;
}

function formatStripeError(err: {
  message?: string;
  code?: string;
  type?: string;
  decline_code?: string;
}): string {
  const parts = [err.message ?? "Card setup failed"].filter(Boolean);
  if (err.code) parts.push(`Code: ${err.code}`);
  if (err.decline_code) parts.push(`Decline: ${err.decline_code}`);
  if (err.type) parts.push(`Type: ${err.type}`);
  return parts.join(" · ");
}

const CARD_ELEMENT_STYLE = {
  base: {
    color: "#e2e2e2",
    fontSize: "16px",
    fontFamily: "system-ui, sans-serif",
    "::placeholder": { color: "#6b7280" },
    iconColor: "#a78bfa",
  },
  invalid: {
    color: "#ef4444",
    iconColor: "#ef4444",
  },
};

function SaveCardForm({
  clientSecret,
  onSaved,
}: {
  clientSecret: string;
  onSaved: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);

  const saveCard = async () => {
    if (!stripe || !elements) return;
    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    setError(null);
    setLoading(true);
    try {
      const { error: err, setupIntent } = await stripe.confirmCardSetup(
        clientSecret,
        { payment_method: { card: cardElement } },
      );
      if (err) {
        setError(formatStripeError(err));
        return;
      }
      if (setupIntent?.id) {
        await completeAdvSetupIntent(setupIntent.id);
      }
      onSaved();
    } catch (ex: unknown) {
      if (axios.isAxiosError(ex)) {
        const body = ex.response?.data as { message?: string } | undefined;
        setError(
          body?.message ??
            ex.message ??
            "Could not finalize card on your account (API error).",
        );
      } else {
        setError(
          ex instanceof Error ? ex.message : "Could not save payment method",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-surface-700 bg-surface-900 p-3">
        <CardElement
          options={{ style: CARD_ELEMENT_STYLE, hidePostalCode: true }}
          onChange={(e) => {
            setCardComplete(e.complete);
            if (e.error) setError(e.error.message);
            else setError(null);
          }}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        type="button"
        disabled={!stripe || loading || !cardComplete}
        onClick={saveCard}
      >
        {loading ? <Spinner size="sm" /> : "Save card"}
      </Button>
    </div>
  );
}

export function CampaignBillingSection({
  onReadyChange,
}: {
  onReadyChange: (ready: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data: methods, isLoading } = useQuery({
    queryKey: ["advertiser", "payment-methods"],
    queryFn: listAdvPaymentMethods,
  });

  const setupQuery = useQuery({
    queryKey: ["advertiser", "setup-intent", "campaign-create"],
    queryFn: createAdvSetupIntent,
    enabled: !isLoading && (methods?.length ?? 0) === 0,
    /* One client_secret per mount; refetching mid-flow breaks confirmCardSetup */
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const clientSecret = setupQuery.data?.clientSecret ?? null;

  useEffect(() => {
    if (isLoading) {
      onReadyChange(false);
      return;
    }
    onReadyChange((methods?.length ?? 0) > 0);
  }, [isLoading, methods, onReadyChange]);

  const handleSaved = () => {
    qc.invalidateQueries({ queryKey: ["advertiser", "payment-methods"] });
  };

  useEffect(() => {
    if (!pk) onReadyChange(false);
  }, [pk, onReadyChange]);

  /* Empty = Vite never injected VITE_* (wrong .env path or dev server not restarted) */
  if (!pk || !stripePromise) {
    return (
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-lg text-destructive">
            Stripe publishable key not loaded in the browser
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-surface-400">
          <p>
            Add this to{" "}
            <code className="text-surface-200">apps/web/.env</code> (same folder
            as <code className="text-surface-200">vite.config.ts</code>), not only
            in <code className="text-surface-200">apps/api/.env</code>:
          </p>
          <pre className="overflow-x-auto rounded-md bg-surface-950 p-3 text-xs text-surface-200">
            VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_FULL_KEY_HERE{"\n"}
            VITE_API_URL=http://localhost:4000/api
          </pre>
          <p className="text-xs text-surface-500">
            Then <strong className="text-surface-300">stop and restart</strong>{" "}
            the web dev server (
            <code className="text-surface-200">npm run dev:web</code> or{" "}
            <code className="text-surface-200">
              npm run dev --workspace=@kolbo/web
            </code>
            ), hard-refresh the page. Vite only reads{" "}
            <code className="text-surface-200">VITE_*</code> when the server
            starts.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if ((methods?.length ?? 0) > 0) {
    const m = methods![0];
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5 text-primary-400" />
            Billing
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-surface-300">
          <p>
            Card on file:{" "}
            <span className="font-medium text-white">
              {(m.brand ?? "Card").toUpperCase()} &middot;&middot;&middot;&middot; {m.last4}
            </span>
          </p>
          <p className="mt-2 text-xs text-surface-500">
            Your card will be charged per ad view while campaigns run (see admin
            price per view). You can add or replace cards from account settings
            later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CreditCard className="h-5 w-5 text-primary-400" />
          Payment method
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-surface-400">
          Enter your card below. A payment method is required before you can
          create a campaign.
        </p>
        {publishableKeyLooksSuspicious(pk) && (
          <p className="rounded-md border border-amber-600/40 bg-amber-950/30 p-3 text-xs text-amber-200/90">
            Your <code className="text-amber-100">VITE_STRIPE_PUBLISHABLE_KEY</code>{" "}
            still looks like a placeholder or wrong format. Use the full{" "}
            <code className="text-amber-100">pk_test_…</code> from Stripe (same
            account as the API secret key).
          </p>
        )}
        {setupQuery.isError && (
          <p className="text-sm text-destructive">
            Could not start card setup.{" "}
            {axios.isAxiosError(setupQuery.error)
              ? (setupQuery.error.response?.data as { message?: string })
                  ?.message ??
                setupQuery.error.message
              : setupQuery.error instanceof Error
                ? setupQuery.error.message
                : "Try refreshing."}
          </p>
        )}
        {setupQuery.isLoading || !clientSecret ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : (
          <Elements
            stripe={stripePromise}
            options={{ appearance: { theme: "night" } }}
          >
            <SaveCardForm clientSecret={clientSecret} onSaved={handleSaved} />
          </Elements>
        )}
      </CardContent>
    </Card>
  );
}
