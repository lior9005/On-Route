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

export interface CandidatePoint {
  id: string;
  coordinates: Coordinates;
  leg1: RouteLeg; // Start (A) → Meeting Point (D)
  leg2: RouteLeg; // Meeting Point (D) → Destination (C)
  passengerLeg: PassengerLeg; // Meeting Point (D) → Passenger Home (B)
  totalDetour: number; // leg1.duration + leg2.duration
  placeId?: string; // Google Place ID
  name?: string; // e.g., "Main St & 5th Ave"
}

/** Best achievable driving time if the passenger may walk up to maxWalk meters */
export interface WalkingTradeoffStep {
  maxWalk: number; // meters
  bestDriveTime: number | null; // seconds; null when no stop is within maxWalk
}
