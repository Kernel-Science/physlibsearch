#!/bin/bash
set -e

# Start FastAPI backend on internal port 8001
uvicorn server:app --host 127.0.0.1 --port 8001 &

# Wait for uvicorn to be fully ready (lifespan complete, DB connected)
# before starting Next.js so the first /browse request doesn't race it.
echo "Waiting for uvicorn..."
until curl -sf -o /dev/null http://127.0.0.1:8001/modules 2>/dev/null; do
  sleep 1
done
echo "Uvicorn ready."

# Start Next.js frontend on the port Heroku exposes
cd frontend && npm start -- -p "${PORT:-3000}"
