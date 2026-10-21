# Agent C: State Management Layer
## On-Route: Multi-Modal Drop-off Optimizer

**Your Mission:** Create React hooks for journey state management and optimization orchestration. Integrate with services from Agent B.

**Status:** [BLOCKED] → [IN_PROGRESS] → [COMPLETE]

**Dependencies:** Agent A [COMPLETE], Agent B [COMPLETE]

**Estimated Time:** 2-3 hours

---

## 📋 Prerequisites Check

Before starting, verify:

- [ ] Agent A: `src/models/Journey.ts` exists
- [ ] Agent A: `src/constants/config.ts` exists
- [ ] Agent B: `src/services/RoutingEngine.ts` exists
- [ ] Agent B: `src/strategies/WalkingStrategy.ts` exists
- [ ] Agent B: `src/services/WazeService.ts` exists
- [ ] TypeScript compiles: `npx tsc --noEmit` passes

**If any are missing, STOP and wait for dependencies!**

---

## 📋 Your Tasks

### Task 1: Journey State Hook
**File:** `src/hooks/useJourneyState.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Journey } from '../models';

const JOURNEY_STORAGE_KEY = '@onroute:journey';

export function useJourneyState() {
  const [journey, setJourney] = useState<Journey | null>(null);
  const [loading, setLoading] = useState(true);

  // Load journey from storage on mount
  useEffect(() => {
    loadJourney();
  }, []);

  const loadJourney = async () => {
    try {
      const stored = await AsyncStorage.getItem(JOURNEY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Journey;
        setJourney(parsed);
      }
    } catch (error) {
      console.error('Error loading journey:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveJourney = useCallback(async (newJourney: Journey) => {
    try {
      await AsyncStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(newJourney));
      setJourney(newJourney);
    } catch (error) {
      console.error('Error saving journey:', error);
      throw error;
    }
  }, []);

  const updateJourney = useCallback(async (updates: Partial<Journey>) => {
    if (!journey) {
      throw new Error('No journey to update');
    }
    const updated = { ...journey, ...updates };
    await saveJourney(updated);
  }, [journey, saveJourney]);

  const advanceStage = useCallback(async (newStage: Journey['stage']) => {
    await updateJourney({ stage: newStage });
  }, [updateJourney]);

  const clearJourney = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(JOURNEY_STORAGE_KEY);
      setJourney(null);
    } catch (error) {
      console.error('Error clearing journey:', error);
    }
  }, []);

  return {
    journey,
    loading,
    saveJourney,
    updateJourney,
    advanceStage,
    clearJourney,
  };
}
```

---

### Task 2: Optimization Hook
**File:** `src/hooks/useOptimization.ts`

```typescript
import { useState, useCallback } from 'react';
import { RoutingEngine } from '../services/RoutingEngine';
import { GoogleMapsService } from '../services/GoogleMapsService';
import { WalkingStrategy } from '../strategies/WalkingStrategy';
import { Coordinates, CandidatePoint } from '../models';

interface OptimizationParams {
  start: Coordinates;
  end: Coordinates;
  passengerHome: Coordinates;
  maxWalkingDistance: number;
}

export function useOptimization() {
  const [candidates, setCandidates] = useState<CandidatePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runOptimization = useCallback(async (params: OptimizationParams) => {
    setLoading(true);
    setError(null);
    setCandidates([]);

    try {
      // Initialize services
      const googleMapsService = new GoogleMapsService();
      const strategy = new WalkingStrategy();
      const routingEngine = new RoutingEngine(googleMapsService, strategy);

      // Run optimization
      const results = await routingEngine.optimize(
        params.start,
        params.end,
        params.passengerHome,
        params.maxWalkingDistance
      );

      setCandidates(results);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Optimization error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setCandidates([]);
    setError(null);
  }, []);

  return {
    candidates,
    loading,
    error,
    runOptimization,
    clearResults,
  };
}
```

---

### Task 3: Route Visualization Hook
**File:** `src/hooks/useRouteVisualization.ts`

```typescript
import { useState, useCallback } from 'react';
import { GoogleMapsService } from '../services/GoogleMapsService';
import { CandidatePoint, RouteVisualization, Coordinates } from '../models';

export function useRouteVisualization() {
  const [visualization, setVisualization] = useState<RouteVisualization | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVisualization = useCallback(async (
    candidate: CandidatePoint,
    start: Coordinates,
    end: Coordinates,
    passengerHome: Coordinates
  ) => {
    setLoading(true);
    setError(null);

    try {
      const googleMapsService = new GoogleMapsService();
      const result = await googleMapsService.getRouteVisualization(
        candidate,
        start,
        end,
        passengerHome
      );
      setVisualization(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load route visualization';
      setError(errorMessage);
      console.error('Visualization error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

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
```

---

### Task 4: Export Hooks
**File:** `src/hooks/index.ts`

```typescript
export * from './useJourneyState';
export * from './useOptimization';
export * from './useRouteVisualization';
```

---

## ✅ Completion Checklist

Before reporting completion, verify:

- [ ] All TypeScript files compile: `npx tsc --noEmit` (no errors)
- [ ] `useJourneyState` saves/loads from AsyncStorage correctly
- [ ] `useOptimization` calls `RoutingEngine.optimize()` correctly
- [ ] All hooks export correctly from `src/hooks/index.ts`
- [ ] No circular dependencies
- [ ] Error states handled gracefully
- [ ] Loading states managed properly

---

## 🧪 Testing Notes

You can test hooks in isolation:

```typescript
// Test useJourneyState
const { journey, saveJourney } = useJourneyState();
await saveJourney({
  startPoint: { lat: 40.7128, lon: -74.0060 },
  endPoint: { lat: 40.7589, lon: -73.9851 },
  passengerHome: { lat: 40.7282, lon: -73.9942 },
  stage: 'NOT_STARTED',
  timestamp: Date.now(),
});
```

**Note:** Hooks need React context, so full testing requires component integration (Agent D's job).

---

## 📤 Handoff Report

When complete, report to orchestrator:

```
✅ Agent C (State Management) Complete

Completed:
- useJourneyState: Journey persistence with AsyncStorage
- useOptimization: Integration with RoutingEngine
- useRouteVisualization: Route preview data fetching

Files Created:
- src/hooks/useJourneyState.ts
- src/hooks/useOptimization.ts
- src/hooks/useRouteVisualization.ts
- src/hooks/index.ts

Verification:
- ✅ TypeScript compilation: PASSED
- ✅ All exports working: PASSED
- ✅ No circular dependencies: PASSED

Ready for: Agent D (Frontend Integration)
```

---

## 🚨 If You Encounter Issues

1. **AsyncStorage errors:** Ensure `@react-native-async-storage/async-storage` is installed
2. **Import errors:** Verify paths to services and models are correct
3. **Type errors:** Check that imported types match Agent A's models
4. **Hook rules:** Ensure hooks follow React rules (only call at top level)

**Do NOT proceed if TypeScript compilation fails!** Fix all errors before reporting completion.

---

**Next Agent:** Agent D will use your hooks to build the UI components and screens.
