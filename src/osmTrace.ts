import { useEffect, useState } from "react";
import type {
  LngLat,
  TraceContext,
  TraceFn,
  TraceHit,
} from "@orange-groove/react-map-annotate/mapbox";

const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const PIXEL_TOLERANCE = 32;
const HIGHWAY =
  /^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|pedestrian|footway|path|cycleway|steps)(_link)?$/;

type OsmFeature = {
  id: string;
  kind: "road" | "building";
  coordinates: LngLat[];
};

type MapView = {
  longitude: number;
  latitude: number;
  zoom: number;
};

const features = new Map<string, OsmFeature>();
const fetched = new Set<string>();
let aroundTimer: number | undefined;
let aroundKey = "";

function cellKey(longitude: number, latitude: number, zoom: number): string {
  return `${latitude.toFixed(3)},${longitude.toFixed(3)},${Math.round(zoom)}`;
}

function fetchRadiusMeters(zoom: number): number {
  return Math.min(1200, Math.max(180, 280 * 2 ** (16 - zoom)));
}

function query(lat: number, lng: number, radius: number): string {
  return `[out:json][timeout:12];
(
  way["highway"](around:${Math.round(radius)},${lat},${lng});
  way["building"](around:${Math.round(radius)},${lat},${lng});
);
out geom;`;
}

function asFeature(element: {
  type?: string;
  id?: number;
  tags?: { highway?: string; building?: string };
  geometry?: Array<{ lat: number; lon: number }>;
}): OsmFeature | null {
  if (element.type !== "way" || element.id == null || !element.geometry) {
    return null;
  }
  const coordinates = element.geometry.map(
    (node) => [node.lon, node.lat] as LngLat,
  );
  if (coordinates.length < 2) return null;
  const highway = element.tags?.highway;
  if (highway && HIGHWAY.test(highway)) {
    return { id: `way/${element.id}`, kind: "road", coordinates };
  }
  if (element.tags?.building) {
    return { id: `way/${element.id}`, kind: "building", coordinates };
  }
  return null;
}

async function loadAround(
  longitude: number,
  latitude: number,
  zoom: number,
): Promise<void> {
  const key = cellKey(longitude, latitude, zoom);
  if (fetched.has(key)) return;
  fetched.add(key);
  const body = new URLSearchParams({
    data: query(latitude, longitude, fetchRadiusMeters(zoom)),
  });
  for (const endpoint of OVERPASS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!response.ok) continue;
      const payload = (await response.json()) as {
        elements?: Parameters<typeof asFeature>[0][];
      };
      for (const element of payload.elements ?? []) {
        const feature = asFeature(element);
        if (feature) features.set(feature.id, feature);
      }
      return;
    } catch {
      // Try the next public Overpass mirror.
    }
  }
  fetched.delete(key);
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

function pointInRing(
  point: { x: number; y: number },
  ring: Array<{ x: number; y: number }>,
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i];
    const b = ring[j];
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x <
        ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || Number.EPSILON) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function distanceToFeature(
  project: TraceContext["map"]["project"],
  point: { x: number; y: number },
  coordinates: LngLat[],
): number {
  const ring = coordinates.map(([lng, lat]) => project({ lng, lat }));
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  const closed =
    coordinates.length >= 4 && first[0] === last[0] && first[1] === last[1];
  if (closed && pointInRing(point, ring)) return 0;
  let min = Infinity;
  for (let index = 1; index < ring.length; index += 1) {
    min = Math.min(min, distanceToSegment(point, ring[index - 1], ring[index]));
  }
  return min;
}

function pickHit(context: TraceContext): TraceHit | null {
  const point = context.point;
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    return null;
  }
  let best: { feature: OsmFeature; distance: number } | null = null;
  for (const feature of features.values()) {
    const distance = distanceToFeature(
      context.map.project,
      point,
      feature.coordinates,
    );
    if (distance > PIXEL_TOLERANCE) continue;
    if (!best || distance < best.distance) best = { feature, distance };
  }
  if (!best) return null;
  return { id: best.feature.id, coordinates: best.feature.coordinates };
}

let lastHoverPoint: { x: number; y: number } | null = null;

function requestAround(lngLat: LngLat, zoom = 16) {
  const key = cellKey(lngLat[0], lngLat[1], zoom);
  if (fetched.has(key) || aroundKey === key) return;
  aroundKey = key;
  window.clearTimeout(aroundTimer);
  aroundTimer = window.setTimeout(() => {
    void loadAround(lngLat[0], lngLat[1], zoom).then(replayLastHover);
  }, 0);
}

function replayLastHover() {
  if (!lastHoverPoint) return;
  const host = document.querySelector(".rma-crosshair");
  if (!(host instanceof HTMLElement)) return;
  const rect = host.getBoundingClientRect();
  host.dispatchEvent(
    new PointerEvent("pointermove", {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + lastHoverPoint.x,
      clientY: rect.top + lastHoverPoint.y,
    }),
  );
}

export const osmTrace: TraceFn = (lngLat, context) => {
  if (context.point) lastHoverPoint = context.point;
  const hit = pickHit(context);
  if (!hit) requestAround(lngLat);
  return hit;
};

export function useOsmTrace(view: MapView, enabled: boolean): TraceFn {
  const [, setTick] = useState(0);
  const cell = enabled
    ? cellKey(view.longitude, view.latitude, view.zoom)
    : "";

  useEffect(() => {
    if (!enabled || !cell) return;
    void loadAround(view.longitude, view.latitude, view.zoom).then(() => {
      setTick((tick) => tick + 1);
      replayLastHover();
    });
  }, [cell, enabled]);

  return osmTrace;
}
