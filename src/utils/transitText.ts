import { CandidatePoint } from '../models';
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
 * Lines describing the hitchhiker's bus trip, or null for walking candidates.
 * e.g. ["Line 47 → Center", "Leaves 14:32 from Herzl · 6 stops",
 *       "Arrives 14:50 at Ben Gurion · waits 6 min at the stop · walks 300 m"]
 */
export function describeBusTrip(candidate: CandidatePoint): string[] | null {
  const transit = candidate.passengerLeg.transit;
  if (candidate.passengerLeg.mode !== 'TRANSIT' || !transit) return null;

  const line = transit.headsign ? `Line ${transit.lineName} → ${transit.headsign}` : `Line ${transit.lineName}`;
  const stops = transit.stopCount ? ` · ${transit.stopCount} stops` : '';
  // Drop-off: waiting for the bus after the drop-off; pick-up: waiting for the driver
  const waitText =
    candidate.meetTime && Date.parse(transit.departureTime) >= Date.parse(candidate.meetTime)
      ? `waits ${secondsToMinutes(transit.waitSeconds)} min for the bus`
      : `waits ${secondsToMinutes(transit.waitSeconds)} min for the driver`;
  const walkText = transit.walkMeters > 0 ? ` · walks ${transit.walkMeters} m` : '';

  return [
    line,
    `Leaves ${formatClock(transit.departureTime)} from ${transit.departureStop}${stops}`,
    `Arrives ${formatClock(transit.arrivalTime)} at ${transit.arrivalStop} · ${waitText}${walkText}`,
  ];
}
