const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";

export const CONFIG = {
  MAX_WALKING_DISTANCE: 2000, // meters
  MIN_WALKING_DISTANCE: 100, // meters
  DEFAULT_WALKING_DISTANCE: 500, // meters
  TOP_CANDIDATES_COUNT: 3,
  /** Merge meeting point candidates within this distance (meters); keep best per cluster */
  CANDIDATE_MERGE_RADIUS_METERS: 100,
  SAMPLE_INTERVAL: 5, // Sample every Nth point from polyline

  // Street meeting points (OpenStreetMap road types)
  SMALL_STREET_TYPES: ["residential", "living_street", "unclassified"],
  BIG_ROAD_TYPES: [
    "motorway", "motorway_link", "trunk", "trunk_link",
    "primary", "primary_link", "secondary", "secondary_link",
    "tertiary", "tertiary_link",
  ],
  STREET_SAMPLE_INTERVAL_METERS: 100, // One candidate point every 100m of street
  BIG_ROAD_BUFFER_METERS: 30, // Skip street points this close to a big road
  ON_ROUTE_THRESHOLD_METERS: 25, // Point counts as on the driver's route within this distance
  MAX_SNAP_DISTANCE_METERS: 20, // Drop street points Google snaps further than this
  MAX_CANDIDATES_TO_EVALUATE: 15, // Candidates sent to Google APIs per search
  OSM_TIMEOUT_MS: 10000, // Streets proxy (Netlify function)
  OSM_DIRECT_TIMEOUT_MS: 5000, // Each public Overpass server, if the proxy fails
  ROUTE_SAMPLE_INTERVAL_METERS: 10, // Precision when searching the driver's route for the closest spot
  DRIVE_TIME_TIE_SECONDS: 60, // Driving times this close count as equal; shorter walk wins
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
