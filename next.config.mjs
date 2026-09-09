/** @type {import('next').NextConfig} */

// Content-Security-Policy is intentionally listed with named groups so it's
// easy to extend when a new external service is added. If you add a new
// API/script/image source anywhere in the app, add its domain here too —
// otherwise the browser will silently block it.
const CSP_DIRECTIVES = {
  "default-src": ["'self'"],
  "script-src": [
    "'self'",
    "'unsafe-inline'", // required for Next.js inline bootstrap + our theme-init script
    "'wasm-unsafe-eval'", // Cubism Core is a WebAssembly binary, needs this to compile/run
    "https://cdnjs.cloudflare.com",
    "https://va.vercel-scripts.com",
    "https://cubism.live2d.com", // Cubism Core SDK, loaded by the Aiko Live2D stage
  ],
  "style-src": [
    "'self'",
    "'unsafe-inline'", // required by CSS-in-JS / styled-jsx output and Font Awesome CSS
    "https://fonts.googleapis.com",
    "https://cdnjs.cloudflare.com",
  ],
  "font-src": [
    "'self'",
    "https://fonts.gstatic.com",
    "https://cdnjs.cloudflare.com",
    "data:",
  ],
  "img-src": [
    "'self'",
    "data:",
    "blob:",
    "https:", // OG image / avatar bisa dari host eksternal kalau kamu custom di config.js
  ],
  "connect-src": [
    "'self'",
    "https://app.unlimitedai.chat",
    "https://vitals.vercel-insights.com",
  ],
  "media-src": ["'self'", "https:"],
  "frame-ancestors": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "object-src": ["'none'"],
};

const cspString = Object.entries(CSP_DIRECTIVES)
  .map(([key, values]) => `${key} ${values.join(" ")}`)
  .join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspString },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig = {
  poweredByHeader: false, // don't advertise "X-Powered-By: Next.js" to attackers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
