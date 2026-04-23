/**
 * 科技联动配置 — 预定义联动效果数据
 *
 * 从 TechLinkSystem 中提取，保持主文件精简。
 *
 * @module engine/tech/TechLinkConfig
 */

import type { TechLinkEffect } from './TechLinkSystem';

/** 预定义的科技联动效果 */
export const DEFAULT_LINK_EFFECTS: TechLinkEffect[] = [
  // ── 科技与建筑联动 ──
  { id: 'link_building_farm_1', techId: 'eco_t1_farming', target: 'building', targetSub: 'farm', description: '精耕细作提升农田产出+20%', value: 20 },
  { id: 'link_building_farm_2', techId: 'eco_t2_irrigation', target: 'building', targetSub: 'farm', description: '水利灌溉提升农田产出+25%', value: 25 },
  { id: 'link_building_market_1', techId: 'eco_t1_trade', target: 'building', targetSub: 'market', description: '商路开拓提升市场产出+20%', value: 20 },
  { id: 'link_building_market_2', techId: 'eco_t2_minting', target: 'building', targetSub: 'market', description: '铸币术提升市场产出+25%', value: 25 },
  { id: 'link_building_barracks_1', techId: 'mil_t1_attack', target: 'building', targetSub: 'barracks', description: '锐兵术解锁兵营高级训练', value: 15, unlockFeature: true, unlockDescription: '解锁高级兵种训练' },
  { id: 'link_building_academy_1', techId: 'cul_t2_academy', target: 'building', targetSub: 'academy', description: '书院扩建提升研究速度+15%', value: 15 },

  // ── 科技与武将联动 ──
  { id: 'link_hero_cavalry_1', techId: 'mil_t2_charge', target: 'hero', targetSub: 'cavalry_charge', description: '冲锋战术强化骑兵冲锋技能+20%', value: 20 },
  { id: 'link_hero_infantry_1', techId: 'mil_t2_fortify', target: 'hero', targetSub: 'infantry_shield', description: '固守战术强化步兵防御技能+20%', value: 20 },
  { id: 'link_hero_all_1', techId: 'cul_t1_education', target: 'hero', targetSub: 'all_skill_exp', description: '兴学令提升武将技能经验+15%', value: 15 },
  { id: 'link_hero_all_2', techId: 'cul_t3_scholar', target: 'hero', targetSub: 'all_skill_exp', description: '百家争鸣提升武将技能经验+25%', value: 25 },
  { id: 'link_hero_recruit_1', techId: 'cul_t2_talent', target: 'hero', targetSub: 'recruit_quality', description: '唯才是举解锁高级招募', value: 15, unlockSkill: true, newSkillDescription: '解锁高级武将招募池' },

  // ── 科技与资源联动 ──
  { id: 'link_res_grain_1', techId: 'eco_t1_farming', target: 'resource', targetSub: 'grain', description: '精耕细作提升粮草产出+10%', value: 10 },
  { id: 'link_res_grain_2', techId: 'eco_t3_granary', target: 'resource', targetSub: 'grain', description: '大粮仓提升粮草产出+15%和存储+25%', value: 15 },
  { id: 'link_res_grain_storage', techId: 'eco_t3_granary', target: 'resource', targetSub: 'grain_storage', description: '大粮仓提升粮草存储上限+25%', value: 25 },
  { id: 'link_res_gold_1', techId: 'eco_t1_trade', target: 'resource', targetSub: 'gold', description: '商路开拓提升铜钱产出+10%', value: 10 },
  { id: 'link_res_gold_2', techId: 'eco_t3_marketplace', target: 'resource', targetSub: 'gold', description: '大集市提升铜钱产出+15%', value: 15 },
  { id: 'link_res_mandate_1', techId: 'cul_t1_education', target: 'resource', targetSub: 'mandate', description: '兴学令提升天命获取+10%', value: 10 },
];
