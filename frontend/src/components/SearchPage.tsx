"use client";

import { useState, useRef } from "react";
import { Button } from "@heroui/react";
import { search, augmentQuery } from "@/lib/api";
import type { QueryResult } from "@/types";
import ResultCard from "./ResultCard";
import Header from "./Header";
import Footer from "./Footer";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<QueryResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [augment, setAugment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function handleSearch(e?: { preventDefault?: () => void }) {
    e?.preventDefault?.();
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError(null);

    try {
      let finalQuery = q;
      if (augment) finalQuery = await augmentQuery(q);
      const data = await search(finalQuery);
      setResults(data);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  const hasResults = results.length > 0;

  return (
    <div className="min-h-screen flex flex-col">

      <Header />

      <main className="flex-1 flex flex-col" style={{ position: "relative", zIndex: 1 }}>
        {/* Hero — vertically centered when no results, compact at top when results exist */}
        <div
          className={`w-full flex flex-col items-center px-4 transition-all duration-300 ${
            hasResults
              ? "pt-24 pb-6 border-b border-foreground/8"
              : "flex-1 justify-center pb-24"
          }`}
        >
          {/* Title — only show when no results */}
          {!hasResults && (
            <div className="text-center mb-8 mt-12">
              <h1 className="text-5xl font-bold tracking-tight mb-3">
                PhyslibSearch
              </h1>
              <p className="text-foreground/50 text-base">
                Semantic search for{" "}
                <a
                  href="https://physlib.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-foreground/80 transition-colors"
                >
                  PhysLib
                </a>{" "}
                — the formal Lean 4 physics library
              </p>
            </div>
          )}

          {/* Search form */}
          <form
            onSubmit={handleSearch}
            className="w-full max-w-2xl flex flex-col gap-3"
          >
            <div className="rounded-xl bg-foreground/5 border border-foreground/12 focus-within:border-foreground/35 focus-within:bg-foreground/7 transition-all">
              <textarea
                ref={inputRef}
                value={query}
                rows={2}
                onChange={(e) => {
                  setQuery(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                placeholder="e.g. Newton's second law, Schrödinger equation… (Shift+Enter for new line)"
                className="w-full px-5 pt-3 pb-2 bg-transparent text-sm placeholder:text-foreground/30 focus:outline-none resize-none overflow-hidden leading-relaxed"
                disabled={loading}
                autoFocus
              />
              <div className="flex items-center justify-between px-4 pb-3 pt-1">
                <label className="flex items-center gap-2 text-xs text-foreground/50 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={augment}
                    onChange={(e) => setAugment(e.target.checked)}
                    className="accent-current"
                  />
                  <span>Augment with HyDE</span>
                  <span className="text-foreground/30 hidden sm:inline">
                    — generates a hypothetical Lean declaration
                  </span>
                </label>
                <Button
                  type="submit"
                  variant="primary"
                  isDisabled={loading || !query.trim()}
                  onPress={() => handleSearch()}
                  size="sm"
                >
                  {loading ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      Searching
                    </span>
                  ) : (
                    "Search"
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>

        {/* Results area */}
        <div className="flex-1 w-full max-w-2xl mx-auto px-4 py-6">
          {error && (
            <p className="text-sm text-red-400 py-4">{error}</p>
          )}

          {searched && !loading && results.length === 0 && !error && (
            <p className="text-foreground/40 text-sm py-4">No results found.</p>
          )}

          {results.length > 0 && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-foreground/35">
                {results.length} result{results.length !== 1 ? "s" : ""} for{" "}
                <span className="font-mono">&ldquo;{query}&rdquo;</span>
              </p>
              {results.map((r, i) => (
                <ResultCard key={i} result={r} rank={i + 1} />
              ))}
            </div>
          )}
        </div>
      </main>

      <div style={{ position: "relative", zIndex: 1 }}><Footer /></div>
    </div>
  );
}
