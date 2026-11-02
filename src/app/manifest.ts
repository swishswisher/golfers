import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Clubline",
    short_name: "Clubline",
    description: "Your club, connected.",
    start_url: "/app",
    display: "standalone",
    background_color: "#f4f5ef",
    theme_color: "#15382f",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
