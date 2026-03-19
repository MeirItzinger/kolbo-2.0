import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Button } from "@/components/ui/Button";

export default function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const type = searchParams.get("type") ?? "subscription";
  const sessionId = searchParams.get("session_id");

  const { isLoading } = useQuery({
    queryKey: ["verify-session", sessionId],
    queryFn: async () => {
      const { data } = await api.get(`/stripe/session/${sessionId}`);
      return data;
    },
    enabled: !!sessionId,
    retry: 2,
    staleTime: Infinity,
  });

  const messages: Record<string, { title: string; subtitle: string }> = {
    subscription: {
      title: "Subscription Activated!",
      subtitle: "Your subscription is now active. Start watching your favorite content.",
    },
    purchase: {
      title: "Purchase Complete!",
      subtitle: "The video has been added to your library. You can watch it anytime.",
    },
    rental: {
      title: "Rental Confirmed!",
      subtitle: "Your rental is now active. Enjoy watching!",
    },
    bundle: {
      title: "Bundle Purchased!",
      subtitle: "All videos in the bundle have been added to your library.",
    },
  };

  const msg = messages[type] ?? messages.subscription;

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary-400" />
        <p className="mt-4 text-surface-400">Confirming your payment…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-success/20 p-4">
            <CheckCircle className="h-12 w-12 text-success" />
          </div>
        </div>
        <h1 className="mb-3 text-3xl font-bold text-white">{msg.title}</h1>
        <p className="mb-8 text-surface-400">{msg.subtitle}</p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Button size="lg" asChild>
            <Link to="/library">Go to Library</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/explore">Explore More</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
