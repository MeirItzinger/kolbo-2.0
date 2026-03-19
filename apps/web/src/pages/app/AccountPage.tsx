import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  User,
  CreditCard,
  Tv,
  History,
  Monitor,
  ShoppingBag,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getSubscriptions } from "@/api/account";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { formatDate } from "@/lib/utils";

const quickLinks = [
  {
    to: "/account/subscriptions",
    icon: Tv,
    label: "Subscriptions",
    description: "Manage your channel subscriptions",
  },
  {
    to: "/account/purchases",
    icon: ShoppingBag,
    label: "Purchases & Rentals",
    description: "View your purchases and active rentals",
  },
  {
    to: "/account/history",
    icon: History,
    label: "Watch History",
    description: "See what you've been watching",
  },
  {
    to: "/account/devices",
    icon: Monitor,
    label: "Devices",
    description: "Manage your registered devices",
  },
] as const;

export default function AccountPage() {
  const { user } = useAuth();

  const subsQuery = useQuery({
    queryKey: ["account", "subscriptions"],
    queryFn: getSubscriptions,
  });

  const activeSubs = (subsQuery.data ?? []).filter(
    (s) => s.status === "active" || s.status === "trialing",
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-2xl font-bold text-white">Account</h1>

      {/* User info */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary-400" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          {user ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-surface-400">Name</span>
                <span className="text-sm text-white">
                  {user.firstName} {user.lastName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-surface-400">Email</span>
                <span className="text-sm text-white">{user.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-surface-400">Member since</span>
                <span className="text-sm text-white">
                  {formatDate(user.createdAt)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-surface-400">Email verified</span>
                <Badge variant={user.emailVerified ? "success" : "warning"}>
                  {user.emailVerified ? "Verified" : "Unverified"}
                </Badge>
              </div>
            </div>
          ) : (
            <Spinner />
          )}
        </CardContent>
      </Card>

      {/* Subscription summary */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary-400" />
            Subscription Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subsQuery.isLoading ? (
            <Spinner />
          ) : activeSubs.length > 0 ? (
            <div className="space-y-3">
              {activeSubs.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between rounded-lg border border-surface-800 bg-surface-800/50 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-white">
                      {sub.channel?.name ?? "Channel"}
                    </p>
                    <p className="text-xs text-surface-400">
                      {sub.plan?.name ?? "Plan"}
                    </p>
                  </div>
                  <Badge variant="success">{sub.status}</Badge>
                </div>
              ))}
              <Button variant="outline" size="sm" asChild>
                <Link to="/account/subscriptions">
                  Manage Subscriptions
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-surface-400 mb-4">
                You don&apos;t have any active subscriptions.
              </p>
              <Button asChild>
                <Link to="/explore">Browse Channels</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-2">
        {quickLinks.map(({ to, icon: Icon, label, description }) => (
          <Link
            key={to}
            to={to}
            className="group flex items-center gap-4 rounded-xl border border-surface-800 bg-surface-900 p-4 transition-all hover:border-surface-600 hover:bg-surface-850"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-800 transition-colors group-hover:bg-primary-600/20">
              <Icon className="h-5 w-5 text-surface-400 group-hover:text-primary-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-white">{label}</p>
              <p className="text-sm text-surface-500">{description}</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-surface-600 group-hover:text-surface-400" />
          </Link>
        ))}
      </div>
    </div>
  );
}
