/**
 * 关卡系统 — 第6章：汉中争夺 关卡数据
 *
 * 包含第6章全部8个关卡的静态配置：
 *   5普通 + 2精英 + 1BOSS
 *
 * @module engine/campaign/campaign-chapter6
 */

import { TroopType } from '../battle/battle.types';
import type { Stage } from './campaign.types';

// ── 6-1 阳平关 ──
const ch6_stage1: Stage = {
  id: 'chapter6_stage1',
  name: '阳平关',
  type: 'normal',
  chapterId: 'chapter6',
  order: 1,
  enemyFormation: {
    id: 'ef_ch6_s1',
    name: '曹军关防',
    recommendedPower: 3500,
    units: [
      { id: 'e_ch6_s1_1', name: '曹军守将', faction: 'wei', troopType: TroopType.INFANTRY, level: 16, attack: 85, defense: 65, intelligence: 28, speed: 30, maxHp: 1200, position: 'front' },
      { id: 'e_ch6_s1_2', name: '曹军弩手', faction: 'wei', troopType: TroopType.ARCHER, level: 16, attack: 88, defense: 32, intelligence: 35, speed: 38, maxHp: 600, position: 'back' },
      { id: 'e_ch6_s1_3', name: '曹军枪兵', faction: 'wei', troopType: TroopType.SPEARMAN, level: 16, attack: 80, defense: 58, intelligence: 22, speed: 32, maxHp: 1000, position: 'front' },
      { id: 'e_ch6_s1_4', name: '曹军骑兵', faction: 'wei', troopType: TroopType.CAVALRY, level: 16, attack: 82, defense: 48, intelligence: 25, speed: 52, maxHp: 850, position: 'back' },
    ],
  },
  baseRewards: { grain: 1000, gold: 700 },
  baseExp: 420,
  firstClearRewards: { grain: 2800, gold: 1800 },
  firstClearExp: 1000,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 450, maxAmount: 900, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 350, maxAmount: 700, probability: 0.7 },
    { type: 'exp', minAmount: 130, maxAmount: 260, probability: 0.5 },
  ],
  recommendedPower: 3500,
  description: '阳平关是汉中的门户，曹操派重兵把守。',
};

// ── 6-2 定军山前哨 ──
const ch6_stage2: Stage = {
  id: 'chapter6_stage2',
  name: '定军山前哨',
  type: 'normal',
  chapterId: 'chapter6',
  order: 2,
  enemyFormation: {
    id: 'ef_ch6_s2',
    name: '夏侯渊前锋',
    recommendedPower: 3800,
    units: [
      { id: 'e_ch6_s2_1', name: '夏侯渊偏将', faction: 'wei', troopType: TroopType.CAVALRY, level: 17, attack: 92, defense: 52, intelligence: 30, speed: 58, maxHp: 1000, position: 'front' },
      { id: 'e_ch6_s2_2', name: '曹军精锐骑兵', faction: 'wei', troopType: TroopType.CAVALRY, level: 17, attack: 85, defense: 48, intelligence: 22, speed: 55, maxHp: 900, position: 'front' },
      { id: 'e_ch6_s2_3', name: '曹军弓骑', faction: 'wei', troopType: TroopType.ARCHER, level: 17, attack: 88, defense: 30, intelligence: 32, speed: 48, maxHp: 620, position: 'back' },
      { id: 'e_ch6_s2_4', name: '曹军重步兵', faction: 'wei', troopType: TroopType.INFANTRY, level: 17, attack: 78, defense: 68, intelligence: 18, speed: 25, maxHp: 1200, position: 'front' },
    ],
  },
  baseRewards: { grain: 1100, gold: 750 },
  baseExp: 450,
  firstClearRewards: { grain: 3000, gold: 2000 },
  firstClearExp: 1100,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 500, maxAmount: 1000, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 380, maxAmount: 750, probability: 0.7 },
    { type: 'exp', minAmount: 140, maxAmount: 280, probability: 0.5 },
  ],
  recommendedPower: 3800,
  description: '夏侯渊麾下精锐骑兵在前方驻扎，速战速决。',
};

// ── 6-3 天荡山 ──
const ch6_stage3: Stage = {
  id: 'chapter6_stage3',
  name: '天荡山',
  type: 'normal',
  chapterId: 'chapter6',
  order: 3,
  enemyFormation: {
    id: 'ef_ch6_s3',
    name: '曹军粮道守卫',
    recommendedPower: 4000,
    units: [
      { id: 'e_ch6_s3_1', name: '曹军运粮官', faction: 'wei', troopType: TroopType.STRATEGIST, level: 17, attack: 55, defense: 40, intelligence: 72, speed: 35, maxHp: 700, position: 'back' },
      { id: 'e_ch6_s3_2', name: '曹军护粮兵', faction: 'wei', troopType: TroopType.INFANTRY, level: 17, attack: 75, defense: 62, intelligence: 18, speed: 28, maxHp: 1100, position: 'front' },
      { id: 'e_ch6_s3_3', name: '曹军护粮兵', faction: 'wei', troopType: TroopType.INFANTRY, level: 17, attack: 75, defense: 62, intelligence: 18, speed: 28, maxHp: 1100, position: 'front' },
      { id: 'e_ch6_s3_4', name: '曹军弩卫', faction: 'wei', troopType: TroopType.ARCHER, level: 17, attack: 85, defense: 32, intelligence: 30, speed: 38, maxHp: 600, position: 'back' },
    ],
  },
  baseRewards: { grain: 1200, gold: 800 },
  baseExp: 470,
  firstClearRewards: { grain: 3200, gold: 2200 },
  firstClearExp: 1200,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 550, maxAmount: 1100, probability: 0.9 },
    { type: 'resource', resourceType: 'gold', minAmount: 400, maxAmount: 800, probability: 0.7 },
  ],
  recommendedPower: 4000,
  description: '天荡山是曹军粮道要冲，截断粮草是制胜关键。',
};

// ── 6-4 定军山 ──
const ch6_stage4: Stage = {
  id: 'chapter6_stage4',
  name: '定军山',
  type: 'normal',
  chapterId: 'chapter6',
  order: 4,
  enemyFormation: {
    id: 'ef_ch6_s4',
    name: '夏侯渊本阵',
    recommendedPower: 4200,
    units: [
      { id: 'e_ch6_s4_1', name: '夏侯渊', faction: 'wei', troopType: TroopType.CAVALRY, level: 18, attack: 98, defense: 58, intelligence: 35, speed: 62, maxHp: 1300, position: 'front' },
      { id: 'e_ch6_s4_2', name: '曹军骁骑', faction: 'wei', troopType: TroopType.CAVALRY, level: 18, attack: 90, defense: 52, intelligence: 25, speed: 58, maxHp: 1000, position: 'front' },
      { id: 'e_ch6_s4_3', name: '曹军精锐步兵', faction: 'wei', troopType: TroopType.INFANTRY, level: 18, attack: 82, defense: 68, intelligence: 22, speed: 28, maxHp: 1300, position: 'front' },
      { id: 'e_ch6_s4_4', name: '曹军弓弩手', faction: 'wei', troopType: TroopType.ARCHER, level: 18, attack: 92, defense: 35, intelligence: 35, speed: 42, maxHp: 650, position: 'back' },
      { id: 'e_ch6_s4_5', name: '曹军参军', faction: 'wei', troopType: TroopType.STRATEGIST, level: 17, attack: 60, defense: 38, intelligence: 80, speed: 40, maxHp: 680, position: 'back' },
    ],
  },
  baseRewards: { grain: 1300, gold: 880 },
  baseExp: 500,
  firstClearRewards: { grain: 3500, gold: 2500 },
  firstClearExp: 1300,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 600, maxAmount: 1200, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 450, maxAmount: 900, probability: 0.7 },
    { type: 'fragment', generalId: 'huangzhong', minAmount: 1, maxAmount: 3, probability: 0.25 },
    { type: 'exp', minAmount: 150, maxAmount: 300, probability: 0.6 },
  ],
  recommendedPower: 4200,
  description: '老将黄忠在定军山斩杀夏侯渊，一战成名！',
};

// ── 6-5 汉水之战 ──
const ch6_stage5: Stage = {
  id: 'chapter6_stage5',
  name: '汉水之战',
  type: 'normal',
  chapterId: 'chapter6',
  order: 5,
  enemyFormation: {
    id: 'ef_ch6_s5',
    name: '曹军援军',
    recommendedPower: 4500,
    units: [
      { id: 'e_ch6_s5_1', name: '曹军都督', faction: 'wei', troopType: TroopType.STRATEGIST, level: 18, attack: 68, defense: 45, intelligence: 88, speed: 42, maxHp: 800, position: 'back' },
      { id: 'e_ch6_s5_2', name: '曹军虎豹骑', faction: 'wei', troopType: TroopType.CAVALRY, level: 18, attack: 95, defense: 55, intelligence: 28, speed: 60, maxHp: 1100, position: 'front' },
      { id: 'e_ch6_s5_3', name: '曹军虎卫', faction: 'wei', troopType: TroopType.INFANTRY, level: 18, attack: 85, defense: 72, intelligence: 20, speed: 26, maxHp: 1400, position: 'front' },
      { id: 'e_ch6_s5_4', name: '曹军弩卫', faction: 'wei', troopType: TroopType.ARCHER, level: 18, attack: 92, defense: 35, intelligence: 35, speed: 40, maxHp: 650, position: 'back' },
    ],
  },
  baseRewards: { grain: 1400, gold: 950 },
  baseExp: 520,
  firstClearRewards: { grain: 3800, gold: 2800 },
  firstClearExp: 1400,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 650, maxAmount: 1300, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 500, maxAmount: 1000, probability: 0.7 },
    { type: 'exp', minAmount: 160, maxAmount: 320, probability: 0.5 },
  ],
  recommendedPower: 4500,
  description: '曹操亲率大军来争汉中，赵云在汉水边以寡敌众。',
};

// ── 6-6 北山之战（精英） ──
const ch6_stage6: Stage = {
  id: 'chapter6_stage6',
  name: '北山之战',
  type: 'elite',
  chapterId: 'chapter6',
  order: 6,
  enemyFormation: {
    id: 'ef_ch6_s6',
    name: '曹军北山大营',
    recommendedPower: 4800,
    units: [
      { id: 'e_ch6_s6_1', name: '曹军大将', faction: 'wei', troopType: TroopType.CAVALRY, level: 19, attack: 100, defense: 60, intelligence: 38, speed: 58, maxHp: 1400, position: 'front' },
      { id: 'e_ch6_s6_2', name: '曹军虎卫营', faction: 'wei', troopType: TroopType.INFANTRY, level: 19, attack: 88, defense: 75, intelligence: 22, speed: 26, maxHp: 1500, position: 'front' },
      { id: 'e_ch6_s6_3', name: '曹军军师', faction: 'wei', troopType: TroopType.STRATEGIST, level: 19, attack: 65, defense: 42, intelligence: 90, speed: 45, maxHp: 750, position: 'back' },
      { id: 'e_ch6_s6_4', name: '曹军神弩手', faction: 'wei', troopType: TroopType.ARCHER, level: 19, attack: 98, defense: 38, intelligence: 38, speed: 44, maxHp: 680, position: 'back' },
      { id: 'e_ch6_s6_5', name: '曹军重枪兵', faction: 'wei', troopType: TroopType.SPEARMAN, level: 19, attack: 90, defense: 62, intelligence: 22, speed: 34, maxHp: 1100, position: 'front' },
    ],
  },
  baseRewards: { grain: 1600, gold: 1100 },
  baseExp: 580,
  firstClearRewards: { grain: 4000, gold: 3000 },
  firstClearExp: 1500,
  threeStarBonusMultiplier: 1.8,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 750, maxAmount: 1500, probability: 0.9 },
    { type: 'resource', resourceType: 'gold', minAmount: 550, maxAmount: 1100, probability: 0.8 },
    { type: 'fragment', generalId: 'zhaoyun', minAmount: 1, maxAmount: 4, probability: 0.3 },
    { type: 'exp', minAmount: 180, maxAmount: 360, probability: 0.6 },
  ],
  recommendedPower: 4800,
  description: '北山曹军大营壁垒森严，需要精锐部队攻坚。',
};

// ── 6-7 斜谷之战（精英） ──
const ch6_stage7: Stage = {
  id: 'chapter6_stage7',
  name: '斜谷之战',
  type: 'elite',
  chapterId: 'chapter6',
  order: 7,
  enemyFormation: {
    id: 'ef_ch6_s7',
    name: '曹操亲军',
    recommendedPower: 5200,
    units: [
      { id: 'e_ch6_s7_1', name: '曹军骁将', faction: 'wei', troopType: TroopType.CAVALRY, level: 20, attack: 105, defense: 62, intelligence: 40, speed: 60, maxHp: 1500, position: 'front' },
      { id: 'e_ch6_s7_2', name: '曹军禁卫', faction: 'wei', troopType: TroopType.INFANTRY, level: 20, attack: 92, defense: 78, intelligence: 25, speed: 28, maxHp: 1600, position: 'front' },
      { id: 'e_ch6_s7_3', name: '曹军参军', faction: 'wei', troopType: TroopType.STRATEGIST, level: 20, attack: 70, defense: 45, intelligence: 95, speed: 48, maxHp: 800, position: 'back' },
      { id: 'e_ch6_s7_4', name: '曹军弩卫长', faction: 'wei', troopType: TroopType.ARCHER, level: 20, attack: 102, defense: 40, intelligence: 40, speed: 45, maxHp: 720, position: 'back' },
      { id: 'e_ch6_s7_5', name: '曹军铁骑', faction: 'wei', troopType: TroopType.CAVALRY, level: 20, attack: 98, defense: 55, intelligence: 28, speed: 62, maxHp: 1200, position: 'front' },
      { id: 'e_ch6_s7_6', name: '曹军枪卫', faction: 'wei', troopType: TroopType.SPEARMAN, level: 20, attack: 95, defense: 65, intelligence: 22, speed: 35, maxHp: 1200, position: 'front' },
    ],
  },
  baseRewards: { grain: 1800, gold: 1300 },
  baseExp: 650,
  firstClearRewards: { grain: 4500, gold: 3500 },
  firstClearExp: 1700,
  threeStarBonusMultiplier: 1.8,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 850, maxAmount: 1700, probability: 0.9 },
    { type: 'resource', resourceType: 'gold', minAmount: 650, maxAmount: 1300, probability: 0.8 },
    { type: 'fragment', generalId: 'huangzhong', minAmount: 2, maxAmount: 5, probability: 0.35 },
    { type: 'exp', minAmount: 200, maxAmount: 400, probability: 0.6 },
  ],
  recommendedPower: 5200,
  description: '斜谷道中曹操亲自断后，这是汉中之战的关键一役。',
};

// ── 6-8 汉中决战（BOSS） ──
const ch6_stage8: Stage = {
  id: 'chapter6_stage8',
  name: '汉中决战',
  type: 'boss',
  chapterId: 'chapter6',
  order: 8,
  enemyFormation: {
    id: 'ef_ch6_s8',
    name: '曹操主力',
    recommendedPower: 6000,
    units: [
      { id: 'e_ch6_s8_1', name: '曹操', faction: 'wei', troopType: TroopType.STRATEGIST, level: 22, attack: 95, defense: 65, intelligence: 100, speed: 55, maxHp: 1800, position: 'back' },
      { id: 'e_ch6_s8_2', name: '许褚', faction: 'wei', troopType: TroopType.INFANTRY, level: 21, attack: 108, defense: 78, intelligence: 22, speed: 35, maxHp: 1600, position: 'front' },
      { id: 'e_ch6_s8_3', name: '徐晃', faction: 'wei', troopType: TroopType.SPEARMAN, level: 21, attack: 102, defense: 70, intelligence: 42, speed: 45, maxHp: 1400, position: 'front' },
      { id: 'e_ch6_s8_4', name: '曹军虎卫', faction: 'wei', troopType: TroopType.INFANTRY, level: 20, attack: 90, defense: 75, intelligence: 22, speed: 28, maxHp: 1500, position: 'front' },
      { id: 'e_ch6_s8_5', name: '曹军军师', faction: 'wei', troopType: TroopType.STRATEGIST, level: 20, attack: 72, defense: 48, intelligence: 92, speed: 48, maxHp: 850, position: 'back' },
      { id: 'e_ch6_s8_6', name: '曹军铁骑队长', faction: 'wei', troopType: TroopType.CAVALRY, level: 20, attack: 105, defense: 58, intelligence: 32, speed: 65, maxHp: 1200, position: 'back' },
    ],
  },
  baseRewards: { grain: 2500, gold: 1800 },
  baseExp: 800,
  firstClearRewards: { grain: 8000, gold: 6000, troops: 1200, mandate: 100 },
  firstClearExp: 2500,
  threeStarBonusMultiplier: 2.0,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 1200, maxAmount: 2500, probability: 1.0 },
    { type: 'resource', resourceType: 'gold', minAmount: 900, maxAmount: 1800, probability: 1.0 },
    { type: 'fragment', generalId: 'liubei', minAmount: 2, maxAmount: 5, probability: 0.5 },
    { type: 'fragment', generalId: 'zhugeliang', minAmount: 1, maxAmount: 4, probability: 0.4 },
    { type: 'fragment', generalId: 'zhaoyun', minAmount: 1, maxAmount: 3, probability: 0.35 },
    { type: 'exp', minAmount: 250, maxAmount: 500, probability: 0.8 },
  ],
  recommendedPower: 6000,
  description: '汉中决战！刘备大破曹军，进位汉中王，三分天下格局已定。',
};

export const CHAPTER6_STAGES: Stage[] = [
  ch6_stage1, ch6_stage2, ch6_stage3, ch6_stage4,
  ch6_stage5, ch6_stage6, ch6_stage7, ch6_stage8,
];
