# Cloudflare Tunnel Setup for Vercel + Local Backend

## Overview

This guide explains how to set up a Cloudflare Tunnel to connect your Vercel frontend with your local backend services (vLLM, TTS, search, voice).

## Architecture

```
┌─────────────────┐         ┌──────────────────┐
│   Vercel App    │────────>│  Cloudflare Tunnel│
│  (Frontend)     │<────────│  (cloudflared)   │
└─────────────────┘         └──────────────────┘
                                   │
                                   ▼
                           ┌─────────────────┐
                           │  Local Backend  │
                           │  (Your Machine) │
                           │  RTX Pro 6000   │
                           └─────────────────┘
```

## Prerequisites

1. **Cloudflare Account**: Free tier sufficient
2. **Domain**: Either use an existing domain or register a new one
3. **Docker & Docker Compose**: Already installed on your machine
4. **Node.js**: Required for `cloudflared` installation

## Step-by-Step Setup

### Step 1: Install Cloudflared

```bash
# Download and install cloudflared
curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb

# Verify installation
cloudflared --version
```

### Step 2: Authenticate with Cloudflare

```bash
# Login to Cloudflare
cloudflared login

# This will open a browser window to authenticate
# Follow the instructions to complete the login
```

### Step 3: Create Tunnel Configuration

Create a tunnel configuration file:

```bash
# Create tunnel
cloudflared tunnel create qwen-chat-tunnel

# This creates a .json file in ~/.cloudflared/ with your tunnel credentials
```

### Step 4: Configure Tunnel Routes

Create a routes configuration file (`tunnel-routes.yaml`):

```yaml
- service: http://localhost:8000
  hostname: api.yourdomain.com
- service: http://localhost:8001
  hostname: search.yourdomain.com
- service: http://localhost:8080
  hostname: tts.yourdomain.com
- service: http://localhost:8002
  hostname: voice.yourdomain.com
```

### Step 5: Run Cloudflared Tunnel

```bash
# Start the tunnel
cloudflared tunnel --config tunnel-routes.yaml

# Or run as a daemon
cloudflared tunnel run qwen-chat-tunnel
```

### Step 6: Configure DNS in Cloudflare

In your Cloudflare dashboard:

1. Go to **DNS** tab
2. Add A records for each service:
   - `api.yourdomain.com` → Points to `127.0.0.1` (or leave as CNAME)
   - `search.yourdomain.com` → Points to `127.0.0.1`
   - `tts.yourdomain.com` → Points to `127.0.0.1`
   - `voice.yourdomain.com` → Points to `127.0.0.1`

### Step 7: Update Vercel Frontend

Update your frontend configuration to use the tunnel URLs:

```javascript
// In your frontend code or environment variables
const API_BASE_URL = 'https://api.yourdomain.com';
const SEARCH_URL = 'https://search.yourdomain.com';
const TTS_URL = 'https://tts.yourdomain.com';
const VOICE_URL = 'https://voice.yourdomain.com';
```

### Step 8: Configure CORS on Local Backend

Add CORS headers to your backend services to allow requests from Vercel:

#### For search_server.py:

```python
# Add at the top of your handler
def set_cors_headers(self):
    self.send_header('Access-Control-Allow-Origin', '*')
    self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
```

#### For FastAPI services (TTS, voice):

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or specify your Vercel domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Security Considerations

### 1. Restrict CORS to Your Domain

Instead of `*`, specify your Vercel domain:

```python
allow_origins=["https://your-app.vercel.app"]
```

### 2. Add API Keys or Tokens

Add authentication to your tunnel endpoints:

```bash
# Add authentication header to cloudflared
cloudflared tunnel --token YOUR_AUTH_TOKEN
```

### 3. Use HTTPS Only

Cloudflare automatically handles SSL/TLS, ensuring all traffic is encrypted.

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Ensure your local services are running
   - Check firewall settings
   - Verify port numbers match

2. **DNS Not Resolving**
   - Wait for DNS propagation (can take up to 24 hours, usually much faster)
   - Check Cloudflare DNS settings
   - Try `cloudflared tunnel inspect` to verify tunnel status

3. **CORS Errors**
   - Add CORS headers to your backend
   - Check Cloudflare firewall settings
   - Verify Vercel domain is in allowed origins

### Debug Commands

```bash
# Check tunnel status
cloudflared tunnel list

# Inspect specific tunnel
cloudflared tunnel inspect TUNNEL_NAME

# View logs
cloudflared tunnel run TUNNEL_NAME --loglevel debug
```

## Alternative: Single Endpoint Approach

If you prefer a simpler setup with a single endpoint:

```yaml
# tunnel-routes.yaml
- service: http://localhost:8000
  hostname: api.yourdomain.com
- service: http://localhost:8001
  path: /search
- service: http://localhost:8080
  path: /api/tts
- service: http://localhost:8002
  path: /api/transcribe
```

This routes different paths to different local services.

## Cost Estimate

- **Cloudflare Free Tier**: $0/month
- **Domain Registration**: ~$10-15/year (if you don't have one)
- **Total**: ~$0-15/year

## Benefits of This Approach

1. **No Intermediate VM**: Direct connection from Vercel to your local machine
2. **Free Tier**: Cloudflare's free tier is generous for most use cases
3. **Automatic SSL**: Cloudflare handles all SSL/TLS certificates
4. **Global CDN**: Vercel + Cloudflare provides global edge network
5. **Security**: Built-in DDoS protection and WAF
6. **Low Latency**: Cloudflare's edge network routes traffic efficiently

## Next Steps

1. Set up your domain in Cloudflare
2. Install and configure `cloudflared`
3. Test each endpoint individually
4. Update your Vercel frontend configuration
5. Monitor and optimize based on usage patterns

## References

- [Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [cloudflared GitHub](https://github.com/cloudflare/cloudflared)
- [Vercel Deployment Documentation](https://vercel.com/docs)