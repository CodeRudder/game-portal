/**
 * 北欧英灵 (Norse Valkyrie) — 放置类游戏引擎
 *
 * 继承 IdleGameEngine，实现：
 * - 多资源系统（铁矿石/荣耀/卢恩）
 * - 建筑升级系统
 * - 英灵战士招募与进化
 * - 卢恩符文镶嵌系统
 * - 声望重置系统（荣耀重生）
 * - Canvas 北欧神话风格渲染
 * - 离线收益
 * - 自动存档
 */
import { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { Resource, Upgrade, SaveData } from '@/types/idle';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  IRON_PER_CLICK,
  GLORY_BONUS_MULTIPLIER,
  PRESTIGE_BASE_GLORY,
  MIN_PRESTIGE_IRON,
  EINHERJAR,
  RUNES,
  BUILDINGS,
  COLORS,
  WARRIOR_DRAW,
  BUILDING_PANEL,
  RESOURCE_PANEL,
  type EinherjarDef,
  type RuneDef,
  type BuildingDef,
} from './constants';

/** 英灵战士状态 */
export interface EinherjarState {
  id: string;
  unlocked: boolean;
  /** 进化等级 0-5 */
  evolutionLevel: number;
}

/** 卢恩符文状态 */
export interface RuneState {
  id: string;
  /** 是否已镶嵌 */
  inscribed: boolean;
}

/** 游戏统计 */
export interface NorseValkyrieStatistics {
  totalIronEarned: number;
  totalClicks: number;
  totalGloryEarned: number;
  totalRuneEarned: number;
  totalPrestigeCount: number;
  totalEinherjarUnlocked: number;
  totalEvolutions: number;
  totalRunesInscribed: number;
}

/** 北欧英灵游戏状态 */
export interface NorseValkyrieState {
  [key: string]: unknown;
  resources: Record<string, { amount: number; perSecond: number; unlocked: boolean }>;
  buildings: Record<string, number>;
  einherjar: EinherjarState[];
  runes: RuneState[];
  prestige: { currency: number; count: number };
  statistics: NorseValkyrieStatistics;
  selectedIndex: number;
}

/** 进化费用表（按进化等级） */
const EVOLUTION_COSTS: Record<number, Record<string, number>> = {
  1: { glory: 10, rune: 5 },
  2: { glory: 50, rune: 20 },
  3: { glory: 200, rune: 80 },
  4: { glory: 800, rune: 300 },
  5: { glory: 3000, rune: 1000 },
};

/** 最大进化等级 */
const MAX_EVOLUTION_LEVEL = 5;

export class NorseValkyrieEngine extends IdleGameEngine {
  // ========== 游戏状态 ==========

  protected _gameId = 'norse-valkyrie';

  constructor() {
    super();
    // Override base class `statistics` instance field with a getter/setter,
    // because class fields shadow prototype accessors.
    Object.defineProperty(this, 'statistics', {
      get: () => ({ ...this._stats }) as NorseValkyrieStatistics,
      set: (_val: Record<string, number>) => { /* base class writes are no-ops */ },
      configurable: true,
      enumerable: true,
    });
  }

  /** 英灵战士状态 */
  private _einherjar: EinherjarState[] = EINHERJAR.map((e) => ({
    id: e.id,
    unlocked: e.id === 'berserker', // 狂战士初始解锁
    evolutionLevel: 0,
  }));

  /** 卢恩符文状态 */
  private _runes: RuneState[] = RUNES.map((r) => ({
    id: r.id,
    inscribed: false,
  }));

  /** 当前选中的建筑索引 */
  private _selectedIndex: number = 0;

  /** 统计数据 */
  private _stats: NorseValkyrieStatistics = {
    totalIronEarned: 0,
    totalClicks: 0,
    totalGloryEarned: 0,
    totalRuneEarned: 0,
    totalPrestigeCount: 0,
    totalEinherjarUnlocked: 1,
    totalEvolutions: 0,
    totalRunesInscribed: 0,
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

  /** 战士动画计时器 */
  private _warriorAnimTimer: number = 0;
  /** 战士呼吸缩放 */
  private _warriorBreathe: number = 0;
  /** 剑挥动角度 */
  private _swordAngle: number = 0;
  /** 点击缩放效果 */
  private _clickScale: number = 1;
  private _clickAnimTimer: number = 0;
  /** 极光粒子 */
  private _auroraParticles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    color: string;
  }> = [];
  /** 雪花粒子 */
  private _snowParticles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
  }> = [];

  // ========== 公开属性 ==========

  get selectedIndex(): number {
    return this._selectedIndex;
  }

  get einherjar(): EinherjarState[] {
    return this._einherjar.map((e) => ({ ...e }));
  }

  get runes(): RuneState[] {
    return this._runes.map((r) => ({ ...r }));
  }

  get totalIronEarned(): number {
    return this._stats.totalIronEarned;
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
        id: 'iron',
        name: '铁矿石',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e15,
        unlocked: true,
      },
      {
        id: 'glory',
        name: '荣耀',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e12,
        unlocked: false,
      },
      {
        id: 'rune',
        name: '卢恩',
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
        unlocked: b.id === 'mining_pit', // 矿坑初始解锁
        requires: b.requires,
        icon: b.icon,
      }))
    );

    // 重置状态
    this._einherjar = EINHERJAR.map((e) => ({
      id: e.id,
      unlocked: e.id === 'berserker',
      evolutionLevel: 0,
    }));
    this._runes = RUNES.map((r) => ({
      id: r.id,
      inscribed: false,
    }));
    this._selectedIndex = 0;
    this._stats = {
      totalIronEarned: 0,
      totalClicks: 0,
      totalGloryEarned: 0,
      totalRuneEarned: 0,
      totalPrestigeCount: 0,
      totalEinherjarUnlocked: 1,
      totalEvolutions: 0,
      totalRunesInscribed: 0,
    };
    this._floatingTexts = [];
    this._warriorAnimTimer = 0;
    this._warriorBreathe = 0;
    this._swordAngle = 0;
    this._clickScale = 1;
    this._clickAnimTimer = 0;
    this._auroraParticles = [];
    this._snowParticles = [];
  }

  protected onUpdate(deltaTime: number): void {
    // 战士动画
    this._warriorAnimTimer += deltaTime;
    this._warriorBreathe = Math.sin(this._warriorAnimTimer * 0.002) * 2;
    this._swordAngle = Math.sin(this._warriorAnimTimer * 0.003) * 0.3;

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

    // 极光粒子更新
    this._auroraParticles = this._auroraParticles.filter((p) => {
      p.life -= deltaTime;
      p.x += p.vx * (deltaTime / 1000);
      p.y += p.vy * (deltaTime / 1000);
      return p.life > 0;
    });

    // 随机产生极光粒子
    if (Math.random() < 0.03) {
      const colors = [COLORS.auroraGreen, COLORS.auroraBlue, '#7B68EE'];
      this._auroraParticles.push({
        x: Math.random() * CANVAS_WIDTH,
        y: 20 + Math.random() * 60,
        vx: (Math.random() - 0.5) * 20,
        vy: Math.random() * 5,
        life: 2000 + Math.random() * 1500,
        maxLife: 3500,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    // 雪花粒子更新
    this._snowParticles = this._snowParticles.filter((p) => {
      p.life -= deltaTime;
      p.x += p.vx * (deltaTime / 1000);
      p.y += p.vy * (deltaTime / 1000);
      p.vx += (Math.random() - 0.5) * 0.5;
      return p.life > 0;
    });

    // 随机产生雪花
    if (Math.random() < 0.05) {
      this._snowParticles.push({
        x: Math.random() * CANVAS_WIDTH,
        y: -5,
        vx: (Math.random() - 0.5) * 10,
        vy: 15 + Math.random() * 20,
        life: 4000 + Math.random() * 2000,
        maxLife: 6000,
      });
    }

    // 统计资源产出
    const iron = this.getResource('iron');
    if (iron && iron.perSecond > 0) {
      this._stats.totalIronEarned += iron.perSecond * (deltaTime / 1000);
    }
    const glory = this.getResource('glory');
    if (glory && glory.perSecond > 0) {
      this._stats.totalGloryEarned += glory.perSecond * (deltaTime / 1000);
    }
    const rune = this.getResource('rune');
    if (rune && rune.perSecond > 0) {
      this._stats.totalRuneEarned += rune.perSecond * (deltaTime / 1000);
    }

    // 检查建筑解锁条件
    this.checkBuildingUnlocks();
    // 检查资源解锁条件
    this.checkResourceUnlocks();
  }

  // ========== 核心玩法 ==========

  /**
   * 点击获得铁矿石
   */
  click(): number {
    if (this._status !== 'playing') return 0;

    let gained = IRON_PER_CLICK;

    // 英灵战士点击加成
    gained *= this.getClickMultiplier();

    // 符文点击加成
    gained *= this.getRuneClickMultiplier();

    // 声望加成
    gained *= this.getPrestigeMultiplier();

    gained = Math.floor(gained * 100) / 100;

    this.addResource('iron', gained);
    this._stats.totalIronEarned += gained;
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
      x: WARRIOR_DRAW.centerX + Math.cos(angle) * dist,
      y: WARRIOR_DRAW.centerY + Math.sin(angle) * dist - 30,
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
   * 解锁英灵战士
   */
  unlockEinherjar(einherjarId: string): boolean {
    const einherjarDef = EINHERJAR.find((e) => e.id === einherjarId);
    if (!einherjarDef) return false;

    const einherjarState = this._einherjar.find((e) => e.id === einherjarId);
    if (!einherjarState || einherjarState.unlocked) return false;

    if (!this.hasResource('iron', einherjarDef.unlockCost)) return false;

    this.spendResource('iron', einherjarDef.unlockCost);
    einherjarState.unlocked = true;
    this._stats.totalEinherjarUnlocked++;

    // 重新计算产出
    this.recalculateProduction();

    this.emit('einherjarUnlocked', einherjarId);
    this.emit('stateChange');
    return true;
  }

  /**
   * 进化英灵战士
   */
  evolveEinherjar(einherjarId: string): boolean {
    const einherjarState = this._einherjar.find((e) => e.id === einherjarId);
    if (!einherjarState || !einherjarState.unlocked) return false;

    const nextLevel = einherjarState.evolutionLevel + 1;
    if (nextLevel > MAX_EVOLUTION_LEVEL) return false;

    const cost = this.getEvolutionCost(nextLevel);
    if (!this.canAfford(cost)) return false;

    // 扣除资源
    for (const [resId, amount] of Object.entries(cost)) {
      this.spendResource(resId, amount);
    }

    einherjarState.evolutionLevel = nextLevel;
    this._stats.totalEvolutions++;

    // 重新计算产出
    this.recalculateProduction();

    this.emit('einherjarEvolved', einherjarId, nextLevel);
    this.emit('stateChange');
    return true;
  }

  /**
   * 镶嵌卢恩符文
   */
  inscribeRune(runeId: string): boolean {
    const runeDef = RUNES.find((r) => r.id === runeId);
    if (!runeDef) return false;

    const runeState = this._runes.find((r) => r.id === runeId);
    if (!runeState || runeState.inscribed) return false;

    if (!this.hasResource('rune', runeDef.inscribeCost)) return false;

    this.spendResource('rune', runeDef.inscribeCost);
    runeState.inscribed = true;
    this._stats.totalRunesInscribed++;

    // 重新计算产出
    this.recalculateProduction();

    this.emit('runeInscribed', runeId);
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
   * 获取英灵战士进化等级
   */
  getEinherjarEvolutionLevel(einherjarId: string): number {
    const einherjar = this._einherjar.find((e) => e.id === einherjarId);
    return einherjar ? einherjar.evolutionLevel : 0;
  }

  /**
   * 声望重置
   */
  doPrestige(): number {
    const iron = this.getResource('iron');
    if (!iron || this._stats.totalIronEarned < MIN_PRESTIGE_IRON) return 0;

    // 计算获得的荣耀
    const gloryGained = Math.floor(
      PRESTIGE_BASE_GLORY * Math.sqrt(this._stats.totalIronEarned / MIN_PRESTIGE_IRON)
    );

    if (gloryGained <= 0) return 0;

    // 先更新声望数据
    this.prestige.currency += gloryGained;
    this.prestige.count++;
    this._stats.totalPrestigeCount++;

    // 保存需要跨声望保留的数据
    const savedPrestige = { ...this.prestige };
    const savedStats = {
      ...this._stats,
      totalIronEarned: 0,
      totalClicks: 0,
      totalGloryEarned: 0,
      totalRuneEarned: 0,
    };

    // 保存英灵战士进化等级（声望保留进化等级）
    const savedEinherjar = this._einherjar.map((e) => ({
      id: e.id,
      evolutionLevel: e.evolutionLevel,
      unlocked: e.unlocked,
    }));

    // 保存符文镶嵌状态（声望保留符文）
    const savedRunes = this._runes.map((r) => ({
      id: r.id,
      inscribed: r.inscribed,
    }));

    // 重置
    this.onInit();

    // 恢复声望和部分统计
    this.prestige = savedPrestige;
    this._stats = savedStats as NorseValkyrieStatistics;

    // 恢复英灵战士进化等级
    for (const saved of savedEinherjar) {
      const einherjar = this._einherjar.find((e) => e.id === saved.id);
      if (einherjar) {
        einherjar.evolutionLevel = saved.evolutionLevel;
        einherjar.unlocked = saved.unlocked;
      }
    }

    // 恢复符文镶嵌状态
    for (const saved of savedRunes) {
      const rune = this._runes.find((r) => r.id === saved.id);
      if (rune) {
        rune.inscribed = saved.inscribed;
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
    return 1 + this.prestige.currency * GLORY_BONUS_MULTIPLIER;
  }

  /**
   * 获取点击加成倍率（英灵战士）
   */
  getClickMultiplier(): number {
    let multiplier = 1;
    for (const einherjar of this._einherjar) {
      if (!einherjar.unlocked) continue;
      const def = EINHERJAR.find((e) => e.id === einherjar.id);
      if (!def) continue;
      if (def.bonusType === 'click' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.evolutionMultiplier, einherjar.evolutionLevel);
        multiplier += bonus;
      }
    }
    return multiplier;
  }

  /**
   * 获取符文点击加成倍率
   */
  getRuneClickMultiplier(): number {
    let multiplier = 1;
    for (const rune of this._runes) {
      if (!rune.inscribed) continue;
      const def = RUNES.find((r) => r.id === rune.id);
      if (!def) continue;
      if (def.bonusType === 'click' || def.bonusType === 'all') {
        multiplier += def.bonusValue;
      }
    }
    return multiplier;
  }

  /**
   * 获取生产加成倍率
   */
  getProductionMultiplier(): number {
    let multiplier = 1;
    for (const einherjar of this._einherjar) {
      if (!einherjar.unlocked) continue;
      const def = EINHERJAR.find((e) => e.id === einherjar.id);
      if (!def) continue;
      if (def.bonusType === 'production' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.evolutionMultiplier, einherjar.evolutionLevel);
        multiplier += bonus;
      }
    }
    // 声望加成
    multiplier *= this.getPrestigeMultiplier();
    return multiplier;
  }

  /**
   * 获取荣耀加成倍率
   */
  getGloryMultiplier(): number {
    let multiplier = 1;
    for (const einherjar of this._einherjar) {
      if (!einherjar.unlocked) continue;
      const def = EINHERJAR.find((e) => e.id === einherjar.id);
      if (!def) continue;
      if (def.bonusType === 'glory' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.evolutionMultiplier, einherjar.evolutionLevel);
        multiplier += bonus;
      }
    }
    // 符文加成
    for (const rune of this._runes) {
      if (!rune.inscribed) continue;
      const def = RUNES.find((r) => r.id === rune.id);
      if (!def) continue;
      if (def.bonusType === 'glory' || def.bonusType === 'all') {
        multiplier += def.bonusValue;
      }
    }
    multiplier *= this.getPrestigeMultiplier();
    return multiplier;
  }

  /**
   * 获取卢恩加成倍率
   */
  getRuneMultiplier(): number {
    let multiplier = 1;
    for (const einherjar of this._einherjar) {
      if (!einherjar.unlocked) continue;
      const def = EINHERJAR.find((e) => e.id === einherjar.id);
      if (!def) continue;
      if (def.bonusType === 'rune' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.evolutionMultiplier, einherjar.evolutionLevel);
        multiplier += bonus;
      }
    }
    // 符文加成
    for (const rune of this._runes) {
      if (!rune.inscribed) continue;
      const def = RUNES.find((r) => r.id === rune.id);
      if (!def) continue;
      if (def.bonusType === 'rune' || def.bonusType === 'all') {
        multiplier += def.bonusValue;
      }
    }
    multiplier *= this.getPrestigeMultiplier();
    return multiplier;
  }

  /**
   * 获取铁矿石加成倍率
   */
  getIronMultiplier(): number {
    let multiplier = 1;
    for (const rune of this._runes) {
      if (!rune.inscribed) continue;
      const def = RUNES.find((r) => r.id === rune.id);
      if (!def) continue;
      if (def.bonusType === 'production' || def.bonusType === 'all') {
        multiplier += def.bonusValue;
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
   * 获取预览声望荣耀数
   */
  getPrestigePreview(): number {
    if (this._stats.totalIronEarned < MIN_PRESTIGE_IRON) return 0;
    return Math.floor(
      PRESTIGE_BASE_GLORY * Math.sqrt(this._stats.totalIronEarned / MIN_PRESTIGE_IRON)
    );
  }

  /**
   * 检查是否可以声望
   */
  canPrestige(): boolean {
    return this._stats.totalIronEarned >= MIN_PRESTIGE_IRON;
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
      if (building.productionResource === 'iron') {
        production *= this.getProductionMultiplier() * this.getIronMultiplier();
      } else if (building.productionResource === 'glory') {
        production *= this.getGloryMultiplier();
      } else if (building.productionResource === 'rune') {
        production *= this.getRuneMultiplier();
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
    // 荣耀：矿坑等级 >= 5 时解锁
    const miningPit = this.upgrades.get('mining_pit');
    if (miningPit && miningPit.level >= 5) {
      const glory = this.resources.get('glory');
      if (glory && !glory.unlocked) {
        glory.unlocked = true;
        this.emit('resourceUnlocked', 'glory');
      }
    }

    // 卢恩：长船等级 >= 3 时解锁
    const longship = this.upgrades.get('longship');
    if (longship && longship.level >= 3) {
      const rune = this.resources.get('rune');
      if (rune && !rune.unlocked) {
        rune.unlocked = true;
        this.emit('resourceUnlocked', 'rune');
      }
    }
  }

  // ========== 渲染 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawAuroraParticles(ctx);
    this.drawSnowParticles(ctx);
    this.drawWarrior(ctx);
    this.drawFloatingTexts(ctx);
    this.drawResourcePanel(ctx, w);
    this.drawBuildingList(ctx, w, h);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 天空渐变（北欧深蓝夜空）
    const skyGradient = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    skyGradient.addColorStop(0, COLORS.skyTop);
    skyGradient.addColorStop(1, COLORS.skyBottom);
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, w, h * 0.5);

    // 地面渐变（冰雪大地）
    const groundGradient = ctx.createLinearGradient(0, h * 0.45, 0, h);
    groundGradient.addColorStop(0, COLORS.groundLight);
    groundGradient.addColorStop(1, COLORS.groundDark);
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, h * 0.45, w, h * 0.55);

    // 地面纹理（雪地小石子）
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < 30; i++) {
      const x = ((i * 73 + 17) % w);
      const y = h * 0.45 + ((i * 47 + 23) % (h * 0.55));
      ctx.fillStyle = '#4A5568';
      ctx.fillRect(x, y, 3, 2);
    }
    ctx.globalAlpha = 1;

    // 远山
    ctx.fillStyle = '#2D3748';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.quadraticCurveTo(80, h * 0.35, 160, h * 0.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(200, h * 0.5);
    ctx.quadraticCurveTo(300, h * 0.32, 400, h * 0.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(350, h * 0.5);
    ctx.quadraticCurveTo(420, h * 0.38, 480, h * 0.5);
    ctx.fill();

    // 山顶积雪
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.moveTo(70, h * 0.39);
    ctx.quadraticCurveTo(80, h * 0.35, 90, h * 0.39);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(280, h * 0.36);
    ctx.quadraticCurveTo(300, h * 0.32, 320, h * 0.36);
    ctx.fill();

    // 月亮
    ctx.beginPath();
    ctx.arc(60, 50, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#E8E8E8';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(60, 50, 24, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(232, 232, 232, 0.15)';
    ctx.fill();

    // 星星
    ctx.fillStyle = '#FFFFFF';
    const starPositions = [
      [120, 30], [200, 55], [300, 20], [380, 45], [450, 25],
      [150, 70], [350, 65], [250, 15], [420, 70], [80, 80],
    ];
    for (const [sx, sy] of starPositions) {
      ctx.globalAlpha = 0.3 + Math.sin(this._warriorAnimTimer * 0.001 + sx) * 0.2;
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  private drawAuroraParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this._auroraParticles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha * 0.6;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 8, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawSnowParticles(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = COLORS.snowColor;
    for (const p of this._snowParticles) {
      const alpha = Math.min(1, p.life / p.maxLife * 2);
      ctx.globalAlpha = alpha * 0.7;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawWarrior(ctx: CanvasRenderingContext2D): void {
    const cx = WARRIOR_DRAW.centerX;
    const cy = WARRIOR_DRAW.centerY + this._warriorBreathe;
    const scale = this._clickScale;

    // 获取第一个已解锁的英灵战士
    const unlockedWarrior = this._einherjar.find((e) => e.unlocked);
    const warriorDef = unlockedWarrior
      ? EINHERJAR.find((e) => e.id === unlockedWarrior.id)!
      : EINHERJAR[0];

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // 身体阴影
    ctx.beginPath();
    ctx.ellipse(4, WARRIOR_DRAW.bodyHeight * 0.8 + 4, WARRIOR_DRAW.bodyWidth * 0.6, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();

    // 腿
    ctx.fillStyle = '#4A3728';
    ctx.fillRect(-WARRIOR_DRAW.bodyWidth * 0.3, WARRIOR_DRAW.bodyHeight * 0.3, 8, WARRIOR_DRAW.legHeight);
    ctx.fillRect(WARRIOR_DRAW.bodyWidth * 0.05, WARRIOR_DRAW.bodyHeight * 0.3, 8, WARRIOR_DRAW.legHeight);

    // 盾牌（左手）
    ctx.save();
    ctx.translate(-WARRIOR_DRAW.bodyWidth * 0.45, 0);
    ctx.beginPath();
    ctx.arc(0, 0, WARRIOR_DRAW.shieldRadius, 0, Math.PI * 2);
    ctx.fillStyle = warriorDef.shieldColor;
    ctx.fill();
    ctx.strokeStyle = '#8B7355';
    ctx.lineWidth = 2;
    ctx.stroke();
    // 盾牌十字纹
    ctx.beginPath();
    ctx.moveTo(0, -WARRIOR_DRAW.shieldRadius * 0.7);
    ctx.lineTo(0, WARRIOR_DRAW.shieldRadius * 0.7);
    ctx.moveTo(-WARRIOR_DRAW.shieldRadius * 0.7, 0);
    ctx.lineTo(WARRIOR_DRAW.shieldRadius * 0.7, 0);
    ctx.strokeStyle = '#C0A060';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // 剑（右手）
    ctx.save();
    ctx.translate(WARRIOR_DRAW.bodyWidth * 0.35, -WARRIOR_DRAW.bodyHeight * 0.2);
    ctx.rotate(this._swordAngle);
    ctx.fillStyle = '#C0C0C0';
    ctx.fillRect(-2, -WARRIOR_DRAW.swordLength, 4, WARRIOR_DRAW.swordLength);
    // 剑柄
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(-5, 0, 10, 6);
    // 剑尖
    ctx.beginPath();
    ctx.moveTo(-2, -WARRIOR_DRAW.swordLength);
    ctx.lineTo(0, -WARRIOR_DRAW.swordLength - 6);
    ctx.lineTo(2, -WARRIOR_DRAW.swordLength);
    ctx.fillStyle = '#D0D0D0';
    ctx.fill();
    ctx.restore();

    // 身体（铠甲）
    ctx.beginPath();
    ctx.ellipse(0, 0, WARRIOR_DRAW.bodyWidth * 0.5, WARRIOR_DRAW.bodyHeight * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = warriorDef.color;
    ctx.fill();

    // 铠甲纹理
    ctx.beginPath();
    ctx.ellipse(0, WARRIOR_DRAW.bodyHeight * 0.05, WARRIOR_DRAW.bodyWidth * 0.35, WARRIOR_DRAW.bodyHeight * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = warriorDef.shieldColor;
    ctx.fill();

    // 头（头盔）
    ctx.beginPath();
    ctx.arc(0, -WARRIOR_DRAW.bodyHeight * 0.5, WARRIOR_DRAW.headRadius, 0, Math.PI * 2);
    ctx.fillStyle = warriorDef.color;
    ctx.fill();

    // 头盔角
    ctx.beginPath();
    ctx.moveTo(-WARRIOR_DRAW.headRadius * 0.7, -WARRIOR_DRAW.bodyHeight * 0.5 - WARRIOR_DRAW.headRadius * 0.8);
    ctx.lineTo(-WARRIOR_DRAW.headRadius * 0.3, -WARRIOR_DRAW.bodyHeight * 0.5 - WARRIOR_DRAW.headRadius);
    ctx.lineTo(-WARRIOR_DRAW.headRadius * 0.1, -WARRIOR_DRAW.bodyHeight * 0.5 - WARRIOR_DRAW.headRadius * 0.5);
    ctx.fillStyle = warriorDef.shieldColor;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(WARRIOR_DRAW.headRadius * 0.7, -WARRIOR_DRAW.bodyHeight * 0.5 - WARRIOR_DRAW.headRadius * 0.8);
    ctx.lineTo(WARRIOR_DRAW.headRadius * 0.3, -WARRIOR_DRAW.bodyHeight * 0.5 - WARRIOR_DRAW.headRadius);
    ctx.lineTo(WARRIOR_DRAW.headRadius * 0.1, -WARRIOR_DRAW.bodyHeight * 0.5 - WARRIOR_DRAW.headRadius * 0.5);
    ctx.fillStyle = warriorDef.shieldColor;
    ctx.fill();

    // 眼睛
    ctx.beginPath();
    ctx.arc(-5, -WARRIOR_DRAW.bodyHeight * 0.55, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-5, -WARRIOR_DRAW.bodyHeight * 0.55, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = '#1A1A2E';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(5, -WARRIOR_DRAW.bodyHeight * 0.55, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(5, -WARRIOR_DRAW.bodyHeight * 0.55, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = '#1A1A2E';
    ctx.fill();

    // 进化等级指示（卢恩符号）
    if (unlockedWarrior) {
      const evoLevel = unlockedWarrior.evolutionLevel;
      for (let i = 0; i < evoLevel; i++) {
        ctx.fillStyle = COLORS.accent;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ᛟ', -15 + i * 10, -WARRIOR_DRAW.bodyHeight * 0.9);
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
      const icon = res.id === 'iron' ? '⛏️' : res.id === 'glory' ? '⭐' : '🔮';

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
            const icon = id === 'iron' ? '⛏️' : id === 'glory' ? '⭐' : '🔮';
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
    ctx.fillText('空格 点击 · ↑↓ 选择 · Enter 购买 · E 进化 · R 符文 · P 声望', w / 2, h - 10);
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
        // 进化当前选中的英灵战士（第一个已解锁的）
        {
          const unlocked = this._einherjar.find((e) => e.unlocked);
          if (unlocked) this.evolveEinherjar(unlocked.id);
        }
        break;
      case 'r':
      case 'R':
        // 镶嵌第一个未镶嵌的符文
        {
          const uninscribed = this._runes.find((r) => !r.inscribed);
          if (uninscribed) this.inscribeRune(uninscribed.id);
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

  getState(): NorseValkyrieState {
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
      einherjar: this.einherjar,
      runes: this.runes,
      prestige: { ...this.prestige },
      statistics: { ...this._stats },
      selectedIndex: this._selectedIndex,
    };
  }

  /**
   * 从状态恢复
   */
  loadState(state: NorseValkyrieState): void {
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

    // 恢复英灵战士
    if (state.einherjar) {
      for (const einherjarState of state.einherjar) {
        const myEinherjar = this._einherjar.find((e) => e.id === einherjarState.id);
        if (myEinherjar) {
          myEinherjar.unlocked = einherjarState.unlocked;
          if (einherjarState.evolutionLevel !== undefined) {
            myEinherjar.evolutionLevel = einherjarState.evolutionLevel;
          }
        }
      }
    }

    // 恢复符文
    if (state.runes) {
      for (const runeState of state.runes) {
        const myRune = this._runes.find((r) => r.id === runeState.id);
        if (myRune) {
          myRune.inscribed = runeState.inscribed;
        }
      }
    }

    // 恢复声望
    if (state.prestige) {
      this.prestige = { ...state.prestige };
    }

    // 恢复统计
    if (state.statistics) {
      this._stats = { ...state.statistics } as NorseValkyrieStatistics;
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
    // 附加英灵战士和统计信息到 settings
    data.settings = {
      einherjar: this._einherjar,
      runes: this._runes,
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
      if (settings.einherjar) {
        for (const einherjarState of settings.einherjar) {
          const myEinherjar = this._einherjar.find((e) => e.id === einherjarState.id);
          if (myEinherjar) {
            myEinherjar.unlocked = einherjarState.unlocked;
            if (einherjarState.evolutionLevel !== undefined) {
              myEinherjar.evolutionLevel = einherjarState.evolutionLevel;
            }
          }
        }
      }
      if (settings.runes) {
        for (const runeState of settings.runes) {
          const myRune = this._runes.find((r) => r.id === runeState.id);
          if (myRune) {
            myRune.inscribed = runeState.inscribed;
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
