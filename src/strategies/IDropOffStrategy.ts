import { Coordinates, PassengerLeg } from '../models';

export interface IDropOffStrategy {
  /**
   * Validates if a drop-off point satisfies the passenger's travel constraint
   * @param dropoffPoint - The candidate drop-off location (D)
   * @param passengerHome - The passenger's destination (B)
   * @param maxConstraint - Maximum allowed constraint (meters for walking, minutes for transit)
   * @returns PassengerLeg if valid, null if constraint not met
   */
  validate(
    dropoffPoint: Coordinates,
    passengerHome: Coordinates,
    maxConstraint: number
  ): Promise<PassengerLeg | null>;
}
