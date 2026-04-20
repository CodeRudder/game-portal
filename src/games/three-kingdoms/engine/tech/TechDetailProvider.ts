/**
 * 科技域 — 科技节点详情数据提供者
 *
 * 职责：
 * - 提供科技节点详情弹窗所需的完整数据
 * - 包含效果列表、前置条件、消耗、研究时间
 * - 支持普通科技和融合科技
 * - 提供格式化方法供 UI 直接消费
 *
 * 设计原则：
 * - 纯数据组装层，不持有可变状态
 * - 通过依赖系统查询实时数据
 * - 返回结构化数据供 UI 渲染
 *
 * @module engine/tech/TechDetailProvider
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

/** 单条效果展示信息 */
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
function formatTime(seconds: number): string {
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
function describeEffect(effect: TechEffect): string {
  const typeLabel = EFFECT_TYPE_LABELS[effect.type] ?? effect.type;
  const targetLabel = TARGET_LABELS[effect.target] ?? effect.target;
  const sign = effect.value >= 0 ? '+' : '';
  return `${typeLabel}(${targetLabel}) ${sign}${effect.value}%`;
}

// ─────────────────────────────────────────────
// 3. TechDetailProvider
// ─────────────────────────────────────────────

export class TechDetailProvider {
  /** 依赖的科技树系统 */
  private techTree: TechTreeSystem | null = null;
  /** 依赖的融合科技系统 */
  private fusionSystem: FusionTechSystem | null = null;
  /** 依赖的联动系统 */
  private linkSystem: TechLinkSystem | null = null;
  /** 获取当前科技点数的回调 */
  private getCurrentTechPoints: () => number;
  /** 获取研究速度加成的回调 */
  private getResearchSpeedBonus: () => number;

  constructor(
    getCurrentTechPoints: () => number = () => 0,
    getResearchSpeedBonus: () => number = () => 0,
  ) {
    this.getCurrentTechPoints = getCurrentTechPoints;
    this.getResearchSpeedBonus = getResearchSpeedBonus;
  }

  // ─────────────────────────────────────────
  // 依赖注入
  // ─────────────────────────────────────────

  /** 注入科技树系统 */
  setTechTree(techTree: TechTreeSystem): void {
    this.techTree = techTree;
  }

  /** 注入融合科技系统 */
  setFusionSystem(fusionSystem: FusionTechSystem): void {
    this.fusionSystem = fusionSystem;
  }

  /** 注入联动系统 */
  setLinkSystem(linkSystem: TechLinkSystem): void {
    this.linkSystem = linkSystem;
  }

  // ─────────────────────────────────────────
  // 核心接口
  // ─────────────────────────────────────────

  /**
   * 获取科技节点详情（自动判断普通/融合科技）
   *
   * @param techId - 科技节点 ID
   * @returns 详情数据，不存在返回 null
   */
  getTechDetail(techId: string): TechDetail | null {
    // 先尝试普通科技
    const normalDef = TECH_NODE_MAP.get(techId);
    if (normalDef) {
      return this.buildNormalDetail(normalDef);
    }

    // 再尝试融合科技
    const fusionDef = FUSION_TECH_MAP.get(techId);
    if (fusionDef) {
      return this.buildFusionDetail(fusionDef);
    }

    return null;
  }

  /**
   * 批量获取多个科技节点详情
   *
   * @param techIds - 科技节点 ID 列表
   * @returns 详情数组（跳过不存在的）
   */
  getTechDetails(techIds: string[]): TechDetail[] {
    const details: TechDetail[] = [];
    for (const id of techIds) {
      const detail = this.getTechDetail(id);
      if (detail) details.push(detail);
    }
    return details;
  }

  // ─────────────────────────────────────────
  // 普通科技详情构建
  // ─────────────────────────────────────────

  /** 构建普通科技详情 */
  private buildNormalDetail(def: TechNodeDef): TechDetail {
    const state = this.techTree?.getNodeState(def.id);
    const status = state?.status ?? 'locked';
    const currentPoints = this.getCurrentTechPoints();
    const speedBonus = this.getResearchSpeedBonus();

    return {
      id: def.id,
      name: def.name,
      description: def.description,
      icon: def.icon,
      path: def.path,
      pathLabel: TECH_PATH_LABELS[def.path],
      pathColor: TECH_PATH_COLORS[def.path],
      tier: def.tier,
      isFusion: false,
      status,
      effects: this.buildEffects(def.effects),
      prerequisites: this.buildPrerequisites(def.prerequisites),
      cost: {
        type: 'tech_points',
        typeLabel: '科技点',
        amount: def.costPoints,
        current: currentPoints,
        sufficient: currentPoints >= def.costPoints,
      },
      researchTime: this.buildTimeDisplay(def.researchTime, speedBonus),
      linkEffects: this.buildLinkEffects(def.id),
    };
  }

  // ─────────────────────────────────────────
  // 融合科技详情构建
  // ─────────────────────────────────────────

  /** 构建融合科技详情 */
  private buildFusionDetail(def: FusionTechDef): TechDetail {
    const state = this.fusionSystem?.getFusionState(def.id);
    const status = state?.status ?? 'locked';
    const currentPoints = this.getCurrentTechPoints();
    const speedBonus = this.getResearchSpeedBonus();

    // 融合科技路线标签
    const pathLabel = `${TECH_PATH_LABELS[def.pathPair[0]]}+${TECH_PATH_LABELS[def.pathPair[1]]}`;
    const pathColor = TECH_PATH_COLORS[def.pathPair[0]]; // 用第一条路线颜色

    return {
      id: def.id,
      name: def.name,
      description: def.description,
      icon: def.icon,
      path: `${def.pathPair[0]}+${def.pathPair[1]}`,
      pathLabel,
      pathColor,
      tier: 0, // 融合科技没有层级概念
      isFusion: true,
      status,
      effects: this.buildEffects(def.effects),
      prerequisites: this.buildFusionPrerequisites(def),
      cost: {
        type: 'tech_points',
        typeLabel: '科技点',
        amount: def.costPoints,
        current: currentPoints,
        sufficient: currentPoints >= def.costPoints,
      },
      researchTime: this.buildTimeDisplay(def.researchTime, speedBonus),
      linkEffects: [], // 融合科技暂无联动
    };
  }

  // ─────────────────────────────────────────
  // 子组件构建
  // ─────────────────────────────────────────

  /** 构建效果展示列表 */
  private buildEffects(effects: TechEffect[]): EffectDisplay[] {
    return effects.map((eff) => ({
      type: eff.type,
      target: eff.target,
      value: eff.value,
      description: describeEffect(eff),
    }));
  }

  /** 构建普通科技前置条件展示 */
  private buildPrerequisites(prereqIds: string[]): PrerequisiteDisplay[] {
    return prereqIds.map((id) => {
      const def = TECH_NODE_MAP.get(id);
      const state = this.techTree?.getNodeState(id);
      return {
        id,
        name: def?.name ?? id,
        completed: state?.status === 'completed',
        path: def?.path ?? '',
        pathLabel: def ? TECH_PATH_LABELS[def.path] : '',
      };
    });
  }

  /** 构建融合科技前置条件展示 */
  private buildFusionPrerequisites(def: FusionTechDef): PrerequisiteDisplay[] {
    const { pathA, pathB } = def.prerequisites;
    const results: PrerequisiteDisplay[] = [];

    const defA = TECH_NODE_MAP.get(pathA);
    const stateA = this.techTree?.getNodeState(pathA);
    if (defA) {
      results.push({
        id: pathA,
        name: defA.name,
        completed: stateA?.status === 'completed',
        path: defA.path,
        pathLabel: TECH_PATH_LABELS[defA.path],
      });
    }

    const defB = TECH_NODE_MAP.get(pathB);
    const stateB = this.techTree?.getNodeState(pathB);
    if (defB) {
      results.push({
        id: pathB,
        name: defB.name,
        completed: stateB?.status === 'completed',
        path: defB.path,
        pathLabel: TECH_PATH_LABELS[defB.path],
      });
    }

    return results;
  }

  /** 构建研究时间展示 */
  private buildTimeDisplay(baseTime: number, speedBonus: number): TimeDisplay {
    const actualTime = speedBonus > 0 ? baseTime / (1 + speedBonus / 100) : baseTime;
    return {
      baseTime,
      actualTime: Math.ceil(actualTime),
      speedBonus,
      formattedBase: formatTime(baseTime),
      formattedActual: formatTime(Math.ceil(actualTime)),
    };
  }

  /** 构建联动效果展示 */
  private buildLinkEffects(techId: string): LinkEffectDisplay[] {
    if (!this.linkSystem) return [];
    const links = this.linkSystem.getLinksByTechId(techId);
    return links.map((link) => ({
      target: link.target,
      targetSub: link.targetSub,
      description: link.description,
      value: link.value,
    }));
  }
}
