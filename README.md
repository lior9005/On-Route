# On the Way

Expo / React Native app that finds the best drop/pick location for a driver and passenger. Runs on Android, iOS and web.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
3. `npm start` (or `npm run web` / `npm run android` / `npm run ios`)

## Google Maps Platform

Enable these APIs for the key in Google Cloud Console:

| API | Used for |
| --- | --- |
| Routes API | Driving and walking routes, walking distance matrix (`GoogleMapsService`) |
| Places API (New) | Address autocomplete and nearby transit stops |
| Maps JavaScript API | Route map on web |
| Maps SDK for Android | Route map on Android |
| Geocoding API | Address for "use my current location" |

Street meeting points use the free OpenStreetMap Overpass API (`overpass-api.de`, no key) to find small streets (`residential`, `living_street`, `unclassified`) and keep away from big roads. If it is unavailable, only transit stops are suggested.

`EXPO_PUBLIC_*` values are embedded in the app bundle, so the key is visible to users. Protect it with API restrictions (only the APIs above) and application restrictions (HTTP referrers for web, package name + SHA-1 for Android).

### Where to set the key

- **Local dev:** `.env` (git-ignored)
- **EAS builds:** EAS environment variables (`eas env:create --name EXPO_PUBLIC_GOOGLE_MAPS_API_KEY --value <key> --visibility sensitive`)
- **GitHub Actions** (only if a workflow builds/deploys the app): repository secret `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, passed to the build step as an env var
