import { Coordinates, PassengerLeg, TransitRejection, TripDirection } from '../models';
import { GoogleMapsService, RoutesApiTransitRoute } from '../services/GoogleMapsService';
import { CONFIG } from '../constants/config';

export interface TransitLimits {
  spareSeconds: number;
  maxTripSeconds: number;
  maxWalkMeters: number;
  departureBufferSeconds: number; // Pick-up: minimum time before the hitchhiker leaves
}

export const DEFAULT_TRANSIT_LIMITS: TransitLimits = {
  spareSeconds: CONFIG.TRANSIT_SPARE_MINUTES * 60,
  maxTripSeconds: CONFIG.TRANSIT_MAX_TRIP_MINUTES * 60,
  maxWalkMeters: CONFIG.TRANSIT_MAX_WALK_METERS,
  departureBufferSeconds: CONFIG.PICKUP_DEPARTURE_BUFFER_SECONDS,
};

export type TransitEvaluation =
  | { ok: true; leg: PassengerLeg }
  | { ok: false; reason: TransitRejection };

/**
 * Judge one Routes API transit route for a meeting at `meetTime`.
 *
 * DROP_OFF (meeting point → hitchhiker's place): after the drop-off the
 * hitchhiker walks to the bus, which must leave at least `spareSeconds` later.
 * Trip = drop-off → arrival home.
 *
 * PICK_UP (hitchhiker's place → meeting point): the hitchhiker must reach the
 * meeting point at least `spareSeconds` before the car and must not have to
 * leave home before now + departureBufferSeconds. Trip = leaving home → meeting.
 */
export function evaluateTransitRoute(
  route: RoutesApiTransitRoute,
  direction: TripDirection,
  meetTime: Date,
  now: Date,
  limits: TransitLimits = DEFAULT_TRANSIT_LIMITS,
): TransitEvaluation {
  const steps = route.legs?.flatMap((leg) => leg.steps ?? []) ?? [];
  const busIndexes = steps
    .map((step, i) => (step.travelMode === 'TRANSIT' ? i : -1))
    .filter((i) => i >= 0);

  // Exactly one bus: no transfers (and walking-only routes are not bus trips)
  if (busIndexes.length !== 1) return { ok: false, reason: 'NO_DIRECT_BUS' };
  const busIndex = busIndexes[0];
  const bus = steps[busIndex].transitDetails;
  const busDeparture = parseTime(bus?.stopDetails?.departureTime);
  const busArrival = parseTime(bus?.stopDetails?.arrivalTime);
  if (!bus || busDeparture === null || busArrival === null) {
    return { ok: false, reason: 'NO_DIRECT_BUS' };
  }

  const walkSteps = steps.filter((step) => step.travelMode === 'WALK');
  const walkMeters = walkSteps.reduce((sum, step) => sum + (step.distanceMeters ?? 0), 0);
  if (walkMeters > limits.maxWalkMeters) return { ok: false, reason: 'TOO_MUCH_WALKING' };

  const walkSeconds = (from: number, to: number) =>
    steps
      .slice(from, to)
      .filter((step) => step.travelMode === 'WALK')
      .reduce((sum, step) => sum + parseSeconds(step.staticDuration), 0);
  const walkBefore = walkSeconds(0, busIndex);
  const walkAfter = walkSeconds(busIndex + 1, steps.length);

  const meet = meetTime.getTime() / 1000;
  let tripSeconds: number;
  let waitSeconds: number;

  if (direction === 'DROP_OFF') {
    // Ready at the bus stop after walking there, plus the spare time
    const earliestBoarding = meet + walkBefore + limits.spareSeconds;
    if (busDeparture < earliestBoarding) return { ok: false, reason: 'NO_SPARE_TIME' };
    waitSeconds = busDeparture - (meet + walkBefore);
    tripSeconds = busArrival + walkAfter - meet;
  } else {
    const atMeetingPoint = busArrival + walkAfter;
    if (atMeetingPoint > meet - limits.spareSeconds) return { ok: false, reason: 'NO_SPARE_TIME' };
    const leaveHome = busDeparture - walkBefore;
    if (leaveHome < now.getTime() / 1000 + limits.departureBufferSeconds) {
      return { ok: false, reason: 'CANT_MAKE_IT' };
    }
    waitSeconds = meet - atMeetingPoint;
    tripSeconds = meet - leaveHome;
  }

  if (tripSeconds > limits.maxTripSeconds) return { ok: false, reason: 'TOO_LONG' };

  const line = bus.transitLine;
  return {
    ok: true,
    leg: {
      mode: 'TRANSIT',
      duration: Math.round(tripSeconds),
      distance: steps.reduce((sum, step) => sum + (step.distanceMeters ?? 0), 0),
      transit: {
        lineName: line?.nameShort || line?.name || 'Bus',
        headsign: bus.headsign,
        departureStop: bus.stopDetails?.departureStop?.name ?? '',
        arrivalStop: bus.stopDetails?.arrivalStop?.name ?? '',
        departureTime: new Date(busDeparture * 1000).toISOString(),
        arrivalTime: new Date(busArrival * 1000).toISOString(),
        stopCount: bus.stopCount,
        waitSeconds: Math.round(waitSeconds),
        walkMeters: Math.round(walkMeters),
        segments: steps
          .filter((step) => step.polyline?.encodedPolyline)
          .map((step) => ({
            kind: step.travelMode === 'TRANSIT' ? ('BUS' as const) : ('WALK' as const),
            polyline: step.polyline!.encodedPolyline,
          })),
      },
    },
  };
}

/**
 * Best acceptable alternative (shortest trip); otherwise the most telling
 * rejection reason across the alternatives.
 */
export function pickTransitOption(
  routes: RoutesApiTransitRoute[],
  direction: TripDirection,
  meetTime: Date,
  now: Date,
  limits: TransitLimits = DEFAULT_TRANSIT_LIMITS,
): TransitEvaluation {
  if (routes.length === 0) return { ok: false, reason: 'NO_DIRECT_BUS' };

  const evaluations = routes.map((r) => evaluateTransitRoute(r, direction, meetTime, now, limits));
  const accepted = evaluations
    .filter((e): e is { ok: true; leg: PassengerLeg } => e.ok)
    .sort((a, b) => a.leg.duration - b.leg.duration);
  if (accepted.length > 0) return accepted[0];

  // Report the rejection closest to working (e.g. "too long" over "no direct bus")
  const order: TransitRejection[] = ['TOO_LONG', 'NO_SPARE_TIME', 'CANT_MAKE_IT', 'TOO_MUCH_WALKING', 'NO_DIRECT_BUS'];
  const reasons = evaluations.map((e) => (e.ok ? 'NO_DIRECT_BUS' : e.reason));
  return { ok: false, reason: order.find((r) => reasons.includes(r)) ?? 'NO_DIRECT_BUS' };
}

/**
 * Finds the hitchhiker's bus between a meeting point and their own place,
 * timed around when the driver reaches the meeting point.
 */
export class TransitStrategy {
  constructor(
    private googleMapsService: GoogleMapsService,
    private limits: TransitLimits = DEFAULT_TRANSIT_LIMITS,
  ) {}

  async evaluate(
    meetingPoint: Coordinates,
    passengerHome: Coordinates,
    direction: TripDirection,
    meetTime: Date,
    now: Date = new Date(),
  ): Promise<TransitEvaluation> {
    const spareMs = this.limits.spareSeconds * 1000;
    const routes =
      direction === 'DROP_OFF'
        ? await this.googleMapsService.computeTransitRoutes(meetingPoint, passengerHome, {
            departureTime: new Date(meetTime.getTime() + spareMs),
          })
        : await this.googleMapsService.computeTransitRoutes(passengerHome, meetingPoint, {
            arrivalTime: new Date(meetTime.getTime() - spareMs),
          });

    return pickTransitOption(routes, direction, meetTime, now, this.limits);
  }
}

function parseTime(iso?: string): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms / 1000;
}

function parseSeconds(duration?: string): number {
  return duration ? parseFloat(duration) : 0;
}
