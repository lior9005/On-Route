import { Coordinates } from "../models";
import { CONFIG } from "../constants/config";

// Shared by the app and the Netlify `streets` function, so keep it free of
// React Native imports.

/** Public Overpass (OpenStreetMap) servers, in order of preference */
export const OVERPASS_SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

/**
 * Overpass query for small streets within `radius` of `center`, plus big
 * roads slightly further out (so points near the edge are still checked)
 */
export function buildStreetQuery(center: Coordinates, radius: number): string {
  const small = CONFIG.SMALL_STREET_TYPES.join("|");
  const big = CONFIG.BIG_ROAD_TYPES.join("|");
  const bigRadius = Math.round(radius + CONFIG.BIG_ROAD_BUFFER_METERS);
  const around = (r: number) => `around:${Math.round(r)},${center.lat},${center.lon}`;

  return `[out:json][timeout:10];(
      way(${around(radius)})["highway"~"^(${small})$"];
      way(${around(bigRadius)})["highway"~"^(${big})$"];
    );out body geom;`;
}
