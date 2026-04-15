import type { Metadata } from "next";
import "./globals.css";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";
import { Providers } from "./providers";

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
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <Providers>
          {children}
          <FeedbackButton tabName="general" />
        </Providers>
      </body>
    </html>
  );
}
