/**
 * 埃及神话 (Egypt Myth) — 放置类游戏引擎
 *
 * 继承 IdleGameEngine，实现：
 * - 多资源系统（黄金/莎草纸/神圣之力）
 * - 建筑升级系统（8种建筑）
 * - 神明庇护系统（6位神明）
 * - 木乃伊系统（3种木乃伊，碎片收集）
 * - 神明恩赐系统（定期奖励）
 * - 声望重置系统（神圣之力）
 * - Canvas 古埃及风格渲染
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
  PRESTIGE_BASE_DIVINE,
  MIN_PRESTIGE_GOLD,
  GODS,
  MUMMIES,
  BUILDINGS,
  COLORS,
  GOD_DRAW,
  BUILDING_PANEL,
  RESOURCE_PANEL,
  RESOURCE_IDS,
  type GodDef,
  type MummyDef,
  type BuildingDef,
} from './constants';

// ========== 类型定义 ==========

/** 神明状态 */
export interface GodState {
  id: string;
  unlocked: boolean;
  /** 庇护等级 0-5 */
  blessingLevel: number;
}

/** 木乃伊状态 */
export interface MummyState {
  id: string;
  /** 当前碎片数 */
  fragments: number;
  /** 是否已召唤 */
  summoned: boolean;
}

/** 神明恩赐状态 */
export interface BlessingState {
  /** 上次恩赐时间戳 */
  lastBlessingTime: number;
  /** 恩赐间隔（毫秒） */
  interval: number;
  /** 已领取次数 */
  claimedCount: number;
}

/** 游戏统计 */
export interface EgyptMythStatistics {
  totalGoldEarned: number;
  totalClicks: number;
  totalPapyrusEarned: number;
  totalDivinePowerEarned: number;
  totalPrestigeCount: number;
  totalGodsUnlocked: number;
  totalBlessingsClaimed: number;
  totalMummiesSummoned: number;
}

/** 埃及神话游戏状态 */
export interface EgyptMythState {
  [key: string]: unknown;
  resources: Record<string, { amount: number; perSecond: number; unlocked: boolean }>;
  buildings: Record<string, number>;
  gods: GodState[];
  mummies: MummyState[];
  blessing: BlessingState;
  prestige: { currency: number; count: number };
  statistics: EgyptMythStatistics;
  selectedIndex: number;
}

// ========== 常量 ==========

/** 庇护升级费用表（按庇护等级） */
const BLESSING_COSTS: Record<number, Record<string, number>> = {
  1: { gold: 500, papyrus: 10 },
  2: { gold: 2000, papyrus: 50, divine_power: 5 },
  3: { gold: 8000, papyrus: 200, divine_power: 20 },
  4: { gold: 30000, papyrus: 800, divine_power: 60 },
  5: { gold: 100000, papyrus: 3000, divine_power: 200 },
};

/** 最大庇护等级 */
const MAX_BLESSING_LEVEL = 5;

/** 神明恩赐基础间隔（毫秒） */
const BLESSING_INTERVAL = 120_000; // 2 分钟

/** 木乃伊碎片掉落概率 */
const MUMMY_FRAGMENT_DROP_RATE = 0.05;

/** 恩赐奖励基数 */
const BLESSING_GOLD_BASE = 100;
const BLESSING_PAPYRUS_BASE = 5;

export class EgyptMythEngine extends IdleGameEngine {
  // ========== 游戏状态 ==========

  protected _gameId = 'egypt-myth';

  constructor() {
    super();
    Object.defineProperty(this, 'statistics', {
      get: () => ({ ...this._stats }) as EgyptMythStatistics,
      set: (_val: Record<string, number>) => { /* base class writes are no-ops */ },
      configurable: true,
      enumerable: true,
    });
  }

  /** 神明状态 */
  private _gods: GodState[] = GODS.map((g) => ({
    id: g.id,
    unlocked: g.id === 'ra', // 拉神初始解锁
    blessingLevel: 0,
  }));

  /** 木乃伊状态 */
  private _mummies: MummyState[] = MUMMIES.map((m) => ({
    id: m.id,
    fragments: 0,
    summoned: false,
  }));

  /** 神明恩赐状态 */
  private _blessing: BlessingState = {
    lastBlessingTime: 0,
    interval: BLESSING_INTERVAL,
    claimedCount: 0,
  };

  /** 当前选中的建筑索引 */
  private _selectedIndex: number = 0;

  /** 统计数据 */
  private _stats: EgyptMythStatistics = {
    totalGoldEarned: 0,
    totalClicks: 0,
    totalPapyrusEarned: 0,
    totalDivinePowerEarned: 0,
    totalPrestigeCount: 0,
    totalGodsUnlocked: 1,
    totalBlessingsClaimed: 0,
    totalMummiesSummoned: 0,
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

  /** 神明动画计时器 */
  private _godAnimTimer: number = 0;
  /** 光环脉冲 */
  private _auraPulse: number = 0;
  /** 点击缩放效果 */
  private _clickScale: number = 1;
  private _clickAnimTimer: number = 0;
  /** 沙尘粒子 */
  private _sandParticles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    size: number;
  }> = [];

  /** 星星闪烁 */
  private _starPhase: number = 0;

  /** 恩赐就绪标志 */
  private _blessingReady: boolean = false;

  // ========== 公开属性 ==========

  get selectedIndex(): number {
    return this._selectedIndex;
  }

  get gods(): GodState[] {
    return this._gods.map((g) => ({ ...g }));
  }

  get mummies(): MummyState[] {
    return this._mummies.map((m) => ({ ...m }));
  }

  get blessing(): BlessingState {
    return { ...this._blessing };
  }

  get blessingReady(): boolean {
    return this._blessingReady;
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
        id: 'gold',
        name: '黄金',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e15,
        unlocked: true,
      },
      {
        id: 'papyrus',
        name: '莎草纸',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e12,
        unlocked: false,
      },
      {
        id: 'divine_power',
        name: '神圣之力',
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
          type: 'add_production' as const,
          target: b.productionResource,
          value: b.baseProduction,
        },
        unlocked: b.id === 'sand_pit', // 采砂场初始解锁
        requires: b.requires,
        icon: b.icon,
      }))
    );

    // 重置神明状态
    this._gods = GODS.map((g) => ({
      id: g.id,
      unlocked: g.id === 'ra',
      blessingLevel: 0,
    }));

    // 重置木乃伊状态
    this._mummies = MUMMIES.map((m) => ({
      id: m.id,
      fragments: 0,
      summoned: false,
    }));

    // 重置恩赐状态
    this._blessing = {
      lastBlessingTime: Date.now(),
      interval: BLESSING_INTERVAL,
      claimedCount: 0,
    };

    // 重置其他状态
    this._selectedIndex = 0;
    this._stats = {
      totalGoldEarned: 0,
      totalClicks: 0,
      totalPapyrusEarned: 0,
      totalDivinePowerEarned: 0,
      totalPrestigeCount: 0,
      totalGodsUnlocked: 1,
      totalBlessingsClaimed: 0,
      totalMummiesSummoned: 0,
    };
    this._floatingTexts = [];
    this._godAnimTimer = 0;
    this._auraPulse = 0;
    this._clickScale = 1;
    this._clickAnimTimer = 0;
    this._sandParticles = [];
    this._starPhase = 0;
    this._blessingReady = false;
  }

  protected onUpdate(deltaTime: number): void {
    // 神明动画
    this._godAnimTimer += deltaTime;
    this._auraPulse = Math.sin(this._godAnimTimer * 0.003) * 0.3 + 0.7;
    this._starPhase += deltaTime * 0.001;

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

    // 沙尘粒子更新
    this._sandParticles = this._sandParticles.filter((p) => {
      p.life -= deltaTime;
      p.x += p.vx * (deltaTime / 1000);
      p.y += p.vy * (deltaTime / 1000);
      return p.life > 0;
    });

    // 随机产生沙尘粒子
    if (Math.random() < 0.03) {
      this._sandParticles.push({
        x: -10,
        y: 200 + Math.random() * 200,
        vx: 20 + Math.random() * 40,
        vy: -5 + Math.random() * 10,
        life: 3000 + Math.random() * 2000,
        maxLife: 5000,
        size: 1 + Math.random() * 2,
      });
    }

    // 统计资源产出
    const gold = this.getResource('gold');
    if (gold && gold.perSecond > 0) {
      this._stats.totalGoldEarned += gold.perSecond * (deltaTime / 1000);
    }
    const papyrus = this.getResource('papyrus');
    if (papyrus && papyrus.perSecond > 0) {
      this._stats.totalPapyrusEarned += papyrus.perSecond * (deltaTime / 1000);
    }
    const divine = this.getResource('divine_power');
    if (divine && divine.perSecond > 0) {
      this._stats.totalDivinePowerEarned += divine.perSecond * (deltaTime / 1000);
    }

    // 检查建筑解锁条件
    this.checkBuildingUnlocks();
    // 检查资源解锁条件
    this.checkResourceUnlocks();
    // 检查神明恩赐
    this.checkBlessing();
  }

  // ========== 核心玩法 ==========

  /**
   * 点击获得黄金
   */
  click(): number {
    if (this._status !== 'playing') return 0;

    let gained = GOLD_PER_CLICK;

    // 神明点击加成
    gained *= this.getClickMultiplier();

    // 木乃伊点击加成
    gained *= this.getMummyClickMultiplier();

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

    // 木乃伊碎片掉落
    if (Math.random() < MUMMY_FRAGMENT_DROP_RATE) {
      this.dropMummyFragment();
    }

    // 飘字
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 40;
    this._floatingTexts.push({
      text: `+${this.formatNumber(gained)}`,
      x: GOD_DRAW.centerX + Math.cos(angle) * dist,
      y: GOD_DRAW.centerY + Math.sin(angle) * dist - 30,
      life: 800,
      maxLife: 800,
      color: COLORS.accent,
    });

    this.emit('stateChange');
    return gained;
  }

  /**
   * 掉落木乃伊碎片
   */
  private dropMummyFragment(): void {
    // 随机选择一个木乃伊
    const notSummoned = this._mummies.filter((m) => !m.summoned);
    if (notSummoned.length === 0) return;

    const target = notSummoned[Math.floor(Math.random() * notSummoned.length)];
    target.fragments++;

    this._floatingTexts.push({
      text: '碎片 +1',
      x: GOD_DRAW.centerX + (Math.random() - 0.5) * 100,
      y: GOD_DRAW.centerY + 60,
      life: 1000,
      maxLife: 1000,
      color: COLORS.divineColor,
    });

    this.emit('fragmentDropped', target.id);
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
   * 解锁神明
   */
  unlockGod(godId: string): boolean {
    const godDef = GODS.find((g) => g.id === godId);
    if (!godDef) return false;

    const godState = this._gods.find((g) => g.id === godId);
    if (!godState || godState.unlocked) return false;

    if (!this.hasResource('gold', godDef.unlockCost)) return false;

    this.spendResource('gold', godDef.unlockCost);
    godState.unlocked = true;
    this._stats.totalGodsUnlocked++;

    // 重新计算产出
    this.recalculateProduction();

    this.emit('godUnlocked', godId);
    this.emit('stateChange');
    return true;
  }

  /**
   * 升级神明庇护等级
   */
  blessGod(godId: string): boolean {
    const godState = this._gods.find((g) => g.id === godId);
    if (!godState || !godState.unlocked) return false;

    const nextLevel = godState.blessingLevel + 1;
    if (nextLevel > MAX_BLESSING_LEVEL) return false;

    const cost = this.getBlessingCost(nextLevel);
    if (!this.canAfford(cost)) return false;

    // 扣除资源
    for (const [resId, amount] of Object.entries(cost)) {
      this.spendResource(resId, amount);
    }

    godState.blessingLevel = nextLevel;

    // 重新计算产出
    this.recalculateProduction();

    this.emit('godBlessed', godId, nextLevel);
    this.emit('stateChange');
    return true;
  }

  /**
   * 获取庇护费用
   */
  getBlessingCost(level: number): Record<string, number> {
    return BLESSING_COSTS[level] ? { ...BLESSING_COSTS[level] } : {};
  }

  /**
   * 获取神明庇护等级
   */
  getGodBlessingLevel(godId: string): number {
    const god = this._gods.find((g) => g.id === godId);
    return god ? god.blessingLevel : 0;
  }

  /**
   * 召唤木乃伊
   */
  summonMummy(mummyId: string): boolean {
    const mummyDef = MUMMIES.find((m) => m.id === mummyId);
    if (!mummyDef) return false;

    const mummyState = this._mummies.find((m) => m.id === mummyId);
    if (!mummyState || mummyState.summoned) return false;

    if (mummyState.fragments < mummyDef.fragments) return false;

    mummyState.fragments -= mummyDef.fragments;
    mummyState.summoned = true;
    this._stats.totalMummiesSummoned++;

    // 重新计算产出
    this.recalculateProduction();

    this.emit('mummySummoned', mummyId);
    this.emit('stateChange');
    return true;
  }

  /**
   * 获取木乃伊碎片数
   */
  getMummyFragments(mummyId: string): number {
    const mummy = this._mummies.find((m) => m.id === mummyId);
    return mummy ? mummy.fragments : 0;
  }

  /**
   * 获取木乃伊是否已召唤
   */
  isMummySummoned(mummyId: string): boolean {
    const mummy = this._mummies.find((m) => m.id === mummyId);
    return mummy ? mummy.summoned : false;
  }

  /**
   * 领取神明恩赐
   */
  claimBlessing(): boolean {
    if (!this._blessingReady) return false;

    // 计算奖励
    let goldReward = BLESSING_GOLD_BASE * (1 + this._blessing.claimedCount * 0.1);
    goldReward *= this.getBlessingRewardMultiplier();
    goldReward = Math.floor(goldReward);

    let papyrusReward = BLESSING_PAPYRUS_BASE * (1 + this._blessing.claimedCount * 0.05);
    papyrusReward = Math.floor(papyrusReward);

    this.addResource('gold', goldReward);
    if (papyrusReward > 0 && this.getResource('papyrus')?.unlocked) {
      this.addResource('papyrus', papyrusReward);
    }

    this._stats.totalGoldEarned += goldReward;
    this._stats.totalBlessingsClaimed++;
    this._blessing.claimedCount++;
    this._blessing.lastBlessingTime = Date.now();
    this._blessingReady = false;

    // 飘字
    this._floatingTexts.push({
      text: `恩赐! +${this.formatNumber(goldReward)} 🪙`,
      x: GOD_DRAW.centerX,
      y: GOD_DRAW.centerY - 80,
      life: 1500,
      maxLife: 1500,
      color: COLORS.goldColor,
    });

    this.emit('blessingClaimed', { gold: goldReward, papyrus: papyrusReward });
    this.emit('stateChange');
    return true;
  }

  /**
   * 检查神明恩赐是否就绪
   */
  private checkBlessing(): void {
    if (this._blessingReady) return;

    const elapsed = Date.now() - this._blessing.lastBlessingTime;
    if (elapsed >= this._blessing.interval) {
      this._blessingReady = true;
      this.emit('blessingReady');
    }
  }

  /**
   * 获取恩赐奖励倍率
   */
  private getBlessingRewardMultiplier(): number {
    let mult = 1;
    // 已解锁神明数量加成
    const unlockedCount = this._gods.filter((g) => g.unlocked).length;
    mult += unlockedCount * 0.1;
    // 声望加成
    mult *= this.getPrestigeMultiplier();
    return mult;
  }

  /**
   * 获取恩赐倒计时（毫秒）
   */
  getBlessingCountdown(): number {
    if (this._blessingReady) return 0;
    const elapsed = Date.now() - this._blessing.lastBlessingTime;
    return Math.max(0, this._blessing.interval - elapsed);
  }

  // ========== 声望系统 ==========

  /**
   * 声望重置
   */
  doPrestige(): number {
    if (this._stats.totalGoldEarned < MIN_PRESTIGE_GOLD) return 0;

    // 计算获得的神圣之力
    const divineGained = Math.floor(
      PRESTIGE_BASE_DIVINE * Math.sqrt(this._stats.totalGoldEarned / MIN_PRESTIGE_GOLD)
    );

    if (divineGained <= 0) return 0;

    // 保存声望数据
    const savedPrestige = { ...this.prestige };
    savedPrestige.currency += divineGained;
    savedPrestige.count++;

    // 保存神明庇护等级（声望保留）
    const savedGodBlessings = this._gods.map((g) => ({
      id: g.id,
      unlocked: g.unlocked,
      blessingLevel: g.blessingLevel,
    }));

    // 保存木乃伊召唤状态（声望保留）
    const savedMummies = this._mummies.map((m) => ({
      id: m.id,
      fragments: m.fragments,
      summoned: m.summoned,
    }));

    // 保存统计
    const savedStats: EgyptMythStatistics = {
      ...this._stats,
      totalGoldEarned: 0,
      totalClicks: 0,
      totalPapyrusEarned: 0,
      totalDivinePowerEarned: 0,
    };

    // 重置
    this.onInit();

    // 恢复声望
    this.prestige = savedPrestige;
    this._stats.totalPrestigeCount = savedStats.totalPrestigeCount;
    this._stats.totalGodsUnlocked = savedStats.totalGodsUnlocked;
    this._stats.totalBlessingsClaimed = savedStats.totalBlessingsClaimed;
    this._stats.totalMummiesSummoned = savedStats.totalMummiesSummoned;

    // 恢复神明庇护等级
    for (const saved of savedGodBlessings) {
      const god = this._gods.find((g) => g.id === saved.id);
      if (god) {
        god.unlocked = saved.unlocked;
        god.blessingLevel = saved.blessingLevel;
      }
    }

    // 恢复木乃伊状态
    for (const saved of savedMummies) {
      const mummy = this._mummies.find((m) => m.id === saved.id);
      if (mummy) {
        mummy.fragments = saved.fragments;
        mummy.summoned = saved.summoned;
      }
    }

    this.emit('prestige', divineGained);
    this.emit('stateChange');
    return divineGained;
  }

  /**
   * 获取声望加成倍率
   */
  getPrestigeMultiplier(): number {
    return 1 + this.prestige.currency * PRESTIGE_BONUS_MULTIPLIER;
  }

  /**
   * 获取预览声望神圣之力数
   */
  getPrestigePreview(): number {
    if (this._stats.totalGoldEarned < MIN_PRESTIGE_GOLD) return 0;
    return Math.floor(
      PRESTIGE_BASE_DIVINE * Math.sqrt(this._stats.totalGoldEarned / MIN_PRESTIGE_GOLD)
    );
  }

  /**
   * 检查是否可以声望
   */
  canPrestige(): boolean {
    return this._stats.totalGoldEarned >= MIN_PRESTIGE_GOLD;
  }

  // ========== 加成倍率计算 ==========

  /**
   * 获取点击加成倍率（来自神明）
   */
  getClickMultiplier(): number {
    let multiplier = 1;
    for (const god of this._gods) {
      if (!god.unlocked) continue;
      const def = GODS.find((g) => g.id === god.id);
      if (!def) continue;
      if (def.bonusType === 'click' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.blessingMultiplier, god.blessingLevel);
        multiplier += bonus;
      }
    }
    return multiplier;
  }

  /**
   * 获取生产加成倍率（来自神明）
   */
  getProductionMultiplier(): number {
    let multiplier = 1;
    for (const god of this._gods) {
      if (!god.unlocked) continue;
      const def = GODS.find((g) => g.id === god.id);
      if (!def) continue;
      if (def.bonusType === 'production' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.blessingMultiplier, god.blessingLevel);
        multiplier += bonus;
      }
    }
    return multiplier;
  }

  /**
   * 获取莎草纸加成倍率
   */
  getPapyrusMultiplier(): number {
    let multiplier = 1;
    for (const god of this._gods) {
      if (!god.unlocked) continue;
      const def = GODS.find((g) => g.id === god.id);
      if (!def) continue;
      if (def.bonusType === 'papyrus' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.blessingMultiplier, god.blessingLevel);
        multiplier += bonus;
      }
    }
    return multiplier;
  }

  /**
   * 获取神圣之力加成倍率
   */
  getDivinePowerMultiplier(): number {
    let multiplier = 1;
    for (const god of this._gods) {
      if (!god.unlocked) continue;
      const def = GODS.find((g) => g.id === god.id);
      if (!def) continue;
      if (def.bonusType === 'divine_power' || def.bonusType === 'all') {
        let bonus = def.bonusValue;
        bonus *= Math.pow(def.blessingMultiplier, god.blessingLevel);
        multiplier += bonus;
      }
    }
    return multiplier;
  }

  /**
   * 获取木乃伊点击加成倍率
   */
  getMummyClickMultiplier(): number {
    let multiplier = 1;
    for (const mummy of this._mummies) {
      if (!mummy.summoned) continue;
      const def = MUMMIES.find((m) => m.id === mummy.id);
      if (!def) continue;
      if (def.bonusType === 'click' || def.bonusType === 'all') {
        multiplier += def.bonusValue;
      }
    }
    return multiplier;
  }

  /**
   * 获取木乃伊生产加成倍率
   */
  getMummyProductionMultiplier(): number {
    let multiplier = 1;
    for (const mummy of this._mummies) {
      if (!mummy.summoned) continue;
      const def = MUMMIES.find((m) => m.id === mummy.id);
      if (!def) continue;
      if (def.bonusType === 'production' || def.bonusType === 'all') {
        multiplier += def.bonusValue;
      }
    }
    return multiplier;
  }

  // ========== 建筑相关 ==========

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
      if (building.productionResource === 'gold') {
        production *= this.getProductionMultiplier()
          * this.getMummyProductionMultiplier()
          * this.getPrestigeMultiplier();
      } else if (building.productionResource === 'papyrus') {
        production *= this.getPapyrusMultiplier()
          * this.getMummyProductionMultiplier()
          * this.getPrestigeMultiplier();
      } else if (building.productionResource === 'divine_power') {
        production *= this.getDivinePowerMultiplier()
          * this.getMummyProductionMultiplier()
          * this.getPrestigeMultiplier();
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
    // 莎草纸：采砂场等级 >= 3 时解锁
    const sandPit = this.upgrades.get('sand_pit');
    if (sandPit && sandPit.level >= 3) {
      const papyrus = this.resources.get('papyrus');
      if (papyrus && !papyrus.unlocked) {
        papyrus.unlocked = true;
        this.emit('resourceUnlocked', 'papyrus');
      }
    }

    // 神圣之力：神庙等级 >= 1 时解锁
    const temple = this.upgrades.get('temple');
    if (temple && temple.level >= 1) {
      const divine = this.resources.get('divine_power');
      if (divine && !divine.unlocked) {
        divine.unlocked = true;
        this.emit('resourceUnlocked', 'divine_power');
      }
    }
  }

  // ========== 渲染 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawSandParticles(ctx);
    this.drawGod(ctx);
    this.drawFloatingTexts(ctx);
    this.drawResourcePanel(ctx, w);
    this.drawBuildingList(ctx, w, h);
    this.drawBlessingIndicator(ctx, w);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 天空渐变（古埃及夜空）
    const skyGradient = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    skyGradient.addColorStop(0, COLORS.skyTop);
    skyGradient.addColorStop(1, COLORS.skyBottom);
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, w, h * 0.5);

    // 星星
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 20; i++) {
      const x = ((i * 97 + 13) % w);
      const y = ((i * 53 + 7) % (h * 0.4));
      const twinkle = Math.sin(this._starPhase + i * 0.7) * 0.3 + 0.7;
      ctx.globalAlpha = twinkle * 0.6;
      ctx.fillStyle = COLORS.starColor;
      ctx.beginPath();
      ctx.arc(x, y, 1 + (i % 3) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 地面渐变（沙漠）
    const groundGradient = ctx.createLinearGradient(0, h * 0.45, 0, h);
    groundGradient.addColorStop(0, COLORS.groundLight);
    groundGradient.addColorStop(1, COLORS.groundDark);
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, h * 0.45, w, h * 0.55);

    // 地面纹理（沙粒）
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 40; i++) {
      const x = ((i * 73 + 17) % w);
      const y = h * 0.45 + ((i * 47 + 23) % Math.floor(h * 0.55));
      ctx.fillStyle = '#5D4037';
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;

    // 远处金字塔剪影
    ctx.fillStyle = '#4E342E';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.lineTo(60, h * 0.35);
    ctx.lineTo(120, h * 0.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(100, h * 0.5);
    ctx.lineTo(180, h * 0.3);
    ctx.lineTo(260, h * 0.5);
    ctx.fill();

    // 月亮
    ctx.beginPath();
    ctx.arc(w - 60, 50, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF8E1';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w - 60, 50, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 248, 225, 0.12)';
    ctx.fill();
  }

  private drawSandParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this._sandParticles) {
      const alpha = (p.life / p.maxLife) * 0.4;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.sandColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawGod(ctx: CanvasRenderingContext2D): void {
    const cx = GOD_DRAW.centerX;
    const cy = GOD_DRAW.centerY;
    const scale = this._clickScale;

    // 获取第一个已解锁的神明
    const unlockedGod = this._gods.find((g) => g.unlocked);
    const godDef = unlockedGod
      ? GODS.find((g) => g.id === unlockedGod.id)!
      : GODS[0];

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // 光环
    const auraAlpha = this._auraPulse * 0.3;
    ctx.beginPath();
    ctx.arc(0, 0, GOD_DRAW.auraRadius, 0, Math.PI * 2);
    const auraGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, GOD_DRAW.auraRadius);
    auraGrad.addColorStop(0, godDef.auraColor + '60');
    auraGrad.addColorStop(0.6, godDef.auraColor + '20');
    auraGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = auraGrad;
    ctx.globalAlpha = auraAlpha;
    ctx.fill();
    ctx.globalAlpha = 1;

    // 身体阴影
    ctx.beginPath();
    ctx.ellipse(3, GOD_DRAW.bodyHeight * 0.6 + 3, GOD_DRAW.bodyWidth * 0.5, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.godShadow;
    ctx.fill();

    // 身体（古埃及长袍）
    ctx.beginPath();
    ctx.moveTo(-GOD_DRAW.bodyWidth * 0.5, -GOD_DRAW.bodyHeight * 0.2);
    ctx.lineTo(-GOD_DRAW.bodyWidth * 0.6, GOD_DRAW.bodyHeight * 0.5);
    ctx.lineTo(GOD_DRAW.bodyWidth * 0.6, GOD_DRAW.bodyHeight * 0.5);
    ctx.lineTo(GOD_DRAW.bodyWidth * 0.5, -GOD_DRAW.bodyHeight * 0.2);
    ctx.closePath();
    ctx.fillStyle = godDef.color;
    ctx.fill();

    // 腰带
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(-GOD_DRAW.bodyWidth * 0.5, GOD_DRAW.bodyHeight * 0.05, GOD_DRAW.bodyWidth, 4);

    // 头
    ctx.beginPath();
    ctx.arc(0, -GOD_DRAW.bodyHeight * 0.4, GOD_DRAW.headRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#FFCC80';
    ctx.fill();

    // 头冠（埃及风格）
    ctx.fillStyle = godDef.color;
    ctx.beginPath();
    ctx.moveTo(-GOD_DRAW.headRadius * 0.8, -GOD_DRAW.bodyHeight * 0.4 - GOD_DRAW.headRadius * 0.3);
    ctx.lineTo(0, -GOD_DRAW.bodyHeight * 0.4 - GOD_DRAW.headRadius - GOD_DRAW.crownHeight);
    ctx.lineTo(GOD_DRAW.headRadius * 0.8, -GOD_DRAW.bodyHeight * 0.4 - GOD_DRAW.headRadius * 0.3);
    ctx.closePath();
    ctx.fill();

    // 眼睛（埃及风格眼线）
    ctx.beginPath();
    ctx.arc(-7, -GOD_DRAW.bodyHeight * 0.42, GOD_DRAW.eyeRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-7, -GOD_DRAW.bodyHeight * 0.42, GOD_DRAW.eyeRadius * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#1A1A1A';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(7, -GOD_DRAW.bodyHeight * 0.42, GOD_DRAW.eyeRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(7, -GOD_DRAW.bodyHeight * 0.42, GOD_DRAW.eyeRadius * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#1A1A1A';
    ctx.fill();

    // 埃及眼线延伸
    ctx.strokeStyle = '#1A1A1A';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-11, -GOD_DRAW.bodyHeight * 0.42);
    ctx.lineTo(-14, -GOD_DRAW.bodyHeight * 0.44);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(11, -GOD_DRAW.bodyHeight * 0.42);
    ctx.lineTo(14, -GOD_DRAW.bodyHeight * 0.44);
    ctx.stroke();

    // 庇护等级指示（安卡符号）
    if (unlockedGod) {
      const blessingLevel = unlockedGod.blessingLevel;
      for (let i = 0; i < blessingLevel; i++) {
        ctx.fillStyle = COLORS.accent;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('☥', -15 + i * 12, -GOD_DRAW.bodyHeight * 0.8);
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
      const icon = res.id === 'gold' ? '🪙' : res.id === 'papyrus' ? '📜' : '✨';
      const color = res.id === 'gold' ? COLORS.goldColor : res.id === 'papyrus' ? COLORS.papyrusColor : COLORS.divineColor;

      // 图标
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(icon, panel.padding + 8, y + 16);

      // 数量
      ctx.font = 'bold 13px "Segoe UI", monospace';
      ctx.fillStyle = color;
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
        const prodRes = building.productionResource;
        const icon = prodRes === 'gold' ? '🪙' : prodRes === 'papyrus' ? '📜' : '✨';
        ctx.fillText(`${icon}+${this.formatNumber(building.baseProduction * level)}/s`, x + 36, y + 34);
      }

      // 费用
      if (level < building.maxLevel) {
        const costStr = Object.entries(cost)
          .map(([id, amount]) => {
            const icon = id === 'gold' ? '🪙' : id === 'papyrus' ? '📜' : '✨';
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
    ctx.fillText('空格 点击 · ↑↓ 选择 · Enter 购买 · B 庇护 · M 木乃伊 · P 声望', w / 2, h - 10);
  }

  /** 恩赐指示器 */
  private drawBlessingIndicator(ctx: CanvasRenderingContext2D, w: number): void {
    const x = w - 50;
    const y = 60;

    if (this._blessingReady) {
      // 恩赐就绪 - 闪烁金色
      const pulse = Math.sin(this._godAnimTimer * 0.005) * 0.3 + 0.7;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = COLORS.goldColor;
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🎁', x, y + 5);
    } else {
      // 倒计时
      const countdown = this.getBlessingCountdown();
      const seconds = Math.ceil(countdown / 1000);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = 'bold 10px "Segoe UI", sans-serif';
      ctx.fillStyle = COLORS.textSecondary;
      ctx.textAlign = 'center';
      ctx.fillText(`${seconds}s`, x, y + 4);
    }
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
      case 'b':
      case 'B':
        // 庇护当前选中的神明（第一个已解锁的）
        {
          const unlocked = this._gods.find((g) => g.unlocked);
          if (unlocked) this.blessGod(unlocked.id);
        }
        break;
      case 'm':
      case 'M':
        // 召唤第一个可召唤的木乃伊
        {
          const available = this._mummies.find((m) => {
            const def = MUMMIES.find((d) => d.id === m.id);
            return def && !m.summoned && m.fragments >= def.fragments;
          });
          if (available) this.summonMummy(available.id);
        }
        break;
      case 'g':
      case 'G':
        // 解锁下一个神明
        {
          const nextGod = this._gods.find((g) => !g.unlocked);
          if (nextGod) this.unlockGod(nextGod.id);
        }
        break;
      case 'p':
      case 'P':
        this.doPrestige();
        break;
      case 'c':
      case 'C':
        this.claimBlessing();
        break;
    }
  }

  handleKeyUp(_key: string): void {
    // 无需处理
  }

  // ========== 状态序列化 ==========

  getState(): EgyptMythState {
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
      gods: this.gods,
      mummies: this.mummies,
      blessing: this.blessing,
      prestige: { ...this.prestige },
      statistics: { ...this._stats },
      selectedIndex: this._selectedIndex,
    };
  }

  /**
   * 从状态恢复
   */
  loadState(state: EgyptMythState): void {
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

    // 恢复神明
    if (state.gods) {
      for (const godState of state.gods) {
        const myGod = this._gods.find((g) => g.id === godState.id);
        if (myGod) {
          myGod.unlocked = godState.unlocked;
          if (godState.blessingLevel !== undefined) {
            myGod.blessingLevel = godState.blessingLevel;
          }
        }
      }
    }

    // 恢复木乃伊
    if (state.mummies) {
      for (const mummyState of state.mummies) {
        const myMummy = this._mummies.find((m) => m.id === mummyState.id);
        if (myMummy) {
          myMummy.fragments = mummyState.fragments;
          myMummy.summoned = mummyState.summoned;
        }
      }
    }

    // 恢复恩赐
    if (state.blessing) {
      this._blessing = { ...state.blessing };
    }

    // 恢复声望
    if (state.prestige) {
      this.prestige = { ...state.prestige };
    }

    // 恢复统计
    if (state.statistics) {
      this._stats = { ...state.statistics } as EgyptMythStatistics;
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
    data.settings = {
      gods: this._gods,
      mummies: this._mummies,
      blessing: this._blessing,
      stats: this._stats,
      selectedIndex: this._selectedIndex,
    };
    return data;
  }

  load(data: SaveData): void {
    super.load(data);

    if (data.settings) {
      const settings = data.settings as any;
      if (settings.gods) {
        for (const godState of settings.gods) {
          const myGod = this._gods.find((g) => g.id === godState.id);
          if (myGod) {
            myGod.unlocked = godState.unlocked;
            if (godState.blessingLevel !== undefined) {
              myGod.blessingLevel = godState.blessingLevel;
            }
          }
        }
      }
      if (settings.mummies) {
        for (const mummyState of settings.mummies) {
          const myMummy = this._mummies.find((m) => m.id === mummyState.id);
          if (myMummy) {
            myMummy.fragments = mummyState.fragments;
            myMummy.summoned = mummyState.summoned;
          }
        }
      }
      if (settings.blessing) {
        this._blessing = { ...settings.blessing };
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
