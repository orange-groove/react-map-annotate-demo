import { useEffect, useRef, useState } from "react";
import Map from "@arcgis/core/Map.js";
import MapView from "@arcgis/core/views/MapView.js";
import WebTileLayer from "@arcgis/core/layers/WebTileLayer.js";
import {
  Annotate as ArcgisAnnotate,
  ArcgisViewProvider,
  type ArcgisView,
  type TraceFn,
} from "@orange-groove/react-map-annotate/arcgis";
import "@arcgis/core/assets/esri/themes/light/main.css";

export default function ArcgisCanvas({
  view: camera,
  onViewChange,
  trace,
}: {
  view: { longitude: number; latitude: number; zoom: number };
  onViewChange: (view: {
    longitude: number;
    latitude: number;
    zoom: number;
  }) => void;
  trace?: TraceFn;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialCamera = useRef(camera);
  const [view, setView] = useState<ArcgisView | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const { longitude, latitude, zoom } = initialCamera.current;

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
      center: [longitude, latitude],
      zoom,
      popupEnabled: false,
      ui: { components: [] },
    });
    const handle = next.watch("stationary", (stationary) => {
      if (!stationary) return;
      const center = next.center;
      if (center.longitude == null || center.latitude == null) return;
      onViewChange({
        longitude: center.longitude,
        latitude: center.latitude,
        zoom: next.zoom,
      });
    });
    void next.when().then(() => {
      setView(next as unknown as ArcgisView);
    });

    return () => {
      handle.remove();
      next.destroy();
    };
  }, [onViewChange]);

  return (
    <div className="map-canvas">
      <div ref={containerRef} className="arcgis-view" />
      <ArcgisViewProvider view={view}>
        <ArcgisAnnotate trace={trace} />
      </ArcgisViewProvider>
    </div>
  );
}
