/**
 * 关卡系统 — 第2章：讨伐董卓 关卡数据
 *
 * 包含第2章全部8个关卡的静态配置：
 *   5普通 + 2精英 + 1BOSS
 *
 * @module engine/campaign/campaign-chapter2
 */

import { TroopType } from '../battle/battle.types';
import type { Stage } from './campaign.types';

const ch2_stage1: Stage = {
  id: 'chapter2_stage1', name: '汜水关前哨', type: 'normal', chapterId: 'chapter2', order: 1,
  enemyFormation: {
    id: 'ef_ch2_s1', name: '汜水关守军', recommendedPower: 550,
    units: [
      { id: 'e_ch2_s1_1', name: '西凉斥候', faction: 'qun', troopType: TroopType.CAVALRY, level: 8, attack: 46, defense: 22, intelligence: 12, speed: 22, maxHp: 260, position: 'front' },
      { id: 'e_ch2_s1_2', name: '董卓军弓手', faction: 'qun', troopType: TroopType.ARCHER, level: 8, attack: 48, defense: 14, intelligence: 18, speed: 14, maxHp: 170, position: 'back' },
      { id: 'e_ch2_s1_3', name: '西凉步兵', faction: 'qun', troopType: TroopType.INFANTRY, level: 8, attack: 40, defense: 26, intelligence: 10, speed: 10, maxHp: 320, position: 'front' },
    ],
  },
  baseRewards: { grain: 200, gold: 110 }, baseExp: 90,
  firstClearRewards: { grain: 500, gold: 260 }, firstClearExp: 200,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 80, maxAmount: 140, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 40, maxAmount: 80, probability: 0.7 },
  ],
  recommendedPower: 550, description: '讨伐董卓的第一道关卡，西凉军的前哨部队。',
};

const ch2_stage2: Stage = {
  id: 'chapter2_stage2', name: '汜水关', type: 'normal', chapterId: 'chapter2', order: 2,
  enemyFormation: {
    id: 'ef_ch2_s2', name: '汜水关守备军', recommendedPower: 620,
    units: [
      { id: 'e_ch2_s2_1', name: '西凉校尉', faction: 'qun', troopType: TroopType.INFANTRY, level: 9, attack: 50, defense: 30, intelligence: 14, speed: 12, maxHp: 380, position: 'front' },
      { id: 'e_ch2_s2_2', name: '西凉弓手', faction: 'qun', troopType: TroopType.ARCHER, level: 9, attack: 52, defense: 16, intelligence: 20, speed: 14, maxHp: 190, position: 'back' },
      { id: 'e_ch2_s2_3', name: '西凉枪兵', faction: 'qun', troopType: TroopType.SPEARMAN, level: 9, attack: 46, defense: 28, intelligence: 12, speed: 11, maxHp: 350, position: 'front' },
      { id: 'e_ch2_s2_4', name: '西凉骑兵', faction: 'qun', troopType: TroopType.CAVALRY, level: 9, attack: 48, defense: 20, intelligence: 12, speed: 24, maxHp: 240, position: 'back' },
    ],
  },
  baseRewards: { grain: 230, gold: 120, troops: 30 }, baseExp: 100,
  firstClearRewards: { grain: 560, gold: 280, troops: 70 }, firstClearExp: 220,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 90, maxAmount: 160, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 50, maxAmount: 90, probability: 0.7 },
    { type: 'fragment', generalId: 'caocao', minAmount: 1, maxAmount: 1, probability: 0.08 },
  ],
  recommendedPower: 620, description: '汜水关要塞，西凉军重兵把守。',
};

const ch2_stage3: Stage = {
  id: 'chapter2_stage3', name: '虎牢关外', type: 'normal', chapterId: 'chapter2', order: 3,
  enemyFormation: {
    id: 'ef_ch2_s3', name: '虎牢关外围守军', recommendedPower: 700,
    units: [
      { id: 'e_ch2_s3_1', name: '董卓军都尉', faction: 'qun', troopType: TroopType.CAVALRY, level: 10, attack: 56, defense: 26, intelligence: 14, speed: 24, maxHp: 320, position: 'front' },
      { id: 'e_ch2_s3_2', name: '董卓军弩手', faction: 'qun', troopType: TroopType.ARCHER, level: 10, attack: 58, defense: 16, intelligence: 22, speed: 14, maxHp: 200, position: 'back' },
      { id: 'e_ch2_s3_3', name: '西凉铁骑', faction: 'qun', troopType: TroopType.CAVALRY, level: 10, attack: 54, defense: 24, intelligence: 12, speed: 26, maxHp: 300, position: 'front' },
    ],
  },
  baseRewards: { grain: 260, gold: 140, troops: 40 }, baseExp: 110,
  firstClearRewards: { grain: 620, gold: 320, troops: 80 }, firstClearExp: 240,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 100, maxAmount: 180, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 55, maxAmount: 100, probability: 0.7 },
    { type: 'resource', resourceType: 'troops', minAmount: 15, maxAmount: 40, probability: 0.5 },
  ],
  recommendedPower: 700, description: '虎牢关外围阵地，西凉铁骑纵横驰骋。',
};

const ch2_stage4: Stage = {
  id: 'chapter2_stage4', name: '虎牢关', type: 'normal', chapterId: 'chapter2', order: 4,
  enemyFormation: {
    id: 'ef_ch2_s4', name: '虎牢关守军', recommendedPower: 780,
    units: [
      { id: 'e_ch2_s4_1', name: '董卓军偏将', faction: 'qun', troopType: TroopType.INFANTRY, level: 11, attack: 60, defense: 34, intelligence: 16, speed: 12, maxHp: 420, position: 'front' },
      { id: 'e_ch2_s4_2', name: '董卓军弓手', faction: 'qun', troopType: TroopType.ARCHER, level: 11, attack: 62, defense: 18, intelligence: 24, speed: 15, maxHp: 210, position: 'back' },
      { id: 'e_ch2_s4_3', name: '西凉枪兵', faction: 'qun', troopType: TroopType.SPEARMAN, level: 11, attack: 56, defense: 32, intelligence: 14, speed: 11, maxHp: 400, position: 'front' },
      { id: 'e_ch2_s4_4', name: '西凉骑兵', faction: 'qun', troopType: TroopType.CAVALRY, level: 11, attack: 58, defense: 24, intelligence: 14, speed: 26, maxHp: 280, position: 'back' },
    ],
  },
  baseRewards: { grain: 290, gold: 150, troops: 50 }, baseExp: 120,
  firstClearRewards: { grain: 700, gold: 360, troops: 100 }, firstClearExp: 260,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 110, maxAmount: 200, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 60, maxAmount: 110, probability: 0.7 },
    { type: 'fragment', generalId: 'caocao', minAmount: 1, maxAmount: 1, probability: 0.1 },
  ],
  recommendedPower: 780, description: '虎牢关天险，一夫当关万夫莫开。',
};

const ch2_stage5: Stage = {
  id: 'chapter2_stage5', name: '洛阳近郊', type: 'normal', chapterId: 'chapter2', order: 5,
  enemyFormation: {
    id: 'ef_ch2_s5', name: '洛阳外围守军', recommendedPower: 860,
    units: [
      { id: 'e_ch2_s5_1', name: '董卓军护军', faction: 'qun', troopType: TroopType.SPEARMAN, level: 12, attack: 64, defense: 36, intelligence: 16, speed: 12, maxHp: 460, position: 'front' },
      { id: 'e_ch2_s5_2', name: '董卓军术士', faction: 'qun', troopType: TroopType.STRATEGIST, level: 12, attack: 68, defense: 16, intelligence: 30, speed: 16, maxHp: 220, position: 'back' },
      { id: 'e_ch2_s5_3', name: '西凉精骑', faction: 'qun', troopType: TroopType.CAVALRY, level: 12, attack: 62, defense: 28, intelligence: 14, speed: 28, maxHp: 340, position: 'front' },
    ],
  },
  baseRewards: { grain: 320, gold: 170, troops: 60 }, baseExp: 130,
  firstClearRewards: { grain: 760, gold: 400, troops: 120 }, firstClearExp: 280,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 120, maxAmount: 220, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 65, maxAmount: 120, probability: 0.7 },
    { type: 'resource', resourceType: 'troops', minAmount: 20, maxAmount: 50, probability: 0.5 },
  ],
  recommendedPower: 860, description: '洛阳城外围防线，董卓重兵驻扎。',
};

// ── 2-6【精英】华雄 ──
const ch2_stage6: Stage = {
  id: 'chapter2_stage6', name: '华雄', type: 'elite', chapterId: 'chapter2', order: 6,
  enemyFormation: {
    id: 'ef_ch2_s6', name: '西凉猛将·华雄', recommendedPower: 960,
    units: [
      { id: 'e_ch2_s6_1', name: '华雄', faction: 'qun', troopType: TroopType.CAVALRY, level: 14, attack: 78, defense: 40, intelligence: 16, speed: 26, maxHp: 600, position: 'front' },
      { id: 'e_ch2_s6_2', name: '西凉铁骑', faction: 'qun', troopType: TroopType.CAVALRY, level: 13, attack: 66, defense: 30, intelligence: 14, speed: 28, maxHp: 380, position: 'front' },
      { id: 'e_ch2_s6_3', name: '西凉弓骑', faction: 'qun', troopType: TroopType.ARCHER, level: 13, attack: 70, defense: 18, intelligence: 22, speed: 24, maxHp: 240, position: 'back' },
      { id: 'e_ch2_s6_4', name: '西凉步兵', faction: 'qun', troopType: TroopType.INFANTRY, level: 13, attack: 60, defense: 36, intelligence: 12, speed: 10, maxHp: 440, position: 'front' },
      { id: 'e_ch2_s6_5', name: '西凉弓手', faction: 'qun', troopType: TroopType.ARCHER, level: 13, attack: 64, defense: 16, intelligence: 20, speed: 16, maxHp: 220, position: 'back' },
    ],
  },
  baseRewards: { grain: 380, gold: 200, troops: 70, mandate: 8 }, baseExp: 160,
  firstClearRewards: { grain: 900, gold: 480, troops: 160, mandate: 20 }, firstClearExp: 350,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 150, maxAmount: 280, probability: 0.9 },
    { type: 'resource', resourceType: 'gold', minAmount: 80, maxAmount: 160, probability: 0.8 },
    { type: 'fragment', generalId: 'guanyu', minAmount: 1, maxAmount: 2, probability: 0.25 },
    { type: 'resource', resourceType: 'mandate', minAmount: 2, maxAmount: 5, probability: 0.4 },
  ],
  recommendedPower: 960, description: '西凉猛将华雄镇守关隘，骁勇善战，不可小觑。',
};

// ── 2-7【精英】吕布 ──
const ch2_stage7: Stage = {
  id: 'chapter2_stage7', name: '吕布', type: 'elite', chapterId: 'chapter2', order: 7,
  enemyFormation: {
    id: 'ef_ch2_s7', name: '飞将·吕布', recommendedPower: 1100,
    units: [
      { id: 'e_ch2_s7_1', name: '吕布', faction: 'qun', troopType: TroopType.CAVALRY, level: 16, attack: 96, defense: 48, intelligence: 20, speed: 32, maxHp: 800, position: 'front' },
      { id: 'e_ch2_s7_2', name: '并州铁骑', faction: 'qun', troopType: TroopType.CAVALRY, level: 15, attack: 74, defense: 34, intelligence: 14, speed: 30, maxHp: 440, position: 'front' },
      { id: 'e_ch2_s7_3', name: '吕布亲卫', faction: 'qun', troopType: TroopType.INFANTRY, level: 15, attack: 70, defense: 40, intelligence: 14, speed: 12, maxHp: 500, position: 'front' },
      { id: 'e_ch2_s7_4', name: '并州弓骑', faction: 'qun', troopType: TroopType.ARCHER, level: 15, attack: 76, defense: 20, intelligence: 24, speed: 26, maxHp: 280, position: 'back' },
      { id: 'e_ch2_s7_5', name: '并州谋士', faction: 'qun', troopType: TroopType.STRATEGIST, level: 15, attack: 72, defense: 18, intelligence: 34, speed: 18, maxHp: 260, position: 'back' },
    ],
  },
  baseRewards: { grain: 450, gold: 240, troops: 90, mandate: 12 }, baseExp: 200,
  firstClearRewards: { grain: 1100, gold: 560, troops: 200, mandate: 30 }, firstClearExp: 450,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 180, maxAmount: 320, probability: 0.9 },
    { type: 'resource', resourceType: 'gold', minAmount: 100, maxAmount: 180, probability: 0.8 },
    { type: 'fragment', generalId: 'caocao', minAmount: 1, maxAmount: 3, probability: 0.25 },
    { type: 'fragment', generalId: 'liubei', minAmount: 1, maxAmount: 2, probability: 0.2 },
    { type: 'resource', resourceType: 'mandate', minAmount: 3, maxAmount: 8, probability: 0.5 },
  ],
  recommendedPower: 1100, description: '天下第一猛将吕布，武艺超群，人中吕布马中赤兔。',
};

// ── 2-8【BOSS】董卓 ──
const ch2_stage8: Stage = {
  id: 'chapter2_stage8', name: '董卓', type: 'boss', chapterId: 'chapter2', order: 8,
  enemyFormation: {
    id: 'ef_ch2_s8', name: '暴虐太师·董卓', recommendedPower: 1300,
    units: [
      { id: 'e_ch2_s8_1', name: '董卓', faction: 'qun', troopType: TroopType.INFANTRY, level: 18, attack: 90, defense: 50, intelligence: 24, speed: 14, maxHp: 1000, position: 'front' },
      { id: 'e_ch2_s8_2', name: '李儒', faction: 'qun', troopType: TroopType.STRATEGIST, level: 17, attack: 80, defense: 20, intelligence: 42, speed: 18, maxHp: 400, position: 'back' },
      { id: 'e_ch2_s8_3', name: '董卓亲卫', faction: 'qun', troopType: TroopType.INFANTRY, level: 17, attack: 76, defense: 44, intelligence: 14, speed: 12, maxHp: 560, position: 'front' },
      { id: 'e_ch2_s8_4', name: '西凉铁骑', faction: 'qun', troopType: TroopType.CAVALRY, level: 17, attack: 80, defense: 36, intelligence: 16, speed: 30, maxHp: 480, position: 'front' },
      { id: 'e_ch2_s8_5', name: '董卓军术士', faction: 'qun', troopType: TroopType.STRATEGIST, level: 16, attack: 74, defense: 18, intelligence: 36, speed: 18, maxHp: 320, position: 'back' },
      { id: 'e_ch2_s8_6', name: '董卓军弓手', faction: 'qun', troopType: TroopType.ARCHER, level: 16, attack: 72, defense: 18, intelligence: 24, speed: 18, maxHp: 280, position: 'back' },
    ],
  },
  baseRewards: { grain: 600, gold: 320, troops: 120, mandate: 20 }, baseExp: 300,
  firstClearRewards: { grain: 1500, gold: 800, troops: 300, mandate: 50 }, firstClearExp: 700,
  threeStarBonusMultiplier: 2.0,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 300, maxAmount: 500, probability: 1.0 },
    { type: 'resource', resourceType: 'gold', minAmount: 160, maxAmount: 300, probability: 1.0 },
    { type: 'resource', resourceType: 'mandate', minAmount: 8, maxAmount: 20, probability: 0.8 },
    { type: 'fragment', generalId: 'caocao', minAmount: 2, maxAmount: 4, probability: 0.35 },
    { type: 'fragment', generalId: 'liubei', minAmount: 2, maxAmount: 3, probability: 0.3 },
    { type: 'fragment', generalId: 'guanyu', minAmount: 1, maxAmount: 3, probability: 0.3 },
  ],
  recommendedPower: 1300, description: '暴虐太师董卓，挟天子以令诸侯，恶贯满盈。',
};

/** 第2章全部关卡（按 order 排列） */
export const CHAPTER2_STAGES: Stage[] = [
  ch2_stage1, ch2_stage2, ch2_stage3, ch2_stage4,
  ch2_stage5, ch2_stage6, ch2_stage7, ch2_stage8,
];
