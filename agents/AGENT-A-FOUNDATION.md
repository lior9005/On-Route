> **Historical, out of date.** This is the original build plan; the app has changed since (Routes/Places APIs (New), web support, street meeting points). See `AGENTS.md` in the repo root and the code instead.

# Agent A: Foundation Layer
## On-Route: Multi-Modal Drop-off Optimizer

**Your Mission:** Set up the project foundation, create all data models, utilities, and configuration. This is the base layer that all other agents will depend on.

**Status:** [PENDING] → [IN_PROGRESS] → [COMPLETE]

**Dependencies:** None (you start first!)

**Estimated Time:** 2-3 hours

---

## 📋 Your Tasks

### Task 1: Project Initialization
**File:** Root directory setup

1. Initialize Expo TypeScript project:
   ```bash
   npx create-expo-app@latest . --template expo-template-blank-typescript
   ```

2. Install required dependencies:
   ```bash
   npm install expo-router @react-native-async-storage/async-storage axios @react-native-community/slider expo-location react-native-maps @mapbox/polyline
   npm install --save-dev @types/mapbox__polyline
   ```

3. Create folder structure:
   ```
   src/
     models/
     services/
     strategies/
     hooks/
     components/
     screens/
     utils/
     constants/
   ```

4. Set up environment configuration:
   - Create `.env.example` with:
     ```
     GOOGLE_MAPS_API_KEY=your_key_here
     ```
   - Create `.env` (user will fill in actual key)
   - Install `react-native-dotenv` or use `expo-constants` for env vars

5. Update `app.json`:
   ```json
   {
     "expo": {
       "plugins": [
         ["expo-location", {"locationAlwaysAndWhenInUsePermission": "Allow On-Route to access your location"}]
       ],
       "ios": {"bundleIdentifier": "com.yourcompany.onroute"},
       "android": {"package": "com.yourcompany.onroute"}
     }
   }
   ```

---

### Task 2: Data Models
**Files:** `src/models/*.ts`

Create these TypeScript interfaces (export from each file):

#### `src/models/CandidatePoint.ts`
```typescript
export interface Coordinates {
  lat: number;
  lon: number;
}

export interface RouteLeg {
  duration: number;      // seconds
  distance: number;      // meters
}

export interface PassengerLeg extends RouteLeg {
  mode: 'WALK' | 'TRANSIT';
}

export interface CandidatePoint {
  id: string;
  coordinates: Coordinates;
  leg1: RouteLeg;        // Start (A) → Drop-off (D)
  leg2: RouteLeg;        // Drop-off (D) → Destination (C)
  passengerLeg: PassengerLeg;  // Drop-off (D) → Passenger Home (B)
  totalDetour: number;   // leg1.duration + leg2.duration
  placeId?: string;      // Google Place ID
  name?: string;         // e.g., "Main St & 5th Ave"
}
```

#### `src/models/Journey.ts`
```typescript
import { Coordinates, CandidatePoint } from './CandidatePoint';

export interface Journey {
  startPoint: Coordinates;       // A
  endPoint: Coordinates;         // C
  passengerHome: Coordinates;    // B
  selectedDropoff?: CandidatePoint;  // D
  stage: 'NOT_STARTED' | 'EN_ROUTE_TO_DROPOFF' | 'EN_ROUTE_TO_DESTINATION' | 'COMPLETED';
  timestamp: number;
}
```

#### `src/models/RouteVisualization.ts`
```typescript
import { Coordinates } from './CandidatePoint';

export interface RouteSegment {
  polyline: string;           // Encoded polyline
  color: string;              // Hex color for map display
  label: string;              // e.g., "Driver Route to Drop-off"
}

export interface RouteVisualization {
  segments: RouteSegment[];
  bounds: {
    northeast: Coordinates;
    southwest: Coordinates;
  };
}
```

#### `src/models/index.ts`
```typescript
// Re-export all models for easy importing
export * from './CandidatePoint';
export * from './Journey';
export * from './RouteVisualization';
```

---

### Task 3: Utility Functions
**Files:** `src/utils/*.ts`

#### `src/utils/distance.ts`
```typescript
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
```

#### `src/utils/validation.ts`
```typescript
import { Coordinates } from '../models';

export function isValidCoordinate(coord: Coordinates): boolean {
  return (
    typeof coord.lat === 'number' &&
    typeof coord.lon === 'number' &&
    coord.lat >= -90 &&
    coord.lat <= 90 &&
    coord.lon >= -180 &&
    coord.lon <= 180
  );
}

export function validateCoordinates(coords: Coordinates[]): boolean {
  return coords.every(isValidCoordinate);
}
```

#### `src/utils/polylineDecoder.ts`
```typescript
import polyline from '@mapbox/polyline';

/**
 * Decode Google encoded polyline to array of coordinates
 * @param encodedPolyline - Encoded polyline string from Google Maps API
 * @returns Array of {latitude, longitude} objects for react-native-maps
 */
export function decodePolyline(encodedPolyline: string): Array<{latitude: number; longitude: number}> {
  try {
    const decoded = polyline.decode(encodedPolyline);
    return decoded.map(([lat, lon]) => ({ latitude: lat, longitude: lon }));
  } catch (error) {
    console.error('Failed to decode polyline:', error);
    return [];
  }
}
```

#### `src/utils/index.ts`
```typescript
export * from './distance';
export * from './validation';
export * from './polylineDecoder';
```

---

### Task 4: Constants
**File:** `src/constants/config.ts`

```typescript
export const CONFIG = {
  MAX_WALKING_DISTANCE: 1000,      // meters
  MIN_WALKING_DISTANCE: 100,       // meters
  DEFAULT_WALKING_DISTANCE: 500,   // meters
  TOP_CANDIDATES_COUNT: 5,
  GOOGLE_MAPS_API_TIMEOUT: 10000,  // ms
  
  // Route Preview Map Styling
  MAP_PADDING: 0.1,                // 10% padding for map bounds
  ROUTE_COLORS: {
    DRIVER_TO_DROPOFF: '#4285F4',   // Blue
    DRIVER_TO_DEST: '#34A853',      // Green
    PASSENGER_WALKING: '#FBBC04',   // Orange
  },
  POLYLINE_WIDTH: 4,
  MARKER_LABELS: {
    START: 'Your Location',
    DROPOFF: 'Drop-off Point',
    DESTINATION: 'Your Destination',
    PASSENGER: 'Passenger Home',
  },
} as const;
```

---

## ✅ Completion Checklist

Before reporting completion, verify:

- [ ] Project initializes with `npx expo start` (may show errors, but should launch)
- [ ] All TypeScript files compile: `npx tsc --noEmit` (no errors)
- [ ] All models export correctly from `src/models/index.ts`
- [ ] All utilities export correctly from `src/utils/index.ts`
- [ ] `.env.example` exists (no actual API key)
- [ ] Folder structure matches specification
- [ ] Constants file has all required values
- [ ] No hardcoded secrets or API keys

---

## 📤 Handoff Report

When complete, report to orchestrator:

```
✅ Agent A (Foundation) Complete

Completed:
- Project initialized with Expo TypeScript
- All data models created and exported
- Utility functions implemented (distance, validation, polylineDecoder)
- Constants file created
- Environment configuration set up

Files Created:
- src/models/CandidatePoint.ts
- src/models/Journey.ts
- src/models/RouteVisualization.ts
- src/models/index.ts
- src/utils/distance.ts
- src/utils/validation.ts
- src/utils/polylineDecoder.ts
- src/utils/index.ts
- src/constants/config.ts
- .env.example

Verification:
- ✅ TypeScript compilation: PASSED
- ✅ All exports working: PASSED

Ready for: Agent B (Backend Services)
```

---

## 🚨 If You Encounter Issues

1. **TypeScript errors:** Ensure all imports use correct paths
2. **Missing dependencies:** Check `package.json` has all required packages
3. **Expo errors:** Verify `app.json` configuration is correct
4. **Polyline decoder:** Ensure `@mapbox/polyline` types are installed

**Do NOT proceed if TypeScript compilation fails!** Fix all errors before reporting completion.

---

**Next Agent:** Agent B will use your models and utilities. Make sure everything exports cleanly!
