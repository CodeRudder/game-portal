/**
 * 羁绊域 — 配置常量
 *
 * 7种羁绊定义（4种阵营羁绊 + 扩展）
 *
 * @module core/heritage/bond-config
 */

import type { BondDefinition } from './bond.types';

/** 阵营羁绊定义列表 */
export const BOND_DEFINITIONS: BondDefinition[] = [
  {
    id: 'fellowship',
    name: '同乡之谊',
    description: '2名同阵营武将出战，攻击+5%',
    icon: '🤝',
    tier: 'minor',
    condition: { type: 'same_faction', minSameFaction: 2 },
    bonuses: { attack: 0.05 },
  },
  {
    id: 'solidarity',
    name: '同仇敌忾',
    description: '3名同阵营武将出战，攻击+15%',
    icon: '⚔️',
    tier: 'major',
    condition: { type: 'same_faction', minSameFaction: 3 },
    bonuses: { attack: 0.15 },
  },
  {
    id: 'unity',
    name: '众志成城',
    description: '6名同阵营武将出战，攻击+25%+防御+15%',
    icon: '🏰',
    tier: 'ultimate',
    condition: { type: 'same_faction', minSameFaction: 6 },
    bonuses: { attack: 0.25, defense: 0.15 },
  },
  {
    id: 'diversity',
    name: '混搭协作',
    description: '2组各3名不同阵营武将出战，攻击+10%+特效加成',
    icon: '🌈',
    tier: 'major',
    condition: {
      type: 'mixed_factions',
      factionGroups: [
        { faction: 'shu', minCount: 3 },
        { faction: 'wei', minCount: 3 },
      ],
    },
    bonuses: { attack: 0.10, specialEffect: '全技能伤害+5%' },
  },
];

/** 羁绊快速查找 Map */
export const BOND_MAP = new Map(BOND_DEFINITIONS.map(b => [b.id, b]));
