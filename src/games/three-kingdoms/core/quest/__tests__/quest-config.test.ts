/**
 * 核心层 — 任务类型与配置测试
 *
 * 验证：
 * - 任务类型定义完整性
 * - 目标事件映射正确性
 * - 日常任务池配置
 * - 活跃度里程碑配置
 * - 预定义任务数据一致性
 */

import { describe, it, expect } from 'vitest';
import {
  OBJECTIVE_EVENT_MAP,
  DEFAULT_ACTIVITY_MILESTONES,
  DEFAULT_DAILY_POOL_CONFIG,
  QUEST_SAVE_VERSION,
} from '../quest.types';
import {
  QUEST_MAIN_CHAPTER_1,
  QUEST_MAIN_CHAPTER_2,
  QUEST_MAIN_CHAPTER_3,
  QUEST_SIDE_TECH,
  QUEST_SIDE_NPC,
  DAILY_QUEST_TEMPLATES,
  PREDEFINED_QUESTS,
} from '../quest-config';
import type { QuestDef, ObjectiveType } from '../quest.types';

// ═══════════════════════════════════════════════════════════

describe('quest.types', () => {
  // ═══════════════════════════════════════════
  // 1. 目标事件映射
  // ═══════════════════════════════════════════
  describe('OBJECTIVE_EVENT_MAP', () => {
    it('包含所有目标类型', () => {
      const expectedTypes: ObjectiveType[] = [
        'build_upgrade', 'battle_clear', 'recruit_hero', 'collect_resource',
        'npc_interact', 'npc_gift', 'tech_research', 'event_complete',
        'daily_login', 'reach_chapter',
      ];
      for (const type of expectedTypes) {
        expect(OBJECTIVE_EVENT_MAP[type]).toBeDefined();
        expect(typeof OBJECTIVE_EVENT_MAP[type]).toBe('string');
      }
    });

    it('事件名遵循 domain:action 格式', () => {
      for (const [type, event] of Object.entries(OBJECTIVE_EVENT_MAP)) {
        expect(event).toMatch(/^[a-z]+:[a-zA-Z]+$/);
      }
    });
  });

  // ═══════════════════════════════════════════
  // 2. 活跃度里程碑
  // ═══════════════════════════════════════════
  describe('DEFAULT_ACTIVITY_MILESTONES', () => {
    it('有5个里程碑等级', () => {
      expect(DEFAULT_ACTIVITY_MILESTONES).toHaveLength(5);
    });

    it('里程碑分数递增', () => {
      for (let i = 1; i < DEFAULT_ACTIVITY_MILESTONES.length; i++) {
        expect(DEFAULT_ACTIVITY_MILESTONES[i].points).toBeGreaterThan(
          DEFAULT_ACTIVITY_MILESTONES[i - 1].points,
        );
      }
    });

    it('每个里程碑都有资源奖励', () => {
      for (const m of DEFAULT_ACTIVITY_MILESTONES) {
        expect(m.rewards.resources).toBeDefined();
        expect(m.rewards.resources!.gold).toBeGreaterThan(0);
      }
    });

    it('默认未领取', () => {
      for (const m of DEFAULT_ACTIVITY_MILESTONES) {
        expect(m.claimed).toBe(false);
      }
    });
  });

  // ═══════════════════════════════════════════
  // 3. 日常任务池配置
  // ═══════════════════════════════════════════
  describe('DEFAULT_DAILY_POOL_CONFIG', () => {
    it('池大小为20', () => {
      expect(DEFAULT_DAILY_POOL_CONFIG.poolSize).toBe(20);
    });

    it('每日抽取6个', () => {
      expect(DEFAULT_DAILY_POOL_CONFIG.dailyPickCount).toBe(6);
    });

    it('刷新时间为0点', () => {
      expect(DEFAULT_DAILY_POOL_CONFIG.refreshHour).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 存档版本
  // ═══════════════════════════════════════════
  it('QUEST_SAVE_VERSION 为 1', () => {
    expect(QUEST_SAVE_VERSION).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════

describe('quest-config', () => {
  // ═══════════════════════════════════════════
  // 1. 主线任务
  // ═══════════════════════════════════════════
  describe('主线任务', () => {
    it('第一章无前置', () => {
      expect(QUEST_MAIN_CHAPTER_1.prerequisiteQuestIds).toBeUndefined();
    });

    it('第二章前置为第一章', () => {
      expect(QUEST_MAIN_CHAPTER_2.prerequisiteQuestIds).toContain('quest-main-001');
    });

    it('第三章前置为第二章', () => {
      expect(QUEST_MAIN_CHAPTER_3.prerequisiteQuestIds).toContain('quest-main-002');
    });

    it('所有主线任务有奖励', () => {
      const mainQuests = [QUEST_MAIN_CHAPTER_1, QUEST_MAIN_CHAPTER_2, QUEST_MAIN_CHAPTER_3];
      for (const q of mainQuests) {
        expect(q.rewards.resources).toBeDefined();
        expect(q.rewards.resources!.gold).toBeGreaterThan(0);
        expect(q.rewards.experience).toBeGreaterThan(0);
      }
    });

    it('主线任务章节递增', () => {
      expect(QUEST_MAIN_CHAPTER_1.sortOrder).toBeLessThan(QUEST_MAIN_CHAPTER_2.sortOrder!);
      expect(QUEST_MAIN_CHAPTER_2.sortOrder).toBeLessThan(QUEST_MAIN_CHAPTER_3.sortOrder!);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 支线任务
  // ═══════════════════════════════════════════
  describe('支线任务', () => {
    it('支线任务无前置任务链', () => {
      expect(QUEST_SIDE_NPC.prerequisiteQuestIds).toBeUndefined();
    });

    it('支线任务有奖励', () => {
      expect(QUEST_SIDE_TECH.rewards.resources!.gold).toBeGreaterThan(0);
      expect(QUEST_SIDE_NPC.rewards.resources!.gold).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 日常任务池
  // ═══════════════════════════════════════════
  describe('日常任务池', () => {
    it('有20个日常任务模板', () => {
      expect(DAILY_QUEST_TEMPLATES).toHaveLength(20);
    });

    it('所有日常任务类型为 daily', () => {
      for (const q of DAILY_QUEST_TEMPLATES) {
        expect(q.category).toBe('daily');
      }
    });

    it('所有日常任务有活跃度奖励', () => {
      for (const q of DAILY_QUEST_TEMPLATES) {
        expect(q.rewards.activityPoints).toBeGreaterThan(0);
      }
    });

    it('所有日常任务有过期时间', () => {
      for (const q of DAILY_QUEST_TEMPLATES) {
        expect(q.expireHours).toBe(24);
      }
    });

    it('日常任务 ID 唯一', () => {
      const ids = DAILY_QUEST_TEMPLATES.map((q) => q.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('日常任务目标类型覆盖多种', () => {
      const types = new Set(DAILY_QUEST_TEMPLATES.flatMap((q) => q.objectives.map((o) => o.type)));
      expect(types.size).toBeGreaterThanOrEqual(5);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 预定义任务映射
  // ═══════════════════════════════════════════
  describe('PREDEFINED_QUESTS', () => {
    it('包含所有主线和支线任务', () => {
      expect(PREDEFINED_QUESTS['quest-main-001']).toBeDefined();
      expect(PREDEFINED_QUESTS['quest-main-002']).toBeDefined();
      expect(PREDEFINED_QUESTS['quest-main-003']).toBeDefined();
      expect(PREDEFINED_QUESTS['quest-side-tech']).toBeDefined();
      expect(PREDEFINED_QUESTS['quest-side-npc']).toBeDefined();
    });

    it('不包含日常任务模板', () => {
      for (const key of Object.keys(PREDEFINED_QUESTS)) {
        expect(key).not.toMatch(/^daily-/);
      }
    });
  });
});
