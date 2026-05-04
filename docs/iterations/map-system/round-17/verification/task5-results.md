# Task 5 Results: Terrain test supplement + PLAN.md update

## Part A: Terrain non-transition zero-redraw assertions

**File**: `src/components/idle/panels/map/__tests__/PixelWorldMap.terrain-persist.test.tsx`

Added 2 new tests in describe block "Non-transition zero-redraw assertions":

1. **sprites dirty stays true across frames** - Verifies terrain is NOT redrawn when sprites dirty flag remains true across multiple animation frames (no transition). Asserts non-transition frame fillRect counts are strictly less than the initial transition frame.

2. **effects dirty stays true across frames** - Verifies terrain is NOT redrawn when effects dirty flag remains true across multiple siege animation frames (no transition). Asserts non-transition frame fillRect counts are strictly less than the initial transition frame.

**Test run**: 12/12 passed (10 existing + 2 new)

## Part B: PLAN.md updates

**File**: `docs/iterations/map-system/PLAN.md`

### Status changes:
- I3: ⬜ → ✅ (攻城锁定机制)
- I10: ⬜ → ✅ (攻占任务面板)
- I11: 🔄 → ✅ (行军精灵持续时间约束)
- E1-3: ⬜ → ✅ (行军E2E全链路测试)
- R17 iteration row: ⬜ → ✅

### Statistics updates:
- E系列: 5/6 → 6/6
- I系列: 13/15 → 16/17
- 总计: 56/65 (86%) → 60/67 (90%)
- 质量指标表: Added R17 column (地形持久化测试 12)
- 迭代记录表: Added R17 row (2026-05-04, 5 P0 tasks)
- R16未完成清单: Updated to show R17 completions
- R17完成 section: Added with 5 completed items
