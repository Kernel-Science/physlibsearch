"use client";

import LatexText from "./LatexText";

interface Props {
  text: string;
}

function Paragraph({ text }: { text: string }) {
  const lines = text.trim().split("\n");
  const first = lines[0];

  const h3 = first.match(/^### (.+)/);
  if (h3) return <h3 className="font-semibold text-foreground/80 text-sm mt-3">{h3[1]}</h3>;

  const h2 = first.match(/^## (.+)/);
  if (h2) return <h2 className="font-semibold text-foreground/85 mt-3 first:mt-0">{h2[1]}</h2>;

  const h1 = first.match(/^# (.+)/);
  if (h1) return <h2 className="font-semibold text-foreground/90 mt-3 first:mt-0">{h1[1]}</h2>;

  const isAllBullets = lines.every((l) => l.startsWith("- "));
  if (isAllBullets) {
    return (
      <ul className="list-disc list-inside space-y-0.5">
        {lines.map((l, i) => (
          <li key={i} className="text-foreground/70">
            <LatexText text={l.slice(2)} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <p className="text-foreground/70">
      <LatexText text={text.trim()} />
    </p>
  );
}

export default function ModuleDocstring({ text }: Props) {
  const paragraphs = text.split(/\n{2,}/);
  return (
    <div className="text-sm leading-relaxed space-y-2 mt-2">
      {paragraphs.map((p, i) => p.trim() && <Paragraph key={i} text={p.trim()} />)}
    </div>
  );
}
