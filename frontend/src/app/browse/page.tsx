export const dynamic = "force-dynamic";

import Link from "next/link";
import { listModules } from "@/lib/api";
import type { ModuleInfo, DeclarationKind } from "@/types";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BrowseSidebar from "@/components/BrowseSidebar";

interface Props {
  searchParams: Promise<{ kinds?: string }>;
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

export default async function BrowsePage({ searchParams }: Props) {
  const { kinds: kindsParam } = await searchParams;
  const selectedKinds = kindsParam
    ? (kindsParam.split(",").filter(Boolean) as DeclarationKind[])
    : [];
  const kindsQuery = kindsParam ? `?kinds=${kindsParam}` : "";

  const modules = await listModules();
  const groups = groupByTopLevel(modules);
  const total = modules.reduce((s, m) => s + m.count, 0);

  return (
    <div className="min-h-screen flex flex-col">
      <Header currentPath="browse" />

      <main className="flex-1 max-w-6xl mx-auto w-full px-5 sm:px-6 pt-24 pb-12">
        <div className="flex gap-10">
          <BrowseSidebar modules={modules} currentKinds={selectedKinds} />

          <div className="flex-1 min-w-0">
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
                        href={`/browse/${m.name.join("/")}${kindsQuery}`}
                        className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-foreground/5 transition-colors border-b border-foreground/10 last:border-0 group"
                      >
                        <span className="font-mono text-sm text-foreground/80 group-hover:text-foreground transition-colors truncate">
                          {m.name.join(".")}
                        </span>
                        <span className="text-xs text-foreground/35 tabular-nums shrink-0">
                          {m.count}
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
