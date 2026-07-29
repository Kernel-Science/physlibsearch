#!/bin/bash
set -euo pipefail

UVICORN_PID=""
NEXT_PID=""

# Forward the platform's SIGTERM to both children so shutdown is clean instead
# of leaving orphans for the platform to kill.
shutdown() {
  [ -n "$NEXT_PID" ] && kill -TERM "$NEXT_PID" 2>/dev/null || true
  [ -n "$UVICORN_PID" ] && kill -TERM "$UVICORN_PID" 2>/dev/null || true
  wait 2>/dev/null || true
  exit 143
}
trap shutdown TERM INT

# Start FastAPI backend on internal port 8001
uvicorn server:app --host 127.0.0.1 --port 8001 &
UVICORN_PID=$!

# Wait for uvicorn to be fully ready (lifespan complete, DB connected) before
# starting Next.js so the first /browse request doesn't race it.
#
# This wait is bounded and checks that uvicorn is still alive. An unbounded wait
# is dangerous: if the backend dies during startup, Next.js would never start,
# nothing would ever bind $PORT, and the platform would kill the dyno for
# failing to bind -- with nothing in the log explaining why. Fail loudly instead.
WAIT_SECONDS="${UVICORN_WAIT_SECONDS:-90}"
echo "Waiting for uvicorn (timeout ${WAIT_SECONDS}s)..."
ready=""
for attempt in $(seq 1 "$WAIT_SECONDS"); do
  if ! kill -0 "$UVICORN_PID" 2>/dev/null; then
    echo "FATAL: uvicorn exited during startup -- see the traceback above." >&2
    exit 1
  fi
  if curl -sf -o /dev/null http://127.0.0.1:8001/modules 2>/dev/null; then
    echo "Uvicorn ready after ${attempt}s."
    ready=1
    break
  fi
  sleep 1
done
if [ -z "$ready" ]; then
  echo "FATAL: uvicorn did not serve /modules within ${WAIT_SECONDS}s." >&2
  exit 1
fi

# Start Next.js on the port the platform assigns. Bind 0.0.0.0 explicitly so the
# platform's port check reliably sees the listener on the external interface.
cd frontend
npm start -- -p "${PORT:-3000}" -H 0.0.0.0 &
NEXT_PID=$!

# Exit if either process dies, so a dead backend surfaces as a failed dyno
# rather than a frontend silently serving errors.
while true; do
  if ! kill -0 "$NEXT_PID" 2>/dev/null; then
    wait "$NEXT_PID" || true
    echo "FATAL: Next.js exited." >&2
    exit 1
  fi
  if ! kill -0 "$UVICORN_PID" 2>/dev/null; then
    echo "FATAL: uvicorn exited after startup." >&2
    exit 1
  fi
  sleep 5
done
