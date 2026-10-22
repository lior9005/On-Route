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

  // Corners: nodes shared by two or more different small streets
  const nodeStreets = new Map<number, { location: Coordinates; names: Set<string>; wayIds: Set<number> }>();
  for (const way of network.smallStreets) {
    way.nodeIds.forEach((nodeId, i) => {
      const location = way.geometry[i];
      if (!location) return;
      const entry = nodeStreets.get(nodeId) ?? { location, names: new Set(), wayIds: new Set() };
      entry.wayIds.add(way.id);
      if (way.name) entry.names.add(way.name);
      nodeStreets.set(nodeId, entry);
    });
  }
  for (const entry of nodeStreets.values()) {
    if (entry.wayIds.size < 2) continue;
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
): RawCandidate[] {
  const score = (c: RawCandidate) =>
    estimateDetour(start, c.location, end) -
    (c.onDriverRoute ? 1000 : 0) -
    (c.isIntersection ? 20 : 0);

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
