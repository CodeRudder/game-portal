/**
 * 关卡系统 — 第3章：官渡之战 关卡数据
 *
 * 包含第3章全部5个关卡的静态配置：
 *   3普通 + 1精英 + 1BOSS
 *
 * 关卡与碎片映射（Play v3.0 §4.3a）：
 *   3-1 颜良    → 曹操碎片（紫）
 *   3-2 文丑    → 曹操碎片（紫）、颜良碎片（蓝）
 *   3-3 张郃    → 诸葛亮碎片（橙）
 *   3-4 高览    → 诸葛亮碎片（橙）、张郃碎片（蓝）
 *   3-5 袁绍    → 曹操碎片（紫）、袁绍碎片（紫）
 *
 * @module engine/campaign/campaign-chapter3
 */

import { TroopType } from '../battle/battle.types';
import type { Stage } from './campaign.types';

const ch3_stage1: Stage = {
  id: 'chapter3_stage1', name: '颜良', type: 'normal', chapterId: 'chapter3', order: 1,
  enemyFormation: {
    id: 'ef_ch3_s1', name: '袁绍军先锋', recommendedPower: 1200,
    units: [
      { id: 'e_ch3_s1_1', name: '颜良', faction: 'qun', troopType: TroopType.CAVALRY, level: 12, attack: 68, defense: 30, intelligence: 16, speed: 28, maxHp: 340, position: 'front' },
      { id: 'e_ch3_s1_2', name: '袁绍军弓手', faction: 'qun', troopType: TroopType.ARCHER, level: 12, attack: 72, defense: 18, intelligence: 24, speed: 16, maxHp: 230, position: 'back' },
      { id: 'e_ch3_s1_3', name: '冀州步兵', faction: 'qun', troopType: TroopType.INFANTRY, level: 12, attack: 64, defense: 36, intelligence: 14, speed: 11, maxHp: 420, position: 'front' },
    ],
  },
  baseRewards: { grain: 300, gold: 160, troops: 50 }, baseExp: 250,
  firstClearRewards: { grain: 750, gold: 400, troops: 120, recruitToken: 10 }, firstClearExp: 750, // R5: 大关卡首通奖励 +10 求贤令
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 120, maxAmount: 220, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 60, maxAmount: 120, probability: 0.7 },
    { type: 'fragment', generalId: 'caocao', minAmount: 1, maxAmount: 1, probability: 0.1 },
  ],
  recommendedPower: 1200, description: '冀州袁绍势力的先锋大将颜良，勇冠三军。',
};

const ch3_stage2: Stage = {
  id: 'chapter3_stage2', name: '文丑', type: 'normal', chapterId: 'chapter3', order: 2,
  enemyFormation: {
    id: 'ef_ch3_s2', name: '邺城外围守军', recommendedPower: 1600,
    units: [
      { id: 'e_ch3_s2_1', name: '文丑', faction: 'qun', troopType: TroopType.INFANTRY, level: 14, attack: 78, defense: 40, intelligence: 18, speed: 14, maxHp: 520, position: 'front' },
      { id: 'e_ch3_s2_2', name: '袁绍军弩手', faction: 'qun', troopType: TroopType.ARCHER, level: 14, attack: 80, defense: 20, intelligence: 28, speed: 16, maxHp: 260, position: 'back' },
      { id: 'e_ch3_s2_3', name: '冀州枪兵', faction: 'qun', troopType: TroopType.SPEARMAN, level: 14, attack: 74, defense: 38, intelligence: 16, speed: 11, maxHp: 480, position: 'front' },
      { id: 'e_ch3_s2_4', name: '冀州骑兵', faction: 'qun', troopType: TroopType.CAVALRY, level: 14, attack: 76, defense: 28, intelligence: 16, speed: 28, maxHp: 360, position: 'back' },
    ],
  },
  baseRewards: { grain: 350, gold: 190, troops: 60 }, baseExp: 250,
  firstClearRewards: { grain: 880, gold: 470, troops: 150 }, firstClearExp: 750,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 140, maxAmount: 260, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 70, maxAmount: 140, probability: 0.7 },
    { type: 'fragment', generalId: 'caocao', minAmount: 1, maxAmount: 1, probability: 0.1 },
    { type: 'fragment', generalId: 'yanliang', minAmount: 1, maxAmount: 1, probability: 0.1 },
  ],
  recommendedPower: 1600, description: '河北名将文丑，与颜良齐名，袁绍军中猛将。',
};

const ch3_stage3: Stage = {
  id: 'chapter3_stage3', name: '张郃', type: 'normal', chapterId: 'chapter3', order: 3,
  enemyFormation: {
    id: 'ef_ch3_s3', name: '官渡前线守军', recommendedPower: 2000,
    units: [
      { id: 'e_ch3_s3_1', name: '张郃', faction: 'qun', troopType: TroopType.CAVALRY, level: 16, attack: 86, defense: 38, intelligence: 22, speed: 32, maxHp: 440, position: 'front' },
      { id: 'e_ch3_s3_2', name: '袁绍军谋士', faction: 'qun', troopType: TroopType.STRATEGIST, level: 16, attack: 82, defense: 20, intelligence: 36, speed: 18, maxHp: 280, position: 'back' },
      { id: 'e_ch3_s3_3', name: '冀州精锐步兵', faction: 'qun', troopType: TroopType.INFANTRY, level: 16, attack: 76, defense: 40, intelligence: 16, speed: 12, maxHp: 520, position: 'front' },
    ],
  },
  baseRewards: { grain: 400, gold: 220, troops: 70 }, baseExp: 250,
  firstClearRewards: { grain: 1000, gold: 550, troops: 170 }, firstClearExp: 750,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 160, maxAmount: 300, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 80, maxAmount: 160, probability: 0.7 },
    { type: 'fragment', generalId: 'zhugeliang', minAmount: 1, maxAmount: 1, probability: 0.1 },
  ],
  recommendedPower: 2000, description: '官渡之战前线，两军对峙，一触即发。',
};

const ch3_stage4: Stage = {
  id: 'chapter3_stage4', name: '高览', type: 'elite', chapterId: 'chapter3', order: 4,
  enemyFormation: {
    id: 'ef_ch3_s4', name: '袁绍亲卫精锐', recommendedPower: 2200,
    units: [
      { id: 'e_ch3_s4_1', name: '高览', faction: 'qun', troopType: TroopType.INFANTRY, level: 18, attack: 96, defense: 48, intelligence: 20, speed: 14, maxHp: 700, position: 'front' },
      { id: 'e_ch3_s4_2', name: '袁绍亲卫', faction: 'qun', troopType: TroopType.SPEARMAN, level: 17, attack: 88, defense: 44, intelligence: 16, speed: 12, maxHp: 620, position: 'front' },
      { id: 'e_ch3_s4_3', name: '袁绍亲卫骑兵', faction: 'qun', troopType: TroopType.CAVALRY, level: 17, attack: 86, defense: 38, intelligence: 18, speed: 32, maxHp: 500, position: 'front' },
      { id: 'e_ch3_s4_4', name: '袁绍军谋士', faction: 'qun', troopType: TroopType.STRATEGIST, level: 17, attack: 82, defense: 22, intelligence: 40, speed: 18, maxHp: 300, position: 'back' },
      { id: 'e_ch3_s4_5', name: '袁绍军弩手', faction: 'qun', troopType: TroopType.ARCHER, level: 17, attack: 84, defense: 22, intelligence: 28, speed: 16, maxHp: 280, position: 'back' },
    ],
  },
  baseRewards: { grain: 500, gold: 280, troops: 100, mandate: 12 }, baseExp: 250,
  firstClearRewards: { grain: 1300, gold: 700, troops: 240, mandate: 30 }, firstClearExp: 750,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 200, maxAmount: 380, probability: 0.9 },
    { type: 'resource', resourceType: 'gold', minAmount: 110, maxAmount: 220, probability: 0.8 },
    { type: 'fragment', generalId: 'zhugeliang', minAmount: 1, maxAmount: 1, probability: 0.1 },
    { type: 'fragment', generalId: 'zhanghe', minAmount: 1, maxAmount: 1, probability: 0.1 },
  ],
  recommendedPower: 2200, description: '袁绍麾下猛将高览，守卫官渡最后防线。',
};

// ── 3-5 袁绍（BOSS） ──
const ch3_stage5: Stage = {
  id: 'chapter3_stage5', name: '袁绍', type: 'boss', chapterId: 'chapter3', order: 5,
  enemyFormation: {
    id: 'ef_ch3_s5', name: '四世三公·袁绍', recommendedPower: 2500,
    units: [
      { id: 'e_ch3_s5_1', name: '袁绍', faction: 'qun', troopType: TroopType.CAVALRY, level: 20, attack: 100, defense: 48, intelligence: 28, speed: 26, maxHp: 1100, position: 'front' },
      { id: 'e_ch3_s5_2', name: '田丰', faction: 'qun', troopType: TroopType.STRATEGIST, level: 19, attack: 88, defense: 22, intelligence: 44, speed: 18, maxHp: 400, position: 'back' },
      { id: 'e_ch3_s5_3', name: '袁绍亲卫统领', faction: 'qun', troopType: TroopType.INFANTRY, level: 19, attack: 96, defense: 50, intelligence: 20, speed: 13, maxHp: 640, position: 'front' },
      { id: 'e_ch3_s5_4', name: '袁绍精锐骑兵', faction: 'qun', troopType: TroopType.CAVALRY, level: 19, attack: 92, defense: 40, intelligence: 20, speed: 32, maxHp: 540, position: 'front' },
      { id: 'e_ch3_s5_5', name: '袁绍军谋士', faction: 'qun', troopType: TroopType.STRATEGIST, level: 18, attack: 86, defense: 22, intelligence: 40, speed: 18, maxHp: 340, position: 'back' },
      { id: 'e_ch3_s5_6', name: '袁绍军弓手', faction: 'qun', troopType: TroopType.ARCHER, level: 18, attack: 84, defense: 22, intelligence: 28, speed: 18, maxHp: 300, position: 'back' },
    ],
  },
  baseRewards: { grain: 700, gold: 380, troops: 140, mandate: 20 }, baseExp: 250,
  firstClearRewards: { grain: 1800, gold: 950, troops: 350, mandate: 50 }, firstClearExp: 750,
  threeStarBonusMultiplier: 2.0,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 350, maxAmount: 600, probability: 1.0 },
    { type: 'resource', resourceType: 'gold', minAmount: 180, maxAmount: 350, probability: 1.0 },
    { type: 'resource', resourceType: 'mandate', minAmount: 8, maxAmount: 20, probability: 0.8 },
    { type: 'fragment', generalId: 'caocao', minAmount: 1, maxAmount: 2, probability: 0.1 },
    { type: 'fragment', generalId: 'yuanshao', minAmount: 1, maxAmount: 2, probability: 0.1 },
  ],
  recommendedPower: 2500, description: '四世三公袁绍，坐拥河北之地，兵多将广，不可轻敌。',
};

/** 第3章全部关卡（按 order 排列） */
export const CHAPTER3_STAGES: Stage[] = [
  ch3_stage1, ch3_stage2, ch3_stage3, ch3_stage4,
  ch3_stage5,
];
