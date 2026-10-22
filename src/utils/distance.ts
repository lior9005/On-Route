import { Coordinates } from '../models';

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns Distance in meters
 */
export function haversineDistance(
  point1: Coordinates,
  point2: Coordinates
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(point2.lat - point1.lat);
  const dLon = toRad(point2.lon - point1.lon);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.lat)) *
      Math.cos(toRad(point2.lat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Project a coordinate to local planar meters around a reference point
 * (equirectangular approximation, accurate at walking-distance scales)
 */
function toLocalMeters(point: Coordinates, ref: Coordinates): { x: number; y: number } {
  const R = 6371000;
  return {
    x: toRad(point.lon - ref.lon) * Math.cos(toRad(ref.lat)) * R,
    y: toRad(point.lat - ref.lat) * R,
  };
}

/**
 * Shortest distance from a point to a polyline
 * @returns Distance in meters (Infinity for an empty polyline)
 */
export function distanceToPolyline(point: Coordinates, polyline: Coordinates[]): number {
  if (polyline.length === 0) return Infinity;
  if (polyline.length === 1) return haversineDistance(point, polyline[0]);

  let min = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const a = toLocalMeters(polyline[i], point);
    const b = toLocalMeters(polyline[i + 1], point);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    // Projection of the point (origin) onto segment a-b, clamped to the segment
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / lenSq));
    const px = a.x + t * dx;
    const py = a.y + t * dy;
    min = Math.min(min, Math.sqrt(px * px + py * py));
  }
  return min;
}

/**
 * Points spaced every `intervalMeters` along a polyline (first point included)
 */
export function samplePolyline(polyline: Coordinates[], intervalMeters: number): Coordinates[] {
  if (polyline.length === 0) return [];

  const samples: Coordinates[] = [polyline[0]];
  let sinceLast = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const from = polyline[i];
    const to = polyline[i + 1];
    const segment = haversineDistance(from, to);
    let offset = intervalMeters - sinceLast;

    while (offset <= segment) {
      const t = offset / segment;
      samples.push({
        lat: from.lat + (to.lat - from.lat) * t,
        lon: from.lon + (to.lon - from.lon) * t,
      });
      offset += intervalMeters;
    }
    sinceLast = (sinceLast + segment) % intervalMeters;
  }

  return samples;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function metersToMiles(meters: number): number {
  return meters * 0.000621371;
}

export function metersToKilometers(meters: number): number {
  return meters / 1000;
}

export function secondsToMinutes(seconds: number): number {
  return Math.round(seconds / 60);
}
