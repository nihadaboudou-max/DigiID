import { NextResponse } from "next/server";

const BACKEND_URL =
  process.env.URL_BACKEND ||
  process.env.NEXT_PUBLIC_URL_BACKEND ||
  "http://127.0.0.1:8000";

const BACKEND_BASE = BACKEND_URL.replace(/\/$/, "");

async function proxy(
  request: Request,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path: pathArray } = await params;
  const path = pathArray?.join("/") ?? "";
  const search = new URL(request.url).search;
  const backendUrl = `${BACKEND_BASE}/${path}${search}`;

  const headers = new Headers(request.headers);
  headers.delete("host");

      const body = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method)
    ? await request.arrayBuffer()
    : undefined;

  const response = await fetch(backendUrl, {
    method: request.method,
    headers,
    body: body ?? null,
  });

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("content-encoding");

  const responseBody = await response.arrayBuffer();
  return new NextResponse(responseBody, {
    status: response.status,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
