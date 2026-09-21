import type { MetadataRoute } from "next";

/** Manifest do PWA — o app instalável é o LoopChat (caixa de entrada). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LoopChat",
    short_name: "LoopChat",
    description: "Caixa de entrada do WhatsApp — LoopSale",
    start_url: "/loopchat",
    scope: "/loopchat",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#6d28d9",
    lang: "pt-BR",
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/pwa/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
