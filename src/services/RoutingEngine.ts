import { GoogleMapsService } from "./GoogleMapsService";
import { OsmService } from "./OsmService";
import { IDropOffStrategy } from "../strategies/IDropOffStrategy";
import { TransitStrategy } from "../strategies/TransitStrategy";
import {
  Coordinates,
  CandidatePoint,
  RawCandidate,
  SearchInfo,
  TransitRejection,
  TravelMode,
  TripDirection,
  WalkingTradeoffStep,
} from "../models";
import { CONFIG } from "../constants/config";
import { haversineDistance } from "../utils/distance";
import { decodePolyline } from "../utils/polylineDecoder";
import {
  buildStreetCandidates,
  closestRouteCandidate,
  estimateDetour,
  preselectCandidates,
} from "../utils/streetCandidates";

export interface SearchParams {
  start: Coordinates;
  end: Coordinates;
  passengerHome: Coordinates;
  mode: TravelMode;
  maxWalkingDistance: number; // Walk mode (meters)
  direction: TripDirection; // Bus mode
  maxDetourMinutes: number; // Bus mode: max extra driving (+ waiting) for the driver
  departureTime?: Date | null; // Planned ride; null/undefined = leave now
}

export class RoutingEngine {
  /** Details of the most recent optimize() call */
  lastSearchInfo: SearchInfo | null = null;
  /** Walk mode: best driving time at each walking-limit step of the last search */
  lastTradeoff: WalkingTradeoffStep[] = [];
  /** Walk mode: the walking limit the returned candidates were picked for */
  lastWalkingLimit: number | null = null;
  /** Walk mode: the driver's direct A→C time (seconds), when it could be fetched */
  lastDirectDriveTime: number | null = null;

  constructor(
    private googleMapsService: GoogleMapsService,
    private osmService: OsmService,
    private strategy: IDropOffStrategy,
    private transitStrategy?: TransitStrategy,
  ) {}

  /**
   * Find the best meeting points for the chosen travel mode
   * @returns Sorted array of valid candidate points (best first)
   */
  async optimize(params: SearchParams): Promise<CandidatePoint[]> {
    if (params.mode === "BUS") {
      return this.optimizeTransit(params);
    }
    return this.optimizeWalking(
      params.start,
      params.end,
      params.passengerHome,
      params.maxWalkingDistance,
      params.departureTime,
    );
  }

  /**
   * Walk mode: meeting points within walking distance of the passenger
   * @returns Sorted array of valid candidate points (best first)
   */
  async optimizeWalking(
    start: Coordinates,
    end: Coordinates,
    passengerHome: Coordinates,
    maxConstraint: number,
    departureTime?: Date | null,
  ): Promise<CandidatePoint[]> {
    this.lastTradeoff = [];
    this.lastWalkingLimit = null;
    this.lastDirectDriveTime = null;

    // Step 1: In parallel - transit stops near the passenger, small streets
    // near the passenger (OpenStreetMap) and the driver's normal route
    const transitTypes = ["bus_station", "transit_station"];

    const [stopsResult, streetsResult, baselineResult] =
      await Promise.allSettled([
        this.googleMapsService.searchNearLocation(
          passengerHome,
          transitTypes,
          maxConstraint,
        ),
        this.osmService.fetchStreetNetwork(passengerHome, maxConstraint),
        this.googleMapsService.fetchBaselineRoute(start, end, departureTime),
      ]);

    if (
      stopsResult.status === "rejected" &&
      streetsResult.status === "rejected"
    ) {
      throw new Error(
        `${errorText(stopsResult.reason)}; ${errorText(streetsResult.reason)}`,
      );
    }
    if (stopsResult.status === "rejected") {
      console.warn("Transit stop search failed:", stopsResult.reason);
    }
    if (streetsResult.status === "rejected") {
      console.warn("Street search failed:", streetsResult.reason);
    }

    const baseline =
      baselineResult.status === "fulfilled" ? baselineResult.value : null;
    this.lastDirectDriveTime = baseline ? baseline.duration : null;
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

    const streetCandidates: RawCandidate[] = [];
    if (streetsResult.status === "fulfilled") {
      const network = streetsResult.value;
      const closest = closestRouteCandidate(
        network,
        passengerHome,
        maxConstraint,
        driverRoute,
      );
      if (closest) streetCandidates.push(closest);
      streetCandidates.push(
        ...buildStreetCandidates(
          network,
          passengerHome,
          maxConstraint,
          driverRoute,
        ),
      );
    }

    // Step 3: Pre-filter without API calls - likely within walking range
    // (straight line, with room for the real path being longer), merged,
    // best estimated detours first, capped for cost. Short walks get their own
    // share, so the trade-off table isn't only far points with small detours.
    const maxStraightLine = maxConstraint * CONFIG.WALK_PREFILTER_RATIO;
    const shortStraightLine =
      CONFIG.TRADEOFF_SHORT_WALK_METERS * CONFIG.WALK_PREFILTER_RATIO;
    const straightLine = (c: RawCandidate) =>
      haversineDistance(c.location, passengerHome);
    const inRange = [...stopCandidates, ...streetCandidates].filter(
      (c) => straightLine(c) <= maxStraightLine,
    );
    const shortWalk =
      maxConstraint > CONFIG.TRADEOFF_SHORT_WALK_METERS
        ? preselectCandidates(
            inRange.filter((c) => straightLine(c) <= shortStraightLine),
            start,
            end,
            CONFIG.CANDIDATE_MERGE_RADIUS_METERS,
            CONFIG.TRADEOFF_SHORT_WALK_CANDIDATES,
          )
        : [];
    const preselected = [
      ...shortWalk,
      ...preselectCandidates(
        // Skip points the short-walk share already covers
        inRange.filter(
          (c) =>
            !shortWalk.some(
              (s) =>
                haversineDistance(s.location, c.location) <
                CONFIG.CANDIDATE_MERGE_RADIUS_METERS,
            ),
        ),
        start,
        end,
        CONFIG.CANDIDATE_MERGE_RADIUS_METERS,
        CONFIG.MAX_CANDIDATES_TO_EVALUATE,
      ),
    ];

    const info: SearchInfo = {
      busStops: stopCandidates.length,
      busStopError:
        stopsResult.status === "rejected" ? errorText(stopsResult.reason) : undefined,
      streetPoints: streetCandidates.length,
      streetError:
        streetsResult.status === "rejected" ? errorText(streetsResult.reason) : undefined,
      evaluated: preselected.length,
      tooFarToWalk: 0,
      movedToOtherRoad: 0,
      routeErrors: 0,
    };
    this.lastSearchInfo = info;

    if (preselected.length === 0) {
      return [];
    }

    // Step 4: Validate passenger leg (real walking distance, one batched request)
    const passengerLegs = await this.strategy.validate(
      preselected.map((c) => c.location),
      passengerHome,
      maxConstraint,
    );

    // Step 5: For each valid point, calculate detour route without traffic
    // (cheaper rate); the finalists get traffic in step 7
    // Start (A) → Meeting Point (D) → Destination (C)
    const detourResults = await Promise.allSettled(
      preselected.map(async (rawCandidate, i) => {
        const passengerLeg = passengerLegs[i];
        if (!passengerLeg) {
          info.tooFarToWalk++;
          return null;
        }

        const detourRoute = await this.googleMapsService.computeDetourRoute(
          start,
          rawCandidate.location,
          end,
          departureTime,
          false,
        );

        // Google stops the car on the nearest road; if that is far from the
        // street point it may be a bigger road, so drop it
        if (
          rawCandidate.kind === "STREET" &&
          detourRoute.snappedDropoff &&
          haversineDistance(detourRoute.snappedDropoff, rawCandidate.location) >
            CONFIG.MAX_SNAP_DISTANCE_METERS
        ) {
          info.movedToOtherRoad++;
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
    info.routeErrors = detourResults.filter((r) => r.status === "rejected").length;

    const validCandidates = detourResults
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter((c): c is CandidatePoint => c !== null);

    if (validCandidates.length === 0) {
      const failure = detourResults.find((r) => r.status === "rejected");
      if (failure) {
        throw (failure as PromiseRejectedResult).reason;
      }
    }

    // Step 7: Re-route only the finalists with traffic; everything below
    // compares traffic times only (keep the estimates if none come back)
    const finalists = pickTrafficFinalists(validCandidates, maxConstraint);
    const trafficResults = await Promise.allSettled(
      finalists.map(async (c): Promise<CandidatePoint> => {
        const detourRoute = await this.googleMapsService.computeDetourRoute(
          start,
          c.coordinates,
          end,
          departureTime,
        );
        const totalDetour =
          detourRoute.leg1.duration + detourRoute.leg2.duration;
        return {
          ...c,
          leg1: detourRoute.leg1,
          leg2: detourRoute.leg2,
          totalDetour,
          extraDriveTime: baseline
            ? Math.max(0, totalDetour - baseline.duration)
            : undefined,
        };
      }),
    );
    const withTraffic = trafficResults
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter((c): c is CandidatePoint => c !== null);
    const routed = withTraffic.length > 0 ? withTraffic : validCandidates;

    // Step 8: Walk/drive trade-off over everything routed; start on the
    // shortest walk that is about as fast as walking the whole way
    this.lastTradeoff = buildWalkingTradeoff(routed, maxConstraint);
    this.lastWalkingLimit = suggestWalkingLimit(this.lastTradeoff) ?? maxConstraint;

    // Step 9: Rank, merge and keep the top N within that walking limit
    return selectWalkingCandidates(routed, this.lastWalkingLimit);
  }

  /**
   * Bus mode: bus stops near the driver's route where the hitchhiker has a
   * direct bus to/from their place, timed around the driver's arrival.
   * Ranked by driver's extra time + hitchhiker's trip time.
   */
  async optimizeTransit(params: SearchParams): Promise<CandidatePoint[]> {
    const { start, end, passengerHome, direction } = params;
    if (!this.transitStrategy) {
      throw new Error("Bus option is not available");
    }
    const maxDetourSeconds = params.maxDetourMinutes * 60;
    const departureTime = params.departureTime ?? null;
    const leaveAt = departureTime ? departureTime.getTime() : Date.now();

    // Step 1: The driver's normal route (needed to search along it)
    const baseline = await this.googleMapsService.fetchBaselineRoute(
      start,
      end,
      departureTime,
    );

    // Step 2: Bus stops along that route
    const info: SearchInfo = {
      busStops: 0,
      streetPoints: 0,
      evaluated: 0,
      tooFarToWalk: 0,
      movedToOtherRoad: 0,
      routeErrors: 0,
      transitRejections: {},
    };
    this.lastSearchInfo = info;
    const reject = (reason: TransitRejection) => {
      info.transitRejections![reason] = (info.transitRejections![reason] ?? 0) + 1;
    };

    let stops: RawCandidate[] = [];
    try {
      stops = (
        await this.googleMapsService.searchBusStopsAlongRoute(
          baseline.polyline,
          CONFIG.BUS_STOP_SEARCH_PAGES,
        )
      ).map((place) => ({
        id: place.id,
        location: place.location,
        name: place.name,
        kind: "BUS_STOP" as const,
      }));
    } catch (err) {
      info.busStopError = errorText(err);
      throw err;
    }
    info.busStops = stops.length;

    // Step 3: Pre-select without API calls - estimated detour within budget,
    // best estimated driver + bus time first, capped for cost
    const estimatedDetourSeconds = (c: RawCandidate) =>
      estimateDetour(start, c.location, end) / CONFIG.DETOUR_ESTIMATE_SPEED_MPS;
    const estimatedBusSeconds = (c: RawCandidate) =>
      haversineDistance(c.location, passengerHome) / CONFIG.BUS_ESTIMATE_SPEED_MPS;
    const preselected = preselectCandidates(
      stops.filter(
        (c) =>
          estimatedDetourSeconds(c) <= maxDetourSeconds &&
          estimatedBusSeconds(c) <= CONFIG.TRANSIT_MAX_TRIP_MINUTES * 60,
      ),
      start,
      end,
      CONFIG.CANDIDATE_MERGE_RADIUS_METERS,
      CONFIG.MAX_CANDIDATES_TO_EVALUATE,
      (c) => estimatedDetourSeconds(c) + estimatedBusSeconds(c),
    );
    info.evaluated = preselected.length;

    // Steps 4-6: Driver detour (gives the meeting time), then the bus trip
    const results = await Promise.allSettled(
      preselected.map(async (stop) => {
        const detourRoute = await this.googleMapsService.computeDetourRoute(
          start,
          stop.location,
          end,
          departureTime,
        );
        const totalDetour =
          detourRoute.leg1.duration + detourRoute.leg2.duration;
        const extraDriveTime = Math.max(0, totalDetour - baseline.duration);
        if (extraDriveTime > maxDetourSeconds) {
          reject("OVER_DETOUR");
          return null;
        }

        const driverArrival = new Date(
          leaveAt + detourRoute.leg1.duration * 1000,
        );
        // Pick-up: the driver may wait for the hitchhiker, within what is
        // left of the extra-time budget
        const evaluation = await this.transitStrategy!.evaluate(
          stop.location,
          passengerHome,
          direction,
          driverArrival,
          maxDetourSeconds - extraDriveTime,
        );
        if (!evaluation.ok) {
          reject(evaluation.reason);
          return null;
        }

        const candidate: CandidatePoint = {
          id: stop.id,
          coordinates: stop.location,
          leg1: detourRoute.leg1,
          leg2: detourRoute.leg2,
          passengerLeg: evaluation.leg,
          totalDetour,
          placeId: stop.id,
          name: stop.name,
          kind: "BUS_STOP",
          extraDriveTime,
          driverWaitSeconds: evaluation.driverWaitSeconds,
          direction,
          meetTime: evaluation.meetTime.toISOString(),
          combinedTime:
            extraDriveTime + evaluation.driverWaitSeconds + evaluation.leg.duration,
        };
        return candidate;
      }),
    );

    info.routeErrors = results.filter((r) => r.status === "rejected").length;
    const valid = results
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter((c): c is CandidatePoint => c !== null);

    if (valid.length === 0) {
      const failure = results.find((r) => r.status === "rejected");
      if (failure) {
        throw (failure as PromiseRejectedResult).reason;
      }
    }

    // Step 7: Rank by combined time, merge nearby stops, top N
    const merged: CandidatePoint[] = [];
    for (const c of rankByCombinedTime(valid)) {
      const tooClose = merged.some(
        (m) =>
          haversineDistance(c.coordinates, m.coordinates) <
          CONFIG.CANDIDATE_MERGE_RADIUS_METERS,
      );
      if (!tooClose) merged.push(c);
    }
    return merged.slice(0, CONFIG.TOP_CANDIDATES_COUNT);
  }
}

/**
 * Walk mode: the candidates worth a traffic-aware route, judged on routes
 * without traffic - the best few within the suggested walking limit, plus the
 * best at each step of the trade-off table so every step keeps an answer.
 */
export function pickTrafficFinalists(
  routed: CandidatePoint[],
  maxWalk: number,
): CandidatePoint[] {
  const tradeoff = buildWalkingTradeoff(routed, maxWalk);
  const limit = suggestWalkingLimit(tradeoff) ?? maxWalk;
  const top = rankCandidates(
    routed.filter((c) => c.passengerLeg.distance <= limit),
    CONFIG.DRIVE_TIME_TIE_SECONDS,
  ).slice(0, CONFIG.TRAFFIC_FINALISTS_COUNT);
  const steps = tradeoff
    .map((s) => s.best)
    .filter((c): c is CandidatePoint => c !== null);
  return [...new Set([...top, ...steps])];
}

/**
 * Bus mode order: least driver extra time + hitchhiker trip time first;
 * ties go to the shorter hitchhiker trip.
 */
export function rankByCombinedTime(candidates: CandidatePoint[]): CandidatePoint[] {
  const combined = (c: CandidatePoint) =>
    c.combinedTime ?? (c.extraDriveTime ?? 0) + c.passengerLeg.duration;
  return [...candidates].sort(
    (a, b) =>
      combined(a) - combined(b) ||
      a.passengerLeg.duration - b.passengerLeg.duration,
  );
}

/**
 * Order candidates best first: repeatedly take, among the candidates whose
 * driving time is within `tieSeconds` of the fastest remaining one, the one
 * with the shortest passenger leg.
 */
export function rankCandidates(
  candidates: CandidatePoint[],
  tieSeconds: number,
): CandidatePoint[] {
  const remaining = [...candidates];
  const ranked: CandidatePoint[] = [];

  while (remaining.length > 0) {
    const fastest = Math.min(...remaining.map((c) => c.totalDetour));
    let bestIndex = -1;
    remaining.forEach((c, i) => {
      if (c.totalDetour > fastest + tieSeconds) return;
      const best = bestIndex >= 0 ? remaining[bestIndex] : null;
      if (
        !best ||
        c.passengerLeg.duration < best.passengerLeg.duration ||
        (c.passengerLeg.duration === best.passengerLeg.duration &&
          c.totalDetour < best.totalDetour)
      ) {
        bestIndex = i;
      }
    });
    ranked.push(remaining.splice(bestIndex, 1)[0]);
  }

  return ranked;
}

/**
 * Walk mode: the best candidates within maxWalk. Ranked by driving time;
 * near-equal driving times (within DRIVE_TIME_TIE_SECONDS) are decided by the
 * shorter passenger walk. Merged within CANDIDATE_MERGE_RADIUS_METERS and by
 * name (stops on both sides of a street share one; best per cluster), top
 * TOP_CANDIDATES_COUNT.
 */
export function selectWalkingCandidates(
  routed: CandidatePoint[],
  maxWalk: number,
): CandidatePoint[] {
  const ranked = rankCandidates(
    routed.filter((c) => c.passengerLeg.distance <= maxWalk),
    CONFIG.DRIVE_TIME_TIE_SECONDS,
  );

  const merged: CandidatePoint[] = [];
  const mergeRadius = CONFIG.CANDIDATE_MERGE_RADIUS_METERS;
  for (const c of ranked) {
    const duplicate = merged.some(
      (m) =>
        haversineDistance(c.coordinates, m.coordinates) < mergeRadius ||
        (c.name && m.kind === c.kind && m.name === c.name),
    );
    if (!duplicate) merged.push(c);
  }

  return merged.slice(0, CONFIG.TOP_CANDIDATES_COUNT);
}

/**
 * The shortest walking limit whose best driving time is within
 * DRIVE_TIME_TIE_SECONDS of the best with the full walk
 */
export function suggestWalkingLimit(
  tradeoff: WalkingTradeoffStep[],
): number | null {
  const times = tradeoff
    .map((s) => s.bestDriveTime)
    .filter((t): t is number => t !== null);
  if (times.length === 0) return null;
  const fastest = Math.min(...times);
  const step = tradeoff.find(
    (s) =>
      s.bestDriveTime !== null &&
      s.bestDriveTime <= fastest + CONFIG.DRIVE_TIME_TIE_SECONDS,
  );
  return step ? step.maxWalk : null;
}

/** Best driving time for each walking limit, in TRADEOFF_STEP_METERS steps up to maxRadius (always included) */
export function buildWalkingTradeoff(
  routed: CandidatePoint[],
  maxRadius: number,
): WalkingTradeoffStep[] {
  const step = CONFIG.TRADEOFF_STEP_METERS;
  const steps: WalkingTradeoffStep[] = [];
  const limits: number[] = [];
  for (let maxWalk = step; maxWalk < maxRadius; maxWalk += step) limits.push(maxWalk);
  limits.push(maxRadius);
  for (const maxWalk of limits) {
    let best: CandidatePoint | null = null;
    for (const c of routed) {
      if (c.passengerLeg.distance <= maxWalk && (!best || c.totalDetour < best.totalDetour)) {
        best = c;
      }
    }
    steps.push({ maxWalk, bestDriveTime: best?.totalDetour ?? null, best });
  }
  return steps;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function errorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

/**
 * One-line summary of a search, e.g. "Checked 4 bus stops and 38 street points"
 */
export function describeSearch(info: SearchInfo): string {
  if (info.transitRejections) {
    return describeTransitSearch(info);
  }

  const parts = [
    info.busStopError
      ? `Bus stop search failed (${info.busStopError})`
      : plural(info.busStops, "bus stop"),
    info.streetError
      ? `street search failed (${info.streetError})`
      : plural(info.streetPoints, "street point"),
  ];
  const dropped = [
    info.tooFarToWalk && `${info.tooFarToWalk} too far to walk`,
    info.movedToOtherRoad && `${info.movedToOtherRoad} on another road`,
    info.routeErrors && `${info.routeErrors} route errors`,
  ].filter(Boolean);

  return (
    `Found ${parts.join(", ")}; compared the best ${info.evaluated}` +
    (dropped.length ? ` (${dropped.join(", ")})` : "")
  );
}

const TRANSIT_REJECTION_TEXT: Record<TransitRejection, string> = {
  OVER_DETOUR: "too far for the driver",
  DRIVER_WAIT_TOO_LONG: "driver would wait too long",
  NO_DIRECT_BUS: "no direct bus",
  TOO_MUCH_WALKING: "too much walking",
  TOO_LONG: "bus trip too long",
  NO_SPARE_TIME: "no bus with spare time",
  CANT_MAKE_IT: "passenger can't make it in time",
};

/**
 * Bus mode summary, e.g. "Found 32 bus stops along the route; compared the best 15 (6 no direct bus)"
 */
function describeTransitSearch(info: SearchInfo): string {
  const dropped = (Object.keys(TRANSIT_REJECTION_TEXT) as TransitRejection[])
    .filter((reason) => info.transitRejections?.[reason])
    .map((reason) => `${info.transitRejections![reason]} ${TRANSIT_REJECTION_TEXT[reason]}`);
  if (info.routeErrors) dropped.push(`${info.routeErrors} route errors`);

  return (
    `Found ${plural(info.busStops, "bus stop")} along the route; compared the best ${info.evaluated}` +
    (dropped.length ? ` (${dropped.join(", ")})` : "")
  );
}
