import { IDropOffStrategy } from './IDropOffStrategy';
import { Coordinates, PassengerLeg } from '../models';

/**
 * Placeholder for future transit validation
 * Will use Google Routes API with travelMode=TRANSIT
 */
export class TransitStrategy implements IDropOffStrategy {
  async validate(
    dropoffPoint: Coordinates,
    passengerHome: Coordinates,
    maxTransitMinutes: number
  ): Promise<PassengerLeg | null> {
    // TODO: Implement using Google Routes API
    // 1. Call computeRoutes from dropoffPoint → passengerHome with travelMode=TRANSIT
    // 2. Parse routes[0].legs[0].duration (e.g. "123s")
    // 3. Check if duration <= maxTransitMinutes
    // 4. Return PassengerLeg with mode: 'TRANSIT' and actual duration
    // 5. Handle no-transit-available gracefully (return null)
    
    throw new Error('TransitStrategy not yet implemented');
  }
}
