import React, { useState } from 'react';
import { Search, X as CloseIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { listVideos } from '@/api/videos';

export function BlockedVideosSection({ 
  value, 
  onChange, 
  channels 
}: { 
  value: string[]; 
  onChange: (v: string[]) => void; 
  channels: any[] 
}) {
  const [search, setSearch] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [page, setPage] = useState(1);
  const perPage = 20;

  const videosQuery = useQuery({
    queryKey: ['videos-search-parental', search, selectedChannel, page],
    queryFn: () => listVideos({ search: search || undefined, channelId: selectedChannel || undefined, page, perPage }),
    enabled: true, // Allow browsing all videos initially if no search
  });

  const videoResults = videosQuery.data?.data ?? [];
  const meta = videosQuery.data?.meta;

  const toggleVideo = (title: string) => {
    if (value.includes(title)) {
      onChange(value.filter(v => v !== title));
    } else {
      onChange([...value, title]);
    }
  };

  return (
    <Card className="border-surface-800 bg-surface-900/50">
      <CardHeader>
        <CardTitle>Blocked Videos</CardTitle>
        <CardDescription>Block specific video titles across the platform</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
              <Input
                placeholder="Search videos..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="pl-10 bg-surface-800"
              />
            </div>
            <select
              value={selectedChannel}
              onChange={e => { setSelectedChannel(e.target.value); setPage(1); }}
              className="rounded-lg bg-surface-800 border border-surface-700 px-3 py-2 text-sm text-white focus:ring-1 focus:ring-primary-500 outline-none min-w-[200px]"
            >
              <option value="">All Channels</option>
              {channels.map(ch => (
                <option key={ch.id} value={ch.id}>{ch.name}</option>
              ))}
            </select>
          </div>

          <div className="border border-surface-800 rounded-xl overflow-hidden bg-surface-950/50 min-h-[300px]">
            {videosQuery.isLoading ? (
              <div className="flex items-center justify-center h-[300px]"><Spinner size="default" /></div>
            ) : videoResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[300px] opacity-40">
                <Search className="h-10 w-10 mb-2" />
                <p className="text-sm">No videos found</p>
              </div>
            ) : (
              <div className="divide-y divide-surface-800 max-h-[500px] overflow-y-auto custom-scrollbar">
                {videoResults.map(video => {
                  const isBlocked = value.includes(video.title);
                  return (
                    <div key={video.id} className="flex items-center justify-between p-3 hover:bg-surface-800/40 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-12 w-20 rounded bg-black/40 overflow-hidden shrink-0 border border-surface-800">
                          {video.thumbnailAssets?.[0]?.imageUrl && (
                            <img src={video.thumbnailAssets[0].imageUrl} alt="" className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{video.title}</p>
                          <p className="text-xs text-surface-500">{video.channel?.name}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={isBlocked ? "destructive" : "outline"}
                        onClick={() => toggleVideo(video.title)}
                        className="shrink-0"
                      >
                        {isBlocked ? 'Blocked' : 'Block'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 bg-surface-800/30 p-2 rounded-lg border border-surface-800">
              <span className="text-xs text-surface-500">Page {page} of {meta.totalPages} ({meta.total} total)</span>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="ghost" 
                  disabled={page <= 1} 
                  onClick={() => setPage(p => p - 1)}
                  className="h-8 py-0"
                >Prev</Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  disabled={page >= meta.totalPages} 
                  onClick={() => setPage(p => p + 1)}
                  className="h-8 py-0"
                >Next</Button>
              </div>
            </div>
          )}
          
          <div className="mt-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-surface-500 mb-2">Currently Blocked</h4>
            <div className="flex flex-wrap gap-2">
              {value.map(title => (
                <span key={title} className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 border border-red-500/30 px-3 py-1 text-xs text-red-300">
                  <span className="max-w-[200px] truncate">{title}</span>
                  <button onClick={() => toggleVideo(title)} className="hover:text-white"><CloseIcon className="h-3 w-3" /></button>
                </span>
              ))}
              {value.length === 0 && <p className="text-xs text-surface-600 italic">No videos blocked.</p>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
