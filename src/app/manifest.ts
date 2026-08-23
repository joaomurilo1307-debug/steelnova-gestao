import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SteelNova | Gestão de Obras",
    short_name: "SteelNova Obras",
    description: "Gestão de obras, planejamento, custos e equipe da SteelNova Engenharia.",
    start_url: "/inicio",
    scope: "/",
    display: "standalone",
    background_color: "#0B0D10",
    theme_color: "#E8802B",
    lang: "pt-BR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
