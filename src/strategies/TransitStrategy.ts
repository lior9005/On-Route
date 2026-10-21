import { IDropOffStrategy } from './IDropOffStrategy';
import { Coordinates, PassengerLeg } from '../models';

/**
 * Placeholder for future transit validation
 * Will use Google Directions API with mode=TRANSIT
 */
export class TransitStrategy implements IDropOffStrategy {
  async validate(
    dropoffPoint: Coordinates,
    passengerHome: Coordinates,
    maxTransitMinutes: number
  ): Promise<PassengerLeg | null> {
    // TODO: Implement using Google Directions API
    // 1. Call Directions API from dropoffPoint → passengerHome with mode=TRANSIT
    // 2. Parse routes[0].legs[0].duration.value
    // 3. Check if duration <= maxTransitMinutes
    // 4. Return PassengerLeg with mode: 'TRANSIT' and actual duration
    // 5. Handle no-transit-available gracefully (return null)
    
    throw new Error('TransitStrategy not yet implemented');
  }
}
