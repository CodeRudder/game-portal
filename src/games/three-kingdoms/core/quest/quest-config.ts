/**
 * 核心层 — 任务系统配置
 *
 * 包含预定义的主线/支线/日常任务模板。
 * 所有配置为只读常量，运行时不可修改。
 *
 * @module core/quest/quest-config
 */

import type { QuestDef } from './quest.types';

// ─────────────────────────────────────────────
// 主线任务
// ─────────────────────────────────────────────

/** 主线任务 — 第1章：初入乱世 */
export const QUEST_MAIN_CHAPTER_1: QuestDef = {
  id: 'quest-main-001',
  title: '初入乱世',
  description: '天下大乱，群雄并起。你需要建立自己的势力，招兵买马。',
  category: 'main',
  objectives: [
    { id: 'obj-001-1', type: 'build_upgrade', description: '升级任意建筑1次', targetCount: 1, currentCount: 0 },
  ],
  rewards: { resources: { gold: 200 }, experience: 50 },
  sortOrder: 1,
};

/** 主线任务 — 第2章：招兵买马 */
export const QUEST_MAIN_CHAPTER_2: QuestDef = {
  id: 'quest-main-002',
  title: '招兵买马',
  description: '势力初具规模，是时候招募更多武将了。',
  category: 'main',
  objectives: [
    { id: 'obj-002-1', type: 'recruit_hero', description: '招募武将1次', targetCount: 1, currentCount: 0 },
  ],
  rewards: { resources: { gold: 300 }, experience: 80 },
  prerequisiteQuestIds: ['quest-main-001'],
  sortOrder: 2,
};

/** 主线任务 — 第3章：初试锋芒 */
export const QUEST_MAIN_CHAPTER_3: QuestDef = {
  id: 'quest-main-003',
  title: '初试锋芒',
  description: '你的势力已经足够强大，是时候在战场上证明自己了。',
  category: 'main',
  objectives: [
    { id: 'obj-003-1', type: 'battle_clear', description: '通关关卡3次', targetCount: 3, currentCount: 0 },
  ],
  rewards: { resources: { gold: 500 }, experience: 120 },
  prerequisiteQuestIds: ['quest-main-002'],
  sortOrder: 3,
};

// ─────────────────────────────────────────────
// 支线任务
// ─────────────────────────────────────────────

/** 支线任务 — 科技兴邦 */
export const QUEST_SIDE_TECH: QuestDef = {
  id: 'quest-side-tech',
  title: '科技兴邦',
  description: '研究科技可以大幅提升势力实力。',
  category: 'side',
  objectives: [
    { id: 'obj-side-tech-1', type: 'tech_research', description: '研究科技1项', targetCount: 1, currentCount: 0 },
  ],
  rewards: { resources: { gold: 150 }, experience: 30 },
  requiredLevel: 2,
};

/** 支线任务 — 广结善缘 */
export const QUEST_SIDE_NPC: QuestDef = {
  id: 'quest-side-npc',
  title: '广结善缘',
  description: '与NPC建立良好关系，获取更多帮助。',
  category: 'side',
  objectives: [
    { id: 'obj-side-npc-1', type: 'npc_interact', description: '与NPC交互5次', targetCount: 5, currentCount: 0 },
  ],
  rewards: { resources: { gold: 100 }, experience: 20 },
};

// ─────────────────────────────────────────────
// 日常任务池（20个模板）
// ─────────────────────────────────────────────

/** 日常任务模板列表 */
export const DAILY_QUEST_TEMPLATES: QuestDef[] = [
  {
    id: 'daily-001', title: '勤劳建设', description: '升级建筑1次',
    category: 'daily',
    objectives: [{ id: 'd-obj-1', type: 'build_upgrade', description: '升级建筑1次', targetCount: 1, currentCount: 0 }],
    rewards: { resources: { gold: 50 }, activityPoints: 10 },
    expireHours: 24, jumpTarget: '/buildings',
  },
  {
    id: 'daily-002', title: '沙场练兵', description: '通关关卡3次',
    category: 'daily',
    objectives: [{ id: 'd-obj-2', type: 'battle_clear', description: '通关关卡3次', targetCount: 3, currentCount: 0 }],
    rewards: { resources: { gold: 80 }, activityPoints: 15 },
    expireHours: 24, jumpTarget: '/campaign',
  },
  {
    id: 'daily-003', title: '招贤纳士', description: '招募武将1次',
    category: 'daily',
    objectives: [{ id: 'd-obj-3', type: 'recruit_hero', description: '招募武将1次', targetCount: 1, currentCount: 0 }],
    rewards: { resources: { gold: 60 }, activityPoints: 10 },
    expireHours: 24, jumpTarget: '/heroes',
  },
  {
    id: 'daily-004', title: '广积粮草', description: '收集粮草500',
    category: 'daily',
    objectives: [{ id: 'd-obj-4', type: 'collect_resource', description: '收集粮草500', targetCount: 500, currentCount: 0, params: { resource: 'grain' } }],
    rewards: { resources: { gold: 40 }, activityPoints: 10 },
    expireHours: 24,
  },
  {
    id: 'daily-005', title: '礼尚往来', description: '赠送NPC物品1次',
    category: 'daily',
    objectives: [{ id: 'd-obj-5', type: 'npc_gift', description: '赠送NPC物品1次', targetCount: 1, currentCount: 0 }],
    rewards: { resources: { gold: 30 }, activityPoints: 5 },
    expireHours: 24, jumpTarget: '/npc',
  },
  {
    id: 'daily-006', title: '科技创新', description: '研究科技1项',
    category: 'daily',
    objectives: [{ id: 'd-obj-6', type: 'tech_research', description: '研究科技1项', targetCount: 1, currentCount: 0 }],
    rewards: { resources: { gold: 70 }, activityPoints: 15 },
    expireHours: 24, jumpTarget: '/tech',
  },
  {
    id: 'daily-007', title: '社交达人', description: '与NPC交互3次',
    category: 'daily',
    objectives: [{ id: 'd-obj-7', type: 'npc_interact', description: '与NPC交互3次', targetCount: 3, currentCount: 0 }],
    rewards: { resources: { gold: 40 }, activityPoints: 10 },
    expireHours: 24, jumpTarget: '/npc',
  },
  {
    id: 'daily-008', title: '事件达人', description: '完成事件2个',
    category: 'daily',
    objectives: [{ id: 'd-obj-8', type: 'event_complete', description: '完成事件2个', targetCount: 2, currentCount: 0 }],
    rewards: { resources: { gold: 60 }, activityPoints: 10 },
    expireHours: 24,
  },
  {
    id: 'daily-009', title: '勤政爱民', description: '升级建筑2次',
    category: 'daily',
    objectives: [{ id: 'd-obj-9', type: 'build_upgrade', description: '升级建筑2次', targetCount: 2, currentCount: 0 }],
    rewards: { resources: { gold: 80 }, activityPoints: 15 },
    expireHours: 24, jumpTarget: '/buildings',
  },
  {
    id: 'daily-010', title: '百战百胜', description: '通关关卡5次',
    category: 'daily',
    objectives: [{ id: 'd-obj-10', type: 'battle_clear', description: '通关关卡5次', targetCount: 5, currentCount: 0 }],
    rewards: { resources: { gold: 120 }, activityPoints: 20 },
    expireHours: 24, jumpTarget: '/campaign',
  },
  {
    id: 'daily-011', title: '日进斗金', description: '收集金币1000',
    category: 'daily',
    objectives: [{ id: 'd-obj-11', type: 'collect_resource', description: '收集金币1000', targetCount: 1000, currentCount: 0, params: { resource: 'gold' } }],
    rewards: { resources: { grain: 200 }, activityPoints: 10 },
    expireHours: 24,
  },
  {
    id: 'daily-012', title: '名将收集', description: '招募武将2次',
    category: 'daily',
    objectives: [{ id: 'd-obj-12', type: 'recruit_hero', description: '招募武将2次', targetCount: 2, currentCount: 0 }],
    rewards: { resources: { gold: 100 }, activityPoints: 15 },
    expireHours: 24, jumpTarget: '/heroes',
  },
  {
    id: 'daily-013', title: '科技先驱', description: '研究科技2项',
    category: 'daily',
    objectives: [{ id: 'd-obj-13', type: 'tech_research', description: '研究科技2项', targetCount: 2, currentCount: 0 }],
    rewards: { resources: { gold: 100 }, activityPoints: 15 },
    expireHours: 24, jumpTarget: '/tech',
  },
  {
    id: 'daily-014', title: '慷慨解囊', description: '赠送NPC物品3次',
    category: 'daily',
    objectives: [{ id: 'd-obj-14', type: 'npc_gift', description: '赠送NPC物品3次', targetCount: 3, currentCount: 0 }],
    rewards: { resources: { gold: 50 }, activityPoints: 10 },
    expireHours: 24, jumpTarget: '/npc',
  },
  {
    id: 'daily-015', title: '征战四方', description: '通关关卡10次',
    category: 'daily',
    objectives: [{ id: 'd-obj-15', type: 'battle_clear', description: '通关关卡10次', targetCount: 10, currentCount: 0 }],
    rewards: { resources: { gold: 200 }, activityPoints: 25 },
    expireHours: 24, jumpTarget: '/campaign',
  },
  {
    id: 'daily-016', title: '大兴土木', description: '升级建筑3次',
    category: 'daily',
    objectives: [{ id: 'd-obj-16', type: 'build_upgrade', description: '升级建筑3次', targetCount: 3, currentCount: 0 }],
    rewards: { resources: { gold: 120 }, activityPoints: 20 },
    expireHours: 24, jumpTarget: '/buildings',
  },
  {
    id: 'daily-017', title: '满腹经纶', description: '研究科技3项',
    category: 'daily',
    objectives: [{ id: 'd-obj-17', type: 'tech_research', description: '研究科技3项', targetCount: 3, currentCount: 0 }],
    rewards: { resources: { gold: 150 }, activityPoints: 20 },
    expireHours: 24, jumpTarget: '/tech',
  },
  {
    id: 'daily-018', title: '人脉广阔', description: '与NPC交互5次',
    category: 'daily',
    objectives: [{ id: 'd-obj-18', type: 'npc_interact', description: '与NPC交互5次', targetCount: 5, currentCount: 0 }],
    rewards: { resources: { gold: 60 }, activityPoints: 10 },
    expireHours: 24, jumpTarget: '/npc',
  },
  {
    id: 'daily-019', title: '每日签到', description: '今日首次登录',
    category: 'daily',
    objectives: [{ id: 'd-obj-19', type: 'daily_login', description: '今日首次登录', targetCount: 1, currentCount: 0 }],
    rewards: { resources: { gold: 30 }, activityPoints: 5 },
    expireHours: 24,
  },
  {
    id: 'daily-020', title: '事件猎手', description: '完成事件5个',
    category: 'daily',
    objectives: [{ id: 'd-obj-20', type: 'event_complete', description: '完成事件5个', targetCount: 5, currentCount: 0 }],
    rewards: { resources: { gold: 150 }, activityPoints: 20 },
    expireHours: 24,
  },
];

// ─────────────────────────────────────────────
// 所有预定义任务
// ─────────────────────────────────────────────

/** 所有预定义任务映射（不含日常模板） */
export const PREDEFINED_QUESTS: Record<string, QuestDef> = {
  'quest-main-001': QUEST_MAIN_CHAPTER_1,
  'quest-main-002': QUEST_MAIN_CHAPTER_2,
  'quest-main-003': QUEST_MAIN_CHAPTER_3,
  'quest-side-tech': QUEST_SIDE_TECH,
  'quest-side-npc': QUEST_SIDE_NPC,
};
