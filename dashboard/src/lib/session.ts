import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

import type { DashboardUser } from "./types";

export const DASHBOARD_SESSION_COOKIE = "dashboard_session";
export const DASHBOARD_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

type SessionPayload = {
  user: DashboardUser;
  expiresAt: number;
};

function getSessionSecret(): string {
  const secret = process.env.DASHBOARD_SESSION_SECRET;
  if (!secret) {
    throw new Error("DASHBOARD_SESSION_SECRET is required");
  }
  return secret;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createSessionToken(user: DashboardUser): string {
  const payload: SessionPayload = {
    user,
    expiresAt: Date.now() + DASHBOARD_SESSION_MAX_AGE * 1000,
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function verifySessionToken(token?: string): DashboardUser | null {
  if (!token) {
    return null;
  }
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature || !safeEqual(sign(encoded), signature)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as SessionPayload;
    if (!payload.user?.id || payload.expiresAt < Date.now()) {
      return null;
    }
    return payload.user;
  } catch {
    return null;
  }
}

export async function getCurrentSessionUser(): Promise<DashboardUser | null> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(DASHBOARD_SESSION_COOKIE)?.value);
}

export function isSecureCookie(): boolean {
  return process.env.NODE_ENV === "production";
}
