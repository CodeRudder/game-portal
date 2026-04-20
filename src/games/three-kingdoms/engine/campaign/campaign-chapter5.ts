/**
 * 关卡系统 — 第5章：取西川 关卡数据
 *
 * 包含第5章全部8个关卡的静态配置：
 *   5普通 + 2精英 + 1BOSS
 *
 * @module engine/campaign/campaign-chapter5
 */

import { TroopType } from '../battle/battle.types';
import type { Stage } from './campaign.types';

// ── 5-1 涪城之战 ──
const ch5_stage1: Stage = {
  id: 'chapter5_stage1',
  name: '涪城之战',
  type: 'normal',
  chapterId: 'chapter5',
  order: 1,
  enemyFormation: {
    id: 'ef_ch5_s1',
    name: '益州前军',
    recommendedPower: 2200,
    units: [
      { id: 'e_ch5_s1_1', name: '益州弓手', faction: 'shu', troopType: TroopType.ARCHER, level: 12, attack: 78, defense: 30, intelligence: 32, speed: 38, maxHp: 550, position: 'back' },
      { id: 'e_ch5_s1_2', name: '益州步兵', faction: 'shu', troopType: TroopType.INFANTRY, level: 12, attack: 62, defense: 52, intelligence: 18, speed: 26, maxHp: 750, position: 'front' },
      { id: 'e_ch5_s1_3', name: '益州骑兵', faction: 'shu', troopType: TroopType.CAVALRY, level: 12, attack: 72, defense: 42, intelligence: 22, speed: 48, maxHp: 650, position: 'front' },
    ],
  },
  baseRewards: { grain: 800, gold: 500 },
  baseExp: 320,
  firstClearRewards: { grain: 2000, gold: 1200 },
  firstClearExp: 800,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 350, maxAmount: 700, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 250, maxAmount: 500, probability: 0.7 },
  ],
  recommendedPower: 2200,
  description: '刘备入川，与刘璋军在涪城初次交锋。',
};

// ── 5-2 雒城之战 ──
const ch5_stage2: Stage = {
  id: 'chapter5_stage2',
  name: '雒城之战',
  type: 'normal',
  chapterId: 'chapter5',
  order: 2,
  enemyFormation: {
    id: 'ef_ch5_s2',
    name: '雒城守军',
    recommendedPower: 2400,
    units: [
      { id: 'e_ch5_s2_1', name: '张任', faction: 'shu', troopType: TroopType.SPEARMAN, level: 13, attack: 82, defense: 55, intelligence: 35, speed: 42, maxHp: 850, position: 'front' },
      { id: 'e_ch5_s2_2', name: '益州弓弩手', faction: 'shu', troopType: TroopType.ARCHER, level: 13, attack: 80, defense: 28, intelligence: 30, speed: 36, maxHp: 520, position: 'back' },
      { id: 'e_ch5_s2_3', name: '益州重步兵', faction: 'shu', troopType: TroopType.INFANTRY, level: 13, attack: 65, defense: 58, intelligence: 18, speed: 24, maxHp: 900, position: 'front' },
      { id: 'e_ch5_s2_4', name: '益州骑哨', faction: 'shu', troopType: TroopType.CAVALRY, level: 12, attack: 70, defense: 40, intelligence: 22, speed: 50, maxHp: 620, position: 'back' },
    ],
  },
  baseRewards: { grain: 850, gold: 550 },
  baseExp: 340,
  firstClearRewards: { grain: 2200, gold: 1400 },
  firstClearExp: 850,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 380, maxAmount: 750, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 280, maxAmount: 550, probability: 0.7 },
    { type: 'exp', minAmount: 100, maxAmount: 200, probability: 0.5 },
  ],
  recommendedPower: 2400,
  description: '雒城守将张任骁勇善战，庞统在此陨落。',
};

// ── 5-3 落凤坡 ──
const ch5_stage3: Stage = {
  id: 'chapter5_stage3',
  name: '落凤坡',
  type: 'normal',
  chapterId: 'chapter5',
  order: 3,
  enemyFormation: {
    id: 'ef_ch5_s3',
    name: '张任伏兵',
    recommendedPower: 2600,
    units: [
      { id: 'e_ch5_s3_1', name: '张任', faction: 'shu', troopType: TroopType.SPEARMAN, level: 14, attack: 88, defense: 58, intelligence: 38, speed: 45, maxHp: 950, position: 'front' },
      { id: 'e_ch5_s3_2', name: '益州精锐弓手', faction: 'shu', troopType: TroopType.ARCHER, level: 14, attack: 85, defense: 30, intelligence: 35, speed: 38, maxHp: 580, position: 'back' },
      { id: 'e_ch5_s3_3', name: '益州枪兵', faction: 'shu', troopType: TroopType.SPEARMAN, level: 13, attack: 75, defense: 50, intelligence: 20, speed: 32, maxHp: 780, position: 'front' },
      { id: 'e_ch5_s3_4', name: '益州枪兵', faction: 'shu', troopType: TroopType.SPEARMAN, level: 13, attack: 75, defense: 50, intelligence: 20, speed: 32, maxHp: 780, position: 'front' },
    ],
  },
  baseRewards: { grain: 900, gold: 580 },
  baseExp: 360,
  firstClearRewards: { grain: 2400, gold: 1500 },
  firstClearExp: 900,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'gold', minAmount: 300, maxAmount: 600, probability: 0.8 },
    { type: 'exp', minAmount: 110, maxAmount: 220, probability: 0.6 },
  ],
  recommendedPower: 2600,
  description: '张任设伏落凤坡，凤雏庞统中箭身亡。',
};

// ── 5-4 绵竹之战 ──
const ch5_stage4: Stage = {
  id: 'chapter5_stage4',
  name: '绵竹之战',
  type: 'normal',
  chapterId: 'chapter5',
  order: 4,
  enemyFormation: {
    id: 'ef_ch5_s4',
    name: '绵竹守军',
    recommendedPower: 2800,
    units: [
      { id: 'e_ch5_s4_1', name: '李严', faction: 'shu', troopType: TroopType.CAVALRY, level: 14, attack: 85, defense: 52, intelligence: 40, speed: 50, maxHp: 900, position: 'front' },
      { id: 'e_ch5_s4_2', name: '益州铁卫', faction: 'shu', troopType: TroopType.INFANTRY, level: 14, attack: 70, defense: 62, intelligence: 20, speed: 25, maxHp: 1000, position: 'front' },
      { id: 'e_ch5_s4_3', name: '益州术士', faction: 'shu', troopType: TroopType.STRATEGIST, level: 14, attack: 55, defense: 35, intelligence: 75, speed: 40, maxHp: 600, position: 'back' },
      { id: 'e_ch5_s4_4', name: '益州弩手', faction: 'shu', troopType: TroopType.ARCHER, level: 14, attack: 82, defense: 28, intelligence: 30, speed: 36, maxHp: 550, position: 'back' },
    ],
  },
  baseRewards: { grain: 950, gold: 620 },
  baseExp: 380,
  firstClearRewards: { grain: 2600, gold: 1600 },
  firstClearExp: 950,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 420, maxAmount: 850, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 320, maxAmount: 650, probability: 0.7 },
    { type: 'exp', minAmount: 120, maxAmount: 240, probability: 0.5 },
  ],
  recommendedPower: 2800,
  description: '绵竹关是成都的最后屏障，李严率军坚守。',
};

// ── 5-5 葭萌关 ──
const ch5_stage5: Stage = {
  id: 'chapter5_stage5',
  name: '葭萌关',
  type: 'normal',
  chapterId: 'chapter5',
  order: 5,
  enemyFormation: {
    id: 'ef_ch5_s5',
    name: '马超先锋',
    recommendedPower: 3000,
    units: [
      { id: 'e_ch5_s5_1', name: '马超', faction: 'qun', troopType: TroopType.CAVALRY, level: 15, attack: 98, defense: 55, intelligence: 35, speed: 65, maxHp: 1100, position: 'front' },
      { id: 'e_ch5_s5_2', name: '西凉铁骑', faction: 'qun', troopType: TroopType.CAVALRY, level: 14, attack: 80, defense: 48, intelligence: 20, speed: 55, maxHp: 850, position: 'front' },
      { id: 'e_ch5_s5_3', name: '西凉弓骑', faction: 'qun', troopType: TroopType.ARCHER, level: 14, attack: 78, defense: 30, intelligence: 28, speed: 50, maxHp: 600, position: 'back' },
      { id: 'e_ch5_s5_4', name: '西凉枪兵', faction: 'qun', troopType: TroopType.SPEARMAN, level: 14, attack: 75, defense: 50, intelligence: 18, speed: 35, maxHp: 800, position: 'front' },
    ],
  },
  baseRewards: { grain: 1000, gold: 650 },
  baseExp: 400,
  firstClearRewards: { grain: 2800, gold: 1800 },
  firstClearExp: 1000,
  threeStarBonusMultiplier: 1.5,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 450, maxAmount: 900, probability: 0.8 },
    { type: 'resource', resourceType: 'gold', minAmount: 350, maxAmount: 700, probability: 0.7 },
    { type: 'fragment', generalId: 'machao', minAmount: 1, maxAmount: 3, probability: 0.25 },
  ],
  recommendedPower: 3000,
  description: '马超率西凉铁骑来犯，张飞在葭萌关与之大战。',
};

// ── 5-6 金雁桥（精英） ──
const ch5_stage6: Stage = {
  id: 'chapter5_stage6',
  name: '金雁桥',
  type: 'elite',
  chapterId: 'chapter5',
  order: 6,
  enemyFormation: {
    id: 'ef_ch5_s6',
    name: '益州精锐',
    recommendedPower: 3200,
    units: [
      { id: 'e_ch5_s6_1', name: '吴懿', faction: 'shu', troopType: TroopType.CAVALRY, level: 15, attack: 88, defense: 55, intelligence: 38, speed: 52, maxHp: 1000, position: 'front' },
      { id: 'e_ch5_s6_2', name: '益州铁甲军', faction: 'shu', troopType: TroopType.INFANTRY, level: 15, attack: 75, defense: 65, intelligence: 22, speed: 24, maxHp: 1100, position: 'front' },
      { id: 'e_ch5_s6_3', name: '益州军师', faction: 'shu', troopType: TroopType.STRATEGIST, level: 15, attack: 58, defense: 38, intelligence: 82, speed: 42, maxHp: 650, position: 'back' },
      { id: 'e_ch5_s6_4', name: '益州神射手', faction: 'shu', troopType: TroopType.ARCHER, level: 15, attack: 88, defense: 32, intelligence: 35, speed: 40, maxHp: 580, position: 'back' },
      { id: 'e_ch5_s6_5', name: '益州重枪兵', faction: 'shu', troopType: TroopType.SPEARMAN, level: 15, attack: 80, defense: 55, intelligence: 20, speed: 32, maxHp: 900, position: 'front' },
    ],
  },
  baseRewards: { grain: 1200, gold: 800 },
  baseExp: 450,
  firstClearRewards: { grain: 3000, gold: 2000 },
  firstClearExp: 1100,
  threeStarBonusMultiplier: 1.8,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 550, maxAmount: 1100, probability: 0.9 },
    { type: 'resource', resourceType: 'gold', minAmount: 400, maxAmount: 800, probability: 0.8 },
    { type: 'fragment', generalId: 'weiyan', minAmount: 1, maxAmount: 3, probability: 0.3 },
  ],
  recommendedPower: 3200,
  description: '金雁桥上伏兵四起，益州精锐倾巢而出。',
};

// ── 5-7 成都外围（精英） ──
const ch5_stage7: Stage = {
  id: 'chapter5_stage7',
  name: '成都外围',
  type: 'elite',
  chapterId: 'chapter5',
  order: 7,
  enemyFormation: {
    id: 'ef_ch5_s7',
    name: '成都守备军',
    recommendedPower: 3500,
    units: [
      { id: 'e_ch5_s7_1', name: '刘璝', faction: 'shu', troopType: TroopType.INFANTRY, level: 16, attack: 82, defense: 62, intelligence: 30, speed: 30, maxHp: 1200, position: 'front' },
      { id: 'e_ch5_s7_2', name: '益州虎卫', faction: 'shu', troopType: TroopType.INFANTRY, level: 16, attack: 78, defense: 68, intelligence: 22, speed: 26, maxHp: 1300, position: 'front' },
      { id: 'e_ch5_s7_3', name: '益州参军', faction: 'shu', troopType: TroopType.STRATEGIST, level: 16, attack: 62, defense: 40, intelligence: 85, speed: 44, maxHp: 700, position: 'back' },
      { id: 'e_ch5_s7_4', name: '益州弩卫', faction: 'shu', troopType: TroopType.ARCHER, level: 16, attack: 90, defense: 35, intelligence: 38, speed: 42, maxHp: 620, position: 'back' },
      { id: 'e_ch5_s7_5', name: '益州骑将', faction: 'shu', troopType: TroopType.CAVALRY, level: 15, attack: 85, defense: 50, intelligence: 28, speed: 55, maxHp: 950, position: 'back' },
      { id: 'e_ch5_s7_6', name: '益州枪卫', faction: 'shu', troopType: TroopType.SPEARMAN, level: 16, attack: 82, defense: 58, intelligence: 20, speed: 34, maxHp: 1000, position: 'front' },
    ],
  },
  baseRewards: { grain: 1400, gold: 950 },
  baseExp: 500,
  firstClearRewards: { grain: 3500, gold: 2500 },
  firstClearExp: 1200,
  threeStarBonusMultiplier: 1.8,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 650, maxAmount: 1300, probability: 0.9 },
    { type: 'resource', resourceType: 'gold', minAmount: 480, maxAmount: 950, probability: 0.8 },
    { type: 'fragment', generalId: 'machao', minAmount: 1, maxAmount: 4, probability: 0.35 },
    { type: 'exp', minAmount: 150, maxAmount: 300, probability: 0.6 },
  ],
  recommendedPower: 3500,
  description: '成都城外最后的防线，攻破此关即可兵临城下。',
};

// ── 5-8 成都之战（BOSS） ──
const ch5_stage8: Stage = {
  id: 'chapter5_stage8',
  name: '成都之战',
  type: 'boss',
  chapterId: 'chapter5',
  order: 8,
  enemyFormation: {
    id: 'ef_ch5_s8',
    name: '刘璋亲卫',
    recommendedPower: 4000,
    units: [
      { id: 'e_ch5_s8_1', name: '刘璋', faction: 'shu', troopType: TroopType.STRATEGIST, level: 16, attack: 65, defense: 50, intelligence: 70, speed: 40, maxHp: 1300, position: 'back' },
      { id: 'e_ch5_s8_2', name: '严颜', faction: 'shu', troopType: TroopType.SPEARMAN, level: 17, attack: 92, defense: 65, intelligence: 40, speed: 38, maxHp: 1200, position: 'front' },
      { id: 'e_ch5_s8_3', name: '黄权', faction: 'shu', troopType: TroopType.STRATEGIST, level: 16, attack: 60, defense: 42, intelligence: 88, speed: 45, maxHp: 750, position: 'back' },
      { id: 'e_ch5_s8_4', name: '益州铁卫', faction: 'shu', troopType: TroopType.INFANTRY, level: 16, attack: 80, defense: 70, intelligence: 22, speed: 28, maxHp: 1400, position: 'front' },
      { id: 'e_ch5_s8_5', name: '益州铁卫', faction: 'shu', troopType: TroopType.INFANTRY, level: 16, attack: 80, defense: 70, intelligence: 22, speed: 28, maxHp: 1400, position: 'front' },
      { id: 'e_ch5_s8_6', name: '益州弩卫长', faction: 'shu', troopType: TroopType.ARCHER, level: 16, attack: 92, defense: 35, intelligence: 38, speed: 42, maxHp: 650, position: 'back' },
    ],
  },
  baseRewards: { grain: 1800, gold: 1200 },
  baseExp: 600,
  firstClearRewards: { grain: 6000, gold: 4000, troops: 800 },
  firstClearExp: 1800,
  threeStarBonusMultiplier: 2.0,
  dropTable: [
    { type: 'resource', resourceType: 'grain', minAmount: 900, maxAmount: 1800, probability: 1.0 },
    { type: 'resource', resourceType: 'gold', minAmount: 600, maxAmount: 1200, probability: 1.0 },
    { type: 'fragment', generalId: 'machao', minAmount: 2, maxAmount: 5, probability: 0.5 },
    { type: 'fragment', generalId: 'weiyan', minAmount: 1, maxAmount: 4, probability: 0.4 },
    { type: 'exp', minAmount: 200, maxAmount: 400, probability: 0.8 },
  ],
  recommendedPower: 4000,
  description: '兵临成都城下！刘璋开城投降，刘备终得益州。',
};

export const CHAPTER5_STAGES: Stage[] = [
  ch5_stage1, ch5_stage2, ch5_stage3, ch5_stage4,
  ch5_stage5, ch5_stage6, ch5_stage7, ch5_stage8,
];
