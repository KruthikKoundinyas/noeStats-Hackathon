const configuredUrl =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const fallbackUrl = "http://localhost:4000";
let activeUrl = configuredUrl;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

async function requestFrom<T>(
  baseUrl: string,
  path: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      response.status,
      body.error || "Request failed",
      body.details,
    );
  return body as T;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    const result = await requestFrom<T>(activeUrl, path, init);
    return result;
  } catch (error) {
    if (error instanceof ApiError || configuredUrl !== "http://localhost:5000")
      throw error;
    const alternateUrl = activeUrl === configuredUrl ? fallbackUrl : configuredUrl;
    const result = await requestFrom<T>(alternateUrl, path, init);
    activeUrl = alternateUrl;
    return result;
  }
}

export function getApiUrl() {
  return activeUrl;
}
