/**
 * 材料经济系统 — 突破石 & 技能书获取途径 (PRD v1.3 HER-8/9)
 *
 * 突破石获取途径（6种）：
 *   1. 关卡掉落：每关 1~3 个
 *   2. 扫荡：已通关关卡扫荡，50% 概率掉落
 *   3. 商店购买：500 铜钱/个，每日限购 20 个
 *   4. 成就奖励：特定成就奖励 10~50 个
 *   5. 联盟商店：联盟币购买（暂不实现，预留接口）
 *   6. 活动奖励：10~30 个
 *
 * 技能书获取途径（5种）：
 *   1. 日常任务：每日 2 本
 *   2. 远征掉落：每次远征 1~3 本，每日 2 次
 *   3. 活动奖励：5~10 本
 *   4. 联盟商店：联盟币购买（暂不实现，预留接口）
 *   5. 关卡首通：每关首通 1 本
 */
import type { ISubsystem, ISystemDeps } from '../../core/types';

// ── 常量 ──
const BREAKTHROUGH_STONE_PRICE = 500;          // 铜钱/个
const DAILY_BUY_LIMIT = 20;                    // 每日限购
const SWEEP_DROP_CHANCE = 0.5;                 // 扫荡 50% 掉落
const DAILY_SKILL_BOOK_COUNT = 2;              // 日常任务技能书
const MAX_DAILY_EXPEDITION = 2;                // 每日远征次数
const SAVE_VERSION = 1;

// ── 随机范围 ──
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── 成就奖励配置表 ──
const ACHIEVEMENT_BREAKTHROUGH_REWARDS: Record<string, number> = {
  ach_stage_10: 10,
  ach_stage_30: 20,
  ach_stage_50: 30,
  ach_hero_10: 15,
  ach_hero_30: 25,
  ach_hero_50: 40,
  ach_power_10000: 10,
  ach_power_50000: 30,
  ach_power_100000: 50,
};

// ── 存档数据 ──
export interface MaterialEconomySaveData {
  version: number;
  /** 每日已购突破石数量 */
  dailyBreakstonePurchased: number;
  /** 每日日常任务技能书是否已领取 */
  dailySkillBookClaimed: boolean;
  /** 每日远征已用次数 */
  dailyExpeditionCount: number;
  /** 已领取的成就奖励 ID 集合 */
  claimedAchievements: string[];
  /** 已领取首通技能书的关卡 ID 集合 */
  claimedFirstClearStages: string[];
  /** 上次重置日期 */
  lastResetDate: string;
  /** 累计突破石获得 */
  totalBreakthroughStoneEarned: number;
  /** 累计技能书获得 */
  totalSkillBookEarned: number;
  /** 每日突破石获得 */
  dailyBreakthroughStoneEarned: number;
  /** 每日技能书获得 */
  dailySkillBookEarned: number;
}

// ── 依赖注入 ──
export interface MaterialEconomyDeps {
  /** 消耗铜钱，返回是否成功 */
  consumeGold: (amount: number) => boolean;
  /** 获取铜钱数量 */
  getGoldAmount: () => number;
  /** 添加突破石 */
  addBreakthroughStone: (count: number) => void;
  /** 添加技能书 */
  addSkillBook: (count: number) => void;
  /** 获取已通关关卡列表（用于扫荡校验） */
  getClearedStages: () => string[];
  /** 随机数生成器（可注入，默认 Math.random） */
  random?: () => number;
}

// ─────────────────────────────────────────────
// MaterialEconomySystem
// ─────────────────────────────────────────────
export class MaterialEconomySystem implements ISubsystem {
  readonly name = 'materialEconomy' as const;

  private deps: ISystemDeps | null = null;
  private materialDeps: MaterialEconomyDeps | null = null;

  // 每日追踪
  private dailyBreakstonePurchased = 0;
  private dailySkillBookClaimed = false;
  private dailyExpeditionCount = 0;
  private dailyBreakthroughStoneEarned = 0;
  private dailySkillBookEarned = 0;

  // 累计追踪
  private totalBreakthroughStoneEarned = 0;
  private totalSkillBookEarned = 0;

  // 已领取记录
  private claimedAchievements: Set<string> = new Set();
  private claimedFirstClearStages: Set<string> = new Set();

  // 重置日期
  private lastResetDate = '';

  // ── ISubsystem ──
  init(deps: ISystemDeps): void { this.deps = deps; }

  update(dt: number): void { this.checkDailyReset(); }

  getState(): unknown { return this.serialize(); }

  reset(): void {
    this.dailyBreakstonePurchased = 0;
    this.dailySkillBookClaimed = false;
    this.dailyExpeditionCount = 0;
    this.dailyBreakthroughStoneEarned = 0;
    this.dailySkillBookEarned = 0;
    this.totalBreakthroughStoneEarned = 0;
    this.totalSkillBookEarned = 0;
    this.claimedAchievements = new Set();
    this.claimedFirstClearStages = new Set();
    this.lastResetDate = '';
  }

  setMaterialDeps(deps: MaterialEconomyDeps): void { this.materialDeps = deps; }

  // ═══════════════════════════════════════════
  // 突破石获取途径
  // ═══════════════════════════════════════════

  /**
   * 1. 关卡掉落突破石
   * 每关掉落 1~3 个突破石
   */
  claimStageBreakthroughStone(stageId: string): number {
    this.checkDailyReset();
    if (!this.materialDeps || !stageId) return 0;
    const count = this.randInt(1, 3);
    this.materialDeps.addBreakthroughStone(count);
    this.recordBreakthroughStone(count);
    return count;
  }

  /**
   * 2. 扫荡掉落突破石
   * 已通关关卡扫荡，50% 概率掉落 1~3 个
   */
  sweepStage(stageId: string): number {
    this.checkDailyReset();
    if (!this.materialDeps || !stageId) return 0;
    // 校验关卡已通关
    const cleared = this.materialDeps.getClearedStages();
    if (!cleared.includes(stageId)) return 0;
    // 50% 概率
    if (this.random() >= SWEEP_DROP_CHANCE) return 0;
    const count = this.randInt(1, 3);
    this.materialDeps.addBreakthroughStone(count);
    this.recordBreakthroughStone(count);
    return count;
  }

  /**
   * 3. 商店购买突破石
   * 500 铜钱/个，每日限购 20 个
   */
  buyBreakthroughStone(count: number): boolean {
    this.checkDailyReset();
    if (!this.materialDeps || count <= 0) return false;
    // 检查日限购
    if (this.dailyBreakstonePurchased + count > DAILY_BUY_LIMIT) return false;
    // 检查铜钱
    const totalCost = count * BREAKTHROUGH_STONE_PRICE;
    if (!this.materialDeps.consumeGold(totalCost)) return false;
    this.materialDeps.addBreakthroughStone(count);
    this.dailyBreakstonePurchased += count;
    this.recordBreakthroughStone(count);
    return true;
  }

  /**
   * 4. 成就奖励突破石
   * 特定成就奖励 10~50 个
   */
  claimAchievementReward(achievementId: string): number {
    this.checkDailyReset();
    if (!this.materialDeps || !achievementId) return 0;
    // 不可重复领取
    if (this.claimedAchievements.has(achievementId)) return 0;
    const reward = ACHIEVEMENT_BREAKTHROUGH_REWARDS[achievementId];
    if (reward === undefined) return 0;
    this.claimedAchievements.add(achievementId);
    this.materialDeps.addBreakthroughStone(reward);
    this.recordBreakthroughStone(reward);
    return reward;
  }

  /**
   * 5. 联盟商店购买突破石（预留接口，暂不实现）
   */
  buyFromAllianceShop(count: number): boolean {
    // 预留接口：联盟币购买，待联盟系统完善后实现
    return false;
  }

  /**
   * 6. 活动奖励突破石
   * 10~30 个
   */
  claimEventBreakthroughReward(): number {
    this.checkDailyReset();
    if (!this.materialDeps) return 0;
    const count = this.randInt(10, 30);
    this.materialDeps.addBreakthroughStone(count);
    this.recordBreakthroughStone(count);
    return count;
  }

  // ═══════════════════════════════════════════
  // 技能书获取途径
  // ═══════════════════════════════════════════

  /**
   * 1. 日常任务技能书
   * 每日 2 本，每日只能领取一次
   */
  claimDailyTaskSkillBook(): number {
    this.checkDailyReset();
    if (!this.materialDeps || this.dailySkillBookClaimed) return 0;
    this.dailySkillBookClaimed = true;
    this.materialDeps.addSkillBook(DAILY_SKILL_BOOK_COUNT);
    this.recordSkillBook(DAILY_SKILL_BOOK_COUNT);
    return DAILY_SKILL_BOOK_COUNT;
  }

  /**
   * 2. 远征掉落技能书
   * 每次远征 1~3 本，每日 2 次
   */
  claimExpeditionReward(expeditionId: string): number {
    this.checkDailyReset();
    if (!this.materialDeps || !expeditionId) return 0;
    // 每日远征次数限制
    if (this.dailyExpeditionCount >= MAX_DAILY_EXPEDITION) return 0;
    this.dailyExpeditionCount++;
    const count = this.randInt(1, 3);
    this.materialDeps.addSkillBook(count);
    this.recordSkillBook(count);
    return count;
  }

  /**
   * 3. 活动奖励技能书
   * 5~10 本
   */
  claimEventSkillBookReward(): number {
    this.checkDailyReset();
    if (!this.materialDeps) return 0;
    const count = this.randInt(5, 10);
    this.materialDeps.addSkillBook(count);
    this.recordSkillBook(count);
    return count;
  }

  /**
   * 4. 联盟商店购买技能书（预留接口，暂不实现）
   */
  buySkillBookFromAllianceShop(count: number): boolean {
    // 预留接口：联盟币购买，待联盟系统完善后实现
    return false;
  }

  /**
   * 5. 关卡首通技能书
   * 每关首通 1 本，不可重复领取
   */
  claimStageFirstClearSkillBook(stageId: string): number {
    this.checkDailyReset();
    if (!this.materialDeps || !stageId) return 0;
    // 不可重复领取同一关卡
    if (this.claimedFirstClearStages.has(stageId)) return 0;
    this.claimedFirstClearStages.add(stageId);
    const count = 1;
    this.materialDeps.addSkillBook(count);
    this.recordSkillBook(count);
    return count;
  }

  // ═══════════════════════════════════════════
  // 查询接口
  // ═══════════════════════════════════════════

  getDailyBreakstonePurchased(): number { this.checkDailyReset(); return this.dailyBreakstonePurchased; }
  getDailySkillBookClaimed(): boolean { this.checkDailyReset(); return this.dailySkillBookClaimed; }
  getDailyExpeditionCount(): number { this.checkDailyReset(); return this.dailyExpeditionCount; }
  getDailyBreakthroughStoneEarned(): number { this.checkDailyReset(); return this.dailyBreakthroughStoneEarned; }
  getDailySkillBookEarned(): number { this.checkDailyReset(); return this.dailySkillBookEarned; }
  getTotalBreakthroughStoneEarned(): number { return this.totalBreakthroughStoneEarned; }
  getTotalSkillBookEarned(): number { return this.totalSkillBookEarned; }
  getClaimedAchievements(): string[] { return [...this.claimedAchievements]; }
  getClaimedFirstClearStages(): string[] { return [...this.claimedFirstClearStages]; }

  /** 查询成就奖励数量（不领取） */
  getAchievementReward(achievementId: string): number | undefined {
    return ACHIEVEMENT_BREAKTHROUGH_REWARDS[achievementId];
  }

  /** 查询所有可用的成就奖励 ID */
  getAchievementIds(): string[] { return Object.keys(ACHIEVEMENT_BREAKTHROUGH_REWARDS); }

  /** 查询商店配置 */
  getShopConfig(): { price: number; dailyLimit: number } {
    return { price: BREAKTHROUGH_STONE_PRICE, dailyLimit: DAILY_BUY_LIMIT };
  }

  /** 查询远征配置 */
  getExpeditionConfig(): { maxDaily: number; minBooks: number; maxBooks: number } {
    return { maxDaily: MAX_DAILY_EXPEDITION, minBooks: 1, maxBooks: 3 };
  }

  // ═══════════════════════════════════════════
  // 序列化 / 反序列化
  // ═══════════════════════════════════════════

  serialize(): MaterialEconomySaveData {
    return {
      version: SAVE_VERSION,
      dailyBreakstonePurchased: this.dailyBreakstonePurchased,
      dailySkillBookClaimed: this.dailySkillBookClaimed,
      dailyExpeditionCount: this.dailyExpeditionCount,
      claimedAchievements: [...this.claimedAchievements],
      claimedFirstClearStages: [...this.claimedFirstClearStages],
      lastResetDate: this.lastResetDate,
      totalBreakthroughStoneEarned: this.totalBreakthroughStoneEarned,
      totalSkillBookEarned: this.totalSkillBookEarned,
      dailyBreakthroughStoneEarned: this.dailyBreakthroughStoneEarned,
      dailySkillBookEarned: this.dailySkillBookEarned,
    };
  }

  deserialize(data: MaterialEconomySaveData): void {
    this.dailyBreakstonePurchased = data.dailyBreakstonePurchased ?? 0;
    this.dailySkillBookClaimed = data.dailySkillBookClaimed ?? false;
    this.dailyExpeditionCount = data.dailyExpeditionCount ?? 0;
    this.claimedAchievements = new Set(data.claimedAchievements ?? []);
    this.claimedFirstClearStages = new Set(data.claimedFirstClearStages ?? []);
    this.lastResetDate = data.lastResetDate ?? '';
    this.totalBreakthroughStoneEarned = data.totalBreakthroughStoneEarned ?? 0;
    this.totalSkillBookEarned = data.totalSkillBookEarned ?? 0;
    this.dailyBreakthroughStoneEarned = data.dailyBreakthroughStoneEarned ?? 0;
    this.dailySkillBookEarned = data.dailySkillBookEarned ?? 0;
  }

  // ═══════════════════════════════════════════
  // 内部方法
  // ═══════════════════════════════════════════

  private checkDailyReset(): void {
    const today = this.todayString();
    if (this.lastResetDate !== today) {
      this.dailyBreakstonePurchased = 0;
      this.dailySkillBookClaimed = false;
      this.dailyExpeditionCount = 0;
      this.dailyBreakthroughStoneEarned = 0;
      this.dailySkillBookEarned = 0;
      this.lastResetDate = today;
    }
  }

  private recordBreakthroughStone(count: number): void {
    this.dailyBreakthroughStoneEarned += count;
    this.totalBreakthroughStoneEarned += count;
  }

  private recordSkillBook(count: number): void {
    this.dailySkillBookEarned += count;
    this.totalSkillBookEarned += count;
  }

  private todayString(): string {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  }

  private randInt(min: number, max: number): number {
    const rng = this.materialDeps?.random ?? Math.random;
    return Math.floor(rng() * (max - min + 1)) + min;
  }

  private random(): number {
    return (this.materialDeps?.random ?? Math.random)();
  }
}
