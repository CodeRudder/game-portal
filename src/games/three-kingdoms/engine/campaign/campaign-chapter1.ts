/**
 * 关卡系统 — 第1章：黄巾之乱 关卡数据
 *
 * 包含第1章全部8个关卡的静态配置：
 *   6普通 + 1精英 + 1BOSS
 *
 * @module engine/campaign/campaign-chapter1
 */

import { TroopType } from '../battle/battle.types';
import type { Stage } from './campaign.types';

// ── 1-1 黄巾前哨 ──
const ch1_stage1: Stage = {
  id: 'chapter1_stage1',
  name: '黄巾前哨',
  type: 'normal',
  chapterId: 'chapter1',
  order: 1,
  enemyFormation: {
    id: 'ef_ch1_s1',
    name: '黄巾哨兵队',
    recommendedPower: 100,
    units: [
      { id: 'e_ch1_s1_1', name: '黄巾斥候', faction: 'qun', troopType: TroopType.INFANTRY, level: 1, attack: 18, defense: 10, intelligence: 5, speed: 12, maxHp: 120, position: 'front' },
      { id: 'e_ch1_s1_2', name: '黄巾弓手', faction: 'qun', troopType: TroopType.ARCHER, level: 1, attack: 22, defense: 6, intelligence: 8, speed: 10, maxHp: 90, position: 'back' },
      { id: 'e_ch1_s1_3', name: '黄巾步卒', faction: 'qun', troopType: TroopType.INFANTRY, level: 1, attack: 15, defense: 12, intelligence: 4, speed: 8, maxHp: 150, position: 'front' },
    ],
  },
  baseRewards: { grain: 80, gold: 40 },
  baseExp: 30,
  firstClearRewards: { grain: 200, gold: 100 },
  firstClearExp: 80,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 30, maxAmount: 60, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 15, maxAmount: 30, probability: 0.7 },
  ],
  recommendedPower: 100,
  description: '黄巾军的前哨营地，守军薄弱，适合初出茅庐的将领练兵。',
};

// ── 1-2 黄巾村落 ──
const ch1_stage2: Stage = {
  id: 'chapter1_stage2',
  name: '黄巾村落',
  type: 'normal',
  chapterId: 'chapter1',
  order: 2,
  enemyFormation: {
    id: 'ef_ch1_s2',
    name: '黄巾村卫队',
    recommendedPower: 150,
    units: [
      { id: 'e_ch1_s2_1', name: '黄巾头目', faction: 'qun', troopType: TroopType.INFANTRY, level: 2, attack: 22, defense: 14, intelligence: 8, speed: 11, maxHp: 180, position: 'front' },
      { id: 'e_ch1_s2_2', name: '黄巾弓手', faction: 'qun', troopType: TroopType.ARCHER, level: 2, attack: 25, defense: 8, intelligence: 10, speed: 12, maxHp: 100, position: 'back' },
      { id: 'e_ch1_s2_3', name: '黄巾步卒', faction: 'qun', troopType: TroopType.INFANTRY, level: 2, attack: 18, defense: 14, intelligence: 5, speed: 9, maxHp: 160, position: 'front' },
      { id: 'e_ch1_s2_4', name: '黄巾斥候', faction: 'qun', troopType: TroopType.CAVALRY, level: 2, attack: 20, defense: 10, intelligence: 6, speed: 16, maxHp: 110, position: 'back' },
    ],
  },
  baseRewards: { grain: 100, gold: 50 },
  baseExp: 40,
  firstClearRewards: { grain: 250, gold: 120 },
  firstClearExp: 100,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 40, maxAmount: 70, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 20, maxAmount: 40, probability: 0.7 },
    { type: 'exp', minAmount: 10, maxAmount: 20, probability: 0.5 },
  ],
  recommendedPower: 150,
  description: '被黄巾军占据的村落，敌人数量增多，需要小心应对。',
};

// ── 1-3 黄巾山谷 ──
const ch1_stage3: Stage = {
  id: 'chapter1_stage3',
  name: '黄巾山谷',
  type: 'normal',
  chapterId: 'chapter1',
  order: 3,
  enemyFormation: {
    id: 'ef_ch1_s3',
    name: '黄巾山谷守军',
    recommendedPower: 200,
    units: [
      { id: 'e_ch1_s3_1', name: '黄巾枪兵', faction: 'qun', troopType: TroopType.SPEARMAN, level: 3, attack: 26, defense: 16, intelligence: 7, speed: 10, maxHp: 200, position: 'front' },
      { id: 'e_ch1_s3_2', name: '黄巾弓手', faction: 'qun', troopType: TroopType.ARCHER, level: 3, attack: 30, defense: 9, intelligence: 12, speed: 11, maxHp: 110, position: 'back' },
      { id: 'e_ch1_s3_3', name: '黄巾步卒', faction: 'qun', troopType: TroopType.INFANTRY, level: 3, attack: 22, defense: 16, intelligence: 6, speed: 9, maxHp: 180, position: 'front' },
    ],
  },
  baseRewards: { grain: 120, gold: 60 },
  baseExp: 50,
  firstClearRewards: { grain: 300, gold: 150 },
  firstClearExp: 120,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 50, maxAmount: 80, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 25, maxAmount: 50, probability: 0.7 },
    { type: 'fragment', generalId: 'guanyu', minAmount: 1, maxAmount: 1, probability: 0.1 },
  ],
  recommendedPower: 200,
  description: '山谷中驻扎着黄巾军的一支小队，地形对防守方有利。',
};

// ── 1-4 黄巾营地 ──
const ch1_stage4: Stage = {
  id: 'chapter1_stage4',
  name: '黄巾营地',
  type: 'normal',
  chapterId: 'chapter1',
  order: 4,
  enemyFormation: {
    id: 'ef_ch1_s4',
    name: '黄巾营地守军',
    recommendedPower: 260,
    units: [
      { id: 'e_ch1_s4_1', name: '黄巾百夫长', faction: 'qun', troopType: TroopType.INFANTRY, level: 4, attack: 30, defense: 18, intelligence: 10, speed: 12, maxHp: 240, position: 'front' },
      { id: 'e_ch1_s4_2', name: '黄巾弓手', faction: 'qun', troopType: TroopType.ARCHER, level: 4, attack: 34, defense: 10, intelligence: 14, speed: 13, maxHp: 120, position: 'back' },
      { id: 'e_ch1_s4_3', name: '黄巾枪兵', faction: 'qun', troopType: TroopType.SPEARMAN, level: 4, attack: 28, defense: 18, intelligence: 8, speed: 10, maxHp: 220, position: 'front' },
      { id: 'e_ch1_s4_4', name: '黄巾斥候', faction: 'qun', troopType: TroopType.CAVALRY, level: 4, attack: 26, defense: 12, intelligence: 8, speed: 18, maxHp: 140, position: 'back' },
    ],
  },
  baseRewards: { grain: 140, gold: 70 },
  baseExp: 60,
  firstClearRewards: { grain: 350, gold: 180 },
  firstClearExp: 140,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 60, maxAmount: 100, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 30, maxAmount: 60, probability: 0.7 },
    { type: 'fragment', generalId: 'zhangfei', minAmount: 1, maxAmount: 1, probability: 0.1 },
  ],
  recommendedPower: 260,
  description: '黄巾军的主要营地，守军训练有素，不可轻敌。',
};

// ── 1-5 黄巾粮道 ──
const ch1_stage5: Stage = {
  id: 'chapter1_stage5',
  name: '黄巾粮道',
  type: 'normal',
  chapterId: 'chapter1',
  order: 5,
  enemyFormation: {
    id: 'ef_ch1_s5',
    name: '黄巾粮道护卫',
    recommendedPower: 320,
    units: [
      { id: 'e_ch1_s5_1', name: '黄巾护卫', faction: 'qun', troopType: TroopType.CAVALRY, level: 5, attack: 34, defense: 16, intelligence: 10, speed: 20, maxHp: 200, position: 'front' },
      { id: 'e_ch1_s5_2', name: '黄巾弩手', faction: 'qun', troopType: TroopType.ARCHER, level: 5, attack: 38, defense: 11, intelligence: 16, speed: 12, maxHp: 130, position: 'back' },
      { id: 'e_ch1_s5_3', name: '黄巾步兵', faction: 'qun', troopType: TroopType.INFANTRY, level: 5, attack: 30, defense: 20, intelligence: 8, speed: 10, maxHp: 260, position: 'front' },
    ],
  },
  baseRewards: { grain: 160, gold: 80, troops: 20 },
  baseExp: 70,
  firstClearRewards: { grain: 400, gold: 200, troops: 50 },
  firstClearExp: 160,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 70, maxAmount: 120, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 35, maxAmount: 70, probability: 0.7 },
    { type: 'resource', resourceType: 'troops', minAmount: 10, maxAmount: 30, probability: 0.5 },
  ],
  recommendedPower: 320,
  description: '黄巾军的粮草运输要道，截断粮道可动摇敌军根基。',
};

// ── 1-6 黄巾关隘 ──
const ch1_stage6: Stage = {
  id: 'chapter1_stage6',
  name: '黄巾关隘',
  type: 'normal',
  chapterId: 'chapter1',
  order: 6,
  enemyFormation: {
    id: 'ef_ch1_s6',
    name: '黄巾关隘守军',
    recommendedPower: 380,
    units: [
      { id: 'e_ch1_s6_1', name: '黄巾守将', faction: 'qun', troopType: TroopType.INFANTRY, level: 6, attack: 38, defense: 24, intelligence: 12, speed: 11, maxHp: 300, position: 'front' },
      { id: 'e_ch1_s6_2', name: '黄巾弓手', faction: 'qun', troopType: TroopType.ARCHER, level: 6, attack: 42, defense: 12, intelligence: 18, speed: 13, maxHp: 140, position: 'back' },
      { id: 'e_ch1_s6_3', name: '黄巾枪兵', faction: 'qun', troopType: TroopType.SPEARMAN, level: 6, attack: 34, defense: 22, intelligence: 10, speed: 10, maxHp: 280, position: 'front' },
      { id: 'e_ch1_s6_4', name: '黄巾骑兵', faction: 'qun', troopType: TroopType.CAVALRY, level: 6, attack: 36, defense: 16, intelligence: 10, speed: 22, maxHp: 180, position: 'back' },
    ],
  },
  baseRewards: { grain: 180, gold: 90, troops: 30 },
  baseExp: 80,
  firstClearRewards: { grain: 450, gold: 220, troops: 60 },
  firstClearExp: 180,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 80, maxAmount: 130, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 40, maxAmount: 80, probability: 0.7 },
    { type: 'fragment', generalId: 'liubei', minAmount: 1, maxAmount: 1, probability: 0.08 },
  ],
  recommendedPower: 380,
  description: '黄巾军据守的关隘，地势险要，需强攻突破。',
};

// ── 1-7【精英】黄巾力士营 ──
const ch1_stage7: Stage = {
  id: 'chapter1_stage7',
  name: '黄巾力士营',
  type: 'elite',
  chapterId: 'chapter1',
  order: 7,
  enemyFormation: {
    id: 'ef_ch1_s7',
    name: '黄巾力士精锐',
    recommendedPower: 480,
    units: [
      { id: 'e_ch1_s7_1', name: '黄巾力士头领', faction: 'qun', troopType: TroopType.INFANTRY, level: 8, attack: 48, defense: 30, intelligence: 14, speed: 12, maxHp: 400, position: 'front' },
      { id: 'e_ch1_s7_2', name: '黄巾力士', faction: 'qun', troopType: TroopType.INFANTRY, level: 7, attack: 42, defense: 28, intelligence: 10, speed: 10, maxHp: 350, position: 'front' },
      { id: 'e_ch1_s7_3', name: '黄巾术士', faction: 'qun', troopType: TroopType.STRATEGIST, level: 7, attack: 50, defense: 14, intelligence: 24, speed: 14, maxHp: 180, position: 'back' },
      { id: 'e_ch1_s7_4', name: '黄巾弓手', faction: 'qun', troopType: TroopType.ARCHER, level: 7, attack: 44, defense: 12, intelligence: 18, speed: 15, maxHp: 160, position: 'back' },
      { id: 'e_ch1_s7_5', name: '黄巾力士', faction: 'qun', troopType: TroopType.SPEARMAN, level: 7, attack: 40, defense: 26, intelligence: 10, speed: 10, maxHp: 320, position: 'front' },
    ],
  },
  baseRewards: { grain: 250, gold: 130, troops: 50 },
  baseExp: 120,
  firstClearRewards: { grain: 600, gold: 300, troops: 100, mandate: 10 },
  firstClearExp: 250,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 100, maxAmount: 180, probability: 0.9 },
    { type: 'resource', resourceType: 'gold', minAmount: 60, maxAmount: 120, probability: 0.8 },
    { type: 'fragment', generalId: 'guanyu', minAmount: 1, maxAmount: 2, probability: 0.2 },
    { type: 'fragment', generalId: 'zhangfei', minAmount: 1, maxAmount: 2, probability: 0.2 },
    { type: 'resource', resourceType: 'mandate', minAmount: 1, maxAmount: 3, probability: 0.3 },
  ],
  recommendedPower: 480,
  description: '黄巾力士精锐营地，敌人强悍，但击败后可获得丰厚奖励。',
};

// ── 1-8【BOSS】张角 ──
const ch1_stage8: Stage = {
  id: 'chapter1_stage8',
  name: '张角',
  type: 'boss',
  chapterId: 'chapter1',
  order: 8,
  enemyFormation: {
    id: 'ef_ch1_s8',
    name: '天公将军·张角',
    recommendedPower: 600,
    units: [
      { id: 'e_ch1_s8_1', name: '张角', faction: 'qun', troopType: TroopType.STRATEGIST, level: 10, attack: 60, defense: 24, intelligence: 40, speed: 16, maxHp: 600, position: 'back' },
      { id: 'e_ch1_s8_2', name: '张宝', faction: 'qun', troopType: TroopType.STRATEGIST, level: 9, attack: 48, defense: 20, intelligence: 32, speed: 14, maxHp: 380, position: 'back' },
      { id: 'e_ch1_s8_3', name: '张梁', faction: 'qun', troopType: TroopType.INFANTRY, level: 9, attack: 52, defense: 30, intelligence: 16, speed: 12, maxHp: 450, position: 'front' },
      { id: 'e_ch1_s8_4', name: '黄巾力士', faction: 'qun', troopType: TroopType.INFANTRY, level: 8, attack: 44, defense: 28, intelligence: 10, speed: 10, maxHp: 380, position: 'front' },
      { id: 'e_ch1_s8_5', name: '黄巾术士', faction: 'qun', troopType: TroopType.STRATEGIST, level: 8, attack: 46, defense: 14, intelligence: 28, speed: 14, maxHp: 200, position: 'back' },
      { id: 'e_ch1_s8_6', name: '黄巾弓手', faction: 'qun', troopType: TroopType.ARCHER, level: 8, attack: 42, defense: 12, intelligence: 18, speed: 16, maxHp: 180, position: 'back' },
    ],
  },
  baseRewards: { grain: 400, gold: 200, troops: 80, mandate: 15 },
  baseExp: 200,
  firstClearRewards: { grain: 1000, gold: 500, troops: 200, mandate: 30 },
  firstClearExp: 500,
  threeStarBonusMultiplier: 2.0,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 200, maxAmount: 350, probability: 1.0 },
    { type: 'resource', resourceType: 'gold', minAmount: 100, maxAmount: 200, probability: 1.0 },
    { type: 'resource', resourceType: 'mandate', minAmount: 5, maxAmount: 15, probability: 0.8 },
    { type: 'fragment', generalId: 'liubei', minAmount: 2, maxAmount: 3, probability: 0.3 },
    { type: 'fragment', generalId: 'guanyu', minAmount: 2, maxAmount: 3, probability: 0.3 },
    { type: 'fragment', generalId: 'zhangfei', minAmount: 2, maxAmount: 3, probability: 0.3 },
  ],
  recommendedPower: 600,
  description: '黄巾之乱首领——天公将军张角，掌握太平道术，实力强大。',
};

/** 第1章全部关卡（按 order 排列） */
export const CHAPTER1_STAGES: Stage[] = [
  ch1_stage1, ch1_stage2, ch1_stage3, ch1_stage4,
  ch1_stage5, ch1_stage6, ch1_stage7, ch1_stage8,
];
