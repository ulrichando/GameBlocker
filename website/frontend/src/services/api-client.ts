/**
 * Base API client with authentication and token refresh handling.
 * Following Next.js best practices for API service layer.
 */

const API_URL = "/api";

export interface ApiError {
  message: string;
  status: number;
  detail?: string;
}

export class ApiClientError extends Error {
  status: number;
  detail?: string;

  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.detail = detail;
  }
}

/**
 * Refresh the access token using the refresh token.
 * Returns the new access token or null if refresh failed.
 */
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.data?.accessToken) {
        localStorage.setItem("access_token", data.data.accessToken);
        if (data.data.refreshToken) {
          localStorage.setItem("refresh_token", data.data.refreshToken);
        }
        return data.data.accessToken;
      }
    }
  } catch {
    // Refresh failed
  }

  return null;
}

/**
 * Clear authentication tokens and redirect to login.
 */
function clearAuthAndRedirect(): void {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user_role");
  localStorage.removeItem("user_email");
  localStorage.removeItem("user_name");
  window.location.href = "/login";
}

/**
 * Make an authenticated API request with automatic token refresh.
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const accessToken = localStorage.getItem("access_token");

  if (!accessToken) {
    clearAuthAndRedirect();
    throw new ApiClientError("No access token", 401);
  }

  const url = `${API_URL}${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    ...(options.headers as Record<string, string>),
  };

  let response = await fetch(url, { ...options, headers });

  // Handle token expiration
  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      // Retry with new token
      headers.Authorization = `Bearer ${newToken}`;
      response = await fetch(url, { ...options, headers });
    } else {
      clearAuthAndRedirect();
      throw new ApiClientError("Session expired", 401);
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiClientError(
      errorData.detail || errorData.message || "Request failed",
      response.status,
      errorData.detail
    );
  }

  // Handle empty responses (204 No Content)
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

/**
 * GET request helper
 */
export async function apiGet<T>(endpoint: string): Promise<T> {
  return apiRequest<T>(endpoint, { method: "GET" });
}

/**
 * POST request helper
 */
export async function apiPost<T>(endpoint: string, data?: unknown): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: "POST",
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PUT request helper
 */
export async function apiPut<T>(endpoint: string, data?: unknown): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: "PUT",
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * DELETE request helper
 */
export async function apiDelete<T>(endpoint: string): Promise<T> {
  return apiRequest<T>(endpoint, { method: "DELETE" });
}

/**
 * Build query string from params object
 */
export function buildQueryString(
  params: Record<string, string | number | boolean | undefined>
): string {
  const filtered = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== ""
  );
  if (filtered.length === 0) return "";
  return "?" + new URLSearchParams(
    filtered.map(([key, value]) => [key, String(value)])
  ).toString();
}

export { API_URL };
