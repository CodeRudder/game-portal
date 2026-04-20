/**
 * AdvisorSystem — 军师推荐系统测试
 *
 * 覆盖：
 *   #14 建议触发规则 — 9种触发条件
 *   #15 建议内容结构 — 标题/描述/置信度
 *   #16 建议展示规则 — 最多3条+冷却+每日上限
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdvisorSystem } from '../AdvisorSystem';
import type { GameStateSnapshot } from '../AdvisorSystem';
import type { AdvisorTriggerType } from '../../../core/advisor';
import {
  ADVISOR_MAX_DISPLAY,
  ADVISOR_DAILY_LIMIT,
  ADVISOR_CLOSE_COOLDOWN_MS,
} from '../../../core/advisor';

// ─────────────────────────────────────────────
// Mock EventBus
// ─────────────────────────────────────────────

function createMockEventBus() {
  const listeners: Record<string, Function[]> = {};
  return {
    on: (event: string, cb: Function) => { (listeners[event] ??= []).push(cb); },
    emit: (event: string, payload?: unknown) => { (listeners[event] ?? []).forEach(cb => cb(payload)); },
    off: () => {},
  };
}

function createMockDeps() {
  return {
    eventBus: createMockEventBus() as any,
    config: { get: () => undefined } as any,
    registry: { get: () => null, has: () => false } as any,
  };
}

// ─────────────────────────────────────────────
// 辅助函数：创建游戏状态快照
// ─────────────────────────────────────────────

function createSnapshot(overrides: Partial<GameStateSnapshot> = {}): GameStateSnapshot {
  return {
    resources: { grain: 500, gold: 300, troops: 200, mandate: 10 },
    resourceCaps: { grain: 1000, gold: 0, troops: 500, mandate: 0 },
    buildingQueueIdle: false,
    upgradeableHeroes: [],
    techQueueIdle: false,
    armyFull: false,
    leavingNpcs: [],
    newFeatures: [],
    offlineOverflowPercent: 0,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('AdvisorSystem', () => {
  let system: AdvisorSystem;

  beforeEach(() => {
    system = new AdvisorSystem();
    system.init(createMockDeps());
  });

  // ── #14 建议触发规则 ──

  describe('#14 建议触发规则 (9种)', () => {
    it('资源溢出检测: 资源>80%上限', () => {
      const snapshot = createSnapshot({
        resources: { grain: 900, gold: 300, troops: 200, mandate: 10 },
        resourceCaps: { grain: 1000, gold: 0, troops: 500, mandate: 0 },
      });
      const suggestions = system.detectTriggers(snapshot);
      const overflow = suggestions.find(s => s.triggerType === 'resource_overflow');
      expect(overflow).toBeDefined();
      expect(overflow!.title).toContain('满仓');
    });

    it('资源告急检测: 资源<10%', () => {
      const snapshot = createSnapshot({
        resources: { grain: 50, gold: 300, troops: 200, mandate: 10 },
        resourceCaps: { grain: 1000, gold: 0, troops: 500, mandate: 0 },
      });
      const suggestions = system.detectTriggers(snapshot);
      const shortage = suggestions.find(s => s.triggerType === 'resource_shortage');
      expect(shortage).toBeDefined();
      expect(shortage!.title).toContain('告急');
    });

    it('建筑队列空闲检测', () => {
      const snapshot = createSnapshot({ buildingQueueIdle: true });
      const suggestions = system.detectTriggers(snapshot);
      const idle = suggestions.find(s => s.triggerType === 'building_idle');
      expect(idle).toBeDefined();
      expect(idle!.title).toContain('空闲');
    });

    it('武将可升级检测', () => {
      const snapshot = createSnapshot({ upgradeableHeroes: ['guanyu'] });
      const suggestions = system.detectTriggers(snapshot);
      const upgrade = suggestions.find(s => s.triggerType === 'hero_upgradeable');
      expect(upgrade).toBeDefined();
      expect(upgrade!.title).toContain('升级');
    });

    it('科技队列空闲检测', () => {
      const snapshot = createSnapshot({ techQueueIdle: true });
      const suggestions = system.detectTriggers(snapshot);
      const idle = suggestions.find(s => s.triggerType === 'tech_idle');
      expect(idle).toBeDefined();
    });

    it('兵力满值检测', () => {
      const snapshot = createSnapshot({ armyFull: true });
      const suggestions = system.detectTriggers(snapshot);
      const full = suggestions.find(s => s.triggerType === 'army_full');
      expect(full).toBeDefined();
    });

    it('NPC即将离开检测', () => {
      const snapshot = createSnapshot({
        leavingNpcs: [{ id: 'npc_1', name: '诸葛亮', hoursLeft: 1.5 }],
      });
      const suggestions = system.detectTriggers(snapshot);
      const leaving = suggestions.find(s => s.triggerType === 'npc_leaving');
      expect(leaving).toBeDefined();
      expect(leaving!.title).toContain('诸葛亮');
    });

    it('新功能解锁检测', () => {
      const snapshot = createSnapshot({
        newFeatures: [{ id: 'bond_system', name: '武将羁绊' }],
      });
      const suggestions = system.detectTriggers(snapshot);
      const feature = suggestions.find(s => s.triggerType === 'new_feature_unlock');
      expect(feature).toBeDefined();
      expect(feature!.title).toContain('武将羁绊');
    });

    it('离线溢出检测: >50%', () => {
      const snapshot = createSnapshot({ offlineOverflowPercent: 60 });
      const suggestions = system.detectTriggers(snapshot);
      const offline = suggestions.find(s => s.triggerType === 'offline_overflow');
      expect(offline).toBeDefined();
    });
  });

  // ── #15 建议内容结构 ──

  describe('#15 建议内容结构', () => {
    it('标题不超过20字', () => {
      const snapshot = createSnapshot({ buildingQueueIdle: true });
      const suggestions = system.detectTriggers(snapshot);
      for (const s of suggestions) {
        expect(s.title.length).toBeLessThanOrEqual(20);
      }
    });

    it('描述不超过50字', () => {
      const snapshot = createSnapshot({ buildingQueueIdle: true });
      const suggestions = system.detectTriggers(snapshot);
      for (const s of suggestions) {
        expect(s.description.length).toBeLessThanOrEqual(50);
      }
    });

    it('建议包含行动按钮和跳转目标', () => {
      const snapshot = createSnapshot({ buildingQueueIdle: true });
      const suggestions = system.detectTriggers(snapshot);
      for (const s of suggestions) {
        expect(s.actionLabel).toBeTruthy();
        expect(s.actionTarget).toBeTruthy();
      }
    });

    it('建议包含置信度', () => {
      const snapshot = createSnapshot({ buildingQueueIdle: true });
      const suggestions = system.detectTriggers(snapshot);
      for (const s of suggestions) {
        expect(['high', 'medium', 'low']).toContain(s.confidence);
      }
    });

    it('建议包含优先级', () => {
      const snapshot = createSnapshot({
        resourceCaps: { grain: 1000, gold: 0, troops: 500, mandate: 0 },
        resources: { grain: 50, gold: 300, troops: 200, mandate: 10 },
      });
      const suggestions = system.detectTriggers(snapshot);
      for (const s of suggestions) {
        expect(s.priority).toBeGreaterThan(0);
      }
    });
  });

  // ── #16 建议展示规则 ──

  describe('#16 建议展示规则', () => {
    it('最多展示3条建议', () => {
      const snapshot = createSnapshot({
        resources: { grain: 900, gold: 300, troops: 450, mandate: 10 },
        resourceCaps: { grain: 1000, gold: 0, troops: 500, mandate: 0 },
        buildingQueueIdle: true,
        techQueueIdle: true,
        armyFull: true,
        upgradeableHeroes: ['hero1', 'hero2'],
      });
      system.updateSuggestions(snapshot);
      const displayed = system.getDisplayedSuggestions();
      expect(displayed.length).toBeLessThanOrEqual(ADVISOR_MAX_DISPLAY);
    });

    it('按优先级排序', () => {
      const snapshot = createSnapshot({
        resources: { grain: 900, gold: 300, troops: 450, mandate: 10 },
        resourceCaps: { grain: 1000, gold: 0, troops: 500, mandate: 0 },
        buildingQueueIdle: true,
        techQueueIdle: true,
      });
      system.updateSuggestions(snapshot);
      const displayed = system.getDisplayedSuggestions();
      for (let i = 1; i < displayed.length; i++) {
        expect(displayed[i - 1].priority).toBeGreaterThanOrEqual(displayed[i].priority);
      }
    });

    it('执行建议后自动移除', () => {
      const snapshot = createSnapshot({ buildingQueueIdle: true });
      system.updateSuggestions(snapshot);
      const displayed = system.getDisplayedSuggestions();
      expect(displayed.length).toBeGreaterThan(0);

      const result = system.executeSuggestion(displayed[0].id);
      expect(result.success).toBe(true);

      const after = system.getDisplayedSuggestions();
      expect(after.find(s => s.id === displayed[0].id)).toBeUndefined();
    });

    it('关闭建议后进入冷却', () => {
      const snapshot = createSnapshot({ buildingQueueIdle: true });
      system.updateSuggestions(snapshot);
      const displayed = system.getDisplayedSuggestions();
      expect(displayed.length).toBeGreaterThan(0);

      const result = system.dismissSuggestion(displayed[0].id);
      expect(result.success).toBe(true);

      // 同类型应在冷却中
      expect(system.isInCooldown('building_idle')).toBe(true);
    });

    it('冷却中的触发类型不生成新建议', () => {
      const snapshot = createSnapshot({ buildingQueueIdle: true });
      // 先生成一次
      system.updateSuggestions(snapshot);
      const first = system.getDisplayedSuggestions();
      const buildIdle = first.find(s => s.triggerType === 'building_idle');

      if (buildIdle) {
        // 关闭建议
        system.dismissSuggestion(buildIdle.id);
        // 再次检测
        const newSuggestions = system.detectTriggers(snapshot);
        const newBuildIdle = newSuggestions.find(s => s.triggerType === 'building_idle');
        expect(newBuildIdle).toBeUndefined();
      }
    });

    it('每日上限15条', () => {
      // 通过创建大量不同快照来测试上限
      let totalCreated = 0;
      for (let i = 0; i < 20; i++) {
        const snapshot = createSnapshot({
          resources: { grain: 900, gold: 300, troops: 450, mandate: 10 },
          resourceCaps: { grain: 1000, gold: 0, troops: 500, mandate: 0 },
          buildingQueueIdle: i % 2 === 0,
          techQueueIdle: i % 2 === 1,
        });
        const suggestions = system.detectTriggers(snapshot);
        totalCreated += suggestions.length;
      }

      const state = system.getDisplayState();
      expect(state.dailyCount).toBeLessThanOrEqual(ADVISOR_DAILY_LIMIT);
    });
  });

  // ── 序列化 ──

  describe('序列化', () => {
    it('序列化和反序列化保持一致', () => {
      const snapshot = createSnapshot({ buildingQueueIdle: true });
      system.updateSuggestions(snapshot);

      const data = system.serialize();
      const newSystem = new AdvisorSystem();
      newSystem.init(createMockDeps());
      newSystem.loadSaveData(data);

      expect(newSystem.getDisplayState().dailyCount).toBe(data.dailyCount);
    });
  });

  // ── 生命周期 ──

  describe('生命周期', () => {
    it('reset 清除所有状态', () => {
      const snapshot = createSnapshot({ buildingQueueIdle: true });
      system.updateSuggestions(snapshot);
      system.reset();
      expect(system.getDisplayedSuggestions()).toHaveLength(0);
      expect(system.getDisplayState().dailyCount).toBe(0);
    });
  });
});
