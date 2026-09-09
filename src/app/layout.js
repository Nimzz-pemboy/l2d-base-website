import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import config from "@/lib/config";

export const metadata = {
  metadataBase: new URL(config.siteUrl),
  title: `${config.companion.name} — AI Live2D Companion`,
  description: config.companion.tagline,
  authors: [{ name: config.ownerName }],
  creator: config.ownerName,
  openGraph: {
    title: `${config.companion.name} — AI Live2D Companion`,
    description: config.companion.tagline,
    url: config.siteUrl,
    siteName: config.companion.name,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `Pratinjau ${config.companion.name}`,
      },
    ],
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${config.companion.name} — AI Live2D Companion`,
    description: config.companion.tagline,
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }) {
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: config.companion.name,
    url: config.siteUrl,
    description: config.companion.tagline,
    inLanguage: "id-ID",
  };

  return (
    <html lang="id" data-theme="dark">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"
        />
        <link rel="alternate" type="text/plain" href="/llms.txt" title="LLMs.txt" />
      </head>
      <body>
        <script
          id="json-ld-website"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
