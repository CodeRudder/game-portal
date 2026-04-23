import { EventTriggerSystem } from '../EventTriggerSystem';
import type { ISystemDeps } from '../../../core/types';
import type {
import type { ProbabilityCondition } from '../../../core/event/event-v15-event.types';
import {


      const expired = sys.expireEvents(5);
      expect(expired.length).toBeGreaterThanOrEqual(1);
    });

    it('expireEvents 不清理未过期事件', () => {
      const def = createRandomEventDef({ expireAfterTurns: 10 });
      sys.registerEvent(def);
      sys.forceTriggerEvent(def.id, 1);

      const expired = sys.expireEvents(5);
      const hasOurEvent = expired.some(e => e.eventDefId === def.id);
      expect(hasOurEvent).toBe(false);
    });

    it('expireEvents 发出 event:expired 事件', () => {
      const deps = mockDeps();
      const s = new EventTriggerSystem();
      s.init(deps);
      const def = createRandomEventDef({ expireAfterTurns: 2 });
      s.registerEvent(def);
      s.forceTriggerEvent(def.id, 1);

      s.expireEvents(5);
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'event:expired',
        expect.objectContaining({
          eventDefId: def.id,
        }),
      );
    });
  });

  // ═══════════════════════════════════════════
  // 8. 活跃事件管理
  // ═══════════════════════════════════════════
  describe('活跃事件管理', () => {
    it('getActiveEvents 返回活跃事件列表', () => {
      const def = createRandomEventDef();
      sys.registerEvent(def);
      sys.forceTriggerEvent(def.id, 1);

      expect(sys.getActiveEvents().length).toBeGreaterThanOrEqual(1);
    });

    it('getInstance 获取指定实例', () => {
      const def = createRandomEventDef();
      sys.registerEvent(def);
      const r = sys.forceTriggerEvent(def.id, 1);

      expect(sys.getInstance(r.instance!.instanceId)).toBeDefined();
    });

    it('getInstance 不存在返回 undefined', () => {
      expect(sys.getInstance('non-existent')).toBeUndefined();
    });

    it('getCompletedEventIds 返回已完成事件', () => {
      const def = createRandomEventDef();
      sys.registerEvent(def);
      const r = sys.forceTriggerEvent(def.id, 1);
      sys.resolveEvent(r.instance!.instanceId, 'opt-a');

      expect(sys.getCompletedEventIds()).toContain(def.id);
    });
  });

  // ═══════════════════════════════════════════
  // 9. 事件类型矩阵完整性
  // ═══════════════════════════════════════════
  describe('事件类型矩阵完整性', () => {
    it('预定义事件包含三种类型', () => {
      const types = new Set(Object.values(PREDEFINED_EVENTS).map(d => d.triggerType));
      expect(types.has('random')).toBe(true);
      expect(types.has('fixed')).toBe(true);
      expect(types.has('chain')).toBe(true);
    });

    it('预定义事件ID唯一', () => {
      const ids = Object.values(PREDEFINED_EVENTS).map(d => d.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('每个事件至少有一个选项', () => {
      for (const def of Object.values(PREDEFINED_EVENTS)) {
        expect(def.options.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('每个选项都有后果定义', () => {
      for (const def of Object.values(PREDEFINED_EVENTS)) {
        for (const opt of def.options) {
          expect(opt.consequences).toBeDefined();
        }
      }
    });
  });

  // ═══════════════════════════════════════════
  // 10. 存档序列化
  // ═══════════════════════════════════════════
  describe('存档序列化', () => {
    it('serialize 导出完整存档', () => {
      const data = sys.serialize();
      expect(data).toHaveProperty('activeEvents');
      expect(data).toHaveProperty('completedEventIds');
      expect(data).toHaveProperty('cooldowns');
      expect(data).toHaveProperty('version');
    });

    it('deserialize 恢复存档', () => {
      const def = createRandomEventDef();
      sys.registerEvent(def);
      sys.forceTriggerEvent(def.id, 1);

      const data = sys.serialize();
      const newSys = createSystem();
      newSys.deserialize(data);

      expect(newSys.getActiveEvents().length).toBe(data.activeEvents.length);
    });

    it('deserialize 恢复已完成事件', () => {
      const def = createRandomEventDef();
      sys.registerEvent(def);
      const r = sys.forceTriggerEvent(def.id, 1);
      sys.resolveEvent(r.instance!.instanceId, 'opt-a');

      const data = sys.serialize();
      const newSys = createSystem();
      newSys.deserialize(data);

      expect(newSys.isEventCompleted(def.id)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 11. 配置
  // ═══════════════════════════════════════════
  describe('配置', () => {
    it('getConfig 返回默认配置', () => {
      const config = sys.getConfig();
      expect(config.randomEventProbability).toBe(DEFAULT_EVENT_TRIGGER_CONFIG.randomEventProbability);
      expect(config.maxActiveEvents).toBe(DEFAULT_EVENT_TRIGGER_CONFIG.maxActiveEvents);
    });

    it('setConfig 更新配置', () => {
      sys.setConfig({ randomEventProbability: 0.8 });
      expect(sys.getConfig().randomEventProbability).toBe(0.8);
    });
  });

  // ═══════════════════════════════════════════
  // 12. canTrigger 综合测试
  // ═══════════════════════════════════════════
  describe('canTrigger 综合测试', () => {
    it('已完成的事件不能再触发', () => {
      const def = createRandomEventDef();
      sys.registerEvent(def);
      const r = sys.forceTriggerEvent(def.id, 1);
      sys.resolveEvent(r.instance!.instanceId, 'opt-a');

      expect(sys.canTrigger(def.id, 2)).toBe(false);
    });

    it('活跃事件不能重复触发', () => {
      const def = createRandomEventDef();
      sys.registerEvent(def);
      sys.forceTriggerEvent(def.id, 1);

      expect(sys.canTrigger(def.id, 1)).toBe(false);
    });

    it('不存在的事件不能触发', () => {
      expect(sys.canTrigger('non-existent', 1)).toBe(false);
    });

    it('达到最大活跃事件数时不能再触发', () => {
      const maxEvents = sys.getConfig().maxActiveEvents;

      for (let i = 0; i < maxEvents; i++) {
        const def = createRandomEventDef({ id: `max-test-${i}` });
        sys.registerEvent(def);
        sys.forceTriggerEvent(def.id, 1);
      }

      const extraDef = createRandomEventDef({ id: 'extra' });
      sys.registerEvent(extraDef);
      expect(sys.canTrigger('extra', 1)).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 13. 概率计算（v15 迁移）
  // ═══════════════════════════════════════════
  describe('概率计算', () => {
    it('calculateProbability — 仅基础概率，无修正', () => {
      const result = sys.calculateProbability({
        baseProbability: 0.5,
        modifiers: [],
      });
      expect(result.baseProbability).toBe(0.5);
      expect(result.additiveTotal).toBe(0);
      expect(result.multiplicativeTotal).toBe(1);
      expect(result.finalProbability).toBe(0.5);
    });

    it('calculateProbability — 公式 P = clamp(base + Σ(add) × Π(mul), 0, 1)', () => {
      const result = sys.calculateProbability({
        baseProbability: 0.3,
        modifiers: [
          { name: 'bonus1', additiveBonus: 0.1, multiplicativeBonus: 1.2, active: true },
          { name: 'bonus2', additiveBonus: 0.05, multiplicativeBonus: 0.9, active: true },
        ],
      });
      // Σ(add) = 0.1 + 0.05 = 0.15
      expect(result.additiveTotal).toBeCloseTo(0.15);
      // Π(mul) = 1.2 × 0.9 = 1.08
      expect(result.multiplicativeTotal).toBeCloseTo(1.08);
      // P = clamp((0.3 + 0.15) × 1.08, 0, 1) = clamp(0.486, 0, 1) = 0.486
      expect(result.finalProbability).toBeCloseTo(0.486);
    });

    it('calculateProbability — 非活跃修正不参与计算', () => {
      const result = sys.calculateProbability({
        baseProbability: 0.5,
        modifiers: [
          { name: 'active', additiveBonus: 0.2, multiplicativeBonus: 1.5, active: true },
          { name: 'inactive', additiveBonus: 0.5, multiplicativeBonus: 2.0, active: false },
        ],
      });
      // Σ(add) = 0.2 (仅 active)
      expect(result.additiveTotal).toBeCloseTo(0.2);
      // Π(mul) = 1.5 (仅 active)
      expect(result.multiplicativeTotal).toBeCloseTo(1.5);
      // P = clamp((0.5 + 0.2) × 1.5, 0, 1) = clamp(1.05, 0, 1) = 1.0
      expect(result.finalProbability).toBe(1.0);
    });

    it('calculateProbability — 结果 clamp 到 [0, 1]', () => {
      // 上限 clamp
      const high = sys.calculateProbability({
        baseProbability: 0.8,
        modifiers: [
          { name: 'big', additiveBonus: 0.5, multiplicativeBonus: 2.0, active: true },
        ],
      });
      // P = clamp((0.8 + 0.5) × 2.0, 0, 1) = clamp(2.6, 0, 1) = 1.0
      expect(high.finalProbability).toBe(1.0);

      // 下限 clamp
      const low = sys.calculateProbability({
        baseProbability: 0.1,
        modifiers: [
          { name: 'neg', additiveBonus: -0.2, multiplicativeBonus: 1.0, active: true },
        ],
      });
      // P = clamp((0.1 + (-0.2)) × 1.0, 0, 1) = clamp(-0.1, 0, 1) = 0.0
      expect(low.finalProbability).toBe(0.0);
    });

    it('calculateProbability — triggered 由随机数决定', () => {
      // baseProbability = 1.0 时必然触发
      const always = sys.calculateProbability({
        baseProbability: 1.0,
        modifiers: [],
      });
      expect(always.triggered).toBe(true);

      // baseProbability = 0.0 时永远不触发
      const never = sys.calculateProbability({
        baseProbability: 0.0,
        modifiers: [],
      });
      expect(never.triggered).toBe(false);
    });

    it('registerProbabilityCondition / getProbabilityCondition / reset', () => {
      // 未注册返回 undefined
      expect(sys.getProbabilityCondition('non-existent')).toBeUndefined();

      // 注册后可获取
      const condition: ProbabilityCondition = {
        baseProbability: 0.4,
        modifiers: [{ name: 'test', additiveBonus: 0.1, multiplicativeBonus: 1.0, active: true }],
      };
      sys.registerProbabilityCondition('test-event', condition);
      expect(sys.getProbabilityCondition('test-event')).toEqual(condition);

      // reset 清除
      sys.reset();
      expect(sys.getProbabilityCondition('test-event')).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════
  // 14. 条件评估
  // ═══════════════════════════════════════════
  describe('条件评估', () => {
    describe('turn_range 条件', () => {
      it('minTurn / maxTurn / turnInterval 组合验证', () => {
        // minTurn
        const minDef = createFixedEventDef({
          id: 'turn-min', triggerConditions: [{ type: 'turn_range', params: { minTurn: 5 } }],
        });
        sys.registerEvent(minDef);
        expect(sys.canTrigger('turn-min', 3)).toBe(false);
        expect(sys.canTrigger('turn-min', 5)).toBe(true);

        // maxTurn
        const maxDef = createFixedEventDef({
          id: 'turn-max', triggerConditions: [{ type: 'turn_range', params: { maxTurn: 10 } }],
        });
        sys.registerEvent(maxDef);
        expect(sys.canTrigger('turn-max', 10)).toBe(true);
        expect(sys.canTrigger('turn-max', 11)).toBe(false);

        // turnInterval
        const intDef = createFixedEventDef({
          id: 'turn-int', triggerConditions: [{ type: 'turn_range', params: { turnInterval: 5 } }],
        });
        sys.registerEvent(intDef);
        expect(sys.canTrigger('turn-int', 5)).toBe(true);
        expect(sys.canTrigger('turn-int', 7)).toBe(false);

        // 组合 minTurn + maxTurn
        const rangeDef = createFixedEventDef({
          id: 'turn-range', triggerConditions: [{ type: 'turn_range', params: { minTurn: 3, maxTurn: 8 } }],
        });
        sys.registerEvent(rangeDef);
        expect(sys.canTrigger('turn-range', 2)).toBe(false);
        expect(sys.canTrigger('turn-range', 5)).toBe(true);
        expect(sys.canTrigger('turn-range', 9)).toBe(false);
      });
    });

    describe('resource_threshold 条件', () => {
      it('资源满足条件时触发', () => {
        const def = createFixedEventDef({
          id: 'res-check',
          triggerConditions: [
            { type: 'resource_threshold', params: { resource: 'gold', minAmount: 100 } },
          ],
        });
        sys.registerEvent(def);

        // 无 gameState 时默认通过（兼容旧逻辑）
        expect(sys.canTrigger('res-check', 1)).toBe(true);
      });
    });

    describe('event_completed 条件', () => {
      it('前置事件完成后可触发，无 eventId 默认通过', () => {
        // 无 eventId 默认通过
        const noIdDef = createFixedEventDef({
          id: 'no-event-id',
          triggerConditions: [{ type: 'event_completed', params: {} }],
        });
        sys.registerEvent(noIdDef);
        expect(sys.canTrigger('no-event-id', 1)).toBe(true);

        // 注册前置事件
        const pre = createRandomEventDef({ id: 'pre-event' });
        sys.registerEvent(pre);

        const def = createFixedEventDef({
          id: 'need-complete',
          triggerConditions: [{ type: 'event_completed', params: { eventId: 'pre-event' } }],
        });
        sys.registerEvent(def);

        // 未完成前置
        expect(sys.canTrigger('need-complete', 1)).toBe(false);

        // 完成前置事件
        const r = sys.forceTriggerEvent('pre-event', 1);
        sys.resolveEvent(r.instance!.instanceId, 'opt-a');
        expect(sys.canTrigger('need-complete', 2)).toBe(true);
      });
    });

    describe('多条件 AND 逻辑', () => {
      it('所有条件必须满足', () => {
        const def = createFixedEventDef({
          id: 'multi-cond',
          triggerConditions: [
            { type: 'turn_range', params: { minTurn: 5 } },
            { type: 'turn_range', params: { maxTurn: 10 } },
          ],
        });
        sys.registerEvent(def);

        // turn=3 → minTurn 不满足
        expect(sys.canTrigger('multi-cond', 3)).toBe(false);
        // turn=7 → 都满足
        expect(sys.canTrigger('multi-cond', 7)).toBe(true);
        // turn=12 → maxTurn 不满足
        expect(sys.canTrigger('multi-cond', 12)).toBe(false);
      });
    });

    describe('空/未知条件', () => {
      it('空 triggerConditions 和未知类型默认通过', () => {
        // 空数组
        const emptyDef = createFixedEventDef({ id: 'no-cond', triggerConditions: [] });
        sys.registerEvent(emptyDef);
        expect(sys.canTrigger('no-cond', 1)).toBe(true);

        // undefined
        const undefDef = createFixedEventDef({ id: 'undef-cond' });
        delete (undefDef as unknown as Record<string, unknown>).triggerConditions;
        sys.registerEvent(undefDef);
        expect(sys.canTrigger('undef-cond', 1)).toBe(true);

        // 未知类型
        const unkDef = createFixedEventDef({
          id: 'unknown-cond',
          triggerConditions: [{ type: 'future_condition' as unknown as Record<string, unknown>, params: {} }],
        });
        sys.registerEvent(unkDef);
        expect(sys.canTrigger('unknown-cond', 1)).toBe(true);
      });
    });
  });

  // ═══════════════════════════════════════════
  // 15. 概率公式集成触发
  // ═══════════════════════════════════════════
  describe('概率公式集成触发', () => {
    it('注册概率条件后 checkAndTriggerEvents 使用公式', () => {
      const def = createRandomEventDef({ id: 'prob-event' });
      sys.registerEvent(def);

      // 注册概率条件：概率 = 1.0 必然触发
      sys.registerProbabilityCondition('prob-event', {
        baseProbability: 1.0,
        modifiers: [],
      });

      const triggered = sys.checkAndTriggerEvents(1);
      const found = triggered.find((i) => i.eventDefId === 'prob-event');
      expect(found).toBeDefined();
    });

    it('概率条件概率 = 0 时不触发', () => {
      const def = createRandomEventDef({ id: 'no-prob-event' });
      sys.registerEvent(def);

      // 注册概率条件：概率 = 0.0 不触发
      sys.registerProbabilityCondition('no-prob-event', {
        baseProbability: 0.0,
        modifiers: [],
      });

      const triggered = sys.checkAndTriggerEvents(1);
      const found = triggered.find((i) => i.eventDefId === 'no-prob-event');
      expect(found).toBeUndefined();
    });

    it('无概率条件时回退到简单概率', () => {
      const def = createRandomEventDef({
        id: 'simple-prob',
        triggerProbability: 1.0, // 必然触发
      });
      sys.registerEvent(def);

      // 不注册概率条件，使用 triggerProbability
      const triggered = sys.checkAndTriggerEvents(1);
      const found = triggered.find((i) => i.eventDefId === 'simple-prob');
      expect(found).toBeDefined();
    });
  });
});
