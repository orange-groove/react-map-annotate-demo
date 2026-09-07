/**
 * Host Trace inject for Google, Leaflet, and ArcGIS. Do not pass this to
 * AnnotateProvider — Mapbox and MapLibre use the library's vector query.
 */
import { useEffect } from "react";
import { useMap as useGoogleMap } from "@vis.gl/react-google-maps";
import { useMap as useLeafletMap } from "react-leaflet";
import type { LngLat, TraceFn, TraceHit } from "@orange-groove/react-map-annotate/mapbox";

type HostTrace = (
  lngLat: LngLat,
) => TraceHit | null | Promise<TraceHit | null>;

const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const SKIP_HIGHWAY =
  /^(no|abandoned|dismantled|disused|proposed|razed|demolished|planned)$/;
const METERS_PER_DEG = 111_320;
const HIT_METERS = 36;
const BBOX_PAD = 0.01;

type OsmFeature = {
  id: string;
  kind: "road" | "building";
  name: string;
  highway: string;
  coordinates: LngLat[];
};

export type MapView = {
  longitude: number;
  latitude: number;
  zoom: number;
};

export type GeoBBox = {
  south: number;
  west: number;
  north: number;
  east: number;
};

const features = new Map<string, OsmFeature>();
const fetched = new Set<string>();
const inflight = new Map<string, Promise<void>>();

function bboxKey(bbox: GeoBBox): string {
  return [bbox.south, bbox.west, bbox.north, bbox.east]
    .map((value) => value.toFixed(4))
    .join(",");
}

function aroundKey(lngLat: LngLat): string {
  return `a:${lngLat[1].toFixed(3)},${lngLat[0].toFixed(3)}`;
}

function clampBBox(bbox: GeoBBox): GeoBBox {
  const lat = (bbox.south + bbox.north) / 2;
  const lng = (bbox.west + bbox.east) / 2;
  return {
    south: Math.max(bbox.south, lat - BBOX_PAD),
    west: Math.max(bbox.west, lng - BBOX_PAD),
    north: Math.min(bbox.north, lat + BBOX_PAD),
    east: Math.min(bbox.east, lng + BBOX_PAD),
  };
}

function viewBBox(view: MapView): GeoBBox {
  const meters =
    ((156543.03392 * Math.cos((view.latitude * Math.PI) / 180)) /
      2 ** view.zoom) *
    720;
  const dLat = Math.min(BBOX_PAD, meters / METERS_PER_DEG);
  const dLng = Math.min(
    BBOX_PAD,
    meters /
      (METERS_PER_DEG *
        Math.max(0.2, Math.cos((view.latitude * Math.PI) / 180))),
  );
  return {
    south: view.latitude - dLat,
    west: view.longitude - dLng,
    north: view.latitude + dLat,
    east: view.longitude + dLng,
  };
}

function pointBBox(lngLat: LngLat): GeoBBox {
  const pad = 0.002;
  return {
    south: lngLat[1] - pad,
    west: lngLat[0] - pad,
    north: lngLat[1] + pad,
    east: lngLat[0] + pad,
  };
}

function ingestFeature(
  id: string,
  coordinates: LngLat[],
  tags: { highway?: string; building?: string; name?: string },
) {
  if (coordinates.length < 2) return;
  const name = tags.name ?? "";
  const highway = tags.highway ?? "";
  if (highway && !SKIP_HIGHWAY.test(highway)) {
    features.set(id, { id, kind: "road", name, highway, coordinates });
    return;
  }
  if (tags.building) {
    features.set(id, {
      id,
      kind: "building",
      name,
      highway: "",
      coordinates,
    });
  }
}

function ingestOsmXml(xml: string) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const nodes = new Map<string, LngLat>();
  for (const node of Array.from(doc.getElementsByTagName("node"))) {
    const id = node.getAttribute("id");
    const lat = Number(node.getAttribute("lat"));
    const lon = Number(node.getAttribute("lon"));
    if (!id || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    nodes.set(id, [lon, lat]);
  }
  for (const way of Array.from(doc.getElementsByTagName("way"))) {
    const id = way.getAttribute("id");
    if (!id) continue;
    const tags: { highway?: string; building?: string; name?: string } = {};
    for (const tag of Array.from(way.getElementsByTagName("tag"))) {
      const key = tag.getAttribute("k");
      const value = tag.getAttribute("v");
      if (key === "highway" || key === "building" || key === "name") {
        tags[key] = value ?? "";
      }
    }
    const coordinates: LngLat[] = [];
    for (const nd of Array.from(way.getElementsByTagName("nd"))) {
      const ref = nd.getAttribute("ref");
      const node = ref ? nodes.get(ref) : undefined;
      if (node) coordinates.push(node);
    }
    ingestFeature(`way/${id}`, coordinates, tags);
  }
}

function ingestOverpass(payload: {
  elements?: Array<{
    type?: string;
    id?: number;
    tags?: { highway?: string; building?: string; name?: string };
    geometry?: Array<{ lat: number; lon: number }>;
  }>;
}) {
  for (const element of payload.elements ?? []) {
    if (element.type !== "way" || element.id == null || !element.geometry) {
      continue;
    }
    ingestFeature(
      `way/${element.id}`,
      element.geometry.map((node) => [node.lon, node.lat] as LngLat),
      element.tags ?? {},
    );
  }
}

async function requestBBox(bbox: GeoBBox): Promise<boolean> {
  const box = `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
  try {
    const response = await fetch(
      `https://api.openstreetmap.org/api/0.6/map?bbox=${box}`,
    );
    if (response.ok) {
      ingestOsmXml(await response.text());
      return true;
    }
  } catch {
    // Fall through to Overpass.
  }

  const query = `[out:json][timeout:12];
(
  way["highway"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  way["building"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
);
out geom;`;
  const body = new URLSearchParams({ data: query });
  for (const endpoint of OVERPASS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!response.ok) continue;
      ingestOverpass(
        (await response.json()) as Parameters<typeof ingestOverpass>[0],
      );
      return true;
    } catch {
      // Try the next mirror.
    }
  }
  return false;
}

function fetchBBox(bbox: GeoBBox, key: string): Promise<void> {
  if (fetched.has(key)) return Promise.resolve();
  const pending = inflight.get(key);
  if (pending) return pending;
  const next = requestBBox(clampBBox(bbox)).then((ok) => {
    if (ok) fetched.add(key);
  }).finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, next);
  return next;
}

export function loadBBox(bbox: GeoBBox): Promise<void> {
  return fetchBBox(bbox, bboxKey(clampBBox(bbox)));
}

export function loadViewExtent(extent: {
  xmin?: number;
  ymin?: number;
  xmax?: number;
  ymax?: number;
}): Promise<void> {
  const { xmin, ymin, xmax, ymax } = extent;
  if (xmin == null || ymin == null || xmax == null || ymax == null) {
    return Promise.resolve();
  }
  if (Math.abs(xmin) > 180 || Math.abs(xmax) > 180) {
    const west = (xmin / 6378137) * (180 / Math.PI);
    const east = (xmax / 6378137) * (180 / Math.PI);
    const south =
      (2 * Math.atan(Math.exp(ymin / 6378137)) - Math.PI / 2) * (180 / Math.PI);
    const north =
      (2 * Math.atan(Math.exp(ymax / 6378137)) - Math.PI / 2) * (180 / Math.PI);
    return loadBBox({ south, west, north, east });
  }
  return loadBBox({ south: ymin, west: xmin, north: ymax, east: xmax });
}

function loadAround(lngLat: LngLat): Promise<void> {
  return fetchBBox(pointBBox(lngLat), aroundKey(lngLat));
}

function toLocal(point: LngLat, origin: LngLat): { x: number; y: number } {
  const cos = Math.max(0.2, Math.cos((origin[1] * Math.PI) / 180));
  return {
    x: (point[0] - origin[0]) * METERS_PER_DEG * cos,
    y: (point[1] - origin[1]) * METERS_PER_DEG,
  };
}

function distanceToSegment(
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = dx * dx + dy * dy;
  if (length === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length),
  );
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function isClosed(coordinates: LngLat[]): boolean {
  if (coordinates.length < 4) return false;
  const a = coordinates[0];
  const b = coordinates[coordinates.length - 1];
  return Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
}

function pointInRing(point: LngLat, ring: LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i];
    const b = ring[j];
    const intersects =
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] <
        ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1] || Number.EPSILON) +
          a[0];
    if (intersects) inside = !inside;
  }
  return inside;
}

function metersToFeature(point: LngLat, coordinates: LngLat[]): number {
  if (isClosed(coordinates) && pointInRing(point, coordinates)) return 0;
  let min = Infinity;
  for (let index = 1; index < coordinates.length; index += 1) {
    min = Math.min(
      min,
      distanceToSegment(
        { x: 0, y: 0 },
        toLocal(coordinates[index - 1], point),
        toLocal(coordinates[index], point),
      ),
    );
  }
  return min;
}

function endpointKey(coordinate: LngLat): string {
  return `${coordinate[0].toFixed(6)},${coordinate[1].toFixed(6)}`;
}

function stitchRoad(start: OsmFeature): LngLat[] {
  if (start.kind === "building") return start.coordinates;
  const unused = [...features.values()].filter(
    (feature) =>
      feature.id !== start.id &&
      feature.kind === "road" &&
      ((start.name && feature.name === start.name) ||
        (!start.name && feature.highway === start.highway)),
  );
  let coordinates = start.coordinates.slice();
  for (let guard = 0; guard < 60 && unused.length > 0; guard += 1) {
    const head = endpointKey(coordinates[0]);
    const tail = endpointKey(coordinates[coordinates.length - 1]);
    const index = unused.findIndex((feature) => {
      const startKey = endpointKey(feature.coordinates[0]);
      const endKey = endpointKey(
        feature.coordinates[feature.coordinates.length - 1],
      );
      return (
        tail === startKey ||
        tail === endKey ||
        head === startKey ||
        head === endKey
      );
    });
    if (index < 0) break;
    const [feature] = unused.splice(index, 1);
    const startKey = endpointKey(feature.coordinates[0]);
    const endKey = endpointKey(
      feature.coordinates[feature.coordinates.length - 1],
    );
    if (tail === startKey) {
      coordinates = [...coordinates, ...feature.coordinates.slice(1)];
    } else if (tail === endKey) {
      coordinates = [
        ...coordinates,
        ...feature.coordinates.slice(0, -1).reverse(),
      ];
    } else if (head === endKey) {
      coordinates = [...feature.coordinates, ...coordinates.slice(1)];
    } else {
      coordinates = [
        ...feature.coordinates.slice().reverse(),
        ...coordinates.slice(1),
      ];
    }
  }
  return coordinates;
}

function pickHit(lngLat: LngLat): TraceHit | null {
  if (!Number.isFinite(lngLat[0]) || !Number.isFinite(lngLat[1])) return null;
  if (Math.abs(lngLat[0]) > 180 || Math.abs(lngLat[1]) > 90) return null;
  let best: { feature: OsmFeature; distance: number } | null = null;
  for (const feature of features.values()) {
    const distance = metersToFeature(lngLat, feature.coordinates);
    if (distance > HIT_METERS) continue;
    if (!best || distance < best.distance) best = { feature, distance };
  }
  if (!best) return null;
  return { id: best.feature.id, coordinates: stitchRoad(best.feature) };
}

export const osmTrace: HostTrace = async (lngLat) => {
  const hit = pickHit(lngLat);
  if (hit) return hit;
  await loadAround(lngLat);
  return pickHit(lngLat);
};

export function useOsmTrace(view: MapView, enabled: boolean): TraceFn {
  const latitude = view.latitude;
  const longitude = view.longitude;
  const zoom = view.zoom;

  useEffect(() => {
    if (!enabled) return;
    void loadBBox(viewBBox({ latitude, longitude, zoom }));
  }, [enabled, latitude, longitude, zoom]);

  return osmTrace as TraceFn;
}

export function GoogleOsmPrefetch() {
  const map = useGoogleMap();
  useEffect(() => {
    if (!map) return;
    const load = () => {
      const bounds = map.getBounds();
      if (!bounds) return;
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      void loadBBox({
        south: sw.lat(),
        west: sw.lng(),
        north: ne.lat(),
        east: ne.lng(),
      });
    };
    const idle = map.addListener("idle", load);
    load();
    return () => idle.remove();
  }, [map]);
  return null;
}

export function LeafletOsmPrefetch() {
  const map = useLeafletMap();
  useEffect(() => {
    const load = () => {
      const bounds = map.getBounds();
      void loadBBox({
        south: bounds.getSouth(),
        west: bounds.getWest(),
        north: bounds.getNorth(),
        east: bounds.getEast(),
      });
    };
    map.on("moveend", load);
    load();
    return () => {
      map.off("moveend", load);
    };
  }, [map]);
  return null;
}
