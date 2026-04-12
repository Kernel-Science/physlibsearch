# Local development setup

This guide covers getting a full PhyslibSearch stack running on your machine for development.

---

## Prerequisites

| Tool | Minimum version | Install |
|---|---|---|
| Python | 3.11 | [python.org](https://www.python.org/) |
| PostgreSQL | 14 | [postgresql.org/download](https://www.postgresql.org/download/) |
| Node.js | 20 | [nodejs.org](https://nodejs.org/) |
| Lean 4 + elan | latest | `curl https://elan.lean-lang.org/elan-init.sh -sSf | sh` |

---

## 1 — Python environment

```shell
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

---

## 2 — PostgreSQL

Create a dedicated database:

```shell
createdb physlibsearch
```

If you want to reset from scratch at any point:

```shell
dropdb physlibsearch && createdb physlibsearch
```

---

## 3 — jixia

jixia is the Lean 4 project parser. Build it from source:

```shell
git clone https://github.com/frenzymath/jixia.git
cd jixia
lake build          # first build takes ~70 s
cd ..
```

> **Toolchain matching** — jixia's `lean-toolchain` must match the toolchain of the project you're indexing. Run `cat jixia/lean-toolchain` and compare with `cat /path/to/physlib/lean-toolchain`. If they differ, update one to match the other before building.

---

## 4 — Environment variables

```shell
cp .env.example .env
```

Open `.env` and fill in at minimum:

| Variable | What to set |
|---|---|
| `JIXIA_PATH` | Absolute path to `jixia/.lake/build/bin/jixia` |
| `LEAN_SYSROOT` | Run `lake env` in PhysLib and copy the `LEAN_SYSROOT` value |
| `CONNECTION_STRING` | `"dbname=physlibsearch user=YOUR_USER password=YOUR_PASSWORD"` |
| `GEMINI_API_KEY` | Your key from [aistudio.google.com](https://aistudio.google.com/app/apikey) |

The remaining variables have sensible defaults.

### Using a custom LLM endpoint

If you want to use OpenRouter (or any OpenAI-compatible endpoint) instead of Gemini directly for the fast model, add:

```env
LLM_API_KEY  = "sk-or-..."
LLM_BASE_URL = "https://openrouter.ai/api/v1"
GEMINI_FAST_MODEL = "google/gemini-2.5-flash"   # use the endpoint's model name
```

---

## 5 — Index a small project (recommended for dev)

For development it's easiest to index a small Lean project rather than all of PhysLib. Set `DRY_RUN=true` to verify the pipeline runs without spending any API quota:

```shell
DRY_RUN=true python -m database jixia /path/to/physlib Physlib
DRY_RUN=true python -m database informal
DRY_RUN=true python -m database vector-db
```

For a real index of PhysLib:

```shell
python -m database jixia /path/to/physlib Physlib,QuantumInfo
python -m database informal
python -m database vector-db
```

### Makefile shortcuts

```shell
# Set env vars first, then:
export DBNAME=physlibsearch
export INDEXED_REPO_PATH=/path/to/physlib
export MODULE_NAMES=Physlib,QuantumInfo
export CHROMA_PATH=chroma

make index      # runs reset → jixia → informal → vector-db in sequence
```

---

## 6 — Run the backend

```shell
uvicorn server:app --reload --port 8000
```

The API is now at [http://localhost:8000](http://localhost:8000). Interactive docs at [http://localhost:8000/docs](http://localhost:8000/docs).

---

## 7 — Run the frontend

```shell
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The frontend reads `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000`). To point it at a different backend:

```shell
NEXT_PUBLIC_API_URL=http://my-server:8000 npm run dev
```

---

## Code quality

```shell
# Python linting + formatting (ruff)
ruff check .
ruff format .

# Frontend linting
cd frontend && npm run lint
```

CI runs `ruff check` and `ruff format --check` on every push (see `.github/workflows/lint.yaml`).

---

## Database schema management

The schema is defined in `database/create_schema.py`. To (re-)apply it:

```shell
python -m database schema
```

This is idempotent — safe to run on an empty database. It creates all tables, types, views, and the `physlibsearch` operational schema.

---

## CLI search (no frontend needed)

```shell
python search.py "conservation of momentum"
python search.py "Schrödinger equation" "Hamiltonian operator" --json
python search.py -n 20 "entropy"
```

Flags:
- `-n N` — number of results (default 5)
- `--json` — output as JSON
