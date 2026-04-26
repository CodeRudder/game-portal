/**
 * 铜钱经济系统 — 基于 4h 在线/天的经济模型 (PRD v1.3 HER-10.3)
 *
 * 日产出约 22,000：被动 1.3/秒×14400=18720 + 日常2000 + 关卡~2000
 * 消耗线：商店≤40%、升级30%、升星15%、突破10%、技能5%
 */
import type { ISubsystem, ISystemDeps } from '../../core/types';

// ── 常量 ──
const PASSIVE_COPPER_RATE = 1.3;        // 铜钱/秒
const DAILY_TASK_COPPER_REWARD = 2000;
const STAGE_CLEAR_BASE_COPPER = 100;
const STAGE_CLEAR_COPPER_PER_LEVEL = 20;
const SHOP_DAILY_SPEND_LIMIT = 9000;    // ≈ 日产出 40%
const COPPER_SAFETY_LINE = 500;
const SAVE_VERSION = 1;

// ── 升级消耗表（来源：hero-config.ts LEVEL_EXP_TABLE） ──
const LEVEL_GOLD_TABLE: readonly { levelMin: number; levelMax: number; goldPerLevel: number }[] = [
  { levelMin: 1, levelMax: 10, goldPerLevel: 20 },
  { levelMin: 11, levelMax: 20, goldPerLevel: 50 },
  { levelMin: 21, levelMax: 30, goldPerLevel: 100 },
  { levelMin: 31, levelMax: 40, goldPerLevel: 200 },
  { levelMin: 41, levelMax: 50, goldPerLevel: 400 },
  { levelMin: 51, levelMax: 60, goldPerLevel: 600 },
  { levelMin: 61, levelMax: 70, goldPerLevel: 1000 },
];

// ── 升星消耗表（来源：star-up-config.ts） ──
const STAR_UP_GOLD_COST: readonly number[] = [0, 5000, 10000, 20000, 50000, 100000];

// ── 突破消耗表（来源：star-up-config.ts BREAKTHROUGH_TIERS） ──
const BREAKTHROUGH_GOLD_COST: readonly number[] = [20000, 50000, 100000, 200000];

// ── 技能升级消耗表（来源：SkillUpgradeSystem.ts） ──
const SKILL_UPGRADE_GOLD_TABLE: Record<number, number> = { 1: 500, 2: 1500, 3: 4000, 4: 10000 };
const DEFAULT_SKILL_UPGRADE_GOLD = 10000;

// ── 商店物品 ──
export interface ShopItem { id: string; name: string; price: number; dailyLimit: number | null }
const SHOP_ITEMS: Record<string, ShopItem> = {
  recruitToken: { id: 'recruitToken', name: '招贤令', price: 100, dailyLimit: 50 },
  breakthroughStone: { id: 'breakthroughStone', name: '突破石', price: 2000, dailyLimit: 10 },
  expBook: { id: 'expBook', name: '经验书', price: 500, dailyLimit: 20 },
  skillBook: { id: 'skillBook', name: '技能书', price: 3000, dailyLimit: 5 },
};

// ── 存档数据 ──
export interface CopperEconomySaveData {
  version: number;
  dailyTaskClaimed: boolean;
  dailyShopPurchases: Record<string, number>;
  lastResetDate: string;
  dailyCopperProduced: number;
  dailyCopperSpent: number;
  totalCopperProduced: number;
  totalCopperSpent: number;
  spendByCategory: Record<string, number>;
}

// ── 依赖注入 ──
export interface CopperEconomyDeps {
  addGold: (amount: number) => number;
  consumeGold: (amount: number) => boolean;
  getGoldAmount: () => number;
  addItem?: (itemId: string, count: number) => void;
}

/** 消耗类别 */
export type SpendCategory = 'shop' | 'levelUp' | 'starUp' | 'breakthrough' | 'skill';

// ── 辅助函数 ──
function todayDateString(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function lookupLevelUpGold(level: number): number {
  for (const t of LEVEL_GOLD_TABLE) {
    if (level >= t.levelMin && level <= t.levelMax) return level * t.goldPerLevel;
  }
  return level * LEVEL_GOLD_TABLE[LEVEL_GOLD_TABLE.length - 1].goldPerLevel;
}

function lookupStarUpGold(star: number): number {
  return STAR_UP_GOLD_COST[Math.min(star, STAR_UP_GOLD_COST.length - 1)];
}

function lookupBreakthroughGold(stage: number): number {
  return BREAKTHROUGH_GOLD_COST[Math.min(stage, BREAKTHROUGH_GOLD_COST.length - 1)];
}

function lookupSkillUpgradeGold(skillLevel: number): number {
  return SKILL_UPGRADE_GOLD_TABLE[skillLevel] ?? DEFAULT_SKILL_UPGRADE_GOLD;
}

// ─────────────────────────────────────────────
// CopperEconomySystem
// ─────────────────────────────────────────────
export class CopperEconomySystem implements ISubsystem {
  readonly name = 'copperEconomy' as const;

  private deps: ISystemDeps | null = null;
  private economyDeps: CopperEconomyDeps | null = null;
  private dailyCopperProduced = 0;
  private dailyCopperSpent = 0;
  private spendByCategory: Record<string, number> = { shop: 0, levelUp: 0, starUp: 0, breakthrough: 0, skill: 0 };
  private lastResetDate = '';
  private totalCopperProduced = 0;
  private totalCopperSpent = 0;
  private dailyTaskClaimed = false;
  private dailyShopPurchases: Record<string, number> = {};

  // ── ISubsystem ──
  init(deps: ISystemDeps): void { this.deps = deps; }
  update(dt: number): void { this.checkDailyReset(); this.tick(dt); }
  getState(): unknown { return this.serialize(); }
  reset(): void {
    this.dailyCopperProduced = 0; this.dailyCopperSpent = 0;
    this.spendByCategory = { shop: 0, levelUp: 0, starUp: 0, breakthrough: 0, skill: 0 };
    this.lastResetDate = ''; this.totalCopperProduced = 0; this.totalCopperSpent = 0;
    this.dailyTaskClaimed = false; this.dailyShopPurchases = {};
  }

  setEconomyDeps(deps: CopperEconomyDeps): void { this.economyDeps = deps; }

  // ── 1. 被动产出 ──
  tick(deltaSeconds: number): void {
    this.checkDailyReset();
    if (!this.economyDeps || deltaSeconds <= 0) return;
    const earned = PASSIVE_COPPER_RATE * deltaSeconds;
    const actual = this.economyDeps.addGold(earned);
    this.dailyCopperProduced += actual;
    this.totalCopperProduced += actual;
  }

  // ── 2. 日常任务 ──
  claimDailyTaskCopper(): number {
    this.checkDailyReset();
    if (this.dailyTaskClaimed || !this.economyDeps) return 0;
    this.dailyTaskClaimed = true;
    const actual = this.economyDeps.addGold(DAILY_TASK_COPPER_REWARD);
    this.dailyCopperProduced += actual; this.totalCopperProduced += actual;
    return actual;
  }

  // ── 3. 关卡通关 ──
  claimStageClearCopper(stageLevel: number): number {
    if (!this.economyDeps || stageLevel < 1) return 0;
    const reward = STAGE_CLEAR_BASE_COPPER + stageLevel * STAGE_CLEAR_COPPER_PER_LEVEL;
    const actual = this.economyDeps.addGold(reward);
    this.dailyCopperProduced += actual; this.totalCopperProduced += actual;
    return actual;
  }

  // ── 4. 商店购买 ──
  purchaseItem(itemId: string, count: number): boolean {
    this.checkDailyReset();
    if (!this.economyDeps || count <= 0) return false;
    const item = SHOP_ITEMS[itemId];
    if (!item) return false;
    if (item.dailyLimit !== null) {
      if ((this.dailyShopPurchases[itemId] ?? 0) + count > item.dailyLimit) return false;
    }
    const totalCost = item.price * count;
    if (this.spendByCategory.shop + totalCost > SHOP_DAILY_SPEND_LIMIT) return false;
    if (this.economyDeps.getGoldAmount() - totalCost < COPPER_SAFETY_LINE) return false;
    if (!this.economyDeps.consumeGold(totalCost)) return false;
    this.economyDeps.addItem?.(itemId, count);
    this.recordSpend('shop', totalCost);
    this.dailyShopPurchases[itemId] = (this.dailyShopPurchases[itemId] ?? 0) + count;
    return true;
  }

  // ── 5. 升级消耗 ──
  spendOnLevelUp(heroId: string, level: number): number {
    if (!this.economyDeps || !heroId || level < 1) return 0;
    return this.trySpend(lookupLevelUpGold(level), 'levelUp');
  }

  // ── 6. 升星消耗 ──
  spendOnStarUp(heroId: string, star: number): number {
    if (!this.economyDeps || !heroId || star < 0) return 0;
    return this.trySpend(lookupStarUpGold(star), 'starUp');
  }

  // ── 7. 突破消耗 ──
  spendOnBreakthrough(heroId: string, stage: number): number {
    if (!this.economyDeps || !heroId || stage < 0) return 0;
    return this.trySpend(lookupBreakthroughGold(stage), 'breakthrough');
  }

  // ── 8. 技能升级消耗 ──
  spendOnSkillUpgrade(heroId: string, skillLevel: number): number {
    if (!this.economyDeps || !heroId || skillLevel < 1) return 0;
    return this.trySpend(lookupSkillUpgradeGold(skillLevel), 'skill');
  }

  // ── 9. 查询接口 ──
  getDailyCopperProduced(): number { this.checkDailyReset(); return this.dailyCopperProduced; }
  getDailyCopperSpent(): number { this.checkDailyReset(); return this.dailyCopperSpent; }
  getEconomyBalance(): number { this.checkDailyReset(); return this.dailyCopperProduced - this.dailyCopperSpent; }
  getTotalCopperProduced(): number { return this.totalCopperProduced; }
  getTotalCopperSpent(): number { return this.totalCopperSpent; }
  getSpendByCategory(cat: SpendCategory): number { this.checkDailyReset(); return this.spendByCategory[cat] ?? 0; }
  getAllSpendByCategory(): Readonly<Record<string, number>> { this.checkDailyReset(); return { ...this.spendByCategory }; }
  getDailyTaskClaimed(): boolean { this.checkDailyReset(); return this.dailyTaskClaimed; }
  getDailyShopPurchased(itemId: string): number { this.checkDailyReset(); return this.dailyShopPurchases[itemId] ?? 0; }
  getPassiveRate(): number { return PASSIVE_COPPER_RATE; }
  getShopItem(itemId: string): ShopItem | undefined { return SHOP_ITEMS[itemId] ? { ...SHOP_ITEMS[itemId] } : undefined; }
  getShopItemIds(): string[] { return Object.keys(SHOP_ITEMS); }
  getShopDailySpendLimit(): number { return SHOP_DAILY_SPEND_LIMIT; }
  getCopperSafetyLine(): number { return COPPER_SAFETY_LINE; }
  calculateStageClearCopper(level: number): number { return level < 1 ? 0 : STAGE_CLEAR_BASE_COPPER + level * STAGE_CLEAR_COPPER_PER_LEVEL; }
  calculateLevelUpCost(level: number): number { return lookupLevelUpGold(level); }
  calculateStarUpCost(star: number): number { return lookupStarUpGold(star); }
  calculateBreakthroughCost(stage: number): number { return lookupBreakthroughGold(stage); }
  calculateSkillUpgradeCost(skillLevel: number): number { return lookupSkillUpgradeGold(skillLevel); }

  // ── 10. 序列化 ──
  serialize(): CopperEconomySaveData {
    return {
      version: SAVE_VERSION, dailyTaskClaimed: this.dailyTaskClaimed,
      dailyShopPurchases: { ...this.dailyShopPurchases }, lastResetDate: this.lastResetDate,
      dailyCopperProduced: this.dailyCopperProduced, dailyCopperSpent: this.dailyCopperSpent,
      totalCopperProduced: this.totalCopperProduced, totalCopperSpent: this.totalCopperSpent,
      spendByCategory: { ...this.spendByCategory },
    };
  }

  deserialize(data: CopperEconomySaveData): void {
    this.dailyTaskClaimed = data.dailyTaskClaimed ?? false;
    this.dailyShopPurchases = { ...(data.dailyShopPurchases ?? {}) };
    this.lastResetDate = data.lastResetDate ?? '';
    this.dailyCopperProduced = data.dailyCopperProduced ?? 0;
    this.dailyCopperSpent = data.dailyCopperSpent ?? 0;
    this.totalCopperProduced = data.totalCopperProduced ?? 0;
    this.totalCopperSpent = data.totalCopperSpent ?? 0;
    this.spendByCategory = {
      shop: data.spendByCategory?.shop ?? 0, levelUp: data.spendByCategory?.levelUp ?? 0,
      starUp: data.spendByCategory?.starUp ?? 0, breakthrough: data.spendByCategory?.breakthrough ?? 0,
      skill: data.spendByCategory?.skill ?? 0,
    };
  }

  // ── 内部方法 ──
  private checkDailyReset(): void {
    const today = todayDateString();
    if (this.lastResetDate !== today) {
      this.dailyCopperProduced = 0; this.dailyCopperSpent = 0;
      this.spendByCategory = { shop: 0, levelUp: 0, starUp: 0, breakthrough: 0, skill: 0 };
      this.dailyTaskClaimed = false; this.dailyShopPurchases = {};
      this.lastResetDate = today;
    }
  }

  private trySpend(cost: number, category: SpendCategory): number {
    this.checkDailyReset();
    if (cost <= 0) return 0;
    if (this.economyDeps!.getGoldAmount() - cost < COPPER_SAFETY_LINE) return 0;
    if (!this.economyDeps!.consumeGold(cost)) return 0;
    this.recordSpend(category, cost);
    return cost;
  }

  private recordSpend(category: SpendCategory, amount: number): void {
    this.dailyCopperSpent += amount; this.totalCopperSpent += amount;
    this.spendByCategory[category] = (this.spendByCategory[category] ?? 0) + amount;
  }
}
