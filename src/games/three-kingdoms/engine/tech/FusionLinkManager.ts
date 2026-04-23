/**
 * 科技域 — 融合科技联动效果管理器
 *
 * 从 FusionTechSystem.ts 拆分出的联动效果管理逻辑。
 * 职责：联动效果注册、查询、汇总计算、同步到联动系统
 *
 * @module engine/tech/FusionLinkManager
 */

import type { FusionLinkEffect } from './fusion-tech.types';
import type { TechLinkSystem } from './TechLinkSystem';

/**
 * 融合科技联动效果管理器
 *
 * 管理融合科技与其他系统（建筑/武将/资源）之间的联动效果。
 * 由 FusionTechSystem 持有并委托调用。
 */
export class FusionLinkManager {
  private links: Map<string, FusionLinkEffect> = new Map();

  constructor() {
    this.registerDefaults();
  }

  // ─── 注册 ──────────────────────────────────

  /** 注册默认融合科技联动效果 */
  private registerDefaults(): void {
    const defaultLinks: FusionLinkEffect[] = [
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
    for (const link of defaultLinks) {
      this.links.set(link.id, link);
    }
  }

  // ─── 查询 ──────────────────────────────────

  /** 获取融合科技的联动效果列表 */
  getByFusionTechId(fusionTechId: string): FusionLinkEffect[] {
    const result: FusionLinkEffect[] = [];
    for (const link of this.links.values()) {
      if (link.fusionTechId === fusionTechId) {
        result.push(link);
      }
    }
    return result;
  }

  /** 获取所有已完成融合科技的联动效果 */
  getActiveEffects(isCompleted: (fusionTechId: string) => boolean): FusionLinkEffect[] {
    const result: FusionLinkEffect[] = [];
    for (const link of this.links.values()) {
      if (isCompleted(link.fusionTechId)) {
        result.push(link);
      }
    }
    return result;
  }

  /** 获取已完成融合科技对指定目标的联动加成总值 */
  getBonus(
    target: 'building' | 'hero' | 'resource',
    targetSub: string,
    isCompleted: (fusionTechId: string) => boolean,
  ): number {
    let total = 0;
    for (const link of this.links.values()) {
      if (link.target !== target || link.targetSub !== targetSub) continue;
      if (!isCompleted(link.fusionTechId)) continue;
      total += link.value;
    }
    return total;
  }

  // ─── 同步 ──────────────────────────────────

  /** 同步融合科技联动效果到联动系统 */
  syncToLinkSystem(
    fusionTechId: string,
    linkSystem: TechLinkSystem,
  ): void {
    const links = this.getByFusionTechId(fusionTechId);
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
}
