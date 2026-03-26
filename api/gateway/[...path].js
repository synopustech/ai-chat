export const config = { runtime: 'edge' };

// Proxy /api/* → voice.synopustech.com/api/*
// Vercel rewrites /api/:path* → /api/gateway/:path*, so we reconstruct the original /api/ prefix.
export default async function handler(req) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/gateway/, '/api');
  const target = `https://voice.synopustech.com${path}${url.search}`;

  const headers = new Headers(req.headers);
  headers.set('x-vercel-auth', process.env.API_SECRET || '');
  headers.delete('host');
  headers.delete('content-length');

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
  });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers,
  });
}
