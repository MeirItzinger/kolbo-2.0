import {
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import * as authApi from "@/api/auth";
import { setTokens, clearTokens, getAccessToken } from "@/api/client";
import type { User, RoleName } from "@/types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (
    role: RoleName,
    channelId?: string,
    creatorProfileId?: string,
  ) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_QUERY_KEY = ["auth", "me"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  const {
    data: user = null,
    isLoading,
  } = useQuery<User | null>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async () => {
      if (!getAccessToken()) return null;
      try {
        return await authApi.getMe();
      } catch {
        clearTokens();
        return null;
      }
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: (vars: { email: string; password: string }) =>
      authApi.login(vars),
    onSuccess: (res) => {
      setTokens(res.accessToken, res.refreshToken ?? res.sessionId);
      qc.setQueryData(AUTH_QUERY_KEY, res.user);
    },
  });

  const signupMutation = useMutation({
    mutationFn: authApi.signup,
    onSuccess: (res) => {
      setTokens(res.accessToken, res.refreshToken ?? res.sessionId);
      qc.setQueryData(AUTH_QUERY_KEY, res.user);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      clearTokens();
      qc.setQueryData(AUTH_QUERY_KEY, null);
      qc.clear();
    },
  });

  const login = useCallback(
    async (email: string, password: string) => {
      await loginMutation.mutateAsync({ email, password });
    },
    [loginMutation],
  );

  const signup = useCallback(
    async (payload: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    }) => {
      await signupMutation.mutateAsync(payload);
    },
    [signupMutation],
  );

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const hasRole = useCallback(
    (role: RoleName, channelId?: string, creatorProfileId?: string) => {
      if (!user) return false;
      if (!user.roles) return false;

      return user.roles.some((r: any) => {
        const key = typeof r === "string" ? r : r.role?.key ?? r.name ?? r.key;
        if (key !== role) return false;
        if (channelId && typeof r !== "string" && r.channelId !== channelId) return false;
        if (creatorProfileId && typeof r !== "string" && r.creatorProfileId !== creatorProfileId) return false;
        return true;
      });
    },
    [user],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
