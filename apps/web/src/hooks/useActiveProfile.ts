import { useState, useEffect } from 'react';

interface Profile {
  id: string;
  name: string;
  avatarUrl?: string | null;
  isKidsProfile?: boolean;
}

const ACTIVE_PROFILE_KEY = 'kolbo_active_profile_id';

export function useActiveProfile() {
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(ACTIVE_PROFILE_KEY);
    if (stored) {
      setActiveProfileIdState(stored);
    }
  }, []);

  const setActiveProfileId = (profileId: string) => {
    localStorage.setItem(ACTIVE_PROFILE_KEY, profileId);
    setActiveProfileIdState(profileId);
  };

  const clearActiveProfile = () => {
    localStorage.removeItem(ACTIVE_PROFILE_KEY);
    setActiveProfileIdState(null);
  };

  return {
    activeProfileId,
    setActiveProfileId,
    clearActiveProfile,
  };
}
