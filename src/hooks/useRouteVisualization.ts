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
    ) => {
      setLoading(true);
      setError(null);

      try {
        const googleMapsService = new GoogleMapsService(
          CONFIG.GOOGLE_MAPS_API_KEY,
        );
        const result = await googleMapsService.getRouteVisualization(
          candidate,
          start,
          end,
          passengerHome,
        );
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
