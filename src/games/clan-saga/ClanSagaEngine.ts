/**
 * 家族风云 (Clan Saga) 放置类游戏引擎
 *
 * 继承 IdleGameEngine，核心玩法：
 * - 点击/空格键获得财富
 * - 建筑系统（商铺、书院、武馆、祠堂、茶馆、钱庄、使馆、宝库）
 * - 后代培养系统（武将、文士、商人、外交官）
 * - 联姻系统（与其他家族联姻获得加成）
 * - 声望系统（转生获得家族传承，永久加成）
 * - 离线收益
 * - 自动存档/读档
 * - 古风雅韵画面（朱红/金色/墨色）
 */
import { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { SaveData } from '@/types/idle';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  WEALTH_PER_CLICK,
  RESOURCE_IDS,
  BUILDING_IDS,
  BUILDINGS,
  HEIR_TYPES,
  HEIR_TYPE_DEFS,
  MARRIAGE_FAMILIES,
  PRESTIGE_MULTIPLIER,
  MIN_PRESTIGE_WEALTH,
  COLORS,
  UPGRADE_PANEL,
  RESOURCE_ICONS,
  RESOURCE_NAMES,
  FLOATING_TEXT_DURATION,
  ANIMATION,
  type BuildingDef,
  type HeirTypeDef,
  type MarriageFamilyDef,
} from './constants';

// ========== 游戏状态接口 ==========

/** 飘字效果 */
interface FloatingText {
  text: string;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  color: string;
}

/** 灯笼粒子 */
interface LanternParticle {
  x: number;
  y: number;
  speed: number;
  size: number;
  opacity: number;
  swingAngle: number;
  swingSpeed: number;
}

/** 落叶粒子 */
interface LeafParticle {
  x: number;
  y: number;
  speed: number;
  size: number;
  opacity: number;
  angle: number;
  rotSpeed: number;
  drift: number;
}

/** 后代培养状态 */
interface HeirState {
  type: string;
  level: number;
}

/** 家族统计 */
interface ClanStatistics {
  totalWealthEarned: number;
  totalClicks: number;
  totalPrestigeCount: number;
  totalHeirsTrained: number;
  totalMarriages: number;
  totalBuildingsBuilt: number;
}

/** 游戏完整状态 */
export interface ClanSagaState {
  [key: string]: unknown;
  resources: Record<string, { amount: number; unlocked: boolean }>;
  upgrades: Record<string, number>;
  prestige: { currency: number; count: number };
  statistics: Record<string, number>;
  heirs: Record<string, number>;
  marriedFamilies: string[];
  selectedBuildingIndex: number;
}

// ========== 默认统计 ==========

const defaultStats = (): ClanStatistics => ({
  totalWealthEarned: 0,
  totalClicks: 0,
  totalPrestigeCount: 0,
  totalHeirsTrained: 0,
  totalMarriages: 0,
  totalBuildingsBuilt: 0,
});

export class ClanSagaEngine extends IdleGameEngine {
  // ========== 游戏ID ==========

  protected _gameId = 'clan-saga';

  // ========== 构造函数 ==========

  constructor() {
    super();
    // Override base class `statistics` instance field with a getter/setter,
    // because class fields shadow prototype accessors.
    Object.defineProperty(this, 'statistics', {
      get: () => ({ ...this._stats }) as unknown as Record<string, number>,
      set: (_val: Record<string, number>) => { /* base class writes are no-ops */ },
      configurable: true,
      enumerable: true,
    });
  }

  // ========== 游戏统计（使用 _stats 避免基类 statistics getter 返回副本） ==========

  private _stats: ClanStatistics = defaultStats();

  // ========== 后代培养状态 ==========

  /** 各类型后代的等级 { heirTypeId: level } */
  private _heirs: Map<string, number> = new Map();

  // ========== 联姻状态 ==========

  /** 已联姻的家族ID列表 */
  private _marriedFamilies: Set<string> = new Set();

  // ========== UI 状态 ==========

  /** 当前选中建筑索引 */
  private _selectedBuildingIndex: number = 0;

  // ========== 动画状态 ==========

  /** 飘字效果列表 */
  private _floatingTexts: FloatingText[] = [];
  /** 灯笼粒子 */
  private _lanternParticles: LanternParticle[] = [];
  /** 落叶粒子 */
  private _leafParticles: LeafParticle[] = [];
  /** 点击缩放动画 */
  private _clickScale: number = 1;
  /** 点击动画计时器 */
  private _clickAnimTimer: number = 0;
  /** 全局动画计时 */
  private _animTimer: number = 0;
  /** 转生光效计时 */
  private _prestigeTimer: number = 0;
  /** 转生成功标记 */
  private _prestigeSuccess: boolean = false;

  // ========== 常量 ==========

  private static readonly CLICK_ANIM_DURATION = 200;
  private static readonly PRESTIGE_EFFECT_DURATION = 1500;

  // ========== 公开属性 ==========

  /** 获取统计副本 */
  get stats(): ClanStatistics {
    return { ...this._stats };
  }

  get totalWealthEarned(): number {
    return this._stats.totalWealthEarned;
  }

  get totalClicks(): number {
    return this._stats.totalClicks;
  }

  get selectedBuildingIndex(): number {
    return this._selectedBuildingIndex;
  }

  get marriedFamilyIds(): string[] {
    return Array.from(this._marriedFamilies);
  }

  // ========== 生命周期 ==========

  protected onInit(): void {
    super.onInit();

    // 初始化资源
    this.initializeResources([
      {
        id: RESOURCE_IDS.WEALTH,
        name: '财富',
        amount: 0,
        perSecond: 0,
        maxAmount: Infinity,
        unlocked: true,
      },
      {
        id: RESOURCE_IDS.REPUTATION,
        name: '声望',
        amount: 0,
        perSecond: 0,
        maxAmount: Infinity,
        unlocked: false,
      },
      {
        id: RESOURCE_IDS.CONNECTION,
        name: '人脉',
        amount: 0,
        perSecond: 0,
        maxAmount: Infinity,
        unlocked: false,
      },
    ]);

    // 初始化建筑（作为升级系统）
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
          type: 'add_production' as const,
          target: b.productionResource,
          value: b.baseProduction,
        },
        unlocked: !b.unlockCondition,
        icon: b.icon,
      }))
    );

    // 重置后代
    this._heirs = new Map();
    for (const heir of HEIR_TYPE_DEFS) {
      this._heirs.set(heir.id, 0);
    }

    // 重置联姻
    this._marriedFamilies = new Set();

    // 重置统计
    this._stats = defaultStats();

    // 重置UI状态
    this._selectedBuildingIndex = 0;

    // 重置动画状态
    this._floatingTexts = [];
    this._lanternParticles = [];
    this._leafParticles = [];
    this._clickScale = 1;
    this._clickAnimTimer = 0;
    this._animTimer = 0;
    this._prestigeTimer = 0;
    this._prestigeSuccess = false;

    // 初始化粒子
    this.initLanternParticles();
    this.initLeafParticles();
  }

  protected onStart(): void {
    this.loadFromStorage();
  }

  protected onUpdate(deltaTime: number): void {
    this.updateAnimations(deltaTime);
    this.checkBuildingUnlocks();
    this.checkResourceUnlocks();
    this.trackProduction(deltaTime);
  }

  // ========== 核心逻辑：点击 ==========

  /**
   * 点击获得财富
   * @returns 本次获得的财富数
   */
  click(): number {
    if (this._status !== 'playing') return 0;

    const clickPower = this.getClickPower();
    this.addResource(RESOURCE_IDS.WEALTH, clickPower);
    this._stats.totalWealthEarned += clickPower;
    this._stats.totalClicks++;
    this.addScore(clickPower);

    // 触发点击动画
    this._clickScale = 1.2;
    this._clickAnimTimer = ClanSagaEngine.CLICK_ANIM_DURATION;

    // 飘字效果
    const angle = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * 30;
    this._floatingTexts.push({
      text: `+${this.formatNumber(clickPower)}`,
      x: CANVAS_WIDTH / 2 + Math.cos(angle) * dist,
      y: 200 + Math.sin(angle) * dist,
      life: FLOATING_TEXT_DURATION,
      maxLife: FLOATING_TEXT_DURATION,
      color: COLORS.wealthColor,
    });

    this.emit('stateChange');
    return clickPower;
  }

  /**
   * 获取当前点击力量
   */
  getClickPower(): number {
    let power = WEALTH_PER_CLICK;

    // 武馆加成（每级 +0.3 点击力量）
    const dojoLevel = this.getBuildingLevel(BUILDING_IDS.DOJO);
    power += dojoLevel * 0.3;

    // 武将后代加成（每级 +0.5）
    const warriorLevel = this._heirs.get(HEIR_TYPES.WARRIOR) || 0;
    power += warriorLevel * 0.5;

    // 联姻加成（李家：财富+1.0）
    if (this._marriedFamilies.has('family-li')) {
      const liFamily = MARRIAGE_FAMILIES.find((f) => f.id === 'family-li');
      if (liFamily) {
        power += liFamily.bonus.wealth || 0;
      }
    }

    // 声望加成
    power *= 1 + this.prestige.currency * PRESTIGE_MULTIPLIER;

    return power;
  }

  // ========== 核心逻辑：建筑 ==========

  /**
   * 获取建筑费用
   */
  getBuildingCost(buildingId: string): Record<string, number> {
    return this.getUpgradeCost(buildingId);
  }

  /**
   * 购买建筑
   */
  purchaseBuilding(buildingId: string): boolean {
    const result = this.purchaseUpgrade(buildingId);
    if (result) {
      this._stats.totalBuildingsBuilt++;
      this.recalculateProduction();
      this.emit('stateChange');
    }
    return result;
  }

  /**
   * 按索引购买建筑
   */
  buyBuildingByIndex(index: number): boolean {
    if (index < 0 || index >= BUILDINGS.length) return false;
    return this.purchaseBuilding(BUILDINGS[index].id);
  }

  /**
   * 获取建筑等级
   */
  getBuildingLevel(buildingId: string): number {
    const upgrade = this.upgrades.get(buildingId);
    return upgrade ? upgrade.level : 0;
  }

  // ========== 核心逻辑：后代培养 ==========

  /**
   * 获取后代等级
   */
  getHeirLevel(heirTypeId: string): number {
    return this._heirs.get(heirTypeId) || 0;
  }

  /**
   * 获取后代培养费用
   */
  getHeirTrainCost(heirTypeId: string): Record<string, number> {
    const heirDef = HEIR_TYPE_DEFS.find((h) => h.id === heirTypeId);
    if (!heirDef) return {};

    const currentLevel = this.getHeirLevel(heirTypeId);
    const cost: Record<string, number> = {};
    for (const [resId, baseCost] of Object.entries(heirDef.trainCost)) {
      cost[resId] = Math.floor(baseCost * Math.pow(heirDef.trainCostMultiplier, currentLevel));
    }
    return cost;
  }

  /**
   * 培养后代（提升等级）
   */
  trainHeir(heirTypeId: string): boolean {
    if (this._status !== 'playing') return false;

    const heirDef = HEIR_TYPE_DEFS.find((h) => h.id === heirTypeId);
    if (!heirDef) return false;

    const currentLevel = this.getHeirLevel(heirTypeId);
    if (currentLevel >= heirDef.maxLevel) return false;

    const cost = this.getHeirTrainCost(heirTypeId);
    if (!this.canAfford(cost)) return false;

    // 扣除资源
    for (const [resId, amount] of Object.entries(cost)) {
      this.spendResource(resId, amount);
    }

    // 升级
    this._heirs.set(heirTypeId, currentLevel + 1);
    this._stats.totalHeirsTrained++;

    // 重新计算产出
    this.recalculateProduction();

    this.emit('heirTrained', heirTypeId, currentLevel + 1);
    this.emit('stateChange');
    return true;
  }

  /**
   * 计算后代对指定资源的加成
   */
  getHeirBonus(resourceId: string): number {
    let bonus = 0;
    for (const heirDef of HEIR_TYPE_DEFS) {
      const level = this._heirs.get(heirDef.id) || 0;
      if (level > 0 && heirDef.bonusTarget === resourceId) {
        bonus += heirDef.bonusPerLevel * level;
      }
    }
    return bonus;
  }

  // ========== 核心逻辑：联姻 ==========

  /**
   * 检查是否可以与某家族联姻
   */
  canMarry(familyId: string): boolean {
    if (this._marriedFamilies.has(familyId)) return false;

    const family = MARRIAGE_FAMILIES.find((f) => f.id === familyId);
    if (!family) return false;

    // 检查后代要求
    if (family.requiredHeirType) {
      const heirLevel = this.getHeirLevel(family.requiredHeirType);
      if (heirLevel < (family.requiredHeirLevel || 1)) return false;
    }

    // 检查费用
    return this.canAfford(family.cost);
  }

  /**
   * 与家族联姻
   */
  marry(familyId: string): boolean {
    if (this._status !== 'playing') return false;
    if (!this.canMarry(familyId)) return false;

    const family = MARRIAGE_FAMILIES.find((f) => f.id === familyId);
    if (!family) return false;

    // 扣除资源
    for (const [resId, amount] of Object.entries(family.cost)) {
      this.spendResource(resId, amount);
    }

    // 联姻
    this._marriedFamilies.add(familyId);
    this._stats.totalMarriages++;

    // 重新计算产出
    this.recalculateProduction();

    this.emit('marriageComplete', familyId);
    this.emit('stateChange');
    return true;
  }

  /**
   * 检查是否已与某家族联姻
   */
  isMarried(familyId: string): boolean {
    return this._marriedFamilies.has(familyId);
  }

  /**
   * 获取联姻总加成
   */
  getMarriageBonus(resourceId: string): number {
    let bonus = 0;
    for (const familyId of this._marriedFamilies) {
      const family = MARRIAGE_FAMILIES.find((f) => f.id === familyId);
      if (family && family.bonus[resourceId]) {
        bonus += family.bonus[resourceId];
      }
    }
    return bonus;
  }

  // ========== 产出计算 ==========

  /**
   * 计算总产出倍率
   */
  getProductionMultiplier(): number {
    let multiplier = 1;

    // 祠堂加成（每级 +5% 全产出）
    const ancestralHallLevel = this.getBuildingLevel(BUILDING_IDS.ANCESTRAL_HALL);
    multiplier += ancestralHallLevel * 0.05;

    // 宝库加成（每级 +8% 全产出）
    const treasuryLevel = this.getBuildingLevel(BUILDING_IDS.TREASURY);
    multiplier += treasuryLevel * 0.08;

    // 声望加成
    multiplier += this.prestige.currency * PRESTIGE_MULTIPLIER;

    return multiplier;
  }

  /**
   * 获取实际每秒产出（含所有加成）
   */
  getEffectiveProduction(resourceId: string): number {
    const resource = this.getResource(resourceId);
    if (!resource) return 0;

    // 基础产出 × 全局倍率
    let production = resource.perSecond * this.getProductionMultiplier();

    // 后代加成（加到 perSecond 上）
    production += this.getHeirBonus(resourceId);

    // 联姻加成
    production += this.getMarriageBonus(resourceId);

    return production;
  }

  /**
   * 重新计算所有资源的每秒产出
   */
  protected recalculateProduction(): void {
    // 先重置
    for (const r of this.resources.values()) {
      r.perSecond = 0;
    }

    // 根据建筑等级计算基础产出
    for (const building of BUILDINGS) {
      const upgrade = this.upgrades.get(building.id);
      if (upgrade && upgrade.level > 0 && building.baseProduction > 0) {
        const resource = this.resources.get(building.productionResource);
        if (resource) {
          resource.perSecond += building.baseProduction * upgrade.level;
        }
      }
    }
  }

  // ========== 声望系统 ==========

  /**
   * 计算转生可获得的传承点数
   */
  calculatePrestigeHeritage(): number {
    const wealth = this.getResource(RESOURCE_IDS.WEALTH);
    if (!wealth || wealth.amount < MIN_PRESTIGE_WEALTH) return 0;
    return Math.floor(Math.sqrt(wealth.amount / MIN_PRESTIGE_WEALTH));
  }

  /**
   * 执行声望重置（使用 doPrestige 避免与基类 prestige 属性冲突）
   */
  doPrestige(): boolean {
    const heritage = this.calculatePrestigeHeritage();
    if (heritage <= 0) return false;

    // 保存需要跨声望保留的数据
    const prestigeData = {
      currency: this.prestige.currency + heritage,
      count: this.prestige.count + 1,
    };
    const savedPrestigeCount = this._stats.totalPrestigeCount;

    // 重置游戏
    this.onInit();

    // 恢复声望数据
    this.prestige = prestigeData;
    this._stats.totalPrestigeCount = savedPrestigeCount + 1;

    // 转生光效
    this._prestigeTimer = ClanSagaEngine.PRESTIGE_EFFECT_DURATION;
    this._prestigeSuccess = true;

    // 重新计算产出
    this.recalculateProduction();

    this.emit('prestigeReset', heritage);
    this.emit('stateChange');
    return true;
  }

  /**
   * 检查是否可以进行声望重置
   */
  canPrestige(): boolean {
    return this.calculatePrestigeHeritage() > 0;
  }

  // ========== 自动检查 ==========

  /**
   * 检查建筑解锁条件
   */
  private checkBuildingUnlocks(): void {
    for (const building of BUILDINGS) {
      if (!building.unlockCondition) continue;

      const upgrade = this.upgrades.get(building.id);
      if (upgrade && !upgrade.unlocked) {
        let satisfied = true;
        for (const [resId, amount] of Object.entries(building.unlockCondition)) {
          const resource = this.getResource(resId);
          if (!resource || resource.amount < amount) {
            satisfied = false;
            break;
          }
        }
        if (satisfied) {
          upgrade.unlocked = true;
          this.emit('buildingUnlocked', building.id);
        }
      }
    }
  }

  /**
   * 检查资源解锁条件
   */
  private checkResourceUnlocks(): void {
    // 声望：书院解锁后自动解锁
    const academyUpgrade = this.upgrades.get(BUILDING_IDS.ACADEMY);
    if (academyUpgrade && academyUpgrade.unlocked) {
      const reputation = this.getResource(RESOURCE_IDS.REPUTATION);
      if (reputation && !reputation.unlocked) {
        reputation.unlocked = true;
        this.emit('resourceUnlocked', RESOURCE_IDS.REPUTATION);
      }
    }

    // 人脉：茶馆解锁后自动解锁
    const teaHouseUpgrade = this.upgrades.get(BUILDING_IDS.TEA_HOUSE);
    if (teaHouseUpgrade && teaHouseUpgrade.unlocked) {
      const connection = this.getResource(RESOURCE_IDS.CONNECTION);
      if (connection && !connection.unlocked) {
        connection.unlocked = true;
        this.emit('resourceUnlocked', RESOURCE_IDS.CONNECTION);
      }
    }
  }

  /**
   * 追踪产出统计
   */
  private trackProduction(deltaTime: number): void {
    const secondsDelta = deltaTime / 1000;

    // 追踪财富产出
    const wealth = this.getResource(RESOURCE_IDS.WEALTH);
    if (wealth && wealth.perSecond > 0) {
      this._stats.totalWealthEarned += wealth.perSecond * secondsDelta;
    }
  }

  // ========== 动画系统 ==========

  private initLanternParticles(): void {
    this._lanternParticles = [];
    for (let i = 0; i < ANIMATION.lanternCount; i++) {
      this._lanternParticles.push({
        x: 30 + Math.random() * (CANVAS_WIDTH - 60),
        y: 40 + Math.random() * 80,
        speed: 2 + Math.random() * 4,
        size: 4 + Math.random() * 4,
        opacity: 0.3 + Math.random() * 0.4,
        swingAngle: Math.random() * Math.PI * 2,
        swingSpeed: 0.5 + Math.random() * 1.5,
      });
    }
  }

  private initLeafParticles(): void {
    this._leafParticles = [];
    for (let i = 0; i < ANIMATION.leafCount; i++) {
      this._leafParticles.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        speed: 8 + Math.random() * 15,
        size: 2 + Math.random() * 3,
        opacity: 0.15 + Math.random() * 0.25,
        angle: Math.random() * Math.PI * 2,
        rotSpeed: 0.5 + Math.random() * 2,
        drift: 0.3 + Math.random() * 0.8,
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
        this._clickScale = 1 + 0.2 * (this._clickAnimTimer / ClanSagaEngine.CLICK_ANIM_DURATION);
      }
    }

    // 转生光效
    if (this._prestigeTimer > 0) {
      this._prestigeTimer -= deltaTime;
      if (this._prestigeTimer < 0) this._prestigeTimer = 0;
    }

    // 飘字更新
    this._floatingTexts = this._floatingTexts.filter((ft) => {
      ft.life -= deltaTime;
      ft.y -= deltaTime * 0.03;
      return ft.life > 0;
    });

    // 灯笼粒子飘动
    for (const l of this._lanternParticles) {
      l.swingAngle += l.swingSpeed * deltaTime * 0.001;
      l.y -= (l.speed * deltaTime) / 10000;
      l.x += Math.sin(l.swingAngle) * 0.2;
      if (l.y < 20) {
        l.y = 120;
        l.x = 30 + Math.random() * (CANVAS_WIDTH - 60);
      }
    }

    // 落叶粒子飘动
    for (const leaf of this._leafParticles) {
      leaf.angle += leaf.rotSpeed * deltaTime * 0.001;
      leaf.y += (leaf.speed * deltaTime) / 1000;
      leaf.x += Math.sin(leaf.angle) * leaf.drift;
      if (leaf.y > CANVAS_HEIGHT + 10) {
        leaf.y = -10;
        leaf.x = Math.random() * CANVAS_WIDTH;
      }
    }
  }

  // ========== 渲染系统 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawLanterns(ctx);
    this.drawLeaves(ctx);
    this.drawPrestigeEffect(ctx, w, h);
    this.drawFloatingTexts(ctx);
    this.drawInfoPanel(ctx, w);
    this.drawHeirPanel(ctx, w);
    this.drawBuildingList(ctx, w, h);
    this.drawBottomHint(ctx, w, h);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, COLORS.bgGradient1);
    gradient.addColorStop(0.5, COLORS.bgGradient2);
    gradient.addColorStop(1, COLORS.bgGradient3);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // 屋顶装饰线
    ctx.strokeStyle = COLORS.roofRed;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(0, 130);
    for (let x = 0; x <= w; x += 40) {
      ctx.lineTo(x + 20, 120);
      ctx.lineTo(x + 40, 130);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 地面
    ctx.fillStyle = COLORS.inkDark;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, 250, w, 4);
    ctx.globalAlpha = 1;
  }

  private drawLanterns(ctx: CanvasRenderingContext2D): void {
    for (const lantern of this._lanternParticles) {
      ctx.globalAlpha = lantern.opacity;

      // 灯笼光晕
      const gradient = ctx.createRadialGradient(
        lantern.x, lantern.y, 0,
        lantern.x, lantern.y, lantern.size * 3,
      );
      gradient.addColorStop(0, COLORS.lanternGlow);
      gradient.addColorStop(1, 'rgba(240, 160, 60, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(lantern.x, lantern.y, lantern.size * 3, 0, Math.PI * 2);
      ctx.fill();

      // 灯笼本体
      ctx.fillStyle = COLORS.redPrimary;
      ctx.beginPath();
      ctx.ellipse(lantern.x, lantern.y, lantern.size, lantern.size * 1.3, 0, 0, Math.PI * 2);
      ctx.fill();

      // 灯笼顶
      ctx.fillStyle = COLORS.goldPrimary;
      ctx.fillRect(lantern.x - lantern.size * 0.6, lantern.y - lantern.size * 1.3, lantern.size * 1.2, 2);
    }
    ctx.globalAlpha = 1;
  }

  private drawLeaves(ctx: CanvasRenderingContext2D): void {
    for (const leaf of this._leafParticles) {
      ctx.save();
      ctx.translate(leaf.x, leaf.y);
      ctx.rotate(leaf.angle);
      ctx.globalAlpha = leaf.opacity;
      ctx.fillStyle = COLORS.goldLight;
      ctx.beginPath();
      ctx.ellipse(0, 0, leaf.size, leaf.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private drawPrestigeEffect(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this._prestigeTimer <= 0) return;

    const progress = 1 - this._prestigeTimer / ClanSagaEngine.PRESTIGE_EFFECT_DURATION;
    const alpha = (1 - progress) * 0.3;

    if (this._prestigeSuccess) {
      // 金色光芒（传承）
      ctx.globalAlpha = alpha;
      const gradient = ctx.createRadialGradient(w / 2, h / 3, 0, w / 2, h / 3, 200);
      gradient.addColorStop(0, COLORS.prestigeGlow);
      gradient.addColorStop(1, 'rgba(201, 168, 76, 0)');
      ctx.fillStyle = gradient;
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
    ctx.fillStyle = COLORS.goldPrimary;
    ctx.textAlign = 'center';
    ctx.fillText('家族风云', w / 2, 24);

    // 副标题
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textSecondary;
    ctx.fillText('Clan Saga', w / 2, 40);

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
      ctx.fillText(`${icon} ${amount}`, rx, 60);

      if (effectiveProd > 0) {
        ctx.font = '10px "Segoe UI", sans-serif';
        ctx.fillStyle = COLORS.accentGreen;
        ctx.fillText(`+${this.formatNumber(effectiveProd)}/s`, rx, 74);
      }
    }

    // 点击力量 & 产出倍率
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.textAlign = 'center';
    ctx.fillText(
      `点击: ${this.formatNumber(this.getClickPower())} 财富 | 倍率: x${this.getProductionMultiplier().toFixed(2)}`,
      w / 2,
      92,
    );

    // 声望信息
    if (this.prestige.count > 0) {
      ctx.fillStyle = COLORS.prestigeGlow;
      ctx.fillText(
        `🏮 ${this.formatNumber(this.prestige.currency)} 传承点 (x${this.prestige.count})`,
        w / 2,
        106,
      );
    }
  }

  private drawHeirPanel(ctx: CanvasRenderingContext2D, w: number): void {
    const panelY = 115;

    // 后代面板框
    ctx.fillStyle = COLORS.panelBg;
    ctx.strokeStyle = COLORS.panelBorder;
    ctx.lineWidth = 1;
    this.roundRect(ctx, 12, panelY, w - 24, 50, 8);
    ctx.fill();
    ctx.stroke();

    // 标题
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textSecondary;
    ctx.textAlign = 'left';
    ctx.fillText('后代培养', 24, panelY + 16);

    // 显示后代图标和等级
    let hx = 24;
    for (const heirDef of HEIR_TYPE_DEFS) {
      const level = this._heirs.get(heirDef.id) || 0;
      if (level > 0) {
        ctx.font = '14px sans-serif';
        ctx.fillText(heirDef.icon, hx, panelY + 36);
        ctx.font = '9px "Segoe UI", sans-serif';
        ctx.fillStyle = COLORS.textDim;
        ctx.fillText(`Lv${level}`, hx - 2, panelY + 46);
        hx += 36;
      }
    }

    // 联姻标记
    if (this._marriedFamilies.size > 0) {
      ctx.font = '10px "Segoe UI", sans-serif';
      ctx.fillStyle = COLORS.accentRed;
      ctx.textAlign = 'right';
      ctx.fillText(`联姻: ${this._marriedFamilies.size}家`, w - 24, panelY + 16);
    }

    // 联姻家族图标
    let mx = w - 24;
    for (const familyId of this._marriedFamilies) {
      const family = MARRIAGE_FAMILIES.find((f) => f.id === familyId);
      if (family) {
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(family.icon, mx, panelY + 38);
        mx -= 24;
      }
    }
  }

  private drawBuildingList(ctx: CanvasRenderingContext2D, w: number, _h: number): void {
    const panel = UPGRADE_PANEL;

    // 标题
    ctx.font = 'bold 12px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textSecondary;
    ctx.textAlign = 'center';
    ctx.fillText('— 家族建筑 —', w / 2, panel.startY - 8);

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
        ctx.strokeStyle = 'rgba(201, 168, 76, 0.1)';
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
      if (building.baseProduction > 0) {
        const prodText = `Lv.${level} (+${this.formatNumber(building.baseProduction * level)}/s ${RESOURCE_NAMES[building.productionResource] || ''})`;
        ctx.fillText(prodText, x + 34, y + 34);
      } else {
        // 特殊建筑（武馆、宝库）显示特殊效果
        const specialText = `Lv.${level} (${building.id === BUILDING_IDS.DOJO ? '点击+力量' : '全产出+倍率'})`;
        ctx.fillText(specialText, x + 34, y + 34);
      }

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
    ctx.fillText('空格 点击 · ↑↓ 选择 · Enter 购买 · P 转生 · 1-4 培养后代 · M 联姻', w / 2, h - 8);
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number,
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

  // ========== 存档系统 ==========

  save(): SaveData {
    const data = super.save();
    const stats: Record<string, number> = {
      ...this.statistics,
      totalWealthEarned: this._stats.totalWealthEarned,
      totalClicks: this._stats.totalClicks,
      totalPrestigeCount: this._stats.totalPrestigeCount,
      totalHeirsTrained: this._stats.totalHeirsTrained,
      totalMarriages: this._stats.totalMarriages,
      totalBuildingsBuilt: this._stats.totalBuildingsBuilt,
      selectedBuildingIndex: this._selectedBuildingIndex,
    };
    // 后代等级（存为 heir_xxx = level）
    for (const [id, level] of this._heirs.entries()) {
      stats[`heir_${id}`] = level;
    }
    // 已联姻家族（存为 married_0 = index 映射）
    let marryIdx = 0;
    for (const familyId of this._marriedFamilies) {
      const familyIndex = MARRIAGE_FAMILIES.findIndex((f) => f.id === familyId);
      stats[`married_${marryIdx}`] = familyIndex;
      marryIdx++;
    }
    stats.marriedCount = this._marriedFamilies.size;
    data.statistics = stats;
    return data;
  }

  load(data: SaveData): void {
    super.load(data);

    // 恢复统计
    this._stats.totalWealthEarned = (data.statistics?.totalWealthEarned as number) || 0;
    this._stats.totalClicks = (data.statistics?.totalClicks as number) || 0;
    this._stats.totalPrestigeCount = (data.statistics?.totalPrestigeCount as number) || 0;
    this._stats.totalHeirsTrained = (data.statistics?.totalHeirsTrained as number) || 0;
    this._stats.totalMarriages = (data.statistics?.totalMarriages as number) || 0;
    this._stats.totalBuildingsBuilt = (data.statistics?.totalBuildingsBuilt as number) || 0;

    // 恢复后代等级
    for (const heirDef of HEIR_TYPE_DEFS) {
      const key = `heir_${heirDef.id}`;
      const level = (data.statistics?.[key] as number) || 0;
      this._heirs.set(heirDef.id, level);
    }

    // 恢复已联姻家族
    this._marriedFamilies = new Set();
    const marriedCount = (data.statistics?.marriedCount as number) || 0;
    for (let i = 0; i < marriedCount; i++) {
      const key = `married_${i}`;
      const familyIndex = (data.statistics?.[key] as number);
      if (familyIndex !== undefined && familyIndex >= 0 && familyIndex < MARRIAGE_FAMILIES.length) {
        this._marriedFamilies.add(MARRIAGE_FAMILIES[familyIndex].id);
      }
    }

    // 恢复选中建筑索引
    this._selectedBuildingIndex = (data.statistics?.selectedBuildingIndex as number) || 0;

    // 重新计算产出
    this.recalculateProduction();
  }

  getState(): ClanSagaState {
    const base = super.getState();
    return {
      resources: (base.resources as Record<string, { amount: number; unlocked: boolean }>) ?? {},
      upgrades: (base.upgrades as Record<string, number>) ?? {},
      prestige: { ...this.prestige },
      statistics: (base.statistics as Record<string, number>) ?? {},
      heirs: Object.fromEntries(this._heirs.entries()),
      marriedFamilies: Array.from(this._marriedFamilies),
      selectedBuildingIndex: this._selectedBuildingIndex,
    };
  }

  loadState(state: ClanSagaState): void {
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

    // 恢复后代等级
    if (state.heirs) {
      for (const [id, level] of Object.entries(state.heirs)) {
        this._heirs.set(id, level);
      }
    }

    // 恢复联姻
    if (state.marriedFamilies) {
      this._marriedFamilies = new Set(state.marriedFamilies);
    }

    this._selectedBuildingIndex = state.selectedBuildingIndex || 0;
    this.recalculateProduction();
    this.emit('stateChange');
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    if (this._status !== 'playing') return;

    switch (key) {
      case ' ':
        this.click();
        break;
      case 'p':
      case 'P':
        this.doPrestige();
        break;
      case '1':
        this.trainHeir(HEIR_TYPES.WARRIOR);
        break;
      case '2':
        this.trainHeir(HEIR_TYPES.SCHOLAR);
        break;
      case '3':
        this.trainHeir(HEIR_TYPES.MERCHANT);
        break;
      case '4':
        this.trainHeir(HEIR_TYPES.DIPLOMAT);
        break;
      case 'm':
      case 'M':
        this.marryNextAvailable();
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

  // ========== 辅助方法 ==========

  /**
   * 自动联姻下一个可用的家族
   */
  private marryNextAvailable(): void {
    for (const family of MARRIAGE_FAMILIES) {
      if (!this._marriedFamilies.has(family.id) && this.canMarry(family.id)) {
        this.marry(family.id);
        return;
      }
    }
  }
}
