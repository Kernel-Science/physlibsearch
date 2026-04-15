"use client";

import { useState } from "react";
import { Button, Card } from "@heroui/react";
import type { QueryResult, DeclarationKind } from "@/types";
import LatexText from "./LatexText";

interface Props {
  result: QueryResult;
  rank: number;
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

function formatName(name: string[]): string {
  return name.join(".");
}

function moduleUrl(moduleName: string[]): string {
  const path = moduleName.join("/");
  return `https://github.com/HEPLean/PhysLean/blob/master/${path}.lean`;
}

function docUrl(moduleName: string[], name: string[]): string {
  const path = moduleName.join("/");
  const anchor = name.join(".");
  return `https://physlib.io/docs/${path}.html#${anchor}`;
}

export default function ResultCard({ result, rank }: Props) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { result: record, distance } = result;

  const qualifiedName = formatName(record.name);
  const kindColor =
    KIND_COLORS[record.kind] ??
    "bg-slate-500/15 text-slate-400 border-slate-500/30";

  async function copyName() {
    await navigator.clipboard.writeText(qualifiedName);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card className="w-full">
      <Card.Header>
        <div className="flex items-start justify-between gap-3 w-full">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-xs font-mono px-2 py-0.5 rounded-full border ${kindColor}`}
            >
              {record.kind}
            </span>
            <span className="text-xs text-foreground/40 font-mono">
              #{rank} · {(1 - distance).toFixed(3)} relevance
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onPress={copyName}
            className="shrink-0 text-xs"
          >
            {copied ? "Copied!" : "Copy name"}
          </Button>
        </div>
        <Card.Title className="mt-2 text-lg leading-snug">
          <LatexText text={record.informal_name} />
        </Card.Title>
        <a
          href={`/browse/${record.module_name.join("/")}`}
          className="flex items-center gap-1 mt-1 flex-wrap hover:text-foreground/70 transition-colors"
        >
          {record.module_name.map((part, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && (
                <span className="text-foreground/30 text-xs">›</span>
              )}
              <span className="text-xs text-foreground/50 font-mono">
                {part}
              </span>
            </span>
          ))}
        </a>
      </Card.Header>

      <Card.Content>
        <div className="text-sm leading-relaxed text-foreground/80">
          <LatexText text={record.informal_description} />
        </div>

        <div className="mt-4">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-foreground/40 hover:text-foreground/70 transition-colors flex items-center gap-1"
          >
            <span>{expanded ? "▾" : "▸"}</span>
            <span>Formal signature</span>
          </button>
          {expanded && (
            <pre className="mt-2 p-3 bg-foreground/5 rounded-lg text-xs font-mono overflow-x-auto text-foreground/70 border border-foreground/10 leading-relaxed">
              {record.signature}
            </pre>
          )}
        </div>
      </Card.Content>

      <Card.Footer className="flex gap-4">
        <a
          href={docUrl(record.module_name, record.name)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-foreground/40 hover:text-foreground/70 transition-colors font-mono"
        >
          {formatName(record.name)} ↗
        </a>
        <a
          href={moduleUrl(record.module_name)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-foreground/40 hover:text-foreground/70 transition-colors"
        >
          Source ↗
        </a>
      </Card.Footer>
    </Card>
  );
}
