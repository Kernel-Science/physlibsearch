"use client";

import { useRouter } from "next/navigation";
import type { DeclarationKind } from "@/types";

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
  abbrev: "Abbrev",
  axiom: "Axiom",
  opaque: "Opaque",
  proofWanted: "Proof Wanted",
};

interface Props {
  pathname: string;
  currentKinds: DeclarationKind[];
}

export default function MobileKindFilter({ pathname, currentKinds }: Props) {
  const router = useRouter();

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

  return (
    <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto pb-1 mb-5 -mx-5 sm:-mx-6 px-5 sm:px-6 thin-scrollbar">
      {currentKinds.length > 0 && (
        <button
          onClick={() => router.replace(pathname)}
          className="shrink-0 text-xs px-3 py-1 rounded-full border border-foreground/25 text-foreground/50 hover:text-foreground/80 transition-colors whitespace-nowrap"
        >
          Reset
        </button>
      )}
      {ALL_KINDS.map((kind) => {
        const isVisible = currentKinds.length === 0 || currentKinds.includes(kind);
        return (
          <button
            key={kind}
            onClick={() => toggleKind(kind)}
            className={`shrink-0 text-xs px-3 py-1 rounded-full border transition-colors whitespace-nowrap ${
              isVisible
                ? "border-foreground/20 bg-foreground/8 text-foreground/70"
                : "border-foreground/10 text-foreground/25"
            }`}
          >
            {KIND_LABELS[kind] ?? kind}
          </button>
        );
      })}
    </div>
  );
}
