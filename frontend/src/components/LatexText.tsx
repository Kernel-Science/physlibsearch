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
  // Match $$...$$, \[...\] (display), then \(...\), $...$ (inline)
  const re = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[^$\n]+?\$)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ type: "text", content: text.slice(last, match.index) });
    }
    const raw = match[0];
    if (raw.startsWith("$$")) {
      parts.push({ type: "block", latex: raw.slice(2, -2) });
    } else if (raw.startsWith("\\[")) {
      parts.push({ type: "block", latex: raw.slice(2, -2) });
    } else if (raw.startsWith("\\(")) {
      parts.push({ type: "inline", latex: raw.slice(2, -2) });
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const MATHBB_UNICODE: Record<string, string> = {
  R: "ℝ", C: "ℂ", Z: "ℤ", N: "ℕ", Q: "ℚ",
  P: "ℙ", H: "ℍ", F: "𝔽", K: "𝕂",
};

// The informal-description generator sometimes emits math-mode commands like
// `\mathbb{R}` inside `\text{...}`, which KaTeX (correctly) refuses to render.
// Replace those with their Unicode equivalents so the text renders cleanly.
function sanitizeLatex(latex: string): string {
  const textGroup = /\\text\{((?:[^{}]|\{[^{}]*\})*)\}/g;
  return latex.replace(textGroup, (_match, inner: string) => {
    const fixed = inner.replace(
      /\\mathbb\{([A-Z])\}/g,
      (m, letter: string) => MATHBB_UNICODE[letter] ?? m
    );
    return `\\text{${fixed}}`;
  });
}

function renderLatex(latex: string, displayMode: boolean): string {
  const source = sanitizeLatex(latex);
  try {
    return katex.renderToString(source, {
      displayMode,
      throwOnError: true,
      strict: "ignore",
      trust: false,
    });
  } catch {
    const [open, close] = displayMode ? ["\\[", "\\]"] : ["$", "$"];
    return escapeHtml(`${open}${latex}${close}`);
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
