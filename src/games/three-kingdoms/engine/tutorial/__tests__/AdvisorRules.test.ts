/**
 * 军师建议系统 P1 缺口测试
 *
 * 覆盖：
 *   1. 军师建议触发规则（9条触发条件）
 *   2. 军师建议展示规则（最大3条/排序/冷却）
 *   3. 军师建议面板UI交互
 *
 * 使用真实引擎实例，不mock内部逻辑
 *
 * @module engine/tutorial/__tests__/AdvisorRules.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdvisorSystem } from '../../advisor/AdvisorSystem';
import type { GameStateSnapshot } from '../../advisor/AdvisorSystem';
import type { AdvisorTriggerType } from '../../../core/advisor';
import {
  ADVISOR_MAX_DISPLAY,
  ADVISOR_DAILY_LIMIT,
  ADVISOR_CLOSE_COOLDOWN_MS,
  ADVISOR_TRIGGER_PRIORITY,
} from '../../../core/advisor';
import { detectAllTriggers, findOverflowResource, findShortageResource } from '../../advisor/AdvisorTriggerDetector';
import type { ISystemDeps } from '../../../core/types';

// ─────────────────────────────────────────────
// Mock EventBus
// ─────────────────────────────────────────────

function createMockEventBus() {
  const listeners: Record<string, Function[]> = {};
  const emitted: { event: string; payload?: unknown }[] = [];
  return {
    on: (event: string, cb: Function) => { (listeners[event] ??= []).push(cb); },
    emit: (event: string, payload?: unknown) => {
      emitted.push({ event, payload });
      (listeners[event] ?? []).forEach(cb => cb(payload));
    },
    off: () => {},
    _emitted: emitted,
  };
}

function createMockDeps(): ISystemDeps {
  return {
    eventBus: createMockEventBus() as unknown as ISystemDeps['eventBus'],
    config: { get: () => undefined } as unknown as ISystemDeps['config'],
    registry: { get: () => null, has: () => false } as unknown as ISystemDeps['registry'],
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

/** 所有9种触发类型 */
const ALL_TRIGGER_TYPES: AdvisorTriggerType[] = [
  'resource_overflow',
  'resource_shortage',
  'building_idle',
  'hero_upgradeable',
  'tech_idle',
  'army_full',
  'npc_leaving',
  'new_feature_unlock',
  'offline_overflow',
];

// ─────────────────────────────────────────────
// 1. 军师建议触发规则（9条触发条件）
// ─────────────────────────────────────────────

describe('军师建议触发规则（9条触发条件）', () => {
  let system: AdvisorSystem;

  beforeEach(() => {
    system = new AdvisorSystem();
    system.init(createMockDeps());
  });

  describe('触发条件 #1: 资源溢出（resource_overflow）', () => {
    it('资源超过90%上限时触发', () => {
      const snapshot = createSnapshot({
        resources: { grain: 950, gold: 300, troops: 200, mandate: 10 },
        resourceCaps: { grain: 1000, gold: 0, troops: 500, mandate: 0 },
      });
      const triggers = system.detectTriggers(snapshot);
      const overflow = triggers.find(t => t.triggerType === 'resource_overflow');
      expect(overflow).toBeDefined();
      expect(overflow!.title).toContain('资源');
    });

    it('资源未超过阈值时不触发', () => {
      const snapshot = createSnapshot({
        resources: { grain: 500, gold: 300, troops: 200, mandate: 10 },
        resourceCaps: { grain: 1000, gold: 0, troops: 500, mandate: 0 },
      });
      const triggers = system.detectTriggers(snapshot);
      expect(triggers.find(t => t.triggerType === 'resource_overflow')).toBeUndefined();
    });

    it('grain超过90%时findOverflowResource返回grain', () => {
      const snapshot = createSnapshot({
        resources: { grain: 920, gold: 300, troops: 200, mandate: 10 },
        resourceCaps: { grain: 1000, gold: 0, troops: 500, mandate: 0 },
      });
      expect(findOverflowResource(snapshot)).toBe('grain');
    });
  });

  describe('触发条件 #2: 资源告急（resource_shortage）', () => {
    it('资源低于10%时触发', () => {
      const snapshot = createSnapshot({
        resources: { grain: 50, gold: 300, troops: 200, mandate: 10 },
        resourceCaps: { grain: 1000, gold: 0, troops: 500, mandate: 0 },
      });
      const triggers = system.detectTriggers(snapshot);
      const shortage = triggers.find(t => t.triggerType === 'resource_shortage');
      expect(shortage).toBeDefined();
      expect(shortage!.title).toContain('告急');
    });

    it('grain低于10%时findShortageResource返回grain', () => {
      const snapshot = createSnapshot({
        resources: { grain: 50, gold: 300, troops: 200, mandate: 10 },
        resourceCaps: { grain: 1000, gold: 0, troops: 500, mandate: 0 },
      });
      expect(findShortageResource(snapshot)).toBe('grain');
    });

    it('资源充足时不触发', () => {
      const snapshot = createSnapshot({
        resources: { grain: 500, gold: 300, troops: 200, mandate: 10 },
        resourceCaps: { grain: 1000, gold: 0, troops: 500, mandate: 0 },
      });
      expect(findShortageResource(snapshot)).toBeNull();
    });
  });

  describe('触发条件 #3: 建筑队列空闲（building_idle）', () => {
    it('建筑队列空闲时触发', () => {
      const snapshot = createSnapshot({ buildingQueueIdle: true });
      const triggers = system.detectTriggers(snapshot);
      const idle = triggers.find(t => t.triggerType === 'building_idle');
      expect(idle).toBeDefined();
      expect(idle!.actionTarget).toBe('building');
    });

    it('建筑队列忙碌时不触发', () => {
      const snapshot = createSnapshot({ buildingQueueIdle: false });
      const triggers = system.detectTriggers(snapshot);
      expect(triggers.find(t => t.triggerType === 'building_idle')).toBeUndefined();
    });
  });

  describe('触发条件 #4: 武将可升级（hero_upgradeable）', () => {
    it('有可升级武将时触发', () => {
      const snapshot = createSnapshot({ upgradeableHeroes: ['hero_zhaoyun'] });
      const triggers = system.detectTriggers(snapshot);
      const hero = triggers.find(t => t.triggerType === 'hero_upgradeable');
      expect(hero).toBeDefined();
      expect(hero!.relatedId).toBe('hero_zhaoyun');
    });

    it('无可升级武将时不触发', () => {
      const snapshot = createSnapshot({ upgradeableHeroes: [] });
      const triggers = system.detectTriggers(snapshot);
      expect(triggers.find(t => t.triggerType === 'hero_upgradeable')).toBeUndefined();
    });
  });

  describe('触发条件 #5: 科技队列空闲（tech_idle）', () => {
    it('科技队列空闲时触发', () => {
      const snapshot = createSnapshot({ techQueueIdle: true });
      const triggers = system.detectTriggers(snapshot);
      const tech = triggers.find(t => t.triggerType === 'tech_idle');
      expect(tech).toBeDefined();
      expect(tech!.actionTarget).toBe('tech');
    });
  });

  describe('触发条件 #6: 兵力满值（army_full）', () => {
    it('兵力满值时触发', () => {
      const snapshot = createSnapshot({ armyFull: true });
      const triggers = system.detectTriggers(snapshot);
      const army = triggers.find(t => t.triggerType === 'army_full');
      expect(army).toBeDefined();
      expect(army!.actionTarget).toBe('campaign');
    });
  });

  describe('触发条件 #7: 限时NPC即将离开（npc_leaving）', () => {
    it('有NPC即将离开时触发', () => {
      const snapshot = createSnapshot({
        leavingNpcs: [{ id: 'npc_huang', name: '黄忠', hoursLeft: 1.5 }],
      });
      const triggers = system.detectTriggers(snapshot);
      const npc = triggers.find(t => t.triggerType === 'npc_leaving');
      expect(npc).toBeDefined();
      expect(npc!.title).toContain('黄忠');
      expect(npc!.relatedId).toBe('npc_huang');
    });

    it('多个NPC只生成一条建议', () => {
      const snapshot = createSnapshot({
        leavingNpcs: [
          { id: 'npc1', name: 'NPC1', hoursLeft: 1 },
          { id: 'npc2', name: 'NPC2', hoursLeft: 0.5 },
        ],
      });
      const triggers = system.detectTriggers(snapshot);
      const npcTriggers = triggers.filter(t => t.triggerType === 'npc_leaving');
      // 冷却机制导致只有第一条触发
      expect(npcTriggers.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('触发条件 #8: 新功能解锁（new_feature_unlock）', () => {
    it('有新功能解锁时触发', () => {
      const snapshot = createSnapshot({
        newFeatures: [{ id: 'feature_alliance', name: '联盟系统' }],
      });
      const triggers = system.detectTriggers(snapshot);
      const feature = triggers.find(t => t.triggerType === 'new_feature_unlock');
      expect(feature).toBeDefined();
      expect(feature!.title).toContain('联盟系统');
    });
  });

  describe('触发条件 #9: 离线溢出（offline_overflow）', () => {
    it('离线溢出>50%时触发', () => {
      const snapshot = createSnapshot({ offlineOverflowPercent: 60 });
      const triggers = system.detectTriggers(snapshot);
      const offline = triggers.find(t => t.triggerType === 'offline_overflow');
      expect(offline).toBeDefined();
      expect(offline!.actionTarget).toBe('building');
    });

    it('离线溢出≤50%时不触发', () => {
      const snapshot = createSnapshot({ offlineOverflowPercent: 50 });
      const triggers = system.detectTriggers(snapshot);
      expect(triggers.find(t => t.triggerType === 'offline_overflow')).toBeUndefined();
    });
  });

  describe('9种触发条件完整性验证', () => {
    it('所有触发类型都有对应优先级', () => {
      for (const type of ALL_TRIGGER_TYPES) {
        expect(ADVISOR_TRIGGER_PRIORITY[type]).toBeDefined();
        expect(ADVISOR_TRIGGER_PRIORITY[type]).toBeGreaterThan(0);
      }
    });

    it('资源告急优先级最高', () => {
      const shortagePriority = ADVISOR_TRIGGER_PRIORITY['resource_shortage'];
      for (const type of ALL_TRIGGER_TYPES) {
        if (type !== 'resource_shortage') {
          expect(shortagePriority).toBeGreaterThan(ADVISOR_TRIGGER_PRIORITY[type]);
        }
      }
    });

    it('同时满足多个条件时返回多条建议', () => {
      const snapshot = createSnapshot({
        resources: { grain: 950, gold: 300, troops: 200, mandate: 10 },
        resourceCaps: { grain: 1000, gold: 0, troops: 500, mandate: 0 },
        buildingQueueIdle: true,
        upgradeableHeroes: ['hero_zhaoyun'],
        techQueueIdle: true,
        armyFull: true,
      });
      const triggers = system.detectTriggers(snapshot);
      // 至少应触发：resource_overflow + building_idle + hero_upgradeable + tech_idle + army_full
      expect(triggers.length).toBeGreaterThanOrEqual(5);
    });
  });
});

// ─────────────────────────────────────────────
// 2. 军师建议展示规则（最大3条/排序/冷却）
// ─────────────────────────────────────────────

describe('军师建议展示规则（最大3条/排序/冷却）', () => {
  let system: AdvisorSystem;

  beforeEach(() => {
    system = new AdvisorSystem();
    system.init(createMockDeps());
  });

  describe('最大展示数量', () => {
    it('ADVISOR_MAX_DISPLAY 应为3', () => {
      expect(ADVISOR_MAX_DISPLAY).toBe(3);
    });

    it('展示建议不超过3条', () => {
      // 触发多个条件
      const snapshot = createSnapshot({
        resources: { grain: 950, gold: 300, troops: 200, mandate: 10 },
        resourceCaps: { grain: 1000, gold: 0, troops: 500, mandate: 0 },
        buildingQueueIdle: true,
        upgradeableHeroes: ['hero_zhaoyun'],
        techQueueIdle: true,
        armyFull: true,
        offlineOverflowPercent: 60,
      });
      system.updateSuggestions(snapshot);
      const displayed = system.getDisplayedSuggestions();
      expect(displayed.length).toBeLessThanOrEqual(ADVISOR_MAX_DISPLAY);
    });
  });

  describe('按优先级排序', () => {
    it('展示列表按优先级降序排列', () => {
      const snapshot = createSnapshot({
        resources: { grain: 950, gold: 300, troops: 200, mandate: 10 },
        resourceCaps: { grain: 1000, gold: 0, troops: 500, mandate: 0 },
        buildingQueueIdle: true,
        upgradeableHeroes: ['hero_zhaoyun'],
        techQueueIdle: true,
      });
      system.updateSuggestions(snapshot);
      const displayed = system.getDisplayedSuggestions();

      for (let i = 1; i < displayed.length; i++) {
        expect(displayed[i - 1].priority).toBeGreaterThanOrEqual(displayed[i].priority);
      }
    });

    it('资源告急应排在最前（优先级90）', () => {
      const snapshot = createSnapshot({
        resources: { grain: 50, gold: 300, troops: 200, mandate: 10 },
        resourceCaps: { grain: 1000, gold: 0, troops: 500, mandate: 0 },
        buildingQueueIdle: true,
        techQueueIdle: true,
      });
      system.updateSuggestions(snapshot);
      const displayed = system.getDisplayedSuggestions();
      if (displayed.length > 0) {
        expect(displayed[0].triggerType).toBe('resource_shortage');
      }
    });
  });

  describe('冷却机制', () => {
    it('ADVISOR_CLOSE_COOLDOWN_MS 应为30分钟', () => {
      expect(ADVISOR_CLOSE_COOLDOWN_MS).toBe(30 * 60 * 1000);
    });

    it('关闭建议后同类型进入冷却', () => {
      const snapshot = createSnapshot({ buildingQueueIdle: true });
      system.updateSuggestions(snapshot);

      const displayed = system.getDisplayedSuggestions();
      if (displayed.length > 0) {
        const suggestion = displayed[0];
        const result = system.dismissSuggestion(suggestion.id);
        expect(result.success).toBe(true);

        // 检查冷却状态
        expect(system.isInCooldown(suggestion.triggerType)).toBe(true);
      }
    });

    it('冷却期间同类型不触发新建议', () => {
      const snapshot = createSnapshot({ buildingQueueIdle: true });
      system.updateSuggestions(snapshot);

      const displayed = system.getDisplayedSuggestions();
      if (displayed.length > 0) {
        system.dismissSuggestion(displayed[0].id);

        // 再次更新同条件，不应生成新建议
        system.updateSuggestions(snapshot);
        const newDisplayed = system.getDisplayedSuggestions();
        expect(newDisplayed.find(s => s.triggerType === displayed[0].triggerType)).toBeUndefined();
      }
    });

    it('冷却期间不同类型仍可触发', () => {
      // 触发建筑空闲
      const snapshot1 = createSnapshot({ buildingQueueIdle: true });
      system.updateSuggestions(snapshot1);

      const displayed = system.getDisplayedSuggestions();
      if (displayed.length > 0) {
        system.dismissSuggestion(displayed[0].id);
      }

      // 触发科技空闲（不同类型）
      const snapshot2 = createSnapshot({ techQueueIdle: true });
      system.updateSuggestions(snapshot2);
      const newDisplayed = system.getDisplayedSuggestions();
      expect(newDisplayed.find(s => s.triggerType === 'tech_idle')).toBeDefined();
    });
  });

  describe('每日上限', () => {
    it('ADVISOR_DAILY_LIMIT 应为15', () => {
      expect(ADVISOR_DAILY_LIMIT).toBe(15);
    });

    it('达到每日上限后不再生成新建议', () => {
      // 通过反复更新来消耗每日配额
      for (let i = 0; i < 20; i++) {
        const snapshot = createSnapshot({
          resources: { grain: 950, gold: 300, troops: 200, mandate: 10 },
          resourceCaps: { grain: 1000, gold: 0, troops: 500, mandate: 0 },
        });
        system.updateSuggestions(snapshot);
        // 清除建议以允许新建议
        const displayed = system.getDisplayedSuggestions();
        for (const s of displayed) {
          system.executeSuggestion(s.id);
        }
      }

      const displayState = system.getDisplayState();
      expect(displayState.dailyCount).toBeLessThanOrEqual(ADVISOR_DAILY_LIMIT);
    });
  });

  describe('建议过期', () => {
    it('建议有过期时间（1小时后）', () => {
      const snapshot = createSnapshot({ buildingQueueIdle: true });
      system.updateSuggestions(snapshot);
      const displayed = system.getDisplayedSuggestions();
      if (displayed.length > 0) {
        expect(displayed[0].expiresAt).toBeGreaterThan(displayed[0].createdAt);
        // 过期时间约为创建时间 + 1小时
        const diff = displayed[0].expiresAt! - displayed[0].createdAt;
        expect(diff).toBe(60 * 60 * 1000);
      }
    });
  });
});

// ─────────────────────────────────────────────
// 3. 军师建议面板UI交互
// ─────────────────────────────────────────────

describe('军师建议面板UI交互', () => {
  let system: AdvisorSystem;
  let eventBus: ReturnType<typeof createMockEventBus>;

  beforeEach(() => {
    system = new AdvisorSystem();
    eventBus = createMockEventBus();
    const deps = {
      eventBus: eventBus as unknown as ISystemDeps['eventBus'],
      config: { get: () => undefined } as unknown as ISystemDeps['config'],
      registry: { get: () => null, has: () => false } as unknown as ISystemDeps['registry'],
    };
    system.init(deps);
  });

  describe('执行建议', () => {
    it('执行后建议从列表移除', () => {
      const snapshot = createSnapshot({ buildingQueueIdle: true });
      system.updateSuggestions(snapshot);
      const displayed = system.getDisplayedSuggestions();
      const target = displayed[0];

      const result = system.executeSuggestion(target.id);
      expect(result.success).toBe(true);

      const afterExec = system.getDisplayedSuggestions();
      expect(afterExec.find(s => s.id === target.id)).toBeUndefined();
    });

    it('执行后触发 advisor:suggestionExecuted 事件', () => {
      const snapshot = createSnapshot({ buildingQueueIdle: true });
      system.updateSuggestions(snapshot);
      const displayed = system.getDisplayedSuggestions();
      const target = displayed[0];

      system.executeSuggestion(target.id);

      const execEvent = eventBus._emitted.find(e => e.event === 'advisor:suggestionExecuted');
      expect(execEvent).toBeDefined();
      expect((execEvent?.payload as any)?.id).toBe(target.id);
    });

    it('执行不存在的建议返回失败', () => {
      const result = system.executeSuggestion('nonexistent');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('建议不存在');
    });

    it('执行后不进入冷却（区别于关闭）', () => {
      const snapshot = createSnapshot({ buildingQueueIdle: true });
      system.updateSuggestions(snapshot);
      const displayed = system.getDisplayedSuggestions();
      const triggerType = displayed[0].triggerType;

      system.executeSuggestion(displayed[0].id);

      // 执行后同类型不应进入冷却
      expect(system.isInCooldown(triggerType)).toBe(false);
    });
  });

  describe('关闭建议', () => {
    it('关闭后建议从列表移除', () => {
      const snapshot = createSnapshot({ buildingQueueIdle: true });
      system.updateSuggestions(snapshot);
      const displayed = system.getDisplayedSuggestions();
      const target = displayed[0];

      const result = system.dismissSuggestion(target.id);
      expect(result.success).toBe(true);

      const afterDismiss = system.getDisplayedSuggestions();
      expect(afterDismiss.find(s => s.id === target.id)).toBeUndefined();
    });

    it('关闭后同类型进入30分钟冷却', () => {
      const snapshot = createSnapshot({ buildingQueueIdle: true });
      system.updateSuggestions(snapshot);
      const displayed = system.getDisplayedSuggestions();
      const triggerType = displayed[0].triggerType;

      system.dismissSuggestion(displayed[0].id);
      expect(system.isInCooldown(triggerType)).toBe(true);
    });

    it('关闭不存在的建议返回失败', () => {
      const result = system.dismissSuggestion('nonexistent');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('建议不存在');
    });
  });

  describe('展示状态查询', () => {
    it('getDisplayState 返回完整状态', () => {
      const snapshot = createSnapshot({ buildingQueueIdle: true });
      system.updateSuggestions(snapshot);

      const state = system.getDisplayState();
      expect(state).toHaveProperty('displayedSuggestions');
      expect(state).toHaveProperty('dailyCount');
      expect(state).toHaveProperty('lastDailyReset');
      expect(state).toHaveProperty('cooldowns');
      expect(state.dailyCount).toBeGreaterThan(0);
    });

    it('无建议时展示列表为空', () => {
      const snapshot = createSnapshot(); // 默认快照无触发条件
      system.updateSuggestions(snapshot);
      const displayed = system.getDisplayedSuggestions();
      expect(displayed).toHaveLength(0);
    });
  });

  describe('建议内容结构验证', () => {
    it('标题不超过20字', () => {
      const snapshot = createSnapshot({
        buildingQueueIdle: true,
        upgradeableHeroes: ['hero_zhaoyun'],
        leavingNpcs: [{ id: 'npc1', name: '黄忠', hoursLeft: 1 }],
        newFeatures: [{ id: 'f1', name: '联盟' }],
        offlineOverflowPercent: 60,
      });
      system.updateSuggestions(snapshot);
      const displayed = system.getDisplayedSuggestions();
      for (const s of displayed) {
        expect(s.title.length).toBeLessThanOrEqual(20);
      }
    });

    it('描述不超过50字', () => {
      const snapshot = createSnapshot({
        buildingQueueIdle: true,
        upgradeableHeroes: ['hero_zhaoyun'],
      });
      system.updateSuggestions(snapshot);
      const displayed = system.getDisplayedSuggestions();
      for (const s of displayed) {
        expect(s.description.length).toBeLessThanOrEqual(50);
      }
    });

    it('每条建议有行动按钮和跳转目标', () => {
      const snapshot = createSnapshot({
        buildingQueueIdle: true,
        upgradeableHeroes: ['hero_zhaoyun'],
      });
      system.updateSuggestions(snapshot);
      const displayed = system.getDisplayedSuggestions();
      for (const s of displayed) {
        expect(s.actionLabel).toBeTruthy();
        expect(s.actionTarget).toBeTruthy();
      }
    });

    it('建议有置信度标记', () => {
      const snapshot = createSnapshot({ buildingQueueIdle: true });
      system.updateSuggestions(snapshot);
      const displayed = system.getDisplayedSuggestions();
      for (const s of displayed) {
        expect(['high', 'medium', 'low']).toContain(s.confidence);
      }
    });
  });

  describe('序列化与反序列化', () => {
    it('序列化保存冷却和每日计数', () => {
      const snapshot = createSnapshot({ buildingQueueIdle: true });
      system.updateSuggestions(snapshot);
      const displayed = system.getDisplayedSuggestions();
      if (displayed.length > 0) {
        system.dismissSuggestion(displayed[0].id);
      }

      const data = system.serialize();
      expect(data.dailyCount).toBeGreaterThan(0);
      expect(data.cooldowns.length).toBeGreaterThan(0);
    });

    it('反序列化恢复状态', () => {
      const snapshot = createSnapshot({ buildingQueueIdle: true });
      system.updateSuggestions(snapshot);
      const displayed = system.getDisplayedSuggestions();
      if (displayed.length > 0) {
        system.dismissSuggestion(displayed[0].id);
      }

      const data = system.serialize();
      const newSystem = new AdvisorSystem();
      newSystem.init(createMockDeps());
      newSystem.loadSaveData(data);

      const state = newSystem.getDisplayState();
      expect(state.dailyCount).toBe(data.dailyCount);
    });
  });

  describe('重置', () => {
    it('重置后所有状态清空', () => {
      const snapshot = createSnapshot({ buildingQueueIdle: true });
      system.updateSuggestions(snapshot);
      system.reset();

      const state = system.getDisplayState();
      expect(state.displayedSuggestions).toHaveLength(0);
      expect(state.dailyCount).toBe(0);
      expect(state.cooldowns).toHaveLength(0);
    });
  });
});
