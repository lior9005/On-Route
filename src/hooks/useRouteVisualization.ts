import { useState, useCallback } from "react";
import { GoogleMapsService } from "../services/GoogleMapsService";
import { CandidatePoint, RouteVisualization, Coordinates } from "../models";
import { CONFIG } from "../constants/config";

export function useRouteVisualization() {
  const [visualization, setVisualization] = useState<RouteVisualization | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVisualization = useCallback(
    async (
      candidate: CandidatePoint,
      start: Coordinates,
      end: Coordinates,
      passengerHome: Coordinates,
      departureTime?: Date | null,
    ) => {
      setLoading(true);
      setError(null);
      const startedAt = Date.now();
      // Keep the loading screen up for a minimum time, even on fast answers
      const minimumWait = () =>
        new Promise((resolve) =>
          setTimeout(
            resolve,
            Math.max(0, CONFIG.ROUTE_PREVIEW_MIN_LOADING_MS - (Date.now() - startedAt)),
          ),
        );

      try {
        const googleMapsService = new GoogleMapsService(
          CONFIG.GOOGLE_MAPS_API_KEY,
        );
        const result = await googleMapsService.getRouteVisualization(
          candidate,
          start,
          end,
          passengerHome,
          departureTime,
        );
        await minimumWait();
        setVisualization(result);
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to load route visualization";
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const clearVisualization = useCallback(() => {
    setVisualization(null);
    setError(null);
  }, []);

  return {
    visualization,
    loading,
    error,
    fetchVisualization,
    clearVisualization,
  };
}
