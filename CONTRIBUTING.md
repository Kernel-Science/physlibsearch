# Contributing to PhyslibSearch

Thanks for your interest in contributing! Here's everything you need to get started.

---

## Getting started

1. Fork the repo and clone your fork.
2. Follow the [local development guide](docs/development.md) to get the stack running.
3. Create a feature branch: `git checkout -b my-feature`.

---

## What to work on

Check the [issue tracker](https://github.com/Kernel-Science/physlibsearch/issues) for open issues. Good first issues are tagged `good first issue`.

Some areas that always welcome contributions:

- **Prompt quality** — improving the informalization prompts (`prompt/`) to produce better natural-language descriptions
- **Frontend UX** — search experience, result rendering, browse view
- **Performance** — batch size tuning, embedding caching, connection pooling
- **Documentation** — improving or translating the docs in `docs/`
- **Indexing robustness** — better error handling and recovery in the pipeline

---

## Code style

### Python

We use [Ruff](https://github.com/astral-sh/ruff) for linting and formatting. Before pushing:

```shell
ruff check .
ruff format .
```

CI will fail if either of these produces warnings or changes.

### TypeScript / Frontend

```shell
cd frontend
npm run lint
```

---

## Commit messages

Keep commits small and focused. Use a short imperative subject line:

```
add HyDE toggle to CLI
fix: embedding dimension mismatch on re-index
docs: document ALLOWED_ORIGINS env var
```

No strict prefix convention is enforced, but the first word should be a verb.

---

## Pull requests

- Open a PR against `main`.
- Describe what the PR does and why.
- Link any related issues.
- Keep PRs focused — one logical change per PR.

A maintainer will review and provide feedback within a few days.

---

## Reporting bugs

Please open an issue and include:

- What you were trying to do
- What you expected to happen
- What actually happened
- Relevant logs or error messages
- Your OS, Python version, and Node.js version

---

## Questions

Feel free to open a discussion or an issue if something is unclear. We're happy to help.
