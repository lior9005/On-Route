import { Coordinates } from "./CandidatePoint";

export interface RouteSegment {
  polyline: string; // Encoded polyline
  color: string; // Hex color for map display
  label: string; // e.g., "Driver Route to Meeting Point"
}

export interface RouteVisualization {
  segments: RouteSegment[];
  bounds: {
    northeast: Coordinates;
    southwest: Coordinates;
  };
}
