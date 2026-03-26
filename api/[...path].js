export const config = { runtime: 'edge' };

// Catch-all proxy for /api/* → voice.synopustech.com/api/*
export default async function handler(req) {
  const url = new URL(req.url);
  const target = `https://voice.synopustech.com${url.pathname}${url.search}`;

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
