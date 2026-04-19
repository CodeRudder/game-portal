/**
 * 关卡系统 — 第3章：群雄割据 关卡数据
 *
 * 包含第3章全部8个关卡的静态配置：
 *   5普通 + 2精英 + 1BOSS
 *
 * @module engine/campaign/campaign-chapter3
 */

import { TroopType } from '../battle/battle.types';
import type { Stage } from './campaign.types';

const ch3_stage1: Stage = {
  id: 'chapter3_stage1', name: '冀州边境', type: 'normal', chapterId: 'chapter3', order: 1,
  enemyFormation: {
    id: 'ef_ch3_s1', name: '袁绍军先锋', recommendedPower: 1200,
    units: [
      { id: 'e_ch3_s1_1', name: '袁绍军斥候', faction: 'qun', troopType: TroopType.CAVALRY, level: 14, attack: 68, defense: 30, intelligence: 16, speed: 28, maxHp: 340, position: 'front' },
      { id: 'e_ch3_s1_2', name: '袁绍军弓手', faction: 'qun', troopType: TroopType.ARCHER, level: 14, attack: 72, defense: 18, intelligence: 24, speed: 16, maxHp: 230, position: 'back' },
      { id: 'e_ch3_s1_3', name: '冀州步兵', faction: 'qun', troopType: TroopType.INFANTRY, level: 14, attack: 64, defense: 36, intelligence: 14, speed: 11, maxHp: 420, position: 'front' },
    ],
  },
  baseRewards: { grain: 350, gold: 190, troops: 60 }, baseExp: 140,
  firstClearRewards: { grain: 800, gold: 420, troops: 130 }, firstClearExp: 300,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 130, maxAmount: 240, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 70, maxAmount: 130, probability: 0.7 },
  ],
  recommendedPower: 1200, description: '冀州袁绍势力的边境哨所，各路诸侯开始争霸。',
};

const ch3_stage2: Stage = {
  id: 'chapter3_stage2', name: '邺城外郊', type: 'normal', chapterId: 'chapter3', order: 2,
  enemyFormation: {
    id: 'ef_ch3_s2', name: '邺城外围守军', recommendedPower: 1350,
    units: [
      { id: 'e_ch3_s2_1', name: '袁绍军校尉', faction: 'qun', troopType: TroopType.INFANTRY, level: 15, attack: 74, defense: 38, intelligence: 18, speed: 12, maxHp: 480, position: 'front' },
      { id: 'e_ch3_s2_2', name: '袁绍军弩手', faction: 'qun', troopType: TroopType.ARCHER, level: 15, attack: 76, defense: 20, intelligence: 26, speed: 16, maxHp: 250, position: 'back' },
      { id: 'e_ch3_s2_3', name: '冀州枪兵', faction: 'qun', troopType: TroopType.SPEARMAN, level: 15, attack: 70, defense: 36, intelligence: 16, speed: 11, maxHp: 460, position: 'front' },
      { id: 'e_ch3_s2_4', name: '冀州骑兵', faction: 'qun', troopType: TroopType.CAVALRY, level: 15, attack: 72, defense: 28, intelligence: 16, speed: 28, maxHp: 340, position: 'back' },
    ],
  },
  baseRewards: { grain: 380, gold: 210, troops: 70 }, baseExp: 155,
  firstClearRewards: { grain: 880, gold: 460, troops: 150 }, firstClearExp: 320,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 140, maxAmount: 260, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 75, maxAmount: 140, probability: 0.7 },
    { type: 'fragment', generalId: 'caocao', minAmount: 1, maxAmount: 1, probability: 0.1 },
  ],
  recommendedPower: 1350, description: '邺城外围防线，袁绍军严阵以待。',
};

const ch3_stage3: Stage = {
  id: 'chapter3_stage3', name: '官渡前线', type: 'normal', chapterId: 'chapter3', order: 3,
  enemyFormation: {
    id: 'ef_ch3_s3', name: '官渡前线守军', recommendedPower: 1500,
    units: [
      { id: 'e_ch3_s3_1', name: '袁绍军骁将', faction: 'qun', troopType: TroopType.CAVALRY, level: 16, attack: 80, defense: 34, intelligence: 18, speed: 30, maxHp: 400, position: 'front' },
      { id: 'e_ch3_s3_2', name: '袁绍军谋士', faction: 'qun', troopType: TroopType.STRATEGIST, level: 16, attack: 82, defense: 20, intelligence: 36, speed: 18, maxHp: 280, position: 'back' },
      { id: 'e_ch3_s3_3', name: '冀州精锐步兵', faction: 'qun', troopType: TroopType.INFANTRY, level: 16, attack: 76, defense: 40, intelligence: 16, speed: 12, maxHp: 520, position: 'front' },
    ],
  },
  baseRewards: { grain: 420, gold: 230, troops: 80 }, baseExp: 170,
  firstClearRewards: { grain: 960, gold: 500, troops: 170 }, firstClearExp: 340,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 160, maxAmount: 280, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 80, maxAmount: 150, probability: 0.7 },
    { type: 'resource', resourceType: 'troops', minAmount: 25, maxAmount: 60, probability: 0.5 },
  ],
  recommendedPower: 1500, description: '官渡之战前线，两军对峙，一触即发。',
};

const ch3_stage4: Stage = {
  id: 'chapter3_stage4', name: '乌巢粮仓', type: 'normal', chapterId: 'chapter3', order: 4,
  enemyFormation: {
    id: 'ef_ch3_s4', name: '乌巢守军', recommendedPower: 1650,
    units: [
      { id: 'e_ch3_s4_1', name: '淳于琼', faction: 'qun', troopType: TroopType.INFANTRY, level: 17, attack: 82, defense: 42, intelligence: 16, speed: 12, maxHp: 560, position: 'front' },
      { id: 'e_ch3_s4_2', name: '袁绍军守卫', faction: 'qun', troopType: TroopType.INFANTRY, level: 17, attack: 78, defense: 40, intelligence: 14, speed: 11, maxHp: 520, position: 'front' },
      { id: 'e_ch3_s4_3', name: '袁绍军弓手', faction: 'qun', troopType: TroopType.ARCHER, level: 17, attack: 80, defense: 20, intelligence: 26, speed: 16, maxHp: 260, position: 'back' },
      { id: 'e_ch3_s4_4', name: '袁绍军斥候', faction: 'qun', troopType: TroopType.CAVALRY, level: 16, attack: 76, defense: 30, intelligence: 18, speed: 30, maxHp: 360, position: 'back' },
    ],
  },
  baseRewards: { grain: 500, gold: 260, troops: 90 }, baseExp: 185,
  firstClearRewards: { grain: 1200, gold: 600, troops: 200 }, firstClearExp: 380,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 200, maxAmount: 350, probability: 0.9 },
    { type: 'resource', resourceType: 'gold', minAmount: 90, maxAmount: 170, probability: 0.7 },
    { type: 'fragment', generalId: 'guanyu', minAmount: 1, maxAmount: 2, probability: 0.15 },
  ],
  recommendedPower: 1650, description: '袁绍军屯粮重地乌巢，火烧乌巢可扭转战局。',
};

const ch3_stage5: Stage = {
  id: 'chapter3_stage5', name: '官渡决战', type: 'normal', chapterId: 'chapter3', order: 5,
  enemyFormation: {
    id: 'ef_ch3_s5', name: '袁绍主力军', recommendedPower: 1800,
    units: [
      { id: 'e_ch3_s5_1', name: '袁绍军大将', faction: 'qun', troopType: TroopType.CAVALRY, level: 18, attack: 88, defense: 40, intelligence: 20, speed: 30, maxHp: 500, position: 'front' },
      { id: 'e_ch3_s5_2', name: '袁绍军精骑', faction: 'qun', troopType: TroopType.CAVALRY, level: 18, attack: 84, defense: 36, intelligence: 18, speed: 32, maxHp: 460, position: 'front' },
      { id: 'e_ch3_s5_3', name: '袁绍军谋士', faction: 'qun', troopType: TroopType.STRATEGIST, level: 18, attack: 86, defense: 22, intelligence: 40, speed: 18, maxHp: 300, position: 'back' },
    ],
  },
  baseRewards: { grain: 480, gold: 260, troops: 100, mandate: 10 }, baseExp: 200,
  firstClearRewards: { grain: 1100, gold: 580, troops: 220, mandate: 25 }, firstClearExp: 400,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 180, maxAmount: 320, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 90, maxAmount: 170, probability: 0.7 },
    { type: 'resource', resourceType: 'troops', minAmount: 30, maxAmount: 70, probability: 0.5 },
  ],
  recommendedPower: 1800, description: '官渡决战，两军主力正面交锋，决定北方霸权。',
};

// ── 3-6【精英】颜良文丑 ──
const ch3_stage6: Stage = {
  id: 'chapter3_stage6', name: '颜良文丑', type: 'elite', chapterId: 'chapter3', order: 6,
  enemyFormation: {
    id: 'ef_ch3_s6', name: '河北双雄·颜良文丑', recommendedPower: 2000,
    units: [
      { id: 'e_ch3_s6_1', name: '颜良', faction: 'qun', troopType: TroopType.CAVALRY, level: 20, attack: 100, defense: 48, intelligence: 18, speed: 32, maxHp: 700, position: 'front' },
      { id: 'e_ch3_s6_2', name: '文丑', faction: 'qun', troopType: TroopType.INFANTRY, level: 20, attack: 96, defense: 50, intelligence: 16, speed: 14, maxHp: 750, position: 'front' },
      { id: 'e_ch3_s6_3', name: '袁绍精锐骑兵', faction: 'qun', troopType: TroopType.CAVALRY, level: 19, attack: 88, defense: 38, intelligence: 18, speed: 32, maxHp: 500, position: 'front' },
      { id: 'e_ch3_s6_4', name: '袁绍军弓手', faction: 'qun', troopType: TroopType.ARCHER, level: 19, attack: 86, defense: 22, intelligence: 28, speed: 18, maxHp: 300, position: 'back' },
      { id: 'e_ch3_s6_5', name: '袁绍军术士', faction: 'qun', troopType: TroopType.STRATEGIST, level: 19, attack: 84, defense: 20, intelligence: 38, speed: 20, maxHp: 280, position: 'back' },
    ],
  },
  baseRewards: { grain: 560, gold: 300, troops: 110, mandate: 15 }, baseExp: 240,
  firstClearRewards: { grain: 1300, gold: 700, troops: 260, mandate: 35 }, firstClearExp: 500,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 220, maxAmount: 400, probability: 0.9 },
    { type: 'resource', resourceType: 'gold', minAmount: 120, maxAmount: 220, probability: 0.8 },
    { type: 'fragment', generalId: 'guanyu', minAmount: 2, maxAmount: 3, probability: 0.3 },
    { type: 'fragment', generalId: 'zhangfei', minAmount: 1, maxAmount: 3, probability: 0.25 },
    { type: 'resource', resourceType: 'mandate', minAmount: 3, maxAmount: 8, probability: 0.5 },
  ],
  recommendedPower: 2000, description: '河北名将颜良文丑，勇冠三军，双雄联手威力倍增。',
};

// ── 3-7【精英】袁绍亲卫 ──
const ch3_stage7: Stage = {
  id: 'chapter3_stage7', name: '袁绍亲卫', type: 'elite', chapterId: 'chapter3', order: 7,
  enemyFormation: {
    id: 'ef_ch3_s7', name: '袁绍亲卫精锐', recommendedPower: 2200,
    units: [
      { id: 'e_ch3_s7_1', name: '袁绍亲卫统领', faction: 'qun', troopType: TroopType.INFANTRY, level: 22, attack: 106, defense: 54, intelligence: 22, speed: 14, maxHp: 800, position: 'front' },
      { id: 'e_ch3_s7_2', name: '袁绍亲卫', faction: 'qun', troopType: TroopType.SPEARMAN, level: 21, attack: 98, defense: 50, intelligence: 18, speed: 12, maxHp: 700, position: 'front' },
      { id: 'e_ch3_s7_3', name: '袁绍亲卫骑兵', faction: 'qun', troopType: TroopType.CAVALRY, level: 21, attack: 96, defense: 42, intelligence: 20, speed: 34, maxHp: 560, position: 'front' },
      { id: 'e_ch3_s7_4', name: '袁绍军谋士', faction: 'qun', troopType: TroopType.STRATEGIST, level: 21, attack: 92, defense: 24, intelligence: 44, speed: 20, maxHp: 340, position: 'back' },
      { id: 'e_ch3_s7_5', name: '袁绍军弩手', faction: 'qun', troopType: TroopType.ARCHER, level: 21, attack: 94, defense: 24, intelligence: 30, speed: 18, maxHp: 320, position: 'back' },
    ],
  },
  baseRewards: { grain: 620, gold: 340, troops: 130, mandate: 18 }, baseExp: 270,
  firstClearRewards: { grain: 1400, gold: 760, troops: 300, mandate: 40 }, firstClearExp: 560,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 240, maxAmount: 440, probability: 0.9 },
    { type: 'resource', resourceType: 'gold', minAmount: 130, maxAmount: 240, probability: 0.8 },
    { type: 'fragment', generalId: 'caocao', minAmount: 2, maxAmount: 4, probability: 0.3 },
    { type: 'fragment', generalId: 'liubei', minAmount: 1, maxAmount: 3, probability: 0.25 },
    { type: 'resource', resourceType: 'mandate', minAmount: 4, maxAmount: 10, probability: 0.5 },
  ],
  recommendedPower: 2200, description: '袁绍的贴身亲卫，精锐中的精锐，守卫邺城最后防线。',
};

// ── 3-8【BOSS】袁绍 ──
const ch3_stage8: Stage = {
  id: 'chapter3_stage8', name: '袁绍', type: 'boss', chapterId: 'chapter3', order: 8,
  enemyFormation: {
    id: 'ef_ch3_s8', name: '四世三公·袁绍', recommendedPower: 2500,
    units: [
      { id: 'e_ch3_s8_1', name: '袁绍', faction: 'qun', troopType: TroopType.CAVALRY, level: 24, attack: 110, defense: 52, intelligence: 30, speed: 28, maxHp: 1200, position: 'front' },
      { id: 'e_ch3_s8_2', name: '田丰', faction: 'qun', troopType: TroopType.STRATEGIST, level: 23, attack: 96, defense: 24, intelligence: 48, speed: 20, maxHp: 440, position: 'back' },
      { id: 'e_ch3_s8_3', name: '袁绍亲卫统领', faction: 'qun', troopType: TroopType.INFANTRY, level: 23, attack: 104, defense: 54, intelligence: 22, speed: 14, maxHp: 700, position: 'front' },
      { id: 'e_ch3_s8_4', name: '袁绍精锐骑兵', faction: 'qun', troopType: TroopType.CAVALRY, level: 23, attack: 100, defense: 44, intelligence: 22, speed: 34, maxHp: 600, position: 'front' },
      { id: 'e_ch3_s8_5', name: '袁绍军谋士', faction: 'qun', troopType: TroopType.STRATEGIST, level: 22, attack: 94, defense: 24, intelligence: 44, speed: 20, maxHp: 380, position: 'back' },
      { id: 'e_ch3_s8_6', name: '袁绍军弓手', faction: 'qun', troopType: TroopType.ARCHER, level: 22, attack: 92, defense: 24, intelligence: 30, speed: 20, maxHp: 340, position: 'back' },
    ],
  },
  baseRewards: { grain: 800, gold: 420, troops: 160, mandate: 25 }, baseExp: 350,
  firstClearRewards: { grain: 2000, gold: 1000, troops: 400, mandate: 60 }, firstClearExp: 800,
  threeStarBonusMultiplier: 2.0,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 400, maxAmount: 650, probability: 1.0 },
    { type: 'resource', resourceType: 'gold', minAmount: 200, maxAmount: 380, probability: 1.0 },
    { type: 'resource', resourceType: 'mandate', minAmount: 10, maxAmount: 25, probability: 0.8 },
    { type: 'fragment', generalId: 'caocao', minAmount: 3, maxAmount: 5, probability: 0.4 },
    { type: 'fragment', generalId: 'liubei', minAmount: 2, maxAmount: 4, probability: 0.35 },
    { type: 'fragment', generalId: 'guanyu', minAmount: 2, maxAmount: 4, probability: 0.35 },
    { type: 'fragment', generalId: 'zhangfei', minAmount: 2, maxAmount: 4, probability: 0.35 },
  ],
  recommendedPower: 2500, description: '四世三公袁绍，坐拥河北之地，兵多将广，不可轻敌。',
};

/** 第3章全部关卡（按 order 排列） */
export const CHAPTER3_STAGES: Stage[] = [
  ch3_stage1, ch3_stage2, ch3_stage3, ch3_stage4,
  ch3_stage5, ch3_stage6, ch3_stage7, ch3_stage8,
];
