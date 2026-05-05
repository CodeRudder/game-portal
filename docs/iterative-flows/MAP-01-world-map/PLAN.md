# 天下地图系统 — 迭代流程补全计划

> **版本**: v1.5.R4 | **创建日期**: 2026-05-05
> **功能缩写**: MAP | **编号**: 01

## 背景

天下地图系统（MAP）是三国游戏门户的核心功能之一，提供世界地图浏览、领土管理、攻城战、地图事件、地图统计等玩法。系统经历了 v1.0（六边形网格）和 v2.0（像素风格重设计）两个 PRD 版本，以及 R1~R11 共 11 轮迭代。

## 原始文档

| 文档 | 路径 | 说明 |
|------|------|------|
| PRD v1.0 | `docs/games/three-kingdoms/ui-design/prd/MAP-world-prd.md` | 初始设计（六边形网格），部分已被 v2.0 替代 |
| PRD v2.0 | `docs/games/three-kingdoms/ui-design/prd/MAP-world-prd-v2.md` | 像素风格重设计，当前权威版本 |
| UI v1.0 | `docs/games/three-kingdoms/ui-design/ui-layout/MAP-world.md` | v1.0 布局，部分已被 v2.0 替代 |
| UI v2.0 | `docs/games/three-kingdoms/ui-design/ui-layout/MAP-world-v2.md` | 像素风格布局，当前权威版本 |
| 旧流程文档 | `docs/games/three-kingdoms/adversarial/flows/map/flows.md` | 11 轮迭代后的流程汇总（仅参考） |

## 功能范围

基于 PRD v2.0 和 UI v2.0，天下地图系统包含以下功能模块：

| 模块 | PRD 章节 | 旧流程编号 | 新流程编号 |
|------|---------|-----------|-----------|
| 进入天下Tab | MAP-1 | MAP-F01 | FL-MAP-01 |
| 地图浏览与缩放 | MAP-1 | MAP-F02 | FL-MAP-02 |
| 像素地图渲染 | MAP-1 | MAP-F02a | FL-MAP-03 |
| 行军动画 | MAP-3 | MAP-F02b | FL-MAP-04 |
| 攻城动画 | MAP-4 | MAP-F02c | FL-MAP-05 |
| 领土选择与详情 | MAP-3 | MAP-F03 | FL-MAP-06 |
| 领土征服 | MAP-3 | MAP-F04 | FL-MAP-07 |
| 驻防管理 | MAP-3 | MAP-F05 | FL-MAP-08 |
| 攻城战 | MAP-4 | MAP-F06 | FL-MAP-09 |
| 筛选与热力图 | MAP-2 | MAP-F07 | FL-MAP-10 |
| 攻城奖励领取 | MAP-4 | MAP-F08 | FL-MAP-11 |
| 地图事件处理 | MAP-5 | MAP-F09 | FL-MAP-12 |
| 地图统计查看 | MAP-6 | MAP-F10 | FL-MAP-13 |
| 领土等级提升 | MAP-3 | MAP-F11 | FL-MAP-14 |
| 离线领土变化查看 | MAP-3 | MAP-F12 | FL-MAP-15 |
| 编队系统 | MAP-7 | (MAP-F06子流程) | FL-MAP-16 |
| 伤亡系统 | MAP-8 | (MAP-F06子流程) | FL-MAP-17 |
| 手机端适配 | MAP-10 | (散落各流程) | FL-MAP-18 |

## 关键业务约束

1. **渲染体系**: v2.0 像素风格渲染（8x8色块），v1.0 六边形网格已废弃
2. **道路即相邻**: 有道路连接的城市互为相邻，无道路则不相邻
3. **攻城条件**: 城防值归零即占领（唯一条件），旧版三条件已废弃
4. **统一声明**: PRD v1.0 中的多项旧公式/规则已由 v2.0 统一声明替代
5. **行军时长**: 最短10秒，最长60秒（硬约束）
6. **编队上限**: 最多3个编队同时存在
7. **攻城次数**: 每日3次上限

## 整体目标

通过多轮迭代，将天下地图系统的所有用户流程补全至 L3+ 深度，确保：
- 每个流程可直接由工程师实施，无需额外澄清
- 所有异常分支和边界条件已覆盖
- 所有子流程引用有效，无断裂
- 时间描述(⏱)和空间描述(📱)覆盖率 100%

---

## 附录 A: AI 敌方系统定义

> **解决**: P0-V01（AI Enemy System Undefined）
> **被引用流程**: FL-MAP-04, FL-MAP-06, FL-MAP-08, FL-MAP-15

### A.1 架构原则

本游戏为 **100% 本地单机游戏**，无服务器、无网络。所有 AI 敌方行为由客户端本地模拟引擎驱动。AI 行为分为两类:

1. **在线 AI 行为**: 玩家活跃期间，AI 阵营根据定时器和游戏规则自动执行动作
2. **离线 AI 行为**: 玩家离线期间，AI 阵营的行为在玩家下次登录时一次性批量计算（无实时模拟）

### A.2 AI 阵营定义

游戏世界中存在 3 个 AI 阵营，与玩家形成对抗关系:

| 阵营 | 初始领土 | 阵营色 | 行为倾向 |
|------|---------|--------|---------|
| 魏 | 邺城、许昌、濮阳、北海 | 靛蓝 #2E5090 | 扩张型 — 优先攻占中立领土，主动性强 |
| 蜀 | 成都、汉中、永安、南中 | 赤红 #8B2500 | 防御型 — 优先巩固现有领土，被动防御 |
| 吴 | 建业、会稽、柴桑、庐江 | 翠绿 #2E6B3E | 均衡型 — 攻守兼备，随机性较强 |

每个 AI 阵营拥有与玩家相同的数据结构: 领土列表、驻防兵力、总兵力池。

### A.3 AI 攻击行为

**攻击频率**: 每个 AI 阵营独立计时，默认每 2~4 小时（实际游戏时间）发起一次攻击尝试。

| 难度 | 攻击间隔 | 攻击兵力倍率 |
|------|---------|------------|
| 简单 | 4 小时 | 0.6x |
| 普通 | 3 小时 | 0.8x |
| 困难 | 2 小时 | 1.0x |

**攻击目标选择逻辑**:
1. 优先攻击与己方领土相邻的中立领土（无主领土）
2. 其次攻击相邻的弱防守玩家领土（驻防兵力 < AI 攻击兵力 x 1.5）
3. 不攻击其他 AI 阵营的领土（AI 之间互不冲突）
4. 若无可攻击目标，则跳过本次攻击

**攻击执行**:
- 攻击使用简化版征服公式（参考 FL-MAP-07 胜率公式）
- AI 攻击兵力 = 该 AI 阵营总兵力池 x 攻击兵力倍率 x 0.3（单次最多动用 30% 总兵力）
- 胜利: 领土归属变更为 AI 阵营，自动驻防（驻防数 = 攻击兵力 x 50%）
- 失败: AI 不损失实际兵力（仅扣除攻击兵力部分），无其他惩罚

**在线 vs 离线**:
- **在线**: AI 攻击通过本地定时器触发，玩家可看到"敌方行军"精灵动画（复用 FL-MAP-04 行军精灵，颜色为阵营色）
- **离线**: AI 攻击在玩家下次登录时批量结算（参考 FL-MAP-15 离线变化检测）

### A.4 AI 驻防增援

AI 阵营领土的驻防兵力会随时间自动增长:

- **增援频率**: 每 1 小时（实际游戏时间）增加一次
- **增援量**: `garrison_growth = base_rate x territory_level`
  - `base_rate` = 10（固定值）
  - `territory_level` = 领土等级（1~14）
- **上限**: 每个领土驻防上限 = `100 x territory_level`，达到上限后停止增援
- **在线**: 通过本地定时器触发，地图驻防数值实时更新
- **离线**: 离线期间累计增援在下次登录时一次性结算

### A.5 AI 领土防御

当玩家攻击 AI 阵营领土时，AI 使用现有驻防兵力进行被动防御:

- **防御方式**: 纯被动 — AI 不主动调动增援，不使用策略
- **防御战力**: 驻防兵力 x 防御系数（参考 FL-MAP-06 FR-06-06 防御系数 = 1.0 + 城墙等级 x 0.05 + 地形加成）
- **攻城战（城池）**: 使用现有城防值（参考 FL-MAP-09 Stage P8 城防衰减公式），AI 无额外策略修正
- **征服战（非城池）**: 使用 FL-MAP-07 胜率公式，AI 驻防兵力即为"敌方战力"

### A.6 行军拦截

行军拦截为稀有事件，玩家行军穿过 AI 阵营领土时可能触发:

- **触发概率**: 5% 每次行军（每次行军最多触发一次拦截）
- **触发条件**: 行军路径经过 AI 阵营领土（非中立、非己方）
- **拦截兵力**: AI 领土驻防兵力 x 20%（临时调动，不影响实际驻防）
- **拦截战斗**: 使用简化版 FL-MAP-07 征服战斗（概率判定），胜利后继续行军，失败则行军中断并回城
- **视觉表现**: 行军精灵停止 + 红色警报闪光（参考 FL-MAP-04 行军拦截状态机）

### A.7 离线 AI 活动

玩家离线期间，AI 阵营仍会执行活动（在下次登录时批量结算）:

| AI 行为 | 离线触发规则 | 结算方式 |
|--------|------------|---------|
| 攻占中立领土 | 每 2~4 小时检查一次（按难度），有相邻中立领土则攻占 | 登录时批量变更归属 |
| 增援驻防 | 每小时增援一次 | 登录时累计增援 |
| 不攻击玩家领土 | 离线期间 AI 不主动攻击玩家领土 | — |
| 不攻击其他 AI | AI 之间不发生冲突 | — |

**离线结算时机**: 玩家下次登录进入天下 Tab 时（参考 FL-MAP-15 S1 登录检测），对比离线前后快照计算所有 AI 活动。

### A.8 术语统一

在本系统所有流程文档中:

| 旧术语（已废弃） | 新术语 | 说明 |
|-----------------|--------|------|
| "其他玩家" | AI 阵营 | 本游戏为单机，无其他真实玩家 |
| "敌方行军" | AI 行军精灵 | AI 阵营的行军动画 |
| "敌人" / "敌军" | AI 阵营兵力 | AI 阵营的驻防/攻击兵力 |
| "推送通知" | 游戏内通知 / 浏览器通知 | 无服务器推送，仅本地通知 |
| "重新连接" | 恢复游戏状态 | 无网络断连概念 |

---

## 附录 B: 核心数据结构

> **解决**: P0-V02（Core Data Structures Undefined）
> **被引用流程**: FL-MAP-01, FL-MAP-03, FL-MAP-04, FL-MAP-06, FL-MAP-07, FL-MAP-08, FL-MAP-09, FL-MAP-15, FL-MAP-16

### B.1 MapConfig — 地图配置

```typescript
interface MapConfig {
  /** 地图宽度（色块单位） */
  mapWidth: number;                  // 默认 320
  /** 地图高度（色块单位） */
  mapHeight: number;                 // 默认 240
  /** 所有领土列表 */
  territories: TerritoryData[];
  /** 所有城池列表（TerritoryData 的子集） */
  cities: CityData[];
  /** 所有道路段列表 */
  roads: RoadSegment[];
  /** 所有阵营定义 */
  factions: FactionData[];
  /** 16色调色板 */
  palette: Record<string, string>;
}

interface FactionData {
  id: string;                        // "faction-wei" | "faction-shu" | "faction-wu" | "faction-neutral"
  name: string;                      // "魏" | "蜀" | "吴" | "中立"
  color: string;                     // 阵营主色
  isPlayer: boolean;                 // 是否为玩家阵营
  /** AI 行为配置（仅 AI 阵营） */
  aiConfig?: AIFactionConfig;
}

interface AIFactionConfig {
  behaviorType: 'expansion' | 'defense' | 'balanced';
  attackIntervalHours: number;       // 攻击间隔（小时）
  attackPowerMultiplier: number;     // 攻击兵力倍率
}
```

### B.2 TerritoryData — 领土数据

```typescript
interface TerritoryData {
  /** 领土唯一ID，如 "city-luoyang", "res-grain1" */
  id: string;
  /** 领土名称 */
  name: string;
  /** 领土类型 */
  type: 'city' | 'pass' | 'resource' | 'plain';
  /** 地形类型 */
  terrain: 'plain' | 'mountain' | 'forest' | 'desert' | 'water' | 'snow';
  /** 领土中心点坐标（色块单位） */
  coordinates: { x: number; y: number };
  /** 当前归属阵营ID，null 表示中立 */
  owner: string | null;
  /** 领土等级 (1~14) */
  level: number;
  /** 当前驻防兵力 */
  garrison: number;
  /** 驻防上限 */
  garrisonCap: number;
  /** 驻防将领ID，null 表示无将领 */
  garrisonGeneralId: string | null;
  /** 产出数据 */
  production: ProductionData;
  /** 占领时间戳（ms），null 表示未占领 */
  occupiedAt: number | null;
}

interface ProductionData {
  /** 粮草产出/小时 */
  food: number;
  /** 铜钱产出/小时 */
  gold: number;
  /** 兵力产出/小时 */
  troops: number;
  /** 天命产出/小时 */
  mandate: number;
  /** 产出充能进度 (0%~100%) */
  chargeProgress: number;
}
```

### B.3 CityData — 城池数据（扩展 TerritoryData）

```typescript
interface CityData extends TerritoryData {
  type: 'city' | 'pass';
  /** 城防值（当前） */
  cityDefense: number;
  /** 城防值上限 */
  cityDefenseCap: number;
  /** 城墙等级 (0~10) */
  wallLevel: number;
  /** 城池建筑列表 */
  structures: CityStructure[];
}

interface CityStructure {
  type: 'barracks' | 'wall' | 'warehouse' | 'market' | 'watchtower';
  level: number;
}
```

### B.4 RoadSegment — 道路段

```typescript
interface RoadSegment {
  /** 起点领土ID */
  from: string;                      // 如 "city-luoyang"
  /** 终点领土ID */
  to: string;                        // 如 "city-xuchang"
  /** 路径距离（像素单位） */
  distance: number;
  /** 地形修正系数（影响行军速度） */
  terrainModifiers: Array<{
    terrain: string;
    moveCost: number;                // 如 平原 1.0, 山地 0.5, 水域 2.14
  }>;
}
```

### B.5 SiegeTask — 攻城任务

```typescript
interface SiegeTask {
  /** 任务唯一ID */
  id: string;                        // 格式: "siege_{timestamp}_{random}"
  /** 目标领土ID */
  targetId: string;
  /** 攻城策略 */
  strategy: 'assault' | 'siege' | 'night_raid' | 'insider';
  /** 出征编队列表（最多3个） */
  forces: ForceData[];
  /** 任务状态 */
  state: 'preparing' | 'marching' | 'sieging' | 'settling' | 'returning' | 'completed' | 'cancelled';
  /** 创建时间戳 */
  createdAt: number;
  /** 行军出发时间戳 */
  marchStartedAt: number | null;
  /** 攻城开始时间戳 */
  siegeStartedAt: number | null;
  /** 结算时间戳 */
  settledAt: number | null;
  /** 行军路径（A* 计算结果） */
  marchPath: PathNode[];
  /** 出发城市ID */
  departureCityId: string;
}
```

### B.6 ForceData — 编队数据

```typescript
interface ForceData {
  /** 编队唯一ID */
  id: string;
  /** 将领ID */
  generalId: string;
  /** 士兵数量 */
  troops: number;
  /** 编队状态 */
  status: 'ready' | 'marching' | 'fighting' | 'returning';
  /** 编队战力（计算值） */
  combatPower: number;
  /** 目标领土ID */
  targetId: string | null;
}
```

### B.7 MapEvent — 地图事件

```typescript
interface MapEvent {
  /** 事件唯一ID */
  id: string;
  /** 事件类型 */
  type: 'caravan' | 'bandit' | 'refugee' | 'ruin' | 'faction_clash';
  /** 所在领土ID */
  territoryId: string;
  /** 过期时间戳 */
  expiresAt: number;
  /** 事件数据（按类型不同） */
  data: Record<string, unknown>;
  /** 是否已处理 */
  processed: boolean;
  /** 生成时间戳 */
  generatedAt: number;
}
```

### B.8 TotalArmyPool — 全局兵力池

```typescript
interface TotalArmyPool {
  /** 总兵力上限 */
  cap: number;
  // cap = 500 (基础) + 己方领土总数 x 200 + Σ(所有己方兵营建筑等级) x 50
  /** 已分配兵力（所有领土驻防之和 + 所有出征编队兵力之和） */
  allocated: number;
  /** 未分配兵力（可用） */
  unallocated: number;
  // 不变量: unallocated = cap - allocated; unallocated >= 0
  /** 每小时自然补充率 */
  replenishRate: number;
  /** 各领土驻防分配详情 */
  garrisons: Record<string, number>; // territoryId -> garrisonCount
}
```

---

## 附录 C: 战力公式链（完整定义）

> **解决**: P0-V03（Combat Power Formula Chain Incomplete）
> **被引用流程**: FL-MAP-07, FL-MAP-09, FL-MAP-16

### C.1 基础兵力战力

> **[P1-M-01] 注意**: 此处为简化公式。完整编队总战力公式（含将领属性加成和科技加成）详见 FL-MAP-16 S2 [P0-02-R2]。

```
base_force_power = troops x 1.0 + general.武力 x 10
```

- `troops`: 编队士兵数量
- `general.武力`: 武将武力属性值（无武将时为 0）

### C.2 编队战力（含修正）

```
force_combat_power = base_force_power x strategy_modifier x terrain_modifier
```

**策略修正 (strategy_modifier)** **[R4-ISS-003/R4-ISS-015]**: 此处策略修正为 `power_strategy_modifier`（编队战力修正），与城防衰减专用的 `decay_strategy_modifier`（见 FL-MAP-09 AC-09-01）是两组独立参数，用途不同，不可混用。

| 策略 | 修正值 | 适用条件 |
|------|--------|---------|
| 强攻 (assault) | x1.5 | 无条件 |
| 围困 (siege) | x0.8 | 无条件 |
| 夜袭 (night_raid) | x1.2 | 仅夜间（20:00~06:00 游戏时间），需夜袭令 |
| 内应 (insider) | x2.0 | 需内应信道具 |

**地形修正 (terrain_modifier)**:

| 地形 | 攻击方修正 | 说明 |
|------|----------|------|
| 平原 (plain) | x1.00 (+0%) | 无修正 |
| 山地 (mountain) | x0.90 (-10%) | 防守方优势 |
| 森林 (forest) | x0.95 (-5%) | 轻微不利 |
| 沙漠 (desert) | x0.92 (-8%) | 补给困难 |
| 水域 (water) | x0.80 (-20%) | 渡水不利 |
| 关隘 (pass) | x0.85 (-15%) | 隘口防御 |
| 雪地 (snow) | x0.90 (-10%) | 寒冷消耗 |

### C.3 征服胜率公式（非城池领土，FL-MAP-07）

```
win_rate = clamp(5%, 95%, (attacker_power / defender_power x 0.5) + terrain_modifier_pct)
```

- `attacker_power`: 攻方编队战力 = troops x 武将战力系数（参考 C.2）
  - 武将战力系数 = (武力 x 3 + 统率 x 2 + 智力) / 300，范围约 1.0~3.0
- `defender_power`: 守方战力 = garrison x defense_coefficient
  - defense_coefficient = 1.0 + wall_level x 0.05 + terrain_defense_bonus
- `terrain_modifier_pct`: 地形胜率修正百分比（与 C.2 地形修正一致，转换为小数）
- `clamp(5%, 95%, ...)`: 胜率范围限制在 5%~95% 之间

### C.4 攻城城防衰减公式（城池，FL-MAP-09）**[R4-ISS-004 已废弃]**

> **[R4-ISS-004] 本节已废弃**: 城防衰减公式以 FL-MAP-09 AC-09-01 为权威来源。废弃原因: (1) 分母结构差异: 本节用 `wall_level x 5 + 100`，AC-09-01 用 `(1.0 + 城墙等级 x 0.05) x 回合数上限`；(2) 策略修正差异: 本节用 `power_strategy_modifier`，AC-09-01 用 `decay_strategy_modifier`。实现时应以 AC-09-01 为准。

```
defense_decay_per_tick = attacker_power x strategy_modifier / (wall_level x 5 + 100) x tick_interval
```

- `attacker_power`: 攻方总战力（所有编队战力之和）
- `strategy_modifier`: 策略修正系数（强攻 x1.5, 围困 x0.8, 夜袭 x1.2, 内应 x2.0）
- `wall_level`: 城墙等级 (0~10)
- `tick_interval`: 回合间隔 = 1 秒
- **总战斗时长**: 最长 20 回合（60 秒），城防归零即胜利
- **UI 渲染**: 进度条每帧按 `计算值/回合帧数` 平滑递减（帧级视觉插值）

> **[P1-M-09] 注意** [R2-Step2]: PLAN.md附录C.4的城防衰减公式为旧版参考，以FL-MAP-09流程 AC-09-01 定义为准（即: 每回合城防减少 = 攻方总战力 x 策略修正 / (城防系数 x 回合数上限)）。两版公式在策略修正系数和分母结构上存在差异，实现时应以 AC-09-01 为权威来源。

### C.5 战力预览（编队创建，FL-MAP-16）

编队创建时的战力预览使用上述公式的简化版本:

```
force_preview = troops x 1.0 + general.武力 x 10
```

此值为初始战力（不含策略和地形修正），策略和地形修正在实际出征时叠加。

### C.6 战后战力重算（FL-MAP-17）

```
post_battle_power = initial_power x (1 - casualty_rate) x (1 - injury_penalty)
```

- `initial_power`: 编队初始战力
- `casualty_rate`: 士兵损失比例（按 3 档结果计算: victory 5%~15%, defeat 20%~40%, crushing_defeat 50%~80%）
- `injury_penalty`: 武将受伤减益（轻伤 -10%, 中伤 -30%, 重伤 -50%）
