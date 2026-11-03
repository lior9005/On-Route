import polyline from "@mapbox/polyline";
import { Coordinates } from "../models";
import { haversineDistance } from "./distance";

/**
 * The part of a route that passes near a point: from the first to the last
 * route point within `radiusMeters` of it. If the route never comes that
 * close, the radius grows to the closest approach plus `radiusMeters` / 4,
 * so a section is always returned for a non-empty route.
 */
export function routeSectionNear(
  route: Coordinates[],
  center: Coordinates,
  radiusMeters: number,
): Coordinates[] {
  if (route.length === 0) return [];
  const distances = route.map((p) => haversineDistance(p, center));
  const radius = Math.max(radiusMeters, Math.min(...distances) + radiusMeters / 4);
  const first = distances.findIndex((d) => d <= radius);
  let last = first;
  distances.forEach((d, i) => {
    if (d <= radius) last = i;
  });
  return route.slice(first, last + 1);
}

/** Google encoded polyline for a list of points */
export function encodePolyline(points: Coordinates[]): string {
  return polyline.encode(points.map((p) => [p.lat, p.lon]));
}
