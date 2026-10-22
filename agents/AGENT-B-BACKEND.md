> **Historical, out of date.** This is the original build plan; the app has changed since (Routes/Places APIs (New), web support, street meeting points). See `AGENTS.md` in the repo root and the code instead.

# Agent B: Backend Services Layer
## On-Route: Multi-Modal Drop-off Optimizer

**Your Mission:** Implement the Strategy Pattern, Google Maps API service, Waze service, and the core RoutingEngine optimization algorithm.

**Status:** [BLOCKED] → [IN_PROGRESS] → [COMPLETE]

**Dependencies:** Agent A must be [COMPLETE] before you start!

**Estimated Time:** 4-5 hours

---

## 📋 Prerequisites Check

Before starting, verify Agent A completed:

- [ ] `src/models/CandidatePoint.ts` exists with `Coordinates`, `RouteLeg`, `PassengerLeg`, `CandidatePoint`
- [ ] `src/models/Journey.ts` exists with `Journey` interface
- [ ] `src/models/RouteVisualization.ts` exists
- [ ] `src/constants/config.ts` exists with `CONFIG` object
- [ ] `src/utils/distance.ts` has `haversineDistance` function
- [ ] TypeScript compiles: `npx tsc --noEmit` passes

**If any are missing, STOP and wait for Agent A to complete!**

---

## 📋 Your Tasks

### Task 1: Strategy Pattern Interface
**File:** `src/strategies/IDropOffStrategy.ts`

```typescript
import { Coordinates, PassengerLeg } from '../models';

export interface IDropOffStrategy {
  /**
   * Validates if a drop-off point satisfies the passenger's travel constraint
   * @param dropoffPoint - The candidate drop-off location (D)
   * @param passengerHome - The passenger's destination (B)
   * @param maxConstraint - Maximum allowed constraint (meters for walking, minutes for transit)
   * @returns PassengerLeg if valid, null if constraint not met
   */
  validate(
    dropoffPoint: Coordinates,
    passengerHome: Coordinates,
    maxConstraint: number
  ): Promise<PassengerLeg | null>;
}
```

---

### Task 2: Walking Strategy Implementation
**File:** `src/strategies/WalkingStrategy.ts`

```typescript
import { IDropOffStrategy } from './IDropOffStrategy';
import { Coordinates, PassengerLeg } from '../models';
import { haversineDistance } from '../utils/distance';

export class WalkingStrategy implements IDropOffStrategy {
  async validate(
    dropoffPoint: Coordinates,
    passengerHome: Coordinates,
    maxWalkingMeters: number
  ): Promise<PassengerLeg | null> {
    const distance = haversineDistance(dropoffPoint, passengerHome);
    
    if (distance <= maxWalkingMeters) {
      // Estimate walking time: average walking speed is 1.4 m/s (5 km/h)
      const walkingSpeed = 1.4; // meters per second
      const duration = Math.round(distance / walkingSpeed);
      
      return {
        distance,
        duration,
        mode: 'WALK',
      };
    }
    
    return null; // Distance exceeds constraint
  }
}
```

---

### Task 3: Transit Strategy Placeholder
**File:** `src/strategies/TransitStrategy.ts`

```typescript
import { IDropOffStrategy } from './IDropOffStrategy';
import { Coordinates, PassengerLeg } from '../models';

/**
 * Placeholder for future transit validation
 * Will use Google Directions API with mode=TRANSIT
 */
export class TransitStrategy implements IDropOffStrategy {
  async validate(
    dropoffPoint: Coordinates,
    passengerHome: Coordinates,
    maxTransitMinutes: number
  ): Promise<PassengerLeg | null> {
    // TODO: Implement using Google Directions API
    // 1. Call Directions API from dropoffPoint → passengerHome with mode=TRANSIT
    // 2. Parse routes[0].legs[0].duration.value
    // 3. Check if duration <= maxTransitMinutes
    // 4. Return PassengerLeg with mode: 'TRANSIT' and actual duration
    // 5. Handle no-transit-available gracefully (return null)
    
    throw new Error('TransitStrategy not yet implemented');
  }
}
```

---

### Task 4: Google Maps Service
**File:** `src/services/GoogleMapsService.ts`

**Critical:** Use environment variable for API key: `process.env.GOOGLE_MAPS_API_KEY`

```typescript
import axios, { AxiosInstance } from 'axios';
import { Coordinates, CandidatePoint, RouteVisualization, RouteSegment } from '../models';
import { CONFIG } from '../constants/config';

interface GoogleRoutesResponse {
  routes: Array<{
    polyline: { encodedPolyline: string };
    legs: Array<{
      duration: string; // e.g., "600s"
      distanceMeters: number;
    }>;
    bounds: {
      northeast: { latitude: number; longitude: number };
      southwest: { latitude: number; longitude: number };
    };
  }>;
}

interface GooglePlacesResponse {
  places: Array<{
    id: string;
    displayName: { text: string };
    location: { latitude: number; longitude: number };
    routingSummaries?: Array<{
      duration: string;
      distanceMeters: number;
    }>;
  }>;
}

export class GoogleMapsService {
  private apiKey: string;
  private client: AxiosInstance;
  private baseUrl = 'https://routes.googleapis.com/v2';
  private placesUrl = 'https://places.googleapis.com/v1';

  constructor() {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_MAPS_API_KEY not found in environment variables');
    }
    this.apiKey = apiKey;
    this.client = axios.create({
      timeout: CONFIG.GOOGLE_MAPS_API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'routes.polyline.encodedPolyline,routes.legs.duration,routes.legs.distanceMeters,routes.bounds',
      },
    });
  }

  /**
   * Fetch baseline route from start to end using Routes API v2
   * @returns Encoded polyline for A→C route
   */
  async fetchBaselineRoute(
    start: Coordinates,
    end: Coordinates
  ): Promise<{ polyline: string; bounds: { northeast: Coordinates; southwest: Coordinates } }> {
    try {
      const response = await this.client.post<GoogleRoutesResponse>(
        `${this.baseUrl}:computeRoutes`,
        {
          origin: { location: { latLng: { latitude: start.lat, longitude: start.lon } } },
          destination: { location: { latLng: { latitude: end.lat, longitude: end.lon } } },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
          computeAlternativeRoutes: false,
        }
      );

      const route = response.data.routes[0];
      return {
        polyline: route.polyline.encodedPolyline,
        bounds: {
          northeast: {
            lat: route.bounds.northeast.latitude,
            lon: route.bounds.northeast.longitude,
          },
          southwest: {
            lat: route.bounds.southwest.latitude,
            lon: route.bounds.southwest.longitude,
          },
        },
      };
    } catch (error) {
      console.error('Error fetching baseline route:', error);
      throw new Error('Failed to fetch baseline route');
    }
  }

  /**
   * Search for places (intersections) along a route using Places API (New)
   */
  async searchAlongRoute(
    polyline: string,
    query: string = 'intersection'
  ): Promise<Array<{ id: string; name: string; location: Coordinates; routingSummary?: { duration: number; distance: number } }>> {
    try {
      const response = await this.client.post<GooglePlacesResponse>(
        `${this.placesUrl}/places:searchText`,
        {
          textQuery: query,
          searchAlongRouteParameters: {
            polyline: { encodedPolyline: polyline },
            maxRouteLength: '10000m', // 10km search radius
          },
          routingParameters: {
            travelMode: 'DRIVE',
          },
        },
        {
          headers: {
            'X-Goog-FieldMask': 'places.id,places.displayName,places.location,routingSummaries',
          },
        }
      );

      return response.data.places.map((place) => ({
        id: place.id,
        name: place.displayName.text,
        location: {
          lat: place.location.latitude,
          lon: place.location.longitude,
        },
        routingSummary: place.routingSummaries?.[0]
          ? {
              duration: parseInt(place.routingSummaries[0].duration.replace('s', '')),
              distance: place.routingSummaries[0].distanceMeters,
            }
          : undefined,
      }));
    } catch (error) {
      console.error('Error searching along route:', error);
      throw new Error('Failed to search places along route');
    }
  }

  /**
   * Compute detour route A→D→C with waypoint optimization
   * Returns polylines for both legs
   */
  async computeDetourRoute(
    start: Coordinates,
    waypoint: Coordinates,
    end: Coordinates
  ): Promise<{
    leg1Polyline: string;
    leg2Polyline: string;
    leg1: { duration: number; distance: number };
    leg2: { duration: number; distance: number };
  }> {
    try {
      const response = await this.client.post<GoogleRoutesResponse>(
        `${this.baseUrl}:computeRoutes`,
        {
          origin: { location: { latLng: { latitude: start.lat, longitude: start.lon } } },
          destination: { location: { latLng: { latitude: end.lat, longitude: end.lon } } },
          intermediates: [
            { location: { latLng: { latitude: waypoint.lat, longitude: waypoint.lon } } },
          ],
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
          optimizeWaypointOrder: true,
        }
      );

      const route = response.data.routes[0];
      const legs = route.legs;

      // If waypoint order was optimized, we need to identify which leg is which
      // For simplicity, assume first leg is A→D, second is D→C
      const leg1 = legs[0];
      const leg2 = legs[1] || legs[0]; // Fallback if only one leg

      return {
        leg1Polyline: route.polyline.encodedPolyline, // Full route polyline (can be split later if needed)
        leg2Polyline: route.polyline.encodedPolyline, // Same for now
        leg1: {
          duration: parseInt(leg1.duration.replace('s', '')),
          distance: leg1.distanceMeters,
        },
        leg2: {
          duration: parseInt(leg2.duration.replace('s', '')),
          distance: leg2.distanceMeters,
        },
      };
    } catch (error) {
      console.error('Error computing detour route:', error);
      throw new Error('Failed to compute detour route');
    }
  }

  /**
   * Get walking route from drop-off to passenger home
   * Used for route preview visualization
   */
  async getWalkingRoute(
    from: Coordinates,
    to: Coordinates
  ): Promise<{ polyline: string; duration: number; distance: number }> {
    try {
      const response = await this.client.post<GoogleRoutesResponse>(
        `${this.baseUrl}:computeRoutes`,
        {
          origin: { location: { latLng: { latitude: from.lat, longitude: from.lon } } },
          destination: { location: { latLng: { latitude: to.lat, longitude: to.lon } } },
          travelMode: 'WALK',
        }
      );

      const route = response.data.routes[0];
      const leg = route.legs[0];

      return {
        polyline: route.polyline.encodedPolyline,
        duration: parseInt(leg.duration.replace('s', '')),
        distance: leg.distanceMeters,
      };
    } catch (error) {
      console.error('Error getting walking route:', error);
      throw new Error('Failed to get walking route');
    }
  }

  /**
   * Get complete route visualization for preview screen
   */
  async getRouteVisualization(
    candidate: CandidatePoint,
    start: Coordinates,
    end: Coordinates,
    passengerHome: Coordinates
  ): Promise<RouteVisualization> {
    // Fetch walking route D→B
    const walkingRoute = await this.getWalkingRoute(candidate.coordinates, passengerHome);

    // Get detour route polylines (already computed, but fetch again for visualization)
    const detourRoute = await this.computeDetourRoute(start, candidate.coordinates, end);

    const segments: RouteSegment[] = [
      {
        polyline: detourRoute.leg1Polyline,
        color: CONFIG.ROUTE_COLORS.DRIVER_TO_DROPOFF,
        label: 'Driver Route to Drop-off',
      },
      {
        polyline: detourRoute.leg2Polyline,
        color: CONFIG.ROUTE_COLORS.DRIVER_TO_DEST,
        label: 'Driver Route to Destination',
      },
      {
        polyline: walkingRoute.polyline,
        color: CONFIG.ROUTE_COLORS.PASSENGER_WALKING,
        label: 'Passenger Walking Route',
      },
    ];

    // Calculate bounds from all points
    const allPoints = [
      start,
      candidate.coordinates,
      end,
      passengerHome,
    ];

    const lats = allPoints.map((p) => p.lat);
    const lons = allPoints.map((p) => p.lon);

    return {
      segments,
      bounds: {
        northeast: {
          lat: Math.max(...lats),
          lon: Math.max(...lons),
        },
        southwest: {
          lat: Math.min(...lats),
          lon: Math.min(...lons),
        },
      },
    };
  }
}
```

---

### Task 5: Waze Service
**File:** `src/services/WazeService.ts`

```typescript
import { Linking, Alert } from 'react-native';
import { Coordinates } from '../models';

export class WazeService {
  /**
   * Open Waze navigation to destination
   */
  static async openNavigation(destination: Coordinates): Promise<void> {
    const url = `waze://?ll=${destination.lat},${destination.lon}&navigate=yes`;
    
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          'Waze Not Installed',
          'Please install Waze to use navigation features.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error opening Waze:', error);
      Alert.alert('Error', 'Failed to open Waze navigation');
    }
  }
}
```

---

### Task 6: Routing Engine
**File:** `src/services/RoutingEngine.ts`

```typescript
import { GoogleMapsService } from './GoogleMapsService';
import { IDropOffStrategy } from '../strategies/IDropOffStrategy';
import { Coordinates, CandidatePoint } from '../models';
import { CONFIG } from '../constants/config';

export class RoutingEngine {
  constructor(
    private googleMapsService: GoogleMapsService,
    private strategy: IDropOffStrategy
  ) {}

  /**
   * Optimize drop-off point selection
   * @returns Sorted array of valid candidate points (best first)
   */
  async optimize(
    start: Coordinates,
    end: Coordinates,
    passengerHome: Coordinates,
    maxConstraint: number
  ): Promise<CandidatePoint[]> {
    // Step 1: Fetch baseline route A→C
    const baselineRoute = await this.googleMapsService.fetchBaselineRoute(start, end);

    // Step 2: Search for intersection candidates along route
    const rawCandidates = await this.googleMapsService.searchAlongRoute(
      baselineRoute.polyline,
      'intersection'
    );

    // Step 3: Validate each candidate in parallel
    const validationPromises = rawCandidates.map(async (rawCandidate) => {
      // Compute detour route A→D→C
      const detourRoute = await this.googleMapsService.computeDetourRoute(
        start,
        rawCandidate.location,
        end
      );

      // Validate with strategy (D→B constraint)
      const passengerLeg = await this.strategy.validate(
        rawCandidate.location,
        passengerHome,
        maxConstraint
      );

      if (!passengerLeg) {
        return null; // Candidate doesn't meet constraint
      }

      // Create candidate point
      const candidate: CandidatePoint = {
        id: rawCandidate.id,
        coordinates: rawCandidate.location,
        leg1: detourRoute.leg1,
        leg2: detourRoute.leg2,
        passengerLeg,
        totalDetour: detourRoute.leg1.duration + detourRoute.leg2.duration,
        placeId: rawCandidate.id,
        name: rawCandidate.name,
      };

      return candidate;
    });

    // Wait for all validations
    const candidates = await Promise.all(validationPromises);

    // Step 4: Filter out nulls (invalid candidates)
    const validCandidates = candidates.filter(
      (c): c is CandidatePoint => c !== null
    );

    // Step 5: Sort by total detour time (ascending - best first)
    validCandidates.sort((a, b) => a.totalDetour - b.totalDetour);

    // Step 6: Return top N candidates
    return validCandidates.slice(0, CONFIG.TOP_CANDIDATES_COUNT);
  }
}
```

---

### Task 7: Export Services
**File:** `src/services/index.ts`

```typescript
export * from './GoogleMapsService';
export * from './WazeService';
export * from './RoutingEngine';
```

---

### Task 8: Export Strategies
**File:** `src/strategies/index.ts`

```typescript
export * from './IDropOffStrategy';
export * from './WalkingStrategy';
export * from './TransitStrategy';
```

---

## ✅ Completion Checklist

Before reporting completion, verify:

- [ ] All TypeScript files compile: `npx tsc --noEmit` (no errors)
- [ ] `GoogleMapsService` uses `process.env.GOOGLE_MAPS_API_KEY` (no hardcoded keys)
- [ ] `WalkingStrategy.validate()` returns correct `PassengerLeg` type
- [ ] `RoutingEngine.optimize()` returns `Promise<CandidatePoint[]>`
- [ ] All services export correctly from `src/services/index.ts`
- [ ] All strategies export correctly from `src/strategies/index.ts`
- [ ] Error handling in place (try-catch blocks)
- [ ] No console.log statements with sensitive data

---

## 🧪 Testing Notes

You can create simple test files to verify your services work:

```typescript
// test-google-service.ts (don't commit this)
import { GoogleMapsService } from './src/services/GoogleMapsService';

const service = new GoogleMapsService();
const result = await service.fetchBaselineRoute(
  { lat: 40.7128, lon: -74.0060 }, // NYC
  { lat: 40.7589, lon: -73.9851 }  // NYC
);
console.log('Polyline:', result.polyline);
```

**Delete test files before reporting completion!**

---

## 📤 Handoff Report

When complete, report to orchestrator:

```
✅ Agent B (Backend Services) Complete

Completed:
- Strategy Pattern: IDropOffStrategy, WalkingStrategy, TransitStrategy (placeholder)
- GoogleMapsService: All API methods implemented
- WazeService: Deep linking implemented
- RoutingEngine: Optimization algorithm complete

Files Created:
- src/strategies/IDropOffStrategy.ts
- src/strategies/WalkingStrategy.ts
- src/strategies/TransitStrategy.ts
- src/strategies/index.ts
- src/services/GoogleMapsService.ts
- src/services/WazeService.ts
- src/services/RoutingEngine.ts
- src/services/index.ts

Verification:
- ✅ TypeScript compilation: PASSED
- ✅ All exports working: PASSED
- ✅ No hardcoded API keys: PASSED

Ready for: Agent C (State Management)
```

---

## 🚨 If You Encounter Issues

1. **API Key errors:** Ensure `.env` has `GOOGLE_MAPS_API_KEY` set
2. **Type errors:** Verify imports from `src/models` are correct
3. **Google API errors:** Check API key has Routes API and Places API enabled
4. **Polyline format:** Google Routes API v2 uses `encodedPolyline` field

**Do NOT proceed if TypeScript compilation fails!** Fix all errors before reporting completion.

---

**Next Agent:** Agent C will use your `RoutingEngine` and `IDropOffStrategy` to build React hooks.
