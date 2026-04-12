import Link from "next/link";
import { listModules } from "@/lib/api";
import type { ModuleInfo } from "@/types";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

function moduleUrl(name: string[]): string {
  return `/browse/${name.join("/")}`;
}

function groupByTopLevel(modules: ModuleInfo[]): Map<string, ModuleInfo[]> {
  const groups = new Map<string, ModuleInfo[]>();
  for (const m of modules) {
    const top = m.name[0] ?? "Other";
    if (!groups.has(top)) groups.set(top, []);
    groups.get(top)!.push(m);
  }
  return groups;
}

export default async function BrowsePage() {
  const modules = await listModules();
  const groups = groupByTopLevel(modules);
  const total = modules.reduce((s, m) => s + m.count, 0);

  return (
    <div className="min-h-screen flex flex-col">
      <Header currentPath="browse" />

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 pt-24 pb-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Browse</h1>
          <p className="text-foreground/50 text-sm">
            {modules.length} modules · {total.toLocaleString()} declarations
          </p>
        </div>

        <div className="flex flex-col gap-8">
          {Array.from(groups.entries()).map(([top, mods]) => (
            <section key={top}>
              <h2 className="text-xs font-semibold text-foreground/40 uppercase tracking-widest mb-3 font-mono">
                {top}
              </h2>
              <div className="border border-foreground/10 rounded-xl overflow-hidden">
                {mods.map((m, i) => (
                  <Link
                    key={i}
                    href={moduleUrl(m.name)}
                    className="flex items-center justify-between px-4 py-3 hover:bg-foreground/5 transition-colors border-b border-foreground/10 last:border-0 group"
                  >
                    <span className="font-mono text-sm text-foreground/80 group-hover:text-foreground transition-colors">
                      {m.name.join(".")}
                    </span>
                    <span className="text-xs text-foreground/35 tabular-nums">{m.count}</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
