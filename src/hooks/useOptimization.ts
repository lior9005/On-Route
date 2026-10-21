import { useState, useCallback } from "react";
import { CandidatePoint, Coordinates } from "../models";
import { GoogleMapsService } from "../services/GoogleMapsService";
import { RoutingEngine } from "../services/RoutingEngine";
import { WalkingStrategy } from "../strategies/WalkingStrategy";
import { CONFIG } from "../constants/config";

interface OptimizationParams {
  start: Coordinates;
  end: Coordinates;
  passengerHome: Coordinates;
  maxWalkingDistance: number;
}

export function useOptimization() {
  const [candidates, setCandidates] = useState<CandidatePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runOptimization = useCallback(async (params: OptimizationParams) => {
    setLoading(true);
    setError(null);
    setCandidates([]);

    try {
      // Initialize services
      const googleMapsService = new GoogleMapsService(
        CONFIG.GOOGLE_MAPS_API_KEY,
      );
      const strategy = new WalkingStrategy();
      const routingEngine = new RoutingEngine(googleMapsService, strategy);

      // Run optimization
      const results = await routingEngine.optimize(
        params.start,
        params.end,
        params.passengerHome,
        params.maxWalkingDistance,
      );

      setCandidates(results);

      if (results.length === 0) {
        setError(
          "No suitable drop/pick locations found. Try increasing the maximum walking distance.",
        );
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An unknown error occurred";
      setError(`Optimization failed: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearCandidates = useCallback(() => {
    setCandidates([]);
    setError(null);
  }, []);

  return {
    candidates,
    loading,
    error,
    runOptimization,
    clearCandidates,
  };
}
