import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PhyslibSearch",
  description:
    "Semantic search for PhysLib — the formal Lean 4 physics library",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
