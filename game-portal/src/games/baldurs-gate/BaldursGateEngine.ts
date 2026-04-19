/**
 * 博德之门 (Baldur's Gate) — 放置类游戏引擎
 *
 * 继承 IdleGameEngine，实现：
 * - 多资源系统（金币/经验/魔法物品）
 * - 建筑升级系统
 * - 队友招募与升级
 * - 地下城探索系统
 * - 声望重置系统（命运点数）
 * - Canvas 暗黑奇幻风格渲染
 * - 离线收益
 * - 自动存档
 */
import { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { Resource, Upgrade, SaveData } from '@/types/idle';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GOLD_PER_CLICK,
  PRESTIGE_BONUS_MULTIPLIER,
  PRESTIGE_BASE_FATE,
  MIN_PRESTIGE_GOLD,
  COMPANIONS,
  BUILDINGS,
  DUNGEONS,
  COMPANION_UPGRADE_COSTS,
  MAX_COMPANION_LEVEL,
  COLORS,
  HERO_DRAW,
  BUILDING_PANEL,
  RESOURCE_PANEL,
  type CompanionDef,
  type BuildingDef,
  type DungeonDef,
} from './constants';

/** 队友状态 */
export interface CompanionState {
  id: string;
  unlocked: boolean;
  /** 升级等级 0-5 */
  upgradeLevel: number;
}

/** 地下城探索状态 */
export interface DungeonExploreState {
  dungeonId: string;
  startTime: number;
  duration: number;
  completed: boolean;
}

/** 游戏统计 */
export interface BaldursGateStatistics {
  totalGoldEarned: number;
  totalClicks: number;
  totalXpEarned: number;
  totalMagicItemsEarned: number;
  totalPrestigeCount: number;
  totalCompanionsUnlocked: number;
  totalUpgrades: number;
  totalDungeonsCompleted: number;
}

/** 博德之门游戏状态 */
export interface BaldursGateState {
  [key: string]: unknown;
  resources: Record<string, { amount: number; perSecond: number; unlocked: boolean }>;
  buildings: Record<string, number>;
  companions: CompanionState[];
  prestige: { currency: number; count: number };
  statistics: BaldursGateStatistics;
  selectedIndex: number;
  dungeonExplore: DungeonExploreState | null;
}

export class BaldursGateEngine extends IdleGameEngine {
  // ========== 游戏状态 ==========

  protected _gameId = 'baldurs-gate';

  constructor() {
    super();
    Object.defineProperty(this, 'statistics', {
      get: () => ({ ...this._stats }) as BaldursGateStatistics,
      set: (_val: Record<string, number>) => { /* base class writes are no-ops */ },
      configurable: true,
      enumerable: true,
    });
  }

  /** 队友状态 */
  private _companions: CompanionState[] = COMPANIONS.map((c) => ({
    id: c.id,
    unlocked: c.id === 'shadowheart',
    upgradeLevel: 0,
  }));

  /** 当前选中的建筑索引 */
  private _selectedIndex: number = 0;

  /** 统计数据 */
  private _stats: BaldursGateStatistics = {
    totalGoldEarned: 0,
    totalClicks: 0,
    totalXpEarned: 0,
    totalMagicItemsEarned: 0,
    totalPrestigeCount: 0,
    totalCompanionsUnlocked: 1,
    totalUpgrades: 0,
    totalDungeonsCompleted: 0,
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
  /** 披风摆动角度 */
  private _capeAngle: number = 0;
  /** 英雄呼吸缩放 */
  private _heroBreathe: number = 0;
  /** 点击缩放效果 */
  private _clickScale: number = 1;
  private _clickAnimTimer: number = 0;
  /** 传送门粒子 */
  private _portalParticles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
  }> = [];

  /** 火把粒子 */
  private _torchParticles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
  }> = [];

  /** 地下城探索状态 */
  private _dungeonExplore: DungeonExploreState | null = null;

  // ========== 公开属性 ==========

  get selectedIndex(): number {
    return this._selectedIndex;
  }

  get companions(): CompanionState[] {
    return this._companions.map((c) => ({ ...c }));
  }

  get totalGoldEarned(): number {
    return this._stats.totalGoldEarned;
  }

  get totalClicks(): number {
    return this._stats.totalClicks;
  }

  get dungeonExplore(): DungeonExploreState | null {
    return this._dungeonExplore ? { ...this._dungeonExplore } : null;
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
        id: 'xp',
        name: '经验',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e12,
        unlocked: false,
      },
      {
        id: 'magic_item',
        name: '魔法物品',
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
    this._companions = COMPANIONS.map((c) => ({
      id: c.id,
      unlocked: c.id === 'shadowheart',
      upgradeLevel: 0,
    }));
    this._selectedIndex = 0;
    this._stats = {
      totalGoldEarned: 0,
      totalClicks: 0,
      totalXpEarned: 0,
      totalMagicItemsEarned: 0,
      totalPrestigeCount: 0,
      totalCompanionsUnlocked: 1,
      totalUpgrades: 0,
      totalDungeonsCompleted: 0,
    };
    this._floatingTexts = [];
    this._heroAnimTimer = 0;
    this._capeAngle = 0;
    this._heroBreathe = 0;
    this._clickScale = 1;
    this._clickAnimTimer = 0;
    this._portalParticles = [];
    this._torchParticles = [];
    this._dungeonExplore = null;
  }

  protected onUpdate(deltaTime: number): void {
    // 英雄动画
    this._heroAnimTimer += deltaTime;
    this._capeAngle = Math.sin(this._heroAnimTimer * 0.004) * 0.5;
    this._heroBreathe = Math.sin(this._heroAnimTimer * 0.002) * 2;

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

    // 传送门粒子更新
    this._portalParticles = this._portalParticles.filter((p) => {
      p.life -= deltaTime;
      p.x += p.vx * (deltaTime / 1000);
      p.y += p.vy * (deltaTime / 1000);
      p.vy -= 20 * (deltaTime / 1000);
      return p.life > 0;
    });

    // 随机产生传送门粒子
    if (Math.random() < 0.03) {
      this._portalParticles.push({
        x: 380 + Math.random() * 30,
        y: 100 + Math.random() * 20,
        vx: (Math.random() - 0.5) * 20,
        vy: -10 - Math.random() * 20,
        life: 1500 + Math.random() * 1000,
        maxLife: 2500,
      });
    }

    // 火把粒子更新
    this._torchParticles = this._torchParticles.filter((p) => {
      p.life -= deltaTime;
      p.x += p.vx * (deltaTime / 1000);
      p.y += p.vy * (deltaTime / 1000);
      return p.life > 0;
    });

    // 火把粒子生成
    if (Math.random() < 0.05) {
      this._torchParticles.push({
        x: 50 + Math.random() * 10,
        y: 150 + Math.random() * 5,
        vx: (Math.random() - 0.5) * 5,
        vy: -15 - Math.random() * 10,
        life: 500 + Math.random() * 500,
        maxLife: 1000,
      });
    }
    if (Math.random() < 0.05) {
      this._torchParticles.push({
        x: 420 + Math.random() * 10,
        y: 150 + Math.random() * 5,
        vx: (Math.random() - 0.5) * 5,
        vy: -15 - Math.random() * 10,
        life: 500 + Math.random() * 500,
        maxLife: 1000,
      });
    }

    // 统计资源产出
    const gold = this.getResource('gold');
    if (gold && gold.perSecond > 0) {
      this._stats.totalGoldEarned += gold.perSecond * (deltaTime / 1000);
    }
    const xp = this.getResource('xp');
    if (xp && xp.perSecond > 0) {
      this._stats.totalXpEarned += xp.perSecond * (deltaTime / 1000);
    }
    const magicItem = this.getResource('magic_item');
    if (magicItem && magicItem.perSecond > 0) {
      this._stats.totalMagicItemsEarned += magicItem.perSecond * (deltaTime / 1000);
    }

    // 检查建筑解锁条件
    this.checkBuildingUnlocks();
    // 检查资源解锁条件
    this.checkResourceUnlocks();

    // 地下城探索进度
    this.updateDungeonExplore(deltaTime);
  }

  // ========== 核心玩法 ==========

  /**
   * 点击获得金币
   */
  click(): number {
    if (this._status !== 'playing') return 0;

    let gained = GOLD_PER_CLICK;

    // 队友点击加成
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
      x: HERO_DRAW.centerX + Math.cos(angle) * dist,
      y: HERO_DRAW.centerY + Math.sin(angle) * dist - 30,
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
   * 解锁队友
   */
  unlockCompanion(companionId: string): boolean {
    const companionDef = COMPANIONS.find((c) => c.id === companionId);
    if (!companionDef) return false;

    const companionState = this._companions.find((c) => c.id === companionId);
    if (!companionState || companionState.unlocked) return false;

    if (!this.hasResource('gold', companionDef.unlockCost)) return false;

    this.spendResource('gold', companionDef.unlockCost);
    companionState.unlocked = true;
    this._stats.totalCompanionsUnlocked++;

    // 重新计算产出
    this.recalculateProduction();

    this.emit('companionUnlocked', companionId);
    this.emit('stateChange');
    return true;
  }

  /**
   * 升级队友
   */
  upgradeCompanion(companionId: string): boolean {
    const companionState = this._companions.find((c) => c.id === companionId);
    if (!companionState || !companionState.unlocked) return false;

    const nextLevel = companionState.upgradeLevel + 1;
    if (nextLevel > MAX_COMPANION_LEVEL) return false;

    const cost = this.getCompanionUpgradeCost(nextLevel);
    if (!this.canAfford(cost)) return false;

    // 扣除资源
    for (const [resId, amount] of Object.entries(cost)) {
      this.spendResource(resId, amount);
    }

    companionState.upgradeLevel = nextLevel;
    this._stats.totalUpgrades++;

    // 重新计算产出
    this.recalculateProduction();

    this.emit('companionUpgraded', companionId, nextLevel);
    this.emit('stateChange');
    return true;
  }

  /**
   * 获取队友升级费用
   */
  getCompanionUpgradeCost(level: number): Record<string, number> {
    return COMPANION_UPGRADE_COSTS[level] ? { ...COMPANION_UPGRADE_COSTS[level] } : {};
  }

  /**
   * 获取队友升级等级
   */
  getCompanionUpgradeLevel(companionId: string): number {
    const companion = this._companions.find((c) => c.id === companionId);
    return companion ? companion.upgradeLevel : 0;
  }

  /**
   * 开始地下城探索
   */
  startDungeonExplore(dungeonId: string): boolean {
    if (this._status !== 'playing') return false;
    if (this._dungeonExplore) return false; // 已在探索中

    const dungeon = DUNGEONS.find((d) => d.id === dungeonId);
    if (!dungeon) return false;

    // 检查队友数量要求
    const unlockedCount = this._companions.filter((c) => c.unlocked).length;
    if (unlockedCount < dungeon.requiredCompanions) return false;

    this._dungeonExplore = {
      dungeonId,
      startTime: Date.now(),
      duration: dungeon.exploreTime,
      completed: false,
    };

    this.emit('dungeonExploreStarted', dungeonId);
    this.emit('stateChange');
    return true;
  }

  /**
   * 更新地下城探索进度
   */
  private updateDungeonExplore(deltaTime: number): void {
    if (!this._dungeonExplore || this._dungeonExplore.completed) return;

    const elapsed = Date.now() - this._dungeonExplore.startTime;
    if (elapsed >= this._dungeonExplore.duration) {
      this.completeDungeonExplore();
    }
  }

  /**
   * 完成地下城探索
   */
  private completeDungeonExplore(): void {
    if (!this._dungeonExplore) return;

    const dungeon = DUNGEONS.find((d) => d.id === this._dungeonExplore!.dungeonId);
    if (!dungeon) return;

    // 发放奖励
    const goldReward = dungeon.goldReward * this.getPrestigeMultiplier();
    const xpReward = dungeon.xpReward * this.getPrestigeMultiplier();
    const magicItemReward = dungeon.magicItemReward;

    this.addResource('gold', goldReward);
    this.addResource('xp', xpReward);
    this.addResource('magic_item', magicItemReward);

    this._stats.totalGoldEarned += goldReward;
    this._stats.totalXpEarned += xpReward;
    this._stats.totalMagicItemsEarned += magicItemReward;
    this._stats.totalDungeonsCompleted++;

    this._dungeonExplore.completed = true;

    // 飘字
    this._floatingTexts.push({
      text: `🏰 ${dungeon.name} 完成！+${this.formatNumber(goldReward)}💰 +${this.formatNumber(xpReward)}✨`,
      x: HERO_DRAW.centerX,
      y: HERO_DRAW.centerY - 60,
      life: 2000,
      maxLife: 2000,
      color: COLORS.accentGreen,
    });

    this.emit('dungeonExploreCompleted', dungeon.id, { goldReward, xpReward, magicItemReward });
    this.emit('stateChange');

    // 重置探索状态
    this._dungeonExplore = null;
  }

  /**
   * 获取地下城探索进度（0-1）
   */
  getDungeonExploreProgress(): number {
    if (!this._dungeonExplore) return 0;
    const elapsed = Date.now() - this._dungeonExplore.startTime;
    return Math.min(1, elapsed / this._dungeonExplore.duration);
  }

  /**
   * 检查是否可以开始地下城探索
   */
  canStartDungeonExplore(dungeonId: string): boolean {
    if (this._dungeonExplore) return false;
    const dungeon = DUNGEONS.find((d) => d.id === dungeonId);
    if (!dungeon) return false;
    const unlockedCount = this._companions.filter((c) => c.unlocked).length;
    return unlockedCount >= dungeon.requiredCompanions;
  }

  /**
   * 声望重置
   */
  doPrestige(): number {
    const gold = this.getResource('gold');
    if (!gold || this._stats.totalGoldEarned < MIN_PRESTIGE_GOLD) return 0;

    // 计算获得的命运点数
    const fateGained = Math.floor(
      PRESTIGE_BASE_FATE * Math.sqrt(this._stats.totalGoldEarned / MIN_PRESTIGE_GOLD)
    );

    if (fateGained <= 0) return 0;

    // 保存命运点数
    const savedPrestige = { ...this.prestige };
    savedPrestige.currency += fateGained;
    savedPrestige.count++;

    // 保存队友升级等级（声望保留升级等级）
    const savedCompanionUpgrades = this._companions.map((c) => ({
      id: c.id,
      upgradeLevel: c.upgradeLevel,
      unlocked: c.unlocked,
    }));

    const savedStats = {
      ...this._stats,
      totalGoldEarned: 0,
      totalClicks: 0,
      totalXpEarned: 0,
      totalMagicItemsEarned: 0,
    };

    // 重置
    this.onInit();

    // 恢复声望和部分统计
    this.prestige = savedPrestige;
    this._stats = savedStats as BaldursGateStatistics;

    // 恢复队友升级等级
    for (const saved of savedCompanionUpgrades) {
      const companion = this._companions.find((c) => c.id === saved.id);
      if (companion) {
        companion.upgradeLevel = saved.upgradeLevel;
        companion.unlocked = saved.unlocked;
      }
    }

    this.emit('prestige', fateGained);
    this.emit('stateChange');
    return fateGained;
  }

  /**
   * 获取声望加成倍率
   */
  getPrestigeMultiplier(): number {
    return 1 + this.prestige.currency * PRESTIGE_BONUS_MULTIPLIER;
  }

  /**
   * 获取点击加成倍率
   */
  getClickMultiplier(): number {
    let multiplier = 1;
    for (const companion of this._companions) {
      if (!companion.unlocked) continue;
      const def = COMPANIONS.find((c) => c.id === companion.id);
      if (!def) continue;
      if (def.bonusType === 'click' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.upgradeMultiplier, companion.upgradeLevel);
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
    for (const companion of this._companions) {
      if (!companion.unlocked) continue;
      const def = COMPANIONS.find((c) => c.id === companion.id);
      if (!def) continue;
      if (def.bonusType === 'gold_production' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.upgradeMultiplier, companion.upgradeLevel);
        multiplier += bonus;
      }
    }
    multiplier *= this.getPrestigeMultiplier();
    return multiplier;
  }

  /**
   * 获取经验生产加成倍率
   */
  getXpProductionMultiplier(): number {
    let multiplier = 1;
    for (const companion of this._companions) {
      if (!companion.unlocked) continue;
      const def = COMPANIONS.find((c) => c.id === companion.id);
      if (!def) continue;
      if (def.bonusType === 'xp_production' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.upgradeMultiplier, companion.upgradeLevel);
        multiplier += bonus;
      }
    }
    multiplier *= this.getPrestigeMultiplier();
    return multiplier;
  }

  /**
   * 获取魔法物品生产加成倍率
   */
  getMagicItemProductionMultiplier(): number {
    let multiplier = 1;
    for (const companion of this._companions) {
      if (!companion.unlocked) continue;
      const def = COMPANIONS.find((c) => c.id === companion.id);
      if (!def) continue;
      if (def.bonusType === 'magic_item_production' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.upgradeMultiplier, companion.upgradeLevel);
        multiplier += bonus;
      }
    }
    multiplier *= this.getPrestigeMultiplier();
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
   * 获取预览声望命运点数
   */
  getPrestigePreview(): number {
    if (this._stats.totalGoldEarned < MIN_PRESTIGE_GOLD) return 0;
    return Math.floor(
      PRESTIGE_BASE_FATE * Math.sqrt(this._stats.totalGoldEarned / MIN_PRESTIGE_GOLD)
    );
  }

  /**
   * 检查是否可以声望
   */
  canPrestige(): boolean {
    return this._stats.totalGoldEarned >= MIN_PRESTIGE_GOLD;
  }

  /**
   * 获取已解锁队友数量
   */
  getUnlockedCompanionCount(): number {
    return this._companions.filter((c) => c.unlocked).length;
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
      } else if (building.productionResource === 'xp') {
        production *= this.getXpProductionMultiplier();
      } else if (building.productionResource === 'magic_item') {
        production *= this.getMagicItemProductionMultiplier();
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
    // 经验：酒馆等级 >= 5 时解锁
    const tavern = this.upgrades.get('tavern');
    if (tavern && tavern.level >= 5) {
      const xp = this.resources.get('xp');
      if (xp && !xp.unlocked) {
        xp.unlocked = true;
        this.emit('resourceUnlocked', 'xp');
      }
    }

    // 魔法物品：冒险公会等级 >= 1 时解锁
    const adventureGuild = this.upgrades.get('adventure_guild');
    if (adventureGuild && adventureGuild.level >= 1) {
      const magicItem = this.resources.get('magic_item');
      if (magicItem && !magicItem.unlocked) {
        magicItem.unlocked = true;
        this.emit('resourceUnlocked', 'magic_item');
      }
    }
  }

  // ========== 渲染 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawPortalParticles(ctx);
    this.drawTorchParticles(ctx);
    this.drawHero(ctx);
    this.drawFloatingTexts(ctx);
    this.drawResourcePanel(ctx, w);
    this.drawBuildingList(ctx, w, h);
    this.drawDungeonProgress(ctx, w);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 天空渐变（暗紫色调）
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
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < 30; i++) {
      const x = ((i * 73 + 17) % w);
      const y = h * 0.45 + ((i * 47 + 23) % (h * 0.55));
      ctx.fillStyle = '#4A148C';
      ctx.fillRect(x, y, 4, 3);
    }
    ctx.globalAlpha = 1;

    // 传送门
    this.drawPortal(ctx, w);

    // 星星
    ctx.fillStyle = COLORS.textPrimary;
    const stars = [
      [30, 30], [80, 55], [150, 20], [200, 45], [320, 25],
      [370, 50], [420, 15], [460, 40],
    ];
    for (const [sx, sy] of stars) {
      ctx.globalAlpha = 0.3 + Math.sin(this._heroAnimTimer * 0.001 + sx) * 0.2;
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;

    // 火把
    this.drawTorch(ctx, 50, 150);
    this.drawTorch(ctx, 420, 150);

    // 远处的城墙
    ctx.fillStyle = '#2D1B4E';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.lineTo(0, h * 0.42);
    ctx.lineTo(40, h * 0.42);
    ctx.lineTo(40, h * 0.45);
    ctx.lineTo(80, h * 0.45);
    ctx.lineTo(80, h * 0.40);
    ctx.lineTo(120, h * 0.40);
    ctx.lineTo(120, h * 0.5);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(360, h * 0.5);
    ctx.lineTo(360, h * 0.42);
    ctx.lineTo(400, h * 0.42);
    ctx.lineTo(400, h * 0.45);
    ctx.lineTo(440, h * 0.45);
    ctx.lineTo(440, h * 0.40);
    ctx.lineTo(480, h * 0.40);
    ctx.lineTo(480, h * 0.5);
    ctx.fill();
  }

  private drawPortal(ctx: CanvasRenderingContext2D, w: number): void {
    const px = w - 80;
    const py = 80;

    // 传送门光环
    ctx.fillStyle = 'rgba(255, 215, 0, 0.1)';
    ctx.beginPath();
    ctx.ellipse(px, py, 35, 40, 0, 0, Math.PI * 2);
    ctx.fill();

    // 传送门
    ctx.fillStyle = COLORS.portalColor;
    ctx.beginPath();
    ctx.ellipse(px, py, 15, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    // 传送门内部
    ctx.fillStyle = '#1A0A2E';
    ctx.beginPath();
    ctx.ellipse(px, py, 10, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    // 光晕
    ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
    ctx.beginPath();
    ctx.ellipse(px, py, 25, 30, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawTorch(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    // 火把柄
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(x - 2, y, 4, 20);

    // 火焰
    const flicker = Math.sin(this._heroAnimTimer * 0.01 + x) * 2;
    ctx.fillStyle = COLORS.torchColor;
    ctx.beginPath();
    ctx.ellipse(x + flicker * 0.3, y - 5, 6, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFEB3B';
    ctx.beginPath();
    ctx.ellipse(x + flicker * 0.2, y - 3, 3, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawPortalParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this._portalParticles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.portalColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawTorchParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this._torchParticles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.torchColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawHero(ctx: CanvasRenderingContext2D): void {
    const cx = HERO_DRAW.centerX;
    const cy = HERO_DRAW.centerY + this._heroBreathe;
    const scale = this._clickScale;

    // 获取第一个已解锁的队友
    const unlockedCompanion = this._companions.find((c) => c.unlocked);
    const companionDef = unlockedCompanion
      ? COMPANIONS.find((c) => c.id === unlockedCompanion.id)!
      : COMPANIONS[0];

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // 身体阴影
    ctx.beginPath();
    ctx.ellipse(4, HERO_DRAW.bodyHeight * 0.8 + 4, HERO_DRAW.bodyWidth * 0.7, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.companionShadow;
    ctx.fill();

    // 腿
    ctx.fillStyle = '#4E342E';
    ctx.fillRect(-HERO_DRAW.bodyWidth * 0.3, HERO_DRAW.bodyHeight * 0.2, 8, 18);
    ctx.fillRect(HERO_DRAW.bodyWidth * 0.05, HERO_DRAW.bodyHeight * 0.2, 8, 18);

    // 披风
    ctx.save();
    ctx.translate(0, -HERO_DRAW.bodyHeight * 0.2);
    ctx.rotate(this._capeAngle);
    ctx.beginPath();
    ctx.moveTo(-HERO_DRAW.bodyWidth * 0.4, 0);
    ctx.quadraticCurveTo(
      -HERO_DRAW.bodyWidth * 0.5,
      HERO_DRAW.capeLength * 0.5,
      -HERO_DRAW.bodyWidth * 0.3,
      HERO_DRAW.capeLength
    );
    ctx.lineTo(HERO_DRAW.bodyWidth * 0.1, HERO_DRAW.capeLength * 0.8);
    ctx.lineTo(0, 0);
    ctx.fillStyle = '#4A148C';
    ctx.fill();
    ctx.restore();

    // 身体（盔甲）
    ctx.beginPath();
    ctx.ellipse(0, 0, HERO_DRAW.bodyWidth * 0.45, HERO_DRAW.bodyHeight * 0.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = companionDef.color;
    ctx.fill();

    // 盔甲细节
    ctx.beginPath();
    ctx.ellipse(0, HERO_DRAW.bodyHeight * 0.05, HERO_DRAW.bodyWidth * 0.3, HERO_DRAW.bodyHeight * 0.25, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fill();

    // 剑
    ctx.save();
    ctx.translate(HERO_DRAW.bodyWidth * 0.45, -HERO_DRAW.bodyHeight * 0.1);
    ctx.rotate(-0.3);
    ctx.fillStyle = '#B0BEC5';
    ctx.fillRect(0, 0, 3, HERO_DRAW.swordLength);
    // 剑柄
    ctx.fillStyle = '#795548';
    ctx.fillRect(-3, -2, 9, 4);
    ctx.restore();

    // 头
    ctx.beginPath();
    ctx.arc(0, -HERO_DRAW.bodyHeight * 0.45, HERO_DRAW.headRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#FFCC80';
    ctx.fill();

    // 头盔
    ctx.beginPath();
    ctx.arc(0, -HERO_DRAW.bodyHeight * 0.5, HERO_DRAW.headRadius * 0.9, Math.PI, Math.PI * 2);
    ctx.fillStyle = companionDef.color;
    ctx.fill();

    // 眼睛
    ctx.beginPath();
    ctx.arc(-HERO_DRAW.bodyWidth * 0.1, -HERO_DRAW.bodyHeight * 0.45, HERO_DRAW.eyeRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-HERO_DRAW.bodyWidth * 0.1, -HERO_DRAW.bodyHeight * 0.45, HERO_DRAW.eyeRadius * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = '#2C2C2C';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(HERO_DRAW.bodyWidth * 0.1, -HERO_DRAW.bodyHeight * 0.45, HERO_DRAW.eyeRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(HERO_DRAW.bodyWidth * 0.1, -HERO_DRAW.bodyHeight * 0.45, HERO_DRAW.eyeRadius * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = '#2C2C2C';
    ctx.fill();

    // 升级等级指示（小星星）
    if (unlockedCompanion) {
      const upgradeLevel = unlockedCompanion.upgradeLevel;
      for (let i = 0; i < upgradeLevel; i++) {
        ctx.fillStyle = COLORS.accent;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★', -12 + i * 10, -HERO_DRAW.bodyHeight * 0.75);
      }
    }

    ctx.restore();
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

  private drawResourcePanel(ctx: CanvasRenderingContext2D, w: number): void {
    const panel = RESOURCE_PANEL;
    const resources = this.getUnlockedResources();

    // 背景条
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.roundRect(ctx, panel.padding, panel.startY, w - panel.padding * 2, resources.length * (panel.itemHeight + panel.itemPadding) + panel.padding, 8);
    ctx.fill();

    let y = panel.startY + panel.padding;
    for (const res of resources) {
      const icon = res.id === 'gold' ? '💰' : res.id === 'xp' ? '✨' : '🔮';

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
            const icon = id === 'gold' ? '💰' : id === 'xp' ? '✨' : '🔮';
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
    ctx.fillText('空格 点击 · ↑↓ 选择 · Enter 购买 · U 升级队友 · D 探索 · P 声望', w / 2, h - 10);
  }

  /** 地下城进度条 */
  private drawDungeonProgress(ctx: CanvasRenderingContext2D, w: number): void {
    if (!this._dungeonExplore) return;

    const dungeon = DUNGEONS.find((d) => d.id === this._dungeonExplore!.dungeonId);
    if (!dungeon) return;

    const progress = this.getDungeonExploreProgress();
    const barWidth = w - 40;
    const barHeight = 16;
    const barX = 20;
    const barY = 330;

    // 背景
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    this.roundRect(ctx, barX, barY, barWidth, barHeight, 4);
    ctx.fill();

    // 进度
    ctx.fillStyle = COLORS.accentPurple;
    this.roundRect(ctx, barX, barY, barWidth * progress, barHeight, 4);
    ctx.fill();

    // 文字
    ctx.font = 'bold 10px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textPrimary;
    ctx.textAlign = 'center';
    ctx.fillText(`${dungeon.icon} ${dungeon.name} 探索中... ${Math.floor(progress * 100)}%`, w / 2, barY + 12);
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
      case 'u':
      case 'U':
        // 升级第一个已解锁的队友
        {
          const unlocked = this._companions.find((c) => c.unlocked);
          if (unlocked) this.upgradeCompanion(unlocked.id);
        }
        break;
      case 'd':
      case 'D':
        // 开始第一个可用的地下城探索
        {
          const available = DUNGEONS.find((d) => this.canStartDungeonExplore(d.id));
          if (available) this.startDungeonExplore(available.id);
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

  getState(): BaldursGateState {
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
      companions: this.companions,
      prestige: { ...this.prestige },
      statistics: { ...this._stats },
      selectedIndex: this._selectedIndex,
      dungeonExplore: this._dungeonExplore ? { ...this._dungeonExplore } : null,
    };
  }

  /**
   * 从状态恢复
   */
  loadState(state: BaldursGateState): void {
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

    // 恢复队友
    if (state.companions) {
      for (const companionState of state.companions) {
        const myCompanion = this._companions.find((c) => c.id === companionState.id);
        if (myCompanion) {
          myCompanion.unlocked = companionState.unlocked;
          if (companionState.upgradeLevel !== undefined) {
            myCompanion.upgradeLevel = companionState.upgradeLevel;
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
      this._stats = { ...state.statistics } as BaldursGateStatistics;
    }

    // 恢复选中
    if (state.selectedIndex !== undefined) {
      this._selectedIndex = state.selectedIndex;
    }

    // 恢复地下城探索
    if (state.dungeonExplore) {
      this._dungeonExplore = { ...state.dungeonExplore };
    }

    // 重新计算产出
    this.recalculateProduction();

    this.emit('stateChange');
  }

  // ========== 存档覆盖 ==========

  save(): SaveData {
    const data = super.save();
    data.settings = {
      companions: this._companions,
      stats: this._stats,
      selectedIndex: this._selectedIndex,
      dungeonExplore: this._dungeonExplore,
    };
    return data;
  }

  load(data: SaveData): void {
    super.load(data);

    // 恢复附加数据
    if (data.settings) {
      const settings = data.settings as any;
      if (settings.companions) {
        for (const companionState of settings.companions) {
          const myCompanion = this._companions.find((c) => c.id === companionState.id);
          if (myCompanion) {
            myCompanion.unlocked = companionState.unlocked;
            if (companionState.upgradeLevel !== undefined) {
              myCompanion.upgradeLevel = companionState.upgradeLevel;
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
      if (settings.dungeonExplore) {
        this._dungeonExplore = { ...settings.dungeonExplore };
      }
    }

    this.recalculateProduction();
  }
}
