import type { MetadataRoute } from "next";

// Web app manifest → served at /manifest.webmanifest. Enables add-to-home-screen
// / install as a standalone app. No push notifications (not decided yet).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Blue Carrot Solutions — Command Center",
    short_name: "Command Center",
    description:
      "Internal lead-gen property management for Blue Carrot Solutions.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#4f46e5",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
