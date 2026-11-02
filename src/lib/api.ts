export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
let csrf: string | undefined;
export function resetCsrf() {
  csrf = undefined;
}
async function token() {
  if (!csrf) {
    const r = await fetch("/api/auth/csrf", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!r.ok)
      throw new ApiError(
        r.status,
        "The service is unavailable. Please try again.",
      );
    csrf = (await r.json()).token;
  }
  return csrf!;
}
export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers),
    method = (init.method || "GET").toUpperCase();
  if (!["GET", "HEAD"].includes(method)) {
    headers.set("X-CSRF-TOKEN", await token());
    if (!(init.body instanceof FormData))
      headers.set("Content-Type", "application/json");
  }
  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      problem.title ||
        problem.message ||
        (response.status === 401
          ? "Sign in to continue."
          : response.status === 403
            ? "Your account does not have permission for this action."
            : "The service could not complete this request."),
    );
  }
  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
}
export const post = <T = unknown>(path: string, body: unknown = {}) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export const put = <T = unknown>(path: string, body: unknown) =>
  api<T>(path, { method: "PUT", body: JSON.stringify(body) });
