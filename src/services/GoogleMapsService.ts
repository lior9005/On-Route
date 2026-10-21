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

export class GoogleMapsService {
  private apiKey: string;
  private baseUrl = "https://maps.googleapis.com/maps/api";

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
    const origin = `${start.lat},${start.lon}`;
    const destination = `${end.lat},${end.lon}`;

    // Use departure_time=now for real-time traffic data
    const url = `${this.baseUrl}/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&departure_time=now&key=${encodeURIComponent(this.apiKey)}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "OK" || !data.routes || data.routes.length === 0) {
      throw new Error(`Failed to fetch baseline route: ${data.status}`);
    }

    const route = data.routes[0];
    const leg = route.legs[0];

    return {
      polyline: route.overview_polyline.points,
      duration: leg.duration.value,
      distance: leg.distance.value,
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
    // Fetch the detour route with polylines (with real-time traffic)
    const detourUrl = `${this.baseUrl}/directions/json?origin=${start.lat},${start.lon}&destination=${end.lat},${end.lon}&waypoints=${candidate.coordinates.lat},${candidate.coordinates.lon}&departure_time=now&key=${encodeURIComponent(this.apiKey)}`;

    const detourResponse = await fetch(detourUrl);
    const detourData = await detourResponse.json();

    if (
      detourData.status !== "OK" ||
      !detourData.routes ||
      detourData.routes.length === 0
    ) {
      throw new Error(
        `Failed to fetch route visualization: ${detourData.status}`,
      );
    }

    const route = detourData.routes[0];
    const legs = route.legs;

    // Fetch walking route from meeting point to passenger home
    const walkingUrl = `${this.baseUrl}/directions/json?origin=${candidate.coordinates.lat},${candidate.coordinates.lon}&destination=${passengerHome.lat},${passengerHome.lon}&mode=walking&key=${encodeURIComponent(this.apiKey)}`;

    const walkingResponse = await fetch(walkingUrl);
    const walkingData = await walkingResponse.json();

    if (
      walkingData.status !== "OK" ||
      !walkingData.routes ||
      walkingData.routes.length === 0
    ) {
      throw new Error(`Failed to fetch walking route: ${walkingData.status}`);
    }

    // Manually decode and re-encode leg polylines from steps
    const leg1Points: Coordinates[] = [];
    const leg2Points: Coordinates[] = [];

    // Decode all steps in leg 1
    for (const step of legs[0].steps) {
      const stepPoints = this.decodePolyline(step.polyline.points);
      leg1Points.push(...stepPoints);
    }

    // Decode all steps in leg 2
    for (const step of legs[1].steps) {
      const stepPoints = this.decodePolyline(step.polyline.points);
      leg2Points.push(...stepPoints);
    }

    // Create segments with properly combined polylines
    const segments = [
      {
        polyline: this.encodePolyline(leg1Points),
        color: "#4285F4", // Blue - driver to meeting point
        label: "Driver to Meeting Point",
      },
      {
        polyline: this.encodePolyline(leg2Points),
        color: "#34A853", // Green - meeting point to destination
        label: "Driver to Destination",
      },
      {
        polyline: walkingData.routes[0].overview_polyline.points,
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
    const origin = `${start.lat},${start.lon}`;
    const waypoint = `${dropoff.lat},${dropoff.lon}`;
    const destination = `${end.lat},${end.lon}`;

    // Use departure_time=now for real-time traffic data
    const url = `${this.baseUrl}/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoint)}&departure_time=now&key=${encodeURIComponent(this.apiKey)}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "OK" || !data.routes || data.routes.length === 0) {
      throw new Error(`Failed to compute detour route: ${data.status}`);
    }

    const legs = data.routes[0].legs;

    if (legs.length < 2) {
      throw new Error("Expected 2 legs in detour route");
    }

    return {
      leg1: {
        duration: legs[0].duration.value,
        distance: legs[0].distance.value,
      },
      leg2: {
        duration: legs[1].duration.value,
        distance: legs[1].distance.value,
      },
    };
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
   * Encode coordinates to Google polyline format
   */
  private encodePolyline(coordinates: Coordinates[]): string {
    let encoded = "";
    let prevLat = 0;
    let prevLon = 0;

    for (const coord of coordinates) {
      const lat = Math.round(coord.lat * 1e5);
      const lon = Math.round(coord.lon * 1e5);

      encoded += this.encodeNumber(lat - prevLat);
      encoded += this.encodeNumber(lon - prevLon);

      prevLat = lat;
      prevLon = lon;
    }

    return encoded;
  }

  /**
   * Encode a single number for polyline
   */
  private encodeNumber(num: number): string {
    let encoded = "";
    let value = num < 0 ? ~(num << 1) : num << 1;

    while (value >= 0x20) {
      encoded += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
      value >>= 5;
    }

    encoded += String.fromCharCode(value + 63);
    return encoded;
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
