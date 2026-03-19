import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Film, Pencil, ExternalLink } from "lucide-react";
import { adminListVideos } from "@/api/admin";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Card, CardContent } from "@/components/ui/Card";
import { formatDate } from "@/lib/utils";
import type { VideoStatus } from "@/types";

const statusVariant: Record<VideoStatus, "success" | "warning" | "secondary" | "destructive"> = {
  draft: "secondary",
  processing: "warning",
  ready: "success",
  error: "destructive",
  archived: "secondary",
};

export default function ChannelAdminVideosPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const videosQuery = useQuery({
    queryKey: ["channel-admin", channelId, "videos", { statusFilter, page }],
    queryFn: () =>
      adminListVideos({
        channelId,
        status: statusFilter || undefined,
        page,
        perPage: 20,
      }),
    enabled: !!channelId,
  });

  const videos = videosQuery.data?.data ?? [];
  const meta = videosQuery.data?.meta;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Videos</h1>
        <Button asChild>
          <Link to={`/admin/videos/new`}>
            <Plus className="h-4 w-4" />
            Add Video
          </Link>
        </Button>
      </div>

      <div className="flex gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-10 rounded-md border border-surface-700 bg-surface-900 px-3 text-sm text-surface-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All Statuses</option>
          {(["draft", "processing", "ready", "error", "archived"] as const).map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {videosQuery.isLoading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : videos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Film className="mx-auto mb-4 h-12 w-12 text-surface-600" />
            <p className="text-lg font-medium text-white">No videos found</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-surface-800">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-800 bg-surface-900">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-400">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-400">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-400">Created</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-surface-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800">
                {videos.map((v) => (
                  <tr key={v.id} className="bg-surface-900/50 hover:bg-surface-900">
                    <td className="px-4 py-3">
                      <p className="max-w-[300px] truncate font-medium text-white">{v.title}</p>
                      <p className="text-xs text-surface-500">{v.creatorProfile?.name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant[v.status]}>{v.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-surface-400">{formatDate(v.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/admin/videos/${v.id}`}><Pencil className="h-4 w-4" /></Link>
                        </Button>
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/videos/${v.slug}`} target="_blank"><ExternalLink className="h-4 w-4" /></Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span className="text-sm text-surface-400">Page {meta.page} of {meta.totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
