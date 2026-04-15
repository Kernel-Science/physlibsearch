"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="w-7 h-7 shrink-0" />;

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle dark mode"
      className="p-1.5 rounded-full text-foreground/50 hover:text-foreground/80 hover:bg-foreground/5 transition-colors shrink-0"
    >
      {isDark ? <Sun size={15} fill="currentColor" /> : <Moon size={15} fill="currentColor" />}
    </button>
  );
}
