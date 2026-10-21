import { Coordinates } from '../models';

// Application Security Requirement: Boundary validation for coordinate inputs
export function isValidCoordinate(coord: Coordinates): boolean {
  return (
    typeof coord.lat === 'number' &&
    typeof coord.lon === 'number' &&
    coord.lat >= -90 &&
    coord.lat <= 90 &&
    coord.lon >= -180 &&
    coord.lon <= 180
  );
}

export function validateCoordinates(coords: Coordinates[]): boolean {
  return coords.every(isValidCoordinate);
}
