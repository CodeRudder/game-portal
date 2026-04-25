/**
 * 核心层 — v20.0 数值平衡类型定义
 *
 * 涵盖 BalanceValidator 的所有类型：
 *   - 资源产出平衡 (#5)
 *   - 武将战力平衡 (#6)
 *   - 战斗难度曲线 (#7)
 *   - 经济系统平衡 (#8)
 *   - 转生倍率平衡 (#9)
 *
 * @module core/unification/balance.types
 */

// ─────────────────────────────────────────────
// 1. 通用类型
// ─────────────────────────────────────────────

/** 验证结果等级 */
export type ValidationLevel = 'pass' | 'warning' | 'fail';

/** 单项验证结果 */
export interface ValidationEntry {
  /** 功能点编号 */
  featureId: string;
  /** 验证维度 */
  dimension: BalanceDimension;
  /** 结果等级 */
  level: ValidationLevel;
  /** 实际值 */
  actual: number;
  /** 期望值（或范围） */
  expected: number | NumericRange;
  /** 偏差百分比 */
  deviation: number;
  /** 描述 */
  message: string;
}

/** 数值范围 */
export interface NumericRange {
  min: number;
  max: number;
}

/** 平衡维度枚举 */
export type BalanceDimension =
  | 'resource_production'   // 资源产出
  | 'hero_power'            // 武将战力
  | 'battle_difficulty'     // 战斗难度
  | 'economy'               // 经济系统
  | 'rebirth_multiplier';   // 转生倍率

/** 平衡验证报告 */
export interface BalanceReport {
  /** 报告 ID */
  id: string;
  /** 生成时间戳 */
  timestamp: number;
  /** 总体等级 */
  overallLevel: ValidationLevel;
  /** 各维度结果 */
  entries: ValidationEntry[];
  /** 汇总统计 */
  summary: BalanceSummary;
}

/** 平衡验证汇总 */
export interface BalanceSummary {
  /** 总检查项数 */
  totalChecks: number;
  /** 通过数 */
  passCount: number;
  /** 警告数 */
  warningCount: number;
  /** 失败数 */
  failCount: number;
  /** 通过率 */
  passRate: number;
}

// ─────────────────────────────────────────────
// 2. 资源产出平衡 (#5)
// ─────────────────────────────────────────────

/** 资源类型标识 */
export type BalanceResourceType = 'grain' | 'gold' | 'troops' | 'mandate';

/** 资源产出曲线数据点 */
export interface ResourceCurvePoint {
  /** 游戏天数 */
  day: number;
  /** 产出速率（每秒） */
  productionRate: number;
  /** 累计产出 */
  totalProduced: number;
  /** 累计消耗 */
  totalConsumed: number;
  /** 净收入 */
  netIncome: number;
}

/** 资源平衡配置 */
export interface ResourceBalanceConfig {
  /** 资源类型 */
  resourceType: BalanceResourceType;
  /** 早期日产出期望范围 */
  earlyGameDailyRange: NumericRange;
  /** 中期日产出期望范围 */
  midGameDailyRange: NumericRange;
  /** 后期日产出期望范围 */
  lateGameDailyRange: NumericRange;
  /** 产出/消耗比期望范围 */
  productionConsumptionRatio: NumericRange;
  /** 最大偏差容忍度（百分比） */
  maxDeviationPercent: number;
}

/** 资源平衡验证结果 */
export interface ResourceBalanceResult {
  /** 资源类型 */
  resourceType: BalanceResourceType;
  /** 各阶段数据 */
  curvePoints: ResourceCurvePoint[];
  /** 是否平衡 */
  isBalanced: boolean;
  /** 验证条目 */
  entries: ValidationEntry[];
}

// ─────────────────────────────────────────────
// 3. 武将战力平衡 (#6)
// ─────────────────────────────────────────────

/** 武将品质等级标识 */
export type HeroQualityTier = 'COMMON' | 'FINE' | 'RARE' | 'EPIC' | 'LEGENDARY';

/** 武将战力数据点 */
export interface HeroPowerPoint {
  /** 等级 */
  level: number;
  /** 品质 */
  quality: HeroQualityTier;
  /** 基础属性 */
  baseStats: HeroBaseStats;
  /** 总战力 */
  totalPower: number;
  /** 成长倍率 */
  growthMultiplier: number;
}

/** 武将基础属性 */
export interface HeroBaseStats {
  attack: number;
  defense: number;
  hp: number;
  speed: number;
}

/** 武将战力平衡配置 */
export interface HeroBalanceConfig {
  /** 品质 */
  quality: HeroQualityTier;
  /** 1级基础属性范围 */
  baseStatsRange: Record<keyof HeroBaseStats, NumericRange>;
  /** 满级属性范围 */
  maxLevelStatsRange: Record<keyof HeroBaseStats, NumericRange>;
  /** 相邻品质战力比范围 */
  qualityRatioRange: NumericRange;
  /** 成长曲线类型 */
  growthCurveType: 'linear' | 'exponential' | 'logarithmic';
}

/** 武将战力验证结果 */
export interface HeroBalanceResult {
  /** 品质 */
  quality: HeroQualityTier;
  /** 各等级数据 */
  powerPoints: HeroPowerPoint[];
  /** 是否平衡 */
  isBalanced: boolean;
  /** 验证条目 */
  entries: ValidationEntry[];
}

// ─────────────────────────────────────────────
// 4. 战斗难度曲线 (#7)
// ─────────────────────────────────────────────

/** 关卡难度数据点 */
export interface StageDifficultyPoint {
  /** 章节索引 */
  chapterIndex: number;
  /** 关卡索引 */
  stageIndex: number;
  /** 敌方战力 */
  enemyPower: number;
  /** 推荐战力 */
  recommendedPower: number;
  /** 难度系数 (0~1) */
  difficultyFactor: number;
}

/** 战斗难度配置 */
export interface BattleDifficultyConfig {
  /** 总章节数 */
  totalChapters: number;
  /** 每章关卡数 */
  stagesPerChapter: number;
  /** 首关敌方战力 */
  firstStagePower: number;
  /** 末关敌方战力 */
  lastStagePower: number;
  /** 难度递增类型 */
  curveType: 'linear' | 'exponential' | 'stepped';
  /** 递增系数 */
  growthFactor: number;
  /** 每章 BOSS 战力倍率 */
  bossMultiplier: number;
}

/** 战斗难度验证结果 */
export interface BattleDifficultyResult {
  /** 各关卡数据 */
  stagePoints: StageDifficultyPoint[];
  /** 是否平衡 */
  isBalanced: boolean;
  /** 验证条目 */
  entries: ValidationEntry[];
}

// ─────────────────────────────────────────────
// 5. 经济系统平衡 (#8)
// ─────────────────────────────────────────────

/** 货币类型标识 */
export type BalanceCurrencyType = 'copper' | 'mandate' | 'recruit' | 'ingot';

/** 货币获取/消耗数据点 */
export interface CurrencyFlowPoint {
  /** 货币类型 */
  currency: BalanceCurrencyType;
  /** 日均获取量 */
  dailyAcquisition: number;
  /** 日均消耗量 */
  dailyConsumption: number;
  /** 净流量（正=盈余，负=亏损） */
  netFlow: number;
  /** 获取途径数 */
  acquisitionSources: number;
  /** 消耗途径数 */
  consumptionSinks: number;
}

/** 经济平衡配置 */
export interface EconomyBalanceConfig {
  /** 货币类型 */
  currency: BalanceCurrencyType;
  /** 日获取量期望范围 */
  dailyAcquisitionRange: NumericRange;
  /** 日消耗量期望范围 */
  dailyConsumptionRange: NumericRange;
  /** 获取/消耗比期望范围 */
  acquisitionConsumptionRatio: NumericRange;
  /** 通胀警戒线（日盈余占比） */
  inflationWarningThreshold: number;
}

/** 经济验证结果 */
export interface EconomyBalanceResult {
  /** 各货币数据 */
  currencyFlows: CurrencyFlowPoint[];
  /** 是否平衡 */
  isBalanced: boolean;
  /** 验证条目 */
  entries: ValidationEntry[];
}

// ─────────────────────────────────────────────
// 6. 转生倍率平衡 (#9)
// ─────────────────────────────────────────────

/** 转生倍率数据点 */
export interface RebirthMultiplierPoint {
  /** 转生次数 (1~20) */
  rebirthCount: number;
  /** 当前倍率 */
  multiplier: number;
  /** 倍率增量 */
  increment: number;
  /** 累计加速效果 */
  cumulativeAcceleration: number;
}

/** 转生倍率配置 */
export interface RebirthBalanceConfig {
  /** 最大转生次数 */
  maxRebirthCount: number;
  /** 基础倍率 */
  baseMultiplier: number;
  /** 每次增量 */
  perRebirthIncrement: number;
  /** 最大倍率 */
  maxMultiplier: number;
  /** 倍率增长曲线类型 */
  curveType: 'linear' | 'diminishing' | 'accelerating' | 'logarithmic';
  /** 衰减因子（diminishing 曲线时使用） */
  decayFactor: number;
}

/** 转生倍率验证结果 */
export interface RebirthBalanceResult {
  /** 各次转生数据 */
  multiplierPoints: RebirthMultiplierPoint[];
  /** 是否平衡 */
  isBalanced: boolean;
  /** 验证条目 */
  entries: ValidationEntry[];
}
