#!/usr/bin/env bash
# Deploy AI Business Operations Platform using Docker Compose
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

echo "=== 1. Checking environment configuration ==="
if [ ! -f .env ]; then
  if [ -f .env.docker.example ]; then
    echo "Creating .env from .env.docker.example..."
    cp .env.docker.example .env
  else
    touch .env
  fi
fi

echo "=== 2. Publishing self-contained backend binary (.NET 10 linux-arm64) ==="
DOTNET_BIN="/Users/raed22/.dotnet/dotnet"
if [ ! -x "$DOTNET_BIN" ]; then
  DOTNET_BIN="$(command -v dotnet || true)"
fi

if [ -z "$DOTNET_BIN" ]; then
  echo "Error: .NET 10 SDK not found. Please ensure dotnet is in PATH."
  exit 1
fi

"$DOTNET_BIN" publish backend/src/AiBusiness.Api/AiBusiness.Api.csproj \
  -c Release \
  --self-contained true \
  -r linux-arm64 \
  -o backend/publish-linux-arm64

echo "=== 3. Building and starting Docker Compose containers ==="
docker compose up --build -d

echo "=== 4. Checking container health and connectivity ==="
echo "Waiting for services to initialize..."
sleep 5

FRONTEND_PORT="${FRONTEND_PORT:-3080}"
BACKEND_PORT="${BACKEND_PORT:-5280}"

echo "Testing backend health (http://localhost:${BACKEND_PORT}/api/health)..."
for i in {1..15}; do
  if curl -fsS "http://localhost:${BACKEND_PORT}/api/health" >/dev/null 2>&1; then
    echo " Backend API is healthy!"
    break
  fi
  sleep 2
done

echo "Testing frontend response (http://localhost:${FRONTEND_PORT}/login)..."
for i in {1..15}; do
  if curl -fsS -o /dev/null -w "%{http_code}\n" "http://localhost:${FRONTEND_PORT}/login" 2>/dev/null | grep -q "200"; then
    echo " Frontend UI is reachable!"
    break
  fi
  sleep 2
done

echo "Fetching secure public tunnel URL..."
sleep 2
TUNNEL_URL=$(docker compose logs tunnel 2>&1 | grep -o "https://.*\.trycloudflare\.com" | tail -1 || true)

echo ""
echo "=========================================================="
echo " AI Business Operations Platform deployed successfully!"
if [ -n "$TUNNEL_URL" ]; then
  echo " Public Access: $TUNNEL_URL"
fi
echo " Local Web UI:  http://localhost:${FRONTEND_PORT}"
echo " Backend API:   http://localhost:${BACKEND_PORT}"
echo " Logs:          docker compose logs -f"
echo " Stop:          docker compose down"
echo "=========================================================="
