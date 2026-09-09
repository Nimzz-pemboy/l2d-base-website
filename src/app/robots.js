import config from "@/lib/config";

// Explicitly welcoming AI/LLM crawlers (in addition to the wildcard allow)
// so it's unambiguous that this site wants to be indexed and cited by AI
// assistants (ChatGPT, Claude, Gemini, Perplexity, etc.), not just
// traditional search engines.
const AI_CRAWLERS = [
  "GPTBot", // OpenAI / ChatGPT
  "OAI-SearchBot", // OpenAI search
  "ChatGPT-User",
  "ClaudeBot", // Anthropic / Claude
  "Claude-Web",
  "anthropic-ai",
  "Google-Extended", // Gemini / Google AI features
  "GoogleOther",
  "PerplexityBot", // Perplexity
  "Perplexity-User",
  "Bytespider", // TikTok/ByteDance AI
  "CCBot", // Common Crawl (used to train many LLMs)
  "Applebot-Extended", // Apple Intelligence
  "Meta-ExternalAgent", // Meta AI
  "DuckAssistBot", // DuckDuckGo AI
];

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: ["/api/"],
      })),
    ],
    sitemap: `${config.siteUrl}/sitemap.xml`,
    host: config.siteUrl,
  };
}
