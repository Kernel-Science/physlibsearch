export const dynamic = "force-dynamic";

import Link from "next/link";
import { getModuleDeclarations, listModules } from "@/lib/api";
import DeclarationItem from "@/components/DeclarationItem";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import type { ModuleInfo } from "@/types";

interface Props {
  params: Promise<{ slug: string[] }>;
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

export default async function ModulePage({ params }: Props) {
  const { slug } = await params;
  const moduleName = slug;

  const [declarations, allModules] = await Promise.all([
    getModuleDeclarations(moduleName),
    listModules(),
  ]);

  const subModules = getDirectChildren(allModules, moduleName);

  return (
    <div className="min-h-screen flex flex-col">
      <Header currentPath="browse" />

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 pt-24 pb-10">
        <nav className="flex items-center gap-1.5 text-sm text-foreground/40 mb-6 flex-wrap">
          <Link href="/browse" className="hover:text-foreground/70 transition-colors">
            Browse
          </Link>
          {moduleName.map((part, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span>›</span>
              {i < moduleName.length - 1 ? (
                <Link
                  href={`/browse/${moduleName.slice(0, i + 1).join("/")}`}
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

        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight font-mono">
            {moduleName.join(".")}
          </h1>
          <p className="text-foreground/40 text-sm mt-1">
            {declarations.length} declaration{declarations.length !== 1 ? "s" : ""}
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
                  href={`/browse/${sub.fullPath.join("/")}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-foreground/5 transition-colors border-b border-foreground/10 last:border-0 group"
                >
                  <span className="font-mono text-sm text-foreground/80 group-hover:text-foreground transition-colors">
                    {sub.name}
                  </span>
                  <span className="text-xs text-foreground/35 tabular-nums">
                    {sub.count}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {declarations.length > 0 && (
          <div>
            {subModules.length > 0 && (
              <h2 className="text-xs font-semibold text-foreground/40 uppercase tracking-widest mb-3">
                Declarations
              </h2>
            )}
            {declarations.map((decl, i) => (
              <DeclarationItem key={i} record={decl} />
            ))}
          </div>
        )}

        {subModules.length === 0 && declarations.length === 0 && (
          <p className="text-foreground/40 text-sm">
            No declarations found in this module.
          </p>
        )}
      </main>

      <Footer />
    </div>
  );
}
