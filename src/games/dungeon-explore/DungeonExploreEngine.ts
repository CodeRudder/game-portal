/**
 * 地下城探险 (Dungeon Explore) — 放置类游戏引擎
 *
 * 继承 IdleGameEngine，实现：
 * - 多资源系统（金币/经验/宝石）
 * - 建筑升级系统（8种建筑）
 * - 角色升级系统（经验升级）
 * - 装备系统（武器/护甲/饰品）
 * - 声望重置系统（远古之魂）
 * - Canvas 暗黑地下城风格渲染
 * - 离线收益
 * - 自动存档
 */
import { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { Resource, Upgrade, SaveData } from '@/types/idle';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  RESOURCE_IDS,
  BUILDING_IDS,
  BUILDINGS,
  EQUIPMENTS,
  GOLD_PER_CLICK,
  EXP_PER_CLICK,
  SOUL_BONUS_MULTIPLIER,
  MIN_PRESTIGE_GOLD,
  PRESTIGE_BASE_SOULS,
  MAX_CHARACTER_LEVEL,
  LEVEL_EXP_BASE,
  LEVEL_EXP_MULTIPLIER,
  COLORS,
  HERO_DRAW,
  BUILDING_PANEL,
  RESOURCE_PANEL,
  type EquipmentSlot,
  type EquipmentDef,
  type BuildingDef,
} from './constants';

/** 获取指定等级所需经验 */
function getExpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(LEVEL_EXP_BASE * Math.pow(LEVEL_EXP_MULTIPLIER, level - 2));
}

/** 装备状态 */
export interface EquipmentState {
  id: string;
  purchased: boolean;
}

/** 游戏统计 */
export interface DungeonExploreStatistics {
  totalGoldEarned: number;
  totalExpEarned: number;
  totalGemEarned: number;
  totalClicks: number;
  totalPrestigeCount: number;
  totalBuildingsPurchased: number;
  totalEquipmentsPurchased: number;
  totalLevelUps: number;
  highestLevel: number;
}

/** 地下城探险游戏状态 */
export interface DungeonExploreState {
  [key: string]: unknown;
  resources: Record<string, { amount: number; perSecond: number; unlocked: boolean }>;
  buildings: Record<string, number>;
  equipments: EquipmentState[];
  character: { level: number; exp: number };
  prestige: { currency: number; count: number };
  statistics: DungeonExploreStatistics;
  selectedIndex: number;
}

export class DungeonExploreEngine extends IdleGameEngine {
  // ========== 游戏状态 ==========

  protected _gameId = 'dungeon-explore';

  constructor() {
    super();
    // Override base class `statistics` instance field with a getter/setter,
    // because class fields shadow prototype accessors.
    Object.defineProperty(this, 'statistics', {
      get: () => ({ ...this._stats }) as DungeonExploreStatistics,
      set: (_val: Record<string, number>) => { /* base class writes are no-ops */ },
      configurable: true,
      enumerable: true,
    });
  }

  /** 装备状态 */
  private _equipments: EquipmentState[] = EQUIPMENTS.map((e) => ({
    id: e.id,
    purchased: false,
  }));

  /** 角色状态 */
  private _character: { level: number; exp: number } = {
    level: 1,
    exp: 0,
  };

  /** 当前选中的建筑索引 */
  private _selectedIndex: number = 0;

  /** 统计数据 */
  private _stats: DungeonExploreStatistics = {
    totalGoldEarned: 0,
    totalExpEarned: 0,
    totalGemEarned: 0,
    totalClicks: 0,
    totalPrestigeCount: 0,
    totalBuildingsPurchased: 0,
    totalEquipmentsPurchased: 0,
    totalLevelUps: 0,
    highestLevel: 1,
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

  /** 英雄动画计时器 */
  private _heroAnimTimer: number = 0;
  /** 英雄呼吸缩放 */
  private _heroBreathe: number = 0;
  /** 英雄武器摆动 */
  private _swordAngle: number = 0;
  /** 点击缩放效果 */
  private _clickScale: number = 1;
  private _clickAnimTimer: number = 0;
  /** 火把粒子 */
  private _torchParticles: Array<{
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

  get characterLevel(): number {
    return this._character.level;
  }

  get characterExp(): number {
    return this._character.exp;
  }

  get equipments(): EquipmentState[] {
    return this._equipments.map((e) => ({ ...e }));
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
        id: RESOURCE_IDS.GOLD,
        name: '金币',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e15,
        unlocked: true,
      },
      {
        id: RESOURCE_IDS.EXP,
        name: '经验',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e12,
        unlocked: true,
      },
      {
        id: RESOURCE_IDS.GEM,
        name: '宝石',
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
        unlocked: b.id === BUILDING_IDS.TAVERN, // 酒馆初始解锁
        requires: b.requires,
        icon: b.icon,
      }))
    );

    // 重置状态
    this._equipments = EQUIPMENTS.map((e) => ({
      id: e.id,
      purchased: false,
    }));
    this._character = { level: 1, exp: 0 };
    this._selectedIndex = 0;
    this._stats = {
      totalGoldEarned: 0,
      totalExpEarned: 0,
      totalGemEarned: 0,
      totalClicks: 0,
      totalPrestigeCount: 0,
      totalBuildingsPurchased: 0,
      totalEquipmentsPurchased: 0,
      totalLevelUps: 0,
      highestLevel: 1,
    };
    this._floatingTexts = [];
    this._heroAnimTimer = 0;
    this._heroBreathe = 0;
    this._swordAngle = 0;
    this._clickScale = 1;
    this._clickAnimTimer = 0;
    this._torchParticles = [];
  }

  protected onUpdate(deltaTime: number): void {
    // 英雄动画
    this._heroAnimTimer += deltaTime;
    this._heroBreathe = Math.sin(this._heroAnimTimer * 0.002) * 2;
    this._swordAngle = Math.sin(this._heroAnimTimer * 0.003) * 0.3;

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

    // 火把粒子更新
    this._torchParticles = this._torchParticles.filter((p) => {
      p.life -= deltaTime;
      p.x += p.vx * (deltaTime / 1000);
      p.y += p.vy * (deltaTime / 1000);
      p.vy -= 20 * (deltaTime / 1000); // 向上飘
      return p.life > 0;
    });

    // 随机产生火把粒子
    if (Math.random() < 0.03) {
      const torchX = 60 + Math.random() * 10;
      this._torchParticles.push({
        x: torchX,
        y: 120 + Math.random() * 10,
        vx: (Math.random() - 0.5) * 10,
        vy: -15 - Math.random() * 20,
        life: 800 + Math.random() * 600,
        maxLife: 1400,
      });
    }
    if (Math.random() < 0.03) {
      const torchX = 400 + Math.random() * 10;
      this._torchParticles.push({
        x: torchX,
        y: 120 + Math.random() * 10,
        vx: (Math.random() - 0.5) * 10,
        vy: -15 - Math.random() * 20,
        life: 800 + Math.random() * 600,
        maxLife: 1400,
      });
    }

    // 统计资源产出
    const gold = this.getResource(RESOURCE_IDS.GOLD);
    if (gold && gold.perSecond > 0) {
      this._stats.totalGoldEarned += gold.perSecond * (deltaTime / 1000);
    }
    const exp = this.getResource(RESOURCE_IDS.EXP);
    if (exp && exp.perSecond > 0) {
      this._stats.totalExpEarned += exp.perSecond * (deltaTime / 1000);
    }
    const gem = this.getResource(RESOURCE_IDS.GEM);
    if (gem && gem.perSecond > 0) {
      this._stats.totalGemEarned += gem.perSecond * (deltaTime / 1000);
    }

    // 检查建筑解锁条件
    this.checkBuildingUnlocks();
    // 检查资源解锁条件
    this.checkResourceUnlocks();
  }

  // ========== 核心玩法 ==========

  /**
   * 点击探索地下城
   */
  click(): number {
    if (this._status !== 'playing') return 0;

    let goldGained = GOLD_PER_CLICK;
    let expGained = EXP_PER_CLICK;

    // 装备加成
    goldGained += this.getEquipmentClickBonus('click_gold');
    expGained += this.getEquipmentClickBonus('click_exp');

    // 角色等级加成
    const levelMultiplier = 1 + (this._character.level - 1) * 0.05;
    goldGained *= levelMultiplier;

    // 声望加成
    goldGained *= this.getPrestigeMultiplier();
    expGained *= this.getPrestigeMultiplier();

    goldGained = Math.floor(goldGained * 100) / 100;
    expGained = Math.floor(expGained * 100) / 100;

    this.addResource(RESOURCE_IDS.GOLD, goldGained);
    this.addResource(RESOURCE_IDS.EXP, expGained);
    this._stats.totalGoldEarned += goldGained;
    this._stats.totalExpEarned += expGained;
    this._stats.totalClicks++;
    this.addScore(goldGained);

    // 检查升级
    this.checkLevelUp();

    // 点击动画
    this._clickScale = 1.15;
    this._clickAnimTimer = 150;

    // 飘字
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 40;
    this._floatingTexts.push({
      text: `+${this.formatNumber(goldGained)}💰`,
      x: HERO_DRAW.centerX + Math.cos(angle) * dist,
      y: HERO_DRAW.centerY + Math.sin(angle) * dist - 30,
      life: 800,
      maxLife: 800,
      color: COLORS.goldColor,
    });

    this.emit('stateChange');
    return goldGained;
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
    this._stats.totalBuildingsPurchased++;
    this.recalculateProduction();
    this.emit('upgradePurchased', upgradeId, upgrade.level);
    this.emit('stateChange');
    return true;
  }

  /**
   * 购买装备
   */
  purchaseEquipment(equipId: string): boolean {
    const equipDef = EQUIPMENTS.find((e) => e.id === equipId);
    if (!equipDef) return false;

    const equipState = this._equipments.find((e) => e.id === equipId);
    if (!equipState || equipState.purchased) return false;

    // 检查角色等级
    if (this._character.level < equipDef.requireLevel) return false;

    // 检查费用
    if (!this.canAfford(equipDef.cost)) return false;

    // 扣除资源
    for (const [resId, amount] of Object.entries(equipDef.cost)) {
      this.spendResource(resId, amount);
    }

    equipState.purchased = true;
    this._stats.totalEquipmentsPurchased++;

    // 重新计算产出（装备可能影响产出）
    this.recalculateProduction();

    this.emit('equipmentPurchased', equipId);
    this.emit('stateChange');
    return true;
  }

  /**
   * 检查角色升级
   */
  private checkLevelUp(): void {
    const exp = this.getResource(RESOURCE_IDS.EXP);
    if (!exp) return;

    while (this._character.level < MAX_CHARACTER_LEVEL) {
      const needed = getExpForLevel(this._character.level + 1);
      if (exp.amount >= needed && needed > 0) {
        this.spendResource(RESOURCE_IDS.EXP, needed);
        this._character.level++;
        this._stats.totalLevelUps++;
        if (this._character.level > this._stats.highestLevel) {
          this._stats.highestLevel = this._character.level;
        }
        this.emit('levelUp', this._character.level);
      } else {
        break;
      }
    }
  }

  /**
   * 手动升级（消耗经验）
   */
  levelUp(): boolean {
    if (this._character.level >= MAX_CHARACTER_LEVEL) return false;

    const needed = getExpForLevel(this._character.level + 1);
    const exp = this.getResource(RESOURCE_IDS.EXP);
    if (!exp || exp.amount < needed || needed <= 0) return false;

    this.spendResource(RESOURCE_IDS.EXP, needed);
    this._character.level++;
    this._stats.totalLevelUps++;
    if (this._character.level > this._stats.highestLevel) {
      this._stats.highestLevel = this._character.level;
    }

    this.emit('levelUp', this._character.level);
    this.emit('stateChange');
    return true;
  }

  /**
   * 获取升级所需经验
   */
  getExpNeededForNextLevel(): number {
    return getExpForLevel(this._character.level + 1);
  }

  /**
   * 获取指定等级所需经验
   */
  getExpForLevel(level: number): number {
    return getExpForLevel(level);
  }

  /**
   * 获取装备点击加成
   */
  private getEquipmentClickBonus(type: 'click_gold' | 'click_exp' | 'click_gem'): number {
    let bonus = 0;
    for (const eq of this._equipments) {
      if (!eq.purchased) continue;
      const def = EQUIPMENTS.find((e) => e.id === eq.id);
      if (!def || def.bonus.type !== type) continue;
      bonus += def.bonus.value;
    }
    return bonus;
  }

  /**
   * 获取装备产出加成
   */
  private getEquipmentProductionMultiplier(): number {
    let multiplier = 1;
    for (const eq of this._equipments) {
      if (!eq.purchased) continue;
      const def = EQUIPMENTS.find((e) => e.id === eq.id);
      if (!def) continue;
      if (def.bonus.type === 'production') {
        multiplier += def.bonus.value;
      }
    }
    return multiplier;
  }

  /**
   * 获取装备经验产出加成
   */
  private getEquipmentExpMultiplier(): number {
    let multiplier = 1;
    for (const eq of this._equipments) {
      if (!eq.purchased) continue;
      const def = EQUIPMENTS.find((e) => e.id === eq.id);
      if (!def) continue;
      if (def.bonus.type === 'exp_production') {
        multiplier += def.bonus.value;
      }
    }
    return multiplier;
  }

  /**
   * 获取装备宝石产出加成
   */
  private getEquipmentGemMultiplier(): number {
    let multiplier = 1;
    for (const eq of this._equipments) {
      if (!eq.purchased) continue;
      const def = EQUIPMENTS.find((e) => e.id === eq.id);
      if (!def) continue;
      if (def.bonus.type === 'gem_production') {
        multiplier += def.bonus.value;
      }
    }
    return multiplier;
  }

  /**
   * 获取装备是否已购买
   */
  isEquipmentPurchased(equipId: string): boolean {
    const eq = this._equipments.find((e) => e.id === equipId);
    return eq ? eq.purchased : false;
  }

  /**
   * 声望重置
   */
  doPrestige(): number {
    if (this._stats.totalGoldEarned < MIN_PRESTIGE_GOLD) return 0;

    // 计算获得的远古之魂
    const soulsGained = Math.floor(
      PRESTIGE_BASE_SOULS * Math.sqrt(this._stats.totalGoldEarned / MIN_PRESTIGE_GOLD)
    );

    if (soulsGained <= 0) return 0;

    // 保存远古之魂
    const savedPrestige = { ...this.prestige };
    savedPrestige.currency += soulsGained;
    savedPrestige.count++;

    // 保存角色等级（声望保留角色等级）
    const savedCharacter = { ...this._character };
    const savedStats = {
      ...this._stats,
      totalGoldEarned: 0,
      totalExpEarned: 0,
      totalGemEarned: 0,
      totalClicks: 0,
      totalBuildingsPurchased: 0,
      totalEquipmentsPurchased: 0,
      totalLevelUps: 0,
    };

    // 保存已购买的装备（声望保留装备）
    const savedEquipments = this._equipments.map((e) => ({ ...e }));

    // 重置
    this.onInit();

    // 恢复声望
    this.prestige = savedPrestige;
    this._stats = savedStats as DungeonExploreStatistics;
    this._stats.totalPrestigeCount++;

    // 恢复角色等级
    this._character = savedCharacter;

    // 恢复装备
    this._equipments = savedEquipments;

    this.emit('prestige', soulsGained);
    this.emit('stateChange');
    return soulsGained;
  }

  /**
   * 获取声望加成倍率
   */
  getPrestigeMultiplier(): number {
    return 1 + this.prestige.currency * SOUL_BONUS_MULTIPLIER;
  }

  /**
   * 获取预览声望远古之魂数
   */
  getPrestigePreview(): number {
    if (this._stats.totalGoldEarned < MIN_PRESTIGE_GOLD) return 0;
    return Math.floor(
      PRESTIGE_BASE_SOULS * Math.sqrt(this._stats.totalGoldEarned / MIN_PRESTIGE_GOLD)
    );
  }

  /**
   * 检查是否可以声望
   */
  canPrestige(): boolean {
    return this._stats.totalGoldEarned >= MIN_PRESTIGE_GOLD;
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
      if (building.productionResource === RESOURCE_IDS.GOLD) {
        production *= this.getEquipmentProductionMultiplier();
        production *= this.getPrestigeMultiplier();
      } else if (building.productionResource === RESOURCE_IDS.EXP) {
        production *= this.getEquipmentExpMultiplier();
        production *= this.getPrestigeMultiplier();
      } else if (building.productionResource === RESOURCE_IDS.GEM) {
        production *= this.getEquipmentGemMultiplier();
        production *= this.getPrestigeMultiplier();
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
    // 宝石：魔法塔等级 >= 1 时解锁
    const magicTower = this.upgrades.get(BUILDING_IDS.MAGIC_TOWER);
    if (magicTower && magicTower.level >= 1) {
      const gem = this.resources.get(RESOURCE_IDS.GEM);
      if (gem && !gem.unlocked) {
        gem.unlocked = true;
        this.emit('resourceUnlocked', RESOURCE_IDS.GEM);
      }
    }
  }

  // ========== 渲染 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawTorchParticles(ctx);
    this.drawHero(ctx);
    this.drawFloatingTexts(ctx);
    this.drawResourcePanel(ctx, w);
    this.drawBuildingList(ctx, w, h);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 天空渐变（地下城暗色调）
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
    for (let i = 0; i < 20; i++) {
      const x = ((i * 73 + 17) % w);
      const y = h * 0.45 + ((i * 47 + 23) % (h * 0.55));
      ctx.fillStyle = '#4A3070';
      ctx.fillRect(x, y, 4, 3);
    }
    ctx.globalAlpha = 1;

    // 拱门
    this.drawArchway(ctx, w);

    // 火把（左）
    this.drawTorch(ctx, 60, 100);
    // 火把（右）
    this.drawTorch(ctx, 400, 100);

    // 宝箱
    this.drawChest(ctx, w);
  }

  private drawArchway(ctx: CanvasRenderingContext2D, w: number): void {
    const h = CANVAS_HEIGHT;
    ctx.fillStyle = '#3D2066';
    ctx.beginPath();
    ctx.moveTo(w * 0.2, h * 0.5);
    ctx.quadraticCurveTo(w * 0.5, h * 0.15, w * 0.8, h * 0.5);
    ctx.lineTo(w * 0.75, h * 0.5);
    ctx.quadraticCurveTo(w * 0.5, h * 0.2, w * 0.25, h * 0.5);
    ctx.closePath();
    ctx.fill();
  }

  private drawTorch(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    // 火把柄
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(x - 3, y, 6, 30);

    // 火焰
    ctx.fillStyle = COLORS.torchColor;
    ctx.beginPath();
    ctx.ellipse(x, y - 3, 8, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // 火焰光晕
    ctx.fillStyle = COLORS.torchGlow;
    ctx.beginPath();
    ctx.ellipse(x, y - 3, 20, 25, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawChest(ctx: CanvasRenderingContext2D, w: number): void {
    const cx = w * 0.5;
    const cy = 280;

    // 宝箱底部
    ctx.fillStyle = '#6D4C41';
    ctx.fillRect(cx - 18, cy, 36, 20);

    // 宝箱盖
    ctx.fillStyle = '#8D6E63';
    ctx.beginPath();
    ctx.moveTo(cx - 20, cy);
    ctx.quadraticCurveTo(cx, cy - 15, cx + 20, cy);
    ctx.closePath();
    ctx.fill();

    // 锁扣
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(cx - 3, cy + 5, 6, 8);
  }

  private drawTorchParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this._torchParticles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.torchColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawHero(ctx: CanvasRenderingContext2D): void {
    const cx = HERO_DRAW.centerX;
    const cy = HERO_DRAW.centerY + this._heroBreathe;
    const scale = this._clickScale;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // 身体阴影
    ctx.beginPath();
    ctx.ellipse(4, HERO_DRAW.bodyHeight * 0.8 + 4, HERO_DRAW.bodyWidth * 0.7, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.shadow;
    ctx.fill();

    // 腿
    ctx.fillStyle = '#4A3070';
    ctx.fillRect(-HERO_DRAW.bodyWidth * 0.3, HERO_DRAW.bodyHeight * 0.3, 7, HERO_DRAW.legHeight);
    ctx.fillRect(HERO_DRAW.bodyWidth * 0.1, HERO_DRAW.bodyHeight * 0.3, 7, HERO_DRAW.legHeight);

    // 身体
    ctx.beginPath();
    ctx.ellipse(0, 0, HERO_DRAW.bodyWidth * 0.5, HERO_DRAW.bodyHeight * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#5C6BC0';
    ctx.fill();

    // 头
    ctx.beginPath();
    ctx.arc(0, -HERO_DRAW.bodyHeight * 0.5, HERO_DRAW.headRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#FFCC80';
    ctx.fill();

    // 头盔
    ctx.beginPath();
    ctx.arc(0, -HERO_DRAW.bodyHeight * 0.5 - 4, HERO_DRAW.headRadius + 2, Math.PI, 0);
    ctx.fillStyle = '#78909C';
    ctx.fill();

    // 眼睛
    ctx.beginPath();
    ctx.arc(-4, -HERO_DRAW.bodyHeight * 0.52, HERO_DRAW.eyeRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-4, -HERO_DRAW.bodyHeight * 0.52, HERO_DRAW.eyeRadius * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = '#2C2C2C';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(4, -HERO_DRAW.bodyHeight * 0.52, HERO_DRAW.eyeRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(4, -HERO_DRAW.bodyHeight * 0.52, HERO_DRAW.eyeRadius * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = '#2C2C2C';
    ctx.fill();

    // 剑
    ctx.save();
    ctx.translate(HERO_DRAW.bodyWidth * 0.5, -HERO_DRAW.bodyHeight * 0.1);
    ctx.rotate(this._swordAngle);
    ctx.fillStyle = '#B0BEC5';
    ctx.fillRect(0, 0, 4, HERO_DRAW.swordLength);
    // 剑柄
    ctx.fillStyle = '#795548';
    ctx.fillRect(-3, -2, 10, 5);
    ctx.restore();

    // 角色等级标识
    ctx.fillStyle = COLORS.accent;
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Lv.${this._character.level}`, 0, -HERO_DRAW.bodyHeight * 0.5 - HERO_DRAW.headRadius - 8);

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
      const icon = res.id === RESOURCE_IDS.GOLD ? '💰' : res.id === RESOURCE_IDS.EXP ? '⭐' : '💎';

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

    // 角色等级显示
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.accent;
    ctx.textAlign = 'right';
    const needed = this.getExpNeededForNextLevel();
    const expRes = this.getResource(RESOURCE_IDS.EXP);
    const expText = this._character.level >= MAX_CHARACTER_LEVEL
      ? `Lv.${this._character.level} MAX`
      : `Lv.${this._character.level} (${this.formatNumber(expRes?.amount ?? 0)}/${this.formatNumber(needed)})`;
    ctx.fillText(expText, w - panel.padding, panel.startY + resources.length * (panel.itemHeight + panel.itemPadding) + panel.padding + 16);
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
            const icon = id === RESOURCE_IDS.GOLD ? '💰' : id === RESOURCE_IDS.EXP ? '⭐' : '💎';
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
    ctx.fillText('空格 探索 · ↑↓ 选择 · Enter 购买 · L 升级 · E 装备 · P 声望', w / 2, h - 10);
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
      case 'l':
      case 'L':
        this.levelUp();
        break;
      case 'e':
      case 'E':
        // 购买第一个未购买的装备
        {
          const unpurchased = this._equipments.find((e) => !e.purchased);
          if (unpurchased) this.purchaseEquipment(unpurchased.id);
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

  getState(): DungeonExploreState {
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
      equipments: this.equipments,
      character: { ...this._character },
      prestige: { ...this.prestige },
      statistics: { ...this._stats },
      selectedIndex: this._selectedIndex,
    };
  }

  /**
   * 从状态恢复
   */
  loadState(state: DungeonExploreState): void {
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

    // 恢复装备
    if (state.equipments) {
      for (const eqState of state.equipments) {
        const myEq = this._equipments.find((e) => e.id === eqState.id);
        if (myEq) {
          myEq.purchased = eqState.purchased;
        }
      }
    }

    // 恢复角色
    if (state.character) {
      this._character = { ...state.character };
    }

    // 恢复声望
    if (state.prestige) {
      this.prestige = { ...state.prestige };
    }

    // 恢复统计
    if (state.statistics) {
      this._stats = { ...state.statistics } as DungeonExploreStatistics;
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
    // 附加装备、角色和统计信息到 settings
    data.settings = {
      equipments: this._equipments,
      character: this._character,
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
      if (settings.equipments) {
        for (const eqState of settings.equipments) {
          const myEq = this._equipments.find((e) => e.id === eqState.id);
          if (myEq) {
            myEq.purchased = eqState.purchased;
          }
        }
      }
      if (settings.character) {
        this._character = { ...settings.character };
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
