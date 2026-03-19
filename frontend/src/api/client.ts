import type { ApiError } from "@/types/api";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";
const TOKEN_KEY = "access_token";

class ApiClientError extends Error {
  status: number;
  detail?: unknown;

  constructor(error: ApiError) {
    super(error.message);
    this.name = "ApiClientError";
    this.status = error.status;
    this.detail = error.detail;
  }
}

/** Store the JWT token (call after login/register). */
function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/** Remove the stored token (call on logout). */
function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** Get the stored token, or null if not set. */
function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${BASE_URL}${path}`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // Inject auth token if available
  const token = getToken();
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let detail: unknown;
    try {
      detail = await response.json();
    } catch {
      detail = await response.text();
    }

    throw new ApiClientError({
      status: response.status,
      message: `Request failed: ${response.status} ${response.statusText}`,
      detail,
    });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export { apiRequest, ApiClientError, setToken, clearToken, getToken };
