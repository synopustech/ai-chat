import { NextResponse } from 'next/server';

export function middleware(request) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-vercel-auth', process.env.API_SECRET);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/v1/:path*', '/search', '/api/:path*'],
};
