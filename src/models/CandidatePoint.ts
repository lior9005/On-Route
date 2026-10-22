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
}

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
}
