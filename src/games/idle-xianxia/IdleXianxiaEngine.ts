/**
 * 挂机修仙·凡人篇 (Idle Xianxia) 放置类游戏引擎
 *
 * 继承 IdleGameEngine，核心玩法：
 * - 点击/打坐获得灵气
 * - 境界修炼 + 突破系统（8大境界）
 * - 修炼建筑（灵气池、灵石矿、炼丹炉、洞府、灵兽园、仙缘阁）
 * - 声望系统（重置获得道韵，永久加成）
 * - 离线收益
 * - 自动存档/读档
 * - 水墨国风画面（黑/白/淡青/金色）
 */
import { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { SaveData } from '@/types/idle';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SPIRIT_PER_CLICK,
  RESOURCE_IDS,
  BUILDING_IDS,
  BUILDINGS,
  REALMS,
  REALM_IDS,
  PRESTIGE_MULTIPLIER,
  MIN_PRESTIGE_SPIRIT,
  COLORS,
  UPGRADE_PANEL,
  RESOURCE_ICONS,
  RESOURCE_NAMES,
  MEDITATION,
  ANIMATION,
  type RealmDef,
  type BuildingDef,
} from './constants';

// ========== 游戏状态接口 ==========

/** 灵气粒子 */
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

/** 云雾粒子 */
interface CloudParticle {
  x: number;
  y: number;
  speed: number;
  width: number;
  opacity: number;
}

/** 场景灵兽 */
interface SceneBeast {
  x: number;
  y: number;
  targetX: number;
  direction: number;
  idle: boolean;
  walkTimer: number;
  type: number; // 0=鹤, 1=鹿, 2=龟
}

/** 突破结果 */
export interface BreakthroughResult {
  success: boolean;
  realmFrom: string;
  realmTo: string;
  resourcesLost: Record<string, number>;
  message: string;
}

/** 游戏完整状态 */
export interface IdleXianxiaState {
  [key: string]: unknown;
  resources: Record<string, { amount: number; unlocked: boolean }>;
  upgrades: Record<string, number>;
  prestige: { currency: number; count: number };
  statistics: Record<string, number>;
  currentRealmIndex: number;
  totalSpiritEarned: number;
  totalClicks: number;
  totalBreakthroughs: number;
  meditationActive: boolean;
  meditationEndTime: number;
  meditationCooldownEnd: number;
  selectedBuildingIndex: number;
}

export class IdleXianxiaEngine extends IdleGameEngine {
  // ========== 游戏状态 ==========

  protected _gameId = 'idle-xianxia';

  /** 当前境界索引 */
  private _currentRealmIndex: number = 0;
  /** 累计灵气获得 */
  private _totalSpiritEarned: number = 0;
  /** 累计点击次数 */
  private _totalClicks: number = 0;
  /** 累计突破次数 */
  private _totalBreakthroughs: number = 0;
  /** 当前选中建筑索引 */
  private _selectedBuildingIndex: number = 0;

  // ========== 打坐状态 ==========

  /** 是否正在打坐 */
  private _meditationActive: boolean = false;
  /** 打坐结束时间 */
  private _meditationEndTime: number = 0;
  /** 打坐冷却结束时间 */
  private _meditationCooldownEnd: number = 0;

  // ========== 动画状态 ==========

  /** 飘字效果列表 */
  private _floatingTexts: FloatingText[] = [];
  /** 灵气粒子 */
  private _spiritParticles: SpiritParticle[] = [];
  /** 云雾粒子 */
  private _cloudParticles: CloudParticle[] = [];
  /** 场景灵兽 */
  private _sceneBeasts: SceneBeast[] = [];
  /** 点击缩放动画 */
  private _clickScale: number = 1;
  /** 点击动画计时器 */
  private _clickAnimTimer: number = 0;
  /** 全局动画计时 */
  private _animTimer: number = 0;
  /** 突破光效计时 */
  private _breakthroughTimer: number = 0;
  /** 突破成功标记 */
  private _breakthroughSuccess: boolean = false;

  // ========== 公开属性 ==========

  get currentRealmIndex(): number {
    return this._currentRealmIndex;
  }

  get currentRealm(): RealmDef {
    return REALMS[this._currentRealmIndex];
  }

  get totalSpiritEarned(): number {
    return this._totalSpiritEarned;
  }

  get totalClicks(): number {
    return this._totalClicks;
  }

  get totalBreakthroughs(): number {
    return this._totalBreakthroughs;
  }

  get meditationActive(): boolean {
    return this._meditationActive;
  }

  get meditationOnCooldown(): boolean {
    return Date.now() < this._meditationCooldownEnd;
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
        id: RESOURCE_IDS.SPIRIT,
        name: '灵气',
        amount: 0,
        perSecond: 0,
        maxAmount: Infinity,
        unlocked: true,
      },
      {
        id: RESOURCE_IDS.STONE,
        name: '灵石',
        amount: 0,
        perSecond: 0,
        maxAmount: Infinity,
        unlocked: false,
      },
      {
        id: RESOURCE_IDS.PILL,
        name: '丹药',
        amount: 0,
        perSecond: 0,
        maxAmount: Infinity,
        unlocked: false,
      },
      {
        id: RESOURCE_IDS.FATE,
        name: '仙缘',
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
        unlocked: b.unlockRealmIndex === 0,
        icon: b.icon,
      }))
    );

    // 重置游戏状态
    this._currentRealmIndex = 0;
    this._totalSpiritEarned = 0;
    this._totalClicks = 0;
    this._totalBreakthroughs = 0;
    this._selectedBuildingIndex = 0;
    this._meditationActive = false;
    this._meditationEndTime = 0;
    this._meditationCooldownEnd = 0;

    // 重置动画状态
    this._floatingTexts = [];
    this._spiritParticles = [];
    this._cloudParticles = [];
    this._sceneBeasts = [];
    this._clickScale = 1;
    this._clickAnimTimer = 0;
    this._animTimer = 0;
    this._breakthroughTimer = 0;
    this._breakthroughSuccess = false;

    // 初始化粒子
    this.initSpiritParticles();
    this.initCloudParticles();
    this.initSceneBeasts();
  }

  protected onStart(): void {
    this.loadFromStorage();
  }

  protected onUpdate(deltaTime: number): void {
    this.updateAnimations(deltaTime);
    this.updateMeditation();
    this.checkBuildingUnlocks();
    this.checkResourceUnlocks();
  }

  // ========== 核心逻辑：点击 ==========

  /**
   * 点击获得灵气
   * @returns 本次获得的灵气数
   */
  click(): number {
    if (this._status !== 'playing') return 0;

    const clickPower = this.getClickPower();
    this.addResource(RESOURCE_IDS.SPIRIT, clickPower);
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
      x: 240 + Math.cos(angle) * dist,
      y: 200 + Math.sin(angle) * dist,
      life: ANIMATION.floatingTextDuration,
      maxLife: ANIMATION.floatingTextDuration,
      color: COLORS.spiritColor,
    });

    this.emit('stateChange');
    return clickPower;
  }

  /**
   * 获取当前点击力量
   */
  getClickPower(): number {
    let power = SPIRIT_PER_CLICK;

    // 洞府加成
    const caveLevel = this.getBuildingLevel(BUILDING_IDS.CAVE_DWELLING);
    power += caveLevel * 0.3;

    // 境界加成（每级 +0.5）
    power += this._currentRealmIndex * 0.5;

    // 声望加成
    power *= 1 + this.prestige.currency * PRESTIGE_MULTIPLIER;

    return power;
  }

  // ========== 核心逻辑：打坐 ==========

  /**
   * 开始打坐（持续获得灵气倍率加成）
   */
  startMeditation(): boolean {
    if (this._status !== 'playing') return false;
    if (this._meditationActive) return false;
    if (this.meditationOnCooldown) return false;

    this._meditationActive = true;
    this._meditationEndTime = Date.now() + MEDITATION.duration;

    this.emit('meditationStart');
    this.emit('stateChange');
    return true;
  }

  /**
   * 更新打坐状态
   */
  private updateMeditation(): void {
    if (!this._meditationActive) return;

    if (Date.now() >= this._meditationEndTime) {
      this._meditationActive = false;
      this._meditationCooldownEnd = Date.now() + MEDITATION.cooldown;
      this.emit('meditationEnd');
    } else {
      // 打坐期间持续产出灵气
      const medProd = this.getClickPower() * MEDITATION.multiplier / 10;
      this.addResource(RESOURCE_IDS.SPIRIT, medProd);
      this._totalSpiritEarned += medProd;
    }
  }

  // ========== 核心逻辑：境界突破 ==========

  /**
   * 尝试突破到下一境界
   */
  attemptBreakthrough(): BreakthroughResult {
    if (this._status !== 'playing') {
      return this.failResult('当前状态不可突破');
    }

    const nextIndex = this._currentRealmIndex + 1;
    if (nextIndex >= REALMS.length) {
      return this.failResult('已达最高境界');
    }

    const nextRealm = REALMS[nextIndex];
    const cost = nextRealm.cost;

    // 检查资源
    if (!this.canAfford(cost)) {
      return this.failResult('资源不足，无法突破');
    }

    // 计算成功率
    const successRate = this.getBreakthroughRate(nextRealm);

    // 扣除资源
    for (const [id, amount] of Object.entries(cost)) {
      this.spendResource(id, amount);
    }

    // 判定成功
    const roll = Math.random();
    if (roll < successRate) {
      // 突破成功
      this._currentRealmIndex = nextIndex;
      this._totalBreakthroughs++;
      this.setLevel(this._currentRealmIndex + 1);

      // 突破光效
      this._breakthroughTimer = ANIMATION.breakthroughDuration;
      this._breakthroughSuccess = true;

      // 突破奖励灵气
      const bonus = Math.floor(nextIndex * 100 * (1 + this.prestige.currency * PRESTIGE_MULTIPLIER));
      this.addResource(RESOURCE_IDS.SPIRIT, bonus);
      this._totalSpiritEarned += bonus;

      this.emit('breakthrough', { success: true, realm: nextRealm.name });
      this.emit('stateChange');

      return {
        success: true,
        realmFrom: REALMS[nextIndex - 1].name,
        realmTo: nextRealm.name,
        resourcesLost: cost,
        message: `突破成功！踏入${nextRealm.name}境！`,
      };
    } else {
      // 突破失败，损失部分灵气
      const lost: Record<string, number> = {};
      const spiritResource = this.getResource(RESOURCE_IDS.SPIRIT);
      if (spiritResource) {
        const lossAmount = Math.floor(spiritResource.amount * nextRealm.failLossRate);
        if (lossAmount > 0) {
          this.spendResource(RESOURCE_IDS.SPIRIT, lossAmount);
          lost[RESOURCE_IDS.SPIRIT] = lossAmount;
        }
      }

      this._breakthroughTimer = ANIMATION.breakthroughDuration;
      this._breakthroughSuccess = false;

      this.emit('breakthrough', { success: false, realm: nextRealm.name });
      this.emit('stateChange');

      return {
        success: false,
        realmFrom: REALMS[this._currentRealmIndex].name,
        realmTo: nextRealm.name,
        resourcesLost: lost,
        message: `突破失败！${nextRealm.name}境机缘未到…`,
      };
    }
  }

  /**
   * 计算突破成功率
   */
  getBreakthroughRate(realm: RealmDef): number {
    let rate = realm.baseSuccessRate;

    // 丹药加成（每颗丹药 +2%，最多 +30%）
    const pillAmount = this.getResource(RESOURCE_IDS.PILL)?.amount || 0;
    const pillBonus = Math.min(pillAmount * 0.02, 0.3);
    rate += pillBonus;

    // 洞府加成（每级 +1%）
    const caveLevel = this.getBuildingLevel(BUILDING_IDS.CAVE_DWELLING);
    rate += caveLevel * 0.01;

    // 声望加成
    rate += this.prestige.currency * PRESTIGE_MULTIPLIER * 0.1;

    // 上限 95%
    return Math.min(rate, 0.95);
  }

  /**
   * 检查是否可以尝试突破
   */
  canAttemptBreakthrough(): boolean {
    const nextIndex = this._currentRealmIndex + 1;
    if (nextIndex >= REALMS.length) return false;
    return this.canAfford(REALMS[nextIndex].cost);
  }

  /**
   * 获取下一境界信息
   */
  getNextRealm(): RealmDef | null {
    const nextIndex = this._currentRealmIndex + 1;
    return nextIndex < REALMS.length ? REALMS[nextIndex] : null;
  }

  private failResult(message: string): BreakthroughResult {
    return {
      success: false,
      realmFrom: this.currentRealm.name,
      realmTo: '',
      resourcesLost: {},
      message,
    };
  }

  // ========== 核心逻辑：建筑 ==========

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

    // 洞府加成
    const caveLevel = this.getBuildingLevel(BUILDING_IDS.CAVE_DWELLING);
    multiplier += caveLevel * 0.05;

    // 灵兽园加成
    const beastLevel = this.getBuildingLevel(BUILDING_IDS.BEAST_GARDEN);
    multiplier += beastLevel * 0.08;

    // 境界加成（每级 +10%）
    multiplier += this._currentRealmIndex * 0.1;

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

  // ========== 声望系统 ==========

  /**
   * 计算声望重置可获得的道韵数
   */
  calculatePrestigeDaoRhyme(): number {
    const spirit = this.getResource(RESOURCE_IDS.SPIRIT);
    if (!spirit || spirit.amount < MIN_PRESTIGE_SPIRIT) return 0;
    return Math.floor(Math.sqrt(spirit.amount / MIN_PRESTIGE_SPIRIT));
  }

  /**
   * 执行声望重置（使用 doPrestige 避免与基类 prestige 属性冲突）
   */
  doPrestige(): boolean {
    const daoRhyme = this.calculatePrestigeDaoRhyme();
    if (daoRhyme <= 0) return false;

    // 保存声望数据
    const prestigeData = { currency: this.prestige.currency + daoRhyme, count: this.prestige.count + 1 };
    const totalBreakthroughs = this._totalBreakthroughs;

    // 重置游戏
    this.onInit();

    // 恢复声望数据
    this.prestige = prestigeData;
    this._totalBreakthroughs = totalBreakthroughs;

    // 重新计算产出
    this.recalculateProduction();

    // 给予初始道韵奖励（以仙缘体现）
    this.addResource(RESOURCE_IDS.FATE, daoRhyme);

    this.emit('prestigeReset', daoRhyme);
    this.emit('stateChange');
    return true;
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
      ...this.statistics,
      totalSpiritEarned: this._totalSpiritEarned,
      totalClicks: this._totalClicks,
      totalBreakthroughs: this._totalBreakthroughs,
      currentRealmIndex: this._currentRealmIndex,
      meditationActive: this._meditationActive ? 1 : 0,
      meditationEndTime: this._meditationEndTime,
      meditationCooldownEnd: this._meditationCooldownEnd,
    };
    return data;
  }

  load(data: SaveData): void {
    super.load(data);
    this._totalSpiritEarned = (data.statistics?.totalSpiritEarned as number) || 0;
    this._totalClicks = (data.statistics?.totalClicks as number) || 0;
    this._totalBreakthroughs = (data.statistics?.totalBreakthroughs as number) || 0;
    this._currentRealmIndex = (data.statistics?.currentRealmIndex as number) || 0;
    this._meditationActive = ((data.statistics?.meditationActive as number) || 0) === 1;
    this._meditationEndTime = (data.statistics?.meditationEndTime as number) || 0;
    this._meditationCooldownEnd = (data.statistics?.meditationCooldownEnd as number) || 0;
    this.setLevel(this._currentRealmIndex + 1);
    this.recalculateProduction();
  }

  getState(): IdleXianxiaState {
    const base = super.getState();
    return {
      resources: (base.resources as Record<string, { amount: number; unlocked: boolean }>) ?? {},
      upgrades: (base.upgrades as Record<string, number>) ?? {},
      prestige: { ...this.prestige },
      statistics: (base.statistics as Record<string, number>) ?? {},
      currentRealmIndex: this._currentRealmIndex,
      totalSpiritEarned: this._totalSpiritEarned,
      totalClicks: this._totalClicks,
      totalBreakthroughs: this._totalBreakthroughs,
      meditationActive: this._meditationActive,
      meditationEndTime: this._meditationEndTime,
      meditationCooldownEnd: this._meditationCooldownEnd,
      selectedBuildingIndex: this._selectedBuildingIndex,
    };
  }

  loadState(state: IdleXianxiaState): void {
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
      for (const [id, level] of Object.entries(state.upgrades)) {
        const upgrade = this.upgrades.get(id);
        if (upgrade) upgrade.level = level;
      }
    }
    if (state.prestige) this.prestige = { ...state.prestige };
    this._currentRealmIndex = state.currentRealmIndex || 0;
    this._totalSpiritEarned = state.totalSpiritEarned || 0;
    this._totalClicks = state.totalClicks || 0;
    this._totalBreakthroughs = state.totalBreakthroughs || 0;
    this._meditationActive = state.meditationActive || false;
    this._meditationEndTime = state.meditationEndTime || 0;
    this._meditationCooldownEnd = state.meditationCooldownEnd || 0;
    this._selectedBuildingIndex = state.selectedBuildingIndex || 0;
    this.setLevel(this._currentRealmIndex + 1);
    this.recalculateProduction();
    this.emit('stateChange');
  }

  // ========== 自动检查 ==========

  private checkBuildingUnlocks(): void {
    for (const building of BUILDINGS) {
      const upgrade = this.upgrades.get(building.id);
      if (upgrade && !upgrade.unlocked) {
        if (this._currentRealmIndex >= building.unlockRealmIndex) {
          upgrade.unlocked = true;
          this.emit('buildingUnlocked', building.id);
        }
      }
    }
  }

  private checkResourceUnlocks(): void {
    // 灵石：筑基后解锁
    if (this._currentRealmIndex >= 1) {
      const stone = this.getResource(RESOURCE_IDS.STONE);
      if (stone && !stone.unlocked) {
        stone.unlocked = true;
        this.emit('resourceUnlocked', RESOURCE_IDS.STONE);
      }
    }

    // 丹药：金丹后解锁
    if (this._currentRealmIndex >= 2) {
      const pill = this.getResource(RESOURCE_IDS.PILL);
      if (pill && !pill.unlocked) {
        pill.unlocked = true;
        this.emit('resourceUnlocked', RESOURCE_IDS.PILL);
      }
    }

    // 仙缘：化神后解锁 或 声望后解锁
    if (this._currentRealmIndex >= 4 || this.prestige.count > 0) {
      const fate = this.getResource(RESOURCE_IDS.FATE);
      if (fate && !fate.unlocked) {
        fate.unlocked = true;
        this.emit('resourceUnlocked', RESOURCE_IDS.FATE);
      }
    }
  }

  // ========== 动画系统 ==========

  private initSpiritParticles(): void {
    this._spiritParticles = [];
    for (let i = 0; i < ANIMATION.spiritParticleCount; i++) {
      this._spiritParticles.push({
        x: Math.random() * CANVAS_WIDTH,
        y: 100 + Math.random() * 200,
        speed: 10 + Math.random() * 20,
        size: 1 + Math.random() * 2,
        opacity: 0.2 + Math.random() * 0.4,
        angle: Math.random() * Math.PI * 2,
      });
    }
  }

  private initCloudParticles(): void {
    this._cloudParticles = [];
    for (let i = 0; i < ANIMATION.cloudCount; i++) {
      this._cloudParticles.push({
        x: Math.random() * CANVAS_WIDTH,
        y: 60 + Math.random() * 120,
        speed: 3 + Math.random() * 8,
        width: 60 + Math.random() * 100,
        opacity: 0.03 + Math.random() * 0.06,
      });
    }
  }

  private initSceneBeasts(): void {
    this._sceneBeasts = [];
    for (let i = 0; i < 2; i++) {
      this._sceneBeasts.push({
        x: 80 + Math.random() * 320,
        y: 210 + Math.random() * 40,
        targetX: 80 + Math.random() * 320,
        direction: Math.random() > 0.5 ? 1 : -1,
        idle: Math.random() > 0.5,
        walkTimer: 0,
        type: i % 3,
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

    // 突破光效
    if (this._breakthroughTimer > 0) {
      this._breakthroughTimer -= deltaTime;
      if (this._breakthroughTimer < 0) this._breakthroughTimer = 0;
    }

    // 飘字更新
    this._floatingTexts = this._floatingTexts.filter((ft) => {
      ft.life -= deltaTime;
      ft.y -= deltaTime * 0.03;
      return ft.life > 0;
    });

    // 灵气粒子飘动
    for (const p of this._spiritParticles) {
      p.angle += deltaTime * 0.001;
      p.y -= (p.speed * deltaTime) / 1000;
      p.x += Math.sin(p.angle) * 0.3;
      if (p.y < 50) {
        p.y = 300;
        p.x = Math.random() * CANVAS_WIDTH;
      }
    }

    // 云雾飘动
    for (const c of this._cloudParticles) {
      c.x += (c.speed * deltaTime) / 1000;
      if (c.x > CANVAS_WIDTH + c.width) {
        c.x = -c.width;
        c.y = 60 + Math.random() * 120;
      }
    }

    // 灵兽行走
    for (const beast of this._sceneBeasts) {
      beast.walkTimer += deltaTime;
      if (beast.idle) {
        if (beast.walkTimer > 3000 + Math.random() * 4000) {
          beast.idle = false;
          beast.walkTimer = 0;
          beast.targetX = 60 + Math.random() * 360;
          beast.direction = beast.targetX > beast.x ? 1 : -1;
        }
      } else {
        const dx = beast.targetX - beast.x;
        const step = (15 * deltaTime) / 1000;
        if (Math.abs(dx) < step) {
          beast.x = beast.targetX;
          beast.idle = true;
          beast.walkTimer = 0;
        } else {
          beast.x += Math.sign(dx) * step;
        }
      }
    }
  }

  // ========== 渲染 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawMountains(ctx, w);
    this.drawClouds(ctx, w);
    this.drawSpiritParticles(ctx);
    this.drawSceneBeasts(ctx);
    this.drawBreakthroughEffect(ctx, w, h);
    this.drawFloatingTexts(ctx);
    this.drawInfoPanel(ctx, w);
    this.drawRealmPanel(ctx, w);
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
    ctx.fillStyle = COLORS.paperWhite;
    for (let i = 0; i < 20; i++) {
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
    ctx.fillStyle = COLORS.mountainFar;
    ctx.beginPath();
    ctx.moveTo(0, 260);
    for (let x = 0; x <= w; x += 10) {
      const y = 230 + Math.sin(x * 0.008 + 1) * 25 + Math.sin(x * 0.02) * 10;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, 260);
    ctx.closePath();
    ctx.fill();

    // 近山
    ctx.fillStyle = COLORS.mountainNear;
    ctx.beginPath();
    ctx.moveTo(0, 270);
    for (let x = 0; x <= w; x += 10) {
      const y = 245 + Math.sin(x * 0.012 + 3) * 20 + Math.sin(x * 0.025 + t * 0.1) * 8;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, 270);
    ctx.closePath();
    ctx.fill();
  }

  private drawClouds(ctx: CanvasRenderingContext2D, _w: number): void {
    for (const cloud of this._cloudParticles) {
      ctx.globalAlpha = cloud.opacity;
      ctx.fillStyle = COLORS.cloudColor;
      ctx.beginPath();
      ctx.ellipse(cloud.x, cloud.y, cloud.width / 2, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawSpiritParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this._spiritParticles) {
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = COLORS.accentCyan;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawSceneBeasts(ctx: CanvasRenderingContext2D): void {
    for (const beast of this._sceneBeasts) {
      this.drawBeast(ctx, beast);
    }
  }

  private drawBeast(ctx: CanvasRenderingContext2D, beast: SceneBeast): void {
    const { x, y, type, idle, direction } = beast;
    ctx.save();
    ctx.translate(x, y);
    if (direction < 0) ctx.scale(-1, 1);

    ctx.globalAlpha = 0.6;
    ctx.fillStyle = COLORS.paperWhite;

    if (type === 0) {
      // 鹤 — 简笔
      ctx.fillRect(-3, -8, 6, 8);
      ctx.fillRect(-6, -12, 12, 4);
      ctx.fillRect(-8, -8, 3, 3);
      ctx.fillRect(5, -8, 3, 3);
      if (!idle) {
        ctx.fillRect(-2, 0, 4, 3);
      }
    } else if (type === 1) {
      // 鹿 — 简笔
      ctx.fillRect(-4, -6, 8, 6);
      ctx.fillRect(-3, -10, 6, 4);
      ctx.fillRect(-5, -14, 2, 5);
      ctx.fillRect(3, -14, 2, 5);
      ctx.fillRect(-3, 0, 2, 3);
      ctx.fillRect(1, 0, 2, 3);
    } else {
      // 龟 — 简笔
      ctx.fillRect(-5, -4, 10, 4);
      ctx.fillRect(-6, -3, 1, 2);
      ctx.fillRect(5, -3, 1, 2);
      ctx.fillRect(-3, 0, 2, 2);
      ctx.fillRect(1, 0, 2, 2);
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private drawBreakthroughEffect(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this._breakthroughTimer <= 0) return;

    const progress = 1 - this._breakthroughTimer / ANIMATION.breakthroughDuration;
    const alpha = (1 - progress) * 0.3;

    if (this._breakthroughSuccess) {
      // 金色光芒
      ctx.globalAlpha = alpha;
      const gradient = ctx.createRadialGradient(w / 2, h / 3, 0, w / 2, h / 3, 200);
      gradient.addColorStop(0, COLORS.accentGold);
      gradient.addColorStop(1, 'rgba(212, 168, 67, 0)');
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
    ctx.fillText('修仙·凡人篇', w / 2, 24);

    // 境界显示
    const realm = this.currentRealm;
    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.accentCyan;
    ctx.fillText(`${realm.name} (${realm.nameEn})`, w / 2, 42);

    // 资源显示
    const resources = this.getUnlockedResources();
    const resPerRow = Math.min(resources.length, 4);
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
    ctx.fillText(`点击: ${this.formatNumber(this.getClickPower())} 灵气 | 倍率: x${this.getProductionMultiplier().toFixed(2)}`, w / 2, 92);

    // 打坐状态
    if (this._meditationActive) {
      ctx.fillStyle = COLORS.accentGold;
      ctx.fillText('🧘 打坐中…', w / 2, 106);
    } else if (this.meditationOnCooldown) {
      const remain = Math.ceil((this._meditationCooldownEnd - Date.now()) / 1000);
      ctx.fillStyle = COLORS.textDim;
      ctx.fillText(`打坐冷却: ${remain}s`, w / 2, 106);
    }

    // 声望信息
    if (this.prestige.count > 0) {
      ctx.fillStyle = COLORS.fateColor;
      ctx.fillText(`🏮 ${this.formatNumber(this.prestige.currency)} 道韵 (x${this.prestige.count})`, w / 2, 120);
    }
  }

  private drawRealmPanel(ctx: CanvasRenderingContext2D, w: number): void {
    const panelY = 130;
    const nextRealm = this.getNextRealm();

    // 境界进度框
    ctx.fillStyle = COLORS.panelBg;
    ctx.strokeStyle = COLORS.panelBorder;
    ctx.lineWidth = 1;
    this.roundRect(ctx, 12, panelY, w - 24, 70, 8);
    ctx.fill();
    ctx.stroke();

    // 当前境界
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.accentCyan;
    ctx.textAlign = 'left';
    ctx.fillText(`当前: ${this.currentRealm.name}境`, 24, panelY + 20);

    // 突破信息
    if (nextRealm) {
      ctx.fillStyle = COLORS.textSecondary;
      ctx.font = '11px "Segoe UI", sans-serif';
      ctx.fillText(`→ ${nextRealm.name}境 (${nextRealm.nameEn})`, 24, panelY + 36);

      // 所需资源
      const costEntries = Object.entries(nextRealm.cost);
      if (costEntries.length > 0) {
        const costText = costEntries
          .map(([id, amount]) => `${RESOURCE_ICONS[id] || ''}${this.formatNumber(amount)}`)
          .join('  ');
        ctx.fillStyle = this.canAfford(nextRealm.cost) ? COLORS.affordable : COLORS.unaffordable;
        ctx.fillText(`需: ${costText}`, 24, panelY + 52);
      }

      // 成功率
      const rate = this.getBreakthroughRate(nextRealm);
      ctx.fillStyle = COLORS.textDim;
      ctx.textAlign = 'right';
      ctx.fillText(`成功率: ${(rate * 100).toFixed(0)}%`, w - 24, panelY + 52);

      // 突破按钮
      const canBreak = this.canAttemptBreakthrough();
      ctx.fillStyle = canBreak ? COLORS.accentGold : COLORS.inkGray;
      ctx.font = 'bold 11px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(canBreak ? '[ 突破 ]' : '[ 资源不足 ]', w / 2, panelY + 66);
    } else {
      ctx.fillStyle = COLORS.accentGold;
      ctx.font = 'bold 12px "Segoe UI", sans-serif';
      ctx.fillText('已臻至大乘圆满！', 24, panelY + 40);
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
        ctx.strokeStyle = 'rgba(126, 200, 200, 0.1)';
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
      const prodText = building.baseProduction > 0
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
    ctx.fillText('空格 点击 · M 打坐 · B 突破 · ↑↓ 选择 · Enter 购买 · P 声望', w / 2, h - 8);
  }

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
      case 'm':
      case 'M':
        this.startMeditation();
        break;
      case 'b':
      case 'B':
        this.attemptBreakthrough();
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
        this._selectedBuildingIndex = Math.min(visibleCount - 1, this._selectedBuildingIndex + 1);
        this.emit('stateChange');
        break;
      }
      case 'Enter': {
        const visibleBuildings = BUILDINGS.filter((b) => {
          const u = this.upgrades.get(b.id);
          return u && u.unlocked;
        });
        if (this._selectedBuildingIndex < visibleBuildings.length) {
          this.buyBuildingByIndex(BUILDINGS.indexOf(visibleBuildings[this._selectedBuildingIndex]));
        }
        break;
      }
    }
  }

  handleKeyUp(_key: string): void {
    // 不需要处理
  }
}
