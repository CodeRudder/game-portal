/**
 * 帝国时代 (Age of Empires) — 放置类游戏引擎
 *
 * 继承 IdleGameEngine，实现：
 * - 多资源系统（食物/木材/石头）
 * - 建筑升级系统（8种建筑）
 * - 时代演进系统（黑暗→封建→城堡→帝王）
 * - 文明升级系统
 * - 声望重置系统（帝国荣耀）
 * - Canvas 中世纪风格渲染
 * - 离线收益
 * - 自动存档
 */
import { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { Resource, Upgrade, SaveData } from '@/types/idle';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  FOOD_PER_CLICK,
  GLORY_BONUS_MULTIPLIER,
  PRESTIGE_BASE_GLORY,
  MIN_PRESTIGE_FOOD,
  BUILDINGS,
  AGES,
  CIVILIZATION_UPGRADES,
  COLORS,
  CASTLE_DRAW,
  BUILDING_PANEL,
  RESOURCE_PANEL,
  type BuildingDef,
  type AgeDef,
  type CivilizationUpgradeDef,
} from './constants';

/** 文明升级状态 */
export interface CivilizationUpgradeState {
  id: string;
  purchased: boolean;
}

/** 游戏统计 */
export interface AgeOfEmpiresStatistics {
  totalFoodEarned: number;
  totalWoodEarned: number;
  totalStoneEarned: number;
  totalClicks: number;
  totalPrestigeCount: number;
  totalAgeAdvances: number;
  totalCivUpgrades: number;
  totalBuildingsPurchased: number;
}

/** 帝国时代游戏状态 */
export interface AgeOfEmpiresState {
  [key: string]: unknown;
  resources: Record<string, { amount: number; perSecond: number; unlocked: boolean }>;
  buildings: Record<string, number>;
  currentAge: string;
  civilizationUpgrades: CivilizationUpgradeState[];
  prestige: { currency: number; count: number };
  statistics: AgeOfEmpiresStatistics;
  selectedIndex: number;
}

export class AgeOfEmpiresEngine extends IdleGameEngine {
  // ========== 游戏状态 ==========

  protected _gameId = 'age-of-empires';

  constructor() {
    super();
    Object.defineProperty(this, 'statistics', {
      get: () => ({ ...this._stats }) as AgeOfEmpiresStatistics,
      set: (_val: Record<string, number>) => { /* base class writes are no-ops */ },
      configurable: true,
      enumerable: true,
    });
  }

  /** 当前时代 ID */
  private _currentAge: string = 'dark_age';

  /** 文明升级状态 */
  private _civUpgrades: CivilizationUpgradeState[] = CIVILIZATION_UPGRADES.map((u) => ({
    id: u.id,
    purchased: false,
  }));

  /** 当前选中的建筑索引 */
  private _selectedIndex: number = 0;

  /** 统计数据 */
  private _stats: AgeOfEmpiresStatistics = {
    totalFoodEarned: 0,
    totalWoodEarned: 0,
    totalStoneEarned: 0,
    totalClicks: 0,
    totalPrestigeCount: 0,
    totalAgeAdvances: 0,
    totalCivUpgrades: 0,
    totalBuildingsPurchased: 0,
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
  /** 旗帜飘动 */
  private _flagWave: number = 0;
  /** 火把闪烁 */
  private _torchFlicker: number = 0;
  /** 点击缩放效果 */
  private _clickScale: number = 1;
  private _clickAnimTimer: number = 0;
  /** 烟雾粒子 */
  private _smokeParticles: Array<{
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

  get currentAge(): string {
    return this._currentAge;
  }

  get civilizationUpgrades(): CivilizationUpgradeState[] {
    return this._civUpgrades.map((u) => ({ ...u }));
  }

  get totalFoodEarned(): number {
    return this._stats.totalFoodEarned;
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
        id: 'food',
        name: '食物',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e15,
        unlocked: true,
      },
      {
        id: 'wood',
        name: '木材',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e12,
        unlocked: false,
      },
      {
        id: 'stone',
        name: '石头',
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
          type: 'add_production' as const,
          target: b.productionResource,
          value: b.baseProduction,
        },
        unlocked: b.id === 'farm',
        requires: b.requires,
        icon: b.icon,
      }))
    );

    // 重置状态
    this._currentAge = 'dark_age';
    this._civUpgrades = CIVILIZATION_UPGRADES.map((u) => ({
      id: u.id,
      purchased: false,
    }));
    this._selectedIndex = 0;
    this._stats = {
      totalFoodEarned: 0,
      totalWoodEarned: 0,
      totalStoneEarned: 0,
      totalClicks: 0,
      totalPrestigeCount: 0,
      totalAgeAdvances: 0,
      totalCivUpgrades: 0,
      totalBuildingsPurchased: 0,
    };
    this._floatingTexts = [];
    this._castleAnimTimer = 0;
    this._flagWave = 0;
    this._torchFlicker = 0;
    this._clickScale = 1;
    this._clickAnimTimer = 0;
    this._smokeParticles = [];
  }

  protected onUpdate(deltaTime: number): void {
    // 城堡动画
    this._castleAnimTimer += deltaTime;
    this._flagWave = Math.sin(this._castleAnimTimer * 0.005) * 0.3;
    this._torchFlicker = Math.sin(this._castleAnimTimer * 0.01) * 0.5 + 0.5;

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

    // 烟雾粒子更新
    this._smokeParticles = this._smokeParticles.filter((p) => {
      p.life -= deltaTime;
      p.x += p.vx * (deltaTime / 1000);
      p.y += p.vy * (deltaTime / 1000);
      p.vy -= 5 * (deltaTime / 1000);
      return p.life > 0;
    });

    // 随机产生烟雾粒子（城堡烟囱）
    if (Math.random() < 0.03) {
      this._smokeParticles.push({
        x: CASTLE_DRAW.centerX + 10 + Math.random() * 10,
        y: CASTLE_DRAW.centerY - CASTLE_DRAW.towerHeight - 10,
        vx: (Math.random() - 0.5) * 10,
        vy: -8 - Math.random() * 10,
        life: 2000 + Math.random() * 1500,
        maxLife: 3500,
      });
    }

    // 统计资源产出
    const food = this.getResource('food');
    if (food && food.perSecond > 0) {
      this._stats.totalFoodEarned += food.perSecond * (deltaTime / 1000);
    }
    const wood = this.getResource('wood');
    if (wood && wood.perSecond > 0) {
      this._stats.totalWoodEarned += wood.perSecond * (deltaTime / 1000);
    }
    const stone = this.getResource('stone');
    if (stone && stone.perSecond > 0) {
      this._stats.totalStoneEarned += stone.perSecond * (deltaTime / 1000);
    }

    // 检查建筑解锁条件
    this.checkBuildingUnlocks();
    // 检查资源解锁条件
    this.checkResourceUnlocks();
  }

  // ========== 核心玩法 ==========

  /**
   * 点击获得食物
   */
  click(): number {
    if (this._status !== 'playing') return 0;

    let gained = FOOD_PER_CLICK;

    // 时代点击加成
    gained *= this.getAgeClickBonus();

    // 文明升级点击加成
    gained *= this.getCivClickMultiplier();

    // 声望加成
    gained *= this.getPrestigeMultiplier();

    gained = Math.floor(gained * 100) / 100;

    this.addResource('food', gained);
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
    this._stats.totalBuildingsPurchased++;
    this.recalculateProduction();
    this.emit('upgradePurchased', upgradeId, upgrade.level);
    this.emit('stateChange');
    return true;
  }

  // ========== 时代演进 ==========

  /**
   * 获取当前时代定义
   */
  getCurrentAgeDef(): AgeDef {
    return AGES.find((a) => a.id === this._currentAge) || AGES[0];
  }

  /**
   * 获取当前时代索引
   */
  getCurrentAgeIndex(): number {
    return AGES.findIndex((a) => a.id === this._currentAge);
  }

  /**
   * 获取下一个时代
   */
  getNextAge(): AgeDef | null {
    const idx = this.getCurrentAgeIndex();
    if (idx < 0 || idx >= AGES.length - 1) return null;
    return AGES[idx + 1];
  }

  /**
   * 检查是否可以演进到下一个时代
   */
  canAdvanceAge(): boolean {
    const nextAge = this.getNextAge();
    if (!nextAge) return false;
    return this.canAfford({
      food: nextAge.foodCost,
      wood: nextAge.woodCost,
      stone: nextAge.stoneCost,
    });
  }

  /**
   * 演进到下一个时代
   */
  advanceAge(): boolean {
    if (this._status !== 'playing') return false;

    const nextAge = this.getNextAge();
    if (!nextAge) return false;

    const cost: Record<string, number> = {};
    if (nextAge.foodCost > 0) cost.food = nextAge.foodCost;
    if (nextAge.woodCost > 0) cost.wood = nextAge.woodCost;
    if (nextAge.stoneCost > 0) cost.stone = nextAge.stoneCost;

    if (!this.canAfford(cost)) return false;

    // 扣除资源
    for (const [resId, amount] of Object.entries(cost)) {
      this.spendResource(resId, amount);
    }

    this._currentAge = nextAge.id;
    this._stats.totalAgeAdvances++;

    // 重新计算产出（时代加成变化）
    this.recalculateProduction();

    this.emit('ageAdvanced', nextAge.id);
    this.emit('stateChange');
    return true;
  }

  /**
   * 获取时代产出加成
   */
  getAgeProductionBonus(): number {
    const ageDef = this.getCurrentAgeDef();
    return ageDef.productionBonus;
  }

  /**
   * 获取时代点击加成
   */
  getAgeClickBonus(): number {
    const ageDef = this.getCurrentAgeDef();
    return ageDef.clickBonus;
  }

  // ========== 文明升级 ==========

  /**
   * 购买文明升级
   */
  purchaseCivUpgrade(upgradeId: string): boolean {
    if (this._status !== 'playing') return false;

    const upgradeDef = CIVILIZATION_UPGRADES.find((u) => u.id === upgradeId);
    if (!upgradeDef) return false;

    const upgradeState = this._civUpgrades.find((u) => u.id === upgradeId);
    if (!upgradeState || upgradeState.purchased) return false;

    // 检查时代要求
    const ageIdx = AGES.findIndex((a) => a.id === this._currentAge);
    const reqAgeIdx = AGES.findIndex((a) => a.id === upgradeDef.requiredAge);
    if (ageIdx < reqAgeIdx) return false;

    // 检查费用
    if (!this.canAfford(upgradeDef.cost)) return false;

    // 扣除资源
    for (const [resId, amount] of Object.entries(upgradeDef.cost)) {
      this.spendResource(resId, amount);
    }

    upgradeState.purchased = true;
    this._stats.totalCivUpgrades++;

    // 重新计算产出
    this.recalculateProduction();

    this.emit('civUpgradePurchased', upgradeId);
    this.emit('stateChange');
    return true;
  }

  /**
   * 获取文明升级是否已购买
   */
  isCivUpgradePurchased(upgradeId: string): boolean {
    const state = this._civUpgrades.find((u) => u.id === upgradeId);
    return state ? state.purchased : false;
  }

  /**
   * 获取可用的文明升级列表
   */
  getAvailableCivUpgrades(): CivilizationUpgradeDef[] {
    const ageIdx = AGES.findIndex((a) => a.id === this._currentAge);
    return CIVILIZATION_UPGRADES.filter((u) => {
      const reqAgeIdx = AGES.findIndex((a) => a.id === u.requiredAge);
      if (ageIdx < reqAgeIdx) return false;
      const state = this._civUpgrades.find((s) => s.id === u.id);
      return state && !state.purchased;
    });
  }

  // ========== 声望系统 ==========

  /**
   * 声望重置
   */
  doPrestige(): number {
    const food = this.getResource('food');
    if (!food || this._stats.totalFoodEarned < MIN_PRESTIGE_FOOD) return 0;

    // 计算获得的帝国荣耀
    const gloryGained = Math.floor(
      PRESTIGE_BASE_GLORY * Math.sqrt(this._stats.totalFoodEarned / MIN_PRESTIGE_FOOD)
    );

    if (gloryGained <= 0) return 0;

    // 保存帝国荣耀
    const savedPrestige = { ...this.prestige };
    this.prestige.currency += gloryGained;
    this.prestige.count++;
    this._stats.totalPrestigeCount++;

    // 保存部分统计
    const savedStats = {
      ...this._stats,
      totalFoodEarned: 0,
      totalWoodEarned: 0,
      totalStoneEarned: 0,
      totalClicks: 0,
    };

    // 保存文明升级状态（声望保留）
    const savedCivUpgrades = this._civUpgrades.map((u) => ({
      id: u.id,
      purchased: u.purchased,
    }));

    // 重置
    this.onInit();

    // 恢复声望和部分统计
    this.prestige = savedPrestige;
    this._stats = savedStats as AgeOfEmpiresStatistics;

    // 恢复文明升级
    for (const saved of savedCivUpgrades) {
      const civ = this._civUpgrades.find((u) => u.id === saved.id);
      if (civ) {
        civ.purchased = saved.purchased;
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
   * 获取文明升级点击加成
   */
  getCivClickMultiplier(): number {
    let multiplier = 1;
    for (const civState of this._civUpgrades) {
      if (!civState.purchased) continue;
      const def = CIVILIZATION_UPGRADES.find((u) => u.id === civState.id);
      if (!def) continue;
      if (def.effectType === 'click' || def.effectType === 'all') {
        multiplier += def.effectValue;
      }
    }
    return multiplier;
  }

  /**
   * 获取食物加成倍率
   */
  getFoodMultiplier(): number {
    let multiplier = 1;
    for (const civState of this._civUpgrades) {
      if (!civState.purchased) continue;
      const def = CIVILIZATION_UPGRADES.find((u) => u.id === civState.id);
      if (!def) continue;
      if (def.effectType === 'food' || def.effectType === 'all') {
        multiplier += def.effectValue;
      }
    }
    return multiplier;
  }

  /**
   * 获取木材加成倍率
   */
  getWoodMultiplier(): number {
    let multiplier = 1;
    for (const civState of this._civUpgrades) {
      if (!civState.purchased) continue;
      const def = CIVILIZATION_UPGRADES.find((u) => u.id === civState.id);
      if (!def) continue;
      if (def.effectType === 'wood' || def.effectType === 'all') {
        multiplier += def.effectValue;
      }
    }
    return multiplier;
  }

  /**
   * 获取石头加成倍率
   */
  getStoneMultiplier(): number {
    let multiplier = 1;
    for (const civState of this._civUpgrades) {
      if (!civState.purchased) continue;
      const def = CIVILIZATION_UPGRADES.find((u) => u.id === civState.id);
      if (!def) continue;
      if (def.effectType === 'stone' || def.effectType === 'all') {
        multiplier += def.effectValue;
      }
    }
    return multiplier;
  }

  /**
   * 获取全产出加成倍率
   */
  getProductionMultiplier(): number {
    let multiplier = 1;
    for (const civState of this._civUpgrades) {
      if (!civState.purchased) continue;
      const def = CIVILIZATION_UPGRADES.find((u) => u.id === civState.id);
      if (!def) continue;
      if (def.effectType === 'production' || def.effectType === 'all') {
        multiplier += def.effectValue;
      }
    }
    // 声望加成
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
   * 获取预览声望帝国荣耀数
   */
  getPrestigePreview(): number {
    if (this._stats.totalFoodEarned < MIN_PRESTIGE_FOOD) return 0;
    return Math.floor(
      PRESTIGE_BASE_GLORY * Math.sqrt(this._stats.totalFoodEarned / MIN_PRESTIGE_FOOD)
    );
  }

  /**
   * 检查是否可以声望
   */
  canPrestige(): boolean {
    return this._stats.totalFoodEarned >= MIN_PRESTIGE_FOOD;
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
      production *= this.getAgeProductionBonus();

      // 应用对应资源加成
      if (building.productionResource === 'food') {
        production *= this.getFoodMultiplier() * this.getProductionMultiplier();
      } else if (building.productionResource === 'wood') {
        production *= this.getWoodMultiplier() * this.getProductionMultiplier();
      } else if (building.productionResource === 'stone') {
        production *= this.getStoneMultiplier() * this.getProductionMultiplier();
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
    // 木材：伐木场等级 >= 1 时解锁
    const lumberCamp = this.upgrades.get('lumber_camp');
    if (lumberCamp && lumberCamp.level >= 1) {
      const wood = this.resources.get('wood');
      if (wood && !wood.unlocked) {
        wood.unlocked = true;
        this.emit('resourceUnlocked', 'wood');
      }
    }

    // 石头：采石场等级 >= 1 时解锁
    const stoneQuarry = this.upgrades.get('stone_quarry');
    if (stoneQuarry && stoneQuarry.level >= 1) {
      const stone = this.resources.get('stone');
      if (stone && !stone.unlocked) {
        stone.unlocked = true;
        this.emit('resourceUnlocked', 'stone');
      }
    }
  }

  // ========== 渲染 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawSmokeParticles(ctx);
    this.drawCastle(ctx);
    this.drawFloatingTexts(ctx);
    this.drawResourcePanel(ctx, w);
    this.drawBuildingList(ctx, w, h);
    this.drawAgeIndicator(ctx, w);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 天空渐变（中世纪夜空）
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

    // 地面纹理
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < 30; i++) {
      const x = ((i * 73 + 17) % w);
      const y = h * 0.45 + ((i * 47 + 23) % (h * 0.55));
      ctx.fillStyle = '#3E2723';
      ctx.fillRect(x, y, 3, 2);
    }
    ctx.globalAlpha = 1;

    // 远处的小山
    ctx.fillStyle = '#3E2F1E';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.quadraticCurveTo(80, h * 0.38, 160, h * 0.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(200, h * 0.5);
    ctx.quadraticCurveTo(300, h * 0.35, 380, h * 0.5);
    ctx.fill();

    // 树木
    this.drawTree(ctx, 50, h * 0.47, 0.8);
    this.drawTree(ctx, 120, h * 0.49, 0.6);
    this.drawTree(ctx, w - 60, h * 0.48, 0.7);
    this.drawTree(ctx, w - 130, h * 0.5, 0.5);

    // 月亮
    ctx.beginPath();
    ctx.arc(60, 50, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF8E1';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(60, 50, 24, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 248, 225, 0.15)';
    ctx.fill();

    // 星星
    ctx.fillStyle = '#FFF8E1';
    for (let i = 0; i < 15; i++) {
      const sx = (i * 97 + 31) % w;
      const sy = (i * 43 + 17) % (h * 0.35);
      const size = 1 + (i % 3);
      ctx.globalAlpha = 0.3 + (i % 5) * 0.15;
      ctx.fillRect(sx, sy, size, size);
    }
    ctx.globalAlpha = 1;
  }

  private drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // 树干
    ctx.fillStyle = COLORS.treeTrunk;
    ctx.fillRect(-3, -20, 6, 20);

    // 树冠
    ctx.fillStyle = COLORS.treeGreen;
    ctx.beginPath();
    ctx.moveTo(0, -45);
    ctx.lineTo(-15, -20);
    ctx.lineTo(15, -20);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -55);
    ctx.lineTo(-12, -35);
    ctx.lineTo(12, -35);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  private drawCastle(ctx: CanvasRenderingContext2D): void {
    const cx = CASTLE_DRAW.centerX;
    const cy = CASTLE_DRAW.centerY;
    const scale = this._clickScale;
    const ageDef = this.getCurrentAgeDef();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // 地基阴影
    ctx.beginPath();
    ctx.ellipse(4, CASTLE_DRAW.castleHeight * 0.6 + 4, CASTLE_DRAW.castleWidth * 0.7, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();

    // 城墙
    ctx.fillStyle = COLORS.castleStone;
    ctx.fillRect(
      -CASTLE_DRAW.castleWidth / 2,
      -CASTLE_DRAW.castleHeight / 2,
      CASTLE_DRAW.castleWidth,
      CASTLE_DRAW.castleHeight
    );

    // 城墙纹理
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.5;
    for (let row = 0; row < 4; row++) {
      const ry = -CASTLE_DRAW.castleHeight / 2 + row * (CASTLE_DRAW.castleHeight / 4);
      ctx.beginPath();
      ctx.moveTo(-CASTLE_DRAW.castleWidth / 2, ry);
      ctx.lineTo(CASTLE_DRAW.castleWidth / 2, ry);
      ctx.stroke();
      for (let col = 0; col < 5; col++) {
        const bx = -CASTLE_DRAW.castleWidth / 2 + col * (CASTLE_DRAW.castleWidth / 5);
        ctx.beginPath();
        ctx.moveTo(bx, ry);
        ctx.lineTo(bx, ry + CASTLE_DRAW.castleHeight / 4);
        ctx.stroke();
      }
    }

    // 城垛
    const merlonWidth = 8;
    const merlonHeight = 6;
    for (let i = 0; i < 6; i++) {
      const mx = -CASTLE_DRAW.castleWidth / 2 + i * (CASTLE_DRAW.castleWidth / 5);
      ctx.fillStyle = COLORS.castleStone;
      ctx.fillRect(mx, -CASTLE_DRAW.castleHeight / 2 - merlonHeight, merlonWidth, merlonHeight);
    }

    // 左塔
    ctx.fillStyle = COLORS.castleColor;
    ctx.fillRect(
      -CASTLE_DRAW.castleWidth / 2 - 5,
      -CASTLE_DRAW.towerHeight / 2,
      CASTLE_DRAW.towerWidth,
      CASTLE_DRAW.towerHeight
    );
    // 左塔尖顶
    ctx.fillStyle = COLORS.castleRoof;
    ctx.beginPath();
    ctx.moveTo(-CASTLE_DRAW.castleWidth / 2 - 5, -CASTLE_DRAW.towerHeight / 2);
    ctx.lineTo(-CASTLE_DRAW.castleWidth / 2 + CASTLE_DRAW.towerWidth / 2 - 5, -CASTLE_DRAW.towerHeight / 2 - 20);
    ctx.lineTo(-CASTLE_DRAW.castleWidth / 2 + CASTLE_DRAW.towerWidth - 5, -CASTLE_DRAW.towerHeight / 2);
    ctx.closePath();
    ctx.fill();

    // 右塔
    ctx.fillStyle = COLORS.castleColor;
    ctx.fillRect(
      CASTLE_DRAW.castleWidth / 2 - CASTLE_DRAW.towerWidth + 5,
      -CASTLE_DRAW.towerHeight / 2,
      CASTLE_DRAW.towerWidth,
      CASTLE_DRAW.towerHeight
    );
    // 右塔尖顶
    ctx.fillStyle = COLORS.castleRoof;
    ctx.beginPath();
    ctx.moveTo(CASTLE_DRAW.castleWidth / 2 - CASTLE_DRAW.towerWidth + 5, -CASTLE_DRAW.towerHeight / 2);
    ctx.lineTo(CASTLE_DRAW.castleWidth / 2 - CASTLE_DRAW.towerWidth / 2 + 5, -CASTLE_DRAW.towerHeight / 2 - 20);
    ctx.lineTo(CASTLE_DRAW.castleWidth / 2 + 5, -CASTLE_DRAW.towerHeight / 2);
    ctx.closePath();
    ctx.fill();

    // 窗户
    const windowY = -CASTLE_DRAW.castleHeight / 4;
    ctx.fillStyle = COLORS.castleWindow;
    ctx.fillRect(-15, windowY, 8, 12);
    ctx.fillRect(7, windowY, 8, 12);

    // 塔楼窗户
    ctx.fillStyle = COLORS.castleWindow;
    ctx.beginPath();
    ctx.arc(-CASTLE_DRAW.castleWidth / 2 + CASTLE_DRAW.towerWidth / 2 - 5, -CASTLE_DRAW.towerHeight / 4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(CASTLE_DRAW.castleWidth / 2 - CASTLE_DRAW.towerWidth / 2 + 5, -CASTLE_DRAW.towerHeight / 4, 4, 0, Math.PI * 2);
    ctx.fill();

    // 大门
    ctx.fillStyle = '#4E342E';
    ctx.beginPath();
    ctx.moveTo(-10, CASTLE_DRAW.castleHeight / 2);
    ctx.lineTo(-10, CASTLE_DRAW.castleHeight / 2 - 20);
    ctx.quadraticCurveTo(0, CASTLE_DRAW.castleHeight / 2 - 28, 10, CASTLE_DRAW.castleHeight / 2 - 20);
    ctx.lineTo(10, CASTLE_DRAW.castleHeight / 2);
    ctx.closePath();
    ctx.fill();

    // 旗帜（右塔）
    ctx.save();
    ctx.translate(CASTLE_DRAW.castleWidth / 2 - CASTLE_DRAW.towerWidth / 2 + 5, -CASTLE_DRAW.towerHeight / 2 - 20);
    // 旗杆
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(-1, 0, 2, -CASTLE_DRAW.flagHeight);
    // 旗面（飘动）
    ctx.fillStyle = COLORS.castleFlag;
    ctx.beginPath();
    ctx.moveTo(1, -CASTLE_DRAW.flagHeight);
    ctx.quadraticCurveTo(10 + this._flagWave * 5, -CASTLE_DRAW.flagHeight + 5, 18 + this._flagWave * 8, -CASTLE_DRAW.flagHeight + 2);
    ctx.lineTo(18 + this._flagWave * 8, -CASTLE_DRAW.flagHeight + 14);
    ctx.quadraticCurveTo(10 + this._flagWave * 5, -CASTLE_DRAW.flagHeight + 12, 1, -CASTLE_DRAW.flagHeight + 14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 火把（大门两侧）
    const torchY = CASTLE_DRAW.castleHeight / 2 - 15;
    this.drawTorch(ctx, -18, torchY);
    this.drawTorch(ctx, 18, torchY);

    // 时代指示图标
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(ageDef.icon, 0, -CASTLE_DRAW.towerHeight / 2 - 30);

    ctx.restore();
  }

  private drawTorch(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    // 火把柄
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(x - 1.5, y, 3, 12);

    // 火焰
    const flicker = this._torchFlicker;
    ctx.fillStyle = COLORS.torchColor;
    ctx.beginPath();
    ctx.moveTo(x - 3, y);
    ctx.quadraticCurveTo(x - 2, y - 6 - flicker * 2, x, y - 8 - flicker * 3);
    ctx.quadraticCurveTo(x + 2, y - 6 - flicker * 2, x + 3, y);
    ctx.closePath();
    ctx.fill();

    // 火焰光晕
    ctx.fillStyle = COLORS.torchGlow;
    ctx.beginPath();
    ctx.arc(x, y - 4, 8 + flicker * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawSmokeParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this._smokeParticles) {
      const alpha = (p.life / p.maxLife) * 0.3;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#90A4AE';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3 + (1 - p.life / p.maxLife) * 4, 0, Math.PI * 2);
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
      const icon = res.id === 'food' ? '🍖' : res.id === 'wood' ? '🪵' : '🪨';

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
            const icon = id === 'food' ? '🍖' : id === 'wood' ? '🪵' : '🪨';
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
    ctx.fillText('空格 点击 · ↑↓ 选择 · Enter 购买 · A 演进 · P 声望', w / 2, h - 10);
  }

  private drawAgeIndicator(ctx: CanvasRenderingContext2D, w: number): void {
    const ageDef = this.getCurrentAgeDef();
    const ageIdx = this.getCurrentAgeIndex();

    // 时代指示器背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    this.roundRect(ctx, w - 110, 0, 110, 28, 0);
    ctx.fill();

    // 时代图标和名称
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.accent;
    ctx.fillText(`${ageDef.icon} ${ageDef.name}`, w - 8, 18);

    // 时代进度点
    for (let i = 0; i < AGES.length; i++) {
      const dotX = w - 105 + i * 12;
      ctx.beginPath();
      ctx.arc(dotX, 24, 3, 0, Math.PI * 2);
      ctx.fillStyle = i <= ageIdx ? COLORS.accent : 'rgba(255,255,255,0.2)';
      ctx.fill();
    }
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
      case 'a':
      case 'A':
        this.advanceAge();
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

  getState(): AgeOfEmpiresState {
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
      currentAge: this._currentAge,
      civilizationUpgrades: this.civilizationUpgrades,
      prestige: { ...this.prestige },
      statistics: { ...this._stats },
      selectedIndex: this._selectedIndex,
    };
  }

  /**
   * 从状态恢复
   */
  loadState(state: AgeOfEmpiresState): void {
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

    // 恢复时代
    if (state.currentAge) {
      this._currentAge = state.currentAge;
    }

    // 恢复文明升级
    if (state.civilizationUpgrades) {
      for (const civState of state.civilizationUpgrades) {
        const myCiv = this._civUpgrades.find((u) => u.id === civState.id);
        if (myCiv) {
          myCiv.purchased = civState.purchased;
        }
      }
    }

    // 恢复声望
    if (state.prestige) {
      this.prestige = { ...state.prestige };
    }

    // 恢复统计
    if (state.statistics) {
      this._stats = { ...state.statistics } as AgeOfEmpiresStatistics;
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
    data.settings = {
      currentAge: this._currentAge,
      civUpgrades: this._civUpgrades,
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
      if (settings.currentAge) {
        this._currentAge = settings.currentAge;
      }
      if (settings.civUpgrades) {
        for (const civState of settings.civUpgrades) {
          const myCiv = this._civUpgrades.find((u) => u.id === civState.id);
          if (myCiv) {
            myCiv.purchased = civState.purchased;
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
