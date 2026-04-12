"use client";

import katex from "katex";

interface Props {
  text: string;
  className?: string;
}

type Part =
  | { type: "text"; content: string }
  | { type: "inline"; latex: string }
  | { type: "block"; latex: string };

function parseParts(text: string): Part[] {
  const parts: Part[] = [];
  // Match $$...$$ first (display), then $...$ (inline)
  const re = /(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ type: "text", content: text.slice(last, match.index) });
    }
    const raw = match[0];
    if (raw.startsWith("$$")) {
      parts.push({ type: "block", latex: raw.slice(2, -2) });
    } else {
      parts.push({ type: "inline", latex: raw.slice(1, -1) });
    }
    last = match.index + raw.length;
  }

  if (last < text.length) {
    parts.push({ type: "text", content: text.slice(last) });
  }
  return parts;
}

function renderLatex(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      trust: false,
    });
  } catch {
    return latex;
  }
}

export default function LatexText({ text, className }: Props) {
  const parts = parseParts(text);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.type === "text") {
          return <span key={i}>{part.content}</span>;
        }
        if (part.type === "inline") {
          return (
            <span
              key={i}
              dangerouslySetInnerHTML={{
                __html: renderLatex(part.latex, false),
              }}
            />
          );
        }
        return (
          <span
            key={i}
            className="block"
            dangerouslySetInnerHTML={{
              __html: renderLatex(part.latex, true),
            }}
          />
        );
      })}
    </span>
  );
}
