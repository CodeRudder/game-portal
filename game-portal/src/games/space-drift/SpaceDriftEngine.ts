/**
 * 太空漂流 (Space Drift) — 放置类游戏引擎
 *
 * 继承 IdleGameEngine，实现：
 * - 多资源系统（矿石/能量/数据）
 * - 建筑升级系统（8 种太空设施）
 * - 星系探索系统（6 个星系）
 * - 飞船升级系统
 * - 声望重置系统（星际信用点）
 * - Canvas 太空风格渲染
 * - 离线收益
 * - 自动存档
 */
import { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { Resource, Upgrade, SaveData } from '@/types/idle';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  ORE_PER_CLICK,
  CREDIT_BONUS_MULTIPLIER,
  PRESTIGE_BASE_CREDITS,
  MIN_PRESTIGE_ORE,
  GALAXIES,
  BUILDINGS,
  COLORS,
  SHIP_DRAW,
  SHIP_UPGRADE_COSTS,
  MAX_SHIP_LEVEL,
  BUILDING_PANEL,
  RESOURCE_PANEL,
  type GalaxyDef,
  type BuildingDef,
} from './constants';

/** 星系状态 */
export interface GalaxyState {
  id: string;
  unlocked: boolean;
  /** 探索等级 0-5 */
  explorationLevel: number;
}

/** 游戏统计 */
export interface SpaceDriftStatistics {
  totalOreEarned: number;
  totalClicks: number;
  totalEnergyEarned: number;
  totalDataEarned: number;
  totalPrestigeCount: number;
  totalGalaxiesUnlocked: number;
  totalShipUpgrades: number;
}

/** 太空漂流游戏状态 */
export interface SpaceDriftState {
  [key: string]: unknown;
  resources: Record<string, { amount: number; perSecond: number; unlocked: boolean }>;
  buildings: Record<string, number>;
  galaxies: GalaxyState[];
  prestige: { currency: number; count: number };
  statistics: SpaceDriftStatistics;
  selectedIndex: number;
}

export class SpaceDriftEngine extends IdleGameEngine {
  // ========== 游戏状态 ==========

  protected _gameId = 'space-drift';

  constructor() {
    super();
    // Override base class `statistics` instance field with a getter/setter,
    // because class fields shadow prototype accessors.
    Object.defineProperty(this, 'statistics', {
      get: () => ({ ...this._stats }) as SpaceDriftStatistics,
      set: (_val: Record<string, number>) => { /* base class writes are no-ops */ },
      configurable: true,
      enumerable: true,
    });
  }

  /** 星系状态 */
  private _galaxies: GalaxyState[] = GALAXIES.map((g) => ({
    id: g.id,
    unlocked: g.id === 'sol', // 太阳系初始解锁
    explorationLevel: 0,
  }));

  /** 当前选中的建筑索引 */
  private _selectedIndex: number = 0;

  /** 统计数据 */
  private _stats: SpaceDriftStatistics = {
    totalOreEarned: 0,
    totalClicks: 0,
    totalEnergyEarned: 0,
    totalDataEarned: 0,
    totalPrestigeCount: 0,
    totalGalaxiesUnlocked: 1,
    totalShipUpgrades: 0,
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

  /** 飞船动画计时器 */
  private _shipAnimTimer: number = 0;
  /** 飞船浮动偏移 */
  private _shipFloat: number = 0;
  /** 飞船倾斜角度 */
  private _shipTilt: number = 0;
  /** 点击缩放效果 */
  private _clickScale: number = 1;
  private _clickAnimTimer: number = 0;
  /** 引擎火焰粒子 */
  private _engineParticles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
  }> = [];

  /** 背景星星 */
  private _stars: Array<{ x: number; y: number; size: number; brightness: number; speed: number }> = [];

  /** 星云粒子 */
  private _nebulaParticles: Array<{
    x: number;
    y: number;
    radius: number;
    alpha: number;
    color: string;
    vx: number;
    vy: number;
  }> = [];

  // ========== 公开属性 ==========

  get selectedIndex(): number {
    return this._selectedIndex;
  }

  get galaxies(): GalaxyState[] {
    return this._galaxies.map((g) => ({ ...g }));
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
        id: 'ore',
        name: '矿石',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e15,
        unlocked: true,
      },
      {
        id: 'energy',
        name: '能量',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e12,
        unlocked: false,
      },
      {
        id: 'data',
        name: '数据',
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
        unlocked: b.id === 'miner_drone', // 采矿无人机初始解锁
        requires: b.requires,
        icon: b.icon,
      }))
    );

    // 重置状态
    this._galaxies = GALAXIES.map((g) => ({
      id: g.id,
      unlocked: g.id === 'sol',
      explorationLevel: 0,
    }));
    this._selectedIndex = 0;
    this._stats = {
      totalOreEarned: 0,
      totalClicks: 0,
      totalEnergyEarned: 0,
      totalDataEarned: 0,
      totalPrestigeCount: 0,
      totalGalaxiesUnlocked: 1,
      totalShipUpgrades: 0,
    };
    this._floatingTexts = [];
    this._shipAnimTimer = 0;
    this._shipFloat = 0;
    this._shipTilt = 0;
    this._clickScale = 1;
    this._clickAnimTimer = 0;
    this._engineParticles = [];

    // 初始化背景星星
    this._stars = [];
    for (let i = 0; i < 60; i++) {
      this._stars.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT * 0.6,
        size: 0.5 + Math.random() * 2,
        brightness: 0.3 + Math.random() * 0.7,
        speed: 0.1 + Math.random() * 0.3,
      });
    }

    // 初始化星云粒子
    this._nebulaParticles = [];
    for (let i = 0; i < 8; i++) {
      this._nebulaParticles.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT * 0.5,
        radius: 20 + Math.random() * 40,
        alpha: 0.05 + Math.random() * 0.1,
        color: i % 2 === 0 ? COLORS.nebulaColor1 : COLORS.nebulaColor2,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.1,
      });
    }
  }

  protected onUpdate(deltaTime: number): void {
    // 飞船动画
    this._shipAnimTimer += deltaTime;
    this._shipFloat = Math.sin(this._shipAnimTimer * 0.002) * 5;
    this._shipTilt = Math.sin(this._shipAnimTimer * 0.001) * 0.03;

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

    // 引擎火焰粒子更新
    this._engineParticles = this._engineParticles.filter((p) => {
      p.life -= deltaTime;
      p.x += p.vx * (deltaTime / 1000);
      p.y += p.vy * (deltaTime / 1000);
      return p.life > 0;
    });

    // 随机产生引擎粒子
    if (Math.random() < 0.15) {
      this._engineParticles.push({
        x: SHIP_DRAW.centerX + (Math.random() - 0.5) * 8,
        y: SHIP_DRAW.centerY + SHIP_DRAW.bodyHeight * 0.5 + 5,
        vx: (Math.random() - 0.5) * 15,
        vy: 20 + Math.random() * 40,
        life: 600 + Math.random() * 600,
        maxLife: 1200,
      });
    }

    // 星云粒子移动
    for (const np of this._nebulaParticles) {
      np.x += np.vx;
      np.y += np.vy;
      if (np.x < -50) np.x = CANVAS_WIDTH + 50;
      if (np.x > CANVAS_WIDTH + 50) np.x = -50;
      if (np.y < -50) np.y = CANVAS_HEIGHT * 0.5 + 50;
      if (np.y > CANVAS_HEIGHT * 0.5 + 50) np.y = -50;
    }

    // 统计资源产出
    const ore = this.getResource('ore');
    if (ore && ore.perSecond > 0) {
      this._stats.totalOreEarned += ore.perSecond * (deltaTime / 1000);
    }
    const energy = this.getResource('energy');
    if (energy && energy.perSecond > 0) {
      this._stats.totalEnergyEarned += energy.perSecond * (deltaTime / 1000);
    }
    const data = this.getResource('data');
    if (data && data.perSecond > 0) {
      this._stats.totalDataEarned += data.perSecond * (deltaTime / 1000);
    }

    // 检查建筑解锁条件
    this.checkBuildingUnlocks();
    // 检查资源解锁条件
    this.checkResourceUnlocks();
  }

  // ========== 核心玩法 ==========

  /**
   * 点击获得矿石
   */
  click(): number {
    if (this._status !== 'playing') return 0;

    let gained = ORE_PER_CLICK;

    // 星系点击加成
    gained *= this.getClickMultiplier();

    // 声望加成
    gained *= this.getPrestigeMultiplier();

    gained = Math.floor(gained * 100) / 100;

    this.addResource('ore', gained);
    this._stats.totalOreEarned += gained;
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
      x: SHIP_DRAW.centerX + Math.cos(angle) * dist,
      y: SHIP_DRAW.centerY + Math.sin(angle) * dist - 30,
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
   * 解锁星系
   */
  unlockGalaxy(galaxyId: string): boolean {
    const galaxyDef = GALAXIES.find((g) => g.id === galaxyId);
    if (!galaxyDef) return false;

    const galaxyState = this._galaxies.find((g) => g.id === galaxyId);
    if (!galaxyState || galaxyState.unlocked) return false;

    if (!this.hasResource('ore', galaxyDef.unlockCost)) return false;

    this.spendResource('ore', galaxyDef.unlockCost);
    galaxyState.unlocked = true;
    this._stats.totalGalaxiesUnlocked++;

    // 重新计算产出
    this.recalculateProduction();

    this.emit('galaxyUnlocked', galaxyId);
    this.emit('stateChange');
    return true;
  }

  /**
   * 升级飞船（探索等级）
   */
  upgradeShip(galaxyId: string): boolean {
    const galaxyState = this._galaxies.find((g) => g.id === galaxyId);
    if (!galaxyState || !galaxyState.unlocked) return false;

    const nextLevel = galaxyState.explorationLevel + 1;
    if (nextLevel > MAX_SHIP_LEVEL) return false;

    const cost = this.getShipUpgradeCost(nextLevel);
    if (!this.canAfford(cost)) return false;

    // 扣除资源
    for (const [resId, amount] of Object.entries(cost)) {
      this.spendResource(resId, amount);
    }

    galaxyState.explorationLevel = nextLevel;
    this._stats.totalShipUpgrades++;

    // 重新计算产出
    this.recalculateProduction();

    this.emit('shipUpgraded', galaxyId, nextLevel);
    this.emit('stateChange');
    return true;
  }

  /**
   * 获取飞船升级费用
   */
  getShipUpgradeCost(level: number): Record<string, number> {
    return SHIP_UPGRADE_COSTS[level] ? { ...SHIP_UPGRADE_COSTS[level] } : {};
  }

  /**
   * 获取星系探索等级
   */
  getGalaxyExplorationLevel(galaxyId: string): number {
    const galaxy = this._galaxies.find((g) => g.id === galaxyId);
    return galaxy ? galaxy.explorationLevel : 0;
  }

  /**
   * 声望重置
   */
  doPrestige(): number {
    const ore = this.getResource('ore');
    if (!ore || this._stats.totalOreEarned < MIN_PRESTIGE_ORE) return 0;

    // 计算获得的星际信用点
    const creditsGained = Math.floor(
      PRESTIGE_BASE_CREDITS * Math.sqrt(this._stats.totalOreEarned / MIN_PRESTIGE_ORE)
    );

    if (creditsGained <= 0) return 0;

    // 保存星际信用点
    const savedPrestige = { ...this.prestige };
    this.prestige.currency += creditsGained;
    this.prestige.count++;
    this._stats.totalPrestigeCount++;

    // 重置资源和建筑（保留星际信用点和声望数据）
    const prestigeData = { ...this.prestige };
    const savedStats = {
      ...this._stats,
      totalOreEarned: 0,
      totalClicks: 0,
      totalEnergyEarned: 0,
      totalDataEarned: 0,
    };

    // 保存星系探索等级（声望保留探索等级）
    const savedGalaxyExplorations = this._galaxies.map((g) => ({
      id: g.id,
      explorationLevel: g.explorationLevel,
      unlocked: g.unlocked,
    }));

    // 重置
    this.onInit();

    // 恢复声望和部分统计
    this.prestige = prestigeData;
    this._stats = savedStats as SpaceDriftStatistics;

    // 恢复星系探索等级
    for (const saved of savedGalaxyExplorations) {
      const galaxy = this._galaxies.find((g) => g.id === saved.id);
      if (galaxy) {
        galaxy.explorationLevel = saved.explorationLevel;
        galaxy.unlocked = saved.unlocked;
      }
    }

    this.emit('prestige', creditsGained);
    this.emit('stateChange');
    return creditsGained;
  }

  /**
   * 获取声望加成倍率
   */
  getPrestigeMultiplier(): number {
    return 1 + this.prestige.currency * CREDIT_BONUS_MULTIPLIER;
  }

  /**
   * 获取点击加成倍率
   */
  getClickMultiplier(): number {
    let multiplier = 1;
    for (const galaxy of this._galaxies) {
      if (!galaxy.unlocked) continue;
      const def = GALAXIES.find((g) => g.id === galaxy.id);
      if (!def) continue;
      if (def.bonusType === 'click' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        // 探索加成
        bonus *= Math.pow(def.evolutionMultiplier, galaxy.explorationLevel);
        multiplier += bonus;
      }
    }
    return multiplier;
  }

  /**
   * 获取矿石加成倍率
   */
  getOreMultiplier(): number {
    let multiplier = 1;
    for (const galaxy of this._galaxies) {
      if (!galaxy.unlocked) continue;
      const def = GALAXIES.find((g) => g.id === galaxy.id);
      if (!def) continue;
      if (def.bonusType === 'ore' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.evolutionMultiplier, galaxy.explorationLevel);
        multiplier += bonus;
      }
    }
    return multiplier;
  }

  /**
   * 获取能量加成倍率
   */
  getEnergyMultiplier(): number {
    let multiplier = 1;
    for (const galaxy of this._galaxies) {
      if (!galaxy.unlocked) continue;
      const def = GALAXIES.find((g) => g.id === galaxy.id);
      if (!def) continue;
      if (def.bonusType === 'energy' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.evolutionMultiplier, galaxy.explorationLevel);
        multiplier += bonus;
      }
    }
    return multiplier;
  }

  /**
   * 获取数据加成倍率
   */
  getDataMultiplier(): number {
    let multiplier = 1;
    for (const galaxy of this._galaxies) {
      if (!galaxy.unlocked) continue;
      const def = GALAXIES.find((g) => g.id === galaxy.id);
      if (!def) continue;
      if (def.bonusType === 'data' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.evolutionMultiplier, galaxy.explorationLevel);
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
   * 获取预览声望星际信用点数
   */
  getPrestigePreview(): number {
    if (this._stats.totalOreEarned < MIN_PRESTIGE_ORE) return 0;
    return Math.floor(
      PRESTIGE_BASE_CREDITS * Math.sqrt(this._stats.totalOreEarned / MIN_PRESTIGE_ORE)
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
      if (building.productionResource === 'ore') {
        production *= this.getOreMultiplier() * this.getPrestigeMultiplier();
      } else if (building.productionResource === 'energy') {
        production *= this.getEnergyMultiplier() * this.getPrestigeMultiplier();
      } else if (building.productionResource === 'data') {
        production *= this.getDataMultiplier() * this.getPrestigeMultiplier();
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
    // 能量：采矿无人机等级 >= 3 时解锁
    const minerDrone = this.upgrades.get('miner_drone');
    if (minerDrone && minerDrone.level >= 3) {
      const energy = this.resources.get('energy');
      if (energy && !energy.unlocked) {
        energy.unlocked = true;
        this.emit('resourceUnlocked', 'energy');
      }
    }

    // 数据：太阳能板等级 >= 2 时解锁
    const solarPanel = this.upgrades.get('solar_panel');
    if (solarPanel && solarPanel.level >= 2) {
      const data = this.resources.get('data');
      if (data && !data.unlocked) {
        data.unlocked = true;
        this.emit('resourceUnlocked', 'data');
      }
    }
  }

  // ========== 渲染 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawNebulaParticles(ctx);
    this.drawEngineParticles(ctx);
    this.drawShip(ctx);
    this.drawFloatingTexts(ctx);
    this.drawResourcePanel(ctx, w);
    this.drawBuildingList(ctx, w, h);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 太空渐变
    const skyGradient = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    skyGradient.addColorStop(0, COLORS.nebulaTop);
    skyGradient.addColorStop(1, COLORS.nebulaBottom);
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, w, h * 0.5);

    // 深空渐变
    const groundGradient = ctx.createLinearGradient(0, h * 0.45, 0, h);
    groundGradient.addColorStop(0, COLORS.spaceLight);
    groundGradient.addColorStop(1, COLORS.spaceDark);
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, h * 0.45, w, h * 0.55);

    // 背景星星
    for (const star of this._stars) {
      const twinkle = 0.5 + 0.5 * Math.sin(this._shipAnimTimer * star.speed * 0.01 + star.x);
      ctx.globalAlpha = star.brightness * twinkle;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 远处的小行星
    ctx.fillStyle = '#1A237E';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.quadraticCurveTo(80, h * 0.38, 160, h * 0.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(200, h * 0.5);
    ctx.quadraticCurveTo(300, h * 0.35, 380, h * 0.5);
    ctx.fill();

    // 远处行星
    const planetX = w - 70;
    const planetY = 55;
    ctx.beginPath();
    ctx.arc(planetX, planetY, 25, 0, Math.PI * 2);
    const planetGrad = ctx.createRadialGradient(planetX - 5, planetY - 5, 5, planetX, planetY, 25);
    planetGrad.addColorStop(0, '#7C4DFF');
    planetGrad.addColorStop(1, '#311B92');
    ctx.fillStyle = planetGrad;
    ctx.fill();

    // 行星光环
    ctx.beginPath();
    ctx.ellipse(planetX, planetY, 35, 8, -0.3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(124, 77, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private drawNebulaParticles(ctx: CanvasRenderingContext2D): void {
    for (const np of this._nebulaParticles) {
      ctx.globalAlpha = np.alpha;
      ctx.fillStyle = np.color;
      ctx.beginPath();
      ctx.arc(np.x, np.y, np.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawEngineParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this._engineParticles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.engineFlame;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawShip(ctx: CanvasRenderingContext2D): void {
    const cx = SHIP_DRAW.centerX;
    const cy = SHIP_DRAW.centerY + this._shipFloat;
    const scale = this._clickScale;

    // 获取第一个已解锁的星系
    const unlockedGalaxy = this._galaxies.find((g) => g.unlocked);
    const galaxyDef = unlockedGalaxy
      ? GALAXIES.find((g) => g.id === unlockedGalaxy.id)!
      : GALAXIES[0];

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this._shipTilt);
    ctx.scale(scale, scale);

    // 飞船阴影
    ctx.beginPath();
    ctx.ellipse(4, SHIP_DRAW.bodyHeight * 0.6 + 4, SHIP_DRAW.bodyWidth * 0.6, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.shipShadow;
    ctx.fill();

    // 引擎火焰
    ctx.beginPath();
    ctx.moveTo(-SHIP_DRAW.engineRadius, SHIP_DRAW.bodyHeight * 0.4);
    ctx.quadraticCurveTo(0, SHIP_DRAW.bodyHeight * 0.4 + 20 + Math.sin(this._shipAnimTimer * 0.01) * 5, SHIP_DRAW.engineRadius, SHIP_DRAW.bodyHeight * 0.4);
    ctx.fillStyle = COLORS.engineFlame;
    ctx.fill();

    // 火焰光晕
    ctx.beginPath();
    ctx.ellipse(0, SHIP_DRAW.bodyHeight * 0.4 + 5, SHIP_DRAW.engineRadius + 4, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 109, 0, 0.3)';
    ctx.fill();

    // 机翼 - 左
    ctx.beginPath();
    ctx.moveTo(-SHIP_DRAW.bodyWidth * 0.4, SHIP_DRAW.bodyHeight * 0.1);
    ctx.lineTo(-SHIP_DRAW.bodyWidth * 0.4 - SHIP_DRAW.wingWidth, SHIP_DRAW.bodyHeight * 0.35);
    ctx.lineTo(-SHIP_DRAW.bodyWidth * 0.4 - SHIP_DRAW.wingWidth * 0.6, SHIP_DRAW.bodyHeight * 0.4);
    ctx.lineTo(-SHIP_DRAW.bodyWidth * 0.4, SHIP_DRAW.bodyHeight * 0.3);
    ctx.closePath();
    ctx.fillStyle = galaxyDef.color;
    ctx.fill();

    // 机翼 - 右
    ctx.beginPath();
    ctx.moveTo(SHIP_DRAW.bodyWidth * 0.4, SHIP_DRAW.bodyHeight * 0.1);
    ctx.lineTo(SHIP_DRAW.bodyWidth * 0.4 + SHIP_DRAW.wingWidth, SHIP_DRAW.bodyHeight * 0.35);
    ctx.lineTo(SHIP_DRAW.bodyWidth * 0.4 + SHIP_DRAW.wingWidth * 0.6, SHIP_DRAW.bodyHeight * 0.4);
    ctx.lineTo(SHIP_DRAW.bodyWidth * 0.4, SHIP_DRAW.bodyHeight * 0.3);
    ctx.closePath();
    ctx.fillStyle = galaxyDef.color;
    ctx.fill();

    // 机身
    ctx.beginPath();
    ctx.moveTo(0, -SHIP_DRAW.bodyHeight * 0.5);
    ctx.bezierCurveTo(
      SHIP_DRAW.bodyWidth * 0.3, -SHIP_DRAW.bodyHeight * 0.3,
      SHIP_DRAW.bodyWidth * 0.4, SHIP_DRAW.bodyHeight * 0.1,
      SHIP_DRAW.bodyWidth * 0.3, SHIP_DRAW.bodyHeight * 0.4
    );
    ctx.lineTo(-SHIP_DRAW.bodyWidth * 0.3, SHIP_DRAW.bodyHeight * 0.4);
    ctx.bezierCurveTo(
      -SHIP_DRAW.bodyWidth * 0.4, SHIP_DRAW.bodyHeight * 0.1,
      -SHIP_DRAW.bodyWidth * 0.3, -SHIP_DRAW.bodyHeight * 0.3,
      0, -SHIP_DRAW.bodyHeight * 0.5
    );
    ctx.fillStyle = galaxyDef.color;
    ctx.fill();

    // 驾驶舱
    ctx.beginPath();
    ctx.ellipse(0, -SHIP_DRAW.bodyHeight * 0.15, SHIP_DRAW.cockpitRadius, SHIP_DRAW.cockpitRadius * 1.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = galaxyDef.coreColor;
    ctx.fill();

    // 驾驶舱高光
    ctx.beginPath();
    ctx.ellipse(-2, -SHIP_DRAW.bodyHeight * 0.2, 3, 4, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fill();

    // 探索等级指示（小星星）
    if (unlockedGalaxy) {
      const evoLevel = unlockedGalaxy.explorationLevel;
      for (let i = 0; i < evoLevel; i++) {
        ctx.fillStyle = COLORS.accent;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★', -12 + i * 10, -SHIP_DRAW.bodyHeight * 0.55 - 8);
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
      const icon = res.id === 'ore' ? '⛏️' : res.id === 'energy' ? '⚡' : '📊';

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
    ctx.fillText('— 太空设施 —', w / 2, panel.startY - 8);

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
            const icon = id === 'ore' ? '⛏️' : id === 'energy' ? '⚡' : '📊';
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
    ctx.fillText('空格 采矿 · ↑↓ 选择 · Enter 购买 · U 升级飞船 · P 声望', w / 2, h - 10);
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
        // 升级当前飞船（第一个已解锁的星系）
        {
          const unlocked = this._galaxies.find((g) => g.unlocked);
          if (unlocked) this.upgradeShip(unlocked.id);
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

  getState(): SpaceDriftState {
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
      galaxies: this.galaxies,
      prestige: { ...this.prestige },
      statistics: { ...this._stats },
      selectedIndex: this._selectedIndex,
    };
  }

  /**
   * 从状态恢复
   */
  loadState(state: SpaceDriftState): void {
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

    // 恢复星系
    if (state.galaxies) {
      for (const galaxyState of state.galaxies) {
        const myGalaxy = this._galaxies.find((g) => g.id === galaxyState.id);
        if (myGalaxy) {
          myGalaxy.unlocked = galaxyState.unlocked;
          if (galaxyState.explorationLevel !== undefined) {
            myGalaxy.explorationLevel = galaxyState.explorationLevel;
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
      this._stats = { ...state.statistics } as SpaceDriftStatistics;
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
    // 附加星系和统计信息到 settings
    data.settings = {
      galaxies: this._galaxies,
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
      if (settings.galaxies) {
        for (const galaxyState of settings.galaxies) {
          const myGalaxy = this._galaxies.find((g) => g.id === galaxyState.id);
          if (myGalaxy) {
            myGalaxy.unlocked = galaxyState.unlocked;
            if (galaxyState.explorationLevel !== undefined) {
              myGalaxy.explorationLevel = galaxyState.explorationLevel;
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
