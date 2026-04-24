#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PORT_FILE="$ROOT/.dev.port"

_stop_backend() {
  if pkill -f "uvicorn app.main:app" 2>/dev/null; then
    echo "Backend stopped"
  else
    echo "Backend was not running"
  fi
}

_stop_frontend() {
  local port=3000
  [[ -f "$PORT_FILE" ]] && port=$(cat "$PORT_FILE") && rm -f "$PORT_FILE"
  local pids
  pids=$(lsof -ti:"$port" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    echo "$pids" | xargs kill
    echo "Frontend stopped (port $port)"
  else
    echo "Frontend was not running on port $port"
  fi
}

start() {
  # Ensure clean state before starting
  _stop_backend
  _stop_frontend

  echo "Starting backend..."
  cd "$ROOT/backend"
  uv run uvicorn app.main:app --reload --port 8000 > "$ROOT/backend.log" 2>&1 &

  echo "Starting frontend..."
  cd "$ROOT/frontend"
  npm run dev > "$ROOT/frontend.log" 2>&1 &

  # Wait for frontend to report its actual port (may differ from 3000 if taken)
  local port waited=0
  while [[ $waited -lt 15 ]]; do
    sleep 1; waited=$((waited + 1))
    port=$(grep -oE 'Local:\s+http://localhost:[0-9]+' "$ROOT/frontend.log" 2>/dev/null \
           | grep -oE '[0-9]+$' | head -1 || true)
    [[ -n "$port" ]] && break
  done

  if [[ -z "${port:-}" ]]; then
    echo "Frontend did not start in time — check frontend.log"
    exit 1
  fi

  echo "$port" > "$PORT_FILE"
  echo ""
  echo "Backend:  http://localhost:8000"
  echo "Frontend: http://localhost:$port"
  echo "Logs: backend.log  frontend.log"
}

stop() {
  _stop_backend
  _stop_frontend
}

case "${1:-}" in
  start) start ;;
  stop)  stop  ;;
  *)     echo "Usage: $0 {start|stop}" ; exit 1 ;;
esac
