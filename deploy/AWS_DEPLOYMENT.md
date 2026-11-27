# Deploying MyMeet Backend on AWS EC2 (Mumbai `ap-south-1` — Free Tier)

This guide moves the MyMeet Node.js backend from Render Free (`0.1 vCPU`, sleeps after 15m) to **AWS EC2 Free Tier (`t3.micro` / `t2.micro` in Mumbai `ap-south-1`)** — giving **10× more CPU, zero cold starts, ~20ms latency in India, and automatic free HTTPS**.

> **Free Tier Cost:** ₹0/month for 12 months (750 hours/month of `t2.micro` or `t3.micro` + 30 GB EBS storage).

---

## Step 1 — Launch EC2 Instance in Mumbai (`ap-south-1`)

1. Sign in to [AWS Console](https://console.aws.amazon.com/) and switch the top-right region to **Asia Pacific (Mumbai) `ap-south-1`**.
2. Open **EC2** → **Launch Instance**:
   - **Name:** `mymeet-api`
   - **OS Image:** **Ubuntu Server 24.04 LTS** (64-bit x86, Free tier eligible)
   - **Instance Type:** `t3.micro` (or `t2.micro`, Free tier eligible)
   - **Key pair:** Create new key pair (`mymeet-ec2.pem`) and download it safely.
   - **Network settings (Firewall / Security Group):** Check ALL 3 boxes:
     - Allow **SSH** (`22`) from My IP / Anywhere
     - Allow **HTTP** (`80`) from Anywhere (`0.0.0.0/0`) — required for free Let's Encrypt SSL
     - Allow **HTTPS** (`443`) from Anywhere (`0.0.0.0/0`)
   - **Storage:** `20 GiB gp3` (Free tier covers up to 30 GB)
3. Click **Launch instance**.
4. *(Recommended)* Go to **EC2 → Elastic IPs → Allocate Elastic IP → Associate** with `mymeet-api` so your server IP never changes on reboot.

---

## Step 2 — Run the One-Command Setup Script

Connect to your EC2 instance (either click **Connect → EC2 Instance Connect** in the AWS browser console, or via PowerShell `ssh -i mymeet-ec2.pem ubuntu@<YOUR_EC2_IP>`):

```bash
git clone https://github.com/krishnaxkant/MyMeet.git ~/MyMeet
bash ~/MyMeet/deploy/aws-ec2-setup.sh
```

The first run creates `~/MyMeet/server/.env` and pauses so you can paste your secrets:

```bash
nano ~/MyMeet/server/.env
```

Fill in the same values you currently have on Render:
- `NODE_ENV=production`
- `PORT=4000`
- `CORS_ORIGIN=https://mymeet-live.vercel.app`
- `WEB_APP_URL=https://mymeet-live.vercel.app`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `GEMINI_API_KEY`
- `GEMINI_MODEL=gemini-3.5-flash-lite`

Save (`Ctrl+O`, `Enter`, `Ctrl+X`) and re-run:

```bash
bash ~/MyMeet/deploy/aws-ec2-setup.sh
```

> **Free Automatic HTTPS (Zero Domain Cost!):**
> If you don't own a custom domain yet, the script automatically configures Caddy with `https://api.<your-ip-dashed>.sslip.io` and fetches a real **Let's Encrypt HTTPS certificate** in ~10 seconds!
> If you own a domain (e.g. `api.mymeet.in`), point its DNS `A` record to your EC2 Elastic IP and run:
> `bash ~/MyMeet/deploy/aws-ec2-setup.sh api.mymeet.in`

Verify it's live:
```bash
curl https://api.<your-ip-dashed>.sslip.io/api/health
```
You should see `"status": "ok"`, `"supabase": "connected"`, `"livekit": "configured"`, and `"gemini": { "configured": true, "model": "gemini-3.5-flash-lite" }`.

---

## Step 3 — Point Vercel (Web) & Android OTA to AWS

1. **Vercel (`mymeet-live.vercel.app`):**
   - Project Settings → **Environment Variables** → update `VITE_API_URL` to your new AWS HTTPS URL (`https://api.<your-ip-dashed>.sslip.io`) → **Redeploy**.
2. **GitHub Secrets (Android OTA Auto-Update):**
   - Repo Settings → **Secrets and variables → Actions** → update `EXPO_PUBLIC_API_URL` to your new AWS HTTPS URL.
   - Re-run the latest **Android OTA Update** workflow (or push any small commit to `apps/mobile/`) — all installed Android APKs switch to AWS automatically!

---

## Updating Backend After Future `git push`

```bash
cd ~/MyMeet && git pull origin main && cd server && npm install --include=dev && npm run build && pm2 reload mymeet-api
```
