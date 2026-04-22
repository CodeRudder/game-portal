# ISubsystem 覆盖率扫描报告 — R4

> **扫描时间**: 2025-07-09  
> **扫描范围**: `src/games/three-kingdoms/engine/`  
> **接口定义**: `src/games/three-kingdoms/core/types/subsystem.ts`

---

## 1. ISubsystem 接口要求

实现 `ISubsystem` 需满足以下 5 个契约：

| 成员 | 类型 | 说明 |
|------|------|------|
| `readonly name: string` | getter | 子系统唯一标识 |
| `init(deps: ISystemDeps): void` | method | 注入依赖、注册事件、初始化状态 |
| `update(dt: number): void` | method | 每帧/每回合业务逻辑 |
| `getState(): unknown` | method | 返回可序列化状态快照 |
| `reset(): void` | method | 恢复初始状态，清除运行时数据 |

---

## 2. 全局覆盖率总览

| 指标 | 数量 |
|------|------|
| **已实现 ISubsystem** ✅ | **87** |
| **未实现 ISubsystem** ❌ | **30** |
| **System 类总计** | **117** |
| **全局覆盖率** | **74.4%** |

---

## 3. 按模块分组详情

### ✅ 已完全覆盖的模块（覆盖率 100%）

| 模块 | 已实现类数 |
|------|-----------|
| `npc/` | 10 |
| `tech/` | 8 |
| `bond/` | 1 |
| `building/` | 1 |
| `trade/` | 2 |
| `responsive/` | 6 |
| `shop/` | 1 |
| `advisor/` | 1 |
| `event/` | 12 |
| `calendar/` | 1 |
| `guide/` | 6 |
| `resource/` | 1 |
| `battle/` | 9 |
| `hero/` | 5 |
| `equipment/` | 5 |
| `currency/` | 1 |
| `achievement/` | 1 |
| `quest/` | 3 |
| `unification/` | 7 |
| `campaign/` | 4 |
| `heritage/` | 1 |
| `prestige/` | 3 |
| `map/` (TerritorySystem, SiegeEnhancer, SiegeSystem, WorldMapSystem, GarrisonSystem) | 5 |

### ❌ 未覆盖的模块

---

#### 模块: `mail/` — 覆盖率 0/2 (0%)

| 类名 | 文件 | 已有部分方法 | 需补充方法 |
|------|------|-------------|-----------|
| `MailSystem` | `mail/MailSystem.ts` | `reset()` ✅ | `name`, `init()`, `update()`, `getState()` |
| `MailTemplateSystem` | `mail/MailTemplateSystem.ts` | `reset()` ✅ | `name`, `init()`, `update()`, `getState()` |

---

#### 模块: `expedition/` — 覆盖率 0/4 (0%)

| 类名 | 文件 | 已有部分方法 | 需补充方法 |
|------|------|-------------|-----------|
| `ExpeditionSystem` | `expedition/ExpeditionSystem.ts` | `getState()` ✅ | `name`, `init()`, `update()`, `reset()` |
| `ExpeditionBattleSystem` | `expedition/ExpeditionBattleSystem.ts` | 无 | `name`, `init()`, `update()`, `getState()`, `reset()` |
| `ExpeditionRewardSystem` | `expedition/ExpeditionRewardSystem.ts` | 无 | `name`, `init()`, `update()`, `getState()`, `reset()` |
| `AutoExpeditionSystem` | `expedition/AutoExpeditionSystem.ts` | 无 | `name`, `init()`, `update()`, `getState()`, `reset()` |

---

#### 模块: `social/` — 覆盖率 0/3 (0%)

| 类名 | 文件 | 已有部分方法 | 需补充方法 |
|------|------|-------------|-----------|
| `ChatSystem` | `social/ChatSystem.ts` | 无 | `name`, `init()`, `update()`, `getState()`, `reset()` |
| `LeaderboardSystem` | `social/LeaderboardSystem.ts` | `getState()` ✅ | `name`, `init()`, `update()`, `reset()` |
| `FriendSystem` | `social/FriendSystem.ts` | 无 | `name`, `init()`, `update()`, `getState()`, `reset()` |

> ⚠️ `social/LeaderboardSystem` 与 `leaderboard/LeaderboardSystem` 是**不同的类**（前者侧重全服排名+赛季，后者侧重多维度排名+每日刷新），均需独立实现 ISubsystem。

---

#### 模块: `offline/` — 覆盖率 0/3 (0%)

| 类名 | 文件 | 已有部分方法 | 需补充方法 |
|------|------|-------------|-----------|
| `OfflineRewardSystem` | `offline/OfflineRewardSystem.ts` | `reset()` ✅ | `name`, `init()`, `update()`, `getState()` |
| `OfflineEstimateSystem` | `offline/OfflineEstimateSystem.ts` | `reset()` ✅ | `name`, `init()`, `update()`, `getState()` |
| `OfflineSnapshotSystem` | `offline/OfflineSnapshotSystem.ts` | `reset()` ✅ | `name`, `init()`, `update()`, `getState()` |

---

#### 模块: `pvp/` — 覆盖率 0/6 (0%)

| 类名 | 文件 | 已有部分方法 | 需补充方法 |
|------|------|-------------|-----------|
| `ArenaSystem` | `pvp/ArenaSystem.ts` | 无 | `name`, `init()`, `update()`, `getState()`, `reset()` |
| `ArenaShopSystem` | `pvp/ArenaShopSystem.ts` | 无 | `name`, `init()`, `update()`, `getState()`, `reset()` |
| `RankingSystem` | `pvp/RankingSystem.ts` | 无 | `name`, `init()`, `update()`, `getState()`, `reset()` |
| `DefenseFormationSystem` | `pvp/DefenseFormationSystem.ts` | 无 | `name`, `init()`, `update()`, `getState()`, `reset()` |
| `ArenaSeasonSystem` | `pvp/ArenaSeasonSystem.ts` | 无 | `name`, `init()`, `update()`, `getState()`, `reset()` |
| `PvPBattleSystem` | `pvp/PvPBattleSystem.ts` | 无 | `name`, `init()`, `update()`, `getState()`, `reset()` |

---

#### 模块: `settings/` — 覆盖率 0/2 (0%)

| 类名 | 文件 | 已有部分方法 | 需补充方法 |
|------|------|-------------|-----------|
| `CloudSaveSystem` | `settings/CloudSaveSystem.ts` | `getState()` ✅, `reset()` ✅ | `name`, `init()`, `update()` |
| `AccountSystem` | `settings/AccountSystem.ts` | `reset()` ✅ | `name`, `init()`, `update()`, `getState()` |

---

#### 模块: `activity/` — 覆盖率 0/4 (0%)

| 类名 | 文件 | 已有部分方法 | 需补充方法 |
|------|------|-------------|-----------|
| `TokenShopSystem` | `activity/TokenShopSystem.ts` | 无 | `name`, `init()`, `update()`, `getState()`, `reset()` |
| `TimedActivitySystem` | `activity/TimedActivitySystem.ts` | 无 | `name`, `init()`, `update()`, `getState()`, `reset()` |
| `SignInSystem` | `activity/SignInSystem.ts` | 无 | `name`, `init()`, `update()`, `getState()`, `reset()` |
| `ActivitySystem` | `activity/ActivitySystem.ts` | 无 | `name`, `init()`, `update()`, `getState()`, `reset()` |

> ⚠️ `activity/ActivitySystem` 与 `quest/ActivitySystem` 是**不同的类**（前者管理 5 类活动矩阵+里程碑，后者管理日常活跃度+宝箱），均需独立实现 ISubsystem。

---

#### 模块: `alliance/` — 覆盖率 0/4 (0%)

| 类名 | 文件 | 已有部分方法 | 需补充方法 |
|------|------|-------------|-----------|
| `AllianceSystem` | `alliance/AllianceSystem.ts` | 无 | `name`, `init()`, `update()`, `getState()`, `reset()` |
| `AllianceBossSystem` | `alliance/AllianceBossSystem.ts` | 无 | `name`, `init()`, `update()`, `getState()`, `reset()` |
| `AllianceShopSystem` | `alliance/AllianceShopSystem.ts` | 无 | `name`, `init()`, `update()`, `getState()`, `reset()` |
| `AllianceTaskSystem` | `alliance/AllianceTaskSystem.ts` | 无 | `name`, `init()`, `update()`, `getState()`, `reset()` |

---

#### 模块: `leaderboard/` — 覆盖率 0/1 (0%)

| 类名 | 文件 | 已有部分方法 | 需补充方法 |
|------|------|-------------|-----------|
| `LeaderboardSystem` | `leaderboard/LeaderboardSystem.ts` | `getState()` ✅ | `name`, `init()`, `update()`, `reset()` |

---

#### 模块: `map/` — 覆盖率 5/6 (83.3%)

| 类名 | 文件 | 已有部分方法 | 需补充方法 |
|------|------|-------------|-----------|
| `MapFilterSystem` | `map/MapFilterSystem.ts` | 无 | `name`, `init()`, `update()`, `getState()`, `reset()` |

> `map/` 模块其余 5 个类（TerritorySystem, SiegeEnhancer, SiegeSystem, WorldMapSystem, GarrisonSystem）已实现 ISubsystem ✅

---

## 4. 模块覆盖率排行

| 排名 | 模块 | 已实现 | 总数 | 覆盖率 | 优先级 |
|------|------|--------|------|--------|--------|
| 1 | `pvp/` | 0 | 6 | 0% | 🔴 高 |
| 2 | `alliance/` | 0 | 4 | 0% | 🔴 高 |
| 3 | `expedition/` | 0 | 4 | 0% | 🔴 高 |
| 4 | `activity/` | 0 | 4 | 0% | 🔴 高 |
| 5 | `social/` | 0 | 3 | 0% | 🟡 中 |
| 6 | `offline/` | 0 | 3 | 0% | 🟡 中 |
| 7 | `mail/` | 0 | 2 | 0% | 🟡 中 |
| 8 | `settings/` | 0 | 2 | 0% | 🟡 中 |
| 9 | `leaderboard/` | 0 | 1 | 0% | 🟢 低 |
| 10 | `map/` | 5 | 6 | 83% | 🟢 低 |
| — | 其余 23 个模块 | 87 | 87 | 100% | ✅ 完成 |

---

## 5. 修复工作量估算

| 类别 | 数量 | 说明 |
|------|------|------|
| 仅需 `implements ISubsystem` + 少量方法 | 7 | 已有部分方法（reset/getState），仅需补充剩余 |
| 需完整实现 5 个接口方法 | 23 | 无任何现有方法匹配 |
| **总计需修改文件** | **30** | |

### 按方法统计缺失数量

| 缺失方法 | 出现次数 |
|----------|---------|
| `readonly name` | 30 |
| `init(deps)` | 30 |
| `update(dt)` | 30 |
| `getState()` | 23 |
| `reset()` | 19 |
| **缺失方法总计** | **132** |

---

## 6. 修复模板参考

每个未实现的类需按以下模式改造：

```typescript
// 1. 添加 implements ISubsystem
export class XxxSystem implements ISubsystem {

  // 2. 添加 name getter（如果不存在）
  readonly name = 'xxx';

  // 3. 添加 init（如果不存在）
  init(deps: ISystemDeps): void {
    // 从 deps 注入依赖
    // 注册事件监听
    // 初始化内部状态
  }

  // 4. 添加 update（如果不存在）
  update(dt: number): void {
    // 每帧/每回合逻辑（无帧逻辑可留空）
  }

  // 5. 添加 getState（如果不存在）
  getState(): unknown {
    return { /* 可序列化状态快照 */ };
  }

  // 6. 添加 reset（如果不存在）
  reset(): void {
    // 恢复初始状态
  }
}
```

---

## 7. 建议修复顺序

### Phase 1 — 高优先级（核心玩法模块）
1. **`pvp/`** (6 个类) — 竞技场核心，影响 PvP 全链路
2. **`expedition/`** (4 个类) — 远征系统，影响 PvE 玩法
3. **`alliance/`** (4 个类) — 公会系统，社交核心

### Phase 2 — 中优先级（辅助系统）
4. **`activity/`** (4 个类) — 活动系统，运营核心
5. **`offline/`** (3 个类) — 离线收益，已有 `reset()` 基础
6. **`social/`** (3 个类) — 社交系统
7. **`mail/`** (2 个类) — 邮件系统，已有 `reset()` 基础
8. **`settings/`** (2 个类) — 设置系统，已有部分方法

### Phase 3 — 低优先级（收尾）
9. **`leaderboard/`** (1 个类) — 独立排行榜，已有 `getState()`
10. **`map/MapFilterSystem`** (1 个类) — 地图模块最后一个

---

## 8. 风险提示

| 风险 | 说明 | 建议 |
|------|------|------|
| **name 冲突** | `social/LeaderboardSystem` 与 `leaderboard/LeaderboardSystem` 需使用不同 name 标识 | 建议分别命名为 `social-leaderboard` 和 `leaderboard` |
| **name 冲突** | `activity/ActivitySystem` 与 `quest/ActivitySystem` 需使用不同 name 标识 | 建议分别命名为 `activity` 和 `quest-activity` |
| **空 update()** | 部分系统无帧逻辑，`update()` 需留空实现 | 可接受，但应加注释说明 |
| **依赖注入** | `init(deps)` 需要各系统梳理实际依赖 | 建议逐模块检查现有构造函数依赖 |
