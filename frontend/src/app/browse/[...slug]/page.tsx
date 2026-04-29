export const dynamic = "force-dynamic";

import Link from "next/link";
import { getModuleDeclarations, listModules } from "@/lib/api";
import DeclarationItem from "@/components/DeclarationItem";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BrowseSidebar from "@/components/BrowseSidebar";
import MobileKindFilter from "@/components/MobileKindFilter";
import type { ModuleInfo, DeclarationKind } from "@/types";

interface Props {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<{ kinds?: string }>;
}

function getDirectChildren(
  modules: ModuleInfo[],
  prefix: string[]
): { name: string; fullPath: string[]; count: number }[] {
  const childMap = new Map<string, number>();

  for (const m of modules) {
    if (
      m.name.length > prefix.length &&
      prefix.every((part, i) => m.name[i] === part)
    ) {
      const childName = m.name[prefix.length];
      childMap.set(childName, (childMap.get(childName) ?? 0) + m.count);
    }
  }

  return Array.from(childMap.entries())
    .map(([name, count]) => ({ name, fullPath: [...prefix, name], count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export default async function ModulePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { kinds: kindsParam } = await searchParams;
  const moduleName = slug;

  const selectedKinds = kindsParam
    ? (kindsParam.split(",").filter(Boolean) as DeclarationKind[])
    : [];
  const kindsQuery = kindsParam ? `?kinds=${kindsParam}` : "";

  const [declarations, allModules] = await Promise.all([
    getModuleDeclarations(moduleName),
    listModules(),
  ]);

  const subModules = getDirectChildren(allModules, moduleName);
  const moduleDocstring = allModules.find(
    (m) => m.name.length === moduleName.length && m.name.every((p, i) => p === moduleName[i])
  )?.docstring ?? null;

  const filteredDeclarations =
    selectedKinds.length > 0
      ? declarations.filter((d) => selectedKinds.includes(d.kind))
      : declarations;

  return (
    <div className="min-h-screen flex flex-col">
      <Header currentPath="browse" />

      <main className="flex-1 max-w-6xl mx-auto w-full px-5 sm:px-6 pt-24 pb-10">
        <div className="flex gap-10">
          <BrowseSidebar
            modules={allModules}
            showKindFilter
            currentKinds={selectedKinds}
          />

          <div className="flex-1 min-w-0">
            <nav className="flex items-center gap-1.5 text-sm text-foreground/40 mb-6 flex-wrap">
              <Link
                href={`/browse${kindsQuery}`}
                className="hover:text-foreground/70 transition-colors"
              >
                Browse
              </Link>
              {moduleName.map((part, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <span>›</span>
                  {i < moduleName.length - 1 ? (
                    <Link
                      href={`/browse/${moduleName.slice(0, i + 1).join("/")}${kindsQuery}`}
                      className="hover:text-foreground/70 transition-colors"
                    >
                      {part}
                    </Link>
                  ) : (
                    <span className="text-foreground/80 font-medium">{part}</span>
                  )}
                </span>
              ))}
            </nav>

            <MobileKindFilter
              pathname={`/browse/${moduleName.join("/")}`}
              currentKinds={selectedKinds}
            />

            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight font-mono break-all">
                {moduleName.join(".")}
              </h1>
              {moduleDocstring && (
                <p className="text-foreground/70 text-sm mt-2 leading-relaxed whitespace-pre-wrap">
                  {moduleDocstring}
                </p>
              )}
              <p className="text-foreground/40 text-sm mt-1">
                {filteredDeclarations.length} declaration
                {filteredDeclarations.length !== 1 ? "s" : ""}
                {selectedKinds.length > 0 &&
                  ` (filtered from ${declarations.length})`}
                {subModules.length > 0 &&
                  ` · ${subModules.length} submodule${subModules.length !== 1 ? "s" : ""}`}
              </p>
            </div>

            {subModules.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xs font-semibold text-foreground/40 uppercase tracking-widest mb-3">
                  Submodules
                </h2>
                <div className="border border-foreground/10 rounded-xl overflow-hidden">
                  {subModules.map((sub, i) => (
                    <Link
                      key={i}
                      href={`/browse/${sub.fullPath.join("/")}${kindsQuery}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-foreground/5 transition-colors border-b border-foreground/10 last:border-0 group"
                    >
                      <span className="font-mono text-sm text-foreground/80 group-hover:text-foreground transition-colors truncate">
                        {sub.name}
                      </span>
                      <span className="text-xs text-foreground/35 tabular-nums shrink-0">
                        {sub.count}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {filteredDeclarations.length > 0 && (
              <div>
                {subModules.length > 0 && (
                  <h2 className="text-xs font-semibold text-foreground/40 uppercase tracking-widest mb-3">
                    Declarations
                  </h2>
                )}
                {filteredDeclarations.map((decl, i) => (
                  <DeclarationItem key={i} record={decl} />
                ))}
              </div>
            )}

            {subModules.length === 0 && filteredDeclarations.length === 0 && (
              <p className="text-foreground/40 text-sm">
                {selectedKinds.length > 0
                  ? "No declarations match the current filter."
                  : "No declarations found in this module."}
              </p>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
