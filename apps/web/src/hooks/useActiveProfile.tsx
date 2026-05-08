import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { listProfiles } from "@/api/profiles";
import {
  getParentalControls,
  type ParentalControls,
} from "@/api/parentalControls";
import type { Profile } from "@/types";

const STORAGE_KEY = "kolbo_active_profile_id";

interface ActiveProfileContextValue {
  profiles: Profile[];
  activeProfile: Profile | null;
  parentalControls: ParentalControls | null;
  isLoading: boolean;
  setActiveProfile: (profile: Profile | null) => void;
  clearActiveProfile: () => void;
  refresh: () => Promise<void>;
}

const ActiveProfileContext = createContext<ActiveProfileContextValue | null>(
  null,
);

const PROFILES_KEY = ["profiles", "list"] as const;

function readStoredId(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

function writeStoredId(id: string | null) {
  if (typeof localStorage === "undefined") return;
  if (id) localStorage.setItem(STORAGE_KEY, id);
  else localStorage.removeItem(STORAGE_KEY);
}

export function ActiveProfileProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const qc = useQueryClient();
  const [activeId, setActiveIdState] = useState<string | null>(() =>
    readStoredId(),
  );

  const {
    data: profiles = [],
    isLoading,
    isFetching,
    isFetched,
  } = useQuery<Profile[]>({
    queryKey: PROFILES_KEY,
    queryFn: listProfiles,
    enabled: isAuthenticated,
    staleTime: 1000 * 60,
  });

  // Reset only on a *confirmed* logout. Without the auth-loading guard the
  // initial render (before /api/auth/me resolves) would mis-classify the user
  // as logged out and silently wipe the saved profile id from localStorage.
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setActiveIdState(null);
      writeStoredId(null);
    }
  }, [authLoading, isAuthenticated]);

  // If the stored profile id genuinely no longer belongs to this user, drop
  // it. Skip while a refetch is in flight — otherwise creating a new profile
  // (which invalidates the list) would briefly see a stale list missing the
  // brand-new id and incorrectly clear the just-set active profile.
  useEffect(() => {
    if (!activeId) return;
    if (!isFetched || isFetching) return;
    if (!profiles.length) return;
    if (!profiles.some((p) => p.id === activeId)) {
      setActiveIdState(null);
      writeStoredId(null);
    }
  }, [activeId, profiles, isFetched, isFetching]);

  const activeProfile = useMemo<Profile | null>(() => {
    if (!activeId) return null;
    return profiles.find((p) => p.id === activeId) ?? null;
  }, [activeId, profiles]);

  const { data: parentalControls = null } = useQuery<ParentalControls | null>({
    queryKey: ["profiles", activeProfile?.id, "parental-controls"],
    queryFn: () => getParentalControls(activeProfile!.id),
    enabled: !!activeProfile,
    staleTime: 1000 * 30,
  });

  const setActiveProfile = useCallback((profile: Profile | null) => {
    const id = profile?.id ?? null;
    setActiveIdState(id);
    writeStoredId(id);
  }, []);

  const clearActiveProfile = useCallback(() => {
    setActiveIdState(null);
    writeStoredId(null);
  }, []);

  const refresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: PROFILES_KEY });
  }, [qc]);

  // Touch user to silence unused warning while keeping it referenced for future per-user logic.
  void user;

  const value: ActiveProfileContextValue = {
    profiles,
    activeProfile,
    parentalControls,
    isLoading,
    setActiveProfile,
    clearActiveProfile,
    refresh,
  };

  return (
    <ActiveProfileContext.Provider value={value}>
      {children}
    </ActiveProfileContext.Provider>
  );
}

export function useActiveProfile(): ActiveProfileContextValue {
  const ctx = useContext(ActiveProfileContext);
  if (!ctx) {
    throw new Error(
      "useActiveProfile must be used within an ActiveProfileProvider",
    );
  }
  return ctx;
}
