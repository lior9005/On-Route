import { useState, useCallback } from "react";
import {
  CandidatePoint,
  Coordinates,
  TravelMode,
  TripDirection,
  WalkingTradeoffStep,
} from "../models";
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
  departureTime: Date | null; // null = leave now
}

export function useOptimization() {
  const [candidates, setCandidates] = useState<CandidatePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchSummary, setSearchSummary] = useState<string | null>(null);
  const [tradeoff, setTradeoff] = useState<WalkingTradeoffStep[]>([]);
  // Walk mode: the walking limit the shown candidates were picked for
  const [walkingLimit, setWalkingLimit] = useState<number | null>(null);

  const runOptimization = useCallback(async (params: OptimizationParams) => {
    setLoading(true);
    setError(null);
    setCandidates([]);
    setSearchSummary(null);
    setTradeoff([]);
    setWalkingLimit(null);

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
      setTradeoff(routingEngine.lastTradeoff);
      setWalkingLimit(routingEngine.lastWalkingLimit);
      const summary = routingEngine.lastSearchInfo
        ? describeSearch(routingEngine.lastSearchInfo)
        : null;
      setSearchSummary(summary);

      if (results.length === 0) {
        setError(
          (params.mode === "BUS"
            ? "No direct bus options found. Try allowing more extra driving, or switch to walking."
            : `No suitable drop/pick locations found within a ${CONFIG.WALK_SEARCH_DISTANCE}m walk.`) +
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
    setTradeoff([]);
    setWalkingLimit(null);
    setError(null);
  }, []);

  return {
    candidates,
    loading,
    error,
    searchSummary,
    tradeoff,
    walkingLimit,
    runOptimization,
    clearCandidates,
  };
}
