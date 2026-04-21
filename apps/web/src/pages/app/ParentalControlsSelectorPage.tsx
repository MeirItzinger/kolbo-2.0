import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ProfileAvatar } from '@/components/profiles';
import { getProfiles } from '@/api/profiles';

export default function ParentalControlsSelectorPage() {
  const navigate = useNavigate();

  const profilesQuery = useQuery({
    queryKey: ['profiles'],
    queryFn: getProfiles,
  });

  if (profilesQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const profiles = profilesQuery.data ?? [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/account')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-white">Parental Controls</h1>
          <p className="text-sm text-surface-400">Select a profile to manage its controls</p>
        </div>
      </div>

      {profiles.length === 0 ? (
        <div className="text-center py-16">
          <Shield className="h-12 w-12 text-surface-600 mx-auto mb-4" />
          <p className="text-surface-400">No profiles found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
          {profiles.map(profile => (
            <button
              key={profile.id}
              onClick={() => navigate(`/account/profiles/${profile.id}/controls`)}
              className="group flex flex-col items-center gap-3 rounded-xl border border-surface-800 bg-surface-900 p-6 transition-all hover:border-primary-500/50 hover:bg-surface-850"
            >
              <ProfileAvatar
                avatarUrl={profile.avatarUrl}
                name={profile.name}
                size="lg"
              />
              <div className="text-center">
                <p className="text-white font-medium">{profile.name}</p>
                {profile.isKidsProfile && (
                  <p className="text-xs text-surface-400">Kids</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
