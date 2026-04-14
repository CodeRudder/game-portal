/**
 * 三国志 (Three Kingdoms) — 放置类游戏引擎
 *
 * 继承 IdleGameEngine，实现：
 * - 多资源系统（粮草/金币/兵力）
 * - 建筑升级系统（8个建筑）
 * - 武将招募与升级系统
 * - 声望重置系统（天命）
 * - Canvas 古风水墨风格渲染
 * - 离线收益
 * - 自动存档
 */
import { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { Resource, Upgrade, SaveData } from '@/types/idle';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GRAIN_PER_CLICK,
  MANDATE_BONUS_MULTIPLIER,
  MIN_PRESTIGE_GRAIN,
  GENERALS,
  BUILDINGS,
  COLORS,
  SCENE_DRAW,
  BUILDING_PANEL,
  RESOURCE_PANEL,
  type GeneralDef,
  type BuildingDef,
} from './constants';

/** 武将状态 */
export interface GeneralState {
  id: string;
  unlocked: boolean;
  /** 升级等级 0-5 */
  upgradeLevel: number;
}

/** 游戏统计 */
export interface ThreeKingdomsStatistics {
  totalGrainEarned: number;
  totalClicks: number;
  totalGoldEarned: number;
  totalTroopEarned: number;
  totalPrestigeCount: number;
  totalGeneralsUnlocked: number;
  totalUpgrades: number;
}

/** 三国志游戏状态 */
export interface ThreeKingdomsState {
  [key: string]: unknown;
  resources: Record<string, { amount: number; perSecond: number; unlocked: boolean }>;
  buildings: Record<string, number>;
  generals: GeneralState[];
  prestige: { currency: number; count: number };
  statistics: ThreeKingdomsStatistics;
  selectedIndex: number;
}

/** 武将升级费用表（按升级等级） */
const UPGRADE_COSTS: Record<number, Record<string, number>> = {
  1: { gold: 10, troop: 5 },
  2: { gold: 50, troop: 20, grain: 200 },
  3: { gold: 200, troop: 80, grain: 1000 },
  4: { gold: 800, troop: 300, grain: 5000 },
  5: { gold: 3000, troop: 1000, grain: 20000 },
};

/** 最大升级等级 */
const MAX_UPGRADE_LEVEL = 5;

export class ThreeKingdomsEngine extends IdleGameEngine {
  // ========== 游戏状态 ==========

  protected _gameId = 'three-kingdoms';

  constructor() {
    super();
    // Override base class `statistics` instance field with a getter/setter,
    // because class fields shadow prototype accessors.
    Object.defineProperty(this, 'statistics', {
      get: () => ({ ...this._stats }) as ThreeKingdomsStatistics,
      set: (_val: Record<string, number>) => { /* base class writes are no-ops */ },
      configurable: true,
      enumerable: true,
    });
  }

  /** 武将状态 */
  private _generals: GeneralState[] = GENERALS.map((g) => ({
    id: g.id,
    unlocked: g.id === 'liubei', // 刘备初始解锁
    upgradeLevel: 0,
  }));

  /** 当前选中的建筑索引 */
  private _selectedIndex: number = 0;

  /** 统计数据 */
  private _stats: ThreeKingdomsStatistics = {
    totalGrainEarned: 0,
    totalClicks: 0,
    totalGoldEarned: 0,
    totalTroopEarned: 0,
    totalPrestigeCount: 0,
    totalGeneralsUnlocked: 1,
    totalUpgrades: 0,
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

  /** 武将动画计时器 */
  private _generalAnimTimer: number = 0;
  /** 武将呼吸缩放 */
  private _generalBreathe: number = 0;
  /** 点击缩放效果 */
  private _clickScale: number = 1;
  private _clickAnimTimer: number = 0;
  /** 旗帜飘动角度 */
  private _flagAngle: number = 0;
  /** 云朵偏移 */
  private _cloudOffset: number = 0;
  /** 粒子效果 */
  private _particles: Array<{
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

  get generals(): GeneralState[] {
    return this._generals.map((g) => ({ ...g }));
  }

  get totalGrainEarned(): number {
    return this._stats.totalGrainEarned;
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
        id: 'grain',
        name: '粮草',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e15,
        unlocked: true,
      },
      {
        id: 'gold',
        name: '金币',
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
        unlocked: b.id === 'farm', // 农田初始解锁
        requires: b.requires,
        icon: b.icon,
      }))
    );

    // 重置状态
    this._generals = GENERALS.map((g) => ({
      id: g.id,
      unlocked: g.id === 'liubei',
      upgradeLevel: 0,
    }));
    this._selectedIndex = 0;
    this._stats = {
      totalGrainEarned: 0,
      totalClicks: 0,
      totalGoldEarned: 0,
      totalTroopEarned: 0,
      totalPrestigeCount: 0,
      totalGeneralsUnlocked: 1,
      totalUpgrades: 0,
    };
    this._floatingTexts = [];
    this._generalAnimTimer = 0;
    this._generalBreathe = 0;
    this._clickScale = 1;
    this._clickAnimTimer = 0;
    this._flagAngle = 0;
    this._cloudOffset = 0;
    this._particles = [];
  }

  protected onUpdate(deltaTime: number): void {
    // 武将动画
    this._generalAnimTimer += deltaTime;
    this._generalBreathe = Math.sin(this._generalAnimTimer * 0.002) * 2;
    this._flagAngle = Math.sin(this._generalAnimTimer * 0.003) * 0.3;

    // 云朵移动
    this._cloudOffset += deltaTime * 0.01;

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

    // 粒子更新
    this._particles = this._particles.filter((p) => {
      p.life -= deltaTime;
      p.x += p.vx * (deltaTime / 1000);
      p.y += p.vy * (deltaTime / 1000);
      p.vy += 30 * (deltaTime / 1000); // 重力
      return p.life > 0;
    });

    // 随机产生粒子（灯笼火星）
    if (Math.random() < 0.03) {
      this._particles.push({
        x: 60 + Math.random() * 20,
        y: 100 + Math.random() * 10,
        vx: (Math.random() - 0.5) * 15,
        vy: -15 - Math.random() * 20,
        life: 1200 + Math.random() * 800,
        maxLife: 2000,
      });
    }

    // 统计资源产出
    const grain = this.getResource('grain');
    if (grain && grain.perSecond > 0) {
      this._stats.totalGrainEarned += grain.perSecond * (deltaTime / 1000);
    }
    const gold = this.getResource('gold');
    if (gold && gold.perSecond > 0) {
      this._stats.totalGoldEarned += gold.perSecond * (deltaTime / 1000);
    }
    const troop = this.getResource('troop');
    if (troop && troop.perSecond > 0) {
      this._stats.totalTroopEarned += troop.perSecond * (deltaTime / 1000);
    }

    // 检查建筑解锁条件
    this.checkBuildingUnlocks();
    // 检查资源解锁条件
    this.checkResourceUnlocks();
  }

  // ========== 核心玩法 ==========

  /**
   * 点击获得粮草
   */
  click(): number {
    if (this._status !== 'playing') return 0;

    let gained = GRAIN_PER_CLICK;

    // 武将点击加成
    gained *= this.getClickMultiplier();

    // 声望加成
    gained *= this.getPrestigeMultiplier();

    gained = Math.floor(gained * 100) / 100;

    this.addResource('grain', gained);
    this._stats.totalGrainEarned += gained;
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
      x: SCENE_DRAW.centerX + Math.cos(angle) * dist,
      y: SCENE_DRAW.centerY + Math.sin(angle) * dist - 30,
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
   * 解锁武将
   */
  unlockGeneral(generalId: string): boolean {
    const generalDef = GENERALS.find((g) => g.id === generalId);
    if (!generalDef) return false;

    const generalState = this._generals.find((g) => g.id === generalId);
    if (!generalState || generalState.unlocked) return false;

    if (!this.hasResource('grain', generalDef.unlockCost)) return false;

    this.spendResource('grain', generalDef.unlockCost);
    generalState.unlocked = true;
    this._stats.totalGeneralsUnlocked++;

    // 重新计算产出（武将加成可能影响产出）
    this.recalculateProduction();

    this.emit('generalUnlocked', generalId);
    this.emit('stateChange');
    return true;
  }

  /**
   * 升级武将
   */
  upgradeGeneral(generalId: string): boolean {
    const generalState = this._generals.find((g) => g.id === generalId);
    if (!generalState || !generalState.unlocked) return false;

    const nextLevel = generalState.upgradeLevel + 1;
    if (nextLevel > MAX_UPGRADE_LEVEL) return false;

    const cost = this.getGeneralUpgradeCost(nextLevel);
    if (!this.canAfford(cost)) return false;

    // 扣除资源
    for (const [resId, amount] of Object.entries(cost)) {
      this.spendResource(resId, amount);
    }

    generalState.upgradeLevel = nextLevel;
    this._stats.totalUpgrades++;

    // 重新计算产出
    this.recalculateProduction();

    this.emit('generalUpgraded', generalId, nextLevel);
    this.emit('stateChange');
    return true;
  }

  /**
   * 获取武将升级费用
   */
  getGeneralUpgradeCost(level: number): Record<string, number> {
    return UPGRADE_COSTS[level] ? { ...UPGRADE_COSTS[level] } : {};
  }

  /**
   * 获取武将升级等级
   */
  getGeneralUpgradeLevel(generalId: string): number {
    const general = this._generals.find((g) => g.id === generalId);
    return general ? general.upgradeLevel : 0;
  }

  /**
   * 声望重置
   */
  doPrestige(): number {
    const grain = this.getResource('grain');
    if (!grain || this._stats.totalGrainEarned < MIN_PRESTIGE_GRAIN) return 0;

    // 计算获得的天命
    const mandatesGained = Math.floor(
      Math.sqrt(this._stats.totalGrainEarned / MIN_PRESTIGE_GRAIN)
    );

    if (mandatesGained <= 0) return 0;

    // 保存天命
    const prevMandates = this.prestige.currency;
    this.prestige.currency += mandatesGained;
    this.prestige.count++;
    this._stats.totalPrestigeCount++;

    // 重置资源和建筑（保留天命和声望数据）
    const savedPrestige = { ...this.prestige };
    const savedStats = {
      ...this._stats,
      totalGrainEarned: 0,
      totalClicks: 0,
      totalGoldEarned: 0,
      totalTroopEarned: 0,
    };

    // 保存武将升级等级（声望保留升级等级）
    const savedGeneralUpgrades = this._generals.map((g) => ({
      id: g.id,
      upgradeLevel: g.upgradeLevel,
      unlocked: g.unlocked,
    }));

    // 重置
    this.onInit();

    // 恢复声望和部分统计
    this.prestige = savedPrestige;
    this._stats = savedStats as ThreeKingdomsStatistics;

    // 恢复武将升级等级
    for (const saved of savedGeneralUpgrades) {
      const general = this._generals.find((g) => g.id === saved.id);
      if (general) {
        general.upgradeLevel = saved.upgradeLevel;
        general.unlocked = saved.unlocked;
      }
    }

    this.emit('prestige', mandatesGained);
    this.emit('stateChange');
    return mandatesGained;
  }

  /**
   * 获取声望加成倍率
   */
  getPrestigeMultiplier(): number {
    return 1 + this.prestige.currency * MANDATE_BONUS_MULTIPLIER;
  }

  /**
   * 获取点击加成倍率
   */
  getClickMultiplier(): number {
    let multiplier = 1;
    for (const general of this._generals) {
      if (!general.unlocked) continue;
      const def = GENERALS.find((g) => g.id === general.id);
      if (!def) continue;
      if (def.bonusType === 'click' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        // 升级加成
        bonus *= Math.pow(def.upgradeMultiplier, general.upgradeLevel);
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
    for (const general of this._generals) {
      if (!general.unlocked) continue;
      const def = GENERALS.find((g) => g.id === general.id);
      if (!def) continue;
      if (def.bonusType === 'production' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.upgradeMultiplier, general.upgradeLevel);
        multiplier += bonus;
      }
    }
    // 声望加成
    multiplier *= this.getPrestigeMultiplier();
    return multiplier;
  }

  /**
   * 获取金币加成倍率
   */
  getGoldMultiplier(): number {
    let multiplier = 1;
    for (const general of this._generals) {
      if (!general.unlocked) continue;
      const def = GENERALS.find((g) => g.id === general.id);
      if (!def) continue;
      if (def.bonusType === 'gold' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.upgradeMultiplier, general.upgradeLevel);
        multiplier += bonus;
      }
    }
    return multiplier;
  }

  /**
   * 获取兵力加成倍率
   */
  getTroopMultiplier(): number {
    let multiplier = 1;
    for (const general of this._generals) {
      if (!general.unlocked) continue;
      const def = GENERALS.find((g) => g.id === general.id);
      if (!def) continue;
      if (def.bonusType === 'troop' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.upgradeMultiplier, general.upgradeLevel);
        multiplier += bonus;
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
   * 获取预览声望天命数
   */
  getPrestigePreview(): number {
    if (this._stats.totalGrainEarned < MIN_PRESTIGE_GRAIN) return 0;
    return Math.floor(
      Math.sqrt(this._stats.totalGrainEarned / MIN_PRESTIGE_GRAIN)
    );
  }

  /**
   * 检查是否可以声望
   */
  canPrestige(): boolean {
    return this._stats.totalGrainEarned >= MIN_PRESTIGE_GRAIN;
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
      if (building.productionResource === 'grain') {
        production *= this.getProductionMultiplier();
      } else if (building.productionResource === 'gold') {
        production *= this.getGoldMultiplier() * this.getPrestigeMultiplier();
      } else if (building.productionResource === 'troop') {
        production *= this.getTroopMultiplier() * this.getPrestigeMultiplier();
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
    // 金币：集市等级 >= 1 时解锁
    const market = this.upgrades.get('market');
    if (market && market.level >= 1) {
      const gold = this.resources.get('gold');
      if (gold && !gold.unlocked) {
        gold.unlocked = true;
        this.emit('resourceUnlocked', 'gold');
      }
    }

    // 兵力：兵营等级 >= 1 时解锁
    const barracks = this.upgrades.get('barracks');
    if (barracks && barracks.level >= 1) {
      const troop = this.resources.get('troop');
      if (troop && !troop.unlocked) {
        troop.unlocked = true;
        this.emit('resourceUnlocked', 'troop');
      }
    }
  }

  // ========== 渲染 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawParticles(ctx);
    this.drawGeneral(ctx);
    this.drawFloatingTexts(ctx);
    this.drawResourcePanel(ctx, w);
    this.drawBuildingList(ctx, w, h);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 天空渐变（古风夜色）
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

    // 地面纹理（小石头）
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < 25; i++) {
      const x = ((i * 73 + 17) % w);
      const y = h * 0.45 + ((i * 47 + 23) % (h * 0.55));
      ctx.fillStyle = '#2C3E50';
      ctx.fillRect(x, y, 3, 2);
    }
    ctx.globalAlpha = 1;

    // 远山
    this.drawMountains(ctx, w, h);

    // 江河
    this.drawRiver(ctx, w, h);

    // 月亮
    ctx.beginPath();
    ctx.arc(70, 55, 22, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF8E1';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(70, 55, 28, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.moonGlow;
    ctx.fill();

    // 云朵
    this.drawClouds(ctx, w);

    // 灯笼
    this.drawLantern(ctx, 60, 90);
    this.drawLantern(ctx, w - 60, 90);
  }

  private drawMountains(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 远山
    ctx.fillStyle = COLORS.mountainFar;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.lineTo(60, h * 0.32);
    ctx.lineTo(120, h * 0.42);
    ctx.lineTo(180, h * 0.28);
    ctx.lineTo(250, h * 0.4);
    ctx.lineTo(320, h * 0.3);
    ctx.lineTo(400, h * 0.38);
    ctx.lineTo(w, h * 0.5);
    ctx.closePath();
    ctx.fill();

    // 近山
    ctx.fillStyle = COLORS.mountainNear;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.lineTo(80, h * 0.38);
    ctx.lineTo(160, h * 0.46);
    ctx.lineTo(240, h * 0.35);
    ctx.lineTo(350, h * 0.44);
    ctx.lineTo(w, h * 0.5);
    ctx.closePath();
    ctx.fill();
  }

  private drawRiver(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = COLORS.waterColor;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.48);
    ctx.quadraticCurveTo(w * 0.25, h * 0.44, w * 0.5, h * 0.48);
    ctx.quadraticCurveTo(w * 0.75, h * 0.52, w, h * 0.47);
    ctx.lineTo(w, h * 0.52);
    ctx.quadraticCurveTo(w * 0.75, h * 0.56, w * 0.5, h * 0.52);
    ctx.quadraticCurveTo(w * 0.25, h * 0.48, 0, h * 0.52);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private drawClouds(ctx: CanvasRenderingContext2D, w: number): void {
    ctx.fillStyle = COLORS.cloudColor;
    const offset = this._cloudOffset % (w + 100);
    for (let i = 0; i < 3; i++) {
      const cx = ((offset + i * 180) % (w + 100)) - 50;
      const cy = 30 + i * 25;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 40, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 20, cy - 5, 25, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawLantern(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    // 绳子
    ctx.strokeStyle = '#8D6E63';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y - 20);
    ctx.lineTo(x, y);
    ctx.stroke();

    // 灯笼体
    ctx.fillStyle = '#FF5722';
    ctx.beginPath();
    ctx.ellipse(x, y + 8, 8, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // 灯笼顶/底
    ctx.fillStyle = '#FFB300';
    ctx.fillRect(x - 5, y - 2, 10, 3);
    ctx.fillRect(x - 5, y + 17, 10, 3);

    // 发光效果
    ctx.fillStyle = 'rgba(255, 87, 34, 0.15)';
    ctx.beginPath();
    ctx.arc(x, y + 8, 20, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this._particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#FFB300';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawGeneral(ctx: CanvasRenderingContext2D): void {
    const cx = SCENE_DRAW.centerX;
    const cy = SCENE_DRAW.centerY + this._generalBreathe;
    const scale = this._clickScale;

    // 获取第一个已解锁的武将
    const unlockedGeneral = this._generals.find((g) => g.unlocked);
    const generalDef = unlockedGeneral
      ? GENERALS.find((g) => g.id === unlockedGeneral.id)!
      : GENERALS[0];

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // 身体阴影
    ctx.beginPath();
    ctx.ellipse(4, SCENE_DRAW.bodyHeight * 0.8 + 4, SCENE_DRAW.bodyWidth * 0.6, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.generalShadow;
    ctx.fill();

    // 腿
    ctx.fillStyle = generalDef.color;
    ctx.fillRect(-SCENE_DRAW.bodyWidth * 0.3, SCENE_DRAW.bodyHeight * 0.3, 7, SCENE_DRAW.legHeight);
    ctx.fillRect(SCENE_DRAW.bodyWidth * 0.1, SCENE_DRAW.bodyHeight * 0.3, 7, SCENE_DRAW.legHeight);

    // 旗帜（背后飘动）
    ctx.save();
    ctx.translate(SCENE_DRAW.bodyWidth * 0.4, -SCENE_DRAW.bodyHeight * 0.3);
    ctx.rotate(this._flagAngle);
    ctx.fillStyle = generalDef.subColor;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(15, -8, 30, -3);
    ctx.lineTo(30, 15);
    ctx.quadraticCurveTo(15, 10, 0, 15);
    ctx.closePath();
    ctx.fill();
    // 旗杆
    ctx.strokeStyle = '#8D6E63';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(0, 20);
    ctx.stroke();
    ctx.restore();

    // 身体（长袍）
    ctx.beginPath();
    ctx.ellipse(0, 0, SCENE_DRAW.bodyWidth * 0.45, SCENE_DRAW.bodyHeight * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = generalDef.color;
    ctx.fill();

    // 腰带
    ctx.fillStyle = generalDef.subColor;
    ctx.fillRect(-SCENE_DRAW.bodyWidth * 0.35, SCENE_DRAW.bodyHeight * 0.05, SCENE_DRAW.bodyWidth * 0.7, 4);

    // 头
    ctx.beginPath();
    ctx.arc(-SCENE_DRAW.bodyWidth * 0.15, -SCENE_DRAW.bodyHeight * 0.55, SCENE_DRAW.headRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#FFCC80';
    ctx.fill();

    // 头冠/头盔
    ctx.fillStyle = generalDef.color;
    ctx.beginPath();
    ctx.arc(-SCENE_DRAW.bodyWidth * 0.15, -SCENE_DRAW.bodyHeight * 0.65, SCENE_DRAW.headRadius * 0.7, Math.PI, 0);
    ctx.fill();

    // 眼睛
    ctx.beginPath();
    ctx.arc(-SCENE_DRAW.bodyWidth * 0.22, -SCENE_DRAW.bodyHeight * 0.55, SCENE_DRAW.eyeRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-SCENE_DRAW.bodyWidth * 0.22, -SCENE_DRAW.bodyHeight * 0.55, SCENE_DRAW.eyeRadius * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = '#2C2C2C';
    ctx.fill();

    // 眼睛高光
    ctx.beginPath();
    ctx.arc(-SCENE_DRAW.bodyWidth * 0.22 + 1, -SCENE_DRAW.bodyHeight * 0.55 - 1, 1, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // 武器
    ctx.save();
    ctx.translate(SCENE_DRAW.bodyWidth * 0.35, -SCENE_DRAW.bodyHeight * 0.2);
    ctx.rotate(-0.3);
    ctx.fillStyle = '#8D6E63';
    ctx.fillRect(-2, -SCENE_DRAW.weaponLength, 4, SCENE_DRAW.weaponLength);
    // 刀刃
    ctx.fillStyle = '#B0BEC5';
    ctx.beginPath();
    ctx.moveTo(-2, -SCENE_DRAW.weaponLength);
    ctx.lineTo(0, -SCENE_DRAW.weaponLength - 15);
    ctx.lineTo(2, -SCENE_DRAW.weaponLength);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 升级等级指示（小星星）
    if (unlockedGeneral) {
      const upgLevel = unlockedGeneral.upgradeLevel;
      for (let i = 0; i < upgLevel; i++) {
        ctx.fillStyle = COLORS.accent;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★', -SCENE_DRAW.bodyWidth * 0.15 - 12 + i * 10, -SCENE_DRAW.bodyHeight * 0.85);
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
      const icon = res.id === 'grain' ? '🌾' : res.id === 'gold' ? '🪙' : '⚔️';

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
            const icon = id === 'grain' ? '🌾' : id === 'gold' ? '🪙' : '⚔️';
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
    ctx.fillText('空格 点击 · ↑↓ 选择 · Enter 购买 · U 升级武将 · P 声望', w / 2, h - 10);
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
      case 'u':
      case 'U':
        // 升级当前选中的武将（第一个已解锁的）
        {
          const unlocked = this._generals.find((g) => g.unlocked);
          if (unlocked) this.upgradeGeneral(unlocked.id);
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

  getState(): ThreeKingdomsState {
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
      generals: this.generals,
      prestige: { ...this.prestige },
      statistics: { ...this._stats },
      selectedIndex: this._selectedIndex,
    };
  }

  /**
   * 从状态恢复
   */
  loadState(state: ThreeKingdomsState): void {
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

    // 恢复武将
    if (state.generals) {
      for (const generalState of state.generals) {
        const myGeneral = this._generals.find((g) => g.id === generalState.id);
        if (myGeneral) {
          myGeneral.unlocked = generalState.unlocked;
          if (generalState.upgradeLevel !== undefined) {
            myGeneral.upgradeLevel = generalState.upgradeLevel;
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
      this._stats = { ...state.statistics } as ThreeKingdomsStatistics;
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
    // 附加武将和统计信息到 settings
    data.settings = {
      generals: this._generals,
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
      if (settings.generals) {
        for (const generalState of settings.generals) {
          const myGeneral = this._generals.find((g) => g.id === generalState.id);
          if (myGeneral) {
            myGeneral.unlocked = generalState.unlocked;
            if (generalState.upgradeLevel !== undefined) {
              myGeneral.upgradeLevel = generalState.upgradeLevel;
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
    }

    this.recalculateProduction();
  }
}
