/**
 * 最终幻想 (Final Fantasy) — 放置类游戏引擎
 *
 * 继承 IdleGameEngine，实现：
 * - 多资源系统（金币/经验/魔力）
 * - 建筑升级系统（8种建筑）
 * - 职业系统（6种职业，可进阶）
 * - 召唤兽系统（5种召唤兽，提供全局加成）
 * - 声望重置系统（水晶）
 * - Canvas 奇幻风格渲染
 * - 离线收益
 * - 自动存档
 */
import { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { Resource, Upgrade, SaveData } from '@/types/idle';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GOLD_PER_CLICK,
  CRYSTAL_BONUS_MULTIPLIER,
  PRESTIGE_BASE_CRYSTALS,
  MIN_PRESTIGE_GOLD,
  JOBS,
  SUMMONS,
  BUILDINGS,
  COLORS,
  CHARACTER_DRAW,
  BUILDING_PANEL,
  RESOURCE_PANEL,
  PROMOTION_COSTS,
  MAX_PROMOTION_LEVEL,
  type JobDef,
  type SummonDef,
  type BuildingDef,
} from './constants';

/** 职业状态 */
export interface JobState {
  id: string;
  unlocked: boolean;
  /** 进阶等级 0-5 */
  promotionLevel: number;
}

/** 召唤兽状态 */
export interface SummonState {
  id: string;
  unlocked: boolean;
}

/** 游戏统计 */
export interface FinalFantasyStatistics {
  totalGoldEarned: number;
  totalClicks: number;
  totalExpEarned: number;
  totalManaEarned: number;
  totalPrestigeCount: number;
  totalJobsUnlocked: number;
  totalPromotions: number;
  totalSummonsUnlocked: number;
}

/** 最终幻想游戏状态 */
export interface FinalFantasyState {
  [key: string]: unknown;
  resources: Record<string, { amount: number; perSecond: number; unlocked: boolean }>;
  buildings: Record<string, number>;
  jobs: JobState[];
  summons: SummonState[];
  prestige: { currency: number; count: number };
  statistics: FinalFantasyStatistics;
  selectedIndex: number;
}

export class FinalFantasyEngine extends IdleGameEngine {
  // ========== 游戏状态 ==========

  protected _gameId = 'final-fantasy';

  constructor() {
    super();
    Object.defineProperty(this, 'statistics', {
      get: () => ({ ...this._stats }) as FinalFantasyStatistics,
      set: (_val: Record<string, number>) => { /* base class writes are no-ops */ },
      configurable: true,
      enumerable: true,
    });
  }

  /** 职业状态 */
  private _jobs: JobState[] = JOBS.map((j) => ({
    id: j.id,
    unlocked: j.id === 'warrior',
    promotionLevel: 0,
  }));

  /** 召唤兽状态 */
  private _summons: SummonState[] = SUMMONS.map((s) => ({
    id: s.id,
    unlocked: false,
  }));

  /** 当前选中的建筑索引 */
  private _selectedIndex: number = 0;

  /** 统计数据 */
  private _stats: FinalFantasyStatistics = {
    totalGoldEarned: 0,
    totalClicks: 0,
    totalExpEarned: 0,
    totalManaEarned: 0,
    totalPrestigeCount: 0,
    totalJobsUnlocked: 1,
    totalPromotions: 0,
    totalSummonsUnlocked: 0,
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

  /** 角色动画计时器 */
  private _animTimer: number = 0;
  /** 角色呼吸缩放 */
  private _breathe: number = 0;
  /** 点击缩放效果 */
  private _clickScale: number = 1;
  private _clickAnimTimer: number = 0;
  /** 魔法粒子 */
  private _magicParticles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    color: string;
  }> = [];
  /** 星星背景 */
  private _stars: Array<{ x: number; y: number; size: number; twinkle: number }> = [];

  // ========== 公开属性 ==========

  get selectedIndex(): number {
    return this._selectedIndex;
  }

  get jobs(): JobState[] {
    return this._jobs.map((j) => ({ ...j }));
  }

  get summons(): SummonState[] {
    return this._summons.map((s) => ({ ...s }));
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
        id: 'exp',
        name: '经验',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e12,
        unlocked: false,
      },
      {
        id: 'mana',
        name: '魔力',
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
        unlocked: b.id === 'tavern',
        requires: b.requires,
        icon: b.icon,
      }))
    );

    // 重置状态
    this._jobs = JOBS.map((j) => ({
      id: j.id,
      unlocked: j.id === 'warrior',
      promotionLevel: 0,
    }));
    this._summons = SUMMONS.map((s) => ({
      id: s.id,
      unlocked: false,
    }));
    this._selectedIndex = 0;
    this._stats = {
      totalGoldEarned: 0,
      totalClicks: 0,
      totalExpEarned: 0,
      totalManaEarned: 0,
      totalPrestigeCount: 0,
      totalJobsUnlocked: 1,
      totalPromotions: 0,
      totalSummonsUnlocked: 0,
    };
    this._floatingTexts = [];
    this._animTimer = 0;
    this._breathe = 0;
    this._clickScale = 1;
    this._clickAnimTimer = 0;
    this._magicParticles = [];

    // 初始化星星背景
    this._stars = [];
    for (let i = 0; i < 40; i++) {
      this._stars.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT * 0.45,
        size: 1 + Math.random() * 2,
        twinkle: Math.random() * Math.PI * 2,
      });
    }
  }

  protected onUpdate(deltaTime: number): void {
    // 角色动画
    this._animTimer += deltaTime;
    this._breathe = Math.sin(this._animTimer * 0.002) * 2;

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

    // 魔法粒子更新
    this._magicParticles = this._magicParticles.filter((p) => {
      p.life -= deltaTime;
      p.x += p.vx * (deltaTime / 1000);
      p.y += p.vy * (deltaTime / 1000);
      p.vy -= 20 * (deltaTime / 1000);
      return p.life > 0;
    });

    // 随机产生魔法粒子
    if (Math.random() < 0.03) {
      const colors = [COLORS.accent, COLORS.accentBlue, COLORS.manaColor];
      this._magicParticles.push({
        x: CHARACTER_DRAW.centerX + (Math.random() - 0.5) * 60,
        y: CHARACTER_DRAW.centerY + 20,
        vx: (Math.random() - 0.5) * 20,
        vy: -10 - Math.random() * 20,
        life: 1500 + Math.random() * 1000,
        maxLife: 2500,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    // 统计资源产出
    const gold = this.getResource('gold');
    if (gold && gold.perSecond > 0) {
      this._stats.totalGoldEarned += gold.perSecond * (deltaTime / 1000);
    }
    const exp = this.getResource('exp');
    if (exp && exp.perSecond > 0) {
      this._stats.totalExpEarned += exp.perSecond * (deltaTime / 1000);
    }
    const mana = this.getResource('mana');
    if (mana && mana.perSecond > 0) {
      this._stats.totalManaEarned += mana.perSecond * (deltaTime / 1000);
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

    // 职业点击加成
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
      x: CHARACTER_DRAW.centerX + Math.cos(angle) * dist,
      y: CHARACTER_DRAW.centerY + Math.sin(angle) * dist - 30,
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
   * 解锁职业
   */
  unlockJob(jobId: string): boolean {
    const jobDef = JOBS.find((j) => j.id === jobId);
    if (!jobDef) return false;

    const jobState = this._jobs.find((j) => j.id === jobId);
    if (!jobState || jobState.unlocked) return false;

    if (!this.hasResource('gold', jobDef.unlockCost)) return false;

    this.spendResource('gold', jobDef.unlockCost);
    jobState.unlocked = true;
    this._stats.totalJobsUnlocked++;

    this.recalculateProduction();

    this.emit('jobUnlocked', jobId);
    this.emit('stateChange');
    return true;
  }

  /**
   * 进阶职业
   */
  promoteJob(jobId: string): boolean {
    const jobState = this._jobs.find((j) => j.id === jobId);
    if (!jobState || !jobState.unlocked) return false;

    const nextLevel = jobState.promotionLevel + 1;
    if (nextLevel > MAX_PROMOTION_LEVEL) return false;

    const cost = this.getPromotionCost(nextLevel);
    if (!this.canAfford(cost)) return false;

    // 扣除资源
    for (const [resId, amount] of Object.entries(cost)) {
      this.spendResource(resId, amount);
    }

    jobState.promotionLevel = nextLevel;
    this._stats.totalPromotions++;

    this.recalculateProduction();

    this.emit('jobPromoted', jobId, nextLevel);
    this.emit('stateChange');
    return true;
  }

  /**
   * 获取进阶费用
   */
  getPromotionCost(level: number): Record<string, number> {
    return PROMOTION_COSTS[level] ? { ...PROMOTION_COSTS[level] } : {};
  }

  /**
   * 获取职业进阶等级
   */
  getJobPromotionLevel(jobId: string): number {
    const job = this._jobs.find((j) => j.id === jobId);
    return job ? job.promotionLevel : 0;
  }

  /**
   * 解锁召唤兽
   */
  unlockSummon(summonId: string): boolean {
    const summonDef = SUMMONS.find((s) => s.id === summonId);
    if (!summonDef) return false;

    const summonState = this._summons.find((s) => s.id === summonId);
    if (!summonState || summonState.unlocked) return false;

    if (!this.hasResource('mana', summonDef.unlockCost)) return false;

    this.spendResource('mana', summonDef.unlockCost);
    summonState.unlocked = true;
    this._stats.totalSummonsUnlocked++;

    this.recalculateProduction();

    this.emit('summonUnlocked', summonId);
    this.emit('stateChange');
    return true;
  }

  /**
   * 获取召唤兽是否已解锁
   */
  isSummonUnlocked(summonId: string): boolean {
    const summon = this._summons.find((s) => s.id === summonId);
    return summon ? summon.unlocked : false;
  }

  /**
   * 声望重置（转生）
   */
  doPrestige(): number {
    const gold = this.getResource('gold');
    if (!gold || this._stats.totalGoldEarned < MIN_PRESTIGE_GOLD) return 0;

    // 计算获得的水晶
    const crystalsGained = Math.floor(
      PRESTIGE_BASE_CRYSTALS * Math.sqrt(this._stats.totalGoldEarned / MIN_PRESTIGE_GOLD)
    );

    if (crystalsGained <= 0) return 0;

    // 保存水晶和声望数据
    const savedPrestige = { ...this.prestige };
    savedPrestige.currency += crystalsGained;
    savedPrestige.count++;

    // 保存职业进阶等级（转生保留进阶等级）
    const savedJobPromotions = this._jobs.map((j) => ({
      id: j.id,
      promotionLevel: j.promotionLevel,
      unlocked: j.unlocked,
    }));

    // 保存召唤兽解锁状态
    const savedSummons = this._summons.map((s) => ({
      id: s.id,
      unlocked: s.unlocked,
    }));

    // 保存统计
    const savedStats = {
      ...this._stats,
      totalGoldEarned: 0,
      totalClicks: 0,
      totalExpEarned: 0,
      totalManaEarned: 0,
    };
    savedStats.totalPrestigeCount++;

    // 重置
    this.onInit();

    // 恢复声望
    this.prestige = savedPrestige;

    // 恢复统计
    this._stats = savedStats as FinalFantasyStatistics;

    // 恢复职业进阶等级
    for (const saved of savedJobPromotions) {
      const job = this._jobs.find((j) => j.id === saved.id);
      if (job) {
        job.promotionLevel = saved.promotionLevel;
        job.unlocked = saved.unlocked;
      }
    }

    // 恢复召唤兽解锁状态
    for (const saved of savedSummons) {
      const summon = this._summons.find((s) => s.id === saved.id);
      if (summon) {
        summon.unlocked = saved.unlocked;
      }
    }

    this.emit('prestige', crystalsGained);
    this.emit('stateChange');
    return crystalsGained;
  }

  /**
   * 获取声望加成倍率
   */
  getPrestigeMultiplier(): number {
    return 1 + this.prestige.currency * CRYSTAL_BONUS_MULTIPLIER;
  }

  /**
   * 获取点击加成倍率
   */
  getClickMultiplier(): number {
    let multiplier = 1;
    for (const job of this._jobs) {
      if (!job.unlocked) continue;
      const def = JOBS.find((j) => j.id === job.id);
      if (!def) continue;
      if (def.bonusType === 'click' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.promotionMultiplier, job.promotionLevel);
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
    for (const job of this._jobs) {
      if (!job.unlocked) continue;
      const def = JOBS.find((j) => j.id === job.id);
      if (!def) continue;
      if (def.bonusType === 'gold_production' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.promotionMultiplier, job.promotionLevel);
        multiplier += bonus;
      }
    }
    // 声望加成
    multiplier *= this.getPrestigeMultiplier();
    // 召唤兽加成
    multiplier *= this.getSummonMultiplier('gold');
    return multiplier;
  }

  /**
   * 获取经验生产加成倍率
   */
  getExpProductionMultiplier(): number {
    let multiplier = 1;
    for (const job of this._jobs) {
      if (!job.unlocked) continue;
      const def = JOBS.find((j) => j.id === job.id);
      if (!def) continue;
      if (def.bonusType === 'exp_production' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.promotionMultiplier, job.promotionLevel);
        multiplier += bonus;
      }
    }
    multiplier *= this.getPrestigeMultiplier();
    multiplier *= this.getSummonMultiplier('exp');
    return multiplier;
  }

  /**
   * 获取魔力生产加成倍率
   */
  getManaProductionMultiplier(): number {
    let multiplier = 1;
    for (const job of this._jobs) {
      if (!job.unlocked) continue;
      const def = JOBS.find((j) => j.id === job.id);
      if (!def) continue;
      if (def.bonusType === 'mana_production' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.promotionMultiplier, job.promotionLevel);
        multiplier += bonus;
      }
    }
    multiplier *= this.getPrestigeMultiplier();
    multiplier *= this.getSummonMultiplier('mana');
    return multiplier;
  }

  /**
   * 获取召唤兽加成倍率
   */
  getSummonMultiplier(target: 'gold' | 'exp' | 'mana' | 'all'): number {
    let multiplier = 1;
    for (const summon of this._summons) {
      if (!summon.unlocked) continue;
      const def = SUMMONS.find((s) => s.id === summon.id);
      if (!def) continue;
      if (def.bonusTarget === target || def.bonusTarget === 'all') {
        multiplier *= def.bonusMultiplier;
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
   * 获取预览声望水晶数
   */
  getPrestigePreview(): number {
    if (this._stats.totalGoldEarned < MIN_PRESTIGE_GOLD) return 0;
    return Math.floor(
      PRESTIGE_BASE_CRYSTALS * Math.sqrt(this._stats.totalGoldEarned / MIN_PRESTIGE_GOLD)
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
      } else if (building.productionResource === 'exp') {
        production *= this.getExpProductionMultiplier();
      } else if (building.productionResource === 'mana') {
        production *= this.getManaProductionMultiplier();
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
    // 经验：训练场等级 >= 1 时解锁
    const trainingGround = this.upgrades.get('training_ground');
    if (trainingGround && trainingGround.level >= 1) {
      const exp = this.resources.get('exp');
      if (exp && !exp.unlocked) {
        exp.unlocked = true;
        this.emit('resourceUnlocked', 'exp');
      }
    }

    // 魔力：魔法塔等级 >= 1 时解锁
    const magicTower = this.upgrades.get('magic_tower');
    if (magicTower && magicTower.level >= 1) {
      const mana = this.resources.get('mana');
      if (mana && !mana.unlocked) {
        mana.unlocked = true;
        this.emit('resourceUnlocked', 'mana');
      }
    }
  }

  // ========== 渲染 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawStars(ctx, w, h);
    this.drawMagicParticles(ctx);
    this.drawCharacter(ctx);
    this.drawFloatingTexts(ctx);
    this.drawResourcePanel(ctx, w);
    this.drawBuildingList(ctx, w, h);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 天空渐变（深蓝色奇幻风格）
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
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 25; i++) {
      const x = ((i * 73 + 17) % w);
      const y = h * 0.45 + ((i * 47 + 23) % (h * 0.55));
      ctx.fillStyle = '#1A252F';
      ctx.fillRect(x, y, 4, 3);
    }
    ctx.globalAlpha = 1;

    // 远处城堡轮廓
    ctx.fillStyle = '#1A252F';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.quadraticCurveTo(60, h * 0.38, 120, h * 0.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(300, h * 0.5);
    ctx.quadraticCurveTo(380, h * 0.35, 460, h * 0.5);
    ctx.fill();

    // 城堡塔楼
    ctx.fillStyle = '#2C3E50';
    ctx.fillRect(350, h * 0.3, 15, h * 0.2);
    ctx.fillRect(370, h * 0.35, 12, h * 0.15);
    // 塔尖
    ctx.beginPath();
    ctx.moveTo(350, h * 0.3);
    ctx.lineTo(357, h * 0.25);
    ctx.lineTo(365, h * 0.3);
    ctx.closePath();
    ctx.fill();
  }

  private drawStars(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    for (const star of this._stars) {
      const twinkle = Math.sin(this._animTimer * 0.001 + star.twinkle) * 0.5 + 0.5;
      ctx.globalAlpha = 0.3 + twinkle * 0.7;
      ctx.fillStyle = COLORS.starColor;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size * twinkle, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 月亮
    ctx.beginPath();
    ctx.arc(80, 60, 22, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF8E1';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(80, 60, 26, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 248, 225, 0.12)';
    ctx.fill();
  }

  private drawMagicParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this._magicParticles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawCharacter(ctx: CanvasRenderingContext2D): void {
    const cx = CHARACTER_DRAW.centerX;
    const cy = CHARACTER_DRAW.centerY + this._breathe;
    const scale = this._clickScale;

    // 获取第一个已解锁的职业
    const unlockedJob = this._jobs.find((j) => j.unlocked);
    const jobDef = unlockedJob
      ? JOBS.find((j) => j.id === unlockedJob.id)!
      : JOBS[0];

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // 身体阴影
    ctx.beginPath();
    ctx.ellipse(4, CHARACTER_DRAW.bodyHeight * 0.8 + 4, CHARACTER_DRAW.bodyWidth * 0.6, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.characterShadow;
    ctx.fill();

    // 腿
    ctx.fillStyle = '#2C3E50';
    ctx.fillRect(-CHARACTER_DRAW.bodyWidth * 0.25, CHARACTER_DRAW.bodyHeight * 0.25, 8, 20);
    ctx.fillRect(CHARACTER_DRAW.bodyWidth * 0.05, CHARACTER_DRAW.bodyHeight * 0.25, 8, 20);

    // 身体（盔甲/长袍）
    ctx.beginPath();
    ctx.ellipse(0, 0, CHARACTER_DRAW.bodyWidth * 0.45, CHARACTER_DRAW.bodyHeight * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = jobDef.color;
    ctx.fill();

    // 身体高光
    ctx.beginPath();
    ctx.ellipse(-5, -5, CHARACTER_DRAW.bodyWidth * 0.25, CHARACTER_DRAW.bodyHeight * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fill();

    // 头
    ctx.beginPath();
    ctx.arc(0, -CHARACTER_DRAW.bodyHeight * 0.55, CHARACTER_DRAW.headRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#FDBCB4';
    ctx.fill();

    // 头发/头盔
    ctx.beginPath();
    ctx.arc(0, -CHARACTER_DRAW.bodyHeight * 0.55 - 3, CHARACTER_DRAW.headRadius, Math.PI, Math.PI * 2);
    ctx.fillStyle = jobDef.color;
    ctx.fill();

    // 眼睛
    ctx.beginPath();
    ctx.arc(-5, -CHARACTER_DRAW.bodyHeight * 0.57, CHARACTER_DRAW.eyeRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-5, -CHARACTER_DRAW.bodyHeight * 0.57, CHARACTER_DRAW.eyeRadius * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = '#2C2C2C';
    ctx.fill();

    // 右眼
    ctx.beginPath();
    ctx.arc(5, -CHARACTER_DRAW.bodyHeight * 0.57, CHARACTER_DRAW.eyeRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(5, -CHARACTER_DRAW.bodyHeight * 0.57, CHARACTER_DRAW.eyeRadius * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = '#2C2C2C';
    ctx.fill();

    // 武器（根据职业）
    if (jobDef.id === 'warrior' || jobDef.id === 'dragoon') {
      // 剑
      ctx.fillStyle = '#BDC3C7';
      ctx.fillRect(CHARACTER_DRAW.bodyWidth * 0.35, -CHARACTER_DRAW.bodyHeight * 0.3, 4, CHARACTER_DRAW.swordLength);
      // 剑柄
      ctx.fillStyle = '#8B6914';
      ctx.fillRect(CHARACTER_DRAW.bodyWidth * 0.35 - 3, -CHARACTER_DRAW.bodyHeight * 0.3, 10, 4);
    } else if (jobDef.id === 'mage' || jobDef.id === 'summoner') {
      // 法杖
      ctx.fillStyle = '#8B6914';
      ctx.fillRect(CHARACTER_DRAW.bodyWidth * 0.35, -CHARACTER_DRAW.bodyHeight * 0.5, 3, CHARACTER_DRAW.staffLength + 20);
      // 法杖顶部宝珠
      ctx.beginPath();
      ctx.arc(CHARACTER_DRAW.bodyWidth * 0.35 + 1.5, -CHARACTER_DRAW.bodyHeight * 0.5 - 4, 5, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.manaColor;
      ctx.fill();
    } else if (jobDef.id === 'cleric') {
      // 权杖
      ctx.fillStyle = '#F1C40F';
      ctx.fillRect(CHARACTER_DRAW.bodyWidth * 0.35, -CHARACTER_DRAW.bodyHeight * 0.4, 3, 30);
      ctx.beginPath();
      ctx.arc(CHARACTER_DRAW.bodyWidth * 0.35 + 1.5, -CHARACTER_DRAW.bodyHeight * 0.4 - 3, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#F1C40F';
      ctx.fill();
    } else {
      // 匕首
      ctx.fillStyle = '#BDC3C7';
      ctx.fillRect(CHARACTER_DRAW.bodyWidth * 0.35, -CHARACTER_DRAW.bodyHeight * 0.1, 3, 18);
    }

    // 进阶等级指示（小星星）
    if (unlockedJob) {
      const promoLevel = unlockedJob.promotionLevel;
      for (let i = 0; i < promoLevel; i++) {
        ctx.fillStyle = COLORS.starColor;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★', -15 + i * 10, -CHARACTER_DRAW.bodyHeight * 0.85);
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
      const icon = res.id === 'gold' ? '💰' : res.id === 'exp' ? '⭐' : '🔮';

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
            const icon = id === 'gold' ? '💰' : id === 'exp' ? '⭐' : '🔮';
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
    ctx.fillText('空格 点击 · ↑↓ 选择 · Enter 购买 · J 职业 · S 召唤 · P 转生', w / 2, h - 10);
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
      case 'j':
      case 'J':
        // 进阶当前已解锁的第一个职业
        {
          const unlocked = this._jobs.find((j) => j.unlocked);
          if (unlocked) this.promoteJob(unlocked.id);
        }
        break;
      case 's':
      case 'S':
        // 解锁第一个未解锁的召唤兽
        {
          const locked = this._summons.find((s) => !s.unlocked);
          if (locked) this.unlockSummon(locked.id);
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

  getState(): FinalFantasyState {
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
      jobs: this.jobs,
      summons: this.summons,
      prestige: { ...this.prestige },
      statistics: { ...this._stats },
      selectedIndex: this._selectedIndex,
    };
  }

  /**
   * 从状态恢复
   */
  loadState(state: FinalFantasyState): void {
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

    // 恢复职业
    if (state.jobs) {
      for (const jobState of state.jobs) {
        const myJob = this._jobs.find((j) => j.id === jobState.id);
        if (myJob) {
          myJob.unlocked = jobState.unlocked;
          if (jobState.promotionLevel !== undefined) {
            myJob.promotionLevel = jobState.promotionLevel;
          }
        }
      }
    }

    // 恢复召唤兽
    if (state.summons) {
      for (const summonState of state.summons) {
        const mySummon = this._summons.find((s) => s.id === summonState.id);
        if (mySummon) {
          mySummon.unlocked = summonState.unlocked;
        }
      }
    }

    // 恢复声望
    if (state.prestige) {
      this.prestige = { ...state.prestige };
    }

    // 恢复统计
    if (state.statistics) {
      this._stats = { ...state.statistics } as FinalFantasyStatistics;
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
      jobs: this._jobs,
      summons: this._summons,
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
      if (settings.jobs) {
        for (const jobState of settings.jobs) {
          const myJob = this._jobs.find((j) => j.id === jobState.id);
          if (myJob) {
            myJob.unlocked = jobState.unlocked;
            if (jobState.promotionLevel !== undefined) {
              myJob.promotionLevel = jobState.promotionLevel;
            }
          }
        }
      }
      if (settings.summons) {
        for (const summonState of settings.summons) {
          const mySummon = this._summons.find((s) => s.id === summonState.id);
          if (mySummon) {
            mySummon.unlocked = summonState.unlocked;
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
