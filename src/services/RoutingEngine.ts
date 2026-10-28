import { GoogleMapsService } from "./GoogleMapsService";
import { IDropOffStrategy } from "../strategies/IDropOffStrategy";
import { Coordinates, CandidatePoint, WalkingTradeoffStep } from "../models";
import { CONFIG } from "../constants/config";
import { haversineDistance } from "../utils/distance";

export interface TradeoffResult {
  /** Top candidates within the requested walking limit (best first) */
  candidates: CandidatePoint[];
  /** Every routed candidate, including ones beyond the limit; lets the UI re-pick a limit without a new search */
  routed: CandidatePoint[];
  /** Best driving time at each walking-limit step up to searchRadius */
  tradeoff: WalkingTradeoffStep[];
  searchRadius: number;
}

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
    const { routed } = await this.routeCandidates(
      start,
      end,
      passengerHome,
      maxConstraint,
      maxConstraint,
      0,
    );
    return RoutingEngine.selectTop(routed, maxConstraint);
  }

  /**
   * Like optimize(), but also searches a bit beyond the walking limit so the UI can show
   * how much driving time each extra step of walking would save.
   */
  async optimizeWithTradeoff(
    start: Coordinates,
    end: Coordinates,
    passengerHome: Coordinates,
    maxConstraint: number,
  ): Promise<TradeoffResult> {
    const searchRadius = Math.max(
      maxConstraint,
      Math.min(
        maxConstraint + CONFIG.TRADEOFF_EXTRA_WALK_METERS,
        CONFIG.MAX_WALKING_DISTANCE,
      ),
    );

    const { routed, coveredRadius } = await this.routeCandidates(
      start,
      end,
      passengerHome,
      maxConstraint,
      searchRadius,
      CONFIG.TRADEOFF_MAX_EXTRA_ROUTED,
    );
    // Snap down to a whole step so the last row is never based on a partial search
    const step = CONFIG.TRADEOFF_STEP_METERS;
    const tradeoffRadius = Math.max(
      maxConstraint,
      Math.floor(coveredRadius / step) * step,
    );

    return {
      candidates: RoutingEngine.selectTop(routed, maxConstraint),
      routed,
      tradeoff: RoutingEngine.buildTradeoff(routed, tradeoffRadius),
      searchRadius: tradeoffRadius,
    };
  }

  /** Best candidates within maxWalk: sort by detour, merge nearby stops, keep top N */
  static selectTop(routed: CandidatePoint[], maxWalk: number): CandidatePoint[] {
    const valid = routed
      .filter((c) => c.passengerLeg.distance <= maxWalk)
      .sort((a, b) => a.totalDetour - b.totalDetour);

    // Merge candidates within CANDIDATE_MERGE_RADIUS_METERS; keep best per cluster
    const merged: CandidatePoint[] = [];
    const mergeRadius = CONFIG.CANDIDATE_MERGE_RADIUS_METERS;
    for (const c of valid) {
      const tooClose = merged.some(
        (m) => haversineDistance(c.coordinates, m.coordinates) < mergeRadius,
      );
      if (!tooClose) merged.push(c);
    }

    return merged.slice(0, CONFIG.TOP_CANDIDATES_COUNT);
  }

  /** Best driving time for each walking limit, in TRADEOFF_STEP_METERS steps */
  static buildTradeoff(
    routed: CandidatePoint[],
    maxRadius: number,
  ): WalkingTradeoffStep[] {
    const step = CONFIG.TRADEOFF_STEP_METERS;
    const steps: WalkingTradeoffStep[] = [];
    for (let maxWalk = step; maxWalk <= maxRadius; maxWalk += step) {
      let best: number | null = null;
      for (const c of routed) {
        if (c.passengerLeg.distance <= maxWalk && (best === null || c.totalDetour < best)) {
          best = c.totalDetour;
        }
      }
      steps.push({ maxWalk, bestDriveTime: best });
    }
    return steps;
  }

  /**
   * Find stops within searchRadius of the passenger and compute the detour for each.
   * Every stop within maxConstraint is routed; beyond it, only the closest maxExtra are.
   */
  private async routeCandidates(
    start: Coordinates,
    end: Coordinates,
    passengerHome: Coordinates,
    maxConstraint: number,
    searchRadius: number,
    maxExtra: number,
  ): Promise<{ routed: CandidatePoint[]; coveredRadius: number }> {
    // Step 1: Search for transit stations within walking distance of passenger home
    const transitTypes = ["bus_station", "transit_station"];

    const rawCandidates = await this.googleMapsService.searchNearLocation(
      passengerHome,
      transitTypes,
      searchRadius,
    );

    if (rawCandidates.length === 0) {
      return { routed: [], coveredRadius: searchRadius };
    }

    // Step 2: Validate walking distance from meeting point (D) to passenger home (B)
    const withLegs = await Promise.all(
      rawCandidates.map(async (raw) => ({
        raw,
        passengerLeg: await this.strategy.validate(
          raw.location,
          passengerHome,
          searchRadius,
        ),
      })),
    );
    const valid = withLegs
      .filter((w) => w.passengerLeg !== null)
      .sort((a, b) => a.passengerLeg!.distance - b.passengerLeg!.distance);
    const inLimit = valid.filter((w) => w.passengerLeg!.distance <= maxConstraint);
    const allExtra = valid.filter((w) => w.passengerLeg!.distance > maxConstraint);
    const extra = allExtra.slice(0, maxExtra);
    // When the cap cuts stops off, results are only complete up to the first stop left out
    const coveredRadius =
      allExtra.length > extra.length
        ? allExtra[extra.length].passengerLeg!.distance - 1
        : searchRadius;

    // Step 3: Compute detour route: Start (A) → Meeting Point (D) → Destination (C)
    const routed = await Promise.all(
      [...inLimit, ...extra].map(async ({ raw, passengerLeg }) => {
        const detourRoute = await this.googleMapsService.computeDetourRoute(
          start,
          raw.location,
          end,
        );

        const candidate: CandidatePoint = {
          id: raw.id,
          coordinates: raw.location,
          leg1: detourRoute.leg1,
          leg2: detourRoute.leg2,
          passengerLeg: passengerLeg!,
          totalDetour: detourRoute.leg1.duration + detourRoute.leg2.duration,
          placeId: raw.id,
          name: raw.name,
        };
        return candidate;
      }),
    );
    return { routed, coveredRadius };
  }
}
