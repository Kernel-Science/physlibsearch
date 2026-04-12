# PhyslibSearch

**Semantic search for [PhysLib](https://physlib.io/) — the formal Lean 4 physics library.**

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.11%2B-blue)](https://www.python.org/)
[![Ruff](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/astral-sh/ruff/main/assets/badge/v2.json)](https://github.com/astral-sh/ruff)
[![GitHub](https://img.shields.io/badge/github-Kernel--Science%2Fphyslibsearch-black?logo=github)](https://github.com/Kernel-Science/physlibsearch)

Search PhysLib theorems, definitions, and lemmas using plain English — no Lean syntax required.

```
> Newton's second law
  theorem Physlib.Mechanics.Newton.secondLaw : ∀ (m F : ℝ), m > 0 → acceleration m F = F / m
  Newton's Second Law: for a body of mass m > 0 and applied force F, the acceleration satisfies a = F/m.

> energy of a harmonic oscillator
  theorem Physlib.QuantumMechanics.HarmonicOscillator.energy : ∀ (n : ℕ), E n = ℏ * ω * (n + 1/2)
  Quantum harmonic oscillator energy levels: E_n = ℏω(n + ½).
```

---

## How it works

PhyslibSearch combines dense vector retrieval with LLM-powered query expansion to find relevant Lean declarations from a natural-language query.

```
  User query
      │
      ▼
  ┌─────────────────────────────────────────┐
  │  HyDE Query Expansion (optional)        │
  │  Gemini generates a plausible           │
  │  hypothetical Lean declaration          │
  │  matching the query                     │
  └──────────────────┬──────────────────────┘
                     │
                     ▼
  ┌─────────────────────────────────────────┐
  │  Gemini Embedding                       │
  │  Query → 3072-dim cosine vector         │
  └──────────────────┬──────────────────────┘
                     │
                     ▼
  ┌─────────────────────────────────────────┐
  │  ChromaDB Vector Search                 │
  │  Nearest-neighbor lookup in the index   │
  └──────────────────┬──────────────────────┘
                     │
                     ▼
  ┌─────────────────────────────────────────┐
  │  PostgreSQL Record Fetch                │
  │  Full declaration + informal description│
  └─────────────────────────────────────────┘
```

**Indexing pipeline** (run once):

1. **jixia** parses PhysLib Lean source → PostgreSQL
2. **Gemini** translates each formal declaration into a natural-language name + description (Herald-style)
3. **Gemini Embeddings** encodes descriptions → ChromaDB vector store

See [docs/architecture.md](docs/architecture.md) for a detailed breakdown.

---

## Prerequisites

| Dependency | Notes |
|---|---|
| Python 3.11+ | |
| PostgreSQL 14+ | `createdb` must be on your PATH |
| [jixia](https://github.com/frenzymath/jixia) | Lean 4 project parser — build from source |
| Lean 4 toolchain | Must match the toolchain of the project you index |
| Google Gemini API key | [Get one free](https://aistudio.google.com/app/apikey) |
| Node.js 20+ | Frontend only |

---

## Quick start

### 1 — Clone and install Python dependencies

```shell
git clone https://github.com/Kernel-Science/physlibsearch.git
cd physlibsearch

python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2 — Set up PostgreSQL

```shell
createdb physlibsearch
```

### 3 — Build jixia

```shell
git clone https://github.com/frenzymath/jixia.git
cd jixia
lake build          # ~70 s
cd ..
```

> Make sure `lean-toolchain` in jixia matches the toolchain used by the project you want to index.
> If they differ you'll see `"failed to read file … invalid header"` during indexing.

### 4 — Configure environment

```shell
cp .env.example .env
# Edit .env — set JIXIA_PATH, LEAN_SYSROOT, CONNECTION_STRING, GEMINI_API_KEY
```

See [docs/development.md](docs/development.md) for a full variable reference.

### 5 — Index PhysLib

```shell
# Parse Lean source
python -m database jixia /path/to/physlib Physlib,QuantumInfo

# Generate informal descriptions (calls Gemini — takes a while for large projects)
python -m database informal

# Build the vector index
python -m database vector-db
```

Use `DRY_RUN=true` to test the pipeline without spending API quota.

### 6 — Run the server

```shell
# Backend
uvicorn server:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## CLI search

```shell
python search.py "Schrödinger equation"
python search.py "Newton's second law" "conservation of energy" --json
```

---

## Project structure

```
physlibsearch/
├── server.py            # FastAPI server (search, expand, fetch, modules, feedback)
├── engine.py            # PhyslibSearchEngine — ChromaDB + PostgreSQL retrieval
├── query_expansion.py   # QueryExpander — HyDE via Gemini
├── search.py            # CLI search interface
├── prefix.py            # Module prefix helpers
│
├── database/            # Indexing pipeline
│   ├── __init__.py      # CLI entry point (schema / jixia / informal / vector-db)
│   ├── create_schema.py # PostgreSQL schema
│   ├── jixia_db.py      # Load jixia output → PostgreSQL
│   ├── informalize.py   # Generate informal descriptions with Gemini
│   ├── translate.py     # Herald-style formal→natural translation
│   ├── vector_db.py     # Build ChromaDB embeddings
│   └── embedding.py     # Gemini embedding client
│
├── prompt/              # Jinja2 prompt templates
│   ├── augment_prompt.j2
│   ├── augment_assistant.txt
│   ├── theorem.md.j2
│   ├── definition.md.j2
│   └── ...
│
├── frontend/            # Next.js 16 + HeroUI web interface
│   └── src/
│       ├── app/         # Pages (search, browse, docs)
│       ├── components/  # SearchPage, ResultCard, Header, Footer, …
│       ├── lib/api.ts   # API client
│       └── types/       # TypeScript types
│
└── docs/
    ├── architecture.md  # System design deep-dive
    ├── development.md   # Local dev setup
    └── deployment.md    # Self-hosting guide
```

---

## API endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/search` | Search declarations by natural language |
| `POST` | `/expand` | HyDE query expansion |
| `POST` | `/fetch` | Fetch specific declarations by name |
| `GET` | `/modules` | List indexed modules |
| `POST` | `/modules/declarations` | Get all declarations in a module |
| `POST` | `/feedback` | Submit feedback on a result |

Full API reference: [docs/architecture.md#api](docs/architecture.md#api-endpoints).

---

## Configuration reference

All configuration is through environment variables (`.env`). See [`.env.example`](.env.example) for the full list with explanations.

| Variable | Required | Description |
|---|---|---|
| `JIXIA_PATH` | Yes | Path to compiled jixia binary |
| `LEAN_SYSROOT` | Yes | Lean 4 toolchain root |
| `CONNECTION_STRING` | Yes | PostgreSQL connection string |
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `GEMINI_MODEL` | No | Model for informalization (default: `gemini-2.5-pro`) |
| `GEMINI_FAST_MODEL` | No | Model for query expansion (default: `gemini-2.5-flash`) |
| `GEMINI_EMBEDDING_MODEL` | No | Embedding model (default: `gemini-embedding-2-preview`) |
| `CHROMA_PATH` | No | ChromaDB storage path (default: `chroma`) |
| `DRY_RUN` | No | Skip API calls during indexing (default: `false`) |
| `LLM_API_KEY` / `LLM_BASE_URL` | No | Custom LLM endpoint (e.g. OpenRouter) |

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

---

## Acknowledgements

The HyDE query expansion technique is inspired by the [LeanSearch](https://arxiv.org/abs/2403.13310) paper.
Natural-language translation of formal declarations follows the approach described in [Herald](https://arxiv.org/abs/2410.10878v2).
