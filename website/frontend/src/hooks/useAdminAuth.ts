"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface UserData {
  email: string;
  role: string;
  first_name?: string;
}

export function useAdminAuth() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_email");
    localStorage.removeItem("user_name");
    router.push("/login");
  }, [router]);

  // Helper function for authenticated fetches that handles 401
  const authFetch = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const accessToken = localStorage.getItem("access_token");

    if (!accessToken) {
      logout();
      throw new Error("No access token");
    }

    const res = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (res.status === 401) {
      // Token expired or invalid, try to refresh
      const refreshToken = localStorage.getItem("refresh_token");
      if (refreshToken) {
        try {
          const refreshRes = await fetch("/api/auth/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });

          if (refreshRes.ok) {
            const data = await refreshRes.json();
            localStorage.setItem("access_token", data.access_token);
            if (data.refresh_token) {
              localStorage.setItem("refresh_token", data.refresh_token);
            }
            setToken(data.access_token);

            // Retry the original request with new token
            return fetch(url, {
              ...options,
              headers: {
                ...options.headers,
                Authorization: `Bearer ${data.access_token}`,
              },
            });
          }
        } catch {
          // Refresh failed
        }
      }

      // Refresh failed or no refresh token, logout
      logout();
      throw new Error("Session expired. Please login again.");
    }

    return res;
  }, [logout]);

  useEffect(() => {
    const accessToken = localStorage.getItem("access_token");
    const role = localStorage.getItem("user_role");

    if (!accessToken) {
      router.push("/login");
      return;
    }

    if (role !== "admin") {
      router.push("/dashboard");
      return;
    }

    setToken(accessToken);
    setUser({
      email: localStorage.getItem("user_email") || "admin@parentshield.app",
      role: role,
      first_name: localStorage.getItem("user_name") || "Admin",
    });
    setIsLoading(false);
  }, [router]);

  return { user, isLoading, token, router, authFetch, logout };
}
