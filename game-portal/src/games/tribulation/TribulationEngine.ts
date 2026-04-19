/**
 * 渡劫飞升（Tribulation）放置类游戏引擎
 *
 * 继承 IdleGameEngine，核心玩法：
 * - 点击/空格键获得灵力
 * - 建筑系统（修炼洞府、聚灵阵、炼器坊、渡劫台、道殿、藏宝阁、天门、仙池）
 * - 天劫系统（雷劫、火劫、风劫、心劫、天劫，逐步挑战）
 * - 飞升系统（渡过所有天劫后可飞升转生，获得声望加成）
 * - 离线收益 + 自动存档/读档
 * - 紫金仙侠风画面
 */
import { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { SaveData } from '@/types/idle';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SPIRIT_POWER_PER_CLICK,
  RESOURCE_IDS,
  BUILDING_IDS,
  BUILDINGS,
  TRIBULATIONS,
  TRIBULATION_LEVELS,
  MIN_PRESTIGE_SPIRIT,
  PRESTIGE_MULTIPLIER,
  COLORS,
  UPGRADE_PANEL,
  RESOURCE_ICONS,
  RESOURCE_NAMES,
  FLOATING_TEXT_DURATION,
  MAX_PARTICLES,
  PARTICLE_SPEED,
  TRIBULATION_ANIM_DURATION,
  type BuildingDef,
  type TribulationLevelDef,
} from './constants';

// ========== 游戏状态接口 ==========

/** 灵力粒子 */
interface SpiritParticle {
  x: number;
  y: number;
  speed: number;
  size: number;
  opacity: number;
  angle: number;
}

/** 飘字效果 */
interface FloatingText {
  text: string;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  color: string;
}

/** 天劫动画状态 */
interface TribulationAnim {
  active: boolean;
  tribulationId: string;
  success: boolean;
  timer: number;
  maxTimer: number;
}

/** 渡劫结果 */
export interface TribulationResult {
  success: boolean;
  tribulationId: string;
  tribulationName: string;
  resourcesLost: Record<string, number>;
  heavenAweGained: number;
  message: string;
}

/** 游戏完整状态 */
export interface TribulationState {
  [key: string]: unknown;
  resources: Record<string, { amount: number; unlocked: boolean }>;
  upgrades: Record<string, number>;
  prestige: { currency: number; count: number };
  statistics: Record<string, number>;
  completedTribulations: string[];
  currentTribulationIndex: number;
  totalSpiritEarned: number;
  totalClicks: number;
  totalTribulationsPassed: number;
  selectedBuildingIndex: number;
}

export class TribulationEngine extends IdleGameEngine {
  // ========== 游戏状态 ==========

  protected _gameId = 'tribulation';

  constructor() {
    super();
    // Override base class `statistics` instance field with a getter/setter,
    // because class fields shadow prototype accessors.
    Object.defineProperty(this, 'statistics', {
      get: () => ({
        completedTribulationsJson: JSON.stringify(Array.from(this._completedTribulations)),
        currentTribulationIndex: this._currentTribulationIndex,
        totalSpiritEarned: this._totalSpiritEarned,
        totalClicks: this._totalClicks,
        totalTribulationsPassed: this._totalTribulationsPassed,
        selectedBuildingIndex: this._selectedBuildingIndex,
      }),
      set: (_val: Record<string, number>) => { /* base class writes are no-ops */ },
      configurable: true,
      enumerable: true,
    });
  }

  /** 已完成的天劫 ID 列表 */
  private _completedTribulations: Set<string> = new Set();
  /** 当前可挑战的天劫索引 */
  private _currentTribulationIndex: number = 0;
  /** 累计灵力获得 */
  private _totalSpiritEarned: number = 0;
  /** 累计点击次数 */
  private _totalClicks: number = 0;
  /** 累计渡劫成功次数 */
  private _totalTribulationsPassed: number = 0;
  /** 当前选中建筑索引 */
  private _selectedBuildingIndex: number = 0;

  // ========== 动画状态 ==========

  /** 飘字效果列表 */
  private _floatingTexts: FloatingText[] = [];
  /** 灵力粒子 */
  private _spiritParticles: SpiritParticle[] = [];
  /** 点击缩放动画 */
  private _clickScale: number = 1;
  /** 点击动画计时器 */
  private _clickAnimTimer: number = 0;
  /** 全局动画计时 */
  private _animTimer: number = 0;
  /** 天劫动画 */
  private _tribulationAnim: TribulationAnim = {
    active: false,
    tribulationId: '',
    success: false,
    timer: 0,
    maxTimer: TRIBULATION_ANIM_DURATION,
  };

  // ========== 公开属性 ==========

  get completedTribulations(): string[] {
    return Array.from(this._completedTribulations);
  }

  get currentTribulationIndex(): number {
    return this._currentTribulationIndex;
  }

  get currentTribulation(): TribulationLevelDef | null {
    return this._currentTribulationIndex < TRIBULATIONS.length
      ? TRIBULATIONS[this._currentTribulationIndex]
      : null;
  }

  get totalSpiritEarned(): number {
    return this._totalSpiritEarned;
  }

  get totalClicks(): number {
    return this._totalClicks;
  }

  get totalTribulationsPassed(): number {
    return this._totalTribulationsPassed;
  }

  get allTribulationsCompleted(): boolean {
    return this._completedTribulations.size >= TRIBULATIONS.length;
  }

  get tribulationAnimActive(): boolean {
    return this._tribulationAnim.active;
  }

  get selectedBuildingIndex(): number {
    return this._selectedBuildingIndex;
  }

  // ========== 生命周期 ==========

  protected onInit(): void {
    super.onInit();

    // 初始化资源
    this.initializeResources([
      {
        id: RESOURCE_IDS.SPIRIT_POWER,
        name: RESOURCE_NAMES[RESOURCE_IDS.SPIRIT_POWER],
        amount: 0,
        perSecond: 0,
        maxAmount: Infinity,
        unlocked: true,
      },
      {
        id: RESOURCE_IDS.DAO_RHYME,
        name: RESOURCE_NAMES[RESOURCE_IDS.DAO_RHYME],
        amount: 0,
        perSecond: 0,
        maxAmount: Infinity,
        unlocked: false,
      },
      {
        id: RESOURCE_IDS.HEAVEN_AWE,
        name: RESOURCE_NAMES[RESOURCE_IDS.HEAVEN_AWE],
        amount: 0,
        perSecond: 0,
        maxAmount: Infinity,
        unlocked: false,
      },
    ]);

    // 初始化建筑（升级）
    this.initializeUpgrades(
      BUILDINGS.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        baseCost: b.baseCost,
        costMultiplier: b.costMultiplier,
        level: 0,
        maxLevel: b.maxLevel,
        effect: {
          type: 'add_production',
          target: b.productionResource,
          value: b.baseProduction,
        },
        unlocked: b.unlockTribulationIndex === -1,
        icon: b.icon,
      }))
    );

    // 重置游戏状态
    this._completedTribulations = new Set();
    this._currentTribulationIndex = 0;
    this._totalSpiritEarned = 0;
    this._totalClicks = 0;
    this._totalTribulationsPassed = 0;
    this._selectedBuildingIndex = 0;

    // 重置动画状态
    this._floatingTexts = [];
    this._spiritParticles = [];
    this._clickScale = 1;
    this._clickAnimTimer = 0;
    this._animTimer = 0;
    this._tribulationAnim = {
      active: false,
      tribulationId: '',
      success: false,
      timer: 0,
      maxTimer: TRIBULATION_ANIM_DURATION,
    };

    // 初始化粒子
    this.initSpiritParticles();
  }

  protected onStart(): void {
    this.loadFromStorage();
  }

  protected onUpdate(deltaTime: number): void {
    this.updateAnimations(deltaTime);
    this.checkBuildingUnlocks();
    this.checkResourceUnlocks();
  }

  // ========== 核心逻辑：点击修炼 ==========

  /**
   * 点击获得灵力
   * @returns 本次获得的灵力数
   */
  click(): number {
    if (this._status !== 'playing') return 0;

    const clickPower = this.getClickPower();
    this.addResource(RESOURCE_IDS.SPIRIT_POWER, clickPower);
    this._totalSpiritEarned += clickPower;
    this._totalClicks++;
    this.addScore(clickPower);

    // 触发点击动画
    this._clickScale = 1.2;
    this._clickAnimTimer = 200;

    // 飘字效果
    const angle = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * 30;
    this._floatingTexts.push({
      text: `+${this.formatNumber(clickPower)}`,
      x: CANVAS_WIDTH / 2 + Math.cos(angle) * dist,
      y: 200 + Math.sin(angle) * dist,
      life: FLOATING_TEXT_DURATION,
      maxLife: FLOATING_TEXT_DURATION,
      color: COLORS.spiritColor,
    });

    this.emit('click', clickPower);
    this.emit('stateChange');
    return clickPower;
  }

  /**
   * 获取当前点击力量
   */
  getClickPower(): number {
    let power = SPIRIT_POWER_PER_CLICK;

    // 渡劫台加成（每级 +5%）
    const tribPlatformLevel = this.getBuildingLevel(BUILDING_IDS.TRIBULATION_PLATFORM);
    power *= 1 + tribPlatformLevel * 0.05;

    // 天威加成（每点天威 +0.1%）
    const heavenAwe = this.getResource(RESOURCE_IDS.HEAVEN_AWE)?.amount || 0;
    power *= 1 + heavenAwe * 0.001;

    // 已渡天劫加成（每渡一劫 +20%）
    power *= 1 + this._completedTribulations.size * 0.2;

    // 声望加成
    power *= 1 + this.prestige.currency * PRESTIGE_MULTIPLIER;

    return power;
  }

  // ========== 核心逻辑：天劫系统 ==========

  /**
   * 尝试渡劫
   */
  attemptTribulation(): TribulationResult {
    if (this._status !== 'playing') {
      return this.failResult('', '当前状态不可渡劫');
    }

    if (this._tribulationAnim.active) {
      return this.failResult('', '渡劫进行中…');
    }

    const tribulation = this.currentTribulation;
    if (!tribulation) {
      return this.failResult('', '已渡过所有天劫，可尝试飞升！');
    }

    // 检查资源
    if (!this.canAfford(tribulation.cost)) {
      return this.failResult(tribulation.id, '资源不足，无法渡劫');
    }

    // 计算成功率
    const successRate = this.getTribulationSuccessRate(tribulation);

    // 扣除资源
    for (const [id, amount] of Object.entries(tribulation.cost)) {
      this.spendResource(id, amount);
    }

    // 判定成功
    const roll = Math.random();
    if (roll < successRate) {
      // 渡劫成功
      this._completedTribulations.add(tribulation.id);
      this._currentTribulationIndex = Math.min(
        this._currentTribulationIndex + 1,
        TRIBULATIONS.length
      );
      this._totalTribulationsPassed++;

      // 奖励天威
      const heavenAweReward = tribulation.rewardHeavenAwe;
      this.addResource(RESOURCE_IDS.HEAVEN_AWE, heavenAweReward);

      // 触发渡劫动画
      this._tribulationAnim = {
        active: true,
        tribulationId: tribulation.id,
        success: true,
        timer: TRIBULATION_ANIM_DURATION,
        maxTimer: TRIBULATION_ANIM_DURATION,
      };

      this.emit('tribulationSuccess', {
        tribulationId: tribulation.id,
        heavenAweGained: heavenAweReward,
      });
      this.emit('stateChange');

      return {
        success: true,
        tribulationId: tribulation.id,
        tribulationName: tribulation.name,
        resourcesLost: tribulation.cost,
        heavenAweGained: heavenAweReward,
        message: `${tribulation.name}渡过！获得 ${this.formatNumber(heavenAweReward)} 天威！`,
      };
    } else {
      // 渡劫失败，损失部分灵力
      const lost: Record<string, number> = {};
      const spiritResource = this.getResource(RESOURCE_IDS.SPIRIT_POWER);
      if (spiritResource) {
        const lossAmount = Math.floor(spiritResource.amount * tribulation.failLossRate);
        if (lossAmount > 0) {
          this.spendResource(RESOURCE_IDS.SPIRIT_POWER, lossAmount);
          lost[RESOURCE_IDS.SPIRIT_POWER] = lossAmount;
        }
      }

      this._tribulationAnim = {
        active: true,
        tribulationId: tribulation.id,
        success: false,
        timer: TRIBULATION_ANIM_DURATION,
        maxTimer: TRIBULATION_ANIM_DURATION,
      };

      this.emit('tribulationFail', { tribulationId: tribulation.id });
      this.emit('stateChange');

      return {
        success: false,
        tribulationId: tribulation.id,
        tribulationName: tribulation.name,
        resourcesLost: lost,
        heavenAweGained: 0,
        message: `${tribulation.name}渡劫失败！损失 ${this.formatNumber(lost[RESOURCE_IDS.SPIRIT_POWER] || 0)} 灵力…`,
      };
    }
  }

  /**
   * 计算渡劫成功率
   */
  getTribulationSuccessRate(tribulation: TribulationLevelDef): number {
    let rate = tribulation.successRate;

    // 天威加成（每点天威 +0.1%，最多 +20%）
    const heavenAwe = this.getResource(RESOURCE_IDS.HEAVEN_AWE)?.amount || 0;
    rate += Math.min(heavenAwe * 0.001, 0.2);

    // 声望加成（每点声望 +1%）
    rate += this.prestige.currency * 0.01;

    // 上限 95%
    return Math.min(rate, 0.95);
  }

  /**
   * 检查是否可以尝试渡劫
   */
  canAttemptTribulation(): boolean {
    const tribulation = this.currentTribulation;
    if (!tribulation) return false;
    return this.canAfford(tribulation.cost);
  }

  /**
   * 获取下一天劫信息
   */
  getNextTribulation(): TribulationLevelDef | null {
    return this.currentTribulation;
  }

  /**
   * 检查某个天劫是否已完成
   */
  isTribulationCompleted(tribulationId: string): boolean {
    return this._completedTribulations.has(tribulationId);
  }

  private failResult(tribulationId: string, message: string): TribulationResult {
    return {
      success: false,
      tribulationId,
      tribulationName: '',
      resourcesLost: {},
      heavenAweGained: 0,
      message,
    };
  }

  // ========== 核心逻辑：建筑系统 ==========

  getBuildingCost(buildingId: string): Record<string, number> {
    return this.getUpgradeCost(buildingId);
  }

  purchaseBuilding(buildingId: string): boolean {
    return this.purchaseUpgrade(buildingId);
  }

  buyBuildingByIndex(index: number): boolean {
    if (index < 0 || index >= BUILDINGS.length) return false;
    return this.purchaseBuilding(BUILDINGS[index].id);
  }

  getBuildingLevel(buildingId: string): number {
    const upgrade = this.upgrades.get(buildingId);
    return upgrade ? upgrade.level : 0;
  }

  // ========== 产出计算 ==========

  /**
   * 计算总产出倍率
   */
  getProductionMultiplier(): number {
    let multiplier = 1;

    // 仙池加成（每级 +8% 全资源产出）
    const poolLevel = this.getBuildingLevel(BUILDING_IDS.IMMORTAL_POOL);
    multiplier += poolLevel * 0.08;

    // 已渡天劫加成（每渡一劫 +15%）
    multiplier += this._completedTribulations.size * 0.15;

    // 声望加成
    multiplier += this.prestige.currency * PRESTIGE_MULTIPLIER;

    return multiplier;
  }

  /**
   * 获取实际每秒产出（含加成）
   */
  getEffectiveProduction(resourceId: string): number {
    const resource = this.getResource(resourceId);
    if (!resource) return 0;
    return resource.perSecond * this.getProductionMultiplier();
  }

  // ========== 飞升/声望系统 ==========

  /**
   * 计算飞升可获得的声望数
   */
  calculatePrestigeReward(): number {
    const spirit = this.getResource(RESOURCE_IDS.SPIRIT_POWER);
    if (!spirit || spirit.amount < MIN_PRESTIGE_SPIRIT) return 0;

    let reward = Math.floor(Math.sqrt(spirit.amount / MIN_PRESTIGE_SPIRIT));

    // 天劫加成（每渡一劫额外 +2 声望）
    reward += this._completedTribulations.size * 2;

    return reward;
  }

  /**
   * 执行飞升（声望重置）
   */
  doPrestige(): boolean {
    const reward = this.calculatePrestigeReward();
    if (reward <= 0) return false;

    // 保存需要跨飞升保留的数据
    const prestigeData = {
      currency: this.prestige.currency + reward,
      count: this.prestige.count + 1,
    };
    const totalTribulationsPassed = this._totalTribulationsPassed;

    // 重置游戏
    this.onInit();

    // 恢复声望数据
    this.prestige = prestigeData;
    this._totalTribulationsPassed = totalTribulationsPassed;

    // 重新计算产出
    this.recalculateProduction();

    // 给予初始奖励
    this.addResource(RESOURCE_IDS.SPIRIT_POWER, reward * 10);

    this.emit('prestige', { reward, totalPrestige: prestigeData.currency });
    this.emit('stateChange');
    return true;
  }

  /**
   * 检查是否可以飞升
   */
  canPrestige(): boolean {
    return this.calculatePrestigeReward() > 0;
  }

  // ========== 重新计算产出 ==========

  protected recalculateProduction(): void {
    for (const r of this.resources.values()) {
      r.perSecond = 0;
    }

    for (const building of BUILDINGS) {
      const upgrade = this.upgrades.get(building.id);
      if (upgrade && upgrade.level > 0) {
        const resource = this.resources.get(building.productionResource);
        if (resource) {
          resource.perSecond += building.baseProduction * upgrade.level;
        }
      }
    }
  }

  // ========== 存档系统 ==========

  save(): SaveData {
    const data = super.save();
    data.statistics = {
      currentTribulationIndex: this._currentTribulationIndex,
      totalSpiritEarned: this._totalSpiritEarned,
      totalClicks: this._totalClicks,
      totalTribulationsPassed: this._totalTribulationsPassed,
      selectedBuildingIndex: this._selectedBuildingIndex,
    };
    data.settings = {
      ...data.settings,
      completedTribulations: Array.from(this._completedTribulations),
    };
    return data;
  }

  load(data: SaveData): void {
    super.load(data);
    const stats = data.statistics || {};
    const settings = data.settings || {};

    // 恢复天劫进度
    const savedArr = (settings as Record<string, unknown>).completedTribulations as string[] | undefined;
    this._completedTribulations = new Set(savedArr || []);
    this._currentTribulationIndex = (stats.currentTribulationIndex as number) || 0;
    this._totalSpiritEarned = (stats.totalSpiritEarned as number) || 0;
    this._totalClicks = (stats.totalClicks as number) || 0;
    this._totalTribulationsPassed = (stats.totalTribulationsPassed as number) || 0;
    this._selectedBuildingIndex = (stats.selectedBuildingIndex as number) || 0;

    this.recalculateProduction();
  }

  getState(): TribulationState {
    const base = super.getState();
    return {
      resources: (base.resources as Record<string, { amount: number; unlocked: boolean }>) ?? {},
      upgrades: (base.upgrades as Record<string, number>) ?? {},
      prestige: { ...this.prestige },
      statistics: (base.statistics as Record<string, number>) ?? {},
      completedTribulations: this.completedTribulations,
      currentTribulationIndex: this._currentTribulationIndex,
      totalSpiritEarned: this._totalSpiritEarned,
      totalClicks: this._totalClicks,
      totalTribulationsPassed: this._totalTribulationsPassed,
      selectedBuildingIndex: this._selectedBuildingIndex,
    };
  }

  loadState(state: TribulationState): void {
    if (state.resources) {
      for (const [id, data] of Object.entries(state.resources)) {
        const resource = this.resources.get(id);
        if (resource) {
          resource.amount = data.amount;
          resource.unlocked = data.unlocked;
        }
      }
    }
    if (state.upgrades) {
      for (const [id, value] of Object.entries(state.upgrades)) {
        const upgrade = this.upgrades.get(id);
        if (upgrade) {
          if (typeof value === 'number') {
            upgrade.level = value;
          } else if (value && typeof value === 'object' && 'level' in value) {
            upgrade.level = (value as { level: number }).level;
            if ('unlocked' in value) upgrade.unlocked = (value as { unlocked: boolean }).unlocked;
          }
        }
      }
    }
    if (state.prestige) this.prestige = { ...state.prestige };

    this._completedTribulations = new Set(state.completedTribulations || []);
    this._currentTribulationIndex = state.currentTribulationIndex || 0;
    this._totalSpiritEarned = state.totalSpiritEarned || 0;
    this._totalClicks = state.totalClicks || 0;
    this._totalTribulationsPassed = state.totalTribulationsPassed || 0;
    this._selectedBuildingIndex = state.selectedBuildingIndex || 0;

    this.recalculateProduction();
    this.emit('stateChange');
  }

  // ========== 自动检查 ==========

  private checkBuildingUnlocks(): void {
    for (const building of BUILDINGS) {
      const upgrade = this.upgrades.get(building.id);
      if (upgrade && !upgrade.unlocked) {
        // unlockTribulationIndex === -1 表示初始解锁，已在 onInit 中处理
        if (building.unlockTribulationIndex >= 0) {
          // 需要完成第 N 个天劫才解锁
          const requiredTribulationId = TRIBULATIONS[building.unlockTribulationIndex]?.id;
          if (requiredTribulationId && this._completedTribulations.has(requiredTribulationId)) {
            upgrade.unlocked = true;
            this.emit('buildingUnlocked', building.id);
          }
        }
      }
    }
  }

  private checkResourceUnlocks(): void {
    // 道韵：完成雷劫后解锁
    if (this._completedTribulations.has(TRIBULATION_LEVELS.THUNDER)) {
      const dao = this.getResource(RESOURCE_IDS.DAO_RHYME);
      if (dao && !dao.unlocked) {
        dao.unlocked = true;
        this.emit('resourceUnlocked', RESOURCE_IDS.DAO_RHYME);
      }
    }

    // 天威：完成火劫后解锁
    if (this._completedTribulations.has(TRIBULATION_LEVELS.FIRE)) {
      const awe = this.getResource(RESOURCE_IDS.HEAVEN_AWE);
      if (awe && !awe.unlocked) {
        awe.unlocked = true;
        this.emit('resourceUnlocked', RESOURCE_IDS.HEAVEN_AWE);
      }
    }
  }

  // ========== 动画系统 ==========

  private initSpiritParticles(): void {
    this._spiritParticles = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this._spiritParticles.push({
        x: Math.random() * CANVAS_WIDTH,
        y: 100 + Math.random() * 200,
        speed: PARTICLE_SPEED + Math.random() * 15,
        size: 1 + Math.random() * 2,
        opacity: 0.2 + Math.random() * 0.4,
        angle: Math.random() * Math.PI * 2,
      });
    }
  }

  private updateAnimations(deltaTime: number): void {
    this._animTimer += deltaTime;

    // 点击动画
    if (this._clickAnimTimer > 0) {
      this._clickAnimTimer -= deltaTime;
      if (this._clickAnimTimer <= 0) {
        this._clickScale = 1;
        this._clickAnimTimer = 0;
      } else {
        this._clickScale = 1 + 0.2 * (this._clickAnimTimer / 200);
      }
    }

    // 天劫动画
    if (this._tribulationAnim.active) {
      this._tribulationAnim.timer -= deltaTime;
      if (this._tribulationAnim.timer <= 0) {
        this._tribulationAnim.active = false;
        this._tribulationAnim.timer = 0;
      }
    }

    // 飘字更新
    this._floatingTexts = this._floatingTexts.filter((ft) => {
      ft.life -= deltaTime;
      ft.y -= deltaTime * 0.03;
      return ft.life > 0;
    });

    // 灵力粒子飘动
    for (const p of this._spiritParticles) {
      p.angle += deltaTime * 0.001;
      p.y -= (p.speed * deltaTime) / 1000;
      p.x += Math.sin(p.angle) * 0.3;
      if (p.y < 50) {
        p.y = 300;
        p.x = Math.random() * CANVAS_WIDTH;
      }
    }
  }

  // ========== 渲染 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawMountains(ctx, w);
    this.drawSpiritParticles(ctx);
    this.drawTribulationEffect(ctx, w, h);
    this.drawFloatingTexts(ctx);
    this.drawInfoPanel(ctx, w);
    this.drawTribulationPanel(ctx, w);
    this.drawBuildingList(ctx, w, h);
    this.drawBottomHint(ctx, w, h);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, COLORS.bgGradient1);
    gradient.addColorStop(0.5, COLORS.bgGradient2);
    gradient.addColorStop(1, COLORS.bgGradient1);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // 星辰点缀
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = COLORS.accentWhite;
    for (let i = 0; i < 25; i++) {
      const x = ((i * 73 + 17) % w);
      const y = ((i * 47 + 13) % 160);
      const r = 0.5 + (i % 3) * 0.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawMountains(ctx: CanvasRenderingContext2D, w: number): void {
    const t = this._animTimer / 1000;

    // 远山
    ctx.fillStyle = COLORS.skyPurple;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(0, 260);
    for (let x = 0; x <= w; x += 10) {
      const y = 230 + Math.sin(x * 0.008 + 1) * 25 + Math.sin(x * 0.02) * 10;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, 260);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // 近山
    ctx.fillStyle = COLORS.bgDeep;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, 270);
    for (let x = 0; x <= w; x += 10) {
      const y = 245 + Math.sin(x * 0.012 + 3) * 20 + Math.sin(x * 0.025 + t * 0.1) * 8;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, 270);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private drawSpiritParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this._spiritParticles) {
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = COLORS.spiritColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawTribulationEffect(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this._tribulationAnim.active) return;

    const progress = 1 - this._tribulationAnim.timer / this._tribulationAnim.maxTimer;
    const alpha = (1 - progress) * 0.3;

    if (this._tribulationAnim.success) {
      // 金色光芒
      ctx.globalAlpha = alpha;
      const gradient = ctx.createRadialGradient(w / 2, h / 3, 0, w / 2, h / 3, 200);
      gradient.addColorStop(0, COLORS.accentGold);
      gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    } else {
      // 红色闪烁
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillStyle = COLORS.accentRed;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.globalAlpha = 1;
  }

  private drawFloatingTexts(ctx: CanvasRenderingContext2D): void {
    for (const ft of this._floatingTexts) {
      const alpha = ft.life / ft.maxLife;
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 16px "Segoe UI", sans-serif';
      ctx.fillStyle = ft.color;
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;
  }

  private drawInfoPanel(ctx: CanvasRenderingContext2D, w: number): void {
    // 游戏标题
    ctx.font = 'bold 18px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.accentGold;
    ctx.textAlign = 'center';
    ctx.fillText('渡劫飞升', w / 2, 24);

    // 天劫进度
    const completed = this._completedTribulations.size;
    const total = TRIBULATIONS.length;
    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.accentPurple;
    ctx.fillText(`天劫进度: ${completed}/${total}`, w / 2, 42);

    // 资源显示
    const resources = this.getUnlockedResources();
    const resPerRow = Math.min(resources.length, 3);
    const colWidth = (w - 40) / resPerRow;
    const startX = 20;

    for (let i = 0; i < resources.length; i++) {
      const resource = resources[i];
      const rx = startX + i * colWidth;
      const icon = RESOURCE_ICONS[resource.id] || '';
      const amount = this.formatNumber(resource.amount);
      const effectiveProd = this.getEffectiveProduction(resource.id);

      ctx.textAlign = 'left';
      ctx.font = 'bold 13px "Segoe UI", sans-serif';
      ctx.fillStyle = COLORS.textPrimary;
      ctx.fillText(`${icon} ${amount}`, rx, 62);

      if (effectiveProd > 0) {
        ctx.font = '10px "Segoe UI", sans-serif';
        ctx.fillStyle = COLORS.accentGreen;
        ctx.fillText(`+${this.formatNumber(effectiveProd)}/s`, rx, 76);
      }
    }

    // 点击力量 & 产出倍率
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.textAlign = 'center';
    ctx.fillText(
      `点击: ${this.formatNumber(this.getClickPower())} 灵力 | 倍率: x${this.getProductionMultiplier().toFixed(2)}`,
      w / 2,
      92
    );

    // 声望信息
    if (this.prestige.count > 0) {
      ctx.fillStyle = COLORS.heavenAweColor;
      ctx.fillText(
        `🌟 ${this.formatNumber(this.prestige.currency)} 声望 (飞升 x${this.prestige.count})`,
        w / 2,
        106
      );
    }
  }

  private drawTribulationPanel(ctx: CanvasRenderingContext2D, w: number): void {
    const panelY = 130;

    // 天劫进度框
    ctx.fillStyle = COLORS.panelBg;
    ctx.strokeStyle = COLORS.panelBorder;
    ctx.lineWidth = 1;
    this.roundRect(ctx, 12, panelY, w - 24, 70, 8);
    ctx.fill();
    ctx.stroke();

    if (this.allTribulationsCompleted) {
      // 全部渡过
      ctx.font = 'bold 13px "Segoe UI", sans-serif';
      ctx.fillStyle = COLORS.accentGold;
      ctx.textAlign = 'left';
      ctx.fillText('所有天劫已渡过！', 24, panelY + 20);

      ctx.font = '11px "Segoe UI", sans-serif';
      ctx.fillStyle = COLORS.textSecondary;
      ctx.fillText('按 P 键飞升转生，获得永久声望加成', 24, panelY + 38);

      // 飞升按钮
      const canAscend = this.canPrestige();
      ctx.fillStyle = canAscend ? COLORS.accentGold : COLORS.textDim;
      ctx.font = 'bold 11px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        canAscend ? `[ 飞升 (+${this.calculatePrestigeReward()} 声望) ]` : '[ 灵力不足 ]',
        w / 2,
        panelY + 60
      );
    } else {
      const tribulation = this.currentTribulation;
      if (tribulation) {
        // 当前天劫
        ctx.font = 'bold 13px "Segoe UI", sans-serif';
        ctx.fillStyle = COLORS.tribulationColor;
        ctx.textAlign = 'left';
        ctx.fillText(`${tribulation.icon} ${tribulation.name}`, 24, panelY + 18);

        ctx.font = '11px "Segoe UI", sans-serif';
        ctx.fillStyle = COLORS.textSecondary;
        ctx.fillText(tribulation.description, 24, panelY + 34);

        // 所需资源
        const costEntries = Object.entries(tribulation.cost);
        if (costEntries.length > 0) {
          const costText = costEntries
            .map(([id, amount]) => `${RESOURCE_ICONS[id] || ''}${this.formatNumber(amount)}`)
            .join('  ');
          ctx.fillStyle = this.canAfford(tribulation.cost) ? COLORS.affordable : COLORS.unaffordable;
          ctx.fillText(`需: ${costText}`, 24, panelY + 50);
        }

        // 成功率
        const rate = this.getTribulationSuccessRate(tribulation);
        ctx.fillStyle = COLORS.textDim;
        ctx.textAlign = 'right';
        ctx.fillText(`成功率: ${(rate * 100).toFixed(0)}%`, w - 24, panelY + 50);

        // 渡劫按钮
        const canTrib = this.canAttemptTribulation();
        ctx.fillStyle = canTrib ? COLORS.accentGold : COLORS.textDim;
        ctx.font = 'bold 11px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(canTrib ? '[ 渡劫 ]' : '[ 资源不足 ]', w / 2, panelY + 66);
      }
    }

    // 已渡天劫图标
    const iconY = panelY + 78;
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    let iconX = 20;
    for (const t of TRIBULATIONS) {
      if (this._completedTribulations.has(t.id)) {
        ctx.fillStyle = COLORS.accentGold;
        ctx.fillText(t.icon, iconX, iconY);
      } else {
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = COLORS.textDim;
        ctx.fillText(t.icon, iconX, iconY);
        ctx.globalAlpha = 1;
      }
      iconX += 30;
    }
  }

  private drawBuildingList(ctx: CanvasRenderingContext2D, w: number, _h: number): void {
    const panel = UPGRADE_PANEL;

    // 标题
    ctx.font = 'bold 12px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textSecondary;
    ctx.textAlign = 'center';
    ctx.fillText('— 修炼建筑 —', w / 2, panel.startY - 8);

    let visibleIndex = 0;
    for (let i = 0; i < BUILDINGS.length; i++) {
      const building = BUILDINGS[i];
      const upgrade = this.upgrades.get(building.id);
      if (!upgrade || !upgrade.unlocked) continue;

      const selected = visibleIndex === this._selectedBuildingIndex;
      const cost = this.getBuildingCost(building.id);
      const affordable = this.canAfford(cost);
      const level = upgrade.level;

      const y = panel.startY + visibleIndex * (panel.itemHeight + panel.itemPadding);
      const x = panel.itemMarginX;

      // 背景
      if (selected) {
        ctx.fillStyle = COLORS.selectedBg;
        ctx.strokeStyle = COLORS.selectedBorder;
        ctx.lineWidth = 2;
      } else {
        ctx.fillStyle = COLORS.panelBg;
        ctx.strokeStyle = 'rgba(200, 160, 255, 0.1)';
        ctx.lineWidth = 1;
      }
      this.roundRect(ctx, x, y, panel.itemWidth, panel.itemHeight, 6);
      ctx.fill();
      ctx.stroke();

      // 图标
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(building.icon, x + 8, y + 26);

      // 名称 + 等级
      ctx.font = 'bold 12px "Segoe UI", sans-serif';
      ctx.fillStyle = COLORS.textPrimary;
      ctx.fillText(building.name, x + 34, y + 18);

      ctx.font = '10px "Segoe UI", sans-serif';
      ctx.fillStyle = COLORS.textDim;
      const prodText =
        building.baseProduction > 0
          ? `Lv.${level} (+${this.formatNumber(building.baseProduction * level)}/s)`
          : `Lv.${level} (+${level * 5}%效率)`;
      ctx.fillText(prodText, x + 34, y + 34);

      // 费用
      ctx.font = 'bold 11px "Segoe UI", monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = affordable ? COLORS.affordable : COLORS.unaffordable;
      const costText = Object.entries(cost)
        .map(([id, amount]) => `${RESOURCE_ICONS[id] || ''}${this.formatNumber(amount)}`)
        .join(' ');
      ctx.fillText(costText, x + panel.itemWidth - 8, y + 26);

      visibleIndex++;
    }
  }

  private drawBottomHint(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.font = '10px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.textAlign = 'center';
    ctx.fillText(
      '空格 点击 · T 渡劫 · ↑↓ 选择 · Enter 购买 · P 飞升',
      w / 2,
      h - 8
    );
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
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
      case 't':
      case 'T':
        this.attemptTribulation();
        break;
      case 'p':
      case 'P':
        this.doPrestige();
        break;
      case 'ArrowUp':
        this._selectedBuildingIndex = Math.max(0, this._selectedBuildingIndex - 1);
        this.emit('stateChange');
        break;
      case 'ArrowDown': {
        const visibleCount = BUILDINGS.filter((b) => {
          const u = this.upgrades.get(b.id);
          return u && u.unlocked;
        }).length;
        this._selectedBuildingIndex = Math.min(
          visibleCount - 1,
          this._selectedBuildingIndex + 1
        );
        this.emit('stateChange');
        break;
      }
      case 'Enter': {
        const visibleBuildings = BUILDINGS.filter((b) => {
          const u = this.upgrades.get(b.id);
          return u && u.unlocked;
        });
        if (this._selectedBuildingIndex < visibleBuildings.length) {
          this.buyBuildingByIndex(
            BUILDINGS.indexOf(visibleBuildings[this._selectedBuildingIndex])
          );
        }
        break;
      }
    }
  }

  handleKeyUp(_key: string): void {
    // 不需要处理
  }
}
