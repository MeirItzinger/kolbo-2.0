import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Film, Pencil, ExternalLink, Trash2 } from "lucide-react";
import { adminListVideos, adminListChannels, adminBulkDeleteVideos } from "@/api/admin";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Card, CardContent } from "@/components/ui/Card";
import { formatDate } from "@/lib/utils";

const statusVariant: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  DRAFT: "secondary",
  UNPUBLISHED: "secondary",
  PUBLISHED: "success",
  SCHEDULED: "warning",
  PROCESSING: "warning",
  ARCHIVED: "secondary",
};

export default function AdminVideosPage() {
  const { user, hasRole } = useAuth();
  const isSuperAdmin = hasRole("SUPER_ADMIN");
  const channelAdminChannelId = !isSuperAdmin
    ? user?.roles.find((r) => r.role?.key === "CHANNEL_ADMIN")?.channelId ?? ""
    : "";

  const [channelFilter, setChannelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const qc = useQueryClient();

  const effectiveChannelFilter = isSuperAdmin ? channelFilter : channelAdminChannelId;

  const channelsQuery = useQuery({
    queryKey: ["admin", "channels", "list"],
    queryFn: () => adminListChannels({ perPage: 100 }),
    enabled: isSuperAdmin,
  });

  const videosQuery = useQuery({
    queryKey: ["admin", "videos", { channelFilter: effectiveChannelFilter, statusFilter, page }],
    queryFn: () =>
      adminListVideos({
        channelId: effectiveChannelFilter || undefined,
        status: statusFilter || undefined,
        page,
        perPage: 20,
      }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => adminBulkDeleteVideos(ids),
    onSuccess: () => {
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["admin", "videos"] });
    },
  });

  const channels = channelsQuery.data?.data ?? [];
  const videos = videosQuery.data?.data ?? [];
  const meta = videosQuery.data?.meta;

  const allOnPageSelected = videos.length > 0 && videos.every((v) => selected.has(v.id));

  const toggleAll = () => {
    if (allOnPageSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        videos.forEach((v) => next.delete(v.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        videos.forEach((v) => next.add(v.id));
        return next;
      });
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} video(s)? This cannot be undone.`)) return;
    bulkDeleteMutation.mutate([...selected]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Videos</h1>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
              Delete {selected.size}
            </Button>
          )}
          <Button asChild>
            <Link to="/admin/videos/new">
              <Plus className="h-4 w-4" />
              Create Video
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {isSuperAdmin && (
          <select
            value={channelFilter}
            onChange={(e) => { setChannelFilter(e.target.value); setPage(1); }}
            className="h-10 rounded-md border border-surface-700 bg-surface-900 px-3 text-sm text-surface-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">All Channels</option>
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>{ch.name}</option>
            ))}
          </select>
        )}
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-10 rounded-md border border-surface-700 bg-surface-900 px-3 text-sm text-surface-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All Statuses</option>
          {(["DRAFT", "UNPUBLISHED", "PUBLISHED", "SCHEDULED", "PROCESSING", "ARCHIVED"]).map(
            (s) => (
              <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
            ),
          )}
        </select>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-sm text-surface-400 underline hover:text-surface-200"
          >
            Clear selection ({selected.size})
          </button>
        )}
      </div>

      {videosQuery.isLoading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : videos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Film className="mx-auto mb-4 h-12 w-12 text-surface-600" />
            <p className="text-lg font-medium text-white">No videos found</p>
            <p className="mt-1 text-surface-400">
              Adjust your filters or create a new video.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-surface-800">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-800 bg-surface-900">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-surface-600 bg-surface-800 text-primary-600 focus:ring-primary-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-400">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-400">Channel</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-400">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-400">Visibility</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-400">Created</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-surface-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800">
                {videos.map((v) => (
                  <tr
                    key={v.id}
                    className={`hover:bg-surface-900 ${selected.has(v.id) ? "bg-primary-950/30" : "bg-surface-900/50"}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(v.id)}
                        onChange={() => toggleOne(v.id)}
                        className="h-4 w-4 rounded border-surface-600 bg-surface-800 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="max-w-[240px] truncate font-medium text-white">{v.title}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-surface-400">
                      {v.channel?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant[v.status] ?? "secondary"}>{v.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={v.isFree ? "success" : "secondary"}>
                        {v.isFree ? "Free" : "Paid"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-surface-400">
                      {formatDate(v.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/admin/videos/${v.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/videos/${v.slug}`} target="_blank">
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && meta.total > meta.limit && (() => {
            const totalPages = Math.ceil(meta.total / meta.limit);
            return (
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-surface-400">
                  Page {meta.page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
