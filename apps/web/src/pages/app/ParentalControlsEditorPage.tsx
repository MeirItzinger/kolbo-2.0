import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Loader2, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ProfileAvatar } from '@/components/profiles';
import { getProfile, updateParentalControls, defaultParentalControls, getKidsDefaultParentalControls } from '@/api/profiles';
import type { ParentalControls } from '@/api/profiles';
import { useAutosave } from '@/hooks/useAutosave';
import { listChannels } from '@/api/channels';
import { listCategories } from '@/api/categories';

// Subcomponents
import { AllowedChannelsSection } from '@/components/parental-controls/AllowedChannelsSection';
import { BlockedCategoriesSection } from '@/components/parental-controls/BlockedCategoriesSection';
import { BlockedVideosSection } from '@/components/parental-controls/BlockedVideosSection';
import { ContentFiltersSection, AgeRatingSection } from '@/components/parental-controls/ContentFiltersSection';
import { WatchTimeSection } from '@/components/parental-controls/WatchTimeSection';
import { WatchWindowsSection } from '@/components/parental-controls/WatchWindowsSection';

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
      // Normalize data to handle old formats or missing properties
      const normalized: ParentalControls = {
        ...defaultParentalControls,
        ...existing,
        contentFilters: {
          ...defaultParentalControls.contentFilters,
          ...(existing.contentFilters || {}),
        },
        watchTime: {
          ...defaultParentalControls.watchTime,
          ...(existing.watchTime || {}),
        },
        watchWindows: typeof existing.watchWindows === 'object' && existing.watchWindows !== null && 'windows' in existing.watchWindows
          ? existing.watchWindows
          : { mode: 'UNIFORM', windows: Array.isArray(existing.watchWindows) ? existing.watchWindows : [] }
      };
      setControls(normalized);
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
          useChannelAllowlist={controls.useChannelAllowlist}
          allowedChannels={controls.allowedChannels}
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
