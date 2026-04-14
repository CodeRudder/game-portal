/**
 * 四大文明·古印度 (Civ India) — 放置类游戏引擎
 *
 * 继承 IdleGameEngine，实现：
 * - 多资源系统（香料/宝石/业力）
 * - 建筑升级系统（香料园、佛塔、恒河灌溉等）
 * - 种姓制度系统：婆罗门 / 刹帝利 / 吠舍 / 首陀罗
 * - 佛法修行系统：冥想 / 布施 / 忍辱 / 精进 / 禅定 / 般若
 * - 声望系统：涅槃重生，获得永久加成
 * - Canvas 印度风格渲染
 * - 离线收益
 * - 自动存档
 */
import { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { Resource, Upgrade, SaveData } from '@/types/idle';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  RESOURCE_IDS,
  SPICE_PER_CLICK,
  NIRVANA_BONUS_MULTIPLIER,
  PRESTIGE_BASE_NIRVANA,
  MIN_PRESTIGE_SPICE,
  CASTES,
  DHARMAS,
  BUILDINGS,
  BUILDING_IDS,
  COLORS,
  STUPA_DRAW,
  BUILDING_PANEL,
  RESOURCE_PANEL,
  EVOLUTION_COSTS,
  MAX_EVOLUTION_LEVEL,
  type CasteDef,
  type DharmaDef,
  type BuildingDef,
} from './constants';

// ========== 类型定义 ==========

/** 种姓状态 */
export interface CasteState {
  id: string;
  unlocked: boolean;
}

/** 佛法修行状态 */
export interface DharmaState {
  id: string;
  unlocked: boolean;
  /** 进化等级 0-5 */
  evolutionLevel: number;
}

/** 游戏统计 */
export interface CivIndiaStatistics {
  totalSpiceEarned: number;
  totalClicks: number;
  totalGemsEarned: number;
  totalKarmaEarned: number;
  totalPrestigeCount: number;
  totalCastesUnlocked: number;
  totalDharmasUnlocked: number;
  totalEvolutions: number;
}

/** 古印度游戏状态 */
export interface CivIndiaState {
  [key: string]: unknown;
  resources: Record<string, { amount: number; perSecond: number; unlocked: boolean }>;
  buildings: Record<string, number>;
  castes: CasteState[];
  dharmas: DharmaState[];
  prestige: { currency: number; count: number };
  statistics: CivIndiaStatistics;
  selectedIndex: number;
}

// ========== 引擎实现 ==========

export class CivIndiaEngine extends IdleGameEngine {
  // ========== 游戏状态 ==========

  protected _gameId = 'civ-india';

  constructor() {
    super();
    // Override base class `statistics` instance field with a getter/setter,
    // because class fields shadow prototype accessors.
    Object.defineProperty(this, 'statistics', {
      get: () => ({ ...this._stats }) as CivIndiaStatistics,
      set: (_val: Record<string, number>) => { /* base class writes are no-ops */ },
      configurable: true,
      enumerable: true,
    });
  }

  /** 种姓状态 */
  private _castes: CasteState[] = CASTES.map((c) => ({
    id: c.id,
    unlocked: c.id === 'sudra', // 首陀罗初始解锁
  }));

  /** 佛法修行状态 */
  private _dharmas: DharmaState[] = DHARMAS.map((d) => ({
    id: d.id,
    unlocked: d.id === 'meditation', // 冥想初始解锁
    evolutionLevel: 0,
  }));

  /** 当前选中的建筑索引 */
  private _selectedIndex: number = 0;

  /** 统计数据 */
  private _stats: CivIndiaStatistics = {
    totalSpiceEarned: 0,
    totalClicks: 0,
    totalGemsEarned: 0,
    totalKarmaEarned: 0,
    totalPrestigeCount: 0,
    totalCastesUnlocked: 1,
    totalDharmasUnlocked: 1,
    totalEvolutions: 0,
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
  /** 太阳光芒旋转角度 */
  private _sunRayAngle: number = 0;
  /** 恒河波纹偏移 */
  private _riverWave: number = 0;
  /** 点击缩放效果 */
  private _clickScale: number = 1;
  private _clickAnimTimer: number = 0;
  /** 莲花花瓣粒子 */
  private _lotusParticles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    rotation: number;
  }> = [];

  // ========== 公开属性 ==========

  get selectedIndex(): number {
    return this._selectedIndex;
  }

  get castes(): CasteState[] {
    return this._castes.map((c) => ({ ...c }));
  }

  get dharmas(): DharmaState[] {
    return this._dharmas.map((d) => ({ ...d }));
  }

  get totalSpiceEarned(): number {
    return this._stats.totalSpiceEarned;
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
        id: RESOURCE_IDS.SPICE,
        name: '香料',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e15,
        unlocked: true,
      },
      {
        id: RESOURCE_IDS.GEM,
        name: '宝石',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e12,
        unlocked: false,
      },
      {
        id: RESOURCE_IDS.KARMA,
        name: '业力',
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
        unlocked: b.id === BUILDING_IDS.SPICE_GARDEN, // 香料园初始解锁
        requires: b.requires,
        icon: b.icon,
      }))
    );

    // 重置私有状态
    this._castes = CASTES.map((c) => ({
      id: c.id,
      unlocked: c.id === 'sudra',
    }));
    this._dharmas = DHARMAS.map((d) => ({
      id: d.id,
      unlocked: d.id === 'meditation',
      evolutionLevel: 0,
    }));
    this._selectedIndex = 0;
    this._stats = {
      totalSpiceEarned: 0,
      totalClicks: 0,
      totalGemsEarned: 0,
      totalKarmaEarned: 0,
      totalPrestigeCount: 0,
      totalCastesUnlocked: 1,
      totalDharmasUnlocked: 1,
      totalEvolutions: 0,
    };
    this._floatingTexts = [];
    this._animTimer = 0;
    this._sunRayAngle = 0;
    this._riverWave = 0;
    this._clickScale = 1;
    this._clickAnimTimer = 0;
    this._lotusParticles = [];
  }

  protected onUpdate(deltaTime: number): void {
    // 动画更新
    this._animTimer += deltaTime;
    this._sunRayAngle += deltaTime * 0.001;
    this._riverWave += deltaTime * 0.003;

    // 点击动画衰减
    if (this._clickAnimTimer > 0) {
      this._clickAnimTimer -= deltaTime;
      if (this._clickAnimTimer <= 0) {
        this._clickScale = 1;
        this._clickAnimTimer = 0;
      } else {
        this._clickScale = 1 + 0.12 * (this._clickAnimTimer / 150);
      }
    }

    // 飘字更新
    this._floatingTexts = this._floatingTexts.filter((ft) => {
      ft.life -= deltaTime;
      ft.y -= deltaTime * 0.04;
      return ft.life > 0;
    });

    // 莲花粒子更新
    this._lotusParticles = this._lotusParticles.filter((p) => {
      p.life -= deltaTime;
      p.x += p.vx * (deltaTime / 1000);
      p.y += p.vy * (deltaTime / 1000);
      p.rotation += deltaTime * 0.002;
      return p.life > 0;
    });

    // 随机产生莲花花瓣粒子
    if (Math.random() < 0.015) {
      this._lotusParticles.push({
        x: 100 + Math.random() * 280,
        y: 280 + Math.random() * 40,
        vx: (Math.random() - 0.5) * 15,
        vy: -10 - Math.random() * 20,
        life: 2000 + Math.random() * 1500,
        maxLife: 3500,
        rotation: Math.random() * Math.PI * 2,
      });
    }

    // 统计资源产出
    const spice = this.getResource(RESOURCE_IDS.SPICE);
    if (spice && spice.perSecond > 0) {
      this._stats.totalSpiceEarned += spice.perSecond * (deltaTime / 1000);
    }
    const gem = this.getResource(RESOURCE_IDS.GEM);
    if (gem && gem.perSecond > 0) {
      this._stats.totalGemsEarned += gem.perSecond * (deltaTime / 1000);
    }
    const karma = this.getResource(RESOURCE_IDS.KARMA);
    if (karma && karma.perSecond > 0) {
      this._stats.totalKarmaEarned += karma.perSecond * (deltaTime / 1000);
    }

    // 检查建筑解锁条件
    this.checkBuildingUnlocks();
    // 检查资源解锁条件
    this.checkResourceUnlocks();
    // 检查种姓解锁条件
    this.checkCasteUnlocks();
    // 检查佛法解锁条件
    this.checkDharmaUnlocks();
  }

  // ========== 核心玩法 ==========

  /**
   * 点击获得香料
   */
  click(): number {
    if (this._status !== 'playing') return 0;

    let gained = SPICE_PER_CLICK;

    // 种姓点击加成
    gained *= this.getClickMultiplier();

    // 声望（涅槃）加成
    gained *= this.getPrestigeMultiplier();

    gained = Math.floor(gained * 100) / 100;

    this.addResource(RESOURCE_IDS.SPICE, gained);
    this._stats.totalSpiceEarned += gained;
    this._stats.totalClicks++;
    this.addScore(gained);

    // 点击动画
    this._clickScale = 1.12;
    this._clickAnimTimer = 150;

    // 飘字
    const angle = Math.random() * Math.PI * 2;
    const dist = 50 + Math.random() * 40;
    this._floatingTexts.push({
      text: `+${this.formatNumber(gained)}`,
      x: STUPA_DRAW.centerX + Math.cos(angle) * dist,
      y: STUPA_DRAW.centerY + Math.sin(angle) * dist - 20,
      life: 800,
      maxLife: 800,
      color: COLORS.spiceColor,
    });

    this.emit('stateChange');
    return gained;
  }

  /**
   * 购买建筑升级
   */
  purchaseBuilding(id: string): boolean {
    const upgrade = this.upgrades.get(id);
    if (!upgrade || !upgrade.unlocked) return false;
    if (upgrade.level >= upgrade.maxLevel) return false;

    // 检查前置建筑
    if (upgrade.requires) {
      for (const reqId of upgrade.requires) {
        const req = this.upgrades.get(reqId);
        if (!req || req.level <= 0) return false;
      }
    }

    return this.purchaseUpgrade(id);
  }

  /**
   * 通过索引购买建筑
   */
  purchaseBuildingByIndex(index: number): boolean {
    if (index < 0 || index >= BUILDINGS.length) return false;
    return this.purchaseBuilding(BUILDINGS[index].id);
  }

  /**
   * 解锁种姓
   */
  unlockCaste(casteId: string): boolean {
    const casteDef = CASTES.find((c) => c.id === casteId);
    if (!casteDef) return false;

    const casteState = this._castes.find((c) => c.id === casteId);
    if (!casteState || casteState.unlocked) return false;

    if (!this.hasResource(RESOURCE_IDS.SPICE, casteDef.unlockCost)) return false;

    this.spendResource(RESOURCE_IDS.SPICE, casteDef.unlockCost);
    casteState.unlocked = true;
    this._stats.totalCastesUnlocked++;

    // 重新计算产出
    this.recalculateProduction();

    this.emit('casteUnlocked', casteId);
    this.emit('stateChange');
    return true;
  }

  /**
   * 解锁佛法修行
   */
  unlockDharma(dharmaId: string): boolean {
    const dharmaDef = DHARMAS.find((d) => d.id === dharmaId);
    if (!dharmaDef) return false;

    const dharmaState = this._dharmas.find((d) => d.id === dharmaId);
    if (!dharmaState || dharmaState.unlocked) return false;

    if (!this.hasResource(RESOURCE_IDS.KARMA, dharmaDef.unlockCost)) return false;

    this.spendResource(RESOURCE_IDS.KARMA, dharmaDef.unlockCost);
    dharmaState.unlocked = true;
    this._stats.totalDharmasUnlocked++;

    // 重新计算产出
    this.recalculateProduction();

    this.emit('dharmaUnlocked', dharmaId);
    this.emit('stateChange');
    return true;
  }

  /**
   * 进化佛法修行
   */
  evolveDharma(dharmaId: string): boolean {
    const dharmaState = this._dharmas.find((d) => d.id === dharmaId);
    if (!dharmaState || !dharmaState.unlocked) return false;

    const nextLevel = dharmaState.evolutionLevel + 1;
    if (nextLevel > MAX_EVOLUTION_LEVEL) return false;

    const cost = this.getEvolutionCost(nextLevel);
    if (!this.canAfford(cost)) return false;

    // 扣除资源
    for (const [resId, amount] of Object.entries(cost)) {
      this.spendResource(resId, amount);
    }

    dharmaState.evolutionLevel = nextLevel;
    this._stats.totalEvolutions++;

    // 重新计算产出
    this.recalculateProduction();

    this.emit('dharmaEvolved', dharmaId, nextLevel);
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
   * 获取佛法修行进化等级
   */
  getDharmaEvolutionLevel(dharmaId: string): number {
    const dharma = this._dharmas.find((d) => d.id === dharmaId);
    return dharma ? dharma.evolutionLevel : 0;
  }

  // ========== 声望系统 ==========

  /**
   * 声望重置（涅槃重生）
   */
  doPrestige(): number {
    const spice = this.getResource(RESOURCE_IDS.SPICE);
    if (!spice || this._stats.totalSpiceEarned < MIN_PRESTIGE_SPICE) return 0;

    // 计算获得的涅槃点数
    const nirvanaGained = Math.floor(
      PRESTIGE_BASE_NIRVANA * Math.sqrt(this._stats.totalSpiceEarned / MIN_PRESTIGE_SPICE)
    );

    if (nirvanaGained <= 0) return 0;

    // 保存涅槃点数
    const savedPrestige = { ...this.prestige };
    savedPrestige.currency += nirvanaGained;
    savedPrestige.count++;

    // 保存部分统计（重置资源相关统计，保留声望统计）
    const savedStats: CivIndiaStatistics = {
      ...this._stats,
      totalSpiceEarned: 0,
      totalClicks: 0,
      totalGemsEarned: 0,
      totalKarmaEarned: 0,
    };

    // 保存种姓解锁状态（声望保留种姓）
    const savedCastes = this._castes.map((c) => ({
      id: c.id,
      unlocked: c.unlocked,
    }));

    // 保存佛法修行进化等级（声望保留进化等级）
    const savedDharmas = this._dharmas.map((d) => ({
      id: d.id,
      evolutionLevel: d.evolutionLevel,
      unlocked: d.unlocked,
    }));

    // 重置
    this.onInit();

    // 恢复声望和部分统计
    this.prestige = savedPrestige;
    this._stats = savedStats;

    // 恢复种姓
    for (const saved of savedCastes) {
      const caste = this._castes.find((c) => c.id === saved.id);
      if (caste) {
        caste.unlocked = saved.unlocked;
      }
    }

    // 恢复佛法修行
    for (const saved of savedDharmas) {
      const dharma = this._dharmas.find((d) => d.id === saved.id);
      if (dharma) {
        dharma.evolutionLevel = saved.evolutionLevel;
        dharma.unlocked = saved.unlocked;
      }
    }

    this.emit('prestige', nirvanaGained);
    this.emit('stateChange');
    return nirvanaGained;
  }

  /**
   * 获取声望（涅槃）加成倍率
   */
  getPrestigeMultiplier(): number {
    return 1 + this.prestige.currency * NIRVANA_BONUS_MULTIPLIER;
  }

  // ========== 加成计算 ==========

  /**
   * 获取点击加成倍率（来自种姓和佛法修行）
   */
  getClickMultiplier(): number {
    let multiplier = 1;

    // 种姓加成
    for (const caste of this._castes) {
      if (!caste.unlocked) continue;
      const def = CASTES.find((c) => c.id === caste.id);
      if (!def) continue;
      if (def.bonusType === 'click' || def.bonusType === 'all') {
        multiplier += def.bonusValue;
      }
    }

    // 佛法修行加成
    for (const dharma of this._dharmas) {
      if (!dharma.unlocked) continue;
      const def = DHARMAS.find((d) => d.id === dharma.id);
      if (!def) continue;
      if (def.bonusType === 'click' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.evolutionMultiplier, dharma.evolutionLevel);
        multiplier += bonus;
      }
    }

    return multiplier;
  }

  /**
   * 获取生产加成倍率
   */
  getProductionMultiplier(): number {
    let multiplier = 1;

    // 种姓加成
    for (const caste of this._castes) {
      if (!caste.unlocked) continue;
      const def = CASTES.find((c) => c.id === caste.id);
      if (!def) continue;
      if (def.bonusType === 'production' || def.bonusType === 'all') {
        multiplier += def.bonusValue;
      }
    }

    // 佛法修行加成
    for (const dharma of this._dharmas) {
      if (!dharma.unlocked) continue;
      const def = DHARMAS.find((d) => d.id === dharma.id);
      if (!def) continue;
      if (def.bonusType === 'production' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.evolutionMultiplier, dharma.evolutionLevel);
        multiplier += bonus;
      }
    }

    // 声望加成
    multiplier *= this.getPrestigeMultiplier();
    return multiplier;
  }

  /**
   * 获取宝石加成倍率
   */
  getGemMultiplier(): number {
    let multiplier = 1;

    // 种姓加成
    for (const caste of this._castes) {
      if (!caste.unlocked) continue;
      const def = CASTES.find((c) => c.id === caste.id);
      if (!def) continue;
      if (def.bonusType === 'gem' || def.bonusType === 'all') {
        multiplier += def.bonusValue;
      }
    }

    // 佛法修行加成
    for (const dharma of this._dharmas) {
      if (!dharma.unlocked) continue;
      const def = DHARMAS.find((d) => d.id === dharma.id);
      if (!def) continue;
      if (def.bonusType === 'gem' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.evolutionMultiplier, dharma.evolutionLevel);
        multiplier += bonus;
      }
    }

    // 声望加成
    multiplier *= this.getPrestigeMultiplier();
    return multiplier;
  }

  /**
   * 获取业力加成倍率
   */
  getKarmaMultiplier(): number {
    let multiplier = 1;

    // 种姓加成
    for (const caste of this._castes) {
      if (!caste.unlocked) continue;
      const def = CASTES.find((c) => c.id === caste.id);
      if (!def) continue;
      if (def.bonusType === 'karma' || def.bonusType === 'all') {
        multiplier += def.bonusValue;
      }
    }

    // 佛法修行加成
    for (const dharma of this._dharmas) {
      if (!dharma.unlocked) continue;
      const def = DHARMAS.find((d) => d.id === dharma.id);
      if (!def) continue;
      if (def.bonusType === 'karma' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.evolutionMultiplier, dharma.evolutionLevel);
        multiplier += bonus;
      }
    }

    // 声望加成
    multiplier *= this.getPrestigeMultiplier();
    return multiplier;
  }

  // ========== 建筑信息 ==========

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
   * 获取预览声望涅槃点数
   */
  getPrestigePreview(): number {
    if (this._stats.totalSpiceEarned < MIN_PRESTIGE_SPICE) return 0;
    return Math.floor(
      PRESTIGE_BASE_NIRVANA * Math.sqrt(this._stats.totalSpiceEarned / MIN_PRESTIGE_SPICE)
    );
  }

  /**
   * 检查是否可以声望
   */
  canPrestige(): boolean {
    return this._stats.totalSpiceEarned >= MIN_PRESTIGE_SPICE;
  }

  // ========== 内部方法 ==========

  /**
   * 重写产出计算，加入种姓和佛法修行加成
   */
  protected recalculateProduction(): void {
    // 先重置
    for (const r of this.resources.values()) {
      r.perSecond = 0;
    }

    // 基础产出 + 加成
    for (const building of BUILDINGS) {
      const upgrade = this.upgrades.get(building.id);
      if (!upgrade || upgrade.level <= 0) continue;

      let production = building.baseProduction * upgrade.level;

      // 应用对应资源加成
      if (building.productionResource === RESOURCE_IDS.SPICE) {
        production *= this.getProductionMultiplier();
      } else if (building.productionResource === RESOURCE_IDS.GEM) {
        production *= this.getGemMultiplier();
      } else if (building.productionResource === RESOURCE_IDS.KARMA) {
        production *= this.getKarmaMultiplier();
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
    // 宝石：宝石矿场等级 >= 1 时解锁
    const gemMine = this.upgrades.get(BUILDING_IDS.GEM_MINE);
    if (gemMine && gemMine.level >= 1) {
      const gem = this.resources.get(RESOURCE_IDS.GEM);
      if (gem && !gem.unlocked) {
        gem.unlocked = true;
        this.emit('resourceUnlocked', RESOURCE_IDS.GEM);
      }
    }

    // 业力：瑜伽修行所等级 >= 1 时解锁
    const yogaStudio = this.upgrades.get(BUILDING_IDS.YOGA_STUDIO);
    if (yogaStudio && yogaStudio.level >= 1) {
      const karma = this.resources.get(RESOURCE_IDS.KARMA);
      if (karma && !karma.unlocked) {
        karma.unlocked = true;
        this.emit('resourceUnlocked', RESOURCE_IDS.KARMA);
      }
    }
  }

  /**
   * 检查种姓解锁条件（自动提示，不自动购买）
   */
  private checkCasteUnlocks(): void {
    for (const caste of CASTES) {
      if (caste.unlockCost <= 0) continue; // 初始种姓跳过
      const spice = this.getResource(RESOURCE_IDS.SPICE);
      if (spice && spice.amount >= caste.unlockCost) {
        const state = this._castes.find((c) => c.id === caste.id);
        if (state && !state.unlocked) {
          this.emit('casteAvailable', caste.id);
        }
      }
    }
  }

  /**
   * 检查佛法修行解锁条件（自动提示，不自动购买）
   */
  private checkDharmaUnlocks(): void {
    for (const dharma of DHARMAS) {
      if (dharma.unlockCost <= 0) continue; // 初始修行跳过
      const karma = this.getResource(RESOURCE_IDS.KARMA);
      if (karma && karma.amount >= dharma.unlockCost) {
        const state = this._dharmas.find((d) => d.id === dharma.id);
        if (state && !state.unlocked) {
          this.emit('dharmaAvailable', dharma.id);
        }
      }
    }
  }

  // ========== 渲染 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawLotusParticles(ctx);
    this.drawStupa(ctx);
    this.drawFloatingTexts(ctx);
    this.drawResourcePanel(ctx, w);
    this.drawBuildingList(ctx, w, h);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 天空渐变（印度金色/橙色色调）
    const skyGradient = ctx.createLinearGradient(0, 0, 0, h * 0.45);
    skyGradient.addColorStop(0, COLORS.skyTop);
    skyGradient.addColorStop(1, COLORS.skyBottom);
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, w, h * 0.45);

    // 太阳
    const sunX = 60;
    const sunY = 55;
    // 光晕
    ctx.beginPath();
    ctx.arc(sunX, sunY, 35, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.sunGlow;
    ctx.fill();
    // 光芒
    ctx.save();
    ctx.translate(sunX, sunY);
    ctx.rotate(this._sunRayAngle);
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6);
      ctx.beginPath();
      ctx.moveTo(0, 22);
      ctx.lineTo(-3, 38);
      ctx.lineTo(3, 38);
      ctx.closePath();
      ctx.fillStyle = COLORS.sunColor;
      ctx.globalAlpha = 0.6;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // 太阳本体
    ctx.beginPath();
    ctx.arc(sunX, sunY, 18, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.sunColor;
    ctx.fill();

    // 地面渐变
    const groundGradient = ctx.createLinearGradient(0, h * 0.45, 0, h);
    groundGradient.addColorStop(0, COLORS.groundLight);
    groundGradient.addColorStop(1, COLORS.groundDark);
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, h * 0.45, w, h * 0.55);

    // 恒河（波纹效果）
    const riverY = h * 0.5;
    const riverH = 30;
    ctx.fillStyle = COLORS.riverColor;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, riverY, w, riverH);
    // 波纹高光
    ctx.strokeStyle = COLORS.riverHighlight;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      const waveOffset = this._riverWave + i * 80;
      for (let x = 0; x < w; x += 4) {
        const y = riverY + 5 + i * 5 + Math.sin((x + waveOffset) * 0.03) * 3;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 地面纹理
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 25; i++) {
      const x = ((i * 79 + 13) % w);
      const y = h * 0.55 + ((i * 53 + 7) % (h * 0.4));
      ctx.fillStyle = '#4A148C';
      ctx.fillRect(x, y, 4, 2);
    }
    ctx.globalAlpha = 1;

    // 远处的小山丘
    ctx.fillStyle = '#311B92';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.48);
    ctx.quadraticCurveTo(100, h * 0.38, 200, h * 0.48);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(280, h * 0.48);
    ctx.quadraticCurveTo(380, h * 0.35, w, h * 0.48);
    ctx.fill();
  }

  private drawStupa(ctx: CanvasRenderingContext2D): void {
    const cx = STUPA_DRAW.centerX;
    const cy = STUPA_DRAW.centerY;
    const scale = this._clickScale;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // 底座阴影
    ctx.beginPath();
    ctx.ellipse(3, STUPA_DRAW.bodyHeight * 0.6 + 3, STUPA_DRAW.bodyWidth * 0.7, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fill();

    // 底座（方形基座）
    const bw = STUPA_DRAW.bodyWidth;
    const bh = STUPA_DRAW.bodyHeight;
    ctx.fillStyle = COLORS.stupaColor;
    ctx.fillRect(-bw * 0.5, -bh * 0.2, bw, bh * 0.8);

    // 底座装饰线
    ctx.strokeStyle = '#FFB300';
    ctx.lineWidth = 2;
    ctx.strokeRect(-bw * 0.5, -bh * 0.2, bw, bh * 0.8);

    // 穹顶（半球）
    const dr = STUPA_DRAW.domeRadius;
    ctx.beginPath();
    ctx.arc(0, -bh * 0.2, dr, Math.PI, 0);
    ctx.fillStyle = '#FFE082';
    ctx.fill();
    ctx.strokeStyle = '#FFB300';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 尖塔
    const sh = STUPA_DRAW.spireHeight;
    ctx.beginPath();
    ctx.moveTo(-4, -bh * 0.2 - dr);
    ctx.lineTo(0, -bh * 0.2 - dr - sh);
    ctx.lineTo(4, -bh * 0.2 - dr);
    ctx.closePath();
    ctx.fillStyle = COLORS.accent;
    ctx.fill();

    // 尖塔装饰圆环
    for (let i = 1; i <= 3; i++) {
      const ringY = -bh * 0.2 - dr - sh * (i / 4);
      ctx.beginPath();
      ctx.ellipse(0, ringY, 6 - i, 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.accent;
      ctx.fill();
    }

    // 佛塔顶部宝珠
    ctx.beginPath();
    ctx.arc(0, -bh * 0.2 - dr - sh - 5, 5, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.accent;
    ctx.fill();

    // 底座上的莲花装饰
    ctx.fillStyle = COLORS.lotusColor;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.ellipse(i * 10, bh * 0.55, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 种姓等级指示（小星星）
    const unlockedCastes = this._castes.filter((c) => c.unlocked).length;
    for (let i = 0; i < unlockedCastes - 1; i++) {
      ctx.fillStyle = COLORS.accent;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✦', -15 + i * 10, -bh * 0.2 - dr - sh - 15);
    }

    ctx.restore();
  }

  private drawLotusParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this._lotusParticles) {
      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);

      // 花瓣形状
      ctx.fillStyle = COLORS.lotusColor;
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.rotate((Math.PI * 2 / 5) * i);
        ctx.beginPath();
        ctx.ellipse(0, -4, 2.5, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      // 花蕊
      ctx.beginPath();
      ctx.arc(0, 0, 2, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.accent;
      ctx.fill();

      ctx.restore();
    }
    ctx.globalAlpha = 1;
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
    this.roundRect(
      ctx,
      panel.padding,
      panel.startY,
      w - panel.padding * 2,
      resources.length * (panel.itemHeight + panel.itemPadding) + panel.padding,
      8
    );
    ctx.fill();

    let y = panel.startY + panel.padding;
    for (const res of resources) {
      const icon =
        res.id === RESOURCE_IDS.SPICE ? '🌿' :
        res.id === RESOURCE_IDS.GEM ? '💎' :
        '☸️';

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
            const icon =
              id === RESOURCE_IDS.SPICE ? '🌿' :
              id === RESOURCE_IDS.GEM ? '💎' :
              '☸️';
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
    ctx.fillText('空格 点击 · ↑↓ 选择 · Enter 购买 · E 进化 · P 涅槃', w / 2, h - 10);
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
        this.purchaseBuildingByIndex(this._selectedIndex);
        break;
      case 'e':
      case 'E':
        // 进化当前选中的佛法修行（第一个已解锁的）
        {
          const unlocked = this._dharmas.find((d) => d.unlocked);
          if (unlocked) this.evolveDharma(unlocked.id);
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

  getState(): CivIndiaState {
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
      castes: this.castes,
      dharmas: this.dharmas,
      prestige: { ...this.prestige },
      statistics: { ...this._stats },
      selectedIndex: this._selectedIndex,
    };
  }

  /**
   * 从状态恢复
   */
  loadState(state: CivIndiaState): void {
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

    // 恢复种姓
    if (state.castes) {
      for (const casteState of state.castes) {
        const myCaste = this._castes.find((c) => c.id === casteState.id);
        if (myCaste) {
          myCaste.unlocked = casteState.unlocked;
        }
      }
    }

    // 恢复佛法修行
    if (state.dharmas) {
      for (const dharmaState of state.dharmas) {
        const myDharma = this._dharmas.find((d) => d.id === dharmaState.id);
        if (myDharma) {
          myDharma.unlocked = dharmaState.unlocked;
          if (dharmaState.evolutionLevel !== undefined) {
            myDharma.evolutionLevel = dharmaState.evolutionLevel;
          }
        }
      }
    }

    // 恢复声望
    if (state.prestige) {
      this.prestige = { ...state.prestige };
    }

    // 恢复统计
    if (state.statistics) {
      this._stats = { ...state.statistics } as CivIndiaStatistics;
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
    // 附加种姓、佛法修行和统计信息到 settings
    data.settings = {
      castes: this._castes,
      dharmas: this._dharmas,
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

      // 恢复种姓
      if (settings.castes) {
        for (const casteState of settings.castes) {
          const myCaste = this._castes.find((c) => c.id === casteState.id);
          if (myCaste) {
            myCaste.unlocked = casteState.unlocked;
          }
        }
      }

      // 恢复佛法修行
      if (settings.dharmas) {
        for (const dharmaState of settings.dharmas) {
          const myDharma = this._dharmas.find((d) => d.id === dharmaState.id);
          if (myDharma) {
            myDharma.unlocked = dharmaState.unlocked;
            if (dharmaState.evolutionLevel !== undefined) {
              myDharma.evolutionLevel = dharmaState.evolutionLevel;
            }
          }
        }
      }

      // 恢复统计
      if (settings.stats) {
        this._stats = { ...this._stats, ...settings.stats };
      }

      // 恢复选中
      if (settings.selectedIndex !== undefined) {
        this._selectedIndex = settings.selectedIndex;
      }
    }

    this.recalculateProduction();
  }
}
