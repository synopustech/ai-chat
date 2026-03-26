// Middleware is intentionally a no-op.
// Auth header injection is handled by the Edge Function proxies in api/.
export default function middleware() {}
export const config = { matcher: [] };
