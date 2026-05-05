# 天下地图核心数据结构定义

> **版本**: v1.2 | **日期**: 2026-05-05
> **用途**: 天下地图系统实施的数据契约，所有流程文档引用的数据结构以此为准
> **架构假设**: 纯客户端本地游戏，数据存储于 localStorage / IndexedDB

---

## 基础类型

```typescript
// 坐标系: 色块坐标 (320x240 网格)
type BlockCoord = { x: number; y: number }; // x: 0~319, y: 0~239

// 阵营枚举
type Faction = 'wei' | 'shu' | 'wu' | 'neutral' | 'enemy';

// 地形类型枚举
type TerrainType = 'plains' | 'mountain' | 'forest' | 'desert' | 'water' | 'snow';

// 战斗结果枚举（3档系统，FL-MAP-17 权威来源）
type BattleResult = 'victory' | 'defeat' | 'crushing_defeat';

// 受伤等级（FL-MAP-17 S3）
type InjuryLevel = 'light' | 'medium' | 'heavy';

// 攻城策略（FL-MAP-09 Stage P4）
type SiegeStrategy = 'assault' | 'surround' | 'night_raid' | 'insider';

// [P1-R2-05] 策略修正系数常量表
// 注意：城防衰减和编队战力使用不同的修正系数
const SIEGE_STRATEGY_WALL_DECAY_MODIFIER: Record<SiegeStrategy, number> = {
  'assault': 1.2,          // [P1-fix] key aligned with SiegeStrategy type
  'surround': 0.8,
  'night_raid': 1.5,
  'insider': 1.3,
};

const SIEGE_STRATEGY_FORCE_POWER_MODIFIER: Record<SiegeStrategy, number> = {
  'assault': 1.5,          // [P1-fix] key aligned with SiegeStrategy type
  'surround': 0.8,
  'night_raid': 1.2,
  'insider': 2.0,
};

// 编队状态（FL-MAP-16，由 SiegeTask 驱动变更）
// [P1-M-03] cancelled: SiegeTask取消时编队直接执行销毁流程（归还兵力+释放将领），不经过cancelled ForceStatus中间状态
type ForceStatus = 'ready' | 'marching' | 'fighting' | 'returning';

// 城市类型（FL-MAP-03-02）
type CityType = 'capital' | 'major' | 'minor';

// 道路类型（FL-MAP-03-03）
type RoadType = 'main' | 'branch';

// 领土类型（INT-R2-03）
type TerritoryType = 'city' | 'resource' | 'pass' | 'plain';

// 资源类型
type ResourceType = 'food' | 'gold' | 'iron';
```

---

## 地图配置

> 来源: FL-MAP-01 地图数据加载, FL-MAP-03 读取地图配置

```typescript
interface MapConfig {
  width: 320;           // 色块列数
  height: 240;          // 色块行数
  blockSize: 8;         // 基础色块像素尺寸 (px)
  factions: FactionConfig[];
}

interface FactionConfig {
  id: Faction;
  name: string;            // 中文名称（魏/蜀/吴）
  color: string;           // 阵营主题色 (#hex)
  initialCity: BlockCoord; // 初始城市色块坐标
}
```

**阵营初始城市坐标**（FL-MAP-01-04）:
- 魏 -> 邺城 (80, 40)
- 蜀 -> 成都 (40, 170)
- 吴 -> 建业 (220, 160)

---

## 地图数据

> 来源: FL-MAP-01-02 地图数据加载, FL-MAP-03-00 读取地图配置

```typescript
interface MapData {
  blocks: TerrainBlock[];       // 色块数组 (320x240 = 76800)
  cities: CityData[];           // 城市列表
  roads: RoadSegment[];         // 道路段列表
  territories: TerritoryData[]; // 领土列表
}

interface TerrainBlock {
  terrain: TerrainType;
  variant: number;       // 变体编号 0~3（基础/浅色/中间/深色）
  faction?: Faction;     // 所属阵营（可选）
  territoryId?: number;  // 所属领土ID（可选）
}
```

### TERRAIN_PALETTE 调色板（FL-MAP-03-01）

| 色号 | 地形 | variant 0 (基础) | variant 1 | variant 2 | variant 3 |
|------|------|-----------------|-----------|-----------|-----------|
| 0-3 | 平原 (plains) | #7EC850 | #8DD460 | #6DB840 | #5CA830 |
| 4-7 | 山地 (mountain) | #A08060 | #907050 | #B09070 | #C0A080 |
| 8-11 | 森林 (forest) | #4A8030 | #3A7020 | #5A9040 | #6AA050 |
| 12-15 | 水域 (water) | #4080C0 | #5090D0 | #3070B0 | #2060A0 |
| 16-19 | 沙漠 (desert) | #D0B070 | #C0A060 | #E0C080 | #B09050 |
| 20-23 | 雪地 (snow) | #E8E8F0 | #D0D0E0 | #B8B8D0 | #C8C8E0 |

查表逻辑: `terrainTypeIndex * 4 + variant = paletteIndex`

---

## 城市数据

> 来源: FL-MAP-03-02 城市渲染, FL-MAP-09 Stage P1

```typescript
interface CityData {
  id: number;
  name: string;
  coord: BlockCoord;        // 城市色块坐标
  faction: Faction;
  type: CityType;           // 'capital' | 'major' | 'minor'
  defense: number;          // 城防值 (0~defenseMax)
  defenseMax: number;       // 城防最大值
  level: number;            // 城市等级 (1~15)
  wallLevel: number;        // 城墙等级（影响城防系数）
}
```

**城防初始值公式**（FL-MAP-09 V-029）:
`城防初始值 = 基础值(500) + 城墙等级 * 50`

**城防系数**（FL-MAP-09 AC-09-01）:
`城防系数 = 1.0 + 城墙等级 * 0.05`

### 城市精灵规格（FL-MAP-03-02）

| 类型 | 尺寸 | 说明 |
|------|------|------|
| 都城 (capital) | 16x16 | 独立设计，标志性建筑轮廓 |
| 普通城池 (major) | 12x12 | 通用模板 + 阵营色旗 |
| 关隘 (minor) | 10x10 | 简化设计，山壁+关门轮廓 |

Sprite Sheet: 单帧 16x16px, 4帧动画（旗帜飘动），PNG透明底，水平排列 64x16px。帧间隔 200ms (5fps)。

---

## 道路数据

> 来源: FL-MAP-03-03 道路渲染

```typescript
interface RoadSegment {
  from: BlockCoord;      // 起点城市色块坐标
  to: BlockCoord;        // 终点城市色块坐标
  type: RoadType;        // 'main' | 'branch'
}
```

道路端点与城市城门位置对齐。宽度按 zoom 缩放并保持最小可见宽度。

---

## 领土数据

> 来源: FL-MAP-01 产出上限机制, FL-MAP-06 领土选择与详情, FL-MAP-08 驻防管理

```typescript
interface TerritoryData {
  id: number;
  name: string;
  center: BlockCoord;       // 领土中心色块坐标
  type: TerritoryType;      // 领土类型: 'city' | 'resource' | 'pass' | 'plain'（INT-R2-03）
  faction: Faction;
  level: number;            // 领土等级 (1~15)
  occupiedAt?: number;      // 占领时间戳 (ms)
  production: ProductionData;
  garrison?: GarrisonData;  // 驻防信息
  adjacentIds: number[];    // 相邻领土ID列表
  isCity: boolean;          // [R3] 是否为城池类领土（派生自 territoryType === 'city'，保留向后兼容）
  abandonCooldownUntil?: number; // 放弃冷却截止时间戳 (ms)，冷却期内放弃者不可重新占领
}

interface ProductionData {
  food: number;         // 粮草产出/小时
  gold: number;         // 金币产出/小时
  iron: number;         // 铁矿产出/小时
  dailyCap: number;     // 每日产出上限
}

interface GarrisonData {
  troops: number;        // 驻防兵力数
  generalId?: number;    // 驻防将领ID
}
```

**产出上限公式**（FL-MAP-01-02 P1-16）:
`产出上限 = 基础上限(1000) + 领土等级 * 200 + 科技加成`

---

## 兵力系统

> 来源: FL-MAP-08 全局兵力池模型

```typescript
interface TotalArmyPool {
  cap: number;                 // 兵力上限
  unallocated: number;         // 未分配兵力
  garrisoned: number;          // 已驻防兵力（各领土合计）
  replenishRate: number;       // 每小时自然补充量
  lastReplenishTime: number;   // 上次补充时间戳 (ms)
}
```

**兵力上限公式**（FL-MAP-08 AC-08-01）:
`cap = 基础兵力(500) + 己方领土总数 * 200 + SUM(所有己方兵营建筑等级) * 50`

**replenishRate 定义**（FL-MAP-08 V-030）:
`replenishRate = 基础值(50/小时) + 兵营总等级 * 10/小时`

**兵力池分配规则**:

| 操作 | 兵力池变化 | 说明 |
|------|-----------|------|
| 增加驻防 | `unallocated -= 增量` | 从未分配池扣减 |
| 减少驻防 | `unallocated += 减量` | 回收到未分配池 |
| 征服/攻城出征 | `unallocated -= 出征兵力` | 临时扣减 |
| 征服/攻城胜利 | 归还剩余兵力，驻防自动分配 | 自动驻防 |
| 征服/攻城失败 | 归还剩余兵力（扣除损失） | 兵力永久损失 |
| 放弃领土 | `unallocated += 驻防 * 70%` | 仅回收70%，剩余30%永久损失 |

**不变量约束**:
- `unallocated >= 0` 且 `unallocated <= cap`
- `garrisoned + unallocated <= cap`

---

## 编队系统

> 来源: FL-MAP-16 编队系统, FL-MAP-09 Stage P3

```typescript
interface ExpeditionForce {
  id: number;
  generalId: number;
  troops: number;
  status: ForceStatus;                  // 'ready' | 'marching' | 'fighting' | 'returning'
  targetTerritoryId?: number;           // 目标领土ID
  originTerritoryId: number;            // 出发领土ID
  siegeTaskId?: number;                 // 关联的攻城任务ID
}
```

**编队约束**:
- 最多 3 个编队同时存在
- 每支编队含 1 名将领 + 兵力
- 将领不可重复分配
- 受伤将领不可选（`injury` 存在时）
- 编队状态由 SiegeTask 驱动变更，编队不主动变更状态

**编队状态与 SiegeTask 映射**（FL-MAP-16 P1-39）:

| 编队状态 | SiegeTask 状态 | 说明 |
|---------|---------------|------|
| ready | preparing | 编队就绪，攻城准备中 |
| marching | marching | 编队行军中 |
| fighting | sieging | 编队攻城战斗中 |
| (无映射) | settling | 攻城结算中 |
| returning | returning | 编队返回中 |
| **[P1-M-03] 编队销毁** | completed | 攻城完成后编队对象销毁（兵力归还unallocated，将领释放为available） |
| **[P1-M-03] 编队销毁** | cancelled | [P1-M-03] cancelled: SiegeTask取消时编队直接执行销毁流程（归还兵力+释放将领），不经过cancelled ForceStatus中间状态 |

---

## 攻城系统

> 来源: FL-MAP-09 攻城战

```typescript
interface SiegeTask {
  id: number;
  targetTerritoryId: number;
  originTerritoryId: number;
  strategy: SiegeStrategy;
  forces: ExpeditionForce[];     // 参战编队（最多3个）
  status: SiegeTaskStatus;
  createdAt: number;             // 创建时间戳 (ms)
  marchStartTime?: number;      // 行军开始时间戳 (ms)
  battleStartTime?: number;     // 战斗开始时间戳 (ms)
  completedAt?: number;         // 完成时间戳 (ms)
  result?: BattleResult;        // [INT-R2-02] result字段：攻城5档UI值(大胜/小胜/险胜/惜败/惨败)经判定树映射为3档计算值(victory/defeat/crushing_defeat)，详见FL-MAP-17 S1映射表
  foodCost: number;              // 粮草消耗
  cooldownUntil?: number;       // 攻城冷却截止时间戳 (ms)，同一目标独立计算
  marchPath?: BlockCoord[];     // A*寻路路径
}

type SiegeTaskStatus =
  | 'preparing'      // P1-P4: 编队配置中
  | 'marching'       // P6: 行军中
  | 'sieging'        // P7-P8: 攻城战斗中
  | 'settling'       // P9: 结算中
  | 'returning'      // P10: 回城中
  | 'completed'      // 终态: 完成
  | 'cancelled';     // 终态: 已取消
```

**SiegeTask 状态机**（FL-MAP-09-08）:

```
preparing -> marching -> sieging -> settling -> returning -> completed
                 |          |
            cancelled    settling(撤退/超时)
                             |
                          returning -> completed
```

**中断退款政策**（FL-MAP-09 P0-V07）:

| 中断场景 | SiegeTask 状态 | 资源退还 | 每日次数 | 冷却 |
|---------|---------------|---------|---------|------|
| 行军阶段取消（玩家主动） | preparing/marching | 100%退还 | 不消耗 | 不触发 |
| 攻城阶段撤退（玩家主动） | sieging | 50%退还（兵力保留） | 消耗1次 | 5分钟冷却 |
| 应用切后台/恢复超时 | sieging | 50%退还（兵力保留） | 消耗1次 | 5分钟冷却 |

**粮草消耗公式**（FL-MAP-09 P2-R3-09）:
`粮草消耗 = 基础消耗(5/秒) x 行军时间(秒) x (1 + 编队兵力/1000)`
> 此为唯一权威版本，详见 FL-MAP-09 Stage P2

**城防衰减公式**（FL-MAP-09 AC-09-01）:
`每回合城防减少 = 攻方总战力 * 策略修正 / (城防系数 * 回合数上限)`
策略修正: 强攻 1.2 / 围困 0.8 / 夜袭 1.5 / 内应 1.3

**攻方总战力公式**（FL-MAP-09 V-029, P2-M-12）:
`攻方总战力 = SUM(各编队兵力 * 武将进攻战力系数 * command / 100)`
> 注: `command` 为武将统率值（GeneralData.command），影响编队兵力上限和编队战力，取值 1~100。

**时间约束**:
- 行军时长: 10s ~ 60s
- 攻城战斗时长: 10s ~ 60s（最长20回合，每回合1s）
- 回城行军时长: 10s ~ 60s
- 攻城冷却: 每次攻城结束后4小时
- 每日攻城次数上限: 3次，本地时间 00:00 重置
- 恢复超时: 10秒

---

## 行军过渡数据

> 来源: FL-MAP-09 Stage P6->P7 过渡

```typescript
interface MarchToSiegeTransition {
  siegeTaskId: number;
  strategy: SiegeStrategy;
  forces: ExpeditionForce[];
  faction: Faction;
  targetId: number;
  originId: number;
  estimatedMarchTime: number;   // 预计行军时间 (秒)
}
```

---

## 寻路节点

> 来源: FL-MAP-04-01 A*寻路算法

```typescript
// [R3] PathNode — FL-MAP-04 uses PathNode(x, y, px, py)
interface PathNode {
  x: number;            // 色块x坐标
  y: number;            // 色块y坐标
  px: number;           // 像素x坐标（渲染用）
  py: number;           // 像素y坐标（渲染用）
  gCost: number;        // 从起点到当前节点的移动成本
  hCost: number;        // 从当前节点到终点的启发式估计成本
  fCost: number;        // gCost + hCost
  parent?: PathNode;    // 父节点（用于回溯路径）
  walkable: boolean;    // 是否可通行
}
```

---

## 地图事件

> 来源: FL-MAP-12 地图事件

```typescript
// [R3] 事件类型（FL-MAP-12 定义6种：山贼/宝箱/商队/天灾/外交/传说）
type MapEventType = 'bandit' | 'treasure' | 'merchant' | 'natural_disaster' | 'diplomatic' | 'legendary';

interface MapEvent {
  id: number;
  type: MapEventType;             // 事件类型
  position: BlockCoord;           // 事件发生位置（色块坐标）
  choices: EventChoice[];         // 可选分支（2~3个）
  rewards?: RewardItem[];         // 奖励
  expiresAt: number;              // 过期时间戳 (ms)
  status: 'active' | 'completed' | 'expired';
}

interface EventChoice {
  id: number;
  label: string;                  // 选项文案
  outcome: 'success' | 'failure';
  probability: number;            // 成功概率 0~1
  rewards?: RewardItem[];
  penalties?: RewardItem[];       // 失败惩罚
}
```

---

## 战斗结果与伤亡

> 来源: FL-MAP-09 Stage P9, FL-MAP-17 伤亡系统

```typescript
interface BattleOutcome {
  result: BattleResult;             // 'victory' | 'defeat' | 'crushing_defeat'
  soldierLoss: number;              // 士兵损失数量
  soldierLossPercent: number;       // 士兵损失百分比
  generalInjuries: GeneralInjury[]; // 将领受伤列表
  rewards?: PendingReward[];        // 暂存奖励（24h有效）
  territoryCaptured: boolean;       // 是否占领领土
}

interface GeneralInjury {
  generalId: number;
  injured: boolean;
  level?: InjuryLevel;              // 'light' | 'medium' | 'heavy'
  combatPowerPenalty?: number;      // 战力惩罚百分比（轻伤-10%/中伤-30%/重伤-50%）
  recoveryTime?: number;            // 恢复时长 (ms)
  recoveryEndTime?: number;         // 恢复截止时间戳 (ms)
}

// [INT-R2-01] PendingReward 统一为详细版本（来源: FL-MAP-11-03）
interface PendingReward {
  id: number;
  siegeTaskId: number;
  items: RewardItem[];
  strategyType: SiegeStrategy;
  strategyMultiplier: number;
  expiresAt: number;               // 过期时间戳 (ms)，24h后自动发放
  status: 'pending' | 'claimed' | 'expired';
}

interface RewardItem {
  type: 'food' | 'gold' | 'iron' | 'item' | 'reputation' | 'title';
  itemId?: number;
  amount: number;
  multiplier: number;              // 策略倍率修正后的最终数量
}
```

**伤亡参数表**（FL-MAP-17 权威来源）:

| 战斗结果 | 士兵损失比例 | 将领受伤概率 | 受伤等级 | 战力惩罚 | 恢复时间 |
|---------|------------|------------|---------|---------|---------|
| victory | 5%~15% | 10% | 轻伤 (light) | -10% | 30 分钟 |
| defeat | 20%~40% | 30% | 中伤 (medium) | -30% | 2 小时 |
| crushing_defeat | 50%~80% | 50% | 重伤 (heavy) | -50% | 6 小时 |

**5档->3档映射**（FL-MAP-09 P1-32，仅用于攻城UI展示）:

| 攻城5档 | 伤亡3档 | 士兵损失比例 | 将领受伤概率 | 受伤等级 |
|--------|--------|------------|------------|---------|
| 大胜 (T<20s) | victory | 5%~15% | 10% | 轻伤 |
| 胜利 (20s<=T<30s) | victory | 5%~15% | 10% | 轻伤 |
| 险胜 (30s<=T<=60s) | victory | 5%~15% | 10% | 轻伤 |
| 失败 (60s超时, 城防<30%) | defeat | 20%~40% | 30% | 中伤 |
| 惨败 (60s超时, 城防>=30%) | crushing_defeat | 50%~80% | 50% | 重伤 |

**伤亡计算公式**（FL-MAP-17 S2）:
- 士兵损失 = `编队兵力 * random(最小比例, 最大比例)`，向下取整，最少损失1名
- 武将受伤判定 = `Math.random() < injuryProbability`

---

## 将领数据

> 来源: FL-MAP-16 S2 选择将领, FL-MAP-17 S3 S4 武将受伤

```typescript
interface GeneralData {
  id: number;
  name: string;
  faction: Faction;
  attack: number;       // 攻击力 (1~100)
  defense: number;      // 防御力 (1~100)
  intel: number;        // 智力 (1~100)
  command: number;      // 统率 (1~100) — 影响兵力上限和编队战力（P2-M-12, [R3]）
  injury?: GeneralInjuryState;
}

interface GeneralInjuryState {
  level: InjuryLevel;            // 'light' | 'medium' | 'heavy'
  combatPowerPenalty: number;    // 战力惩罚百分比 (0.10 / 0.30 / 0.50)
  recoveryEndTime: number;       // 恢复截止时间戳 (ms)
}
```

**将领可用性判定**:
- `injury` 存在且 `Date.now() < recoveryEndTime` -> 恢复中，不可选
- `injury` 存在但已过恢复时间 -> 自动清除受伤状态，战力恢复100%
- 编队分配中（ExpeditionForce 存在且 status 非 completed/cancelled）-> 出战中，不可选

---

## 数据存储

> 来源: FL-MAP-01 状态持久化, FL-MAP-08 全局兵力池

```typescript
interface MapGameState {
  // 地图数据
  mapConfig: MapConfig;
  mapData: MapData;

  // 兵力系统
  armyPool: TotalArmyPool;

  // 编队
  forces: ExpeditionForce[];

  // 攻城任务
  siegeTasks: SiegeTask[];

  // 将领
  generals: GeneralData[];

  // 攻城每日计数
  siegeDailyCount: number;        // 今日已使用攻城次数
  siegeDailyResetAt: number;      // 每日重置时间戳 (ms)，本地时间 00:00

  // 持久化元信息
  lastSaveTime: number;
  version: string;
}
```

**版本迁移策略**（[R3] INT-R2-09）:
```typescript
function migrateGameState(saved: MapGameState): MapGameState {
  // [P1-fix] use shared constant instead of inline string
  if (saved.version === CURRENT_MAP_GAME_STATE_VERSION) return saved;

  // [R3] 迁移策略:
  // 1. 版本检查: 加载时比较 saved.version 与 CURRENT_MAP_GAME_STATE_VERSION
  // 2. 增量迁移: 按版本号链式调用（如 v1.0→v1.1→v1.2），每个迁移函数只处理相邻版本差
  // 3. 跨大版本不兼容: 若 major version 不同（如 v1→v2），提示"存档版本不兼容，需重新开始"并清除旧数据
  // 4. 迁移失败回退: 核心数据（地图配置/领土归属）保留，扩展数据（科技/事件）重置为默认值
  // 5. 迁移成功后更新 version 至 CURRENT_MAP_GAME_STATE_VERSION

  return migratedState;
}
```

```typescript
// [P1-R2-06] 版本迁移策略
// - 加载时检查 version 字段与当前代码版本是否匹配
// - 若 version < CURRENT_VERSION: 触发数据迁移函数 migrateMapGameState(oldData)
// - 迁移函数按版本号顺序执行增量迁移（如 v1→v2→v3...）
// - 若版本差距过大（如跨大版本），提示"存档版本不兼容，需重新开始"并清除旧数据
// - 迁移成功后更新 version 至 CURRENT_VERSION
const CURRENT_MAP_GAME_STATE_VERSION = '1.2';  // [P1-fix] unified to string to match MapGameState.version: string
```

**存储策略**（FL-MAP-01 XC-007）:

| 数据类型 | 存储方式 | 说明 |
|---------|---------|------|
| 视口位置/缩放 | localStorage | 24h后重置为默认 |
| 选中领土ID | localStorage | 24h后清除 |
| 新手引导步骤 | localStorage | 引导完成后清除 |
| 领土/兵力/事件/产出 | IndexedDB | 持久化游戏数据 |
| 攻城状态暂停 | IndexedDB | 记录当前城防值和战斗进度 |

---

## 坐标系约定

| 坐标类型 | 范围 | 用途 |
|---------|------|------|
| 色块坐标 | (0,0)~(319,239) | 地图逻辑坐标，所有游戏逻辑使用 |
| 像素坐标 | 由色块坐标 x blockSize x zoom 计算 | Canvas 渲染坐标 |
| 视口坐标 | 相对于 Canvas 容器 | 鼠标/触摸事件坐标 |

**坐标转换公式**:

```typescript
// 色块坐标 -> 像素坐标
function blockToPixel(coord: BlockCoord, zoom: number): { x: number; y: number } {
  return {
    x: coord.x * 8 * zoom,
    y: coord.y * 8 * zoom
  };
}

// 像素坐标 -> 色块坐标
function pixelToBlock(pixel: { x: number; y: number }, zoom: number): BlockCoord {
  return {
    x: Math.floor(pixel.x / (8 * zoom)),
    y: Math.floor(pixel.y / (8 * zoom))
  };
}
```

---

## 接口索引

共定义 **36 个** TypeScript 接口/类型:

| # | 名称 | 类型 | 用途 | 来源流程 |
|---|------|------|------|---------|
| 1 | BlockCoord | type | 色块坐标 | FL-MAP-03 |
| 2 | Faction | type | 阵营枚举 | FL-MAP-01 |
| 3 | TerrainType | type | 地形枚举 | FL-MAP-03 |
| 4 | BattleResult | type | 战斗结果（3档） | FL-MAP-17 |
| 5 | InjuryLevel | type | 受伤等级 | FL-MAP-17 |
| 6 | SiegeStrategy | type | 攻城策略 | FL-MAP-09 |
| 7 | ForceStatus | type | 编队状态 | FL-MAP-16 |
| 8 | CityType | type | 城市类型 | FL-MAP-03 |
| 9 | RoadType | type | 道路类型 | FL-MAP-03 |
| 10 | TerritoryType | type | 领土类型 | FL-MAP-06/08 [R3] |
| 11 | ResourceType | type | 资源类型 | FL-MAP-01 |
| 12 | MapEventType | type | 地图事件类型（6种） | FL-MAP-12 [R3] |
| 13 | MapConfig | interface | 地图配置 | FL-MAP-01 |
| 14 | FactionConfig | interface | 阵营配置 | FL-MAP-01 |
| 15 | MapData | interface | 地图数据 | FL-MAP-01/03 |
| 16 | TerrainBlock | interface | 色块数据 | FL-MAP-03 |
| 17 | CityData | interface | 城市数据 | FL-MAP-03 |
| 18 | RoadSegment | interface | 道路段 | FL-MAP-03 |
| 19 | TerritoryData | interface | 领土数据 | FL-MAP-06/08 |
| 20 | ProductionData | interface | 产出数据 | FL-MAP-01 |
| 21 | GarrisonData | interface | 驻防数据 | FL-MAP-08 |
| 22 | TotalArmyPool | interface | 全局兵力池 | FL-MAP-08 |
| 23 | ExpeditionForce | interface | 编队 | FL-MAP-16 |
| 24 | SiegeTask | interface | 攻城任务 | FL-MAP-09 |
| 25 | SiegeTaskStatus | type | 攻城任务状态 | FL-MAP-09 |
| 26 | MarchToSiegeTransition | interface | 行军过渡数据 | FL-MAP-09 |
| 27 | PathNode | interface | A*寻路节点 | FL-MAP-04 [R3] |
| 28 | MapEvent | interface | 地图事件 | FL-MAP-12 [R3] |
| 29 | EventChoice | interface | 事件选项 | FL-MAP-12 [R3] |
| 30 | BattleOutcome | interface | 战斗结果 | FL-MAP-09/17 |
| 31 | GeneralInjury | interface | 将领受伤 | FL-MAP-17 |
| 32 | GeneralInjuryState | interface | 将领受伤状态 | FL-MAP-17 |
| 33 | PendingReward | interface | 暂存奖励 | FL-MAP-09 |
| 34 | RewardItem | interface | 奖励条目 | FL-MAP-09/12 |
| 35 | GeneralData | interface | 将领数据 | FL-MAP-16/17 |
| 36 | MapGameState | interface | 游戏状态存储 | FL-MAP-01 |

---

## 公式索引

| 公式 | 定义位置 | 用途 |
|------|---------|------|
| 兵力上限 = 500 + 领土数 * 200 + 兵营总等级 * 50 | FL-MAP-08 | TotalArmyPool.cap |
| replenishRate = 50/小时 + 兵营总等级 * 10/小时 | FL-MAP-08 | TotalArmyPool.replenishRate |
| 产出上限 = 1000 + 领土等级 * 200 + 科技加成 | FL-MAP-01 | ProductionData.dailyCap |
| 城防初始值 = 500 + 城墙等级 * 50 | FL-MAP-09 | CityData.defenseMax |
| 城防系数 = 1.0 + 城墙等级 * 0.05 | FL-MAP-09 | 战斗计算 |
| 每回合城防减少 = 攻方总战力 * 策略修正 / (城防系数 * 回合数上限) | FL-MAP-09 | 回合制战斗 |
| 攻方总战力 = SUM(各编队兵力 * 武将进攻战力系数 * command / 100) | FL-MAP-09 | 编队战力 |
| 粮草消耗 = 基础消耗(50) x 兵力系数(兵力/100) x 距离系数(格数x0.3) x 策略修正 | FL-MAP-09 | 出征消耗（[R3] 唯一权威版本，详见 FL-MAP-09 Stage P2） |
| 士兵损失 = 编队兵力 * random(最小比例, 最大比例) | FL-MAP-17 | 伤亡计算 |
| 战后战力 = 初始战力 * (1 - 伤亡比例) * (1 - 受伤减益) | FL-MAP-17 | 战力重算 |

---

*天下地图核心数据结构定义 v1.2 | 2026-05-05 (Round 3 fixes: P2-M-09, P2-M-10, INT-R2-03, P2-M-12, DP-#4, DP-#7, INT-R2-09)*

---

## 策略修正系数常量表

> **用途**: 明确区分两组策略修正参数，避免实施时混淆

### 城防衰减策略修正（FL-MAP-09 Stage P8 城防衰减公式使用）

| 策略 | 修正系数 | 说明 |
|------|:--------:|------|
| 强攻 (assault) | 1.2 | 正面强攻，中等效率 |
| 围困 (surround) | 0.8 | 围困消耗，效率较低 |
| 夜袭 (night_raid) | 1.5 | 夜间突袭，效率最高 |
| 内应 (insider) | 1.3 | 内应配合，效率较高 |

### 编队战力策略修正（FL-MAP-16 编队总战力公式使用）

| 策略 | 修正系数 | 说明 |
|------|:--------:|------|
| 强攻 (assault) | 1.5 | 强攻需要大量兵力，战力加成高 |
| 围困 (surround) | 0.8 | 围困消耗少，战力加成低 |
| 夜袭 (night_raid) | 1.2 | 夜袭依赖技巧，战力加成中等 |
| 内应 (insider) | 2.0 | 内应配合效果翻倍 |

> **注意**: 两组参数含义不同。城防衰减修正影响"每回合城防减少量"，编队战力修正影响"编队总战力计算"。参数值为初始设计值，最终以PRD确认为准。
