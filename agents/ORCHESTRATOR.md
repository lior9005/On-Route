> **Historical, out of date.** This is the original build plan; the app has changed since (Routes/Places APIs (New), web support, street meeting points). See `AGENTS.md` in the repo root and the code instead.

# Multi-Agent Orchestrator
## On-Route: Multi-Modal Drop-off Optimizer

**Purpose:** Coordinate 4 specialized agents to build the complete mobile application.

---

## 🎯 Agent Overview

| Agent | Name | Scope | Dependencies | Estimated Time |
|-------|------|-------|--------------|----------------|
| **A** | Foundation | Setup, Models, Utils | None | 2-3 hours |
| **B** | Backend | Strategies, Services, Engine | Agent A | 4-5 hours |
| **C** | State Management | Hooks, Persistence | Agent A, B | 2-3 hours |
| **D** | Frontend | UI Components, Integration | Agent A, B, C | 5-6 hours |

**Total Estimated Time:** 13-17 hours (parallel execution reduces to ~8-10 hours)

---

## 📋 Execution Workflow

### Phase 1: Foundation (Agent A)
```
Status: [PENDING] → [IN_PROGRESS] → [COMPLETE]
```

**Agent A Must Complete:**
- ✅ Project initialization (Expo TypeScript)
- ✅ All TypeScript interfaces/models
- ✅ Utility functions
- ✅ Environment configuration
- ✅ Constants file

**Handoff Checkpoint:**
- [ ] All files compile without errors (`npx tsc --noEmit`)
- [ ] `.env.example` created (no secrets)
- [ ] All models exported from `src/models/index.ts`
- [ ] All utilities exported from `src/utils/index.ts`

**Deliverables for Next Agents:**
- TypeScript interfaces: `Coordinates`, `RouteLeg`, `PassengerLeg`, `CandidatePoint`, `Journey`, `RouteVisualization`
- Config: `CONFIG` object with all constants
- Utils: `distance.ts`, `validation.ts`, `polylineDecoder.ts`

---

### Phase 2: Backend Services (Agent B)
```
Status: [BLOCKED] → [IN_PROGRESS] → [COMPLETE]
Dependencies: Agent A must be [COMPLETE]
```

**Agent B Must Complete:**
- ✅ Strategy Pattern: `IDropOffStrategy`, `WalkingStrategy`, `TransitStrategy` (placeholder)
- ✅ `GoogleMapsService` with all API methods
- ✅ `WazeService` for deep linking
- ✅ `RoutingEngine` optimization algorithm

**Handoff Checkpoint:**
- [ ] All services compile
- [ ] Strategy pattern tests pass (unit tests for `WalkingStrategy`)
- [ ] `GoogleMapsService` methods return correct TypeScript types
- [ ] `RoutingEngine.optimize()` returns `Promise<CandidatePoint[]>`
- [ ] No hardcoded API keys (use `process.env.GOOGLE_MAPS_API_KEY`)

**Deliverables for Next Agents:**
- Service classes ready for dependency injection
- Strategy interface that hooks can use
- Error handling in place (try-catch, typed errors)

---

### Phase 3: State Management (Agent C)
```
Status: [BLOCKED] → [IN_PROGRESS] → [COMPLETE]
Dependencies: Agent A [COMPLETE], Agent B [COMPLETE]
```

**Agent C Must Complete:**
- ✅ `useJourneyState` hook with AsyncStorage persistence
- ✅ `useOptimization` hook that uses `RoutingEngine`
- ✅ State management utilities

**Handoff Checkpoint:**
- [ ] Hooks compile and export correctly
- [ ] `useJourneyState` saves/loads from AsyncStorage
- [ ] `useOptimization` calls `RoutingEngine` correctly
- [ ] No circular dependencies

**Deliverables for Next Agents:**
- React hooks ready to use in components
- State persists across app restarts
- Loading/error states handled

---

### Phase 4: Frontend Integration (Agent D)
```
Status: [BLOCKED] → [IN_PROGRESS] → [COMPLETE]
Dependencies: Agent A [COMPLETE], Agent B [COMPLETE], Agent C [COMPLETE]
```

**Agent D Must Complete:**
- ✅ All UI components
- ✅ Route Preview Screen
- ✅ Main screen orchestration
- ✅ Navigation flow
- ✅ Manual testing checklist

**Final Checkpoint:**
- [ ] App builds successfully (`npx expo start`)
- [ ] All screens render without crashes
- [ ] Navigation flow works end-to-end
- [ ] Waze deep linking works
- [ ] Route preview displays correctly

---

## 🔄 Handoff Protocol

### When Agent A Completes:
1. **Agent A reports:** "Foundation complete. All models exported from `src/models/index.ts`"
2. **Orchestrator verifies:**
   ```bash
   cd /Users/lior.sha/Desktop/On-Route
   npx tsc --noEmit  # Should pass
   ls src/models/*.ts  # Verify files exist
   ```
3. **Orchestrator signals:** "Agent B can begin"

### When Agent B Completes:
1. **Agent B reports:** "Backend services complete. RoutingEngine.optimize() returns CandidatePoint[]"
2. **Orchestrator verifies:**
   ```bash
   npx tsc --noEmit  # Should pass
   # Check that GoogleMapsService methods exist
   ```
3. **Orchestrator signals:** "Agent C can begin"

### When Agent C Completes:
1. **Agent C reports:** "State hooks complete. useOptimization integrates with RoutingEngine"
2. **Orchestrator verifies:**
   ```bash
   npx tsc --noEmit  # Should pass
   # Check hooks export correctly
   ```
3. **Orchestrator signals:** "Agent D can begin"

### When Agent D Completes:
1. **Agent D reports:** "Frontend complete. App builds and runs"
2. **Orchestrator verifies:**
   ```bash
   npx expo start  # Should launch without errors
   ```
3. **Orchestrator signals:** "✅ Project complete"

---

## 📐 Interface Contracts

### Agent A → Agent B Contract
```typescript
// Agent A must export:
export interface Coordinates { lat: number; lon: number; }
export interface RouteLeg { duration: number; distance: number; }
export interface PassengerLeg extends RouteLeg { mode: 'WALK' | 'TRANSIT'; }
export interface CandidatePoint { /* ... */ }
export interface Journey { /* ... */ }
export interface RouteVisualization { /* ... */ }

// Agent B imports from:
import { Coordinates, CandidatePoint, PassengerLeg } from '../models';
```

### Agent B → Agent C Contract
```typescript
// Agent B must export:
export interface IDropOffStrategy {
  validate(...): Promise<PassengerLeg | null>;
}
export class GoogleMapsService { /* ... */ }
export class WazeService { /* ... */ }
export class RoutingEngine {
  async optimize(...): Promise<CandidatePoint[]>;
}

// Agent C imports from:
import { RoutingEngine } from '../services/RoutingEngine';
import { IDropOffStrategy } from '../strategies/IDropOffStrategy';
```

### Agent C → Agent D Contract
```typescript
// Agent C must export:
export function useJourneyState() { /* ... */ }
export function useOptimization() { /* ... */ }

// Agent D imports from:
import { useJourneyState, useOptimization } from '../hooks';
```

---

## 🚨 Conflict Resolution

### If Two Agents Modify Same File:
1. **Stop both agents immediately**
2. **Orchestrator reviews:** Which agent's changes are correct?
3. **Orchestrator merges:** Manually resolve conflicts
4. **Resume agents:** Continue from checkpoint

### If Agent Reports Blocking Issue:
1. **Agent reports:** "Cannot proceed because [dependency] missing"
2. **Orchestrator checks:** Is dependency agent complete?
3. **If yes:** Investigate why interface contract broken
4. **If no:** Wait for dependency agent to complete

### If Type Errors Appear:
1. **Agent reports:** "TypeScript errors in [file]"
2. **Orchestrator checks:** Are imported types from other agent correct?
3. **Fix:** Update interface contract or agent implementation

---

## 📊 Progress Tracking

### Current Status Board:
```
Agent A (Foundation):     [PENDING]
Agent B (Backend):        [BLOCKED] - Waiting for A
Agent C (State):          [BLOCKED] - Waiting for A, B
Agent D (Frontend):       [BLOCKED] - Waiting for A, B, C
```

### Update This Board After Each Handoff:
- Change status from `[PENDING]` → `[IN_PROGRESS]` when agent starts
- Change status from `[IN_PROGRESS]` → `[COMPLETE]` when agent finishes
- Change status from `[BLOCKED]` → `[IN_PROGRESS]` when dependencies met

---

## ✅ Final Verification Checklist

Before marking project complete:

- [ ] All TypeScript files compile (`npx tsc --noEmit`)
- [ ] App builds (`npx expo start` launches)
- [ ] No console errors on startup
- [ ] All imports resolve correctly
- [ ] Environment variables configured (`.env` exists)
- [ ] Route preview screen displays map
- [ ] Waze deep linking works
- [ ] Journey state persists (test by force-quitting app)
- [ ] Optimization algorithm returns candidates
- [ ] UI components render without crashes

---

## 🎯 Success Criteria

**Project is complete when:**
1. User can enter three addresses (A, B, C)
2. App finds optimal drop-off point (D)
3. User views route preview on map
4. User presses "Let's Go!" → Waze opens to D
5. User completes first leg → Returns to app
6. User presses "Navigate to Destination" → Waze opens to C

**All of the above works end-to-end without crashes.**

---

## 📝 Notes for Orchestrator

- **Do NOT start Agent B until Agent A reports completion**
- **Do NOT start Agent C until Agent B reports completion**
- **Do NOT start Agent D until Agent C reports completion**
- **Verify each handoff checkpoint before proceeding**
- **Keep this document updated with current status**

---

**Last Updated:** [Date when orchestrator created]
**Current Phase:** Phase 1 (Agent A - Foundation)
**Next Action:** Start Agent A with `agents/AGENT-A-FOUNDATION.md`
