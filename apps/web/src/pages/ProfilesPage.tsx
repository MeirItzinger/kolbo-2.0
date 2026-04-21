import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '@/components/ui/Spinner';
import { ProfileGrid } from '@/components/profiles';
import { VerifyPinDialog } from '@/components/pin/VerifyPinDialog';
import { useProfile } from '@/hooks/useProfile';
import { verifyProfilePin } from '@/api/profiles';

export default function ProfilesPage() {
  const navigate = useNavigate();
  const { profiles, isLoading, selectProfile } = useProfile();
  
  const [verifyingProfile, setVerifyingProfile] = useState<any | null>(null);

  const handleProfileClick = (profile: any) => {
    if (profile.isLocked) {
      setVerifyingProfile(profile);
    } else {
      activateProfile(profile);
    }
  };

  const activateProfile = (profile: any) => {
    selectProfile(profile);
    setTimeout(() => {
      navigate('/');
    }, 300);
  };

  const handleVerifyPin = async (pin: string) => {
    if (!verifyingProfile) return false;
    try {
      await verifyProfilePin(verifyingProfile.id, pin);
      activateProfile(verifyingProfile);
      setVerifyingProfile(null);
      return true;
    } catch (err) {
      return false;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

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

      <VerifyPinDialog
        open={!!verifyingProfile}
        onOpenChange={(open) => !open && setVerifyingProfile(null)}
        onVerify={handleVerifyPin}
        title="Profile Locked"
        description={`Enter PIN for ${verifyingProfile?.name}`}
      />
    </div>
  );
}
