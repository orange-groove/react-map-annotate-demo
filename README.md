# react-map-annotate-testbed

Vite + React playground for [`@orange-groove/react-map-annotate`](../react-map-annotate). Switch Mapbox, MapLibre, Google, Leaflet, and ArcGIS with the same drawing session.

## Setup

```bash
cp .env.example .env.local
# add Mapbox / Google keys if you want those engines
npm install
npm run dev
```

The annotate package is loaded from the sibling `react-map-annotate` source so library edits show up on refresh.
