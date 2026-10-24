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
  | { ok: true; leg: PassengerLeg; meetTime: Date; driverWaitSeconds: number }
  | { ok: false; reason: TransitRejection };

/** A transit route reduced to what the timing rules need (all times in epoch seconds) */
interface BusTrip {
  busDeparture: number;
  busArrival: number;
  walkBefore: number; // Seconds walking before boarding
  walkAfter: number; // Seconds walking after getting off
  walkMeters: number;
  toLeg: (tripSeconds: number, waitSeconds: number) => PassengerLeg;
}

/**
 * Single-bus trip (no transfers) within the walking limit, or why not
 */
function parseBusTrip(
  route: RoutesApiTransitRoute,
  limits: TransitLimits,
): BusTrip | { reason: TransitRejection } {
  const steps = route.legs?.flatMap((leg) => leg.steps ?? []) ?? [];
  const busIndexes = steps
    .map((step, i) => (step.travelMode === 'TRANSIT' ? i : -1))
    .filter((i) => i >= 0);

  // Exactly one bus: no transfers (and walking-only routes are not bus trips)
  if (busIndexes.length !== 1) return { reason: 'NO_DIRECT_BUS' };
  const busIndex = busIndexes[0];
  const bus = steps[busIndex].transitDetails;
  const busDeparture = parseTime(bus?.stopDetails?.departureTime);
  const busArrival = parseTime(bus?.stopDetails?.arrivalTime);
  if (!bus || busDeparture === null || busArrival === null) {
    return { reason: 'NO_DIRECT_BUS' };
  }

  const walkMeters = steps
    .filter((step) => step.travelMode === 'WALK')
    .reduce((sum, step) => sum + (step.distanceMeters ?? 0), 0);
  if (walkMeters > limits.maxWalkMeters) return { reason: 'TOO_MUCH_WALKING' };

  const walkSeconds = (from: number, to: number) =>
    steps
      .slice(from, to)
      .filter((step) => step.travelMode === 'WALK')
      .reduce((sum, step) => sum + parseSeconds(step.staticDuration), 0);

  const line = bus.transitLine;
  return {
    busDeparture,
    busArrival,
    walkBefore: walkSeconds(0, busIndex),
    walkAfter: walkSeconds(busIndex + 1, steps.length),
    walkMeters,
    toLeg: (tripSeconds, waitSeconds) => ({
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
    }),
  };
}

/**
 * Judge one Routes API transit route for a meeting at `meetTime` (the
 * driver's arrival; the driver does not wait).
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
  const trip = parseBusTrip(route, limits);
  if ('reason' in trip) return { ok: false, reason: trip.reason };

  const meet = meetTime.getTime() / 1000;
  let tripSeconds: number;
  let waitSeconds: number;

  if (direction === 'DROP_OFF') {
    // Ready at the bus stop after walking there, plus the spare time
    const earliestBoarding = meet + trip.walkBefore + limits.spareSeconds;
    if (trip.busDeparture < earliestBoarding) return { ok: false, reason: 'NO_SPARE_TIME' };
    waitSeconds = trip.busDeparture - (meet + trip.walkBefore);
    tripSeconds = trip.busArrival + trip.walkAfter - meet;
  } else {
    const atMeetingPoint = trip.busArrival + trip.walkAfter;
    if (atMeetingPoint > meet - limits.spareSeconds) return { ok: false, reason: 'NO_SPARE_TIME' };
    const leaveHome = trip.busDeparture - trip.walkBefore;
    if (leaveHome < now.getTime() / 1000 + limits.departureBufferSeconds) {
      return { ok: false, reason: 'CANT_MAKE_IT' };
    }
    waitSeconds = meet - atMeetingPoint;
    tripSeconds = meet - leaveHome;
  }

  if (tripSeconds > limits.maxTripSeconds) return { ok: false, reason: 'TOO_LONG' };
  return { ok: true, leg: trip.toLeg(tripSeconds, waitSeconds), meetTime, driverWaitSeconds: 0 };
}

/**
 * Pick-up where the driver may wait: the hitchhiker takes this bus, and the
 * meeting is when the driver arrives or when the hitchhiker is there plus the
 * spare time, whichever is later. The driver's wait is returned so the caller
 * can count it against the extra-time limit.
 */
export function evaluatePickupWithDriverWait(
  route: RoutesApiTransitRoute,
  driverArrival: Date,
  now: Date,
  limits: TransitLimits = DEFAULT_TRANSIT_LIMITS,
): TransitEvaluation {
  const trip = parseBusTrip(route, limits);
  if ('reason' in trip) return { ok: false, reason: trip.reason };

  const leaveHome = trip.busDeparture - trip.walkBefore;
  if (leaveHome < now.getTime() / 1000 + limits.departureBufferSeconds) {
    return { ok: false, reason: 'CANT_MAKE_IT' };
  }

  const atMeetingPoint = trip.busArrival + trip.walkAfter;
  const driver = driverArrival.getTime() / 1000;
  const meet = Math.max(driver, atMeetingPoint + limits.spareSeconds);
  const tripSeconds = meet - leaveHome;
  if (tripSeconds > limits.maxTripSeconds) return { ok: false, reason: 'TOO_LONG' };

  return {
    ok: true,
    leg: trip.toLeg(tripSeconds, meet - atMeetingPoint),
    meetTime: new Date(meet * 1000),
    driverWaitSeconds: Math.round(meet - driver),
  };
}

const REJECTION_ORDER: TransitRejection[] = [
  'TOO_LONG',
  'NO_SPARE_TIME',
  'CANT_MAKE_IT',
  'TOO_MUCH_WALKING',
  'NO_DIRECT_BUS',
];

/**
 * Best acceptable evaluation (least driver wait, then shortest trip);
 * otherwise the rejection closest to working.
 */
function bestEvaluation(evaluations: TransitEvaluation[]): TransitEvaluation {
  const accepted = evaluations
    .filter((e): e is Extract<TransitEvaluation, { ok: true }> => e.ok)
    .sort(
      (a, b) =>
        a.driverWaitSeconds + a.leg.duration - (b.driverWaitSeconds + b.leg.duration),
    );
  if (accepted.length > 0) return accepted[0];

  const reasons = evaluations.map((e) => (e.ok ? 'NO_DIRECT_BUS' : e.reason));
  return { ok: false, reason: REJECTION_ORDER.find((r) => reasons.includes(r)) ?? 'NO_DIRECT_BUS' };
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
  return bestEvaluation(routes.map((r) => evaluateTransitRoute(r, direction, meetTime, now, limits)));
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

  /**
   * @param driverArrival When the driver reaches the meeting point
   * @param maxDriverWaitSeconds Pick-up only: how long the driver may wait if
   *   no bus gets the hitchhiker there in time (0 = never wait)
   */
  async evaluate(
    meetingPoint: Coordinates,
    passengerHome: Coordinates,
    direction: TripDirection,
    driverArrival: Date,
    maxDriverWaitSeconds = 0,
    now: Date = new Date(),
  ): Promise<TransitEvaluation> {
    const spareMs = this.limits.spareSeconds * 1000;

    if (direction === 'DROP_OFF') {
      const routes = await this.googleMapsService.computeTransitRoutes(meetingPoint, passengerHome, {
        departureTime: new Date(driverArrival.getTime() + spareMs),
      });
      return pickTransitOption(routes, direction, driverArrival, now, this.limits);
    }

    // Pick-up: first a bus that gets the hitchhiker there before the driver
    const onTime = pickTransitOption(
      await this.googleMapsService.computeTransitRoutes(passengerHome, meetingPoint, {
        arrivalTime: new Date(driverArrival.getTime() - spareMs),
      }),
      direction,
      driverArrival,
      now,
      this.limits,
    );
    if (onTime.ok || maxDriverWaitSeconds <= 0) return onTime;
    if (onTime.reason !== 'CANT_MAKE_IT' && onTime.reason !== 'NO_SPARE_TIME') return onTime;

    // Too soon for the hitchhiker: take the earliest bus they can catch and
    // let the driver wait for them (within the allowed wait)
    const earliestDeparture = new Date(now.getTime() + this.limits.departureBufferSeconds * 1000);
    const routes = await this.googleMapsService.computeTransitRoutes(passengerHome, meetingPoint, {
      departureTime: earliestDeparture,
    });
    if (routes.length === 0) return onTime;

    const withWait = bestEvaluation(
      routes.map((r) => evaluatePickupWithDriverWait(r, driverArrival, now, this.limits)),
    );
    if (withWait.ok && withWait.driverWaitSeconds > maxDriverWaitSeconds) {
      return { ok: false, reason: 'DRIVER_WAIT_TOO_LONG' };
    }
    return withWait.ok ? withWait : onTime;
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
