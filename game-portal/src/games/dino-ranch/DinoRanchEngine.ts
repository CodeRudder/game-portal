/**
 * 恐龙牧场 (Dino Ranch) — 放置类游戏引擎
 *
 * 继承 IdleGameEngine，实现：
 * - 多资源系统（肉/恐龙蛋/化石/基因碎片）
 * - 建筑升级系统
 * - 恐龙品种解锁与进化
 * - 声望重置系统（远古基因）
 * - Canvas 像素复古风格渲染
 * - 离线收益
 * - 自动存档
 */
import { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { Resource, Upgrade, SaveData } from '@/types/idle';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  MEAT_PER_CLICK,
  GENE_BONUS_MULTIPLIER,
  PRESTIGE_BASE_GENES,
  PRESTIGE_MIN_TOTAL_MEAT,
  DINO_BREEDS,
  BUILDINGS,
  COLORS,
  DINO_DRAW,
  BUILDING_PANEL,
  RESOURCE_PANEL,
  type DinoBreedDef,
  type BuildingDef,
} from './constants';

/** 恐龙品种状态 */
export interface DinoBreedState {
  id: string;
  unlocked: boolean;
  /** 进化等级 0-5 */
  evolutionLevel: number;
}

/** 游戏统计 */
export interface DinoRanchStatistics {
  totalMeatEarned: number;
  totalClicks: number;
  totalEggsEarned: number;
  totalFossilsEarned: number;
  totalGeneFragmentsEarned: number;
  totalPrestigeCount: number;
  totalDinosUnlocked: number;
  totalEvolutions: number;
}

/** 恐龙牧场游戏状态 */
export interface DinoRanchState {
  [key: string]: unknown;
  resources: Record<string, { amount: number; perSecond: number; unlocked: boolean }>;
  buildings: Record<string, number>;
  dinos: DinoBreedState[];
  prestige: { currency: number; count: number };
  statistics: DinoRanchStatistics;
  selectedIndex: number;
}

/** 进化费用表（按进化等级） */
const EVOLUTION_COSTS: Record<number, Record<string, number>> = {
  1: { dino_eggs: 10, fossils: 5 },
  2: { dino_eggs: 50, fossils: 20, gene_fragments: 5 },
  3: { dino_eggs: 200, fossils: 80, gene_fragments: 20 },
  4: { dino_eggs: 800, fossils: 300, gene_fragments: 50 },
  5: { dino_eggs: 3000, fossils: 1000, gene_fragments: 150 },
};

/** 最大进化等级 */
const MAX_EVOLUTION_LEVEL = 5;

export class DinoRanchEngine extends IdleGameEngine {
  // ========== 游戏状态 ==========

  protected _gameId = 'dino-ranch';

  constructor() {
    super();
    // Override base class `statistics` instance field with a getter/setter,
    // because class fields shadow prototype accessors.
    Object.defineProperty(this, 'statistics', {
      get: () => ({ ...this._stats }) as DinoRanchStatistics,
      set: (_val: Record<string, number>) => { /* base class writes are no-ops */ },
      configurable: true,
      enumerable: true,
    });
  }

  /** 恐龙品种状态 */
  private _dinos: DinoBreedState[] = DINO_BREEDS.map((d) => ({
    id: d.id,
    unlocked: d.id === 'velociraptor', // 迅猛龙初始解锁
    evolutionLevel: 0,
  }));

  /** 当前选中的建筑索引 */
  private _selectedIndex: number = 0;

  /** 统计数据 */
  private _stats: DinoRanchStatistics = {
    totalMeatEarned: 0,
    totalClicks: 0,
    totalEggsEarned: 0,
    totalFossilsEarned: 0,
    totalGeneFragmentsEarned: 0,
    totalPrestigeCount: 0,
    totalDinosUnlocked: 1,
    totalEvolutions: 0,
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

  /** 恐龙动画计时器 */
  private _dinoAnimTimer: number = 0;
  /** 恐龙尾巴摆动角度 */
  private _tailAngle: number = 0;
  /** 恐龙呼吸缩放 */
  private _dinoBreathe: number = 0;
  /** 点击缩放效果 */
  private _clickScale: number = 1;
  private _clickAnimTimer: number = 0;
  /** 火山喷发粒子 */
  private _lavaParticles: Array<{
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

  get dinos(): DinoBreedState[] {
    return this._dinos.map((d) => ({ ...d }));
  }

  get totalMeatEarned(): number {
    return this._stats.totalMeatEarned;
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
        id: 'meat',
        name: '肉',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e15,
        unlocked: true,
      },
      {
        id: 'dino_eggs',
        name: '恐龙蛋',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e12,
        unlocked: false,
      },
      {
        id: 'fossils',
        name: '化石',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e9,
        unlocked: false,
      },
      {
        id: 'gene_fragments',
        name: '基因碎片',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e6,
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
        unlocked: b.id === 'fence', // 围栏初始解锁
        requires: b.requires,
        icon: b.icon,
      }))
    );

    // 重置状态
    this._dinos = DINO_BREEDS.map((d) => ({
      id: d.id,
      unlocked: d.id === 'velociraptor',
      evolutionLevel: 0,
    }));
    this._selectedIndex = 0;
    this._stats = {
      totalMeatEarned: 0,
      totalClicks: 0,
      totalEggsEarned: 0,
      totalFossilsEarned: 0,
      totalGeneFragmentsEarned: 0,
      totalPrestigeCount: 0,
      totalDinosUnlocked: 1,
      totalEvolutions: 0,
    };
    this._floatingTexts = [];
    this._dinoAnimTimer = 0;
    this._tailAngle = 0;
    this._dinoBreathe = 0;
    this._clickScale = 1;
    this._clickAnimTimer = 0;
    this._lavaParticles = [];
    this._stats.totalMeatEarned = 0;
    this._stats.totalClicks = 0;
  }

  protected onUpdate(deltaTime: number): void {
    // 恐龙动画
    this._dinoAnimTimer += deltaTime;
    this._tailAngle = Math.sin(this._dinoAnimTimer * 0.004) * 0.5;
    this._dinoBreathe = Math.sin(this._dinoAnimTimer * 0.002) * 2;

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

    // 火山粒子更新
    this._lavaParticles = this._lavaParticles.filter((p) => {
      p.life -= deltaTime;
      p.x += p.vx * (deltaTime / 1000);
      p.y += p.vy * (deltaTime / 1000);
      p.vy += 50 * (deltaTime / 1000); // 重力
      return p.life > 0;
    });

    // 随机产生火山粒子
    if (Math.random() < 0.02) {
      this._lavaParticles.push({
        x: 420 + Math.random() * 20,
        y: 120 + Math.random() * 10,
        vx: (Math.random() - 0.5) * 30,
        vy: -20 - Math.random() * 30,
        life: 1500 + Math.random() * 1000,
        maxLife: 2500,
      });
    }

    // 统计资源产出
    const meat = this.getResource('meat');
    if (meat && meat.perSecond > 0) {
      this._stats.totalMeatEarned += meat.perSecond * (deltaTime / 1000);
    }
    const eggs = this.getResource('dino_eggs');
    if (eggs && eggs.perSecond > 0) {
      this._stats.totalEggsEarned += eggs.perSecond * (deltaTime / 1000);
    }
    const fossils = this.getResource('fossils');
    if (fossils && fossils.perSecond > 0) {
      this._stats.totalFossilsEarned += fossils.perSecond * (deltaTime / 1000);
    }
    const genes = this.getResource('gene_fragments');
    if (genes && genes.perSecond > 0) {
      this._stats.totalGeneFragmentsEarned += genes.perSecond * (deltaTime / 1000);
    }

    // 检查建筑解锁条件
    this.checkBuildingUnlocks();
    // 检查资源解锁条件
    this.checkResourceUnlocks();
  }

  // ========== 核心玩法 ==========

  /**
   * 点击获得肉
   */
  click(): number {
    if (this._status !== 'playing') return 0;

    let gained = MEAT_PER_CLICK;

    // 恐龙点击加成
    gained *= this.getClickMultiplier();

    // 声望加成
    gained *= this.getPrestigeMultiplier();

    gained = Math.floor(gained * 100) / 100;

    this.addResource('meat', gained);
    this._stats.totalMeatEarned += gained;
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
      x: DINO_DRAW.centerX + Math.cos(angle) * dist,
      y: DINO_DRAW.centerY + Math.sin(angle) * dist - 30,
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
   * 解锁恐龙品种
   */
  unlockDino(breedId: string): boolean {
    const breedDef = DINO_BREEDS.find((b) => b.id === breedId);
    if (!breedDef) return false;

    const dinoState = this._dinos.find((d) => d.id === breedId);
    if (!dinoState || dinoState.unlocked) return false;

    if (!this.hasResource('meat', breedDef.unlockCost)) return false;

    this.spendResource('meat', breedDef.unlockCost);
    dinoState.unlocked = true;
    this._stats.totalDinosUnlocked++;

    // 重新计算产出（恐龙加成可能影响产出）
    this.recalculateProduction();

    this.emit('dinoUnlocked', breedId);
    this.emit('stateChange');
    return true;
  }

  /**
   * 进化恐龙
   */
  evolveDino(breedId: string): boolean {
    const dinoState = this._dinos.find((d) => d.id === breedId);
    if (!dinoState || !dinoState.unlocked) return false;

    const nextLevel = dinoState.evolutionLevel + 1;
    if (nextLevel > MAX_EVOLUTION_LEVEL) return false;

    const cost = this.getEvolutionCost(nextLevel);
    if (!this.canAfford(cost)) return false;

    // 扣除资源
    for (const [resId, amount] of Object.entries(cost)) {
      this.spendResource(resId, amount);
    }

    dinoState.evolutionLevel = nextLevel;
    this._stats.totalEvolutions++;

    // 重新计算产出
    this.recalculateProduction();

    this.emit('dinoEvolved', breedId, nextLevel);
    this.emit('stateChange');
    return true;
  }

  /**
   * 获取进化费用
   */
  getEvolutionCost(level: number): Record<string, number> {
    return EVOLUTION_COSTS[level] ? { ...EVOLUTION_COSTS[level] } : {};
  }

  /**
   * 获取恐龙进化等级
   */
  getDinoEvolutionLevel(breedId: string): number {
    const dino = this._dinos.find((d) => d.id === breedId);
    return dino ? dino.evolutionLevel : 0;
  }

  /**
   * 声望重置
   */
  doPrestige(): number {
    const meat = this.getResource('meat');
    if (!meat || this._stats.totalMeatEarned < PRESTIGE_MIN_TOTAL_MEAT) return 0;

    // 计算获得的远古基因
    const genesGained = Math.floor(
      PRESTIGE_BASE_GENES * Math.sqrt(this._stats.totalMeatEarned / PRESTIGE_MIN_TOTAL_MEAT)
    );

    if (genesGained <= 0) return 0;

    // 保存远古基因
    const prevGenes = this.prestige.currency;
    this.prestige.currency += genesGained;
    this.prestige.count++;
    this._stats.totalPrestigeCount++;

    // 重置资源和建筑（保留远古基因和声望数据）
    const savedPrestige = { ...this.prestige };
    const savedStats = {
      ...this._stats,
      totalMeatEarned: 0,
      totalClicks: 0,
      totalEggsEarned: 0,
      totalFossilsEarned: 0,
      totalGeneFragmentsEarned: 0,
    };

    // 保存恐龙进化等级（声望保留进化等级）
    const savedDinoEvolutions = this._dinos.map((d) => ({
      id: d.id,
      evolutionLevel: d.evolutionLevel,
      unlocked: d.unlocked,
    }));

    // 重置
    this.onInit();

    // 恢复声望和部分统计
    this.prestige = savedPrestige;
    this._stats = savedStats as DinoRanchStatistics;

    // 恢复恐龙进化等级
    for (const saved of savedDinoEvolutions) {
      const dino = this._dinos.find((d) => d.id === saved.id);
      if (dino) {
        dino.evolutionLevel = saved.evolutionLevel;
        dino.unlocked = saved.unlocked;
      }
    }

    this.emit('prestige', genesGained);
    this.emit('stateChange');
    return genesGained;
  }

  /**
   * 获取声望加成倍率
   */
  getPrestigeMultiplier(): number {
    return 1 + this.prestige.currency * GENE_BONUS_MULTIPLIER;
  }

  /**
   * 获取点击加成倍率
   */
  getClickMultiplier(): number {
    let multiplier = 1;
    for (const dino of this._dinos) {
      if (!dino.unlocked) continue;
      const def = DINO_BREEDS.find((b) => b.id === dino.id);
      if (!def) continue;
      if (def.bonusType === 'click' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        // 进化加成
        bonus *= Math.pow(def.evolutionMultiplier, dino.evolutionLevel);
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
    for (const dino of this._dinos) {
      if (!dino.unlocked) continue;
      const def = DINO_BREEDS.find((b) => b.id === dino.id);
      if (!def) continue;
      if (def.bonusType === 'production' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.evolutionMultiplier, dino.evolutionLevel);
        multiplier += bonus;
      }
    }
    // 声望加成
    multiplier *= this.getPrestigeMultiplier();
    return multiplier;
  }

  /**
   * 获取恐龙蛋加成倍率
   */
  getEggMultiplier(): number {
    let multiplier = 1;
    for (const dino of this._dinos) {
      if (!dino.unlocked) continue;
      const def = DINO_BREEDS.find((b) => b.id === dino.id);
      if (!def) continue;
      if (def.bonusType === 'egg' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.evolutionMultiplier, dino.evolutionLevel);
        multiplier += bonus;
      }
    }
    return multiplier;
  }

  /**
   * 获取化石加成倍率
   */
  getFossilMultiplier(): number {
    let multiplier = 1;
    for (const dino of this._dinos) {
      if (!dino.unlocked) continue;
      const def = DINO_BREEDS.find((b) => b.id === dino.id);
      if (!def) continue;
      if (def.bonusType === 'fossil' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.evolutionMultiplier, dino.evolutionLevel);
        multiplier += bonus;
      }
    }
    return multiplier;
  }

  /**
   * 获取基因碎片加成倍率
   */
  getGeneFragmentMultiplier(): number {
    let multiplier = 1;
    for (const dino of this._dinos) {
      if (!dino.unlocked) continue;
      const def = DINO_BREEDS.find((b) => b.id === dino.id);
      if (!def) continue;
      if (def.bonusType === 'gene_fragment' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.evolutionMultiplier, dino.evolutionLevel);
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
   * 获取预览声望远古基因数
   */
  getPrestigePreview(): number {
    if (this._stats.totalMeatEarned < PRESTIGE_MIN_TOTAL_MEAT) return 0;
    return Math.floor(
      PRESTIGE_BASE_GENES * Math.sqrt(this._stats.totalMeatEarned / PRESTIGE_MIN_TOTAL_MEAT)
    );
  }

  /**
   * 检查是否可以声望
   */
  canPrestige(): boolean {
    return this._stats.totalMeatEarned >= PRESTIGE_MIN_TOTAL_MEAT;
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
      if (building.productionResource === 'meat') {
        production *= this.getProductionMultiplier();
      } else if (building.productionResource === 'dino_eggs') {
        production *= this.getEggMultiplier() * this.getPrestigeMultiplier();
      } else if (building.productionResource === 'fossils') {
        production *= this.getFossilMultiplier() * this.getPrestigeMultiplier();
      } else if (building.productionResource === 'gene_fragments') {
        production *= this.getGeneFragmentMultiplier() * this.getPrestigeMultiplier();
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
    // 恐龙蛋：围栏等级 >= 5 时解锁
    const fence = this.upgrades.get('fence');
    if (fence && fence.level >= 5) {
      const eggs = this.resources.get('dino_eggs');
      if (eggs && !eggs.unlocked) {
        eggs.unlocked = true;
        this.emit('resourceUnlocked', 'dino_eggs');
      }
    }

    // 化石：孵化室等级 >= 3 时解锁
    const hatchery = this.upgrades.get('hatchery');
    if (hatchery && hatchery.level >= 3) {
      const fossils = this.resources.get('fossils');
      if (fossils && !fossils.unlocked) {
        fossils.unlocked = true;
        this.emit('resourceUnlocked', 'fossils');
      }
    }

    // 基因碎片：通过建筑解锁
    const geneLab = this.upgrades.get('gene_lab');
    if (geneLab && geneLab.level >= 1) {
      const genes = this.resources.get('gene_fragments');
      if (genes && !genes.unlocked) {
        genes.unlocked = true;
        this.emit('resourceUnlocked', 'gene_fragments');
      }
    }
  }

  // ========== 渲染 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawLavaParticles(ctx);
    this.drawDino(ctx);
    this.drawFloatingTexts(ctx);
    this.drawResourcePanel(ctx, w);
    this.drawBuildingList(ctx, w, h);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 天空渐变（火山色调）
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

    // 地面纹理（像素风格小石头）
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < 30; i++) {
      const x = ((i * 73 + 17) % w);
      const y = h * 0.45 + ((i * 47 + 23) % (h * 0.55));
      ctx.fillStyle = '#4E342E';
      ctx.fillRect(x, y, 3, 2);
    }
    ctx.globalAlpha = 1;

    // 火山
    this.drawVolcano(ctx, w);

    // 月亮
    ctx.beginPath();
    ctx.arc(60, 50, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF8E1';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(60, 50, 24, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 248, 225, 0.15)';
    ctx.fill();

    // 远处的小山
    ctx.fillStyle = '#4E342E';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.quadraticCurveTo(80, h * 0.38, 160, h * 0.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(200, h * 0.5);
    ctx.quadraticCurveTo(300, h * 0.35, 380, h * 0.5);
    ctx.fill();
  }

  private drawVolcano(ctx: CanvasRenderingContext2D, w: number): void {
    const vx = w - 80;
    const vy = 60;

    // 火山体
    ctx.fillStyle = '#3E2723';
    ctx.beginPath();
    ctx.moveTo(vx - 60, 200);
    ctx.lineTo(vx - 15, vy);
    ctx.lineTo(vx + 15, vy);
    ctx.lineTo(vx + 60, 200);
    ctx.closePath();
    ctx.fill();

    // 火山口发光
    ctx.fillStyle = COLORS.lavaColor;
    ctx.beginPath();
    ctx.ellipse(vx, vy, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 火山口光晕
    ctx.fillStyle = 'rgba(255, 61, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(vx, vy, 25, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawLavaParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this._lavaParticles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.lavaColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawDino(ctx: CanvasRenderingContext2D): void {
    const cx = DINO_DRAW.centerX;
    const cy = DINO_DRAW.centerY + this._dinoBreathe;
    const scale = this._clickScale;

    // 获取第一个已解锁的恐龙
    const unlockedDino = this._dinos.find((d) => d.unlocked);
    const breedDef = unlockedDino
      ? DINO_BREEDS.find((b) => b.id === unlockedDino.id)!
      : DINO_BREEDS[0];

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // 身体阴影
    ctx.beginPath();
    ctx.ellipse(4, DINO_DRAW.bodyHeight * 0.8 + 4, DINO_DRAW.bodyWidth * 0.7, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.dinoShadow;
    ctx.fill();

    // 腿
    ctx.fillStyle = breedDef.color;
    ctx.fillRect(-DINO_DRAW.bodyWidth * 0.35, DINO_DRAW.bodyHeight * 0.3, 8, DINO_DRAW.legHeight);
    ctx.fillRect(DINO_DRAW.bodyWidth * 0.1, DINO_DRAW.bodyHeight * 0.3, 8, DINO_DRAW.legHeight);

    // 尾巴
    ctx.save();
    ctx.translate(DINO_DRAW.bodyWidth * 0.45, 0);
    ctx.rotate(this._tailAngle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(DINO_DRAW.tailLength * 0.5, -15, DINO_DRAW.tailLength, -5);
    ctx.quadraticCurveTo(DINO_DRAW.tailLength * 0.5, 5, 0, 0);
    ctx.fillStyle = breedDef.color;
    ctx.fill();
    ctx.restore();

    // 身体
    ctx.beginPath();
    ctx.ellipse(0, 0, DINO_DRAW.bodyWidth * 0.5, DINO_DRAW.bodyHeight * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = breedDef.color;
    ctx.fill();

    // 腹部
    ctx.beginPath();
    ctx.ellipse(0, DINO_DRAW.bodyHeight * 0.1, DINO_DRAW.bodyWidth * 0.35, DINO_DRAW.bodyHeight * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = breedDef.bellyColor;
    ctx.fill();

    // 头
    ctx.beginPath();
    ctx.arc(-DINO_DRAW.bodyWidth * 0.3, -DINO_DRAW.bodyHeight * 0.5, DINO_DRAW.headRadius, 0, Math.PI * 2);
    ctx.fillStyle = breedDef.color;
    ctx.fill();

    // 眼睛
    ctx.beginPath();
    ctx.arc(-DINO_DRAW.bodyWidth * 0.35, -DINO_DRAW.bodyHeight * 0.55, DINO_DRAW.eyeRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-DINO_DRAW.bodyWidth * 0.35, -DINO_DRAW.bodyHeight * 0.55, DINO_DRAW.eyeRadius * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = '#2C2C2C';
    ctx.fill();

    // 眼睛高光
    ctx.beginPath();
    ctx.arc(-DINO_DRAW.bodyWidth * 0.35 + 1.5, -DINO_DRAW.bodyHeight * 0.55 - 1.5, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // 嘴巴
    ctx.beginPath();
    ctx.arc(-DINO_DRAW.bodyWidth * 0.45, -DINO_DRAW.bodyHeight * 0.4, 4, 0, Math.PI * 0.8);
    ctx.strokeStyle = '#2C2C2C';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 进化等级指示（小星星）
    if (unlockedDino) {
      const evoLevel = unlockedDino.evolutionLevel;
      for (let i = 0; i < evoLevel; i++) {
        ctx.fillStyle = COLORS.accent;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★', -DINO_DRAW.bodyWidth * 0.3 - 12 + i * 10, -DINO_DRAW.bodyHeight * 0.8);
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
      const icon = res.id === 'meat' ? '🥩' : res.id === 'dino_eggs' ? '🥚' : res.id === 'fossils' ? '🦴' : '🧬';

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
            const icon = id === 'meat' ? '🥩' : id === 'dino_eggs' ? '🥚' : id === 'fossils' ? '🦴' : '🧬';
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
    ctx.fillText('空格 点击 · ↑↓ 选择 · Enter 购买 · E 进化 · P 声望', w / 2, h - 10);
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
      case 'e':
      case 'E':
        // 进化当前选中的恐龙（第一个已解锁的）
        {
          const unlocked = this._dinos.find((d) => d.unlocked);
          if (unlocked) this.evolveDino(unlocked.id);
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

  getState(): DinoRanchState {
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
      dinos: this.dinos,
      prestige: { ...this.prestige },
      statistics: { ...this._stats },
      selectedIndex: this._selectedIndex,
    };
  }

  /**
   * 从状态恢复
   */
  loadState(state: DinoRanchState): void {
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

    // 恢复恐龙
    if (state.dinos) {
      for (const dinoState of state.dinos) {
        const myDino = this._dinos.find((d) => d.id === dinoState.id);
        if (myDino) {
          myDino.unlocked = dinoState.unlocked;
          if (dinoState.evolutionLevel !== undefined) {
            myDino.evolutionLevel = dinoState.evolutionLevel;
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
      this._stats = { ...state.statistics } as DinoRanchStatistics;
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
    // 附加恐龙和统计信息到 settings
    data.settings = {
      dinos: this._dinos,
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
      if (settings.dinos) {
        for (const dinoState of settings.dinos) {
          const myDino = this._dinos.find((d) => d.id === dinoState.id);
          if (myDino) {
            myDino.unlocked = dinoState.unlocked;
            if (dinoState.evolutionLevel !== undefined) {
              myDino.evolutionLevel = dinoState.evolutionLevel;
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
