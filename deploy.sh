#!/bin/bash
# ============================================================
# deploy.sh — pull latest code, rebuild both backend and
# frontend, restart both via PM2, reload nginx.
#
# Run this on the VPS, from inside the project folder:
#   cd /var/www/eit-pass-scan-app
#   ./deploy.sh
#
# First time only:
#   chmod +x deploy.sh
# ============================================================

set -e  # stop immediately if any command fails

APP_DIR="/var/www/eit-pass-scan-app"
BRANCH="main"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}==>${NC} $1"; }
warn() { echo -e "${YELLOW}==>${NC} $1"; }
fail() { echo -e "${RED}==> ERROR:${NC} $1"; exit 1; }

cd "$APP_DIR" || fail "Could not cd into $APP_DIR"

log "Pulling latest code from GitHub ($BRANCH)..."
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

log "Installing backend dependencies..."
cd "$APP_DIR/backend"
npm install
mkdir -p logs

log "Installing frontend dependencies..."
cd "$APP_DIR/frontend"
npm install
mkdir -p logs

log "Building frontend..."
npm run build

cd "$APP_DIR"

log "Restarting both apps via PM2..."
if pm2 describe eit-pass-scan-backend > /dev/null 2>&1; then
  pm2 restart ecosystem.config.js
else
  warn "PM2 processes not found — starting fresh."
  pm2 start ecosystem.config.js
fi
pm2 save

log "Checking nginx config..."
if sudo nginx -t; then
  log "Reloading nginx..."
  sudo systemctl reload nginx
else
  fail "nginx config test failed — NOT reloading. Fix the config and rerun."
fi

log "Deploy complete. Site: https://passscan.eitfaridabad.co.in"
pm2 status