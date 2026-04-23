/**
 * 关卡系统 — 第4章：赤壁之战 关卡数据
 *
 * 包含第4章全部5个关卡的静态配置：
 *   3普通 + 1精英 + 1BOSS
 *
 * 关卡与碎片映射（Play v3.0 §4.3a）：
 *   4-1 蔡瑁        → 周瑜碎片（橙）
 *   4-2 张允        → 周瑜碎片（橙）、蔡瑁碎片（蓝）
 *   4-3 黄盖        → 孙权碎片（橙）
 *   4-4 甘宁        → 孙权碎片（橙）、黄盖碎片（紫）
 *   4-5 曹操·赤壁   → 周瑜碎片（橙）、孙权碎片（橙）
 *
 * @module engine/campaign/campaign-chapter4
 */

import { TroopType } from '../battle/battle.types';
import type { Stage } from './campaign.types';

// ── 4-1 蔡瑁 ──
const ch4_stage1: Stage = {
  id: 'chapter4_stage1',
  name: '蔡瑁',
  type: 'normal',
  chapterId: 'chapter4',
  order: 1,
  enemyFormation: {
    id: 'ef_ch4_s1',
    name: '曹军水寨前哨',
    recommendedPower: 2500,
    units: [
      { id: 'e_ch4_s1_1', name: '蔡瑁', faction: 'wei', troopType: TroopType.SPEARMAN, level: 14, attack: 72, defense: 48, intelligence: 28, speed: 32, maxHp: 650, position: 'front' },
      { id: 'e_ch4_s1_2', name: '曹军水兵', faction: 'wei', troopType: TroopType.INFANTRY, level: 14, attack: 60, defense: 42, intelligence: 16, speed: 26, maxHp: 580, position: 'front' },
      { id: 'e_ch4_s1_3', name: '曹军弓手', faction: 'wei', troopType: TroopType.ARCHER, level: 14, attack: 68, defense: 22, intelligence: 26, speed: 30, maxHp: 420, position: 'back' },
    ],
  },
  baseRewards: { grain: 500, gold: 300 },
  baseExp: 500,
  firstClearRewards: { grain: 1200, gold: 800 },
  firstClearExp: 1500,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 200, maxAmount: 400, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 120, maxAmount: 250, probability: 0.7 },
    { type: 'fragment', generalId: 'zhouyu', minAmount: 1, maxAmount: 1, probability: 0.1 },
  ],
  recommendedPower: 2500,
  description: '曹操水军都督蔡瑁，训练水军但终被离间。',
};

// ── 4-2 张允 ──
const ch4_stage2: Stage = {
  id: 'chapter4_stage2',
  name: '张允',
  type: 'normal',
  chapterId: 'chapter4',
  order: 2,
  enemyFormation: {
    id: 'ef_ch4_s2',
    name: '曹军水寨守卫',
    recommendedPower: 3200,
    units: [
      { id: 'e_ch4_s2_1', name: '张允', faction: 'wei', troopType: TroopType.ARCHER, level: 16, attack: 78, defense: 30, intelligence: 34, speed: 34, maxHp: 550, position: 'back' },
      { id: 'e_ch4_s2_2', name: '曹军水兵', faction: 'wei', troopType: TroopType.INFANTRY, level: 16, attack: 65, defense: 48, intelligence: 18, speed: 26, maxHp: 700, position: 'front' },
      { id: 'e_ch4_s2_3', name: '曹军弩手', faction: 'wei', troopType: TroopType.ARCHER, level: 16, attack: 75, defense: 22, intelligence: 28, speed: 32, maxHp: 450, position: 'back' },
      { id: 'e_ch4_s2_4', name: '曹军步兵', faction: 'wei', troopType: TroopType.INFANTRY, level: 15, attack: 60, defense: 44, intelligence: 16, speed: 24, maxHp: 620, position: 'front' },
    ],
  },
  baseRewards: { grain: 600, gold: 380 },
  baseExp: 500,
  firstClearRewards: { grain: 1500, gold: 950 },
  firstClearExp: 1500,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'gold', minAmount: 150, maxAmount: 300, probability: 0.8 },
    { type: 'fragment', generalId: 'zhouyu', minAmount: 1, maxAmount: 1, probability: 0.1 },
    { type: 'fragment', generalId: 'caimao', minAmount: 1, maxAmount: 1, probability: 0.1 },
  ],
  recommendedPower: 3200,
  description: '曹操水军副都督张允，与蔡瑁共掌水军。',
};

// ── 4-3 黄盖 ──
const ch4_stage3: Stage = {
  id: 'chapter4_stage3',
  name: '黄盖',
  type: 'normal',
  chapterId: 'chapter4',
  order: 3,
  enemyFormation: {
    id: 'ef_ch4_s3',
    name: '东吴老将·黄盖',
    recommendedPower: 3800,
    units: [
      { id: 'e_ch4_s3_1', name: '黄盖', faction: 'wu', troopType: TroopType.INFANTRY, level: 18, attack: 85, defense: 55, intelligence: 32, speed: 28, maxHp: 900, position: 'front' },
      { id: 'e_ch4_s3_2', name: '东吴精兵', faction: 'wu', troopType: TroopType.INFANTRY, level: 17, attack: 72, defense: 48, intelligence: 20, speed: 26, maxHp: 750, position: 'front' },
      { id: 'e_ch4_s3_3', name: '东吴弓手', faction: 'wu', troopType: TroopType.ARCHER, level: 17, attack: 78, defense: 24, intelligence: 28, speed: 32, maxHp: 520, position: 'back' },
      { id: 'e_ch4_s3_4', name: '东吴水兵', faction: 'wu', troopType: TroopType.SPEARMAN, level: 17, attack: 70, defense: 45, intelligence: 18, speed: 24, maxHp: 680, position: 'front' },
    ],
  },
  baseRewards: { grain: 700, gold: 450 },
  baseExp: 500,
  firstClearRewards: { grain: 1800, gold: 1100 },
  firstClearExp: 1500,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 280, maxAmount: 550, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 180, maxAmount: 360, probability: 0.7 },
    { type: 'fragment', generalId: 'sunquan', minAmount: 1, maxAmount: 1, probability: 0.1 },
  ],
  recommendedPower: 3800,
  description: '东吴老将黄盖，苦肉计诈降曹操，忠勇无双。',
};

// ── 4-4 甘宁（精英） ──
const ch4_stage4: Stage = {
  id: 'chapter4_stage4',
  name: '甘宁',
  type: 'elite',
  chapterId: 'chapter4',
  order: 4,
  enemyFormation: {
    id: 'ef_ch4_s4',
    name: '锦帆贼·甘宁',
    recommendedPower: 4200,
    units: [
      { id: 'e_ch4_s4_1', name: '甘宁', faction: 'wu', troopType: TroopType.CAVALRY, level: 20, attack: 95, defense: 45, intelligence: 30, speed: 48, maxHp: 850, position: 'front' },
      { id: 'e_ch4_s4_2', name: '东吴铁卫', faction: 'wu', troopType: TroopType.INFANTRY, level: 19, attack: 78, defense: 58, intelligence: 22, speed: 28, maxHp: 950, position: 'front' },
      { id: 'e_ch4_s4_3', name: '东吴术士', faction: 'wu', troopType: TroopType.STRATEGIST, level: 19, attack: 60, defense: 32, intelligence: 72, speed: 38, maxHp: 580, position: 'back' },
      { id: 'e_ch4_s4_4', name: '东吴弩队长', faction: 'wu', troopType: TroopType.ARCHER, level: 19, attack: 85, defense: 28, intelligence: 30, speed: 36, maxHp: 500, position: 'back' },
      { id: 'e_ch4_s4_5', name: '东吴枪卫', faction: 'wu', troopType: TroopType.SPEARMAN, level: 19, attack: 80, defense: 50, intelligence: 22, speed: 30, maxHp: 780, position: 'front' },
    ],
  },
  baseRewards: { grain: 900, gold: 600 },
  baseExp: 500,
  firstClearRewards: { grain: 2300, gold: 1500 },
  firstClearExp: 1500,
  threeStarBonusMultiplier: 1.8,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 380, maxAmount: 750, probability: 0.9 },
    { type: 'resource', resourceType: 'gold', minAmount: 280, maxAmount: 560, probability: 0.8 },
    { type: 'fragment', generalId: 'sunquan', minAmount: 1, maxAmount: 1, probability: 0.1 },
    { type: 'fragment', generalId: 'huanggai', minAmount: 1, maxAmount: 1, probability: 0.1 },
  ],
  recommendedPower: 4200,
  description: '东吴猛将甘宁，百骑劫魏营，勇冠三军。',
};

// ── 4-5 曹操·赤壁（BOSS） ──
const ch4_stage5: Stage = {
  id: 'chapter4_stage5',
  name: '曹操·赤壁',
  type: 'boss',
  chapterId: 'chapter4',
  order: 5,
  enemyFormation: {
    id: 'ef_ch4_s5',
    name: '曹操亲卫',
    recommendedPower: 5000,
    units: [
      { id: 'e_ch4_s5_1', name: '曹操', faction: 'wei', troopType: TroopType.STRATEGIST, level: 22, attack: 92, defense: 58, intelligence: 95, speed: 52, maxHp: 1500, position: 'back' },
      { id: 'e_ch4_s5_2', name: '许褚', faction: 'wei', troopType: TroopType.INFANTRY, level: 21, attack: 98, defense: 68, intelligence: 20, speed: 34, maxHp: 1200, position: 'front' },
      { id: 'e_ch4_s5_3', name: '张辽', faction: 'wei', troopType: TroopType.CAVALRY, level: 21, attack: 95, defense: 55, intelligence: 42, speed: 58, maxHp: 1100, position: 'front' },
      { id: 'e_ch4_s5_4', name: '曹军铁卫', faction: 'wei', troopType: TroopType.INFANTRY, level: 20, attack: 80, defense: 62, intelligence: 22, speed: 28, maxHp: 900, position: 'front' },
      { id: 'e_ch4_s5_5', name: '曹军谋士', faction: 'wei', troopType: TroopType.STRATEGIST, level: 20, attack: 65, defense: 36, intelligence: 82, speed: 42, maxHp: 650, position: 'back' },
      { id: 'e_ch4_s5_6', name: '曹军弓骑', faction: 'wei', troopType: TroopType.ARCHER, level: 20, attack: 88, defense: 30, intelligence: 34, speed: 46, maxHp: 600, position: 'back' },
    ],
  },
  baseRewards: { grain: 1500, gold: 1000 },
  baseExp: 500,
  firstClearRewards: { grain: 5000, gold: 3000, troops: 500 },
  firstClearExp: 1500,
  threeStarBonusMultiplier: 2.0,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 800, maxAmount: 1500, probability: 1.0 },
    { type: 'resource', resourceType: 'gold', minAmount: 500, maxAmount: 1000, probability: 1.0 },
    { type: 'fragment', generalId: 'zhouyu', minAmount: 1, maxAmount: 2, probability: 0.1 },
    { type: 'fragment', generalId: 'sunquan', minAmount: 1, maxAmount: 2, probability: 0.1 },
  ],
  recommendedPower: 5000,
  description: '赤壁之战！孙刘联军火烧曹营，曹操败走华容道。',
};

export const CHAPTER4_STAGES: Stage[] = [
  ch4_stage1, ch4_stage2, ch4_stage3, ch4_stage4,
  ch4_stage5,
];
