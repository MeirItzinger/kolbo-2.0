import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, Film, Clock, ChevronLeft } from "lucide-react";
import { getPurchases, getRentals } from "@/api/account";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function PurchasesPage() {
  const purchasesQuery = useQuery({
    queryKey: ["account", "purchases"],
    queryFn: () => getPurchases({ perPage: 50 }),
  });

  const rentalsQuery = useQuery({
    queryKey: ["account", "rentals"],
    queryFn: () => getRentals({ perPage: 50 }),
  });

  const purchases = purchasesQuery.data?.data ?? [];
  const rentals = rentalsQuery.data?.data ?? [];
  const isLoading = purchasesQuery.isLoading || rentalsQuery.isLoading;

  const isRentalActive = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) > new Date();
  };

  if (isLoading) {
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
        <h1 className="text-2xl font-bold text-white">Purchases & Rentals</h1>
      </div>

      {/* Purchases */}
      <section className="mb-10">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
          <ShoppingBag className="h-5 w-5 text-primary-400" />
          Purchases
        </h2>
        {purchases.length > 0 ? (
          <div className="space-y-3">
            {purchases.map((p) => (
              <Card key={p.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-16 items-center justify-center rounded-lg bg-surface-800">
                      <Film className="h-6 w-6 text-surface-500" />
                    </div>
                    <div>
                      <p className="font-medium text-white">
                        {p.video?.title ?? "Video"}
                      </p>
                      <p className="text-xs text-surface-400">
                        Purchased {formatDate(p.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="success">Owned</Badge>
                    {p.video && (
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/watch/${p.video.slug}`}>Watch</Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-surface-600" />
              <p className="text-surface-400">No purchases yet.</p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Rentals */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
          <Clock className="h-5 w-5 text-primary-400" />
          Rentals
        </h2>
        {rentals.length > 0 ? (
          <div className="space-y-3">
            {rentals.map((r) => {
              const active = isRentalActive(r.expiresAt);
              return (
                <Card key={r.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-16 items-center justify-center rounded-lg bg-surface-800">
                        <Film className="h-6 w-6 text-surface-500" />
                      </div>
                      <div>
                        <p className="font-medium text-white">
                          {r.video?.title ?? "Video"}
                        </p>
                        <p className="text-xs text-surface-400">
                          {active && r.expiresAt
                            ? `Expires ${formatDate(r.expiresAt)}`
                            : "Expired"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={active ? "success" : "secondary"}>
                        {active ? "Active" : "Expired"}
                      </Badge>
                      {active && r.video && (
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/watch/${r.video.slug}`}>Watch</Link>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <Clock className="mx-auto mb-3 h-10 w-10 text-surface-600" />
              <p className="text-surface-400">No rentals yet.</p>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
