/**
 * 希腊众神 (Greek Gods) — 放置类游戏引擎
 *
 * 继承 IdleGameEngine，实现：
 * - 多资源系统（金币/信仰/荣耀）
 * - 建筑升级系统（8种古希腊建筑）
 * - 众神恩赐解锁系统
 * - 声望重置系统（众神庇护）
 * - Canvas 古希腊风格渲染
 * - 离线收益
 * - 自动存档
 */
import { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { Resource, Upgrade, SaveData } from '@/types/idle';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GOLD_PER_CLICK,
  BLESSING_BONUS_MULTIPLIER,
  PRESTIGE_BASE_BLESSING,
  MIN_PRESTIGE_GOLD,
  GODS,
  BUILDINGS,
  COLORS,
  TEMPLE_DRAW,
  BUILDING_PANEL,
  RESOURCE_PANEL,
  type GodDef,
  type BuildingDef,
} from './constants';

/** 众神恩赐状态 */
export interface GodBlessingState {
  id: string;
  unlocked: boolean;
  /** 恩赐等级 0-5 */
  blessingLevel: number;
}

/** 游戏统计 */
export interface GreekGodsStatistics {
  totalGoldEarned: number;
  totalClicks: number;
  totalFaithEarned: number;
  totalGloryEarned: number;
  totalPrestigeCount: number;
  totalGodsUnlocked: number;
  totalBlessings: number;
}

/** 希腊众神游戏状态 */
export interface GreekGodsState {
  [key: string]: unknown;
  resources: Record<string, { amount: number; perSecond: number; unlocked: boolean }>;
  buildings: Record<string, number>;
  gods: GodBlessingState[];
  prestige: { currency: number; count: number };
  statistics: GreekGodsStatistics;
  selectedIndex: number;
}

/** 恩赐费用表（按恩赐等级） */
const BLESSING_COSTS: Record<number, Record<string, number>> = {
  1: { faith: 10, glory: 5 },
  2: { faith: 50, glory: 20, gold: 500 },
  3: { faith: 200, glory: 80, gold: 2000 },
  4: { faith: 800, glory: 300, gold: 8000 },
  5: { faith: 3000, glory: 1000, gold: 30000 },
};

/** 最大恩赐等级 */
const MAX_BLESSING_LEVEL = 5;

export class GreekGodsEngine extends IdleGameEngine {
  // ========== 游戏状态 ==========

  protected _gameId = 'greek-gods';

  constructor() {
    super();
    // Override base class `statistics` instance field with a getter/setter,
    // because class fields shadow prototype accessors.
    Object.defineProperty(this, 'statistics', {
      get: () => ({ ...this._stats }) as GreekGodsStatistics,
      set: (_val: Record<string, number>) => { /* base class writes are no-ops */ },
      configurable: true,
      enumerable: true,
    });
  }

  /** 众神恩赐状态 */
  private _gods: GodBlessingState[] = GODS.map((g) => ({
    id: g.id,
    unlocked: g.id === 'zeus', // 宙斯初始解锁
    blessingLevel: 0,
  }));

  /** 当前选中的建筑索引 */
  private _selectedIndex: number = 0;

  /** 统计数据 */
  private _stats: GreekGodsStatistics = {
    totalGoldEarned: 0,
    totalClicks: 0,
    totalFaithEarned: 0,
    totalGloryEarned: 0,
    totalPrestigeCount: 0,
    totalGodsUnlocked: 1,
    totalBlessings: 0,
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

  /** 神殿动画计时器 */
  private _templeAnimTimer: number = 0;
  /** 闪电效果计时器 */
  private _lightningTimer: number = 0;
  /** 光环脉动 */
  private _auraPulse: number = 0;
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
    size: number;
  }> = [];

  // ========== 公开属性 ==========

  get selectedIndex(): number {
    return this._selectedIndex;
  }

  get gods(): GodBlessingState[] {
    return this._gods.map((g) => ({ ...g }));
  }

  get totalGoldEarned(): number {
    return this._stats.totalGoldEarned;
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
        id: 'gold',
        name: '金币',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e15,
        unlocked: true,
      },
      {
        id: 'faith',
        name: '信仰',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e12,
        unlocked: false,
      },
      {
        id: 'glory',
        name: '荣耀',
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
        unlocked: b.id === 'temple_of_zeus', // 宙斯神殿初始解锁
        requires: b.requires,
        icon: b.icon,
      }))
    );

    // 重置状态
    this._gods = GODS.map((g) => ({
      id: g.id,
      unlocked: g.id === 'zeus',
      blessingLevel: 0,
    }));
    this._selectedIndex = 0;
    this._stats = {
      totalGoldEarned: 0,
      totalClicks: 0,
      totalFaithEarned: 0,
      totalGloryEarned: 0,
      totalPrestigeCount: 0,
      totalGodsUnlocked: 1,
      totalBlessings: 0,
    };
    this._floatingTexts = [];
    this._templeAnimTimer = 0;
    this._lightningTimer = 0;
    this._auraPulse = 0;
    this._clickScale = 1;
    this._clickAnimTimer = 0;
    this._starParticles = [];
  }

  protected onStart(): void {
    // 游戏开始时的初始化
  }

  protected onUpdate(deltaTime: number): void {
    // 神殿动画
    this._templeAnimTimer += deltaTime;
    this._auraPulse = Math.sin(this._templeAnimTimer * 0.002) * 2;

    // 闪电效果
    this._lightningTimer += deltaTime;

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
        x: TEMPLE_DRAW.centerX + (Math.random() - 0.5) * 100,
        y: TEMPLE_DRAW.centerY - 20 + Math.random() * 10,
        vx: (Math.random() - 0.5) * 20,
        vy: -15 - Math.random() * 25,
        life: 1200 + Math.random() * 800,
        maxLife: 2000,
        size: 1 + Math.random() * 2,
      });
    }

    // 统计资源产出
    const gold = this.getResource('gold');
    if (gold && gold.perSecond > 0) {
      this._stats.totalGoldEarned += gold.perSecond * (deltaTime / 1000);
    }
    const faith = this.getResource('faith');
    if (faith && faith.perSecond > 0) {
      this._stats.totalFaithEarned += faith.perSecond * (deltaTime / 1000);
    }
    const glory = this.getResource('glory');
    if (glory && glory.perSecond > 0) {
      this._stats.totalGloryEarned += glory.perSecond * (deltaTime / 1000);
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

    // 众神点击加成
    gained *= this.getClickMultiplier();

    // 声望加成
    gained *= this.getPrestigeMultiplier();

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
      x: TEMPLE_DRAW.centerX + Math.cos(angle) * dist,
      y: TEMPLE_DRAW.centerY + Math.sin(angle) * dist - 30,
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
   * 解锁众神恩赐
   */
  unlockGod(godId: string): boolean {
    const godDef = GODS.find((g) => g.id === godId);
    if (!godDef) return false;

    const godState = this._gods.find((g) => g.id === godId);
    if (!godState || godState.unlocked) return false;

    if (!this.hasResource('gold', godDef.unlockCost)) return false;

    this.spendResource('gold', godDef.unlockCost);
    godState.unlocked = true;
    this._stats.totalGodsUnlocked++;

    // 重新计算产出（众神加成可能影响产出）
    this.recalculateProduction();

    this.emit('godUnlocked', godId);
    this.emit('stateChange');
    return true;
  }

  /**
   * 提升众神恩赐等级
   */
  blessGod(godId: string): boolean {
    const godState = this._gods.find((g) => g.id === godId);
    if (!godState || !godState.unlocked) return false;

    const nextLevel = godState.blessingLevel + 1;
    if (nextLevel > MAX_BLESSING_LEVEL) return false;

    const cost = this.getBlessingCost(nextLevel);
    if (!this.canAfford(cost)) return false;

    // 扣除资源
    for (const [resId, amount] of Object.entries(cost)) {
      this.spendResource(resId, amount);
    }

    godState.blessingLevel = nextLevel;
    this._stats.totalBlessings++;

    // 重新计算产出
    this.recalculateProduction();

    this.emit('godBlessed', godId, nextLevel);
    this.emit('stateChange');
    return true;
  }

  /**
   * 获取恩赐费用
   */
  getBlessingCost(level: number): Record<string, number> {
    return BLESSING_COSTS[level] ? { ...BLESSING_COSTS[level] } : {};
  }

  /**
   * 获取众神恩赐等级
   */
  getGodBlessingLevel(godId: string): number {
    const god = this._gods.find((g) => g.id === godId);
    return god ? god.blessingLevel : 0;
  }

  /**
   * 声望重置（众神庇护）
   */
  doPrestige(): number {
    const gold = this.getResource('gold');
    if (!gold || this._stats.totalGoldEarned < MIN_PRESTIGE_GOLD) return 0;

    // 计算获得的众神庇护点
    const blessingsGained = Math.floor(
      PRESTIGE_BASE_BLESSING * Math.sqrt(this._stats.totalGoldEarned / MIN_PRESTIGE_GOLD)
    );

    if (blessingsGained <= 0) return 0;

    // 先增加声望数据
    this.prestige.currency += blessingsGained;
    this.prestige.count++;
    this._stats.totalPrestigeCount++;

    // 保存众神恩赐等级（声望保留恩赐等级）
    const savedGodBlessings = this._gods.map((g) => ({
      id: g.id,
      blessingLevel: g.blessingLevel,
      unlocked: g.unlocked,
    }));

    // 保存已增加的声望数据和部分统计
    const savedPrestige = { ...this.prestige };
    const savedStats = {
      ...this._stats,
      totalGoldEarned: 0,
      totalClicks: 0,
      totalFaithEarned: 0,
      totalGloryEarned: 0,
    };

    // 重置
    this.onInit();

    // 恢复声望和部分统计
    this.prestige = savedPrestige;
    this._stats = savedStats as GreekGodsStatistics;

    // 恢复众神恩赐等级
    for (const saved of savedGodBlessings) {
      const god = this._gods.find((g) => g.id === saved.id);
      if (god) {
        god.blessingLevel = saved.blessingLevel;
        god.unlocked = saved.unlocked;
      }
    }

    this.emit('prestige', blessingsGained);
    this.emit('stateChange');
    return blessingsGained;
  }

  /**
   * 获取声望加成倍率
   */
  getPrestigeMultiplier(): number {
    return 1 + this.prestige.currency * BLESSING_BONUS_MULTIPLIER;
  }

  /**
   * 获取点击加成倍率
   */
  getClickMultiplier(): number {
    let multiplier = 1;
    for (const god of this._gods) {
      if (!god.unlocked) continue;
      const def = GODS.find((g) => g.id === god.id);
      if (!def) continue;
      if (def.bonusType === 'click' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        // 恩赐加成
        bonus *= Math.pow(def.blessingMultiplier, god.blessingLevel);
        multiplier += bonus;
      }
    }
    return multiplier;
  }

  /**
   * 获取金币生产加成倍率
   */
  getGoldProductionMultiplier(): number {
    let multiplier = 1;
    for (const god of this._gods) {
      if (!god.unlocked) continue;
      const def = GODS.find((g) => g.id === god.id);
      if (!def) continue;
      if (def.bonusType === 'gold_production' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.blessingMultiplier, god.blessingLevel);
        multiplier += bonus;
      }
    }
    // 声望加成
    multiplier *= this.getPrestigeMultiplier();
    return multiplier;
  }

  /**
   * 获取信仰生产加成倍率
   */
  getFaithProductionMultiplier(): number {
    let multiplier = 1;
    for (const god of this._gods) {
      if (!god.unlocked) continue;
      const def = GODS.find((g) => g.id === god.id);
      if (!def) continue;
      if (def.bonusType === 'faith_production' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.blessingMultiplier, god.blessingLevel);
        multiplier += bonus;
      }
    }
    // 声望加成
    multiplier *= this.getPrestigeMultiplier();
    return multiplier;
  }

  /**
   * 获取荣耀生产加成倍率
   */
  getGloryProductionMultiplier(): number {
    let multiplier = 1;
    for (const god of this._gods) {
      if (!god.unlocked) continue;
      const def = GODS.find((g) => g.id === god.id);
      if (!def) continue;
      if (def.bonusType === 'glory_production' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.blessingMultiplier, god.blessingLevel);
        multiplier += bonus;
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
   * 获取预览声望（众神庇护点数）
   */
  getPrestigePreview(): number {
    if (this._stats.totalGoldEarned < MIN_PRESTIGE_GOLD) return 0;
    return Math.floor(
      PRESTIGE_BASE_BLESSING * Math.sqrt(this._stats.totalGoldEarned / MIN_PRESTIGE_GOLD)
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
        production *= this.getGoldProductionMultiplier();
      } else if (building.productionResource === 'faith') {
        production *= this.getFaithProductionMultiplier();
      } else if (building.productionResource === 'glory') {
        production *= this.getGloryProductionMultiplier();
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
    // 信仰：雅典娜圣坛等级 >= 5 时解锁
    const shrine = this.upgrades.get('shrine_of_athena');
    if (shrine && shrine.level >= 5) {
      const faith = this.resources.get('faith');
      if (faith && !faith.unlocked) {
        faith.unlocked = true;
        this.emit('resourceUnlocked', 'faith');
      }
    }

    // 信仰也可以通过花园直接产出
    const garden = this.upgrades.get('garden_of_demeter');
    if (garden && garden.level >= 1) {
      const faith = this.resources.get('faith');
      if (faith && !faith.unlocked) {
        faith.unlocked = true;
        this.emit('resourceUnlocked', 'faith');
      }
    }

    // 荣耀：阿瑞斯兵营等级 >= 1 时解锁
    const barracks = this.upgrades.get('barracks_of_ares');
    if (barracks && barracks.level >= 1) {
      const glory = this.resources.get('glory');
      if (glory && !glory.unlocked) {
        glory.unlocked = true;
        this.emit('resourceUnlocked', 'glory');
      }
    }
  }

  // ========== 渲染 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawStarParticles(ctx);
    this.drawTemple(ctx);
    this.drawFloatingTexts(ctx);
    this.drawResourcePanel(ctx, w);
    this.drawBuildingList(ctx, w, h);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 天空渐变（古希腊夜空色调）
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
    for (let i = 0; i < 30; i++) {
      const x = ((i * 73 + 17) % w);
      const y = h * 0.45 + ((i * 47 + 23) % (h * 0.55));
      ctx.fillStyle = '#8B7340';
      ctx.fillRect(x, y, 4, 2);
    }
    ctx.globalAlpha = 1;

    // 远处的小山丘
    ctx.fillStyle = '#6B5B3A';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.quadraticCurveTo(80, h * 0.38, 160, h * 0.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(200, h * 0.5);
    ctx.quadraticCurveTo(300, h * 0.35, 380, h * 0.5);
    ctx.fill();

    // 星星
    ctx.fillStyle = COLORS.starColor;
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 20; i++) {
      const sx = (i * 97 + 31) % w;
      const sy = (i * 43 + 17) % (h * 0.4);
      const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(this._templeAnimTimer * 0.001 + i));
      ctx.globalAlpha = twinkle * 0.6;
      ctx.beginPath();
      ctx.arc(sx, sy, 1 + (i % 2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 月亮
    ctx.beginPath();
    ctx.arc(60, 50, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF8DC';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(60, 50, 24, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 248, 220, 0.15)';
    ctx.fill();
  }

  private drawStarParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this._starParticles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.starColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawTemple(ctx: CanvasRenderingContext2D): void {
    const cx = TEMPLE_DRAW.centerX;
    const cy = TEMPLE_DRAW.centerY + this._auraPulse;
    const scale = this._clickScale;

    // 获取第一个已解锁的神
    const unlockedGod = this._gods.find((g) => g.unlocked);
    const godDef = unlockedGod
      ? GODS.find((g) => g.id === unlockedGod.id)!
      : GODS[0];

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // 神殿阴影
    ctx.beginPath();
    ctx.ellipse(4, TEMPLE_DRAW.bodyHeight * 0.8 + 4, TEMPLE_DRAW.bodyWidth * 0.7, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.pillarShadow;
    ctx.fill();

    // 神殿基座
    ctx.fillStyle = COLORS.columnColor;
    ctx.fillRect(
      -TEMPLE_DRAW.bodyWidth * 0.55,
      TEMPLE_DRAW.bodyHeight * 0.3,
      TEMPLE_DRAW.bodyWidth * 1.1,
      TEMPLE_DRAW.bodyHeight * 0.2
    );

    // 柱子
    const pillarSpacing = TEMPLE_DRAW.bodyWidth / (TEMPLE_DRAW.pillarCount + 1);
    for (let i = 0; i < TEMPLE_DRAW.pillarCount; i++) {
      const px = -TEMPLE_DRAW.bodyWidth * 0.45 + pillarSpacing * (i + 1);
      ctx.fillStyle = COLORS.columnColor;
      ctx.fillRect(
        px - TEMPLE_DRAW.pillarWidth / 2,
        -TEMPLE_DRAW.pillarHeight * 0.3,
        TEMPLE_DRAW.pillarWidth,
        TEMPLE_DRAW.pillarHeight
      );
      // 柱头
      ctx.fillRect(
        px - TEMPLE_DRAW.pillarWidth * 0.8,
        -TEMPLE_DRAW.pillarHeight * 0.35,
        TEMPLE_DRAW.pillarWidth * 1.6,
        4
      );
    }

    // 三角屋顶
    ctx.beginPath();
    ctx.moveTo(-TEMPLE_DRAW.bodyWidth * 0.6, -TEMPLE_DRAW.pillarHeight * 0.3);
    ctx.lineTo(0, -TEMPLE_DRAW.pillarHeight * 0.3 - TEMPLE_DRAW.roofHeight);
    ctx.lineTo(TEMPLE_DRAW.bodyWidth * 0.6, -TEMPLE_DRAW.pillarHeight * 0.3);
    ctx.closePath();
    ctx.fillStyle = COLORS.templeColor;
    ctx.fill();
    ctx.strokeStyle = '#A08040';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 神殿中心神符
    ctx.beginPath();
    ctx.arc(0, -5, 12, 0, Math.PI * 2);
    ctx.fillStyle = godDef.color;
    ctx.fill();

    // 神符光环
    ctx.beginPath();
    ctx.arc(0, -5, 18, 0, Math.PI * 2);
    ctx.strokeStyle = godDef.auraColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(this._templeAnimTimer * 0.003);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 神符图标
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(godDef.icon, 0, -5);

    // 恩赐等级指示（小星星）
    if (unlockedGod) {
      const blessLevel = unlockedGod.blessingLevel;
      for (let i = 0; i < blessLevel; i++) {
        ctx.fillStyle = COLORS.accent;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('★', -20 + i * 10, -TEMPLE_DRAW.pillarHeight * 0.3 - TEMPLE_DRAW.roofHeight - 5);
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
      ctx.textBaseline = 'alphabetic';
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
      const icon = res.id === 'gold' ? '💰' : res.id === 'faith' ? '🙏' : '🏆';

      // 图标
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
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
    ctx.textBaseline = 'alphabetic';
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
      ctx.textBaseline = 'alphabetic';
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
            const icon = id === 'gold' ? '💰' : id === 'faith' ? '🙏' : '🏆';
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
    ctx.fillText('空格 点击 · ↑↓ 选择 · Enter 购买 · B 恩赐 · P 声望', w / 2, h - 10);
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
      case 'b':
      case 'B':
        // 恩赐当前选中的神（第一个已解锁的）
        {
          const unlocked = this._gods.find((g) => g.unlocked);
          if (unlocked) this.blessGod(unlocked.id);
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

  getState(): GreekGodsState {
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
      gods: this.gods,
      prestige: { ...this.prestige },
      statistics: { ...this._stats },
      selectedIndex: this._selectedIndex,
    };
  }

  /**
   * 从状态恢复
   */
  loadState(state: GreekGodsState): void {
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

    // 恢复众神
    if (state.gods) {
      for (const godState of state.gods) {
        const myGod = this._gods.find((g) => g.id === godState.id);
        if (myGod) {
          myGod.unlocked = godState.unlocked;
          if (godState.blessingLevel !== undefined) {
            myGod.blessingLevel = godState.blessingLevel;
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
      this._stats = { ...state.statistics } as GreekGodsStatistics;
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
    // 附加众神和统计信息到 settings
    data.settings = {
      gods: this._gods,
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
      if (settings.gods) {
        for (const godState of settings.gods) {
          const myGod = this._gods.find((g) => g.id === godState.id);
          if (myGod) {
            myGod.unlocked = godState.unlocked;
            if (godState.blessingLevel !== undefined) {
              myGod.blessingLevel = godState.blessingLevel;
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
