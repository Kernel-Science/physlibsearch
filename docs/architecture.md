# Architecture

PhyslibSearch is split into two largely independent parts: an **indexing pipeline** (run offline, once per corpus update) and a **query serving layer** (the live API + frontend).

---

## High-level overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  INDEXING PIPELINE  (offline, run once)                              │
│                                                                      │
│  PhysLib Lean source                                                 │
│       │                                                              │
│       ▼                                                              │
│  ┌─────────┐    jixia parses .olean files                           │
│  │  jixia  │──► declarations, modules, symbols, dependencies        │
│  └─────────┘         │                                              │
│                       ▼                                              │
│              ┌──────────────┐                                        │
│              │  PostgreSQL  │  modules, declarations, symbols,       │
│              │  (raw data)  │  dependency graph, topological levels  │
│              └──────┬───────┘                                        │
│                     │                                                │
│                     ▼                                                │
│         ┌───────────────────────┐                                    │
│         │  Gemini (informalize) │  Herald-style formal→natural       │
│         │  GEMINI_MODEL         │  translation, level by level       │
│         └──────────┬────────────┘                                    │
│                    │ informal names + descriptions                    │
│                    ▼                                                  │
│              ┌──────────────┐                                        │
│              │  PostgreSQL  │  informal table                        │
│              │  (enriched)  │                                        │
│              └──────┬───────┘                                        │
│                     │                                                │
│                     ▼                                                │
│         ┌──────────────────────────┐                                 │
│         │  Gemini Embedding        │  3072-dim cosine vectors        │
│         │  GEMINI_EMBEDDING_MODEL  │  (RETRIEVAL_DOCUMENT task)      │
│         └──────────┬───────────────┘                                 │
│                    │                                                 │
│                    ▼                                                 │
│              ┌──────────────┐                                        │
│              │   ChromaDB   │  persistent vector store               │
│              └──────────────┘                                        │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  QUERY SERVING  (live)                                               │
│                                                                      │
│  User query (plain English)                                          │
│       │                                                              │
│       ▼  (optional)                                                  │
│  ┌──────────────────────────────┐                                    │
│  │  QueryExpander (query_expansion.py)                               │
│  │  HyDE: Gemini GEMINI_FAST_MODEL generates a plausible            │
│  │  hypothetical Lean declaration → used as the search text         │
│  └──────────────┬───────────────┘                                    │
│                 │                                                    │
│                 ▼                                                    │
│  ┌──────────────────────────────┐                                    │
│  │  Gemini Embedding            │  (RETRIEVAL_QUERY task)            │
│  └──────────────┬───────────────┘                                    │
│                 │                                                    │
│                 ▼                                                    │
│  ┌──────────────────────────────┐                                    │
│  │  PhyslibSearchEngine         │  engine.py                        │
│  │  ChromaDB .query()           │  nearest-neighbor by cosine dist  │
│  │  PostgreSQL record fetch     │  joins declaration + informal      │
│  └──────────────┬───────────────┘                                    │
│                 │                                                    │
│                 ▼                                                    │
│  List[QueryResult]  →  FastAPI (server.py)  →  Frontend / CLI       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Database schema

All tables live in the default PostgreSQL schema. PhyslibSearch adds its own `physlibsearch` schema for operational tables.

### Core tables (populated by jixia)

| Table | Key columns | Description |
|---|---|---|
| `module` | `name JSONB PK`, `content BYTEA`, `docstring TEXT` | One row per Lean module |
| `symbol` | `name JSONB PK`, `module_name`, `kind`, `type`, `is_prop` | Every symbol in the corpus |
| `declaration` | `(module_name, index) PK`, `name`, `visible`, `kind`, `signature`, `value` | Syntactic declarations |
| `dependency` | `(source, target, on_type)` | Symbol dependency edges |
| `level` | `symbol_name PK`, `level INT` | Topological order (used for batch informalization) |

### Enrichment tables

| Table | Key columns | Description |
|---|---|---|
| `informal` | `symbol_name PK`, `name TEXT`, `description TEXT` | Natural-language name + description per symbol |

### Operational tables (`physlibsearch` schema)

| Table | Key columns | Description |
|---|---|---|
| `physlibsearch.query` | `id UUID PK`, `query TEXT`, `time` | Search query log |
| `physlibsearch.feedback` | `(query_id, declaration_name) PK`, `action TEXT` | User feedback |

### Views

| View | Description |
|---|---|
| `record` | Joins `declaration` + `informal` + `symbol` — the shape returned by the API |

---

## Informalization

The `database/informalize.py` module translates formal Lean declarations into natural language using a **level-by-level** strategy:

1. Declarations are processed in topological order (`level` table), so dependencies are always translated before dependants.
2. For each declaration, Gemini receives:
   - The formal signature and value
   - Neighbouring declarations in the same module (±2 positions)
   - Already-translated dependency descriptions
3. Gemini returns an `informal_name` (a short, human-readable label) and an `informal_description` (a LaTeX-rendered explanation).

This follows the [Herald](https://arxiv.org/abs/2410.10878v2) approach to formalization reversal.

---

## HyDE query expansion

[Hypothetical Document Embeddings (HyDE)](https://arxiv.org/abs/2212.10496) is a retrieval technique that closes the distribution gap between short user queries and longer indexed documents:

1. Gemini (`GEMINI_FAST_MODEL`) is prompted to generate a **plausible hypothetical Lean declaration** that would answer the user's query.
2. The hypothetical declaration is embedded instead of the raw query.
3. Because the hypothetical text is in the same format as the indexed documents, the embedding is much closer to relevant results in vector space.

HyDE is optional — users can toggle it off in the UI or skip it in the CLI.

---

## API endpoints

| Method | Path | Rate limit | Description |
|---|---|---|---|
| `POST` | `/search` | 1/s (default) | Search declarations; accepts a list of queries |
| `POST` | `/expand` | 15/min | HyDE query expansion |
| `POST` | `/fetch` | 10/s | Fetch specific declarations by Lean name |
| `GET` | `/modules` | 30/min | List all indexed modules with declaration counts |
| `POST` | `/modules/declarations` | 30/min | All declarations in a module |
| `POST` | `/feedback` | — | Log click/thumbs feedback |

Request/response shapes are defined by Pydantic models in `server.py` and TypeScript types in `frontend/src/types/index.ts`.

---

## Technology choices

| Layer | Technology | Why |
|---|---|---|
| Lean parser | [jixia](https://github.com/frenzymath/jixia) | Purpose-built for extracting structured data from Lean 4 `.olean` files |
| Relational store | PostgreSQL + psycopg 3 | Rich querying for the indexing pipeline; async-capable |
| Vector store | ChromaDB | Simple persistent embedding store; no separate service required |
| Embeddings + LLM | Google Gemini | Single API key for embeddings, informalization, and query expansion |
| Backend | FastAPI | Async, Pydantic-native, minimal boilerplate |
| Frontend | Next.js 16 + HeroUI v3 | App Router, React 19, Tailwind CSS 4 |
| Rate limiting | slowapi | Per-endpoint limits to protect the Gemini quota |
