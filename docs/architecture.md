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

## Design decisions

The pipeline looks the way it does because **the indexed corpus is not text — it is formal Lean code**. Generic RAGs (like [gbrain](https://github.com/garrytan/gbrain)) assume the corpus is already prose, so they chunk by paragraph, embed once, and retrieve. That collapses here: a user's plain-English query lives in a completely different distribution than a terse Lean signature, so direct nearest-neighbour search in a single embedding space returns noise. Every non-obvious choice in PhyslibSearch exists to close that gap.

### Per-declaration chunking

The unit of retrieval is a single Lean declaration (theorem, definition, instance), not a file, module, or fixed-size window. This is because Lean's semantic unit *is* the declaration — splitting mid-file would break signatures and proofs, while grouping by file would dilute the embedding across unrelated lemmas. jixia already exposes declaration-level structure (name, signature, value, dependencies), so symbol-level chunking comes for free without a custom splitter. See the `declaration` table below and [`database/jixia_db.py`](../database/jixia_db.py).

### Informalize formal code before embedding

Rather than embedding the raw Lean signature, PhyslibSearch uses Gemini (`GEMINI_MODEL`, quality-tuned) to generate a **natural-language name and description** for every declaration, following the [Herald](https://arxiv.org/abs/2410.10878v2) "formalization reversal" idea. The final text that gets embedded is a concatenation of the formal and informal forms:

```text
{kind} {name} {signature}
{informal_name}: {informal_description}
```

(see [`database/vector_db.py`](../database/vector_db.py), line 43). This hybrid embedding lets the vector store match both exact-Lean queries (`mem_cons_self`) and natural-language queries ("an element is in the list it was prepended to"). A pure-formal embedding would miss the second; a pure-informal embedding would miss the first.

### Dependency-aware, topological informalization

The informalization pass is not independent per declaration. Declarations are translated in **topological order over the dependency graph** (the `level` table; see [`database/informalize.py`](../database/informalize.py)) so that when Gemini translates a theorem, it has already-translated descriptions of every symbol that theorem references, plus the ±2 neighbouring declarations in the same module (`find_neighbor`). This replicates how a mathematician reads a library: you understand a lemma in terms of things you already understand. A generic RAG has no analogue because prose has no typed dependency graph.

### HyDE query expansion

Even with hybrid embeddings, a short user query ("Schrödinger equation") is much shorter and less structured than a full indexed document. [HyDE](https://arxiv.org/abs/2212.10496) closes this final gap: Gemini (`GEMINI_FAST_MODEL`, latency-tuned) rewrites the query into a plausible hypothetical Lean declaration, and *that* is what gets embedded ([`query_expansion.py`](../query_expansion.py)). The hypothetical declaration lives in the same distribution as the indexed documents, so nearest-neighbour search becomes meaningful. HyDE is toggleable — for short formal queries where the distribution gap is already small, users can skip it.

### Dual store: PostgreSQL + ChromaDB

The pipeline is graph-heavy: dependency edges, topological levels, neighbour lookups, joins between declarations and their informalizations. That's what relational stores are good at, and the indexing pipeline relies on SQL throughout. ChromaDB, meanwhile, only needs to store vectors and return nearest IDs — it would be wasteful to replicate the full record schema inside a vector DB. At query time Chroma returns IDs, and Postgres assembles the human-readable records via the `record` view (see [`engine.py`](../engine.py)).

### Task-type-aware embeddings + model tiering

Three different Gemini knobs serve three different jobs:

- `GEMINI_MODEL` (default `gemini-2.5-pro`) — offline informalization. Quality matters, latency doesn't; this is a one-time cost per corpus.
- `GEMINI_FAST_MODEL` (default `gemini-2.5-flash`) — real-time HyDE expansion on every query. Latency matters.
- `GEMINI_EMBEDDING_MODEL` — invoked with `task_type="RETRIEVAL_DOCUMENT"` during indexing and `"RETRIEVAL_QUERY"` at query time ([`database/embedding.py`](../database/embedding.py)), letting Gemini tune each embedding for its role in the asymmetric retrieval setup.

### Why this differs from a gbrain-style RAG

| Aspect | Generic notes RAG | PhyslibSearch |
|---|---|---|
| Corpus | Prose the user already wrote | Formal Lean declarations |
| Chunking | By paragraph / section | By declaration (jixia-provided) |
| Embedding input | Raw text | Hybrid (formal + Herald-style informal) |
| Indexing pass | Single embedding pass | Dependency-ordered informalization, then embedding |
| Query expansion | Often unnecessary | HyDE — queries rewritten into Lean syntax |
| Stores | Vector store only | Postgres (graph + records) + Chroma (vectors) |

In short: a generic RAG can treat the corpus as a bag of text because its users already speak the corpus's language. For PhyslibSearch the whole point is that users *don't* — they speak physics, not Lean — so the pipeline's job is to translate both sides (documents → informal via Herald, queries → formal via HyDE) until they meet in a shared embedding space.

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
