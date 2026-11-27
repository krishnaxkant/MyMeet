#!/usr/bin/env bash
set -euo pipefail

# MyMeet Backend - One-Command Ubuntu 24.04 AWS EC2 (Mumbai ap-south-1) Setup
# Installs Node.js 22, PM2, Caddy (automatic free Let's Encrypt HTTPS), builds server/, and starts it on boot.

APP_DIR="${APP_DIR:-$HOME/MyMeet}"
REPO_URL="${REPO_URL:-https://github.com/krishnaxkant/MyMeet.git}"
API_DOMAIN="${1:-}"

if [ -z "$API_DOMAIN" ]; then
  PUBLIC_IP="$(curl -s http://checkip.amazonaws.com || true)"
  if [ -n "$PUBLIC_IP" ]; then
    API_DOMAIN="api.${PUBLIC_IP//./-}.sslip.io"
    echo "[MyMeet] No custom domain passed — using free automatic HTTPS domain: https://${API_DOMAIN}"
  else
    echo "Usage: bash deploy/aws-ec2-setup.sh <your-api-domain-or-ip.sslip.io>"
    exit 1
  fi
fi

echo "[1/6] Updating system & installing Node.js 22 + build essentials..."
sudo apt-get update -y
sudo apt-get install -y curl git ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https

if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "[2/6] Installing PM2 process manager..."
sudo npm install -g pm2

echo "[3/6] Installing Caddy (automatic free HTTPS reverse proxy)..."
if ! command -v caddy >/dev/null 2>&1; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y caddy
fi

echo "[4/6] Cloning / updating MyMeet repository..."
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" pull origin main
fi

if [ ! -f "$APP_DIR/server/.env" ]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/server/.env"
  echo ""
  echo "================================================================="
  echo "IMPORTANT: Fill your real secrets in $APP_DIR/server/.env first!"
  echo "Run: nano $APP_DIR/server/.env"
  echo "Then re-run: bash $APP_DIR/deploy/aws-ec2-setup.sh $API_DOMAIN"
  echo "================================================================="
  exit 0
fi

echo "[5/6] Building MyMeet backend & starting with PM2..."
cd "$APP_DIR/server"
npm install --include=dev
npm run build
pm2 startOrReload ecosystem.config.cjs
pm2 save
sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$USER" --hp "$HOME" | tail -n 1 | bash || true

echo "[6/6] Configuring Caddy HTTPS reverse proxy for https://${API_DOMAIN}..."
sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
${API_DOMAIN} {
    encode gzip
    reverse_proxy 127.0.0.1:4000
}
EOF

sudo systemctl enable caddy
sudo systemctl restart caddy

echo ""
echo "================================================================="
echo "MyMeet Backend is LIVE on AWS EC2!"
echo "Health URL: https://${API_DOMAIN}/api/health"
echo "Next: Update VITE_API_URL (Vercel) & EXPO_PUBLIC_API_URL (GitHub Secrets)"
echo "      to: https://${API_DOMAIN}"
echo "================================================================="
