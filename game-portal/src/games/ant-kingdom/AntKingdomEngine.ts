/**
 * Ant Kingdom（蚂蚁王国）放置类游戏引擎
 *
 * 继承 IdleGameEngine，核心玩法：
 * - 点击/空格键产生食物
 * - 建筑系统（蚁穴、真菌农场、蚁酸工厂、育婴室、兵蚁训练营、蜜蚁巢穴）
 * - 蚂蚁兵种系统（工蚁、兵蚁、侦察蚁、收割蚁、织叶蚁、子弹蚁）
 * - 声望系统（重置获得蚁后之息，永久加成）
 * - 离线收益
 * - 自动存档/读档
 * - 场景动画：蚂蚁在蚁巢隧道中行走
 */
import { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { Resource, Upgrade, SaveData } from '@/types/idle';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  FOOD_PER_CLICK,
  RESOURCE_IDS,
  BUILDING_IDS,
  BUILDINGS,
  ANTS,
  ANT_IDS,
  PRESTIGE_MULTIPLIER,
  MIN_PRESTIGE_FOOD,
  COLORS,
  UPGRADE_PANEL,
  RESOURCE_ICONS,
  MAX_VISIBLE_ANTS,
  ANT_WALK_SPEED,
  FLOATING_TEXT_DURATION,
  type BuildingDef,
  type AntDef,
} from './constants';

// ========== 游戏状态接口 ==========

/** 场景中的蚂蚁（动画用） */
interface SceneAnt {
  x: number;
  y: number;
  targetX: number;
  direction: number; // 1=右, -1=左
  walkTimer: number;
  idle: boolean;
  scale: number;
  tunnelIndex: number; // 所在隧道层
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

/** 土粒粒子（背景装饰） */
interface SoilParticle {
  x: number;
  y: number;
  size: number;
  opacity: number;
  color: string;
}

/** 蚂蚁兵种解锁状态 */
interface AntUnlockState {
  id: string;
  unlocked: boolean;
}

/** 游戏完整状态 */
export interface AntKingdomState {
  [key: string]: unknown;
  resources: Record<string, { amount: number; unlocked: boolean }>;
  upgrades: Record<string, number>;
  prestige: { currency: number; count: number };
  statistics: Record<string, number>;
  totalFoodEarned: number;
  totalClicks: number;
  selectedBuildingIndex: number;
  unlockedAnts: string[];
}

export class AntKingdomEngine extends IdleGameEngine {
  // ========== 游戏状态 ==========

  protected _gameId = 'ant-kingdom';

  /** 累计食物获得 */
  private _totalFoodEarned: number = 0;
  /** 累计点击次数 */
  private _totalClicks: number = 0;
  /** 当前选中建筑索引 */
  private _selectedBuildingIndex: number = 0;
  /** 已解锁蚂蚁兵种 */
  private _unlockedAnts: Set<string> = new Set([ANT_IDS.WORKER]);

  // ========== 动画状态 ==========

  /** 飘字效果列表 */
  private _floatingTexts: FloatingText[] = [];
  /** 场景蚂蚁列表 */
  private _sceneAnts: SceneAnt[] = [];
  /** 土粒粒子 */
  private _soilParticles: SoilParticle[] = [];
  /** 点击缩放动画 */
  private _clickScale: number = 1;
  /** 点击动画计时器 */
  private _clickAnimTimer: number = 0;
  /** 背景动画计时 */
  private _bgAnimTimer: number = 0;

  // ========== 公开属性 ==========

  get totalFoodEarned(): number {
    return this._totalFoodEarned;
  }

  get totalClicks(): number {
    return this._totalClicks;
  }

  get selectedBuildingIndex(): number {
    return this._selectedBuildingIndex;
  }

  get unlockedAnts(): string[] {
    return Array.from(this._unlockedAnts);
  }

  // ========== 生命周期 ==========

  protected onInit(): void {
    super.onInit();

    // 初始化资源
    this.initializeResources([
      {
        id: RESOURCE_IDS.FOOD,
        name: '食物',
        amount: 0,
        perSecond: 0,
        maxAmount: Infinity,
        unlocked: true,
      },
      {
        id: RESOURCE_IDS.LEAF,
        name: '树叶',
        amount: 0,
        perSecond: 0,
        maxAmount: Infinity,
        unlocked: false,
      },
      {
        id: RESOURCE_IDS.ACID,
        name: '蚁酸',
        amount: 0,
        perSecond: 0,
        maxAmount: Infinity,
        unlocked: false,
      },
      {
        id: RESOURCE_IDS.HONEY,
        name: '蜂蜜',
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
        unlocked: !b.unlockCondition,
        icon: b.icon,
      }))
    );

    // 重置状态
    this._totalFoodEarned = 0;
    this._totalClicks = 0;
    this._selectedBuildingIndex = 0;
    this._unlockedAnts = new Set([ANT_IDS.WORKER]);
    this._floatingTexts = [];
    this._sceneAnts = [];
    this._soilParticles = [];
    this._clickScale = 1;
    this._clickAnimTimer = 0;
    this._bgAnimTimer = 0;

    // 初始化场景蚂蚁
    this.initSceneAnts();

    // 初始化土粒粒子
    this.initSoilParticles();
  }

  protected onStart(): void {
    this.loadFromStorage();
  }

  protected onUpdate(deltaTime: number): void {
    this.updateAnimations(deltaTime);
    this.checkBuildingUnlocks();
    this.checkResourceUnlocks();
    this.checkAntUnlocks();
  }

  // ========== 核心逻辑 ==========

  /**
   * 点击产生食物
   * @returns 本次获得的食物数
   */
  click(): number {
    if (this._status !== 'playing') return 0;

    const clickPower = this.getClickPower();
    this.addResource(RESOURCE_IDS.FOOD, clickPower);
    this._totalFoodEarned += clickPower;
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
      color: COLORS.foodColor,
    });

    this.emit('stateChange');
    return clickPower;
  }

  /**
   * 获取当前点击力量
   */
  getClickPower(): number {
    let power = FOOD_PER_CLICK;

    // 育婴室加成点击
    const nurseryLevel = this.getBuildingLevel(BUILDING_IDS.NURSERY);
    power += nurseryLevel * 0.5;

    // 声望加成
    power *= 1 + this.prestige.currency * PRESTIGE_MULTIPLIER;

    // 工蚁加成
    if (this._unlockedAnts.has(ANT_IDS.WORKER)) {
      power *= 1.10;
    }

    return power;
  }

  /**
   * 获取建筑当前费用
   */
  getBuildingCost(buildingId: string): Record<string, number> {
    const baseCost = this.getUpgradeCost(buildingId);
    // 织叶蚁建筑费用减免
    if (this._unlockedAnts.has(ANT_IDS.WEAVER)) {
      const discount = 1 - ANTS.find(a => a.id === ANT_IDS.WEAVER)!.bonusValue;
      const reduced: Record<string, number> = {};
      for (const [id, amount] of Object.entries(baseCost)) {
        reduced[id] = Math.floor(amount * discount);
      }
      return reduced;
    }
    return baseCost;
  }

  /**
   * 购买建筑
   */
  purchaseBuilding(buildingId: string): boolean {
    // 使用自定义费用计算
    const cost = this.getBuildingCost(buildingId);
    if (!this.canAfford(cost)) return false;

    const upgrade = this.upgrades.get(buildingId);
    if (!upgrade || !upgrade.unlocked) return false;
    if (upgrade.level >= upgrade.maxLevel) return false;

    // 检查前置条件
    if (upgrade.requires) {
      for (const reqId of upgrade.requires) {
        const req = this.upgrades.get(reqId);
        if (!req || req.level <= 0) return false;
      }
    }

    // 扣除资源
    for (const [resId, amount] of Object.entries(cost)) {
      this.spendResource(resId, amount);
    }

    upgrade.level++;
    this.recalculateProduction();
    this.emit('upgradePurchased', buildingId, upgrade.level);
    this.emit('stateChange');
    return true;
  }

  /**
   * 通过索引购买建筑
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

  /**
   * 解锁蚂蚁兵种
   */
  unlockAnt(antId: string): boolean {
    const antDef = ANTS.find(a => a.id === antId);
    if (!antDef) return false;
    if (this._unlockedAnts.has(antId)) return false;

    // 检查解锁费用
    if (Object.keys(antDef.unlockCost).length > 0) {
      if (!this.canAfford(antDef.unlockCost)) return false;
      for (const [resId, amount] of Object.entries(antDef.unlockCost)) {
        this.spendResource(resId, amount);
      }
    }

    this._unlockedAnts.add(antId);
    this.recalculateProduction();
    this.emit('antUnlocked', antId);
    this.emit('stateChange');
    return true;
  }

  /**
   * 检查蚂蚁是否已解锁
   */
  isAntUnlocked(antId: string): boolean {
    return this._unlockedAnts.has(antId);
  }

  /**
   * 检查蚂蚁是否可解锁（费用足够）
   */
  canUnlockAnt(antId: string): boolean {
    const antDef = ANTS.find(a => a.id === antId);
    if (!antDef || this._unlockedAnts.has(antId)) return false;
    return this.canAfford(antDef.unlockCost);
  }

  /**
   * 计算总产出倍率
   */
  getProductionMultiplier(): number {
    let multiplier = 1;

    // 育婴室加成
    const nurseryLevel = this.getBuildingLevel(BUILDING_IDS.NURSERY);
    multiplier += nurseryLevel * 0.05;

    // 声望加成
    multiplier += this.prestige.currency * PRESTIGE_MULTIPLIER;

    // 子弹蚁全加成
    if (this._unlockedAnts.has(ANT_IDS.BULLET_ANT)) {
      multiplier += ANTS.find(a => a.id === ANT_IDS.BULLET_ANT)!.bonusValue;
    }

    return multiplier;
  }

  /**
   * 获取指定资源的产出倍率（含兵种加成）
   */
  getResourceMultiplier(resourceId: string): number {
    let multiplier = this.getProductionMultiplier();

    // 工蚁：食物+10%
    if (resourceId === RESOURCE_IDS.FOOD && this._unlockedAnts.has(ANT_IDS.WORKER)) {
      multiplier += ANTS.find(a => a.id === ANT_IDS.WORKER)!.bonusValue;
    }

    // 侦察蚁：树叶+20%
    if (resourceId === RESOURCE_IDS.LEAF && this._unlockedAnts.has(ANT_IDS.SCOUT)) {
      multiplier += ANTS.find(a => a.id === ANT_IDS.SCOUT)!.bonusValue;
    }

    // 收割蚁：树叶+25%
    if (resourceId === RESOURCE_IDS.LEAF && this._unlockedAnts.has(ANT_IDS.HARVESTER)) {
      multiplier += ANTS.find(a => a.id === ANT_IDS.HARVESTER)!.bonusValue;
    }

    return multiplier;
  }

  /**
   * 获取实际每秒产出（含加成）
   */
  getEffectiveProduction(resourceId: string): number {
    const resource = this.getResource(resourceId);
    if (!resource) return 0;
    const baseProd = resource.perSecond;
    const multiplier = this.getResourceMultiplier(resourceId);
    return baseProd * multiplier;
  }

  // ========== 声望系统 ==========

  /**
   * 计算声望重置可获得的蚁后之息数
   */
  calculatePrestigeEssence(): number {
    const food = this.getResource(RESOURCE_IDS.FOOD);
    if (!food || food.amount < MIN_PRESTIGE_FOOD) return 0;
    return Math.floor(Math.sqrt(food.amount / MIN_PRESTIGE_FOOD));
  }

  /**
   * 执行声望重置
   */
  doPrestige(): boolean {
    const essence = this.calculatePrestigeEssence();
    if (essence <= 0) return false;

    // 保存声望数据
    this.prestige.currency += essence;
    this.prestige.count++;

    // 保留统计信息
    const stats = { ...this.statistics };
    const prestigeData = { ...this.prestige };

    // 重置游戏
    this.onInit();

    // 恢复声望数据
    this.prestige = prestigeData;
    this.statistics = stats;

    // 重新计算产出
    this.recalculateProduction();

    // 给予蚁后之息（以蜂蜜体现）
    this.addResource(RESOURCE_IDS.HONEY, essence);

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

    // 根据建筑等级重新计算基础产出
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

    // 附加统计数据
    (data as any).statistics = {
      ...this.statistics,
      totalFoodEarned: this._totalFoodEarned,
      totalClicks: this._totalClicks,
      unlockedAnts: JSON.stringify(Array.from(this._unlockedAnts)),
    };

    return data;
  }

  load(data: SaveData): void {
    super.load(data);

    // 恢复统计
    this._totalFoodEarned = (data.statistics?.totalFoodEarned as number) || 0;
    this._totalClicks = (data.statistics?.totalClicks as number) || 0;

    // 恢复蚂蚁兵种解锁状态
    const savedAnts = data.statistics?.unlockedAnts;
    if (typeof savedAnts === 'string') {
      try {
        const antIds = JSON.parse(savedAnts) as string[];
        this._unlockedAnts = new Set(antIds);
      } catch {
        this._unlockedAnts = new Set([ANT_IDS.WORKER]);
      }
    }

    // 重新计算产出
    this.recalculateProduction();
  }

  getState(): AntKingdomState {
    const baseState = super.getState();

    return {
      ...baseState,
      totalFoodEarned: this._totalFoodEarned,
      totalClicks: this._totalClicks,
      selectedBuildingIndex: this._selectedBuildingIndex,
      unlockedAnts: Array.from(this._unlockedAnts),
      prestige: { ...this.prestige },
    } as AntKingdomState;
  }

  /**
   * 从状态恢复
   */
  loadState(state: AntKingdomState): void {
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
    if (state.upgrades) {
      for (const [id, level] of Object.entries(state.upgrades)) {
        const upgrade = this.upgrades.get(id);
        if (upgrade) {
          upgrade.level = level;
        }
      }
    }

    // 恢复声望
    if (state.prestige) {
      this.prestige = { ...state.prestige };
    }

    // 恢复统计
    this._totalFoodEarned = state.totalFoodEarned || 0;
    this._totalClicks = state.totalClicks || 0;
    this._selectedBuildingIndex = state.selectedBuildingIndex || 0;

    // 恢复蚂蚁兵种
    if (state.unlockedAnts) {
      this._unlockedAnts = new Set(state.unlockedAnts);
    }

    this.recalculateProduction();
    this.emit('stateChange');
  }

  // ========== 自动检查 ==========

  private checkBuildingUnlocks(): void {
    for (const building of BUILDINGS) {
      if (building.unlockCondition) {
        const upgrade = this.upgrades.get(building.id);
        if (upgrade && !upgrade.unlocked) {
          let met = true;
          for (const [resId, amount] of Object.entries(building.unlockCondition)) {
            const resource = this.resources.get(resId);
            if (!resource || resource.amount < amount) {
              met = false;
              break;
            }
          }
          if (met) {
            upgrade.unlocked = true;
            this.emit('buildingUnlocked', building.id);
          }
        }
      }
    }
  }

  private checkResourceUnlocks(): void {
    // 树叶：食物超过 50 时解锁
    const food = this.getResource(RESOURCE_IDS.FOOD);
    if (food && food.amount >= 50) {
      const leaf = this.getResource(RESOURCE_IDS.LEAF);
      if (leaf && !leaf.unlocked) {
        leaf.unlocked = true;
        this.emit('resourceUnlocked', RESOURCE_IDS.LEAF);
      }
    }

    // 蚁酸：树叶超过 50 时解锁
    const leaf = this.getResource(RESOURCE_IDS.LEAF);
    if (leaf && leaf.amount >= 50) {
      const acid = this.getResource(RESOURCE_IDS.ACID);
      if (acid && !acid.unlocked) {
        acid.unlocked = true;
        this.emit('resourceUnlocked', RESOURCE_IDS.ACID);
      }
    }

    // 蜂蜜：声望重置后或蜜蚁巢穴解锁后
    if (this.prestige.count > 0) {
      const honey = this.getResource(RESOURCE_IDS.HONEY);
      if (honey && !honey.unlocked) {
        honey.unlocked = true;
      }
    }

    const honeyVault = this.upgrades.get(BUILDING_IDS.HONEY_VAULT);
    if (honeyVault && honeyVault.unlocked) {
      const honey = this.getResource(RESOURCE_IDS.HONEY);
      if (honey && !honey.unlocked) {
        honey.unlocked = true;
      }
    }
  }

  private checkAntUnlocks(): void {
    // 蚂蚁兵种通过手动购买解锁，此处仅用于通知UI
    // 实际解锁逻辑在 unlockAnt() 中
  }

  // ========== 动画系统 ==========

  private initSceneAnts(): void {
    for (let i = 0; i < 3; i++) {
      this.addSceneAnt();
    }
  }

  private addSceneAnt(): void {
    if (this._sceneAnts.length >= MAX_VISIBLE_ANTS) return;

    const tunnelIndex = Math.floor(Math.random() * 3);
    this._sceneAnts.push({
      x: 60 + Math.random() * 360,
      y: 200 + tunnelIndex * 25,
      targetX: 60 + Math.random() * 360,
      direction: Math.random() > 0.5 ? 1 : -1,
      walkTimer: 0,
      idle: Math.random() > 0.5,
      scale: 0.7 + Math.random() * 0.5,
      tunnelIndex,
    });
  }

  private initSoilParticles(): void {
    this._soilParticles = [];
    const soilColors = [COLORS.dirtColor, COLORS.rootColor, '#4e342e', '#6d4c41'];
    for (let i = 0; i < 40; i++) {
      this._soilParticles.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        size: 1 + Math.random() * 3,
        opacity: 0.2 + Math.random() * 0.3,
        color: soilColors[Math.floor(Math.random() * soilColors.length)],
      });
    }
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

    // 蚂蚁行走
    for (const ant of this._sceneAnts) {
      ant.walkTimer += deltaTime;

      if (ant.idle) {
        if (ant.walkTimer > 1500 + Math.random() * 2500) {
          ant.idle = false;
          ant.walkTimer = 0;
          ant.targetX = 60 + Math.random() * 360;
          ant.direction = ant.targetX > ant.x ? 1 : -1;
        }
      } else {
        const dx = ant.targetX - ant.x;
        const step = (ANT_WALK_SPEED * deltaTime) / 1000;
        if (Math.abs(dx) < step) {
          ant.x = ant.targetX;
          ant.idle = true;
          ant.walkTimer = 0;
        } else {
          ant.x += Math.sign(dx) * step;
        }
      }
    }

    // 背景动画
    this._bgAnimTimer += deltaTime;
  }

  // ========== 渲染 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawSoilParticles(ctx);
    this.drawTunnels(ctx, w, h);
    this.drawRoots(ctx, w);
    this.drawSceneAnts(ctx);
    this.drawQueenAnt(ctx);
    this.drawFloatingTexts(ctx);
    this.drawInfoPanel(ctx, w);
    this.drawBuildingList(ctx, w, h);
    this.drawBottomHint(ctx, w, h);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#0d1a05');
    gradient.addColorStop(0.3, COLORS.bgGradient1);
    gradient.addColorStop(1, COLORS.bgGradient2);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // 草地顶部
    ctx.fillStyle = COLORS.grassColor;
    ctx.fillRect(0, 0, w, 20);

    // 草叶装饰
    ctx.strokeStyle = '#558b2f';
    ctx.lineWidth = 2;
    const t = this._bgAnimTimer / 1000;
    for (let i = 0; i < 20; i++) {
      const gx = i * 25 + 5;
      const sway = Math.sin(t + i * 0.5) * 3;
      ctx.beginPath();
      ctx.moveTo(gx, 20);
      ctx.quadraticCurveTo(gx + sway, 5, gx + sway * 2, 0);
      ctx.stroke();
    }
  }

  private drawSoilParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this._soilParticles) {
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawTunnels(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 蚁巢隧道
    ctx.strokeStyle = COLORS.tunnelColor;
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';

    // 主隧道
    ctx.beginPath();
    ctx.moveTo(w / 2, 40);
    ctx.lineTo(w / 2, 260);
    ctx.stroke();

    // 分支隧道
    const branches = [
      { x1: 80, y1: 120, x2: w / 2, y2: 120 },
      { x1: w / 2, y1: 180, x2: w - 80, y2: 180 },
      { x1: 100, y1: 230, x2: w - 100, y2: 230 },
    ];

    ctx.lineWidth = 12;
    for (const b of branches) {
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
    }

    // 巢室（圆形空间）
    ctx.fillStyle = COLORS.tunnelColor;
    const chambers = [
      { x: w / 2, y: 80, r: 25 },
      { x: 80, y: 120, r: 18 },
      { x: w - 80, y: 180, r: 18 },
      { x: w / 2, y: 260, r: 30 },
    ];

    for (const c of chambers) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawRoots(ctx: CanvasRenderingContext2D, w: number): void {
    // 树根装饰
    ctx.strokeStyle = COLORS.rootColor;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.4;

    const rootPaths = [
      [[30, 20], [45, 80], [35, 140], [50, 200]],
      [[w - 40, 20], [w - 55, 90], [w - 35, 160], [w - 50, 220]],
      [[w / 2 - 60, 20], [w / 2 - 70, 100], [w / 2 - 50, 180]],
      [[w / 2 + 40, 20], [w / 2 + 55, 110], [w / 2 + 35, 190]],
    ];

    for (const path of rootPaths) {
      ctx.beginPath();
      ctx.moveTo(path[0][0], path[0][1]);
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i][0], path[i][1]);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawQueenAnt(ctx: CanvasRenderingContext2D): void {
    const cx = 240;
    const cy = 80;
    const size = 16 * this._clickScale;

    ctx.save();
    ctx.translate(cx, cy);

    // 蚁后身体（较大）
    ctx.fillStyle = COLORS.queenColor;
    // 腹部
    ctx.beginPath();
    ctx.ellipse(0, size * 0.6, size * 0.8, size * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    // 胸部
    ctx.beginPath();
    ctx.ellipse(0, -size * 0.1, size * 0.45, size * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    // 头部
    ctx.beginPath();
    ctx.arc(0, -size * 0.6, size * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // 触角
    ctx.strokeStyle = COLORS.queenColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-3, -size * 0.85);
    ctx.quadraticCurveTo(-8, -size * 1.3, -12, -size * 1.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(3, -size * 0.85);
    ctx.quadraticCurveTo(8, -size * 1.3, 12, -size * 1.2);
    ctx.stroke();

    // 王冠标记
    ctx.fillStyle = '#ffd700';
    ctx.font = `${10 * this._clickScale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('♛', 0, -size * 0.5);

    ctx.restore();
  }

  private drawSceneAnts(ctx: CanvasRenderingContext2D): void {
    for (const ant of this._sceneAnts) {
      this.drawPixelAnt(ctx, ant.x, ant.y, ant.direction, ant.idle, ant.scale);
    }
  }

  private drawPixelAnt(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    direction: number,
    idle: boolean,
    scale: number = 1
  ): void {
    const size = 8 * scale;
    ctx.save();
    ctx.translate(x, y);
    if (direction < 0) {
      ctx.scale(-1, 1);
    }

    // 腹部
    ctx.fillStyle = COLORS.antBody;
    ctx.beginPath();
    ctx.ellipse(0, size * 0.4, size * 0.55, size * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // 胸部
    ctx.fillStyle = COLORS.antBody;
    ctx.beginPath();
    ctx.ellipse(0, -size * 0.1, size * 0.35, size * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    // 头部
    ctx.beginPath();
    ctx.arc(0, -size * 0.45, size * 0.28, 0, Math.PI * 2);
    ctx.fill();

    // 触角
    ctx.strokeStyle = COLORS.antLegs;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-2, -size * 0.65);
    ctx.lineTo(-6, -size * 0.95);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(2, -size * 0.65);
    ctx.lineTo(6, -size * 0.95);
    ctx.stroke();

    // 腿（3对）
    ctx.strokeStyle = COLORS.antLegs;
    ctx.lineWidth = 1;
    const legPhase = idle ? 0 : Math.sin(this._bgAnimTimer / 100) * 2;
    for (let i = 0; i < 3; i++) {
      const ly = -size * 0.1 + i * size * 0.25;
      const offset = i === 1 ? legPhase : -legPhase;
      // 左腿
      ctx.beginPath();
      ctx.moveTo(-size * 0.3, ly);
      ctx.lineTo(-size * 0.7 + offset, ly + size * 0.2);
      ctx.stroke();
      // 右腿
      ctx.beginPath();
      ctx.moveTo(size * 0.3, ly);
      ctx.lineTo(size * 0.7 - offset, ly + size * 0.2);
      ctx.stroke();
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

  private drawInfoPanel(ctx: CanvasRenderingContext2D, w: number): void {
    // 游戏标题
    ctx.font = 'bold 20px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.accentGold;
    ctx.textAlign = 'center';
    ctx.fillText('🐜 蚂蚁王国', w / 2, 28);

    // 资源显示
    const resources = this.getUnlockedResources();
    const startX = 20;
    let rx = startX;

    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    for (const resource of resources) {
      const icon = RESOURCE_ICONS[resource.id] || '';
      const amount = this.formatNumber(resource.amount);
      const effectiveProd = this.getEffectiveProduction(resource.id);

      ctx.textAlign = 'left';
      ctx.fillStyle = COLORS.textPrimary;
      ctx.fillText(`${icon} ${amount}`, rx, 52);

      if (effectiveProd > 0) {
        ctx.font = '11px "Segoe UI", sans-serif';
        ctx.fillStyle = COLORS.accentGreen;
        ctx.fillText(`+${this.formatNumber(effectiveProd)}/s`, rx, 66);
        ctx.font = 'bold 14px "Segoe UI", sans-serif';
      }

      rx += 120;
    }

    // 点击力量
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.textAlign = 'center';
    ctx.fillText(`点击力量: ${this.formatNumber(this.getClickPower())} 🍎`, w / 2, 82);

    // 总产出倍率
    ctx.fillText(`产出倍率: x${this.getProductionMultiplier().toFixed(2)}`, w / 2, 96);

    // 声望信息
    if (this.prestige.count > 0) {
      ctx.fillStyle = COLORS.honeyColor;
      ctx.fillText(`🍯 ${this.formatNumber(this.prestige.currency)} 蚁后之息 x${this.prestige.count}`, w / 2, 110);
    }

    // 蚂蚁兵种显示
    const antIcons = ANTS
      .filter(a => this._unlockedAnts.has(a.id))
      .map(a => a.icon)
      .join(' ');
    if (antIcons) {
      ctx.font = '11px "Segoe UI", sans-serif';
      ctx.fillStyle = COLORS.textSecondary;
      ctx.fillText(`兵种: ${antIcons}`, w / 2, 124);
    }
  }

  private drawBuildingList(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const panel = UPGRADE_PANEL;

    // 标题
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textSecondary;
    ctx.textAlign = 'center';
    ctx.fillText('— 建筑 —', w / 2, panel.startY - 10);

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
        ctx.strokeStyle = 'rgba(200,144,80,0.1)';
        ctx.lineWidth = 1;
      }
      this.roundRect(ctx, x, y, panel.itemWidth, panel.itemHeight, 8);
      ctx.fill();
      ctx.stroke();

      // 图标
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(building.icon, x + 10, y + 30);

      // 名称 + 等级
      ctx.font = 'bold 13px "Segoe UI", sans-serif';
      ctx.fillStyle = COLORS.textPrimary;
      ctx.fillText(`${building.name}`, x + 40, y + 20);

      ctx.font = '10px "Segoe UI", sans-serif';
      ctx.fillStyle = COLORS.textDim;
      const prodText = building.baseProduction > 0
        ? `Lv.${level} (+${this.formatNumber(building.baseProduction * level)}/s)`
        : `Lv.${level} (+${(level * 5)}%效率)`;
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
    ctx.fillText('空格 点击 · ↑↓ 选择 · Enter 购买', w / 2, h - 8);
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
