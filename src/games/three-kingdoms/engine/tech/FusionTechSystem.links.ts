/**
 * 科技域 — 融合科技联动效果数据与操作
 *
 * 从 FusionTechSystem.ts 中提取的融合科技联动效果注册、查询和同步逻辑。
 *
 * @module engine/tech/FusionTechSystem.links
 */

import type {
  FusionLinkEffect,
  FusionTechState,
} from './fusion-tech.types';
import type { TechPath } from './tech.types';
import type { TechLinkSystem } from './TechLinkSystem';

// ─────────────────────────────────────────────
// 默认联动效果数据
// ─────────────────────────────────────────────

/** 默认融合科技联动效果列表 */
export const DEFAULT_FUSION_LINKS: FusionLinkEffect[] = [
  // ── 兵精粮足 → 建筑/资源联动 ──
  { id: 'fl_mil_eco_1_barracks', fusionTechId: 'fusion_mil_eco_1', target: 'building', targetSub: 'barracks', description: '兵精粮足：兵营训练速度+10%', value: 10 },
  { id: 'fl_mil_eco_1_grain', fusionTechId: 'fusion_mil_eco_1', target: 'resource', targetSub: 'grain', description: '兵精粮足：粮草产出+15%', value: 15 },
  // ── 铁骑商路 → 建筑/资源联动 ──
  { id: 'fl_mil_eco_2_stable', fusionTechId: 'fusion_mil_eco_2', target: 'building', targetSub: 'stable', description: '铁骑商路：马厩产出+20%', value: 20, unlockFeature: true, unlockDescription: '解锁精锐骑兵训练' },
  { id: 'fl_mil_eco_2_gold', fusionTechId: 'fusion_mil_eco_2', target: 'resource', targetSub: 'gold', description: '铁骑商路：铜钱产出+20%', value: 20 },
  // ── 兵法大家 → 武将联动 ──
  { id: 'fl_mil_cul_1_hero', fusionTechId: 'fusion_mil_cul_1', target: 'hero', targetSub: 'all_skill_exp', description: '兵法大家：武将技能经验+20%', value: 20 },
  { id: 'fl_mil_cul_1_academy', fusionTechId: 'fusion_mil_cul_1', target: 'building', targetSub: 'academy', description: '兵法大家：书院研究速度+10%', value: 10 },
  // ── 名将传承 → 武将联动 ──
  { id: 'fl_mil_cul_2_hero', fusionTechId: 'fusion_mil_cul_2', target: 'hero', targetSub: 'infantry_command', description: '名将传承：步兵指挥+25%', value: 25, unlockSkill: true },
  { id: 'fl_mil_cul_2_research', fusionTechId: 'fusion_mil_cul_2', target: 'resource', targetSub: 'mandate', description: '名将传承：天命获取+15%', value: 15 },
  // ── 文景之治 → 资源联动 ──
  { id: 'fl_eco_cul_1_all_res', fusionTechId: 'fusion_eco_cul_1', target: 'resource', targetSub: 'grain', description: '文景之治：粮草产出+15%', value: 15 },
  { id: 'fl_eco_cul_1_hero_exp', fusionTechId: 'fusion_eco_cul_1', target: 'hero', targetSub: 'all_skill_exp', description: '文景之治：武将经验+15%', value: 15 },
  // ── 盛世华章 → 资源/武将联动 ──
  { id: 'fl_eco_cul_2_gold', fusionTechId: 'fusion_eco_cul_2', target: 'resource', targetSub: 'gold', description: '盛世华章：铜钱产出+25%', value: 25 },
  { id: 'fl_eco_cul_2_recruit', fusionTechId: 'fusion_eco_cul_2', target: 'hero', targetSub: 'recruit_quality', description: '盛世华章：招募折扣+15%', value: 15, unlockSkill: true },
];

// ─────────────────────────────────────────────
// 联动效果操作
// ─────────────────────────────────────────────

/** 从默认列表创建联动效果 Map */
export function createFusionLinksMap(): Map<string, FusionLinkEffect> {
  const map = new Map<string, FusionLinkEffect>();
  for (const link of DEFAULT_FUSION_LINKS) {
    map.set(link.id, link);
  }
  return map;
}

/** 获取融合科技的联动效果列表 */
export function getFusionLinkEffects(
  fusionTechId: string,
  fusionLinks: Map<string, FusionLinkEffect>,
): FusionLinkEffect[] {
  const result: FusionLinkEffect[] = [];
  for (const link of fusionLinks.values()) {
    if (link.fusionTechId === fusionTechId) {
      result.push(link);
    }
  }
  return result;
}

/** 获取所有已完成融合科技的联动效果 */
export function getActiveFusionLinkEffects(
  fusionLinks: Map<string, FusionLinkEffect>,
  nodes: Record<string, FusionTechState>,
): FusionLinkEffect[] {
  const result: FusionLinkEffect[] = [];
  for (const link of fusionLinks.values()) {
    if (nodes[link.fusionTechId]?.status === 'completed') {
      result.push(link);
    }
  }
  return result;
}

/** 获取已完成融合科技对指定目标的联动加成总值 */
export function getFusionLinkBonus(
  target: 'building' | 'hero' | 'resource',
  targetSub: string,
  fusionLinks: Map<string, FusionLinkEffect>,
  nodes: Record<string, FusionTechState>,
): number {
  let total = 0;
  for (const link of fusionLinks.values()) {
    if (link.target !== target || link.targetSub !== targetSub) continue;
    if (nodes[link.fusionTechId]?.status !== 'completed') continue;
    total += link.value;
  }
  return total;
}

/** 同步融合科技联动效果到联动系统 */
export function syncFusionLinksToLinkSystem(
  fusionTechId: string,
  fusionLinks: Map<string, FusionLinkEffect>,
  nodes: Record<string, FusionTechState>,
  linkSystem: TechLinkSystem | null,
): void {
  if (!linkSystem) return;
  const links = getFusionLinkEffects(fusionTechId, fusionLinks);
  for (const fl of links) {
    linkSystem.registerLink({
      id: fl.id,
      techId: fl.fusionTechId,
      target: fl.target,
      targetSub: fl.targetSub,
      description: fl.description,
      value: fl.value,
      unlockFeature: fl.unlockFeature,
      unlockDescription: fl.unlockDescription,
      unlockSkill: fl.unlockSkill,
      newSkillDescription: fl.newSkillDescription,
    });
    linkSystem.addCompletedTech(fl.fusionTechId);
  }
}

// ─────────────────────────────────────────────
// 前置条件详细检查
// ─────────────────────────────────────────────

import type {
  PrerequisiteCheckResult,
  PathGroupCheckResult,
} from './fusion-tech.types';

/** 前置条件检查的依赖接口 */
export interface PrerequisiteCheckDeps {
  getNodeDef: (id: string) => { path: string } | undefined;
  getNodeState: (id: string) => { status: string } | undefined;
}

/** 详细检查融合科技的前置条件（v5.0 扩展） */
export function checkPrerequisitesDetailed(
  id: string,
  prerequisites: { pathA: string; pathB: string },
  deps: PrerequisiteCheckDeps,
): PrerequisiteCheckResult {
  const { pathA, pathB } = prerequisites;
  const defA = deps.getNodeDef(pathA);
  const defB = deps.getNodeDef(pathB);
  const stateA = deps.getNodeState(pathA);
  const stateB = deps.getNodeState(pathB);

  const groupA: PathGroupCheckResult = {
    path: (defA?.path ?? 'military') as TechPath,
    requiredNodes: [pathA],
    completedNodes: stateA?.status === 'completed' ? [pathA] : [],
    minCompleted: 1,
    actualCompleted: stateA?.status === 'completed' ? 1 : 0,
    met: stateA?.status === 'completed',
  };

  const groupB: PathGroupCheckResult = {
    path: (defB?.path ?? 'economy') as TechPath,
    requiredNodes: [pathB],
    completedNodes: stateB?.status === 'completed' ? [pathB] : [],
    minCompleted: 1,
    actualCompleted: stateB?.status === 'completed' ? 1 : 0,
    met: stateB?.status === 'completed',
  };

  return {
    met: groupA.met && groupB.met,
    groups: [groupA, groupB],
  };
}

/** 检查指定路线组合的所有融合科技解锁进度 */
export function getPathPairProgress(
  fusions: { id: string }[],
  nodes: Record<string, FusionTechState>,
): { total: number; available: number; completed: number; locked: number } {
  let available = 0;
  let completed = 0;
  let locked = 0;

  for (const def of fusions) {
    const state = nodes[def.id];
    if (!state) continue;
    if (state.status === 'completed') completed++;
    else if (state.status === 'available' || state.status === 'researching') available++;
    else locked++;
  }

  return { total: fusions.length, available, completed, locked };
}
