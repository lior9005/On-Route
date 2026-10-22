import { GoogleMapsService } from "./GoogleMapsService";
import { OsmService } from "./OsmService";
import { IDropOffStrategy } from "../strategies/IDropOffStrategy";
import { Coordinates, CandidatePoint, RawCandidate } from "../models";
import { CONFIG } from "../constants/config";
import { haversineDistance } from "../utils/distance";
import { decodePolyline } from "../utils/polylineDecoder";
import {
  buildStreetCandidates,
  preselectCandidates,
} from "../utils/streetCandidates";

export class RoutingEngine {
  constructor(
    private googleMapsService: GoogleMapsService,
    private osmService: OsmService,
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
    // Step 1: In parallel - transit stops near the passenger, small streets
    // near the passenger (OpenStreetMap) and the driver's normal route
    const transitTypes = ["bus_station", "transit_station"];

    const [stopsResult, streetsResult, baselineResult] =
      await Promise.allSettled([
        this.googleMapsService.searchNearLocation(
          passengerHome,
          transitTypes,
          maxConstraint, // Use max walking distance as search radius
        ),
        this.osmService.fetchStreetNetwork(passengerHome, maxConstraint),
        this.googleMapsService.fetchBaselineRoute(start, end),
      ]);

    if (
      stopsResult.status === "rejected" &&
      streetsResult.status === "rejected"
    ) {
      throw stopsResult.reason;
    }
    if (stopsResult.status === "rejected") {
      console.warn("Transit stop search failed:", stopsResult.reason);
    }
    if (streetsResult.status === "rejected") {
      console.warn("Street search failed:", streetsResult.reason);
    }

    const baseline =
      baselineResult.status === "fulfilled" ? baselineResult.value : null;
    const driverRoute: Coordinates[] = baseline
      ? decodePolyline(baseline.polyline).map((p) => ({
          lat: p.latitude,
          lon: p.longitude,
        }))
      : [];

    // Step 2: Candidate points - transit stops and small-street points
    const stopCandidates: RawCandidate[] =
      stopsResult.status === "fulfilled"
        ? stopsResult.value.map((place) => ({
            id: place.id,
            location: place.location,
            name: place.name,
            kind: "BUS_STOP" as const,
          }))
        : [];

    const streetCandidates: RawCandidate[] =
      streetsResult.status === "fulfilled"
        ? buildStreetCandidates(
            streetsResult.value,
            passengerHome,
            maxConstraint,
            driverRoute,
          )
        : [];

    // Step 3: Pre-filter without API calls - within walking range (straight
    // line), merged, best estimated detours first, capped for cost
    const preselected = preselectCandidates(
      [...stopCandidates, ...streetCandidates].filter(
        (c) => haversineDistance(c.location, passengerHome) <= maxConstraint,
      ),
      start,
      end,
      CONFIG.CANDIDATE_MERGE_RADIUS_METERS,
      CONFIG.MAX_CANDIDATES_TO_EVALUATE,
    );

    if (preselected.length === 0) {
      return [];
    }

    // Step 4: Validate passenger leg (real walking distance, one batched request)
    const passengerLegs = await this.strategy.validate(
      preselected.map((c) => c.location),
      passengerHome,
      maxConstraint,
    );

    // Step 5: For each valid point, calculate detour route
    // Start (A) → Meeting Point (D) → Destination (C)
    const detourResults = await Promise.allSettled(
      preselected.map(async (rawCandidate, i) => {
        const passengerLeg = passengerLegs[i];
        if (!passengerLeg) {
          return null;
        }

        const detourRoute = await this.googleMapsService.computeDetourRoute(
          start,
          rawCandidate.location,
          end,
        );

        // Google stops the car on the nearest road; if that is far from the
        // street point it may be a bigger road, so drop it
        if (
          rawCandidate.kind === "STREET" &&
          detourRoute.snappedDropoff &&
          haversineDistance(detourRoute.snappedDropoff, rawCandidate.location) >
            CONFIG.MAX_SNAP_DISTANCE_METERS
        ) {
          return null;
        }

        const totalDetour =
          detourRoute.leg1.duration + detourRoute.leg2.duration;

        const candidate: CandidatePoint = {
          id: rawCandidate.id,
          coordinates: rawCandidate.location,
          leg1: detourRoute.leg1,
          leg2: detourRoute.leg2,
          passengerLeg,
          totalDetour,
          placeId: rawCandidate.kind === "BUS_STOP" ? rawCandidate.id : undefined,
          name: rawCandidate.name,
          kind: rawCandidate.kind,
          extraDriveTime: baseline
            ? Math.max(0, totalDetour - baseline.duration)
            : undefined,
        };

        return candidate;
      }),
    );

    // Step 6: Keep successful, valid candidates
    const validCandidates = detourResults
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter((c): c is CandidatePoint => c !== null);

    if (validCandidates.length === 0) {
      const failure = detourResults.find((r) => r.status === "rejected");
      if (failure) {
        throw (failure as PromiseRejectedResult).reason;
      }
    }

    // Step 7: Sort by total detour time (shortest first)
    validCandidates.sort((a, b) => a.totalDetour - b.totalDetour);

    // Step 8: Merge candidates within CANDIDATE_MERGE_RADIUS_METERS; keep best per cluster
    const merged: CandidatePoint[] = [];
    const mergeRadius = CONFIG.CANDIDATE_MERGE_RADIUS_METERS;
    for (const c of validCandidates) {
      const tooClose = merged.some(
        (m) => haversineDistance(c.coordinates, m.coordinates) < mergeRadius,
      );
      if (!tooClose) merged.push(c);
    }

    // Step 9: Return top N candidates
    return merged.slice(0, CONFIG.TOP_CANDIDATES_COUNT);
  }
}
