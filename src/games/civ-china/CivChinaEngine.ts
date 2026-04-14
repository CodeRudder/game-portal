/**
 * 四大文明·古中国 (Civ China) — 放置类游戏引擎
 *
 * 继承 IdleGameEngine，实现：
 * - 多资源系统（粮食/丝绸/文化）
 * - 建筑升级系统（8 种建筑）
 * - 朝代更替系统（8 个朝代）
 * - 科举制度（招募官员获得加成）
 * - 声望重置系统（天命点）
 * - Canvas 古典中国风渲染
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
  MANDATE_BONUS_MULTIPLIER,
  PRESTIGE_BASE_MANDATE,
  MIN_PRESTIGE_FOOD,
  DYNASTY_BONUS,
  BUILDINGS,
  DYNASTIES,
  OFFICIALS,
  COLORS,
  SCENE_DRAW,
  BUILDING_PANEL,
  RESOURCE_PANEL,
  type BuildingDef,
  type DynastyDef,
  type OfficialDef,
} from './constants';

/** 官员状态 */
export interface OfficialState {
  id: string;
  recruited: boolean;
}

/** 游戏统计 */
export interface CivChinaStatistics {
  totalFoodEarned: number;
  totalClicks: number;
  totalSilkEarned: number;
  totalCultureEarned: number;
  totalPrestigeCount: number;
  totalDynastyAdvances: number;
  totalBuildingPurchases: number;
  totalOfficialsRecruited: number;
}

/** 古中国游戏状态 */
export interface CivChinaState {
  [key: string]: unknown;
  resources: Record<string, { amount: number; perSecond: number; unlocked: boolean }>;
  buildings: Record<string, number>;
  dynastyIndex: number;
  officials: OfficialState[];
  prestige: { currency: number; count: number };
  statistics: CivChinaStatistics;
  selectedIndex: number;
}

export class CivChinaEngine extends IdleGameEngine {
  // ========== 游戏状态 ==========

  protected _gameId = 'civ-china';

  constructor() {
    super();
    Object.defineProperty(this, 'statistics', {
      get: () => ({ ...this._stats }) as CivChinaStatistics,
      set: (_val: Record<string, number>) => { /* base class writes are no-ops */ },
      configurable: true,
      enumerable: true,
    });
  }

  /** 科举官员状态 */
  private _officials: OfficialState[] = OFFICIALS.map((o) => ({
    id: o.id,
    recruited: o.id === 'scholar', // 秀才初始已招募
  }));

  /** 当前朝代索引 */
  private _dynastyIndex: number = 0;

  /** 当前选中的建筑索引 */
  private _selectedIndex: number = 0;

  /** 统计数据 */
  private _stats: CivChinaStatistics = {
    totalFoodEarned: 0,
    totalClicks: 0,
    totalSilkEarned: 0,
    totalCultureEarned: 0,
    totalPrestigeCount: 0,
    totalDynastyAdvances: 0,
    totalBuildingPurchases: 0,
    totalOfficialsRecruited: 1,
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

  /** 场景动画计时器 */
  private _sceneAnimTimer: number = 0;
  /** 云朵偏移 */
  private _cloudOffset: number = 0;
  /** 灯笼闪烁 */
  private _lanternGlow: number = 0;
  /** 点击缩放效果 */
  private _clickScale: number = 1;
  private _clickAnimTimer: number = 0;
  /** 烟花粒子 */
  private _fireworkParticles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    color: string;
  }> = [];

  // ========== 公开属性 ==========

  get selectedIndex(): number {
    return this._selectedIndex;
  }

  get dynastyIndex(): number {
    return this._dynastyIndex;
  }

  get officials(): OfficialState[] {
    return this._officials.map((o) => ({ ...o }));
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
        id: RESOURCE_IDS.FOOD,
        name: '粮食',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e15,
        unlocked: true,
      },
      {
        id: RESOURCE_IDS.SILK,
        name: '丝绸',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e12,
        unlocked: false,
      },
      {
        id: RESOURCE_IDS.CULTURE,
        name: '文化',
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
        unlocked: b.id === 'farm', // 农田初始解锁
        requires: b.requires,
        icon: b.icon,
      }))
    );

    // 重置官员状态
    this._officials = OFFICIALS.map((o) => ({
      id: o.id,
      recruited: o.id === 'scholar',
    }));

    // 重置朝代
    this._dynastyIndex = 0;

    // 重置状态
    this._selectedIndex = 0;
    this._stats = {
      totalFoodEarned: 0,
      totalClicks: 0,
      totalSilkEarned: 0,
      totalCultureEarned: 0,
      totalPrestigeCount: 0,
      totalDynastyAdvances: 0,
      totalBuildingPurchases: 0,
      totalOfficialsRecruited: 1,
    };
    this._floatingTexts = [];
    this._sceneAnimTimer = 0;
    this._cloudOffset = 0;
    this._lanternGlow = 0;
    this._clickScale = 1;
    this._clickAnimTimer = 0;
    this._fireworkParticles = [];
  }

  protected onUpdate(deltaTime: number): void {
    // 场景动画
    this._sceneAnimTimer += deltaTime;
    this._cloudOffset = Math.sin(this._sceneAnimTimer * 0.0005) * 30;
    this._lanternGlow = Math.sin(this._sceneAnimTimer * 0.003) * 0.3 + 0.7;

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

    // 烟花粒子更新
    this._fireworkParticles = this._fireworkParticles.filter((p) => {
      p.life -= deltaTime;
      p.x += p.vx * (deltaTime / 1000);
      p.y += p.vy * (deltaTime / 1000);
      p.vy += 40 * (deltaTime / 1000); // 重力
      return p.life > 0;
    });

    // 随机产生烟花粒子
    if (Math.random() < 0.02) {
      const colors = [COLORS.accent, COLORS.accentRed, COLORS.cultureColor];
      this._fireworkParticles.push({
        x: Math.random() * CANVAS_WIDTH,
        y: 50 + Math.random() * 60,
        vx: (Math.random() - 0.5) * 20,
        vy: -10 - Math.random() * 20,
        life: 1500 + Math.random() * 1000,
        maxLife: 2500,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    // 统计资源产出
    const food = this.getResource(RESOURCE_IDS.FOOD);
    if (food && food.perSecond > 0) {
      this._stats.totalFoodEarned += food.perSecond * (deltaTime / 1000);
    }
    const silk = this.getResource(RESOURCE_IDS.SILK);
    if (silk && silk.perSecond > 0) {
      this._stats.totalSilkEarned += silk.perSecond * (deltaTime / 1000);
    }
    const culture = this.getResource(RESOURCE_IDS.CULTURE);
    if (culture && culture.perSecond > 0) {
      this._stats.totalCultureEarned += culture.perSecond * (deltaTime / 1000);
    }

    // 检查建筑解锁条件
    this.checkBuildingUnlocks();
    // 检查资源解锁条件
    this.checkResourceUnlocks();
  }

  // ========== 核心玩法 ==========

  /**
   * 点击获得粮食
   */
  click(): number {
    if (this._status !== 'playing') return 0;

    let gained = FOOD_PER_CLICK;

    // 官员点击加成
    gained *= this.getOfficialClickMultiplier();

    // 声望加成
    gained *= this.getPrestigeMultiplier();

    // 朝代加成
    gained *= this.getDynastyMultiplier(RESOURCE_IDS.FOOD);

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
      x: SCENE_DRAW.centerX + Math.cos(angle) * dist,
      y: SCENE_DRAW.centerY + Math.sin(angle) * dist - 30,
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
    this._stats.totalBuildingPurchases++;
    this.recalculateProduction();
    this.emit('upgradePurchased', upgradeId, upgrade.level);
    this.emit('stateChange');
    return true;
  }

  /**
   * 推进朝代
   */
  advanceDynasty(): boolean {
    const nextIndex = this._dynastyIndex + 1;
    if (nextIndex >= DYNASTIES.length) return false;

    const nextDynasty = DYNASTIES[nextIndex];
    if (this.prestige.currency < nextDynasty.requiredMandate) return false;

    this._dynastyIndex = nextIndex;
    this._stats.totalDynastyAdvances++;

    // 重新计算产出
    this.recalculateProduction();

    // 解锁新建筑
    this.checkBuildingUnlocks();

    this.emit('dynastyAdvanced', nextDynasty.id, nextIndex);
    this.emit('stateChange');
    return true;
  }

  /**
   * 招募科举官员
   */
  recruitOfficial(officialId: string): boolean {
    const officialDef = OFFICIALS.find((o) => o.id === officialId);
    if (!officialDef) return false;

    const officialState = this._officials.find((o) => o.id === officialId);
    if (!officialState || officialState.recruited) return false;

    // 检查文化资源
    if (officialDef.recruitCost > 0) {
      if (!this.hasResource(RESOURCE_IDS.CULTURE, officialDef.recruitCost)) return false;
      this.spendResource(RESOURCE_IDS.CULTURE, officialDef.recruitCost);
    }

    officialState.recruited = true;
    this._stats.totalOfficialsRecruited++;

    // 重新计算产出
    this.recalculateProduction();

    this.emit('officialRecruited', officialId);
    this.emit('stateChange');
    return true;
  }

  /**
   * 声望重置（朝代更替）
   */
  doPrestige(): number {
    const food = this.getResource(RESOURCE_IDS.FOOD);
    if (!food || this._stats.totalFoodEarned < MIN_PRESTIGE_FOOD) return 0;

    // 计算获得的天命点
    const mandateGained = Math.floor(
      PRESTIGE_BASE_MANDATE * Math.sqrt(this._stats.totalFoodEarned / MIN_PRESTIGE_FOOD)
    );

    if (mandateGained <= 0) return 0;

    // 保存天命
    const savedPrestige = { ...this.prestige };
    savedPrestige.currency += mandateGained;
    savedPrestige.count++;
    this._stats.totalPrestigeCount++;

    // 保存官员状态（声望保留官员）
    const savedOfficials = this._officials.map((o) => ({
      id: o.id,
      recruited: o.recruited,
    }));

    // 保存朝代索引（声望保留朝代）
    const savedDynastyIndex = this._dynastyIndex;

    const savedStats = {
      ...this._stats,
      totalFoodEarned: 0,
      totalClicks: 0,
      totalSilkEarned: 0,
      totalCultureEarned: 0,
    };

    // 重置
    this.onInit();

    // 恢复声望和部分统计
    this.prestige = savedPrestige;
    this._stats = savedStats as CivChinaStatistics;

    // 恢复官员
    for (const saved of savedOfficials) {
      const official = this._officials.find((o) => o.id === saved.id);
      if (official) {
        official.recruited = saved.recruited;
      }
    }

    // 恢复朝代
    this._dynastyIndex = savedDynastyIndex;

    // 重新计算产出
    this.recalculateProduction();

    this.emit('prestige', mandateGained);
    this.emit('stateChange');
    return mandateGained;
  }

  /**
   * 获取声望加成倍率
   */
  getPrestigeMultiplier(): number {
    return 1 + this.prestige.currency * MANDATE_BONUS_MULTIPLIER;
  }

  /**
   * 获取朝代加成倍率
   */
  getDynastyMultiplier(resourceId?: string): number {
    const dynasty = DYNASTIES[this._dynastyIndex];
    if (!dynasty) return 1;

    if (dynasty.bonusType === 'all') {
      return 1 + dynasty.bonusValue;
    }

    if (resourceId) {
      const resourceMap: Record<string, string> = {
        food: 'food',
        silk: 'silk',
        culture: 'culture',
      };
      if (dynasty.bonusType === resourceMap[resourceId]) {
        return 1 + dynasty.bonusValue;
      }
    }

    return 1;
  }

  /**
   * 获取官员点击加成倍率
   */
  getOfficialClickMultiplier(): number {
    let multiplier = 1;
    for (const official of this._officials) {
      if (!official.recruited) continue;
      const def = OFFICIALS.find((o) => o.id === official.id);
      if (!def) continue;
      if (def.bonusType === 'click' || def.bonusType === 'all') {
        multiplier += def.bonusValue;
      }
    }
    return multiplier;
  }

  /**
   * 获取官员生产加成倍率
   */
  getOfficialProductionMultiplier(): number {
    let multiplier = 1;
    for (const official of this._officials) {
      if (!official.recruited) continue;
      const def = OFFICIALS.find((o) => o.id === official.id);
      if (!def) continue;
      if (def.bonusType === 'production' || def.bonusType === 'all') {
        multiplier += def.bonusValue;
      }
    }
    return multiplier;
  }

  /**
   * 获取官员资源特定加成倍率
   */
  getOfficialResourceMultiplier(resourceId: string): number {
    let multiplier = 1;
    for (const official of this._officials) {
      if (!official.recruited) continue;
      const def = OFFICIALS.find((o) => o.id === official.id);
      if (!def) continue;
      if (def.bonusType === resourceId || def.bonusType === 'all') {
        multiplier += def.bonusValue;
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
   * 获取当前朝代名称
   */
  getCurrentDynastyName(): string {
    return DYNASTIES[this._dynastyIndex]?.name ?? '夏';
  }

  /**
   * 获取当前朝代定义
   */
  getCurrentDynasty(): DynastyDef {
    return DYNASTIES[this._dynastyIndex];
  }

  /**
   * 获取预览声望天命数
   */
  getPrestigePreview(): number {
    if (this._stats.totalFoodEarned < MIN_PRESTIGE_FOOD) return 0;
    return Math.floor(
      PRESTIGE_BASE_MANDATE * Math.sqrt(this._stats.totalFoodEarned / MIN_PRESTIGE_FOOD)
    );
  }

  /**
   * 检查是否可以声望
   */
  canPrestige(): boolean {
    return this._stats.totalFoodEarned >= MIN_PRESTIGE_FOOD;
  }

  /**
   * 检查是否可以推进朝代
   */
  canAdvanceDynasty(): boolean {
    const nextIndex = this._dynastyIndex + 1;
    if (nextIndex >= DYNASTIES.length) return false;
    return this.prestige.currency >= DYNASTIES[nextIndex].requiredMandate;
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

    // 建筑基础产出
    for (const building of BUILDINGS) {
      const upgrade = this.upgrades.get(building.id);
      if (!upgrade || upgrade.level <= 0) continue;

      let production = building.baseProduction * upgrade.level;

      // 声望加成
      production *= this.getPrestigeMultiplier();

      // 朝代加成
      production *= this.getDynastyMultiplier(building.productionResource);

      // 官员生产加成
      production *= this.getOfficialProductionMultiplier();

      // 官员资源特定加成
      production *= this.getOfficialResourceMultiplier(building.productionResource);

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

        if (!allReqsMet) continue;
      }

      // 检查朝代要求
      if (building.requiredDynasty !== undefined && building.requiredDynasty > this._dynastyIndex) {
        continue;
      }

      upgrade.unlocked = true;
    }
  }

  /**
   * 检查资源解锁条件
   */
  private checkResourceUnlocks(): void {
    // 丝绸：丝绸作坊等级 >= 1 时解锁
    const silkWorkshop = this.upgrades.get('silk_workshop');
    if (silkWorkshop && silkWorkshop.level >= 1) {
      const silk = this.resources.get(RESOURCE_IDS.SILK);
      if (silk && !silk.unlocked) {
        silk.unlocked = true;
        this.emit('resourceUnlocked', RESOURCE_IDS.SILK);
      }
    }

    // 文化：科举书院等级 >= 1 时解锁
    const academy = this.upgrades.get('academy');
    if (academy && academy.level >= 1) {
      const culture = this.resources.get(RESOURCE_IDS.CULTURE);
      if (culture && !culture.unlocked) {
        culture.unlocked = true;
        this.emit('resourceUnlocked', RESOURCE_IDS.CULTURE);
      }
    }
  }

  // ========== 渲染 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawFireworkParticles(ctx);
    this.drawGreatWall(ctx, w);
    this.drawPagoda(ctx);
    this.drawFloatingTexts(ctx);
    this.drawResourcePanel(ctx, w);
    this.drawDynastyInfo(ctx, w);
    this.drawBuildingList(ctx, w, h);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 天空渐变（深紫蓝色调）
    const skyGradient = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    skyGradient.addColorStop(0, COLORS.skyTop);
    skyGradient.addColorStop(1, COLORS.skyBottom);
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, w, h * 0.5);

    // 地面渐变（暗红棕色调）
    const groundGradient = ctx.createLinearGradient(0, h * 0.45, 0, h);
    groundGradient.addColorStop(0, COLORS.groundLight);
    groundGradient.addColorStop(1, COLORS.groundDark);
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, h * 0.45, w, h * 0.55);

    // 地面纹理
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < 30; i++) {
      const x = ((i * 73 + 17) % w);
      const y = h * 0.45 + ((i * 47 + 23) % (h * 0.55));
      ctx.fillStyle = '#4E342E';
      ctx.fillRect(x, y, 3, 2);
    }
    ctx.globalAlpha = 1;

    // 星星
    this.drawStars(ctx, w);

    // 月亮
    ctx.beginPath();
    ctx.arc(60, 50, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF8E1';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(60, 50, 24, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 248, 225, 0.15)';
    ctx.fill();

    // 远山
    ctx.fillStyle = COLORS.mountainFar;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.quadraticCurveTo(80, h * 0.38, 160, h * 0.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(200, h * 0.5);
    ctx.quadraticCurveTo(300, h * 0.35, 380, h * 0.5);
    ctx.fill();

    // 云朵
    this.drawClouds(ctx, w);
  }

  private drawStars(ctx: CanvasRenderingContext2D, w: number): void {
    const starPositions = [
      [30, 20], [90, 35], [150, 15], [200, 40], [260, 25],
      [310, 45], [370, 30], [420, 18], [450, 38], [100, 55],
      [180, 60], [340, 55], [400, 50], [50, 70], [230, 65],
    ];

    for (const [x, y] of starPositions) {
      const alpha = 0.3 + Math.random() * 0.7;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.accent;
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawClouds(ctx: CanvasRenderingContext2D, w: number): void {
    ctx.fillStyle = COLORS.cloudColor;
    const clouds = [
      { x: 100 + this._cloudOffset, y: 80, w: 60, h: 20 },
      { x: 300 + this._cloudOffset * 0.7, y: 60, w: 50, h: 16 },
    ];
    for (const c of clouds) {
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.w / 2, c.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawFireworkParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this._fireworkParticles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawGreatWall(ctx: CanvasRenderingContext2D, w: number): void {
    const cx = SCENE_DRAW.centerX;
    const cy = SCENE_DRAW.centerY;
    const scale = this._clickScale;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // 城墙主体
    ctx.fillStyle = COLORS.wallColor;
    ctx.fillRect(-SCENE_DRAW.wallWidth / 2, 0, SCENE_DRAW.wallWidth, SCENE_DRAW.wallHeight);

    // 城墙顶部
    ctx.fillStyle = COLORS.wallTop;
    ctx.fillRect(-SCENE_DRAW.wallWidth / 2 - 5, -5, SCENE_DRAW.wallWidth + 10, 10);

    // 城垛
    for (let i = 0; i < 6; i++) {
      const bx = -SCENE_DRAW.wallWidth / 2 + 5 + i * 22;
      ctx.fillStyle = COLORS.wallTop;
      ctx.fillRect(bx, -15, 12, 12);
    }

    // 烽火台（左）
    ctx.fillStyle = COLORS.wallColor;
    ctx.fillRect(-SCENE_DRAW.wallWidth / 2 - SCENE_DRAW.towerWidth / 2, -SCENE_DRAW.towerHeight + 20, SCENE_DRAW.towerWidth, SCENE_DRAW.towerHeight);
    ctx.fillStyle = COLORS.wallTop;
    ctx.fillRect(-SCENE_DRAW.wallWidth / 2 - SCENE_DRAW.towerWidth / 2 - 3, -SCENE_DRAW.towerHeight + 15, SCENE_DRAW.towerWidth + 6, 8);

    // 烽火台（右）
    ctx.fillStyle = COLORS.wallColor;
    ctx.fillRect(SCENE_DRAW.wallWidth / 2 - SCENE_DRAW.towerWidth / 2, -SCENE_DRAW.towerHeight + 20, SCENE_DRAW.towerWidth, SCENE_DRAW.towerHeight);
    ctx.fillStyle = COLORS.wallTop;
    ctx.fillRect(SCENE_DRAW.wallWidth / 2 - SCENE_DRAW.towerWidth / 2 - 3, -SCENE_DRAW.towerHeight + 15, SCENE_DRAW.towerWidth + 6, 8);

    // 灯笼（左塔）
    ctx.globalAlpha = this._lanternGlow;
    ctx.fillStyle = COLORS.lanternGlow;
    ctx.beginPath();
    ctx.ellipse(-SCENE_DRAW.wallWidth / 2, -SCENE_DRAW.towerHeight + 5, 5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.ellipse(-SCENE_DRAW.wallWidth / 2, -SCENE_DRAW.towerHeight + 5, 10, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // 灯笼（右塔）
    ctx.globalAlpha = this._lanternGlow;
    ctx.fillStyle = COLORS.lanternGlow;
    ctx.beginPath();
    ctx.ellipse(SCENE_DRAW.wallWidth / 2, -SCENE_DRAW.towerHeight + 5, 5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.ellipse(SCENE_DRAW.wallWidth / 2, -SCENE_DRAW.towerHeight + 5, 10, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 城门
    ctx.fillStyle = '#3E2723';
    ctx.beginPath();
    ctx.arc(0, SCENE_DRAW.wallHeight, 12, Math.PI, 0);
    ctx.fillRect(-12, SCENE_DRAW.wallHeight - 12, 24, 12);
    ctx.fill();

    ctx.restore();
  }

  private drawPagoda(ctx: CanvasRenderingContext2D): void {
    const px = SCENE_DRAW.pagodaX;
    const py = SCENE_DRAW.pagodaY;
    const floors = SCENE_DRAW.pagodaFloors;
    const floorH = 15;
    const baseW = SCENE_DRAW.pagodaWidth;

    for (let i = 0; i < floors; i++) {
      const w = baseW - i * 6;
      const y = py - i * floorH;

      // 楼层
      ctx.fillStyle = '#B71C1C';
      ctx.fillRect(px - w / 2, y, w, floorH - 3);

      // 屋檐
      ctx.fillStyle = '#4E342E';
      ctx.beginPath();
      ctx.moveTo(px - w / 2 - 4, y);
      ctx.lineTo(px + w / 2 + 4, y);
      ctx.lineTo(px + w / 2 + 2, y - 4);
      ctx.lineTo(px - w / 2 - 2, y - 4);
      ctx.closePath();
      ctx.fill();
    }

    // 塔尖
    ctx.fillStyle = COLORS.accent;
    ctx.beginPath();
    ctx.moveTo(px, py - floors * floorH - 10);
    ctx.lineTo(px - 3, py - floors * floorH);
    ctx.lineTo(px + 3, py - floors * floorH);
    ctx.closePath();
    ctx.fill();
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
      const icon = res.id === RESOURCE_IDS.FOOD ? '🌾' : res.id === RESOURCE_IDS.SILK ? '🧵' : '📜';

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

  private drawDynastyInfo(ctx: CanvasRenderingContext2D, w: number): void {
    const dynasty = DYNASTIES[this._dynastyIndex];
    if (!dynasty) return;

    // 朝代信息条
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    this.roundRect(ctx, 12, 90, w - 24, 28, 6);
    ctx.fill();

    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.fillStyle = dynasty.color;
    ctx.textAlign = 'left';
    ctx.fillText(`${dynasty.icon} ${dynasty.name}朝`, 20, 109);

    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textSecondary;
    ctx.textAlign = 'center';
    ctx.fillText(dynasty.description, w / 2, 109);

    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.accent;
    ctx.textAlign = 'right';
    ctx.fillText(`天命: ${this.prestige.currency}`, w - 20, 109);
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
            const icon = id === RESOURCE_IDS.FOOD ? '🌾' : id === RESOURCE_IDS.SILK ? '🧵' : '📜';
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
    ctx.fillText('空格 点击 · ↑↓ 选择 · Enter 购买 · D 朝代 · O 科举 · P 声望', w / 2, h - 10);
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
      case 'd':
      case 'D':
        this.advanceDynasty();
        break;
      case 'o':
      case 'O':
        // 招募下一个未招募的官员
        {
          const next = this._officials.find((o) => !o.recruited);
          if (next) this.recruitOfficial(next.id);
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

  getState(): CivChinaState {
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
      dynastyIndex: this._dynastyIndex,
      officials: this.officials,
      prestige: { ...this.prestige },
      statistics: { ...this._stats },
      selectedIndex: this._selectedIndex,
    };
  }

  /**
   * 从状态恢复
   */
  loadState(state: CivChinaState): void {
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

    // 恢复朝代
    if (state.dynastyIndex !== undefined) {
      this._dynastyIndex = state.dynastyIndex;
    }

    // 恢复官员
    if (state.officials) {
      for (const officialState of state.officials) {
        const myOfficial = this._officials.find((o) => o.id === officialState.id);
        if (myOfficial) {
          myOfficial.recruited = officialState.recruited;
        }
      }
    }

    // 恢复声望
    if (state.prestige) {
      this.prestige = { ...state.prestige };
    }

    // 恢复统计
    if (state.statistics) {
      this._stats = { ...state.statistics } as CivChinaStatistics;
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
    // 附加朝代、官员和统计信息到 settings
    data.settings = {
      dynastyIndex: this._dynastyIndex,
      officials: this._officials,
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
      if (settings.dynastyIndex !== undefined) {
        this._dynastyIndex = settings.dynastyIndex;
      }
      if (settings.officials) {
        for (const officialState of settings.officials) {
          const myOfficial = this._officials.find((o) => o.id === officialState.id);
          if (myOfficial) {
            myOfficial.recruited = officialState.recruited;
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
