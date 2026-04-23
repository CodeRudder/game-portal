# R21 Phase 5 架构审查报告

**审查日期**: 2025-04-24  
**审查版本**: Round 21  
**审查人**: 架构审查工程师  

---

## 审查维度

| 维度 | 标准 | 结果 | 状态 |
|------|------|------|------|
| TypeScript编译 | 0 error | `tsc --noEmit` 输出 0 错误 | ✅ 通过 |
| `as any` 使用 | 0 处 | 全项目 grep 结果: 0 处 | ✅ 通过 |
| `exports-v` 反模式 | 0 处 | 无 `exports-v*.ts` 文件，无 `export * from exports` 引用 | ✅ 通过 |
| 超标文件 (>500行) | 0 个 | 最大 499 行 (ArenaSystem.ts, StoryEventPlayer.ts) | ✅ 通过 |
| DDD 域完整性 | ≥30 子目录 | core: 32 + engine: 33 + rendering: 6 = **71** 子目录 | ✅ 通过 |
| 死代码/残留文件 | 0 个 | 无 `.bak/.old/.tmp` 文件，无 `bak/` 目录 | ✅ 通过 |
| `data-testid` 泄漏 | 0 处到非测试文件 | tsx: 0, ts(非test): 0 | ✅ 通过 |
| DDD 分层隔离 | core 不引用 engine 运行时 | 7 处 `import type` 仅类型引用，无运行时依赖 | ✅ 通过 |
| rendering 层隔离 | engine/core 不引用 rendering | 0 处跨层引用 | ✅ 通过 |

---

## 遗留 P1 状态

### P1-1: 邮件域双重导出风险

| 项目 | 说明 |
|------|------|
| **状态** | ✅ 已解决（降级为信息项） |
| **详情** | `core/mail/index.ts` 仅导出类型和常量（无运行时代码）；`engine/mail/index.ts` 导出完整实现（MailSystem、MailPersistence 等）+ 类型 + 向后兼容别名 |
| **风险评估** | **低风险** — 两者的 `mail.types.ts` 各自独立定义类型，`core/mail` 是精简子集，`engine/mail` 是完整集。无外部文件直接引用 `core/mail`（grep 确认 0 引用），所有消费方通过 `engine/mail` 或 `engine/index.ts` 统一导入 |
| **建议** | 可考虑在 `core/mail/index.ts` 中改为 `export type { ... } from '../../engine/mail/mail.types'` 以消除类型重复定义，但非阻塞项 |

### P1-2: ThreeKingdomsEngine.ts 未集成 prestige/unification

| 项目 | 说明 |
|------|------|
| **prestige 状态** | ✅ 已集成 |
| **详情** | 通过 `engine-extended-deps.ts` (R11Systems) 集成：`PrestigeSystem`、`PrestigeShopSystem`、`RebirthSystem` 均已注册到 `ThreeKingdomsEngine.r11`。`engine-getters.ts` 提供 `getPrestigeSystem()` / `getPrestigeShopSystem()` 访问器 |
| **unification 状态** | ✅ 已通过 engine/index.ts 统一导出 |
| **详情** | unification 域包含 17 个文件（BalanceValidator、GraphicsQualityManager、PerformanceMonitor 等），通过 `engine/index.ts` 导出核心工具类。unification 域作为**工具/基础设施层**存在，不需要作为引擎子系统注册（无状态、无 tick 逻辑），设计合理 |
| **结论** | **P1-2 已关闭** |

---

## 新发现问题

### P2-1: core 层存在 7 处对 engine 层的类型引用

| 项目 | 说明 |
|------|------|
| **严重级别** | P2（低） |
| **文件** | `core/bond/bond.types.ts`、`core/expedition/expedition.types.ts`、`core/pvp/pvp.types.ts`、`core/heritage/bond.types.ts`、`core/heritage/heritage.types.ts` |
| **引用内容** | `import type { Faction } from '../../engine/hero/hero.types'` (5处)、`import type { BattleAction, BattleResult, BattleState } from '../../engine/battle/battle.types'` (1处) |
| **影响** | 均为 `import type`（编译时擦除），不构成运行时耦合，但违反了 DDD 核心层不应依赖引擎层的分层原则 |
| **建议** | 将 `Faction`、`GeneralStats`、`BattleAction`、`BattleResult`、`BattleState` 等共享类型提升到 `shared/types.ts` 或 `core/types/` 中 |

### P2-2: 版本号后缀文件名（反模式残留）

| 项目 | 说明 |
|------|------|
| **严重级别** | P2（低） |
| **文件** | `engine/battle/battle-v4.types.ts`、`core/event/event-v15*.ts`（6个文件）、`core/equipment/equipment-v10.types.ts`，共 **8 个文件** |
| **影响** | 文件名含版本号后缀 `-v4`/`-v10`/`-v15`，属于迭代演化残留命名，不影响功能但降低可读性 |
| **建议** | 在后续迭代中重命名为语义化名称（如 `battle-ultimate.types.ts`、`event-activity.types.ts` 等） |

### P2-3: 邮件域 core/engine 类型重复定义

| 项目 | 说明 |
|------|------|
| **严重级别** | P2（低） |
| **详情** | `core/mail/mail.types.ts` 和 `engine/mail/mail.types.ts` 各自独立定义了相同的 `MailCategory`、`MailStatus`、`MailAttachment` 等类型，存在漂移风险 |
| **建议** | core/mail 改为从 engine/mail 重新导出类型，或提升到 shared 层 |

---

## 用户待办处理状态

| 待办项 | 状态 | 说明 |
|--------|------|------|
| DDD 业务域划分 | ✅ 已完成 | 71 个子目录，按业务域清晰组织 |
| 版本号后缀反模式 | ⚠️ 部分残留 | 8 个文件仍带版本号后缀（P2-2），不影响功能 |
| 资源来源完整性 | ✅ 已覆盖 | `addResource` 在 ResourceSystem、engine-building-ops、engine-campaign-deps、heritage 等多路径有调用，资源获取途径完整 |
| 引擎核心文件行数 | ✅ 达标 | ThreeKingdomsEngine.ts: 433行, engine-getters.ts: 271行, engine-save.ts: 485行, engine-tick.ts: 174行 |

---

## 核心指标汇总

```
编译错误:        0
as any:          0 处
exports-v反模式:  0 处
超标文件(>500行): 0 个 (最大 499 行)
DDD域子目录:     71 个 (core:32 + engine:33 + rendering:6)
跨层违规:        7 处 import type (P2, 非阻塞)
死代码/残留:     0 个
data-testid泄漏: 0 处
```

---

## 结论

### ✅ **通过**

**理由**：
1. **编译质量**: 0 错误、0 `as any`、0 反模式 — 代码质量优秀
2. **遗留 P1 全部关闭**: 邮件域双重导出已确认为安全设计（core 为精简类型子集，无外部引用）；prestige 通过 R11 系统完整集成；unification 作为工具层通过 engine/index.ts 统一导出
3. **DDD 分层**: 71 个业务域子目录，分层清晰。仅 7 处 `import type` 跨层引用（编译时擦除），不影响运行时隔离
4. **新发现均为 P2**: 3 个 P2 级别问题（类型引用、版本号命名、邮件类型重复），均非阻塞项，可在后续迭代优化

**建议优先级**：
- P2-1（共享类型提升）→ 下次重构时处理
- P2-2（版本号文件重命名）→ 低优先级
- P2-3（邮件类型统一）→ 低优先级
