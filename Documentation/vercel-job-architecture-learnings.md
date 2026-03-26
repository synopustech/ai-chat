# Building a Production AI Chat Platform: Architecture Learnings

A technical case study of deploying a self-hosted LLM stack with Vercel as the public-facing edge layer.

---

## What We Built

A full-stack, production-grade AI chat application consisting of:

| Service | Technology | Role |
|---|---|---|
| LLM inference | vLLM + Qwen3.5-122B (NVfp4 quantised) | Chat completions via OpenAI-compatible API |
| TTS | Kokoro-82M (GPU) | Text-to-speech audio synthesis |
| STT / Voice gateway | Faster-Whisper large-v3-turbo (GPU) | Speech-to-text transcription |
| Web search | Python HTTP server + Tavily API | Real-time search context injection |
| Reverse proxy | Nginx (Docker) | Internal API routing and header injection |
| Tunnel | Cloudflare Tunnel (cloudflared) | Zero-config public HTTPS without open inbound ports |
| Edge layer | Vercel Edge Function (proxy) | Public frontend + API proxying with auth |

---

## Architecture Overview

```
Browser (Vercel)
    │
    ├── /api/v1/*        ┐
    ├── /api/search       ├── vercel.json rewrite → /api/proxy (Edge Function)
    └── /api/voice/*     ┘         │
                                   │  injects x-vercel-auth from env var
                                   │  HTTPS via Cloudflare Tunnel
               ┌───────────────────┴────────────────────────┐
               │  api.synopustech.com  → Nginx :3000         │
               │  search.synopustech.com → search :8001      │
               │  voice.synopustech.com  → voice :8002       │
               │                                             │
               │  Nginx :3000                                │
               │    ├── /v1/      → vLLM :8000               │
               │    ├── /search   → search :8001             │
               │    ├── /v1/tts   → tts :8080                │
               │    └── /api/     → voice :8002              │
               └─────────────────────────────────────────────┘
```

For the **local UI** (served directly from the same Nginx container), the auth header is injected by Nginx's `proxy_set_header` directive — no changes needed in the frontend HTML.

For the **Vercel UI**, a single Edge Function (`api/proxy.js`) reads `process.env.API_SECRET` and injects the header before forwarding to the appropriate Cloudflare subdomain. A `vercel.json` rewrite maps all `/api/*` traffic to this one function.

---

## CDN and Edge Networking

### Cloudflare Tunnel
Rather than opening inbound firewall ports, `cloudflared` establishes outbound persistent connections to Cloudflare's edge (using QUIC/HTTP2). Cloudflare then routes public traffic through these tunnels. Key learnings:

- **Connection refused errors** (`dial tcp 127.0.0.1:8002: connect: connection refused`) were caused by Docker containers not publishing port bindings to the host. Cloudflared runs on the host network, so even a healthy container is unreachable unless `ports:` are declared in `docker-compose.yml`.
- Tunnel ingress rules map subdomains (`api.`, `search.`, `tts.`, `voice.`) to different `localhost:<port>` services, effectively acting as a Layer 7 routing table at the edge.
- Protocol negotiation: connections fall back from QUIC to HTTP/2 when network conditions require it, visible in cloudflared logs as `protocol=quic` vs `protocol=http2`.

### Nginx as Internal Reverse Proxy
- **Lazy DNS resolution** (`resolver 127.0.0.11; set $upstream "http://service:port"`) prevents Nginx from crashing at startup when upstream containers haven't yet registered in Docker's DNS.
- **SSE streaming** for LLM token-by-token output requires `proxy_buffering off` and `chunked_transfer_encoding on`. Buffered proxies will hold the response until completion, breaking the streaming UX entirely.
- **Auth header injection**: `proxy_set_header x-vercel-auth "..."` in every `location` block means the local frontend requires zero changes — the proxy layer transparently satisfies the auth requirement backends enforce.

### Routing and Redirects
The application uses a single-origin model at `/` with path-based routing to different backend services, avoiding CORS issues entirely. Vercel's `rewrites` in `vercel.json` mirror this exact pattern at the edge:

```json
{ "source": "/v1/:path*", "destination": "https://api.synopustech.com/v1/:path*" }
```

This is equivalent to an Nginx `proxy_pass` but executed at Vercel's global edge network before the request ever hits the origin server.

---

## AI Enablement

### LLM Serving with vLLM
- vLLM exposes an **OpenAI-compatible API** (`/v1/chat/completions`, `/v1/models`), making it a drop-in for any OpenAI SDK or frontend built against that spec.
- **Streaming (SSE)**: The frontend uses a `ReadableStream` reader consuming `data: {...}` newline-delimited events. `reasoning_content` and `content` deltas are assembled separately to support the model's chain-of-thought (`<think>...</think>`) pattern.
- **Context window management**: Token estimation (`length / 3`) allows `max_tokens` to be calculated dynamically as `contextWindow - used_tokens - buffer`, maximising response length without hitting the model's hard limit.
- **`chat_template_kwargs: { enable_thinking: bool }`** toggles the reasoning mode at the API level without needing a different model or endpoint.

### Multi-modal Pipeline
- **Voice in**: Browser MediaRecorder API captures `audio/webm;codecs=opus` → POSTed to `/api/transcribe` → Faster-Whisper returns transcript → fed directly into `sendMessage()`.
- **Voice out**: Assistant response text is cleaned (strip `<think>` blocks, markdown, code fences) → POSTed to `/api/tts` → Kokoro returns WAV audio → played via `Audio` Web API with `createObjectURL`.
- **Auto-TTS**: When a voice query triggers the STT→chat→TTS pipeline, the entire interaction is hands-free.

### Web Search Augmentation (RAG-lite)
- Query is sent to Tavily's search API before the LLM call.
- Results are appended directly to the user message content as a structured block.
- A search instruction is prepended to the system prompt to guide citation behaviour.
- This is a **retrieval-augmented generation (RAG)** pattern implemented without a vector database — effective for real-time web data that cannot be in the model's training set.

### Asynchronous and Event-Driven Patterns
- vLLM health check uses a `start_period: 1200s` to accommodate GPU model loading time — a critical consideration for any async system with slow cold-start dependencies.
- FastAPI's async request handling means the TTS and voice services can handle concurrent connections while GPU inference runs in a dedicated `ThreadPoolExecutor` off the event loop.
- Docker `depends_on` with `condition: service_healthy` creates a dependency graph that mirrors event-driven startup sequencing.

---

## Vercel: Edge Functions and Deployment

### The `next/server` vs `@vercel/edge` vs Plain Edge Function
Deploying on Vercel without a Next.js project exposes a module resolution hierarchy that trips up most first attempts:

- `next/server` → Next.js internal only; throws `referencing unsupported modules` in framework-agnostic deployments.
- `@vercel/edge` → available in standalone deployments, but `next({ headers })` **adds response headers**, not forwarded request headers. Useless for upstream auth injection.
- **Plain Edge Function with no imports** → correct for a proxy pattern. Just `export default async function handler(req)` using the native `fetch` and `Headers` APIs.

The working pattern:

```js
// vercel/api/proxy.js
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
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }

  const headers = new Headers(req.headers);
  headers.set('x-vercel-auth', process.env.API_SECRET || '');
  headers.delete('host');           // prevent host header mismatch
  headers.delete('content-length'); // let fetch recalculate

  const upstream = await fetch(target, { method: req.method, headers, body: req.body });
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers,
  });
}
```

Paired with a single rewrite in `vercel.json`:

```json
{ "rewrites": [{ "source": "/api/(.*)", "destination": "/api/proxy" }] }
```

### Vercel `/api/` Namespace and Named vs Catch-all Files
Vercel treats the `api/` directory as a reserved namespace for serverless/edge functions. This creates subtle conflicts:

- `api/[...path].js` (catch-all) — Vercel generates a route pattern that does **not** always match when `vercel.json` rewrites are also present. Multiple attempts failed.
- `api/proxy.js` (named file) — always resolves to `/api/proxy`. The rewrite `/api/(.*)` → `/api/proxy` then directs all traffic to this one function, which handles internal routing in code.

**Key insight**: named Edge Function files are resolved first; catch-alls are lower priority and can be shadowed by rewrite rules. When in doubt, use a named file and route in code rather than relying on filename-based catch-alls.

### Environment Variables as Secrets
Hardcoding secrets in source is not safe for public repos. The correct pattern:

1. `api/proxy.js` references `process.env.API_SECRET` — no secret in source.
2. Secret is set in Vercel dashboard → Settings → Environment Variables.
3. Vercel injects it at runtime into the Edge Function's process context.
4. Same secret in server-side `.env` (gitignored), passed to Docker containers via `docker-compose.yml` environment interpolation (`${API_SECRET:-}`).

### Rewrite vs Edge Function for Header Injection
`vercel.json` rewrites alone cannot inject request headers — they only rewrite the URL. An Edge Function is required to mutate headers before the upstream call. The two work together: the rewrite routes all `/api/*` traffic to the Edge Function; the function injects the header and proxies to the correct origin.

---

## Security Considerations (OWASP-aligned)

| Risk | Mitigation |
|---|---|
| Broken Access Control | All API backends reject requests missing `x-vercel-auth` header (401). Health endpoints exempted to preserve uptime monitoring. |
| Security Misconfiguration | Port bindings explicit in `docker-compose.yml`; only necessary ports exposed. vLLM not exposed publicly — only via authenticated Nginx proxy. |
| Sensitive Data Exposure | `API_SECRET` lives in `.env` (gitignored) on server and Vercel environment variables only — never committed to source. |
| Injection | Search query passed to Tavily API — not interpolated into shell or SQL. LLM input is user-controlled by design but sandboxed to API calls only. |

---

## Troubleshooting Cases Encountered

### Case 1 — Cloudflared `connection refused` on TTS and Voice
**Symptom**: `dial tcp 127.0.0.1:8002: connect: connection refused` and `127.0.0.1:8080: connect: connection refused` in cloudflared logs.  
**Root cause**: `tts` and `voice` containers had no `ports:` mapping in `docker-compose.yml`. Docker containers are only reachable from host-network processes (like cloudflared) when ports are explicitly published.  
**Fix**: Added `- "8080:8080"` and `- "8002:8002"` to the respective services, then `docker compose up -d --no-build tts voice`.  
**Lesson**: Container-to-container networking (Docker bridge) is separate from host-network access. Always distinguish which network context a client belongs to.

### Case 2 — Edge Middleware module error (`next/server`)  
**Symptom**: Vercel deployment failed with `referencing unsupported modules: next/server`.  
**Root cause**: `next/server` is a Next.js framework internal unavailable in framework-agnostic Vercel Edge Functions.  
**Fix**: Removed the import entirely. A framework-agnostic Edge Function needs no special imports — `fetch`, `Headers`, `Request`, and `Response` are all globally available in the edge runtime.  
**Lesson**: Vercel's edge runtime has two flavours — Next.js-integrated and standalone. Standalone Edge Functions use Web Platform APIs only; no framework globals needed.

### Case 4 — `@vercel/edge` middleware injects response headers, not request headers
**Symptom**: After fixing the `next/server` error, search still returned 401 from the backend even though middleware appeared to add the auth header.  
**Root cause**: `@vercel/edge`'s `next({ headers: { 'x-vercel-auth': secret } })` adds headers to the **response** sent back to the browser, not to the **upstream** request forwarded to the origin.  
**Fix**: Abandoned the middleware pattern entirely. Replaced with a proxy Edge Function that calls `fetch(target, { headers })` directly, giving full control over the outgoing request headers.  
**Lesson**: Middleware intercepts and can mutate the request object, but `next()` / `NextResponse.next()` with headers applies those headers to the **response**. To inject a header into an **upstream** fetch, you must do the fetch explicitly inside the function.

### Case 5 — Vercel `api/[...path].js` catch-all not matching under rewrites
**Symptom**: Requests to `/api/v1/models` and `/api/v1/chat/completions` returned 404 even with a `[...path].js` catch-all Edge Function in place.  
**Root cause**: `vercel.json` rewrites pointing to `/api/[...path]` conflict with Vercel's own file-based route generation for the `/api/` namespace. The rewrite and the catch-all pattern shadow each other depending on evaluation order.  
**Fix**: Replaced `api/[...path].js` with a named `api/proxy.js` and updated the rewrite destination to `/api/proxy`. The named file always resolves; routing logic was moved into the function body.  
**Lesson**: In the Vercel `/api/` namespace, prefer named files over catch-alls when combined with `vercel.json` rewrites. Route in code rather than relying on filename-based catch-alls when the rewrite and catch-all need to co-exist.

### Case 3 — LLM streaming broken through proxy
**Symptom**: Chat responses appeared all at once after a long delay instead of streaming token-by-token.  
**Root cause**: Default Nginx proxy behaviour buffers the full upstream response before forwarding.  
**Fix**: `proxy_buffering off;` and `proxy_cache off;` in the `/v1/` location block.  
**Lesson**: SSE and chunked-transfer streaming are incompatible with buffered reverse proxies. Any intermediary (Nginx, CDN, load balancer) in the path must have buffering disabled for streaming AI responses to work.

---

## Skills Demonstrated (Mapped to Role)

| Role Requirement | Evidence |
|---|---|
| Hands-on Vercel platform experience | Deployed production app; debugged Edge Function module errors, header injection subtleties, and `/api/` namespace routing; used rewrites + env vars |
| LLM-powered app architecture | End-to-end: inference server, streaming API, RAG search, voice I/O pipeline |
| CDN / edge networking | Cloudflare Tunnel routing, Nginx as reverse proxy, SSE through edge layers |
| Domains, DNS, SSL/TLS | Cloudflare subdomains per service (`api.`, `search.`, `tts.`, `voice.`) with automatic TLS termination |
| Caching and routing rules | Path-based routing with Nginx location blocks mirrored in Vercel rewrites |
| Troubleshooting root causes | Three distinct production issues diagnosed and resolved with clear fix + lesson |
| Security | Header-based auth, secret management via environment variables, health endpoint exemptions |
| Documentation | Runbooks, architecture diagrams, inline comments throughout codebase |
