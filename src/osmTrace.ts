/**
 * Host Trace inject for Google, Leaflet, and ArcGIS. Do not pass this to
 * AnnotateProvider — Mapbox and MapLibre use the library's vector query.
 *
 * The library ships the OSM reader, so this is only the wiring. It reads the
 * viewport off the map itself, so there is nothing to prefetch.
 */
import { createOsmTrace } from "@orange-groove/react-map-annotate/osm";

export const osmTrace = createOsmTrace();
