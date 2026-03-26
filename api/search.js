export const config = { runtime: 'edge' };

export default async function handler(req) {
  const url = new URL(req.url);
  const target = `https://search.synopustech.com/search${url.search}`;

  const headers = new Headers(req.headers);
  headers.set('x-vercel-auth', process.env.API_SECRET || '');
  headers.delete('host');

  const upstream = await fetch(target, { method: req.method, headers });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers,
  });
}
