import { useState, useCallback } from "react";
import { CandidatePoint, Coordinates } from "../models";
import { GoogleMapsService } from "../services/GoogleMapsService";
import { OsmService } from "../services/OsmService";
import { RoutingEngine, describeSearch } from "../services/RoutingEngine";
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
      );

      // Run optimization
      const results = await routingEngine.optimize(
        params.start,
        params.end,
        params.passengerHome,
        params.maxWalkingDistance,
      );

      setCandidates(results);
      const summary = routingEngine.lastSearchInfo
        ? describeSearch(routingEngine.lastSearchInfo)
        : null;
      setSearchSummary(summary);

      if (results.length === 0) {
        setError(
          "No suitable drop/pick locations found. Try increasing the maximum walking distance." +
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
