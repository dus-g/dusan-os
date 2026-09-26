import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dusan OS",
    short_name: "Dusan OS",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#161b26",
    theme_color: "#161b26",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
