import { next } from '@vercel/edge';

export default function middleware(request) {
  return next({
    headers: { 'x-vercel-auth': process.env.API_SECRET },
  });
}

export const config = {
  matcher: ['/v1/:path*', '/search', '/api/:path*'],
};
