import type { Metadata } from "next";
import "./globals.css";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";

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
      <body>
        {children}
        <FeedbackButton tabName="general" />
      </body>
    </html>
  );
}
