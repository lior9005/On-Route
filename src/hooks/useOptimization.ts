import { useState, useCallback } from "react";
import { CandidatePoint, Coordinates, TravelMode, TripDirection } from "../models";
import { GoogleMapsService } from "../services/GoogleMapsService";
import { OsmService } from "../services/OsmService";
import { RoutingEngine, describeSearch } from "../services/RoutingEngine";
import { WalkingStrategy } from "../strategies/WalkingStrategy";
import { TransitStrategy } from "../strategies/TransitStrategy";
import { CONFIG } from "../constants/config";

interface OptimizationParams {
  start: Coordinates;
  end: Coordinates;
  passengerHome: Coordinates;
  mode: TravelMode;
  maxWalkingDistance: number;
  direction: TripDirection;
  maxDetourMinutes: number;
}

export function useOptimization() {
  const [candidates, setCandidates] = useState<CandidatePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchSummary, setSearchSummary] = useState<string | null>(null);

  const runOptimization = useCallback(async (params: OptimizationParams) => {
    setLoading(true);
    setError(null);
    setCandidates([]);
    setSearchSummary(null);

    try {
      // Initialize services
      const googleMapsService = new GoogleMapsService(
        CONFIG.GOOGLE_MAPS_API_KEY,
      );
      const strategy = new WalkingStrategy(googleMapsService);
      const routingEngine = new RoutingEngine(
        googleMapsService,
        new OsmService(),
        strategy,
        new TransitStrategy(googleMapsService),
      );

      // Run optimization
      const results = await routingEngine.optimize(params);

      setCandidates(results);
      const summary = routingEngine.lastSearchInfo
        ? describeSearch(routingEngine.lastSearchInfo)
        : null;
      setSearchSummary(summary);

      if (results.length === 0) {
        setError(
          (params.mode === "BUS"
            ? "No direct bus options found. Try allowing more extra driving, or switch to walking."
            : "No suitable drop/pick locations found. Try increasing the maximum walking distance.") +
            (summary ? `\n\n${summary}` : ""),
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
    searchSummary,
    runOptimization,
    clearCandidates,
  };
}
