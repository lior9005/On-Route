import { IDropOffStrategy } from './IDropOffStrategy';
import { Coordinates, PassengerLeg } from '../models';
import { haversineDistance } from '../utils/distance';

export class WalkingStrategy implements IDropOffStrategy {
  async validate(
    dropoffPoint: Coordinates,
    passengerHome: Coordinates,
    maxWalkingMeters: number
  ): Promise<PassengerLeg | null> {
    const distance = haversineDistance(dropoffPoint, passengerHome);
    
    if (distance <= maxWalkingMeters) {
      // Estimate walking time: average walking speed is 1.4 m/s (5 km/h)
      const walkingSpeed = 1.4; // meters per second
      const duration = Math.round(distance / walkingSpeed);
      
      return {
        distance,
        duration,
        mode: 'WALK',
      };
    }
    
    return null; // Distance exceeds constraint
  }
}
