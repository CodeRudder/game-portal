# Task 3 Results: Fix status markers for G4/H7/I1/I2/I6 and G5 integration

**Date**: 2026-05-04
**Round**: R18

## Part A: Status Marker Fixes

### I1 - 攻城策略选择UI(强攻/围困/夜袭/内应)
- **Before**: status=🔄, engine=✅, UI=✅
- **After**: status=✅
- **Evidence**: `SiegeConfirmModal.tsx` lines 392-450 contain full strategy selection grid with SIEGE_STRATEGY_CONFIGS rendering forceAttack/siege/nightRaid/insider cards. `WorldMapTab.tsx` wires `selectedStrategy`/`setSelectedStrategy` state and passes to confirm modal.

### I2 - 内应信三态卡片(可点击/暴露冷却/道具不足)
- **Before**: status=🔄, engine=✅, UI=✅
- **After**: status=✅
- **Evidence**: `SiegeConfirmModal.tsx` lines 227-251 implement three-state logic: (1) clickable when `insiderLetterCount > 0 && !insiderExposed`, (2) exposed cooldown when `insiderExposed` with `insiderCooldownText`, (3) item insufficient when `insiderLetterCount <= 0`. States rendered at lines 431-444.

### I6 - 首次/重复攻城奖励(元宝+声望+称号)
- **Before**: status=🔄, engine=⚠️, UI=✅
- **After**: status=✅, engine=✅, UI=✅
- **Evidence**:
  - Engine: `SiegeResultCalculator.calculateSettlement()` line 97: `context.isFirstCapture ? baseMultiplier * 1.5 : baseMultiplier` applies 1.5x reward for first capture.
  - Engine: `SettlementPipeline.distribute()` line 406: `ctx.isFirstCapture ? multiplier * 1.5 : multiplier` applies first capture bonus in settlement flow.
  - Engine: `SiegeSystem.ts` has `isFirstCapture()` method used by `WorldMapTab` to pass `isFirstCapture` prop.
  - UI: `SiegeConfirmModal.tsx` lines 453-462 display first capture badge with rewards preview (元宝x100, 声望+50, 专属称号).

### G4 - 编队UI组件(将领选择+兵力分配)
- **Before**: status=🔄
- **After**: status=✅
- **Evidence**: `ExpeditionForcePanel.tsx` (311 lines) implements full expedition force selection UI with:
  - Hero selection from available heroes (filtering out injured/busy)
  - Injured heroes display with injury level and recovery time
  - Busy heroes display
  - Troop allocation slider (min 100, max=maxTroops)
  - Validation (must have hero + min 100 troops)
  - Tests: `ExpeditionForcePanel.test.tsx` exists

### H7 - 将领受伤影响战力
- **Before**: status=🔄
- **After**: status=✅
- **Evidence**:
  - `expedition-types.ts` line 133-138: `INJURY_POWER_MULTIPLIER = { none: 1.0, minor: 0.8, moderate: 0.5, severe: 0.2 }`
  - `ExpeditionSystem.ts`:
    - `getHeroPowerMultiplier(heroId)` line 308-311: returns `INJURY_POWER_MULTIPLIER[injury]`
    - `calculateEffectivePower(force)` line 336-339: facade for effective power calculation
    - `calculateRemainingPower(forceId)` line 385-392: `basePower = troops * heroMultiplier` where heroMultiplier accounts for injury
    - `getInjuryPowerModifier(injuryLevel)` line 321-323: pure function for power modifier
  - Tests verify power multiplier is correctly applied.

## Part B: G5 Integration Verification

### G5 - 攻城确认弹窗集成编队选择
- **Before**: status=⬜
- **After**: status=✅
- **Analysis**: G5 is already fully wired. The integration chain is:

1. **State management** (`WorldMapTab.tsx`):
   - Line 203: `expeditionSelection` state with `ExpeditionForceSelection` type
   - Line 206: `selectedStrategy` state for siege strategy

2. **SiegeConfirmModal receives expedition props** (`WorldMapTab.tsx` lines 1603-1626):
   - `heroes={heroes}` - available hero list from engine
   - `expeditionSelection={expeditionSelection}` - current selection
   - `onExpeditionChange={setExpeditionSelection}` - selection callback
   - `selectedStrategy`, `onStrategyChange` - strategy props

3. **SiegeConfirmModal renders ExpeditionForcePanel** (lines 465-475):
   - Panel shown when `hasHeroes && onExpeditionChange`
   - Disabled when conditions not met

4. **handleSiegeConfirm uses expedition data** (`WorldMapTab.tsx` lines 1109-1207):
   - Line 1150-1163: Creates expedition object from `expeditionSelection` with heroId, heroName, troops
   - Falls back to default hero if no expedition selection
   - Line 1181-1184: Uses selected hero name for march creation

5. **Task creation includes expedition** (line 1144-1165):
   - `expedition` field populated with forceId, heroId, heroName, troops from selection

### Data Flow Summary
```
User selects hero + troops in ExpeditionForcePanel
  -> expeditionSelection state updated
  -> handleSiegeConfirm reads expeditionSelection
  -> siegeTaskManager.createTask({ expedition: { heroId, heroName, troops } })
  -> marchingSystem.createMarch with hero name and troop count
  -> On march arrival, task expedition data used for battle + settlement
```

## PLAN.md Statistics Update

| Category | Total | Completed | Remaining |
|----------|-------|-----------|-----------|
| G series | 6 | 6 | 0 |
| H series | 7 | 7 | 0 |
| I series | 15 | 12 | 3 (I4, I5 only unfinished) |
| **Overall** | **65** | **61** | **4** |

**Completion rate**: 61/65 = 93.8% (was 84.6%)

### Remaining unfinished items
- I4: 攻城中断处理 (延期)
- I5: 城防衰减显示 (UI missing)
- F2: 更新MAP-INTEGRATION-STATUS.md (🔄)
- F3: 更新测试覆盖文档 (⬜)

## Tests

All status marker changes are documentation-only (PLAN.md). No code changes were made that would affect test results. G5 was already fully integrated - verified by code analysis of the data flow chain from ExpeditionForcePanel through SiegeConfirmModal to WorldMapTab.handleSiegeConfirm.
