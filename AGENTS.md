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
- `src/strategies/`: passenger leg check. `WalkingStrategy` handles walk mode. `TransitStrategy` handles bus mode: `evaluateTransitRoute` / `pickTransitOption` are pure timing rules.
- `src/constants/config.ts`: every tuning number (radii, limits, timeouts, road classes)
- `App.tsx`: home screen, form and candidate modal; `src/screens/RoutePreviewScreen.tsx`: map preview

## Password screen

`PasswordGate` (`src/components/PasswordGate.tsx`) wraps the whole app (`App.tsx` → `MainApp`). It compares the SHA-256 of the input (`js-sha256`, pure JS, so it works on Hermes) with `CONFIG.APP_PASSWORD_SHA256`. "Remember me" stores that hash in AsyncStorage (`app-unlocked-v1`), so changing the password locks devices again. To change the password, set `EXPO_PUBLIC_APP_PASSWORD_SHA256` to the new hash (for example in Netlify) or update the default in `config.ts`. Never commit the plain password.

This only keeps casual visitors out: the check runs in the client and the repo is public. Netlify's team login protection is the real access control for the website.

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

## Meeting point search: walk mode (RoutingEngine.optimizeWalking)

1. In parallel: transit stops near the passenger (Places), small streets and big roads (OpenFreeMap), and the driver's normal route A→C.
2. Street points: corners (3+ distinct directions meeting) plus one point every 100 m. Points within 30 m of a big road (`tertiary` and above) are dropped. Small streets = class `minor`. Also add the spot on the driver's route closest to the passenger.
3. Pre-select without API calls: straight line within 75% of the walking limit, merge points within 100 m, rank by estimated detour (closest-on-route first), keep the best 15. Short walks (≤ 400 m) get 8 more of their own, so the trade-off table has data at the short end.
4. Real walking distance with one Route Matrix request (WALK); drop anything over the limit.
5. Detour route A→point→C per candidate (TRAFFIC_AWARE); drop street points that Google snaps more than 20 m away (probably a bigger road).
6. Trade-off: for each 100 m walking step up to the limit, the best driving time (`buildWalkingTradeoff`). The slider is the most the passenger will walk; results open on the shortest step within 60 s of the fastest (`suggestWalkingLimit`).
7. Rank: driving times within 60 s count as equal and the shorter walk wins. Merge within 100 m, show the top 3 within the chosen step (`selectWalkingCandidates`). The UI badges the shortest walk. The "Walk more, drive less?" card (`WalkingTradeoff`) lists the steps where the best time changes; tapping one re-picks from the routed candidates without new API calls.

## Meeting point search: bus mode (RoutingEngine.optimizeTransit)

The form has a **Leave now / Plan a ride** switch (`DepartureTimePicker`: next 7 days, 15-minute steps). A planned time is passed as `departureTime` to every DRIVE request, for predicted traffic, and is the base for the bus timings. The map preview's route request still uses "now", since it only draws lines.

The form has a Walk / Bus switch. Bus mode also has a Drop-off / Pick-up switch and a "Max extra driving" slider instead of the walking slider.

1. Fetch the driver's normal route A→C, then the bus stops along it: Places Text Search with `searchAlongRouteParameters` and `includedType: bus_stop`, falling back to `transit_station`.
2. Pre-select the 15 stops with the best estimated extra driving + bus time (straight-line estimates), skipping stops clearly over the detour budget.
3. For each stop, compute the detour route A→stop→C and drop it if the extra driving is over the slider value. The leg-1 duration gives the meeting time T.
4. Bus trip: Routes API `TRANSIT` with bus only, `FEWER_TRANSFERS` and alternatives.
   - **Drop-off:** stop→home with `departureTime = T + 5 min`.
   - **Pick-up:** home→stop with `arrivalTime = T − 5 min`.
   - **Pick-up fallback, driver waits:** if the hitchhiker can't make it in time, request the earliest bus (`departureTime = now + 2 min`). They meet at max(T, hitchhiker at the stop + 5 min). The driver's wait plus the extra driving must fit within "Max extra driving", and the wait counts in the combined ranking (`evaluatePickupWithDriverWait`).
5. Rules (`config.ts` `TRANSIT_*`):
   - exactly one bus, no transfers;
   - walking ≤ 800 m;
   - 5 min spare time: the bus leaves ≥ 5 min after the drop-off, or the hitchhiker arrives ≥ 5 min before the car;
   - pick-up: the hitchhiker must not need to leave within 2 min of now;
   - trip ≤ 40 min, waiting included.
6. Rank by extra driving + bus trip (`rankByCombinedTime`), merge within 100 m, show the top 3. The meeting point is labeled "Near *stop*", because a car should not stop inside a bus stop.

Failures degrade instead of breaking: no street data means bus stops only, and the reverse. `SearchInfo` / `describeSearch` produces the grey summary line under the results; ask users for that line when debugging.

## Deploy

Netlify site `on-route` builds from GitHub on every push to the configured branch (`netlify.toml`: build command, publish `dist`, SPA redirect). The site needs the `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` environment variable. Native apps need a new build (for example `eas build -p android`) to pick up code changes.

## Testing without network access

Cloud sessions usually cannot reach Google, OpenFreeMap or Netlify. Verify changes by:

- running pure logic (`src/utils/*`, `rankCandidates`) with `npx tsx` on made-up geometry
- building the web bundle and driving it with Playwright (Chromium is preinstalled), mocking the endpoints with `page.route`. Tiles can be produced locally with `geojson-vt` + `vt-pbf`.
- real Google data is reachable from cloud sessions: run the engine with `npx tsx` and the env key (`NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt`). Fake `Date` to test weekday service: on Shabbat only weekend lines run, so bus results look empty.
- for bus mode: mock Text Search, and DRIVE and TRANSIT `computeRoutes`. Google's transit `arrivalTime` covers arrival at the destination including the final walk. Note that the switches are `<button>` elements and the Find button can be below the fold, so scroll into view before clicking.

Say clearly what was verified with mocks and what still needs a real-world check.

## Old docs

`agents/` holds the original multi-agent build plan. It is historical and out of date (for example, it describes the legacy Directions API). Follow this file and the code instead.
