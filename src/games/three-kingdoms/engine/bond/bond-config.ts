/**
 * Bond system - config constants
 *
 * Extracted from BondSystem.ts.
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { Faction } from '../hero/hero.types';
import type { GeneralStats, GeneralData } from '../hero/hero.types';
import { FACTIONS } from '../hero/hero.types';
import type {
  BondType,
  BondEffect,
  StoryEventDef,
} from '../../core/bond';
import {
  BOND_NAMES,
  BOND_DESCRIPTIONS,
} from '../../core/bond';
// ─────────────────────────────────────────────
// 羁绊效果配置
// ─────────────────────────────────────────────

export const BOND_EFFECTS: Record<BondType, BondEffect> = {
  faction_2: {
    type: 'faction_2',
    name: BOND_NAMES.faction_2,
    description: BOND_DESCRIPTIONS.faction_2,
    bonuses: { attack: 0.05 },
    condition: '2名同阵营武将上阵',
    icon: '🤝',
  },
  faction_3: {
    type: 'faction_3',
    name: BOND_NAMES.faction_3,
    description: BOND_DESCRIPTIONS.faction_3,
    bonuses: { attack: 0.15 },
    condition: '3名同阵营武将上阵',
    icon: '⚔️',
  },
  faction_6: {
    type: 'faction_6',
    name: BOND_NAMES.faction_6,
    description: BOND_DESCRIPTIONS.faction_6,
    bonuses: { attack: 0.25, defense: 0.15 },
    condition: '6名同阵营武将上阵',
    icon: '🏰',
  },
  mixed_3_3: {
    type: 'mixed_3_3',
    name: BOND_NAMES.mixed_3_3,
    description: BOND_DESCRIPTIONS.mixed_3_3,
    bonuses: { attack: 0.10, intelligence: 0.05 },
    condition: '3+3名不同阵营武将上阵',
    icon: '🌟',
  },
};

// ─────────────────────────────────────────────
// 故事事件配置
// ─────────────────────────────────────────────

/** 预定义的武将故事事件 */
export const STORY_EVENTS: StoryEventDef[] = [
  {
    id: 'story_001',
    title: '桃园结义',
    description: '刘备、关羽、张飞三人于桃园中义结金兰，誓同生死，共图大业。',
    category: 'friendship',
    condition: { eventId: 'story_001', heroIds: ['liubei', 'guanyu', 'zhangfei'], minFavorability: 50, minLevel: 5 },
    rewards: { favorability: 20, fragments: { liubei: 3, guanyu: 3, zhangfei: 3 }, prestigePoints: 100 },
    repeatable: false,
  },
  {
    id: 'story_002',
    title: '三顾茅庐',
    description: '刘备三次亲赴隆中拜访诸葛亮，终于感动卧龙出山相助。',
    category: 'mentor',
    condition: { eventId: 'story_002', heroIds: ['liubei', 'zhugeliang'], minFavorability: 60, minLevel: 10 },
    rewards: { favorability: 30, fragments: { zhugeliang: 5 }, prestigePoints: 200 },
    repeatable: false,
  },
  {
    id: 'story_003',
    title: '赤壁之战',
    description: '周瑜与诸葛亮联手，以火攻大破曹操百万大军于赤壁。',
    category: 'historical',
    condition: { eventId: 'story_003', heroIds: ['zhouyu', 'zhugeliang', 'caocao'], minFavorability: 70, minLevel: 15 },
    rewards: { favorability: 40, fragments: { zhouyu: 5, zhugeliang: 5 }, prestigePoints: 300 },
    repeatable: false,
  },
  {
    id: 'story_004',
    title: '过五关斩六将',
    description: '关羽护送嫂嫂千里走单骑，过五关斩六将，忠义无双。',
    category: 'historical',
    condition: { eventId: 'story_004', heroIds: ['guanyu'], minFavorability: 80, minLevel: 20 },
    rewards: { favorability: 25, fragments: { guanyu: 8 }, prestigePoints: 250 },
    repeatable: false,
  },
  {
    id: 'story_005',
    title: '草船借箭',
    description: '诸葛亮以草船向曹操借箭十万，智谋超群。',
    category: 'mentor',
    condition: { eventId: 'story_005', heroIds: ['zhugeliang', 'caocao'], minFavorability: 55, minLevel: 12 },
    rewards: { favorability: 20, fragments: { zhugeliang: 4 }, prestigePoints: 150 },
    repeatable: false,
  },
];
