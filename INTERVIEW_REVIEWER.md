# Vercel Customer Support Engineering Interview Reviewer

## Role Overview

**Position**: Customer Support Engineer  
**Team**: Customer Support Engineering  
**Reporting To**: Manager, Customer Support Engineering  
**Location**: Fully remote (Australia)  
**On-Call**: Weekend/holiday rotation (scheduled in advance)

---

## Core Competencies

### 1. Technical Domain Expertise

#### CDN & Edge Networking
- Domains, DNS, and SSL/TLS lifecycle management
- Caching strategy and cache-invalidation patterns
- Cloud/edge networking fundamentals and routing rules/redirects
- Performance tuning, logs/analytics, and WAF/DDoS understanding
- **Vercel-specific**: Edge Functions, rewrites, Cloudflare Tunnel integration

#### AI Enablement
- Vercel AI Gateway, MCP (Model Context Protocol), and Vercel Agent
- Asynchronous systems (queues, background jobs, event-driven architectures)
- Workflows product comfortability
- Sandbox related configuration and error troubleshooting
- **Vercel-specific**: v0, Next.js, AI SDK

### 2. Support Engineering Skills
- Troubleshooting complex customer cases
- Root cause analysis and driving fixes
- Partnering with Product, Solutions, and Customer Success
- Developing internal tools and scripts for efficiency
- Creating runbooks, guides, and documentation
- Enterprise customer escalations

### 3. Communication & Collaboration
- Clear written and verbal communication
- Explaining complex systems to non-technical audiences
- Working with globally distributed teams
- Mentoring and providing feedback to team members

---

## Vercel-Specific Knowledge

### Architecture Patterns

#### Vercel Edge Layer
- **Edge Functions**: Serverless functions running at the edge
- **Rewrites**: `vercel.json` routing to proxy requests
- **API Proxy Pattern**: Single Edge Function (`api/proxy.js`) handling all `/api/*` traffic

#### Cloudflare Tunnel Integration
- `cloudflared` establishes outbound connections to Cloudflare edge
- QUIC/HTTP2 protocol negotiation
- Ingress rules map subdomains to localhost services
- No inbound firewall ports required

#### Internal Reverse Proxy (Nginx)
- Lazy DNS resolution (`resolver 127.0.0.11`)
- SSE streaming with `proxy_buffering off`
- Auth header injection via `proxy_set_header`

### Key Technologies

| Technology | Purpose |
|------------|---------|
| vLLM | LLM serving via OpenAI-compatible API |
| Next.js | Frontend framework with Edge Functions |
| Cloudflare Tunnel | Zero-config public HTTPS |
| Docker/Docker Compose | Container orchestration |
| Python/FastAPI | Backend services (TTS, search, voice) |

---

## Common Scenarios & Troubleshooting

### 1. 502 Bad Gateway Errors
**Root Causes**:
- Docker network isolation (containers on different networks)
- DNS resolution failures
- Upstream service not healthy

**Fix**: Use `external: true` in docker-compose.yml to reference existing networks

### 2. Infinite Reasoning Loop (Qwen3.5-27B)
**Root Causes**:
- Model not properly generating `</think>` token
- CUDA graph issues

**Fix**:
- `--stop-token-ids 151643` (Qwen3.5's `</think>` token)
- `--enforce-eager` (disables CUDA graph)
- `--max-thinking-steps` (client-side limit)

### 3. Context Window Detection
**Issue**: HTML has hardcoded value, not updated on page load

**Fix**: Update `context-window-val` element directly after fetching model info:
```javascript
const valEl = document.getElementById('context-window-val');
if (valEl) valEl.textContent = cw;
updateContextWindow();
```

### 4. API Endpoint Routing
**Pattern**: Vercel `/api/v1/*` → Cloudflare → Nginx → vLLM

**Configuration**:
- Vercel: `vercel.json` rewrites
- Nginx: `location /api/v1/` proxy to vllm
- Auth: `x-vercel-auth` header injection

---

## Interview Questions & Answers

### Technical Questions

**Q: How does Vercel's Edge Functions differ from traditional serverless?**
> A: Edge Functions run at Cloudflare's edge network (350+ cities) before the request reaches the origin, providing lower latency. They use Deno runtime and support Edge-specific APIs like `fetch` and `Request`/`Response`.

**Q: Explain the Cloudflare Tunnel architecture**
> A: `cloudflared` establishes outbound QUIC/HTTP2 connections to Cloudflare's edge. Public traffic comes through these tunnels, eliminating the need for inbound firewall ports. The tunnel acts as a reverse proxy with built-in DDoS protection.

**Q: How do you troubleshoot a 502 error in a Docker-based architecture?**
> A: Check:
> 1. Container health (`docker ps`, `docker logs`)
> 2. Network connectivity (`docker network inspect`)
> 3. DNS resolution (`docker exec container ping service`)
> 4. Port bindings (`docker-compose.yml` ports section)

**Q: What is the difference between CDN caching and edge caching?**
> A: CDN caching stores static assets at edge locations. Edge caching (like Vercel's) caches dynamic content and API responses at the edge, reducing origin load and latency.

### Scenario-Based Questions

**Scenario**: Customer reports "context window falling back to 32k after refresh"
> **Diagnosis**: HTML element not updated after async API call
> **Solution**: Update DOM element directly in async IIFE, call `updateContextWindow()`

**Scenario**: API endpoint returns 404 through Cloudflare proxy
> **Diagnosis**: Proxy path mismatch or upstream service not running
> **Solution**: Check `vercel.json` rewrites, verify upstream service health, check Cloudflare tunnel logs

---

## Key Learnings from Project

### Docker Networking
- Docker creates networks with `project_networkname` prefix
- Use `external: true` to reference existing networks
- Containers must be on same network for DNS resolution

### Vercel Architecture
- Single-origin model with path-based routing
- Edge Functions handle API proxying with auth
- Cloudflare Tunnel provides public HTTPS without open ports

### AI Enablement
- vLLM provides OpenAI-compatible API
- Streaming (SSE) for token-by-token output
- Context window management with dynamic token estimation

### Performance Optimization
- Lazy DNS resolution prevents startup crashes
- `proxy_buffering off` for SSE streaming
- Chunked transfer encoding for LLM output

---

## Preparation Checklist

- [ ] Review Vercel documentation (Edge Functions, rewrites, Cloudflare integration)
- [ ] Understand Docker networking and troubleshooting
- [ ] Review vLLM architecture and OpenAI API compatibility
- [ ] Practice explaining complex systems simply
- [ ] Prepare examples of customer support experience
- [ ] Review common troubleshooting scenarios
- [ ] Understand async patterns and event-driven architectures

---

## Questions to Ask Interviewer

1. What is the typical case volume and resolution time expectations?
2. How is the team structured (specializations, domain owners)?
3. What internal tools exist, and what improvements are needed?
4. How does the team collaborate with Product and Engineering?
5. What are the current pain points in customer support?
6. What opportunities for automation exist?
7. How is knowledge sharing and documentation maintained?
