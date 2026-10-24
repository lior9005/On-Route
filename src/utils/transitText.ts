import { CandidatePoint, TripDirection } from '../models';
import { secondsToMinutes } from './distance';

/**
 * Local clock time "HH:MM" for an ISO timestamp (no Intl, works on Hermes)
 */
export function formatClock(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Name for the meeting point that matches the chosen option.
 * Walk mode has no drop-off / pick-up choice, so it stays generic.
 */
export function meetingPointTerm(direction?: TripDirection): string {
  if (direction === 'DROP_OFF') return 'Drop-off Location';
  if (direction === 'PICK_UP') return 'Pick-up Location';
  return 'Drop/Pick Location';
}

export interface BusTripText {
  title: string; // e.g. "🚌 Passenger Bus · 37 min trip (dropped off 15:56 → at destination 16:33)"
  lines: string[];
}

/**
 * The hitchhiker's bus trip in the order things happen, or null for walking
 * candidates. Drop-off waiting happens before the bus; pick-up waiting
 * (for the driver) happens after it.
 */
export function describeBusTrip(candidate: CandidatePoint): BusTripText | null {
  const transit = candidate.passengerLeg.transit;
  if (candidate.passengerLeg.mode !== 'TRANSIT' || !transit) return null;

  const direction: TripDirection =
    candidate.direction ??
    (candidate.meetTime && Date.parse(transit.departureTime) >= Date.parse(candidate.meetTime)
      ? 'DROP_OFF'
      : 'PICK_UP');
  const tripMinutes = secondsToMinutes(candidate.passengerLeg.duration);
  const waitMinutes = secondsToMinutes(transit.waitSeconds);

  // Trip span: drop-off starts at the meeting, pick-up ends at it
  let span = '';
  if (candidate.meetTime) {
    const meet = Date.parse(candidate.meetTime);
    const other = new Date(
      meet + (direction === 'DROP_OFF' ? 1 : -1) * candidate.passengerLeg.duration * 1000,
    ).toISOString();
    span =
      direction === 'DROP_OFF'
        ? ` (dropped off ${formatClock(candidate.meetTime)} → at destination ${formatClock(other)})`
        : ` (leaves home ${formatClock(other)} → meets driver ${formatClock(candidate.meetTime)})`;
  }

  const line = transit.headsign ? `Line ${transit.lineName} → ${transit.headsign}` : `Line ${transit.lineName}`;
  const stops = transit.stopCount ? ` · ${transit.stopCount} stops` : '';
  const walk = transit.walkMeters > 0 ? ` · walks ${transit.walkMeters} m in total` : '';
  const busLines = [
    `${line} · leaves ${formatClock(transit.departureTime)} from ${transit.departureStop}${stops}`,
    `Gets off ${formatClock(transit.arrivalTime)} at ${transit.arrivalStop}${walk}`,
  ];

  const lines =
    direction === 'DROP_OFF'
      ? [...(waitMinutes > 0 ? [`⏳ Waits ${waitMinutes} min at the stop`] : []), ...busLines]
      : [...busLines, ...(waitMinutes > 0 ? [`⏳ Waits ${waitMinutes} min for the driver`] : [])];

  return { title: `🚌 Passenger Bus · ${tripMinutes} min trip${span}`, lines };
}
