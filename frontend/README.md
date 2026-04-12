# PhyslibSearch — Frontend

Next.js 16 frontend for [PhyslibSearch](https://github.com/Kernel-Science/physlibsearch).

## Development

```shell
npm install
npm run dev       # http://localhost:3000
```

Set `NEXT_PUBLIC_API_URL` to point to a non-local backend (default: `http://localhost:8000`).

## Build

```shell
npm run build
npm start
```

## Stack

- **Next.js 16** (App Router)
- **HeroUI v3** — component library (Tailwind CSS 4 + React Aria)
- **KaTeX** — LaTeX rendering
- **ogl** — WebGL background effect

For deployment instructions see [docs/deployment.md](../docs/deployment.md).
