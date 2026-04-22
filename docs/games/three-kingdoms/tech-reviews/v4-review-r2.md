# v4.0 技术审查 (Round 2) — 攻城略地-下
日期: 2026-04-23
审查范围: `src/games/three-kingdoms/` 全量源码

## 摘要
- **P0问题: 2个** (阻塞发布)
- **P1问题: 3个** (重要，需限期修复)
- **P2问题: 4个** (建议优化)

---

## 1. 文件行数

### 1.1 生产代码超500行 (P0阈值)

| 文件 | 行数 | 分类 | 状态 |
|------|------|------|------|
| `core/event/encounter-templates.ts` | 815 | 配置/模板 | ⚠️ P1 |
| `core/npc/npc-config.ts` | 714 | 配置 | ⚠️ P2 |
| `engine/settings/AccountSystem.ts` | 603 | 引擎子系统 | 🔴 P0 |
| `engine/settings/SaveSlotManager.ts` | 560 | 引擎子系统 | ⚠️ P1 |
| `core/event/event-v15.types.ts` | 548 | 类型定义 | ⚠️ P2 |
| `engine/settings/CloudSaveSystem.ts` | 544 | 引擎子系统 | ⚠️ P1 |
| `engine/activity/ActivitySystem.ts` | 503 | 引擎子系统 | ⚠️ P1 |
| `core/expedition/expedition.types.ts` | 502 | 类型定义 | ⚠️ P2 |

### 1.2 生产代码超400行 (P2阈值)

共计 **~50+** 个文件超过400行，主要集中在:
- `engine/battle/` — BattleEngine(433), BattleTurnExecutor(459), UltimateSkillSystem(439) 等
- `engine/event/` — EventTriggerSystem(487), ChainEventSystem(453) 等
- `engine/tech/` — TechLinkSystem(489), FusionTechSystem(487) 等
- `engine/map/` — 全部5个子系统均超400行
- `engine/settings/` — 全部子系统均超400行

### 1.3 测试文件超500行

| 文件 | 行数 |
|------|------|
| `engine/activity/__tests__/ActivitySystem.test.ts` | 934 |
| `engine/battle/__tests__/BattleTurnExecutor.test.ts` | 897 |
| `engine/equipment/__tests__/EquipmentSystem.test.ts` | 888 |
| `engine/shop/__tests__/ShopSystem.test.ts` | 831 |
| `engine/equipment/__tests__/equipment-v10.test.ts` | 755 |
| `engine/npc/__tests__/NPCMapPlacer.test.ts` | 680 |

> 测试文件超长可接受，但建议拆分以提升可维护性。

---

## 2. DDD门面

### 2.1 engine/index.ts
- **行数**: 138行
- **模式**: ✅ 按DDD业务域组织导出（`export * from './domain'`）
- **域覆盖**: 27个业务域，从v1.0(资源)到v20.0(成就/军师)
- **注释规范**: 每个域标注版本号，清晰明了

### 2.2 exports-vN反模式
- **结果**: ✅ **无** exports-vN文件
- `find src/games/three-kingdoms -name "exports-v*.ts"` 返回空

### 2.3 评价
DDD门面设计良好，按业务域分模块导出，无版本耦合反模式。

---

## 3. ISubsystem实现率

| 指标 | 数值 |
|------|------|
| 实现 ISubsystem 的生产文件 | **87** |
| 引擎子系统总文件(排除test/types/config/index) | **196** |
| **实现率** | **44.4%** |
| 未实现文件数 | **109** |

### 3.1 未实现ISubsystem的关键子系统 (P1)

以下为业务核心子系统，缺少 `implements ISubsystem`：

| 域 | 未实现子系统 |
|----|-------------|
| **battle** | BattleEngine, autoFormation, BattleEffectApplier, DamageCalculator |
| **expedition** | ExpeditionSystem, AutoExpeditionSystem, ExpeditionBattleSystem, ExpeditionRewardSystem |
| **alliance** | AllianceSystem, AllianceBossSystem, AllianceShopSystem, AllianceTaskSystem |
| **pvp** | ArenaSystem, PvPBattleSystem, ArenaSeasonSystem, ArenaShopSystem, RankingSystem, DefenseFormationSystem |
| **settings** | SettingsManager, AccountSystem, CloudSaveSystem, SaveSlotManager, AudioManager, AnimationController, GraphicsManager |
| **social** | FriendSystem, ChatSystem, LeaderboardSystem, BorrowHeroSubsystem |
| **mail** | MailSystem, MailPersistence, MailTemplateSystem |
| **offline** | OfflineRewardSystem, OfflineRewardEngine, OfflineSnapshotSystem 等7个 |
| **responsive** | 全部7个子系统均未实现 |
| **activity** | ActivitySystem, SignInSystem, TimedActivitySystem, TokenShopSystem 等 |
| **map** | MapDataRenderer, MapFilterSystem |

### 3.2 辅助/工具类 (可豁免)

以下文件为纯工具/辅助/数据类，ISubsystem实现可豁免：
- `engine/engine-*-deps.ts` (6个) — 引擎内部依赖注入
- `engine/engine-tick.ts`, `engine-engine-getters.ts` — 引擎内部逻辑
- `campaign-chapter*.ts` (6个) — 关卡数据
- `*-helpers.ts`, `*-utils.ts`, `*-calculator.ts` — 纯函数工具
- `core/` 下全部文件 — 类型/配置层

**豁免后实际未实现子系统约 ~70个**，实现率约 **55%**。

---

## 4. data-testid覆盖

| 指标 | 数值 |
|------|------|
| `.tsx` 文件中的 data-testid | **0** |
| `.ts` 文件中的 data-testid | **4** (测试工具类) |
| **UI组件(.tsx)总数** | **0** |
| **总覆盖** | **极低** |

### 4.1 分析
- 项目中 **不存在任何 `.tsx` 文件**，所有UI通过 PixiJS 渲染层实现
- `data-testid` 仅出现在 `tests/ui-extractor/` 的测试工具中(4处)
- PixiJS渲染组件无法使用DOM的 `data-testid`，需通过其他方式实现E2E定位

---

## 5. `as any` 使用

| 分类 | 数量 |
|------|------|
| **生产代码** | **14处** (8个文件) |
| **测试代码** | **118处** |
| **总计** | **132处** |

### 5.1 生产代码中的 `as any` (P1)

| 文件 | 数量 | 说明 |
|------|------|------|
| `engine/unification/SettingsManager.ts` | 5 | 设置管理器类型逃逸 |
| `engine/unification/AccountSystem.ts` | 2 | 账户系统 |
| `engine/settings/GraphicsManager.ts` | 2 | 图形设置 |
| `engine/resource/ResourceSystem.ts` | 1 | 资源系统 |
| `engine/expedition/ExpeditionSystem.ts` | 1 | 远征系统 |
| `engine/equipment/EquipmentSystem.ts` | 1 | 装备系统 |
| `engine/equipment/EquipmentRecommendSystem.ts` | 1 | 装备推荐 |
| `engine/unification/GraphicsQualityManager.ts` | 1 | 图形质量 |

### 5.2 测试代码中的 `as any`
118处测试 `as any` 可接受（测试场景需要绕过类型），但仍建议逐步替换为 `as unknown as TargetType` 或创建专门的测试工具类型。

---

## P0问题 (阻塞发布)

### P0-1: AccountSystem.ts 超过600行 (603行)
- **文件**: `engine/settings/AccountSystem.ts`
- **风险**: 单文件承载过多职责，难以维护和测试
- **建议**: 拆分为 AccountSystem(~300行) + AccountSerializer + AccountValidator

### P0-2: ISubsystem 实现率严重不足 (44.4%)
- **影响域**: battle, expedition, alliance, pvp, settings, social, mail, offline, responsive, activity, map
- **风险**: 子系统无法被引擎统一生命周期管理（init/update/destroy），运行时可能遗漏初始化
- **建议**: 
  1. 优先为 battle(BattleEngine), expedition(ExpeditionSystem), alliance(AllianceSystem) 等核心子系统补充实现
  2. 辅助类(Helper/Calculator/Utils)可豁免，但需在文件头注释标注 `@subsystem-type utility`

---

## P1问题 (重要)

### P1-1: 生产代码中14处 `as any` 类型逃逸
- **热点**: SettingsManager(5处), AccountSystem(2处), GraphicsManager(2处)
- **建议**: 替换为具体类型或 `as unknown as TargetType`，至少消除 SettingsManager 和 AccountSystem 中的 `as any`

### P1-2: SaveSlotManager(560行) 和 CloudSaveSystem(544行) 过长
- **建议**: 抽取序列化/反序列化逻辑为独立模块

### P1-3: 8个生产文件超过500行
- encounter-templates.ts(815), npc-config.ts(714) 等配置文件建议拆分为按模块导入的子配置

---

## P2问题 (建议)

### P2-1: 无 `.tsx` 文件，缺少 DOM 级 `data-testid` 覆盖
- PixiJS渲染架构下无法直接使用 DOM test-id
- **建议**: 为关键UI节点添加 `name` 或 `id` 属性，并在E2E测试中通过 PixiJS tree walker 定位

### P2-2: 测试文件普遍偏长（6个超600行）
- ActivitySystem.test.ts(934), BattleTurnExecutor.test.ts(897) 等
- **建议**: 按场景拆分测试文件（如 `ActivitySystem.lifecycle.test.ts`, `ActivitySystem.rewards.test.ts`）

### P2-3: `core/` 层存在大文件
- encounter-templates.ts(815), npc-config.ts(714), event-v15.types.ts(548), expedition.types.ts(502)
- 类型/配置文件过长影响IDE性能，建议按子域拆分

### P2-4: 测试代码118处 `as any`
- 不阻塞发布，但建议逐步替换为类型安全的测试工具函数

---

## 审查结论

| 维度 | 评分 | 说明 |
|------|------|------|
| DDD门面 | ✅ 优秀 | 按业务域导出，无exports-vN反模式 |
| 文件行数 | ⚠️ 需改进 | 2个生产文件超600行，8个超500行 |
| ISubsystem | 🔴 不足 | 44.4%实现率，核心域大量缺失 |
| data-testid | ⚠️ 受限 | PixiJS架构下无法使用DOM test-id |
| 类型安全 | ⚠️ 需改进 | 14处生产代码 `as any` |

**发布建议**: 修复 P0-1(AccountSystem拆分) 和 P0-2(核心子系统ISubsystem补充) 后可发布。P1问题建议在下一迭代修复。
