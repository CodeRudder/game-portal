# Round 7 Issues: FL-BLD-08 工坊锻造 L3+ Depth Refinement

**Date**: 2026-05-05
**Flow**: FL-BLD-08 (工坊锻造)

## Issues Found

### I-08-01: Equipment slot sub-stat pool values need balancing
**Severity**: P1
**Step**: 08-04 (Attribute Generation)
**Description**: The sub-stat generation formula uses `base × random(0.8, 1.2) × quality_multiplier × 0.3` but the slot_base_value and individual sub-stat base values are not defined per sub-stat type. For example, does "暴击率" use the same base as "穿透"? The sub-stat base values per type need to be defined in the equipment system configuration.
**Recommendation**: Define per-sub-stat base values in the equipment system (e.g., 暴击率 base=5%, 穿透 base=10, 攻速 base=3%).

### I-08-02: Enhancement cost formula quality jump concern
**Severity**: P2
**Step**: 08-06 (Equipment Enhancement)
**Description**: The quality_base jumps significantly (白10/绿20/蓝40/紫80/橙160), meaning enhancing an orange item from +14 to +15 costs `ceil(160 × 5.2 × (1-discount)) = ~786` ore. At workshop Lv20, the mine produces ~22 ore/sec, requiring ~36 seconds of mining per single enhancement at high levels. This may feel too grindy or too cheap depending on game pacing.
**Recommendation**: Verify these costs against expected progression timeline. Consider whether high-level enhancement should require additional rare materials beyond ore.

### I-08-03: Decompose recycle rate calculation on original vs actual cost
**Severity**: P1
**Step**: 08-07 (Equipment Decomposition)
**Description**: The recycle formula uses "original_ore_cost" but it is ambiguous whether this means the base cost (before efficiency discount) or the actual cost paid (after discount). The formula should specify: recycle should be based on the BASE cost (before discount), so players with higher workshop levels get better value from recycling.
**Recommendation**: Clarify that recycle is calculated from base material cost (pre-discount). Document this explicitly.

### I-08-04: Special effect descriptions lack numeric specifics
**Severity**: P2
**Step**: 08-04 (Attribute Generation - Special Effects)
**Description**: The special effect pool for purple/orange equipment lists effects like "连击: 普攻15%概率触发二次攻击" but does not specify how these values are generated or scaled. Are these fixed values per effect, or do they scale with equipment level/quality?
**Recommendation**: Define special effect value tables (base value + quality scaling) in the equipment system configuration. Orange effects stated as +50% over purple.

### I-08-05: Batch forge max count of 20 not validated against bag space
**Severity**: P2
**Step**: 08-08 (Batch Forging)
**Description**: The max_forge_count formula checks material sufficiency and caps at 20, but does not check equipment bag remaining capacity. If a player has 5 bag slots left but materials for 20, the batch would fail partially.
**Recommendation**: Add `equipment_bag_remaining` to the min() calculation in max_forge_count formula.

### I-08-06: Material flow real-time display may cause performance issues
**Severity**: P3
**Step**: 08-01 (Material Inventory Bar)
**Description**: The material inventory bar at the top of the forge tab is "always visible" and shows production rates from mine/lumber buildings. If these values update every second (matching production tick rate), this could cause unnecessary re-renders.
**Recommendation**: Throttle inventory display updates to every 5 seconds or on significant change (>5% delta). Use optimistic local updates for spent materials.

### I-08-07: Quality cap redistribution creates unintuitive behavior at Lv10 boundary
**Severity**: P3
**Step**: 08-03 (Forging Mode Selection)
**Description**: At workshop Lv6-10, divine forge redistributes orange 30% to purple+blue. At Lv11-15, it redistributes orange 30% to purple only. This means the same divine forge at Lv10 (cap=blue) vs Lv11 (cap=purple) has different blue/purple ratios, which may confuse players.
**Recommendation**: Consider making the redistribution algorithm more transparent to players, perhaps by showing the actual probability table in a tooltip when hovering over quality indicators.

### I-08-08: Equipment naming table only has one entry per quality-slot
**Severity**: P3
**Step**: 08-05 (Result Display)
**Description**: The naming table lists 1 name per quality-slot combination, but the description says "3-5 random names per quality." The full name lists need to be defined in the equipment system config.
**Recommendation**: This is a data task, not a flow issue. Mark as deferred to equipment system implementation.

## Summary

| Severity | Count | IDs |
|:--------:|:-----:|-----|
| P1 | 2 | I-08-01, I-08-03 |
| P2 | 3 | I-08-02, I-08-04, I-08-05 |
| P3 | 3 | I-08-06, I-08-07, I-08-08 |
| **Total** | **8** | |

**P1 Issues Requiring Resolution Before Implementation**:
- I-08-01: Sub-stat base values need definition
- I-08-03: Recycle rate base cost ambiguity
