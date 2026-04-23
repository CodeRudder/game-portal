# Evolution Progress — v2.1 还债提质 Round 23

> **日期**: 2025-07-25
> **版本**: v2.1 还债提质
> **轮次**: Round 23
> **目标**: 修复R22遗留P1 + 架构评分恢复59+ + 渲染层TODO清理 + 功能覆盖度恢复

---

## R23 Phase 1+2 准备+冒烟报告

### 迭代目标: v2.1还债提质

### 待修复P1

| # | P1问题 | 状态 | 位置 |
|---|--------|------|------|
| 1 | UP武将描述缺失 | ❌ 未修复 | `engine/hero/hero-recruit-config.ts` — 无UP武将池/限定池配置，无featuredGeneral/banner机制 |
| 2 | 每日免费招募未实现 | ❌ 未修复 | `engine/hero/HeroRecruitSystem.ts:180` — `update()` 为空预留注释 `/* 预留：每日免费次数重置等 */` |
| 3 | mail常量重复定义 | ❌ 未修复 | `engine/mail/MailPersistence.ts:27,30` 重复定义 `MAIL_SAVE_VERSION=1` 和 `MAIL_SAVE_KEY`，与 `core/mail/mail.types.ts:33` 冲突 |
| 4 | 400+行文件70个 | ❌ 未修复 | 最高499行(ArenaSystem.ts, StoryEventPlayer.ts)，距500行红线仅1行 |

### 架构现状

| 指标 | 数值 | 目标 | 差距 |
|------|:----:|:----:|:----:|
| **架构评分(估)** | **~57** | 59+ | ⚠️ 差2分 |
| as any 文件数 | 0 | 0 | ✅ |
| @ts-ignore 数 | 0 | 0 | ✅ |
| any 类型(非测试) | 6处 | ≤5 | ⚠️ 差1 |
| >500行超标文件 | 0 | 0 | ✅ |
| 400~499行预警文件 | **70** | <50 | ❌ 严重超标 |
| 渲染层TODO | **40** | ≤30 | ❌ 差10 |
| 测试文件数 | 216 | — | — |
| 非测试TS文件 | 417 | — | — |
| 编译(vite build) | ✅ 通过(39.85s) | — | ✅ |
| 类型检查(tsc) | ✅ 通过(0 error) | — | ✅ |

### 冒烟结果

| 验证项 | 结果 |
|--------|------|
| vite build 编译 | ✅ `✓ built in 39.85s`（有chunk size警告，无error） |
| tsc --noEmit 类型检查 | ✅ 0 error |
| 武将系统测试(19文件) | ✅ **474/474 passed** |
| as any 数量 | ✅ 0 |
| exports-v 残留 | ✅ 0 |
| 版本号后缀残留 | ✅ 0 |
| >500行超标文件 | ✅ 0 |
| 400+行预警文件 | ❌ **70个**（目标<50） |
| 渲染层TODO | ❌ **40个**（目标≤30） |
| mail常量上移 | ❌ `MailPersistence.ts` 本地重复定义 |
| 每日免费招募 | ❌ 未实现（空预留） |
| UP武将描述 | ❌ 缺失（无池/无banner配置） |

### 400+行文件 TOP 20（需优先拆分）

| 行数 | 文件 |
|:----:|------|
| 499 | engine/pvp/ArenaSystem.ts |
| 499 | engine/guide/StoryEventPlayer.ts |
| 496 | engine/npc/NPCPatrolSystem.ts |
| 495 | engine/quest/QuestSystem.ts |
| 491 | core/responsive/responsive.types.ts |
| 489 | engine/tech/TechLinkSystem.ts |
| 488 | engine/event/EventTriggerSystem.ts |
| 487 | engine/tech/FusionTechSystem.ts |
| 485 | engine/engine-save.ts |
| 480 | engine/settings/SettingsManager.ts |
| 477 | engine/hero/HeroLevelSystem.ts |
| 476 | engine/settings/AnimationController.ts |
| 476 | core/guide/guide.types.ts |
| 471 | engine/unification/PerformanceMonitor.ts |
| 470 | engine/expedition/AutoExpeditionSystem.ts |
| 467 | engine/activity/TimedActivitySystem.ts |
| 466 | engine/settings/AccountSystem.ts |
| 459 | engine/battle/BattleTurnExecutor.ts |
| 458 | engine/building/building-config.ts |
| 457 | engine/tech/TechOfflineSystem.ts |

### 渲染层TODO分布（40个）

| 文件 | TODO数 |
|------|:------:|
| rendering/general/GeneralPortraitRenderer.ts | 7 |
| rendering/battle/BattleEffectRenderer.ts | 5 |
| rendering/battle/DamageNumberRenderer.ts | 5 |
| rendering/ui-overlay/ParticleRenderer.ts | 6 |
| rendering/ui-overlay/FloatingTextRenderer.ts | 4 |
| rendering/map/TerritoryRenderer.ts | 6 |
| rendering/map/TileRenderer.ts | 7 |

### mail常量重复问题详情

- `core/mail/mail.types.ts:33` — 定义 `MAIL_SAVE_VERSION`（权威源）
- `core/mail/index.ts:33` — re-export `MAIL_SAVE_VERSION`
- `engine/mail/MailPersistence.ts:27` — **重复定义** `const MAIL_SAVE_VERSION = 1`
- `engine/mail/MailPersistence.ts:30` — **重复定义** `const MAIL_SAVE_KEY = 'three-kingdoms-mails'`

### 结论: Phase 2 ⚠️ 有条件通过

**编译+类型+测试全部绿灯**，但架构评分约57分（目标59+），存在以下阻塞项：

1. **400+行文件70个** → 需拆分至少20个文件降至400以下
2. **渲染层TODO 40个** → 需清理10个降至30以下
3. **mail常量重复** → 需删除 `MailPersistence.ts` 本地定义，改为从 `core/mail` import
4. **每日免费招募** → 需在 `HeroRecruitSystem.ts` 实现免费次数逻辑
5. **UP武将描述** → 需在 `hero-recruit-config.ts` 添加UP池/featured配置

**建议**: Phase 2有条件通过，进入Phase 3实施时优先处理P1-1(mail常量)和P1-2(拆分400+行文件)，这两项对架构评分影响最大。
