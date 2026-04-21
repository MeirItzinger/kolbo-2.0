import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ProfileGrid } from '@/components/profiles';
import { getProfiles, deleteProfile } from '@/api/profiles';

export default function ManageProfilesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const profilesQuery = useQuery({
    queryKey: ['profiles'],
    queryFn: getProfiles,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProfile,
    onMutate: (profileId) => {
      setDeletingId(profileId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
    onSettled: () => {
      setDeletingId(null);
    },
  });

  const handleProfileClick = (profile: any) => {
    navigate(`/account/profiles/${profile.id}`);
  };

  const handleAddProfile = () => {
    navigate('/account/profiles/new');
  };

  const handleDeleteProfile = (profile: any) => {
    if (profilesQuery.data?.length > 1) {
      deleteMutation.mutate(profile.id);
    }
  };

  if (profilesQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const profiles = profilesQuery.data ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/account')}
          className="mr-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-bold text-white">Manage Profiles</h1>
      </div>

      <ProfileGrid
        profiles={profiles}
        onProfileClick={handleProfileClick}
        onAddProfile={handleAddProfile}
        onEditProfile={handleProfileClick}
        onDeleteProfile={handleDeleteProfile}
        showActions
        showAddButton
      />

      <p className="text-surface-500 text-sm mt-12 text-center">
        You cannot delete the last profile on your account
      </p>
    </div>
  );
}
