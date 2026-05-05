# Judge Ruling: Round 18

**Date**: 2026-05-04
**Judge**: Independent Arbiter

---

## Executive Summary

After cross-examining the Builder Manifest and Challenger Attack Report against actual source code, the Judge **confirms 0 P0, 2 P1, 5 P2, and 3 P3 issues**. Several of the Challenger's most severe claims (C1-P0, C2-P0, C3-P0) are **overturned** because they rely on stale or incorrect code assumptions -- the actual `SiegeTaskPanel.tsx` already contains `paused` status mappings in all three required locations.

| Severity | Count | Challenges |
|:--------:|:-----:|:-----------|
| **P0** | 0 | None confirmed |
| **P1** | 2 | C1 (downgraded from P0), C8 |
| **P2** | 5 | C4, C5, C6, C7, C9 |
| **P3** | 2 | C3, C10 |
| **OVERRULED** | 1 | C2 (factually incorrect) |

---

## Detailed Rulings

### C1 [Challenger: P0 -> Judge: P1 CONFIRMED, DOWNGRADED]

**Claim**: pause/resume/cancel have zero UI wiring -- Task 1 core feature is dead code.

**Finding**: PARTIALLY CONFIRMED, but severity downgraded from P0 to P1.

- **Confirmed**: No UI button, event listener, or code path in `WorldMapTab.tsx` (1682 lines) calls `pauseSiege()`, `resumeSiege()`, or `cancelSiege()`. Grep across all non-test production `src/` files confirms these methods only appear in `SiegeTaskManager.ts` itself. The user cannot trigger pause/resume/cancel through any UI interaction.
- **Downgrade rationale (P0 -> P1)**: P0 requires "feature completely unavailable / crash / data loss." The engine implementation is correct and functional -- it can be invoked programmatically (e.g., via console or future UI wiring). The feature is "implemented but unreachable," which is P1 (core function exists but is not reachable), not P0 (function completely unavailable). A simple UI button addition would activate the feature.

**Impact**: Task 1's siege interrupt is engine-only. Users cannot pause/resume/cancel sieges through the UI. This is a significant integration gap but not a system failure.

---

### C2 [Challenger: P0 -> Judge: OVERRULED]

**Claim**: `SiegeTaskPanel.tsx` has 3 TypeScript compile errors (TS2741/TS2366) because `paused` is missing from `STATUS_LABELS`, `STATUS_COLORS`, and `getStatusIcon`.

**Finding**: FACTUALLY INCORRECT -- OVERRULED.

Actual code inspection of `src/components/idle/panels/map/SiegeTaskPanel.tsx` reveals:

| Location | Line | Contains `paused`? |
|----------|:----:|:------------------:|
| `STATUS_LABELS` | 53 | YES: `paused: '已暂停'` |
| `STATUS_COLORS` | 64 | YES: `paused: '#ff9800'` |
| `getStatusIcon` switch | 112 | YES: `case 'paused': return '⏸'` |

Furthermore, live TypeScript compilation (`tsc --noEmit`) produces **zero errors** in `SiegeTaskPanel.tsx`. The Builder's own manifest erroneously lists these as errors (lines 48-50), and the Challenger relied on the Builder's incorrect claim.

**Verdict**: Both Builder and Challenger were wrong about these TS errors. The `SiegeTaskPanel.tsx` already correctly handles the `paused` status in all three mappings. C2 is OVERRULED.

**Note**: This also invalidates C3's claim that `getStatusIcon` would return undefined for `paused`, and C10's claim about missing status mappings. However, C3 and C10 raise additional points (progress bar) that are assessed independently.

---

### C3 [Challenger: P0 -> Judge: P3 CONFIRMED, DOWNGRADED]

**Claim**: `getProgressPercent()` has no `case 'paused'` branch, so paused tasks show 0% progress. Also, the progress bar condition does not render for `paused` status.

**Finding**: CONFIRMED but severity downgraded to P3 (minor cosmetic).

- **Confirmed**: `getProgressPercent()` (line 152-184) has no explicit `case 'paused'`, falling into `default: return 0`. The progress bar render condition (line 340) checks `marching/sieging/returning/settling` but not `paused`.
- **Downgrade rationale**: The paused task will still appear in the active task list with correct status icon, label, and color. The only visual gap is: (1) no progress bar, and (2) the status label and icon are correct (per C2 overruling). A paused task not showing a progress bar is arguably correct UX behavior (the task is paused, so showing static progress would require additional snapshot logic). This is a P3 (minor) cosmetic issue, not a P0 functional failure.

---

### C4 [Challenger: P1 -> Judge: P2 CONFIRMED, DOWNGRADED]

**Claim**: Defense recovery occurs only in `completed` phase but `renderCompletedPhase` does not render the defense bar, so recovery is invisible.

**Finding**: CONFIRMED, but downgraded to P2.

- **Confirmed**: `SiegeBattleAnimationSystem.update()` (line 268-270) only recovers defense when `anim.phase === 'completed' && anim.victory === false`. The `renderCompletedPhase` function (line 774-830) renders victory flags or gray smoke effects, not the defense bar. The defense bar is rendered only in `renderBattlePhase` (line 716-764).
- **Downgrade rationale**: The defense decay display (the primary I5 requirement) works correctly during the `battle` phase -- the defense bar renders in real-time with color interpolation. The *recovery* portion after battle completion is a secondary enhancement. The user sees defense decreasing during siege, which fulfills the core I5 requirement ("城防衰减显示"). The recovery animation is a visual gap, not a core function failure.
- **Impact**: P2 -- UX degradation. Defense recovery happens in engine state but is not visually reflected in the completed phase animation.

---

### C5 [Challenger: P1 -> Judge: P2 CONFIRMED, DOWNGRADED]

**Claim**: No E2E/integration tests for the full interrupt flow (pause -> reconnect -> resume).

**Finding**: CONFIRMED as P2.

- **Confirmed**: All 26 interrupt tests are unit tests for `SiegeTaskManager` using mock eventBus and mock MarchingSystem. No integration test spans `WorldMapTab -> SiegeTaskManager -> MarchingSystem`.
- **Downgrade rationale**: The unit tests do verify the core interrupt logic correctly. The lack of integration tests is a test coverage gap (P2), not a functional defect (P1). The engine methods work as tested; what is untested is the wiring between components -- which is already covered by C1's P1 finding.

---

### C6 [Challenger: P1 -> Judge: P2 CONFIRMED, DOWNGRADED]

**Claim**: Task 3 produced zero code changes and should not count as "completed."

**Finding**: CONFIRMED as P2.

- **Confirmed**: Task 3 results state "No code changes were made that would affect test results." It was a verification/audit task for G5 integration and status marker review.
- **Downgrade rationale**: A verification/confirmation task is legitimate in an iteration -- it confirms existing code is correct and updates documentation. However, counting it as equivalent to Tasks 1/2/4 (which produced code changes) inflates the completion narrative. This is a documentation/process issue (P2), not a functional defect.

---

### C7 [Challenger: P1 -> Judge: P2 CONFIRMED, DOWNGRADED]

**Claim**: PLAN.md was not updated despite Task 4 Part C claiming statistics recount.

**Finding**: CONFIRMED as P2.

- **Confirmed**: `PLAN.md` still shows `I4 = ⬜` (line 145) and `I5 = ⬜` (line 146) despite Task 1 and Task 2 implementing engine code for these items. Task 4 Part C claimed "statistics verified at 93.8%" but did not actually update the PLAN.md markers.
- **Downgrade rationale**: This is a documentation inconsistency (P2), not a functional issue. The code exists and works; the documentation is stale.
- **Builder self-contradiction**: The Builder correctly identified this in their own manifest (Issue #2, Issue #3) but still marked Task 4 Part C as "PASS."

---

### C8 [Challenger: P1 -> Judge: P1 CONFIRMED]

**Claim**: `cancelSiege` hardcodes `faction: 'neutral'` instead of using the player's faction.

**Finding**: CONFIRMED as P1.

- **Confirmed**: `SiegeTaskManager.ts` line 366 sets `faction: 'neutral'` in the `createReturnMarch` call. In contrast, `WorldMapTab.tsx` line 649 uses `faction: 'wei'` for normal return marches.
- **Analysis**: `FACTION_COLORS` in `ConquestAnimation.ts` maps `neutral` to `#6B5B3E` (brown) and `wei` to `#2E5090` (blue). The return march from a cancelled siege would render in brown (neutral) instead of blue (player faction). This is a semantic error -- cancelled siege troops returning home should belong to the player's faction.
- **Impact**: P1 -- functional defect. The cancelled siege's return march will render with incorrect faction color, creating visual inconsistency. The `SiegeTask` data structure stores `expedition` with faction information that should be used here.

---

### C9 [Challenger: P2 -> Judge: P2 CONFIRMED]

**Claim**: `cancelSiege` integration with `MarchingSystem` is only tested with mocks.

**Finding**: CONFIRMED as P2.

- **Confirmed**: Tests use a hand-written mock for `marchingSystem.createReturnMarch()`. No test verifies real `MarchingSystem` compatibility.
- **Impact**: P2 -- test confidence gap. Combined with C8's faction issue, the mock test validated the wrong `faction` value, giving false confidence.

---

### C10 [Challenger: P2 -> Judge: P3 CONFIRMED, DOWNGRADED]

**Claim**: `activeTasks` filter includes `paused` tasks but progress bar condition and `getProgressPercent` don't handle `paused`.

**Finding**: CONFIRMED as P3 (subsumed by C3).

- **Confirmed**: `activeTasks` (line 204) filters `t.status !== 'completed'`, so `paused` tasks appear in the active list. Progress bar condition (line 340) does not include `paused`. `getProgressPercent` has no `case 'paused'`.
- **However**: The task will still display correctly with the right icon (⏸), label ("已暂停"), and color (#ff9800) per the C2 overruling. The only gap is no progress bar for paused tasks.
- **Downgrade**: P3 -- this is a minor UX gap, arguably intentional (a paused task shouldn't show dynamic progress).

---

## Corrected Verdict Matrix

| Challenge | Challenger Severity | Judge Severity | Verdict | Rationale |
|:---------:|:-------------------:|:--------------:|:-------:|-----------|
| C1 | P0 | **P1** | CONFIRMED (downgraded) | Engine-only, no UI wiring -- real gap but feature exists |
| C2 | P0 | -- | **OVERRULED** | Factually incorrect -- `paused` IS in all 3 mappings, no TS errors |
| C3 | P0 | **P3** | CONFIRMED (downgraded) | Minor cosmetic -- no progress bar for paused (arguably correct UX) |
| C4 | P1 | **P2** | CONFIRMED (downgraded) | Recovery invisible in completed phase; decay display works during battle |
| C5 | P1 | **P2** | CONFIRMED (downgraded) | Test coverage gap, not functional defect |
| C6 | P1 | **P2** | CONFIRMED (downgraded) | Process/documentation issue |
| C7 | P1 | **P2** | CONFIRMED (downgraded) | Documentation staleness |
| C8 | P1 | **P1** | CONFIRMED | Wrong faction in cancelSiege return march -- real functional defect |
| C9 | P2 | **P2** | CONFIRMED | Mock-only test gives false confidence |
| C10 | P2 | **P3** | CONFIRMED (downgraded) | Subsumed by C3; minor cosmetic gap |

---

## Task-by-Task Rerating

| Task | Builder Rating | Judge Rating | Notes |
|:----:|:--------------:|:------------:|-------|
| Task 1 (I4 Siege Interrupt) | PASS with caveat | **PARTIAL PASS** | Engine complete + UI status mappings complete; but no UI trigger buttons (P1) + wrong cancel faction (P1) |
| Task 2 (I5 Defense Decay) | PASS | **PASS** | Defense decay display works during battle phase; recovery rendering gap is P2 |
| Task 3 (G5 Status Fixes) | PASS | **VERIFIED (no-op)** | No code changes; documentation/verification only |
| Task 4 (P2 Cleanup) | PASS | **PARTIAL PASS** | Tests added (good); PLAN.md not updated (P2) |

---

## Key Observations

1. **Challenger C2 was the linchpin of the P0 case** -- and it was factually wrong. The `SiegeTaskPanel.tsx` already contains `paused` in `STATUS_LABELS` (line 53), `STATUS_COLORS` (line 64), and `getStatusIcon` (line 112). Both Builder and Challenger incorrectly stated these were missing, and the Builder erroneously reported TS compilation errors that do not exist. Live `tsc --noEmit` confirms zero errors in `SiegeTaskPanel.tsx`.

2. **The real issues are integration gaps**, not broken code. The engine works, the UI component handles `paused` status correctly, but nothing connects them (C1). This is a P1 wiring gap, not a P0 system failure.

3. **C8 is the most impactful real bug** -- `cancelSiege` using `faction: 'neutral'` instead of the player's faction is a genuine semantic error that will produce visually incorrect return marches.

4. **Builder's self-assessment was more honest than given credit for**. The Builder correctly identified the SiegeTaskPanel caveat and PLAN.md staleness. However, the Builder's claim of TS errors in SiegeTaskPanel was incorrect, which paradoxically made the Challenger's P0 case look stronger than it was.

---

## Final Count

**P0: 0, P1: 2, P2: 5, P3: 2**

Builder's "PASS with 2 issues" is somewhat overstated but the Challenger's "3 P0 issues" is substantially overstated. The accurate assessment is: **PASS with 2 P1 integration/semantic issues and 7 lower-severity gaps**.
