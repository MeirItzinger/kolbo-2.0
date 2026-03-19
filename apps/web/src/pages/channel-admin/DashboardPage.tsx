import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Film, Users, Rows3, ChevronRight, Tv, DollarSign } from "lucide-react";
import { adminGetChannel, adminListVideos, adminListCreators, adminListContentRows } from "@/api/admin";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";

export default function ChannelAdminDashboardPage() {
  const { channelId } = useParams<{ channelId: string }>();

  const channelQuery = useQuery({
    queryKey: ["admin", "channel", channelId],
    queryFn: () => adminGetChannel(channelId!),
    enabled: !!channelId,
  });

  const videosQuery = useQuery({
    queryKey: ["channel-admin", channelId, "videos-count"],
    queryFn: () => adminListVideos({ channelId, perPage: 1 }),
    enabled: !!channelId,
  });

  const creatorsQuery = useQuery({
    queryKey: ["channel-admin", channelId, "creators-count"],
    queryFn: () => adminListCreators({ channelId, perPage: 1 }),
    enabled: !!channelId,
  });

  const rowsQuery = useQuery({
    queryKey: ["channel-admin", channelId, "rows"],
    queryFn: () => adminListContentRows({ channelId }),
    enabled: !!channelId,
  });

  const channel = channelQuery.data;
  const videoCount = videosQuery.data?.meta?.total ?? 0;
  const creatorCount = creatorsQuery.data?.meta?.total ?? 0;
  const rowCount = rowsQuery.data?.length ?? 0;

  if (channelQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3">
          {channel?.logoUrl ? (
            <img src={channel.logoUrl} alt={channel.name} className="h-10 w-10 rounded-lg object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-800">
              <Tv className="h-5 w-5 text-surface-500" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-white">
            {channel?.name ?? "Channel"} Dashboard
          </h1>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Videos", value: videoCount, icon: Film, loading: videosQuery.isLoading },
          { label: "Creators", value: creatorCount, icon: Users, loading: creatorsQuery.isLoading },
          { label: "Content Rows", value: rowCount, icon: Rows3, loading: rowsQuery.isLoading },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-600/20">
                <s.icon className="h-6 w-6 text-primary-400" />
              </div>
              <div>
                <p className="text-sm text-surface-400">{s.label}</p>
                {s.loading ? <Spinner size="sm" /> : <p className="text-2xl font-bold text-white">{s.value}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { to: `videos`, icon: Film, label: "Manage Videos" },
          { to: `creators`, icon: Users, label: "Manage Creators" },
          { to: `content`, icon: Rows3, label: "Content Rows" },
          { to: `sales`, icon: DollarSign, label: "Sales" },
        ].map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="group flex items-center gap-3 rounded-xl border border-surface-800 bg-surface-900 p-4 transition-all hover:border-surface-600"
          >
            <a.icon className="h-5 w-5 text-surface-400 group-hover:text-primary-400" />
            <span className="flex-1 font-medium text-surface-200 group-hover:text-white">{a.label}</span>
            <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400" />
          </Link>
        ))}
      </div>
    </div>
  );
}
