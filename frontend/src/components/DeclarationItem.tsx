"use client";

import { useState } from "react";
import type { SearchRecord, DeclarationKind } from "@/types";
import LatexText from "./LatexText";

interface Props {
  record: SearchRecord;
}

const KIND_COLORS: Record<DeclarationKind, string> = {
  theorem: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  definition: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  instance: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  structure: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  classInductive: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  inductive: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  abbrev: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  axiom: "bg-red-500/15 text-red-400 border-red-500/30",
  opaque: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  example: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  proofWanted: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
};

function docUrl(moduleName: string[], name: string[]): string {
  const path = moduleName.join("/");
  const anchor = name.join(".");
  return `https://physlib.io/docs/${path}.html#${anchor}`;
}

export default function DeclarationItem({ record }: Props) {
  const [expanded, setExpanded] = useState(false);
  const kindColor = KIND_COLORS[record.kind] ?? "bg-slate-500/15 text-slate-400 border-slate-500/30";
  const anchor = record.name.at(-1) ?? "";

  return (
    <div id={anchor} className="border-b border-foreground/10 last:border-0 py-5">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 shrink-0 text-xs font-mono px-2 py-0.5 rounded-full border ${kindColor}`}>
          {record.kind}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-base leading-snug min-w-0 break-words">
              <LatexText text={record.informal_name} />
            </h3>
            <a
              href={docUrl(record.module_name, record.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-foreground/30 hover:text-foreground/60 font-mono shrink-0 mt-0.5 hidden sm:block"
            >
              #{anchor}
            </a>
          </div>

          <p className="mt-1.5 text-sm text-foreground/70 leading-relaxed break-words">
            <LatexText text={record.informal_description} />
          </p>

          <div className="mt-3">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-foreground/35 hover:text-foreground/60 transition-colors flex items-start gap-1 text-left max-w-full"
            >
              <span className="shrink-0">{expanded ? "▾" : "▸"}</span>
              <span className="font-mono break-all min-w-0">{record.name.join(".")}</span>
            </button>
            {expanded && (
              <pre className="mt-2 p-3 bg-foreground/5 rounded-lg text-xs font-mono overflow-x-auto text-foreground/65 border border-foreground/10 leading-relaxed whitespace-pre-wrap break-words">
                {record.signature}
                {record.value
                  ? `\n${record.value.trimStart().startsWith(":=") ? record.value : `:= ${record.value}`}`
                  : ""}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
