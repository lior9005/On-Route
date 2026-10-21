import { GoogleMapsService } from "./GoogleMapsService";
import { IDropOffStrategy } from "../strategies/IDropOffStrategy";
import { Coordinates, CandidatePoint } from "../models";
import { CONFIG } from "../constants/config";
import { haversineDistance } from "../utils/distance";

export class RoutingEngine {
  constructor(
    private googleMapsService: GoogleMapsService,
    private strategy: IDropOffStrategy,
  ) {}

  /**
   * Optimize meeting point selection
   * @returns Sorted array of valid candidate points (best first)
   */
  async optimize(
    start: Coordinates,
    end: Coordinates,
    passengerHome: Coordinates,
    maxConstraint: number,
  ): Promise<CandidatePoint[]> {
    // Step 1: Search for transit stations within walking distance of passenger home
    const transitTypes = ["bus_station", "transit_station"];

    const rawCandidates = await this.googleMapsService.searchNearLocation(
      passengerHome,
      transitTypes,
      maxConstraint, // Use max walking distance as search radius
    );

    if (rawCandidates.length === 0) {
      return [];
    }

    // Step 2: For each bus station, calculate detour route and walking distance
    const validationPromises = rawCandidates.map(async (rawCandidate) => {
      // Validate walking distance from meeting point (D) to passenger home (B)
      const passengerLeg = await this.strategy.validate(
        rawCandidate.location,
        passengerHome,
        maxConstraint,
      );

      if (!passengerLeg) {
        return null;
      }

      // Compute detour route: Start (A) → Meeting Point (D) → Destination (C)
      const detourRoute = await this.googleMapsService.computeDetourRoute(
        start,
        rawCandidate.location,
        end,
      );

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

    // Step 3: Wait for all calculations
    const candidates = await Promise.all(validationPromises);

    // Step 4: Filter out nulls (stations that failed validation)
    const validCandidates = candidates.filter(
      (c): c is CandidatePoint => c !== null,
    );

    // Step 5: Sort by total detour time (shortest first)
    validCandidates.sort((a, b) => a.totalDetour - b.totalDetour);

    // Step 6: Merge candidates within CANDIDATE_MERGE_RADIUS_METERS; keep best per cluster
    const merged: CandidatePoint[] = [];
    const mergeRadius = CONFIG.CANDIDATE_MERGE_RADIUS_METERS;
    for (const c of validCandidates) {
      const tooClose = merged.some(
        (m) => haversineDistance(c.coordinates, m.coordinates) < mergeRadius,
      );
      if (!tooClose) merged.push(c);
    }

    // Step 7: Return top N candidates
    return merged.slice(0, CONFIG.TOP_CANDIDATES_COUNT);
  }
}
