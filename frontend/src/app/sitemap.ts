import type { MetadataRoute } from "next";
import { listModules } from "@/lib/api";

const BASE_URL = "https://physlibsearch.net";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/browse`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/docs`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  let moduleRoutes: MetadataRoute.Sitemap = [];
  try {
    const modules = await listModules();
    moduleRoutes = modules.map((m) => ({
      url: `${BASE_URL}/browse/${m.name.join("/")}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    }));
  } catch {
    // If the API is unavailable at build time, skip module routes
  }

  return [...staticRoutes, ...moduleRoutes];
}
