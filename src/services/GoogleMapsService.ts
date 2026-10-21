import { Coordinates, RouteLeg } from "../models";
import { CONFIG } from "../constants/config";

interface PlaceResult {
  id: string;
  location: Coordinates;
  name: string;
}

interface BaselineRoute {
  polyline: string;
  duration: number;
  distance: number;
}

interface DetourRoute {
  leg1: RouteLeg;
  leg2: RouteLeg;
}

type TravelMode = "DRIVE" | "WALK";

interface RoutesApiLeg {
  duration?: string; // e.g. "123s"
  distanceMeters?: number;
  polyline?: { encodedPolyline: string };
}

interface RoutesApiRoute {
  duration?: string;
  distanceMeters?: number;
  polyline?: { encodedPolyline: string };
  legs?: RoutesApiLeg[];
}

export class GoogleMapsService {
  private apiKey: string;
  private baseUrl = "https://maps.googleapis.com/maps/api";
  private routesUrl =
    "https://routes.googleapis.com/directions/v2:computeRoutes";

  constructor(apiKey: string) {
    // Application Security Requirement: API key passed as parameter (from environment), parameterized queries for all API calls
    this.apiKey = apiKey;
  }

  /**
   * Fetch baseline route from start to end
   */
  async fetchBaselineRoute(
    start: Coordinates,
    end: Coordinates,
  ): Promise<BaselineRoute> {
    const route = await this.computeRoute(
      start,
      end,
      [],
      "DRIVE",
      "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
      "Failed to fetch baseline route",
    );

    return {
      polyline: route.polyline?.encodedPolyline ?? "",
      duration: this.parseDuration(route.duration),
      distance: route.distanceMeters ?? 0,
    };
  }

  /**
   * Search for places near a specific location (supports multiple types)
   */
  async searchNearLocation(
    location: Coordinates,
    placeTypes: string[],
    radius: number,
  ): Promise<PlaceResult[]> {
    // Search for all types in parallel
    const searchPromises = placeTypes.map((type) =>
      this.nearbySearch(location, type, radius),
    );

    const allResults = await Promise.all(searchPromises);

    // Combine results and remove duplicates by place ID
    const seenIds = new Set<string>();
    const uniqueResults: PlaceResult[] = [];

    for (const results of allResults) {
      for (const place of results) {
        if (!seenIds.has(place.id)) {
          seenIds.add(place.id);
          uniqueResults.push(place);
        }
      }
    }

    return uniqueResults;
  }

  /**
   * Search for places along a route polyline
   */
  async searchAlongRoute(
    polyline: string,
    placeType: string,
  ): Promise<PlaceResult[]> {
    // Decode polyline and sample points
    const points = this.decodePolyline(polyline);
    const sampledPoints = this.samplePoints(
      points,
      CONFIG.SAMPLE_INTERVAL || 5,
    );

    const results: PlaceResult[] = [];
    const seenIds = new Set<string>();

    // Search near each sampled point
    for (const point of sampledPoints) {
      const nearby = await this.nearbySearch(point, placeType, 100);

      for (const place of nearby) {
        if (!seenIds.has(place.id)) {
          seenIds.add(place.id);
          results.push(place);
        }
      }
    }

    return results;
  }

  /**
   * Get route visualization data for map display
   */
  async getRouteVisualization(
    candidate: any,
    start: Coordinates,
    end: Coordinates,
    passengerHome: Coordinates,
  ): Promise<any> {
    // Fetch the detour route with per-leg polylines (with real-time traffic)
    // and the walking route from meeting point to passenger home in parallel
    const [detourRoute, walkingRoute] = await Promise.all([
      this.computeRoute(
        start,
        end,
        [candidate.coordinates],
        "DRIVE",
        "routes.legs.polyline.encodedPolyline",
        "Failed to fetch route visualization",
      ),
      this.computeRoute(
        candidate.coordinates,
        passengerHome,
        [],
        "WALK",
        "routes.polyline.encodedPolyline",
        "Failed to fetch walking route",
      ),
    ]);

    const legs = detourRoute.legs ?? [];

    if (legs.length < 2) {
      throw new Error("Expected 2 legs in detour route");
    }

    // Create segments from the per-leg polylines
    const segments = [
      {
        polyline: legs[0].polyline?.encodedPolyline ?? "",
        color: "#4285F4", // Blue - driver to meeting point
        label: "Driver to Meeting Point",
      },
      {
        polyline: legs[1].polyline?.encodedPolyline ?? "",
        color: "#34A853", // Green - meeting point to destination
        label: "Driver to Destination",
      },
      {
        polyline: walkingRoute.polyline?.encodedPolyline ?? "",
        color: "#FBBC04", // Orange - passenger walking
        label: "Passenger Walking",
      },
    ];

    // Calculate bounds
    const allCoordinates = [start, candidate.coordinates, end, passengerHome];

    const lats = allCoordinates.map((c) => c.lat);
    const lons = allCoordinates.map((c) => c.lon);

    const bounds = {
      northeast: {
        lat: Math.max(...lats),
        lon: Math.max(...lons),
      },
      southwest: {
        lat: Math.min(...lats),
        lon: Math.min(...lons),
      },
    };

    return { segments, bounds };
  }

  /**
   * Compute detour route: start → dropoff → end
   */
  async computeDetourRoute(
    start: Coordinates,
    dropoff: Coordinates,
    end: Coordinates,
  ): Promise<DetourRoute> {
    const route = await this.computeRoute(
      start,
      end,
      [dropoff],
      "DRIVE",
      "routes.legs.duration,routes.legs.distanceMeters",
      "Failed to compute detour route",
    );

    const legs = route.legs ?? [];

    if (legs.length < 2) {
      throw new Error("Expected 2 legs in detour route");
    }

    return {
      leg1: {
        duration: this.parseDuration(legs[0].duration),
        distance: legs[0].distanceMeters ?? 0,
      },
      leg2: {
        duration: this.parseDuration(legs[1].duration),
        distance: legs[1].distanceMeters ?? 0,
      },
    };
  }

  /**
   * Compute a single route via the Routes API (computeRoutes)
   */
  private async computeRoute(
    origin: Coordinates,
    destination: Coordinates,
    intermediates: Coordinates[],
    travelMode: TravelMode,
    fieldMask: string,
    errorMessage: string,
  ): Promise<RoutesApiRoute> {
    const toWaypoint = (c: Coordinates) => ({
      location: { latLng: { latitude: c.lat, longitude: c.lon } },
    });

    const body: Record<string, unknown> = {
      origin: toWaypoint(origin),
      destination: toWaypoint(destination),
      travelMode,
    };

    if (intermediates.length > 0) {
      body.intermediates = intermediates.map(toWaypoint);
    }

    // TRAFFIC_AWARE uses real-time traffic (departure time defaults to now);
    // routing preference is only allowed for driving
    if (travelMode === "DRIVE") {
      body.routingPreference = "TRAFFIC_AWARE";
    }

    const response = await fetch(this.routesUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `${errorMessage}: ${data?.error?.status ?? response.status} ${data?.error?.message ?? ""}`.trim(),
      );
    }

    if (!data.routes || data.routes.length === 0) {
      throw new Error(`${errorMessage}: ZERO_RESULTS`);
    }

    return data.routes[0];
  }

  /**
   * Parse a Routes API duration string (e.g. "123s") into seconds
   */
  private parseDuration(duration?: string): number {
    return duration ? parseFloat(duration) : 0;
  }

  /**
   * Search for nearby places
   */
  private async nearbySearch(
    location: Coordinates,
    type: string,
    radius: number,
  ): Promise<PlaceResult[]> {
    const allPlaces: PlaceResult[] = [];
    let nextPageToken: string | null = null;
    let pageCount = 0;
    const maxPages = 1; // Limit to 1 page (20 results max per type)

    do {
      let url: string;
      if (nextPageToken) {
        // Wait a bit before requesting next page (Google requires this)
        await new Promise((resolve) => setTimeout(resolve, 2000));
        url = `${this.baseUrl}/place/nearbysearch/json?pagetoken=${encodeURIComponent(nextPageToken)}&key=${encodeURIComponent(this.apiKey)}`;
      } else {
        url = `${this.baseUrl}/place/nearbysearch/json?location=${location.lat},${location.lon}&radius=${radius}&type=${encodeURIComponent(type)}&key=${encodeURIComponent(this.apiKey)}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
        if (data.status === "INVALID_REQUEST" && nextPageToken) {
          // Token might not be ready yet, break and return what we have
          break;
        }
        throw new Error(`Nearby search failed: ${data.status}`);
      }

      if (data.results && data.results.length > 0) {
        const places = data.results.map((place: any) => ({
          id: place.place_id,
          location: {
            lat: place.geometry.location.lat,
            lon: place.geometry.location.lng,
          },
          name: place.name || "Unknown",
        }));

        allPlaces.push(...places);
        pageCount++;
      }

      nextPageToken = data.next_page_token || null;
    } while (nextPageToken && pageCount < maxPages);

    return allPlaces;
  }

  /**
   * Decode Google polyline format
   */
  private decodePolyline(encoded: string): Coordinates[] {
    const points: Coordinates[] = [];
    let index = 0;
    let lat = 0;
    let lon = 0;

    while (index < encoded.length) {
      let b;
      let shift = 0;
      let result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlon = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lon += dlon;

      points.push({
        lat: lat / 1e5,
        lon: lon / 1e5,
      });
    }

    return points;
  }

  /**
   * Sample points from array at regular intervals
   */
  private samplePoints(points: Coordinates[], interval: number): Coordinates[] {
    const sampled: Coordinates[] = [];

    for (let i = 0; i < points.length; i += interval) {
      sampled.push(points[i]);
    }

    return sampled;
  }
}
