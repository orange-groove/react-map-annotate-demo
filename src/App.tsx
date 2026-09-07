import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { JsonTree } from "./JsonTree";
import {
  GoogleOsmPrefetch,
  LeafletOsmPrefetch,
  useOsmTrace,
} from "./osmTrace";
import { APIProvider, Map as GoogleMap } from "@vis.gl/react-google-maps";
import MapboxMap, { NavigationControl as MapboxNav } from "react-map-gl/mapbox";
import MapLibreMap, {
  NavigationControl as MapLibreNav,
} from "react-map-gl/maplibre";
import {
  Annotate as MapboxAnnotate,
  AnnotateList,
  AnnotateProvider,
  AnnotateToolbar,
  type Annotation,
  type TraceFn,
} from "@orange-groove/react-map-annotate/mapbox";
import { Annotate as MapLibreAnnotate } from "@orange-groove/react-map-annotate/maplibre";
import { Annotate as GoogleAnnotate } from "@orange-groove/react-map-annotate/google";
import { Annotate as LeafletAnnotate } from "@orange-groove/react-map-annotate/leaflet";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "mapbox-gl/dist/mapbox-gl.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "leaflet/dist/leaflet.css";
import "@orange-groove/react-map-annotate/styles.css";

const ArcgisCanvas = lazy(() => import("./ArcgisCanvas"));

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const MAPLIBRE_STYLE =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

type Engine = "mapbox" | "maplibre" | "google" | "leaflet" | "arcgis";

type MapView = {
  longitude: number;
  latitude: number;
  zoom: number;
};

const DEFAULT_VIEW: MapView = {
  longitude: -73.9857,
  latitude: 40.7484,
  zoom: 16,
};

const ENGINES: { id: Engine; label: string }[] = [
  { id: "mapbox", label: "Mapbox" },
  { id: "maplibre", label: "MapLibre" },
  { id: "google", label: "Google" },
  { id: "leaflet", label: "Leaflet" },
  { id: "arcgis", label: "ArcGIS" },
];

export default function App() {
  const [engine, setEngine] = useState<Engine>("mapbox");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [stateOpen, setStateOpen] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [showArea, setShowArea] = useState(true);
  const [view, setView] = useState<MapView>(DEFAULT_VIEW);
  // Google / Leaflet / ArcGIS have no vector query. Mapbox and MapLibre
  // keep the library's built-in Trace — do not put this on AnnotateProvider.
  const osmTrace = useOsmTrace(
    view,
    engine === "google" || engine === "leaflet" || engine === "arcgis",
  );
  const onViewChange = useCallback((next: MapView) => {
    setView((current) =>
      current.longitude === next.longitude &&
      current.latitude === next.latitude &&
      current.zoom === next.zoom
        ? current
        : next,
    );
  }, []);

  return (
    <AnnotateProvider
      annotations={annotations}
      onChange={setAnnotations}
      showLabels={showLabels}
      showArea={showArea}
    >
      <div className="app">
        <div
          className={stateOpen ? "state-dock is-open" : "state-dock"}
        >
          <button
            type="button"
            className="state-toggle"
            aria-expanded={stateOpen}
            aria-controls="annotation-state"
            onClick={() => setStateOpen((open) => !open)}
          >
            State
          </button>
          <aside
            id="annotation-state"
            className="state-flyout"
            aria-label="Annotation state"
          >
            <div className="state-flyout-heading">state</div>
            <div className="state-flyout-toggles">
              <label>
                <input
                  type="checkbox"
                  checked={showLabels}
                  onChange={(event) => setShowLabels(event.target.checked)}
                />
                Labels
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showArea}
                  onChange={(event) => setShowArea(event.target.checked)}
                />
                Area
              </label>
            </div>
            <div className="state-flyout-json">
              <JsonTree value={{ view, annotations }} />
            </div>
          </aside>
        </div>
        <div className="engine-switch" role="tablist" aria-label="Map engine">
          {ENGINES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={engine === item.id}
              className={engine === item.id ? "is-active" : undefined}
              onClick={() => setEngine(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {engine === "mapbox" ? (
          <MapboxCanvas view={view} onViewChange={onViewChange} />
        ) : engine === "maplibre" ? (
          <MapLibreCanvas view={view} onViewChange={onViewChange} />
        ) : engine === "google" ? (
          <GoogleCanvas
            view={view}
            onViewChange={onViewChange}
            osmTrace={osmTrace}
          />
        ) : engine === "leaflet" ? (
          <LeafletCanvas
            view={view}
            onViewChange={onViewChange}
            osmTrace={osmTrace}
          />
        ) : (
          <Suspense fallback={null}>
            <ArcgisCanvas
              view={view}
              onViewChange={onViewChange}
              trace={osmTrace}
            />
          </Suspense>
        )}
        <div className="toolbar">
          <AnnotateToolbar />
        </div>
        <div className="lists">
          <div className="list">
            <AnnotateList />
          </div>
        </div>
      </div>
    </AnnotateProvider>
  );
}

function MapboxCanvas({
  view,
  onViewChange,
}: {
  view: MapView;
  onViewChange: (view: MapView) => void;
}) {
  if (!TOKEN) {
    return (
      <div className="missing-token">
        <p>
          Add a Mapbox token to <code>.env</code>, or switch to MapLibre.
        </p>
        <pre>VITE_MAPBOX_TOKEN=pk.your_token</pre>
      </div>
    );
  }

  return (
    <MapboxMap
      mapboxAccessToken={TOKEN}
      initialViewState={view}
      onMove={(event) =>
        onViewChange({
          longitude: event.viewState.longitude,
          latitude: event.viewState.latitude,
          zoom: event.viewState.zoom,
        })
      }
      mapStyle="mapbox://styles/mapbox/streets-v12"
      attributionControl={false}
      style={{ width: "100%", height: "100%" }}
    >
      <MapboxNav position="bottom-right" showCompass={false} />
      <MapboxAnnotate enableTerrain />
    </MapboxMap>
  );
}

function MapLibreCanvas({
  view,
  onViewChange,
}: {
  view: MapView;
  onViewChange: (view: MapView) => void;
}) {
  return (
    <MapLibreMap
      initialViewState={view}
      onMove={(event) =>
        onViewChange({
          longitude: event.viewState.longitude,
          latitude: event.viewState.latitude,
          zoom: event.viewState.zoom,
        })
      }
      mapStyle={MAPLIBRE_STYLE}
      attributionControl={false}
      style={{ width: "100%", height: "100%" }}
    >
      <MapLibreNav position="bottom-right" showCompass={false} />
      <MapLibreAnnotate />
    </MapLibreMap>
  );
}

function GoogleCanvas({
  view,
  onViewChange,
  osmTrace,
}: {
  view: MapView;
  onViewChange: (view: MapView) => void;
  osmTrace: TraceFn;
}) {
  const publishedView = useRef(view);
  if (!GOOGLE_KEY) {
    return (
      <div className="missing-token">
        <p>
          Add a Google Maps key to <code>.env</code>, or switch to MapLibre.
        </p>
        <pre>VITE_GOOGLE_MAPS_API_KEY=your_key</pre>
      </div>
    );
  }

  return (
    <APIProvider apiKey={GOOGLE_KEY}>
      <GoogleMap
        defaultCenter={{ lat: view.latitude, lng: view.longitude }}
        defaultZoom={view.zoom}
        onCameraChanged={(event) => {
          const next = {
            longitude: event.detail.center.lng,
            latitude: event.detail.center.lat,
            zoom: event.detail.zoom,
          };
          const prev = publishedView.current;
          if (
            Math.abs(prev.latitude - next.latitude) < 0.0002 &&
            Math.abs(prev.longitude - next.longitude) < 0.0002 &&
            Math.abs(prev.zoom - next.zoom) < 0.15
          ) {
            return;
          }
          publishedView.current = next;
          onViewChange(next);
        }}
        mapId="DEMO_MAP_ID"
        gestureHandling="greedy"
        disableDefaultUI
        clickableIcons={false}
        style={{ width: "100%", height: "100%" }}
      >
        <GoogleOsmPrefetch />
        <GoogleAnnotate trace={osmTrace} />
      </GoogleMap>
    </APIProvider>
  );
}

function LeafletCanvas({
  view,
  onViewChange,
  osmTrace,
}: {
  view: MapView;
  onViewChange: (view: MapView) => void;
  osmTrace: TraceFn;
}) {
  return (
    <div className="map-canvas">
      <MapContainer
        center={[view.latitude, view.longitude]}
        zoom={view.zoom}
        zoomControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LeafletViewSync onViewChange={onViewChange} />
        <LeafletOsmPrefetch />
        <LeafletAnnotate trace={osmTrace} />
      </MapContainer>
    </div>
  );
}

function LeafletViewSync({
  onViewChange,
}: {
  onViewChange: (view: MapView) => void;
}) {
  const map = useMap();
  useEffect(() => {
    const sync = () => {
      const center = map.getCenter();
      onViewChange({
        longitude: center.lng,
        latitude: center.lat,
        zoom: map.getZoom(),
      });
    };
    map.on("move", sync);
    map.on("moveend", sync);
    return () => {
      map.off("move", sync);
      map.off("moveend", sync);
    };
  }, [map, onViewChange]);
  return null;
}
