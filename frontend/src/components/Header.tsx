import Link from "next/link";

interface Props {
  currentPath?: string;
}

export default function Header({ currentPath }: Props) {
  return (
    <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 md:gap-3 px-3 md:px-5 py-2 md:py-2.5 rounded-full bg-background/80 backdrop-blur-lg border border-foreground/10 shadow-lg shadow-foreground/5 max-w-[calc(100vw-2rem)]">
      {/* Brand */}
      <Link
        href="/"
        className="flex items-center gap-2 md:gap-2.5 hover:opacity-80 transition-opacity shrink-0"
      >
        <span className="font-bold text-sm md:text-base tracking-tight whitespace-nowrap">PhyslibSearch</span>
        <span className="font-light text-xs text-foreground/35 hidden md:inline">by</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/KS_logo.png"
          alt="Kernel Science"
          style={{ height: "16px", width: "auto" }}
          className="dark:invert opacity-65 hidden md:block"
        />
      </Link>

      {/* Divider */}
      <span className="w-px h-4 bg-foreground/15 shrink-0" />

      {/* Nav */}
      <nav className="flex items-center gap-0.5 md:gap-1 shrink-0">
        <Link
          href="/docs"
          className={`text-xs md:text-sm px-2.5 md:px-3 py-1 rounded-full transition-colors whitespace-nowrap ${
            currentPath === "docs"
              ? "bg-foreground/10 text-foreground font-medium"
              : "text-foreground/50 hover:text-foreground/80 hover:bg-foreground/5"
          }`}
        >
          Docs
        </Link>
        <Link
          href="/browse"
          className={`text-xs md:text-sm px-2.5 md:px-3 py-1 rounded-full transition-colors whitespace-nowrap ${
            currentPath === "browse"
              ? "bg-foreground/10 text-foreground font-medium"
              : "text-foreground/50 hover:text-foreground/80 hover:bg-foreground/5"
          }`}
        >
          Browse
        </Link>
      </nav>

      {/* Divider + external — only on large screens */}
      <span className="w-px h-4 bg-foreground/15 hidden lg:block shrink-0" />
      <a
        href="https://physlib.io"
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-foreground/40 hover:text-foreground/70 transition-colors whitespace-nowrap hidden lg:block shrink-0"
      >
        physlib.io ↗
      </a>
    </header>
  );
}
