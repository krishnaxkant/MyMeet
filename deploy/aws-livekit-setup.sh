#!/usr/bin/env bash
set -euo pipefail

# Self-Hosted LiveKit Server Setup for MyMeet on Ubuntu EC2 (with Caddy auto-HTTPS)
PUBLIC_IP="${1:-3.107.38.177}"
DASH_IP="${PUBLIC_IP//./-}"
LIVEKIT_DOMAIN="livekit.${DASH_IP}.sslip.io"
API_DOMAIN="api.${DASH_IP}.sslip.io"
ENV_FILE="$HOME/MyMeet/server/.env"

echo "==> 1/7 Ensuring 2GB swap file exists..."
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  if ! grep -q '/swapfile' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  fi
fi

echo "==> 2/7 Checking UFW firewall rules..."
if sudo ufw status 2>/dev/null | grep -q "Status: active"; then
  sudo ufw allow 7881/tcp
  sudo ufw allow 50000:60000/udp
fi

echo "==> 3/7 Ensuring livekit-server is installed..."
if ! command -v livekit-server >/dev/null 2>&1; then
  curl -sSL https://get.livekit.io | sudo bash
fi

echo "==> 4/7 Generating LiveKit API keys & writing /etc/livekit.yaml..."
LK_OUT="$(livekit-server generate-keys)"
LK_KEY="$(echo "$LK_OUT" | awk '/API Key:/ {print $3}')"
LK_SECRET="$(echo "$LK_OUT" | awk '/API Secret:/ {print $3}')"

if [ -z "$LK_KEY" ] || [ -z "$LK_SECRET" ]; then
  echo "ERROR: Could not generate LiveKit keys."
  exit 1
fi

sudo tee /etc/livekit.yaml >/dev/null <<EOF
port: 7880
bind_addresses:
  - "127.0.0.1"
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
keys:
  ${LK_KEY}: ${LK_SECRET}
logging:
  level: info
EOF

echo "==> 5/7 Starting mymeet-livekit via PM2..."
pm2 delete mymeet-livekit >/dev/null 2>&1 || true
pm2 start /usr/local/bin/livekit-server --name mymeet-livekit -- --config /etc/livekit.yaml
pm2 save

echo "==> 6/7 Configuring Caddy HTTPS proxy for ${LIVEKIT_DOMAIN}..."
if ! grep -q "${LIVEKIT_DOMAIN}" /etc/caddy/Caddyfile; then
  sudo tee -a /etc/caddy/Caddyfile >/dev/null <<EOF

${LIVEKIT_DOMAIN} {
    reverse_proxy 127.0.0.1:7880
}
EOF
fi
sudo systemctl reload caddy

echo "==> 7/7 Updating ${ENV_FILE}, building backend, and restarting mymeet-api..."
cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%s)"
sed -i '/^LIVEKIT_URL=/d; /^LIVEKIT_API_KEY=/d; /^LIVEKIT_API_SECRET=/d' "$ENV_FILE"
cat >> "$ENV_FILE" <<EOF
LIVEKIT_URL=wss://${LIVEKIT_DOMAIN}
LIVEKIT_API_KEY=${LK_KEY}
LIVEKIT_API_SECRET=${LK_SECRET}
EOF

cd "$HOME/MyMeet/server"
npm run build
pm2 restart mymeet-api --update-env

sleep 3
echo ""
echo "==================== VERIFICATION ===================="
pm2 status
echo ""
echo "--- LiveKit HTTPS (${LIVEKIT_DOMAIN}) ---"
curl -sS -i "https://${LIVEKIT_DOMAIN}" | head -n 5 || true
echo ""
echo "--- MyMeet API Health (${API_DOMAIN}) ---"
curl -sS "https://${API_DOMAIN}/api/health" || true
echo ""
echo "======================================================"
echo "SUCCESS! Self-hosted LiveKit is live at wss://${LIVEKIT_DOMAIN}"
