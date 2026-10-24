export interface Coordinates {
  lat: number;
  lon: number;
}

export interface RouteLeg {
  duration: number; // seconds
  distance: number; // meters
}

export interface PassengerLeg extends RouteLeg {
  mode: "WALK" | "TRANSIT";
  transit?: TransitDetails; // Set when mode is TRANSIT
}

/** How the hitchhiker gets between the meeting point and their own place */
export type TravelMode = "WALK" | "BUS";

/**
 * DROP_OFF: hitchhiker rides with the driver, then takes the bus to their place.
 * PICK_UP: hitchhiker takes the bus from their place to meet the driver.
 */
export type TripDirection = "DROP_OFF" | "PICK_UP";

/** One walking or bus part of the hitchhiker's bus trip, for the map */
export interface TransitSegment {
  kind: "WALK" | "BUS";
  polyline: string;
}

/** The hitchhiker's bus trip (a single bus line, no transfers) */
export interface TransitDetails {
  lineName: string; // e.g. "47"
  headsign?: string; // Direction shown on the bus
  departureStop: string;
  arrivalStop: string;
  departureTime: string; // ISO time the bus leaves departureStop
  arrivalTime: string; // ISO time the bus reaches arrivalStop
  stopCount?: number;
  waitSeconds: number; // Waiting at the stop (drop-off) or for the driver (pick-up)
  walkMeters: number; // Walking inside the trip
  segments: TransitSegment[];
}

export type MeetingPointKind = "BUS_STOP" | "STREET";

/** A possible meeting point before routes are computed */
export interface RawCandidate {
  id: string;
  location: Coordinates;
  name: string;
  kind: MeetingPointKind;
  onDriverRoute?: boolean; // Street point on the driver's normal route
  isIntersection?: boolean; // Corner of two small streets
  isClosestOnRoute?: boolean; // Spot on the driver's route closest to the passenger
}

/** What a search looked at, shown under the results to explain them */
export interface SearchInfo {
  busStops: number;
  busStopError?: string;
  streetPoints: number;
  streetError?: string;
  evaluated: number; // Candidates sent to Google after pre-filtering
  tooFarToWalk: number;
  movedToOtherRoad: number;
  routeErrors: number;
  /** Bus mode: why candidates were dropped (reason -> count) */
  transitRejections?: Partial<Record<TransitRejection, number>>;
}

export type TransitRejection =
  | "OVER_DETOUR"
  | "DRIVER_WAIT_TOO_LONG"
  | "NO_DIRECT_BUS"
  | "TOO_MUCH_WALKING"
  | "TOO_LONG"
  | "NO_SPARE_TIME"
  | "CANT_MAKE_IT";

export interface CandidatePoint {
  id: string;
  coordinates: Coordinates;
  leg1: RouteLeg; // Start (A) → Meeting Point (D)
  leg2: RouteLeg; // Meeting Point (D) → Destination (C)
  passengerLeg: PassengerLeg; // Meeting Point (D) → Passenger Home (B)
  totalDetour: number; // leg1.duration + leg2.duration
  placeId?: string; // Google Place ID
  name?: string; // e.g., "Main St & 5th Ave"
  kind?: MeetingPointKind;
  extraDriveTime?: number; // seconds added vs. the driver's normal route
  meetTime?: string; // ISO meeting time at the meeting point (bus mode)
  direction?: TripDirection; // Bus mode: drop-off or pick-up
  driverWaitSeconds?: number; // Bus pick-up: driver waits for the hitchhiker
  combinedTime?: number; // Bus mode ranking: extraDriveTime + passenger trip (seconds)
}
