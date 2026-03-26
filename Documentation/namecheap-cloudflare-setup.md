# Namecheap Domain + Cloudflare Setup Guide

## Overview

This guide walks you through connecting your Namecheap domain to Cloudflare and setting up the Cloudflare Tunnel for your Vercel + local backend architecture.

## Prerequisites

- Namecheap account with a registered domain
- Computer with internet access (for setup)
- Your local machine with Docker/RTX Pro 6000 (for running backend)

---

## Part 1: Add Domain to Cloudflare

### Step 1: Create Cloudflare Account

1. Go to [cloudflare.com](https://www.cloudflare.com)
2. Click **"Sign Up"** (top right)
3. Enter your email and create a password
4. Verify your email address

### Step 2: Add Your Domain to Cloudflare

1. After logging in, click **"Add a Site"**
2. Enter your domain name (e.g., `example.com`)
3. Click **"Add Site"**
4. Cloudflare will scan your current DNS records (this may take 1-2 minutes)

### Step 3: Choose a Plan

1. Select the **Free plan** (you can upgrade later if needed)
2. Click **"Continue to DNS"**

### Step 4: Update Namecheap Name Servers

1. In Cloudflare, you'll see a screen showing the two name servers you need to use:
   - `lara.cloudflare.com`
   - `mike.cloudflare.com`
   (These will be different for your account - copy the ones shown)

2. **Go to Namecheap**:
   - Log in to [namecheap.com](https://www.namecheap.com)
   - Go to **"Domain List"**
   - Find your domain and click **"Manage"**
   - Go to **"Nameservers"** tab
   - Select **"Custom DNS"**
   - Enter the two Cloudflare name servers
   - Click **"Save Changes"**

### Step 5: Wait for Propagation

- DNS propagation can take **5 minutes to 24 hours** (usually 5-30 minutes)
- You'll see a green checkmark in Cloudflare when it's ready
- **Don't proceed until you see the green checkmark!**

---

## Part 2: Configure Cloudflare Settings

### Step 1: Verify Your Domain is Active

1. In Cloudflare dashboard, your domain should show **"Active"**
2. Click on your domain to go to the dashboard

### Step 2: Update SSL/TLS Settings

1. Go to **"SSL/TLS"** tab
2. Select **"Full (strict)"** for encryption mode
3. Click **"Overview"** tab
4. Note your **"Name"** - this is your Cloudflare name server (e.g., `lara.cloudflare.com`)

### Step 3: Set Up DNS Records

Go to the **"DNS"** tab and add these records:

| Type | Name | Content | TTL | Proxy status |
|------|------|---------|-----|--------------|
| A | @ | 192.0.2.1 | 5 min | Proxied |
| A | * | 192.0.2.1 | 5 min | Proxied |

**Note**: The `192.0.2.1` is a dummy IP for now. We'll replace this with our tunnel later.

---

## Part 3: Install and Configure Cloudflared

### Step 1: Install Cloudflared

```bash
# Download cloudflared
curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb

# Install
sudo dpkg -i cloudflared.deb

# Verify installation
cloudflared --version
```

### Step 2: Authenticate with Cloudflare

```bash
# Login to Cloudflare
cloudflared login
```

This will open a browser window. Follow the instructions to complete authentication.

### Step 3: Create Tunnel

```bash
# Create a tunnel
cloudflared tunnel create qwen-chat-tunnel

# This creates ~/.cloudflared/qwen-chat-tunnel.json
```

### Step 4: Get Tunnel Credentials

```bash
# View tunnel credentials
cat ~/.cloudflared/qwen-chat-tunnel.json
```

You'll see something like:
```json
{
  "AccountTag": "YOUR_ACCOUNT_TAG",
  "TunnelID": "YOUR_TUNNEL_ID",
  "TunnelName": "qwen-chat-tunnel"
}
```

### Step 5: Create Tunnel Configuration

Create a configuration file:

```bash
# Create the config directory if it doesn't exist
mkdir -p ~/.cloudflared

# Create config file
cat > ~/.cloudflared/config.yml << EOF
tunnel: ec70d16e-cd3f-4f4c-804b-feb4f0950b35
credentials-file: /home/$(whoami)/.cloudflared/qwen-chat-tunnel.json

ingress:
  - hostname: api.synopustech.com
    service: http://localhost:8000
  - hostname: search.synopustech.com
    service: http://localhost:8001
  - hostname: tts.synopustech.com
    service: http://localhost:8080
  - hostname: voice.synopustech.com
    service: http://localhost:8002
  - service: http_status:404
EOF

# Replace placeholders
sed -i "s/YOUR_TUNNEL_ID/YOUR_TUNNEL_ID/g" ~/.cloudflared/config.yml
sed -i "s/YOUR_TUNNEL_NAME/YOUR_TUNNEL_NAME/g" ~/.cloudflared/config.yml
sed -i "s/YOURDOMAIN.com/YOURDOMAIN.com/g" ~/.cloudflared/config.yml
```

### Step 6: Update Cloudflare DNS Records

1. In Cloudflare dashboard, go to **"DNS"** tab
2. Add these A records:

| Type | Name | Content | TTL | Proxy status |
|------|------|---------|-----|--------------|
| A | api | 192.0.2.1 | 5 min | Proxied |
| A | search | 192.0.2.1 | 5 min | Proxied |
| A | tts | 192.0.2.1 | 5 min | Proxied |
| A | voice | 192.0.2.1 | 5 min | Proxied |

**Note**: These are placeholder records. Cloudflare Tunnel will handle the actual routing.

### Step 7: Run the Tunnel

```bash
# Test the tunnel
cloudflared tunnel run qwen-chat-tunnel
```

You should see output like:
```
2024-01-01T00:00:00Z INFO Tunnel server started on 127.0.0.1:8080
2024-01-01T00:00:00Z INFO Ready to serve connections
```

### Step 8: Test Your Setup

Open a new terminal and test each endpoint:

```bash
# Test vLLM API
curl https://api.YOURDOMAIN.com/v1/models

# Test search server
curl https://search.YOURDOMAIN.com/search?q=test

# Test TTS
curl https://tts.YOURDOMAIN.com/v1/health

# Test voice/STT
curl https://voice.YOURDOMAIN.com/api/health
```

---

## Part 4: Configure Vercel Frontend

### Step 1: Update Environment Variables

In your Vercel project, add these environment variables:

```
API_BASE_URL=https://api.YOURDOMAIN.com
SEARCH_URL=https://search.YOURDOMAIN.com
TTS_URL=https://tts.YOURDOMAIN.com
VOICE_URL=https://voice.YOURDOMAIN.com
```

### Step 2: Update Frontend Code

Update your frontend to use these environment variables:

```javascript
// In your frontend code
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
const SEARCH_URL = process.env.NEXT_PUBLIC_SEARCH_URL || 'http://localhost:8001';
const TTS_URL = process.env.NEXT_PUBLIC_TTS_URL || 'http://localhost:8080';
const VOICE_URL = process.env.NEXT_PUBLIC_VOICE_URL || 'http://localhost:8002';
```

---

## Part 5: Keep Tunnel Running

### Option 1: Run as a Service (Recommended)

Create a systemd service:

```bash
# Create service file
sudo nano /etc/systemd/system/cloudflared.service
```

Add this content:

```ini
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=your-username
ExecStart=/usr/local/bin/cloudflared tunnel run --config /home/your-username/.cloudflared/config.yml
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reexec
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

### Option 2: Use Docker (Alternative)

Create a `cloudflared.yml` file:

```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /root/.cloudflared/credentials.json

ingress:
  - hostname: api.YOURDOMAIN.com
    service: http://host.docker.internal:8000
  - hostname: search.YOURDOMAIN.com
    service: http://host.docker.internal:8001
  - hostname: tts.YOURDOMAIN.com
    service: http://host.docker.internal:8080
  - hostname: voice.YOURDOMAIN.com
    service: http://host.docker.internal:8002
  - service: http_status:404
```

Create a Docker Compose file:

```yaml
version: '3'
services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: cloudflared
    restart: unless-stopped
    volumes:
      - ./cloudflared.yml:/etc/cloudflared/config.yml:ro
      - ./credentials.json:/root/.cloudflared/credentials.json:ro
    command: tunnel run
```

---

## Troubleshooting

### Common Issues

1. **DNS Not Resolving**
   - Wait for propagation (check with `dig YOURDOMAIN.com`)
   - Verify name servers in Namecheap
   - Check Cloudflare DNS records

2. **Tunnel Not Connecting**
   - Verify `cloudflared` is running: `systemctl status cloudflared`
   - Check logs: `journalctl -u cloudflared -f`
   - Re-authenticate: `cloudflared login`

3. **Connection Refused**
   - Ensure local services are running
   - Check firewall settings
   - Verify port numbers in config match your services

### Debug Commands

```bash
# Check tunnel status
cloudflared tunnel list

# Inspect tunnel
cloudflared tunnel inspect TUNNEL_NAME

# View logs
cloudflared tunnel run TUNNEL_NAME --loglevel debug

# Test connectivity
curl -v https://api.YOURDOMAIN.com/v1/models
```

---

## Cost Summary

| Item | Cost |
|------|------|
| Cloudflare Free Tier | $0/month |
| Namecheap Domain | ~$10-15/year (already paid) |
| Total | ~$0-15/year |

---

## Next Steps

1. Test each endpoint individually
2. Update your Vercel frontend configuration
3. Monitor tunnel health
4. Set up alerts for tunnel downtime

## References

- [Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [cloudflared GitHub](https://github.com/cloudflare/cloudflared)
- [Namecheap DNS Setup](https://www.namecheap.com/support/knowledgebase/article.aspx/31/2237/how-do-i-link-my-domain-to-cloudflare/)