import type { MetadataRoute } from "next"

/** Web app manifest so the app can be installed as a standalone desktop app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FinAlly — personal finances",
    short_name: "FinAlly",
    description: "Your quiet place to look after your money.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  }
}
