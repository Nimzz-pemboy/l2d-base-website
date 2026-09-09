import config from "@/lib/config";

export default function sitemap() {
  const now = new Date();

  return [
    {
      url: config.siteUrl,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
  ];
}
