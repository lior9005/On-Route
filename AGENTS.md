# On the Way: notes for coding agents

Expo (SDK 54) / React Native + TypeScript app that finds the best meeting point where a driver drops off or picks up a passenger. Runs on Android, iOS and web; the web build is deployed on Netlify.

## Commands

- `npm run typecheck`: run before every commit (there are no unit tests yet)
- `npm run web`: dev server for the browser
- `npx expo export --platform web --clear`: production web build into `dist/`. Keep `--clear`: Metro caches transformed modules, including inlined `EXPO_PUBLIC_*` values, so a build without it can ship an old key.
- Local config: `.env` (git-ignored) with `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, see `.env.example`

## Layout

- `src/services/RoutingEngine.ts`: the meeting-point search (flow below)
- `src/services/GoogleMapsService.ts`: all Google calls (Routes, Route Matrix, Places, Geocoding)
- `src/services/OsmService.ts`: OpenStreetMap streets from OpenFreeMap vector tiles
- `src/utils/streetCandidates.ts`: turns streets into candidate points, plus the cheap pre-selection
- `src/strategies/`: passenger leg check (`WalkingStrategy` done; `TransitStrategy` is a placeholder for the planned bus feature)
- `src/constants/config.ts`: every tuning number (radii, limits, timeouts, road classes)
- `App.tsx`: home screen, form and candidate modal; `src/screens/RoutePreviewScreen.tsx`: map preview

## Platform rules

- Platform-specific files: `RouteMap.tsx` (react-native-maps, native) vs `RouteMap.web.tsx` (Google Maps JavaScript API). Metro picks `.web.tsx` for web; never import `react-native-maps` from shared code.
- Use `showAlert` (`src/utils/alert.ts`), not `Alert.alert`: it is a no-op on react-native-web.
- Web has a DOM (`tsconfig` includes `DOM`), but guard browser-only APIs with `Platform.OS === "web"`.

## APIs (browser constraints matter)

The web app calls every API directly from the browser, so each one must allow CORS:

- Google **Routes API** (`routes.googleapis.com`: computeRoutes and computeRouteMatrix), **Places API (New)** (`places.googleapis.com`), **Geocoding API**, and the **Maps JavaScript API** for the web map.
- Do **not** use the legacy Directions or Places web services (`maps.googleapis.com/maps/api/directions|place/...`): browsers cannot call them.
- Address autocomplete uses `react-native-google-places-autocomplete` (>= 2.6.5; 2.6.4 crashes on web) with `isNewPlacesAPI`.
- Road types come from OpenStreetMap via **OpenFreeMap** vector tiles (`tiles.openfreemap.org`, z14, OpenMapTiles schema: `transportation.class` and `transportation_name`). Google APIs do not expose road types. The public Overpass servers were tried and timed out from both browsers and Netlify, so don't switch back to them.
- The Google key is embedded in the bundle (`EXPO_PUBLIC_*`) and is protected by key restrictions (allowed websites, allowed APIs), not by secrecy.

## Meeting point search (RoutingEngine.optimize)

1. In parallel: transit stops near the passenger (Places), small streets and big roads (OpenFreeMap), and the driver's normal route A→C.
2. Street points: corners (3+ distinct directions meeting) plus one point every 100 m. Points within 30 m of a big road (`tertiary` and above) are dropped. Small streets = class `minor`. Also add the spot on the driver's route closest to the passenger.
3. Pre-select without API calls: straight line within 75% of the walking limit, merge points within 100 m, rank by estimated detour (closest-on-route first), keep the best 15.
4. Real walking distance with one Route Matrix request (WALK); drop anything over the limit.
5. Detour route A→point→C per candidate (TRAFFIC_AWARE); drop street points that Google snaps more than 20 m away (probably a bigger road).
6. Rank: driving times within 60 s count as equal and the shorter walk wins. Merge within 100 m, show the top 3. The UI badges the shortest walk.

Failures degrade instead of breaking: no street data means bus stops only, and the reverse. `SearchInfo` / `describeSearch` produces the grey summary line under the results; ask users for that line when debugging.

## Deploy

Netlify site `on-route` builds from GitHub on every push to the configured branch (`netlify.toml`: build command, publish `dist`, SPA redirect). The site needs the `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` environment variable. Native apps need a new build (for example `eas build -p android`) to pick up code changes.

## Testing without network access

Cloud sessions usually cannot reach Google, OpenFreeMap or Netlify. Verify changes by:

- running pure logic (`src/utils/*`, `rankCandidates`) with `npx tsx` on made-up geometry
- building the web bundle and driving it with Playwright (Chromium is preinstalled), mocking the endpoints with `page.route`. Tiles can be produced locally with `geojson-vt` + `vt-pbf`.

Say clearly what was verified with mocks and what still needs a real-world check.

## Old docs

`agents/` holds the original multi-agent build plan. It is historical and out of date (for example, it describes the legacy Directions API). Follow this file and the code instead.
