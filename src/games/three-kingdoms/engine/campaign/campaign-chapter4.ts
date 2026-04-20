/**
 * 关卡系统 — 第4章：赤壁之战 关卡数据
 *
 * 包含第4章全部8个关卡的静态配置：
 *   5普通 + 2精英 + 1BOSS
 *
 * @module engine/campaign/campaign-chapter4
 */

import { TroopType } from '../battle/battle.types';
import type { Stage } from './campaign.types';

// ── 4-1 长坂坡 ──
const ch4_stage1: Stage = {
  id: 'chapter4_stage1',
  name: '长坂坡',
  type: 'normal',
  chapterId: 'chapter4',
  order: 1,
  enemyFormation: {
    id: 'ef_ch4_s1',
    name: '曹军先锋',
    recommendedPower: 1200,
    units: [
      { id: 'e_ch4_s1_1', name: '曹军骑兵', faction: 'wei', troopType: TroopType.CAVALRY, level: 8, attack: 65, defense: 40, intelligence: 20, speed: 45, maxHp: 600, position: 'front' },
      { id: 'e_ch4_s1_2', name: '曹军弓手', faction: 'wei', troopType: TroopType.ARCHER, level: 8, attack: 55, defense: 25, intelligence: 30, speed: 35, maxHp: 450, position: 'back' },
      { id: 'e_ch4_s1_3', name: '曹军步兵', faction: 'wei', troopType: TroopType.INFANTRY, level: 8, attack: 50, defense: 45, intelligence: 15, speed: 25, maxHp: 700, position: 'front' },
    ],
  },
  baseRewards: { grain: 500, gold: 300 },
  baseExp: 200,
  firstClearRewards: { grain: 1200, gold: 800 },
  firstClearExp: 500,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 200, maxAmount: 400, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 120, maxAmount: 250, probability: 0.7 },
    { type: 'exp', minAmount: 50, maxAmount: 100, probability: 0.5 },
  ],
  recommendedPower: 1200,
  description: '曹操大军追击刘备至长坂坡，赵云单骑救主，张飞据水断桥。',
};

// ── 4-2 舌战群儒 ──
const ch4_stage2: Stage = {
  id: 'chapter4_stage2',
  name: '舌战群儒',
  type: 'normal',
  chapterId: 'chapter4',
  order: 2,
  enemyFormation: {
    id: 'ef_ch4_s2',
    name: '东吴文臣',
    recommendedPower: 1300,
    units: [
      { id: 'e_ch4_s2_1', name: '张昭', faction: 'wu', troopType: TroopType.STRATEGIST, level: 9, attack: 40, defense: 30, intelligence: 70, speed: 35, maxHp: 500, position: 'back' },
      { id: 'e_ch4_s2_2', name: '虞翻', faction: 'wu', troopType: TroopType.STRATEGIST, level: 8, attack: 35, defense: 25, intelligence: 60, speed: 30, maxHp: 450, position: 'back' },
      { id: 'e_ch4_s2_3', name: '步骘', faction: 'wu', troopType: TroopType.STRATEGIST, level: 8, attack: 38, defense: 28, intelligence: 55, speed: 32, maxHp: 480, position: 'front' },
      { id: 'e_ch4_s2_4', name: '东吴侍卫', faction: 'wu', troopType: TroopType.INFANTRY, level: 8, attack: 45, defense: 35, intelligence: 15, speed: 28, maxHp: 550, position: 'front' },
    ],
  },
  baseRewards: { grain: 550, gold: 350 },
  baseExp: 220,
  firstClearRewards: { grain: 1300, gold: 900 },
  firstClearExp: 550,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'gold', minAmount: 150, maxAmount: 300, probability: 0.8 },
    { type: 'exp', minAmount: 60, maxAmount: 120, probability: 0.6 },
  ],
  recommendedPower: 1300,
  description: '诸葛亮出使东吴，舌战群儒，力排众议促成孙刘联盟。',
};

// ── 4-3 草船借箭 ──
const ch4_stage3: Stage = {
  id: 'chapter4_stage3',
  name: '草船借箭',
  type: 'normal',
  chapterId: 'chapter4',
  order: 3,
  enemyFormation: {
    id: 'ef_ch4_s3',
    name: '曹军水寨守卫',
    recommendedPower: 1400,
    units: [
      { id: 'e_ch4_s3_1', name: '曹军弩手', faction: 'wei', troopType: TroopType.ARCHER, level: 9, attack: 70, defense: 20, intelligence: 25, speed: 30, maxHp: 400, position: 'back' },
      { id: 'e_ch4_s3_2', name: '曹军弩手', faction: 'wei', troopType: TroopType.ARCHER, level: 9, attack: 70, defense: 20, intelligence: 25, speed: 30, maxHp: 400, position: 'back' },
      { id: 'e_ch4_s3_3', name: '曹军校尉', faction: 'wei', troopType: TroopType.INFANTRY, level: 9, attack: 55, defense: 40, intelligence: 20, speed: 28, maxHp: 600, position: 'front' },
      { id: 'e_ch4_s3_4', name: '曹军水兵', faction: 'wei', troopType: TroopType.INFANTRY, level: 8, attack: 48, defense: 35, intelligence: 15, speed: 25, maxHp: 520, position: 'front' },
    ],
  },
  baseRewards: { grain: 600, gold: 400 },
  baseExp: 240,
  firstClearRewards: { grain: 1400, gold: 1000 },
  firstClearExp: 600,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 250, maxAmount: 500, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 180, maxAmount: 350, probability: 0.7 },
  ],
  recommendedPower: 1400,
  description: '大雾弥漫之夜，诸葛亮以草船向曹军借箭十万支。',
};

// ── 4-4 苦肉计 ──
const ch4_stage4: Stage = {
  id: 'chapter4_stage4',
  name: '苦肉计',
  type: 'normal',
  chapterId: 'chapter4',
  order: 4,
  enemyFormation: {
    id: 'ef_ch4_s4',
    name: '曹军巡逻队',
    recommendedPower: 1500,
    units: [
      { id: 'e_ch4_s4_1', name: '蔡瑁', faction: 'wei', troopType: TroopType.SPEARMAN, level: 9, attack: 58, defense: 45, intelligence: 30, speed: 32, maxHp: 650, position: 'front' },
      { id: 'e_ch4_s4_2', name: '张允', faction: 'wei', troopType: TroopType.ARCHER, level: 9, attack: 62, defense: 25, intelligence: 35, speed: 34, maxHp: 480, position: 'back' },
      { id: 'e_ch4_s4_3', name: '曹军水兵', faction: 'wei', troopType: TroopType.INFANTRY, level: 9, attack: 52, defense: 38, intelligence: 18, speed: 26, maxHp: 580, position: 'front' },
      { id: 'e_ch4_s4_4', name: '曹军水兵', faction: 'wei', troopType: TroopType.INFANTRY, level: 9, attack: 52, defense: 38, intelligence: 18, speed: 26, maxHp: 580, position: 'front' },
    ],
  },
  baseRewards: { grain: 650, gold: 420 },
  baseExp: 260,
  firstClearRewards: { grain: 1500, gold: 1100 },
  firstClearExp: 650,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'gold', minAmount: 200, maxAmount: 400, probability: 0.8 },
    { type: 'exp', minAmount: 80, maxAmount: 150, probability: 0.5 },
  ],
  recommendedPower: 1500,
  description: '黄盖施苦肉计诈降曹操，为火攻赤壁埋下伏笔。',
};

// ── 4-5 借东风 ──
const ch4_stage5: Stage = {
  id: 'chapter4_stage5',
  name: '借东风',
  type: 'normal',
  chapterId: 'chapter4',
  order: 5,
  enemyFormation: {
    id: 'ef_ch4_s5',
    name: '曹军精锐',
    recommendedPower: 1600,
    units: [
      { id: 'e_ch4_s5_1', name: '曹军铁骑', faction: 'wei', troopType: TroopType.CAVALRY, level: 10, attack: 72, defense: 48, intelligence: 22, speed: 48, maxHp: 700, position: 'front' },
      { id: 'e_ch4_s5_2', name: '曹军谋士', faction: 'wei', troopType: TroopType.STRATEGIST, level: 10, attack: 45, defense: 30, intelligence: 65, speed: 38, maxHp: 500, position: 'back' },
      { id: 'e_ch4_s5_3', name: '曹军枪兵', faction: 'wei', troopType: TroopType.SPEARMAN, level: 10, attack: 60, defense: 42, intelligence: 18, speed: 30, maxHp: 620, position: 'front' },
      { id: 'e_ch4_s5_4', name: '曹军弩手', faction: 'wei', troopType: TroopType.ARCHER, level: 10, attack: 68, defense: 22, intelligence: 28, speed: 35, maxHp: 460, position: 'back' },
      { id: 'e_ch4_s5_5', name: '曹军步兵', faction: 'wei', troopType: TroopType.INFANTRY, level: 10, attack: 55, defense: 45, intelligence: 15, speed: 25, maxHp: 680, position: 'front' },
    ],
  },
  baseRewards: { grain: 700, gold: 450 },
  baseExp: 280,
  firstClearRewards: { grain: 1600, gold: 1200 },
  firstClearExp: 700,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 300, maxAmount: 600, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 220, maxAmount: 450, probability: 0.7 },
    { type: 'exp', minAmount: 90, maxAmount: 180, probability: 0.5 },
  ],
  recommendedPower: 1600,
  description: '诸葛亮七星坛借东风，万事俱备只欠东风。',
};

// ── 4-6 赤壁前哨（精英） ──
const ch4_stage6: Stage = {
  id: 'chapter4_stage6',
  name: '赤壁前哨',
  type: 'elite',
  chapterId: 'chapter4',
  order: 6,
  enemyFormation: {
    id: 'ef_ch4_s6',
    name: '曹军水寨精锐',
    recommendedPower: 1800,
    units: [
      { id: 'e_ch4_s6_1', name: '曹军都尉', faction: 'wei', troopType: TroopType.CAVALRY, level: 11, attack: 78, defense: 52, intelligence: 25, speed: 50, maxHp: 800, position: 'front' },
      { id: 'e_ch4_s6_2', name: '曹军铁卫', faction: 'wei', troopType: TroopType.INFANTRY, level: 11, attack: 62, defense: 55, intelligence: 20, speed: 28, maxHp: 850, position: 'front' },
      { id: 'e_ch4_s6_3', name: '曹军术士', faction: 'wei', troopType: TroopType.STRATEGIST, level: 11, attack: 50, defense: 32, intelligence: 72, speed: 40, maxHp: 550, position: 'back' },
      { id: 'e_ch4_s6_4', name: '曹军弩队长', faction: 'wei', troopType: TroopType.ARCHER, level: 11, attack: 75, defense: 28, intelligence: 30, speed: 38, maxHp: 520, position: 'back' },
      { id: 'e_ch4_s6_5', name: '曹军枪卫', faction: 'wei', troopType: TroopType.SPEARMAN, level: 11, attack: 68, defense: 48, intelligence: 22, speed: 32, maxHp: 720, position: 'front' },
    ],
  },
  baseRewards: { grain: 900, gold: 600 },
  baseExp: 350,
  firstClearRewards: { grain: 2000, gold: 1500 },
  firstClearExp: 900,
  threeStarBonusMultiplier: 1.8,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 400, maxAmount: 800, probability: 0.9 },
    { type: 'resource', resourceType: 'gold', minAmount: 300, maxAmount: 600, probability: 0.8 },
    { type: 'fragment', generalId: 'zhugeliang', minAmount: 1, maxAmount: 3, probability: 0.3 },
    { type: 'exp', minAmount: 100, maxAmount: 200, probability: 0.6 },
  ],
  recommendedPower: 1800,
  description: '曹军水寨的精锐守卫，突破这里就能直取曹操本阵。',
};

// ── 4-7 火烧连环（精英） ──
const ch4_stage7: Stage = {
  id: 'chapter4_stage7',
  name: '火烧连环',
  type: 'elite',
  chapterId: 'chapter4',
  order: 7,
  enemyFormation: {
    id: 'ef_ch4_s7',
    name: '连环船守军',
    recommendedPower: 2000,
    units: [
      { id: 'e_ch4_s7_1', name: '曹军偏将', faction: 'wei', troopType: TroopType.CAVALRY, level: 12, attack: 85, defense: 55, intelligence: 28, speed: 52, maxHp: 900, position: 'front' },
      { id: 'e_ch4_s7_2', name: '曹军铁甲兵', faction: 'wei', troopType: TroopType.INFANTRY, level: 12, attack: 68, defense: 60, intelligence: 20, speed: 25, maxHp: 1000, position: 'front' },
      { id: 'e_ch4_s7_3', name: '曹军军师', faction: 'wei', troopType: TroopType.STRATEGIST, level: 12, attack: 55, defense: 35, intelligence: 78, speed: 42, maxHp: 600, position: 'back' },
      { id: 'e_ch4_s7_4', name: '曹军神射手', faction: 'wei', troopType: TroopType.ARCHER, level: 12, attack: 82, defense: 30, intelligence: 32, speed: 40, maxHp: 550, position: 'back' },
      { id: 'e_ch4_s7_5', name: '曹军重枪兵', faction: 'wei', troopType: TroopType.SPEARMAN, level: 12, attack: 72, defense: 52, intelligence: 18, speed: 30, maxHp: 800, position: 'front' },
      { id: 'e_ch4_s7_6', name: '曹军斥候', faction: 'wei', troopType: TroopType.CAVALRY, level: 11, attack: 65, defense: 38, intelligence: 25, speed: 55, maxHp: 600, position: 'back' },
    ],
  },
  baseRewards: { grain: 1100, gold: 750 },
  baseExp: 400,
  firstClearRewards: { grain: 2500, gold: 1800 },
  firstClearExp: 1000,
  threeStarBonusMultiplier: 1.8,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 500, maxAmount: 1000, probability: 0.9 },
    { type: 'resource', resourceType: 'gold', minAmount: 350, maxAmount: 700, probability: 0.8 },
    { type: 'fragment', generalId: 'zhouyu', minAmount: 1, maxAmount: 3, probability: 0.3 },
    { type: 'exp', minAmount: 120, maxAmount: 250, probability: 0.6 },
  ],
  recommendedPower: 2000,
  description: '东风已起，火船冲入连环船阵，曹军大乱！',
};

// ── 4-8 赤壁决战（BOSS） ──
const ch4_stage8: Stage = {
  id: 'chapter4_stage8',
  name: '赤壁决战',
  type: 'boss',
  chapterId: 'chapter4',
  order: 8,
  enemyFormation: {
    id: 'ef_ch4_s8',
    name: '曹操亲卫',
    recommendedPower: 2500,
    units: [
      { id: 'e_ch4_s8_1', name: '曹操', faction: 'wei', troopType: TroopType.STRATEGIST, level: 15, attack: 90, defense: 60, intelligence: 95, speed: 55, maxHp: 1500, position: 'back' },
      { id: 'e_ch4_s8_2', name: '许褚', faction: 'wei', troopType: TroopType.INFANTRY, level: 14, attack: 95, defense: 70, intelligence: 20, speed: 35, maxHp: 1200, position: 'front' },
      { id: 'e_ch4_s8_3', name: '张辽', faction: 'wei', troopType: TroopType.CAVALRY, level: 14, attack: 92, defense: 58, intelligence: 45, speed: 60, maxHp: 1100, position: 'front' },
      { id: 'e_ch4_s8_4', name: '曹军铁卫', faction: 'wei', troopType: TroopType.INFANTRY, level: 13, attack: 75, defense: 62, intelligence: 22, speed: 30, maxHp: 900, position: 'front' },
      { id: 'e_ch4_s8_5', name: '曹军谋士', faction: 'wei', troopType: TroopType.STRATEGIST, level: 13, attack: 60, defense: 38, intelligence: 80, speed: 45, maxHp: 650, position: 'back' },
      { id: 'e_ch4_s8_6', name: '曹军弓骑', faction: 'wei', troopType: TroopType.ARCHER, level: 13, attack: 85, defense: 32, intelligence: 35, speed: 48, maxHp: 600, position: 'back' },
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
    { type: 'fragment', generalId: 'caocao', minAmount: 2, maxAmount: 5, probability: 0.5 },
    { type: 'fragment', generalId: 'zhaoyun', minAmount: 1, maxAmount: 3, probability: 0.3 },
    { type: 'exp', minAmount: 200, maxAmount: 400, probability: 0.8 },
  ],
  recommendedPower: 2500,
  description: '赤壁之战！孙刘联军火烧曹营，曹操败走华容道。',
};

export const CHAPTER4_STAGES: Stage[] = [
  ch4_stage1, ch4_stage2, ch4_stage3, ch4_stage4,
  ch4_stage5, ch4_stage6, ch4_stage7, ch4_stage8,
];
