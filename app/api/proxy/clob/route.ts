/**
 * CLOB Proxy — forwards Polymarket CLOB requests from US Vercel edge
 * Bypasses Australian geoblock on the VPS
 */

export const dynamic = "force-dynamic";
export const preferredRegion = "iad1"; // Force US East — bypass AU Polymarket geoblock

const CLOB_BASE = "https://clob.polymarket.com";

export async function POST(request: Request) {
  const url = new URL(request.url);
  // Extract the CLOB path after /api/proxy/clob
  const clobPath = url.searchParams.get("path") || "/order";

  const body = await request.text();

  // Forward all POLY_* auth headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  request.headers.forEach((v, k) => {
    if (k.toLowerCase().startsWith("poly_") || k.toLowerCase() === "content-type") {
      headers[k] = v;
    }
  });

  const res = await fetch(CLOB_BASE + clobPath, {
    method: "POST",
    headers,
    body,
  });

  const json = await res.json().catch(() => ({}));
  return Response.json(json, { status: res.status });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clobPath = url.searchParams.get("path") || "/";

  const headers: Record<string, string> = {};
  request.headers.forEach((v, k) => {
    if (k.toLowerCase().startsWith("poly_")) headers[k] = v;
  });

  const res = await fetch(CLOB_BASE + clobPath, { headers });
  const json = await res.json().catch(() => ({}));
  return Response.json(json, { status: res.status });
}
