import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { getProfiles, createProfile, type Profile } from '@/api/profiles';

interface ProfileContextValue {
  activeProfile: Profile | null;
  profiles: Profile[];
  isLoading: boolean;
  selectProfile: (profile: Profile) => void;
  clearActiveProfile: () => void;
  refreshProfiles: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

const ACTIVE_PROFILE_KEY = 'kolbo_active_profile_id';

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, isLoading: isAuthLoading } = useAuth();
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Fetch profiles only if authenticated
  const { data: profiles = [], isLoading: isProfilesLoading, refetch } = useQuery({
    queryKey: ['profiles'],
    queryFn: getProfiles,
    enabled: isAuthenticated,
  });

  const createProfileMutation = useMutation({
    mutationFn: createProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });

  const selectProfile = useCallback((profile: Profile) => {
    localStorage.setItem(ACTIVE_PROFILE_KEY, profile.id);
    setActiveProfile(profile);
  }, []);

  const clearActiveProfile = useCallback(() => {
    localStorage.removeItem(ACTIVE_PROFILE_KEY);
    setActiveProfile(null);
  }, []);

  const refreshProfiles = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Main logic: Profile Enforcement
  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) return;
    if (isProfilesLoading) return;

    const storedProfileId = localStorage.getItem(ACTIVE_PROFILE_KEY);

    // Case 1: No profiles exist -> Auto-create first profile
    if (profiles.length === 0 && !createProfileMutation.isPending) {
      const createDefault = async () => {
        try {
          const newProfile = await createProfileMutation.mutateAsync({
            name: user?.firstName || 'User',
            isKidsProfile: false,
          });
          selectProfile(newProfile);
        } catch (err) {
          console.error('Failed to create default profile', err);
        }
      };
      createDefault();
      return;
    }

    // Case 2: Only 1 profile exists -> Auto-select if nothing active
    if (profiles.length === 1 && !storedProfileId) {
      if (profiles[0].isLocked) {
        if (location.pathname !== '/profiles' && !location.pathname.startsWith('/login')) {
          navigate('/profiles', { replace: true });
        }
      } else {
        selectProfile(profiles[0]);
      }
      return;
    }

    // Case 3: Validate active profile exists and belongs to current user
    if (storedProfileId) {
      const found = profiles.find(p => p.id === storedProfileId);
      if (found) {
        if (activeProfile?.id !== found.id) {
          setActiveProfile(found);
        }
      } else {
        // Invalid profile ID (maybe deleted)
        clearActiveProfile();
        if (location.pathname !== '/profiles' && !location.pathname.startsWith('/login')) {
          navigate('/profiles', { replace: true });
        }
      }
    } else {
      // No profile selected -> Redirect to selection screen
      // Except if we are already on profiles page or some auth routes
      if (
        location.pathname !== '/profiles' && 
        !location.pathname.includes('/account/profiles') && // Don't redirect if we are managing them
        !location.pathname.startsWith('/login') &&
        !location.pathname.startsWith('/signup')
      ) {
        navigate('/profiles', { replace: true });
      }
    }
  }, [
    isAuthenticated, 
    isAuthLoading, 
    isProfilesLoading, 
    profiles, 
    activeProfile, 
    location.pathname, 
    navigate, 
    selectProfile, 
    clearActiveProfile, 
    createProfileMutation,
    user
  ]);

  return (
    <ProfileContext.Provider
      value={{
        activeProfile,
        profiles,
        isLoading: isProfilesLoading,
        selectProfile,
        clearActiveProfile,
        refreshProfiles,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
