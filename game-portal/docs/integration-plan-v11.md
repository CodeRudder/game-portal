# v11.0 集成方案：ArenaSystem / FriendSystem / ChatSystem → ThreeKingdomsEngine

> **文档版本**: v1.0  
> **目标文件**: `src/games/three-kingdoms/ThreeKingdomsEngine.ts` (2986 行)  
> **状态**: 仅分析，不修改引擎文件  
> **并行子任务状态**: ArenaSystem.ts / FriendSystem.ts / ChatSystem.ts 尚未创建

---

## 1. 现有架构概览

### 1.1 引擎类签名

```typescript
export class ThreeKingdomsEngine extends IdleGameEngine {
  protected _gameId = GAME_ID;
  // ...
}
```

### 1.2 现有子系统清单（25 个）

| # | 属性名 | 类型 | 声明方式 | 来源 |
|---|--------|------|----------|------|
| 1 | `bldg` | `BuildingSystem<BuildingDef>` | `private !:` | `@/engines/idle/modules/BuildingSystem` |
| 2 | `prest` | `PrestigeSystem` | `private !:` | `@/engines/idle/modules/PrestigeSystem` |
| 3 | `units` | `UnitSystem` | `private !:` | `@/engines/idle/modules/UnitSystem` |
| 4 | `stages` | `StageSystem<StageDef>` | `private !:` | `@/engines/idle/modules/StageSystem` |
| 5 | `battles` | `BattleSystem<BattleDef>` | `private !:` | `@/engines/idle/modules/BattleSystem` |
| 6 | `techs` | `TechTreeSystem<TechDef>` | `private !:` | `@/engines/idle/modules/TechTreeSystem` |
| 7 | `terr` | `TerritorySystem<TerritoryDef>` | `private !:` | `@/engines/idle/modules/TerritorySystem` |
| 8 | `ftSys` | `FloatingTextSystem` | `private !:` | `@/engines/idle/modules/FloatingTextSystem` |
| 9 | `ptSys` | `ParticleSystem` | `private !:` | `@/engines/idle/modules/ParticleSystem` |
| 10 | `stats` | `StatisticsTracker` | (基类) | `@/engines/idle/modules/StatisticsTracker` |
| 11 | `unlock` | `UnlockChecker` | (基类) | `@/engines/idle/modules/UnlockChecker` |
| 12 | `input` | `InputHandler` | (基类) | `@/engines/idle/modules/InputHandler` |
| 13 | `battleChallenges` | `BattleChallengeSystem` | `private !:` | `./BattleChallengeSystem` |
| 14 | `tutorialStory` | `TutorialStorySystem` | `private !:` | `./TutorialStorySystem` |
| 15 | `mapGen` | `MapGenerator` | `private !:` | `./MapGenerator` |
| 16 | `npcSys` | `NPCSystem` | `private !:` | `./NPCSystem` |
| 17 | `questSys` | `QuestSystem` | `private !:` | `@/engines/idle/modules/QuestSystem` |
| 18 | `eventSys` | `EventSystem` | `private !:` | `@/engines/idle/modules/EventSystem` |
| 19 | `rewardSys` | `RewardSystem` | `private !:` | `@/engines/idle/modules/RewardSystem` |
| 20 | `dayNightWeather` | `DayNightWeatherSystem` | `private !:` | `./DayNightWeatherSystem` |
| 21 | `npcActivitySys` | `NPCActivitySystem` | `private !:` | `./NPCActivitySystem` |
| 22 | `calendar` | `GameCalendarSystem` | `private !:` | `./GameCalendarSystem` |
| 23 | `cityMapSys` | `CityMapSystem` | `private !:` | `./CityMapSystem` |
| 24 | `resourcePointSys` | `ResourcePointSystem` | `private !:` | `./ResourcePointSystem` |
| 25 | `offlineRewardSys` | `OfflineRewardSystem` | `private !:` | `./OfflineRewardSystem` |
| 26 | `tradeRouteSys` | `TradeRouteSystem` | `private !:` | `./TradeRouteSystem` |
| 27 | `eventEnrichSys` | `EventEnrichmentSystem` | `private !:` | `./EventEnrichmentSystem` |
| 28 | `campaignSys` | `CampaignSystem` | `private !:` | `./CampaignSystem` |
| 29 | `campaignBattleSys` | `CampaignBattleSystem` | `private !:` | `./CampaignBattleSystem` |

**非 private（public 属性）**:
- `audioManager: AudioManager` — 直接初始化
- `weatherSystem: WeatherSystem` — 直接初始化
- `dialogueSystem: GeneralDialogueSystem` — 直接初始化
- `bondSystem: GeneralBondSystem` — 直接初始化
- `storyEventSystem: GeneralStoryEventSystem` — 直接初始化

### 1.3 关键行号映射

| 区域 | 行号范围 |
|------|----------|
| Imports | 1–59 |
| 类型定义 (SaveState 等) | 110–145 |
| 属性声明 | 151–243 |
| `onInit()` | 244–410 |
| `onStart()` | 415–420 |
| `update()` 中的子系统更新 | 470–510 |
| `serialize()` | 612–645 |
| `deserialize()` | 648–690 |
| Getter 方法 | 2648–2655 |
| 文件末尾 | 2986 |

---

## 2. 集成方案：逐项代码修改

### 2.1 新增 Import 语句

**插入位置**: 第 57 行之后（`import { RewardSystem }` 之后，`import { DayNightWeatherSystem }` 之前）

```typescript
// ─── v11.0 社交竞技系统 ──
import { ArenaSystem } from './ArenaSystem';
import { FriendSystem } from './FriendSystem';
import { ChatSystem } from './ChatSystem';
```

**说明**:
- 三个新系统文件位于 `src/games/three-kingdoms/` 目录下（与引擎同级）
- 如果系统采用通用引擎模块设计，路径改为 `@/engines/idle/modules/ArenaSystem` 等
- 需根据最终系统设计确认是否需要导出类型（如 `type ArenaRank`, `type FriendProfile`, `type ChatChannel`）

### 2.2 新增 Private 属性声明

**插入位置**: 第 241 行之后（`private campaignBattleSys!: CampaignBattleSystem;` 之后，`// 状态` 注释之前）

```typescript
  // ── v11.0 社交竞技系统 ──
  /** 竞技场系统：PvP 排名/赛季/挑战 */
  private arenaSys!: ArenaSystem;

  /** 好友系统：好友管理/互赠/拜访 */
  private friendSys!: FriendSystem;

  /** 聊天系统：世界/私聊/公会频道 */
  private chatSys!: ChatSystem;
```

**命名约定**:
- 遵循现有 `xxxSys` / `xxx` 简写风格
- 使用 `!:` 非空断言（在 `onInit()` 中初始化）

### 2.3 Constructor (onInit) 中初始化

**插入位置**: `onInit()` 方法内，第 396 行附近（`this.campaignBattleSys = new CampaignBattleSystem();` 之后）

```typescript
    // ── v11.0 社交竞技系统 ──
    this.arenaSys = new ArenaSystem();
    this.friendSys = new FriendSystem();
    this.chatSys = new ChatSystem();
```

**可能需要的初始化配置参数**（取决于系统设计）:

```typescript
    // 如果 ArenaSystem 需要 config：
    this.arenaSys = new ArenaSystem({
      seasonDuration: 7 * 24 * 3600,    // 7天赛季
      maxDailyChallenges: 5,
      rankRewards: { /* ... */ },
    });

    // 如果 FriendSystem 需要引用 InteractionSystem：
    this.friendSys = new FriendSystem(/* 可选: interactionSystem 引用 */);

    // 如果 ChatSystem 需要频道配置：
    this.chatSys = new ChatSystem({
      channels: ['world', 'guild', 'private'],
      maxMessageLength: 200,
      messageCooldown: 3, // 秒
    });
```

### 2.4 Update 方法中的更新调用

**插入位置**: `update()` 方法中子系统更新区域（第 490–510 行附近）

```typescript
    // v11.0 社交竞技系统更新
    this.arenaSys.update(sec);
    this.friendSys.update(sec);
    this.chatSys.update(sec);
```

**注意**: 
- 如果系统不需要每帧更新（如 FriendSystem 纯事件驱动），可省略
- ArenaSystem 可能需要处理赛季倒计时、挑战冷却等
- ChatSystem 可能需要处理消息队列、超时清理等

### 2.5 ThreeKingdomsSaveState 类型扩展

**插入位置**: `ThreeKingdomsSaveState` 接口（第 110–145 行），在 `pityCounterEpic` 之后

```typescript
export interface ThreeKingdomsSaveState {
  // ... 现有字段 ...
  
  /** 保底计数器：史诗+保底 */
  pityCounterEpic?: number;

  // ── v11.0 社交竞技系统 ──
  /** 竞技场存档数据 */
  arena?: object;
  /** 好友系统存档数据 */
  friends?: object;
  /** 聊天系统存档数据 */
  chat?: object;
}
```

### 2.6 Serialize 方法扩展

**插入位置**: `serialize()` 返回对象中（第 635–645 行），在 `pityCounterEpic` 之后

```typescript
  public serialize(): ThreeKingdomsSaveState {
    // ... 现有序列化 ...
    return {
      // ... 现有字段 ...
      pityCounterRare: this.pityCounterRare,
      pityCounterEpic: this.pityCounterEpic,

      // ── v11.0 社交竞技系统 ──
      arena: this.arenaSys.serialize(),
      friends: this.friendSys.serialize(),
      chat: this.chatSys.serialize(),
    };
  }
```

### 2.7 Deserialize 方法扩展

**插入位置**: `deserialize()` 方法末尾（第 690 行附近），在 `pityCounterEpic` 反序列化之后

```typescript
  public deserialize(d: ThreeKingdomsSaveState): void {
    // ... 现有反序列化 ...
    if (d.pityCounterEpic !== undefined) this.pityCounterEpic = d.pityCounterEpic;

    // ── v11.0 社交竞技系统 ──
    if (d.arena) this.arenaSys.deserialize(d.arena as Record<string, unknown>);
    if (d.friends) this.friendSys.deserialize(d.friends as Record<string, unknown>);
    if (d.chat) this.chatSys.deserialize(d.chat as Record<string, unknown>);

    // 重新检查已激活羁绊
    const recruitedIds = this.getRecruitedGeneralIds();
    this.bondSystem.checkAndActivateBonds(recruitedIds);

    this.emit('stateChange');
  }
```

### 2.8 Getter 方法

**插入位置**: 第 2655 行之后（现有 getter 区域末尾）

```typescript
  // ─── v11.0 社交竞技系统集成 ──────────────────────────────

  /** 获取竞技场系统实例 */
  public get arenaSystem(): ArenaSystem { return this.arenaSys; }

  /** 获取好友系统实例 */
  public get friendSystem(): FriendSystem { return this.friendSys; }

  /** 获取聊天系统实例 */
  public get chatSystem(): ChatSystem { return this.chatSys; }
```

---

## 3. 类型依赖分析

### 3.1 需要的系统接口约定

每个新系统必须实现以下最小接口以兼容引擎集成模式：

```typescript
// ArenaSystem 必须实现：
interface IArenaSystem {
  update(sec: number): void;
  serialize(): object;
  deserialize(data: Record<string, unknown>): void;
}

// FriendSystem 必须实现：
interface IFriendSystem {
  update?(sec: number): void;     // 可选：如果纯事件驱动
  serialize(): object;
  deserialize(data: Record<string, unknown>): void;
}

// ChatSystem 必须实现：
interface IChatSystem {
  update(sec: number): void;
  serialize(): object;
  deserialize(data: Record<string, unknown>): void;
}
```

### 3.2 与现有系统的交互点

| 新系统 | 交互系统 | 交互方式 |
|--------|----------|----------|
| **ArenaSystem** | `UnitSystem` | 读取武将列表/属性用于战斗匹配 |
| **ArenaSystem** | `RewardSystem` | 赛季奖励/挑战奖励发放 |
| **ArenaSystem** | `StatisticsTracker` | 记录竞技场胜负统计 |
| **ArenaSystem** | `EventSystem` | 触发竞技事件（赛季开始/结束） |
| **FriendSystem** | `InteractionSystem` | **可能复用**通用引擎的 InteractionSystem |
| **FriendSystem** | `RewardSystem` | 好友互赠奖励 |
| **FriendSystem** | `EventSystem` | 好友事件触发 |
| **ChatSystem** | `InteractionSystem` | **可能复用**通用引擎的聊天功能 |
| **ChatSystem** | `EventSystem` | 聊天事件通知 |

### 3.3 InteractionSystem 复用分析

通用引擎的 `InteractionSystem`（`src/engines/idle/modules/InteractionSystem.ts`）已提供：

| 功能 | InteractionSystem 支持 | 建议 |
|------|----------------------|------|
| 好友管理 | ✅ `addFriend/removeFriend/acceptFriend/blockFriend` | FriendSystem 可继承或组合 |
| 聊天消息 | ✅ `sendMessage/readMessage/getChatHistory` | ChatSystem 可继承或组合 |
| 互赠礼物 | ✅ `sendGift` (含冷却) | FriendSystem 直接复用 |
| 公会系统 | ✅ `createGuild/joinGuild/leaveGuild` | ChatSystem 频道可关联 |
| 序列化 | ✅ `serialize/deserialize` | 已兼容引擎模式 |

**推荐方案**: 
- **FriendSystem** → 组合 `InteractionSystem`，在其基础上扩展三国特色（武将拜访、结义系统等）
- **ChatSystem** → 组合 `InteractionSystem` 的聊天部分，扩展频道系统和三国主题表情
- **ArenaSystem** → 全新实现，不依赖 `InteractionSystem`

---

## 4. 修改清单汇总

| # | 修改点 | 文件位置（行号） | 操作 |
|---|--------|-----------------|------|
| 1 | 新增 3 条 import | L57 之后 | INSERT |
| 2 | 新增 3 个 private 属性 | L241 之后 | INSERT |
| 3 | SaveState 接口新增 3 个字段 | L145 之前 | INSERT |
| 4 | `onInit()` 新增 3 行初始化 | L396 之后 | INSERT |
| 5 | `update()` 新增系统更新调用 | L510 附近 | INSERT |
| 6 | `serialize()` 新增 3 个字段 | L645 之前 | INSERT |
| 7 | `deserialize()` 新增 3 条恢复 | L690 之前 | INSERT |
| 8 | 新增 3 个 getter | L2655 之后 | INSERT |

**预计新增代码量**: ~50 行  
**预计修改文件数**: 1 个（ThreeKingdomsEngine.ts）  
**风险等级**: 低（纯增量修改，不影响现有逻辑）

---

## 5. 集成检查清单

- [ ] ArenaSystem.ts 已创建并实现 `update/serialize/deserialize`
- [ ] FriendSystem.ts 已创建并实现 `serialize/deserialize`
- [ ] ChatSystem.ts 已创建并实现 `update/serialize/deserialize`
- [ ] 三个系统均有默认无参构造函数（或可选配置参数）
- [ ] `ThreeKingdomsSaveState` 接口已扩展
- [ ] 旧存档兼容性：新字段均为 `optional`，旧存档 `deserialize` 不会报错
- [ ] 单元测试：`ThreeKingdomsEngine.test.ts` 新增序列化/反序列化测试
- [ ] TypeScript 编译通过：`npx tsc --noEmit`

---

## 6. 文件依赖关系图

```
ThreeKingdomsEngine.ts
├── @/engines/idle/modules/InteractionSystem  (可选复用)
├── ./ArenaSystem          ← NEW v11.0
├── ./FriendSystem         ← NEW v11.0
├── ./ChatSystem           ← NEW v11.0
├── ./RewardSystem         (竞技奖励)
├── ./EventSystem          (社交事件)
├── ./StatisticsTracker    (竞技统计)
└── ./UnitSystem           (武将数据)
```

---

*文档结束 — 此方案仅用于分析和准备，不包含对 ThreeKingdomsEngine.ts 的实际修改。*
