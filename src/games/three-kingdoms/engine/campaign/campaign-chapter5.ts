/**
 * 关卡系统 — 第5章：三国鼎立 关卡数据
 *
 * 包含第5章全部5个关卡的静态配置：
 *   3普通 + 1精英 + 1BOSS
 *
 * 关卡与碎片映射（Play v3.0 §4.3a）：
 *   5-1 夏侯惇    → 刘备碎片（橙）
 *   5-2 夏侯渊    → 刘备碎片（橙）、夏侯惇碎片（紫）
 *   5-3 张辽      → 司马懿碎片（橙）
 *   5-4 徐晃      → 司马懿碎片（橙）、张辽碎片（紫）
 *   5-5 曹丕      → 刘备碎片（橙）、司马懿碎片（橙）
 *
 * @module engine/campaign/campaign-chapter5
 */

import { TroopType } from '../battle/battle.types';
import type { Stage } from './campaign.types';

// ── 5-1 夏侯惇 ──
const ch5_stage1: Stage = {
  id: 'chapter5_stage1',
  name: '夏侯惇',
  type: 'normal',
  chapterId: 'chapter5',
  order: 1,
  enemyFormation: {
    id: 'ef_ch5_s1',
    name: '魏军先锋',
    recommendedPower: 5000,
    units: [
      { id: 'e_ch5_s1_1', name: '夏侯惇', faction: 'wei', troopType: TroopType.CAVALRY, level: 20, attack: 92, defense: 52, intelligence: 28, speed: 48, maxHp: 1000, position: 'front' },
      { id: 'e_ch5_s1_2', name: '魏军步兵', faction: 'wei', troopType: TroopType.INFANTRY, level: 20, attack: 75, defense: 55, intelligence: 18, speed: 26, maxHp: 850, position: 'front' },
      { id: 'e_ch5_s1_3', name: '魏军弓手', faction: 'wei', troopType: TroopType.ARCHER, level: 20, attack: 82, defense: 28, intelligence: 32, speed: 38, maxHp: 600, position: 'back' },
    ],
  },
  baseRewards: { grain: 800, gold: 500 },
  baseExp: 1000,
  firstClearRewards: { grain: 2000, gold: 1200, recruitToken: 10 }, // R5: 大关卡首通奖励 +10 求贤令
  firstClearExp: 3000,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 350, maxAmount: 700, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 250, maxAmount: 500, probability: 0.7 },
    { type: 'fragment', generalId: 'liubei', minAmount: 1, maxAmount: 1, probability: 0.1 },
  ],
  recommendedPower: 5000,
  description: '曹魏名将夏侯惇，独眼猛将，忠心耿耿。',
};

// ── 5-2 夏侯渊 ──
const ch5_stage2: Stage = {
  id: 'chapter5_stage2',
  name: '夏侯渊',
  type: 'normal',
  chapterId: 'chapter5',
  order: 2,
  enemyFormation: {
    id: 'ef_ch5_s2',
    name: '魏军疾风部队',
    recommendedPower: 6500,
    units: [
      { id: 'e_ch5_s2_1', name: '夏侯渊', faction: 'wei', troopType: TroopType.CAVALRY, level: 22, attack: 100, defense: 50, intelligence: 32, speed: 58, maxHp: 1050, position: 'front' },
      { id: 'e_ch5_s2_2', name: '魏军精骑', faction: 'wei', troopType: TroopType.CAVALRY, level: 21, attack: 88, defense: 42, intelligence: 22, speed: 52, maxHp: 800, position: 'front' },
      { id: 'e_ch5_s2_3', name: '魏军弓骑', faction: 'wei', troopType: TroopType.ARCHER, level: 21, attack: 90, defense: 28, intelligence: 30, speed: 45, maxHp: 580, position: 'back' },
      { id: 'e_ch5_s2_4', name: '魏军重步兵', faction: 'wei', troopType: TroopType.INFANTRY, level: 21, attack: 80, defense: 62, intelligence: 18, speed: 24, maxHp: 1100, position: 'front' },
    ],
  },
  baseRewards: { grain: 1000, gold: 650 },
  baseExp: 1000,
  firstClearRewards: { grain: 2500, gold: 1600 },
  firstClearExp: 3000,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 420, maxAmount: 850, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 300, maxAmount: 600, probability: 0.7 },
    { type: 'fragment', generalId: 'liubei', minAmount: 1, maxAmount: 1, probability: 0.1 },
    { type: 'fragment', generalId: 'xiaohoudun', minAmount: 1, maxAmount: 1, probability: 0.1 },
  ],
  recommendedPower: 6500,
  description: '曹魏名将夏侯渊，千里袭人，神速无双。',
};

// ── 5-3 张辽 ──
const ch5_stage3: Stage = {
  id: 'chapter5_stage3',
  name: '张辽',
  type: 'normal',
  chapterId: 'chapter5',
  order: 3,
  enemyFormation: {
    id: 'ef_ch5_s3',
    name: '张辽本阵',
    recommendedPower: 7500,
    units: [
      { id: 'e_ch5_s3_1', name: '张辽', faction: 'wei', troopType: TroopType.CAVALRY, level: 24, attack: 108, defense: 55, intelligence: 40, speed: 60, maxHp: 1150, position: 'front' },
      { id: 'e_ch5_s3_2', name: '魏军虎卫', faction: 'wei', troopType: TroopType.INFANTRY, level: 23, attack: 90, defense: 65, intelligence: 22, speed: 28, maxHp: 1200, position: 'front' },
      { id: 'e_ch5_s3_3', name: '魏军弓弩手', faction: 'wei', troopType: TroopType.ARCHER, level: 23, attack: 95, defense: 30, intelligence: 35, speed: 40, maxHp: 620, position: 'back' },
      { id: 'e_ch5_s3_4', name: '魏军参军', faction: 'wei', troopType: TroopType.STRATEGIST, level: 22, attack: 65, defense: 38, intelligence: 82, speed: 38, maxHp: 650, position: 'back' },
    ],
  },
  baseRewards: { grain: 1200, gold: 800 },
  baseExp: 1000,
  firstClearRewards: { grain: 3000, gold: 2000 },
  firstClearExp: 3000,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 500, maxAmount: 1000, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 350, maxAmount: 700, probability: 0.7 },
    { type: 'fragment', generalId: 'simayi', minAmount: 1, maxAmount: 1, probability: 0.1 },
  ],
  recommendedPower: 7500,
  description: '张辽威震逍遥津，孙权闻其名而胆寒。',
};

// ── 5-4 徐晃（精英） ──
const ch5_stage4: Stage = {
  id: 'chapter5_stage4',
  name: '徐晃',
  type: 'elite',
  chapterId: 'chapter5',
  order: 4,
  enemyFormation: {
    id: 'ef_ch5_s4',
    name: '魏军精锐',
    recommendedPower: 8500,
    units: [
      { id: 'e_ch5_s4_1', name: '徐晃', faction: 'wei', troopType: TroopType.SPEARMAN, level: 26, attack: 105, defense: 62, intelligence: 38, speed: 42, maxHp: 1200, position: 'front' },
      { id: 'e_ch5_s4_2', name: '魏军铁甲军', faction: 'wei', troopType: TroopType.INFANTRY, level: 25, attack: 88, defense: 68, intelligence: 22, speed: 26, maxHp: 1300, position: 'front' },
      { id: 'e_ch5_s4_3', name: '魏军军师', faction: 'wei', troopType: TroopType.STRATEGIST, level: 25, attack: 70, defense: 40, intelligence: 88, speed: 42, maxHp: 700, position: 'back' },
      { id: 'e_ch5_s4_4', name: '魏军神射手', faction: 'wei', troopType: TroopType.ARCHER, level: 25, attack: 98, defense: 32, intelligence: 35, speed: 40, maxHp: 600, position: 'back' },
      { id: 'e_ch5_s4_5', name: '魏军重枪兵', faction: 'wei', troopType: TroopType.SPEARMAN, level: 25, attack: 92, defense: 58, intelligence: 20, speed: 32, maxHp: 1050, position: 'front' },
    ],
  },
  baseRewards: { grain: 1400, gold: 950 },
  baseExp: 1000,
  firstClearRewards: { grain: 3500, gold: 2400 },
  firstClearExp: 3000,
  threeStarBonusMultiplier: 1.8,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 600, maxAmount: 1200, probability: 0.9 },
    { type: 'resource', resourceType: 'gold', minAmount: 420, maxAmount: 850, probability: 0.8 },
    { type: 'fragment', generalId: 'simayi', minAmount: 1, maxAmount: 1, probability: 0.1 },
    { type: 'fragment', generalId: 'zhangliao', minAmount: 1, maxAmount: 1, probability: 0.1 },
  ],
  recommendedPower: 8500,
  description: '曹魏名将徐晃，有周亚夫之风，治军严明。',
};

// ── 5-5 曹丕（BOSS） ──
const ch5_stage5: Stage = {
  id: 'chapter5_stage5',
  name: '曹丕',
  type: 'boss',
  chapterId: 'chapter5',
  order: 5,
  enemyFormation: {
    id: 'ef_ch5_s5',
    name: '魏文帝·曹丕',
    recommendedPower: 10000,
    units: [
      { id: 'e_ch5_s5_1', name: '曹丕', faction: 'wei', troopType: TroopType.STRATEGIST, level: 28, attack: 95, defense: 58, intelligence: 92, speed: 48, maxHp: 1600, position: 'back' },
      { id: 'e_ch5_s5_2', name: '司马懿', faction: 'wei', troopType: TroopType.STRATEGIST, level: 27, attack: 88, defense: 45, intelligence: 98, speed: 52, maxHp: 1200, position: 'back' },
      { id: 'e_ch5_s5_3', name: '魏军虎卫统领', faction: 'wei', troopType: TroopType.INFANTRY, level: 26, attack: 102, defense: 72, intelligence: 24, speed: 30, maxHp: 1400, position: 'front' },
      { id: 'e_ch5_s5_4', name: '魏军精骑', faction: 'wei', troopType: TroopType.CAVALRY, level: 26, attack: 98, defense: 52, intelligence: 28, speed: 58, maxHp: 1100, position: 'front' },
      { id: 'e_ch5_s5_5', name: '魏军谋士', faction: 'wei', troopType: TroopType.STRATEGIST, level: 25, attack: 75, defense: 40, intelligence: 90, speed: 44, maxHp: 750, position: 'back' },
      { id: 'e_ch5_s5_6', name: '魏军弩卫长', faction: 'wei', troopType: TroopType.ARCHER, level: 25, attack: 100, defense: 35, intelligence: 38, speed: 42, maxHp: 680, position: 'back' },
    ],
  },
  baseRewards: { grain: 2000, gold: 1400, troops: 300, mandate: 30 },
  baseExp: 1000,
  firstClearRewards: { grain: 6000, gold: 4000, troops: 800 },
  firstClearExp: 3000,
  threeStarBonusMultiplier: 2.0,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 1000, maxAmount: 2000, probability: 1.0 },
    { type: 'resource', resourceType: 'gold', minAmount: 700, maxAmount: 1400, probability: 1.0 },
    { type: 'fragment', generalId: 'liubei', minAmount: 1, maxAmount: 2, probability: 0.1 },
    { type: 'fragment', generalId: 'simayi', minAmount: 1, maxAmount: 2, probability: 0.1 },
  ],
  recommendedPower: 10000,
  description: '魏文帝曹丕，篡汉建魏，三国鼎立格局已成。',
};

export const CHAPTER5_STAGES: Stage[] = [
  ch5_stage1, ch5_stage2, ch5_stage3, ch5_stage4,
  ch5_stage5,
];
