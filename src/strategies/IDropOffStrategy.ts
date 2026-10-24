import { Coordinates, PassengerLeg } from '../models';

export interface IDropOffStrategy {
  /**
   * Validates which drop-off points satisfy the passenger's travel constraint
   * @param dropoffPoints - The candidate drop-off locations (D)
   * @param passengerHome - The passenger's destination (B)
   * @param maxConstraint - Maximum allowed constraint (meters for walking, minutes for transit)
   * @returns For each point (same order): PassengerLeg if valid, null if constraint not met
   */
  validate(
    dropoffPoints: Coordinates[],
    passengerHome: Coordinates,
    maxConstraint: number
  ): Promise<(PassengerLeg | null)[]>;
}
