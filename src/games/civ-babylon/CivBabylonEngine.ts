/**
 * 四大文明·古巴比伦 (Civ Babylon) — 放置类游戏引擎
 *
 * 继承 IdleGameEngine，实现：
 * - 多资源系统（泥砖/铜币/星象知识）
 * - 建筑升级系统（8 种建筑）
 * - 空中花园建造系统（7 层逐层解锁）
 * - 占星术系统（观星台升级加成）
 * - 声望重置系统（泥板）
 * - Canvas 美索不达米亚风格渲染
 * - 离线收益
 * - 自动存档
 */
import { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { Resource, Upgrade, SaveData } from '@/types/idle';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  RESOURCE_IDS,
  BRICK_PER_CLICK,
  PRESTIGE_BONUS_MULTIPLIER,
  PRESTIGE_BASE_TABLETS,
  MIN_PRESTIGE_BRICK,
  GARDEN_LAYERS,
  BUILDINGS,
  COLORS,
  GARDEN_DRAW,
  BUILDING_PANEL,
  RESOURCE_PANEL,
  type GardenLayerDef,
  type BuildingDef,
} from './constants';

/** 空中花园层状态 */
export interface GardenLayerState {
  layer: number;
  unlocked: boolean;
  /** 升级等级 0-5 */
  upgradeLevel: number;
}

/** 游戏统计 */
export interface CivBabylonStatistics {
  totalBrickEarned: number;
  totalClicks: number;
  totalCopperEarned: number;
  totalAstroEarned: number;
  totalPrestigeCount: number;
  totalGardenLayersUnlocked: number;
  totalBuildingPurchases: number;
}

/** 古巴比伦游戏状态 */
export interface CivBabylonState {
  [key: string]: unknown;
  resources: Record<string, { amount: number; perSecond: number; unlocked: boolean }>;
  buildings: Record<string, number>;
  gardenLayers: GardenLayerState[];
  prestige: { currency: number; count: number };
  statistics: CivBabylonStatistics;
  selectedIndex: number;
}

/** 花园层升级费用表（按升级等级） */
const GARDEN_UPGRADE_COSTS: Record<number, Record<string, number>> = {
  1: { brick: 200, copper: 10 },
  2: { brick: 1000, copper: 50, astro: 5 },
  3: { brick: 5000, copper: 200, astro: 20 },
  4: { brick: 20000, copper: 800, astro: 50 },
  5: { brick: 80000, copper: 3000, astro: 150 },
};

/** 最大花园层升级等级 */
const MAX_GARDEN_UPGRADE_LEVEL = 5;

export class CivBabylonEngine extends IdleGameEngine {
  // ========== 游戏状态 ==========

  protected _gameId = 'civ-babylon';

  constructor() {
    super();
    Object.defineProperty(this, 'statistics', {
      get: () => ({ ...this._stats }) as CivBabylonStatistics,
      set: (_val: Record<string, number>) => { /* base class writes are no-ops */ },
      configurable: true,
      enumerable: true,
    });
  }

  /** 空中花园层状态 */
  private _gardenLayers: GardenLayerState[] = GARDEN_LAYERS.map((g) => ({
    layer: g.layer,
    unlocked: g.layer === 1, // 基座平台初始解锁
    upgradeLevel: 0,
  }));

  /** 当前选中的建筑索引 */
  private _selectedIndex: number = 0;

  /** 统计数据 */
  private _stats: CivBabylonStatistics = {
    totalBrickEarned: 0,
    totalClicks: 0,
    totalCopperEarned: 0,
    totalAstroEarned: 0,
    totalPrestigeCount: 0,
    totalGardenLayersUnlocked: 1,
    totalBuildingPurchases: 0,
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

  /** 花园动画计时器 */
  private _gardenAnimTimer: number = 0;
  /** 水流动画偏移 */
  private _waterOffset: number = 0;
  /** 星星闪烁 */
  private _starTwinkle: number = 0;
  /** 点击缩放效果 */
  private _clickScale: number = 1;
  private _clickAnimTimer: number = 0;
  /** 星星粒子 */
  private _starParticles: Array<{
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

  get gardenLayers(): GardenLayerState[] {
    return this._gardenLayers.map((g) => ({ ...g }));
  }

  get totalBrickEarned(): number {
    return this._stats.totalBrickEarned;
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
        id: RESOURCE_IDS.BRICK,
        name: '泥砖',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e15,
        unlocked: true,
      },
      {
        id: RESOURCE_IDS.COPPER,
        name: '铜币',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e12,
        unlocked: false,
      },
      {
        id: RESOURCE_IDS.ASTRO,
        name: '星象知识',
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
        description: b.description,
        baseCost: { ...b.baseCost },
        costMultiplier: b.costMultiplier,
        level: 0,
        maxLevel: b.maxLevel,
        effect: {
          type: 'add_production',
          target: b.productionResource,
          value: b.baseProduction,
        },
        unlocked: b.id === 'brick_kiln', // 泥砖窑初始解锁
        requires: b.requires,
        icon: b.icon,
      }))
    );

    // 重置花园层状态
    this._gardenLayers = GARDEN_LAYERS.map((g) => ({
      layer: g.layer,
      unlocked: g.layer === 1,
      upgradeLevel: 0,
    }));

    // 重置状态
    this._selectedIndex = 0;
    this._stats = {
      totalBrickEarned: 0,
      totalClicks: 0,
      totalCopperEarned: 0,
      totalAstroEarned: 0,
      totalPrestigeCount: 0,
      totalGardenLayersUnlocked: 1,
      totalBuildingPurchases: 0,
    };
    this._floatingTexts = [];
    this._gardenAnimTimer = 0;
    this._waterOffset = 0;
    this._starTwinkle = 0;
    this._clickScale = 1;
    this._clickAnimTimer = 0;
    this._starParticles = [];
  }

  protected onUpdate(deltaTime: number): void {
    // 花园动画
    this._gardenAnimTimer += deltaTime;
    this._waterOffset = Math.sin(this._gardenAnimTimer * 0.003) * 5;
    this._starTwinkle = Math.sin(this._gardenAnimTimer * 0.005) * 0.5 + 0.5;

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

    // 星星粒子更新
    this._starParticles = this._starParticles.filter((p) => {
      p.life -= deltaTime;
      p.x += p.vx * (deltaTime / 1000);
      p.y += p.vy * (deltaTime / 1000);
      p.vy += 30 * (deltaTime / 1000); // 轻微重力
      return p.life > 0;
    });

    // 随机产生星星粒子
    if (Math.random() < 0.03) {
      this._starParticles.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * 100,
        vx: (Math.random() - 0.5) * 10,
        vy: -5 - Math.random() * 10,
        life: 2000 + Math.random() * 1500,
        maxLife: 3500,
      });
    }

    // 统计资源产出
    const brick = this.getResource(RESOURCE_IDS.BRICK);
    if (brick && brick.perSecond > 0) {
      this._stats.totalBrickEarned += brick.perSecond * (deltaTime / 1000);
    }
    const copper = this.getResource(RESOURCE_IDS.COPPER);
    if (copper && copper.perSecond > 0) {
      this._stats.totalCopperEarned += copper.perSecond * (deltaTime / 1000);
    }
    const astro = this.getResource(RESOURCE_IDS.ASTRO);
    if (astro && astro.perSecond > 0) {
      this._stats.totalAstroEarned += astro.perSecond * (deltaTime / 1000);
    }

    // 检查建筑解锁条件
    this.checkBuildingUnlocks();
    // 检查资源解锁条件
    this.checkResourceUnlocks();
  }

  // ========== 核心玩法 ==========

  /**
   * 点击获得泥砖
   */
  click(): number {
    if (this._status !== 'playing') return 0;

    let gained = BRICK_PER_CLICK;

    // 花园加成
    gained *= this.getGardenClickMultiplier();

    // 声望加成
    gained *= this.getPrestigeMultiplier();

    // 占星术加成
    gained *= this.getAstrologyMultiplier();

    gained = Math.floor(gained * 100) / 100;

    this.addResource(RESOURCE_IDS.BRICK, gained);
    this._stats.totalBrickEarned += gained;
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
      x: GARDEN_DRAW.centerX + Math.cos(angle) * dist,
      y: GARDEN_DRAW.baseY - 80 + Math.sin(angle) * dist - 30,
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
    this._stats.totalBuildingPurchases++;
    this.recalculateProduction();
    this.emit('upgradePurchased', upgradeId, upgrade.level);
    this.emit('stateChange');
    return true;
  }

  /**
   * 解锁空中花园层
   */
  unlockGardenLayer(layer: number): boolean {
    const layerDef = GARDEN_LAYERS.find((g) => g.layer === layer);
    if (!layerDef) return false;

    const layerState = this._gardenLayers.find((g) => g.layer === layer);
    if (!layerState || layerState.unlocked) return false;

    // 检查前置层是否解锁
    const prevLayer = this._gardenLayers.find((g) => g.layer === layer - 1);
    if (prevLayer && !prevLayer.unlocked) return false;

    if (!this.hasResource(RESOURCE_IDS.BRICK, layerDef.unlockCost)) return false;

    this.spendResource(RESOURCE_IDS.BRICK, layerDef.unlockCost);
    layerState.unlocked = true;
    this._stats.totalGardenLayersUnlocked++;

    // 重新计算产出
    this.recalculateProduction();

    this.emit('gardenLayerUnlocked', layer);
    this.emit('stateChange');
    return true;
  }

  /**
   * 升级空中花园层
   */
  upgradeGardenLayer(layer: number): boolean {
    const layerState = this._gardenLayers.find((g) => g.layer === layer);
    if (!layerState || !layerState.unlocked) return false;

    const nextLevel = layerState.upgradeLevel + 1;
    if (nextLevel > MAX_GARDEN_UPGRADE_LEVEL) return false;

    const cost = this.getGardenUpgradeCost(nextLevel);
    if (!this.canAfford(cost)) return false;

    // 扣除资源
    for (const [resId, amount] of Object.entries(cost)) {
      this.spendResource(resId, amount);
    }

    layerState.upgradeLevel = nextLevel;

    // 重新计算产出
    this.recalculateProduction();

    this.emit('gardenLayerUpgraded', layer, nextLevel);
    this.emit('stateChange');
    return true;
  }

  /**
   * 获取花园层升级费用
   */
  getGardenUpgradeCost(level: number): Record<string, number> {
    return GARDEN_UPGRADE_COSTS[level] ? { ...GARDEN_UPGRADE_COSTS[level] } : {};
  }

  /**
   * 获取花园层升级等级
   */
  getGardenUpgradeLevel(layer: number): number {
    const gardenLayer = this._gardenLayers.find((g) => g.layer === layer);
    return gardenLayer ? gardenLayer.upgradeLevel : 0;
  }

  /**
   * 声望重置
   */
  doPrestige(): number {
    const brick = this.getResource(RESOURCE_IDS.BRICK);
    if (!brick || this._stats.totalBrickEarned < MIN_PRESTIGE_BRICK) return 0;

    // 计算获得的泥板
    const tabletsGained = Math.floor(
      PRESTIGE_BASE_TABLETS * Math.sqrt(this._stats.totalBrickEarned / MIN_PRESTIGE_BRICK)
    );

    if (tabletsGained <= 0) return 0;

    // 保存泥板
    const savedPrestige = { ...this.prestige };
    savedPrestige.currency += tabletsGained;
    savedPrestige.count++;
    this._stats.totalPrestigeCount++;

    // 保存花园层状态（声望保留花园层）
    const savedGardenLayers = this._gardenLayers.map((g) => ({
      layer: g.layer,
      unlocked: g.unlocked,
      upgradeLevel: g.upgradeLevel,
    }));

    const savedStats = {
      ...this._stats,
      totalBrickEarned: 0,
      totalClicks: 0,
      totalCopperEarned: 0,
      totalAstroEarned: 0,
    };

    // 重置
    this.onInit();

    // 恢复声望和部分统计
    this.prestige = savedPrestige;
    this._stats = savedStats as CivBabylonStatistics;

    // 恢复花园层
    for (const saved of savedGardenLayers) {
      const layer = this._gardenLayers.find((g) => g.layer === saved.layer);
      if (layer) {
        layer.unlocked = saved.unlocked;
        layer.upgradeLevel = saved.upgradeLevel;
      }
    }

    this.emit('prestige', tabletsGained);
    this.emit('stateChange');
    return tabletsGained;
  }

  /**
   * 获取声望加成倍率
   */
  getPrestigeMultiplier(): number {
    return 1 + this.prestige.currency * PRESTIGE_BONUS_MULTIPLIER;
  }

  /**
   * 获取花园点击加成倍率
   */
  getGardenClickMultiplier(): number {
    let multiplier = 1;
    for (const layer of this._gardenLayers) {
      if (!layer.unlocked) continue;
      const def = GARDEN_LAYERS.find((g) => g.layer === layer.layer);
      if (!def) continue;
      // 每层解锁 +10% 点击加成
      multiplier += 0.1;
      // 升级额外加成
      multiplier += layer.upgradeLevel * 0.05;
    }
    return multiplier;
  }

  /**
   * 获取占星术加成倍率（基于观星台和巴别塔等级）
   */
  getAstrologyMultiplier(): number {
    const observatory = this.upgrades.get('observatory');
    const ziggurat = this.upgrades.get('ziggurat');

    let multiplier = 1;
    if (observatory && observatory.level > 0) {
      multiplier += observatory.level * 0.05; // 观星台每级 +5%
    }
    if (ziggurat && ziggurat.level > 0) {
      multiplier += ziggurat.level * 0.03; // 巴别塔每级 +3%
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
   * 获取预览声望泥板数
   */
  getPrestigePreview(): number {
    if (this._stats.totalBrickEarned < MIN_PRESTIGE_BRICK) return 0;
    return Math.floor(
      PRESTIGE_BASE_TABLETS * Math.sqrt(this._stats.totalBrickEarned / MIN_PRESTIGE_BRICK)
    );
  }

  /**
   * 检查是否可以声望
   */
  canPrestige(): boolean {
    return this._stats.totalBrickEarned >= MIN_PRESTIGE_BRICK;
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

      // 应用声望加成
      production *= this.getPrestigeMultiplier();

      const resource = this.resources.get(building.productionResource);
      if (resource) {
        resource.perSecond += production;
      }
    }

    // 空中花园层产出
    for (const layerState of this._gardenLayers) {
      if (!layerState.unlocked) continue;

      const layerDef = GARDEN_LAYERS.find((g) => g.layer === layerState.layer);
      if (!layerDef) continue;

      let production = layerDef.baseProduction;
      // 升级加成
      production *= (1 + layerState.upgradeLevel * 0.5);
      // 声望加成
      production *= this.getPrestigeMultiplier();

      const resource = this.resources.get(layerDef.productionResource);
      if (resource) {
        resource.perSecond += production;
      }
    }

    // 占星术加成应用到所有产出
    const astroMult = this.getAstrologyMultiplier();
    if (astroMult > 1) {
      for (const r of this.resources.values()) {
        if (r.perSecond > 0) {
          r.perSecond *= astroMult;
        }
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
    // 铜币：泥砖窑等级 >= 5 时解锁
    const brickKiln = this.upgrades.get('brick_kiln');
    if (brickKiln && brickKiln.level >= 5) {
      const copper = this.resources.get(RESOURCE_IDS.COPPER);
      if (copper && !copper.unlocked) {
        copper.unlocked = true;
        this.emit('resourceUnlocked', RESOURCE_IDS.COPPER);
      }
    }

    // 星象知识：观星台等级 >= 1 时解锁
    const observatory = this.upgrades.get('observatory');
    if (observatory && observatory.level >= 1) {
      const astro = this.resources.get(RESOURCE_IDS.ASTRO);
      if (astro && !astro.unlocked) {
        astro.unlocked = true;
        this.emit('resourceUnlocked', RESOURCE_IDS.ASTRO);
      }
    }
  }

  // ========== 渲染 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawStarParticles(ctx);
    this.drawGarden(ctx, w);
    this.drawFloatingTexts(ctx);
    this.drawResourcePanel(ctx, w);
    this.drawBuildingList(ctx, w, h);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 天空渐变（深蓝色调）
    const skyGradient = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    skyGradient.addColorStop(0, COLORS.skyTop);
    skyGradient.addColorStop(1, COLORS.skyBottom);
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, w, h * 0.5);

    // 地面渐变（沙漠色调）
    const groundGradient = ctx.createLinearGradient(0, h * 0.45, 0, h);
    groundGradient.addColorStop(0, COLORS.groundLight);
    groundGradient.addColorStop(1, COLORS.groundDark);
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, h * 0.45, w, h * 0.55);

    // 地面纹理（沙粒效果）
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < 30; i++) {
      const x = ((i * 73 + 17) % w);
      const y = h * 0.45 + ((i * 47 + 23) % (h * 0.55));
      ctx.fillStyle = '#8B6914';
      ctx.fillRect(x, y, 3, 2);
    }
    ctx.globalAlpha = 1;

    // 星星（固定位置）
    this.drawStars(ctx, w);

    // 月亮
    ctx.beginPath();
    ctx.arc(60, 50, 20, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.starGlow;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(60, 50, 24, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 213, 79, 0.15)';
    ctx.fill();

    // 远处的小丘
    ctx.fillStyle = '#A1887F';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.quadraticCurveTo(80, h * 0.38, 160, h * 0.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(200, h * 0.5);
    ctx.quadraticCurveTo(300, h * 0.35, 380, h * 0.5);
    ctx.fill();

    // 巴别塔轮廓（远景）
    this.drawZiggurat(ctx, w);
  }

  private drawStars(ctx: CanvasRenderingContext2D, w: number): void {
    const starPositions = [
      [30, 20], [90, 35], [150, 15], [200, 40], [260, 25],
      [310, 45], [370, 30], [420, 18], [450, 38], [100, 55],
      [180, 60], [340, 55], [400, 50], [50, 70], [230, 65],
    ];

    for (const [x, y] of starPositions) {
      const alpha = 0.3 + this._starTwinkle * 0.7 * Math.random();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.starGlow;
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawZiggurat(ctx: CanvasRenderingContext2D, w: number): void {
    const zx = w - 100;
    const zy = 80;

    // 巴别塔（远景剪影）
    ctx.fillStyle = '#3E2723';
    ctx.beginPath();
    ctx.moveTo(zx - 50, 200);
    ctx.lineTo(zx - 30, zy + 20);
    ctx.lineTo(zx - 15, zy);
    ctx.lineTo(zx + 15, zy);
    ctx.lineTo(zx + 30, zy + 20);
    ctx.lineTo(zx + 50, 200);
    ctx.closePath();
    ctx.fill();

    // 塔顶发光
    ctx.fillStyle = 'rgba(124, 77, 255, 0.3)';
    ctx.beginPath();
    ctx.ellipse(zx, zy, 15, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawStarParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this._starParticles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.starGlow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawGarden(ctx: CanvasRenderingContext2D, w: number): void {
    const cx = GARDEN_DRAW.centerX;
    const baseY = GARDEN_DRAW.baseY;
    const scale = this._clickScale;

    ctx.save();
    ctx.translate(cx, baseY);
    ctx.scale(scale, scale);

    // 绘制已解锁的花园层（从底层到顶层）
    for (let i = this._gardenLayers.length - 1; i >= 0; i--) {
      const layerState = this._gardenLayers[i];
      if (!layerState.unlocked) continue;

      const layerDef = GARDEN_LAYERS.find((g) => g.layer === layerState.layer);
      if (!layerDef) continue;

      const layerY = -(layerState.layer - 1) * (GARDEN_DRAW.layerHeight + 5);
      const layerW = GARDEN_DRAW.layerWidth - (layerState.layer - 1) * 8;

      // 层台
      ctx.fillStyle = layerDef.color;
      ctx.beginPath();
      ctx.moveTo(-layerW / 2, layerY);
      ctx.lineTo(layerW / 2, layerY);
      ctx.lineTo(layerW / 2 - 5, layerY + GARDEN_DRAW.layerHeight);
      ctx.lineTo(-layerW / 2 + 5, layerY + GARDEN_DRAW.layerHeight);
      ctx.closePath();
      ctx.fill();

      // 植被
      ctx.fillStyle = layerDef.plantColor;
      for (let p = 0; p < 3; p++) {
        const px = -layerW / 2 + 10 + p * (layerW - 20) / 3;
        const py = layerY - 2;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px + 5, py - GARDEN_DRAW.plantHeight, px + 10, py);
        ctx.fill();
      }

      // 水流效果（第2层以上）
      if (layerState.layer >= 2) {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = COLORS.waterColor;
        const waterY = layerY + GARDEN_DRAW.layerHeight / 2 + this._waterOffset;
        ctx.fillRect(-layerW / 2 + 8, waterY, layerW - 16, 3);
        ctx.globalAlpha = 1;
      }

      // 升级等级指示（小星星）
      for (let s = 0; s < layerState.upgradeLevel; s++) {
        ctx.fillStyle = COLORS.accent;
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★', -layerW / 2 + 15 + s * 10, layerY - 5);
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
      const icon = res.id === RESOURCE_IDS.BRICK ? '🧱' : res.id === RESOURCE_IDS.COPPER ? '🪙' : '⭐';

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
            const icon = id === RESOURCE_IDS.BRICK ? '🧱' : id === RESOURCE_IDS.COPPER ? '🪙' : '⭐';
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
    ctx.fillText('空格 点击 · ↑↓ 选择 · Enter 购买 · G 花园 · P 声望', w / 2, h - 10);
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
      case 'g':
      case 'G':
        // 解锁下一层花园
        {
          const nextLayer = this._gardenLayers.find((g) => !g.unlocked);
          if (nextLayer) this.unlockGardenLayer(nextLayer.layer);
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

  getState(): CivBabylonState {
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
      gardenLayers: this.gardenLayers,
      prestige: { ...this.prestige },
      statistics: { ...this._stats },
      selectedIndex: this._selectedIndex,
    };
  }

  /**
   * 从状态恢复
   */
  loadState(state: CivBabylonState): void {
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

    // 恢复花园层
    if (state.gardenLayers) {
      for (const layerState of state.gardenLayers) {
        const myLayer = this._gardenLayers.find((g) => g.layer === layerState.layer);
        if (myLayer) {
          myLayer.unlocked = layerState.unlocked;
          if (layerState.upgradeLevel !== undefined) {
            myLayer.upgradeLevel = layerState.upgradeLevel;
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
      this._stats = { ...state.statistics } as CivBabylonStatistics;
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
    // 附加花园层和统计信息到 settings
    data.settings = {
      gardenLayers: this._gardenLayers,
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
      if (settings.gardenLayers) {
        for (const layerState of settings.gardenLayers) {
          const myLayer = this._gardenLayers.find((g) => g.layer === layerState.layer);
          if (myLayer) {
            myLayer.unlocked = layerState.unlocked;
            if (layerState.upgradeLevel !== undefined) {
              myLayer.upgradeLevel = layerState.upgradeLevel;
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
