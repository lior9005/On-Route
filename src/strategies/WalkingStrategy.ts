import { IDropOffStrategy } from './IDropOffStrategy';
import { Coordinates, PassengerLeg, RouteLeg } from '../models';
import { GoogleMapsService } from '../services/GoogleMapsService';
import { haversineDistance } from '../utils/distance';

export class WalkingStrategy implements IDropOffStrategy {
  constructor(private googleMapsService: GoogleMapsService) {}

  async validate(
    dropoffPoints: Coordinates[],
    passengerHome: Coordinates,
    maxWalkingMeters: number
  ): Promise<(PassengerLeg | null)[]> {
    let legs: (RouteLeg | null)[];

    try {
      // Real walking distance along streets/paths (one Route Matrix request)
      legs = await this.googleMapsService.computeWalkingLegs(dropoffPoints, passengerHome);
    } catch (err) {
      console.warn('Walking distance lookup failed, using straight-line estimate:', err);
      legs = dropoffPoints.map((point) => this.estimateWalk(point, passengerHome));
    }

    return legs.map((leg) =>
      leg && leg.distance <= maxWalkingMeters ? { ...leg, mode: 'WALK' } : null
    );
  }

  /**
   * Straight-line estimate: average walking speed is 1.4 m/s (5 km/h)
   */
  private estimateWalk(point: Coordinates, passengerHome: Coordinates): RouteLeg {
    const distance = haversineDistance(point, passengerHome);
    const walkingSpeed = 1.4; // meters per second
    return { distance, duration: Math.round(distance / walkingSpeed) };
  }
}
