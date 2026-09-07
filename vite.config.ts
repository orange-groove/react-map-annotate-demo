import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const annotateRoot = path.resolve(
  fileURLToPath(new URL("../react-map-annotate", import.meta.url)),
);
const hasLocalLibrary = fs.existsSync(path.join(annotateRoot, "src/mapbox.ts"));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: hasLocalLibrary
      ? {
          "@orange-groove/react-map-annotate/styles.css": path.join(
            annotateRoot,
            "src/styles.css",
          ),
          "@orange-groove/react-map-annotate/arcgis": path.join(
            annotateRoot,
            "src/arcgis.ts",
          ),
          "@orange-groove/react-map-annotate/leaflet": path.join(
            annotateRoot,
            "src/leaflet.ts",
          ),
          "@orange-groove/react-map-annotate/google": path.join(
            annotateRoot,
            "src/google.ts",
          ),
          "@orange-groove/react-map-annotate/maplibre": path.join(
            annotateRoot,
            "src/maplibre.ts",
          ),
          "@orange-groove/react-map-annotate/mapbox": path.join(
            annotateRoot,
            "src/mapbox.ts",
          ),
          "@orange-groove/react-map-annotate": path.join(
            annotateRoot,
            "src/index.ts",
          ),
        }
      : {},
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
    exclude: ["@arcgis/core", "@orange-groove/react-map-annotate"],
  },
  server: hasLocalLibrary
    ? {
        fs: {
          allow: [path.resolve(annotateRoot, "..")],
        },
      }
    : undefined,
  preview: {
    host: true,
    allowedHosts: true,
  },
});
