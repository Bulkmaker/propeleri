import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HC Propeleri - Hokejaski klub Novi Sad",
    short_name: "HC Propeleri",
    description:
      "Amaterski hokejaski klub Propeleri iz Novog Sada",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0f1a",
    theme_color: "#1a2744",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
