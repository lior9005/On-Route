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
  /** Where Google placed the stop on the road (may differ from the requested point) */
  snappedDropoff?: Coordinates;
}

type TravelMode = "DRIVE" | "WALK";

interface RoutesApiLeg {
  duration?: string; // e.g. "123s"
  distanceMeters?: number;
  polyline?: { encodedPolyline: string };
  endLocation?: { latLng?: { latitude: number; longitude: number } };
}

/** Routes API TRANSIT route (fields from the computeTransitRoutes field mask) */
export interface RoutesApiTransitRoute {
  duration?: string;
  legs?: Array<{
    steps?: Array<{
      travelMode?: "WALK" | "TRANSIT" | string;
      distanceMeters?: number;
      staticDuration?: string;
      polyline?: { encodedPolyline: string };
      transitDetails?: {
        stopDetails?: {
          departureStop?: { name?: string };
          arrivalStop?: { name?: string };
          departureTime?: string;
          arrivalTime?: string;
        };
        headsign?: string;
        stopCount?: number;
        transitLine?: {
          name?: string;
          nameShort?: string;
          vehicle?: { type?: string };
        };
      };
    }>;
  }>;
}

interface RoutesApiRoute {
  duration?: string;
  distanceMeters?: number;
  polyline?: { encodedPolyline: string };
  legs?: RoutesApiLeg[];
}

export class GoogleMapsService {
  private apiKey: string;
  private routesUrl =
    "https://routes.googleapis.com/directions/v2:computeRoutes";
  private routeMatrixUrl =
    "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix";
  private placesUrl = "https://places.googleapis.com/v1/places:searchNearby";
  private placesTextSearchUrl = "https://places.googleapis.com/v1/places:searchText";

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
    departureTime?: Date | null,
  ): Promise<BaselineRoute> {
    const route = await this.computeRoute(
      start,
      end,
      [],
      "DRIVE",
      "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
      "Failed to fetch baseline route",
      departureTime,
    );

    return {
      polyline: route.polyline?.encodedPolyline ?? "",
      duration: this.parseDuration(route.duration),
      distance: route.distanceMeters ?? 0,
    };
  }

  /**
   * Reverse geocode coordinates to a human-readable address (Geocoding API)
   * Returns null when no address is found.
   */
  async reverseGeocode(location: Coordinates): Promise<string | null> {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${location.lat},${location.lon}&language=en&key=${encodeURIComponent(this.apiKey)}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "ZERO_RESULTS") {
      return null;
    }

    if (data.status !== "OK") {
      throw new Error(`Reverse geocoding failed: ${data.status}`);
    }

    // Prefer a precise street address over areas (neighborhood, city, ...)
    const results: any[] = data.results ?? [];
    const best =
      results.find((r) => r.types?.includes("street_address")) ??
      results.find((r) => r.types?.includes("route")) ??
      results[0];

    return best?.formatted_address ?? null;
  }

  /**
   * Search for places near a specific location (supports multiple types)
   */
  async searchNearLocation(
    location: Coordinates,
    placeTypes: string[],
    radius: number,
  ): Promise<PlaceResult[]> {
    // Places API (New) accepts all types in a single request
    return this.nearbySearch(location, placeTypes, radius);
  }

  /**
   * Bus stops along a route (Places API (New) Text Search along a route).
   * Google orders them by the detour they add to the route.
   */
  async searchBusStopsAlongRoute(
    encodedPolyline: string,
    pages: number,
  ): Promise<PlaceResult[]> {
    const results: PlaceResult[] = [];
    const seenIds = new Set<string>();
    let pageToken: string | undefined;

    for (let page = 0; page < pages; page++) {
      let data: any;
      try {
        data = await this.textSearchAlongRoute(encodedPolyline, "bus_stop", pageToken);
      } catch (err) {
        // Fall back to the broader transit_station type if bus_stop is rejected
        if (page > 0) break;
        data = await this.textSearchAlongRoute(encodedPolyline, "transit_station");
      }

      for (const place of data.places ?? []) {
        if (seenIds.has(place.id)) continue;
        seenIds.add(place.id);
        results.push({
          id: place.id,
          location: {
            lat: place.location.latitude,
            lon: place.location.longitude,
          },
          name: place.displayName?.text || "Bus stop",
        });
      }

      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }

    return results;
  }

  /**
   * Bus trips from `origin` to `destination` (Routes API, TRANSIT), leaving
   * after `departureTime` or arriving before `arrivalTime`. Returns Google's
   * alternatives as-is; an empty list means no transit route.
   */
  async computeTransitRoutes(
    origin: Coordinates,
    destination: Coordinates,
    time: { departureTime: Date } | { arrivalTime: Date },
  ): Promise<RoutesApiTransitRoute[]> {
    const toWaypoint = (c: Coordinates) => ({
      location: { latLng: { latitude: c.lat, longitude: c.lon } },
    });

    const response = await fetch(this.routesUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": [
          "routes.duration",
          "routes.legs.steps.travelMode",
          "routes.legs.steps.distanceMeters",
          "routes.legs.steps.staticDuration",
          "routes.legs.steps.polyline.encodedPolyline",
          "routes.legs.steps.transitDetails",
        ].join(","),
      },
      body: JSON.stringify({
        origin: toWaypoint(origin),
        destination: toWaypoint(destination),
        travelMode: "TRANSIT",
        computeAlternativeRoutes: true,
        languageCode: CONFIG.PLACE_NAMES_LANGUAGE,
        transitPreferences: {
          allowedTravelModes: CONFIG.TRANSIT_MODES,
          routingPreference: "FEWER_TRANSFERS",
        },
        ...("departureTime" in time
          ? { departureTime: time.departureTime.toISOString() }
          : { arrivalTime: time.arrivalTime.toISOString() }),
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `Failed to compute bus routes: ${data?.error?.status ?? response.status} ${data?.error?.message ?? ""}`.trim(),
      );
    }

    // An empty object is returned when there is no transit route
    return data.routes ?? [];
  }

  /**
   * Get route visualization data for map display
   */
  async getRouteVisualization(
    candidate: any,
    start: Coordinates,
    end: Coordinates,
    passengerHome: Coordinates,
    departureTime?: Date | null,
  ): Promise<any> {
    // Bus trips already carry their map lines (bus + walking parts)
    const transitSegments = candidate.passengerLeg?.transit?.segments as
      | Array<{ kind: "WALK" | "BUS"; polyline: string }>
      | undefined;

    // Fetch the detour route with per-leg polylines (with traffic at the
    // planned time, same as the search)
    // and, for walking candidates, the walking route to the passenger in parallel
    const [detourRoute, walkingRoute] = await Promise.all([
      this.computeRoute(
        start,
        end,
        [candidate.coordinates],
        "DRIVE",
        "routes.legs.polyline.encodedPolyline",
        "Failed to fetch route visualization",
        departureTime,
      ),
      transitSegments
        ? Promise.resolve(null)
        : this.computeRoute(
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
      ...(transitSegments
        ? transitSegments.map((segment) =>
            segment.kind === "BUS"
              ? {
                  polyline: segment.polyline,
                  color: "#8E24AA", // Purple - passenger bus
                  label: "Passenger Bus",
                }
              : {
                  polyline: segment.polyline,
                  color: "#FBBC04", // Orange - passenger walking
                  label: "Passenger Walking",
                },
          )
        : [
            {
              polyline: walkingRoute?.polyline?.encodedPolyline ?? "",
              color: "#FBBC04", // Orange - passenger walking
              label: "Passenger Walking",
            },
          ]),
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
    departureTime?: Date | null,
    trafficAware = true,
  ): Promise<DetourRoute> {
    const route = await this.computeRoute(
      start,
      end,
      [dropoff],
      "DRIVE",
      "routes.legs.duration,routes.legs.distanceMeters,routes.legs.endLocation",
      "Failed to compute detour route",
      departureTime,
      trafficAware,
    );

    const legs = route.legs ?? [];

    if (legs.length < 2) {
      throw new Error("Expected 2 legs in detour route");
    }

    const snapped = legs[0].endLocation?.latLng;

    return {
      leg1: {
        duration: this.parseDuration(legs[0].duration),
        distance: legs[0].distanceMeters ?? 0,
      },
      leg2: {
        duration: this.parseDuration(legs[1].duration),
        distance: legs[1].distanceMeters ?? 0,
      },
      snappedDropoff: snapped
        ? { lat: snapped.latitude, lon: snapped.longitude }
        : undefined,
    };
  }

  /**
   * Real walking distance/time from each origin to one destination,
   * in a single Route Matrix request. Null where no walking route exists.
   */
  async computeWalkingLegs(
    origins: Coordinates[],
    destination: Coordinates,
  ): Promise<(RouteLeg | null)[]> {
    if (origins.length === 0) return [];

    const toWaypoint = (c: Coordinates) => ({
      waypoint: { location: { latLng: { latitude: c.lat, longitude: c.lon } } },
    });

    const response = await fetch(this.routeMatrixUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask":
          "originIndex,destinationIndex,duration,distanceMeters,condition",
      },
      body: JSON.stringify({
        origins: origins.map(toWaypoint),
        destinations: [toWaypoint(destination)],
        travelMode: "WALK",
      }),
    });
    const data = await response.json();

    if (!response.ok || !Array.isArray(data)) {
      throw new Error(
        `Failed to compute walking distances: ${data?.error?.status ?? response.status} ${data?.error?.message ?? ""}`.trim(),
      );
    }

    const legs: (RouteLeg | null)[] = origins.map(() => null);
    for (const element of data) {
      if (element.condition !== "ROUTE_EXISTS") continue;
      // Zero values (e.g. originIndex 0) are omitted from the JSON
      legs[element.originIndex ?? 0] = {
        duration: this.parseDuration(element.duration),
        distance: element.distanceMeters ?? 0,
      };
    }
    return legs;
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
    departureTime?: Date | null,
    trafficAware = true,
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
    // routing preference is only allowed for driving. TRAFFIC_UNAWARE is
    // billed at the cheaper rate; departure time is only allowed with traffic.
    if (travelMode === "DRIVE" && !trafficAware) {
      body.routingPreference = "TRAFFIC_UNAWARE";
    } else if (travelMode === "DRIVE") {
      body.routingPreference = "TRAFFIC_AWARE";
      // Planned rides: predicted traffic at that time (must be in the future)
      if (departureTime && departureTime.getTime() > Date.now() + 60_000) {
        body.departureTime = departureTime.toISOString();
      }
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
   * One page of Places API (New) Text Search along a route
   */
  private async textSearchAlongRoute(
    encodedPolyline: string,
    includedType: string,
    pageToken?: string,
  ): Promise<any> {
    const response = await fetch(this.placesTextSearchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask":
          "places.id,places.location,places.displayName,nextPageToken",
      },
      body: JSON.stringify({
        textQuery: "bus stop",
        languageCode: CONFIG.PLACE_NAMES_LANGUAGE,
        includedType,
        strictTypeFiltering: true,
        pageSize: 20,
        searchAlongRouteParameters: { polyline: { encodedPolyline } },
        ...(pageToken ? { pageToken } : {}),
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `Bus stop search failed: ${data?.error?.status ?? response.status} ${data?.error?.message ?? ""}`.trim(),
      );
    }
    return data;
  }

  /**
   * Search for nearby places via Places API (New) searchNearby
   */
  private async nearbySearch(
    location: Coordinates,
    types: string[],
    radius: number,
  ): Promise<PlaceResult[]> {
    const response = await fetch(this.placesUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": "places.id,places.location,places.displayName",
      },
      body: JSON.stringify({
        includedTypes: types,
        languageCode: CONFIG.PLACE_NAMES_LANGUAGE,
        maxResultCount: 20, // API maximum, no pagination
        locationRestriction: {
          circle: {
            center: { latitude: location.lat, longitude: location.lon },
            radius,
          },
        },
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `Nearby search failed: ${data?.error?.status ?? response.status} ${data?.error?.message ?? ""}`.trim(),
      );
    }

    // An empty object is returned when nothing is found
    return (data.places ?? []).map((place: any) => ({
      id: place.id,
      location: {
        lat: place.location.latitude,
        lon: place.location.longitude,
      },
      name: place.displayName?.text || "Unknown",
    }));
  }
}
