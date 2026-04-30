# Battle 流程分支树 Round 1

> Builder: TreeBuilder v1.3 | Time: 2026-05-01
> 模块: battle | 文件: 20 | 源码: 4,907行 | API: ~72

## 统计

| Part | 节点数 | API数 | covered | uncovered | todo | P0 | P1 |
|------|--------|-------|---------|-----------|------|----|----|
| A    | 198    | 32    | 143     | 55        | 0    | 26 | 29 |
| B    | 172    | 38    | 133     | 39        | 0    | 19 | 20 |
| C    | 118    | 25    | 89      | 29        | 0    | 12 | 17 |
| **总计** | **488** | **95** | **365** | **123** | **0** | **57** | **66** |

> 注：API数包含公开方法、辅助函数、配置验证项；节点数=分支条件总行数

## 子系统覆盖

| 子系统 | 文件 | API数 | 节点数 | covered | uncovered | 覆盖率 |
|--------|------|-------|--------|---------|-----------|--------|
| BattleEngine | BattleEngine.ts | 12 | 68 | 55 | 13 | 80.9% |
| DamageCalculator | DamageCalculator.ts | 8 | 60 | 46 | 14 | 76.7% |
| BattleTurnExecutor | BattleTurnExecutor.ts | 4 | 42 | 36 | 6 | 85.7% |
| BattleTargetSelector | BattleTargetSelector.ts | 1 | 16 | 15 | 1 | 93.8% |
| autoFormation | autoFormation.ts | 1 | 11 | 9 | 2 | 81.8% |
| battle-helpers | battle-helpers.ts | 6 | 15 | 13 | 2 | 86.7% |
| BattleEffectApplier | BattleEffectApplier.ts | 8 | 28 | 20 | 8 | 71.4% |
| BattleEffectManager | BattleEffectManager.ts | 10 | 38 | 31 | 7 | 81.6% |
| UltimateSkillSystem | UltimateSkillSystem.ts | 12 | 42 | 37 | 5 | 88.1% |
| BattleSpeedController | BattleSpeedController.ts | 10 | 32 | 28 | 4 | 87.5% |
| DamageNumberSystem | DamageNumberSystem.ts | 8 | 28 | 23 | 5 | 82.1% |
| DamageNumberConfig | DamageNumberConfig.ts | 1 | 7 | 7 | 0 | 100% |
| BattleStatistics | BattleStatistics.ts | 3 | 14 | 11 | 3 | 78.6% |
| BattleFragmentRewards | BattleFragmentRewards.ts | 2 | 14 | 10 | 4 | 71.4% |
| battle-config | battle-config.ts | 1 | 12 | 11 | 1 | 91.7% |
| battle-effect-presets | battle-effect-presets.ts | 1 | 6 | 5 | 1 | 83.3% |
| index.ts | index.ts | 1 | 6 | 6 | 0 | 100% |

## 跨系统链路覆盖

| 链路域 | 链路数 | covered | uncovered |
|--------|--------|---------|-----------|
| Part A 内部 | 12 | 12 | 0 |
| Part B 内部 | 9 | 9 | 0 |
| Part C 与 A/B 交叉 | 9 | 9 | 0 |
| **总计** | **30** | **30** | **0** |

## 特别关注项汇总（基于Hero模块经验）

| # | 模式 | 严重度 | 影响范围 | 状态 |
|---|------|--------|---------|------|
| S-1 | NaN绕过<=0检查（模式9） | 🔴 P0 | DamageCalculator.getCriticalRate, BattleEffectApplier.getEnhancedStats, DamageNumberSystem.createDamageNumber, calculateBattleStats | uncovered |
| S-2 | 配置交叉不一致（模式10） | 🔴 P0 | BATTLE_CONFIG.AVAILABLE_SPEEDS=[1,2,3] 但 BattleSpeed.X4=4 枚举存在 | uncovered |
| S-3 | setter/getter注入未调用（模式12） | 🟡 P1 | BattleEngine.init未注入deps到子系统; BattleEffectApplier.setTechEffectSystem需手动调用 | uncovered |
| S-4 | 修复穿透不完整（模式13） | 🔴 P0 | DamageCalculator NaN防护已覆盖calculateDamage+applyDamage ✅; 但getCriticalRate(speed=NaN)未防护 | uncovered |
| S-5 | 资源溢出无上限（模式14） | 🟡 P1 | attack/defense无溢出保护; getEnhancedStats加成无上限 | uncovered |
| S-6 | 保存/加载流程缺失（模式15） | 🔴 P0 | BattleEngine.serialize仅处理BattleState，不含battleMode/speedState/ultimateState | uncovered |
| S-7 | deserialize无验证 | 🔴 P0 | UltimateSkillSystem.deserialize/BattleSpeedController.deserialize直接赋值无校验 | uncovered |
| S-8 | BUFF_ELEMENT_MAP不完整 | 🟡 P1 | ATK_DOWN/DEF_DOWN未映射→neutral fallback | uncovered |

## Top 10 P0 Uncovered 节点

| # | 节点 | 子系统 | 描述 |
|---|------|--------|------|
| 1 | DamageCalculator.getCriticalRate(speed=NaN) | Part A | NaN→rate=NaN，rollCritical可能永远false或true |
| 2 | BattleEngine.serialize不含battleMode/speed | Part A | 存档恢复后丢失战斗模式和速度设置 |
| 3 | BattleSpeedController.X4不在AVAILABLE_SPEEDS | Part B | cycleSpeed遇到X4时行为异常 |
| 4 | BattleEffectApplier.getEnhancedStats(NaN baseAttack) | Part B | enhancedAttack=NaN传播到战斗伤害 |
| 5 | DamageNumberSystem.createDamageNumber(NaN value) | Part C | text="-NaN"显示异常 |
| 6 | calculateBattleStats(NaN damage) | Part C | allyTotalDamage变NaN |
| 7 | UltimateSkillSystem.deserialize(null) | Part B | 崩溃 |
| 8 | BattleSpeedController.deserialize(null) | Part B | 崩溃 |
| 9 | simpleHash(null) | Part C | 崩溃 |
| 10 | BattleEffectApplier.applyTechBonusesToTeam含null | Part B | 崩溃 |

## 与Hero模块对比

| 维度 | Hero R1 | Battle R1 |
|------|---------|-----------|
| 总节点数 | ~420 | 488 |
| API数 | ~60 | 95 |
| covered率 | ~72% | 74.8% |
| P0 uncovered | ~35 | 57 |
| 配置交叉问题 | 2 | 1 (AVAILABLE_SPEEDS vs X4) |
| NaN防护 | 6处遗漏 | 5处遗漏 |
| serialize缺失 | 6个子系统 | 3个子系统(speed/ultimate/effectManager) |

## 下一步建议

1. **S-2 配置交叉修复**：AVAILABLE_SPEEDS应包含4或移除BattleSpeed.X4
2. **S-6 serialize扩展**：BattleEngine.serialize需包含battleMode、speedController.serialize()、ultimateSystem.serialize()
3. **S-1 NaN防护补全**：getCriticalRate、getEnhancedStats、createDamageNumber、calculateBattleStats
4. **S-7 deserialize验证**：添加null检查和state值范围校验
5. **S-3 依赖注入链**：BattleEngine.init应将deps传递给子系统

---

*详细分支树见：*
- [Part A: 核心引擎层](./round-1-tree-partA.md)
- [Part B: 效果+大招层](./round-1-tree-partB.md)
- [Part C: 辅助层](./round-1-tree-partC.md)
