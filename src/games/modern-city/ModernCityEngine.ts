/**
 * 现代都市 (Modern City) — 放置类游戏引擎
 *
 * 继承 IdleGameEngine，实现：
 * - 多资源系统（金币/人口/科技）
 * - 建筑升级系统（8种建筑）
 * - 城市等级系统（10级）
 * - 科技树（通过建筑前置依赖体现）
 * - 声望重置系统
 * - Canvas 现代都市风格渲染
 * - 离线收益
 * - 自动存档
 */
import { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { Resource, Upgrade, SaveData } from '@/types/idle';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  COIN_PER_CLICK,
  PRESTIGE_BONUS_MULTIPLIER,
  PRESTIGE_BASE_POINTS,
  MIN_PRESTIGE_COIN,
  CITY_LEVEL_COSTS,
  MAX_CITY_LEVEL,
  BUILDINGS,
  COLORS,
  CITY_DRAW,
  BUILDING_PANEL,
  RESOURCE_PANEL,
  RESOURCE_IDS,
  BUILDING_IDS,
  type BuildingDef,
} from './constants';

/** 游戏统计 */
export interface ModernCityStatistics {
  totalCoinEarned: number;
  totalClicks: number;
  totalPopulationEarned: number;
  totalTechEarned: number;
  totalPrestigeCount: number;
  totalBuildingsPurchased: number;
  totalCityUpgrades: number;
}

/** 现代都市游戏状态 */
export interface ModernCityState {
  [key: string]: unknown;
  resources: Record<string, { amount: number; perSecond: number; unlocked: boolean }>;
  buildings: Record<string, number>;
  prestige: { currency: number; count: number };
  statistics: ModernCityStatistics;
  selectedIndex: number;
  cityLevel: number;
}

export class ModernCityEngine extends IdleGameEngine {
  // ========== 游戏状态 ==========

  protected _gameId = 'modern-city';

  constructor() {
    super();
    // Override base class `statistics` instance field with a getter/setter,
    // because class fields shadow prototype accessors.
    Object.defineProperty(this, 'statistics', {
      get: () => ({ ...this._stats }) as ModernCityStatistics,
      set: (_val: Record<string, number>) => { /* base class writes are no-ops */ },
      configurable: true,
      enumerable: true,
    });
  }

  /** 当前选中的建筑索引 */
  private _selectedIndex: number = 0;

  /** 城市等级 */
  private _cityLevel: number = 1;

  /** 统计数据 */
  private _stats: ModernCityStatistics = {
    totalCoinEarned: 0,
    totalClicks: 0,
    totalPopulationEarned: 0,
    totalTechEarned: 0,
    totalPrestigeCount: 0,
    totalBuildingsPurchased: 0,
    totalCityUpgrades: 0,
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

  /** 城市动画计时器 */
  private _cityAnimTimer: number = 0;
  /** 窗户闪烁计时器 */
  private _windowBlinkTimer: number = 0;
  /** 窗户亮灯状态 */
  private _windowLights: boolean[][] = [];
  /** 点击缩放效果 */
  private _clickScale: number = 1;
  private _clickAnimTimer: number = 0;
  /** 星星粒子 */
  private _starParticles: Array<{
    x: number;
    y: number;
    size: number;
    brightness: number;
    speed: number;
  }> = [];

  // ========== 公开属性 ==========

  get selectedIndex(): number {
    return this._selectedIndex;
  }

  get cityLevel(): number {
    return this._cityLevel;
  }

  get totalCoinEarned(): number {
    return this._stats.totalCoinEarned;
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
        id: RESOURCE_IDS.COIN,
        name: '金币',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e15,
        unlocked: true,
      },
      {
        id: RESOURCE_IDS.POPULATION,
        name: '人口',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e12,
        unlocked: false,
      },
      {
        id: RESOURCE_IDS.TECH,
        name: '科技',
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
        unlocked: b.id === BUILDING_IDS.HOUSE, // 住宅初始解锁
        requires: b.requires,
        icon: b.icon,
      }))
    );

    // 重置状态
    this._selectedIndex = 0;
    this._cityLevel = 1;
    this._stats = {
      totalCoinEarned: 0,
      totalClicks: 0,
      totalPopulationEarned: 0,
      totalTechEarned: 0,
      totalPrestigeCount: 0,
      totalBuildingsPurchased: 0,
      totalCityUpgrades: 0,
    };
    this._floatingTexts = [];
    this._cityAnimTimer = 0;
    this._windowBlinkTimer = 0;
    this._clickScale = 1;
    this._clickAnimTimer = 0;
    this._windowLights = [];
    this._starParticles = [];

    // 初始化星星
    for (let i = 0; i < 30; i++) {
      this._starParticles.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CITY_DRAW.groundY * 0.6,
        size: 0.5 + Math.random() * 1.5,
        brightness: 0.3 + Math.random() * 0.7,
        speed: 0.5 + Math.random() * 2,
      });
    }
  }

  protected onUpdate(deltaTime: number): void {
    // 城市动画
    this._cityAnimTimer += deltaTime;
    this._windowBlinkTimer += deltaTime;

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

    // 星星闪烁
    for (const star of this._starParticles) {
      star.brightness = 0.3 + Math.abs(Math.sin(this._cityAnimTimer * 0.001 * star.speed)) * 0.7;
    }

    // 统计资源产出
    const coin = this.getResource(RESOURCE_IDS.COIN);
    if (coin && coin.perSecond > 0) {
      this._stats.totalCoinEarned += coin.perSecond * (deltaTime / 1000);
    }
    const pop = this.getResource(RESOURCE_IDS.POPULATION);
    if (pop && pop.perSecond > 0) {
      this._stats.totalPopulationEarned += pop.perSecond * (deltaTime / 1000);
    }
    const tech = this.getResource(RESOURCE_IDS.TECH);
    if (tech && tech.perSecond > 0) {
      this._stats.totalTechEarned += tech.perSecond * (deltaTime / 1000);
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

    let gained = COIN_PER_CLICK;

    // 城市等级加成
    gained *= this.getCityLevelMultiplier();

    // 声望加成
    gained *= this.getPrestigeMultiplier();

    gained = Math.floor(gained * 100) / 100;

    this.addResource(RESOURCE_IDS.COIN, gained);
    this._stats.totalCoinEarned += gained;
    this._stats.totalClicks++;
    this.addScore(gained);

    // 点击动画
    this._clickScale = 1.15;
    this._clickAnimTimer = 150;

    // 飘字
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 40;
    this._floatingTexts.push({
      text: `+$${this.formatNumber(gained)}`,
      x: CITY_DRAW.centerX + Math.cos(angle) * dist,
      y: CITY_DRAW.centerY + Math.sin(angle) * dist - 30,
      life: 800,
      maxLife: 800,
      color: COLORS.coinColor,
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

    // 检查城市等级要求
    if (building.requiresCityLevel && this._cityLevel < building.requiresCityLevel) {
      return false;
    }

    // 检查前置建筑
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
    this._stats.totalBuildingsPurchased++;
    this.recalculateProduction();
    this.emit('upgradePurchased', upgradeId, upgrade.level);
    this.emit('stateChange');
    return true;
  }

  /**
   * 升级城市等级
   */
  upgradeCity(): boolean {
    if (this._cityLevel >= MAX_CITY_LEVEL) return false;

    const nextLevel = this._cityLevel + 1;
    const cost = CITY_LEVEL_COSTS[nextLevel];
    if (!cost) return false;

    const coin = this.getResource(RESOURCE_IDS.COIN);
    if (!coin || coin.amount < cost) return false;

    this.spendResource(RESOURCE_IDS.COIN, cost);
    this._cityLevel = nextLevel;
    this._stats.totalCityUpgrades++;

    // 检查是否有新建筑因城市等级解锁
    this.checkBuildingUnlocks();

    this.emit('cityUpgraded', nextLevel);
    this.emit('stateChange');
    return true;
  }

  /**
   * 获取城市升级费用
   */
  getCityUpgradeCost(): number {
    const nextLevel = this._cityLevel + 1;
    return CITY_LEVEL_COSTS[nextLevel] ?? 0;
  }

  /**
   * 检查是否可以升级城市
   */
  canUpgradeCity(): boolean {
    if (this._cityLevel >= MAX_CITY_LEVEL) return false;
    const cost = this.getCityUpgradeCost();
    return cost > 0 && this.hasResource(RESOURCE_IDS.COIN, cost);
  }

  /**
   * 声望重置
   */
  doPrestige(): number {
    if (this._stats.totalCoinEarned < MIN_PRESTIGE_COIN) return 0;

    // 计算获得的声望点数
    const pointsGained = Math.floor(
      PRESTIGE_BASE_POINTS * Math.sqrt(this._stats.totalCoinEarned / MIN_PRESTIGE_COIN)
    );

    if (pointsGained <= 0) return 0;

    // 保存声望数据
    const savedPrestige = { ...this.prestige };
    savedPrestige.currency += pointsGained;
    savedPrestige.count++;

    // 保存统计（部分重置）
    const savedStats: ModernCityStatistics = {
      ...this._stats,
      totalCoinEarned: 0,
      totalClicks: 0,
      totalPopulationEarned: 0,
      totalTechEarned: 0,
    };

    // 重置
    this.onInit();

    // 恢复声望
    this.prestige = savedPrestige;
    this._stats = savedStats as ModernCityStatistics;
    this._stats.totalPrestigeCount++;

    this.emit('prestige', pointsGained);
    this.emit('stateChange');
    return pointsGained;
  }

  /**
   * 获取声望加成倍率
   */
  getPrestigeMultiplier(): number {
    return 1 + this.prestige.currency * PRESTIGE_BONUS_MULTIPLIER;
  }

  /**
   * 获取城市等级加成倍率
   */
  getCityLevelMultiplier(): number {
    return 1 + (this._cityLevel - 1) * 0.15; // 每级 +15%
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
   * 获取预览声望点数
   */
  getPrestigePreview(): number {
    if (this._stats.totalCoinEarned < MIN_PRESTIGE_COIN) return 0;
    return Math.floor(
      PRESTIGE_BASE_POINTS * Math.sqrt(this._stats.totalCoinEarned / MIN_PRESTIGE_COIN)
    );
  }

  /**
   * 检查是否可以声望
   */
  canPrestige(): boolean {
    return this._stats.totalCoinEarned >= MIN_PRESTIGE_COIN;
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

      // 声望加成
      production *= this.getPrestigeMultiplier();

      // 城市等级加成
      production *= this.getCityLevelMultiplier();

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

      // 检查城市等级要求
      if (building.requiresCityLevel && this._cityLevel < building.requiresCityLevel) {
        continue;
      }

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
    // 人口：住宅等级 >= 1 时解锁
    const house = this.upgrades.get(BUILDING_IDS.HOUSE);
    if (house && house.level >= 1) {
      const pop = this.resources.get(RESOURCE_IDS.POPULATION);
      if (pop && !pop.unlocked) {
        pop.unlocked = true;
        this.emit('resourceUnlocked', RESOURCE_IDS.POPULATION);
      }
    }

    // 科技：学校等级 >= 1 时解锁
    const school = this.upgrades.get(BUILDING_IDS.SCHOOL);
    if (school && school.level >= 1) {
      const tech = this.resources.get(RESOURCE_IDS.TECH);
      if (tech && !tech.unlocked) {
        tech.unlocked = true;
        this.emit('resourceUnlocked', RESOURCE_IDS.TECH);
      }
    }
  }

  // ========== 渲染 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawStarParticles(ctx);
    this.drawCitySkyline(ctx, w);
    this.drawFloatingTexts(ctx);
    this.drawResourcePanel(ctx, w);
    this.drawBuildingList(ctx, w, h);
    this.drawCityLevelBadge(ctx, w);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 天空渐变（都市夜景）
    const skyGradient = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    skyGradient.addColorStop(0, COLORS.skyTop);
    skyGradient.addColorStop(1, COLORS.skyBottom);
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, w, h * 0.5);

    // 地面渐变
    const groundGradient = ctx.createLinearGradient(0, CITY_DRAW.groundY - 20, 0, h);
    groundGradient.addColorStop(0, COLORS.groundLight);
    groundGradient.addColorStop(1, COLORS.groundDark);
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, CITY_DRAW.groundY - 20, w, h - CITY_DRAW.groundY + 20);

    // 地面纹理（城市道路线条）
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#95A5A6';
    // 水平道路
    ctx.fillRect(0, CITY_DRAW.groundY, w, 3);
    // 垂直道路
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(i * (w / 5), CITY_DRAW.groundY, 2, h - CITY_DRAW.groundY);
    }
    ctx.globalAlpha = 1;
  }

  private drawStarParticles(ctx: CanvasRenderingContext2D): void {
    for (const star of this._starParticles) {
      ctx.globalAlpha = star.brightness;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawCitySkyline(ctx: CanvasRenderingContext2D, w: number): void {
    const groundY = CITY_DRAW.groundY;
    const scale = this._clickScale;

    ctx.save();
    ctx.translate(CITY_DRAW.centerX, groundY);
    ctx.scale(scale, scale);

    // 绘制已有建筑的剪影
    const buildingCount = this.getBuiltBuildingCount();
    const totalWidth = Math.min(buildingCount * 30, w * 0.8);
    const startX = -totalWidth / 2;

    for (let i = 0; i < Math.min(buildingCount, 10); i++) {
      const bx = startX + i * 30;
      const bh = 40 + (i * 15) + Math.min(this._cityLevel * 8, 60);
      const bw = 25;

      // 建筑主体
      ctx.fillStyle = '#2C3E50';
      ctx.fillRect(bx, -bh, bw, bh);

      // 窗户
      ctx.fillStyle = COLORS.windowColor;
      const cols = 2;
      const rows = Math.floor(bh / 12);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const wx = bx + 4 + c * 10;
          const wy = -bh + 6 + r * 12;
          // 随机亮灭
          const isLit = Math.sin(this._cityAnimTimer * 0.001 + i * 3 + r * 2 + c) > -0.3;
          if (isLit) {
            ctx.globalAlpha = 0.6 + Math.sin(this._cityAnimTimer * 0.002 + r + c) * 0.3;
            ctx.fillRect(wx, wy, 6, 6);
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    // 如果没有建筑，画一个小房子
    if (buildingCount === 0) {
      ctx.fillStyle = '#34495E';
      ctx.fillRect(-15, -30, 30, 30);
      // 屋顶
      ctx.beginPath();
      ctx.moveTo(-20, -30);
      ctx.lineTo(0, -45);
      ctx.lineTo(20, -30);
      ctx.closePath();
      ctx.fillStyle = '#E74C3C';
      ctx.fill();
      // 门
      ctx.fillStyle = COLORS.windowColor;
      ctx.fillRect(-4, -15, 8, 15);
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
      const icon = res.id === RESOURCE_IDS.COIN ? '💰' : res.id === RESOURCE_IDS.POPULATION ? '👥' : '🔬';

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
            const icon = id === RESOURCE_IDS.COIN ? '💰' : id === RESOURCE_IDS.POPULATION ? '👥' : '🔬';
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
    ctx.fillText('空格 点击 · ↑↓ 选择 · Enter 购买 · U 升级城市 · P 声望', w / 2, h - 10);
  }

  private drawCityLevelBadge(ctx: CanvasRenderingContext2D, w: number): void {
    // 城市等级徽章
    const badgeX = w - 70;
    const badgeY = 10;
    const badgeW = 60;
    const badgeH = 22;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 4);
    ctx.fill();

    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.accentYellow;
    ctx.textAlign = 'center';
    ctx.fillText(`Lv.${this._cityLevel} 都市`, badgeX + badgeW / 2, badgeY + 15);
  }

  /** 获取已建造建筑总数 */
  private getBuiltBuildingCount(): number {
    let count = 0;
    for (const building of BUILDINGS) {
      const upgrade = this.upgrades.get(building.id);
      if (upgrade && upgrade.level > 0) {
        count += upgrade.level;
      }
    }
    return count;
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
        this.upgradeCity();
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

  getState(): ModernCityState {
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
      cityLevel: this._cityLevel,
    };
  }

  /**
   * 从状态恢复
   */
  loadState(state: ModernCityState): void {
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
      this._stats = { ...state.statistics } as ModernCityStatistics;
    }

    // 恢复选中
    if (state.selectedIndex !== undefined) {
      this._selectedIndex = state.selectedIndex;
    }

    // 恢复城市等级
    if (state.cityLevel !== undefined) {
      this._cityLevel = state.cityLevel;
    }

    // 重新计算产出
    this.recalculateProduction();

    this.emit('stateChange');
  }

  // ========== 存档覆盖 ==========

  save(): SaveData {
    const data = super.save();
    // 附加城市等级和统计信息到 settings
    data.settings = {
      cityLevel: this._cityLevel,
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
      if (settings.cityLevel !== undefined) {
        this._cityLevel = settings.cityLevel;
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
