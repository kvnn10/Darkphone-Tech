import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "DarkPhone Tech",
    short_name: "DarkPhone",
    description: "Gestión integral de inventario, ventas y servicio técnico.",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#08090b",
    theme_color: "#08090b",
    lang: "es-CO",
    icons: [
      {
        src: "/darkphone-mark.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/darkphone-mark.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
