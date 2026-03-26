export const config = { runtime: 'edge' };

export default async function handler(req) {
  const url = new URL(req.url);
  const pathname = url.pathname;

  let target;

  if (pathname.startsWith('/api/v1/')) {
    target = `https://api.synopustech.com${pathname.replace('/api/v1/', '/v1/')}${url.search}`;
  } else if (pathname === '/api/search') {
    target = `https://search.synopustech.com/search${url.search}`;
  } else if (pathname.startsWith('/api/voice/')) {
    target = `https://voice.synopustech.com${pathname.replace('/api/voice/', '/api/')}${url.search}`;
  } else {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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
