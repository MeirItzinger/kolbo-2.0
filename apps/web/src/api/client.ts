import axios from "axios";

const TOKEN_KEY = "kolbo_access_token";
const REFRESH_KEY = "kolbo_refresh_token";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    original._retry = true;

    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }

    try {
      const newToken = await refreshPromise;
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch {
      clearTokens();
      window.location.href = "/login";
      return Promise.reject(error);
    }
  },
);

async function refreshAccessToken(): Promise<string> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) throw new Error("No refresh token");

  const { data } = await axios.post(
    `${import.meta.env.VITE_API_URL || "/api"}/auth/refresh`,
    { refreshToken },
  );

  const result = data.data ?? data;
  setTokens(result.accessToken, result.refreshToken ?? result.sessionId);
  return result.accessToken;
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
