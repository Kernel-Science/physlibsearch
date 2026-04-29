"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ModuleInfo, DeclarationKind } from "@/types";

const ALL_KINDS: DeclarationKind[] = [
  "theorem",
  "definition",
  "structure",
  "inductive",
  "classInductive",
  "instance",
  "abbrev",
  "axiom",
  "opaque",
  "proofWanted",
];

const KIND_LABELS: Partial<Record<DeclarationKind, string>> = {
  theorem: "Theorem",
  definition: "Definition",
  structure: "Structure",
  inductive: "Inductive",
  classInductive: "Class",
  instance: "Instance",
  abbrev: "Abbreviation",
  axiom: "Axiom",
  opaque: "Opaque",
  proofWanted: "Proof Wanted",
};

interface Props {
  modules: ModuleInfo[];
  showKindFilter?: boolean;
  currentKinds?: DeclarationKind[];
}

function getSubmodules(modules: ModuleInfo[], lib: string) {
  const subMap = new Map<string, number>();
  for (const m of modules) {
    if (m.name[0] === lib && m.name.length > 1) {
      const sub = m.name[1];
      subMap.set(sub, (subMap.get(sub) ?? 0) + m.count);
    }
  }
  return Array.from(subMap.entries())
    .map(([name, count]) => ({ name, fullPath: [lib, name], count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function displayName(lib: string) {
  if (lib === "QuantumInfo") return "Quantum Info";
  return lib;
}

export default function BrowseSidebar({
  modules,
  showKindFilter,
  currentKinds = [],
}: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const topLevelNames = Array.from(
    new Set(modules.map((m) => m.name[0]).filter(Boolean))
  ).sort();

  const initialExpanded = new Set(
    topLevelNames.filter((lib) => pathname.startsWith(`/browse/${lib}`))
  );
  const [expandedLibs, setExpandedLibs] = useState<Set<string>>(initialExpanded);

  function toggleLib(lib: string) {
    setExpandedLibs((prev) => {
      const next = new Set(prev);
      if (next.has(lib)) next.delete(lib);
      else next.add(lib);
      return next;
    });
  }

  function toggleKind(kind: DeclarationKind) {
    const isVisible = currentKinds.length === 0 || currentKinds.includes(kind);

    let newKinds: DeclarationKind[];
    if (isVisible) {
      newKinds =
        currentKinds.length === 0
          ? ALL_KINDS.filter((k) => k !== kind)
          : currentKinds.filter((k) => k !== kind);
    } else {
      newKinds = [...currentKinds, kind];
    }

    const isAll = newKinds.length === 0 || newKinds.length === ALL_KINDS.length;
    router.replace(isAll ? pathname : `${pathname}?kinds=${newKinds.join(",")}`);
  }

  const kindsQuery =
    currentKinds.length > 0 ? `?kinds=${currentKinds.join(",")}` : "";

  return (
    <aside className="w-52 shrink-0 sticky top-24 self-start hidden lg:block max-h-[calc(100vh-6rem)] overflow-y-auto pr-1 thin-scrollbar">
      {/* Library tree */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-foreground/40 uppercase tracking-widest mb-3">
          Libraries
        </p>
        <div className="flex flex-col gap-0.5">
          <Link
            href={`/browse${kindsQuery}`}
            className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
              pathname === "/browse"
                ? "bg-foreground/10 text-foreground font-medium"
                : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
            }`}
          >
            All
          </Link>

          {topLevelNames.map((lib) => {
            const submodules = getSubmodules(modules, lib);
            const isOnLib =
              pathname === `/browse/${lib}` ||
              pathname.startsWith(`/browse/${lib}/`);
            const isExpanded = expandedLibs.has(lib);

            return (
              <div key={lib}>
                <div className="flex items-center gap-1">
                  <Link
                    href={`/browse/${lib}${kindsQuery}`}
                    className={`flex-1 text-sm px-3 py-1.5 rounded-lg transition-colors ${
                      isOnLib
                        ? "bg-foreground/10 text-foreground font-medium"
                        : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
                    }`}
                  >
                    {displayName(lib)}
                  </Link>
                  {submodules.length > 0 && (
                    <button
                      onClick={() => toggleLib(lib)}
                      className="p-1.5 text-foreground/30 hover:text-foreground/60 transition-colors text-xs leading-none"
                      aria-label={isExpanded ? "Collapse" : "Expand"}
                    >
                      {isExpanded ? "▾" : "▸"}
                    </button>
                  )}
                </div>

                {isExpanded && submodules.length > 0 && (
                  <div className="ml-4 mt-0.5 mb-1 flex flex-col gap-0.5 border-l border-foreground/10 pl-3">
                    {submodules.map((sub) => {
                      const isActive =
                        pathname === `/browse/${sub.fullPath.join("/")}` ||
                        pathname.startsWith(`/browse/${sub.fullPath.join("/")}/`);
                      return (
                        <Link
                          key={sub.name}
                          href={`/browse/${sub.fullPath.join("/")}${kindsQuery}`}
                          className={`text-xs py-1 px-2 rounded transition-colors flex items-center justify-between gap-2 ${
                            isActive
                              ? "bg-foreground/10 text-foreground font-medium"
                              : "text-foreground/50 hover:text-foreground/80 hover:bg-foreground/5"
                          }`}
                        >
                          <span className="font-mono truncate">{sub.name}</span>
                          <span className="text-foreground/30 tabular-nums shrink-0">
                            {sub.count}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Kind filter */}
      {showKindFilter && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-foreground/40 uppercase tracking-widest">
              Filter by Kind
            </p>
            {currentKinds.length > 0 && (
              <button
                onClick={() => router.replace(pathname)}
                className="text-xs text-foreground/40 hover:text-foreground/60 transition-colors"
              >
                Reset
              </button>
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            {ALL_KINDS.map((kind) => {
              const isVisible =
                currentKinds.length === 0 || currentKinds.includes(kind);
              return (
                <label
                  key={kind}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-foreground/5 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={() => toggleKind(kind)}
                    className="w-3.5 h-3.5 accent-blue-400 cursor-pointer"
                  />
                  <span className="text-sm text-foreground/60">
                    {KIND_LABELS[kind] ?? kind}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
