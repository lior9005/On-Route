const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";

export const CONFIG = {
  // Password screen: SHA-256 of the app password (only the hash is stored).
  // Override with EXPO_PUBLIC_APP_PASSWORD_SHA256 to change it without a code change.
  APP_PASSWORD_SHA256:
    process.env.EXPO_PUBLIC_APP_PASSWORD_SHA256 ||
    "b2f7d6a21d9ad46561304b2aabcff6896c5e0bc680f6c5dcfa7574759d5f388c",

  MAX_WALKING_DISTANCE: 2000, // meters
  MIN_WALKING_DISTANCE: 100, // meters
  DEFAULT_WALKING_DISTANCE: 500, // meters
  TOP_CANDIDATES_COUNT: 3,
  /** Merge meeting point candidates within this distance (meters); keep best per cluster */
  CANDIDATE_MERGE_RADIUS_METERS: 100,

  // Street meeting points (OpenStreetMap road classes, OpenMapTiles schema).
  // "minor" = residential, living_street, unclassified streets
  SMALL_STREET_CLASSES: ["minor"],
  BIG_ROAD_CLASSES: ["motorway", "trunk", "primary", "secondary", "tertiary"],
  STREET_SAMPLE_INTERVAL_METERS: 100, // One candidate point every 100m of street
  BIG_ROAD_BUFFER_METERS: 30, // Skip street points this close to a big road
  ON_ROUTE_THRESHOLD_METERS: 25, // Point counts as on the driver's route within this distance
  MAX_SNAP_DISTANCE_METERS: 20, // Drop street points Google snaps further than this
  MAX_CANDIDATES_TO_EVALUATE: 15, // Candidates sent to Google APIs per search
  // Real walking routes run ~30% longer than a straight line: only shortlist
  // points within this share of the walking limit (straight line)
  WALK_PREFILTER_RATIO: 0.75,
  OSM_TIMEOUT_MS: 8000, // Each OpenFreeMap request
  ROUTE_SAMPLE_INTERVAL_METERS: 10, // Precision when searching the driver's route for the closest spot
  DRIVE_TIME_TIE_SECONDS: 60, // Driving times this close count as equal; shorter walk wins
  GOOGLE_MAPS_API_TIMEOUT: 10000, // ms
  GOOGLE_MAPS_API_KEY, // From environment variables

  // Bus option (hitchhiker takes a bus to/from the meeting point)
  TRANSIT_MODES: ["BUS"], // Routes API transit vehicle types allowed
  TRANSIT_MAX_TRIP_MINUTES: 40, // Hitchhiker's whole trip, waiting included
  TRANSIT_SPARE_MINUTES: 5, // Bus leaves >= 5 min after drop-off / arrives >= 5 min before pick-up
  TRANSIT_MAX_WALK_METERS: 800, // Walking inside the bus trip
  PICKUP_DEPARTURE_BUFFER_SECONDS: 120, // Hitchhiker needs at least this long to leave home
  DEFAULT_MAX_DETOUR_MINUTES: 10,
  MIN_DETOUR_MINUTES: 2,
  MAX_DETOUR_MINUTES: 20,
  BUS_STOP_SEARCH_PAGES: 2, // Text Search along the route, 20 stops per page
  // Pre-selection estimates (straight-line based, no API calls)
  DETOUR_ESTIMATE_SPEED_MPS: 8, // ~30 km/h city driving
  BUS_ESTIMATE_SPEED_MPS: 5, // ~18 km/h bus incl. stops

  // Route preview loading screen stays at least this long, so it doesn't flash
  ROUTE_PREVIEW_MIN_LOADING_MS: 2400,

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
