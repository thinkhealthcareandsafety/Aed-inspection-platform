/**
 * The visitor's approximate location, from the headers Vercel adds to every
 * request after looking up the caller's IP. Costs no lookup service and no
 * permission prompt. Empty off Vercel (local dev), where the headers are absent.
 *
 * Served here rather than by the backend because only the frontend's host
 * sees these headers; this route takes precedence over the /api rewrite.
 */
export const dynamic = 'force-dynamic';

function header(request: Request, name: string): string | undefined {
  const value = request.headers.get(name);
  if (!value) return undefined;
  try {
    // Vercel URI-encodes the city so non-ASCII names survive the header.
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function coordinate(request: Request, name: string): number | undefined {
  const value = Number(request.headers.get(name));
  return request.headers.get(name) && Number.isFinite(value) ? value : undefined;
}

export function GET(request: Request) {
  return Response.json(
    {
      city: header(request, 'x-vercel-ip-city'),
      region: header(request, 'x-vercel-ip-country-region'),
      country: header(request, 'x-vercel-ip-country'),
      latitude: coordinate(request, 'x-vercel-ip-latitude'),
      longitude: coordinate(request, 'x-vercel-ip-longitude'),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
