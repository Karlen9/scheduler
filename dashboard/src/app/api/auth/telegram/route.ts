import { NextResponse } from "next/server";

import {
  DASHBOARD_SESSION_COOKIE,
  DASHBOARD_SESSION_MAX_AGE,
  createSessionToken,
  isSecureCookie,
} from "@/lib/session";

import type { DashboardUser } from "@/lib/types";

type BackendAuthResponse = {
  user: {
    id: number | string;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: number | string;
  };
};

function backendBaseUrl(): string {
  const baseUrl = process.env.BACKEND_BASE_URL;
  if (!baseUrl) {
    throw new Error("BACKEND_BASE_URL is required");
  }
  return baseUrl.replace(/\/$/, "");
}

function normalizeUser(data: BackendAuthResponse): DashboardUser {
  return {
    id: Number(data.user.id),
    firstName: data.user.first_name,
    lastName: data.user.last_name,
    username: data.user.username,
    photoUrl: data.user.photo_url,
    authDate: Number(data.user.auth_date),
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let response: Response;
  try {
    response = await fetch(`${backendBaseUrl()}/dashboard/auth/telegram`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 502 });
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: await response.text() },
      { status: response.status },
    );
  }

  const data = (await response.json()) as BackendAuthResponse;
  const user = normalizeUser(data);
  const result = NextResponse.json({ user });
  result.cookies.set(DASHBOARD_SESSION_COOKIE, createSessionToken(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookie(),
    path: "/",
    maxAge: DASHBOARD_SESSION_MAX_AGE,
  });
  return result;
}
