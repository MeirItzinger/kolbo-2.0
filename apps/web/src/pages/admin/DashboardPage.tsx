import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Tv,
  Film,
  Users,
  LayoutGrid,
  CreditCard,
  Package,
  Rows3,
  ImageIcon,
  FolderOpen,
  DollarSign,
  PanelsTopLeft,
  ChevronRight,
} from "lucide-react";
import { adminListChannels, adminListVideos, adminGetChannel } from "@/api/admin";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { useAuth } from "@/hooks/useAuth";

export default function AdminDashboardPage() {
  const { user, hasRole } = useAuth();
  const isSuperAdmin = hasRole("SUPER_ADMIN");

  const channelAdminChannelId = !isSuperAdmin
    ? user?.roles?.find((r: any) => r.role?.key === "CHANNEL_ADMIN")?.channelId ?? ""
    : "";

  const channelsQuery = useQuery({
    queryKey: ["admin", "channels", "list"],
    queryFn: () => adminListChannels({ perPage: 100 }),
    enabled: isSuperAdmin,
  });

  const channelDetailQuery = useQuery({
    queryKey: ["admin", "channel", channelAdminChannelId],
    queryFn: () => adminGetChannel(channelAdminChannelId),
    enabled: !!channelAdminChannelId,
  });

  const videosQuery = useQuery({
    queryKey: ["admin", "videos", "count", channelAdminChannelId || "all"],
    queryFn: () =>
      adminListVideos({
        perPage: 1,
        ...(channelAdminChannelId ? { channelId: channelAdminChannelId } : {}),
      }),
  });

  const channels = channelsQuery.data?.data ?? [];
  const channelCount = channelsQuery.data?.meta?.total ?? 0;
  const videoCount = videosQuery.data?.meta?.total ?? 0;
  const channelName = channelDetailQuery.data?.name;

  if (isSuperAdmin) {
    return <SuperAdminDashboard channels={channels} channelCount={channelCount} videoCount={videoCount} channelsLoading={channelsQuery.isLoading} videosLoading={videosQuery.isLoading} />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">
          {channelName ? `${channelName} Dashboard` : "Channel Dashboard"}
        </h1>
        <p className="mt-1 text-sm text-surface-400">
          Manage your channel&apos;s content and settings
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-600/20">
              <Film className="h-6 w-6 text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-surface-400">Videos</p>
              {videosQuery.isLoading ? (
                <Spinner size="sm" />
              ) : (
                <p className="text-2xl font-bold text-white">{videoCount}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-primary-400" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { to: "/admin/videos", icon: Film, label: "Videos" },
              { to: "/admin/categories", icon: FolderOpen, label: "Categories" },
              { to: "/admin/creators", icon: Users, label: "Creators" },
              { to: "/admin/sales", icon: DollarSign, label: "Sales" },
              { to: "/admin/channel-page-builder", icon: PanelsTopLeft, label: "Channel Page Builder" },
            ].map((a) => (
              <Link
                key={a.to}
                to={a.to}
                className="group flex items-center gap-3 rounded-lg border border-surface-800 bg-surface-800/50 p-3 transition-all hover:border-surface-600 hover:bg-surface-800"
              >
                <a.icon className="h-5 w-5 text-surface-400 group-hover:text-primary-400" />
                <span className="flex-1 text-sm font-medium text-surface-200 group-hover:text-white">
                  {a.label}
                </span>
                <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400" />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SuperAdminDashboard({
  channels,
  channelCount,
  videoCount,
  channelsLoading,
  videosLoading,
}: {
  channels: any[];
  channelCount: number;
  videoCount: number;
  channelsLoading: boolean;
  videosLoading: boolean;
}) {
  const stats = [
    { label: "Total Channels", value: channelCount, icon: Tv, loading: channelsLoading },
    { label: "Total Videos", value: videoCount, icon: Film, loading: videosLoading },
    { label: "Total Users", value: "—", icon: Users, loading: false },
  ];

  const quickActions = [
    { to: "/admin/channels", icon: Tv, label: "Channels" },
    { to: "/admin/videos", icon: Film, label: "Videos" },
    { to: "/admin/creators", icon: Users, label: "Creators" },
    { to: "/admin/plans", icon: CreditCard, label: "Plans" },
    { to: "/admin/bundles", icon: Package, label: "Bundles" },
    { to: "/admin/content-rows", icon: Rows3, label: "Content Rows" },
    { to: "/admin/heroes", icon: ImageIcon, label: "Heroes" },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-600/20">
                <s.icon className="h-6 w-6 text-primary-400" />
              </div>
              <div>
                <p className="text-sm text-surface-400">{s.label}</p>
                {s.loading ? (
                  <Spinner size="sm" />
                ) : (
                  <p className="text-2xl font-bold text-white">{s.value}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-primary-400" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {quickActions.map((a) => (
              <Link
                key={a.to}
                to={a.to}
                className="group flex items-center gap-3 rounded-lg border border-surface-800 bg-surface-800/50 p-3 transition-all hover:border-surface-600 hover:bg-surface-800"
              >
                <a.icon className="h-5 w-5 text-surface-400 group-hover:text-primary-400" />
                <span className="flex-1 text-sm font-medium text-surface-200 group-hover:text-white">
                  {a.label}
                </span>
                <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400" />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {channels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tv className="h-5 w-5 text-primary-400" />
              Channel dashboards
            </CardTitle>
            <p className="text-sm text-surface-400">
              Open a channel to manage videos, creators, content rows, and sales for that channel.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {channels.map((ch: any) => (
                <Link
                  key={ch.id}
                  to={`/channel-admin/${ch.id}`}
                  className="group flex items-center gap-3 rounded-lg border border-surface-800 bg-surface-800/50 p-3 transition-all hover:border-surface-600 hover:bg-surface-800"
                >
                  {ch.logoUrl ? (
                    <img src={ch.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-700">
                      <Tv className="h-4 w-4 text-surface-500" />
                    </div>
                  )}
                  <span className="flex-1 text-sm font-medium text-surface-200 group-hover:text-white">
                    {ch.name}
                  </span>
                  <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
