# R14 Task4: Fix R13遗留 P1/P2 Issues — Results

## Summary

Fixed all remaining R13 P1/P2 issues: z-order determinism for same-faction sprites, drop rate assertion tightening, and verified Tasks 1-3 fixes are in place.

## Changes

### 1. P1: Batch render z-order for same-faction sprites

**File:** `src/components/idle/panels/map/PixelWorldMap.tsx`

**Problem:** When batch-rendering, same-faction sprites were rendered in arbitrary order (input order), causing non-deterministic z-ordering when same-color sprites overlap.

**Fix:** Added `.sort()` by `startTime` before both Phase 1 (route rendering) and Phase 2 (sprite batch collection). Earlier-created sprites (lower startTime) render first (bottom layer), later-created sprites render on top.

```typescript
// R14 Task4: Sort marches by creation time for deterministic z-order
const sortedMarches = [...marches].sort((a, b) => a.startTime - b.startTime);
```

### 2. P2: Drop rate assertion tightening

**File:** `src/games/three-kingdoms/engine/map/__tests__/SiegeItemSystem.test.ts` (new)

**Problem:** Original test used 100 simulations with 15-25% range (5-35 actual), too wide to catch drift.

**Fix:** New test file with 500 simulations and binomial distribution 95% CI:
- N=500, p=0.20 → μ=100, σ≈8.94
- ±2σ → [82, 118]
- Also tightened existing test in `SiegeReward.drop.test.ts` from [5,35] to [10,30]

### 3. Tasks 1-3 Verification

| Check | Status | Evidence |
|-------|--------|----------|
| SettlementPipeline import at top (< line 30) | PASS | `import { SIEGE_REWARD_CONFIG } from '../../core/map';` at line 24 |
| No hardcoded baseGrain=100 or baseGold=50 in SettlementPipeline | PASS | Uses `SIEGE_REWARD_CONFIG.baseGrain/baseGold` (lines 410-412) |
| SiegeResultCalculator not directly called in production code | PASS | Only used internally as `private calculator` in SettlementPipeline class |

### 4. New Tests

**File:** `src/components/idle/panels/map/__tests__/PixelWorldMap.batch-render.test.tsx`
- `同阵营精灵按startTime排序 — 更早创建的精灵在底层(先渲染)` — verifies sorting determinism with 3 same-faction sprites in shuffled order
- `不同创建时间的同阵营精灵 — 乱序传入后渲染结果确定性` — verifies 5 same-faction sprites produce identical output regardless of input order

**File:** `src/games/three-kingdoms/engine/map/__tests__/SiegeItemSystem.test.ts` (new)
- `500次模拟掉落数在82~118之间 (±2σ, p=0.20)` — tightened binomial CI test
- `确定性hash: 相同taskId总是返回相同掉落结果` — determinism regression
- `hashCode稳定且非负` — hash function regression
- 3 basic SiegeItemSystem regression tests (acquire/consume, stack limit, reset)

## Test Results

```
✓ PixelWorldMap.batch-render.test.tsx (22 tests) — 136ms
✓ SiegeItemSystem.test.ts (6 tests) — 2ms
✓ SiegeReward.drop.test.ts (17 tests) — 3ms
```

## TypeScript Check

No new TypeScript errors introduced. Pre-existing errors in `PathfindingSystem.ts` (WalkabilityGrid) are unrelated.
