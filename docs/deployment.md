# Self-hosting guide

This guide covers deploying PhyslibSearch to a Linux server.

---

## Overview

A production deployment consists of three long-running processes:

| Process | What it is | Typical port |
|---|---|---|
| PostgreSQL | Relational database | 5432 |
| `uvicorn server:app` | FastAPI backend | 8000 |
| Next.js (`npm start`) | Frontend | 3000 |

The indexing pipeline (`python -m database …`) is a one-off job — run it after a corpus update, then restart the backend.

---

## 1 — Server requirements

- Linux (Ubuntu 22.04 LTS recommended)
- Python 3.11+, Node.js 20+
- PostgreSQL 14+
- At least **4 GB RAM** for ChromaDB in-process (more for large corpora)
- Disk: size depends on corpus — PhysLib indexing produces ~1–2 GB of ChromaDB data

---

## 2 — Install system dependencies

```shell
sudo apt update
sudo apt install -y python3.11 python3.11-venv python3-pip postgresql nodejs npm
```

---

## 3 — Clone and install

```shell
git clone https://github.com/Kernel-Science/physlibsearch.git /srv/physlibsearch
cd /srv/physlibsearch

python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

---

## 4 — Database

```shell
sudo -u postgres createdb physlibsearch
sudo -u postgres psql -c "CREATE USER physlib WITH PASSWORD 'strong-password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE physlibsearch TO physlib;"
```

---

## 5 — Environment

```shell
cp .env.example .env
```

Key variables to set for production:

```env
CONNECTION_STRING = "dbname=physlibsearch user=physlib password=strong-password host=localhost"
GEMINI_API_KEY    = "AIza..."
CHROMA_PATH       = "/srv/physlibsearch/chroma"
ALLOWED_ORIGINS   = "https://physlibsearch.yourdomain.com"
LOG_FILENAME      = "/var/log/physlibsearch/server.log"
LOG_LEVEL         = "WARNING"
```

---

## 6 — Run the indexing pipeline

> The indexing pipeline must be run on a machine with jixia and a Lean 4 toolchain installed. This can be your server or a separate build machine.

```shell
source .venv/bin/activate

# Create schema (idempotent)
python -m database schema

# Index PhysLib (replace with your actual path)
python -m database jixia /path/to/physlib Physlib,QuantumInfo

# Generate informal descriptions (~hours for full PhysLib, API calls)
python -m database informal

# Build vector index
python -m database vector-db
```

After indexing, transfer the `chroma/` folder and the populated PostgreSQL database to the production server if you ran indexing elsewhere.

---

## 7 — Run the backend with systemd

Create `/etc/systemd/system/physlibsearch-api.service`:

```ini
[Unit]
Description=PhyslibSearch API
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/srv/physlibsearch
EnvironmentFile=/srv/physlibsearch/.env
ExecStart=/srv/physlibsearch/.venv/bin/uvicorn server:app --host 127.0.0.1 --port 8000 --workers 2
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```shell
sudo systemctl daemon-reload
sudo systemctl enable --now physlibsearch-api
```

---

## 8 — Build and serve the frontend

```shell
cd /srv/physlibsearch/frontend
npm install
NEXT_PUBLIC_API_URL=https://api.physlibsearch.yourdomain.com npm run build
```

Serve with PM2 or a separate systemd unit:

```shell
npm install -g pm2
pm2 start npm --name physlibsearch-frontend -- start
pm2 save
pm2 startup
```

---

## 9 — Nginx reverse proxy

```nginx
# /etc/nginx/sites-available/physlibsearch

server {
    server_name physlibsearch.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

server {
    server_name api.physlibsearch.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Enable HTTPS with Certbot:

```shell
sudo certbot --nginx -d physlibsearch.yourdomain.com -d api.physlibsearch.yourdomain.com
```

---

## 10 — Re-indexing

When PhysLib is updated, re-run the indexing pipeline:

```shell
# Full reset (drops and recreates the database + ChromaDB)
make reset

# Then re-index
make index
```

After indexing finishes, restart the API to pick up the new ChromaDB:

```shell
sudo systemctl restart physlibsearch-api
```

---

## Troubleshooting

**API returns 500 on `/search`**
- Check that ChromaDB files exist at `CHROMA_PATH` and the collection was created (`python -m database vector-db` completed without errors).
- Check `LOG_FILENAME` for the full traceback.

**Frontend shows "Search failed"**
- Verify `NEXT_PUBLIC_API_URL` points to the correct backend host.
- Check that `ALLOWED_ORIGINS` in `.env` includes your frontend origin.

**Indexing hangs / Gemini quota exceeded**
- Use `DRY_RUN=true` to test the pipeline without API calls.
- Reduce batch size: `python -m database informal --batch-size 10`.
