import type { QueryResult, SearchRecord, ModuleInfo } from "@/types";

export type { SearchRecord };

// Server-side (RSC): call uvicorn directly with an absolute URL.
// Client-side (browser): use relative paths handled by Next.js rewrites.
const API_BASE =
  typeof window === "undefined"
    ? process.env.BACKEND_URL ?? "http://127.0.0.1:8001"
    : (process.env.NEXT_PUBLIC_API_URL ?? "");

export async function search(
  query: string,
  numResults = 10
): Promise<QueryResult[]> {
  const res = await fetch(`${API_BASE}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: [query], num_results: numResults }),
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Search failed: ${res.statusText}`);
  const data: QueryResult[][] = await res.json();
  return data[0] ?? [];
}

export async function listModules(): Promise<ModuleInfo[]> {
  const res = await fetch(`${API_BASE}/modules`, { cache: "force-cache" });
  if (!res.ok) throw new Error("Failed to load modules");
  return res.json();
}

export async function getModuleDeclarations(
  moduleName: string[]
): Promise<SearchRecord[]> {
  const res = await fetch(`${API_BASE}/modules/declarations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(moduleName),
    cache: "force-cache",
  });
  if (!res.ok) throw new Error("Failed to load module");
  return res.json();
}

export async function augmentQuery(query: string): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/expand`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(query),
      credentials: "include",
    });
    if (!res.ok) return query;
    return res.json();
  } catch {
    return query;
  }
}
