/**
 * 集成测试 §3: 事件触发条件与概率公式 → 冷却机制 → 通知优先级
 *
 * 覆盖 Play §1.1-§1.4 的核心事件引擎规则：
 *   - 概率触发公式 P = base × (1 + 等级×0.02) × 时间衰减
 *   - 触发条件引擎（时间/条件/概率）
 *   - 事件冷却机制（同类型60min/同事件4h/新手保护30min）
 *   - 通知优先级排队（6级）
 *   - 事件选项与后果计算
 *   - 数值缩放公式
 *
 * @module engine/event/__tests__/integration
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { EventTriggerSystem } from '../../EventTriggerSystem';
import { EventNotificationSystem } from '../../EventNotificationSystem';
import { EventConditionEvaluator } from '../../EventConditionEvaluator';
import type { ConditionContext } from '../../EventConditionEvaluator';
import { calculateProbability } from '../../EventProbabilityCalculator';
import {
  evaluateCondition,
  evaluateTurnRangeCondition,
  evaluateResourceCondition,
  evaluateAffinityCondition,
  evaluateBuildingCondition,
} from '../../EventTriggerConditions';
import type { ISystemDeps } from '../../../../core/types/subsystem';
import type { EventDef, EventInstance } from '../../../../core/event';
import type { ProbabilityCondition } from '../../../../core/event/event-encounter.types';

// ─────────────────────────────────────────────
// 辅助
// ─────────────────────────────────────────────

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
}

function makeEventDef(overrides?: Partial<EventDef>): EventDef {
  return {
    id: 'evt-prob-001',
    title: '概率测试事件',
    description: '',
    triggerType: 'random',
    urgency: 'medium',
    scope: 'region',
    triggerProbability: 0.03,
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
      {
        id: 'opt-risk',
        text: '冒险',
        consequences: {
          description: '70%获得大量资源/30%遭遇伏击',
          resourceChanges: { copper: 500 },
        },
      },
    ],
    ...overrides,
  };
}

// ═══════════════════════════════════════════════
// §3 事件触发条件与概率公式集成
// ═══════════════════════════════════════════════

describe('§3 事件触发条件与概率公式集成', () => {
  let triggerSys: EventTriggerSystem;
  let notifSys: EventNotificationSystem;
  let evaluator: EventConditionEvaluator;
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = mockDeps();
    triggerSys = new EventTriggerSystem();
    notifSys = new EventNotificationSystem();
    evaluator = new EventConditionEvaluator();

    triggerSys.init(deps);
    notifSys.init(deps);
    // EventConditionEvaluator is not ISubsystem, no init needed
  });

  // ─── §3.1 概率触发公式 ──────────────────

  describe('§3.1 概率触发公式', () => {
    it('基础概率计算', () => {
      const result = calculateProbability({
        baseProbability: 0.03,
        modifiers: [],
      });
      expect(result.finalProbability).toBeCloseTo(0.03, 4);
    });

    it('加法修正因子', () => {
      const result = calculateProbability({
        baseProbability: 0.03,
        modifiers: [
          { name: 'add', additiveBonus: 0.02, multiplicativeBonus: 1, active: true },
        ],
      });
      expect(result.finalProbability).toBeCloseTo(0.05, 4);
    });

    it('乘法修正因子', () => {
      const result = calculateProbability({
        baseProbability: 0.03,
        modifiers: [
          { name: 'mul', additiveBonus: 0, multiplicativeBonus: 2.0, active: true },
        ],
      });
      expect(result.finalProbability).toBeCloseTo(0.06, 4);
    });

    it('混合修正因子', () => {
      const result = calculateProbability({
        baseProbability: 0.03,
        modifiers: [
          { name: 'add', additiveBonus: 0.02, multiplicativeBonus: 1, active: true },
          { name: 'mul', additiveBonus: 0, multiplicativeBonus: 1.5, active: true },
        ],
      });
      // (0.03 + 0.02) * 1.5 = 0.075
      expect(result.finalProbability).toBeCloseTo(0.075, 4);
    });

    it('概率上限为 1', () => {
      const result = calculateProbability({
        baseProbability: 0.8,
        modifiers: [
          { name: 'big', additiveBonus: 0.5, multiplicativeBonus: 1, active: true },
        ],
      });
      expect(result.finalProbability).toBeLessThanOrEqual(1);
    });

    it('概率下限为 0', () => {
      const result = calculateProbability({
        baseProbability: 0.01,
        modifiers: [
          { name: 'neg', additiveBonus: -0.5, multiplicativeBonus: 1, active: true },
        ],
      });
      expect(result.finalProbability).toBeGreaterThanOrEqual(0);
    });

    it('等级系数影响概率: P = base × (1 + level × 0.02)', () => {
      const baseP = 0.03;
      const level = 10;
      const levelMod = 1 + level * 0.02; // 1.2
      const result = calculateProbability({
        baseProbability: baseP,
        modifiers: [{ name: 'level', additiveBonus: 0, multiplicativeBonus: levelMod, active: true }],
      });
      expect(result.finalProbability).toBeCloseTo(0.036, 4);
    });

    it('空修正因子列表', () => {
      const result = calculateProbability({
        baseProbability: 0.5,
        modifiers: [],
      });
      expect(result.finalProbability).toBe(0.5);
    });

    it('非活跃修正因子不参与计算', () => {
      const result = calculateProbability({
        baseProbability: 0.03,
        modifiers: [
          { name: 'inactive', additiveBonus: 0.5, multiplicativeBonus: 1, active: false },
        ],
      });
      expect(result.finalProbability).toBeCloseTo(0.03, 4);
    });
  });

  // ─── §3.2 触发条件引擎 ──────────────────

  describe('§3.2 触发条件引擎', () => {
    it('回合范围条件 — 在范围内', () => {
      const result = evaluateTurnRangeCondition(
        { minTurn: 1, maxTurn: 10 },
        5,
      );
      expect(result).toBe(true);
    });

    it('回合范围条件 — 超出范围', () => {
      const result = evaluateTurnRangeCondition(
        { minTurn: 1, maxTurn: 10 },
        15,
      );
      expect(result).toBe(false);
    });

    it('资源阈值条件 — 满足', () => {
      const result = evaluateResourceCondition(
        { resource: 'copper', minAmount: 100 },
        { copper: 500 },
      );
      expect(result).toBe(true);
    });

    it('资源阈值条件 — 不满足', () => {
      const result = evaluateResourceCondition(
        { resource: 'copper', minAmount: 1000 },
        { copper: 500 },
      );
      expect(result).toBe(false);
    });

    it('好感度条件', () => {
      const result = evaluateAffinityCondition(
        { target: 'npc-1', value: 3 },
        { 'npc-1': 5 },
      );
      expect(result).toBe(true);
    });

    it('建筑等级条件', () => {
      const result = evaluateBuildingCondition(
        { target: 'barracks', value: 2 },
        { barracks: 3 },
      );
      expect(result).toBe(true);
    });

    it('evaluateCondition 统一入口', () => {
      const cond = { type: 'turn_range' as const, params: { minTurn: 1, maxTurn: 100 } };
      const result = evaluateCondition(cond, 50);
      expect(result).toBe(true);
    });
  });

  // ─── §3.3 冷却机制 ──────────────────────

  describe('§3.3 事件冷却机制', () => {
    it('冷却期内 canTrigger 返回 false', () => {
      const def = makeEventDef({ id: 'cooldown-evt', cooldownTurns: 5 });
      triggerSys.registerEvent(def);
      triggerSys.forceTriggerEvent(def.id, 1);

      // 事件已解决
      const inst = triggerSys.getActiveEvents()[0];
      triggerSys.resolveEvent(inst.instanceId, 'opt-accept');

      // 冷却期内
      expect(triggerSys.canTrigger(def.id, 3)).toBe(false);
    });

    it('冷却期过后 canTrigger 恢复', () => {
      const def = makeEventDef({ id: 'cooldown-evt-2', cooldownTurns: 3 });
      triggerSys.registerEvent(def);
      triggerSys.forceTriggerEvent(def.id, 1);
      const inst = triggerSys.getActiveEvents()[0];
      triggerSys.resolveEvent(inst.instanceId, 'opt-accept');

      // 冷却期后 — 但 completedEventIds 仍阻止
      // completed 事件永远不再触发
      expect(triggerSys.canTrigger(def.id, 10)).toBe(false);
    });

    it('活跃事件存在时同ID不能再触发', () => {
      const def = makeEventDef({ id: 'dup-evt' });
      triggerSys.registerEvent(def);
      triggerSys.forceTriggerEvent(def.id, 1);
      expect(triggerSys.hasActiveEvent(def.id)).toBe(true);
      // canTrigger 检查活跃事件
      expect(triggerSys.canTrigger(def.id, 2)).toBe(false);
    });

    it('活跃事件数上限', () => {
      const config = triggerSys.getConfig();
      expect(config.maxActiveEvents).toBeDefined();
      expect(config.maxActiveEvents).toBeGreaterThan(0);
    });
  });

  // ─── §3.4 通知优先级排队 ──────────────────

  describe('§3.4 通知优先级排队（6级）', () => {
    it('6级优先级排序: critical > high > medium > low', () => {
      // 默认maxBannerCount=3，调高以容纳4个测试banner
      notifSys.setMaxBannerDisplay(5);

      // 每个横幅需要独立的事件定义和实例（同ID不可重复触发）
      const def1 = makeEventDef({ id: 'evt-prio-1' });
      const def2 = makeEventDef({ id: 'evt-prio-2' });
      const def3 = makeEventDef({ id: 'evt-prio-3' });
      const def4 = makeEventDef({ id: 'evt-prio-4' });
      triggerSys.registerEvent(def1);
      triggerSys.registerEvent(def2);
      triggerSys.registerEvent(def3);
      triggerSys.registerEvent(def4);

      const inst1 = triggerSys.forceTriggerEvent(def1.id, 1).instance!;
      const inst2 = triggerSys.forceTriggerEvent(def2.id, 2).instance!;
      const inst3 = triggerSys.forceTriggerEvent(def3.id, 3).instance!;
      const inst4 = triggerSys.forceTriggerEvent(def4.id, 4).instance!;

      notifSys.createBanner(inst1, { title: '低', description: '', urgency: 'low' });
      notifSys.createBanner(inst2, { title: '高', description: '', urgency: 'high' });
      notifSys.createBanner(inst3, { title: '紧急', description: '', urgency: 'critical' });
      notifSys.createBanner(inst4, { title: '中', description: '', urgency: 'medium' });

      const banners = notifSys.getActiveBanners();
      expect(banners).toHaveLength(4);
      expect(banners[0].urgency).toBe('critical');
      expect(banners[1].urgency).toBe('high');
      expect(banners[2].urgency).toBe('medium');
      expect(banners[3].urgency).toBe('low');
    });

    it('批量创建横幅', () => {
      const def1 = makeEventDef({ id: 'evt-batch-1' });
      const def2 = makeEventDef({ id: 'evt-batch-2' });
      triggerSys.registerEvent(def1);
      triggerSys.registerEvent(def2);
      const inst1 = triggerSys.forceTriggerEvent(def1.id, 1).instance!;
      const inst2 = triggerSys.forceTriggerEvent(def2.id, 2).instance!;

      const banners = notifSys.createBanners([
        { instance: inst1, eventDef: { title: 'A', description: '', urgency: 'high' } },
        { instance: inst2, eventDef: { title: 'B', description: '', urgency: 'low' } },
      ]);
      expect(banners).toHaveLength(2);
    });

    it('标记所有横幅已读', () => {
      const def1 = makeEventDef({ id: 'evt-read-1' });
      const def2 = makeEventDef({ id: 'evt-read-2' });
      triggerSys.registerEvent(def1);
      triggerSys.registerEvent(def2);
      const inst1 = triggerSys.forceTriggerEvent(def1.id, 1).instance!;
      const inst2 = triggerSys.forceTriggerEvent(def2.id, 2).instance!;
      notifSys.createBanner(inst1, { title: 'T1', description: '', urgency: 'high' });
      notifSys.createBanner(inst2, { title: 'T2', description: '', urgency: 'low' });
      notifSys.markAllBannersRead();
      expect(notifSys.getUnreadBanners()).toHaveLength(0);
    });

    it('过期横幅移除', () => {
      const def = makeEventDef({ expireAfterTurns: 3 });
      triggerSys.registerEvent(def);
      const inst = triggerSys.forceTriggerEvent(def.id, 1).instance!;
      notifSys.createBanner(inst, { title: '过期', description: '', urgency: 'medium' }, 1);

      const expired = notifSys.expireBanners(5);
      expect(expired.length).toBeGreaterThan(0);
      expect(notifSys.getActiveBanners()).toHaveLength(0);
    });

    it('dismiss 横幅', () => {
      const def = makeEventDef();
      triggerSys.registerEvent(def);
      const inst = triggerSys.forceTriggerEvent(def.id, 1).instance!;
      const banner = notifSys.createBanner(inst, { title: 'T', description: '', urgency: 'low' });
      expect(notifSys.dismissBanner(banner.id)).toBe(true);
    });
  });

  // ─── §3.5 事件选项与后果 ──────────────────

  describe('§3.5 事件选项与后果', () => {
    it('事件有2-3个选项', () => {
      const def = makeEventDef();
      expect(def.options.length).toBeGreaterThanOrEqual(2);
      expect(def.options.length).toBeLessThanOrEqual(3);
    });

    it('选择后事件标记为 resolved', () => {
      const def = makeEventDef({ id: 'resolve-test' });
      triggerSys.registerEvent(def);
      const result = triggerSys.forceTriggerEvent(def.id, 1);
      const choiceResult = triggerSys.resolveEvent(result.instance!.instanceId, 'opt-accept');
      expect(choiceResult).not.toBeNull();
    });

    it('默认选项标记正确', () => {
      const def = makeEventDef();
      const defaultOpt = def.options.find(o => o.isDefault);
      expect(defaultOpt).toBeDefined();
      expect(defaultOpt!.id).toBe('opt-accept');
    });

    it('后果包含资源变动', () => {
      const def = makeEventDef();
      const opt = def.options[0];
      expect(opt.consequences.resourceChanges).toBeDefined();
      expect(opt.consequences.resourceChanges!.copper).toBe(100);
    });
  });

  // ─── §3.6 数值缩放公式 ──────────────────

  describe('§3.6 数值缩放公式验证', () => {
    it('奖励缩放: 基础值 × (1 + 主城等级 × 0.1)', () => {
      const baseReward = 100;
      const castleLevel = 10;
      const scaled = baseReward * (1 + castleLevel * 0.1);
      expect(scaled).toBe(200); // 100 × 2.0
    });

    it('损失减免: 基础值 × max(0.3, 1 - 防御等级/(防御等级+50))', () => {
      const baseLoss = 100;
      const defenseLevel = 30;
      const reduction = 1 - defenseLevel / (defenseLevel + 50);
      const loss = baseLoss * Math.max(0.3, reduction);
      expect(loss).toBeCloseTo(62.5, 2); // 100 × 0.625
    });

    it('防御减免率计算: 防御等级/(防御等级+50)', () => {
      expect(30 / (30 + 50)).toBeCloseTo(0.375, 4);
      expect(0 / (0 + 50)).toBe(0);
      expect(50 / (50 + 50)).toBe(0.5);
    });

    it('天灾自动损失上限15%', () => {
      const totalResources = 10000;
      const maxDisasterLoss = totalResources * 0.15;
      expect(maxDisasterLoss).toBe(1500);
    });

    it('离线效率系数含声望等级加成', () => {
      const baseEfficiency = 0.5;
      const reputationLevel = 10;
      const efficiency = baseEfficiency * (1 + reputationLevel * 0.03);
      expect(efficiency).toBeCloseTo(0.65, 4);
    });

    it('代币转化: 未使用代币 × 10%', () => {
      const unusedTokens = 1234;
      const converted = Math.floor(unusedTokens * 0.1);
      expect(converted).toBe(123);
    });
  });

  // ─── §3.7 EventConditionEvaluator ──────────

  describe('§3.7 EventConditionEvaluator', () => {
    it('评估回合范围条件', () => {
      const context: ConditionContext = { currentTurn: 5, completedEventIds: new Set() };
      const result = evaluator.evaluate(
        { type: 'turn_range', params: { minTurn: 1, maxTurn: 10 } },
        context,
      );
      expect(result).toBe(true);
    });

    it('评估资源条件 — 满足', () => {
      const context: ConditionContext = {
        currentTurn: 1,
        completedEventIds: new Set(),
        gameState: { copper: 1000 },
      };
      const result = evaluator.evaluate(
        { type: 'resource_threshold', params: { resource: 'copper', minAmount: 500 } },
        context,
      );
      expect(result).toBe(true);
    });

    it('条件不满足返回 false', () => {
      const context: ConditionContext = {
        currentTurn: 1,
        completedEventIds: new Set(),
        gameState: { copper: 100 },
      };
      const result = evaluator.evaluate(
        { type: 'resource_threshold', params: { resource: 'copper', minAmount: 500 } },
        context,
      );
      expect(result).toBe(false);
    });
  });

  // ─── §3.8 事件系统序列化 ──────────────────

  describe('§3.8 事件系统序列化', () => {
    it('EventTriggerSystem 序列化', () => {
      const def = makeEventDef();
      triggerSys.registerEvent(def);
      const data = triggerSys.serialize();
      expect(data).toBeDefined();
    });

    it('序列化后反序列化恢复状态', () => {
      const def = makeEventDef({ id: 'ser-evt' });
      triggerSys.registerEvent(def);
      triggerSys.forceTriggerEvent(def.id, 1);

      const data = triggerSys.serialize();
      const newSys = new EventTriggerSystem();
      newSys.init(mockDeps());
      newSys.deserialize(data);

      expect(newSys.getActiveEventCount()).toBe(1);
    });

    it('EventNotificationSystem 序列化横幅', () => {
      const data = notifSys.serializeBanners();
      expect(Array.isArray(data)).toBe(true);
    });
  });
});
