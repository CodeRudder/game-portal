/**
 * 英雄无敌 (Heroes Might) — 放置类游戏引擎
 *
 * 继承 IdleGameEngine，实现：
 * - 多资源系统（金币/宝石/魔法水晶）
 * - 建筑升级系统（8种城堡建筑）
 * - 英雄招募与进化系统（6种英雄）
 * - 魔法系统（消耗水晶施放增益魔法）
 * - 声望重置系统（荣耀勋章）
 * - Canvas 奇幻中世纪风格渲染
 * - 离线收益
 * - 自动存档
 */
import { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { Resource, Upgrade, SaveData } from '@/types/idle';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GOLD_PER_CLICK,
  HONOR_BONUS_MULTIPLIER,
  PRESTIGE_BASE_HONOR,
  MIN_PRESTIGE_GOLD,
  HEROES,
  BUILDINGS,
  SPELLS,
  EVOLUTION_COSTS,
  MAX_EVOLUTION_LEVEL,
  COLORS,
  CASTLE_DRAW,
  RESOURCE_PANEL,
  BUILDING_PANEL,
  type HeroDef,
  type BuildingDef,
  type SpellDef,
} from './constants';

/** 英雄状态 */
export interface HeroState {
  id: string;
  unlocked: boolean;
  /** 进化等级 0-5 */
  evolutionLevel: number;
}

/** 活跃魔法效果 */
export interface ActiveSpell {
  spellId: string;
  remainingTime: number;
  totalTime: number;
}

/** 魔法冷却 */
export interface SpellCooldown {
  spellId: string;
  remainingTime: number;
}

/** 游戏统计 */
export interface HeroesMightStatistics {
  totalGoldEarned: number;
  totalClicks: number;
  totalGemsEarned: number;
  totalCrystalsEarned: number;
  totalPrestigeCount: number;
  totalHeroesUnlocked: number;
  totalEvolutions: number;
  totalSpellsCast: number;
}

/** 英雄无敌游戏状态 */
export interface HeroesMightState {
  [key: string]: unknown;
  resources: Record<string, { amount: number; perSecond: number; unlocked: boolean }>;
  buildings: Record<string, number>;
  heroes: HeroState[];
  spells: ActiveSpell[];
  spellCooldowns: SpellCooldown[];
  prestige: { currency: number; count: number };
  statistics: HeroesMightStatistics;
  selectedIndex: number;
}

export class HeroesMightEngine extends IdleGameEngine {
  // ========== 游戏状态 ==========

  protected _gameId = 'heroes-might';

  constructor() {
    super();
    // Override base class `statistics` instance field with a getter/setter,
    // because class fields shadow prototype accessors.
    Object.defineProperty(this, 'statistics', {
      get: () => ({ ...this._stats }) as HeroesMightStatistics,
      set: (_val: Record<string, number>) => { /* base class writes are no-ops */ },
      configurable: true,
      enumerable: true,
    });
  }

  /** 英雄状态 */
  private _heroes: HeroState[] = HEROES.map((h) => ({
    id: h.id,
    unlocked: h.id === 'knight', // 骑士初始解锁
    evolutionLevel: 0,
  }));

  /** 当前选中的建筑索引 */
  private _selectedIndex: number = 0;

  /** 统计数据 */
  private _stats: HeroesMightStatistics = {
    totalGoldEarned: 0,
    totalClicks: 0,
    totalGemsEarned: 0,
    totalCrystalsEarned: 0,
    totalPrestigeCount: 0,
    totalHeroesUnlocked: 1,
    totalEvolutions: 0,
    totalSpellsCast: 0,
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

  /** 城堡动画计时器 */
  private _castleAnimTimer: number = 0;
  /** 旗帜飘动角度 */
  private _flagAngle: number = 0;
  /** 火把闪烁 */
  private _torchFlicker: number = 0;
  /** 点击缩放效果 */
  private _clickScale: number = 1;
  private _clickAnimTimer: number = 0;
  /** 魔法粒子 */
  private _magicParticles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    color: string;
  }> = [];
  /** 星星粒子 */
  private _starParticles: Array<{
    x: number;
    y: number;
    life: number;
    maxLife: number;
  }> = [];

  /** 活跃魔法效果 */
  private _activeSpells: ActiveSpell[] = [];
  /** 魔法冷却 */
  private _spellCooldowns: SpellCooldown[] = [];

  // ========== 公开属性 ==========

  get selectedIndex(): number {
    return this._selectedIndex;
  }

  get heroes(): HeroState[] {
    return this._heroes.map((h) => ({ ...h }));
  }

  get totalGoldEarned(): number {
    return this._stats.totalGoldEarned;
  }

  get totalClicks(): number {
    return this._stats.totalClicks;
  }

  get activeSpells(): ActiveSpell[] {
    return this._activeSpells.map((s) => ({ ...s }));
  }

  get spellCooldowns(): SpellCooldown[] {
    return this._spellCooldowns.map((c) => ({ ...c }));
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
        id: 'gem',
        name: '宝石',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e12,
        unlocked: false,
      },
      {
        id: 'crystal',
        name: '魔法水晶',
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
        unlocked: b.id === 'gold_mine', // 金矿初始解锁
        requires: b.requires,
        icon: b.icon,
      }))
    );

    // 重置状态
    this._heroes = HEROES.map((h) => ({
      id: h.id,
      unlocked: h.id === 'knight',
      evolutionLevel: 0,
    }));
    this._selectedIndex = 0;
    this._stats = {
      totalGoldEarned: 0,
      totalClicks: 0,
      totalGemsEarned: 0,
      totalCrystalsEarned: 0,
      totalPrestigeCount: 0,
      totalHeroesUnlocked: 1,
      totalEvolutions: 0,
      totalSpellsCast: 0,
    };
    this._floatingTexts = [];
    this._castleAnimTimer = 0;
    this._flagAngle = 0;
    this._torchFlicker = 0;
    this._clickScale = 1;
    this._clickAnimTimer = 0;
    this._magicParticles = [];
    this._starParticles = [];
    this._activeSpells = [];
    this._spellCooldowns = [];
    this._stats.totalGoldEarned = 0;
    this._stats.totalClicks = 0;
  }

  protected onUpdate(deltaTime: number): void {
    // 城堡动画
    this._castleAnimTimer += deltaTime;
    this._flagAngle = Math.sin(this._castleAnimTimer * 0.005) * 0.3;
    this._torchFlicker = Math.sin(this._castleAnimTimer * 0.01) * 0.3 + 0.7;

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

    // 魔法粒子更新
    this._magicParticles = this._magicParticles.filter((p) => {
      p.life -= deltaTime;
      p.x += p.vx * (deltaTime / 1000);
      p.y += p.vy * (deltaTime / 1000);
      p.vy += 30 * (deltaTime / 1000); // 重力
      return p.life > 0;
    });

    // 星星粒子更新
    this._starParticles = this._starParticles.filter((s) => {
      s.life -= deltaTime;
      return s.life > 0;
    });

    // 随机产生魔法粒子
    if (this._activeSpells.length > 0 && Math.random() < 0.05) {
      const spellColors = [COLORS.accent, COLORS.accentPurple, COLORS.accentBlue];
      this._magicParticles.push({
        x: CASTLE_DRAW.centerX + (Math.random() - 0.5) * 100,
        y: CASTLE_DRAW.centerY - 50 + Math.random() * 30,
        vx: (Math.random() - 0.5) * 20,
        vy: -15 - Math.random() * 20,
        life: 1200 + Math.random() * 800,
        maxLife: 2000,
        color: spellColors[Math.floor(Math.random() * spellColors.length)],
      });
    }

    // 随机产生星星粒子
    if (Math.random() < 0.02) {
      this._starParticles.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT * 0.3,
        life: 2000 + Math.random() * 2000,
        maxLife: 4000,
      });
    }

    // 更新活跃魔法效果
    this._activeSpells = this._activeSpells.filter((s) => {
      s.remainingTime -= deltaTime;
      return s.remainingTime > 0;
    });

    // 更新魔法冷却
    this._spellCooldowns = this._spellCooldowns.filter((c) => {
      c.remainingTime -= deltaTime;
      return c.remainingTime > 0;
    });

    // 统计资源产出
    const gold = this.getResource('gold');
    if (gold && gold.perSecond > 0) {
      this._stats.totalGoldEarned += gold.perSecond * (deltaTime / 1000);
    }
    const gem = this.getResource('gem');
    if (gem && gem.perSecond > 0) {
      this._stats.totalGemsEarned += gem.perSecond * (deltaTime / 1000);
    }
    const crystal = this.getResource('crystal');
    if (crystal && crystal.perSecond > 0) {
      this._stats.totalCrystalsEarned += crystal.perSecond * (deltaTime / 1000);
    }

    // 检查建筑解锁条件
    this.checkBuildingUnlocks();
    // 检查资源解锁条件
    this.checkResourceUnlocks();
  }

  // ========== 核心玩法 ==========

  /**
   * 点击获得金币
   */
  click(): number {
    if (this._status !== 'playing') return 0;

    let gained = GOLD_PER_CLICK;

    // 英雄点击加成
    gained *= this.getClickMultiplier();

    // 声望加成
    gained *= this.getPrestigeMultiplier();

    // 魔法点击加成
    gained *= this.getSpellClickMultiplier();

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
   * 解锁英雄
   */
  recruitHero(heroId: string): boolean {
    const heroDef = HEROES.find((h) => h.id === heroId);
    if (!heroDef) return false;

    const heroState = this._heroes.find((h) => h.id === heroId);
    if (!heroState || heroState.unlocked) return false;

    // 检查招募费用
    for (const [resId, amount] of Object.entries(heroDef.recruitCost)) {
      if (!this.hasResource(resId, amount)) return false;
    }

    // 扣除资源
    for (const [resId, amount] of Object.entries(heroDef.recruitCost)) {
      this.spendResource(resId, amount);
    }

    heroState.unlocked = true;
    this._stats.totalHeroesUnlocked++;

    // 重新计算产出
    this.recalculateProduction();

    this.emit('heroRecruited', heroId);
    this.emit('stateChange');
    return true;
  }

  /**
   * 进化英雄
   */
  evolveHero(heroId: string): boolean {
    const heroState = this._heroes.find((h) => h.id === heroId);
    if (!heroState || !heroState.unlocked) return false;

    const nextLevel = heroState.evolutionLevel + 1;
    if (nextLevel > MAX_EVOLUTION_LEVEL) return false;

    const cost = this.getEvolutionCost(nextLevel);
    if (!this.canAfford(cost)) return false;

    // 扣除资源
    for (const [resId, amount] of Object.entries(cost)) {
      this.spendResource(resId, amount);
    }

    heroState.evolutionLevel = nextLevel;
    this._stats.totalEvolutions++;

    // 重新计算产出
    this.recalculateProduction();

    this.emit('heroEvolved', heroId, nextLevel);
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
   * 获取英雄进化等级
   */
  getHeroEvolutionLevel(heroId: string): number {
    const hero = this._heroes.find((h) => h.id === heroId);
    return hero ? hero.evolutionLevel : 0;
  }

  /**
   * 施放魔法
   */
  castSpell(spellId: string): boolean {
    if (this._status !== 'playing') return false;

    const spellDef = SPELLS.find((s) => s.id === spellId);
    if (!spellDef) return false;

    // 检查冷却
    const cooldown = this._spellCooldowns.find((c) => c.spellId === spellId);
    if (cooldown) return false;

    // 检查资源
    if (!this.canAfford(spellDef.cost)) return false;

    // 扣除资源
    for (const [resId, amount] of Object.entries(spellDef.cost)) {
      this.spendResource(resId, amount);
    }

    // 添加活跃效果
    this._activeSpells.push({
      spellId,
      remainingTime: spellDef.duration,
      totalTime: spellDef.duration,
    });

    // 添加冷却
    this._spellCooldowns.push({
      spellId,
      remainingTime: spellDef.cooldown,
    });

    this._stats.totalSpellsCast++;

    // 重新计算产出
    this.recalculateProduction();

    this.emit('spellCast', spellId);
    this.emit('stateChange');
    return true;
  }

  /**
   * 获取魔法是否在冷却中
   */
  isSpellOnCooldown(spellId: string): boolean {
    return this._spellCooldowns.some((c) => c.spellId === spellId);
  }

  /**
   * 获取魔法冷却剩余时间
   */
  getSpellCooldownRemaining(spellId: string): number {
    const cooldown = this._spellCooldowns.find((c) => c.spellId === spellId);
    return cooldown ? cooldown.remainingTime : 0;
  }

  /**
   * 获取魔法是否激活中
   */
  isSpellActive(spellId: string): boolean {
    return this._activeSpells.some((s) => s.spellId === spellId);
  }

  /**
   * 获取魔法激活剩余时间
   */
  getSpellActiveRemaining(spellId: string): number {
    const spell = this._activeSpells.find((s) => s.spellId === spellId);
    return spell ? spell.remainingTime : 0;
  }

  /**
   * 声望重置
   */
  doPrestige(): number {
    const gold = this.getResource('gold');
    if (!gold || this._stats.totalGoldEarned < MIN_PRESTIGE_GOLD) return 0;

    // 计算获得的荣耀勋章
    const honorGained = Math.floor(
      PRESTIGE_BASE_HONOR * Math.sqrt(this._stats.totalGoldEarned / MIN_PRESTIGE_GOLD)
    );

    if (honorGained <= 0) return 0;

    // 保存荣耀勋章
    const savedPrestige = { ...this.prestige };
    const savedStats = {
      ...this._stats,
      totalGoldEarned: 0,
      totalClicks: 0,
      totalGemsEarned: 0,
      totalCrystalsEarned: 0,
    };

    // 保存英雄进化等级（声望保留进化等级）
    const savedHeroEvolutions = this._heroes.map((h) => ({
      id: h.id,
      evolutionLevel: h.evolutionLevel,
      unlocked: h.unlocked,
    }));

    // 重置
    this.onInit();

    // 恢复声望和部分统计
    this.prestige = {
      currency: savedPrestige.currency + honorGained,
      count: savedPrestige.count + 1,
    };
    this._stats = savedStats as HeroesMightStatistics;
    this._stats.totalPrestigeCount = savedPrestige.count + 1;

    // 恢复英雄进化等级
    for (const saved of savedHeroEvolutions) {
      const hero = this._heroes.find((h) => h.id === saved.id);
      if (hero) {
        hero.evolutionLevel = saved.evolutionLevel;
        hero.unlocked = saved.unlocked;
      }
    }

    this.emit('prestige', honorGained);
    this.emit('stateChange');
    return honorGained;
  }

  /**
   * 获取声望加成倍率
   */
  getPrestigeMultiplier(): number {
    return 1 + this.prestige.currency * HONOR_BONUS_MULTIPLIER;
  }

  /**
   * 获取点击加成倍率（来自英雄）
   */
  getClickMultiplier(): number {
    let multiplier = 1;
    for (const hero of this._heroes) {
      if (!hero.unlocked) continue;
      const def = HEROES.find((h) => h.id === hero.id);
      if (!def) continue;
      if (def.bonusType === 'click' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.evolutionMultiplier, hero.evolutionLevel);
        multiplier += bonus;
      }
    }
    return multiplier;
  }

  /**
   * 获取生产加成倍率（来自英雄）
   */
  getProductionMultiplier(): number {
    let multiplier = 1;
    for (const hero of this._heroes) {
      if (!hero.unlocked) continue;
      const def = HEROES.find((h) => h.id === hero.id);
      if (!def) continue;
      if (def.bonusType === 'production' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.evolutionMultiplier, hero.evolutionLevel);
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
    for (const hero of this._heroes) {
      if (!hero.unlocked) continue;
      const def = HEROES.find((h) => h.id === hero.id);
      if (!def) continue;
      if (def.bonusType === 'gem' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.evolutionMultiplier, hero.evolutionLevel);
        multiplier += bonus;
      }
    }
    return multiplier;
  }

  /**
   * 获取水晶加成倍率
   */
  getCrystalMultiplier(): number {
    let multiplier = 1;
    for (const hero of this._heroes) {
      if (!hero.unlocked) continue;
      const def = HEROES.find((h) => h.id === hero.id);
      if (!def) continue;
      if (def.bonusType === 'crystal' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.evolutionMultiplier, hero.evolutionLevel);
        multiplier += bonus;
      }
    }
    return multiplier;
  }

  /**
   * 获取魔法点击加成倍率
   */
  getSpellClickMultiplier(): number {
    let multiplier = 1;
    for (const active of this._activeSpells) {
      const spellDef = SPELLS.find((s) => s.id === active.spellId);
      if (!spellDef) continue;
      if (spellDef.effectType === 'multiply_click') {
        multiplier *= spellDef.value;
      }
    }
    return multiplier;
  }

  /**
   * 获取魔法生产加成倍率（针对特定资源）
   */
  getSpellProductionMultiplier(resourceId: string): number {
    let multiplier = 1;
    for (const active of this._activeSpells) {
      const spellDef = SPELLS.find((s) => s.id === active.spellId);
      if (!spellDef) continue;
      if (spellDef.effectType === 'multiply_production' && spellDef.target === resourceId) {
        multiplier *= spellDef.value;
      }
    }
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
   * 获取预览声望荣耀勋章数
   */
  getPrestigePreview(): number {
    if (this._stats.totalGoldEarned < MIN_PRESTIGE_GOLD) return 0;
    return Math.floor(
      PRESTIGE_BASE_HONOR * Math.sqrt(this._stats.totalGoldEarned / MIN_PRESTIGE_GOLD)
    );
  }

  /**
   * 检查是否可以声望
   */
  canPrestige(): boolean {
    return this._stats.totalGoldEarned >= MIN_PRESTIGE_GOLD;
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
      if (building.productionResource === 'gold') {
        production *= this.getProductionMultiplier();
        production *= this.getSpellProductionMultiplier('gold');
      } else if (building.productionResource === 'gem') {
        production *= this.getGemMultiplier() * this.getPrestigeMultiplier();
        production *= this.getSpellProductionMultiplier('gem');
      } else if (building.productionResource === 'crystal') {
        production *= this.getCrystalMultiplier() * this.getPrestigeMultiplier();
        production *= this.getSpellProductionMultiplier('crystal');
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
    // 宝石：伐木场等级 >= 3 时解锁
    const lumberMill = this.upgrades.get('lumber_mill');
    if (lumberMill && lumberMill.level >= 3) {
      const gem = this.resources.get('gem');
      if (gem && !gem.unlocked) {
        gem.unlocked = true;
        this.emit('resourceUnlocked', 'gem');
      }
    }

    // 魔法水晶：魔法塔等级 >= 1 时解锁
    const magicTower = this.upgrades.get('magic_tower');
    if (magicTower && magicTower.level >= 1) {
      const crystal = this.resources.get('crystal');
      if (crystal && !crystal.unlocked) {
        crystal.unlocked = true;
        this.emit('resourceUnlocked', 'crystal');
      }
    }
  }

  // ========== 渲染 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawStarParticles(ctx);
    this.drawMagicParticles(ctx);
    this.drawCastle(ctx);
    this.drawFloatingTexts(ctx);
    this.drawResourcePanel(ctx, w);
    this.drawBuildingList(ctx, w, h);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 天空渐变（奇幻夜空）
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

    // 地面纹理（石砖风格）
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 25; i++) {
      const x = ((i * 73 + 17) % w);
      const y = h * 0.45 + ((i * 47 + 23) % (h * 0.55));
      ctx.fillStyle = '#4E342E';
      ctx.fillRect(x, y, 4, 3);
    }
    ctx.globalAlpha = 1;

    // 远处山脉
    ctx.fillStyle = '#1A0E08';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.quadraticCurveTo(80, h * 0.35, 160, h * 0.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(200, h * 0.5);
    ctx.quadraticCurveTo(300, h * 0.32, 380, h * 0.5);
    ctx.fill();

    // 月亮
    ctx.beginPath();
    ctx.arc(60, 50, 20, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.moonGlow;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(60, 50, 26, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(232, 234, 246, 0.12)';
    ctx.fill();
  }

  private drawCastle(ctx: CanvasRenderingContext2D): void {
    const cx = CASTLE_DRAW.centerX;
    const cy = CASTLE_DRAW.centerY;
    const scale = this._clickScale;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // 阴影
    ctx.beginPath();
    ctx.ellipse(0, CASTLE_DRAW.height * 0.5 + 5, CASTLE_DRAW.width * 0.6, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.heroShadow;
    ctx.fill();

    // 主体城墙
    ctx.fillStyle = COLORS.castleStone;
    ctx.fillRect(-CASTLE_DRAW.width * 0.5, -CASTLE_DRAW.height * 0.3, CASTLE_DRAW.width, CASTLE_DRAW.height * 0.8);

    // 城垛
    const merlonWidth = 12;
    const merlonHeight = 8;
    const merlonCount = Math.floor(CASTLE_DRAW.width / (merlonWidth + 4));
    const startX = -CASTLE_DRAW.width * 0.5 + 2;
    ctx.fillStyle = COLORS.castleStone;
    for (let i = 0; i < merlonCount; i++) {
      ctx.fillRect(startX + i * (merlonWidth + 4), -CASTLE_DRAW.height * 0.3 - merlonHeight, merlonWidth, merlonHeight);
    }

    // 左塔
    ctx.fillStyle = COLORS.castleStone;
    ctx.fillRect(
      -CASTLE_DRAW.width * 0.5 - CASTLE_DRAW.towerWidth * 0.3,
      -CASTLE_DRAW.height * 0.3 - CASTLE_DRAW.towerHeight,
      CASTLE_DRAW.towerWidth,
      CASTLE_DRAW.towerHeight + CASTLE_DRAW.height * 0.8
    );
    // 左塔尖顶
    ctx.fillStyle = COLORS.castleRoof;
    ctx.beginPath();
    ctx.moveTo(-CASTLE_DRAW.width * 0.5 - CASTLE_DRAW.towerWidth * 0.3 - 3, -CASTLE_DRAW.height * 0.3 - CASTLE_DRAW.towerHeight);
    ctx.lineTo(
      -CASTLE_DRAW.width * 0.5 - CASTLE_DRAW.towerWidth * 0.3 + CASTLE_DRAW.towerWidth * 0.5,
      -CASTLE_DRAW.height * 0.3 - CASTLE_DRAW.towerHeight - 20
    );
    ctx.lineTo(-CASTLE_DRAW.width * 0.5 - CASTLE_DRAW.towerWidth * 0.3 + CASTLE_DRAW.towerWidth + 3, -CASTLE_DRAW.height * 0.3 - CASTLE_DRAW.towerHeight);
    ctx.closePath();
    ctx.fill();

    // 右塔
    ctx.fillStyle = COLORS.castleStone;
    ctx.fillRect(
      CASTLE_DRAW.width * 0.5 - CASTLE_DRAW.towerWidth * 0.7,
      -CASTLE_DRAW.height * 0.3 - CASTLE_DRAW.towerHeight,
      CASTLE_DRAW.towerWidth,
      CASTLE_DRAW.towerHeight + CASTLE_DRAW.height * 0.8
    );
    // 右塔尖顶
    ctx.fillStyle = COLORS.castleRoof;
    ctx.beginPath();
    ctx.moveTo(CASTLE_DRAW.width * 0.5 - CASTLE_DRAW.towerWidth * 0.7 - 3, -CASTLE_DRAW.height * 0.3 - CASTLE_DRAW.towerHeight);
    ctx.lineTo(
      CASTLE_DRAW.width * 0.5 - CASTLE_DRAW.towerWidth * 0.7 + CASTLE_DRAW.towerWidth * 0.5,
      -CASTLE_DRAW.height * 0.3 - CASTLE_DRAW.towerHeight - 20
    );
    ctx.lineTo(CASTLE_DRAW.width * 0.5 - CASTLE_DRAW.towerWidth * 0.7 + CASTLE_DRAW.towerWidth + 3, -CASTLE_DRAW.height * 0.3 - CASTLE_DRAW.towerHeight);
    ctx.closePath();
    ctx.fill();

    // 城门
    ctx.fillStyle = '#3E2723';
    ctx.beginPath();
    ctx.moveTo(-CASTLE_DRAW.gateWidth * 0.5, CASTLE_DRAW.height * 0.5);
    ctx.lineTo(-CASTLE_DRAW.gateWidth * 0.5, CASTLE_DRAW.height * 0.5 - CASTLE_DRAW.gateHeight);
    ctx.arc(0, CASTLE_DRAW.height * 0.5 - CASTLE_DRAW.gateHeight, CASTLE_DRAW.gateWidth * 0.5, Math.PI, 0);
    ctx.lineTo(CASTLE_DRAW.gateWidth * 0.5, CASTLE_DRAW.height * 0.5);
    ctx.closePath();
    ctx.fill();

    // 城门装饰
    ctx.strokeStyle = '#8B7355';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, CASTLE_DRAW.height * 0.5);
    ctx.lineTo(0, CASTLE_DRAW.height * 0.5 - CASTLE_DRAW.gateHeight);
    ctx.stroke();

    // 窗户
    ctx.fillStyle = '#FFD54F';
    ctx.globalAlpha = this._torchFlicker;
    ctx.fillRect(-CASTLE_DRAW.width * 0.3, -CASTLE_DRAW.height * 0.1, 10, 12);
    ctx.fillRect(CASTLE_DRAW.width * 0.2, -CASTLE_DRAW.height * 0.1, 10, 12);
    ctx.globalAlpha = 1;

    // 火把
    ctx.fillStyle = COLORS.torchGlow;
    ctx.globalAlpha = this._torchFlicker;
    ctx.beginPath();
    ctx.arc(-CASTLE_DRAW.width * 0.5 - 5, -CASTLE_DRAW.height * 0.2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(CASTLE_DRAW.width * 0.5 + 5, -CASTLE_DRAW.height * 0.2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 旗帜（左塔顶，飘动）
    ctx.save();
    ctx.translate(
      -CASTLE_DRAW.width * 0.5 - CASTLE_DRAW.towerWidth * 0.3 + CASTLE_DRAW.towerWidth * 0.5,
      -CASTLE_DRAW.height * 0.3 - CASTLE_DRAW.towerHeight - 20
    );
    ctx.rotate(this._flagAngle);
    ctx.fillStyle = COLORS.castleRoof;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(20, -5);
    ctx.lineTo(18, 0);
    ctx.lineTo(20, 5);
    ctx.lineTo(0, 0);
    ctx.fill();
    // 旗杆
    ctx.strokeStyle = '#8B7355';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(0, 5);
    ctx.stroke();
    ctx.restore();

    // 英雄进化指示（小星星在城门上方）
    const unlockedHero = this._heroes.find((h) => h.unlocked);
    if (unlockedHero) {
      const evoLevel = unlockedHero.evolutionLevel;
      for (let i = 0; i < evoLevel; i++) {
        ctx.fillStyle = COLORS.accent;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★', -12 + i * 12, -CASTLE_DRAW.height * 0.35);
      }
    }

    ctx.restore();
  }

  private drawStarParticles(ctx: CanvasRenderingContext2D): void {
    for (const s of this._starParticles) {
      const alpha = (s.life / s.maxLife) * 0.6;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.moonGlow;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawMagicParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this._magicParticles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
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
    this.roundRect(ctx, panel.padding, panel.startY, w - panel.padding * 2, resources.length * (panel.itemHeight + panel.itemPadding) + panel.padding, 8);
    ctx.fill();

    let y = panel.startY + panel.padding;
    for (const res of resources) {
      const icon = res.id === 'gold' ? '🪙' : res.id === 'gem' ? '💎' : '🔮';

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
            const icon = id === 'gold' ? '🪙' : id === 'gem' ? '💎' : '🔮';
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
    ctx.fillText('空格 点击 · ↑↓ 选择 · Enter 购买 · E 进化 · S 施法 · P 声望', w / 2, h - 10);
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
        // 进化当前选中的英雄（第一个已解锁的）
        {
          const unlocked = this._heroes.find((h) => h.unlocked);
          if (unlocked) this.evolveHero(unlocked.id);
        }
        break;
      case 's':
      case 'S':
        // 施放第一个可用的魔法
        {
          const available = SPELLS.find((s) => !this.isSpellOnCooldown(s.id) && this.canAfford(s.cost));
          if (available) this.castSpell(available.id);
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

  getState(): HeroesMightState {
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
      heroes: this.heroes,
      spells: this._activeSpells.map((s) => ({ ...s })),
      spellCooldowns: this._spellCooldowns.map((c) => ({ ...c })),
      prestige: { ...this.prestige },
      statistics: { ...this._stats },
      selectedIndex: this._selectedIndex,
    };
  }

  /**
   * 从状态恢复
   */
  loadState(state: HeroesMightState): void {
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

    // 恢复英雄
    if (state.heroes) {
      for (const heroState of state.heroes) {
        const myHero = this._heroes.find((h) => h.id === heroState.id);
        if (myHero) {
          myHero.unlocked = heroState.unlocked;
          if (heroState.evolutionLevel !== undefined) {
            myHero.evolutionLevel = heroState.evolutionLevel;
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
      this._stats = { ...state.statistics } as HeroesMightStatistics;
    }

    // 恢复选中
    if (state.selectedIndex !== undefined) {
      this._selectedIndex = state.selectedIndex;
    }

    // 恢复魔法效果
    if (state.spells) {
      this._activeSpells = state.spells.map((s) => ({ ...s }));
    }
    if (state.spellCooldowns) {
      this._spellCooldowns = state.spellCooldowns.map((c) => ({ ...c }));
    }

    // 重新计算产出
    this.recalculateProduction();

    this.emit('stateChange');
  }

  // ========== 存档覆盖 ==========

  save(): SaveData {
    const data = super.save();
    // 附加英雄和统计信息到 settings
    data.settings = {
      heroes: this._heroes,
      stats: this._stats,
      selectedIndex: this._selectedIndex,
      activeSpells: this._activeSpells,
      spellCooldowns: this._spellCooldowns,
    };
    return data;
  }

  load(data: SaveData): void {
    super.load(data);

    // 恢复附加数据
    if (data.settings) {
      const settings = data.settings as any;
      if (settings.heroes) {
        for (const heroState of settings.heroes) {
          const myHero = this._heroes.find((h) => h.id === heroState.id);
          if (myHero) {
            myHero.unlocked = heroState.unlocked;
            if (heroState.evolutionLevel !== undefined) {
              myHero.evolutionLevel = heroState.evolutionLevel;
            }
          }
        }
      }
      if (settings.stats) {
        this._stats = { ...this._stats, ...settings.stats };
      }
      if (settings.selectedIndex !== undefined) {
        this._selectedIndex = settings.selectedIndex;
      }
      if (settings.activeSpells) {
        this._activeSpells = settings.activeSpells;
      }
      if (settings.spellCooldowns) {
        this._spellCooldowns = settings.spellCooldowns;
      }
    }

    this.recalculateProduction();
  }
}
