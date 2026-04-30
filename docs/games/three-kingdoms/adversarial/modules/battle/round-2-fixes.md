# Battle R2 修复记录

> 日期: 2026-05-01
> 触发: Battle R2 Arbiter评审 → Builder修复

## 修复概览

| FIX-ID | 严重度 | 状态 | 描述 |
|--------|--------|------|------|
| FIX-201 | P0 | ✅ 已修复 | BattleEngine.serialize不含子系统状态 |
| FIX-202 | P0 | ✅ 已修复 | getTechTroopDefenseBonus穿透遗漏 |

---

## FIX-201: BattleEngine.serialize不含子系统状态

**问题**: `BattleEngine.serialize()` 仅对 `BattleState` 做深拷贝，不包含 `battleMode`、`speedController`、`ultimateSystem` 三个子系统状态。`deserialize()` 同样不恢复这些状态。导致存档/读档后战斗模式、速度、大招时停状态全部丢失。

**根因**: serialize/deserialize 设计时仅考虑了 BattleState 纯数据，未将引擎内部的子系统运行时状态纳入序列化范围。

**修复方案**:
1. `serialize()`: 在深拷贝的 BattleState 上附加 `__subsystem` 字段，包含 `battleMode`、`speed`（来自 `speedController.serialize()`）、`ultimate`（来自 `ultimateSystem.serialize()`）
2. `deserialize()`: 从 `__subsystem` 恢复三个子系统状态，然后剥离 `__subsystem` 返回纯净 BattleState

**修改文件**:
- `src/games/three-kingdoms/engine/battle/BattleEngine.ts`

**验证**: `npx tsc --noEmit` 通过

---

## FIX-202: getTechTroopDefenseBonus穿透遗漏

**问题**: FIX-105 修复了 `getTechTroopAttackBonus` 的负值穿透问题（添加 `Math.max(0, result)`），但遗漏了对称函数 `getTechTroopDefenseBonus`。防御加成计算仍可能返回负值，导致防御降低而非增加。

**根因**: 对称函数修复不完整。attack 和 defense 的兵种专属加成函数结构完全相同，但修复时只处理了 attack 侧。

**修复方案**: 在 `getTechTroopDefenseBonus` 中添加 `Math.max(0, result)`，与 attack 侧保持一致。

**修改文件**:
- `src/games/three-kingdoms/engine/battle/BattleEffectApplier.ts`

**验证**: `npx tsc --noEmit` 通过

---

## 规则进化 (v1.4 → v1.5)

| 文件 | 变更 |
|------|------|
| builder-rules.md | +规则20: 对称函数修复验证 |
| arbiter-rules.md | +AR-012: 有条件封版规则 |
| p0-pattern-library.md | +模式19: 对称函数修复遗漏 |
| evolution-log.md | +Battle R2进化记录 |
| 3×agent-history.md | +Battle R2行 |
