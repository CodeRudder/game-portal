# Round 7 Report: FL-BLD-08 工坊锻造 L3+ Depth Refinement

**Date**: 2026-05-05
**Flow**: FL-BLD-08 (工坊锻造)
**Scope**: Deepen all 8 steps to L3+ depth, covering 10 focus areas

## Changes Summary

### FL-BLD-08-01 进入炼制Tab
- Added system behavior table: 5 distinct loading stages (efficiency, quality cap, material inventory, equipment bag, batch forge status) with data sources
- Added full spatial layout wireframe showing material inventory bar (ore/wood/gold + production rates), quality cap indicator, and slot selection zone
- Added material inventory display rules: red text when below minimum, click for tooltip showing source mine/lumber production rates
- Added 3 new exception cases: workshop not built, workshop upgrading, empty material stock

### FL-BLD-08-02 选择装备部位
- Added equipment slot main stat mapping table: weapon=ATK, armor=DEF, accessory=HP, mount=SPD with 5 sub-stat pools per slot
- Added visual preview wireframe: 4 slot buttons (90x64px each) + selected slot preview zone (380x48px) showing main stat, sub-stat pool, and owned count
- Added system behavior table: 5 behaviors triggered on slot switch with data sources
- Added 2 new exception cases: bag full for that slot, no data for slot

### FL-BLD-08-03 选择锻造模式
- Added complete forging mode parameter table: base ore/wood/gold costs for quick/refine/divine
- Added efficiency discount calculation examples with actual numbers (workshop Lv.7, +21.6% efficiency)
- Added quality probability tables with quality cap redistribution logic across all 9 combinations (workshop level x forging mode)
- Added mode card visual wireframe: selected state, disabled state, material-insufficient state
- Added system behavior table: 5 behaviors including efficiency calculation, actual cost, material check, availability, and quality probability tooltip

### FL-BLD-08-04 执行锻造
- Added 11-step execution sequence table with user perception, system behavior, and timing per step
- Added quality draw algorithm pseudocode with quality cap enforcement
- Added attribute generation algorithm pseudocode: main stat (slot base x quality multiplier), sub-stats (random from pool, no replacement, ~30% of main with +-20% variance), special effects (purple/orange only, slot-specific pools)
- Added resource deduction defense mechanism table: 5 checkpoints (frontend pre-check, server pre-check, server transaction, network timeout, result inconsistency)
- Added 5 new exception cases with specific error messages

### FL-BLD-08-05 锻造结果展示
- Added complete equipment card wireframe (360x320px) with main stat, sub-stats (with count), and special effect sections
- Added quality effect tier table: border color, glow effect, background effect, and sound effect for all 5 tiers
- Added action button detail table: equip (links to hero system), decompose (links to 08-07), continue forging (links to 08-03)
- Added equipment naming rules table: 5 quality tiers x 4 slots with culturally appropriate Three Kingdoms names
- Added system behavior table: 4 post-forging behaviors (auto inventory, material update, forge log, statistics update)

### FL-BLD-08-06 装备强化
- Added complete enhancement cost formula with quality base values, level scaling (1+0.3xlevel), workshop discount
- Added cost calculation examples for 7 scenarios (white/blue/purple/orange at different levels)
- Added enhancement panel wireframe showing equipment preview with before/after stats, progress bar, cost breakdown, and consecutive enhancement options
- Added consecutive enhancement mechanism: x1/x5/x10 with auto-stop at +15, 100% success rate (design decision)
- Added 7-step system behavior sequence with timing
- Added 5 exception cases including consecutive enhancement mid-insufficient and mid-max-level scenarios

### FL-BLD-08-07 装备分解
- Added complete decomposition recycle rate formula: base 30% + workshop_level x 1.5%, capped at 60%
- Added enhanced equipment additional recovery formula: 50% of forge recycle rate for enhancement materials
- Added recycle calculation examples for 3 equipment types at workshop Lv.7 (40.5% rate)
- Added decomposition panel wireframe: recycle rate indicator, scrollable equipment list with per-item recycle preview, batch selection, and confirmation preview
- Added decomposition rules table: unworn-only, batch selection, confirmation dialog, animation, permanent destroy, purple/orange warning
- Added 9-step system behavior sequence with timing

### FL-BLD-08-08 批量锻造
- Added batch forge entry button design in bottom button area (only visible at Lv10+)
- Added batch forge panel wireframe: slot selection, mode selection, quantity selection (x5/x10/custom 1-20), cost preview with max forgeable count
- Added 6-step batch execution sequence with progress indicator and fast animation (200ms per card)
- Added batch results summary panel wireframe: quality statistics bar chart, best item highlight, expandable detail list
- Added max forgeable count calculation formula
- Added 5 exception cases including partial failure handling

## New Constraints Added (R7)

1. Equipment slot main stat mapping (weapon/armor/accessory/mount)
2. Forging mode material baselines (ore/wood/gold for 3 modes)
3. Quality probability tables with quality cap redistribution
4. Enhancement cost formula with quality base, level scaling, workshop discount
5. Decomposition recycle rate formula with workshop bonus, enhancement material recovery
6. Attribute generation algorithm: main stat + sub-stats + special effects
7. Equipment naming rules by quality and slot
8. Material flow diagram: mine/lumber/market -> workshop -> equipment -> hero

## Exception Handling Expansion

- Previous: 5 exception IDs (E-08-01 through E-08-05)
- Current: 12 exception IDs (E-08-01 through E-08-12)
- New exceptions: bag full, server transaction failure, consecutive enhancement edge cases, purple/orange decompose warning, batch partial failure, workshop upgrading, max enhancement level
