/**
 * 三国霸业 v1.0 — 游戏引擎核心 (Part1: 基础框架 + 资源系统)
 *
 * 职责：
 *   1. 资源系统：4种资源（粮草/木材/铁矿/铜钱）的存储、产出、消耗
 *   2. 游戏主循环 tick 驱动资源自动增长
 *   3. 挂机产出计算（离线收益）
 *   4. 序列化/反序列化（存档）
 *
 * 数值来源：
 *   - PLAN: docs/games/three-kingdoms/plans/v1.0-基业初立.md
 *   - PRD:  docs/games/three-kingdoms/ui-design/prd/RES-resources-prd.md
 */

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

/** 资源类型枚举 */
export type ResourceType = 'food' | 'wood' | 'iron' | 'gold';

/** 资源状态 — 4种资源的当前持有量 */
export interface Resources {
  food: number;
  wood: number;
  iron: number;
  gold: number;
}

// ─── 建筑系统类型 ───────────────────────────────────────

/**
 * 建筑类型枚举 — PRD BLD-1 八座建筑
 *
 * | 类型 | 分区 | 核心产出 |
 * |------|------|---------|
 * | castle   | 核心中央 | 全资源加成 |
 * | farm     | 左侧民生 | 粮草/秒 |
 * | market   | 左侧民生 | 铜钱/秒 |
 * | barracks | 中央军事 | 兵力/秒 |
 * | smithy   | 中央军事 | 装备强化材料 |
 * | academy  | 右侧文教 | 科技点/秒 |
 * | clinic   | 右侧文教 | 伤兵恢复速率 |
 * | wall     | 上方防御 | 城防值/防御加成 |
 */
export type BuildingType =
  | 'castle'
  | 'farm'
  | 'market'
  | 'barracks'
  | 'smithy'
  | 'academy'
  | 'clinic'
  | 'wall';

/** 建筑状态 — 单座建筑的运行时数据 */
export interface BuildingState {
  /** 建筑类型 */
  type: BuildingType;
  /** 当前等级 (0=未建造, 1=已建造) */
  level: number;
  /** 是否正在升级 */
  isUpgrading: boolean;
  /** 升级开始时间戳（毫秒），未升级时为 0 */
  upgradeStartTime: number;
  /** 升级持续时长（秒），未升级时为 0 */
  upgradeDuration: number;
}

/** 序列化数据结构 */
export interface EngineSaveData {
  resources: Resources;
  productionRate: Resources;
  lastTickTime: number;
  buildings?: Record<string, BuildingState>;
}

// ═══════════════════════════════════════════════════════════════
// 引擎常量
// ═══════════════════════════════════════════════════════════════

/**
 * 初始资源量
 *
 * 参考 PRD RES-1: 新玩家起始资源
 * - 粮草(food): 500 — 足够前期建筑升级
 * - 木材(wood): 300 — 初始建造材料
 * - 铁矿(iron): 100 — 稀有资源，初始少量
 * - 铜钱(gold): 300 — 基础货币
 */
const INITIAL_RESOURCES: Resources = {
  food: 500,
  wood: 300,
  iron: 100,
  gold: 300,
};

/**
 * 基础产出速率（每秒）
 *
 * 参考 PRD RES-2: 资源产出公式
 * 初始状态无任何建筑时的被动产出（基础值）：
 * - 粮草: 0.5/s — 自然产出
 * - 木材: 0.3/s — 自然采集
 * - 铁矿: 0.1/s — 稀有资源低产出
 * - 铜钱: 0.8/s — 基础货币产出
 *
 * 注：建筑加成后产出速率通过 setProductionRate / addProductionBonus 更新
 */
const BASE_PRODUCTION_RATE: Resources = {
  food: 0.5,
  wood: 0.3,
  iron: 0.1,
  gold: 0.8,
};

/**
 * 资源存储上限
 *
 * 参考 PRD RES-4: 资源存储与上限
 * - 粮草: 初始 2,000（粮仓容量）
 * - 木材: 初始 1,500（仓库容量）
 * - 铁矿: 初始 800（仓库容量）
 * - 铜钱: ∞（无上限）
 *
 * 注：上限可通过建筑升级提升，v1.0 先用固定值，后续版本接入 ResourceCapSystem
 */
const INITIAL_RESOURCE_CAPS: Resources = {
  food: 2000,
  wood: 1500,
  iron: 800,
  gold: Infinity,
};

/**
 * 离线收益分段效率 — PRD RES-4 离线效率系数表
 *
 * | 离线时长 | 效率 |
 * |---------|------|
 * | 0~2h    | 100% |
 * | 2~8h    | 80%  |
 * | 8~24h   | 60%  |
 * | 24~48h  | 40%  |
 * | 48~72h  | 25%  |
 * | >72h    | 不计  |
 */
const OFFLINE_EFFICIENCY_TIERS = [
  { maxSeconds: 2 * 3600,  efficiency: 1.0  },
  { maxSeconds: 8 * 3600,  efficiency: 0.8  },
  { maxSeconds: 24 * 3600, efficiency: 0.6  },
  { maxSeconds: 48 * 3600, efficiency: 0.4  },
  { maxSeconds: 72 * 3600, efficiency: 0.25 },
];

/** 离线收益最大计算时长（72小时）— PRD RES-6 */
const MAX_OFFLINE_SECONDS = 72 * 3600;

/** 最低粮草保留量 — PRD RES-6 资源保护机制 */
const MIN_FOOD_RESERVE = 10;

// ═══════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════

/** 创建全零 Resources 对象 */
function zeroResources(): Resources {
  return { food: 0, wood: 0, iron: 0, gold: 0 };
}

/** 深拷贝 Resources */
function cloneResources(res: Resources): Resources {
  return { food: res.food, wood: res.wood, iron: res.iron, gold: res.gold };
}

/** 资源类型列表（遍历用） */
const RESOURCE_TYPES: ResourceType[] = ['food', 'wood', 'iron', 'gold'];

// ═══════════════════════════════════════════════════════════════
// 建筑系统常量 — PRD BLD-1 / BLD-2
// ═══════════════════════════════════════════════════════════════

/** 所有建筑类型列表 */
const BUILDING_TYPES: BuildingType[] = [
  'castle', 'farm', 'market', 'barracks',
  'smithy', 'academy', 'clinic', 'wall',
];

/**
 * 建筑等级上限 — PRD BLD-1
 *
 * | 建筑 | 上限 |
 * |------|:----:|
 * | 主城 | 30 |
 * | 其他 | 25 |
 */
const BUILDING_MAX_LEVEL: Record<BuildingType, number> = {
  castle: 30,
  farm: 25, market: 25, barracks: 25,
  smithy: 20, academy: 20, clinic: 20, wall: 20,
};

/**
 * 建筑解锁所需主城等级 — PRD BLD-4 前置关系
 *
 * | 建筑 | 解锁条件 |
 * |------|---------|
 * | castle/farm | 初始 (Lv1) |
 * | market/barracks | 主城 Lv2 |
 * | smithy/academy | 主城 Lv3 |
 * | clinic | 主城 Lv4 |
 * | wall | 主城 Lv5 |
 */
const BUILDING_UNLOCK_CASTLE_LEVEL: Record<BuildingType, number> = {
  castle: 1, farm: 1,
  market: 2, barracks: 2,
  smithy: 3, academy: 3,
  clinic: 4,
  wall: 5,
};

/**
 * 创建初始建筑状态 — PRD BLD-1
 * 主城和农田初始 Lv1，其余 Lv0（未建造）
 */
function createInitialBuildings(): Map<BuildingType, BuildingState> {
  const map = new Map<BuildingType, BuildingState>();
  for (const type of BUILDING_TYPES) {
    const startLevel = (type === 'castle' || type === 'farm') ? 1 : 0;
    map.set(type, {
      type,
      level: startLevel,
      isUpgrading: false,
      upgradeStartTime: 0,
      upgradeDuration: 0,
    });
  }
  return map;
}

/**
 * 建筑升级费用曲线 — PRD BLD-2 各建筑等级数据表
 *
 * 每项为 [toLevel, { food, gold, troops? }] 元组。
 * troops 字段仅主城/兵营/城墙使用。
 * "每级 ×N" 的区间通过公式动态计算。
 */
interface UpgradeCost { food: number; gold: number; troops: number; }

/**
 * 主城升级费用 — PRD BLD-2 主城等级数据
 * Lv1→2: food=200, gold=150, troops=0, time=10s
 * Lv2→3: food=500, gold=400, troops=50, time=30s
 * Lv3→4: food=1200, gold=900, troops=150, time=60s
 * Lv4→5: food=2500, gold=2000, troops=400, time=180s
 * Lv5→6: food=5000, gold=4000, troops=800, time=480s
 * Lv6→7: food=9000, gold=7500, troops=1500, time=900s
 * Lv7→8: food=15000, gold=12000, troops=3000, time=1800s
 * Lv8→9: food=25000, gold=20000, troops=5000, time=3600s
 * Lv9→10: food=40000, gold=32000, troops=8000, time=7200s
 * Lv10+: 每级 ×1.8 (10~15), ×1.6 (15~20), ×1.5 (20~25), ×1.4 (25~30)
 */
const CASTLE_COST_TABLE: Array<{ toLevel: number; cost: UpgradeCost; time: number }> = [
  { toLevel: 2,  cost: { food: 200,   gold: 150,   troops: 0 },    time: 10 },
  { toLevel: 3,  cost: { food: 500,   gold: 400,   troops: 50 },   time: 30 },
  { toLevel: 4,  cost: { food: 1200,  gold: 900,   troops: 150 },  time: 60 },
  { toLevel: 5,  cost: { food: 2500,  gold: 2000,  troops: 400 },  time: 180 },
  { toLevel: 6,  cost: { food: 5000,  gold: 4000,  troops: 800 },  time: 480 },
  { toLevel: 7,  cost: { food: 9000,  gold: 7500,  troops: 1500 }, time: 900 },
  { toLevel: 8,  cost: { food: 15000, gold: 12000, troops: 3000 }, time: 1800 },
  { toLevel: 9,  cost: { food: 25000, gold: 20000, troops: 5000 }, time: 3600 },
  { toLevel: 10, cost: { food: 40000, gold: 32000, troops: 8000 }, time: 7200 },
];

/**
 * 农田升级费用 — PRD BLD-2 农田等级数据
 * Lv1→2: food=100, gold=50, time=5s
 * Lv2→3: food=250, gold=120, time=15s
 * Lv3→4: food=500, gold=250, time=30s
 * Lv4→5: food=1000, gold=500, time=60s
 * Lv5+: 每级 ×1.8 (5~10), ×1.6 (10~15), ×1.5 (15~20), ×1.4 (20~25)
 */
const FARM_COST_TABLE: Array<{ toLevel: number; cost: UpgradeCost; time: number }> = [
  { toLevel: 2, cost: { food: 100, gold: 50, troops: 0 },   time: 5 },
  { toLevel: 3, cost: { food: 250, gold: 120, troops: 0 },  time: 15 },
  { toLevel: 4, cost: { food: 500, gold: 250, troops: 0 },  time: 30 },
  { toLevel: 5, cost: { food: 1000, gold: 500, troops: 0 }, time: 60 },
];

/**
 * 市集升级费用 — PRD BLD-2 市集等级数据
 * Lv1→2: food=80, gold=100, time=5s
 * Lv2→3: food=200, gold=250, time=15s
 * Lv3→4: food=400, gold=500, time=30s
 * Lv4→5: food=800, gold=1000, time=60s
 * Lv5+: 同农田曲线
 */
const MARKET_COST_TABLE: Array<{ toLevel: number; cost: UpgradeCost; time: number }> = [
  { toLevel: 2, cost: { food: 80, gold: 100, troops: 0 },   time: 5 },
  { toLevel: 3, cost: { food: 200, gold: 250, troops: 0 },  time: 15 },
  { toLevel: 4, cost: { food: 400, gold: 500, troops: 0 },  time: 30 },
  { toLevel: 5, cost: { food: 800, gold: 1000, troops: 0 }, time: 60 },
];

/**
 * 兵营升级费用 — PRD BLD-2 兵营等级数据
 * Lv1→2: food=120, gold=80, troops=0, time=8s
 * Lv2→3: food=300, gold=200, troops=30, time=20s
 * Lv3→4: food=600, gold=400, troops=80, time=45s
 * Lv4→5: food=1200, gold=800, troops=200, time=90s
 * Lv5+: 同农田曲线(food/gold), troops 每级 ×1.8
 */
const BARRACKS_COST_TABLE: Array<{ toLevel: number; cost: UpgradeCost; time: number }> = [
  { toLevel: 2, cost: { food: 120, gold: 80, troops: 0 },   time: 8 },
  { toLevel: 3, cost: { food: 300, gold: 200, troops: 30 }, time: 20 },
  { toLevel: 4, cost: { food: 600, gold: 400, troops: 80 }, time: 45 },
  { toLevel: 5, cost: { food: 1200, gold: 800, troops: 200 }, time: 90 },
];

/**
 * 铁匠铺升级费用 — PRD BLD-2 铁匠铺等级数据
 * Lv1→2: food=200, gold=300, time=30s
 * Lv2→3: food=500, gold=800, time=60s
 * Lv3+: 每级 ×2.0 (3~5), ×1.7 (5~10), ×1.5 (10~20)
 */
const SMITHY_COST_TABLE: Array<{ toLevel: number; cost: UpgradeCost; time: number }> = [
  { toLevel: 2, cost: { food: 200, gold: 300, troops: 0 }, time: 30 },
  { toLevel: 3, cost: { food: 500, gold: 800, troops: 0 }, time: 60 },
];

/**
 * 书院升级费用 — PRD BLD-2 书院等级数据
 * Lv1→2: food=150, gold=200, time=20s
 * Lv2→3: food=400, gold=500, time=45s
 * Lv3+: 每级 ×1.8 (3~5), ×1.6 (5~10), ×1.5 (10~20)
 */
const ACADEMY_COST_TABLE: Array<{ toLevel: number; cost: UpgradeCost; time: number }> = [
  { toLevel: 2, cost: { food: 150, gold: 200, troops: 0 }, time: 20 },
  { toLevel: 3, cost: { food: 400, gold: 500, troops: 0 }, time: 45 },
];

/**
 * 医馆升级费用 — PRD BLD-2 医馆等级数据
 * Lv1→2: food=100, gold=150, time=15s
 * Lv2+: 每级 ×1.8 (2~5), ×1.6 (5~10), ×1.5 (10~20)
 */
const CLINIC_COST_TABLE: Array<{ toLevel: number; cost: UpgradeCost; time: number }> = [
  { toLevel: 2, cost: { food: 100, gold: 150, troops: 0 }, time: 15 },
];

/**
 * 城墙升级费用 — PRD BLD-2 城墙等级数据
 * Lv1→2: food=300, gold=200, troops=100, time=30s
 * Lv2→3: food=800, gold=500, troops=250, time=60s
 * Lv3+: 每级 ×2.0 (3~5), ×1.7 (5~10), ×1.5 (10~20)
 */
const WALL_COST_TABLE: Array<{ toLevel: number; cost: UpgradeCost; time: number }> = [
  { toLevel: 2, cost: { food: 300, gold: 200, troops: 100 }, time: 30 },
  { toLevel: 3, cost: { food: 800, gold: 500, troops: 250 }, time: 60 },
];

/** 建筑费用表映射 */
const BUILDING_COST_TABLES: Record<BuildingType, Array<{ toLevel: number; cost: UpgradeCost; time: number }>> = {
  castle: CASTLE_COST_TABLE,
  farm: FARM_COST_TABLE,
  market: MARKET_COST_TABLE,
  barracks: BARRACKS_COST_TABLE,
  smithy: SMITHY_COST_TABLE,
  academy: ACADEMY_COST_TABLE,
  clinic: CLINIC_COST_TABLE,
  wall: WALL_COST_TABLE,
};

/**
 * 建筑费用乘数区间 — PRD BLD-2 "每级 ×N" 增长规则
 *
 * 每种建筑在不同等级段使用不同的乘数。
 * 未列出的建筑使用默认的农田曲线乘数。
 */
interface CostMultiplierTier {
  /** 区间起始等级（含） */
  fromLevel: number;
  /** 区间结束等级（含） */
  toLevel: number;
  /** food/gold 乘数 */
  resourceMultiplier: number;
  /** troops 乘数（仅对有 troops 的建筑生效） */
  troopsMultiplier: number;
  /** 升级时间乘数 */
  timeMultiplier: number;
}

/** 通用乘数区间（农田/市集/兵营 Lv5+） */
const DEFAULT_COST_TIERS: CostMultiplierTier[] = [
  { fromLevel: 5,  toLevel: 10, resourceMultiplier: 1.8, troopsMultiplier: 1.8, timeMultiplier: 1.6 },
  { fromLevel: 10, toLevel: 15, resourceMultiplier: 1.6, troopsMultiplier: 1.6, timeMultiplier: 1.5 },
  { fromLevel: 15, toLevel: 20, resourceMultiplier: 1.5, troopsMultiplier: 1.5, timeMultiplier: 1.4 },
  { fromLevel: 20, toLevel: 25, resourceMultiplier: 1.4, troopsMultiplier: 1.4, timeMultiplier: 1.3 },
];

/** 主城 Lv10+ 乘数区间 */
const CASTLE_COST_TIERS: CostMultiplierTier[] = [
  { fromLevel: 10, toLevel: 15, resourceMultiplier: 1.8, troopsMultiplier: 1.8, timeMultiplier: 2.0 },
  { fromLevel: 15, toLevel: 20, resourceMultiplier: 1.6, troopsMultiplier: 1.6, timeMultiplier: 1.8 },
  { fromLevel: 20, toLevel: 25, resourceMultiplier: 1.5, troopsMultiplier: 1.5, timeMultiplier: 1.5 },
  { fromLevel: 25, toLevel: 30, resourceMultiplier: 1.4, troopsMultiplier: 1.4, timeMultiplier: 1.3 },
];

/** 铁匠铺/城墙 Lv3+ 乘数区间 */
const SMITHY_WALL_COST_TIERS: CostMultiplierTier[] = [
  { fromLevel: 3,  toLevel: 5,  resourceMultiplier: 2.0, troopsMultiplier: 2.0, timeMultiplier: 1.8 },
  { fromLevel: 5,  toLevel: 10, resourceMultiplier: 1.7, troopsMultiplier: 1.7, timeMultiplier: 1.5 },
  { fromLevel: 10, toLevel: 20, resourceMultiplier: 1.5, troopsMultiplier: 1.5, timeMultiplier: 1.3 },
];

/** 书院 Lv3+ 乘数区间 */
const ACADEMY_COST_TIERS: CostMultiplierTier[] = [
  { fromLevel: 3,  toLevel: 5,  resourceMultiplier: 1.8, troopsMultiplier: 1.8, timeMultiplier: 1.6 },
  { fromLevel: 5,  toLevel: 10, resourceMultiplier: 1.6, troopsMultiplier: 1.6, timeMultiplier: 1.4 },
  { fromLevel: 10, toLevel: 20, resourceMultiplier: 1.5, troopsMultiplier: 1.5, timeMultiplier: 1.3 },
];

/** 医馆 Lv2+ 乘数区间 */
const CLINIC_COST_TIERS: CostMultiplierTier[] = [
  { fromLevel: 2,  toLevel: 5,  resourceMultiplier: 1.8, troopsMultiplier: 1.8, timeMultiplier: 1.6 },
  { fromLevel: 5,  toLevel: 10, resourceMultiplier: 1.6, troopsMultiplier: 1.6, timeMultiplier: 1.4 },
  { fromLevel: 10, toLevel: 20, resourceMultiplier: 1.5, troopsMultiplier: 1.5, timeMultiplier: 1.3 },
];

/** 建筑类型 → 乘数区间映射 */
const BUILDING_COST_TIERS: Record<BuildingType, CostMultiplierTier[]> = {
  castle: CASTLE_COST_TIERS,
  farm: DEFAULT_COST_TIERS,
  market: DEFAULT_COST_TIERS,
  barracks: DEFAULT_COST_TIERS,
  smithy: SMITHY_WALL_COST_TIERS,
  academy: ACADEMY_COST_TIERS,
  clinic: CLINIC_COST_TIERS,
  wall: SMITHY_WALL_COST_TIERS,
};

/**
 * 建筑产出数据 — PRD BLD-3 各建筑产出汇总
 *
 * 产出按等级线性插值计算：
 *   output(lv) = base + (lv - 1) * increment
 *
 * | 建筑 | 资源 | Lv1 | Lv25/30 |
 * |------|------|-----|---------|
 * | farm | food/s | 0.8 | ~45 |
 * | market | gold/s | 0.6 | ~35 |
 * | barracks | (兵力, 暂不产出资源) | 0.4 | ~28 |
 * | academy | (科技点, 暂不产出资源) | 0.2 | ~8 |
 */
interface BuildingProductionDef {
  /** 等级1时的产出 */
  base: number;
  /** 每级增量（线性） */
  perLevel: number;
  /** 产出资源类型（null 表示非资源产出，如兵力/科技点） */
  resource: ResourceType | null;
}

const BUILDING_PRODUCTION: Record<BuildingType, BuildingProductionDef> = {
  castle:   { base: 0,    perLevel: 0,    resource: null },   // 主城产出为加成，非直接产出
  farm:     { base: 0.8,  perLevel: 1.76, resource: 'food' }, // Lv1=0.8, Lv25≈44.8
  market:   { base: 0.6,  perLevel: 1.36, resource: 'gold' }, // Lv1=0.6, Lv25≈33.6
  barracks: { base: 0,    perLevel: 0,    resource: null },   // v1.0 兵力暂不产出资源
  smithy:   { base: 0,    perLevel: 0,    resource: null },   // v1.0 材料暂不产出资源
  academy:  { base: 0,    perLevel: 0,    resource: null },   // v1.0 科技点暂不产出资源
  clinic:   { base: 0,    perLevel: 0,    resource: null },   // v1.0 恢复速率暂不产出资源
  wall:     { base: 0,    perLevel: 0,    resource: null },   // v1.0 城防值暂不产出资源
};

/**
 * 主城全资源加成 — PRD BLD-2 主城等级数据
 * Lv1=+0%, Lv2=+2%, Lv3=+4%, ..., Lv10=+18%
 * Lv10~15=+20%~28%, Lv15~20=+30%~38%, Lv20~25=+40%~48%, Lv25~30=+50%~58%
 */
function getCastleBonusPercent(castleLevel: number): number {
  if (castleLevel <= 1) return 0;
  if (castleLevel <= 10) return (castleLevel - 1) * 2; // Lv2=2%, Lv10=18%
  // Lv11~30: 每2级 +4%（即每级 +2%），延续线性
  return 18 + (castleLevel - 10) * 2; // Lv11=20%, Lv30=58%
}

// ═══════════════════════════════════════════════════════════════
// 引擎主类
// ═══════════════════════════════════════════════════════════════

/**
 * ThreeKingdomsEngine — 三国霸业游戏引擎
 *
 * 核心职责：
 *   - 管理4种资源的存储、产出、消耗
 *   - tick 驱动资源自动增长（受上限约束）
 *   - 离线收益计算（分段衰减）
 *   - 序列化/反序列化支持存档
 *
 * 使用方式：
 *   const engine = new ThreeKingdomsEngine();
 *   engine.tick(deltaSeconds);  // 每帧或每100ms调用
 *   engine.serialize();         // 保存存档
 *   engine.deserialize(data);   // 加载存档
 */
export class ThreeKingdomsEngine {

  // ─── 资源存储 ─────────────────────────────────────────
  /** 当前资源持有量 */
  private resources: Resources;

  /** 每秒产出速率（含建筑/科技加成后的净速率） */
  private productionRate: Resources;

  /** 资源存储上限 */
  private resourceCaps: Resources;

  // ─── 建筑系统 ─────────────────────────────────────────
  /** 所有建筑状态 */
  private buildings: Map<BuildingType, BuildingState>;

  // ─── 时间管理 ─────────────────────────────────────────
  /** 上次 tick 的时间戳（毫秒） */
  private lastTickTime: number;

  // ─── 版本 ─────────────────────────────────────────────
  /** 存档版本号，用于未来数据迁移 */
  private readonly saveVersion: number = 1;

  // ═════════════════════════════════════════════════════════
  // 构造函数
  // ═════════════════════════════════════════════════════════

  /**
   * 初始化引擎
   *
   * 新游戏：不传参数，使用默认初始值
   * 加载存档：调用 deserialize(data) 覆盖初始值
   */
  constructor() {
    this.resources = cloneResources(INITIAL_RESOURCES);
    this.productionRate = cloneResources(BASE_PRODUCTION_RATE);
    this.resourceCaps = cloneResources(INITIAL_RESOURCE_CAPS);
    this.buildings = createInitialBuildings();
    this.lastTickTime = Date.now();
  }

  // ═════════════════════════════════════════════════════════
  // 核心 tick — 游戏主循环驱动
  // ═════════════════════════════════════════════════════════

  /**
   * 游戏主循环 tick
   *
   * 每帧（或每100ms）调用一次，根据 deltaTime 累加资源产出。
   * 产出受存储上限约束，达到上限后停止增长。
   *
   * @param deltaTime  距上次 tick 的秒数（通常为 0.1 或帧间隔）
   *
   * PRD RES-2 产出公式：
   *   资源实际获得/秒 = productionRate × deltaTime
   *   受上限约束：resources[type] = min(resources[type] + gain, cap)
   */
  tick(deltaTime: number): void {
    if (deltaTime <= 0 || !isFinite(deltaTime)) return;

    const dt = Math.min(deltaTime, 1.0);

    for (const type of RESOURCE_TYPES) {
      const cap = this.resourceCaps[type];
      const current = this.resources[type];

      if (current >= cap) continue;

      const gain = this.productionRate[type] * dt;
      this.resources[type] = Math.min(current + gain, cap);
    }

    this.lastTickTime = Date.now();
  }

  // ═════════════════════════════════════════════════════════
  // 资源读取
  // ═════════════════════════════════════════════════════════

  /** 获取指定资源的当前持有量 */
  getResource(type: ResourceType): number {
    return this.resources[type];
  }

  /** 获取所有资源的当前持有量（返回副本） */
  getResources(): Resources {
    return cloneResources(this.resources);
  }

  /** 获取当前产出速率（每秒） */
  getProductionRate(): Resources {
    return cloneResources(this.productionRate);
  }

  /** 获取资源存储上限 */
  getResourceCaps(): Resources {
    return cloneResources(this.resourceCaps);
  }

  // ═════════════════════════════════════════════════════════
  // 资源写入
  // ═════════════════════════════════════════════════════════

  /**
   * 增加资源（奖励、产出补充等场景）
   * 注：增加后受上限约束，超出部分截断
   */
  addResource(type: ResourceType, amount: number): void {
    if (amount <= 0) return;

    const cap = this.resourceCaps[type];
    this.resources[type] = Math.min(this.resources[type] + amount, cap);
  }

  /**
   * 消耗资源（建筑升级、科技研究等场景）
   *
   * @returns true=消耗成功，false=资源不足（不扣减）
   *
   * 特殊规则 — PRD RES-6 最低粮草保留：
   *   粮草消耗后不低于 MIN_FOOD_RESERVE (10)
   */
  consumeResource(type: ResourceType, amount: number): boolean {
    if (amount <= 0) return true;

    const current = this.resources[type];

    // 粮草特殊保护：消耗后至少保留 MIN_FOOD_RESERVE
    if (type === 'food') {
      const available = Math.max(0, current - MIN_FOOD_RESERVE);
      if (available < amount) return false;
      this.resources[type] = current - amount;
      return true;
    }

    if (current < amount) return false;
    this.resources[type] = current - amount;
    return true;
  }

  /**
   * 检查是否能支付指定资源组合
   *
   * @param cost  资源消耗量（Partial，只需填写需要消耗的类型）
   */
  canAfford(cost: Partial<Resources>): boolean {
    for (const type of RESOURCE_TYPES) {
      const required = cost[type];
      if (required === undefined || required <= 0) continue;

      const current = this.resources[type];

      if (type === 'food') {
        const available = Math.max(0, current - MIN_FOOD_RESERVE);
        if (available < required) return false;
      } else {
        if (current < required) return false;
      }
    }
    return true;
  }

  // ═════════════════════════════════════════════════════════
  // 产出速率管理
  // ═════════════════════════════════════════════════════════

  /** 设置指定资源的产出速率（覆盖） */
  setProductionRate(type: ResourceType, rate: number): void {
    this.productionRate[type] = Math.max(0, rate);
  }

  /** 增加产出速率（加法叠加） */
  addProductionBonus(type: ResourceType, bonus: number): void {
    this.productionRate[type] = Math.max(0, this.productionRate[type] + bonus);
  }

  /** 批量设置产出速率（覆盖全部） */
  setAllProductionRates(rates: Resources): void {
    for (const type of RESOURCE_TYPES) {
      this.productionRate[type] = Math.max(0, rates[type]);
    }
  }

  // ═════════════════════════════════════════════════════════
  // 存储上限管理
  // ═════════════════════════════════════════════════════════

  /** 设置指定资源的存储上限 */
  setResourceCap(type: ResourceType, cap: number): void {
    this.resourceCaps[type] = Math.max(0, cap);
    if (this.resources[type] > this.resourceCaps[type]) {
      this.resources[type] = this.resourceCaps[type];
    }
  }

  /** 获取指定资源的存储上限 */
  getResourceCap(type: ResourceType): number {
    return this.resourceCaps[type];
  }

  /**
   * 获取指定资源的容量百分比
   *
   * PRD RES-4 容量警告规则：
   *   0%~70% 安全 | 70%~90% 注意 | 90%~95% 警告 | 95%~100% 紧急 | 100% 已满
   */
  getCapacityPercent(type: ResourceType): number {
    const cap = this.resourceCaps[type];
    if (!isFinite(cap) || cap <= 0) return 0;
    return Math.min(1, this.resources[type] / cap);
  }

  // ═════════════════════════════════════════════════════════
  // 离线收益计算
  // ═════════════════════════════════════════════════════════

  /**
   * 计算离线挂机产出
   *
   * PRD RES-4 离线收益计算公式：分段计算各时段产出，每段使用不同效率系数
   * 超过72小时的部分不计
   *
   * @param offlineSeconds  离线秒数
   * @returns  各资源离线收益（未应用上限截断）
   */
  calculateOfflineProgress(offlineSeconds: number): Resources {
    const cappedSeconds = Math.min(offlineSeconds, MAX_OFFLINE_SECONDS);
    if (cappedSeconds <= 0) return zeroResources();

    let remaining = cappedSeconds;
    let prevTierEnd = 0;
    let effectiveSeconds = 0;

    for (const tier of OFFLINE_EFFICIENCY_TIERS) {
      if (remaining <= 0) break;
      const tierDuration = Math.min(remaining, tier.maxSeconds - prevTierEnd);
      effectiveSeconds += tierDuration * tier.efficiency;
      remaining -= tierDuration;
      prevTierEnd = tier.maxSeconds;
    }

    const gain: Resources = zeroResources();
    for (const type of RESOURCE_TYPES) {
      gain[type] = this.productionRate[type] * effectiveSeconds;
    }

    return gain;
  }

  /**
   * 应用离线收益到资源（含上限截断）
   *
   * @returns  实际获得的各资源量（截断后）
   */
  applyOfflineProgress(offlineSeconds: number): Resources {
    const rawGain = this.calculateOfflineProgress(offlineSeconds);
    const actualGain: Resources = zeroResources();

    for (const type of RESOURCE_TYPES) {
      const cap = this.resourceCaps[type];
      const current = this.resources[type];
      const available = isFinite(cap) ? Math.max(0, cap - current) : rawGain[type];

      actualGain[type] = Math.min(rawGain[type], available);
      this.resources[type] = Math.min(current + actualGain[type], cap);
    }

    return actualGain;
  }

  // ═════════════════════════════════════════════════════════
  // 序列化 / 反序列化
  // ═════════════════════════════════════════════════════════

  /** 序列化引擎状态为可存储对象 */
  serialize(): EngineSaveData {
    return {
      resources: cloneResources(this.resources),
      productionRate: cloneResources(this.productionRate),
      lastTickTime: this.lastTickTime,
    };
  }

  /**
   * 从序列化数据恢复引擎状态
   *
   * 容错处理：缺失字段使用默认值，非法数值修正为 0，lastTickTime 缺失使用当前时间
   */
  deserialize(data: any): void {
    if (!data || typeof data !== 'object') return;

    if (data.resources && typeof data.resources === 'object') {
      for (const type of RESOURCE_TYPES) {
        const val = data.resources[type];
        this.resources[type] = (typeof val === 'number' && isFinite(val) && val >= 0)
          ? val
          : INITIAL_RESOURCES[type];
      }
    } else {
      this.resources = cloneResources(INITIAL_RESOURCES);
    }

    if (data.productionRate && typeof data.productionRate === 'object') {
      for (const type of RESOURCE_TYPES) {
        const val = data.productionRate[type];
        this.productionRate[type] = (typeof val === 'number' && isFinite(val) && val >= 0)
          ? val
          : BASE_PRODUCTION_RATE[type];
      }
    } else {
      this.productionRate = cloneResources(BASE_PRODUCTION_RATE);
    }

    if (typeof data.lastTickTime === 'number' && isFinite(data.lastTickTime) && data.lastTickTime > 0) {
      this.lastTickTime = data.lastTickTime;
    } else {
      this.lastTickTime = Date.now();
    }
  }

  // ═════════════════════════════════════════════════════════
  // 工具方法
  // ═════════════════════════════════════════════════════════

  /** 获取上次 tick 时间戳（毫秒） */
  getLastTickTime(): number {
    return this.lastTickTime;
  }

  /** 获取存档版本号 */
  getSaveVersion(): number {
    return this.saveVersion;
  }

  /** 重置引擎到初始状态（新游戏） */
  reset(): void {
    this.resources = cloneResources(INITIAL_RESOURCES);
    this.productionRate = cloneResources(BASE_PRODUCTION_RATE);
    this.resourceCaps = cloneResources(INITIAL_RESOURCE_CAPS);
    this.lastTickTime = Date.now();
  }
}
