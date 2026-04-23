/**
 * 关卡系统 — 第1章：黄巾之乱 关卡数据
 *
 * 包含第1章全部5个关卡的静态配置：
 *   3普通 + 1精英 + 1BOSS
 *
 * 关卡与碎片映射（Play v3.0 §4.3a）：
 *   1-1 张角    → 张角碎片（蓝）
 *   1-2 程远志  → 张角碎片（蓝）、程远志碎片（绿）
 *   1-3 邓茂    → 程远志碎片（绿）
 *   1-4 卜巳    → 关羽碎片（紫）
 *   1-5 张宝    → 关羽碎片（紫）、张角碎片（蓝）
 *
 * @module engine/campaign/campaign-chapter1
 */

import { TroopType } from '../battle/battle.types';
import type { Stage } from './campaign.types';

// ── 1-1 张角 ──
const ch1_stage1: Stage = {
  id: 'chapter1_stage1',
  name: '张角',
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
  baseExp: 50,
  firstClearRewards: { grain: 200, gold: 100 },
  firstClearExp: 150,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 30, maxAmount: 60, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 15, maxAmount: 30, probability: 0.7 },
    { type: 'fragment', generalId: 'zhangjiao', minAmount: 1, maxAmount: 1, probability: 0.1 },
  ],
  recommendedPower: 100,
  description: '黄巾军的前哨营地，守军薄弱，适合初出茅庐的将领练兵。',
};

// ── 1-2 程远志 ──
const ch1_stage2: Stage = {
  id: 'chapter1_stage2',
  name: '程远志',
  type: 'normal',
  chapterId: 'chapter1',
  order: 2,
  enemyFormation: {
    id: 'ef_ch1_s2',
    name: '黄巾村卫队',
    recommendedPower: 200,
    units: [
      { id: 'e_ch1_s2_1', name: '黄巾头目', faction: 'qun', troopType: TroopType.INFANTRY, level: 2, attack: 22, defense: 14, intelligence: 8, speed: 11, maxHp: 180, position: 'front' },
      { id: 'e_ch1_s2_2', name: '黄巾弓手', faction: 'qun', troopType: TroopType.ARCHER, level: 2, attack: 25, defense: 8, intelligence: 10, speed: 12, maxHp: 100, position: 'back' },
      { id: 'e_ch1_s2_3', name: '黄巾步卒', faction: 'qun', troopType: TroopType.INFANTRY, level: 2, attack: 18, defense: 14, intelligence: 5, speed: 9, maxHp: 160, position: 'front' },
      { id: 'e_ch1_s2_4', name: '黄巾斥候', faction: 'qun', troopType: TroopType.CAVALRY, level: 2, attack: 20, defense: 10, intelligence: 6, speed: 16, maxHp: 110, position: 'back' },
    ],
  },
  baseRewards: { grain: 100, gold: 50 },
  baseExp: 60,
  firstClearRewards: { grain: 250, gold: 120 },
  firstClearExp: 180,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 40, maxAmount: 70, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 20, maxAmount: 40, probability: 0.7 },
    { type: 'exp', minAmount: 10, maxAmount: 20, probability: 0.5 },
    { type: 'fragment', generalId: 'zhangjiao', minAmount: 1, maxAmount: 1, probability: 0.1 },
    { type: 'fragment', generalId: 'chengyuanzhi', minAmount: 1, maxAmount: 1, probability: 0.1 },
  ],
  recommendedPower: 200,
  description: '被黄巾军占据的村落，敌人数量增多，需要小心应对。',
};

// ── 1-3 邓茂 ──
const ch1_stage3: Stage = {
  id: 'chapter1_stage3',
  name: '邓茂',
  type: 'normal',
  chapterId: 'chapter1',
  order: 3,
  enemyFormation: {
    id: 'ef_ch1_s3',
    name: '黄巾山谷守军',
    recommendedPower: 300,
    units: [
      { id: 'e_ch1_s3_1', name: '黄巾枪兵', faction: 'qun', troopType: TroopType.SPEARMAN, level: 3, attack: 26, defense: 16, intelligence: 7, speed: 10, maxHp: 200, position: 'front' },
      { id: 'e_ch1_s3_2', name: '黄巾弓手', faction: 'qun', troopType: TroopType.ARCHER, level: 3, attack: 30, defense: 9, intelligence: 12, speed: 11, maxHp: 110, position: 'back' },
      { id: 'e_ch1_s3_3', name: '黄巾步卒', faction: 'qun', troopType: TroopType.INFANTRY, level: 3, attack: 22, defense: 16, intelligence: 6, speed: 9, maxHp: 180, position: 'front' },
    ],
  },
  baseRewards: { grain: 120, gold: 60 },
  baseExp: 50,
  firstClearRewards: { grain: 300, gold: 150 },
  firstClearExp: 150,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 50, maxAmount: 80, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 25, maxAmount: 50, probability: 0.7 },
    { type: 'fragment', generalId: 'chengyuanzhi', minAmount: 1, maxAmount: 1, probability: 0.1 },
  ],
  recommendedPower: 300,
  description: '山谷中驻扎着黄巾军的一支小队，地形对防守方有利。',
};

// ── 1-4 卜巳（精英） ──
const ch1_stage4: Stage = {
  id: 'chapter1_stage4',
  name: '卜巳',
  type: 'elite',
  chapterId: 'chapter1',
  order: 4,
  enemyFormation: {
    id: 'ef_ch1_s4',
    name: '黄巾力士精锐',
    recommendedPower: 400,
    units: [
      { id: 'e_ch1_s4_1', name: '黄巾力士头领', faction: 'qun', troopType: TroopType.INFANTRY, level: 5, attack: 36, defense: 22, intelligence: 10, speed: 12, maxHp: 300, position: 'front' },
      { id: 'e_ch1_s4_2', name: '黄巾力士', faction: 'qun', troopType: TroopType.INFANTRY, level: 4, attack: 30, defense: 20, intelligence: 8, speed: 10, maxHp: 260, position: 'front' },
      { id: 'e_ch1_s4_3', name: '黄巾术士', faction: 'qun', troopType: TroopType.STRATEGIST, level: 4, attack: 38, defense: 10, intelligence: 20, speed: 14, maxHp: 140, position: 'back' },
      { id: 'e_ch1_s4_4', name: '黄巾弓手', faction: 'qun', troopType: TroopType.ARCHER, level: 4, attack: 32, defense: 9, intelligence: 14, speed: 15, maxHp: 120, position: 'back' },
      { id: 'e_ch1_s4_5', name: '黄巾力士', faction: 'qun', troopType: TroopType.SPEARMAN, level: 4, attack: 28, defense: 18, intelligence: 8, speed: 10, maxHp: 240, position: 'front' },
    ],
  },
  baseRewards: { grain: 180, gold: 90, troops: 30 },
  baseExp: 80,
  firstClearRewards: { grain: 450, gold: 220, troops: 60 },
  firstClearExp: 240,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 70, maxAmount: 130, probability: 0.9 },
    { type: 'resource', resourceType: 'gold', minAmount: 40, maxAmount: 80, probability: 0.8 },
    { type: 'fragment', generalId: 'guanyu', minAmount: 1, maxAmount: 2, probability: 0.1 },
  ],
  recommendedPower: 400,
  description: '黄巾力士精锐营地，敌人强悍，但击败后可获得丰厚奖励。',
};

// ── 1-5 张宝（BOSS） ──
const ch1_stage5: Stage = {
  id: 'chapter1_stage5',
  name: '张宝',
  type: 'boss',
  chapterId: 'chapter1',
  order: 5,
  enemyFormation: {
    id: 'ef_ch1_s5',
    name: '天公将军·张宝',
    recommendedPower: 500,
    units: [
      { id: 'e_ch1_s5_1', name: '张宝', faction: 'qun', troopType: TroopType.STRATEGIST, level: 8, attack: 48, defense: 20, intelligence: 32, speed: 14, maxHp: 500, position: 'back' },
      { id: 'e_ch1_s5_2', name: '黄巾力士', faction: 'qun', troopType: TroopType.INFANTRY, level: 7, attack: 38, defense: 24, intelligence: 10, speed: 10, maxHp: 340, position: 'front' },
      { id: 'e_ch1_s5_3', name: '黄巾术士', faction: 'qun', troopType: TroopType.STRATEGIST, level: 7, attack: 40, defense: 12, intelligence: 24, speed: 14, maxHp: 180, position: 'back' },
      { id: 'e_ch1_s5_4', name: '黄巾弓手', faction: 'qun', troopType: TroopType.ARCHER, level: 7, attack: 36, defense: 10, intelligence: 16, speed: 16, maxHp: 160, position: 'back' },
      { id: 'e_ch1_s5_5', name: '黄巾步卒', faction: 'qun', troopType: TroopType.INFANTRY, level: 6, attack: 32, defense: 20, intelligence: 8, speed: 10, maxHp: 300, position: 'front' },
      { id: 'e_ch1_s5_6', name: '黄巾枪兵', faction: 'qun', troopType: TroopType.SPEARMAN, level: 6, attack: 30, defense: 18, intelligence: 8, speed: 9, maxHp: 280, position: 'front' },
    ],
  },
  baseRewards: { grain: 300, gold: 150, troops: 50, mandate: 10 },
  baseExp: 100,
  firstClearRewards: { grain: 800, gold: 400, troops: 120, mandate: 20 },
  firstClearExp: 300,
  threeStarBonusMultiplier: 2.0,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 150, maxAmount: 280, probability: 1.0 },
    { type: 'resource', resourceType: 'gold', minAmount: 80, maxAmount: 160, probability: 1.0 },
    { type: 'resource', resourceType: 'mandate', minAmount: 3, maxAmount: 10, probability: 0.8 },
    { type: 'fragment', generalId: 'guanyu', minAmount: 1, maxAmount: 2, probability: 0.1 },
    { type: 'fragment', generalId: 'zhangjiao', minAmount: 1, maxAmount: 2, probability: 0.1 },
  ],
  recommendedPower: 500,
  description: '黄巾之乱首领——地公将军张宝，掌握太平道术，实力强大。',
};

/** 第1章全部关卡（按 order 排列） */
export const CHAPTER1_STAGES: Stage[] = [
  ch1_stage1, ch1_stage2, ch1_stage3, ch1_stage4,
  ch1_stage5,
];
