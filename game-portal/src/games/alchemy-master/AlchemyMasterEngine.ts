/**
 * Alchemy Master（炼丹大师）放置类游戏引擎
 *
 * 继承 IdleGameEngine，核心玩法：
 * - 点击/空格键获得灵药
 * - 6种灵药田（百草园、灵泉、药王谷、丹炉、丹房、丹道阁）
 * - 6种丹方（消耗灵药炼制丹药和丹气）
 * - 8种境界（根据丹药数量自动提升）
 * - 声望系统（重置获得丹道，永久加成）
 * - 离线收益
 * - 自动存档/读档
 * - 场景动画：丹炉炼丹烟雾效果
 */
import { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { SaveData } from '@/types/idle';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  HERB_PER_CLICK,
  RESOURCE_IDS,
  FIELD_IDS,
  FIELDS,
  RECIPE_IDS,
  RECIPES,
  REALMS,
  REALM_IDS,
  PRESTIGE_MULTIPLIER,
  MIN_PRESTIGE_PILLS,
  COLORS,
  UPGRADE_PANEL,
  RESOURCE_ICONS,
  RESOURCE_NAMES,
  FLOATING_TEXT_DURATION,
  MAX_SMOKE_PARTICLES,
  SMOKE_RISE_SPEED,
  HERB_PARTICLE_COUNT,
  ANIMATION,
  FURNACE_DRAW,
  type FieldDef,
  type RecipeDef,
  type RealmDef,
} from './constants';

// ========== 游戏状态接口 ==========

/** 烟雾粒子（动画用） */
interface SmokeParticle {
  x: number;
  y: number;
  size: number;
  opacity: number;
  speed: number;
  life: number;
  maxLife: number;
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

/** 灵药粒子（背景装饰） */
interface HerbParticle {
  x: number;
  y: number;
  size: number;
  opacity: number;
  color: string;
}

/** 游戏完整状态 */
export interface AlchemyMasterState {
  [key: string]: unknown;
  resources: Record<string, { amount: number; unlocked: boolean }>;
  upgrades: Record<string, number>;
  prestige: { currency: number; count: number };
  statistics: Record<string, number>;
  totalHerbsEarned: number;
  totalClicks: number;
  totalPillsCrafted: number;
  currentRealmIndex: number;
  selectedFieldIndex: number;
  recipeCooldowns: Record<string, number>;
}

export class AlchemyMasterEngine extends IdleGameEngine {
  // ========== 游戏状态 ==========

  protected _gameId = 'alchemy-master';

  constructor() {
    super();
    // Override base class `statistics` instance field with a getter/setter,
    // because class fields shadow prototype accessors.
    Object.defineProperty(this, 'statistics', {
      get: () => ({ ...this._stats }),
      set: (_val: Record<string, number>) => { /* base class writes are no-ops */ },
      configurable: true,
      enumerable: true,
    });
  }

  /** 统计数据 */
  private _stats: Record<string, number> = {
    totalHerbsEarned: 0,
    totalClicks: 0,
    totalPillsCrafted: 0,
    currentRealmIndex: 0,
    selectedFieldIndex: 0,
  };

  /** 累计灵药获得 */
  private _totalHerbsEarned: number = 0;
  /** 累计点击次数 */
  private _totalClicks: number = 0;
  /** 累计炼制丹药次数 */
  private _totalPillsCrafted: number = 0;
  /** 当前境界索引 */
  private _currentRealmIndex: number = 0;
  /** 当前选中灵药田索引 */
  private _selectedFieldIndex: number = 0;
  /** 丹方冷却列表 */
  private _recipeCooldowns: Map<string, number> = new Map();

  // ========== 动画状态 ==========

  /** 飘字效果列表 */
  private _floatingTexts: FloatingText[] = [];
  /** 烟雾粒子列表 */
  private _smokeParticles: SmokeParticle[] = [];
  /** 灵药粒子 */
  private _herbParticles: HerbParticle[] = [];
  /** 点击缩放动画 */
  private _clickScale: number = 1;
  /** 点击动画计时器 */
  private _clickAnimTimer: number = 0;
  /** 背景动画计时 */
  private _bgAnimTimer: number = 0;
  /** 丹炉火焰动画计时 */
  private _flameTimer: number = 0;

  // ========== 公开属性 ==========

  get totalHerbsEarned(): number {
    return this._totalHerbsEarned;
  }

  get totalClicks(): number {
    return this._totalClicks;
  }

  get totalPillsCrafted(): number {
    return this._totalPillsCrafted;
  }

  get currentRealmIndex(): number {
    return this._currentRealmIndex;
  }

  get selectedFieldIndex(): number {
    return this._selectedFieldIndex;
  }

  // ========== 生命周期 ==========

  protected onInit(): void {
    super.onInit();

    // 初始化资源（4种：灵药、丹气、丹药、丹道）
    this.initializeResources([
      {
        id: RESOURCE_IDS.HERB,
        name: '灵药',
        amount: 0,
        perSecond: 0,
        maxAmount: Number.MAX_SAFE_INTEGER,
        unlocked: true,
      },
      {
        id: RESOURCE_IDS.PILL_ENERGY,
        name: '丹气',
        amount: 0,
        perSecond: 0,
        maxAmount: Number.MAX_SAFE_INTEGER,
        unlocked: false,
      },
      {
        id: RESOURCE_IDS.PILL,
        name: '丹药',
        amount: 0,
        perSecond: 0,
        maxAmount: Number.MAX_SAFE_INTEGER,
        unlocked: false,
      },
      {
        id: RESOURCE_IDS.ALCHEMY_WAY,
        name: '丹道',
        amount: 0,
        perSecond: 0,
        maxAmount: Number.MAX_SAFE_INTEGER,
        unlocked: false,
      },
    ]);

    // 初始化灵药田（6种）
    this.initializeUpgrades(
      FIELDS.map((f) => ({
        id: f.id,
        name: f.name,
        description: f.description,
        baseCost: f.baseCost,
        costMultiplier: f.costMultiplier,
        level: 0,
        maxLevel: f.maxLevel,
        effect: {
          type: 'add_production' as const,
          target: f.productionResource,
          value: f.baseProduction,
        },
        unlocked: !f.unlockCondition,
        icon: f.icon,
      }))
    );

    // 重置状态
    this._totalHerbsEarned = 0;
    this._totalClicks = 0;
    this._totalPillsCrafted = 0;
    this._currentRealmIndex = 0;
    this._selectedFieldIndex = 0;
    this._recipeCooldowns = new Map();
    this._stats = {
      totalHerbsEarned: 0,
      totalClicks: 0,
      totalPillsCrafted: 0,
      currentRealmIndex: 0,
      selectedFieldIndex: 0,
    };

    // 重置动画状态
    this._floatingTexts = [];
    this._smokeParticles = [];
    this._herbParticles = [];
    this._clickScale = 1;
    this._clickAnimTimer = 0;
    this._bgAnimTimer = 0;
    this._flameTimer = 0;

    // 初始化灵药粒子
    this.initHerbParticles();
  }

  protected onStart(): void {
    this.loadFromStorage();
  }

  protected onUpdate(deltaTime: number): void {
    this.updateAnimations(deltaTime);
    this.updateCooldowns(deltaTime);
    this.checkFieldUnlocks();
    this.checkResourceUnlocks();
    this.checkRealmUpgrade();
  }

  // ========== 核心逻辑：点击 ==========

  /**
   * 点击获得灵药
   * @returns 本次获得的灵药数
   */
  click(): number {
    if (this._status !== 'playing') return 0;

    const clickPower = this.getClickPower();
    this.addResource(RESOURCE_IDS.HERB, clickPower);
    this._totalHerbsEarned += clickPower;
    this._totalClicks++;
    this.addScore(clickPower);

    // 触发点击动画
    this._clickScale = 1.2;
    this._clickAnimTimer = 200;

    // 飘字效果
    const angle = Math.random() * Math.PI * 2;
    const dist = 50 + Math.random() * 30;
    this._floatingTexts.push({
      text: `+${this.formatNumber(clickPower)}`,
      x: 240 + Math.cos(angle) * dist,
      y: 180 + Math.sin(angle) * dist,
      life: FLOATING_TEXT_DURATION,
      maxLife: FLOATING_TEXT_DURATION,
      color: COLORS.herbColor,
    });

    this.emit('stateChange');
    return clickPower;
  }

  /**
   * 获取当前点击力量
   */
  getClickPower(): number {
    let power = HERB_PER_CLICK;

    // 境界加成
    const realm = REALMS[this._currentRealmIndex];
    power *= realm.productionMultiplier;

    // 声望加成
    power *= 1 + this.prestige.currency * PRESTIGE_MULTIPLIER;

    return power;
  }

  // ========== 核心逻辑：灵药田 ==========

  /**
   * 获取灵药田当前费用
   */
  getFieldCost(fieldId: string): Record<string, number> {
    return this.getUpgradeCost(fieldId);
  }

  /**
   * 购买灵药田
   */
  purchaseField(fieldId: string): boolean {
    const cost = this.getFieldCost(fieldId);
    if (!this.canAfford(cost)) return false;

    const upgrade = this.upgrades.get(fieldId);
    if (!upgrade || !upgrade.unlocked) return false;
    if (upgrade.level >= upgrade.maxLevel) return false;

    // 扣除资源
    for (const [resId, amount] of Object.entries(cost)) {
      this.spendResource(resId, amount);
    }

    upgrade.level++;
    this.recalculateProduction();
    this.emit('upgradePurchased', fieldId, upgrade.level);
    this.emit('stateChange');
    return true;
  }

  /**
   * 通过索引购买灵药田
   */
  buyFieldByIndex(index: number): boolean {
    if (index < 0 || index >= FIELDS.length) return false;
    return this.purchaseField(FIELDS[index].id);
  }

  /**
   * 获取灵药田等级
   */
  getFieldLevel(fieldId: string): number {
    const upgrade = this.upgrades.get(fieldId);
    return upgrade ? upgrade.level : 0;
  }

  // ========== 核心逻辑：炼丹 ==========

  /**
   * 炼制丹药
   * @param recipeId 丹方 ID
   * @returns 是否成功炼制
   */
  craftPill(recipeId: string): boolean {
    if (this._status !== 'playing') return false;

    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) return false;

    // 检查冷却
    const cooldown = this._recipeCooldowns.get(recipeId);
    if (cooldown && cooldown > 0) return false;

    // 检查境界
    const requiredRealmIndex = REALMS.findIndex(r => r.id === recipe.realmRequired);
    if (this._currentRealmIndex < requiredRealmIndex) return false;

    // 检查资源
    if (!this.canAfford(recipe.cost)) return false;

    // 扣除资源
    for (const [resId, amount] of Object.entries(recipe.cost)) {
      this.spendResource(resId, amount);
    }

    // 设置冷却
    this._recipeCooldowns.set(recipeId, recipe.cooldown);

    // 产出丹药和丹气
    this.addResource(RESOURCE_IDS.PILL, recipe.pillYield);
    this.addResource(RESOURCE_IDS.PILL_ENERGY, recipe.energyYield);

    this._totalPillsCrafted++;

    // 烟雾效果
    for (let i = 0; i < 5; i++) {
      this.addSmokeParticle();
    }

    // 飘字
    this._floatingTexts.push({
      text: `✓ ${recipe.name} +${recipe.pillYield} 丹药 +${recipe.energyYield} 丹气`,
      x: 240 + (Math.random() - 0.5) * 60,
      y: 150,
      life: FLOATING_TEXT_DURATION,
      maxLife: FLOATING_TEXT_DURATION,
      color: COLORS.pillColor,
    });

    this.emit('pillCrafted', recipeId, recipe.pillYield);
    this.emit('stateChange');
    return true;
  }

  /**
   * 检查是否可以炼制某种丹药
   */
  canCraft(recipeId: string): boolean {
    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) return false;

    // 检查冷却
    const cooldown = this._recipeCooldowns.get(recipeId);
    if (cooldown && cooldown > 0) return false;

    // 检查境界
    const requiredRealmIndex = REALMS.findIndex(r => r.id === recipe.realmRequired);
    if (this._currentRealmIndex < requiredRealmIndex) return false;

    // 检查资源
    return this.canAfford(recipe.cost);
  }

  /**
   * 获取丹方冷却剩余时间
   */
  getRecipeCooldown(recipeId: string): number {
    return this._recipeCooldowns.get(recipeId) || 0;
  }

  // ========== 境界系统 ==========

  /**
   * 获取当前境界定义
   */
  getCurrentRealm(): RealmDef {
    return REALMS[this._currentRealmIndex];
  }

  /**
   * 获取当前境界名称
   */
  getCurrentRealmName(): string {
    return REALMS[this._currentRealmIndex].name;
  }

  /**
   * 获取下一个境界
   */
  getNextRealm(): RealmDef | null {
    if (this._currentRealmIndex >= REALMS.length - 1) return null;
    return REALMS[this._currentRealmIndex + 1];
  }

  /**
   * 检查并提升境界
   */
  private checkRealmUpgrade(): void {
    const pillResource = this.getResource(RESOURCE_IDS.PILL);
    if (!pillResource) return;

    const pillAmount = pillResource.amount;

    // 从当前境界的下一个开始检查
    for (let i = this._currentRealmIndex + 1; i < REALMS.length; i++) {
      if (pillAmount >= REALMS[i].requiredPills) {
        this._currentRealmIndex = i;
        this.emit('realmUpgraded', REALMS[i].id);
      } else {
        break;
      }
    }
  }

  // ========== 产出系统 ==========

  /**
   * 计算总产出倍率
   */
  getProductionMultiplier(): number {
    let multiplier = 1;

    // 境界加成
    const realm = REALMS[this._currentRealmIndex];
    multiplier = realm.productionMultiplier;

    // 声望加成
    multiplier += this.prestige.currency * PRESTIGE_MULTIPLIER;

    return multiplier;
  }

  /**
   * 获取资源倍率（与产出倍率相同）
   */
  getResourceMultiplier(_resourceId: string): number {
    return this.getProductionMultiplier();
  }

  /**
   * 获取实际每秒产出（含加成）
   */
  getEffectiveProduction(resourceId: string): number {
    const resource = this.getResource(resourceId);
    if (!resource) return 0;
    const baseProd = resource.perSecond;
    const multiplier = this.getProductionMultiplier();
    return baseProd * multiplier;
  }

  // ========== 声望（传承）系统 ==========

  /**
   * 计算转生可获得的丹道精华数
   */
  calculatePrestigeEssence(): number {
    const pill = this.getResource(RESOURCE_IDS.PILL);
    if (!pill || pill.amount < MIN_PRESTIGE_PILLS) return 0;
    return Math.floor(Math.sqrt(pill.amount / MIN_PRESTIGE_PILLS));
  }

  /**
   * 执行转生重置
   */
  doPrestige(): boolean {
    const essence = this.calculatePrestigeEssence();
    if (essence <= 0) return false;

    // 保存声望数据
    const prestigeData = { currency: this.prestige.currency + essence, count: this.prestige.count + 1 };

    // 重置游戏
    this.onInit();

    // 恢复声望数据
    this.prestige = prestigeData;

    // 重新计算产出
    this.recalculateProduction();

    // 给予丹道
    this.addResource(RESOURCE_IDS.ALCHEMY_WAY, essence);

    this.emit('prestigeReset', essence);
    this.emit('stateChange');
    return true;
  }

  // ========== 重新计算产出 ==========

  protected recalculateProduction(): void {
    // 先重置所有 perSecond 为 0
    for (const r of this.resources.values()) {
      r.perSecond = 0;
    }

    // 根据灵药田等级重新计算基础产出
    for (const field of FIELDS) {
      const upgrade = this.upgrades.get(field.id);
      if (upgrade && upgrade.level > 0) {
        const resource = this.resources.get(field.productionResource);
        if (resource) {
          resource.perSecond += field.baseProduction * upgrade.level;
        }
      }
    }
  }

  // ========== 存档系统 ==========

  save(): SaveData {
    const data = super.save();

    // 附加统计数据
    data.statistics = {
      ...this._stats,
      totalHerbsEarned: this._totalHerbsEarned,
      totalClicks: this._totalClicks,
      totalPillsCrafted: this._totalPillsCrafted,
      currentRealmIndex: this._currentRealmIndex,
      selectedFieldIndex: this._selectedFieldIndex,
      recipeCooldowns: JSON.stringify(Array.from(this._recipeCooldowns.entries())) as any,
    };

    return data;
  }

  load(data: SaveData): void {
    super.load(data);

    // 恢复统计
    this._totalHerbsEarned = (data.statistics?.totalHerbsEarned as number) || 0;
    this._totalClicks = (data.statistics?.totalClicks as number) || 0;
    this._totalPillsCrafted = (data.statistics?.totalPillsCrafted as number) || 0;
    this._currentRealmIndex = (data.statistics?.currentRealmIndex as number) || 0;
    this._selectedFieldIndex = (data.statistics?.selectedFieldIndex as number) || 0;

    // 同步到 _stats
    this._stats = {
      totalHerbsEarned: this._totalHerbsEarned,
      totalClicks: this._totalClicks,
      totalPillsCrafted: this._totalPillsCrafted,
      currentRealmIndex: this._currentRealmIndex,
      selectedFieldIndex: this._selectedFieldIndex,
    };

    // 恢复冷却
    const savedCooldowns = data.statistics?.recipeCooldowns;
    if (typeof savedCooldowns === 'string') {
      try {
        const entries = JSON.parse(savedCooldowns) as [string, number][];
        this._recipeCooldowns = new Map(entries);
      } catch {
        this._recipeCooldowns = new Map();
      }
    }

    // 重新计算产出
    this.recalculateProduction();
  }

  getState(): AlchemyMasterState {
    const baseState = super.getState();

    return {
      ...baseState,
      totalHerbsEarned: this._totalHerbsEarned,
      totalClicks: this._totalClicks,
      totalPillsCrafted: this._totalPillsCrafted,
      currentRealmIndex: this._currentRealmIndex,
      selectedFieldIndex: this._selectedFieldIndex,
      recipeCooldowns: Object.fromEntries(this._recipeCooldowns),
      prestige: { ...this.prestige },
    } as AlchemyMasterState;
  }

  /**
   * 从状态恢复
   */
  loadState(state: AlchemyMasterState): void {
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

    // 恢复灵药田等级
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

    // 恢复声望
    if (state.prestige) {
      this.prestige = { ...state.prestige };
    }

    // 恢复统计
    this._totalHerbsEarned = state.totalHerbsEarned || 0;
    this._totalClicks = state.totalClicks || 0;
    this._totalPillsCrafted = state.totalPillsCrafted || 0;
    this._currentRealmIndex = state.currentRealmIndex || 0;
    this._selectedFieldIndex = state.selectedFieldIndex || 0;

    // 恢复冷却
    if (state.recipeCooldowns) {
      this._recipeCooldowns = new Map(Object.entries(state.recipeCooldowns));
    }

    this.recalculateProduction();
    this.emit('stateChange');
  }

  // ========== 自动检查 ==========

  private checkFieldUnlocks(): void {
    for (const field of FIELDS) {
      if (field.unlockCondition) {
        const upgrade = this.upgrades.get(field.id);
        if (upgrade && !upgrade.unlocked) {
          let met = true;
          for (const [reqId, reqLevel] of Object.entries(field.unlockCondition)) {
            const req = this.upgrades.get(reqId);
            if (!req || req.level < reqLevel) {
              met = false;
              break;
            }
          }
          if (met) {
            upgrade.unlocked = true;
            this.emit('fieldUnlocked', field.id);
          }
        }
      }
    }
  }

  private checkResourceUnlocks(): void {
    // 丹气：灵药达到 50 时解锁
    const herb = this.getResource(RESOURCE_IDS.HERB);
    if (herb && herb.amount >= 50) {
      const energy = this.getResource(RESOURCE_IDS.PILL_ENERGY);
      if (energy && !energy.unlocked) {
        energy.unlocked = true;
        this.emit('resourceUnlocked', RESOURCE_IDS.PILL_ENERGY);
      }
    }

    // 丹药：丹气达到 20 时解锁
    const energy = this.getResource(RESOURCE_IDS.PILL_ENERGY);
    if (energy && energy.amount >= 20) {
      const pill = this.getResource(RESOURCE_IDS.PILL);
      if (pill && !pill.unlocked) {
        pill.unlocked = true;
        this.emit('resourceUnlocked', RESOURCE_IDS.PILL);
      }
    }

    // 丹道：声望后解锁
    if (this.prestige.count > 0) {
      const alchemyWay = this.getResource(RESOURCE_IDS.ALCHEMY_WAY);
      if (alchemyWay && !alchemyWay.unlocked) {
        alchemyWay.unlocked = true;
      }
    }
  }

  // ========== 冷却更新 ==========

  private updateCooldowns(deltaTime: number): void {
    for (const [recipeId, remaining] of this._recipeCooldowns) {
      const newRemaining = remaining - deltaTime;
      if (newRemaining <= 0) {
        this._recipeCooldowns.delete(recipeId);
      } else {
        this._recipeCooldowns.set(recipeId, newRemaining);
      }
    }
  }

  // ========== 动画系统 ==========

  private initHerbParticles(): void {
    this._herbParticles = [];
    const herbColors = ANIMATION.herbParticleColors;
    for (let i = 0; i < HERB_PARTICLE_COUNT; i++) {
      this._herbParticles.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        size: 1 + Math.random() * 3,
        opacity: 0.15 + Math.random() * 0.25,
        color: herbColors[Math.floor(Math.random() * herbColors.length)],
      });
    }
  }

  private addSmokeParticle(): void {
    if (this._smokeParticles.length >= MAX_SMOKE_PARTICLES) return;
    this._smokeParticles.push({
      x: 220 + Math.random() * 40,
      y: 150,
      size: 5 + Math.random() * 10,
      opacity: 0.5 + Math.random() * 0.3,
      speed: SMOKE_RISE_SPEED + Math.random() * 10,
      life: 2000,
      maxLife: 2000,
    });
  }

  private updateAnimations(deltaTime: number): void {
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

    // 飘字更新
    this._floatingTexts = this._floatingTexts.filter((ft) => {
      ft.life -= deltaTime;
      ft.y -= deltaTime * 0.03;
      return ft.life > 0;
    });

    // 烟雾更新
    this._smokeParticles = this._smokeParticles.filter((sp) => {
      sp.life -= deltaTime;
      sp.y -= (sp.speed * deltaTime) / 1000;
      sp.opacity = 0.5 * (sp.life / sp.maxLife);
      sp.size += deltaTime * 0.005;
      return sp.life > 0;
    });

    // 背景动画
    this._bgAnimTimer += deltaTime;
    this._flameTimer += deltaTime;
  }

  // ========== 渲染 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawHerbParticles(ctx);
    this.drawFurnace(ctx, w);
    this.drawSmokeParticles(ctx);
    this.drawFloatingTexts(ctx);
    this.drawInfoPanel(ctx, w);
    this.drawFieldList(ctx, w, h);
    this.drawBottomHint(ctx, w, h);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#0d0a05');
    gradient.addColorStop(0.3, COLORS.bgGradient1);
    gradient.addColorStop(1, COLORS.bgGradient2);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // 顶部装饰线
    ctx.fillStyle = COLORS.accentBrown;
    ctx.fillRect(0, 0, w, 3);

    // 装饰花纹
    ctx.strokeStyle = COLORS.accentGold;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.2;
    const t = this._bgAnimTimer / 1000;
    for (let i = 0; i < 15; i++) {
      const gx = i * 35 + 10;
      const sway = Math.sin(t + i * 0.7) * 4;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.quadraticCurveTo(gx + sway, 8, gx + sway * 2, 3);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawHerbParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this._herbParticles) {
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawFurnace(ctx: CanvasRenderingContext2D, _w: number): void {
    const cx = FURNACE_DRAW.centerX;
    const cy = FURNACE_DRAW.centerY;
    const size = 30 * this._clickScale;

    ctx.save();
    ctx.translate(cx, cy);

    // 丹炉身体
    ctx.fillStyle = '#8b4513';
    ctx.beginPath();
    ctx.ellipse(0, size * 0.2, size * 0.8, size * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // 丹炉盖子
    ctx.fillStyle = '#a0522d';
    ctx.beginPath();
    ctx.ellipse(0, -size * 0.3, size * 0.6, size * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    // 炉顶装饰
    ctx.fillStyle = COLORS.accentGold;
    ctx.beginPath();
    ctx.arc(0, -size * 0.5, size * 0.12, 0, Math.PI * 2);
    ctx.fill();

    // 火焰效果
    const flamePhase = Math.sin(this._flameTimer / 200) * 3;
    ctx.fillStyle = COLORS.furnaceColor;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(-size * 0.3, size * 0.6);
    ctx.quadraticCurveTo(-size * 0.1, size * 0.9 + flamePhase, 0, size * 0.7);
    ctx.quadraticCurveTo(size * 0.1, size * 0.9 - flamePhase, size * 0.3, size * 0.6);
    ctx.fill();

    // 内焰
    ctx.fillStyle = '#ffeb3b';
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(-size * 0.15, size * 0.6);
    ctx.quadraticCurveTo(0, size * 0.8 + flamePhase * 0.5, size * 0.15, size * 0.6);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private drawSmokeParticles(ctx: CanvasRenderingContext2D): void {
    for (const sp of this._smokeParticles) {
      ctx.globalAlpha = sp.opacity;
      ctx.fillStyle = COLORS.smokeColor;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
      ctx.fill();
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
    ctx.font = 'bold 20px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.accentGold;
    ctx.textAlign = 'center';
    ctx.fillText('🔥 炼丹大师', w / 2, 28);

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
      ctx.font = 'bold 14px "Segoe UI", sans-serif';
      ctx.fillStyle = COLORS.textPrimary;
      ctx.fillText(`${icon} ${amount}`, rx, 52);

      if (effectiveProd > 0) {
        ctx.font = '11px "Segoe UI", sans-serif';
        ctx.fillStyle = COLORS.accentGreen;
        ctx.fillText(`+${this.formatNumber(effectiveProd)}/s`, rx, 66);
      }
    }

    // 点击力量 & 产出倍率
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.textAlign = 'center';
    ctx.fillText(`点击: ${this.formatNumber(this.getClickPower())} 灵药 | 倍率: x${this.getProductionMultiplier().toFixed(2)}`, w / 2, 82);

    // 境界信息
    const realm = REALMS[this._currentRealmIndex];
    ctx.fillText(`境界: ${realm.icon} ${realm.name}`, w / 2, 96);

    // 声望信息
    if (this.prestige.count > 0) {
      ctx.fillStyle = COLORS.alchemyWayColor;
      ctx.fillText(`☯️ ${this.formatNumber(this.prestige.currency)} 丹道传承 x${this.prestige.count}`, w / 2, 110);
    }
  }

  private drawFieldList(ctx: CanvasRenderingContext2D, w: number, _h: number): void {
    const panel = UPGRADE_PANEL;

    // 标题
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textSecondary;
    ctx.textAlign = 'center';
    ctx.fillText('— 灵药田 —', w / 2, panel.startY - 10);

    let visibleIndex = 0;
    for (let i = 0; i < FIELDS.length; i++) {
      const field = FIELDS[i];
      const upgrade = this.upgrades.get(field.id);
      if (!upgrade || !upgrade.unlocked) continue;

      const selected = visibleIndex === this._selectedFieldIndex;
      const cost = this.getFieldCost(field.id);
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
        ctx.strokeStyle = 'rgba(200,144,80,0.1)';
        ctx.lineWidth = 1;
      }
      this.roundRect(ctx, x, y, panel.itemWidth, panel.itemHeight, 8);
      ctx.fill();
      ctx.stroke();

      // 图标
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(field.icon, x + 10, y + 30);

      // 名称 + 等级
      ctx.font = 'bold 13px "Segoe UI", sans-serif';
      ctx.fillStyle = COLORS.textPrimary;
      ctx.fillText(field.name, x + 40, y + 20);

      ctx.font = '10px "Segoe UI", sans-serif';
      ctx.fillStyle = COLORS.textDim;
      const prodText = field.baseProduction > 0
        ? `Lv.${level} (+${this.formatNumber(field.baseProduction * level)}/s)`
        : `Lv.${level}`;
      ctx.fillText(prodText, x + 40, y + 36);

      // 费用
      ctx.font = 'bold 12px "Segoe UI", monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = affordable ? COLORS.affordable : COLORS.unaffordable;
      const costText = Object.entries(cost)
        .map(([id, amount]) => `${RESOURCE_ICONS[id] || ''}${this.formatNumber(amount)}`)
        .join(' ');
      ctx.fillText(costText, x + panel.itemWidth - 10, y + 30);

      visibleIndex++;
    }
  }

  private drawBottomHint(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.font = '10px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.textAlign = 'center';
    ctx.fillText('空格 点击 · ↑↓ 选择 · Enter 购买 · R 炼丹 · P 转生', w / 2, h - 8);
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
      case 'ArrowUp':
        this._selectedFieldIndex = Math.max(0, this._selectedFieldIndex - 1);
        this.emit('stateChange');
        break;
      case 'ArrowDown': {
        const visibleCount = FIELDS.filter((f) => {
          const u = this.upgrades.get(f.id);
          return u && u.unlocked;
        }).length;
        this._selectedFieldIndex = Math.min(
          Math.max(visibleCount - 1, 0),
          this._selectedFieldIndex + 1
        );
        this.emit('stateChange');
        break;
      }
      case 'Enter': {
        const visibleFields = FIELDS.filter((f) => {
          const u = this.upgrades.get(f.id);
          return u && u.unlocked;
        });
        if (this._selectedFieldIndex < visibleFields.length) {
          this.buyFieldByIndex(
            FIELDS.indexOf(visibleFields[this._selectedFieldIndex])
          );
        }
        break;
      }
      case 'r':
      case 'R': {
        // 炼制第一个可炼制的丹方
        for (const recipe of RECIPES) {
          if (this.canCraft(recipe.id)) {
            this.craftPill(recipe.id);
            break;
          }
        }
        break;
      }
      case 'p':
      case 'P':
        this.doPrestige();
        break;
    }
  }

  handleKeyUp(_key: string): void {
    // 不需要处理
  }
}
