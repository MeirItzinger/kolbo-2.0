import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Spinner } from '@/components/ui/Spinner';
import { ProfileGrid } from '@/components/profiles';
import { useActiveProfile } from '@/hooks/useActiveProfile';
import { getProfiles } from '@/api/profiles';

export default function ProfilesPage() {
  const navigate = useNavigate();
  const { setActiveProfileId } = useActiveProfile();
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);

  const profilesQuery = useQuery({
    queryKey: ['profiles'],
    queryFn: getProfiles,
  });

  const handleProfileClick = (profile: any) => {
    setSelectedProfile(profile.id);
    setActiveProfileId(profile.id);
    setTimeout(() => {
      navigate('/');
    }, 300);
  };

  useEffect(() => {
    if (profilesQuery.data && profilesQuery.data.length === 0) {
      // Auto create default profile if none exist
    }
  }, [profilesQuery.data]);

  if (profilesQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const profiles = profilesQuery.data ?? [];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <h1 className="text-3xl font-bold text-white mb-12">Who's watching?</h1>

      <ProfileGrid
        profiles={profiles}
        onProfileClick={handleProfileClick}
        showAddButton={false}
      />

      <button
        onClick={() => navigate('/account/profiles')}
        className="mt-12 text-surface-400 hover:text-white transition-colors"
      >
        Manage profiles
      </button>
    </div>
  );
}
