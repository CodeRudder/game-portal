/**
 * 全面战争 (Total War) — 放置类游戏引擎
 *
 * 继承 IdleGameEngine，实现：
 * - 三资源系统（金币/铁矿石/兵力）
 * - 8种帝国建筑升级系统
 * - 6种兵种解锁与升级
 * - 8块领土征服系统
 * - 声望重置系统（荣耀点）
 * - Canvas 中世纪战争风格渲染
 * - 离线收益
 * - 自动存档
 */
import { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { Resource, Upgrade, SaveData } from '@/types/idle';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GOLD_PER_CLICK,
  PRESTIGE_BONUS_MULTIPLIER,
  PRESTIGE_BASE_GLORY,
  MIN_PRESTIGE_GOLD,
  TROOP_TYPES,
  TERRITORIES,
  BUILDINGS,
  COLORS,
  CASTLE_DRAW,
  BUILDING_PANEL,
  RESOURCE_PANEL,
  BUILDING_IDS,
  RESOURCE_IDS,
  type TroopTypeDef,
  type TerritoryDef,
  type BuildingDef,
} from './constants';

/** 兵种状态 */
export interface TroopState {
  id: string;
  unlocked: boolean;
  /** 升级等级 0-5 */
  upgradeLevel: number;
  /** 训练数量 */
  count: number;
}

/** 领土状态 */
export interface TerritoryState {
  id: string;
  conquered: boolean;
}

/** 游戏统计 */
export interface TotalWarStatistics {
  totalGoldEarned: number;
  totalClicks: number;
  totalIronEarned: number;
  totalTroopsTrained: number;
  totalPrestigeCount: number;
  totalTerritoriesConquered: number;
  totalTroopUpgrades: number;
  totalBattlesWon: number;
}

/** 全面战争游戏状态 */
export interface TotalWarState {
  [key: string]: unknown;
  resources: Record<string, { amount: number; perSecond: number; unlocked: boolean }>;
  buildings: Record<string, number>;
  troops: TroopState[];
  territories: TerritoryState[];
  prestige: { currency: number; count: number };
  statistics: TotalWarStatistics;
  selectedIndex: number;
}

/** 兵种升级费用表（按升级等级） */
const TROOP_UPGRADE_COSTS: Record<number, Record<string, number>> = {
  1: { gold: 100, iron: 50 },
  2: { gold: 500, iron: 200 },
  3: { gold: 2000, iron: 800 },
  4: { gold: 8000, iron: 3000 },
  5: { gold: 30000, iron: 10000 },
};

/** 最大兵种升级等级 */
const MAX_TROOP_UPGRADE_LEVEL = 5;

export class TotalWarEngine extends IdleGameEngine {
  // ========== 游戏状态 ==========

  protected _gameId = 'total-war';

  constructor() {
    super();
    Object.defineProperty(this, 'statistics', {
      get: () => ({ ...this._stats }) as TotalWarStatistics,
      set: (_val: Record<string, number>) => { /* base class writes are no-ops */ },
      configurable: true,
      enumerable: true,
    });
  }

  /** 兵种状态 */
  private _troops: TroopState[] = TROOP_TYPES.map((t) => ({
    id: t.id,
    unlocked: false,
    upgradeLevel: 0,
    count: 0,
  }));

  /** 领土状态 */
  private _territories: TerritoryState[] = TERRITORIES.map((t) => ({
    id: t.id,
    conquered: false,
  }));

  /** 当前选中的建筑索引 */
  private _selectedIndex: number = 0;

  /** 统计数据 */
  private _stats: TotalWarStatistics = {
    totalGoldEarned: 0,
    totalClicks: 0,
    totalIronEarned: 0,
    totalTroopsTrained: 0,
    totalPrestigeCount: 0,
    totalTerritoriesConquered: 0,
    totalTroopUpgrades: 0,
    totalBattlesWon: 0,
  };

  /** 飘字效果列表 */
  private _floatingTexts: Array<{
    text: string;
    x: number;
    y: number;
    life: number;
    maxLife: number;
    color: string;
  }> = [];

  /** 城堡旗帜动画 */
  private _flagAnimTimer: number = 0;
  private _flagWave: number = 0;
  /** 火焰粒子 */
  private _fireParticles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
  }> = [];
  /** 城堡呼吸缩放 */
  private _castleBreathe: number = 0;
  /** 点击缩放效果 */
  private _clickScale: number = 1;
  private _clickAnimTimer: number = 0;
  /** 战斗动画 */
  private _battleAnim: { active: boolean; timer: number; territoryId: string; success: boolean } = {
    active: false,
    timer: 0,
    territoryId: '',
    success: false,
  };

  // ========== 公开属性 ==========

  get selectedIndex(): number {
    return this._selectedIndex;
  }

  get troops(): TroopState[] {
    return this._troops.map((t) => ({ ...t }));
  }

  get territories(): TerritoryState[] {
    return this._territories.map((t) => ({ ...t }));
  }

  get totalGoldEarned(): number {
    return this._stats.totalGoldEarned;
  }

  get totalClicks(): number {
    return this._stats.totalClicks;
  }

  get totalBattlesWon(): number {
    return this._stats.totalBattlesWon;
  }

  // ========== 生命周期 ==========

  protected onInit(): void {
    super.onInit();

    // 初始化资源
    this.initializeResources([
      {
        id: 'gold',
        name: '金币',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e15,
        unlocked: true,
      },
      {
        id: 'iron',
        name: '铁矿石',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e12,
        unlocked: false,
      },
      {
        id: 'troop',
        name: '兵力',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e9,
        unlocked: false,
      },
    ]);

    // 初始化建筑（作为升级）
    this.initializeUpgrades(
      BUILDINGS.map((b) => ({
        id: b.id,
        name: b.name,
        description: `产出 ${b.productionResource}`,
        baseCost: { ...b.baseCost },
        costMultiplier: b.costMultiplier,
        level: 0,
        maxLevel: b.maxLevel,
        effect: {
          type: 'add_production',
          target: b.productionResource,
          value: b.baseProduction,
        },
        unlocked: b.id === 'gold_mine',
        requires: b.requires,
        icon: b.icon,
      }))
    );

    // 重置兵种
    this._troops = TROOP_TYPES.map((t) => ({
      id: t.id,
      unlocked: false,
      upgradeLevel: 0,
      count: 0,
    }));

    // 重置领土
    this._territories = TERRITORIES.map((t) => ({
      id: t.id,
      conquered: false,
    }));

    // 重置状态
    this._selectedIndex = 0;
    this._stats = {
      totalGoldEarned: 0,
      totalClicks: 0,
      totalIronEarned: 0,
      totalTroopsTrained: 0,
      totalPrestigeCount: 0,
      totalTerritoriesConquered: 0,
      totalTroopUpgrades: 0,
      totalBattlesWon: 0,
    };
    this._floatingTexts = [];
    this._flagAnimTimer = 0;
    this._flagWave = 0;
    this._castleBreathe = 0;
    this._clickScale = 1;
    this._clickAnimTimer = 0;
    this._fireParticles = [];
    this._battleAnim = { active: false, timer: 0, territoryId: '', success: false };
  }

  protected onUpdate(deltaTime: number): void {
    // 旗帜动画
    this._flagAnimTimer += deltaTime;
    this._flagWave = Math.sin(this._flagAnimTimer * 0.005) * 0.3;

    // 城堡呼吸
    this._castleBreathe = Math.sin(this._flagAnimTimer * 0.002) * 2;

    // 点击动画衰减
    if (this._clickAnimTimer > 0) {
      this._clickAnimTimer -= deltaTime;
      if (this._clickAnimTimer <= 0) {
        this._clickScale = 1;
        this._clickAnimTimer = 0;
      } else {
        this._clickScale = 1 + 0.15 * (this._clickAnimTimer / 150);
      }
    }

    // 飘字更新
    this._floatingTexts = this._floatingTexts.filter((ft) => {
      ft.life -= deltaTime;
      ft.y -= deltaTime * 0.04;
      return ft.life > 0;
    });

    // 火焰粒子更新
    this._fireParticles = this._fireParticles.filter((p) => {
      p.life -= deltaTime;
      p.x += p.vx * (deltaTime / 1000);
      p.y += p.vy * (deltaTime / 1000);
      p.vy -= 20 * (deltaTime / 1000);
      return p.life > 0;
    });

    // 随机产生火焰粒子
    if (Math.random() < 0.03) {
      this._fireParticles.push({
        x: CASTLE_DRAW.centerX - 5 + Math.random() * 10,
        y: CASTLE_DRAW.centerY - CASTLE_DRAW.height * 0.4,
        vx: (Math.random() - 0.5) * 15,
        vy: -15 - Math.random() * 20,
        life: 800 + Math.random() * 600,
        maxLife: 1400,
      });
    }

    // 战斗动画
    if (this._battleAnim.active) {
      this._battleAnim.timer -= deltaTime;
      if (this._battleAnim.timer <= 0) {
        this._battleAnim.active = false;
      }
    }

    // 统计资源产出
    const gold = this.getResource('gold');
    if (gold && gold.perSecond > 0) {
      this._stats.totalGoldEarned += gold.perSecond * (deltaTime / 1000);
    }
    const iron = this.getResource('iron');
    if (iron && iron.perSecond > 0) {
      this._stats.totalIronEarned += iron.perSecond * (deltaTime / 1000);
    }

    // 检查建筑解锁条件
    this.checkBuildingUnlocks();
    // 检查资源解锁条件
    this.checkResourceUnlocks();
    // 检查兵种解锁条件
    this.checkTroopUnlocks();
  }

  // ========== 核心玩法 ==========

  /**
   * 点击获得金币
   */
  click(): number {
    if (this._status !== 'playing') return 0;

    let gained = GOLD_PER_CLICK;

    // 兵种加成
    gained *= this.getClickMultiplier();

    // 声望加成
    gained *= this.getPrestigeMultiplier();

    gained = Math.floor(gained * 100) / 100;

    this.addResource('gold', gained);
    this._stats.totalGoldEarned += gained;
    this._stats.totalClicks++;
    this.addScore(gained);

    // 点击动画
    this._clickScale = 1.15;
    this._clickAnimTimer = 150;

    // 飘字
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 40;
    this._floatingTexts.push({
      text: `+${this.formatNumber(gained)}`,
      x: CASTLE_DRAW.centerX + Math.cos(angle) * dist,
      y: CASTLE_DRAW.centerY + Math.sin(angle) * dist - 30,
      life: 800,
      maxLife: 800,
      color: COLORS.accent,
    });

    this.emit('stateChange');
    return gained;
  }

  /**
   * 购买建筑升级
   */
  purchaseBuilding(index: number): boolean {
    if (index < 0 || index >= BUILDINGS.length) return false;

    const building = BUILDINGS[index];
    const upgradeId = building.id;
    const upgrade = this.upgrades.get(upgradeId);

    if (!upgrade || !upgrade.unlocked) return false;
    if (upgrade.level >= upgrade.maxLevel) return false;

    // 检查前置
    if (upgrade.requires) {
      for (const reqId of upgrade.requires) {
        const req = this.upgrades.get(reqId);
        if (!req || req.level <= 0) return false;
      }
    }

    const cost = this.getUpgradeCost(upgradeId);
    if (!this.canAfford(cost)) return false;

    // 扣除资源
    for (const [resId, amount] of Object.entries(cost)) {
      this.spendResource(resId, amount);
    }

    upgrade.level++;
    this.recalculateProduction();
    this.emit('upgradePurchased', upgradeId, upgrade.level);
    this.emit('stateChange');
    return true;
  }

  /**
   * 训练兵种
   */
  trainTroop(troopId: string): boolean {
    const troopDef = TROOP_TYPES.find((t) => t.id === troopId);
    if (!troopDef) return false;

    const troopState = this._troops.find((t) => t.id === troopId);
    if (!troopState || !troopState.unlocked) return false;

    // 检查费用
    const cost = this.getTroopTrainCost(troopId);
    if (!this.canAfford(cost)) return false;

    // 扣除资源
    for (const [resId, amount] of Object.entries(cost)) {
      this.spendResource(resId, amount);
    }

    troopState.count++;
    this._stats.totalTroopsTrained++;

    this.emit('troopTrained', troopId, troopState.count);
    this.emit('stateChange');
    return true;
  }

  /**
   * 获取兵种训练费用
   */
  getTroopTrainCost(troopId: string): Record<string, number> {
    const troopDef = TROOP_TYPES.find((t) => t.id === troopId);
    if (!troopDef) return {};

    const troopState = this._troops.find((t) => t.id === troopId);
    const level = troopState ? troopState.upgradeLevel : 0;

    // 训练费用随升级等级略微增加
    const cost: Record<string, number> = {};
    for (const [resId, base] of Object.entries(troopDef.cost)) {
      cost[resId] = Math.floor(base * Math.pow(1.05, level));
    }
    return cost;
  }

  /**
   * 升级兵种
   */
  upgradeTroop(troopId: string): boolean {
    const troopState = this._troops.find((t) => t.id === troopId);
    if (!troopState || !troopState.unlocked) return false;

    const nextLevel = troopState.upgradeLevel + 1;
    if (nextLevel > MAX_TROOP_UPGRADE_LEVEL) return false;

    const cost = TROOP_UPGRADE_COSTS[nextLevel];
    if (!cost || !this.canAfford(cost)) return false;

    // 扣除资源
    for (const [resId, amount] of Object.entries(cost)) {
      this.spendResource(resId, amount);
    }

    troopState.upgradeLevel = nextLevel;
    this._stats.totalTroopUpgrades++;

    this.emit('troopUpgraded', troopId, nextLevel);
    this.emit('stateChange');
    return true;
  }

  /**
   * 获取兵种升级费用
   */
  getTroopUpgradeCost(troopId: string): Record<string, number> {
    const troopState = this._troops.find((t) => t.id === troopId);
    if (!troopState) return {};
    const nextLevel = troopState.upgradeLevel + 1;
    return TROOP_UPGRADE_COSTS[nextLevel] ? { ...TROOP_UPGRADE_COSTS[nextLevel] } : {};
  }

  /**
   * 获取兵种升级等级
   */
  getTroopUpgradeLevel(troopId: string): number {
    const troop = this._troops.find((t) => t.id === troopId);
    return troop ? troop.upgradeLevel : 0;
  }

  /**
   * 获取兵种数量
   */
  getTroopCount(troopId: string): number {
    const troop = this._troops.find((t) => t.id === troopId);
    return troop ? troop.count : 0;
  }

  /**
   * 计算总战斗力
   */
  getTotalPower(): number {
    let totalPower = 0;
    for (const troopState of this._troops) {
      if (!troopState.unlocked || troopState.count <= 0) continue;
      const def = TROOP_TYPES.find((t) => t.id === troopState.id);
      if (!def) continue;

      const levelBonus = Math.pow(def.upgradeMultiplier, troopState.upgradeLevel);
      const power = (def.attack + def.defense) * troopState.count * levelBonus;
      totalPower += power;
    }
    return Math.floor(totalPower);
  }

  /**
   * 征服领土
   */
  conquerTerritory(territoryId: string): boolean {
    if (this._status !== 'playing') return false;

    const territoryDef = TERRITORIES.find((t) => t.id === territoryId);
    if (!territoryDef) return false;

    const territoryState = this._territories.find((t) => t.id === territoryId);
    if (!territoryState || territoryState.conquered) return false;

    // 检查前置领土（除第一块外，需要征服前一块）
    const territoryIndex = TERRITORIES.findIndex((t) => t.id === territoryId);
    if (territoryIndex > 0) {
      const prevTerritory = this._territories[territoryIndex - 1];
      if (!prevTerritory.conquered) return false;
    }

    // 检查战斗力
    const totalPower = this.getTotalPower();
    if (totalPower < territoryDef.requiredPower) return false;

    // 征服成功
    territoryState.conquered = true;
    this._stats.totalTerritoriesConquered++;
    this._stats.totalBattlesWon++;

    // 发放奖励
    if (territoryDef.goldReward > 0) {
      // 一次性兵力奖励
      this.addResource('troop', territoryDef.troopReward);
    }

    // 战斗动画
    this._battleAnim = {
      active: true,
      timer: 1000,
      territoryId,
      success: true,
    };

    // 重新计算产出（领土加成）
    this.recalculateProduction();

    this.emit('territoryConquered', territoryId);
    this.emit('stateChange');
    return true;
  }

  /**
   * 检查是否可以征服领土
   */
  canConquerTerritory(territoryId: string): boolean {
    const territoryDef = TERRITORIES.find((t) => t.id === territoryId);
    if (!territoryDef) return false;

    const territoryState = this._territories.find((t) => t.id === territoryId);
    if (!territoryState || territoryState.conquered) return false;

    const territoryIndex = TERRITORIES.findIndex((t) => t.id === territoryId);
    if (territoryIndex > 0) {
      const prevTerritory = this._territories[territoryIndex - 1];
      if (!prevTerritory.conquered) return false;
    }

    return this.getTotalPower() >= territoryDef.requiredPower;
  }

  /**
   * 获取已征服领土数量
   */
  getConqueredCount(): number {
    return this._territories.filter((t) => t.conquered).length;
  }

  /**
   * 获取领土征服状态
   */
  isTerritoryConquered(territoryId: string): boolean {
    const territory = this._territories.find((t) => t.id === territoryId);
    return territory ? territory.conquered : false;
  }

  // ========== 声望系统 ==========

  /**
   * 声望重置
   */
  doPrestige(): number {
    if (this._stats.totalGoldEarned < MIN_PRESTIGE_GOLD) return 0;

    // 计算获得的荣耀点
    const gloryGained = Math.floor(
      PRESTIGE_BASE_GLORY * Math.sqrt(this._stats.totalGoldEarned / MIN_PRESTIGE_GOLD)
    );

    if (gloryGained <= 0) return 0;

    // 保存荣耀点
    const savedPrestige = { ...this.prestige };
    savedPrestige.currency += gloryGained;
    savedPrestige.count++;

    // 保存统计（部分重置）
    const savedStats: TotalWarStatistics = {
      ...this._stats,
      totalGoldEarned: 0,
      totalClicks: 0,
      totalIronEarned: 0,
      totalTroopsTrained: 0,
    };
    savedStats.totalPrestigeCount++;

    // 保存兵种升级等级（声望保留）
    const savedTroopUpgrades = this._troops.map((t) => ({
      id: t.id,
      upgradeLevel: t.upgradeLevel,
      unlocked: t.unlocked,
    }));

    // 保存领土状态
    const savedTerritories = this._territories.map((t) => ({
      id: t.id,
      conquered: t.conquered,
    }));

    // 重置
    this.onInit();

    // 恢复声望
    this.prestige = savedPrestige;

    // 恢复统计
    this._stats = savedStats;

    // 恢复兵种升级等级
    for (const saved of savedTroopUpgrades) {
      const troop = this._troops.find((t) => t.id === saved.id);
      if (troop) {
        troop.upgradeLevel = saved.upgradeLevel;
        troop.unlocked = saved.unlocked;
      }
    }

    // 恢复领土状态
    for (const saved of savedTerritories) {
      const territory = this._territories.find((t) => t.id === saved.id);
      if (territory) {
        territory.conquered = saved.conquered;
      }
    }

    this.emit('prestige', gloryGained);
    this.emit('stateChange');
    return gloryGained;
  }

  /**
   * 获取声望加成倍率
   */
  getPrestigeMultiplier(): number {
    return 1 + this.prestige.currency * PRESTIGE_BONUS_MULTIPLIER;
  }

  /**
   * 获取预览声望荣耀点数
   */
  getPrestigePreview(): number {
    if (this._stats.totalGoldEarned < MIN_PRESTIGE_GOLD) return 0;
    return Math.floor(
      PRESTIGE_BASE_GLORY * Math.sqrt(this._stats.totalGoldEarned / MIN_PRESTIGE_GOLD)
    );
  }

  /**
   * 检查是否可以声望
   */
  canPrestige(): boolean {
    return this._stats.totalGoldEarned >= MIN_PRESTIGE_GOLD;
  }

  // ========== 加成计算 ==========

  /**
   * 获取点击加成倍率
   */
  getClickMultiplier(): number {
    let multiplier = 1;
    for (const troop of this._troops) {
      if (!troop.unlocked || troop.count <= 0) continue;
      const def = TROOP_TYPES.find((t) => t.id === troop.id);
      if (!def) continue;
      // 民兵和圣骑士提供点击加成
      if (troop.id === 'militia' || troop.id === 'knight') {
        let bonus = 0.05 * troop.count;
        bonus *= Math.pow(def.upgradeMultiplier, troop.upgradeLevel);
        multiplier += bonus;
      }
    }
    return multiplier;
  }

  /**
   * 获取生产加成倍率（金币）
   */
  getGoldMultiplier(): number {
    let multiplier = 1;
    // 领土加成
    for (const territory of this._territories) {
      if (!territory.conquered) continue;
      const def = TERRITORIES.find((t) => t.id === territory.id);
      if (def) {
        // 每块领土增加 5% 金币产出
        multiplier += 0.05;
      }
    }
    // 声望加成
    multiplier *= this.getPrestigeMultiplier();
    return multiplier;
  }

  /**
   * 获取铁矿石加成倍率
   */
  getIronMultiplier(): number {
    let multiplier = 1;
    for (const territory of this._territories) {
      if (!territory.conquered) continue;
      const def = TERRITORIES.find((t) => t.id === territory.id);
      if (def) {
        multiplier += 0.05;
      }
    }
    multiplier *= this.getPrestigeMultiplier();
    return multiplier;
  }

  /**
   * 获取兵力加成倍率
   */
  getTroopMultiplier(): number {
    let multiplier = 1;
    for (const territory of this._territories) {
      if (!territory.conquered) continue;
      const def = TERRITORIES.find((t) => t.id === territory.id);
      if (def) {
        multiplier += 0.08;
      }
    }
    multiplier *= this.getPrestigeMultiplier();
    return multiplier;
  }

  // ========== 建筑相关 ==========

  /**
   * 获取建筑当前费用
   */
  getBuildingCost(index: number): Record<string, number> {
    if (index < 0 || index >= BUILDINGS.length) return {};
    return this.getUpgradeCost(BUILDINGS[index].id);
  }

  /**
   * 获取建筑等级
   */
  getBuildingLevel(index: number): number {
    if (index < 0 || index >= BUILDINGS.length) return 0;
    const upgrade = this.upgrades.get(BUILDINGS[index].id);
    return upgrade ? upgrade.level : 0;
  }

  /**
   * 选择建筑
   */
  selectBuilding(index: number): void {
    if (index >= 0 && index < BUILDINGS.length) {
      this._selectedIndex = index;
    }
  }

  // ========== 内部方法 ==========

  /**
   * 重写产出计算，加入加成
   */
  protected recalculateProduction(): void {
    // 先重置
    for (const r of this.resources.values()) {
      r.perSecond = 0;
    }

    // 建筑基础产出
    for (const building of BUILDINGS) {
      const upgrade = this.upgrades.get(building.id);
      if (!upgrade || upgrade.level <= 0) continue;

      let production = building.baseProduction * upgrade.level;

      // 应用对应加成
      if (building.productionResource === 'gold') {
        production *= this.getGoldMultiplier();
      } else if (building.productionResource === 'iron') {
        production *= this.getIronMultiplier();
      } else if (building.productionResource === 'troop') {
        production *= this.getTroopMultiplier();
      }

      const resource = this.resources.get(building.productionResource);
      if (resource) {
        resource.perSecond += production;
      }
    }

    // 领土额外产出
    for (const territory of this._territories) {
      if (!territory.conquered) continue;
      const def = TERRITORIES.find((t) => t.id === territory.id);
      if (!def) continue;

      const goldRes = this.resources.get('gold');
      if (goldRes) goldRes.perSecond += def.goldReward * this.getPrestigeMultiplier();

      const ironRes = this.resources.get('iron');
      if (ironRes) ironRes.perSecond += def.ironReward * this.getPrestigeMultiplier();
    }
  }

  /**
   * 检查建筑解锁条件
   */
  private checkBuildingUnlocks(): void {
    for (const building of BUILDINGS) {
      const upgrade = this.upgrades.get(building.id);
      if (!upgrade || upgrade.unlocked) continue;

      if (building.requires) {
        const allReqsMet = building.requires.every((reqId) => {
          const req = this.upgrades.get(reqId);
          return req && req.level > 0;
        });
        if (allReqsMet) {
          upgrade.unlocked = true;
        }
      }
    }
  }

  /**
   * 检查资源解锁条件
   */
  private checkResourceUnlocks(): void {
    // 铁矿石：金矿场 >= 3 时解锁
    const goldMine = this.upgrades.get('gold_mine');
    if (goldMine && goldMine.level >= 3) {
      const iron = this.resources.get('iron');
      if (iron && !iron.unlocked) {
        iron.unlocked = true;
        this.emit('resourceUnlocked', 'iron');
      }
    }

    // 兵力：兵营 >= 1 时解锁
    const barracks = this.upgrades.get('barracks');
    if (barracks && barracks.level >= 1) {
      const troop = this.resources.get('troop');
      if (troop && !troop.unlocked) {
        troop.unlocked = true;
        this.emit('resourceUnlocked', 'troop');
      }
    }
  }

  /**
   * 检查兵种解锁条件
   */
  private checkTroopUnlocks(): void {
    for (const troopDef of TROOP_TYPES) {
      const troopState = this._troops.find((t) => t.id === troopDef.id);
      if (!troopState || troopState.unlocked) continue;

      const building = this.upgrades.get(troopDef.requiredBuilding);
      if (building && building.level >= troopDef.requiredLevel) {
        troopState.unlocked = true;
        this.emit('troopUnlocked', troopDef.id);
      }
    }
  }

  // ========== 渲染 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawFireParticles(ctx);
    this.drawCastle(ctx);
    this.drawFloatingTexts(ctx);
    this.drawResourcePanel(ctx, w);
    this.drawBuildingList(ctx, w, h);
    this.drawBattleAnim(ctx, w, h);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 天空渐变（深蓝夜空）
    const skyGradient = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    skyGradient.addColorStop(0, COLORS.skyTop);
    skyGradient.addColorStop(1, COLORS.skyBottom);
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, w, h * 0.5);

    // 星星
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < 40; i++) {
      const x = ((i * 127 + 31) % w);
      const y = ((i * 73 + 17) % (h * 0.4));
      const size = (i % 3 === 0) ? 2 : 1;
      ctx.globalAlpha = 0.3 + (i % 5) * 0.15;
      ctx.fillRect(x, y, size, size);
    }
    ctx.globalAlpha = 1;

    // 地面渐变
    const groundGradient = ctx.createLinearGradient(0, h * 0.45, 0, h);
    groundGradient.addColorStop(0, COLORS.groundLight);
    groundGradient.addColorStop(1, COLORS.groundDark);
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, h * 0.45, w, h * 0.55);

    // 地面纹理
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 25; i++) {
      const x = ((i * 97 + 41) % w);
      const y = h * 0.45 + ((i * 67 + 29) % (h * 0.55));
      ctx.fillStyle = '#4E342E';
      ctx.fillRect(x, y, 4, 2);
    }
    ctx.globalAlpha = 1;

    // 月亮
    ctx.beginPath();
    ctx.arc(60, 50, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF8E1';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(60, 50, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 248, 225, 0.12)';
    ctx.fill();

    // 远处山丘
    ctx.fillStyle = '#37474F';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.quadraticCurveTo(100, h * 0.38, 200, h * 0.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(250, h * 0.5);
    ctx.quadraticCurveTo(350, h * 0.36, 480, h * 0.5);
    ctx.fill();
  }

  private drawCastle(ctx: CanvasRenderingContext2D): void {
    const cx = CASTLE_DRAW.centerX;
    const cy = CASTLE_DRAW.centerY + this._castleBreathe;
    const scale = this._clickScale;
    const w = CASTLE_DRAW.width;
    const h = CASTLE_DRAW.height;
    const tw = CASTLE_DRAW.towerWidth;
    const th = CASTLE_DRAW.towerHeight;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // 阴影
    ctx.beginPath();
    ctx.ellipse(0, h * 0.35, w * 0.6, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.shadowColor;
    ctx.fill();

    // 主墙体
    ctx.fillStyle = '#546E7A';
    ctx.fillRect(-w * 0.35, -h * 0.1, w * 0.7, h * 0.45);

    // 城垛
    ctx.fillStyle = '#455A64';
    const crenelW = 8;
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(-w * 0.35 + i * (w * 0.7 / 6), -h * 0.18, crenelW, h * 0.08);
    }

    // 左塔
    ctx.fillStyle = '#37474F';
    ctx.fillRect(-w * 0.45, -h * 0.35, tw, th);
    // 左塔尖
    ctx.beginPath();
    ctx.moveTo(-w * 0.45 - 3, -h * 0.35);
    ctx.lineTo(-w * 0.45 + tw / 2, -h * 0.5);
    ctx.lineTo(-w * 0.45 + tw + 3, -h * 0.35);
    ctx.fillStyle = '#B71C1C';
    ctx.fill();

    // 右塔
    ctx.fillStyle = '#37474F';
    ctx.fillRect(w * 0.45 - tw, -h * 0.35, tw, th);
    // 右塔尖
    ctx.beginPath();
    ctx.moveTo(w * 0.45 - tw - 3, -h * 0.35);
    ctx.lineTo(w * 0.45 - tw / 2, -h * 0.5);
    ctx.lineTo(w * 0.45 + 3, -h * 0.35);
    ctx.fillStyle = '#B71C1C';
    ctx.fill();

    // 大门
    ctx.beginPath();
    ctx.moveTo(-12, h * 0.35);
    ctx.lineTo(-12, h * 0.15);
    ctx.arc(0, h * 0.15, 12, Math.PI, 0);
    ctx.lineTo(12, h * 0.35);
    ctx.fillStyle = '#263238';
    ctx.fill();

    // 旗帜（左塔）
    ctx.save();
    ctx.translate(-w * 0.45 + tw / 2, -h * 0.5);
    // 旗杆
    ctx.fillStyle = '#795548';
    ctx.fillRect(-1, 0, 2, -CASTLE_DRAW.flagHeight);
    // 旗帜
    ctx.beginPath();
    ctx.moveTo(0, -CASTLE_DRAW.flagHeight);
    ctx.quadraticCurveTo(10, -CASTLE_DRAW.flagHeight + 5 + Math.sin(this._flagWave * 3) * 3, 18, -CASTLE_DRAW.flagHeight + 3);
    ctx.lineTo(18, -CASTLE_DRAW.flagHeight + 15);
    ctx.quadraticCurveTo(10, -CASTLE_DRAW.flagHeight + 12 + Math.sin(this._flagWave * 3 + 1) * 2, 0, -CASTLE_DRAW.flagHeight + 15);
    ctx.fillStyle = COLORS.bannerRed;
    ctx.fill();
    ctx.restore();

    // 窗户灯光
    ctx.fillStyle = '#FFD600';
    ctx.globalAlpha = 0.6 + Math.sin(this._flagAnimTimer * 0.003) * 0.2;
    ctx.fillRect(-w * 0.2, -h * 0.02, 6, 8);
    ctx.fillRect(w * 0.12, -h * 0.02, 6, 8);
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  private drawFireParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this._fireParticles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.fireColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawFloatingTexts(ctx: CanvasRenderingContext2D): void {
    for (const ft of this._floatingTexts) {
      const alpha = ft.life / ft.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ft.color;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;
  }

  private drawResourcePanel(ctx: CanvasRenderingContext2D, w: number): void {
    const { startY, itemHeight, padding } = RESOURCE_PANEL;
    const panelW = w - padding * 2;
    const panelH = itemHeight * 3 + padding * 2;

    // 面板背景
    ctx.fillStyle = COLORS.panelBg;
    ctx.fillRect(padding, startY, panelW, panelH);
    ctx.strokeStyle = COLORS.panelBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(padding, startY, panelW, panelH);

    const resources = [
      { id: 'gold', name: '💰 金币', color: COLORS.goldColor },
      { id: 'iron', name: '🔩 铁矿', color: COLORS.ironColor },
      { id: 'troop', name: '⚔️ 兵力', color: COLORS.troopColor },
    ];

    for (let i = 0; i < resources.length; i++) {
      const res = this.resources.get(resources[i].id);
      const y = startY + padding + i * itemHeight;
      const amount = res ? this.formatNumber(res.amount) : '0';
      const perSec = res && res.perSecond > 0 ? ` (+${this.formatNumber(res.perSecond)}/s)` : '';

      ctx.fillStyle = resources[i].color;
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(resources[i].name, padding + 8, y + 16);
      ctx.textAlign = 'right';
      ctx.fillText(`${amount}${perSec}`, padding + panelW - 8, y + 16);
    }
  }

  private drawBuildingList(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const { startY, itemHeight, itemPadding, itemMarginX, itemWidth } = BUILDING_PANEL;

    // 标题
    ctx.fillStyle = COLORS.textPrimary;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏰 帝国建筑', w / 2, startY - 8);

    for (let i = 0; i < BUILDINGS.length; i++) {
      const building = BUILDINGS[i];
      const upgrade = this.upgrades.get(building.id);
      const y = startY + i * (itemHeight + itemPadding);

      if (y + itemHeight > h) break;

      const isSelected = i === this._selectedIndex;
      const isUnlocked = upgrade?.unlocked ?? false;

      // 背景
      ctx.fillStyle = isSelected ? COLORS.selectedBg : COLORS.panelBg;
      ctx.fillRect(itemMarginX, y, itemWidth, itemHeight);
      ctx.strokeStyle = isSelected ? COLORS.selectedBorder : COLORS.panelBorder;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeRect(itemMarginX, y, itemWidth, itemHeight);

      // 图标和名称
      ctx.fillStyle = isUnlocked ? COLORS.textPrimary : COLORS.textDim;
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${building.icon} ${building.name}`, itemMarginX + 8, y + 16);

      // 等级
      if (upgrade && upgrade.level > 0) {
        ctx.textAlign = 'right';
        ctx.fillStyle = COLORS.accent;
        ctx.fillText(`Lv.${upgrade.level}`, itemMarginX + itemWidth - 8, y + 16);
      }

      // 费用
      if (isUnlocked && upgrade && upgrade.level < upgrade.maxLevel) {
        const cost = this.getUpgradeCost(building.id);
        const canAfford = this.canAfford(cost);
        ctx.fillStyle = canAfford ? COLORS.affordable : COLORS.unaffordable;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        const costStr = Object.entries(cost)
          .map(([id, amt]) => `${id === 'gold' ? '💰' : id === 'iron' ? '🔩' : '⚔️'}${this.formatNumber(amt)}`)
          .join(' ');
        ctx.fillText(costStr, itemMarginX + 8, y + 32);
      } else if (!isUnlocked) {
        ctx.fillStyle = COLORS.textDim;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('🔒 未解锁', itemMarginX + 8, y + 32);
      }
    }
  }

  private drawBattleAnim(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this._battleAnim.active) return;

    const alpha = Math.min(1, this._battleAnim.timer / 500);
    ctx.globalAlpha = alpha;

    // 战斗闪光
    ctx.fillStyle = 'rgba(255, 214, 0, 0.3)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = COLORS.textPrimary;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚔️ 征服成功！', w / 2, h / 2);

    ctx.globalAlpha = 1;
  }

  // ========== 存档扩展 ==========

  save(): SaveData {
    const data = super.save();

    // 追加兵种和领土数据
    const extendedData = {
      ...data,
      troops: this._troops.map((t) => ({
        id: t.id,
        unlocked: t.unlocked,
        upgradeLevel: t.upgradeLevel,
        count: t.count,
      })),
      territories: this._territories.map((t) => ({
        id: t.id,
        conquered: t.conquered,
      })),
    };

    return extendedData;
  }

  load(data: SaveData & { troops?: TroopState[]; territories?: TerritoryState[] }): void {
    super.load(data);

    // 恢复兵种
    if (data.troops) {
      for (const saved of data.troops) {
        const troop = this._troops.find((t) => t.id === saved.id);
        if (troop) {
          troop.unlocked = saved.unlocked;
          troop.upgradeLevel = saved.upgradeLevel;
          troop.count = saved.count;
        }
      }
    }

    // 恢复领土
    if (data.territories) {
      for (const saved of data.territories) {
        const territory = this._territories.find((t) => t.id === saved.id);
        if (territory) {
          territory.conquered = saved.conquered;
        }
      }
    }

    this.recalculateProduction();
  }
}
