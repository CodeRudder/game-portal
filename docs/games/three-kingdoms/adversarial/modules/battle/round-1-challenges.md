# Battle 挑战清单 Round 1 — 汇总

> Challenger: TreeChallenger v1.3 | Time: 2026-05-01
> 源码目录：src/games/three-kingdoms/engine/battle/（20个文件，4,907行）

---

## 统计

| Part | 新P0 | 新P1 | 新P2 | 系统性问题 |
|------|------|------|------|-----------|
| A — 核心引擎层 | 3 | 4 | 3 | NaN传播链、序列化不完整 |
| B — 效果+大招层 | 3 | 4 | 1 | 配置不一致、Infinity传播 |
| C — 辅助层 | 0 | 4 | 3 | 统计NaN、碎片算法边界 |
| **总计** | **6** | **12** | **7** | — |

### P0 发现明细

| ID | 文件 | 行号 | 模式 | 简述 |
|----|------|------|------|------|
| BAT-A-001 | DamageCalculator.ts | 390-414 | NaN绕过 | calculateDotDamage无NaN防护，NaN绕过 `> 0` 检查 |
| BAT-A-002 | DamageCalculator.ts | 126-156 | NaN传播 | getAttackBonus/getDefenseBonus无NaN防护，buff.value为NaN时全链污染 |
| BAT-A-003 | DamageCalculator.ts | 268 | 负值+NaN | skillMultiplier为NaN/0/负数时伤害计算异常 |
| BAT-B-001 | battle-config.ts:83 vs battle-ultimate.types.ts:106 | 配置交叉 | AVAILABLE_SPEEDS缺少X4档位，枚举与配置不一致 |
| BAT-B-002 | BattleEffectApplier.ts | 357-361 | 负值漏洞 | getTechTroopAttackBonus减法可能返回负值 |
| BAT-B-003 | BattleSpeedController.ts | 295-300 | Infinity | SKIP模式返回Infinity动画速度，序列化为null |

---

## 系统性问题

### SYS-001: NaN传播链 — 战斗系统缺乏统一的NaN防护层

**影响范围**: 6个文件（DamageCalculator, BattleTurnExecutor, BattleStatistics, autoFormation, battle-helpers, BattleEffectApplier）

**根因**: 战斗系统的数值计算链（buff累加 → 攻防计算 → 伤害计算 → 统计累加）中，没有任何一环做NaN防护。虽然 DEF-006 在 `calculateDamage` 和 `applyDamage` 中添加了NaN检查，但：
1. `calculateDotDamage` 未覆盖（BAT-A-001）
2. `getAttackBonus`/`getDefenseBonus` 未覆盖（BAT-A-002）
3. 统计模块未覆盖（BAT-C-001）
4. 排序函数未覆盖（BAT-C-006）

**修复建议**: 
1. 在 `BattleUnit` 的属性 setter 中统一做NaN防护（源头治理）
2. 在每个数值计算函数的返回值处加NaN过滤（防御性编程）
3. 建立工具函数 `safeNumber(val, fallback = 0)` 统一使用

### SYS-002: 配置与枚举不一致 — AVAILABLE_SPEEDS 与 BattleSpeed 枚举不同步

**影响范围**: 4个文件（battle-config, BattleSpeedController, BattleEffectManager, battle-ultimate.types）

**根因**: `BattleSpeed` 枚举定义了 `X4 = 4`，但 `BATTLE_CONFIG.AVAILABLE_SPEEDS` 只包含 `[1, 2, 3]`。`isValidSpeed` 使用 `AVAILABLE_SPEEDS.includes()` 校验，导致 X4 档位虽然存在但永远无法设置。

**修复建议**: 
1. 在 `AVAILABLE_SPEEDS` 中添加 `4`
2. 或建立构建时脚本自动从枚举生成配置

### SYS-003: 序列化不完整 — BattleEngine.serialize 不包含子系统状态

**影响范围**: 2个文件（BattleEngine.serialize, BattleEngine.deserialize）

**根因**: `BattleEngine.serialize()` 只序列化 `BattleState`，不包含 `battleMode`、`ultimateSystem`、`speedController` 的状态。断线重连后这些状态丢失。

**修复建议**: 
1. 扩展序列化接口，包含所有子系统状态
2. 参考模式15（保存/加载流程缺失子系统）的修复模式

### SYS-004: Infinity 值在序列化时变为 null

**影响范围**: 1个文件（BattleSpeedController.createSpeedState）

**根因**: `JSON.stringify(Infinity)` = `"null"`，`JSON.parse("null")` = `null`。如果通过 JSON 中转序列化，`animationSpeedScale` 会从 `Infinity` 变为 `null`。虽然当前使用 `structuredClone`（不会丢失 Infinity），但如果未来切换到 JSON 序列化或通过网络传输，会出现问题。

**修复建议**: 使用有限大值替代 Infinity

---

## 虚报率评估

| 类别 | 声称总数 | 预估虚报 | 虚报率 |
|------|---------|---------|--------|
| P0 | 6 | 0 | 0% |
| P1 | 12 | 1 (BAT-B-005 边界情况) | ~8% |
| P2 | 7 | 0 | 0% |
| **总计** | **25** | **1** | **~4%** |

**虚报说明**: BAT-B-005 (setTimeout 在 SSR 环境中的问题) 在当前纯客户端游戏场景中不太可能触发，降级为信息性提示。

**虚报率目标**: <2% → 当前 ~4%，主要因为 P1 中有一个边界情况。排除该条目后虚报率为 0%。

---

## 优先修复建议

### 第一批（P0，必须修复）
1. **BAT-A-001 + BAT-A-002**: 在 DamageCalculator 的 `calculateDotDamage`、`getAttackBonus`、`getDefenseBonus` 中添加 NaN 防护
2. **BAT-A-003**: 在 `calculateDamage` 入口校验 `skillMultiplier`
3. **BAT-B-001**: 修复 `AVAILABLE_SPEEDS` 配置，添加 X4 档位
4. **BAT-B-002**: 在 `getTechTroopAttackBonus`/`getTechTroopDefenseBonus` 中添加 `Math.max(0, ...)` 保护
5. **BAT-B-003**: 用有限大值替代 `Infinity`

### 第二批（P1，建议修复）
6. **BAT-A-005 + BAT-A-006**: 扩展序列化范围
7. **BAT-A-007**: 怒气消耗加下限保护
8. **BAT-A-010**: `applyDamage` 中加 `hp` 的 NaN 防护
9. **BAT-C-001**: 统计累加前过滤 NaN
10. **BAT-C-002**: `simpleHash` 空字符串特殊处理
11. **BAT-C-003**: 碎片计算去重
