import { NextResponse } from 'next/server';

const BACKEND_URL =
  process.env.URL_BACKEND ||
  process.env.NEXT_PUBLIC_URL_BACKEND ||
  'http://127.0.0.1:8000';

const BACKEND_BASE = BACKEND_URL.replace(/\/$/, '');

async function proxy(
  request: Request,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path: pathArray } = await params;
  const path = pathArray?.join('/') ?? '';
  const search = new URL(request.url).search;
  const backendUrl = ${BACKEND_BASE}/src/app/api/backend/[...path]/route.ts;

  const headers = new Headers(request.headers);
  headers.delete('host');

  const body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
    ? await request.arrayBuffer()
    : undefined;

  try {
    const controller = new AbortController();
    // Timeout de 25 secondes (Render free met ~30s à se réveiller)
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(backendUrl, {
      method: request.method,
      headers,
      body: body ?? null,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete('content-encoding');

    const responseBody = await response.arrayBuffer();
    return new NextResponse(responseBody, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    const estTimeOut = message.includes('abort') || message.includes('timed out') || message.includes('Timeout');
    const estConnexion = message.includes('fetch') || message.includes('ECONNREFUSED') || message.includes('ENOTFOUND');

    const code_erreur = estTimeOut ? 'BACKEND_TIMEOUT' : estConnexion ? 'BACKEND_INDISPONIBLE' : 'ERREUR_PROXY';
    const message_utilisateur = estTimeOut
      ? 'Le serveur met du temps à répondre. Veuillez réessayer dans quelques instants.'
      : estConnexion
        ? 'Le serveur backend est temporairement indisponible. Rafraîchissez la page.'
        : 'Erreur de connexion au serveur.';

    return NextResponse.json(
      {
        code_erreur,
        message: message_utilisateur,
        details: { erreur_technique: message },
        request_id: null,
      },
      { status: 503 }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;