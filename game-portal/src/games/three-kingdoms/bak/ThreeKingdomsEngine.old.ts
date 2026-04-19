/**
 * 三国霸业 v1.0「基业初立」— 游戏引擎核心
 *
 * 严格按PRD实现：
 *   - PLAN: docs/games/three-kingdoms/plans/v1.0-基业初立.md
 *   - PRD:  docs/games/three-kingdoms/ui-design/prd/BLD-buildings-prd.md
 *   - PRD:  docs/games/three-kingdoms/ui-design/prd/RES-resources-prd.md
 *
 * v1.0 范围：
 *   1. 资源系统：4种资源（粮草/铜钱/兵力/天命）的存储、产出、消耗、上限
 *   2. 建筑系统：8座建筑的建造、升级、产出、解锁
 *   3. 主城等级限制：其他建筑等级 ≤ 主城等级
 *   4. 离线收益：分段衰减计算
 *   5. 存档系统：序列化/反序列化 + 自动保存
 *
 * @module games/three-kingdoms/ThreeKingdomsEngine
 */

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

/** 资源类型 — PRD RES-1: 4种核心资源 */
export type ResourceType = 'food' | 'gold' | 'troops' | 'destiny';

/** 资源状态 */
export interface Resources {
  food: number;     // 粮草
  gold: number;     // 铜钱
  troops: number;   // 兵力
  destiny: number;  // 天命
}

/** 建筑类型 — PRD BLD-1: 8座建筑 */
export type BuildingId =
  | 'castle'   // 主城 — 核心中央，全资源加成
  | 'farm'     // 农田 — 左侧民生，粮草/秒
  | 'market'   // 市集 — 左侧民生，铜钱/秒
  | 'barracks' // 兵营 — 中央军事，兵力/秒
  | 'smithy'   // 铁匠铺 — 中央军事，装备强化材料
  | 'academy'  // 书院 — 右侧文教，科技点/秒
  | 'clinic'   // 医馆 — 右侧文教，伤兵恢复速率
  | 'wall';    // 城墙 — 上方防御，城防值

/** 建筑运行时状态 */
export interface BuildingState {
  id: BuildingId;
  level: number;          // 0=未建造, 1+=已建造
  isUpgrading: boolean;   // 是否正在升级中
  upgradeStartTime: number; // 升级开始时间戳（ms），0=无升级
  upgradeDuration: number;  // 升级持续时长（秒），0=无升级
}

/** 升级费用条目 — PRD BLD-2 */
export interface UpgradeCost {
  food?: number;
  gold?: number;
  troops?: number;
  time: number;       // 升级时间（秒）
}

/** 存档数据结构 */
export interface EngineSaveData {
  version: number;
  resources: Resources;
  buildings: Record<string, {
    level: number;
    isUpgrading: boolean;
    upgradeStartTime: number;
    upgradeDuration: number;
  }>;
  lastTickTime: number;
}

// ═══════════════════════════════════════════════════════════════
// 常量 — PRD数值表
// ═══════════════════════════════════════════════════════════════

/** PRD RES-1: 初始资源量 */
const INITIAL_RESOURCES: Resources = {
  food: 500,
  gold: 300,
  troops: 200,
  destiny: 50,
};

/** PRD RES-1: 资源基础上限 */
const BASE_RESOURCE_CAPS: Resources = {
  food: 2000,
  gold: Infinity,
  troops: 500,
  destiny: Infinity,
};

/** PRD BLD-1: 建筑信息 */
const BUILDING_INFO: Record<BuildingId, {
  name: string; icon: string; maxLevel: number;
  unlockCastleLevel: number;  // 解锁所需主城等级
  description: string;
}> = {
  castle:   { name: '主城',   icon: '🏛️', maxLevel: 30, unlockCastleLevel: 0, description: '全资源加成，限制其他建筑等级上限' },
  farm:     { name: '农田',   icon: '🌾', maxLevel: 25, unlockCastleLevel: 0, description: '产出粮草，提升粮草存储上限' },
  market:   { name: '市集',   icon: '💰', maxLevel: 25, unlockCastleLevel: 2, description: '产出铜钱，经济命脉' },
  barracks: { name: '兵营',   icon: '⚔️', maxLevel: 25, unlockCastleLevel: 2, description: '产出兵力，提升兵力存储上限' },
  smithy:   { name: '铁匠铺', icon: '🔨', maxLevel: 20, unlockCastleLevel: 3, description: '产出装备强化材料' },
  academy:  { name: '书院',   icon: '📚', maxLevel: 20, unlockCastleLevel: 3, description: '产出科技点' },
  clinic:   { name: '医馆',   icon: '🏥', maxLevel: 20, unlockCastleLevel: 4, description: '提升伤兵恢复速率' },
  wall:     { name: '城墙',   icon: '🏯', maxLevel: 20, unlockCastleLevel: 5, description: '提升城防值和防御加成' },
};

/** PRD BLD-2: 主城升级费用表 */
const CASTLE_UPGRADE_COSTS: Record<number, UpgradeCost> = {
  1: { food: 200, gold: 150, time: 10 },
  2: { food: 500, gold: 400, troops: 50, time: 30 },
  3: { food: 1200, gold: 900, troops: 150, time: 60 },
  4: { food: 2500, gold: 2000, troops: 400, time: 180 },
  5: { food: 5000, gold: 4000, troops: 800, time: 480 },
  6: { food: 9000, gold: 7500, troops: 1500, time: 900 },
  7: { food: 15000, gold: 12000, troops: 3000, time: 1800 },
  8: { food: 25000, gold: 20000, troops: 5000, time: 3600 },
  9: { food: 40000, gold: 32000, troops: 8000, time: 7200 },
};

/** PRD BLD-2: 农田升级费用表 */
const FARM_UPGRADE_COSTS: Record<number, UpgradeCost> = {
  1: { food: 100, gold: 50, time: 5 },
  2: { food: 250, gold: 120, time: 15 },
  3: { food: 500, gold: 250, time: 30 },
  4: { food: 1000, gold: 500, time: 60 },
};

/** PRD BLD-2: 市集升级费用表 */
const MARKET_UPGRADE_COSTS: Record<number, UpgradeCost> = {
  1: { food: 80, gold: 100, time: 5 },
  2: { food: 200, gold: 250, time: 15 },
  3: { food: 400, gold: 500, time: 30 },
  4: { food: 800, gold: 1000, time: 60 },
};

/** PRD BLD-2: 兵营升级费用表 */
const BARRACKS_UPGRADE_COSTS: Record<number, UpgradeCost> = {
  1: { food: 120, gold: 80, time: 8 },
  2: { food: 300, gold: 200, troops: 30, time: 20 },
  3: { food: 600, gold: 400, troops: 80, time: 45 },
  4: { food: 1200, gold: 800, troops: 200, time: 90 },
};

/** 其他建筑升级费用（铁匠铺/书院/医馆/城墙） */
const OTHER_UPGRADE_COSTS: Record<number, UpgradeCost> = {
  1: { food: 200, gold: 300, time: 30 },
  2: { food: 500, gold: 800, time: 60 },
  3: { food: 1000, gold: 1500, time: 120 },
  4: { food: 2000, gold: 3000, time: 240 },
};

/** 建筑升级费用表映射 */
const UPGRADE_COST_TABLES: Record<BuildingId, Record<number, UpgradeCost>> = {
  castle: CASTLE_UPGRADE_COSTS,
  farm: FARM_UPGRADE_COSTS,
  market: MARKET_UPGRADE_COSTS,
  barracks: BARRACKS_UPGRADE_COSTS,
  smithy: OTHER_UPGRADE_COSTS,
  academy: OTHER_UPGRADE_COSTS,
  clinic: OTHER_UPGRADE_COSTS,
  wall: OTHER_UPGRADE_COSTS,
};

/** PRD BLD-3: 建筑产出公式 */
const BUILDING_PRODUCTION: Record<BuildingId, (level: number) => Partial<Resources>> = {
  castle:   (lv) => ({}),  // 主城不直接产出，通过加成
  farm:     (lv) => ({ food: 1.0 + 0.5 * lv }),
  market:   (lv) => ({ gold: 0.8 + 0.4 * lv }),
  barracks: (lv) => ({ troops: 0.5 + 0.3 * lv }),
  smithy:   (lv) => ({}),  // v2.0实现装备材料产出
  academy:  (lv) => ({}),  // v5.0实现科技点产出
  clinic:   (lv) => ({}),  // v3.0实现伤兵恢复
  wall:     (lv) => ({}),  // v3.0实现城防值
};

/** PRD BLD-1: 主城全资源加成 (每级+2%) */
const CASTLE_BONUS_PER_LEVEL = 0.02;

/** PRD RES-4: 离线收益分段效率 */
const OFFLINE_EFFICIENCY = [
  { maxHours: 2,  efficiency: 1.0  },
  { maxHours: 8,  efficiency: 0.8  },
  { maxHours: 24, efficiency: 0.6  },
  { maxHours: 48, efficiency: 0.4  },
  { maxHours: 72, efficiency: 0.25 },
];

/** 离线收益最大计算时长72小时 */
const MAX_OFFLINE_HOURS = 72;

/** 自动保存间隔（秒） */
const AUTO_SAVE_INTERVAL = 30;

/** localStorage 存档键 */
const SAVE_KEY = 'three_kingdoms_save';

// ═══════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════

function zeroResources(): Resources {
  return { food: 0, gold: 0, troops: 0, destiny: 0 };
}

function cloneResources(r: Resources): Resources {
  return { food: r.food, gold: r.gold, troops: r.troops, destiny: r.destiny };
}

const ALL_RESOURCE_TYPES: ResourceType[] = ['food', 'gold', 'troops', 'destiny'];
const ALL_BUILDING_IDS: BuildingId[] = ['castle', 'farm', 'market', 'barracks', 'smithy', 'academy', 'clinic', 'wall'];

// ═══════════════════════════════════════════════════════════════
// 引擎主类
// ═══════════════════════════════════════════════════════════════

export class ThreeKingdomsEngine {

  // ─── 核心状态 ─────────────────────────────────────────
  private resources: Resources;
  private buildings: Map<BuildingId, BuildingState>;
  private lastTickTime: number;
  private readonly saveVersion = 1;

  // ─── 缓存 ─────────────────────────────────────────────
  private _cachedProductionRate: Resources | null = null;
  private _cachedResourceCaps: Resources | null = null;

  constructor() {
    this.resources = cloneResources(INITIAL_RESOURCES);
    this.buildings = new Map<BuildingId, BuildingState>();
    ALL_BUILDING_IDS.forEach(id => {
      this.buildings.set(id, {
        id,
        level: (id === 'castle' || id === 'farm') ? 1 : 0,
        isUpgrading: false,
        upgradeStartTime: 0,
        upgradeDuration: 0,
      });
    });
    this.lastTickTime = Date.now();
  }

  // ═════════════════════════════════════════════════════════
  // 资源读取 API
  // ═════════════════════════════════════════════════════════

  /** 获取指定资源当前持有量 */
  getResource(type: ResourceType): number {
    return this.resources[type];
  }

  /** 获取所有资源（副本） */
  getResources(): Resources {
    return cloneResources(this.resources);
  }

  /** 获取当前产出速率（每秒）— 含建筑产出+主城加成 */
  getProductionRate(): Resources {
    if (!this._cachedProductionRate) {
      this._cachedProductionRate = this._calculateProductionRate();
    }
    return cloneResources(this._cachedProductionRate);
  }

  /** 获取资源存储上限 */
  getResourceCap(type: ResourceType): number {
    const caps = this._getResourceCaps();
    return caps[type];
  }

  /** 获取所有资源上限 */
  getResourceCaps(): Resources {
    return cloneResources(this._getResourceCaps());
  }

  /** 获取容量百分比 0~1 — PRD RES-4 容量警告 */
  getCapacityPercent(type: ResourceType): number {
    const cap = this.getResourceCap(type);
    if (!isFinite(cap) || cap <= 0) return 0;
    return Math.min(1, this.resources[type] / cap);
  }

  // ═════════════════════════════════════════════════════════
  // 资源写入 API
  // ═════════════════════════════════════════════════════════

  /** 增加资源（受上限约束） */
  addResource(type: ResourceType, amount: number): void {
    if (amount <= 0) return;
    const cap = this.getResourceCap(type);
    this.resources[type] = Math.min(this.resources[type] + amount, cap);
  }

  /** 消耗资源 — 返回false表示资源不足 */
  consumeResource(type: ResourceType, amount: number): boolean {
    if (amount <= 0) return true;
    if (this.resources[type] < amount) return false;
    this.resources[type] -= amount;
    return true;
  }

  /** 检查是否能支付指定资源组合 */
  canAfford(cost: Partial<Resources>): boolean {
    for (const type of ALL_RESOURCE_TYPES) {
      const needed = cost[type];
      if (needed !== undefined && needed > 0 && this.resources[type] < needed) {
        return false;
      }
    }
    return true;
  }

  /** 批量消耗资源 — 原子操作，要么全扣要么不扣 */
  consumeBatch(cost: Partial<Resources>): boolean {
    if (!this.canAfford(cost)) return false;
    for (const type of ALL_RESOURCE_TYPES) {
      const needed = cost[type];
      if (needed !== undefined && needed > 0) {
        this.resources[type] -= needed;
      }
    }
    return true;
  }

  // ═════════════════════════════════════════════════════════
  // 建筑系统 API
  // ═════════════════════════════════════════════════════════

  /** 获取所有建筑状态 */
  getBuildings(): BuildingState[] {
    return ALL_BUILDING_IDS.map(id => this.buildings.get(id)!);
  }

  /** 获取单个建筑状态 */
  getBuilding(id: BuildingId): BuildingState {
    return this.buildings.get(id)!;
  }

  /** 获取建筑名称 */
  getBuildingName(id: BuildingId): string {
    return BUILDING_INFO[id].name;
  }

  /** 获取建筑图标 */
  getBuildingIcon(id: BuildingId): string {
    return BUILDING_INFO[id].icon;
  }

  /** 获取建筑描述 */
  getBuildingDescription(id: BuildingId): string {
    return BUILDING_INFO[id].description;
  }

  /** 获取建筑等级上限 */
  getBuildingMaxLevel(id: BuildingId): number {
    return BUILDING_INFO[id].maxLevel;
  }

  /** 检查建筑是否已解锁 — PRD BLD-4 */
  isBuildingUnlocked(id: BuildingId): boolean {
    const required = BUILDING_INFO[id].unlockCastleLevel;
    return this.buildings.get('castle')!.level >= required;
  }

  /** 检查建筑是否可以升级 — PRD BLD-4: 等级 ≤ 主城等级 */
  isBuildingUpgradeAllowed(id: BuildingId): boolean {
    const state = this.buildings.get(id)!;
    const currentLevel = state.level;
    const maxLevel = BUILDING_INFO[id].maxLevel;

    // 已达最大等级
    if (currentLevel >= maxLevel) return false;

    // 主城等级限制 — PRD BLD-4 核心规则
    if (id !== 'castle') {
      if (currentLevel >= this.buildings.get('castle')!.level) return false;
    }

    // 未解锁
    if (!this.isBuildingUnlocked(id)) return false;

    return true;
  }

  /** 获取升级费用 — PRD BLD-2 分级费用表
   *  @param id 建筑ID
   *  @param level 可选，指定查询从哪一级升到下一级的费用；默认取当前等级
   */
  getUpgradeCost(id: BuildingId, level?: number): UpgradeCost | null {
    const currentLevel = level ?? this.buildings.get(id)!.level;
    const table = UPGRADE_COST_TABLES[id];
    if (!table) return null;

    // 查表
    const cost = table[currentLevel];
    if (cost) return { ...cost };

    // 超出查表范围，使用公式递推 — PRD BLD-2: 每级×1.8
    const lastDefinedLevel = Math.max(...Object.keys(table).map(Number));
    const lastCost = table[lastDefinedLevel];
    if (!lastCost) return null;

    const multiplier = Math.pow(1.8, currentLevel - lastDefinedLevel);
    return {
      food: lastCost.food ? Math.floor(lastCost.food * multiplier) : undefined,
      gold: lastCost.gold ? Math.floor(lastCost.gold * multiplier) : undefined,
      troops: lastCost.troops ? Math.floor(lastCost.troops * multiplier) : undefined,
      time: Math.floor(lastCost.time * Math.pow(1.6, currentLevel - lastDefinedLevel)),
    };
  }

  /** 升级建筑 — 返回结果对象 */
  upgradeBuilding(id: BuildingId): { success: boolean; reason?: string } {
    const state = this.buildings.get(id)!;

    // 检查是否可升级
    if (!this.isBuildingUpgradeAllowed(id)) {
      if (!this.isBuildingUnlocked(id)) {
        return { success: false, reason: '建筑未解锁' };
      }
      if (id !== 'castle' && state.level >= this.buildings.get('castle')!.level) {
        return { success: false, reason: '建筑等级不能超过主城等级' };
      }
      return { success: false, reason: '已达最大等级' };
    }

    // 检查资源
    const cost = this.getUpgradeCost(id);
    if (!cost) return { success: false, reason: '无法获取升级费用' };

    const costResources: Partial<Resources> = {};
    if (cost.food) costResources.food = cost.food;
    if (cost.gold) costResources.gold = cost.gold;
    if (cost.troops) costResources.troops = cost.troops;

    if (!this.canAfford(costResources)) {
      return { success: false, reason: '资源不足' };
    }

    // 扣除资源
    this.consumeBatch(costResources);

    // 设升级状态 — PRD BLD-2: 升级需要等待时间
    this.buildings.set(id, {
      ...state,
      isUpgrading: true,
      upgradeStartTime: Date.now(),
      upgradeDuration: cost.time,
    });

    // 清除缓存
    this._invalidateCache();

    return { success: true };
  }

  /** 完成升级 — level+1，重置升级状态 */
  completeUpgrade(id: BuildingId): boolean {
    const state = this.buildings.get(id)!;
    if (!state.isUpgrading) return false;

    this.buildings.set(id, {
      ...state,
      level: state.level + 1,
      isUpgrading: false,
      upgradeStartTime: 0,
      upgradeDuration: 0,
    });

    // 清除缓存（等级变化影响产出和上限）
    this._invalidateCache();
    return true;
  }

  /** 获取升级进度 0~1 — PRD BLD-2 升级等待进度 */
  getUpgradeProgress(id: BuildingId): number {
    const state = this.buildings.get(id)!;
    if (!state.isUpgrading || state.upgradeDuration <= 0) return 0;

    const elapsed = (Date.now() - state.upgradeStartTime) / 1000;
    return Math.min(1, elapsed / state.upgradeDuration);
  }

  /** 获取升级剩余时间（秒） */
  getUpgradeRemainingTime(id: BuildingId): number {
    const state = this.buildings.get(id)!;
    if (!state.isUpgrading || state.upgradeDuration <= 0) return 0;

    const elapsed = (Date.now() - state.upgradeStartTime) / 1000;
    return Math.max(0, state.upgradeDuration - elapsed);
  }

  // ═════════════════════════════════════════════════════════
  // 游戏主循环
  // ═════════════════════════════════════════════════════════

  /** 游戏tick — 每帧调用，驱动资源自动增长 + 检查升级完成 */
  tick(deltaTime: number): void {
    if (deltaTime <= 0 || !isFinite(deltaTime)) return;
    const dt = Math.min(deltaTime, 1.0);  // 限制最大1秒

    // 1. 检查建筑升级完成 — PRD BLD-2
    for (const id of ALL_BUILDING_IDS) {
      const state = this.buildings.get(id)!;
      if (!state.isUpgrading) continue;

      const elapsed = (Date.now() - state.upgradeStartTime) / 1000;
      if (elapsed >= state.upgradeDuration) {
        this.completeUpgrade(id);
      }
    }

    // 2. 资源产出 — PRD RES-2
    const rate = this.getProductionRate();
    const caps = this._getResourceCaps();

    for (const type of ALL_RESOURCE_TYPES) {
      const cap = caps[type];
      if (this.resources[type] >= cap) continue;  // 已满跳过

      const gain = rate[type] * dt;
      this.resources[type] = Math.min(this.resources[type] + gain, cap);
    }

    this.lastTickTime = Date.now();
  }

  // ═════════════════════════════════════════════════════════
  // 离线收益 — PRD RES-4
  // ═════════════════════════════════════════════════════════

  /** 计算离线收益 */
  calculateOfflineProgress(offlineSeconds: number): Resources {
    const offlineHours = Math.min(offlineSeconds / 3600, MAX_OFFLINE_HOURS);
    if (offlineHours <= 0) return zeroResources();

    // 分段计算有效时间
    let effectiveHours = 0;
    let prevMax = 0;
    let remaining = offlineHours;

    for (const tier of OFFLINE_EFFICIENCY) {
      if (remaining <= 0) break;
      const tierDuration = Math.min(remaining, tier.maxHours - prevMax);
      effectiveHours += tierDuration * tier.efficiency;
      remaining -= tierDuration;
      prevMax = tier.maxHours;
    }

    // 计算各资源收益
    const rate = this.getProductionRate();
    const gain = zeroResources();
    const seconds = effectiveHours * 3600;
    for (const type of ALL_RESOURCE_TYPES) {
      gain[type] = rate[type] * seconds;
    }
    return gain;
  }

  /** 应用离线收益（含上限截断） */
  applyOfflineProgress(offlineSeconds: number): Resources {
    const rawGain = this.calculateOfflineProgress(offlineSeconds);
    const caps = this._getResourceCaps();
    const actual = zeroResources();

    for (const type of ALL_RESOURCE_TYPES) {
      const cap = caps[type];
      const available = isFinite(cap) ? Math.max(0, cap - this.resources[type]) : rawGain[type];
      actual[type] = Math.min(rawGain[type], available);
      this.resources[type] += actual[type];
      if (isFinite(cap)) {
        this.resources[type] = Math.min(this.resources[type], cap);
      }
    }
    return actual;
  }

  // ═════════════════════════════════════════════════════════
  // 存档系统
  // ═════════════════════════════════════════════════════════

  /** 序列化 */
  serialize(): EngineSaveData {
    const buildingsData: EngineSaveData['buildings'] = {};
    this.buildings.forEach((state, id) => {
      buildingsData[id] = {
        level: state.level,
        isUpgrading: state.isUpgrading,
        upgradeStartTime: state.upgradeStartTime,
        upgradeDuration: state.upgradeDuration,
      };
    });
    return {
      version: this.saveVersion,
      resources: cloneResources(this.resources),
      buildings: buildingsData,
      lastTickTime: this.lastTickTime,
    };
  }

  /** 反序列化（带容错） */
  deserialize(data: any): void {
    if (!data || typeof data !== 'object') return;

    // 恢复资源
    if (data.resources && typeof data.resources === 'object') {
      for (const type of ALL_RESOURCE_TYPES) {
        const val = data.resources[type];
        this.resources[type] = (typeof val === 'number' && isFinite(val) && val >= 0)
          ? val : INITIAL_RESOURCES[type];
      }
    } else {
      this.resources = cloneResources(INITIAL_RESOURCES);
    }

    // 恢复建筑状态
    if (data.buildings && typeof data.buildings === 'object') {
      for (const id of ALL_BUILDING_IDS) {
        const raw = data.buildings[id];
        const defaultLevel = (id === 'castle' || id === 'farm') ? 1 : 0;
        const level = (typeof raw === 'number')
          ? ((isFinite(raw) && raw >= 0 && Number.isInteger(raw)) ? raw : defaultLevel)
          : ((raw && typeof raw.level === 'number' && isFinite(raw.level) && raw.level >= 0 && Number.isInteger(raw.level))
            ? raw.level : defaultLevel);
        const isUpgrading = (raw && typeof raw === 'object' && typeof raw.isUpgrading === 'boolean')
          ? raw.isUpgrading : false;
        const upgradeStartTime = (raw && typeof raw === 'object' && typeof raw.upgradeStartTime === 'number' && raw.upgradeStartTime > 0)
          ? raw.upgradeStartTime : 0;
        const upgradeDuration = (raw && typeof raw === 'object' && typeof raw.upgradeDuration === 'number' && raw.upgradeDuration > 0)
          ? raw.upgradeDuration : 0;
        this.buildings.set(id, { id, level, isUpgrading, upgradeStartTime, upgradeDuration });
      }
    } else {
      this._resetBuildings();
    }

    // 恢复时间
    this.lastTickTime = (typeof data.lastTickTime === 'number' && data.lastTickTime > 0)
      ? data.lastTickTime : Date.now();

    this._invalidateCache();
  }

  /** 自动保存到 localStorage */
  autoSave(): void {
    try {
      const data = this.serialize();
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch { /* ignore */ }
  }

  /** 从 localStorage 加载存档 */
  loadSave(): { loaded: boolean; offlineSeconds: number } {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return { loaded: false, offlineSeconds: 0 };

      const data = JSON.parse(raw);
      const savedTime = data.lastTickTime || 0;
      const offlineSeconds = (Date.now() - savedTime) / 1000;

      this.deserialize(data);
      return { loaded: true, offlineSeconds: Math.max(0, offlineSeconds) };
    } catch {
      return { loaded: false, offlineSeconds: 0 };
    }
  }

  /** 重置到初始状态 */
  reset(): void {
    this.resources = cloneResources(INITIAL_RESOURCES);
    this._resetBuildings();
    this.lastTickTime = Date.now();
    this._invalidateCache();
    try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
  }

  /** 获取上次tick时间 */
  getLastTickTime(): number {
    return this.lastTickTime;
  }

  // ═════════════════════════════════════════════════════════
  // 私有方法
  // ═════════════════════════════════════════════════════════

  /** 计算当前产出速率 — PRD RES-2 + BLD-3 */
  private _calculateProductionRate(): Resources {
    const rate = zeroResources();

    // 各建筑产出
    for (const id of ALL_BUILDING_IDS) {
      const state = this.buildings.get(id)!;
      if (state.level <= 0) continue;

      const production = BUILDING_PRODUCTION[id](state.level);
      for (const type of ALL_RESOURCE_TYPES) {
        if (production[type] !== undefined) {
          rate[type] += production[type]!;
        }
      }
    }

    // 主城加成 — PRD BLD-3: 每级+2%
    const castleLevel = this.buildings.get('castle')!.level;
    if (castleLevel > 0) {
      const bonus = 1 + castleLevel * CASTLE_BONUS_PER_LEVEL;
      for (const type of ALL_RESOURCE_TYPES) {
        rate[type] *= bonus;
      }
    }

    return rate;
  }

  /** 计算资源上限 — PRD RES-4 */
  private _getResourceCaps(): Resources {
    if (!this._cachedResourceCaps) {
      this._cachedResourceCaps = {
        food: BASE_RESOURCE_CAPS.food + this.buildings.get('farm')!.level * 200,
        gold: Infinity,
        troops: BASE_RESOURCE_CAPS.troops + this.buildings.get('barracks')!.level * 100,
        destiny: Infinity,
      };
    }
    return this._cachedResourceCaps;
  }

  /** 清除缓存 */
  private _invalidateCache(): void {
    this._cachedProductionRate = null;
    this._cachedResourceCaps = null;
  }

  // ═════════════════════════════════════════════════════════
  // GameContainer 兼容接口（放置游戏不使用Canvas渲染）
  // ═════════════════════════════════════════════════════════

  /** @deprecated 放置游戏不使用Canvas，此方法为GameContainer兼容 */
  setCanvas(_canvas: HTMLCanvasElement): void { /* no-op */ }

  /** @deprecated 放置游戏通过React组件管理状态 */
  on(_event: string, _callback: (...args: any[]) => void): void { /* no-op */ }

  /** @deprecated 放置游戏初始化在React组件中完成 */
  init(): void { /* no-op */ }

  /** @deprecated 放置游戏清理在React组件中完成 */
  destroy(): void { /* no-op */ }

  /** @deprecated 放置游戏不使用键盘输入 */
  handleKeyDown(_key: string): void { /* no-op */ }

  /** @deprecated 放置游戏不使用键盘输入 */
  handleKeyUp(_key: string): void { /* no-op */ }

  /** @deprecated 放置游戏不使用Canvas点击 */
  handleClick(_x: number, _y: number): void { /* no-op */ }
  handleMouseDown(_x: number, _y: number): void { /* no-op */ }
  handleMouseUp(_x: number, _y: number): void { /* no-op */ }
  handleMouseMove(_x: number, _y: number): void { /* no-op */ }
  handleRightClick(_x: number, _y: number): void { /* no-op */ }
  handleDoubleClick(_x: number, _y: number): void { /* no-op */ }

  /** 兼容GameContainer的score属性 */
  get score(): number { return 0; }

  /** 兼容GameContainer的level属性 */
  get level(): number { return this.buildings.get('castle')!.level; }

  /** 兼容GameContainer的elapsedTime属性 */
  get elapsedTime(): number { return 0; }

  /** 兼容GameContainer的getState方法 */
  getState(): EngineSaveData { return this.serialize(); }

  /** @deprecated 放置游戏自动运行 */
  start(): void { /* no-op */ }

  /** @deprecated 放置游戏自动运行 */
  resume(): void { /* no-op */ }

  /** @deprecated 放置游戏始终运行 */
  pause(): void { /* no-op */ }

  /** 重置建筑到初始状态 */
  private _resetBuildings(): void {
    this.buildings = new Map<BuildingId, BuildingState>();
    ALL_BUILDING_IDS.forEach(id => {
      this.buildings.set(id, {
        id,
        level: (id === 'castle' || id === 'farm') ? 1 : 0,
        isUpgrading: false,
        upgradeStartTime: 0,
        upgradeDuration: 0,
      });
    });
  }
}
