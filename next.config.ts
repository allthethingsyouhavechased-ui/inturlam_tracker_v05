import type { NextConfig } from "next";

const scriptPolicy = process.env.NODE_ENV === "development"
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";
const contentSecurityPolicy = [
  "default-src 'self'",
  scriptPolicy,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Canlı 3001 sürecinin kullandığı `.next` klasörüne dokunmadan doğrulama
  // build'i alabilmek için yalnızca açıkça verildiğinde ayrı çıktı kökü kullan.
  distDir: process.env.INTURLAM_NEXT_DIST_DIR?.trim() || ".next",
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          // HTTPS'e kilitleme. Tarayıcılar HSTS'i YALNIZCA güvenli bir bağlantı
          // üzerinden gelirse dikkate alır; LAN'daki düz HTTP dağıtımında başlık
          // sessizce yok sayılır, yani bu satır oradaki kullanımı bozmaz. Buna
          // karşılık uygulama bir gün TLS arkasına alınırsa ilk isteğin HTTP'ye
          // düşmesini (ve oturum çerezinin düz metin gitmesini) engeller.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      // Varsayılan 1MB — yorum görseli eklerken gerçek telefon fotoğrafları
      // (birkaç MB) bu sınırı aşıp Server Action'a hiç ulaşmadan reddediliyordu.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
