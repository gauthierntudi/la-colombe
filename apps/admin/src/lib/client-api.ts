"use client";

const TOKEN_KEY = "ges_access_token";
const REFRESH_KEY = "ges_refresh_token";
const USER_KEY = "ges_user";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  pointOfSales: { id: string; code: string; name: string; type: string }[];
};

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setSession(accessToken: string, refreshToken: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function updateStoredUser(user: AuthUser) {
  if (typeof window === "undefined") return;
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  const accessToken = getToken();
  if (accessToken && refreshToken) {
    setSession(accessToken, refreshToken, user);
  } else {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
  window.dispatchEvent(new CustomEvent("ges-user-updated", { detail: user }));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`/api/v1${path}`, { ...options, headers });

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers.set("Authorization", `Bearer ${getToken()}`);
      const retry = await fetch(`/api/v1${path}`, { ...options, headers });
      if (!retry.ok) {
        const err = await retry.json();
        throw new Error(err.error?.message ?? "Erreur API");
      }
      return retry.json();
    }
    clearSession();
    window.location.href = "/login";
    throw new Error("Session expirée");
  }

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message ?? "Erreur API");
  }

  return res.json();
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return false;

  try {
    const res = await fetch("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setSession(data.accessToken, data.refreshToken, data.user);
    return true;
  } catch {
    return false;
  }
}

export function formatCdf(amount: number): string {
  return new Intl.NumberFormat("fr-CD", {
    style: "decimal",
    maximumFractionDigits: 0,
  }).format(amount) + " FC";
}
