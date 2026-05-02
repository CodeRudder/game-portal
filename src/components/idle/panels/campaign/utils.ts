/**
 * campaign/utils — 关卡面板共享工具函数
 *
 * 从 BattleScene / BattleResultModal / CampaignTab 中提取的公共函数，
 * 消除跨组件重复定义。
 *
 * @module components/idle/panels/campaign/utils
 */

import { BattleOutcome, StarRating } from '@/games/three-kingdoms/engine';
import type { BattleResult } from '@/games/three-kingdoms/engine';

// ─────────────────────────────────────────────
// 1. createDefaultBattleResult
// ─────────────────────────────────────────────

/**
 * 创建一个安全的"放弃/异常"战斗结果（用于空编队、主动退出等场景）
 *
 * 表示玩家未正常完成战斗，星级为 NONE。
 * 原 BattleScene.tsx 内联定义，现抽取为共享函数。
 */
export function createDefaultBattleResult(): BattleResult {
  return {
    outcome: BattleOutcome.DEFEAT,
    stars: StarRating.NONE,
    totalTurns: 0,
    allySurvivors: 0,
    enemySurvivors: 0,
    enemyTotalDamage: 0,
    allyTotalDamage: 0,
    maxSingleDamage: 0,
    maxCombo: 0,
    summary: '战斗未完成',
    fragmentRewards: {},
  };
}

// ─────────────────────────────────────────────
// 2. filterDamageFloats
// ─────────────────────────────────────────────

/** 伤害飘字条目（与 BattleAnimation useBattleAnimation 输出一致） */
export interface DamageFloat {
  id: number;
  unitId: string;
  value: number;
  isCritical: boolean;
  isHeal: boolean;
}

/**
 * 根据战斗速度过滤伤害飘字
 *
 * - 1x：显示全部
 * - 2x：只显示暴击 + 治疗
 * - 3x 及以上：只显示暴击（KO 由死亡动画处理）
 *
 * 原 BattleScene.tsx 内联 useCallback，现抽取为纯函数以便测试。
 */
export function filterDamageFloats(
  floats: DamageFloat[],
  unitId: string,
  speed: number,
): DamageFloat[] {
  const unitFloats = floats.filter((f) => f.unitId === unitId);
  if (speed <= 1) return unitFloats;
  if (speed === 2) return unitFloats.filter((f) => f.isCritical || f.isHeal);
  return unitFloats.filter((f) => f.isCritical);
}

// ─────────────────────────────────────────────
// 3. buildFragmentDrops
// ─────────────────────────────────────────────

/** 碎片掉落条目 */
export interface FragmentDropItem {
  /** 武将ID */
  generalId: string;
  /** 武将名称 */
  generalName: string;
  /** 碎片数量 */
  count: number;
  /** 是否首通必掉 */
  isFirstClearGuaranteed: boolean;
  /** 掉落概率描述 */
  dropRateLabel: string;
}

/**
 * 构建碎片掉落展示数据
 *
 * @param fragmentRewards - 碎片奖励映射（generalId → count）
 * @param isFirstClear - 是否首通
 * @param generalNames - 武将名称查找表
 * @returns 碎片掉落展示条目列表
 *
 * 原 BattleResultModal.tsx 内联定义，现抽取为共享函数。
 */
export function buildFragmentDrops(
  fragmentRewards: Record<string, number>,
  isFirstClear: boolean,
  generalNames: Record<string, string> = {},
): FragmentDropItem[] {
  if (!fragmentRewards || Object.keys(fragmentRewards).length === 0) return [];

  return Object.entries(fragmentRewards).map(([generalId, count]) => ({
    generalId,
    generalName: generalNames[generalId] || generalId,
    count,
    isFirstClearGuaranteed: isFirstClear,
    dropRateLabel: isFirstClear ? '100%必掉' : '10%概率',
  }));
}

// ─────────────────────────────────────────────
// 4. 格式化工具
// ─────────────────────────────────────────────

/** 格式化秒数为可读时间 */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0分钟';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
  return `${m}分钟`;
}

/** 格式化大数字（≥10000 显示"万"） */
export function formatNum(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return n.toLocaleString();
}

/** 资源名称映射 */
const RESOURCE_LABELS: Record<string, string> = {
  grain: '粮草',
  gold: '铜钱',
  troops: '兵力',
  mandate: '天命',
  techPoint: '科技点',
  recruitToken: '招募令',
  skillBook: '技能书',
  tiger_tally: '虎符',
  war_script: '兵法',
  forge_stone: '锻造石',
  exp_book_small: '经验书·小',
  exp_book_medium: '经验书·中',
  exp_book_large: '经验书·大',
};

/** 获取资源类型中文名 */
export function getResourceLabel(type: string): string {
  if (type.startsWith('fragment_')) {
    return `${type.replace('fragment_', '')}碎片`;
  }
  return RESOURCE_LABELS[type] ?? type;
}
