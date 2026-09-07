import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "mapbox-gl",
      "maplibre-gl",
      "react-map-gl",
      "leaflet",
      "react-leaflet",
      "@arcgis/core",
    ],
  },
  optimizeDeps: {
    exclude: ["@arcgis/core"],
  },
  preview: {
    host: true,
    allowedHosts: true,
  },
});
