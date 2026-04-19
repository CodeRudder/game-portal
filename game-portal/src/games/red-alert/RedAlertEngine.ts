/**
 * 红色警戒 (Red Alert) — 放置类游戏引擎
 *
 * 继承 IdleGameEngine，实现：
 * - 多资源系统（矿石/电力/科技点）
 * - 建筑升级系统（8 个军事建筑）
 * - 兵种解锁与进化系统
 * - 科技树升级系统
 * - 声望重置系统（指挥官勋章）
 * - Canvas 军事风格渲染
 * - 离线收益
 * - 自动存档
 */
import { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { Resource, Upgrade, SaveData } from '@/types/idle';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  ORE_PER_CLICK,
  MEDAL_BONUS_MULTIPLIER,
  PRESTIGE_BASE_MEDALS,
  MIN_PRESTIGE_ORE,
  UNITS,
  BUILDINGS,
  TECHS,
  COLORS,
  BASE_DRAW,
  BUILDING_PANEL,
  RESOURCE_PANEL,
  RESOURCE_IDS,
  BUILDING_IDS,
  type UnitDef,
  type BuildingDef,
  type TechDef,
} from './constants';

/** 兵种状态 */
export interface UnitState {
  id: string;
  unlocked: boolean;
  /** 进化等级 0-5 */
  evolutionLevel: number;
}

/** 科技树状态 */
export interface TechState {
  id: string;
  level: number;
}

/** 游戏统计 */
export interface RedAlertStatistics {
  totalOreEarned: number;
  totalClicks: number;
  totalPowerEarned: number;
  totalTechEarned: number;
  totalPrestigeCount: number;
  totalUnitsUnlocked: number;
  totalEvolutions: number;
  totalTechResearched: number;
}

/** 红色警戒游戏状态 */
export interface RedAlertState {
  [key: string]: unknown;
  resources: Record<string, { amount: number; perSecond: number; unlocked: boolean }>;
  buildings: Record<string, number>;
  units: UnitState[];
  techs: TechState[];
  prestige: { currency: number; count: number };
  statistics: RedAlertStatistics;
  selectedIndex: number;
}

/** 进化费用表（按进化等级） */
const EVOLUTION_COSTS: Record<number, Record<string, number>> = {
  1: { ore: 200, power: 10 },
  2: { ore: 1000, power: 50, tech: 10 },
  3: { ore: 5000, power: 200, tech: 50 },
  4: { ore: 20000, power: 800, tech: 200 },
  5: { ore: 80000, power: 3000, tech: 800 },
};

/** 最大进化等级 */
const MAX_EVOLUTION_LEVEL = 5;

export class RedAlertEngine extends IdleGameEngine {
  // ========== 游戏状态 ==========

  protected _gameId = 'red-alert';

  constructor() {
    super();
    // Override base class `statistics` instance field with a getter/setter,
    // because class fields shadow prototype accessors.
    Object.defineProperty(this, 'statistics', {
      get: () => ({ ...this._stats }) as RedAlertStatistics,
      set: (_val: Record<string, number>) => { /* base class writes are no-ops */ },
      configurable: true,
      enumerable: true,
    });
  }

  /** 兵种状态 */
  private _units: UnitState[] = UNITS.map((u) => ({
    id: u.id,
    unlocked: u.id === 'gi', // 美国大兵初始解锁
    evolutionLevel: 0,
  }));

  /** 科技树状态 */
  private _techs: TechState[] = TECHS.map((t) => ({
    id: t.id,
    level: 0,
  }));

  /** 当前选中的建筑索引 */
  private _selectedIndex: number = 0;

  /** 统计数据 */
  private _stats: RedAlertStatistics = {
    totalOreEarned: 0,
    totalClicks: 0,
    totalPowerEarned: 0,
    totalTechEarned: 0,
    totalPrestigeCount: 0,
    totalUnitsUnlocked: 1,
    totalEvolutions: 0,
    totalTechResearched: 0,
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

  /** 动画计时器 */
  private _animTimer: number = 0;
  /** 雷达扫描角度 */
  private _radarAngle: number = 0;
  /** 建筑呼吸缩放 */
  private _buildingBreathe: number = 0;
  /** 点击缩放效果 */
  private _clickScale: number = 1;
  private _clickAnimTimer: number = 0;
  /** 搜索光束粒子 */
  private _radarParticles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
  }> = [];
  /** 能量脉冲 */
  private _energyPulses: Array<{
    x: number;
    y: number;
    radius: number;
    maxRadius: number;
    life: number;
    maxLife: number;
  }> = [];

  // ========== 公开属性 ==========

  get selectedIndex(): number {
    return this._selectedIndex;
  }

  get units(): UnitState[] {
    return this._units.map((u) => ({ ...u }));
  }

  get techs(): TechState[] {
    return this._techs.map((t) => ({ ...t }));
  }

  get totalOreEarned(): number {
    return this._stats.totalOreEarned;
  }

  get totalClicks(): number {
    return this._stats.totalClicks;
  }

  // ========== 生命周期 ==========

  protected onInit(): void {
    super.onInit();

    // 初始化资源
    this.initializeResources([
      {
        id: RESOURCE_IDS.ORE,
        name: '矿石',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e15,
        unlocked: true,
      },
      {
        id: RESOURCE_IDS.POWER,
        name: '电力',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e12,
        unlocked: false,
      },
      {
        id: RESOURCE_IDS.TECH,
        name: '科技点',
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
        unlocked: b.id === BUILDING_IDS.ORE_REFINERY, // 矿厂初始解锁
        requires: b.requires,
        icon: b.icon,
      }))
    );

    // 重置兵种状态
    this._units = UNITS.map((u) => ({
      id: u.id,
      unlocked: u.id === 'gi',
      evolutionLevel: 0,
    }));

    // 重置科技树状态
    this._techs = TECHS.map((t) => ({
      id: t.id,
      level: 0,
    }));

    // 重置其他状态
    this._selectedIndex = 0;
    this._stats = {
      totalOreEarned: 0,
      totalClicks: 0,
      totalPowerEarned: 0,
      totalTechEarned: 0,
      totalPrestigeCount: 0,
      totalUnitsUnlocked: 1,
      totalEvolutions: 0,
      totalTechResearched: 0,
    };
    this._floatingTexts = [];
    this._animTimer = 0;
    this._radarAngle = 0;
    this._buildingBreathe = 0;
    this._clickScale = 1;
    this._clickAnimTimer = 0;
    this._radarParticles = [];
    this._energyPulses = [];
  }

  protected onUpdate(deltaTime: number): void {
    // 动画
    this._animTimer += deltaTime;
    this._radarAngle = (this._animTimer * 0.003) % (Math.PI * 2);
    this._buildingBreathe = Math.sin(this._animTimer * 0.002) * 2;

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

    // 雷达粒子更新
    this._radarParticles = this._radarParticles.filter((p) => {
      p.life -= deltaTime;
      p.x += p.vx * (deltaTime / 1000);
      p.y += p.vy * (deltaTime / 1000);
      return p.life > 0;
    });

    // 随机产生雷达粒子
    if (Math.random() < 0.03) {
      const angle = Math.random() * Math.PI * 2;
      this._radarParticles.push({
        x: 380 + Math.cos(angle) * 20,
        y: 100 + Math.sin(angle) * 20,
        vx: Math.cos(angle) * 10,
        vy: Math.sin(angle) * 10,
        life: 800 + Math.random() * 600,
        maxLife: 1400,
      });
    }

    // 能量脉冲更新
    this._energyPulses = this._energyPulses.filter((p) => {
      p.life -= deltaTime;
      p.radius += (deltaTime / 1000) * 60;
      return p.life > 0;
    });

    // 随机产生能量脉冲
    if (Math.random() < 0.01) {
      this._energyPulses.push({
        x: 100 + Math.random() * 280,
        y: 160 + Math.random() * 100,
        radius: 0,
        maxRadius: 40,
        life: 1000,
        maxLife: 1000,
      });
    }

    // 统计资源产出
    const ore = this.getResource(RESOURCE_IDS.ORE);
    if (ore && ore.perSecond > 0) {
      this._stats.totalOreEarned += ore.perSecond * (deltaTime / 1000);
    }
    const power = this.getResource(RESOURCE_IDS.POWER);
    if (power && power.perSecond > 0) {
      this._stats.totalPowerEarned += power.perSecond * (deltaTime / 1000);
    }
    const tech = this.getResource(RESOURCE_IDS.TECH);
    if (tech && tech.perSecond > 0) {
      this._stats.totalTechEarned += tech.perSecond * (deltaTime / 1000);
    }

    // 检查建筑解锁条件
    this.checkBuildingUnlocks();
    // 检查资源解锁条件
    this.checkResourceUnlocks();
    // 检查科技解锁条件
    this.checkTechUnlocks();
  }

  // ========== 核心玩法 ==========

  /**
   * 点击获得矿石
   */
  click(): number {
    if (this._status !== 'playing') return 0;

    let gained = ORE_PER_CLICK;

    // 兵种点击加成
    gained *= this.getClickMultiplier();

    // 科技点击加成
    gained *= this.getTechClickMultiplier();

    // 声望加成
    gained *= this.getPrestigeMultiplier();

    gained = Math.floor(gained * 100) / 100;

    this.addResource(RESOURCE_IDS.ORE, gained);
    this._stats.totalOreEarned += gained;
    this._stats.totalClicks++;
    this.addScore(gained);

    // 点击动画
    this._clickScale = 1.15;
    this._clickAnimTimer = 150;

    // 飘字
    const angle = Math.random() * Math.PI * 2;
    const dist = 50 + Math.random() * 30;
    this._floatingTexts.push({
      text: `+${this.formatNumber(gained)}`,
      x: BASE_DRAW.centerX + Math.cos(angle) * dist,
      y: BASE_DRAW.centerY + Math.sin(angle) * dist - 20,
      life: 800,
      maxLife: 800,
      color: COLORS.oreColor,
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
   * 解锁兵种
   */
  unlockUnit(unitId: string): boolean {
    const unitDef = UNITS.find((u) => u.id === unitId);
    if (!unitDef) return false;

    const unitState = this._units.find((u) => u.id === unitId);
    if (!unitState || unitState.unlocked) return false;

    if (!this.hasResource(RESOURCE_IDS.ORE, unitDef.unlockCost)) return false;

    this.spendResource(RESOURCE_IDS.ORE, unitDef.unlockCost);
    unitState.unlocked = true;
    this._stats.totalUnitsUnlocked++;

    // 重新计算产出
    this.recalculateProduction();

    this.emit('unitUnlocked', unitId);
    this.emit('stateChange');
    return true;
  }

  /**
   * 进化兵种
   */
  evolveUnit(unitId: string): boolean {
    const unitState = this._units.find((u) => u.id === unitId);
    if (!unitState || !unitState.unlocked) return false;

    const nextLevel = unitState.evolutionLevel + 1;
    if (nextLevel > MAX_EVOLUTION_LEVEL) return false;

    const cost = this.getEvolutionCost(nextLevel);
    if (!this.canAfford(cost)) return false;

    // 扣除资源
    for (const [resId, amount] of Object.entries(cost)) {
      this.spendResource(resId, amount);
    }

    unitState.evolutionLevel = nextLevel;
    this._stats.totalEvolutions++;

    // 重新计算产出
    this.recalculateProduction();

    this.emit('unitEvolved', unitId, nextLevel);
    this.emit('stateChange');
    return true;
  }

  /**
   * 研究科技
   */
  researchTech(techId: string): boolean {
    const techDef = TECHS.find((t) => t.id === techId);
    if (!techDef) return false;

    const techState = this._techs.find((t) => t.id === techId);
    if (!techState) return false;
    if (techState.level >= techDef.maxLevel) return false;

    // 检查前置科技
    if (techDef.requires) {
      for (const reqId of techDef.requires) {
        const reqTech = this._techs.find((t) => t.id === reqId);
        if (!reqTech || reqTech.level <= 0) return false;
      }
    }

    // 计算费用
    const cost = this.getTechCost(techId);
    if (!this.canAfford(cost)) return false;

    // 扣除资源
    for (const [resId, amount] of Object.entries(cost)) {
      this.spendResource(resId, amount);
    }

    techState.level++;
    this._stats.totalTechResearched++;

    // 重新计算产出
    this.recalculateProduction();

    this.emit('techResearched', techId, techState.level);
    this.emit('stateChange');
    return true;
  }

  /**
   * 获取进化费用
   */
  getEvolutionCost(level: number): Record<string, number> {
    return EVOLUTION_COSTS[level] ? { ...EVOLUTION_COSTS[level] } : {};
  }

  /**
   * 获取兵种进化等级
   */
  getUnitEvolutionLevel(unitId: string): number {
    const unit = this._units.find((u) => u.id === unitId);
    return unit ? unit.evolutionLevel : 0;
  }

  /**
   * 获取科技等级
   */
  getTechLevel(techId: string): number {
    const tech = this._techs.find((t) => t.id === techId);
    return tech ? tech.level : 0;
  }

  /**
   * 获取科技当前费用
   */
  getTechCost(techId: string): Record<string, number> {
    const techDef = TECHS.find((t) => t.id === techId);
    const techState = this._techs.find((t) => t.id === techId);
    if (!techDef || !techState) return {};

    const cost: Record<string, number> = {};
    for (const [resId, base] of Object.entries(techDef.baseCost)) {
      cost[resId] = Math.floor(base * Math.pow(techDef.costMultiplier, techState.level));
    }
    return cost;
  }

  /**
   * 声望重置
   */
  doPrestige(): number {
    if (this._stats.totalOreEarned < MIN_PRESTIGE_ORE) return 0;

    // 计算获得的指挥官勋章
    const medalsGained = Math.floor(
      PRESTIGE_BASE_MEDALS * Math.sqrt(this._stats.totalOreEarned / MIN_PRESTIGE_ORE)
    );

    if (medalsGained <= 0) return 0;

    // 保存声望数据
    const savedPrestige = { ...this.prestige };
    savedPrestige.currency += medalsGained;
    savedPrestige.count++;

    // 保存部分统计
    const savedStats = {
      ...this._stats,
      totalOreEarned: 0,
      totalClicks: 0,
      totalPowerEarned: 0,
      totalTechEarned: 0,
    };

    // 保存兵种进化等级（声望保留进化等级和解锁状态）
    const savedUnitStates = this._units.map((u) => ({
      id: u.id,
      evolutionLevel: u.evolutionLevel,
      unlocked: u.unlocked,
    }));

    // 保存科技等级（声望保留科技等级）
    const savedTechStates = this._techs.map((t) => ({
      id: t.id,
      level: t.level,
    }));

    // 重置
    this.onInit();

    // 恢复声望和统计
    this.prestige = savedPrestige;
    this._stats = savedStats as RedAlertStatistics;
    this._stats.totalPrestigeCount++;

    // 恢复兵种进化等级
    for (const saved of savedUnitStates) {
      const unit = this._units.find((u) => u.id === saved.id);
      if (unit) {
        unit.evolutionLevel = saved.evolutionLevel;
        unit.unlocked = saved.unlocked;
      }
    }

    // 恢复科技等级
    for (const saved of savedTechStates) {
      const tech = this._techs.find((t) => t.id === saved.id);
      if (tech) {
        tech.level = saved.level;
      }
    }

    this.emit('prestige', medalsGained);
    this.emit('stateChange');
    return medalsGained;
  }

  /**
   * 获取声望加成倍率
   */
  getPrestigeMultiplier(): number {
    return 1 + this.prestige.currency * MEDAL_BONUS_MULTIPLIER;
  }

  /**
   * 获取兵种点击加成倍率
   */
  getClickMultiplier(): number {
    let multiplier = 1;
    for (const unit of this._units) {
      if (!unit.unlocked) continue;
      const def = UNITS.find((u) => u.id === unit.id);
      if (!def) continue;
      if (def.bonusType === 'click' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.upgradeMultiplier, unit.evolutionLevel);
        multiplier += bonus;
      }
    }
    return multiplier;
  }

  /**
   * 获取科技点击加成倍率
   */
  getTechClickMultiplier(): number {
    let multiplier = 1;
    for (const tech of this._techs) {
      if (tech.level <= 0) continue;
      const def = TECHS.find((t) => t.id === tech.id);
      if (!def) continue;
      if (def.effectType === 'click_bonus') {
        multiplier += def.effectValue * tech.level;
      }
    }
    return multiplier;
  }

  /**
   * 获取矿石产出加成倍率
   */
  getOreMultiplier(): number {
    let multiplier = 1;
    // 兵种加成
    for (const unit of this._units) {
      if (!unit.unlocked) continue;
      const def = UNITS.find((u) => u.id === unit.id);
      if (!def) continue;
      if (def.bonusType === 'production' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.upgradeMultiplier, unit.evolutionLevel);
        multiplier += bonus;
      }
    }
    // 科技加成
    for (const tech of this._techs) {
      if (tech.level <= 0) continue;
      const def = TECHS.find((t) => t.id === tech.id);
      if (!def) continue;
      if (def.effectType === 'multiply_ore' || def.effectType === 'all_bonus') {
        multiplier += def.effectValue * tech.level;
      }
    }
    // 声望加成
    multiplier *= this.getPrestigeMultiplier();
    return multiplier;
  }

  /**
   * 获取电力产出加成倍率
   */
  getPowerMultiplier(): number {
    let multiplier = 1;
    // 兵种加成
    for (const unit of this._units) {
      if (!unit.unlocked) continue;
      const def = UNITS.find((u) => u.id === unit.id);
      if (!def) continue;
      if (def.bonusType === 'power' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.upgradeMultiplier, unit.evolutionLevel);
        multiplier += bonus;
      }
    }
    // 科技加成
    for (const tech of this._techs) {
      if (tech.level <= 0) continue;
      const def = TECHS.find((t) => t.id === tech.id);
      if (!def) continue;
      if (def.effectType === 'multiply_power' || def.effectType === 'all_bonus') {
        multiplier += def.effectValue * tech.level;
      }
    }
    // 声望加成
    multiplier *= this.getPrestigeMultiplier();
    return multiplier;
  }

  /**
   * 获取科技点产出加成倍率
   */
  getTechMultiplier(): number {
    let multiplier = 1;
    // 兵种加成
    for (const unit of this._units) {
      if (!unit.unlocked) continue;
      const def = UNITS.find((u) => u.id === unit.id);
      if (!def) continue;
      if (def.bonusType === 'tech' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.upgradeMultiplier, unit.evolutionLevel);
        multiplier += bonus;
      }
    }
    // 科技加成
    for (const tech of this._techs) {
      if (tech.level <= 0) continue;
      const def = TECHS.find((t) => t.id === tech.id);
      if (!def) continue;
      if (def.effectType === 'multiply_tech' || def.effectType === 'all_bonus') {
        multiplier += def.effectValue * tech.level;
      }
    }
    // 声望加成
    multiplier *= this.getPrestigeMultiplier();
    return multiplier;
  }

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
   * 获取预览声望勋章数
   */
  getPrestigePreview(): number {
    if (this._stats.totalOreEarned < MIN_PRESTIGE_ORE) return 0;
    return Math.floor(
      PRESTIGE_BASE_MEDALS * Math.sqrt(this._stats.totalOreEarned / MIN_PRESTIGE_ORE)
    );
  }

  /**
   * 检查是否可以声望
   */
  canPrestige(): boolean {
    return this._stats.totalOreEarned >= MIN_PRESTIGE_ORE;
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

    // 基础产出
    for (const building of BUILDINGS) {
      const upgrade = this.upgrades.get(building.id);
      if (!upgrade || upgrade.level <= 0) continue;

      let production = building.baseProduction * upgrade.level;

      // 应用对应加成
      if (building.productionResource === RESOURCE_IDS.ORE) {
        production *= this.getOreMultiplier();
      } else if (building.productionResource === RESOURCE_IDS.POWER) {
        production *= this.getPowerMultiplier();
      } else if (building.productionResource === RESOURCE_IDS.TECH) {
        production *= this.getTechMultiplier();
      }

      const resource = this.resources.get(building.productionResource);
      if (resource) {
        resource.perSecond += production;
      }
    }
  }

  /**
   * 检查建筑解锁条件
   */
  private checkBuildingUnlocks(): void {
    for (const building of BUILDINGS) {
      const upgrade = this.upgrades.get(building.id);
      if (!upgrade || upgrade.unlocked) continue;

      // 检查前置建筑
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
    // 电力：电厂等级 >= 1 时解锁
    const powerPlant = this.upgrades.get(BUILDING_IDS.POWER_PLANT);
    if (powerPlant && powerPlant.level >= 1) {
      const power = this.resources.get(RESOURCE_IDS.POWER);
      if (power && !power.unlocked) {
        power.unlocked = true;
        this.emit('resourceUnlocked', RESOURCE_IDS.POWER);
      }
    }

    // 科技点：科技中心等级 >= 1 时解锁
    const techCenter = this.upgrades.get(BUILDING_IDS.TECH_CENTER);
    if (techCenter && techCenter.level >= 1) {
      const tech = this.resources.get(RESOURCE_IDS.TECH);
      if (tech && !tech.unlocked) {
        tech.unlocked = true;
        this.emit('resourceUnlocked', RESOURCE_IDS.TECH);
      }
    }
  }

  /**
   * 检查科技解锁条件
   */
  private checkTechUnlocks(): void {
    // 科技树解锁不需要特殊条件——只要有前置科技即可
    // 前置科技检查在 researchTech 中完成
  }

  // ========== 渲染 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawRadarParticles(ctx);
    this.drawEnergyPulses(ctx);
    this.drawBase(ctx);
    this.drawFloatingTexts(ctx);
    this.drawResourcePanel(ctx, w);
    this.drawBuildingList(ctx, w, h);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 天空渐变（军事红色风格）
    const skyGradient = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    skyGradient.addColorStop(0, COLORS.skyTop);
    skyGradient.addColorStop(1, COLORS.skyBottom);
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, w, h * 0.5);

    // 地面渐变
    const groundGradient = ctx.createLinearGradient(0, h * 0.45, 0, h);
    groundGradient.addColorStop(0, COLORS.groundLight);
    groundGradient.addColorStop(1, COLORS.groundDark);
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, h * 0.45, w, h * 0.55);

    // 地面纹理（像素风格小石头）
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < 30; i++) {
      const x = ((i * 73 + 17) % w);
      const y = h * 0.45 + ((i * 47 + 23) % (h * 0.55));
      ctx.fillStyle = '#4E342E';
      ctx.fillRect(x, y, 3, 2);
    }
    ctx.globalAlpha = 1;

    // 雷达塔
    this.drawRadarTower(ctx, w);

    // 星星
    ctx.fillStyle = '#FFF8E1';
    for (let i = 0; i < 15; i++) {
      const sx = ((i * 97 + 31) % w);
      const sy = ((i * 43 + 11) % (h * 0.35));
      const size = 1 + (i % 3);
      ctx.globalAlpha = 0.3 + Math.sin(this._animTimer * 0.001 + i) * 0.2;
      ctx.fillRect(sx, sy, size, size);
    }
    ctx.globalAlpha = 1;

    // 远处的小山丘
    ctx.fillStyle = '#3E2723';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.quadraticCurveTo(80, h * 0.38, 160, h * 0.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(200, h * 0.5);
    ctx.quadraticCurveTo(300, h * 0.35, 380, h * 0.5);
    ctx.fill();
  }

  private drawRadarTower(ctx: CanvasRenderingContext2D, w: number): void {
    const rx = w - 80;
    const ry = 60;

    // 塔身
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(rx - 5, ry, 10, 140);

    // 雷达天线底座
    ctx.fillStyle = '#795548';
    ctx.fillRect(rx - 15, ry - 5, 30, 10);

    // 旋转天线
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(this._radarAngle);
    ctx.strokeStyle = COLORS.radarGlow;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-25, 0);
    ctx.lineTo(25, 0);
    ctx.stroke();
    ctx.restore();

    // 雷达光晕
    const radarGlow = ctx.createRadialGradient(rx, ry, 0, rx, ry, 30);
    radarGlow.addColorStop(0, 'rgba(244, 67, 54, 0.15)');
    radarGlow.addColorStop(1, 'rgba(244, 67, 54, 0)');
    ctx.fillStyle = radarGlow;
    ctx.beginPath();
    ctx.arc(rx, ry, 30, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawRadarParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this._radarParticles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.radarGlow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawEnergyPulses(ctx: CanvasRenderingContext2D): void {
    for (const p of this._energyPulses) {
      const alpha = (p.life / p.maxLife) * 0.3;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = COLORS.powerColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawBase(ctx: CanvasRenderingContext2D): void {
    const cx = BASE_DRAW.centerX;
    const cy = BASE_DRAW.centerY + this._buildingBreathe;
    const scale = this._clickScale;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // 基地阴影
    ctx.beginPath();
    ctx.ellipse(4, BASE_DRAW.height * 0.6 + 4, BASE_DRAW.width * 0.6, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.buildingShadow;
    ctx.fill();

    // 主建筑体（五角形风格）
    ctx.fillStyle = '#455A64';
    ctx.beginPath();
    ctx.moveTo(0, -BASE_DRAW.height * 0.5);
    ctx.lineTo(BASE_DRAW.width * 0.5, -BASE_DRAW.height * 0.1);
    ctx.lineTo(BASE_DRAW.width * 0.4, BASE_DRAW.height * 0.5);
    ctx.lineTo(-BASE_DRAW.width * 0.4, BASE_DRAW.height * 0.5);
    ctx.lineTo(-BASE_DRAW.width * 0.5, -BASE_DRAW.height * 0.1);
    ctx.closePath();
    ctx.fill();

    // 建筑高光
    ctx.fillStyle = '#546E7A';
    ctx.beginPath();
    ctx.moveTo(0, -BASE_DRAW.height * 0.5);
    ctx.lineTo(BASE_DRAW.width * 0.5, -BASE_DRAW.height * 0.1);
    ctx.lineTo(0, BASE_DRAW.height * 0.1);
    ctx.lineTo(-BASE_DRAW.width * 0.5, -BASE_DRAW.height * 0.1);
    ctx.closePath();
    ctx.fill();

    // 窗户
    ctx.fillStyle = COLORS.accentBlue;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(-12, -BASE_DRAW.height * 0.2, 8, 6);
    ctx.fillRect(4, -BASE_DRAW.height * 0.2, 8, 6);
    ctx.globalAlpha = 1;

    // 红色警戒标志
    ctx.fillStyle = COLORS.accent;
    ctx.beginPath();
    ctx.arc(0, -BASE_DRAW.height * 0.35, 6, 0, Math.PI * 2);
    ctx.fill();

    // 标志内星
    ctx.fillStyle = '#FFD600';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', 0, -BASE_DRAW.height * 0.34);

    // 兵种进化指示（小星星）
    const unlockedUnit = this._units.find((u) => u.unlocked);
    if (unlockedUnit) {
      const evoLevel = unlockedUnit.evolutionLevel;
      for (let i = 0; i < evoLevel; i++) {
        ctx.fillStyle = COLORS.accent;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★', -15 + i * 10, -BASE_DRAW.height * 0.7);
      }
    }

    ctx.restore();
  }

  private drawFloatingTexts(ctx: CanvasRenderingContext2D): void {
    for (const ft of this._floatingTexts) {
      const alpha = ft.life / ft.maxLife;
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 18px "Segoe UI", sans-serif';
      ctx.fillStyle = ft.color;
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;
  }

  private drawResourcePanel(ctx: CanvasRenderingContext2D, w: number): void {
    const panel = RESOURCE_PANEL;
    const resources = this.getUnlockedResources();

    // 背景条
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.roundRect(ctx, panel.padding, panel.startY, w - panel.padding * 2, resources.length * (panel.itemHeight + panel.itemPadding) + panel.padding, 8);
    ctx.fill();

    let y = panel.startY + panel.padding;
    for (const res of resources) {
      const icon = res.id === RESOURCE_IDS.ORE ? '⛏️' : res.id === RESOURCE_IDS.POWER ? '⚡' : '🔬';
      const color = res.id === RESOURCE_IDS.ORE ? COLORS.oreColor : res.id === RESOURCE_IDS.POWER ? COLORS.powerColor : COLORS.techColor;

      // 图标
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(icon, panel.padding + 8, y + 16);

      // 数量
      ctx.font = 'bold 13px "Segoe UI", monospace';
      ctx.fillStyle = COLORS.textPrimary;
      ctx.fillText(this.formatNumber(res.amount), panel.padding + 30, y + 16);

      // 每秒产出
      if (res.perSecond > 0) {
        ctx.font = '10px "Segoe UI", sans-serif';
        ctx.fillStyle = COLORS.accentGreen;
        ctx.fillText(`+${this.formatNumber(res.perSecond)}/s`, panel.padding + 120, y + 16);
      }

      y += panel.itemHeight + panel.itemPadding;
    }
  }

  private drawBuildingList(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const panel = BUILDING_PANEL;

    // 标题
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textSecondary;
    ctx.textAlign = 'center';
    ctx.fillText('— 建筑 —', w / 2, panel.startY - 8);

    for (let i = 0; i < BUILDINGS.length; i++) {
      const building = BUILDINGS[i];
      const upgrade = this.upgrades.get(building.id);
      if (!upgrade || !upgrade.unlocked) continue;

      const level = upgrade.level;
      const cost = this.getUpgradeCost(building.id);
      const affordable = this.canAfford(cost);
      const selected = i === this._selectedIndex;

      const y = panel.startY + this.getVisibleIndex(i) * (panel.itemHeight + panel.itemPadding);
      const x = panel.itemMarginX;

      // 选中高亮
      if (selected) {
        ctx.fillStyle = COLORS.selectedBg;
        ctx.strokeStyle = COLORS.selectedBorder;
        ctx.lineWidth = 2;
        this.roundRect(ctx, x, y, panel.itemWidth, panel.itemHeight, 6);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = COLORS.panelBg;
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        this.roundRect(ctx, x, y, panel.itemWidth, panel.itemHeight, 6);
        ctx.fill();
        ctx.stroke();
      }

      // 图标
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(building.icon, x + 8, y + 27);

      // 名称 + 等级
      ctx.font = 'bold 12px "Segoe UI", sans-serif';
      ctx.fillStyle = COLORS.textPrimary;
      ctx.fillText(`${building.name} Lv.${level}`, x + 36, y + 18);

      // 产出
      if (level > 0) {
        ctx.font = '10px "Segoe UI", sans-serif';
        ctx.fillStyle = COLORS.textDim;
        ctx.fillText(`产出 +${this.formatNumber(building.baseProduction * level)}/s`, x + 36, y + 34);
      }

      // 费用
      if (level < building.maxLevel) {
        const costStr = Object.entries(cost)
          .map(([id, amount]) => {
            const icon = id === RESOURCE_IDS.ORE ? '⛏️' : id === RESOURCE_IDS.POWER ? '⚡' : '🔬';
            return `${icon}${this.formatNumber(amount)}`;
          })
          .join(' ');
        ctx.font = 'bold 11px "Segoe UI", monospace';
        ctx.textAlign = 'right';
        ctx.fillStyle = affordable ? COLORS.affordable : COLORS.unaffordable;
        ctx.fillText(costStr, x + panel.itemWidth - 8, y + 27);
      } else {
        ctx.font = 'bold 11px "Segoe UI", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = COLORS.accent;
        ctx.fillText('MAX', x + panel.itemWidth - 8, y + 27);
      }
    }

    // 底部提示
    ctx.font = '10px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.textAlign = 'center';
    ctx.fillText('空格 点击 · ↑↓ 选择 · Enter 购买 · E 进化 · T 科技 · P 声望', w / 2, h - 10);
  }

  /** 获取可见索引（跳过未解锁的建筑） */
  private getVisibleIndex(buildingIndex: number): number {
    let visible = 0;
    for (let i = 0; i < buildingIndex; i++) {
      const upgrade = this.upgrades.get(BUILDINGS[i].id);
      if (upgrade && upgrade.unlocked) visible++;
    }
    return visible;
  }

  /** 圆角矩形辅助 */
  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    if (this._status !== 'playing') return;

    switch (key) {
      case ' ':
        this.click();
        break;
      case 'ArrowUp':
        this._selectedIndex = Math.max(0, this._selectedIndex - 1);
        this.emit('stateChange');
        break;
      case 'ArrowDown':
        this._selectedIndex = Math.min(BUILDINGS.length - 1, this._selectedIndex + 1);
        this.emit('stateChange');
        break;
      case 'Enter':
        this.purchaseBuilding(this._selectedIndex);
        break;
      case 'e':
      case 'E':
        // 进化当前选中的兵种（第一个已解锁的）
        {
          const unlocked = this._units.find((u) => u.unlocked);
          if (unlocked) this.evolveUnit(unlocked.id);
        }
        break;
      case 't':
      case 'T':
        // 研究第一个可研究的科技
        {
          const tech = TECHS[0];
          if (tech) this.researchTech(tech.id);
        }
        break;
      case 'p':
      case 'P':
        this.doPrestige();
        break;
    }
  }

  handleKeyUp(_key: string): void {
    // 无需处理
  }

  // ========== 状态序列化 ==========

  getState(): RedAlertState {
    const resources: Record<string, { amount: number; perSecond: number; unlocked: boolean }> = {};
    for (const [id, r] of this.resources) {
      resources[id] = { amount: r.amount, perSecond: r.perSecond, unlocked: r.unlocked };
    }

    const buildings: Record<string, number> = {};
    for (const [id, u] of this.upgrades) {
      if (u.level > 0) buildings[id] = u.level;
    }

    return {
      resources,
      buildings,
      units: this.units,
      techs: this.techs,
      prestige: { ...this.prestige },
      statistics: { ...this._stats },
      selectedIndex: this._selectedIndex,
    };
  }

  /**
   * 从状态恢复
   */
  loadState(state: RedAlertState): void {
    // 恢复资源
    if (state.resources) {
      for (const [id, data] of Object.entries(state.resources)) {
        const resource = this.resources.get(id);
        if (resource) {
          resource.amount = data.amount;
          resource.unlocked = data.unlocked;
        }
      }
    }

    // 恢复建筑等级
    if (state.buildings) {
      for (const [id, level] of Object.entries(state.buildings)) {
        const upgrade = this.upgrades.get(id);
        if (upgrade) {
          upgrade.level = level;
          upgrade.unlocked = true;
        }
      }
    }

    // 恢复兵种
    if (state.units) {
      for (const unitState of state.units) {
        const myUnit = this._units.find((u) => u.id === unitState.id);
        if (myUnit) {
          myUnit.unlocked = unitState.unlocked;
          if (unitState.evolutionLevel !== undefined) {
            myUnit.evolutionLevel = unitState.evolutionLevel;
          }
        }
      }
    }

    // 恢复科技
    if (state.techs) {
      for (const techState of state.techs) {
        const myTech = this._techs.find((t) => t.id === techState.id);
        if (myTech) {
          myTech.level = techState.level;
        }
      }
    }

    // 恢复声望
    if (state.prestige) {
      this.prestige = { ...state.prestige };
    }

    // 恢复统计
    if (state.statistics) {
      this._stats = { ...state.statistics } as RedAlertStatistics;
    }

    // 恢复选中
    if (state.selectedIndex !== undefined) {
      this._selectedIndex = state.selectedIndex;
    }

    // 重新计算产出
    this.recalculateProduction();

    this.emit('stateChange');
  }

  // ========== 存档覆盖 ==========

  save(): SaveData {
    const data = super.save();
    // 附加兵种、科技和统计信息到 settings
    data.settings = {
      units: this._units,
      techs: this._techs,
      stats: this._stats,
      selectedIndex: this._selectedIndex,
    };
    return data;
  }

  load(data: SaveData): void {
    super.load(data);

    // 恢复附加数据
    if (data.settings) {
      const settings = data.settings as any;
      if (settings.units) {
        for (const unitState of settings.units) {
          const myUnit = this._units.find((u) => u.id === unitState.id);
          if (myUnit) {
            myUnit.unlocked = unitState.unlocked;
            if (unitState.evolutionLevel !== undefined) {
              myUnit.evolutionLevel = unitState.evolutionLevel;
            }
          }
        }
      }
      if (settings.techs) {
        for (const techState of settings.techs) {
          const myTech = this._techs.find((t) => t.id === techState.id);
          if (myTech) {
            myTech.level = techState.level;
          }
        }
      }
      if (settings.stats) {
        this._stats = { ...this._stats, ...settings.stats };
      }
      if (settings.selectedIndex !== undefined) {
        this._selectedIndex = settings.selectedIndex;
      }
    }

    this.recalculateProduction();
  }
}
