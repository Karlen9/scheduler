import { NextRequest, NextResponse } from "next/server";

import { getCurrentSessionUser } from "@/lib/session";

type ProxyContext = {
  params: Promise<{ path: string[] }>;
};

function backendBaseUrl(): string {
  const baseUrl = process.env.BACKEND_BASE_URL;
  if (!baseUrl) {
    throw new Error("BACKEND_BASE_URL is required");
  }
  return baseUrl.replace(/\/$/, "");
}

function superadminSecret(): string {
  const secret = process.env.BACKEND_SUPERADMIN_SECRET;
  if (!secret) {
    throw new Error("BACKEND_SUPERADMIN_SECRET is required");
  }
  return secret;
}

async function proxyDashboardRequest(
  request: NextRequest,
  context: ProxyContext,
): Promise<NextResponse> {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await context.params;
  const target = new URL(
    `/superadmin/dashboard/${path.map(encodeURIComponent).join("/")}`,
    backendBaseUrl(),
  );
  target.search = request.nextUrl.search;

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${superadminSecret()}`);
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  const method = request.method.toUpperCase();
  const body =
    method === "GET" || method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  let response: Response;
  try {
    response = await fetch(target, {
      method,
      headers,
      body,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 502 });
  }

  const responseHeaders = new Headers();
  const responseContentType = response.headers.get("content-type");
  if (responseContentType) {
    responseHeaders.set("Content-Type", responseContentType);
  }
  return new NextResponse(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}

export async function GET(
  request: NextRequest,
  context: ProxyContext,
): Promise<NextResponse> {
  return proxyDashboardRequest(request, context);
}

export async function POST(
  request: NextRequest,
  context: ProxyContext,
): Promise<NextResponse> {
  return proxyDashboardRequest(request, context);
}

export async function PUT(
  request: NextRequest,
  context: ProxyContext,
): Promise<NextResponse> {
  return proxyDashboardRequest(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: ProxyContext,
): Promise<NextResponse> {
  return proxyDashboardRequest(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: ProxyContext,
): Promise<NextResponse> {
  return proxyDashboardRequest(request, context);
}
