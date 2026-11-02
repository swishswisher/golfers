import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Session } from "./contracts";
export class ServerApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function serverApi<T>(path: string): Promise<T> {
  const jar = await cookies();
  let response: Response;
  try {
    response = await fetch(
      (process.env.API_INTERNAL_URL || "http://127.0.0.1:5225") + path,
      {
        headers: { cookie: jar.toString() },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      },
    );
  } catch {
    throw new ServerApiError(
      503,
      "The club service is temporarily unavailable. Please retry.",
    );
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ServerApiError(
      response.status,
      body.title || "The requested information is unavailable.",
    );
  }
  return (await response.json()) as T;
}
export const getSession = cache(() => serverApi<Session>("/api/auth/me"));
