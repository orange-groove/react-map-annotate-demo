import { lazy, Suspense, useState } from "react";
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
  useAnnotateTools,
  type Annotation,
} from "@orange-groove/react-map-annotate/mapbox";
import { Annotate as MapLibreAnnotate } from "@orange-groove/react-map-annotate/maplibre";
import { Annotate as GoogleAnnotate } from "@orange-groove/react-map-annotate/google";
import { Annotate as LeafletAnnotate } from "@orange-groove/react-map-annotate/leaflet";
import { MapContainer, TileLayer } from "react-leaflet";
import "mapbox-gl/dist/mapbox-gl.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "leaflet/dist/leaflet.css";
import "@orange-groove/react-map-annotate/styles.css";
import { CustomList } from "./CustomList";

const ArcgisCanvas = lazy(() => import("./ArcgisCanvas"));

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const MAPLIBRE_STYLE =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

type Engine = "mapbox" | "maplibre" | "google" | "leaflet" | "arcgis";

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

  return (
    <AnnotateProvider annotations={annotations} onChange={setAnnotations}>
      <div className="app">
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
          <MapboxCanvas />
        ) : engine === "maplibre" ? (
          <MapLibreCanvas />
        ) : engine === "google" ? (
          <GoogleCanvas />
        ) : engine === "leaflet" ? (
          <LeafletCanvas />
        ) : (
          <Suspense fallback={null}>
            <ArcgisCanvas />
          </Suspense>
        )}
        <div className="toolbar">
          <AnnotateToolbar />
          <TextToolbar />
        </div>
        <div className="lists">
          <CustomList />
          <div className="list">
            <AnnotateList />
          </div>
        </div>
      </div>
    </AnnotateProvider>
  );
}

function MapboxCanvas() {
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
      initialViewState={{
        longitude: -73.9857,
        latitude: 40.7484,
        zoom: 14,
      }}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      attributionControl={false}
      style={{ width: "100%", height: "100%" }}
    >
      <MapboxNav position="bottom-right" showCompass={false} />
      <MapboxAnnotate enableTerrain />
    </MapboxMap>
  );
}

function MapLibreCanvas() {
  return (
    <MapLibreMap
      initialViewState={{
        longitude: -73.9857,
        latitude: 40.7484,
        zoom: 14,
      }}
      mapStyle={MAPLIBRE_STYLE}
      attributionControl={false}
      style={{ width: "100%", height: "100%" }}
    >
      <MapLibreNav position="bottom-right" showCompass={false} />
      <MapLibreAnnotate />
    </MapLibreMap>
  );
}

function GoogleCanvas() {
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
        defaultCenter={{ lat: 40.7484, lng: -73.9857 }}
        defaultZoom={14}
        mapId="DEMO_MAP_ID"
        gestureHandling="greedy"
        disableDefaultUI
        clickableIcons={false}
        style={{ width: "100%", height: "100%" }}
      >
        <GoogleAnnotate />
      </GoogleMap>
    </APIProvider>
  );
}

function LeafletCanvas() {
  return (
    <div className="map-canvas">
      <MapContainer
        center={[40.7484, -73.9857]}
        zoom={14}
        zoomControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LeafletAnnotate />
      </MapContainer>
    </div>
  );
}

function TextToolbar() {
  const {
    items,
    finish,
    canFinish,
    selectedId,
    deleteSelected,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useAnnotateTools();

  return (
    <div className="text-toolbar" role="toolbar" aria-label="Text annotation tools">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={item.active ? "is-active" : undefined}
          aria-pressed={item.active}
          onClick={item.select}
        >
          {item.label}
        </button>
      ))}
      <button type="button" disabled={!canFinish} onClick={finish}>
        Finish
      </button>
      <button type="button" disabled={!canUndo} onClick={undo}>
        Undo
      </button>
      <button type="button" disabled={!canRedo} onClick={redo}>
        Redo
      </button>
      <button type="button" disabled={!selectedId} onClick={deleteSelected}>
        Delete
      </button>
    </div>
  );
}
