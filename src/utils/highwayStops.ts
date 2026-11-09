import { Coordinates } from "../models";
import { distanceToPolyline } from "./distance";
import { CONFIG } from "../constants/config";

/**
 * Stops inside the Ayalon highway (e.g. "קניון עזריאלי/כביש 20"): a car may
 * not stop there, and the walk out of the highway is long. Used where no
 * road data is available (bus mode). Other road numbers are left alone:
 * junction stops on intercity roads ("צומת .../כביש 40") are usable.
 */
const AYALON_STOP_NAME = /כביש\s*20(?!\d)|נתיבי\s*איילון|Ayalon\s*(Hwy|Highway)/i;

export function isAyalonStopName(name?: string): boolean {
  return !!name && AYALON_STOP_NAME.test(name);
}

/**
 * True if a stop is on a motorway (within MOTORWAY_STOP_BUFFER_METERS of an
 * OSM road of a MOTORWAY_CLASSES class) or is named as an Ayalon stop
 */
export function isHighwayStop(
  stop: { location: Coordinates; name?: string },
  motorways: Coordinates[][] = [],
): boolean {
  if (isAyalonStopName(stop.name)) return true;
  return motorways.some(
    (road) => distanceToPolyline(stop.location, road) < CONFIG.MOTORWAY_STOP_BUFFER_METERS,
  );
}
