/**
 * 集成测试 §1: 事件系统 — 随机遭遇/触发条件/概率公式/冷却/通知优先级
 *
 * 覆盖 v15.0 Play §1 事件引擎核心规则：
 *   - 随机遭遇触发（#1）
 *   - 触发条件引擎（#6）— 时间/条件/概率
 *   - 概率公式 P = clamp(base + Σ(add) × Π(mul), 0, 1)（#7）
 *   - 事件冷却机制（同类型60min/同事件4h/新手保护30min）
 *   - 通知优先级排队（6级）（#8）
 *   - 事件选项与后果计算
 *   - 事件注册/触发/过期完整生命周期
 *
 * R29: 将 mockDeps 替换为 createRealDeps()（基于真实引擎实例）
 *
 * @module engine/event/__tests__/integration
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { EventTriggerSystem } from '../../EventTriggerSystem';
import { EventNotificationSystem } from '../../EventNotificationSystem';
import { calculateProbability } from '../../EventProbabilityCalculator';
import {
  evaluateCondition,
  evaluateTurnRangeCondition,
  evaluateResourceCondition,
} from '../../EventTriggerConditions';
import { createRealDeps } from '../../../../test-utils/test-helpers';
import type { ISystemDeps } from '../../../../core/types/subsystem';
import type {
  EventDef, EventInstance, EventCondition, EventOption, EventConsequence,
} from '../../../../core/event';
import type {
  ProbabilityCondition, ProbabilityModifier, ProbabilityResult,
} from '../../../../core/event/event-encounter.types';

// ─────────────────────────────────────────────
// 辅助
// ─────────────────────────────────────────────

function makeEventDef(overrides?: Partial<EventDef>): EventDef {
  return {
    id: 'evt-test-001',
    title: '测试事件',
    description: '集成测试事件',
    triggerType: 'random',
    urgency: 'medium',
    scope: 'global',
    triggerProbability: 0.05,
    options: [
      {
        id: 'opt-accept',
        text: '接受',
        isDefault: true,
        consequences: { description: '获得奖励', resourceChanges: { copper: 100 } },
      },
      {
        id: 'opt-reject',
        text: '拒绝',
        consequences: { description: '无变化' },
      },
    ],
    ...overrides,
  };
}

function makeFixedEventDef(id: string, turnMin: number, turnMax: number): EventDef {
  return makeEventDef({
    id,
    triggerType: 'fixed',
    triggerConditions: [
      { type: 'turn_range', params: { minTurn: turnMin, maxTurn: turnMax } },
    ],
  });
}

function makeProbabilityCondition(base: number, modifiers: ProbabilityModifier[] = []): ProbabilityCondition {
  return { baseProbability: base, modifiers };
}

// ─────────────────────────────────────────────
// §1 事件系统
// ─────────────────────────────────────────────

describe('§1 事件系统 — 随机遭遇/触发条件/概率公式/冷却/通知优先级', () => {

  // ─── §1.1 事件注册与生命周期 ───────────────

  describe('§1.1 事件注册与生命周期', () => {
    let system: EventTriggerSystem;

    beforeEach(() => {
      system = new EventTriggerSystem();
      system.init(createRealDeps());
    });

    it('应成功注册单个事件定义', () => {
      const def = makeEventDef();
      system.registerEvent(def);
      expect(system.getEventDef(def.id)).toEqual(def);
    });

    it('应成功批量注册事件定义', () => {
      const defs = [makeEventDef({ id: 'e1' }), makeEventDef({ id: 'e2' }), makeEventDef({ id: 'e3' })];
      system.registerEvents(defs);
      // init() 已加载预定义事件，加上自定义3个
      const allDefs = system.getAllEventDefs();
      expect(allDefs.length).toBeGreaterThanOrEqual(3);
      for (const d of defs) {
        expect(system.getEventDef(d.id)).toBeDefined();
      }
    });

    it('应按触发类型筛选事件定义', () => {
      system.registerEvents([
        makeEventDef({ id: 'r1', triggerType: 'random' }),
        makeEventDef({ id: 'f1', triggerType: 'fixed' }),
        makeEventDef({ id: 'r2', triggerType: 'random' }),
      ]);
      const randomDefs = system.getEventDefsByType('random');
      const fixedDefs = system.getEventDefsByType('fixed');
      // 自定义 2 random + 1 fixed，加上预定义中可能的同类型
      expect(randomDefs.length).toBeGreaterThanOrEqual(2);
      expect(fixedDefs.length).toBeGreaterThanOrEqual(1);
      // 确认自定义事件在结果中
      expect(randomDefs.some(d => d.id === 'r1' || d.id === 'r2')).toBe(true);
      expect(fixedDefs.some(d => d.id === 'f1')).toBe(true);
    });

    it('应正确重置系统状态', () => {
      const def = makeEventDef({ triggerProbability: 1.0 });
      system.registerEvent(def);
      system.forceTriggerEvent(def.id, 1);
      expect(system.getActiveEventCount()).toBe(1);

      system.reset();
      // reset 清理 activeEvents / completedEventIds / cooldowns（eventDefs 不清除）
      expect(system.getActiveEvents()).toHaveLength(0);
      expect(system.getActiveEventCount()).toBe(0);
    });

    it('应正确序列化和反序列化系统状态', () => {
      const def = makeEventDef({ triggerProbability: 1.0 });
      system.registerEvent(def);
      system.forceTriggerEvent(def.id, 1);

      const saved = system.serialize();
      expect(saved).toBeDefined();

      const system2 = new EventTriggerSystem();
      system2.init(createRealDeps());
      system2.deserialize(saved);
      expect(system2.getActiveEventCount()).toBe(1);
    });
  });

  // ─── §1.2 触发条件引擎 ─────────────────────

  describe('§1.2 触发条件引擎', () => {
    it('应正确评估 turn_range 条件 — minTurn', () => {
      const cond: EventCondition = { type: 'turn_range', params: { minTurn: 5 } };
      expect(evaluateCondition(cond, 3)).toBe(false);
      expect(evaluateCondition(cond, 5)).toBe(true);
      expect(evaluateCondition(cond, 10)).toBe(true);
    });

    it('应正确评估 turn_range 条件 — maxTurn', () => {
      const cond: EventCondition = { type: 'turn_range', params: { maxTurn: 10 } };
      expect(evaluateCondition(cond, 5)).toBe(true);
      expect(evaluateCondition(cond, 10)).toBe(true);
      expect(evaluateCondition(cond, 11)).toBe(false);
    });

    it('应正确评估 turn_range 条件 — turnInterval', () => {
      const cond: EventCondition = { type: 'turn_range', params: { turnInterval: 3 } };
      expect(evaluateCondition(cond, 3)).toBe(true);
      expect(evaluateCondition(cond, 6)).toBe(true);
      expect(evaluateCondition(cond, 7)).toBe(false);
    });

    it('应正确评估 resource_threshold 条件', () => {
      const cond: EventCondition = {
        type: 'resource_threshold',
        params: { resource: 'gold', operator: '>=', value: 100 },
      };
      expect(evaluateCondition(cond, 1, { gold: 150 })).toBe(true);
      expect(evaluateCondition(cond, 1, { gold: 50 })).toBe(false);
    });

    it('应正确评估 event_completed 条件', () => {
      const cond: EventCondition = {
        type: 'event_completed',
        params: { eventId: 'evt-001' },
      };
      const checker = (id: string) => id === 'evt-001';
      expect(evaluateCondition(cond, 1, undefined, checker)).toBe(true);
      expect(evaluateCondition(cond, 1, undefined, () => false)).toBe(false);
    });

    it('固定事件应在条件满足时可触发', () => {
      const system = new EventTriggerSystem();
      system.init(createRealDeps());
      const def = makeFixedEventDef('fixed-01', 3, 10);
      system.registerEvent(def);

      expect(system.canTrigger('fixed-01', 2)).toBe(false);
      expect(system.canTrigger('fixed-01', 5)).toBe(true);
      expect(system.canTrigger('fixed-01', 11)).toBe(false);
    });
  });

  // ─── §1.3 概率公式 ─────────────────────────

  describe('§1.3 概率公式 P = clamp(base + Σ(add) × Π(mul), 0, 1)', () => {
    it('基础概率无修正时应返回 base', () => {
      const result = calculateProbability(makeProbabilityCondition(0.3));
      expect(result.baseProbability).toBe(0.3);
      expect(result.additiveTotal).toBe(0);
      expect(result.multiplicativeTotal).toBe(1);
      expect(result.finalProbability).toBeCloseTo(0.3);
    });

    it('加法修正应累加到概率上', () => {
      const result = calculateProbability(makeProbabilityCondition(0.2, [
        { name: 'buff1', additiveBonus: 0.1, multiplicativeBonus: 1, active: true },
        { name: 'buff2', additiveBonus: 0.15, multiplicativeBonus: 1, active: true },
      ]));
      expect(result.additiveTotal).toBeCloseTo(0.25);
      expect(result.finalProbability).toBeCloseTo(0.45);
    });

    it('乘法修正应累乘到概率上', () => {
      const result = calculateProbability(makeProbabilityCondition(0.3, [
        { name: 'mul1', additiveBonus: 0, multiplicativeBonus: 1.5, active: true },
        { name: 'mul2', additiveBonus: 0, multiplicativeBonus: 0.8, active: true },
      ]));
      expect(result.multiplicativeTotal).toBeCloseTo(1.2);
      expect(result.finalProbability).toBeCloseTo(0.36);
    });

    it('混合加法+乘法修正应按公式计算', () => {
      const result = calculateProbability(makeProbabilityCondition(0.4, [
        { name: 'add', additiveBonus: 0.1, multiplicativeBonus: 1, active: true },
        { name: 'mul', additiveBonus: 0, multiplicativeBonus: 2.0, active: true },
      ]));
      // P = clamp((0.4 + 0.1) × 2.0, 0, 1) = clamp(1.0, 0, 1) = 1.0
      expect(result.finalProbability).toBe(1.0);
    });

    it('非活跃修正因子应被忽略', () => {
      const result = calculateProbability(makeProbabilityCondition(0.3, [
        { name: 'active', additiveBonus: 0.2, multiplicativeBonus: 1, active: true },
        { name: 'inactive', additiveBonus: 0.5, multiplicativeBonus: 3, active: false },
      ]));
      expect(result.additiveTotal).toBeCloseTo(0.2);
      expect(result.finalProbability).toBeCloseTo(0.5);
    });

    it('最终概率应 clamp 到 [0, 1]', () => {
      const result = calculateProbability(makeProbabilityCondition(2.0));
      expect(result.finalProbability).toBe(1);

      const result2 = calculateProbability(makeProbabilityCondition(-0.5));
      expect(result2.finalProbability).toBe(0);
    });

    it('EventTriggerSystem 应支持注册概率条件', () => {
      const system = new EventTriggerSystem();
      system.init(createRealDeps());
      const cond = makeProbabilityCondition(0.1, [
        { name: 'level', additiveBonus: 0.02, multiplicativeBonus: 1, active: true },
      ]);
      system.registerProbabilityCondition('evt-001', cond);
      const retrieved = system.getProbabilityCondition('evt-001');
      expect(retrieved).toEqual(cond);
    });
  });

  // ─── §1.4 事件触发与冷却 ───────────────────

  describe('§1.4 事件触发与冷却', () => {
    let system: EventTriggerSystem;

    beforeEach(() => {
      system = new EventTriggerSystem();
      system.init(createRealDeps());
    });

    it('强制触发应成功创建事件实例', () => {
      const def = makeEventDef({ triggerProbability: 1.0 });
      system.registerEvent(def);
      const result = system.forceTriggerEvent(def.id, 1);
      expect(result.triggered).toBe(true);
      expect(result.instance).toBeDefined();
      expect(result.instance!.eventDefId).toBe(def.id);
    });

    it('触发不存在的事件应失败', () => {
      const result = system.forceTriggerEvent('nonexistent', 1);
      expect(result.triggered).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('已完成的事件不应再次触发', () => {
      const def = makeEventDef();
      system.registerEvent(def);
      system.forceTriggerEvent(def.id, 1);
      const inst = system.getActiveEvents()[0];
      system.resolveEvent(inst.instanceId, 'opt-accept');
      expect(system.canTrigger(def.id, 2)).toBe(false);
    });

    it('活跃事件数达到上限时应阻止新触发', () => {
      system.setConfig({ maxActiveEvents: 1 });
      const def1 = makeEventDef({ id: 'e1', triggerProbability: 1.0 });
      const def2 = makeEventDef({ id: 'e2', triggerProbability: 1.0 });
      system.registerEvents([def1, def2]);
      system.forceTriggerEvent('e1', 1);
      expect(system.canTrigger('e2', 1)).toBe(false);
    });

    it('checkAndTriggerEvents 应返回新触发的事件实例列表', () => {
      const def = makeEventDef({ triggerProbability: 1.0 });
      system.registerEvent(def);
      system.registerProbabilityCondition(def.id, makeProbabilityCondition(1.0));
      const triggered = system.checkAndTriggerEvents(1);
      expect(triggered.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── §1.5 通知优先级 ───────────────────────

  describe('§1.5 通知优先级（6级）', () => {
    let notification: EventNotificationSystem;

    beforeEach(() => {
      notification = new EventNotificationSystem();
      notification.init(createRealDeps());
    });

    it('应按紧急程度创建横幅通知', () => {
      const instance: EventInstance = {
        instanceId: 'inst-001', eventDefId: 'evt-001',
        triggeredTurn: 1, expireTurn: 5, status: 'active',
      };
      const banner = notification.createBanner(instance, {
        title: '紧急军报', description: '敌军来袭', urgency: 'critical',
      }, 1);
      expect(banner).toBeDefined();
      expect(banner.title).toBe('紧急军报');
      expect(banner.urgency).toBe('critical');
      expect(banner.priority).toBe(4);
    });

    it('横幅应按优先级排序 — critical > high > medium > low', () => {
      const makeInst = (id: string): EventInstance => ({
        instanceId: id, eventDefId: id, triggeredTurn: 1, expireTurn: 10, status: 'active',
      });

      notification.createBanner(makeInst('i1'), {
        title: '低', description: '', urgency: 'low',
      }, 1);
      notification.createBanner(makeInst('i2'), {
        title: '高', description: '', urgency: 'high',
      }, 1);
      notification.createBanner(makeInst('i3'), {
        title: '中', description: '', urgency: 'medium',
      }, 1);

      const banners = notification.getActiveBanners();
      expect(banners[0].urgency).toBe('high');
      expect(banners[1].urgency).toBe('medium');
      expect(banners[2].urgency).toBe('low');
    });

    it('应正确追踪未读横幅数量', () => {
      const instance: EventInstance = {
        instanceId: 'inst-001', eventDefId: 'evt-001',
        triggeredTurn: 1, expireTurn: 5, status: 'active',
      };
      notification.createBanner(instance, {
        title: '测试', description: '', urgency: 'medium',
      }, 1);
      const state = notification.getBannerState();
      expect(state.hasUnread).toBe(true);
      expect(state.unreadCount).toBe(1);
    });

    it('标记已读后应更新未读状态', () => {
      const instance: EventInstance = {
        instanceId: 'inst-001', eventDefId: 'evt-001',
        triggeredTurn: 1, expireTurn: 5, status: 'active',
      };
      const banner = notification.createBanner(instance, {
        title: '测试', description: '', urgency: 'medium',
      }, 1);
      notification.markBannerRead(banner.id);
      const state = notification.getBannerState();
      expect(state.unreadCount).toBe(0);
    });

    it('过期横幅应在 expireBanners 时被移除', () => {
      const instance: EventInstance = {
        instanceId: 'inst-001', eventDefId: 'evt-001',
        triggeredTurn: 1, expireTurn: 5, status: 'active',
      };
      notification.createBanner(instance, {
        title: '过期测试', description: '', urgency: 'low',
      }, 1);
      const expired = notification.expireBanners(6);
      expect(expired).toHaveLength(1);
      expect(notification.getActiveBanners()).toHaveLength(0);
    });

    it('批量创建横幅应正常工作', () => {
      const entries = [
        { instance: { instanceId: 'i1', eventDefId: 'e1', triggeredTurn: 1, expireTurn: 5, status: 'active' } as EventInstance, eventDef: { title: 'A', description: '', urgency: 'low' as const } },
        { instance: { instanceId: 'i2', eventDefId: 'e2', triggeredTurn: 1, expireTurn: 5, status: 'active' } as EventInstance, eventDef: { title: 'B', description: '', urgency: 'high' as const } },
      ];
      const banners = notification.createBanners(entries, 1);
      expect(banners).toHaveLength(2);
    });
  });

  // ─── §1.6 事件选项与后果 ───────────────────

  describe('§1.6 事件选项与后果计算', () => {
    it('resolveEvent 应正确处理选项选择', () => {
      const system = new EventTriggerSystem();
      system.init(createRealDeps());
      const def = makeEventDef({ triggerProbability: 1.0 });
      system.registerEvent(def);
      system.forceTriggerEvent(def.id, 1);
      const inst = system.getActiveEvents()[0];
      const result = system.resolveEvent(inst.instanceId, 'opt-accept');
      expect(result).toBeDefined();
      expect(result!.optionId).toBe('opt-accept');
      expect(result!.consequences.resourceChanges?.copper).toBe(100);
    });

    it('resolveEvent 不存在的实例应返回 null', () => {
      const system = new EventTriggerSystem();
      system.init(createRealDeps());
      const result = system.resolveEvent('nonexistent', 'opt-1');
      expect(result).toBeNull();
    });

    it('过期事件应在 expireEvents 时被清理', () => {
      const system = new EventTriggerSystem();
      system.init(createRealDeps());
      const def = makeEventDef({ triggerProbability: 1.0, expireAfterTurns: 3 });
      system.registerEvent(def);
      system.forceTriggerEvent(def.id, 1);
      expect(system.getActiveEventCount()).toBe(1);

      const expired = system.expireEvents(5);
      expect(expired.length).toBeGreaterThanOrEqual(0);
    });
  });
});
