import Link from "next/link";
import { getModuleDeclarations } from "@/lib/api";
import DeclarationItem from "@/components/DeclarationItem";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

interface Props {
  params: Promise<{ slug: string[] }>;
}

export default async function ModulePage({ params }: Props) {
  const { slug } = await params;
  const moduleName = slug;
  const declarations = await getModuleDeclarations(moduleName);

  return (
    <div className="min-h-screen flex flex-col">
      <Header currentPath="browse" />

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 pt-24 pb-10">
        <nav className="flex items-center gap-1.5 text-sm text-foreground/40 mb-6 flex-wrap">
          <Link href="/browse" className="hover:text-foreground/70 transition-colors">
            Browse
          </Link>
          {moduleName.map((part, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span>›</span>
              {i < moduleName.length - 1 ? (
                <Link
                  href={`/browse/${moduleName.slice(0, i + 1).join("/")}`}
                  className="hover:text-foreground/70 transition-colors"
                >
                  {part}
                </Link>
              ) : (
                <span className="text-foreground/80 font-medium">{part}</span>
              )}
            </span>
          ))}
        </nav>

        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight font-mono">{moduleName.join(".")}</h1>
          <p className="text-foreground/40 text-sm mt-1">
            {declarations.length} declaration{declarations.length !== 1 ? "s" : ""}
          </p>
        </div>

        {declarations.length === 0 ? (
          <p className="text-foreground/40 text-sm">No declarations found in this module.</p>
        ) : (
          <div>
            {declarations.map((decl, i) => (
              <DeclarationItem key={i} record={decl} />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
