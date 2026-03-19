import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Film, Upload, BarChart3, ChevronRight } from "lucide-react";
import { adminListVideos } from "@/api/admin";
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
import type { VideoStatus } from "@/types";

const statusVariant: Record<VideoStatus, "success" | "warning" | "secondary" | "destructive"> = {
  draft: "secondary",
  processing: "warning",
  ready: "success",
  error: "destructive",
  archived: "secondary",
};

export default function CreatorAdminDashboardPage() {
  const { creatorId } = useParams<{ creatorId: string }>();

  const videosQuery = useQuery({
    queryKey: ["creator-admin", creatorId, "videos"],
    queryFn: () => adminListVideos({ creatorProfileId: creatorId, perPage: 10 }),
    enabled: !!creatorId,
  });

  const videos = videosQuery.data?.data ?? [];
  const totalVideos = videosQuery.data?.meta?.total ?? 0;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Creator Dashboard</h1>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-600/20">
              <Film className="h-6 w-6 text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-surface-400">Your Videos</p>
              {videosQuery.isLoading ? <Spinner size="sm" /> : (
                <p className="text-2xl font-bold text-white">{totalVideos}</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-600/20">
              <BarChart3 className="h-6 w-6 text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-surface-400">Total Views</p>
              <p className="text-2xl font-bold text-white">—</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-600/20">
              <BarChart3 className="h-6 w-6 text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-surface-400">Avg. Watch Time</p>
              <p className="text-2xl font-bold text-white">—</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="flex gap-3">
        <Button asChild>
          <Link to="videos">
            <Film className="h-4 w-4" />
            My Videos
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to={`videos/new`}>
            <Upload className="h-4 w-4" />
            Upload New Video
          </Link>
        </Button>
      </div>

      {/* Recent videos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Videos</CardTitle>
            <Link
              to="videos"
              className="text-sm text-primary-400 hover:text-primary-300"
            >
              View All
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {videosQuery.isLoading ? (
            <Spinner />
          ) : videos.length === 0 ? (
            <div className="py-8 text-center">
              <Film className="mx-auto mb-3 h-10 w-10 text-surface-600" />
              <p className="text-surface-400">No videos uploaded yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {videos.map((v) => (
                <Link
                  key={v.id}
                  to={`videos/${v.id}`}
                  className="group flex items-center justify-between rounded-lg border border-surface-800 bg-surface-800/50 px-4 py-3 transition-all hover:border-surface-600"
                >
                  <div>
                    <p className="font-medium text-white group-hover:text-primary-400">
                      {v.title}
                    </p>
                    <p className="text-xs text-surface-500">
                      {formatDate(v.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant[v.status]}>{v.status}</Badge>
                    <ChevronRight className="h-4 w-4 text-surface-600" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
