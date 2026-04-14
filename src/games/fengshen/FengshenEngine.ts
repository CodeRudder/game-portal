/**
 * 封神演义 (Fengshen) — 放置类游戏引擎
 *
 * 继承 IdleGameEngine，实现：
 * - 多资源系统（灵力/法宝/功德）
 * - 洞府建筑升级系统
 * - 神仙招募与进化系统
 * - 法宝炼制系统
 * - 封神榜转生系统（天命）
 * - Canvas 仙侠风格渲染
 * - 离线收益
 * - 自动存档
 */
import { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { SaveData } from '@/types/idle';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SPIRIT_PER_CLICK,
  PRESTIGE_BONUS_MULTIPLIER,
  PRESTIGE_BASE_FATE,
  MIN_PRESTIGE_SPIRIT,
  IMMORTALS,
  BUILDINGS,
  TREASURES,
  EVOLUTION_COSTS,
  MAX_EVOLUTION_LEVEL,
  COLORS,
  IMMORTAL_DRAW,
  BUILDING_PANEL,
  RESOURCE_PANEL,
  type ImmortalDef,
  type TreasureDef,
  type BuildingDef,
} from './constants';

/** 神仙状态 */
export interface ImmortalState {
  id: string;
  unlocked: boolean;
  /** 进化等级 0-5 */
  evolutionLevel: number;
}

/** 法宝状态 */
export interface TreasureState {
  id: string;
  forged: boolean;
}

/** 游戏统计 */
export interface FengshenStatistics {
  totalSpiritEarned: number;
  totalClicks: number;
  totalTreasureEarned: number;
  totalMeritEarned: number;
  totalPrestigeCount: number;
  totalImmortalsUnlocked: number;
  totalEvolutions: number;
  totalTreasuresForged: number;
}

/** 封神演义游戏状态 */
export interface FengshenState {
  [key: string]: unknown;
  resources: Record<string, { amount: number; perSecond: number; unlocked: boolean }>;
  buildings: Record<string, number>;
  immortals: ImmortalState[];
  treasures: TreasureState[];
  prestige: { currency: number; count: number };
  statistics: FengshenStatistics;
  selectedIndex: number;
}

export class FengshenEngine extends IdleGameEngine {
  // ========== 游戏状态 ==========

  protected _gameId = 'fengshen';

  /** 神仙状态 */
  private _immortals: ImmortalState[] = IMMORTALS.map((i) => ({
    id: i.id,
    unlocked: i.id === 'ne_zha',
    evolutionLevel: 0,
  }));

  /** 法宝状态 */
  private _treasures: TreasureState[] = TREASURES.map((t) => ({
    id: t.id,
    forged: false,
  }));

  /** 当前选中的建筑索引 */
  private _selectedIndex: number = 0;

  /** 统计数据 */
  private _stats: FengshenStatistics = {
    totalSpiritEarned: 0,
    totalClicks: 0,
    totalTreasureEarned: 0,
    totalMeritEarned: 0,
    totalPrestigeCount: 0,
    totalImmortalsUnlocked: 1,
    totalEvolutions: 0,
    totalTreasuresForged: 0,
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

  /** 神仙动画计时器 */
  private _immortalAnimTimer: number = 0;
  /** 光环脉动 */
  private _auraPulse: number = 0;
  /** 呼吸缩放 */
  private _breathe: number = 0;
  /** 点击缩放效果 */
  private _clickScale: number = 1;
  private _clickAnimTimer: number = 0;
  /** 云朵粒子 */
  private _clouds: Array<{
    x: number;
    y: number;
    speed: number;
    size: number;
    alpha: number;
  }> = [];
  /** 星光粒子 */
  private _starParticles: Array<{
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

  /** 神仙列表（返回副本） */
  get immortals(): ImmortalState[] {
    return this._immortals.map((i) => ({ ...i }));
  }

  /** 法宝列表（返回副本） */
  get treasures(): TreasureState[] {
    return this._treasures.map((t) => ({ ...t }));
  }

  /** 统计数据（返回副本） */
  get statistics(): FengshenStatistics {
    return { ...this._stats };
  }

  get totalSpiritEarned(): number {
    return this._stats.totalSpiritEarned;
  }

  get totalClicks(): number {
    return this._stats.totalClicks;
  }

  // ========== 生命周期 ==========

  protected onInit(): void {
    super.onInit();

    this.initializeResources([
      {
        id: 'spirit',
        name: '灵力',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e15,
        unlocked: true,
      },
      {
        id: 'treasure',
        name: '法宝',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e12,
        unlocked: false,
      },
      {
        id: 'merit',
        name: '功德',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e9,
        unlocked: false,
      },
    ]);

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
        unlocked: b.id === 'cave',
        requires: b.requires,
        icon: b.icon,
      }))
    );

    this._immortals = IMMORTALS.map((i) => ({
      id: i.id,
      unlocked: i.id === 'ne_zha',
      evolutionLevel: 0,
    }));

    this._treasures = TREASURES.map((t) => ({
      id: t.id,
      forged: false,
    }));

    this._selectedIndex = 0;
    this._stats = {
      totalSpiritEarned: 0,
      totalClicks: 0,
      totalTreasureEarned: 0,
      totalMeritEarned: 0,
      totalPrestigeCount: 0,
      totalImmortalsUnlocked: 1,
      totalEvolutions: 0,
      totalTreasuresForged: 0,
    };
    this._floatingTexts = [];
    this._immortalAnimTimer = 0;
    this._auraPulse = 0;
    this._breathe = 0;
    this._clickScale = 1;
    this._clickAnimTimer = 0;
    this._clouds = [];
    this._starParticles = [];
  }

  protected onUpdate(deltaTime: number): void {
    // 神仙动画
    this._immortalAnimTimer += deltaTime;
    this._auraPulse = Math.sin(this._immortalAnimTimer * 0.003) * 0.3;
    this._breathe = Math.sin(this._immortalAnimTimer * 0.002) * 2;

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

    // 星光粒子更新
    this._starParticles = this._starParticles.filter((p) => {
      p.life -= deltaTime;
      p.x += p.vx * (deltaTime / 1000);
      p.y += p.vy * (deltaTime / 1000);
      p.vy += 30 * (deltaTime / 1000);
      return p.life > 0;
    });

    // 随机产生星光粒子
    if (Math.random() < 0.03) {
      this._starParticles.push({
        x: Math.random() * CANVAS_WIDTH,
        y: 50 + Math.random() * 30,
        vx: (Math.random() - 0.5) * 20,
        vy: -10 - Math.random() * 20,
        life: 1500 + Math.random() * 1000,
        maxLife: 2500,
      });
    }

    // 云朵更新
    if (this._clouds.length < 5 && Math.random() < 0.005) {
      this._clouds.push({
        x: -60,
        y: 30 + Math.random() * 80,
        speed: 8 + Math.random() * 12,
        size: 30 + Math.random() * 40,
        alpha: 0.03 + Math.random() * 0.06,
      });
    }
    this._clouds = this._clouds.filter((c) => {
      c.x += c.speed * (deltaTime / 1000);
      return c.x < CANVAS_WIDTH + 100;
    });

    // 统计资源产出
    const spirit = this.getResource('spirit');
    if (spirit && spirit.perSecond > 0) {
      this._stats.totalSpiritEarned += spirit.perSecond * (deltaTime / 1000);
    }
    const treasure = this.getResource('treasure');
    if (treasure && treasure.perSecond > 0) {
      this._stats.totalTreasureEarned += treasure.perSecond * (deltaTime / 1000);
    }
    const merit = this.getResource('merit');
    if (merit && merit.perSecond > 0) {
      this._stats.totalMeritEarned += merit.perSecond * (deltaTime / 1000);
    }

    this.checkBuildingUnlocks();
    this.checkResourceUnlocks();
  }

  // ========== 核心玩法 ==========

  /**
   * 点击获得灵力
   */
  click(): number {
    if (this._status !== 'playing') return 0;

    let gained = SPIRIT_PER_CLICK;
    gained *= this.getClickMultiplier();
    gained *= this.getTreasureClickMultiplier();
    gained *= this.getPrestigeMultiplier();
    gained = Math.floor(gained * 100) / 100;

    this.addResource('spirit', gained);
    this._stats.totalSpiritEarned += gained;
    this._stats.totalClicks++;
    this.addScore(gained);

    this._clickScale = 1.15;
    this._clickAnimTimer = 150;

    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 40;
    this._floatingTexts.push({
      text: `+${this.formatNumber(gained)}`,
      x: IMMORTAL_DRAW.centerX + Math.cos(angle) * dist,
      y: IMMORTAL_DRAW.centerY + Math.sin(angle) * dist - 30,
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

    if (upgrade.requires) {
      for (const reqId of upgrade.requires) {
        const req = this.upgrades.get(reqId);
        if (!req || req.level <= 0) return false;
      }
    }

    const cost = this.getUpgradeCost(upgradeId);
    if (!this.canAfford(cost)) return false;

    for (const [resId, amount] of Object.entries(cost)) {
      this.spendResource(resId, amount);
    }

    upgrade.level++;
    this.recalculateProduction();
    this.emit('upgradePurchased', upgradeId, upgrade.level);
    this.emit('stateChange');
    return true;
  }

  // ========== 神仙系统 ==========

  /**
   * 招募神仙
   */
  unlockImmortal(immortalId: string): boolean {
    const immortalDef = IMMORTALS.find((i) => i.id === immortalId);
    if (!immortalDef) return false;

    const immortalState = this._immortals.find((i) => i.id === immortalId);
    if (!immortalState || immortalState.unlocked) return false;

    if (!this.hasResource('spirit', immortalDef.unlockCost)) return false;

    this.spendResource('spirit', immortalDef.unlockCost);
    immortalState.unlocked = true;
    this._stats.totalImmortalsUnlocked++;

    this.recalculateProduction();
    this.emit('immortalUnlocked', immortalId);
    this.emit('stateChange');
    return true;
  }

  /**
   * 进化神仙
   */
  evolveImmortal(immortalId: string): boolean {
    const immortalState = this._immortals.find((i) => i.id === immortalId);
    if (!immortalState || !immortalState.unlocked) return false;

    const nextLevel = immortalState.evolutionLevel + 1;
    if (nextLevel > MAX_EVOLUTION_LEVEL) return false;

    const cost = this.getEvolutionCost(nextLevel);
    if (!this.canAfford(cost)) return false;

    for (const [resId, amount] of Object.entries(cost)) {
      this.spendResource(resId, amount);
    }

    immortalState.evolutionLevel = nextLevel;
    this._stats.totalEvolutions++;

    this.recalculateProduction();
    this.emit('immortalEvolved', immortalId, nextLevel);
    this.emit('stateChange');
    return true;
  }

  /**
   * 获取神仙进化等级
   */
  getImmortalEvolutionLevel(immortalId: string): number {
    const immortal = this._immortals.find((i) => i.id === immortalId);
    return immortal ? immortal.evolutionLevel : 0;
  }

  /**
   * 获取进化费用
   */
  getEvolutionCost(level: number): Record<string, number> {
    return EVOLUTION_COSTS[level] ? { ...EVOLUTION_COSTS[level] } : {};
  }

  // ========== 法宝系统 ==========

  /**
   * 炼制法宝
   */
  forgeTreasure(treasureId: string): boolean {
    const treasureDef = TREASURES.find((t) => t.id === treasureId);
    if (!treasureDef) return false;

    const treasureState = this._treasures.find((t) => t.id === treasureId);
    if (!treasureState || treasureState.forged) return false;

    if (!this.canAfford(treasureDef.forgeCost)) return false;

    for (const [resId, amount] of Object.entries(treasureDef.forgeCost)) {
      this.spendResource(resId, amount);
    }

    treasureState.forged = true;
    this._stats.totalTreasuresForged++;

    this.recalculateProduction();
    this.emit('treasureForged', treasureId);
    this.emit('stateChange');
    return true;
  }

  /**
   * 检查法宝是否已炼制
   */
  isTreasureForged(treasureId: string): boolean {
    const treasure = this._treasures.find((t) => t.id === treasureId);
    return treasure ? treasure.forged : false;
  }

  // ========== 转生系统 ==========

  /**
   * 封神榜转生重置
   */
  doPrestige(): number {
    if (this._stats.totalSpiritEarned < MIN_PRESTIGE_SPIRIT) return 0;

    const fateGained = Math.floor(
      PRESTIGE_BASE_FATE * Math.sqrt(this._stats.totalSpiritEarned / MIN_PRESTIGE_SPIRIT)
    );

    if (fateGained <= 0) return 0;

    const savedPrestige = { ...this.prestige };
    const savedStats = {
      ...this._stats,
      totalSpiritEarned: 0,
      totalClicks: 0,
      totalTreasureEarned: 0,
      totalMeritEarned: 0,
    };

    const savedImmortals = this._immortals.map((i) => ({
      id: i.id,
      unlocked: i.unlocked,
      evolutionLevel: i.evolutionLevel,
    }));

    const savedTreasures = this._treasures.map((t) => ({
      id: t.id,
      forged: t.forged,
    }));

    this.onInit();

    this.prestige = savedPrestige;
    this.prestige.currency += fateGained;
    this.prestige.count++;
    this._stats = savedStats as FengshenStatistics;
    this._stats.totalPrestigeCount++;

    for (const saved of savedImmortals) {
      const immortal = this._immortals.find((i) => i.id === saved.id);
      if (immortal) {
        immortal.unlocked = saved.unlocked;
        immortal.evolutionLevel = saved.evolutionLevel;
      }
    }

    for (const saved of savedTreasures) {
      const treasure = this._treasures.find((t) => t.id === saved.id);
      if (treasure) {
        treasure.forged = saved.forged;
      }
    }

    this.recalculateProduction();
    this.emit('prestige', fateGained);
    this.emit('stateChange');
    return fateGained;
  }

  /**
   * 获取转生加成倍率
   */
  getPrestigeMultiplier(): number {
    return 1 + this.prestige.currency * PRESTIGE_BONUS_MULTIPLIER;
  }

  /**
   * 获取点击加成倍率（来自神仙）
   */
  getClickMultiplier(): number {
    let multiplier = 1;
    for (const immortal of this._immortals) {
      if (!immortal.unlocked) continue;
      const def = IMMORTALS.find((i) => i.id === immortal.id);
      if (!def) continue;
      if (def.bonusType === 'click' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.evolutionMultiplier, immortal.evolutionLevel);
        multiplier += bonus;
      }
    }
    return multiplier;
  }

  /**
   * 获取法宝点击加成倍率
   */
  getTreasureClickMultiplier(): number {
    let multiplier = 1;
    for (const treasure of this._treasures) {
      if (!treasure.forged) continue;
      const def = TREASURES.find((t) => t.id === treasure.id);
      if (!def) continue;
      multiplier += def.clickBonus;
    }
    return multiplier;
  }

  /**
   * 获取法宝加成倍率（产出）
   */
  getTreasureMultiplier(): number {
    let multiplier = 1;
    for (const immortal of this._immortals) {
      if (!immortal.unlocked) continue;
      const def = IMMORTALS.find((i) => i.id === immortal.id);
      if (!def) continue;
      if (def.bonusType === 'treasure' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.evolutionMultiplier, immortal.evolutionLevel);
        multiplier += bonus;
      }
    }
    return multiplier;
  }

  /**
   * 获取生产加成倍率
   */
  getProductionMultiplier(): number {
    let multiplier = 1;
    for (const immortal of this._immortals) {
      if (!immortal.unlocked) continue;
      const def = IMMORTALS.find((i) => i.id === immortal.id);
      if (!def) continue;
      if (def.bonusType === 'production' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.evolutionMultiplier, immortal.evolutionLevel);
        multiplier += bonus;
      }
    }
    multiplier *= this.getPrestigeMultiplier();
    return multiplier;
  }

  /**
   * 获取功德加成倍率
   */
  getMeritMultiplier(): number {
    let multiplier = 1;
    for (const immortal of this._immortals) {
      if (!immortal.unlocked) continue;
      const def = IMMORTALS.find((i) => i.id === immortal.id);
      if (!def) continue;
      if (def.bonusType === 'merit' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.evolutionMultiplier, immortal.evolutionLevel);
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
   * 获取预览转生天命数
   */
  getPrestigePreview(): number {
    if (this._stats.totalSpiritEarned < MIN_PRESTIGE_SPIRIT) return 0;
    return Math.floor(
      PRESTIGE_BASE_FATE * Math.sqrt(this._stats.totalSpiritEarned / MIN_PRESTIGE_SPIRIT)
    );
  }

  /**
   * 检查是否可以转生
   */
  canPrestige(): boolean {
    return this._stats.totalSpiritEarned >= MIN_PRESTIGE_SPIRIT;
  }

  // ========== 内部方法 ==========

  /**
   * 重写产出计算，加入加成
   */
  protected recalculateProduction(): void {
    for (const r of this.resources.values()) {
      r.perSecond = 0;
    }

    for (const building of BUILDINGS) {
      const upgrade = this.upgrades.get(building.id);
      if (!upgrade || upgrade.level <= 0) continue;

      let production = building.baseProduction * upgrade.level;

      if (building.productionResource === 'spirit') {
        production *= this.getProductionMultiplier();
      } else if (building.productionResource === 'merit') {
        production *= this.getMeritMultiplier() * this.getPrestigeMultiplier();
      } else if (building.productionResource === 'treasure') {
        production *= this.getTreasureMultiplier() * this.getPrestigeMultiplier();
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
    // 法宝：洞府等级 >= 5 时解锁
    const cave = this.upgrades.get('cave');
    if (cave && cave.level >= 5) {
      const treasure = this.resources.get('treasure');
      if (treasure && !treasure.unlocked) {
        treasure.unlocked = true;
        this.emit('resourceUnlocked', 'treasure');
      }
    }

    // 功德：祭天坛等级 >= 1 时解锁
    const altar = this.upgrades.get('altar');
    if (altar && altar.level >= 1) {
      const merit = this.resources.get('merit');
      if (merit && !merit.unlocked) {
        merit.unlocked = true;
        this.emit('resourceUnlocked', 'merit');
      }
    }
  }

  // ========== 渲染 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawClouds(ctx);
    this.drawStarParticles(ctx);
    this.drawImmortal(ctx);
    this.drawFloatingTexts(ctx);
    this.drawResourcePanel(ctx, w);
    this.drawBuildingList(ctx, w, h);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 天空渐变（仙侠紫色调）
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
      ctx.fillStyle = '#4A148C';
      ctx.fillRect(x, y, 3, 2);
    }
    ctx.globalAlpha = 1;

    // 远山
    this.drawMountains(ctx, w, h);

    // 月亮
    ctx.beginPath();
    ctx.arc(70, 50, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF8E1';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(70, 50, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 248, 225, 0.12)';
    ctx.fill();

    // 封神榜卷轴（右上角）
    this.drawScroll(ctx, w);
  }

  private drawMountains(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = COLORS.mountainColor;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.quadraticCurveTo(60, h * 0.32, 130, h * 0.5);
    ctx.fill();

    ctx.fillStyle = COLORS.mountainHighlight;
    ctx.beginPath();
    ctx.moveTo(100, h * 0.5);
    ctx.quadraticCurveTo(200, h * 0.28, 300, h * 0.5);
    ctx.fill();

    ctx.fillStyle = COLORS.mountainColor;
    ctx.beginPath();
    ctx.moveTo(250, h * 0.5);
    ctx.quadraticCurveTo(370, h * 0.35, 480, h * 0.5);
    ctx.fill();
  }

  private drawScroll(ctx: CanvasRenderingContext2D, w: number): void {
    const sx = w - 55;
    const sy = 15;

    ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx + 20, sy - 5, sx + 40, sy);
    ctx.lineTo(sx + 38, sy + 50);
    ctx.quadraticCurveTo(sx + 20, sy + 55, sx + 2, sy + 50);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = COLORS.sealColor;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // 封字
    ctx.fillStyle = COLORS.sealColor;
    ctx.font = 'bold 14px serif';
    ctx.textAlign = 'center';
    ctx.fillText('封', sx + 20, sy + 22);
    ctx.fillText('神', sx + 20, sy + 40);
  }

  private drawClouds(ctx: CanvasRenderingContext2D): void {
    for (const cloud of this._clouds) {
      ctx.globalAlpha = cloud.alpha;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(cloud.x, cloud.y, cloud.size, cloud.size * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cloud.x - cloud.size * 0.3, cloud.y + 5, cloud.size * 0.6, cloud.size * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawStarParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this._starParticles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.starColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawImmortal(ctx: CanvasRenderingContext2D): void {
    const cx = IMMORTAL_DRAW.centerX;
    const cy = IMMORTAL_DRAW.centerY + this._breathe;
    const scale = this._clickScale;

    const unlockedImmortal = this._immortals.find((i) => i.unlocked);
    const immortalDef = unlockedImmortal
      ? IMMORTALS.find((i) => i.id === unlockedImmortal.id)!
      : IMMORTALS[0];

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // 光环
    const auraSize = IMMORTAL_DRAW.auraRadius * (1 + this._auraPulse);
    ctx.beginPath();
    ctx.arc(0, 0, auraSize, 0, Math.PI * 2);
    const auraGrad = ctx.createRadialGradient(0, 0, auraSize * 0.3, 0, 0, auraSize);
    auraGrad.addColorStop(0, 'rgba(255, 215, 0, 0.15)');
    auraGrad.addColorStop(1, 'rgba(255, 215, 0, 0)');
    ctx.fillStyle = auraGrad;
    ctx.fill();

    // 身体阴影
    ctx.beginPath();
    ctx.ellipse(4, IMMORTAL_DRAW.bodyHeight * 0.8 + 4, IMMORTAL_DRAW.bodyWidth * 0.5, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.generalShadow;
    ctx.fill();

    // 道袍（身体）
    ctx.beginPath();
    ctx.moveTo(-IMMORTAL_DRAW.bodyWidth * 0.5, -IMMORTAL_DRAW.bodyHeight * 0.2);
    ctx.quadraticCurveTo(-IMMORTAL_DRAW.bodyWidth * 0.6, IMMORTAL_DRAW.bodyHeight * 0.4, -IMMORTAL_DRAW.bodyWidth * 0.3, IMMORTAL_DRAW.bodyHeight * 0.7);
    ctx.lineTo(IMMORTAL_DRAW.bodyWidth * 0.3, IMMORTAL_DRAW.bodyHeight * 0.7);
    ctx.quadraticCurveTo(IMMORTAL_DRAW.bodyWidth * 0.6, IMMORTAL_DRAW.bodyHeight * 0.4, IMMORTAL_DRAW.bodyWidth * 0.5, -IMMORTAL_DRAW.bodyHeight * 0.2);
    ctx.closePath();
    ctx.fillStyle = immortalDef.color;
    ctx.fill();

    // 道袍内衬
    ctx.beginPath();
    ctx.moveTo(-IMMORTAL_DRAW.bodyWidth * 0.2, -IMMORTAL_DRAW.bodyHeight * 0.1);
    ctx.lineTo(0, IMMORTAL_DRAW.bodyHeight * 0.5);
    ctx.lineTo(IMMORTAL_DRAW.bodyWidth * 0.2, -IMMORTAL_DRAW.bodyHeight * 0.1);
    ctx.closePath();
    ctx.fillStyle = immortalDef.auraColor;
    ctx.globalAlpha = 0.3;
    ctx.fill();
    ctx.globalAlpha = 1;

    // 头部
    ctx.beginPath();
    ctx.arc(0, -IMMORTAL_DRAW.bodyHeight * 0.45, IMMORTAL_DRAW.headRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#FFE0B2';
    ctx.fill();

    // 发髻
    ctx.beginPath();
    ctx.arc(0, -IMMORTAL_DRAW.bodyHeight * 0.45 - IMMORTAL_DRAW.headRadius * 0.8, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#3E2723';
    ctx.fill();

    // 眼睛
    ctx.beginPath();
    ctx.arc(-6, -IMMORTAL_DRAW.bodyHeight * 0.47, IMMORTAL_DRAW.eyeRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#2C2C2C';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(6, -IMMORTAL_DRAW.bodyHeight * 0.47, IMMORTAL_DRAW.eyeRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#2C2C2C';
    ctx.fill();

    // 眼睛高光
    ctx.beginPath();
    ctx.arc(-5, -IMMORTAL_DRAW.bodyHeight * 0.48, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(7, -IMMORTAL_DRAW.bodyHeight * 0.48, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // 法宝（手持）
    ctx.save();
    ctx.translate(IMMORTAL_DRAW.bodyWidth * 0.4, -IMMORTAL_DRAW.bodyHeight * 0.1);
    ctx.rotate(Math.sin(this._immortalAnimTimer * 0.003) * 0.15);
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(-2, -IMMORTAL_DRAW.staffLength * 0.8, 4, IMMORTAL_DRAW.staffLength);
    // 法宝顶部光球
    ctx.beginPath();
    ctx.arc(0, -IMMORTAL_DRAW.staffLength * 0.8, 5, 0, Math.PI * 2);
    ctx.fillStyle = immortalDef.auraColor;
    ctx.fill();
    ctx.restore();

    // 进化等级指示（星）
    if (unlockedImmortal) {
      const evoLevel = unlockedImmortal.evolutionLevel;
      for (let i = 0; i < evoLevel; i++) {
        ctx.fillStyle = COLORS.accent;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★', -15 + i * 10, -IMMORTAL_DRAW.bodyHeight * 0.75);
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

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.roundRect(ctx, panel.padding, panel.startY, w - panel.padding * 2, resources.length * (panel.itemHeight + panel.itemPadding) + panel.padding, 8);
    ctx.fill();

    let y = panel.startY + panel.padding;
    for (const res of resources) {
      const icon = res.id === 'spirit' ? '✨' : res.id === 'treasure' ? '🔮' : '🙏';

      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(icon, panel.padding + 8, y + 16);

      ctx.font = 'bold 13px "Segoe UI", monospace';
      ctx.fillStyle = COLORS.textPrimary;
      ctx.fillText(this.formatNumber(res.amount), panel.padding + 30, y + 16);

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

    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textSecondary;
    ctx.textAlign = 'center';
    ctx.fillText('— 洞府建筑 —', w / 2, panel.startY - 8);

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

      ctx.font = '16px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(building.icon, x + 6, y + 24);

      ctx.font = 'bold 11px "Segoe UI", sans-serif';
      ctx.fillStyle = COLORS.textPrimary;
      ctx.fillText(`${building.name} Lv.${level}`, x + 30, y + 15);

      if (level > 0) {
        ctx.font = '9px "Segoe UI", sans-serif';
        ctx.fillStyle = COLORS.textDim;
        ctx.fillText(`产出 +${this.formatNumber(building.baseProduction * level)}/s`, x + 30, y + 30);
      }

      if (level < building.maxLevel) {
        const costStr = Object.entries(cost)
          .map(([id, amount]) => {
            const icon = id === 'spirit' ? '✨' : id === 'treasure' ? '🔮' : '🙏';
            return `${icon}${this.formatNumber(amount)}`;
          })
          .join(' ');
        ctx.font = 'bold 10px "Segoe UI", monospace';
        ctx.textAlign = 'right';
        ctx.fillStyle = affordable ? COLORS.affordable : COLORS.unaffordable;
        ctx.fillText(costStr, x + panel.itemWidth - 8, y + 24);
      } else {
        ctx.font = 'bold 10px "Segoe UI", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = COLORS.accent;
        ctx.fillText('MAX', x + panel.itemWidth - 8, y + 24);
      }
    }

    ctx.font = '10px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.textAlign = 'center';
    ctx.fillText('空格 点击 · ↑↓ 选择 · Enter 购买 · E 进化 · F 炼制 · P 封神', w / 2, h - 10);
  }

  private getVisibleIndex(buildingIndex: number): number {
    let visible = 0;
    for (let i = 0; i < buildingIndex; i++) {
      const upgrade = this.upgrades.get(BUILDINGS[i].id);
      if (upgrade && upgrade.unlocked) visible++;
    }
    return visible;
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

  // ========== 键盘输入 ==========

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
      case 'e':
      case 'E':
        {
          const unlocked = this._immortals.find((i) => i.unlocked);
          if (unlocked) this.evolveImmortal(unlocked.id);
        }
        break;
      case 'f':
      case 'F':
        {
          // 炼制第一个未炼制的法宝
          const unforged = this._treasures.find((t) => !t.forged);
          if (unforged) this.forgeTreasure(unforged.id);
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

  getState(): FengshenState {
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
      immortals: this.immortals,
      treasures: this.treasures,
      prestige: { ...this.prestige },
      statistics: { ...this._stats },
      selectedIndex: this._selectedIndex,
    };
  }

  loadState(state: FengshenState): void {
    if (state.resources) {
      for (const [id, data] of Object.entries(state.resources)) {
        const resource = this.resources.get(id);
        if (resource) {
          resource.amount = data.amount;
          resource.unlocked = data.unlocked;
        }
      }
    }

    if (state.buildings) {
      for (const [id, level] of Object.entries(state.buildings)) {
        const upgrade = this.upgrades.get(id);
        if (upgrade) {
          upgrade.level = level;
          upgrade.unlocked = true;
        }
      }
    }

    if (state.immortals) {
      for (const immortalState of state.immortals) {
        const myImmortal = this._immortals.find((i) => i.id === immortalState.id);
        if (myImmortal) {
          myImmortal.unlocked = immortalState.unlocked;
          if (immortalState.evolutionLevel !== undefined) {
            myImmortal.evolutionLevel = immortalState.evolutionLevel;
          }
        }
      }
    }

    if (state.treasures) {
      for (const treasureState of state.treasures) {
        const myTreasure = this._treasures.find((t) => t.id === treasureState.id);
        if (myTreasure) {
          myTreasure.forged = treasureState.forged;
        }
      }
    }

    if (state.prestige) {
      this.prestige = { ...state.prestige };
    }

    if (state.statistics) {
      this._stats = { ...state.statistics } as FengshenStatistics;
    }

    if (state.selectedIndex !== undefined) {
      this._selectedIndex = state.selectedIndex;
    }

    this.recalculateProduction();
    this.emit('stateChange');
  }

  // ========== 存档覆盖 ==========

  save(): SaveData {
    const data = super.save();
    data.settings = {
      immortals: this._immortals,
      treasures: this._treasures,
      stats: this._stats,
      selectedIndex: this._selectedIndex,
    };
    return data;
  }

  load(data: SaveData): void {
    super.load(data);

    if (data.settings) {
      const settings = data.settings as any;
      if (settings.immortals) {
        for (const immortalState of settings.immortals) {
          const myImmortal = this._immortals.find((i) => i.id === immortalState.id);
          if (myImmortal) {
            myImmortal.unlocked = immortalState.unlocked;
            if (immortalState.evolutionLevel !== undefined) {
              myImmortal.evolutionLevel = immortalState.evolutionLevel;
            }
          }
        }
      }
      if (settings.treasures) {
        for (const treasureState of settings.treasures) {
          const myTreasure = this._treasures.find((t) => t.id === treasureState.id);
          if (myTreasure) {
            myTreasure.forged = treasureState.forged;
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
