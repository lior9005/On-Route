const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";

export const CONFIG = {
  MAX_WALKING_DISTANCE: 2000, // meters
  MIN_WALKING_DISTANCE: 100, // meters
  DEFAULT_WALKING_DISTANCE: 500, // meters
  TOP_CANDIDATES_COUNT: 3,
  /** Merge meeting point candidates within this distance (meters); keep best per cluster */
  CANDIDATE_MERGE_RADIUS_METERS: 100,
  SAMPLE_INTERVAL: 5, // Sample every Nth point from polyline
  GOOGLE_MAPS_API_TIMEOUT: 10000, // ms
  GOOGLE_MAPS_API_KEY, // From environment variables

  // Route Preview Map Styling
  MAP_PADDING: 0.1, // 10% padding for map bounds
  ROUTE_COLORS: {
    DRIVER_TO_DROPOFF: "#4285F4", // Blue
    DRIVER_TO_DEST: "#34A853", // Green
    PASSENGER_WALKING: "#FBBC04", // Orange
  },
  POLYLINE_WIDTH: 4,
  MARKER_LABELS: {
    START: "Your Location",
    DROPOFF: "Drop/Pick Location",
    DESTINATION: "Your Destination",
    PASSENGER: "Passenger start/end of trip",
  },
} as const;
