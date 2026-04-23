/**
 * 关卡系统 — 第6章：一统天下 关卡数据
 *
 * 包含第6章全部5个关卡的静态配置：
 *   3普通 + 1精英 + 1BOSS
 *
 * 关卡与碎片映射（Play v3.0 §4.3a）：
 *   6-1 魏延          → 关羽碎片（紫）、赵云碎片（紫）
 *   6-2 姜维          → 诸葛亮碎片（橙）、吕布碎片（橙）
 *   6-3 陆逊          → 周瑜碎片（橙）、孙权碎片（橙）
 *   6-4 司马师        → 曹操碎片（紫）、司马懿碎片（橙）
 *   6-5 司马炎·终局   → 全武将碎片随机×3
 *
 * @module engine/campaign/campaign-chapter6
 */

import { TroopType } from '../battle/battle.types';
import type { Stage } from './campaign.types';

// ── 6-1 魏延 ──
const ch6_stage1: Stage = {
  id: 'chapter6_stage1',
  name: '魏延',
  type: 'normal',
  chapterId: 'chapter6',
  order: 1,
  enemyFormation: {
    id: 'ef_ch6_s1',
    name: '蜀军叛将·魏延',
    recommendedPower: 10000,
    units: [
      { id: 'e_ch6_s1_1', name: '魏延', faction: 'shu', troopType: TroopType.CAVALRY, level: 26, attack: 105, defense: 55, intelligence: 35, speed: 52, maxHp: 1200, position: 'front' },
      { id: 'e_ch6_s1_2', name: '魏延亲兵', faction: 'shu', troopType: TroopType.INFANTRY, level: 25, attack: 88, defense: 62, intelligence: 22, speed: 28, maxHp: 1100, position: 'front' },
      { id: 'e_ch6_s1_3', name: '蜀军弓手', faction: 'shu', troopType: TroopType.ARCHER, level: 25, attack: 92, defense: 30, intelligence: 32, speed: 38, maxHp: 650, position: 'back' },
      { id: 'e_ch6_s1_4', name: '蜀军骑兵', faction: 'shu', troopType: TroopType.CAVALRY, level: 25, attack: 90, defense: 45, intelligence: 25, speed: 50, maxHp: 850, position: 'back' },
    ],
  },
  baseRewards: { grain: 1500, gold: 1000 },
  baseExp: 2000,
  firstClearRewards: { grain: 4000, gold: 2500 },
  firstClearExp: 6000,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 650, maxAmount: 1300, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 450, maxAmount: 900, probability: 0.7 },
    { type: 'fragment', generalId: 'guanyu', minAmount: 1, maxAmount: 1, probability: 0.1 },
    { type: 'fragment', generalId: 'zhaoyun', minAmount: 1, maxAmount: 1, probability: 0.1 },
  ],
  recommendedPower: 10000,
  description: '蜀汉大将魏延，勇猛过人却心怀异志。',
};

// ── 6-2 姜维 ──
const ch6_stage2: Stage = {
  id: 'chapter6_stage2',
  name: '姜维',
  type: 'normal',
  chapterId: 'chapter6',
  order: 2,
  enemyFormation: {
    id: 'ef_ch6_s2',
    name: '蜀军后期统帅·姜维',
    recommendedPower: 13000,
    units: [
      { id: 'e_ch6_s2_1', name: '姜维', faction: 'shu', troopType: TroopType.SPEARMAN, level: 28, attack: 110, defense: 58, intelligence: 65, speed: 48, maxHp: 1300, position: 'front' },
      { id: 'e_ch6_s2_2', name: '蜀军精锐', faction: 'shu', troopType: TroopType.INFANTRY, level: 27, attack: 95, defense: 65, intelligence: 25, speed: 28, maxHp: 1200, position: 'front' },
      { id: 'e_ch6_s2_3', name: '蜀军弩手', faction: 'shu', troopType: TroopType.ARCHER, level: 27, attack: 100, defense: 32, intelligence: 38, speed: 40, maxHp: 680, position: 'back' },
      { id: 'e_ch6_s2_4', name: '蜀军骑兵', faction: 'shu', troopType: TroopType.CAVALRY, level: 27, attack: 98, defense: 48, intelligence: 28, speed: 55, maxHp: 900, position: 'front' },
    ],
  },
  baseRewards: { grain: 1800, gold: 1200 },
  baseExp: 2000,
  firstClearRewards: { grain: 4500, gold: 3000 },
  firstClearExp: 6000,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 780, maxAmount: 1550, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 550, maxAmount: 1100, probability: 0.7 },
    { type: 'fragment', generalId: 'zhugeliang', minAmount: 1, maxAmount: 1, probability: 0.1 },
    { type: 'fragment', generalId: 'lvbu', minAmount: 1, maxAmount: 1, probability: 0.1 },
  ],
  recommendedPower: 13000,
  description: '诸葛亮衣钵传人姜维，九伐中原，壮志未酬。',
};

// ── 6-3 陆逊 ──
const ch6_stage3: Stage = {
  id: 'chapter6_stage3',
  name: '陆逊',
  type: 'normal',
  chapterId: 'chapter6',
  order: 3,
  enemyFormation: {
    id: 'ef_ch6_s3',
    name: '东吴大都督·陆逊',
    recommendedPower: 15500,
    units: [
      { id: 'e_ch6_s3_1', name: '陆逊', faction: 'wu', troopType: TroopType.STRATEGIST, level: 30, attack: 95, defense: 50, intelligence: 98, speed: 52, maxHp: 1200, position: 'back' },
      { id: 'e_ch6_s3_2', name: '吴军精锐', faction: 'wu', troopType: TroopType.INFANTRY, level: 29, attack: 92, defense: 62, intelligence: 25, speed: 30, maxHp: 1300, position: 'front' },
      { id: 'e_ch6_s3_3', name: '吴军弓弩手', faction: 'wu', troopType: TroopType.ARCHER, level: 29, attack: 98, defense: 32, intelligence: 38, speed: 42, maxHp: 700, position: 'back' },
      { id: 'e_ch6_s3_4', name: '吴军水军', faction: 'wu', troopType: TroopType.SPEARMAN, level: 28, attack: 88, defense: 55, intelligence: 22, speed: 35, maxHp: 1050, position: 'front' },
    ],
  },
  baseRewards: { grain: 2200, gold: 1500 },
  baseExp: 2000,
  firstClearRewards: { grain: 5500, gold: 3800 },
  firstClearExp: 6000,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 950, maxAmount: 1900, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 680, maxAmount: 1350, probability: 0.7 },
    { type: 'fragment', generalId: 'zhouyu', minAmount: 1, maxAmount: 1, probability: 0.1 },
    { type: 'fragment', generalId: 'sunquan', minAmount: 1, maxAmount: 1, probability: 0.1 },
  ],
  recommendedPower: 15500,
  description: '东吴大都督陆逊，夷陵之战火烧连营，智谋超群。',
};

// ── 6-4 司马师（精英） ──
const ch6_stage4: Stage = {
  id: 'chapter6_stage4',
  name: '司马师',
  type: 'elite',
  chapterId: 'chapter6',
  order: 4,
  enemyFormation: {
    id: 'ef_ch6_s4',
    name: '司马氏精锐',
    recommendedPower: 17500,
    units: [
      { id: 'e_ch6_s4_1', name: '司马师', faction: 'wei', troopType: TroopType.STRATEGIST, level: 32, attack: 100, defense: 55, intelligence: 95, speed: 50, maxHp: 1400, position: 'back' },
      { id: 'e_ch6_s4_2', name: '司马亲卫', faction: 'wei', troopType: TroopType.INFANTRY, level: 31, attack: 98, defense: 72, intelligence: 25, speed: 28, maxHp: 1500, position: 'front' },
      { id: 'e_ch6_s4_3', name: '魏军军师', faction: 'wei', troopType: TroopType.STRATEGIST, level: 31, attack: 78, defense: 42, intelligence: 92, speed: 45, maxHp: 800, position: 'back' },
      { id: 'e_ch6_s4_4', name: '魏军神弩手', faction: 'wei', troopType: TroopType.ARCHER, level: 31, attack: 105, defense: 35, intelligence: 40, speed: 42, maxHp: 720, position: 'back' },
      { id: 'e_ch6_s4_5', name: '魏军重枪兵', faction: 'wei', troopType: TroopType.SPEARMAN, level: 30, attack: 95, defense: 62, intelligence: 22, speed: 34, maxHp: 1200, position: 'front' },
    ],
  },
  baseRewards: { grain: 2800, gold: 1900 },
  baseExp: 2000,
  firstClearRewards: { grain: 7000, gold: 4800 },
  firstClearExp: 6000,
  threeStarBonusMultiplier: 1.8,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 1200, maxAmount: 2400, probability: 0.9 },
    { type: 'resource', resourceType: 'gold', minAmount: 850, maxAmount: 1700, probability: 0.8 },
    { type: 'fragment', generalId: 'caocao', minAmount: 1, maxAmount: 1, probability: 0.1 },
    { type: 'fragment', generalId: 'simayi', minAmount: 1, maxAmount: 1, probability: 0.1 },
  ],
  recommendedPower: 17500,
  description: '司马师继承父业，掌控曹魏朝政，野心勃勃。',
};

// ── 6-5 司马炎·终局（BOSS） ──
const ch6_stage5: Stage = {
  id: 'chapter6_stage5',
  name: '司马炎·终局',
  type: 'boss',
  chapterId: 'chapter6',
  order: 5,
  enemyFormation: {
    id: 'ef_ch6_s5',
    name: '晋武帝·司马炎',
    recommendedPower: 20000,
    units: [
      { id: 'e_ch6_s5_1', name: '司马炎', faction: 'wei', troopType: TroopType.STRATEGIST, level: 35, attack: 110, defense: 62, intelligence: 100, speed: 55, maxHp: 2000, position: 'back' },
      { id: 'e_ch6_s5_2', name: '司马昭', faction: 'wei', troopType: TroopType.STRATEGIST, level: 34, attack: 105, defense: 58, intelligence: 98, speed: 52, maxHp: 1600, position: 'back' },
      { id: 'e_ch6_s5_3', name: '晋军虎卫统领', faction: 'wei', troopType: TroopType.INFANTRY, level: 33, attack: 115, defense: 78, intelligence: 25, speed: 30, maxHp: 1700, position: 'front' },
      { id: 'e_ch6_s5_4', name: '晋军铁骑', faction: 'wei', troopType: TroopType.CAVALRY, level: 33, attack: 112, defense: 58, intelligence: 30, speed: 62, maxHp: 1300, position: 'front' },
      { id: 'e_ch6_s5_5', name: '晋军军师', faction: 'wei', troopType: TroopType.STRATEGIST, level: 32, attack: 85, defense: 48, intelligence: 95, speed: 48, maxHp: 900, position: 'back' },
      { id: 'e_ch6_s5_6', name: '晋军弩卫长', faction: 'wei', troopType: TroopType.ARCHER, level: 32, attack: 108, defense: 38, intelligence: 42, speed: 45, maxHp: 750, position: 'back' },
    ],
  },
  baseRewards: { grain: 4000, gold: 2800, troops: 500, mandate: 50 },
  baseExp: 2000,
  firstClearRewards: { grain: 12000, gold: 8000, troops: 1500, mandate: 150 },
  firstClearExp: 6000,
  threeStarBonusMultiplier: 2.0,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 2000, maxAmount: 4000, probability: 1.0 },
    { type: 'resource', resourceType: 'gold', minAmount: 1400, maxAmount: 2800, probability: 1.0 },
    { type: 'fragment', generalId: 'zhangjiao', minAmount: 1, maxAmount: 2, probability: 0.1 },
    { type: 'fragment', generalId: 'guanyu', minAmount: 1, maxAmount: 2, probability: 0.1 },
    { type: 'fragment', generalId: 'caocao', minAmount: 1, maxAmount: 2, probability: 0.1 },
  ],
  recommendedPower: 20000,
  description: '晋武帝司马炎，篡魏建晋，一统天下，三国终局！',
};

export const CHAPTER6_STAGES: Stage[] = [
  ch6_stage1, ch6_stage2, ch6_stage3, ch6_stage4,
  ch6_stage5,
];
