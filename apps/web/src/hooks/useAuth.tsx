import {
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import * as authApi from "@/api/auth";
import {
  setTokens,
  clearTokens,
  getAccessToken,
  setUscreenAccessToken,
  clearUscreenAccessToken,
  getUscreenAccessToken,
} from "@/api/client";
import type { User, RoleName } from "@/types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isToveedoUser: boolean;
  login: (email: string, password: string) => Promise<User>;
  loginToveedo: (email: string, password: string) => Promise<User>;
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
      if (!getAccessToken()) {
        // Uscreen-only session: user object lives in sessionStorage
        const uscreenUser = sessionStorage.getItem("kolbo_uscreen_user");
        if (uscreenUser && getUscreenAccessToken()) {
          try {
            return JSON.parse(uscreenUser) as User;
          } catch {
            return null;
          }
        }
        return null;
      }
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
    onSuccess: (res: any) => {
      setTokens(res.accessToken, res.refreshToken ?? res.sessionId);
      qc.setQueryData(AUTH_QUERY_KEY, res.user);
    },
  });

  const loginToveedoMutation = useMutation({
    mutationFn: (vars: { email: string; password: string }) =>
      authApi.loginToveedo(vars),
    onSuccess: (res: any) => {
      if (res.uscreenAccessToken) {
        clearTokens();
        setUscreenAccessToken(res.uscreenAccessToken);
        const userWithChannel = { ...res.user, channelSlug: res.channelSlug ?? "toveedo" };
        sessionStorage.setItem("kolbo_uscreen_user", JSON.stringify(userWithChannel));
      }
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
    mutationFn: async () => {
      if (getAccessToken()) {
        await authApi.logout();
      }
    },
    onSettled: () => {
      clearTokens();
      clearUscreenAccessToken();
      sessionStorage.removeItem("kolbo_uscreen_user");
      qc.setQueryData(AUTH_QUERY_KEY, null);
      qc.clear();
    },
  });

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await loginMutation.mutateAsync({ email, password });
      return result.user;
    },
    [loginMutation],
  );

  const loginToveedo = useCallback(
    async (email: string, password: string) => {
      const result = await loginToveedoMutation.mutateAsync({ email, password });
      return result.user;
    },
    [loginToveedoMutation],
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

  const isToveedoUser = !!user && !getAccessToken() && !!getUscreenAccessToken();

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isToveedoUser,
        login,
        loginToveedo,
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
