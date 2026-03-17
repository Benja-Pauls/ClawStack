import type { ApiError } from "@/types/api";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

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

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${BASE_URL}${path}`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

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

export { apiRequest, ApiClientError };
