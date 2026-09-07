import { useEffect, useRef, useState } from "react";
import Map from "@arcgis/core/Map.js";
import MapView from "@arcgis/core/views/MapView.js";
import WebTileLayer from "@arcgis/core/layers/WebTileLayer.js";
import {
  Annotate as ArcgisAnnotate,
  ArcgisViewProvider,
  type ArcgisView,
} from "@orange-groove/react-map-annotate/arcgis";
import "@arcgis/core/assets/esri/themes/light/main.css";

export default function ArcgisCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<ArcgisView | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = new Map({
      layers: [
        new WebTileLayer({
          urlTemplate:
            "https://{subDomain}.tile.openstreetmap.org/{level}/{col}/{row}.png",
          subDomains: ["a", "b", "c"],
          copyright: "OpenStreetMap",
        }),
      ],
    });
    const next = new MapView({
      container,
      map,
      center: [-73.9857, 40.7484],
      zoom: 14,
      popupEnabled: false,
      ui: { components: [] },
    });
    void next.when().then(() => {
      setView(next as unknown as ArcgisView);
    });

    return () => {
      next.destroy();
    };
  }, []);

  return (
    <div className="map-canvas">
      <div ref={containerRef} className="arcgis-view" />
      <ArcgisViewProvider view={view}>
        <ArcgisAnnotate />
      </ArcgisViewProvider>
    </div>
  );
}
