/**
 * 远征系统 — 战斗与奖励类型定义
 *
 * 包含：战斗评级、战斗结果、奖励、掉落物品、扫荡、里程碑
 *
 * @module core/expedition/expedition-battle.types
 */

// ─────────────────────────────────────────────
// 3. 战斗评级与结果
// ─────────────────────────────────────────────

/** 远征战斗评级 */
export enum BattleGrade {
  /** 大捷 ⭐⭐⭐ — 剩余血量>50%且无武将阵亡 */
  GREAT_VICTORY = 'GREAT_VICTORY',
  /** 小胜 ⭐⭐ — 剩余血量10%~50%或有武将阵亡 */
  MINOR_VICTORY = 'MINOR_VICTORY',
  /** 惨胜 ⭐ — 剩余血量<10% */
  PYRRHIC_VICTORY = 'PYRRHIC_VICTORY',
  /** 惜败 — 战斗失败 */
  NARROW_DEFEAT = 'NARROW_DEFEAT',
}

/** 评级星级映射 */
export const GRADE_STARS: Record<BattleGrade, number> = {
  [BattleGrade.GREAT_VICTORY]: 3,
  [BattleGrade.MINOR_VICTORY]: 2,
  [BattleGrade.PYRRHIC_VICTORY]: 1,
  [BattleGrade.NARROW_DEFEAT]: 0,
};

/** 评级标签映射 */
export const GRADE_LABELS: Record<BattleGrade, string> = {
  [BattleGrade.GREAT_VICTORY]: '大捷',
  [BattleGrade.MINOR_VICTORY]: '小胜',
  [BattleGrade.PYRRHIC_VICTORY]: '惨胜',
  [BattleGrade.NARROW_DEFEAT]: '惜败',
};

/** 远征战斗结果 */
export interface ExpeditionBattleResult {
  /** 战斗评级 */
  grade: BattleGrade;
  /** 星级 */
  stars: number;
  /** 总回合数 */
  totalTurns: number;
  /** 我方剩余血量百分比 */
  allyHpPercent: number;
  /** 我方阵亡数 */
  allyDeaths: number;
  /** 获得的经验值 */
  expGained: number;
}

// ─────────────────────────────────────────────
// 4. 奖励
// ─────────────────────────────────────────────

/** 远征奖励 */
export interface ExpeditionReward {
  /** 粮草 */
  grain: number;
  /** 铜钱 */
  gold: number;
  /** 铁矿 */
  iron: number;
  /** 装备碎片数 */
  equipFragments: number;
  /** 经验值 */
  exp: number;
  /** 掉落物品列表 */
  drops: DropItem[];
}

/** 掉落物品 */
export interface DropItem {
  /** 物品类型 */
  type: 'equip_fragment' | 'hero_fragment' | 'skill_book' | 'rare_material' | 'legendary_equip';
  /** 物品ID */
  id: string;
  /** 物品名称 */
  name: string;
  /** 数量 */
  count: number;
}

/** 扫荡类型 */
export enum SweepType {
  /** 普通扫荡 — 扫荡令×1，奖励×100% */
  NORMAL = 'NORMAL',
  /** 高级扫荡 — 扫荡令×3，奖励×150%+保底稀有 */
  ADVANCED = 'ADVANCED',
  /** 免费扫荡 — 无消耗，奖励×50% */
  FREE = 'FREE',
}

/** 扫荡配置 */
export const SWEEP_CONFIG: Record<SweepType, {
  cost: number;
  rewardMultiplier: number;
  dailyLimit: number;
  guaranteedRare: boolean;
}> = {
  [SweepType.NORMAL]: { cost: 1, rewardMultiplier: 1.0, dailyLimit: 5, guaranteedRare: false },
  [SweepType.ADVANCED]: { cost: 3, rewardMultiplier: 1.5, dailyLimit: 3, guaranteedRare: true },
  [SweepType.FREE]: { cost: 0, rewardMultiplier: 0.5, dailyLimit: 1, guaranteedRare: false },
};

/** 里程碑类型 */
export enum MilestoneType {
  /** 初出茅庐 — 通关第1条路线 */
  FIRST_CLEAR = 'FIRST_CLEAR',
  /** 百战百胜 — 累计通关10次 */
  TEN_CLEARS = 'TEN_CLEARS',
  /** 三星通关 — 任意路线获得3星 */
  THREE_STAR = 'THREE_STAR',
  /** 全路线通关 — 通关所有路线 */
  ALL_ROUTES = 'ALL_ROUTES',
  /** 远征大师 — 所有路线三星 */
  ALL_THREE_STAR = 'ALL_THREE_STAR',
  /** 三十战 — 累计通关30次 */
  THIRTY_CLEARS = 'THIRTY_CLEARS',
  /** 全部通关 */
  ALL_CLEARS = 'ALL_CLEARS',
}

/** 里程碑配置 */
export interface MilestoneConfig {
  /** 里程碑类型 */
  type: MilestoneType;
  /** 里程碑名称 */
  name: string;
  /** 里程碑描述 */
  description?: string;
  /** 奖励 */
  reward: ExpeditionReward;
  /** 需要通关次数 */
  requiredClears?: number;
}
