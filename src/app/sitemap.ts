import type { MetadataRoute } from "next";
import { site } from "@/config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: site.url, changeFrequency: "weekly", priority: 1 },
    { url: `${site.url}/terminal`, changeFrequency: "always", priority: 0.9 },
    { url: `${site.url}/rigs`, changeFrequency: "hourly", priority: 0.8 },
  ];
}
