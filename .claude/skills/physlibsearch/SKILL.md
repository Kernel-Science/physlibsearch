---
name: physlibsearch
description: Semantic search over Physlib, a formal Lean 4 library of physics theorems and definitions. Use when asked to find Lean 4 declarations related to physics or mathematics, look up formal proofs, retrieve theorem signatures, or browse the Physlib module hierarchy.
---

# PhyslibSearch API Skill

PhyslibSearch is a semantic search engine over **Physlib**, a Lean 4 formal library of physics and mathematics. It lets you find theorems, definitions, lemmas, and instances by describing them in natural language — no Lean syntax required.

**Base URL**: `https://physlibsearch.net`

---

## When to use this skill

- The user asks to find a Lean 4 theorem, definition, or proof about a physics/math concept.
- The user wants the formal statement (signature) of a known result (e.g. Newton's second law, Schrödinger equation).
- The user wants to browse what Physlib covers in a specific area.
- The user has a Lean 4 declaration name and wants its full record.

---

## Endpoints

### 1. Search — `POST /search`

The main endpoint. Submit one or more natural language queries, get ranked results.

**Request**
```json
{
  "query": ["Newton's second law"],
  "num_results": 10
}
```
- `query`: array of strings (1–many queries); each runs independently and returns its own ranked list.
- `num_results`: 1–150, default 10.

**Response** — `list[list[QueryResult]]` (one list per query, ordered by relevance)
```json
[[
  {
    "result": {
      "module_name": ["Physlib", "Mechanics", "Newton"],
      "kind": "theorem",
      "name": ["Physlib", "Mechanics", "Newton", "secondLaw"],
      "signature": "theorem Physlib.Mechanics.Newton.secondLaw : ∀ (m F : ℝ), m > 0 → acceleration m F = F / m",
      "type": "Prop",
      "value": null,
      "docstring": null,
      "informal_name": "Newton's Second Law",
      "informal_description": "For a body of mass $m > 0$ and applied force $F$, the acceleration satisfies $a = F/m$."
    },
    "distance": 0.12
  }
]]
```

**Key fields**:
- `distance` — cosine distance (lower = more relevant; 0 is perfect).
- `informal_name` / `informal_description` — human-readable explanation (LaTeX math).
- `signature` — the formal Lean 4 statement.
- `name` — fully-qualified name as a string array (use with `/fetch`).
- `kind` — `theorem`, `definition`, `lemma`, `instance`, `axiom`, etc.

**Example (curl)**
```bash
curl -s -X POST https://physlibsearch.net/search \
  -H "Content-Type: application/json" \
  -d '{"query": ["quantum harmonic oscillator energy levels"], "num_results": 5}'
```

---

### 2. Query Expansion — `POST /expand`

Optionally call this **before** `/search` to improve results for technical or ambiguous queries. It uses HyDE (Hypothetical Document Embeddings): Gemini generates a plausible hypothetical Lean declaration, which is then used as the search vector.

**Request** — raw JSON string (the query itself, not an object)
```json
"Schrödinger equation for a free particle"
```

**Response** — JSON string (expanded query or original on failure)
```json
"theorem Physlib.QuantumMechanics.FreeParticle.schrodinger : ..."
```

**When to use**: For precise or highly technical queries (specific equation names, less common concepts). For broad natural-language queries, go straight to `/search`.

**Example flow**
```bash
# Step 1: expand
EXPANDED=$(curl -s -X POST https://physlibsearch.net/expand \
  -H "Content-Type: application/json" \
  -d '"Schrödinger equation for a free particle"')

# Step 2: search with expanded query
curl -s -X POST https://physlibsearch.net/search \
  -H "Content-Type: application/json" \
  -d "{\"query\": [$EXPANDED], \"num_results\": 5}"
```

---

### 3. Fetch by Name — `POST /fetch`

Retrieve full records for known Lean declaration names. Use this when you already have a name from a prior search or from the user.

**Request**
```json
{
  "query": [
    ["Physlib", "Mechanics", "Newton", "secondLaw"],
    ["Physlib", "QuantumMechanics", "HarmonicOscillator", "energy"]
  ]
}
```
- Each entry is a `LeanName` — an array of strings forming the fully-qualified path.

**Response** — `list[Record | null]` (null for names not found, order preserved)

**Example (curl)**
```bash
curl -s -X POST https://physlibsearch.net/fetch \
  -H "Content-Type: application/json" \
  -d '{"query": [["Physlib", "Mechanics", "Newton", "secondLaw"]]}'
```

---

### 4. List Modules — `GET /modules`

Returns all top-level Physlib modules with a count of searchable declarations.

**Response**
```json
[
  {"name": ["Physlib", "Mechanics"], "count": 42},
  {"name": ["Physlib", "QuantumMechanics"], "count": 31}
]
```

**Example (curl)**
```bash
curl -s https://physlibsearch.net/modules
```

---

### 5. Module Declarations — `POST /modules/declarations`

Returns all declarations in a specific module, ordered by source position.

**Request** — raw JSON array (the module name, not wrapped in an object)
```json
["Physlib", "Mechanics", "Newton"]
```

**Response** — `list[Record]` (same shape as search results, without `distance`)

**Example (curl)**
```bash
curl -s -X POST https://physlibsearch.net/modules/declarations \
  -H "Content-Type: application/json" \
  -d '["Physlib", "Mechanics", "Newton"]'
```

---

## Best practices

### Write queries like you'd explain the concept to a physicist, not like Lean code

| Good | Avoid |
|------|-------|
| `"conservation of momentum"` | `"theorem momentum"` |
| `"energy of a quantum harmonic oscillator"` | `"E_n = hbar omega (n + 1/2)"` |
| `"Maxwell's equations in differential form"` | `"curl E = -dB/dt"` |
| `"Euler-Lagrange equation"` | `"Lagrangian mechanics derivative"` |

### Batch multiple queries in one request

If you need to answer several related questions, send them together — each gets its own ranked list and it's a single round trip:
```json
{
  "query": [
    "kinetic energy theorem",
    "work-energy theorem",
    "conservation of mechanical energy"
  ],
  "num_results": 5
}
```

### Use `/expand` for narrow technical queries

Good candidates for expansion: named equations (Schrödinger, Navier-Stokes, Boltzmann), specific physical constants, or queries where the first search returns low-relevance results (distance > 0.4).

### Interpret `distance` to judge relevance

| Distance | Interpretation |
|----------|---------------|
| < 0.15   | Strong match — likely exactly what was asked for |
| 0.15–0.30 | Good match — closely related concept |
| 0.30–0.45 | Partial match — topically related but may not be the right theorem |
| > 0.45   | Weak match — consider rephrasing or using `/expand` |

### Show `informal_description` first, then `signature`

For human-facing answers, lead with `informal_description` (natural language + LaTeX) and offer the formal `signature` as supporting detail. Most users want to understand the result before reading Lean 4 syntax.

### Reconstruct the Lean import path from `name`

The `name` array maps directly to the Lean import path:
- `["Physlib", "Mechanics", "Newton", "secondLaw"]` → `Physlib.Mechanics.Newton.secondLaw`
- Users can reference this in their Lean 4 files with `import Physlib.Mechanics.Newton`

---

## Rate limits

| Endpoint | Limit |
|----------|-------|
| `/search` | 1 request/second |
| `/fetch` | 10 requests/second |
| `/expand` | 15 requests/minute |
| `/modules` | 30 requests/minute |
| `/modules/declarations` | 30 requests/minute |

For agents making multiple searches in a loop, add a short delay between `/search` calls or batch queries into a single request (preferred).

---

## Declaration kinds

Results can have these `kind` values:
`theorem`, `definition`, `lemma`, `instance`, `axiom`, `structure`, `inductive`, `abbrev`, `opaque`, `example`, `proofWanted`, `classInductive`

For most physics queries, `theorem` and `definition` are the most common and useful.

---

## More

- **Live search**: https://physlibsearch.net
- **API docs**: https://physlibsearch.net/docs
- **Skill repo**: https://github.com/Kernel-Science/physlibsearch-skill
- **Source**: https://github.com/Kernel-Science/physlibsearch
