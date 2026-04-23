/**
 * 关卡系统 — 第2章：群雄割据 关卡数据
 *
 * 包含第2章全部5个关卡的静态配置：
 *   3普通 + 1精英 + 1BOSS
 *
 * 关卡与碎片映射（Play v3.0 §4.3a）：
 *   2-1 董卓    → 董卓碎片（紫）
 *   2-2 华雄    → 董卓碎片（紫）、华雄碎片（蓝）
 *   2-3 李傕    → 赵云碎片（紫）
 *   2-4 郭汜    → 赵云碎片（紫）、华雄碎片（蓝）
 *   2-5 吕布    → 吕布碎片（橙）
 *
 * @module engine/campaign/campaign-chapter2
 */

import { TroopType } from '../battle/battle.types';
import type { Stage } from './campaign.types';

const ch2_stage1: Stage = {
  id: 'chapter2_stage1', name: '董卓', type: 'normal', chapterId: 'chapter2', order: 1,
  enemyFormation: {
    id: 'ef_ch2_s1', name: '西凉军先锋', recommendedPower: 500,
    units: [
      { id: 'e_ch2_s1_1', name: '西凉斥候', faction: 'qun', troopType: TroopType.CAVALRY, level: 6, attack: 34, defense: 16, intelligence: 10, speed: 20, maxHp: 200, position: 'front' },
      { id: 'e_ch2_s1_2', name: '董卓军弓手', faction: 'qun', troopType: TroopType.ARCHER, level: 6, attack: 36, defense: 10, intelligence: 14, speed: 12, maxHp: 130, position: 'back' },
      { id: 'e_ch2_s1_3', name: '西凉步兵', faction: 'qun', troopType: TroopType.INFANTRY, level: 6, attack: 30, defense: 20, intelligence: 8, speed: 9, maxHp: 260, position: 'front' },
    ],
  },
  baseRewards: { grain: 150, gold: 80 }, baseExp: 120,
  firstClearRewards: { grain: 380, gold: 200 }, firstClearExp: 360,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 60, maxAmount: 110, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 30, maxAmount: 60, probability: 0.7 },
    { type: 'fragment', generalId: 'dongzhuo', minAmount: 1, maxAmount: 1, probability: 0.1 },
  ],
  recommendedPower: 500, description: '讨伐董卓的第一道关卡，西凉军的前哨部队。',
};

const ch2_stage2: Stage = {
  id: 'chapter2_stage2', name: '华雄', type: 'normal', chapterId: 'chapter2', order: 2,
  enemyFormation: {
    id: 'ef_ch2_s2', name: '汜水关守备军', recommendedPower: 700,
    units: [
      { id: 'e_ch2_s2_1', name: '西凉校尉', faction: 'qun', troopType: TroopType.INFANTRY, level: 8, attack: 42, defense: 26, intelligence: 12, speed: 11, maxHp: 340, position: 'front' },
      { id: 'e_ch2_s2_2', name: '西凉弓手', faction: 'qun', troopType: TroopType.ARCHER, level: 8, attack: 44, defense: 14, intelligence: 18, speed: 13, maxHp: 170, position: 'back' },
      { id: 'e_ch2_s2_3', name: '西凉枪兵', faction: 'qun', troopType: TroopType.SPEARMAN, level: 8, attack: 38, defense: 24, intelligence: 10, speed: 10, maxHp: 310, position: 'front' },
      { id: 'e_ch2_s2_4', name: '西凉骑兵', faction: 'qun', troopType: TroopType.CAVALRY, level: 8, attack: 40, defense: 18, intelligence: 10, speed: 22, maxHp: 220, position: 'back' },
    ],
  },
  baseRewards: { grain: 180, gold: 100, troops: 20 }, baseExp: 120,
  firstClearRewards: { grain: 440, gold: 240, troops: 50 }, firstClearExp: 360,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 70, maxAmount: 130, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 40, maxAmount: 80, probability: 0.7 },
    { type: 'fragment', generalId: 'dongzhuo', minAmount: 1, maxAmount: 1, probability: 0.1 },
    { type: 'fragment', generalId: 'huaxiong', minAmount: 1, maxAmount: 1, probability: 0.1 },
  ],
  recommendedPower: 700, description: '汜水关要塞，西凉军重兵把守。',
};

const ch2_stage3: Stage = {
  id: 'chapter2_stage3', name: '李傕', type: 'normal', chapterId: 'chapter2', order: 3,
  enemyFormation: {
    id: 'ef_ch2_s3', name: '虎牢关外围守军', recommendedPower: 900,
    units: [
      { id: 'e_ch2_s3_1', name: '董卓军都尉', faction: 'qun', troopType: TroopType.CAVALRY, level: 10, attack: 50, defense: 22, intelligence: 12, speed: 24, maxHp: 300, position: 'front' },
      { id: 'e_ch2_s3_2', name: '董卓军弩手', faction: 'qun', troopType: TroopType.ARCHER, level: 10, attack: 52, defense: 14, intelligence: 20, speed: 14, maxHp: 190, position: 'back' },
      { id: 'e_ch2_s3_3', name: '西凉铁骑', faction: 'qun', troopType: TroopType.CAVALRY, level: 10, attack: 48, defense: 20, intelligence: 10, speed: 26, maxHp: 280, position: 'front' },
    ],
  },
  baseRewards: { grain: 210, gold: 110, troops: 30 }, baseExp: 120,
  firstClearRewards: { grain: 520, gold: 280, troops: 70 }, firstClearExp: 360,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 80, maxAmount: 150, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 45, maxAmount: 90, probability: 0.7 },
    { type: 'fragment', generalId: 'zhaoyun', minAmount: 1, maxAmount: 1, probability: 0.1 },
  ],
  recommendedPower: 900, description: '虎牢关外围阵地，西凉铁骑纵横驰骋。',
};

const ch2_stage4: Stage = {
  id: 'chapter2_stage4', name: '郭汜', type: 'elite', chapterId: 'chapter2', order: 4,
  enemyFormation: {
    id: 'ef_ch2_s4', name: '西凉猛将·郭汜', recommendedPower: 1000,
    units: [
      { id: 'e_ch2_s4_1', name: '郭汜', faction: 'qun', troopType: TroopType.CAVALRY, level: 12, attack: 62, defense: 32, intelligence: 14, speed: 24, maxHp: 500, position: 'front' },
      { id: 'e_ch2_s4_2', name: '西凉铁骑', faction: 'qun', troopType: TroopType.CAVALRY, level: 11, attack: 54, defense: 26, intelligence: 12, speed: 26, maxHp: 360, position: 'front' },
      { id: 'e_ch2_s4_3', name: '西凉弓骑', faction: 'qun', troopType: TroopType.ARCHER, level: 11, attack: 58, defense: 16, intelligence: 20, speed: 22, maxHp: 220, position: 'back' },
      { id: 'e_ch2_s4_4', name: '西凉步兵', faction: 'qun', troopType: TroopType.INFANTRY, level: 11, attack: 50, defense: 30, intelligence: 10, speed: 10, maxHp: 400, position: 'front' },
      { id: 'e_ch2_s4_5', name: '西凉弓手', faction: 'qun', troopType: TroopType.ARCHER, level: 11, attack: 52, defense: 14, intelligence: 18, speed: 16, maxHp: 200, position: 'back' },
    ],
  },
  baseRewards: { grain: 280, gold: 150, troops: 50, mandate: 5 }, baseExp: 120,
  firstClearRewards: { grain: 700, gold: 380, troops: 120, mandate: 15 }, firstClearExp: 360,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 110, maxAmount: 210, probability: 0.9 },
    { type: 'resource', resourceType: 'gold', minAmount: 60, maxAmount: 120, probability: 0.8 },
    { type: 'fragment', generalId: 'zhaoyun', minAmount: 1, maxAmount: 1, probability: 0.1 },
    { type: 'fragment', generalId: 'huaxiong', minAmount: 1, maxAmount: 1, probability: 0.1 },
  ],
  recommendedPower: 1000, description: '西凉将领郭汜镇守关隘，骁勇善战。',
};

// ── 2-5 吕布（BOSS） ──
const ch2_stage5: Stage = {
  id: 'chapter2_stage5', name: '吕布', type: 'boss', chapterId: 'chapter2', order: 5,
  enemyFormation: {
    id: 'ef_ch2_s5', name: '飞将·吕布', recommendedPower: 1200,
    units: [
      { id: 'e_ch2_s5_1', name: '吕布', faction: 'qun', troopType: TroopType.CAVALRY, level: 14, attack: 80, defense: 40, intelligence: 18, speed: 30, maxHp: 700, position: 'front' },
      { id: 'e_ch2_s5_2', name: '并州铁骑', faction: 'qun', troopType: TroopType.CAVALRY, level: 13, attack: 62, defense: 30, intelligence: 12, speed: 28, maxHp: 400, position: 'front' },
      { id: 'e_ch2_s5_3', name: '吕布亲卫', faction: 'qun', troopType: TroopType.INFANTRY, level: 13, attack: 58, defense: 36, intelligence: 12, speed: 11, maxHp: 460, position: 'front' },
      { id: 'e_ch2_s5_4', name: '并州弓骑', faction: 'qun', troopType: TroopType.ARCHER, level: 13, attack: 64, defense: 18, intelligence: 22, speed: 24, maxHp: 260, position: 'back' },
      { id: 'e_ch2_s5_5', name: '并州谋士', faction: 'qun', troopType: TroopType.STRATEGIST, level: 13, attack: 60, defense: 16, intelligence: 30, speed: 16, maxHp: 240, position: 'back' },
      { id: 'e_ch2_s5_6', name: '并州骑兵', faction: 'qun', troopType: TroopType.CAVALRY, level: 12, attack: 56, defense: 24, intelligence: 10, speed: 26, maxHp: 320, position: 'front' },
    ],
  },
  baseRewards: { grain: 450, gold: 240, troops: 80, mandate: 15 }, baseExp: 120,
  firstClearRewards: { grain: 1200, gold: 600, troops: 200, mandate: 40 }, firstClearExp: 360,
  threeStarBonusMultiplier: 2.0,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 220, maxAmount: 400, probability: 1.0 },
    { type: 'resource', resourceType: 'gold', minAmount: 120, maxAmount: 240, probability: 1.0 },
    { type: 'resource', resourceType: 'mandate', minAmount: 5, maxAmount: 15, probability: 0.8 },
    { type: 'fragment', generalId: 'lvbu', minAmount: 1, maxAmount: 2, probability: 0.1 },
  ],
  recommendedPower: 1200, description: '天下第一猛将吕布，武艺超群，人中吕布马中赤兔。',
};

/** 第2章全部关卡（按 order 排列） */
export const CHAPTER2_STAGES: Stage[] = [
  ch2_stage1, ch2_stage2, ch2_stage3, ch2_stage4,
  ch2_stage5,
];
