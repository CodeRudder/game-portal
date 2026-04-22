# v5.0 技术审查 (Round 2)
日期: 2026-04-23

## 摘要
- **P0问题: 2个**
- **P1问题: 3个**
- **P2问题: 2个**

---

## 文件行数

### 生产代码超标 (>500行)

| 行数 | 文件 |
|------|------|
| 815 | `core/event/encounter-templates.ts` |
| 714 | `core/npc/npc-config.ts` |
| 548 | `core/event/event-v15.types.ts` |
| 503 | `engine/activity/ActivitySystem.ts` |
| 502 | `core/expedition/expedition.types.ts` |

### 测试代码超标 (>500行) — 30个文件

| 行数 | 文件 |
|------|------|
| 934 | `engine/activity/__tests__/ActivitySystem.test.ts` |
| 897 | `engine/battle/__tests__/BattleTurnExecutor.test.ts` |
| 888 | `engine/equipment/__tests__/EquipmentSystem.test.ts` |
| 831 | `engine/shop/__tests__/ShopSystem.test.ts` |
| 755 | `engine/equipment/__tests__/equipment-v10.test.ts` |
| 680 | `engine/npc/__tests__/NPCMapPlacer.test.ts` |
| 666 | `engine/event/__tests__/EventTriggerSystem.test.ts` |
| 646 | `engine/npc/__tests__/NPCPatrolSystem.test.ts` |
| 645 | `engine/campaign/__tests__/CampaignProgressSystem.test.ts` |
| 643 | `engine/event/__tests__/EventNotificationSystem.test.ts` |
| 623 | `engine/responsive/__tests__/TouchInputSystem.test.ts` |
| 623 | `engine/npc/__tests__/NPCAffinitySystem.test.ts` |
| 612 | `engine/battle/__tests__/BattleEngine.test.ts` |
| 607 | `engine/heritage/__tests__/HeritageSystem.test.ts` |
| 605 | `engine/__tests__/ThreeKingdomsEngine.test.ts` |
| 593 | `tests/ui-extractor/__tests__/ReactDOMAdapter.test.ts` |
| 590 | `engine/quest/__tests__/QuestSystem.test.ts` |
| 582 | `engine/campaign/__tests__/RewardDistributor.test.ts` |
| 577 | `engine/event/__tests__/EventEngine.test.ts` |
| 570 | `engine/activity/__tests__/SignInSystem.test.ts` |
| 566 | `engine/npc/__tests__/NPCFavorabilitySystem.test.ts` |
| 558 | `engine/alliance/__tests__/AllianceSystem.test.ts` |
| 554 | `engine/pvp/__tests__/ArenaSystem.test.ts` |
| 549 | `engine/mail/__tests__/MailSystem.test.ts` |
| 549 | `engine/expedition/__tests__/ExpeditionSystem.test.ts` |
| 534 | `engine/event/__tests__/EventTriggerEngine.test.ts` |
| 529 | `engine/battle/__tests__/BattleEffectManager.test.ts` |
| 511 | `engine/__tests__/engine-tech-integration.test.ts` |
| 509 | `tests/ui-extractor/__tests__/UITreeDiffer.test.ts` |
| 502 | `tests/ui-review/__tests__/PrdChecker.test.ts` |

---

## DDD门面

- **engine/index.ts: 138行** ✅ (≤500行，符合规范)
- **exports-vN反模式: 有** ⚠️
  - `engine/exports-v9.ts` — v9.0 离线收益+邮件系统导出
  - `engine/exports-v12.ts` — v12.0 远征+引导+排行榜导出
  - 注释声称"从 index.ts 拆分，保持 index.ts ≤500行"，但当前 index.ts 仅138行，说明历史拆分遗留未合并

---

## ISubsystem

- **实现数: 90** (含2个类型定义中的声明)
- 覆盖域: resource, building, calendar, hero, bond, battle, campaign, tech(7个), npc(9个), event(11个), quest, currency, shop, trade, offline, mail, equipment, pvp, social, expedition, leaderboard, alliance, prestige, heritage, activity, guide, responsive, settings, unification, advisor, achievement, map

---

## as any

| 类别 | 数量 |
|------|------|
| 生产代码 | **7处** (6个文件) |
| 测试代码 | **102处** (46个文件) |

### 生产代码 as any 详情

| 文件 | 次数 |
|------|------|
| `engine/settings/GraphicsManager.ts` | 2 |
| `engine/expedition/ExpeditionSystem.ts` | 1 |
| `engine/resource/ResourceSystem.ts` | 1 |
| `engine/equipment/EquipmentRecommendSystem.ts` | 1 |
| `engine/equipment/EquipmentSystem.ts` | 1 |
| `engine/unification/GraphicsQualityManager.ts` | 1 |

---

## v5 科技域文件清单

### engine/tech/ (4429行)

| 行数 | 文件 |
|------|------|
| 489 | `TechLinkSystem.ts` |
| 487 | `FusionTechSystem.ts` |
| 457 | `TechOfflineSystem.ts` |
| 437 | `TechDetailProvider.ts` |
| 425 | `TechEffectApplier.ts` |
| 420 | `TechTreeSystem.ts` |
| 413 | `TechEffectSystem.ts` |
| 361 | `TechResearchSystem.ts` |
| 270 | `fusion-tech.types.ts` |
| 226 | `tech.types.ts` |
| 167 | `TechPointSystem.ts` |
| 164 | `tech-config.ts` |
| 113 | `index.ts` |

### core/tech/ (154行)

| 行数 | 文件 |
|------|------|
| 134 | `offline-research.types.ts` |
| 20 | `index.ts` |

### 测试覆盖: 15个测试文件 ✅

### 依赖注入: `engine/engine-tech-deps.ts` (122行) ✅

---

## P0/P1/P2 问题详情

### 🔴 P0 — 必须修复

#### P0-1: 生产代码 `as any` 类型安全违规 (7处)
- **严重性**: 类型安全是DDD架构的基石，生产代码中的 `as any` 绕过编译器检查，可能引发运行时崩溃
- **影响文件**: `GraphicsManager.ts(2)`, `ExpeditionSystem.ts(1)`, `ResourceSystem.ts(1)`, `EquipmentRecommendSystem.ts(1)`, `EquipmentSystem.ts(1)`, `GraphicsQualityManager.ts(1)`
- **修复方案**: 用正确的类型断言或类型守卫替换所有 `as any`

#### P0-2: 超大配置文件未拆分 (encounter-templates.ts 815行)
- **严重性**: 815行的模板配置文件超出500行标准65%，维护困难且合并冲突风险高
- **影响文件**: `core/event/encounter-templates.ts` (815行), `core/npc/npc-config.ts` (714行)
- **修复方案**: 按事件类型/区域拆分为独立模块，通过index.ts聚合导出

### 🟡 P1 — 应当修复

#### P1-1: exports-vN 反模式遗留
- **严重性**: `exports-v9.ts` 和 `exports-v12.ts` 是历史版本拆分的遗留产物，当前 `engine/index.ts` 仅138行，完全不需要额外拆分文件
- **影响**: 增加维护成本，新开发者难以确定导入入口，违反DDD统一门面原则
- **修复方案**: 将 exports-v9.ts 和 exports-v12.ts 内容合并回 engine/index.ts，删除遗留文件

#### P1-2: 测试文件 `as any` 泛滥 (102处/46个文件)
- **严重性**: 测试中使用 `as any` 掩盖了类型不匹配问题，降低测试有效性
- **重点文件**: `calendar-advanced.test.ts(8)`, `EquipmentSystem.test.ts(8)`, `CaravanSystem.test.ts(5)`, `ArenaSystem.test.ts(5)`, `CurrencySystem.test.ts(5)`
- **修复方案**: 创建专用 `createMock<T>()` 工厂函数替代 `as any`，建立测试类型安全规范

#### P1-3: 30个测试文件超过500行
- **严重性**: 最大测试文件934行 (ActivitySystem.test.ts)，测试可读性差，定位失败用例困难
- **修复方案**: 按测试场景拆分，如 `ActivitySystem.signin.test.ts`、`ActivitySystem.rewards.test.ts`

### 🟢 P2 — 建议改进

#### P2-1: core层类型文件超标
- **文件**: `core/event/event-v15.types.ts` (548行), `core/expedition/expedition.types.ts` (502行)
- **建议**: 考虑按子域拆分类型定义，提升可读性

#### P2-2: engine/tech 域文件接近超标线
- **文件**: `TechLinkSystem.ts` (489行), `FusionTechSystem.ts` (487行)
- **建议**: 持续监控，若功能继续增长需提前规划拆分策略

---

## 总结

| 指标 | 状态 | 值 |
|------|------|-----|
| engine/index.ts 行数 | ✅ 合规 | 138行 |
| ISubsystem 实现数 | ✅ 正常 | 90 |
| 生产代码 as any | ❌ 不合规 | 7处 |
| 测试代码 as any | ⚠️ 需改进 | 102处 |
| 生产代码超标文件 | ❌ 不合规 | 5个 |
| 测试代码超标文件 | ⚠️ 需改进 | 30个 |
| exports-vN 反模式 | ⚠️ 存在 | 2个 |
| v5科技域测试覆盖 | ✅ 充分 | 15个测试文件 |
| v5科技域依赖注入 | ✅ 独立 | engine-tech-deps.ts |
