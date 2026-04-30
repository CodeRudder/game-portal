# Battle 模块源码结构分析报告

> 生成时间: 2025-05-01  
> 目的: 为对抗式测试 (Adversarial Testing) Builder/Challenger 分区提供基础

---

## 1. 模块概览

| 指标 | 数值 |
|------|------|
| 源码文件数 | **20** |
| 测试文件数 | **31** |
| 源码总行数 | **4,907** |
| 测试总行数 | **11,639** |
| 公开 API 数量 | **~70+** (export class/function/interface/type/const) |
| 已有对抗测试 | `DamageCalculator.adversarial.test.ts` (236行) |

---

## 2. 源码文件清单

### 2.1 核心引擎层 (Core Engine)

| 文件 | 行数 | 主要导出 | 职责 |
|------|------|----------|------|
| `BattleEngine.ts` | 552 | `class BattleEngine` | 战斗主引擎，编排全部战斗流程 |
| `BattleTurnExecutor.ts` | 355 | `class BattleTurnExecutor` | 单回合执行器：技能选择、目标选择、怒气更新、Buff处理 |
| `DamageCalculator.ts` | 424 | `class DamageCalculator`, 6个工具函数 | 伤害公式、暴击、克制、攻防加成、护盾 |
| `BattleTargetSelector.ts` | 87 | `selectTargets()`, `selectSingleTarget()`, `selectFrontRowTargets()`, `selectBackRowTargets()` | 目标选择策略 |
| `autoFormation.ts` | 76 | `autoFormation()`, `AutoFormationResult` | 自动布阵算法 |

### 2.2 效果系统层 (Effect System)

| 文件 | 行数 | 主要导出 | 职责 |
|------|------|----------|------|
| `BattleEffectApplier.ts` | 370 | `class BattleEffectApplier`, `SkillEffectConfig`, `EnhancedBattleStats`, `EnhancedDamageResult` | 科技效果应用（攻击/防御加成） |
| `BattleEffectManager.ts` | 329 | `class BattleEffectManager`, `SkillEffectData`, `DamageAnimationData` | 战斗特效管理（粒子/光晕/震屏） |
| `battle-effect-presets.ts` | 180 | 5个type + 4个const预设 | 元素粒子/光晕/震屏/移动端布局预设 |

### 2.3 大招与速度控制层 (Ultimate & Speed)

| 文件 | 行数 | 主要导出 | 职责 |
|------|------|----------|------|
| `UltimateSkillSystem.ts` | 439 | `class UltimateSkillSystem` | 大招时停系统（状态机、超时处理） |
| `BattleSpeedController.ts` | 329 | `class BattleSpeedController`, `ISpeedChangeListener` | 战斗加速/减速控制 |
| `battle-ultimate.types.ts` | 175 | 5个interface + `IBattleEngineV4` | 大招系统类型定义 |

### 2.4 伤害数字与统计层 (Damage Number & Stats)

| 文件 | 行数 | 主要导出 | 职责 |
|------|------|----------|------|
| `DamageNumberSystem.ts` | 362 | `class DamageNumberSystem` | 伤害数字飘字动画系统 |
| `DamageNumberConfig.ts` | 193 | `TrajectoryConfig`, `DamageNumber`, `MergedDamageNumber`, `DamageNumberConfig`, 2个const | 伤害数字配置（轨迹/颜色/合并） |
| `BattleStatistics.ts` | 151 | `BattleStats`, `BattleStatisticsSubsystem`, `calculateBattleStats()`, `generateSummary()` | 战斗统计与摘要生成 |
| `BattleFragmentRewards.ts` | 82 | `calculateFragmentRewards()`, `simpleHash()` | 碎片奖励计算 |

### 2.5 类型与配置层 (Types & Config)

| 文件 | 行数 | 主要导出 | 职责 |
|------|------|----------|------|
| `battle.types.ts` | 317 | 8个interface + 3个type + 枚举re-export | 核心战斗类型（BattleTeam/BattleState/BattleResult/IBattleEngine等） |
| `battle-base.types.ts` | 205 | `BattleUnit`, `BuffEffect`, `BattleSkill`, `Position`, `BattleSide` | 基础战斗类型 |
| `battle-config.ts` | 88 | `BATTLE_CONFIG` | 战斗配置常量 |
| `battle-helpers.ts` | 81 | 8个工具函数 | 战斗辅助函数（存活单位/排序/查找） |
| `index.ts` | 112 | 统一导出入口 | 模块公共API聚合 |

---

## 3. 公开 API 完整清单

### 3.1 类 (Classes) — 8个

| 类名 | 文件 | 实现接口 |
|------|------|----------|
| `BattleEngine` | BattleEngine.ts | `IBattleEngine`, `ISubsystem` |
| `BattleTurnExecutor` | BattleTurnExecutor.ts | `ISubsystem` |
| `DamageCalculator` | DamageCalculator.ts | `IDamageCalculator`, `ISubsystem` |
| `BattleEffectApplier` | BattleEffectApplier.ts | `ISubsystem` |
| `BattleEffectManager` | BattleEffectManager.ts | `ISubsystem` |
| `UltimateSkillSystem` | UltimateSkillSystem.ts | `ISubsystem` |
| `BattleSpeedController` | BattleSpeedController.ts | `ISubsystem` |
| `DamageNumberSystem` | DamageNumberSystem.ts | `ISubsystem` |
| `BattleStatisticsSubsystem` | BattleStatistics.ts | `ISubsystem` |

### 3.2 公开函数 (Functions) — 20个

**伤害计算 (DamageCalculator.ts):**
- `getRestraintMultiplier(attacker, defender)` — 兵种克制倍率
- `getCriticalRate(speed)` — 暴击率计算
- `rollCritical(speed)` — 暴击掷骰
- `getAttackBonus(unit)` — 攻击加成
- `getDefenseBonus(unit)` — 防御加成
- `getShieldAmount(unit)` — 护盾计算

**目标选择 (BattleTargetSelector.ts):**
- `selectTargets(state, actor, skill)` — 目标选择主入口
- `selectSingleTarget(team)` — 单体目标
- `selectFrontRowTargets(team)` — 前排目标
- `selectBackRowTargets(team)` — 后排目标

**辅助函数 (battle-helpers.ts):**
- `getAliveUnits(team)` — 获取存活单位
- `getAliveFrontUnits(team)` — 获取存活前排
- `getAliveBackUnits(team)` — 获取存活后排
- `sortBySpeed(units)` — 速度排序
- `getEnemyTeam(state, side)` — 获取敌方队伍
- `getAllyTeam(state, side)` — 获取友方队伍
- `findUnitInTeam(team, unitId)` — 队内查单位
- `findUnit(state, unitId)` — 全局查单位

**统计与奖励:**
- `calculateBattleStats(state)` — 计算战斗统计
- `generateSummary(stats)` — 生成摘要
- `calculateFragmentRewards(result, config)` — 碎片奖励
- `simpleHash(str)` — 简单哈希
- `autoFormation(units)` — 自动布阵

### 3.3 接口/类型 (Interfaces & Types) — 25+

**核心类型:** `BattleUnit`, `BattleTeam`, `BattleAction`, `BattleState`, `BattleResult`, `DamageResult`, `BuffEffect`, `BattleSkill`, `CreateUnitParams`, `UnitMap`, `Position`, `BattleSide`, `IDamageCalculator`, `IBattleEngine`

**V4.0 大招类型:** `UltimateTimeStopEvent`, `IUltimateTimeStopHandler`, `UltimateReadyResult`, `BattleSpeedState`, `SpeedChangeEvent`, `IBattleEngineV4`

**效果类型:** `SkillEffectConfig`, `EnhancedBattleStats`, `EnhancedDamageResult`, `SkillEffectData`, `DamageAnimationData`, `EffectElement`, `EffectTrigger`

**伤害数字类型:** `TrajectoryConfig`, `DamageNumber`, `MergedDamageNumber`, `DamageNumberConfig`

**统计类型:** `BattleStats`, `AutoFormationResult`, `ISpeedChangeListener`

### 3.4 常量 (Constants) — 7个

- `BATTLE_CONFIG` — 战斗配置
- `TROOP_TYPE_LABELS` — 兵种标签
- `ELEMENT_PARTICLE_PRESETS` — 元素粒子预设
- `ELEMENT_GLOW_PRESETS` — 元素光晕预设
- `SCREEN_PRESETS` — 屏幕预设
- `BUFF_ELEMENT_MAP` — Buff元素映射
- `DEFAULT_TRAJECTORIES` — 默认轨迹
- `DAMAGE_NUMBER_COLORS` — 伤害数字颜色
- `DEFAULT_CONFIG` — 默认伤害数字配置

---

## 4. 核心引擎方法签名 (BattleEngine)

```typescript
class BattleEngine implements IBattleEngine, ISubsystem {
  // 公开方法
  init(deps: ISystemDeps): void
  initBattle(allyTeam: BattleTeam, enemyTeam: BattleTeam): BattleState
  executeTurn(state: BattleState): BattleAction[]
  isBattleOver(state: BattleState): boolean
  getBattleResult(state: BattleState): BattleResult
  runFullBattle(allyTeam: BattleTeam, enemyTeam: BattleTeam): BattleResult
  // + V4扩展方法 (通过IBattleEngineV4)

  // 私有方法
  private endTurn(state: BattleState): void
  private calculateStars(state: BattleState): StarRating
}
```

---

## 5. 对抗式测试分区建议 (Builder / Challenger)

### 5.1 高优先级攻击面 (Challenger 重点)

| 攻击面 | 文件 | 风险等级 | 说明 |
|--------|------|----------|------|
| **伤害公式** | `DamageCalculator.ts` | 🔴 Critical | 数值溢出、负数伤害、除零、NaN |
| **战斗状态** | `BattleEngine.ts` | 🔴 Critical | 状态机异常、死循环、空引用 |
| **回合执行** | `BattleTurnExecutor.ts` | 🔴 Critical | 技能选择逻辑、Buff叠加、怒气溢出 |
| **目标选择** | `BattleTargetSelector.ts` | 🟡 High | 空队伍、全灭队伍、无效目标 |
| **大招时停** | `UltimateSkillSystem.ts` | 🟡 High | 状态机转换异常、超时边界 |
| **自动布阵** | `autoFormation.ts` | 🟡 High | 空输入、0单位、超量单位 |

### 5.2 中优先级攻击面

| 攻击面 | 文件 | 风险等级 | 说明 |
|--------|------|----------|------|
| **效果应用** | `BattleEffectApplier.ts` | 🟠 Medium | 科技加成叠加、null依赖注入 |
| **速度控制** | `BattleSpeedController.ts` | 🟠 Medium | 非法速度值、监听器泄漏 |
| **碎片奖励** | `BattleFragmentRewards.ts` | 🟠 Medium | 哈希碰撞、负数奖励 |
| **战斗统计** | `BattleStatistics.ts` | 🟢 Low | 空状态输入 |

### 5.3 Builder 防御重点

| 防御目标 | 涉及文件 | 建议策略 |
|----------|----------|----------|
| 输入校验 | `BattleEngine.initBattle()` | 空队伍/空单位/非法属性校验 |
| 数值边界 | `DamageCalculator.*` | 最大/最小伤害clamp、NaN防护 |
| 状态一致性 | `BattleState`, `BattleTurnExecutor` | 不可变状态、回合数上限 |
| 资源清理 | `UltimateSkillSystem`, `BattleSpeedController` | 超时清理、监听器移除 |

---

## 6. 已有测试覆盖情况

| 测试文件 | 行数 | 覆盖目标 |
|----------|------|----------|
| `BattleEngine-p1.test.ts` | 309 | 引擎基础流程 |
| `BattleEngine-p2.test.ts` | 613 | 引擎进阶场景 |
| `BattleEngine.boundary.test.ts` | 460 | 边界条件 |
| `BattleEngine.path-coverage.test.ts` | 642 | 路径覆盖 |
| `BattleEngine.skip.test.ts` | 563 | 跳过战斗 |
| `BattleEngine.v4.test.ts` | 463 | V4大招系统 |
| `BattleTurnExecutor.test.ts` | 898 | 回合执行器完整测试 |
| `BattleTurnExecutor-p1.test.ts` | 450 | 回合执行器P1 |
| `BattleTurnExecutor-p2.test.ts` | 442 | 回合执行器P2 |
| `BattleTurnExecutor.combat.test.ts` | 483 | 战斗执行 |
| `DamageCalculator.test.ts` | 500 | 伤害计算器 |
| `DamageCalculator.adversarial.test.ts` | 236 | **已有对抗测试** |
| `R23-damage-formula.test.ts` | 315 | 伤害公式回归 |
| `R22-battle-abnormal.test.ts` | 223 | 战斗异常回归 |
| `P0-crash-fixes.test.ts` | 249 | 崩溃修复 |
| `battle-fuzz.test.ts` | 479 | 模糊测试 |
| `UltimateSkillSystem.test.ts` | 402 | 大招系统 |
| `BattleSpeedController.test.ts` | 411 | 速度控制 |
| `BattleEffectApplier.test.ts` | 403 | 效果应用 |
| `BattleEffectManager-p1.test.ts` | 267 | 特效管理P1 |
| `BattleEffectManager-p2.test.ts` | 335 | 特效管理P2 |
| `battle-effect-presets.test.ts` | 352 | 效果预设 |
| `BattleStatistics.test.ts` | 252 | 战斗统计 |
| `BattleTargetSelector.test.ts` | 317 | 目标选择 |
| `BattleFragmentRewards.test.ts` | 195 | 碎片奖励 |
| `autoFormation.test.ts` | 147 | 自动布阵 |
| `battle-helpers.test.ts` | 295 | 辅助函数 |
| `DamageNumberSystem.test.ts` | 466 | 伤害数字系统 |
| `DEF-008-serialize.test.ts` | 183 | 序列化防御 |
| `DEF-009-autoFormation.test.ts` | 113 | 布阵防御 |
| `DEF-010-speed-restore.test.ts` | 176 | 速度恢复防御 |

---

## 7. 依赖关系图

```
BattleEngine (主引擎)
  ├── BattleTurnExecutor (回合执行)
  │   ├── DamageCalculator (伤害计算)
  │   ├── BattleTargetSelector (目标选择)
  │   └── battle-helpers (辅助函数)
  ├── UltimateSkillSystem (大招时停)
  │   └── BattleSpeedController (速度控制)
  ├── BattleEffectApplier (科技效果)
  └── BattleEffectManager (特效管理)
      └── DamageNumberSystem (伤害数字)
          └── DamageNumberConfig (数字配置)

独立模块:
  ├── autoFormation (自动布阵)
  ├── BattleStatistics (战斗统计)
  ├── BattleFragmentRewards (碎片奖励)
  └── battle-config (配置常量)
```

---

## 8. 下一步行动建议

1. **读取对抗式测试技能文件** — 加载 `/mnt/skills/public/adversarial-test-tree-builder/SKILL.md`
2. **选择攻击面** — 从 §5.1 高优先级列表中选择 Challenger 攻击目标
3. **构建测试树** — 为每个攻击面枚举所有分支路径
4. **Builder/Challenger 对抗** — Challenger 生成异常输入，Builder 修复防御
5. **迭代评估** — 每轮评估覆盖率增量，直到达到目标阈值
