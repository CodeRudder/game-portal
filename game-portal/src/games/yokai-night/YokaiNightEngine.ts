/**
 * 日本妖怪 (Yokai Night) — 放置类游戏引擎
 *
 * 继承 IdleGameEngine，实现：
 * - 多资源系统（灵力/妖怪币/御守）
 * - 建筑升级系统
 * - 妖怪品种解锁与进化
 * - 声望重置系统（御守）
 * - Canvas 和风渲染
 * - 离线收益
 * - 自动存档
 */
import { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { Resource, Upgrade, SaveData } from '@/types/idle';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SPIRIT_PER_CLICK,
  OMAMORI_BONUS_MULTIPLIER,
  PRESTIGE_BASE_OMAMORI,
  MIN_PRESTIGE_SPIRIT,
  YOKAI_BREEDS,
  BUILDINGS,
  COLORS,
  YOKAI_DRAW,
  BUILDING_PANEL,
  RESOURCE_PANEL,
  type YokaiBreedDef,
  type BuildingDef,
} from './constants';

/** 妖怪品种状态 */
export interface YokaiBreedState {
  id: string;
  unlocked: boolean;
  /** 进化等级 0-5 */
  evolutionLevel: number;
}

/** 游戏统计 */
export interface YokaiNightStatistics {
  totalSpiritEarned: number;
  totalClicks: number;
  totalCoinsEarned: number;
  totalOmamoriEarned: number;
  totalPrestigeCount: number;
  totalYokaiUnlocked: number;
  totalEvolutions: number;
}

/** 日本妖怪游戏状态 */
export interface YokaiNightState {
  [key: string]: unknown;
  resources: Record<string, { amount: number; perSecond: number; unlocked: boolean }>;
  buildings: Record<string, number>;
  yokai: YokaiBreedState[];
  prestige: { currency: number; count: number };
  statistics: YokaiNightStatistics;
  selectedIndex: number;
}

/** 进化费用表（按进化等级） */
const EVOLUTION_COSTS: Record<number, Record<string, number>> = {
  1: { yokai_coin: 10, omamori: 5 },
  2: { yokai_coin: 50, omamori: 20, spirit: 500 },
  3: { yokai_coin: 200, omamori: 80, spirit: 2000 },
  4: { yokai_coin: 800, omamori: 300, spirit: 8000 },
  5: { yokai_coin: 3000, omamori: 1000, spirit: 30000 },
};

/** 最大进化等级 */
const MAX_EVOLUTION_LEVEL = 5;

export class YokaiNightEngine extends IdleGameEngine {
  // ========== 游戏状态 ==========

  protected _gameId = 'yokai-night';

  constructor() {
    super();
    // Override base class `statistics` instance field with a getter/setter,
    // because class fields shadow prototype accessors.
    Object.defineProperty(this, 'statistics', {
      get: () => ({ ...this._stats }) as YokaiNightStatistics,
      set: (_val: Record<string, number>) => { /* base class writes are no-ops */ },
      configurable: true,
      enumerable: true,
    });
  }

  /** 妖怪品种状态 */
  private _yokai: YokaiBreedState[] = YOKAI_BREEDS.map((y) => ({
    id: y.id,
    unlocked: y.id === 'kitsune', // 狐火初始解锁
    evolutionLevel: 0,
  }));

  /** 当前选中的建筑索引 */
  private _selectedIndex: number = 0;

  /** 统计数据 */
  private _stats: YokaiNightStatistics = {
    totalSpiritEarned: 0,
    totalClicks: 0,
    totalCoinsEarned: 0,
    totalOmamoriEarned: 0,
    totalPrestigeCount: 0,
    totalYokaiUnlocked: 1,
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

  /** 妖怪动画计时器 */
  private _yokaiAnimTimer: number = 0;
  /** 妖怪尾巴摆动角度 */
  private _tailAngle: number = 0;
  /** 妖怪呼吸缩放 */
  private _yokaiBreathe: number = 0;
  /** 点击缩放效果 */
  private _clickScale: number = 1;
  private _clickAnimTimer: number = 0;
  /** 灯笼粒子 */
  private _lanternParticles: Array<{
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

  get yokai(): YokaiBreedState[] {
    return this._yokai.map((y) => ({ ...y }));
  }

  get totalSpiritEarned(): number {
    return this._stats.totalSpiritEarned;
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
        id: 'spirit',
        name: '灵力',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e15,
        unlocked: true,
      },
      {
        id: 'yokai_coin',
        name: '妖怪币',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e12,
        unlocked: false,
      },
      {
        id: 'omamori',
        name: '御守',
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
        unlocked: b.id === 'torii_gate', // 鸟居初始解锁
        requires: b.requires,
        icon: b.icon,
      }))
    );

    // 重置状态
    this._yokai = YOKAI_BREEDS.map((y) => ({
      id: y.id,
      unlocked: y.id === 'kitsune',
      evolutionLevel: 0,
    }));
    this._selectedIndex = 0;
    this._stats = {
      totalSpiritEarned: 0,
      totalClicks: 0,
      totalCoinsEarned: 0,
      totalOmamoriEarned: 0,
      totalPrestigeCount: 0,
      totalYokaiUnlocked: 1,
      totalEvolutions: 0,
    };
    this._floatingTexts = [];
    this._yokaiAnimTimer = 0;
    this._tailAngle = 0;
    this._yokaiBreathe = 0;
    this._clickScale = 1;
    this._clickAnimTimer = 0;
    this._lanternParticles = [];
    this._stats.totalSpiritEarned = 0;
    this._stats.totalClicks = 0;
  }

  protected onUpdate(deltaTime: number): void {
    // 妖怪动画
    this._yokaiAnimTimer += deltaTime;
    this._tailAngle = Math.sin(this._yokaiAnimTimer * 0.004) * 0.5;
    this._yokaiBreathe = Math.sin(this._yokaiAnimTimer * 0.002) * 2;

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

    // 灯笼粒子更新
    this._lanternParticles = this._lanternParticles.filter((p) => {
      p.life -= deltaTime;
      p.x += p.vx * (deltaTime / 1000);
      p.y += p.vy * (deltaTime / 1000);
      p.vy += 50 * (deltaTime / 1000); // 重力
      return p.life > 0;
    });

    // 随机产生灯笼粒子
    if (Math.random() < 0.02) {
      this._lanternParticles.push({
        x: 420 + Math.random() * 20,
        y: 120 + Math.random() * 10,
        vx: (Math.random() - 0.5) * 30,
        vy: -20 - Math.random() * 30,
        life: 1500 + Math.random() * 1000,
        maxLife: 2500,
      });
    }

    // 统计资源产出
    const spirit = this.getResource('spirit');
    if (spirit && spirit.perSecond > 0) {
      this._stats.totalSpiritEarned += spirit.perSecond * (deltaTime / 1000);
    }
    const coins = this.getResource('yokai_coin');
    if (coins && coins.perSecond > 0) {
      this._stats.totalCoinsEarned += coins.perSecond * (deltaTime / 1000);
    }
    const omamori = this.getResource('omamori');
    if (omamori && omamori.perSecond > 0) {
      this._stats.totalOmamoriEarned += omamori.perSecond * (deltaTime / 1000);
    }

    // 检查建筑解锁条件
    this.checkBuildingUnlocks();
    // 检查资源解锁条件
    this.checkResourceUnlocks();
  }

  // ========== 核心玩法 ==========

  /**
   * 点击获得灵力
   */
  click(): number {
    if (this._status !== 'playing') return 0;

    let gained = SPIRIT_PER_CLICK;

    // 妖怪点击加成
    gained *= this.getClickMultiplier();

    // 声望加成
    gained *= this.getPrestigeMultiplier();

    gained = Math.floor(gained * 100) / 100;

    this.addResource('spirit', gained);
    this._stats.totalSpiritEarned += gained;
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
      x: YOKAI_DRAW.centerX + Math.cos(angle) * dist,
      y: YOKAI_DRAW.centerY + Math.sin(angle) * dist - 30,
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
   * 解锁妖怪品种
   */
  unlockYokai(breedId: string): boolean {
    const breedDef = YOKAI_BREEDS.find((b) => b.id === breedId);
    if (!breedDef) return false;

    const yokaiState = this._yokai.find((y) => y.id === breedId);
    if (!yokaiState || yokaiState.unlocked) return false;

    if (!this.hasResource('spirit', breedDef.unlockCost)) return false;

    this.spendResource('spirit', breedDef.unlockCost);
    yokaiState.unlocked = true;
    this._stats.totalYokaiUnlocked++;

    // 重新计算产出（妖怪加成可能影响产出）
    this.recalculateProduction();

    this.emit('yokaiUnlocked', breedId);
    this.emit('stateChange');
    return true;
  }

  /**
   * 进化妖怪
   */
  evolveYokai(breedId: string): boolean {
    const yokaiState = this._yokai.find((y) => y.id === breedId);
    if (!yokaiState || !yokaiState.unlocked) return false;

    const nextLevel = yokaiState.evolutionLevel + 1;
    if (nextLevel > MAX_EVOLUTION_LEVEL) return false;

    const cost = this.getEvolutionCost(nextLevel);
    if (!this.canAfford(cost)) return false;

    // 扣除资源
    for (const [resId, amount] of Object.entries(cost)) {
      this.spendResource(resId, amount);
    }

    yokaiState.evolutionLevel = nextLevel;
    this._stats.totalEvolutions++;

    // 重新计算产出
    this.recalculateProduction();

    this.emit('yokaiEvolved', breedId, nextLevel);
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
   * 获取妖怪进化等级
   */
  getYokaiEvolutionLevel(breedId: string): number {
    const yokai = this._yokai.find((y) => y.id === breedId);
    return yokai ? yokai.evolutionLevel : 0;
  }

  /**
   * 声望重置
   */
  doPrestige(): number {
    const spirit = this.getResource('spirit');
    if (!spirit || this._stats.totalSpiritEarned < MIN_PRESTIGE_SPIRIT) return 0;

    // 计算获得的御守
    const omamoriGained = Math.floor(
      PRESTIGE_BASE_OMAMORI * Math.sqrt(this._stats.totalSpiritEarned / MIN_PRESTIGE_SPIRIT)
    );

    if (omamoriGained <= 0) return 0;

    // 保存妖怪进化等级（声望保留进化等级）
    const savedYokaiEvolutions = this._yokai.map((y) => ({
      id: y.id,
      evolutionLevel: y.evolutionLevel,
      unlocked: y.unlocked,
    }));

    // 保存部分统计
    const savedStats = {
      ...this._stats,
      totalSpiritEarned: 0,
      totalClicks: 0,
      totalCoinsEarned: 0,
      totalOmamoriEarned: 0,
    };

    // 重置
    this.onInit();

    // 恢复声望（先恢复再增加）
    this.prestige.currency += omamoriGained;
    this.prestige.count++;
    this._stats.totalPrestigeCount++;

    // 恢复部分统计
    this._stats = savedStats as YokaiNightStatistics;

    // 恢复妖怪进化等级
    for (const saved of savedYokaiEvolutions) {
      const yokai = this._yokai.find((y) => y.id === saved.id);
      if (yokai) {
        yokai.evolutionLevel = saved.evolutionLevel;
        yokai.unlocked = saved.unlocked;
      }
    }

    this.emit('prestige', omamoriGained);
    this.emit('stateChange');
    return omamoriGained;
  }

  /**
   * 获取声望加成倍率
   */
  getPrestigeMultiplier(): number {
    return 1 + this.prestige.currency * OMAMORI_BONUS_MULTIPLIER;
  }

  /**
   * 获取点击加成倍率
   */
  getClickMultiplier(): number {
    let multiplier = 1;
    for (const yokai of this._yokai) {
      if (!yokai.unlocked) continue;
      const def = YOKAI_BREEDS.find((b) => b.id === yokai.id);
      if (!def) continue;
      if (def.bonusType === 'click' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        // 进化加成
        bonus *= Math.pow(def.evolutionMultiplier, yokai.evolutionLevel);
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
    for (const yokai of this._yokai) {
      if (!yokai.unlocked) continue;
      const def = YOKAI_BREEDS.find((b) => b.id === yokai.id);
      if (!def) continue;
      if (def.bonusType === 'production' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.evolutionMultiplier, yokai.evolutionLevel);
        multiplier += bonus;
      }
    }
    // 声望加成
    multiplier *= this.getPrestigeMultiplier();
    return multiplier;
  }

  /**
   * 获取妖怪币加成倍率
   */
  getCoinMultiplier(): number {
    let multiplier = 1;
    for (const yokai of this._yokai) {
      if (!yokai.unlocked) continue;
      const def = YOKAI_BREEDS.find((b) => b.id === yokai.id);
      if (!def) continue;
      if (def.bonusType === 'coin' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.evolutionMultiplier, yokai.evolutionLevel);
        multiplier += bonus;
      }
    }
    return multiplier;
  }

  /**
   * 获取御守加成倍率
   */
  getOmamoriMultiplier(): number {
    let multiplier = 1;
    for (const yokai of this._yokai) {
      if (!yokai.unlocked) continue;
      const def = YOKAI_BREEDS.find((b) => b.id === yokai.id);
      if (!def) continue;
      if (def.bonusType === 'omamori' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.evolutionMultiplier, yokai.evolutionLevel);
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
   * 获取预览声望御守数
   */
  getPrestigePreview(): number {
    if (this._stats.totalSpiritEarned < MIN_PRESTIGE_SPIRIT) return 0;
    return Math.floor(
      PRESTIGE_BASE_OMAMORI * Math.sqrt(this._stats.totalSpiritEarned / MIN_PRESTIGE_SPIRIT)
    );
  }

  /**
   * 检查是否可以声望
   */
  canPrestige(): boolean {
    return this._stats.totalSpiritEarned >= MIN_PRESTIGE_SPIRIT;
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
      if (building.productionResource === 'spirit') {
        production *= this.getProductionMultiplier();
      } else if (building.productionResource === 'yokai_coin') {
        production *= this.getCoinMultiplier() * this.getPrestigeMultiplier();
      } else if (building.productionResource === 'omamori') {
        production *= this.getOmamoriMultiplier() * this.getPrestigeMultiplier();
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
    // 妖怪币：鸟居等级 >= 5 时解锁
    const torii = this.upgrades.get('torii_gate');
    if (torii && torii.level >= 5) {
      const coins = this.resources.get('yokai_coin');
      if (coins && !coins.unlocked) {
        coins.unlocked = true;
        this.emit('resourceUnlocked', 'yokai_coin');
      }
    }

    // 御守：灵堂等级 >= 3 时解锁
    const shrine = this.upgrades.get('spirit_shrine');
    if (shrine && shrine.level >= 3) {
      const omamori = this.resources.get('omamori');
      if (omamori && !omamori.unlocked) {
        omamori.unlocked = true;
        this.emit('resourceUnlocked', 'omamori');
      }
    }
  }

  // ========== 渲染 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawLanternParticles(ctx);
    this.drawYokai(ctx);
    this.drawFloatingTexts(ctx);
    this.drawResourcePanel(ctx, w);
    this.drawBuildingList(ctx, w, h);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 天空渐变（靛蓝夜空）
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

    // 地面纹理（和风小石子）
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < 30; i++) {
      const x = ((i * 73 + 17) % w);
      const y = h * 0.45 + ((i * 47 + 23) % (h * 0.55));
      ctx.fillStyle = '#3D3D5C';
      ctx.fillRect(x, y, 3, 2);
    }
    ctx.globalAlpha = 1;

    // 远处的小山
    ctx.fillStyle = '#2D2D44';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.quadraticCurveTo(80, h * 0.38, 160, h * 0.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(200, h * 0.5);
    ctx.quadraticCurveTo(300, h * 0.35, 380, h * 0.5);
    ctx.fill();

    // 鸟居
    this.drawTorii(ctx, w);

    // 月亮
    ctx.beginPath();
    ctx.arc(60, 50, 20, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.moonGlow;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(60, 50, 24, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 224, 178, 0.15)';
    ctx.fill();
  }

  private drawTorii(ctx: CanvasRenderingContext2D, w: number): void {
    const tx = w - 80;
    const ty = 60;

    // 鸟居柱子
    ctx.fillStyle = '#B71C1C';
    ctx.fillRect(tx - 35, ty, 6, 140);
    ctx.fillRect(tx + 29, ty, 6, 140);

    // 鸟居横梁
    ctx.fillStyle = '#C62828';
    ctx.fillRect(tx - 45, ty, 90, 8);
    ctx.fillRect(tx - 40, ty + 15, 80, 5);

    // 鸟居顶部弯曲
    ctx.beginPath();
    ctx.moveTo(tx - 45, ty);
    ctx.quadraticCurveTo(tx, ty - 15, tx + 45, ty);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#C62828';
    ctx.stroke();

    // 灯笼发光
    ctx.fillStyle = COLORS.lanternGlow;
    ctx.beginPath();
    ctx.ellipse(tx, ty + 60, 8, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // 灯笼光晕
    ctx.fillStyle = 'rgba(255, 143, 0, 0.15)';
    ctx.beginPath();
    ctx.ellipse(tx, ty + 60, 20, 25, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawLanternParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this._lanternParticles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.lanternGlow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawYokai(ctx: CanvasRenderingContext2D): void {
    const cx = YOKAI_DRAW.centerX;
    const cy = YOKAI_DRAW.centerY + this._yokaiBreathe;
    const scale = this._clickScale;

    // 获取第一个已解锁的妖怪
    const unlockedYokai = this._yokai.find((y) => y.unlocked);
    const breedDef = unlockedYokai
      ? YOKAI_BREEDS.find((b) => b.id === unlockedYokai.id)!
      : YOKAI_BREEDS[0];

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // 身体阴影
    ctx.beginPath();
    ctx.ellipse(4, YOKAI_DRAW.bodyHeight * 0.8 + 4, YOKAI_DRAW.bodyWidth * 0.7, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.yokaiShadow;
    ctx.fill();

    // 腿
    ctx.fillStyle = breedDef.color;
    ctx.fillRect(-YOKAI_DRAW.bodyWidth * 0.35, YOKAI_DRAW.bodyHeight * 0.3, 8, YOKAI_DRAW.legHeight);
    ctx.fillRect(YOKAI_DRAW.bodyWidth * 0.1, YOKAI_DRAW.bodyHeight * 0.3, 8, YOKAI_DRAW.legHeight);

    // 尾巴
    ctx.save();
    ctx.translate(YOKAI_DRAW.bodyWidth * 0.45, 0);
    ctx.rotate(this._tailAngle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(YOKAI_DRAW.tailLength * 0.5, -15, YOKAI_DRAW.tailLength, -5);
    ctx.quadraticCurveTo(YOKAI_DRAW.tailLength * 0.5, 5, 0, 0);
    ctx.fillStyle = breedDef.color;
    ctx.fill();
    ctx.restore();

    // 身体
    ctx.beginPath();
    ctx.ellipse(0, 0, YOKAI_DRAW.bodyWidth * 0.5, YOKAI_DRAW.bodyHeight * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = breedDef.color;
    ctx.fill();

    // 腹部
    ctx.beginPath();
    ctx.ellipse(0, YOKAI_DRAW.bodyHeight * 0.1, YOKAI_DRAW.bodyWidth * 0.35, YOKAI_DRAW.bodyHeight * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = breedDef.bellyColor;
    ctx.fill();

    // 头
    ctx.beginPath();
    ctx.arc(-YOKAI_DRAW.bodyWidth * 0.3, -YOKAI_DRAW.bodyHeight * 0.5, YOKAI_DRAW.headRadius, 0, Math.PI * 2);
    ctx.fillStyle = breedDef.color;
    ctx.fill();

    // 耳朵（狐狸风格三角耳）
    ctx.beginPath();
    ctx.moveTo(-YOKAI_DRAW.bodyWidth * 0.5, -YOKAI_DRAW.bodyHeight * 0.7);
    ctx.lineTo(-YOKAI_DRAW.bodyWidth * 0.3, -YOKAI_DRAW.bodyHeight * 1.0);
    ctx.lineTo(-YOKAI_DRAW.bodyWidth * 0.1, -YOKAI_DRAW.bodyHeight * 0.7);
    ctx.fillStyle = breedDef.color;
    ctx.fill();

    // 眼睛
    ctx.beginPath();
    ctx.arc(-YOKAI_DRAW.bodyWidth * 0.35, -YOKAI_DRAW.bodyHeight * 0.55, YOKAI_DRAW.eyeRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-YOKAI_DRAW.bodyWidth * 0.35, -YOKAI_DRAW.bodyHeight * 0.55, YOKAI_DRAW.eyeRadius * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = '#2C2C2C';
    ctx.fill();

    // 眼睛高光
    ctx.beginPath();
    ctx.arc(-YOKAI_DRAW.bodyWidth * 0.35 + 1.5, -YOKAI_DRAW.bodyHeight * 0.55 - 1.5, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // 嘴巴
    ctx.beginPath();
    ctx.arc(-YOKAI_DRAW.bodyWidth * 0.45, -YOKAI_DRAW.bodyHeight * 0.4, 4, 0, Math.PI * 0.8);
    ctx.strokeStyle = '#2C2C2C';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 进化等级指示（小星星）
    if (unlockedYokai) {
      const evoLevel = unlockedYokai.evolutionLevel;
      for (let i = 0; i < evoLevel; i++) {
        ctx.fillStyle = COLORS.accentGold;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★', -YOKAI_DRAW.bodyWidth * 0.3 - 12 + i * 10, -YOKAI_DRAW.bodyHeight * 0.8);
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
      const icon = res.id === 'spirit' ? '👻' : res.id === 'yokai_coin' ? '🪙' : '📿';

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
        ctx.fillStyle = COLORS.affordable;
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
            const icon = id === 'spirit' ? '👻' : id === 'yokai_coin' ? '🪙' : '📿';
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
        ctx.fillStyle = COLORS.accentGold;
        ctx.fillText('MAX', x + panel.itemWidth - 8, y + 27);
      }
    }

    // 底部提示
    ctx.font = '10px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.textAlign = 'center';
    ctx.fillText('空格 点击 · ↑↓ 选择 · Enter 购买 · E 进化 · P 声望', w / 2, h - 10);
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
        // 进化当前选中的妖怪（第一个已解锁的）
        {
          const unlocked = this._yokai.find((y) => y.unlocked);
          if (unlocked) this.evolveYokai(unlocked.id);
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

  getState(): YokaiNightState {
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
      yokai: this.yokai,
      prestige: { ...this.prestige },
      statistics: { ...this._stats },
      selectedIndex: this._selectedIndex,
    };
  }

  /**
   * 从状态恢复
   */
  loadState(state: YokaiNightState): void {
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

    // 恢复妖怪
    if (state.yokai) {
      for (const yokaiState of state.yokai) {
        const myYokai = this._yokai.find((y) => y.id === yokaiState.id);
        if (myYokai) {
          myYokai.unlocked = yokaiState.unlocked;
          if (yokaiState.evolutionLevel !== undefined) {
            myYokai.evolutionLevel = yokaiState.evolutionLevel;
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
      this._stats = { ...state.statistics } as YokaiNightStatistics;
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
    // 附加妖怪和统计信息到 settings
    data.settings = {
      yokai: this._yokai,
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
      if (settings.yokai) {
        for (const yokaiState of settings.yokai) {
          const myYokai = this._yokai.find((y) => y.id === yokaiState.id);
          if (myYokai) {
            myYokai.unlocked = yokaiState.unlocked;
            if (yokaiState.evolutionLevel !== undefined) {
              myYokai.evolutionLevel = yokaiState.evolutionLevel;
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
