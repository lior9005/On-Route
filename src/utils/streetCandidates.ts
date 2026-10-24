import { Coordinates, RawCandidate } from "../models";
import { StreetNetwork } from "../services/OsmService";
import { CONFIG } from "../constants/config";
import { distanceToPolyline, haversineDistance, samplePolyline } from "./distance";

/**
 * Turn small streets into candidate meeting points:
 * corners between small streets plus a point every STREET_SAMPLE_INTERVAL_METERS,
 * within walking distance of the passenger and away from big roads.
 */
export function buildStreetCandidates(
  network: StreetNetwork,
  passengerHome: Coordinates,
  maxWalkingMeters: number,
  driverRoute: Coordinates[],
): RawCandidate[] {
  const points: Array<{ location: Coordinates; name: string; isIntersection: boolean }> = [];

  // Corners: points where 3+ distinct street directions meet. Counting unique
  // neighbouring vertices ignores a street split into several pieces (or
  // repeated in two map tiles), which would otherwise look like a corner.
  const nodes = new Map<number, { location: Coordinates; names: Set<string>; neighbours: Set<number> }>();
  for (const way of network.smallStreets) {
    way.nodeIds.forEach((nodeId, i) => {
      const location = way.geometry[i];
      if (!location) return;
      const entry = nodes.get(nodeId) ?? { location, names: new Set(), neighbours: new Set() };
      if (i > 0) entry.neighbours.add(way.nodeIds[i - 1]);
      if (i < way.nodeIds.length - 1) entry.neighbours.add(way.nodeIds[i + 1]);
      if (way.name) entry.names.add(way.name);
      nodes.set(nodeId, entry);
    });
  }
  for (const entry of nodes.values()) {
    if (entry.neighbours.size < 3) continue;
    const names = [...entry.names];
    points.push({
      location: entry.location,
      name: names.length > 0 ? names.slice(0, 2).join(" & ") : "Street corner",
      isIntersection: true,
    });
  }

  // Points along each small street
  for (const way of network.smallStreets) {
    for (const location of samplePolyline(way.geometry, CONFIG.STREET_SAMPLE_INTERVAL_METERS)) {
      points.push({ location, name: way.name ?? "Side street", isIntersection: false });
    }
  }

  return points
    .filter((p) => haversineDistance(p.location, passengerHome) <= maxWalkingMeters)
    .filter((p) =>
      network.bigRoads.every(
        (road) => distanceToPolyline(p.location, road.geometry) >= CONFIG.BIG_ROAD_BUFFER_METERS,
      ),
    )
    .map((p) => ({
      id: `street:${p.location.lat.toFixed(5)},${p.location.lon.toFixed(5)}`,
      location: p.location,
      name: p.name,
      kind: "STREET" as const,
      isIntersection: p.isIntersection,
      onDriverRoute:
        driverRoute.length > 0 &&
        distanceToPolyline(p.location, driverRoute) <= CONFIG.ON_ROUTE_THRESHOLD_METERS,
    }));
}

/**
 * The spot on the driver's route closest to the passenger that is on a small
 * street and at least BIG_ROAD_BUFFER_METERS from big roads, so the driver
 * stops on the way instead of the passenger walking to a point further along.
 * Null if the route never passes such a spot within walking distance.
 */
export function closestRouteCandidate(
  network: StreetNetwork,
  passengerHome: Coordinates,
  maxWalkingMeters: number,
  driverRoute: Coordinates[],
): RawCandidate | null {
  let best: { location: Coordinates; name?: string; distance: number } | null = null;

  for (const location of samplePolyline(driverRoute, CONFIG.ROUTE_SAMPLE_INTERVAL_METERS)) {
    const distance = haversineDistance(location, passengerHome);
    if (distance > maxWalkingMeters || (best && distance >= best.distance)) continue;

    // Must be on a small street (route polyline is approximate, allow some slack)
    const street = network.smallStreets.find(
      (way) => distanceToPolyline(location, way.geometry) <= CONFIG.ON_ROUTE_THRESHOLD_METERS,
    );
    if (!street) continue;

    const nearBigRoad = network.bigRoads.some(
      (road) => distanceToPolyline(location, road.geometry) < CONFIG.BIG_ROAD_BUFFER_METERS,
    );
    if (nearBigRoad) continue;

    best = { location, name: street.name, distance };
  }

  if (!best) return null;

  return {
    id: `route:${best.location.lat.toFixed(5)},${best.location.lon.toFixed(5)}`,
    location: best.location,
    name: best.name ?? "Side street",
    kind: "STREET",
    onDriverRoute: true,
    isClosestOnRoute: true,
  };
}

/**
 * Cheap straight-line estimate of the driver's extra distance via a point (meters)
 */
export function estimateDetour(start: Coordinates, point: Coordinates, end: Coordinates): number {
  return (
    haversineDistance(start, point) +
    haversineDistance(point, end) -
    haversineDistance(start, end)
  );
}

/**
 * Pick the most promising candidates before calling Google APIs:
 * rank by estimated detour (on-route points and corners preferred),
 * drop points closer than mergeRadius to a better one, keep the top `limit`.
 */
export function preselectCandidates(
  candidates: RawCandidate[],
  start: Coordinates,
  end: Coordinates,
  mergeRadius: number,
  limit: number,
  customScore?: (c: RawCandidate) => number,
): RawCandidate[] {
  const score = customScore ?? ((c: RawCandidate) =>
    (c.isClosestOnRoute ? -Infinity : 0) +
    estimateDetour(start, c.location, end) -
    (c.onDriverRoute ? 1000 : 0) -
    (c.isIntersection ? 20 : 0));

  const ranked = [...candidates].sort((a, b) => score(a) - score(b));
  const selected: RawCandidate[] = [];

  for (const c of ranked) {
    if (selected.length >= limit) break;
    const tooClose = selected.some(
      (s) => haversineDistance(s.location, c.location) < mergeRadius,
    );
    if (!tooClose) selected.push(c);
  }

  return selected;
}
