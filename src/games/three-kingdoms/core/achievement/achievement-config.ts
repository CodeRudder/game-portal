/**
 * 核心层 — 成就系统配置常量
 *
 * 包含5维度成就定义、转生成就链等配置。
 * 所有配置为只读常量，运行时不可修改。
 *
 * @module core/achievement/achievement-config
 */

import type {
  AchievementDef,
  RebirthAchievementChain,
} from './achievement.types';

// ─────────────────────────────────────────────
// 1. 战斗维度成就
// ─────────────────────────────────────────────

const BATTLE_ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'ach-battle-001', name: '初出茅庐', description: '累计战斗胜利10次',
    dimension: 'battle', rarity: 'common',
    conditions: [{ type: 'battle_wins', targetValue: 10 }],
    rewards: { achievementPoints: 10, resources: { gold: 100 } },
    hidden: false, sortOrder: 1,
  },
  {
    id: 'ach-battle-002', name: '百战之师', description: '累计战斗胜利100次',
    dimension: 'battle', rarity: 'rare',
    conditions: [{ type: 'battle_wins', targetValue: 100 }],
    rewards: { achievementPoints: 30, resources: { gold: 500 } },
    prerequisiteId: 'ach-battle-001', hidden: false, sortOrder: 2,
  },
  {
    id: 'ach-battle-003', name: '常胜将军', description: '累计战斗胜利500次',
    dimension: 'battle', rarity: 'epic',
    conditions: [{ type: 'battle_wins', targetValue: 500 }],
    rewards: { achievementPoints: 100, resources: { gold: 2000 }, prestigePoints: 200 },
    prerequisiteId: 'ach-battle-002', hidden: false, sortOrder: 3,
  },
  {
    id: 'ach-battle-004', name: '战神降临', description: '累计战斗胜利2000次',
    dimension: 'battle', rarity: 'legendary',
    conditions: [{ type: 'battle_wins', targetValue: 2000 }],
    rewards: { achievementPoints: 300, resources: { gold: 10000, mandate: 50 }, prestigePoints: 500 },
    prerequisiteId: 'ach-battle-003', hidden: true, sortOrder: 4,
  },
  {
    id: 'ach-battle-005', name: '连胜达人', description: '取得10连胜',
    dimension: 'battle', rarity: 'rare',
    conditions: [{ type: 'battle_win_streak', targetValue: 10 }],
    rewards: { achievementPoints: 30, resources: { gold: 300 } },
    hidden: false, sortOrder: 5,
  },
  {
    id: 'ach-battle-006', name: '征战天下', description: '通关所有章节',
    dimension: 'battle', rarity: 'epic',
    conditions: [{ type: 'campaign_chapters', targetValue: 10 }],
    rewards: { achievementPoints: 100, resources: { gold: 5000 }, prestigePoints: 300 },
    hidden: false, sortOrder: 6,
  },
];

// ─────────────────────────────────────────────
// 2. 建设维度成就
// ─────────────────────────────────────────────

const BUILDING_ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'ach-build-001', name: '小有规模', description: '任意建筑达到5级',
    dimension: 'building', rarity: 'common',
    conditions: [{ type: 'building_level', targetValue: 5 }],
    rewards: { achievementPoints: 10, resources: { gold: 100 } },
    hidden: false, sortOrder: 1,
  },
  {
    id: 'ach-build-002', name: '基建狂魔', description: '累计升级建筑50次',
    dimension: 'building', rarity: 'rare',
    conditions: [{ type: 'building_upgrades', targetValue: 50 }],
    rewards: { achievementPoints: 30, resources: { gold: 500 } },
    prerequisiteId: 'ach-build-001', hidden: false, sortOrder: 2,
  },
  {
    id: 'ach-build-003', name: '宏伟城池', description: '任意建筑达到15级',
    dimension: 'building', rarity: 'epic',
    conditions: [{ type: 'building_level', targetValue: 15 }],
    rewards: { achievementPoints: 100, resources: { gold: 2000 }, prestigePoints: 200 },
    prerequisiteId: 'ach-build-002', hidden: false, sortOrder: 3,
  },
  {
    id: 'ach-build-004', name: '万丈高楼', description: '累计升级建筑500次',
    dimension: 'building', rarity: 'legendary',
    conditions: [{ type: 'building_upgrades', targetValue: 500 }],
    rewards: { achievementPoints: 300, resources: { gold: 10000, mandate: 50 }, prestigePoints: 500 },
    prerequisiteId: 'ach-build-003', hidden: true, sortOrder: 4,
  },
  {
    id: 'ach-build-005', name: '全面发展', description: '拥有8种不同建筑',
    dimension: 'building', rarity: 'rare',
    conditions: [{ type: 'building_count', targetValue: 8 }],
    rewards: { achievementPoints: 30, resources: { gold: 300 } },
    hidden: false, sortOrder: 5,
  },
];

// ─────────────────────────────────────────────
// 3. 收集维度成就
// ─────────────────────────────────────────────

const COLLECTION_ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'ach-collect-001', name: '招贤纳士', description: '招募5名武将',
    dimension: 'collection', rarity: 'common',
    conditions: [{ type: 'hero_count', targetValue: 5 }],
    rewards: { achievementPoints: 10, resources: { gold: 100 } },
    hidden: false, sortOrder: 1,
  },
  {
    id: 'ach-collect-002', name: '群英荟萃', description: '招募20名武将',
    dimension: 'collection', rarity: 'rare',
    conditions: [{ type: 'hero_count', targetValue: 20 }],
    rewards: { achievementPoints: 30, resources: { gold: 500 } },
    prerequisiteId: 'ach-collect-001', hidden: false, sortOrder: 2,
  },
  {
    id: 'ach-collect-003', name: '名将如云', description: '招募50名武将',
    dimension: 'collection', rarity: 'epic',
    conditions: [{ type: 'hero_count', targetValue: 50 }],
    rewards: { achievementPoints: 100, resources: { gold: 3000 }, prestigePoints: 300 },
    prerequisiteId: 'ach-collect-002', hidden: false, sortOrder: 3,
  },
  {
    id: 'ach-collect-004', name: '装备大师', description: '获得30件装备',
    dimension: 'collection', rarity: 'rare',
    conditions: [{ type: 'equipment_count', targetValue: 30 }],
    rewards: { achievementPoints: 30, resources: { gold: 500 } },
    hidden: false, sortOrder: 4,
  },
  {
    id: 'ach-collect-005', name: '富甲一方', description: '累计获得100000金币',
    dimension: 'collection', rarity: 'epic',
    conditions: [{ type: 'resource_total', targetValue: 100000, params: { resource: 'gold' } }],
    rewards: { achievementPoints: 100, resources: { mandate: 20 }, prestigePoints: 200 },
    hidden: false, sortOrder: 5,
  },
  {
    id: 'ach-collect-006', name: '全武将收集', description: '招募所有武将',
    dimension: 'collection', rarity: 'legendary',
    conditions: [{ type: 'hero_count', targetValue: 100 }],
    rewards: { achievementPoints: 300, resources: { gold: 20000, mandate: 100 }, prestigePoints: 800 },
    prerequisiteId: 'ach-collect-003', hidden: true, sortOrder: 6,
  },
];

// ─────────────────────────────────────────────
// 4. 社交维度成就
// ─────────────────────────────────────────────

const SOCIAL_ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'ach-social-001', name: '初次结交', description: '与NPC好感达到友好',
    dimension: 'social', rarity: 'common',
    conditions: [{ type: 'npc_max_favorability', targetValue: 50 }],
    rewards: { achievementPoints: 10, resources: { gold: 100 } },
    hidden: false, sortOrder: 1,
  },
  {
    id: 'ach-social-002', name: '广结善缘', description: '与5名NPC好感达到亲密',
    dimension: 'social', rarity: 'rare',
    conditions: [{ type: 'npc_max_favorability', targetValue: 80, params: { count: 5 } }],
    rewards: { achievementPoints: 30, resources: { gold: 500 } },
    prerequisiteId: 'ach-social-001', hidden: false, sortOrder: 2,
  },
  {
    id: 'ach-social-003', name: '人脉之王', description: '与10名NPC好感达到挚友',
    dimension: 'social', rarity: 'epic',
    conditions: [{ type: 'npc_max_favorability', targetValue: 100, params: { count: 10 } }],
    rewards: { achievementPoints: 100, resources: { gold: 2000 }, prestigePoints: 200 },
    prerequisiteId: 'ach-social-002', hidden: false, sortOrder: 3,
  },
  {
    id: 'ach-social-004', name: '公会之星', description: '公会贡献达到10000',
    dimension: 'social', rarity: 'rare',
    conditions: [{ type: 'alliance_contribution', targetValue: 10000 }],
    rewards: { achievementPoints: 30, resources: { gold: 500 } },
    hidden: false, sortOrder: 4,
  },
];

// ─────────────────────────────────────────────
// 5. 转生维度成就
// ─────────────────────────────────────────────

const REBIRTH_ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'ach-rebirth-001', name: '浴火重生', description: '完成第一次转生',
    dimension: 'rebirth', rarity: 'rare',
    conditions: [{ type: 'rebirth_count', targetValue: 1 }],
    rewards: { achievementPoints: 30, resources: { gold: 1000 }, prestigePoints: 100 },
    hidden: false, sortOrder: 1,
  },
  {
    id: 'ach-rebirth-002', name: '轮回之路', description: '累计转生3次',
    dimension: 'rebirth', rarity: 'epic',
    conditions: [{ type: 'rebirth_count', targetValue: 3 }],
    rewards: { achievementPoints: 100, resources: { gold: 5000 }, prestigePoints: 300 },
    prerequisiteId: 'ach-rebirth-001', hidden: false, sortOrder: 2,
  },
  {
    id: 'ach-rebirth-003', name: '涅槃大师', description: '累计转生5次',
    dimension: 'rebirth', rarity: 'epic',
    conditions: [{ type: 'rebirth_count', targetValue: 5 }],
    rewards: { achievementPoints: 100, resources: { gold: 8000, mandate: 30 }, prestigePoints: 500 },
    prerequisiteId: 'ach-rebirth-002', hidden: false, sortOrder: 3,
  },
  {
    id: 'ach-rebirth-004', name: '极速轮回', description: '7天内完成转生后重建',
    dimension: 'rebirth', rarity: 'rare',
    conditions: [{ type: 'rebirth_speed', targetValue: 7 }],
    rewards: { achievementPoints: 30, resources: { gold: 2000 } },
    hidden: false, sortOrder: 4,
  },
  {
    id: 'ach-rebirth-005', name: '转生帝王', description: '累计转生10次',
    dimension: 'rebirth', rarity: 'legendary',
    conditions: [{ type: 'rebirth_count', targetValue: 10 }],
    rewards: { achievementPoints: 300, resources: { gold: 50000, mandate: 200 }, prestigePoints: 1000 },
    prerequisiteId: 'ach-rebirth-003', hidden: true, sortOrder: 5,
  },
  {
    id: 'ach-rebirth-006', name: '声望巅峰', description: '达到声望等级50',
    dimension: 'rebirth', rarity: 'legendary',
    conditions: [{ type: 'prestige_level', targetValue: 50 }],
    rewards: { achievementPoints: 300, resources: { gold: 30000, mandate: 100 }, prestigePoints: 800 },
    hidden: true, sortOrder: 6,
  },
];

// ─────────────────────────────────────────────
// 6. 所有成就汇总
// ─────────────────────────────────────────────

/** 所有成就定义列表 */
export const ALL_ACHIEVEMENTS: AchievementDef[] = [
  ...BATTLE_ACHIEVEMENTS,
  ...BUILDING_ACHIEVEMENTS,
  ...COLLECTION_ACHIEVEMENTS,
  ...SOCIAL_ACHIEVEMENTS,
  ...REBIRTH_ACHIEVEMENTS,
];

/** 成就定义映射 (ID -> AchievementDef) */
export const ACHIEVEMENT_DEF_MAP: Record<string, AchievementDef> = Object.fromEntries(
  ALL_ACHIEVEMENTS.map((a) => [a.id, a]),
);

// ─────────────────────────────────────────────
// 7. 转生成就链
// ─────────────────────────────────────────────

/** 转生成就链列表 */
export const REBIRTH_ACHIEVEMENT_CHAINS: RebirthAchievementChain[] = [
  {
    chainId: 'chain-battle-master',
    chainName: '战神之路',
    description: '完成所有战斗成就',
    achievementIds: ['ach-battle-001', 'ach-battle-002', 'ach-battle-003', 'ach-battle-004'],
    chainBonusReward: { achievementPoints: 100, resources: { gold: 10000 }, prestigePoints: 500 },
  },
  {
    chainId: 'chain-builder-king',
    chainName: '建设之王',
    description: '完成所有建设成就',
    achievementIds: ['ach-build-001', 'ach-build-002', 'ach-build-003', 'ach-build-004'],
    chainBonusReward: { achievementPoints: 100, resources: { gold: 10000 }, prestigePoints: 500 },
  },
  {
    chainId: 'chain-collector',
    chainName: '收藏大师',
    description: '完成所有收集成就',
    achievementIds: ['ach-collect-001', 'ach-collect-002', 'ach-collect-003', 'ach-collect-006'],
    chainBonusReward: { achievementPoints: 100, resources: { gold: 10000 }, prestigePoints: 500 },
  },
  {
    chainId: 'chain-rebirth-supreme',
    chainName: '轮回至尊',
    description: '完成所有转生成就',
    achievementIds: ['ach-rebirth-001', 'ach-rebirth-002', 'ach-rebirth-003', 'ach-rebirth-005'],
    chainBonusReward: { achievementPoints: 200, resources: { gold: 50000, mandate: 200 }, prestigePoints: 1000 },
  },
];
