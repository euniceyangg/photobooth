export default function manifest() {
  return {
    name: "Photo Booth",
    short_name: "Photo Booth",
    description: "A little photo booth for your phone.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#111111",
    theme_color: "#111111",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
