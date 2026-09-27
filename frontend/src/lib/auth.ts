import "server-only";
import { cookies } from "next/headers";
import { AUTH_COOKIE_MAX_AGE_SECONDS, AUTH_COOKIE_NAME } from "@/lib/auth-constants";

export type LoginResult =
  | { status: "success"; displayName: string }
  | { status: "error"; message: string };

type LoginApiResponse = {
  accessToken: string;
  expiresAt: string;
  displayName: string;
};

export async function getAccessToken(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(AUTH_COOKIE_NAME)?.value?.trim();
  return value && value.length > 0 ? value : null;
}

export async function setSessionCookie(token: string, expiresAt: string): Promise<void> {
  const jar = await cookies();
  const expires = Date.parse(expiresAt);
  const maxAge = Number.isFinite(expires)
    ? Math.max(60, Math.floor((expires - Date.now()) / 1000))
    : AUTH_COOKIE_MAX_AGE_SECONDS;

  jar.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.AUTH_COOKIE_SECURE === "true",
    path: "/",
    maxAge,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(AUTH_COOKIE_NAME);
}

export async function loginWithPassword(
  username: string,
  password: string,
): Promise<LoginResult> {
  const baseUrl = process.env.API_BASE_URL?.trim();
  if (!baseUrl) {
    return {
      status: "error",
      message: "Missing API_BASE_URL. Set it in frontend/.env.local.",
    };
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/auth/login`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
      cache: "no-store",
    });
  } catch {
    return {
      status: "error",
      message: "Could not reach the API. Check that the backend is running.",
    };
  }

  if (response.status === 401) {
    return { status: "error", message: "Invalid username or password." };
  }

  if (response.status === 503) {
    return {
      status: "error",
      message: "Sign-in is not configured on the server yet.",
    };
  }

  if (!response.ok) {
    return { status: "error", message: `Sign-in failed (${response.status}).` };
  }

  const body: unknown = await response.json();
  if (!isLoginResponse(body)) {
    return { status: "error", message: "Sign-in response had an unexpected shape." };
  }

  await setSessionCookie(body.accessToken, body.expiresAt);
  return { status: "success", displayName: body.displayName };
}

function isLoginResponse(value: unknown): value is LoginApiResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.accessToken === "string" &&
    row.accessToken.length > 0 &&
    typeof row.expiresAt === "string" &&
    typeof row.displayName === "string"
  );
}
