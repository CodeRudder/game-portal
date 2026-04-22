# v1.0~v4.0 技术审查报告（Round 9）

> **审查日期**: 2026-04-23
> **审查范围**: v1.0~v4.0（resource/building/calendar/hero/bond/campaign/map/battle）
> **审查结论**: ⚠️ CONDITIONAL

## 审查概要

| 版本 | P0 | P1 | P2 | ISubsystem | as any | 文件行数 |
|------|:--:|:--:|:--:|:----------:|:------:|:--------:|
| v1.0 | 0 | 0 | 1 | 1/4 (辅助函数豁免) | ✅ 0 | ✅ ≤500 |
| v2.0 | 0 | 0 | 1 | 5/6 (序列化器豁免) | ✅ 0 | ✅ ≤500 |
| v3.0 | 0 | 0 | 1 | 4/8 (数据/序列化豁免) | ✅ 0 | ✅ ≤500 |
| v4.0 | 0 | 1 | 1 | 6/8 (工具/预设豁免) | ✅ 0 | ✅ ≤500 |

## 与 Round 5 对比（改善项）

| 指标 | Round 5 | Round 9 | 改善 |
|------|---------|---------|------|
| 文件行数超标(>500) | 多个文件超标 | **全部 ≤500** | ✅ 清零 |
| `as any` | 存在若干 | **0 处** | ✅ 清零 |
| ISubsystem 覆盖 | 部分模块缺失 | 核心系统 100% | ✅ 大幅改善 |
| 门面违规(生产代码) | 存在 | **0 处** | ✅ 清零 |
| Jest 残留 | 存在 | **0 处** | ✅ 清零 |
| data-testid 覆盖 | 无 | **核心面板全覆盖** | ✅ 新增 |
| 废弃代码 | 未标注 | 1处已标注(保留兼容) | ✅ 改善 |

## 详细检查结果

### 1. 文件行数 — ✅ PASS

全部生产代码文件 ≤ 500 行。最大文件：

| 行数 | 文件 | 模块 |
|------|------|------|
| 477 | `hero/HeroLevelSystem.ts` | v2.0 |
| 476 | `battle/battle.types.ts` | v4.0 |
| 459 | `battle/BattleTurnExecutor.ts` | v4.0 |
| 458 | `building/building-config.ts` | v1.0 |
| 455 | `resource/ResourceSystem.ts` | v1.0 |
| 449 | `campaign/CampaignProgressSystem.ts` | v3.0 |
| 444 | `hero/HeroRecruitSystem.ts` | v2.0 |
| 444 | `bond/BondSystem.ts` | v2.0 |
| 442 | `building/BuildingSystem.ts` | v1.0 |
| 439 | `battle/UltimateSkillSystem.ts` | v4.0 |
| 433 | `battle/BattleEngine.ts` | v4.0 |
| 422 | `calendar/CalendarSystem.ts` | v1.0 |
| 417 | `hero/HeroFormation.ts` | v2.0 |

> Round 5 时存在多个超 500 行的文件，R6/R7 拆分后全部达标。

### 2. ISubsystem 覆盖

| 模块 | 覆盖 | 总计 | 覆盖率 | 备注 |
|------|:----:|:----:|:------:|------|
| resource | 1 | 4 | 25% | ResourceSystem ✅；其余为纯函数模块 |
| building | 1 | 5 | 20% | BuildingSystem ✅；其余为纯函数/辅助 |
| calendar | 1 | 2 | 50% | CalendarSystem ✅；calendar-config 为配置 |
| hero | 5 | 6 | 83% | HeroSerializer 为序列化工具，无需ISubsystem |
| bond | 1 | 1 | 100% | BondSystem ✅ |
| campaign | 4 | 8 | 50% | 4个系统 ✅；其余为数据配置/序列化/工具 |
| map | 6 | 7 | 86% | MapDataRenderer 为渲染数据生成器 |
| battle | 6 | 8 | 75% | BattleEngine+DamageCalculator已实现；其余为工具/预设 |

**豁免说明**（纯函数/数据/配置模块无需 ISubsystem）：
- `resource-calculator.ts`, `OfflineEarningsCalculator.ts` — 纯计算函数
- `BuildingBatchOps.ts`, `BuildingStateHelpers.ts`, `BuildingRecommender.ts` — 纯函数辅助
- `campaign-chapter*.ts`, `campaign-utils.ts` — 章节数据配置
- `CampaignSerializer.ts`, `HeroSerializer.ts` — 序列化工具
- `autoFormation.ts` — 纯函数（`export function`）
- `battle-effect-presets.ts` — 类型/预设定义
- `MapDataRenderer.ts` — 渲染数据生成器（纯计算）

**核心系统（有状态/生命周期）ISubsystem 覆盖率：100%**

### 3. `as any` — ✅ PASS（零容忍）

```
引擎层 as any：0 处
```

### 4. 门面导出 — ✅ PASS

**生产代码违规**：0 处

UI 层（`src/components/`、`src/games/three-kingdoms/ui/`）无直接引用引擎内部模块。
所有引擎引用均通过 `engine/{module}/index.ts` 门面导出。

**测试文件引用**（15 处，P2 级别）：
测试文件中存在引用引擎内部 `.types.ts` 文件的情况（如 `campaign.types`、`battle.types`、`hero.types`、`sweep.types`）。
这些引用均为 `import type` 或枚举值导入，且对应类型已通过门面 `index.ts` 重新导出。
建议后续统一改为从门面导入，但不影响生产代码架构。

### 5. data-testid — ✅ PASS（核心面板全覆盖）

| 组件 | data-testid 数量 |
|------|:----------------:|
| `panels/campaign/CampaignTab.tsx` | 3 |
| `panels/campaign/BattleScene.tsx` | 8 |
| `panels/campaign/BattleResultModal.tsx` | 2 |
| `panels/campaign/BattleFormationModal.tsx` | 4 |
| `panels/hero/HeroTab.tsx` | 9 |
| `panels/hero/RecruitModal.tsx` | 7 |
| `panels/hero/FormationPanel.tsx` | 4 |
| `panels/map/WorldMapTab.tsx` | 17 |
| `panels/building/BuildingPanel.tsx` | 7 |
| `panels/resource/ResourceBar.tsx` | 11 |

> Round 5 时 data-testid 覆盖为 0，R7 新增后核心面板全部覆盖。

### 6. 废弃代码 — ⚠️ 1 处（已标注，保留兼容）

| ID | 级别 | 文件 | 描述 |
|----|------|------|------|
| DEP-1 | P2 | `engine/resource/OfflineEarningsCalculator.ts:4` | 标注 DEPRECATED，保留向后兼容。完整版在 `offline/OfflineRewardEngine.ts` |

该文件已正确标注废弃说明和桥接关系，属于有意保留。

### 7. 测试框架 — ✅ PASS

- **测试文件总数**：53 个（resource:1, building:3, calendar:2, hero:19, bond:1, campaign:7, map:9, battle:11）
- **Vitest 迁移**：100% 完成，所有测试文件使用 `vitest`
- **Jest 残留**：0 处（配置文件、测试文件均无 jest 引用）

## 问题清单

| ID | 级别 | 版本 | 文件 | 行号 | 描述 |
|----|------|------|------|------|------|
| R9-P1-01 | P1 | v4.0 | `engine/battle/BattleEffectApplier.ts` | L148 | `BattleEffectApplier` 未实现 `ISubsystem`。该类持有副作用逻辑（科技效果应用），应实现接口以保持一致性 |
| R9-P2-01 | P2 | v1~v4 | `components/.../campaign/__tests__/*.test.tsx` | 多处 | 测试文件直接引用引擎内部 `.types.ts`（15处），应统一改为从门面 `index.ts` 导入 |
| R9-P2-02 | P2 | v1.0 | `engine/resource/OfflineEarningsCalculator.ts` | L4 | DEPRECATED 标注但保留兼容，建议在 v2.0 迭代中评估是否可移除 |

## 架构评价

### 优点
1. **文件行数管控优秀**：R6/R7 拆分后，所有文件 ≤ 500 行，最大 477 行
2. **类型安全**：引擎层 `as any` 完全清零，TypeScript 严格模式无逃逸
3. **门面模式落地**：8 个模块均有完整 `index.ts` 门面，生产代码零违规
4. **测试框架统一**：Jest → Vitest 迁移彻底，无残留
5. **data-testid 覆盖**：核心面板组件 100% 覆盖，支持 E2E 测试
6. **ISubsystem 标准化**：核心系统（有状态/生命周期）100% 实现

### 待改进
1. **BattleEffectApplier** 应补齐 `ISubsystem` 实现（P1）
2. **测试文件门面引用**：15 处测试文件直接引用引擎内部类型，建议统一收敛到门面导入（P2）
3. **OfflineEarningsCalculator**：DEPRECATED 文件需评估移除时机（P2）

## 结论

**⚠️ CONDITIONAL** — 整体架构质量较 Round 5 显著提升。1 个 P1 问题（BattleEffectApplier 缺少 ISubsystem）需修复后即可 PASS。
