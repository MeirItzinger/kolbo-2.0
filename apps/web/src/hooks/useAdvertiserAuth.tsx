import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  advertiserSignup,
  advertiserLogin,
  advertiserLogout,
  getAdvertiserMe,
  setAdvTokens,
  clearAdvTokens,
  getAdvAccessToken,
} from "@/api/advertiser";
import type { Advertiser } from "@/types";

interface AdvertiserAuthContextValue {
  advertiser: Advertiser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<Advertiser>;
  signup: (payload: {
    email: string;
    password: string;
    companyName: string;
    contactName: string;
    phone?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const AdvertiserAuthContext = createContext<AdvertiserAuthContextValue | null>(
  null
);

export function AdvertiserAuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  const {
    data: advertiser = null,
    isLoading,
  } = useQuery({
    queryKey: ["advertiser", "me"],
    queryFn: getAdvertiserMe,
    enabled: !!getAdvAccessToken(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const loginMutation = useMutation({
    mutationFn: (vars: { email: string; password: string }) =>
      advertiserLogin(vars),
    onSuccess: (result) => {
      setAdvTokens(result.accessToken, result.refreshToken);
      qc.setQueryData(["advertiser", "me"], result.advertiser);
    },
  });

  const signupMutation = useMutation({
    mutationFn: advertiserSignup,
    onSuccess: (result) => {
      setAdvTokens(result.accessToken, result.refreshToken);
      qc.setQueryData(["advertiser", "me"], result.advertiser);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: advertiserLogout,
    onSettled: () => {
      clearAdvTokens();
      qc.setQueryData(["advertiser", "me"], null);
      qc.removeQueries({ queryKey: ["advertiser"] });
    },
  });

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await loginMutation.mutateAsync({ email, password });
      return result.advertiser;
    },
    [loginMutation]
  );

  const signup = useCallback(
    async (payload: {
      email: string;
      password: string;
      companyName: string;
      contactName: string;
      phone?: string;
    }) => {
      await signupMutation.mutateAsync(payload);
    },
    [signupMutation]
  );

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const value = useMemo<AdvertiserAuthContextValue>(
    () => ({
      advertiser,
      isLoading,
      isAuthenticated: !!advertiser,
      login,
      signup,
      logout,
    }),
    [advertiser, isLoading, login, signup, logout]
  );

  return (
    <AdvertiserAuthContext.Provider value={value}>
      {children}
    </AdvertiserAuthContext.Provider>
  );
}

export function useAdvertiserAuth() {
  const ctx = useContext(AdvertiserAuthContext);
  if (!ctx) {
    throw new Error(
      "useAdvertiserAuth must be used within an AdvertiserAuthProvider"
    );
  }
  return ctx;
}
