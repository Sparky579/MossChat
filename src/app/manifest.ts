import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MossChat",
    short_name: "MossChat",
    description: "Browser local chat client for your own model API keys",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#198754",
    icons: [
      { src: "/icons/mosschat-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/mosschat-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
