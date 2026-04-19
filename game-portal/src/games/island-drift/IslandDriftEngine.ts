/**
 * 海岛漂流 (Island Drift) — 放置类游戏引擎
 *
 * 继承 IdleGameEngine，实现：
 * - 多资源系统（木材/食物/贝壳）
 * - 建筑升级系统（8种建筑）
 * - 探险系统：派遣探险队发现新岛屿
 * - 岛屿解锁系统（5个岛屿）
 * - 声望重置系统（漂流瓶）
 * - Canvas 海岛风格渲染
 * - 离线收益
 * - 自动存档
 */
import { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { Resource, Upgrade, SaveData } from '@/types/idle';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  WOOD_PER_CLICK,
  PRESTIGE_BONUS_MULTIPLIER,
  PRESTIGE_BASE_BOTTLES,
  MIN_PRESTIGE_WOOD,
  ISLANDS,
  BUILDINGS,
  COLORS,
  ISLAND_DRAW,
  BUILDING_PANEL,
  RESOURCE_PANEL,
  RESOURCE_IDS,
  type IslandDef,
  type BuildingDef,
} from './constants';

/** 岛屿状态 */
export interface IslandState {
  id: string;
  unlocked: boolean;
  /** 探险完成次数 */
  expeditions: number;
}

/** 探险状态 */
export interface ExpeditionState {
  active: boolean;
  /** 目标岛屿 */
  targetIsland: string;
  /** 剩余时间（ms） */
  remainingTime: number;
  /** 总时间（ms） */
  totalTime: number;
}

/** 游戏统计 */
export interface IslandDriftStatistics {
  totalWoodEarned: number;
  totalClicks: number;
  totalFoodEarned: number;
  totalShellEarned: number;
  totalPrestigeCount: number;
  totalIslandsUnlocked: number;
  totalExpeditions: number;
  totalExpeditionRewards: number;
}

/** 海岛漂流游戏状态 */
export interface IslandDriftState {
  [key: string]: unknown;
  resources: Record<string, { amount: number; perSecond: number; unlocked: boolean }>;
  buildings: Record<string, number>;
  islands: IslandState[];
  expedition: ExpeditionState;
  prestige: { currency: number; count: number };
  statistics: IslandDriftStatistics;
  selectedIndex: number;
}

/** 探险基础时间（毫秒） */
const EXPEDITION_BASE_TIME = 30000; // 30秒

/** 探险奖励基础值 */
const EXPEDITION_BASE_REWARD = 50;

export class IslandDriftEngine extends IdleGameEngine {
  // ========== 游戏状态 ==========

  protected _gameId = 'island-drift';

  constructor() {
    super();
    // Override base class `statistics` instance field with a getter/setter,
    // because class fields shadow prototype accessors.
    Object.defineProperty(this, 'statistics', {
      get: () => ({ ...this._stats }) as IslandDriftStatistics,
      set: (_val: Record<string, number>) => { /* base class writes are no-ops */ },
      configurable: true,
      enumerable: true,
    });
  }

  /** 岛屿状态 */
  private _islands: IslandState[] = ISLANDS.map((i) => ({
    id: i.id,
    unlocked: i.id === 'beach_island', // 沙滩岛初始解锁
    expeditions: 0,
  }));

  /** 当前探险 */
  private _expedition: ExpeditionState = {
    active: false,
    targetIsland: '',
    remainingTime: 0,
    totalTime: 0,
  };

  /** 当前选中的建筑索引 */
  private _selectedIndex: number = 0;

  /** 统计数据 */
  private _stats: IslandDriftStatistics = {
    totalWoodEarned: 0,
    totalClicks: 0,
    totalFoodEarned: 0,
    totalShellEarned: 0,
    totalPrestigeCount: 0,
    totalIslandsUnlocked: 1,
    totalExpeditions: 0,
    totalExpeditionRewards: 0,
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

  /** 海浪动画计时器 */
  private _waveTimer: number = 0;
  /** 海浪偏移 */
  private _waveOffset: number = 0;
  /** 棕榈树摇摆 */
  private _palmSway: number = 0;
  /** 点击缩放效果 */
  private _clickScale: number = 1;
  private _clickAnimTimer: number = 0;
  /** 海鸥粒子 */
  private _seagulls: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    wingAngle: number;
  }> = [];

  // ========== 公开属性 ==========

  get selectedIndex(): number {
    return this._selectedIndex;
  }

  get islands(): IslandState[] {
    return this._islands.map((i) => ({ ...i }));
  }

  get expedition(): ExpeditionState {
    return { ...this._expedition };
  }

  get totalWoodEarned(): number {
    return this._stats.totalWoodEarned;
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
        id: 'wood',
        name: '木材',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e15,
        unlocked: true,
      },
      {
        id: 'food',
        name: '食物',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e12,
        unlocked: false,
      },
      {
        id: 'shell',
        name: '贝壳',
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
        unlocked: b.id === 'shelter', // 庇护所初始解锁
        requires: b.requires,
        icon: b.icon,
      }))
    );

    // 重置状态
    this._islands = ISLANDS.map((i) => ({
      id: i.id,
      unlocked: i.id === 'beach_island',
      expeditions: 0,
    }));
    this._expedition = {
      active: false,
      targetIsland: '',
      remainingTime: 0,
      totalTime: 0,
    };
    this._selectedIndex = 0;
    this._stats = {
      totalWoodEarned: 0,
      totalClicks: 0,
      totalFoodEarned: 0,
      totalShellEarned: 0,
      totalPrestigeCount: 0,
      totalIslandsUnlocked: 1,
      totalExpeditions: 0,
      totalExpeditionRewards: 0,
    };
    this._floatingTexts = [];
    this._waveTimer = 0;
    this._waveOffset = 0;
    this._palmSway = 0;
    this._clickScale = 1;
    this._clickAnimTimer = 0;
    this._seagulls = [];
  }

  protected onUpdate(deltaTime: number): void {
    // 海浪动画
    this._waveTimer += deltaTime;
    this._waveOffset = Math.sin(this._waveTimer * 0.002) * 8;
    this._palmSway = Math.sin(this._waveTimer * 0.003) * 0.15;

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

    // 海鸥更新
    this._seagulls = this._seagulls.filter((g) => {
      g.x += g.vx * (deltaTime / 1000);
      g.y += g.vy * (deltaTime / 1000);
      g.wingAngle += deltaTime * 0.01;
      return g.x < CANVAS_WIDTH + 50 && g.x > -50;
    });

    // 随机产生海鸥
    if (Math.random() < 0.005) {
      this._seagulls.push({
        x: -20,
        y: 30 + Math.random() * 60,
        vx: 20 + Math.random() * 30,
        vy: (Math.random() - 0.5) * 10,
        wingAngle: 0,
      });
    }

    // 探险倒计时
    if (this._expedition.active) {
      this._expedition.remainingTime -= deltaTime;
      if (this._expedition.remainingTime <= 0) {
        this.completeExpedition();
      }
    }

    // 统计资源产出
    const wood = this.getResource('wood');
    if (wood && wood.perSecond > 0) {
      this._stats.totalWoodEarned += wood.perSecond * (deltaTime / 1000);
    }
    const food = this.getResource('food');
    if (food && food.perSecond > 0) {
      this._stats.totalFoodEarned += food.perSecond * (deltaTime / 1000);
    }
    const shell = this.getResource('shell');
    if (shell && shell.perSecond > 0) {
      this._stats.totalShellEarned += shell.perSecond * (deltaTime / 1000);
    }

    // 检查建筑解锁条件
    this.checkBuildingUnlocks();
    // 检查资源解锁条件
    this.checkResourceUnlocks();
  }

  // ========== 核心玩法 ==========

  /**
   * 点击获得木材
   */
  click(): number {
    if (this._status !== 'playing') return 0;

    let gained = WOOD_PER_CLICK;

    // 探险加成
    gained *= this.getClickMultiplier();

    // 声望加成
    gained *= this.getPrestigeMultiplier();

    gained = Math.floor(gained * 100) / 100;

    this.addResource('wood', gained);
    this._stats.totalWoodEarned += gained;
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
      x: ISLAND_DRAW.centerX + Math.cos(angle) * dist,
      y: ISLAND_DRAW.centerY + Math.sin(angle) * dist - 30,
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
   * 解锁岛屿
   */
  unlockIsland(islandId: string): boolean {
    const islandDef = ISLANDS.find((i) => i.id === islandId);
    if (!islandDef) return false;

    const islandState = this._islands.find((i) => i.id === islandId);
    if (!islandState || islandState.unlocked) return false;

    if (!this.hasResource('wood', islandDef.unlockCost)) return false;

    this.spendResource('wood', islandDef.unlockCost);
    islandState.unlocked = true;
    this._stats.totalIslandsUnlocked++;

    this.emit('islandUnlocked', islandId);
    this.emit('stateChange');
    return true;
  }

  /**
   * 开始探险
   */
  startExpedition(islandId: string): boolean {
    if (this._expedition.active) return false;

    const islandState = this._islands.find((i) => i.id === islandId);
    if (!islandState || !islandState.unlocked) return false;

    // 探险需要食物
    const foodCost = 10;
    if (!this.hasResource('food', foodCost)) return false;

    this.spendResource('food', foodCost);

    const islandDef = ISLANDS.find((i) => i.id === islandId)!;
    this._expedition = {
      active: true,
      targetIsland: islandId,
      remainingTime: EXPEDITION_BASE_TIME / islandDef.rewardMultiplier,
      totalTime: EXPEDITION_BASE_TIME / islandDef.rewardMultiplier,
    };

    this.emit('expeditionStarted', islandId);
    this.emit('stateChange');
    return true;
  }

  /**
   * 完成探险
   */
  private completeExpedition(): void {
    if (!this._expedition.active) return;

    const islandDef = ISLANDS.find((i) => i.id === this._expedition.targetIsland);
    const multiplier = islandDef ? islandDef.rewardMultiplier : 1;

    // 计算奖励
    const woodReward = Math.floor(EXPEDITION_BASE_REWARD * multiplier * this.getPrestigeMultiplier());
    const foodReward = Math.floor(EXPEDITION_BASE_REWARD * 0.5 * multiplier * this.getPrestigeMultiplier());
    const shellReward = Math.floor(EXPEDITION_BASE_REWARD * 0.2 * multiplier * this.getPrestigeMultiplier());

    this.addResource('wood', woodReward);
    this.addResource('food', foodReward);
    this.addResource('shell', shellReward);

    this._stats.totalWoodEarned += woodReward;
    this._stats.totalFoodEarned += foodReward;
    this._stats.totalShellEarned += shellReward;
    this._stats.totalExpeditions++;
    this._stats.totalExpeditionRewards += woodReward + foodReward + shellReward;

    // 更新岛屿探险次数
    const islandState = this._islands.find((i) => i.id === this._expedition.targetIsland);
    if (islandState) {
      islandState.expeditions++;
    }

    // 飘字
    this._floatingTexts.push({
      text: `探险完成！+${woodReward}木材`,
      x: ISLAND_DRAW.centerX,
      y: ISLAND_DRAW.centerY - 60,
      life: 1500,
      maxLife: 1500,
      color: COLORS.accentGreen,
    });

    this._expedition = {
      active: false,
      targetIsland: '',
      remainingTime: 0,
      totalTime: 0,
    };

    this.emit('expeditionCompleted', this._expedition.targetIsland);
    this.emit('stateChange');
  }

  /**
   * 声望重置
   */
  doPrestige(): number {
    const wood = this.getResource('wood');
    if (!wood || this._stats.totalWoodEarned < MIN_PRESTIGE_WOOD) return 0;

    // 计算获得的漂流瓶
    const bottlesGained = Math.floor(
      PRESTIGE_BASE_BOTTLES * Math.sqrt(this._stats.totalWoodEarned / MIN_PRESTIGE_WOOD)
    );

    if (bottlesGained <= 0) return 0;

    // 保存漂流瓶和声望数据
    const savedPrestige = { ...this.prestige };
    const savedStats = {
      ...this._stats,
      totalWoodEarned: 0,
      totalClicks: 0,
      totalFoodEarned: 0,
      totalShellEarned: 0,
    };

    // 保存岛屿解锁状态（声望保留岛屿解锁）
    const savedIslands = this._islands.map((i) => ({
      id: i.id,
      unlocked: i.unlocked,
      expeditions: i.expeditions,
    }));

    // 重置
    this.onInit();

    // 恢复声望和部分统计
    this.prestige = savedPrestige;
    this.prestige.currency += bottlesGained;
    this.prestige.count++;
    this._stats = savedStats as IslandDriftStatistics;
    this._stats.totalPrestigeCount++;

    // 恢复岛屿状态
    for (const saved of savedIslands) {
      const island = this._islands.find((i) => i.id === saved.id);
      if (island) {
        island.unlocked = saved.unlocked;
        island.expeditions = saved.expeditions;
      }
    }

    this.emit('prestige', bottlesGained);
    this.emit('stateChange');
    return bottlesGained;
  }

  /**
   * 获取声望加成倍率
   */
  getPrestigeMultiplier(): number {
    return 1 + this.prestige.currency * PRESTIGE_BONUS_MULTIPLIER;
  }

  /**
   * 获取点击加成倍率
   */
  getClickMultiplier(): number {
    let multiplier = 1;
    // 每个已解锁岛屿提供 10% 点击加成
    for (const island of this._islands) {
      if (island.unlocked) {
        multiplier += 0.1;
      }
    }
    return multiplier;
  }

  /**
   * 获取木材生产加成倍率
   */
  getWoodMultiplier(): number {
    let multiplier = 1;
    // 每个已解锁岛屿提供 15% 木材加成
    for (const island of this._islands) {
      if (island.unlocked) {
        multiplier += 0.15;
      }
    }
    multiplier *= this.getPrestigeMultiplier();
    return multiplier;
  }

  /**
   * 获取食物生产加成倍率
   */
  getFoodMultiplier(): number {
    let multiplier = 1;
    // 每个已解锁岛屿提供 10% 食物加成
    for (const island of this._islands) {
      if (island.unlocked) {
        multiplier += 0.1;
      }
    }
    multiplier *= this.getPrestigeMultiplier();
    return multiplier;
  }

  /**
   * 获取贝壳生产加成倍率
   */
  getShellMultiplier(): number {
    let multiplier = 1;
    // 每个已解锁岛屿提供 20% 贝壳加成
    for (const island of this._islands) {
      if (island.unlocked) {
        multiplier += 0.2;
      }
    }
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
   * 获取预览声望漂流瓶数
   */
  getPrestigePreview(): number {
    if (this._stats.totalWoodEarned < MIN_PRESTIGE_WOOD) return 0;
    return Math.floor(
      PRESTIGE_BASE_BOTTLES * Math.sqrt(this._stats.totalWoodEarned / MIN_PRESTIGE_WOOD)
    );
  }

  /**
   * 检查是否可以声望
   */
  canPrestige(): boolean {
    return this._stats.totalWoodEarned >= MIN_PRESTIGE_WOOD;
  }

  /**
   * 获取岛屿探险次数
   */
  getIslandExpeditions(islandId: string): number {
    const island = this._islands.find((i) => i.id === islandId);
    return island ? island.expeditions : 0;
  }

  /**
   * 检查岛屿是否已解锁
   */
  isIslandUnlocked(islandId: string): boolean {
    const island = this._islands.find((i) => i.id === islandId);
    return island ? island.unlocked : false;
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
      if (building.productionResource === 'wood') {
        production *= this.getWoodMultiplier();
      } else if (building.productionResource === 'food') {
        production *= this.getFoodMultiplier();
      } else if (building.productionResource === 'shell') {
        production *= this.getShellMultiplier();
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
    // 食物：庇护所等级 >= 3 时解锁
    const shelter = this.upgrades.get('shelter');
    if (shelter && shelter.level >= 3) {
      const food = this.resources.get('food');
      if (food && !food.unlocked) {
        food.unlocked = true;
        this.emit('resourceUnlocked', 'food');
      }
    }

    // 贝壳：灯塔等级 >= 1 时解锁
    const lighthouse = this.upgrades.get('lighthouse');
    if (lighthouse && lighthouse.level >= 1) {
      const shell = this.resources.get('shell');
      if (shell && !shell.unlocked) {
        shell.unlocked = true;
        this.emit('resourceUnlocked', 'shell');
      }
    }
  }

  // ========== 渲染 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawSeagulls(ctx);
    this.drawIslands(ctx);
    this.drawPalmTree(ctx);
    this.drawBoat(ctx);
    this.drawFloatingTexts(ctx);
    this.drawResourcePanel(ctx, w);
    this.drawBuildingList(ctx, w, h);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 天空渐变
    const skyGradient = ctx.createLinearGradient(0, 0, 0, h * 0.45);
    skyGradient.addColorStop(0, COLORS.skyTop);
    skyGradient.addColorStop(1, COLORS.skyBottom);
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, w, h * 0.45);

    // 太阳
    ctx.beginPath();
    ctx.arc(380, 60, 25, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF9C4';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(380, 60, 35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 249, 196, 0.15)';
    ctx.fill();

    // 海洋渐变
    const oceanGradient = ctx.createLinearGradient(0, h * 0.4, 0, h);
    oceanGradient.addColorStop(0, COLORS.oceanLight);
    oceanGradient.addColorStop(1, COLORS.oceanDark);
    ctx.fillStyle = oceanGradient;
    ctx.fillRect(0, h * 0.4, w, h * 0.6);

    // 海浪
    this.drawWaves(ctx, w, h);

    // 远处云朵
    ctx.globalAlpha = 0.6;
    this.drawCloud(ctx, 80, 40, 20);
    this.drawCloud(ctx, 250, 55, 15);
    this.drawCloud(ctx, 400, 35, 18);
    ctx.globalAlpha = 1;
  }

  private drawWaves(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 三层海浪
    const waveLayers = [
      { y: h * 0.4, amplitude: 6, frequency: 0.015, color: 'rgba(41, 182, 246, 0.3)', speed: 1 },
      { y: h * 0.42, amplitude: 4, frequency: 0.02, color: 'rgba(100, 181, 246, 0.25)', speed: 1.3 },
      { y: h * 0.44, amplitude: 3, frequency: 0.025, color: 'rgba(144, 202, 249, 0.2)', speed: 0.8 },
    ];

    for (const layer of waveLayers) {
      ctx.beginPath();
      ctx.moveTo(0, layer.y);
      for (let x = 0; x <= w; x += 4) {
        const y = layer.y + Math.sin((x * layer.frequency) + this._waveTimer * 0.001 * layer.speed) * layer.amplitude;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fillStyle = layer.color;
      ctx.fill();
    }
  }

  private drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + size * 0.8, y - size * 0.2, size * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - size * 0.6, y + size * 0.1, size * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawIslands(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < ISLANDS.length; i++) {
      const def = ISLANDS[i];
      const state = this._islands[i];
      if (!state.unlocked) continue;

      // 岛屿阴影
      ctx.beginPath();
      ctx.ellipse(def.x + 3, def.y + 5, def.radius + 5, def.radius * 0.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.islandShadow;
      ctx.fill();

      // 岛屿主体
      ctx.beginPath();
      ctx.ellipse(def.x, def.y, def.radius, def.radius * 0.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = def.color;
      ctx.fill();

      // 岛屿高光
      ctx.beginPath();
      ctx.ellipse(def.x - def.radius * 0.2, def.y - def.radius * 0.15, def.radius * 0.5, def.radius * 0.25, -0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fill();

      // 岛屿名称
      ctx.font = '10px "Segoe UI", sans-serif';
      ctx.fillStyle = COLORS.textPrimary;
      ctx.textAlign = 'center';
      ctx.fillText(def.name, def.x, def.y + def.radius * 0.6 + 14);
    }
  }

  private drawSeagulls(ctx: CanvasRenderingContext2D): void {
    for (const g of this._seagulls) {
      const wing = Math.sin(g.wingAngle) * 5;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(g.x - 8, g.y + wing);
      ctx.quadraticCurveTo(g.x - 3, g.y - 3, g.x, g.y);
      ctx.quadraticCurveTo(g.x + 3, g.y - 3, g.x + 8, g.y + wing);
      ctx.stroke();
    }
  }

  private drawPalmTree(ctx: CanvasRenderingContext2D): void {
    const cx = ISLAND_DRAW.centerX;
    const cy = ISLAND_DRAW.centerY;
    const sway = this._palmSway;

    ctx.save();
    ctx.translate(cx - 30, cy + 20);

    // 树干
    ctx.save();
    ctx.rotate(sway * 0.5);
    ctx.fillStyle = COLORS.trunkColor;
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.quadraticCurveTo(-6, -ISLAND_DRAW.palmHeight * 0.5, -3, -ISLAND_DRAW.palmHeight);
    ctx.lineTo(3, -ISLAND_DRAW.palmHeight);
    ctx.quadraticCurveTo(6, -ISLAND_DRAW.palmHeight * 0.5, 4, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 椰叶
    ctx.save();
    ctx.rotate(sway);
    ctx.translate(0, -ISLAND_DRAW.palmHeight);
    const leafCount = 5;
    for (let i = 0; i < leafCount; i++) {
      const angle = (i / leafCount) * Math.PI * 2;
      ctx.save();
      ctx.rotate(angle);
      ctx.fillStyle = COLORS.palmColor;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(ISLAND_DRAW.leafLength * 0.5, -8, ISLAND_DRAW.leafLength, -3);
      ctx.quadraticCurveTo(ISLAND_DRAW.leafLength * 0.5, 4, 0, 0);
      ctx.fill();
      ctx.restore();
    }

    // 椰子
    ctx.fillStyle = '#795548';
    ctx.beginPath();
    ctx.arc(-3, 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3, 2, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.restore();
  }

  private drawBoat(ctx: CanvasRenderingContext2D): void {
    const bx = ISLAND_DRAW.boatX;
    const by = ISLAND_DRAW.boatY + this._waveOffset * 0.5;
    const bw = ISLAND_DRAW.boatWidth;
    const bh = ISLAND_DRAW.boatHeight;
    const scale = this._clickScale;

    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(scale, scale);

    // 船体
    ctx.fillStyle = COLORS.boatColor;
    ctx.beginPath();
    ctx.moveTo(-bw / 2, 0);
    ctx.quadraticCurveTo(-bw / 2 - 5, bh, 0, bh);
    ctx.quadraticCurveTo(bw / 2 + 5, bh, bw / 2, 0);
    ctx.closePath();
    ctx.fill();

    // 桅杆
    ctx.fillStyle = COLORS.trunkColor;
    ctx.fillRect(-2, -35, 4, 35);

    // 帆
    ctx.fillStyle = COLORS.sailColor;
    ctx.beginPath();
    ctx.moveTo(2, -30);
    ctx.quadraticCurveTo(20, -20, 2, -5);
    ctx.closePath();
    ctx.fill();

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
      const icon = res.id === 'wood' ? '🪵' : res.id === 'food' ? '🍖' : '🐚';

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
            const icon = id === 'wood' ? '🪵' : id === 'food' ? '🍖' : '🐚';
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
    ctx.fillText('空格 点击 · ↑↓ 选择 · Enter 购买 · X 探险 · P 声望', w / 2, h - 10);
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
      case 'x':
      case 'X':
        // 探险到第一个已解锁的岛屿
        {
          const unlocked = this._islands.find((i) => i.unlocked);
          if (unlocked) this.startExpedition(unlocked.id);
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

  getState(): IslandDriftState {
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
      islands: this.islands,
      expedition: this.expedition,
      prestige: { ...this.prestige },
      statistics: { ...this._stats },
      selectedIndex: this._selectedIndex,
    };
  }

  /**
   * 从状态恢复
   */
  loadState(state: IslandDriftState): void {
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

    // 恢复岛屿
    if (state.islands) {
      for (const islandState of state.islands) {
        const myIsland = this._islands.find((i) => i.id === islandState.id);
        if (myIsland) {
          myIsland.unlocked = islandState.unlocked;
          if (islandState.expeditions !== undefined) {
            myIsland.expeditions = islandState.expeditions;
          }
        }
      }
    }

    // 恢复探险
    if (state.expedition) {
      this._expedition = { ...state.expedition };
    }

    // 恢复声望
    if (state.prestige) {
      this.prestige = { ...state.prestige };
    }

    // 恢复统计
    if (state.statistics) {
      this._stats = { ...state.statistics } as IslandDriftStatistics;
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
    // 附加岛屿和统计信息到 settings
    data.settings = {
      islands: this._islands,
      expedition: this._expedition,
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
      if (settings.islands) {
        for (const islandState of settings.islands) {
          const myIsland = this._islands.find((i) => i.id === islandState.id);
          if (myIsland) {
            myIsland.unlocked = islandState.unlocked;
            if (islandState.expeditions !== undefined) {
              myIsland.expeditions = islandState.expeditions;
            }
          }
        }
      }
      if (settings.expedition) {
        this._expedition = { ...settings.expedition };
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
