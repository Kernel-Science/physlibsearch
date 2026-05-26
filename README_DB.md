# Istruzioni per il ripristino del database

Questo archivio contiene due componenti del database di LeanSearch:

- `physlibsearch.dump` — dump del database PostgreSQL
- `chroma/` — cartella del database vettoriale ChromaDB

---

## Requisiti

- PostgreSQL 18
- Python 3.13+ con ChromaDB installato (tramite `uv sync`)

---

## 1. Ripristino PostgreSQL

Crea un nuovo database e ripristina il dump:

```bash
createdb physlibsearch
pg_restore -U <tuo_utente> -d physlibsearch physlibsearch.dump
```

Poi aggiorna la stringa di connessione nel file `.env`:

```
CONNECTION_STRING = "dbname=physlibsearch user=<tuo_utente> password=<tua_password>"
```

## 2. Ripristino ChromaDB

Copia la cartella `chroma/` nella radice del progetto LeanSearch (accanto al file `.env`).
La variabile `CHROMA_PATH = "chroma"` nel file `.env` punta già a questa posizione, quindi non serve modificarla.

## 3. Variabili d'ambiente

Crea il file `.env` nella radice del progetto e compila almeno queste variabili:

```
JIXIA_PATH = "/percorso/al/binario/jixia"
LEAN_SYSROOT = "/percorso/al/toolchain/lean4"
CONNECTION_STRING = "dbname=physlibsearch user=<tuo_utente> password=<tua_password>"
GEMINI_API_KEY = "<tua_chiave_api>"
CHROMA_PATH = "chroma"
```
