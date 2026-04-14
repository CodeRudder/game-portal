/**
 * 四大文明·古埃及 (Civ Egypt) — 放置类游戏引擎
 *
 * 继承 IdleGameEngine，实现：
 * - 三资源系统（粮食/黄金/信仰）
 * - 八大建筑升级系统
 * - 法老威望系统
 * - 时代演进系统（前王朝→古王国→中王国→新王国）
 * - 声望重置系统（太阳神赐福）
 * - Canvas 古埃及风格渲染
 * - 离线收益
 * - 自动存档
 */
import { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { Resource, Upgrade, SaveData } from '@/types/idle';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  RESOURCE_IDS,
  FOOD_PER_CLICK,
  PRESTIGE_BONUS_MULTIPLIER,
  PRESTIGE_BASE_BLESSINGS,
  MIN_PRESTIGE_FOOD,
  ERAS,
  BUILDINGS,
  BUILDING_IDS,
  COLORS,
  PYRAMID_DRAW,
  BUILDING_PANEL,
  RESOURCE_PANEL,
  type EraDef,
  type BuildingDef,
} from './constants';

/** 游戏统计 */
export interface CivEgyptStatistics {
  totalFoodEarned: number;
  totalGoldEarned: number;
  totalFaithEarned: number;
  totalClicks: number;
  totalPrestigeCount: number;
  totalBuildingsBuilt: number;
  highestEraReached: number;
}

/** 古埃及游戏状态 */
export interface CivEgyptState {
  [key: string]: unknown;
  resources: Record<string, { amount: number; perSecond: number; unlocked: boolean }>;
  buildings: Record<string, number>;
  prestige: { currency: number; count: number };
  statistics: CivEgyptStatistics;
  selectedIndex: number;
  currentEra: string;
  pharaohPrestige: number;
}

export class CivEgyptEngine extends IdleGameEngine {
  // ========== 游戏状态 ==========

  protected _gameId = 'civ-egypt';

  constructor() {
    super();
    Object.defineProperty(this, 'statistics', {
      get: () => ({ ...this._stats }) as CivEgyptStatistics,
      set: (_val: Record<string, number>) => { /* base class writes are no-ops */ },
      configurable: true,
      enumerable: true,
    });
  }

  /** 当前选中的建筑索引 */
  private _selectedIndex: number = 0;

  /** 统计数据 */
  private _stats: CivEgyptStatistics = {
    totalFoodEarned: 0,
    totalGoldEarned: 0,
    totalFaithEarned: 0,
    totalClicks: 0,
    totalPrestigeCount: 0,
    totalBuildingsBuilt: 0,
    highestEraReached: 0,
  };

  /** 法老威望值（通过声望获得） */
  private _pharaohPrestige: number = 0;

  /** 当前时代索引 */
  private _currentEraIndex: number = 0;

  /** 飘字效果列表 */
  private _floatingTexts: Array<{
    text: string;
    x: number;
    y: number;
    life: number;
    maxLife: number;
    color: string;
  }> = [];

  /** 金字塔动画计时器 */
  private _pyramidAnimTimer: number = 0;
  /** 太阳脉动 */
  private _sunPulse: number = 0;
  /** 点击缩放效果 */
  private _clickScale: number = 1;
  private _clickAnimTimer: number = 0;
  /** 尼罗河波浪 */
  private _nileWaveOffset: number = 0;
  /** 沙尘粒子 */
  private _sandParticles: Array<{
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

  get totalFoodEarned(): number {
    return this._stats.totalFoodEarned;
  }

  get totalClicks(): number {
    return this._stats.totalClicks;
  }

  get pharaohPrestige(): number {
    return this._pharaohPrestige;
  }

  get currentEra(): EraDef {
    return ERAS[this._currentEraIndex];
  }

  get currentEraIndex(): number {
    return this._currentEraIndex;
  }

  // ========== 生命周期 ==========

  protected onInit(): void {
    super.onInit();

    // 初始化资源
    this.initializeResources([
      {
        id: RESOURCE_IDS.FOOD,
        name: '粮食',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e15,
        unlocked: true,
      },
      {
        id: RESOURCE_IDS.GOLD,
        name: '黄金',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e12,
        unlocked: false,
      },
      {
        id: RESOURCE_IDS.FAITH,
        name: '信仰',
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
        unlocked: b.id === BUILDING_IDS.FARM, // 农田初始解锁
        requires: b.requires,
        icon: b.icon,
      }))
    );

    // 重置状态
    this._selectedIndex = 0;
    this._pharaohPrestige = 0;
    this._currentEraIndex = 0;
    this._stats = {
      totalFoodEarned: 0,
      totalGoldEarned: 0,
      totalFaithEarned: 0,
      totalClicks: 0,
      totalPrestigeCount: 0,
      totalBuildingsBuilt: 0,
      highestEraReached: 0,
    };
    this._floatingTexts = [];
    this._pyramidAnimTimer = 0;
    this._sunPulse = 0;
    this._clickScale = 1;
    this._clickAnimTimer = 0;
    this._nileWaveOffset = 0;
    this._sandParticles = [];
  }

  protected onUpdate(deltaTime: number): void {
    // 动画更新
    this._pyramidAnimTimer += deltaTime;
    this._sunPulse = Math.sin(this._pyramidAnimTimer * 0.002) * 3;
    this._nileWaveOffset += deltaTime * 0.01;

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

    // 沙尘粒子更新
    this._sandParticles = this._sandParticles.filter((p) => {
      p.life -= deltaTime;
      p.x += p.vx * (deltaTime / 1000);
      p.y += p.vy * (deltaTime / 1000);
      return p.life > 0;
    });

    // 随机产生沙尘粒子
    if (Math.random() < 0.03) {
      this._sandParticles.push({
        x: -10,
        y: 100 + Math.random() * 200,
        vx: 20 + Math.random() * 40,
        vy: (Math.random() - 0.5) * 10,
        life: 3000 + Math.random() * 2000,
        maxLife: 5000,
      });
    }

    // 统计资源产出
    const food = this.getResource(RESOURCE_IDS.FOOD);
    if (food && food.perSecond > 0) {
      this._stats.totalFoodEarned += food.perSecond * (deltaTime / 1000);
    }
    const gold = this.getResource(RESOURCE_IDS.GOLD);
    if (gold && gold.perSecond > 0) {
      this._stats.totalGoldEarned += gold.perSecond * (deltaTime / 1000);
    }
    const faith = this.getResource(RESOURCE_IDS.FAITH);
    if (faith && faith.perSecond > 0) {
      this._stats.totalFaithEarned += faith.perSecond * (deltaTime / 1000);
    }

    // 检查建筑解锁条件
    this.checkBuildingUnlocks();
    // 检查资源解锁条件
    this.checkResourceUnlocks();
    // 检查时代演进
    this.checkEraAdvancement();
  }

  // ========== 核心玩法 ==========

  /**
   * 点击获得粮食
   */
  click(): number {
    if (this._status !== 'playing') return 0;

    let gained = FOOD_PER_CLICK;

    // 时代加成
    gained *= this.getEraProductionMultiplier();

    // 声望加成
    gained *= this.getPrestigeMultiplier();

    gained = Math.floor(gained * 100) / 100;

    this.addResource(RESOURCE_IDS.FOOD, gained);
    this._stats.totalFoodEarned += gained;
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
      x: PYRAMID_DRAW.centerX + Math.cos(angle) * dist,
      y: PYRAMID_DRAW.centerY + Math.sin(angle) * dist - 30,
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
    this._stats.totalBuildingsBuilt++;
    this.recalculateProduction();
    this.emit('upgradePurchased', upgradeId, upgrade.level);
    this.emit('stateChange');
    return true;
  }

  /**
   * 声望重置
   */
  doPrestige(): number {
    const food = this.getResource(RESOURCE_IDS.FOOD);
    if (!food || this._stats.totalFoodEarned < MIN_PRESTIGE_FOOD) return 0;

    // 计算获得的太阳神赐福
    const blessingsGained = Math.floor(
      PRESTIGE_BASE_BLESSINGS * Math.sqrt(this._stats.totalFoodEarned / MIN_PRESTIGE_FOOD)
    );

    if (blessingsGained <= 0) return 0;

    // 保存声望数据
    const savedPrestige = { ...this.prestige };
    savedPrestige.currency += blessingsGained;
    savedPrestige.count++;

    // 保存统计（部分重置）
    const savedStats: CivEgyptStatistics = {
      ...this._stats,
      totalFoodEarned: 0,
      totalGoldEarned: 0,
      totalFaithEarned: 0,
      totalClicks: 0,
    };

    // 保存法老威望（声望增加威望）
    const savedPharaohPrestige = this._pharaohPrestige + blessingsGained;
    const savedEraIndex = this._currentEraIndex;

    // 重置
    this.onInit();

    // 恢复声望
    this.prestige = savedPrestige;
    this._stats = savedStats;
    this._stats.totalPrestigeCount++;

    // 恢复法老威望和时代
    this._pharaohPrestige = savedPharaohPrestige;
    this._currentEraIndex = savedEraIndex;

    this.emit('prestige', blessingsGained);
    this.emit('stateChange');
    return blessingsGained;
  }

  /**
   * 获取声望加成倍率
   */
  getPrestigeMultiplier(): number {
    return 1 + this.prestige.currency * PRESTIGE_BONUS_MULTIPLIER;
  }

  /**
   * 获取时代产出倍率
   */
  getEraProductionMultiplier(): number {
    return ERAS[this._currentEraIndex].productionMultiplier;
  }

  /**
   * 获取预览声望赐福数
   */
  getPrestigePreview(): number {
    if (this._stats.totalFoodEarned < MIN_PRESTIGE_FOOD) return 0;
    return Math.floor(
      PRESTIGE_BASE_BLESSINGS * Math.sqrt(this._stats.totalFoodEarned / MIN_PRESTIGE_FOOD)
    );
  }

  /**
   * 检查是否可以声望
   */
  canPrestige(): boolean {
    return this._stats.totalFoodEarned >= MIN_PRESTIGE_FOOD;
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
   * 获取当前时代名称
   */
  getCurrentEraName(): string {
    return ERAS[this._currentEraIndex].name;
  }

  /**
   * 获取法老威望等级
   */
  getPharaohPrestigeLevel(): string {
    if (this._pharaohPrestige >= 10) return '半神法老';
    if (this._pharaohPrestige >= 6) return '伟大法老';
    if (this._pharaohPrestige >= 3) return '英明法老';
    if (this._pharaohPrestige >= 1) return '初立法老';
    return '部落首领';
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

      // 时代加成
      production *= this.getEraProductionMultiplier();

      // 声望加成
      production *= this.getPrestigeMultiplier();

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
    // 黄金：采石场等级 >= 1 时解锁
    const quarry = this.upgrades.get(BUILDING_IDS.QUARRY);
    if (quarry && quarry.level >= 1) {
      const gold = this.resources.get(RESOURCE_IDS.GOLD);
      if (gold && !gold.unlocked) {
        gold.unlocked = true;
        this.emit('resourceUnlocked', RESOURCE_IDS.GOLD);
      }
    }

    // 信仰：神庙等级 >= 1 时解锁
    const temple = this.upgrades.get(BUILDING_IDS.TEMPLE);
    if (temple && temple.level >= 1) {
      const faith = this.resources.get(RESOURCE_IDS.FAITH);
      if (faith && !faith.unlocked) {
        faith.unlocked = true;
        this.emit('resourceUnlocked', RESOURCE_IDS.FAITH);
      }
    }
  }

  /**
   * 检查时代演进
   */
  private checkEraAdvancement(): void {
    // 从最高时代向下检查，找到能达到的最高时代
    for (let i = ERAS.length - 1; i > this._currentEraIndex; i--) {
      if (this._pharaohPrestige >= ERAS[i].requiredPrestige) {
        this._currentEraIndex = i;
        this._stats.highestEraReached = Math.max(this._stats.highestEraReached, i);
        this.recalculateProduction();
        this.emit('eraAdvanced', ERAS[i].id, ERAS[i].name);
        break;
      }
    }
  }

  // ========== 渲染 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawSandParticles(ctx);
    this.drawNileRiver(ctx, w, h);
    this.drawPyramid(ctx, w);
    this.drawSun(ctx);
    this.drawFloatingTexts(ctx);
    this.drawResourcePanel(ctx, w);
    this.drawBuildingList(ctx, w, h);
    this.drawEraIndicator(ctx, w);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const era = ERAS[this._currentEraIndex];

    // 天空渐变
    const skyGradient = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    skyGradient.addColorStop(0, era.skyTop);
    skyGradient.addColorStop(1, era.skyBottom);
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, w, h * 0.5);

    // 沙漠渐变
    const sandGradient = ctx.createLinearGradient(0, h * 0.45, 0, h);
    sandGradient.addColorStop(0, COLORS.groundLight);
    sandGradient.addColorStop(1, COLORS.groundDark);
    ctx.fillStyle = sandGradient;
    ctx.fillRect(0, h * 0.45, w, h * 0.55);

    // 沙漠纹理
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 30; i++) {
      const x = ((i * 73 + 17) % w);
      const y = h * 0.45 + ((i * 47 + 23) % (h * 0.55));
      ctx.fillStyle = COLORS.sandDark;
      ctx.fillRect(x, y, 4, 2);
    }
    ctx.globalAlpha = 1;

    // 远处沙丘
    ctx.fillStyle = COLORS.sandDark;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.quadraticCurveTo(80, h * 0.38, 160, h * 0.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(200, h * 0.5);
    ctx.quadraticCurveTo(300, h * 0.35, 400, h * 0.5);
    ctx.fill();

    // 星星（夜晚效果）
    ctx.fillStyle = COLORS.textPrimary;
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 15; i++) {
      const sx = (i * 37 + 11) % w;
      const sy = (i * 23 + 7) % (h * 0.3);
      const sr = 0.5 + (i % 3) * 0.3;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawNileRiver(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 尼罗河
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, h * 0.48);
    for (let x = 0; x <= w; x += 20) {
      const wave = Math.sin((x + this._nileWaveOffset) * 0.03) * 5;
      ctx.lineTo(x, h * 0.48 + wave);
    }
    ctx.lineTo(w, h * 0.52);
    for (let x = w; x >= 0; x -= 20) {
      const wave = Math.sin((x + this._nileWaveOffset) * 0.03) * 3;
      ctx.lineTo(x, h * 0.52 + wave);
    }
    ctx.closePath();
    ctx.fillStyle = COLORS.nileColor;
    ctx.globalAlpha = 0.6;
    ctx.fill();
    ctx.globalAlpha = 1;

    // 河面高光
    ctx.beginPath();
    ctx.moveTo(0, h * 0.49);
    for (let x = 0; x <= w; x += 20) {
      const wave = Math.sin((x + this._nileWaveOffset * 1.2) * 0.04) * 2;
      ctx.lineTo(x, h * 0.49 + wave);
    }
    ctx.lineTo(w, h * 0.50);
    ctx.lineTo(0, h * 0.50);
    ctx.closePath();
    ctx.fillStyle = COLORS.nileHighlight;
    ctx.globalAlpha = 0.3;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private drawPyramid(ctx: CanvasRenderingContext2D, w: number): void {
    const cx = PYRAMID_DRAW.centerX;
    const cy = PYRAMID_DRAW.centerY;
    const scale = this._clickScale;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // 金字塔阴影
    ctx.beginPath();
    ctx.moveTo(4, PYRAMID_DRAW.height * 0.4 + 4);
    ctx.lineTo(PYRAMID_DRAW.baseWidth * 0.5 + 4, PYRAMID_DRAW.height * 0.4 + 4);
    ctx.lineTo(4, PYRAMID_DRAW.height * 0.4 + 4);
    ctx.closePath();
    ctx.fillStyle = COLORS.shadowColor;
    ctx.fill();

    // 金字塔主体（左面）
    ctx.beginPath();
    ctx.moveTo(0, -PYRAMID_DRAW.height * 0.5);
    ctx.lineTo(-PYRAMID_DRAW.baseWidth * 0.5, PYRAMID_DRAW.height * 0.4);
    ctx.lineTo(0, PYRAMID_DRAW.height * 0.4);
    ctx.closePath();
    ctx.fillStyle = COLORS.pyramidColor;
    ctx.fill();

    // 金字塔主体（右面，稍暗）
    ctx.beginPath();
    ctx.moveTo(0, -PYRAMID_DRAW.height * 0.5);
    ctx.lineTo(PYRAMID_DRAW.baseWidth * 0.5, PYRAMID_DRAW.height * 0.4);
    ctx.lineTo(0, PYRAMID_DRAW.height * 0.4);
    ctx.closePath();
    ctx.fillStyle = COLORS.pyramidShadow;
    ctx.fill();

    // 金字塔层级线条
    ctx.strokeStyle = 'rgba(139, 105, 20, 0.5)';
    ctx.lineWidth = 1;
    for (let i = 1; i < PYRAMID_DRAW.layerCount; i++) {
      const ratio = i / PYRAMID_DRAW.layerCount;
      const y = -PYRAMID_DRAW.height * 0.5 + PYRAMID_DRAW.height * 0.9 * ratio;
      const halfW = PYRAMID_DRAW.baseWidth * 0.5 * ratio;
      ctx.beginPath();
      ctx.moveTo(-halfW, y);
      ctx.lineTo(halfW, y);
      ctx.stroke();
    }

    // 金字塔顶点（本本石）
    ctx.beginPath();
    ctx.arc(0, -PYRAMID_DRAW.height * 0.5, 4, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.goldColor;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -PYRAMID_DRAW.height * 0.5, 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 214, 0, 0.3)';
    ctx.fill();

    ctx.restore();
  }

  private drawSun(ctx: CanvasRenderingContext2D): void {
    const sx = 70;
    const sy = 55 + this._sunPulse;

    // 太阳光晕
    ctx.beginPath();
    ctx.arc(sx, sy, 30, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 214, 0, 0.15)';
    ctx.fill();

    // 太阳本体
    ctx.beginPath();
    ctx.arc(sx, sy, 18, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.sunColor;
    ctx.fill();

    // 太阳光线
    ctx.strokeStyle = COLORS.sunColor;
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4 + this._pyramidAnimTimer * 0.001;
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(angle) * 22, sy + Math.sin(angle) * 22);
      ctx.lineTo(sx + Math.cos(angle) * 28, sy + Math.sin(angle) * 28);
      ctx.stroke();
    }
  }

  private drawSandParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this._sandParticles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha * 0.4;
      ctx.fillStyle = COLORS.sandLight;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
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
      const icon = res.id === RESOURCE_IDS.FOOD ? '🌾' : res.id === RESOURCE_IDS.GOLD ? '🪙' : '🙏';

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
            const icon = id === RESOURCE_IDS.FOOD ? '🌾' : id === RESOURCE_IDS.GOLD ? '🪙' : '🙏';
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
    ctx.fillText('空格 点击 · ↑↓ 选择 · Enter 购买 · P 声望', w / 2, h - 10);
  }

  private drawEraIndicator(ctx: CanvasRenderingContext2D, w: number): void {
    const era = ERAS[this._currentEraIndex];

    // 时代指示器背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.roundRect(ctx, w - 130, 40, 120, 24, 4);
    ctx.fill();

    // 时代文字
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.accent;
    ctx.textAlign = 'center';
    ctx.fillText(`${era.icon} ${era.name}`, w - 70, 56);

    // 法老威望
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.roundRect(ctx, w - 130, 68, 120, 20, 4);
    ctx.fill();

    ctx.font = '10px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textSecondary;
    ctx.fillText(`👑 ${this.getPharaohPrestigeLevel()}`, w - 70, 82);
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

  getState(): CivEgyptState {
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
      prestige: { ...this.prestige },
      statistics: { ...this._stats },
      selectedIndex: this._selectedIndex,
      currentEra: ERAS[this._currentEraIndex].id,
      pharaohPrestige: this._pharaohPrestige,
    };
  }

  /**
   * 从状态恢复
   */
  loadState(state: CivEgyptState): void {
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

    // 恢复声望
    if (state.prestige) {
      this.prestige = { ...state.prestige };
    }

    // 恢复统计
    if (state.statistics) {
      this._stats = { ...state.statistics } as CivEgyptStatistics;
    }

    // 恢复选中
    if (state.selectedIndex !== undefined) {
      this._selectedIndex = state.selectedIndex;
    }

    // 恢复时代
    if (state.currentEra) {
      const eraIndex = ERAS.findIndex((e) => e.id === state.currentEra);
      if (eraIndex >= 0) {
        this._currentEraIndex = eraIndex;
      }
    }

    // 恢复法老威望
    if (state.pharaohPrestige !== undefined) {
      this._pharaohPrestige = state.pharaohPrestige;
    }

    // 重新计算产出
    this.recalculateProduction();

    this.emit('stateChange');
  }

  // ========== 存档覆盖 ==========

  save(): SaveData {
    const data = super.save();
    // 附加法老威望、时代和统计信息到 settings
    data.settings = {
      pharaohPrestige: this._pharaohPrestige,
      currentEraIndex: this._currentEraIndex,
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
      if (settings.pharaohPrestige !== undefined) {
        this._pharaohPrestige = settings.pharaohPrestige;
      }
      if (settings.currentEraIndex !== undefined) {
        this._currentEraIndex = settings.currentEraIndex;
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
