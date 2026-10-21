import { Coordinates, CandidatePoint } from "./CandidatePoint";

export interface Journey {
  startPoint: Coordinates; // A
  endPoint: Coordinates; // C
  passengerHome: Coordinates; // B
  selectedDropoff?: CandidatePoint; // D (meeting point)
  stage:
    | "NOT_STARTED"
    | "EN_ROUTE_TO_DROPOFF"
    | "EN_ROUTE_TO_DESTINATION"
    | "COMPLETED";
  timestamp: number;
}
