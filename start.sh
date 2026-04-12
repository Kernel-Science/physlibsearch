#!/bin/bash
set -e

# Start FastAPI backend on internal port 8001
uvicorn server:app --host 127.0.0.1 --port 8001 &

# Start Next.js frontend on the port Heroku exposes
cd frontend && npm start -- -p "${PORT:-3000}"
