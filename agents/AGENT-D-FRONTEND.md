> **Historical, out of date.** This is the original build plan; the app has changed since (Routes/Places APIs (New), web support, street meeting points). See `AGENTS.md` in the repo root and the code instead.

# Agent D: Frontend Integration Layer
## On-Route: Multi-Modal Drop-off Optimizer

**Your Mission:** Build all UI components, screens, navigation flow, and integrate everything into a working mobile application.

**Status:** [BLOCKED] → [IN_PROGRESS] → [COMPLETE]

**Dependencies:** Agent A [COMPLETE], Agent B [COMPLETE], Agent C [COMPLETE]

**Estimated Time:** 5-6 hours

---

## 📋 Prerequisites Check

Before starting, verify:

- [ ] Agent A: All models and utils exist
- [ ] Agent B: All services and strategies exist
- [ ] Agent C: All hooks exist
- [ ] `react-native-maps` is installed
- [ ] TypeScript compiles: `npx tsc --noEmit` passes

**If any are missing, STOP and wait for dependencies!**

---

## 📋 Your Tasks

### Task 1: Destination Input Component
**File:** `src/components/DestinationInput.tsx`

```typescript
import React from 'react';
import { View, TextInput, Text, StyleSheet } from 'react-native';
import { Coordinates } from '../models';

interface DestinationInputProps {
  driverStart: Coordinates | null;
  driverDestination: Coordinates | null;
  passengerHome: Coordinates | null;
  onDriverStartChange: (coord: Coordinates | null) => void;
  onDriverDestinationChange: (coord: Coordinates | null) => void;
  onPassengerHomeChange: (coord: Coordinates | null) => void;
}

export function DestinationInput({
  driverStart,
  driverDestination,
  passengerHome,
  onDriverStartChange,
  onDriverDestinationChange,
  onPassengerHomeChange,
}: DestinationInputProps) {
  // Simple text input for now - can be enhanced with Places Autocomplete later
  const handleDriverStartText = (text: string) => {
    // Parse coordinates from text (e.g., "40.7128, -74.0060")
    const coords = parseCoordinates(text);
    onDriverStartChange(coords);
  };

  const handleDriverDestinationText = (text: string) => {
    const coords = parseCoordinates(text);
    onDriverDestinationChange(coords);
  };

  const handlePassengerHomeText = (text: string) => {
    const coords = parseCoordinates(text);
    onPassengerHomeChange(coords);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Driver Start (A)</Text>
      <TextInput
        style={styles.input}
        placeholder="Latitude, Longitude (e.g., 40.7128, -74.0060)"
        onChangeText={handleDriverStartText}
        value={driverStart ? `${driverStart.lat}, ${driverStart.lon}` : ''}
      />

      <Text style={styles.label}>Driver Destination (C)</Text>
      <TextInput
        style={styles.input}
        placeholder="Latitude, Longitude"
        onChangeText={handleDriverDestinationText}
        value={driverDestination ? `${driverDestination.lat}, ${driverDestination.lon}` : ''}
      />

      <Text style={styles.label}>Passenger Home (B)</Text>
      <TextInput
        style={styles.input}
        placeholder="Latitude, Longitude"
        onChangeText={handlePassengerHomeText}
        value={passengerHome ? `${passengerHome.lat}, ${passengerHome.lon}` : ''}
      />
    </View>
  );
}

function parseCoordinates(text: string): Coordinates | null {
  const parts = text.split(',').map(s => s.trim());
  if (parts.length === 2) {
    const lat = parseFloat(parts[0]);
    const lon = parseFloat(parts[1]);
    if (!isNaN(lat) && !isNaN(lon)) {
      return { lat, lon };
    }
  }
  return null;
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
});
```

---

### Task 2: Max Walking Slider Component
**File:** `src/components/MaxWalkingSlider.tsx`

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { CONFIG } from '../constants/config';

interface MaxWalkingSliderProps {
  value: number;
  onValueChange: (value: number) => void;
}

export function MaxWalkingSlider({ value, onValueChange }: MaxWalkingSliderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        Max Walking Distance: {value}m
      </Text>
      <Slider
        style={styles.slider}
        minimumValue={CONFIG.MIN_WALKING_DISTANCE}
        maximumValue={CONFIG.MAX_WALKING_DISTANCE}
        value={value}
        onValueChange={onValueChange}
        step={50}
      />
      <View style={styles.labels}>
        <Text style={styles.minLabel}>{CONFIG.MIN_WALKING_DISTANCE}m</Text>
        <Text style={styles.maxLabel}>{CONFIG.MAX_WALKING_DISTANCE}m</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  minLabel: {
    fontSize: 12,
    color: '#666',
  },
  maxLabel: {
    fontSize: 12,
    color: '#666',
  },
});
```

---

### Task 3: Candidate List Component
**File:** `src/components/CandidateList.tsx`

```typescript
import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { CandidatePoint } from '../models';
import { secondsToMinutes, metersToKilometers } from '../utils/distance';

interface CandidateListProps {
  candidates: CandidatePoint[];
  selectedId?: string;
  onSelect: (candidate: CandidatePoint) => void;
}

export function CandidateList({ candidates, selectedId, onSelect }: CandidateListProps) {
  const renderItem = ({ item }: { item: CandidatePoint }) => {
    const isSelected = item.id === selectedId;
    
    return (
      <TouchableOpacity
        style={[styles.item, isSelected && styles.selectedItem]}
        onPress={() => onSelect(item)}
      >
        <Text style={styles.name}>{item.name || 'Intersection'}</Text>
        <Text style={styles.details}>
          Detour: {secondsToMinutes(item.totalDetour)} min
        </Text>
        <Text style={styles.details}>
          Walking: {metersToKilometers(item.passengerLeg.distance).toFixed(2)} km
        </Text>
      </TouchableOpacity>
    );
  };

  if (candidates.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No candidates found</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={candidates}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  item: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  selectedItem: {
    backgroundColor: '#e3f2fd',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  details: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  empty: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});
```

---

### Task 4: Route Preview Screen
**File:** `src/screens/RoutePreviewScreen.tsx`

**This is the critical screen showing the map before Waze handoff!**

```typescript
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { CandidatePoint, Coordinates } from '../models';
import { decodePolyline } from '../utils/polylineDecoder';
import { CONFIG } from '../constants/config';
import { useRouteVisualization } from '../hooks/useRouteVisualization';
import { WazeService } from '../services/WazeService';
import { secondsToMinutes, metersToKilometers } from '../utils/distance';

interface RoutePreviewScreenProps {
  candidate: CandidatePoint;
  startPoint: Coordinates;
  endPoint: Coordinates;
  passengerHome: Coordinates;
  onConfirm: () => void;
  onBack: () => void;
}

export function RoutePreviewScreen({
  candidate,
  startPoint,
  endPoint,
  passengerHome,
  onConfirm,
  onBack,
}: RoutePreviewScreenProps) {
  const { visualization, loading, error, fetchVisualization } = useRouteVisualization();

  useEffect(() => {
    fetchVisualization(candidate, startPoint, endPoint, passengerHome);
  }, [candidate, startPoint, endPoint, passengerHome, fetchVisualization]);

  const handleLetsGo = async () => {
    try {
      await WazeService.openNavigation(candidate.coordinates);
      onConfirm();
    } catch (error) {
      Alert.alert('Error', 'Failed to open Waze navigation');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" style={styles.loader} />
        <Text>Loading route preview...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity style={styles.button} onPress={onBack}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!visualization) {
    return null;
  }

  // Calculate map region with padding
  const { northeast, southwest } = visualization.bounds;
  const latDelta = (northeast.lat - southwest.lat) * (1 + CONFIG.MAP_PADDING);
  const lonDelta = (northeast.lon - southwest.lon) * (1 + CONFIG.MAP_PADDING);
  const centerLat = (northeast.lat + southwest.lat) / 2;
  const centerLon = (northeast.lon + southwest.lon) / 2;

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: centerLat,
          longitude: centerLon,
          latitudeDelta: latDelta,
          longitudeDelta: lonDelta,
        }}
      >
        {/* Render polylines for each route segment */}
        {visualization.segments.map((segment, index) => {
          const coordinates = decodePolyline(segment.polyline);
          return (
            <Polyline
              key={index}
              coordinates={coordinates}
              strokeColor={segment.color}
              strokeWidth={CONFIG.POLYLINE_WIDTH}
              lineDashPattern={segment.label.includes('Walking') ? [5, 5] : undefined}
            />
          );
        })}

        {/* Markers */}
        <Marker
          coordinate={startPoint}
          title={CONFIG.MARKER_LABELS.START}
          pinColor="blue"
        />
        <Marker
          coordinate={candidate.coordinates}
          title={CONFIG.MARKER_LABELS.DROPOFF}
          pinColor="red"
        />
        <Marker
          coordinate={endPoint}
          title={CONFIG.MARKER_LABELS.DESTINATION}
          pinColor="green"
        />
        <Marker
          coordinate={passengerHome}
          title={CONFIG.MARKER_LABELS.PASSENGER}
          pinColor="orange"
        />
      </MapView>

      {/* Route Summary Card */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Route Summary</Text>
        <Text style={styles.summaryText}>
          Drop-off: {candidate.name || 'Intersection'}
        </Text>
        <Text style={styles.summaryText}>
          Total Detour: {secondsToMinutes(candidate.totalDetour)} min
        </Text>
        <Text style={styles.summaryText}>
          Passenger Walk: {metersToKilometers(candidate.passengerLeg.distance).toFixed(2)} km
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.letsGoButton} onPress={handleLetsGo}>
          <Text style={styles.letsGoButtonText}>Let's Go!</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loader: {
    marginTop: 100,
  },
  error: {
    color: 'red',
    textAlign: 'center',
    margin: 20,
  },
  map: {
    flex: 1,
  },
  summaryCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  backButton: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  letsGoButton: {
    flex: 2,
    padding: 16,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    alignItems: 'center',
  },
  letsGoButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
});
```

---

### Task 5: Main Screen
**File:** `app/(tabs)/index.tsx` or `app/index.tsx` (depending on your Expo Router setup)

```typescript
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { DestinationInput } from '../src/components/DestinationInput';
import { MaxWalkingSlider } from '../src/components/MaxWalkingSlider';
import { CandidateList } from '../src/components/CandidateList';
import { RoutePreviewScreen } from '../src/screens/RoutePreviewScreen';
import { useJourneyState } from '../src/hooks/useJourneyState';
import { useOptimization } from '../src/hooks/useOptimization';
import { Coordinates, CandidatePoint } from '../src/models';
import { CONFIG } from '../src/constants/config';

export default function HomeScreen() {
  const [driverStart, setDriverStart] = useState<Coordinates | null>(null);
  const [driverDestination, setDriverDestination] = useState<Coordinates | null>(null);
  const [passengerHome, setPassengerHome] = useState<Coordinates | null>(null);
  const [maxWalkingDistance, setMaxWalkingDistance] = useState(CONFIG.DEFAULT_WALKING_DISTANCE);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidatePoint | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const { journey, saveJourney, advanceStage } = useJourneyState();
  const { candidates, loading, error, runOptimization } = useOptimization();

  const handleFindDropoff = async () => {
    if (!driverStart || !driverDestination || !passengerHome) {
      alert('Please enter all three locations');
      return;
    }

    await runOptimization({
      start: driverStart,
      end: driverDestination,
      passengerHome,
      maxWalkingDistance,
    });
  };

  const handleSelectCandidate = (candidate: CandidatePoint) => {
    setSelectedCandidate(candidate);
    setShowPreview(true);
  };

  const handleConfirmNavigation = async () => {
    if (!selectedCandidate || !driverStart || !driverDestination || !passengerHome) {
      return;
    }

    await saveJourney({
      startPoint: driverStart,
      endPoint: driverDestination,
      passengerHome,
      selectedDropoff: selectedCandidate,
      stage: 'EN_ROUTE_TO_DROPOFF',
      timestamp: Date.now(),
    });

    await advanceStage('EN_ROUTE_TO_DROPOFF');
    setShowPreview(false);
  };

  const handleNavigateToDestination = async () => {
    if (!journey?.endPoint) {
      return;
    }

    const { WazeService } = await import('../src/services/WazeService');
    await WazeService.openNavigation(journey.endPoint);
    await advanceStage('EN_ROUTE_TO_DESTINATION');
  };

  // Show route preview screen
  if (showPreview && selectedCandidate && driverStart && driverDestination && passengerHome) {
    return (
      <RoutePreviewScreen
        candidate={selectedCandidate}
        startPoint={driverStart}
        endPoint={driverDestination}
        passengerHome={passengerHome}
        onConfirm={handleConfirmNavigation}
        onBack={() => setShowPreview(false)}
      />
    );
  }

  // Show "Navigate to Destination" button if journey in progress
  if (journey?.stage === 'EN_ROUTE_TO_DROPOFF') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Journey in Progress</Text>
        <Text style={styles.subtitle}>
          You're en route to the drop-off point. When you arrive, press the button below to navigate to your destination.
        </Text>
        <TouchableOpacity style={styles.navButton} onPress={handleNavigateToDestination}>
          <Text style={styles.navButtonText}>Navigate to Destination</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>On-Route Optimizer</Text>

      <DestinationInput
        driverStart={driverStart}
        driverDestination={driverDestination}
        passengerHome={passengerHome}
        onDriverStartChange={setDriverStart}
        onDriverDestinationChange={setDriverDestination}
        onPassengerHomeChange={setPassengerHome}
      />

      <MaxWalkingSlider
        value={maxWalkingDistance}
        onValueChange={setMaxWalkingDistance}
      />

      <TouchableOpacity
        style={[styles.button, (!driverStart || !driverDestination || !passengerHome) && styles.buttonDisabled]}
        onPress={handleFindDropoff}
        disabled={!driverStart || !driverDestination || !passengerHome || loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Find Drop-off</Text>
        )}
      </TouchableOpacity>

      {error && <Text style={styles.error}>{error}</Text>}

      {candidates.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Candidates</Text>
          <CandidateList
            candidates={candidates}
            selectedId={selectedCandidate?.id}
            onSelect={handleSelectCandidate}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    padding: 16,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    padding: 16,
    paddingBottom: 8,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  navButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  navButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  error: {
    color: 'red',
    padding: 16,
    textAlign: 'center',
  },
});
```

---

### Task 6: App Entry Point
**File:** `app/_layout.tsx` (if using Expo Router)

```typescript
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'On-Route' }} />
    </Stack>
  );
}
```

---

## ✅ Completion Checklist

Before reporting completion, verify:

- [ ] App builds: `npx expo start` launches without errors
- [ ] All screens render without crashes
- [ ] Destination inputs accept coordinates
- [ ] Slider updates max walking distance
- [ ] "Find Drop-off" button triggers optimization
- [ ] Candidate list displays results
- [ ] Route preview screen shows map with polylines
- [ ] "Let's Go!" button opens Waze
- [ ] Journey state persists (test by force-quitting app)
- [ ] Navigation flow works end-to-end
- [ ] No TypeScript errors: `npx tsc --noEmit`

---

## 🧪 Manual Testing Checklist

Test the complete user flow:

1. [ ] Enter three coordinates (A, B, C)
2. [ ] Adjust max walking distance slider
3. [ ] Tap "Find Drop-off" → Verify loading state
4. [ ] Verify candidates appear in list
5. [ ] Select a candidate → Verify route preview opens
6. [ ] Verify map shows all four markers (A, B, C, D)
7. [ ] Verify three polylines display (blue, green, orange)
8. [ ] Tap "Back" → Returns to candidate list
9. [ ] Select candidate again → Tap "Let's Go!"
10. [ ] Verify Waze opens with correct coordinates
11. [ ] Return to app → Verify "Navigate to Destination" button appears
12. [ ] Force-quit app → Reopen → Verify journey state persists
13. [ ] Tap "Navigate to Destination" → Verify Waze opens to C

---

## 📤 Handoff Report

When complete, report to orchestrator:

```
✅ Agent D (Frontend Integration) Complete

Completed:
- All UI components created
- Route Preview Screen with map visualization
- Main screen orchestration
- Navigation flow end-to-end
- Journey state persistence working

Files Created:
- src/components/DestinationInput.tsx
- src/components/MaxWalkingSlider.tsx
- src/components/CandidateList.tsx
- src/screens/RoutePreviewScreen.tsx
- app/index.tsx (or app/(tabs)/index.tsx)
- app/_layout.tsx

Verification:
- ✅ App builds: PASSED
- ✅ TypeScript compilation: PASSED
- ✅ Manual testing: PASSED
- ✅ Waze deep linking: PASSED
- ✅ Route preview: PASSED

✅ PROJECT COMPLETE
```

---

## 🚨 If You Encounter Issues

1. **Map not rendering:** Ensure `react-native-maps` is properly configured in `app.json`
2. **Polyline errors:** Verify `@mapbox/polyline` is installed and decoding works
3. **Waze not opening:** Check deep link URL format and Waze installation
4. **State not persisting:** Verify AsyncStorage permissions and storage key
5. **Import errors:** Check all import paths match actual file locations

**Do NOT proceed if app doesn't build!** Fix all errors before reporting completion.

---

**🎉 Congratulations!** You've completed the final layer. The app should now be fully functional!
