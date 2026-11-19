import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Investara",
    short_name: "Investara",
    start_url: "/",
    display: "standalone",
    background_color: "#f0f5fb",
    theme_color: "#f0f5fb",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
