/**
 * Tech detail - types
 *
 * Extracted from TechDetailProvider.ts.
 */

import type { TechNodeDef, TechEffect, TechEffectType, TechNodeState } from './tech.types';
import { TECH_NODE_MAP } from './tech-config';
import { TECH_PATH_LABELS, TECH_PATH_COLORS } from './tech.types';
import type { FusionTechDef, FusionTechState } from './fusion-tech.types';
import { FUSION_TECH_MAP } from './fusion-tech.types';
import type { TechTreeSystem } from './TechTreeSystem';
import type { FusionTechSystem } from './FusionTechSystem';
import type { TechLinkSystem } from './TechLinkSystem';
// ─────────────────────────────────────────────
// 1. 详情数据类型
// ─────────────────────────────────────────────

export interface EffectDisplay {
  /** 效果类型 */
  type: TechEffectType;
  /** 效果目标 */
  target: string;
  /** 效果值（百分比） */
  value: number;
  /** 可读描述 */
  description: string;
}

/** 前置条件展示信息 */
export interface PrerequisiteDisplay {
  /** 节点 ID */
  id: string;
  /** 节点名称 */
  name: string;
  /** 是否已完成 */
  completed: boolean;
  /** 所属路线 */
  path: string;
  /** 路线中文名 */
  pathLabel: string;
}

/** 消耗展示信息 */
export interface CostDisplay {
  /** 消耗类型 */
  type: 'tech_points';
  /** 消耗类型中文名 */
  typeLabel: string;
  /** 消耗数量 */
  amount: number;
  /** 当前拥有数量 */
  current: number;
  /** 是否足够 */
  sufficient: boolean;
}

/** 研究时间展示信息 */
export interface TimeDisplay {
  /** 基础研究时间（秒） */
  baseTime: number;
  /** 实际研究时间（秒，含加成） */
  actualTime: number;
  /** 研究速度加成百分比 */
  speedBonus: number;
  /** 格式化的基础时间 */
  formattedBase: string;
  /** 格式化的实际时间 */
  formattedActual: string;
}

/** 联动效果展示信息 */
export interface LinkEffectDisplay {
  /** 联动目标系统 */
  target: string;
  /** 联动目标子类型 */
  targetSub: string;
  /** 联动效果描述 */
  description: string;
  /** 效果值 */
  value: number;
}

/** 科技节点完整详情 */
export interface TechDetail {
  /** 节点 ID */
  id: string;
  /** 节点名称 */
  name: string;
  /** 节点描述 */
  description: string;
  /** 节点图标 */
  icon: string;
  /** 所属路线 */
  path: string;
  /** 路线中文名 */
  pathLabel: string;
  /** 路线颜色 */
  pathColor: string;
  /** 层级 */
  tier: number;
  /** 是否为融合科技 */
  isFusion: boolean;
  /** 当前状态 */
  status: string;
  /** 效果列表 */
  effects: EffectDisplay[];
  /** 前置条件列表 */
  prerequisites: PrerequisiteDisplay[];
  /** 消耗信息 */
  cost: CostDisplay;
  /** 研究时间 */
  researchTime: TimeDisplay;
  /** 联动效果列表 */
  linkEffects: LinkEffectDisplay[];
}

// ─────────────────────────────────────────────
// 2. 辅助函数
// ─────────────────────────────────────────────

/** 效果类型中文映射 */
const EFFECT_TYPE_LABELS: Record<string, string> = {
  resource_production: '资源产出',
  troop_attack: '兵种攻击',
  troop_defense: '兵种防御',
  troop_hp: '兵种生命',
  building_production: '建筑产出',
  hero_exp: '武将经验',
  research_speed: '研究速度',
  march_speed: '行军速度',
  resource_cap: '资源上限',
  recruit_discount: '招募折扣',
};

/** 目标中文映射 */
const TARGET_LABELS: Record<string, string> = {
  all: '全体',
  cavalry: '骑兵',
  infantry: '步兵',
  grain: '粮草',
  gold: '铜钱',
  troops: '兵力',
  mandate: '天命',
};

/** 格式化秒数为可读时间 */
export function formatTime(seconds: number): string {
  if (seconds <= 0) return '0秒';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}小时`);
  if (m > 0) parts.push(`${m}分`);
  if (s > 0) parts.push(`${s}秒`);
  return parts.join('');
}

/** 生成效果可读描述 */
export function describeEffect(effect: TechEffect): string {
  const typeLabel = EFFECT_TYPE_LABELS[effect.type] ?? effect.type;
  const targetLabel = TARGET_LABELS[effect.target] ?? effect.target;
  const sign = effect.value >= 0 ? '+' : '';
  return `${typeLabel}(${targetLabel}) ${sign}${effect.value}%`;
}

// ─────────────────────────────────────────────
// 3. TechDetailProvider
// ─────────────────────────────────────────────

