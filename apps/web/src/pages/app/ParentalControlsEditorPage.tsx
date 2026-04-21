import { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Loader2, 
  CheckCircle2, 
  Search, 
  X as CloseIcon, 
  ChevronDown, 
  Shield, 
  Clock, 
  Calendar, 
  Eye, 
  EyeOff, 
  Settings,
  AlertCircle,
  Plus,
  Trash2,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { ProfileAvatar } from '@/components/profiles';
import { getProfile, updateParentalControls, defaultParentalControls, getKidsDefaultParentalControls } from '@/api/profiles';
import type { ParentalControls } from '@/api/profiles';
import { useAutosave } from '@/hooks/useAutosave';
import { listChannels } from '@/api/channels';
import { listCategories } from '@/api/categories';
import { listVideos } from '@/api/videos';

export default function ParentalControlsEditorPage() {
  const { profileId } = useParams();
  const navigate = useNavigate();

  const profileQuery = useQuery({
    queryKey: ['profiles', profileId],
    queryFn: () => getProfile(profileId!),
    enabled: !!profileId,
  });

  const channelsQuery = useQuery({
    queryKey: ['channels'],
    queryFn: () => listChannels({ limit: 1000 }),
  });

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => listCategories(),
  });

  const [controls, setControls] = useState<ParentalControls | null>(null);

  const initialized = controls !== null;

  if (profileQuery.data && !initialized) {
    const existing = profileQuery.data.parentalControls;
    if (existing) {
      setControls(existing);
    } else {
      setControls(profileQuery.data.isKidsProfile ? getKidsDefaultParentalControls() : { ...defaultParentalControls });
    }
  }

  const handleSave = useCallback(async (data: ParentalControls) => {
    if (!profileId) return;
    await updateParentalControls(profileId, data);
  }, [profileId]);

  const { saving, lastSavedAt, error: saveError } = useAutosave({
    data: controls!,
    onSave: handleSave,
    delay: 500,
    enabled: initialized,
  });

  if (profileQuery.isLoading || !controls) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const profile = profileQuery.data!;

  const updateField = <K extends keyof ParentalControls>(key: K, value: ParentalControls[K]) => {
    setControls(prev => prev ? { ...prev, [key]: value } : prev);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header Context */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/account/profiles`)}
            className="rounded-full"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div className="flex items-center gap-4">
            <ProfileAvatar
              avatarUrl={profile.avatarUrl}
              name={profile.name}
              size="lg"
            />
            <div>
              <h1 className="text-3xl font-bold text-white leading-none">
                Parental Controls
              </h1>
              <p className="text-surface-400 mt-2 flex items-center gap-2">
                Managing profile: <span className="text-white font-medium">{profile.name}</span>
                {profile.isKidsProfile && (
                  <span className="rounded-full bg-primary-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-400 border border-primary-500/30">
                    Kids
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="flex items-center gap-2 justify-end mb-1">
            {saving && (
              <span className="flex items-center gap-1.5 text-sm text-primary-400 font-medium">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Autosaving...
              </span>
            )}
            {!saving && lastSavedAt && (
              <span className="flex items-center gap-1.5 text-sm text-surface-500">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500/70" />
                Last saved {lastSavedAt.toLocaleTimeString()}
              </span>
            )}
            {saveError && (
              <span className="text-sm text-red-400 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                Save error
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-8 pb-20">
        <AllowedChannelsSection
          controls={controls}
          onChange={updateField}
          channels={channelsQuery.data?.data ?? []}
          isLoading={channelsQuery.isLoading}
        />

        <BlockedCategoriesSection
          value={controls.blockedCategories}
          onChange={v => updateField('blockedCategories', v)}
          categories={categoriesQuery.data ?? []}
          channels={channelsQuery.data?.data ?? []}
          isLoading={categoriesQuery.isLoading || channelsQuery.isLoading}
        />

        <BlockedVideosSection
          value={controls.blockedVideos}
          onChange={v => updateField('blockedVideos', v)}
          channels={channelsQuery.data?.data ?? []}
        />

        <ContentFiltersSection
          value={controls.contentFilters}
          onChange={v => updateField('contentFilters', v)}
        />

        <AgeRatingSection
          value={controls.ageRating}
          onChange={v => updateField('ageRating', v)}
        />

        <WatchTimeSection
          value={controls.watchTime}
          onChange={v => updateField('watchTime', v)}
          channels={channelsQuery.data?.data ?? []}
        />

        <WatchWindowsSection
          value={controls.watchWindows}
          onChange={v => updateField('watchWindows', v)}
        />
      </div>
    </div>
  );
}

// ── Shared Toggle ──
function Toggle({ checked, onChange, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`h-6 w-11 rounded-full transition-all shrink-0 ${
        checked ? 'bg-primary-500 shadow-[0_0_10px_rgba(var(--color-primary-500-rgb),0.3)]' : 'bg-surface-700'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

function SectionHeader({ title, description, badge }: { title: string; description?: string; badge?: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {badge && (
          <span className="rounded-full bg-surface-800 px-2 py-0.5 text-[10px] font-bold text-surface-400 border border-surface-700 uppercase">
            {badge}
          </span>
        )}
      </div>
      {description && <p className="text-sm text-surface-500 mt-1">{description}</p>}
    </div>
  );
}

// ── 1. Allowed Channels Section ──
function AllowedChannelsSection({ 
  controls, 
  onChange, 
  channels, 
  isLoading 
}: { 
  controls: ParentalControls; 
  onChange: any;
  channels: any[];
  isLoading: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredOptions = channels.filter(ch => 
    !controls.allowedChannels.includes(ch.id) &&
    (ch.name.toLowerCase().includes(search.toLowerCase()) || 
     ch.slug.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Card className="overflow-visible border-surface-800 bg-surface-900/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-surface-800">
        <div>
          <CardTitle className="text-xl font-bold">Channel Allow-list</CardTitle>
          <CardDescription>Restrict access to specific channels only</CardDescription>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-surface-500">
            {controls.useChannelAllowlist ? 'Enabled' : 'Disabled'}
          </span>
          <Toggle 
            checked={controls.useChannelAllowlist} 
            onChange={(v) => onChange('useChannelAllowlist', v)} 
          />
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {!controls.useChannelAllowlist ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="h-12 w-12 rounded-full bg-surface-800 flex items-center justify-center mb-3">
              <Eye className="h-6 w-6 text-surface-500" />
            </div>
            <p className="text-surface-400">All channels are currently visible.</p>
            <p className="text-xs text-surface-600 mt-1">Enable the toggle above to start restricting channels.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <div
                onClick={() => !isLoading && setIsOpen(!isOpen)}
                className="flex items-center justify-between rounded-xl border border-surface-700 bg-surface-800 px-4 py-3 cursor-pointer hover:border-primary-500/50 hover:bg-surface-750 transition-all group"
              >
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary-500" />
                  <span className="text-surface-300 font-medium">
                    {isLoading ? 'Loading channels...' : 'Add channel to allow-list'}
                  </span>
                </div>
                <ChevronDown className={`h-4 w-4 text-surface-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
              </div>

              {isOpen && (
                <div className="absolute z-50 mt-2 w-full rounded-2xl border border-surface-700 bg-surface-900 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in duration-200">
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
                    <Input
                      autoFocus
                      placeholder="Search channels..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="pl-10 bg-surface-800 border-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto custom-scrollbar">
                    {filteredOptions.length === 0 ? (
                      <p className="p-8 text-center text-sm text-surface-500 italic">No matching channels found</p>
                    ) : (
                      <div className="grid gap-1">
                        {filteredOptions.map(ch => (
                          <button
                            key={ch.id}
                            onClick={() => {
                              onChange('allowedChannels', [...controls.allowedChannels, ch.id]);
                              setIsOpen(false);
                              setSearch('');
                            }}
                            className="w-full flex items-center gap-3 rounded-xl p-2.5 text-left hover:bg-primary-500/10 transition-colors group"
                          >
                            <div className="h-10 w-10 rounded-full bg-surface-800 border border-surface-700 overflow-hidden shrink-0">
                              {ch.logoUrl ? <img src={ch.logoUrl} alt="" className="h-full w-full object-cover" /> : null}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white group-hover:text-primary-400 transition-colors">{ch.name}</p>
                              <p className="text-xs text-surface-500">@{ch.slug}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              {controls.allowedChannels.map(chId => {
                const ch = channels.find(c => c.id === chId);
                return (
                  <div key={chId} className="flex items-center justify-between rounded-xl border border-primary-500/20 bg-primary-500/5 p-3 group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-surface-800 overflow-hidden shrink-0 border border-primary-500/20">
                         {ch?.logoUrl && <img src={ch.logoUrl} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <span className="text-sm font-medium text-white truncate">{ch?.name || 'Unknown Channel'}</span>
                    </div>
                    <button 
                      onClick={() => onChange('allowedChannels', controls.allowedChannels.filter(c => c !== chId))}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-surface-500 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
            
            {controls.allowedChannels.length === 0 && (
              <p className="text-center text-sm text-surface-600 py-4 italic border border-dashed border-surface-800 rounded-xl">
                No channels restricted yet. Add your first allowed channel.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── 2. Blocked Categories Section (Grouped by Channel) ──
function BlockedCategoriesSection({ 
  value, 
  onChange, 
  categories, 
  channels,
  isLoading 
}: { 
  value: string[]; 
  onChange: (v: string[]) => void; 
  categories: any[]; 
  channels: any[];
  isLoading: boolean;
}) {
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null);

  const categoriesByChannel = useMemo(() => {
    const map: Record<string, any[]> = {};
    categories.forEach(cat => {
      if (!map[cat.channelId]) map[cat.channelId] = [];
      map[cat.channelId].push(cat);
    });
    return map;
  }, [categories]);

  const toggleCategory = (catName: string) => {
    if (value.includes(catName)) {
      onChange(value.filter(v => v !== catName));
    } else {
      onChange([...value, catName]);
    }
  };

  return (
    <Card className="border-surface-800 bg-surface-900/50">
      <CardHeader>
        <CardTitle>Blocked Categories</CardTitle>
        <CardDescription>Hide entire categories of content, grouped by channel</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner size="sm" /></div>
        ) : (
          <div className="space-y-3">
            {channels.map(channel => {
              const channelCats = categoriesByChannel[channel.id] || [];
              if (channelCats.length === 0) return null;
              
              const isExpanded = expandedChannel === channel.id;
              const activeCount = channelCats.filter(c => value.includes(c.name)).length;

              return (
                <div key={channel.id} className="border border-surface-800 rounded-xl overflow-hidden bg-surface-900/30 transition-all">
                  <button
                    onClick={() => setExpandedChannel(isExpanded ? null : channel.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-surface-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-surface-800 border border-surface-700 overflow-hidden shrink-0">
                         {channel.logoUrl && <img src={channel.logoUrl} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-white">{channel.name}</p>
                        <p className="text-xs text-surface-500">{channelCats.length} categories available</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {activeCount > 0 && (
                        <span className="bg-red-500/20 text-red-500 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-500/30">
                          {activeCount} BLOCKED
                        </span>
                      )}
                      <ChevronRight className={`h-4 w-4 text-surface-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
                  </button>
                  
                  {isExpanded && (
                    <div className="p-4 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 animate-in slide-in-from-top-2">
                       {channelCats.map(cat => {
                         const isBlocked = value.includes(cat.name);
                         return (
                           <label 
                             key={cat.id} 
                             className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                               isBlocked ? 'bg-red-500/5 border-red-500/20' : 'bg-surface-800/20 border-surface-800 hover:border-surface-700'
                             }`}
                           >
                             <span className={`text-sm font-medium ${isBlocked ? 'text-red-400' : 'text-surface-300'}`}>
                               {cat.name}
                             </span>
                             <Toggle checked={isBlocked} onChange={() => toggleCategory(cat.name)} />
                           </label>
                         );
                       })}
                    </div>
                  )}
                </div>
              );
            })}
            
            {Object.keys(categoriesByChannel).length === 0 && (
              <div className="flex flex-col items-center py-10 opacity-40">
                <AlertCircle className="h-10 w-10 mb-2" />
                <p className="text-sm">Available once content is tagged</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── 3. Blocked Videos Section (Search + Per-channel Paginated) ──
function BlockedVideosSection({ value, onChange, channels }: { value: string[]; onChange: (v: string[]) => void; channels: any[] }) {
  const [search, setSearch] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [page, setPage] = useState(1);
  const perPage = 20;

  const videosQuery = useQuery({
    queryKey: ['videos-search-parental', search, selectedChannel, page],
    queryFn: () => listVideos({ search, channelId: selectedChannel || undefined, page, perPage }),
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
              <div className="flex items-center justify-center h-[300px]"><Spinner size="md" /></div>
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

// ── 4. Watch Time Section ──
function WatchTimeSection({ 
  value, 
  onChange, 
  channels 
}: { 
  value: ParentalControls['watchTime']; 
  onChange: (v: ParentalControls['watchTime']) => void; 
  channels: any[];
}) {
  const [expandedSection, setExpandedSection] = useState<'daily' | 'channels' | null>(null);

  const setMode = (mode: 'UNIFORM' | 'PER_DAY') => {
    onChange({ ...value, mode });
  };

  const updateDaily = (minutes: number | null) => {
    onChange({ ...value, dailyLimitMinutes: minutes });
  };

  const updateDayLimit = (day: string, minutes: number | null) => {
    const limits = { ...value.perDayLimits };
    if (minutes === null) delete limits[day];
    else limits[day] = minutes;
    onChange({ ...value, perDayLimits: limits });
  };

  const updateChannelLimit = (channelId: string, minutes: number | null) => {
    const limits = { ...value.perChannelLimits };
    if (minutes === null) delete limits[channelId];
    else limits[channelId] = minutes;
    onChange({ ...value, perChannelLimits: limits });
  };

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <Card className="border-surface-800 bg-surface-900/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary-400" />
          Watch Time Limits
        </CardTitle>
        <CardDescription>Cap viewing time globally, by day, or by channel</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Global/Daily Limit */}
        <div className="bg-surface-950/50 border border-surface-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-6">
             <SectionHeader title="Daily Limits" description="Set maximum time allowed per day" />
             <div className="flex bg-surface-800 p-1 rounded-lg">
                <button 
                  onClick={() => setMode('UNIFORM')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${value.mode === 'UNIFORM' ? 'bg-primary-500 text-white shadow-lg' : 'text-surface-400 hover:text-white'}`}
                >UNIFORM</button>
                <button 
                  onClick={() => setMode('PER_DAY')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${value.mode === 'PER_DAY' ? 'bg-primary-500 text-white shadow-lg' : 'text-surface-400 hover:text-white'}`}
                >PER-DAY</button>
             </div>
          </div>

          {value.mode === 'UNIFORM' ? (
            <div className="flex items-center gap-4 bg-surface-800/40 p-4 rounded-xl border border-surface-800">
               <div className="h-10 w-10 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-500">
                  <Clock className="h-5 w-5" />
               </div>
               <div className="flex-1">
                 <p className="text-sm font-medium text-white mb-1">Same limit every day</p>
                 <Input
                  type="number"
                  placeholder="Unlimited"
                  value={value.dailyLimitMinutes ?? ''}
                  onChange={e => updateDaily(e.target.value ? parseInt(e.target.value) : null)}
                  className="bg-surface-900 max-w-[120px]"
                />
               </div>
               <span className="text-sm font-bold text-surface-500">MINUTES</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
               {DAYS.map(day => (
                 <div key={day} className="bg-surface-800/40 p-3 rounded-xl border border-surface-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-surface-400 uppercase tracking-wider">{day}</span>
                    <div className="flex items-center gap-2">
                       <Input
                        type="number"
                        placeholder="--"
                        value={value.perDayLimits[day] ?? ''}
                        onChange={e => updateDayLimit(day, e.target.value ? parseInt(e.target.value) : null)}
                        className="bg-surface-900 w-16 h-8 text-center text-xs"
                      />
                      <span className="text-[10px] font-bold text-surface-600">MIN</span>
                    </div>
                 </div>
               ))}
            </div>
          )}
        </div>

        {/* Per-Channel Limits */}
        <div className="bg-surface-950/50 border border-surface-800 rounded-xl overflow-hidden">
          <button 
             onClick={() => setExpandedSection(expandedSection === 'channels' ? null : 'channels')}
             className="w-full flex items-center justify-between p-5 hover:bg-surface-800 transition-colors"
          >
            <div className="flex items-center gap-3">
               <Settings className="h-5 w-5 text-primary-400" />
               <div className="text-left">
                  <p className="text-sm font-semibold text-white">Per-Channel Limits</p>
                  <p className="text-xs text-surface-500">{Object.keys(value.perChannelLimits).length} channels restricted</p>
               </div>
            </div>
            <ChevronDown className={`h-4 w-4 text-surface-500 transition-transform ${expandedSection === 'channels' ? 'rotate-180' : ''}`} />
          </button>
          
          {expandedSection === 'channels' && (
            <div className="p-5 pt-0 border-t border-surface-800 animate-in slide-in-from-top-2">
               <div className="grid gap-2 mt-4 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                  {channels.map(ch => (
                    <div key={ch.id} className="flex items-center justify-between p-3 rounded-xl border border-surface-800 bg-surface-900/30">
                       <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-surface-800 overflow-hidden border border-surface-700">
                             {ch.logoUrl && <img src={ch.logoUrl} alt="" className="h-full w-full object-cover" />}
                          </div>
                          <span className="text-sm font-medium text-white">{ch.name}</span>
                       </div>
                       <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            placeholder="Unlimited"
                            value={value.perChannelLimits[ch.id] ?? ''}
                            onChange={e => updateChannelLimit(ch.id, e.target.value ? parseInt(e.target.value) : null)}
                            className="bg-surface-900 w-24 h-9 text-right"
                          />
                          <span className="text-xs font-bold text-surface-500">MIN</span>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── 5. Watch Windows Section ──
function WatchWindowsSection({ 
  value, 
  onChange 
}: { 
  value: ParentalControls['watchWindows']; 
  onChange: (v: ParentalControls['watchWindows']) => void; 
}) {
  const setMode = (mode: 'UNIFORM' | 'PER_DAY') => {
    onChange({ ...value, mode });
  };

  const addSlot = (dayOfWeek: number = -1) => {
    const windows = [...value.windows, { dayOfWeek, startTime: '08:00', endTime: '20:00' }];
    onChange({ ...value, windows });
  };

  const updateSlot = (index: number, field: string, v: string | number) => {
    const windows = [...value.windows];
    windows[index] = { ...windows[index], [field]: v };
    onChange({ ...value, windows });
  };

  const removeSlot = (index: number) => {
    onChange({ ...value, windows: value.windows.filter((_, i) => i !== index) });
  };

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <Card className="border-surface-800 bg-surface-900/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary-400" />
          Watch Windows
        </CardTitle>
        <CardDescription>Specify the times of day content can be viewed</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex bg-surface-800 p-1 rounded-xl w-fit">
          <button 
            onClick={() => setMode('UNIFORM')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${value.mode === 'UNIFORM' ? 'bg-primary-500 text-white shadow-lg' : 'text-surface-400 hover:text-white'}`}
          >EVERY DAY THE SAME</button>
          <button 
            onClick={() => setMode('PER_DAY')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${value.mode === 'PER_DAY' ? 'bg-primary-500 text-white shadow-lg' : 'text-surface-400 hover:text-white'}`}
          >DIFFERENT PER DAY</button>
        </div>

        {value.mode === 'UNIFORM' ? (
          <div className="space-y-3">
             <div className="flex items-center justify-between group">
                <SectionHeader title="Allowed Hours" description="Applies to all days of the week" />
                <Button variant="outline" size="sm" onClick={() => addSlot(-1)} className="rounded-full bg-primary-500/10 border-primary-500/20 text-primary-400 hover:bg-primary-500 hover:text-white py-1">
                   <Plus className="h-3.5 w-3.5 mr-1" /> Add Slot
                </Button>
             </div>
             <div className="grid gap-2">
                {value.windows.filter(w => w.dayOfWeek === -1).map((w, idx) => {
                  const globalIdx = value.windows.indexOf(w);
                  return (
                    <div key={globalIdx} className="flex items-center gap-4 bg-surface-800/40 p-4 rounded-2xl border border-surface-800 group animate-in slide-in-from-left-2">
                       <span className="text-xs font-bold text-surface-500 uppercase tracking-widest min-w-[80px]">Window {idx + 1}</span>
                       <div className="flex items-center gap-3">
                          <Input type="time" value={w.startTime} onChange={e => updateSlot(globalIdx, 'startTime', e.target.value)} className="bg-surface-900 border-surface-700 w-32" />
                          <span className="text-surface-600 font-bold">TO</span>
                          <Input type="time" value={w.endTime} onChange={e => updateSlot(globalIdx, 'endTime', e.target.value)} className="bg-surface-900 border-surface-700 w-32" />
                       </div>
                       <button onClick={() => removeSlot(globalIdx)} className="ml-auto text-surface-500 hover:text-red-400 transition-colors">
                          <Trash2 className="h-4 w-4" />
                       </button>
                    </div>
                  );
                })}
                {value.windows.filter(w => w.dayOfWeek === -1).length === 0 && (
                   <p className="text-center text-sm text-surface-600 py-10 bg-surface-800/20 border border-dashed border-surface-800 rounded-2xl italic">
                      No windows set. Restricted profiles won't be able to watch content.
                   </p>
                )}
             </div>
          </div>
        ) : (
          <div className="space-y-4">
             {DAYS.map((dayName, dayIdx) => {
               const dayWindows = value.windows.filter(w => w.dayOfWeek === dayIdx);
               return (
                 <div key={dayIdx} className="bg-surface-950/50 border border-surface-800 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                       <h4 className="font-bold text-white uppercase tracking-widest text-sm">{dayName}</h4>
                       <Button variant="ghost" size="sm" onClick={() => addSlot(dayIdx)} className="h-8 text-[10px] font-bold uppercase tracking-widest text-primary-400 hover:text-primary-300">
                          <Plus className="h-3 w-3 mr-1" /> Add Range
                       </Button>
                    </div>
                    <div className="space-y-2">
                       {dayWindows.map((w, idx) => {
                          const globalIdx = value.windows.indexOf(w);
                          return (
                            <div key={globalIdx} className="flex items-center gap-3 bg-surface-800/30 p-2.5 rounded-xl border border-surface-800 animate-in fade-in duration-300">
                               <Input type="time" value={w.startTime} onChange={e => updateSlot(globalIdx, 'startTime', e.target.value)} className="bg-surface-950 h-9 border-surface-800" />
                               <span className="text-[10px] font-bold text-surface-600">TO</span>
                               <Input type="time" value={w.endTime} onChange={e => updateSlot(globalIdx, 'endTime', e.target.value)} className="bg-surface-950 h-9 border-surface-800" />
                               <button onClick={() => removeSlot(globalIdx)} className="p-1.5 text-surface-600 hover:text-red-500">
                                  <CloseIcon className="h-3.5 w-3.5" />
                               </button>
                            </div>
                          );
                       })}
                       {dayWindows.length === 0 && <p className="text-[10px] text-surface-600 italic px-2">No windows defined for {dayName}.</p>}
                    </div>
                 </div>
               );
             })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── 6. Content Filters Section ──
function ContentFiltersSection({ 
  value, 
  onChange 
}: { 
  value: ParentalControls['contentFilters']; 
  onChange: (v: ParentalControls['contentFilters']) => void; 
}) {
  return (
    <Card className="border-surface-800 bg-surface-900/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
           <Shield className="h-5 w-5 text-primary-400" />
           Content Filters
        </CardTitle>
        <CardDescription>Apply general content restrictions platform-wide</CardDescription>
      </CardHeader>
      <CardContent className="divide-y divide-surface-800">
        <div className="flex items-center justify-between py-4 group">
          <div>
            <p className="text-white font-medium group-hover:text-primary-400 transition-colors">Kol Isha</p>
            <p className="text-sm text-surface-500">Filter content with female singing (applied automatically for kids)</p>
          </div>
          <Toggle
            checked={value.kolIsha}
            onChange={() => onChange({ ...value, kolIsha: !value.kolIsha })}
          />
        </div>
        <div className="flex items-center justify-between py-4 group">
          <div>
            <p className="text-white font-medium group-hover:text-primary-400 transition-colors">Women Only</p>
            <p className="text-sm text-surface-500">Enable women-only filter for the current profile</p>
          </div>
          <Toggle
            checked={value.womenOnly}
            onChange={() => onChange({ ...value, womenOnly: !value.womenOnly })}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ── 7. Age Rating Section ──
const AGE_RATINGS = [
  { key: 'G', label: 'TV-G', desc: 'General Audience' },
  { key: 'PG', label: 'TV-PG', desc: 'Parental Guidance' },
  { key: 'PG-13', label: 'TV-14', desc: 'Parents Strongly Cautioned' },
  { key: 'R', label: 'TV-MA', desc: 'Mature Audiences Only' },
];

function AgeRatingSection({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  return (
    <Card className="border-surface-800 bg-surface-900/50">
      <CardHeader>
        <CardTitle>Maturity Rating Cap</CardTitle>
        <CardDescription>Videos with a higher rating than this will be hidden from this profile</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <button
            onClick={() => onChange(null)}
            className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all text-center ${
              value === null 
                ? 'bg-primary-500/10 border-primary-500 shadow-[0_0_15px_rgba(var(--color-primary-500-rgb),0.1)]' 
                : 'bg-surface-800/40 border-surface-800 hover:border-surface-700'
            }`}
          >
            <span className={`text-sm font-bold ${value === null ? 'text-primary-400' : 'text-white'}`}>No limit</span>
            <span className="text-[10px] text-surface-500 mt-1 uppercase font-bold tracking-widest">All content</span>
          </button>
          
          {AGE_RATINGS.map(rating => (
            <button
              key={rating.key}
              onClick={() => onChange(rating.key)}
              className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all text-center ${
                value === rating.key 
                  ? 'bg-primary-500/10 border-primary-500 shadow-[0_0_15px_rgba(var(--color-primary-500-rgb),0.1)]' 
                  : 'bg-surface-800/40 border-surface-800 hover:border-surface-700'
              }`}
            >
              <span className={`text-sm font-bold ${value === rating.key ? 'text-primary-400' : 'text-white'}`}>{rating.label}</span>
              <span className="text-[10px] text-surface-500 mt-1 uppercase font-bold tracking-widest truncate w-full">{rating.desc}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
