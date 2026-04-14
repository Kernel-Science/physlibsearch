export default function Footer() {
  return (
    <footer className="border-t border-foreground/10 px-6 py-4 flex items-center gap-4 text-xs text-foreground/30">
      <a
        href="https://kernel-science.com"
        target="_blank"
        rel="noopener noreferrer"
        className="opacity-40 hover:opacity-70 transition-opacity shrink-0"
        aria-label="Made by Kernel Science"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/KS_logo.png"
          alt="Kernel Science"
          style={{ height: "20px", width: "auto" }}
          className="dark:invert"
        />
      </a>
      <span>
        PhyslibSearch · powered by{" "}
        <a
          href="https://physlib.io"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground/50 transition-colors"
        >
          Physlib
        </a>{" "}
        & Gemini embeddings
      </span>
    </footer>
  );
}
