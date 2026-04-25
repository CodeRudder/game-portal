/**
 * V4 攻城略地(下) — 地图事件系统生命周期集成测试
 *
 * 覆盖以下 play 流程：
 * - §8.1 事件触发规则 — 间隔/概率/上限/过期
 * - §8.2 事件解决完整流程 — 强攻/谈判/忽略 + 奖励
 * - §8.3 事件过期自动消失
 * - §8.4 事件存档序列化/反序列化
 * - §8.5 强制触发（测试辅助）
 *
 * 编码规范：
 * - 每个it前创建新的 MapEventSystem 实例
 * - describe按play流程ID组织
 * - 不使用 as any
 */

import { describe, it, expect } from 'vitest';
import { MapEventSystem } from '../../map/MapEventSystem';
import { EVENT_TYPE_CONFIGS } from '../../map/map-event-config';
import type { MapEventInstance, MapEventChoice, MapEventType, MapEventResolution } from '../../map/MapEventSystem';

// ── 辅助 ──

/** 创建系统实例，rng固定返回指定值 */
function createSystem(rngValue: number): MapEventSystem {
  return new MapEventSystem({ rng: () => rngValue, checkInterval: 1000 });
}

/** 创建必定触发的系统 */
function createAlwaysTrigger(): MapEventSystem {
  return new MapEventSystem({ rng: () => 0.05, checkInterval: 1000 });
}

/** 创建永不触发的系统 */
function createNeverTrigger(): MapEventSystem {
  return new MapEventSystem({ rng: () => 0.99, checkInterval: 1000 });
}

/** 当前时间基准 */
const NOW = 1_000_000_000_000;

// ═══════════════════════════════════════════════════════════════
// V4 MAP-EVENT-LIFECYCLE 地图事件生命周期
// ═══════════════════════════════════════════════════════════════
describe('V4 MAP-EVENT-LIFECYCLE 地图事件生命周期', () => {

  // ═══════════════════════════════════════════════════════════════
  // §8.1 事件触发规则
  // ═══════════════════════════════════════════════════════════════
  describe('§8.1 事件触发规则', () => {
    it('rng < 0.1 时触发事件（10%概率）', () => {
      const sys = createAlwaysTrigger();
      const event = sys.checkAndTrigger(NOW);
      expect(event).not.toBeNull();
      expect(event!.status).toBe('active');
    });

    it('rng ≥ 0.1 时不触发事件', () => {
      const sys = createNeverTrigger();
      const event = sys.checkAndTrigger(NOW);
      expect(event).toBeNull();
    });

    it('首次检查无需间隔等待', () => {
      const sys = createAlwaysTrigger();
      const event = sys.checkAndTrigger(NOW);
      expect(event).not.toBeNull();
    });

    it('间隔内再次检查不触发', () => {
      const sys = createAlwaysTrigger();
      sys.checkAndTrigger(NOW);
      // 500ms后，间隔1000ms内
      const event2 = sys.checkAndTrigger(NOW + 500);
      expect(event2).toBeNull();
    });

    it('间隔过后可再次触发', () => {
      const sys = createAlwaysTrigger();
      sys.checkAndTrigger(NOW);
      // 1001ms后，超过间隔
      const event2 = sys.checkAndTrigger(NOW + 1001);
      expect(event2).not.toBeNull();
    });

    it('最多3个未处理事件同时存在', () => {
      const sys = createAlwaysTrigger();
      const e1 = sys.checkAndTrigger(NOW);
      const e2 = sys.checkAndTrigger(NOW + 1001);
      const e3 = sys.checkAndTrigger(NOW + 2002);
      expect(e1).not.toBeNull();
      expect(e2).not.toBeNull();
      expect(e3).not.toBeNull();
      expect(sys.getActiveEventCount()).toBe(3);
      // 第4个不触发
      const e4 = sys.checkAndTrigger(NOW + 3003);
      expect(e4).toBeNull();
      expect(sys.getActiveEventCount()).toBe(3);
    });

    it('解决事件后可触发新事件', () => {
      const sys = createAlwaysTrigger();
      const e1 = sys.checkAndTrigger(NOW);
      sys.checkAndTrigger(NOW + 1001);
      sys.checkAndTrigger(NOW + 2002);
      // 满3个，解决1个
      sys.resolveEvent(e1!.id, 'ignore');
      expect(sys.getActiveEventCount()).toBe(2);
      // 现在可以再触发
      const e4 = sys.checkAndTrigger(NOW + 3003);
      expect(e4).not.toBeNull();
      expect(sys.getActiveEventCount()).toBe(3);
    });

    it('初始活跃事件为0', () => {
      const sys = createAlwaysTrigger();
      expect(sys.getActiveEventCount()).toBe(0);
      expect(sys.getActiveEvents()).toEqual([]);
    });

    it('初始已解决计数为0', () => {
      const sys = createAlwaysTrigger();
      expect(sys.getResolvedCount()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // §8.2 事件解决完整流程
  // ═══════════════════════════════════════════════════════════════
  describe('§8.2 事件解决完整流程', () => {
    it('强攻(bandit)返回战斗类奖励', () => {
      const sys = createAlwaysTrigger();
      const event = sys.forceTrigger('bandit', NOW);
      const result = sys.resolveEvent(event.id, 'attack');
      expect(result.success).toBe(true);
      expect(result.choice).toBe('attack');
      expect(result.triggeredBattle).toBe(true);
      expect(result.rewards.length).toBeGreaterThan(0);
    });

    it('谈判(bandit)返回中等奖励且不触发战斗', () => {
      const sys = createAlwaysTrigger();
      const event = sys.forceTrigger('bandit', NOW);
      const result = sys.resolveEvent(event.id, 'negotiate');
      expect(result.success).toBe(true);
      expect(result.triggeredBattle).toBe(false);
      expect(result.rewards.length).toBeGreaterThan(0);
    });

    it('忽略返回空奖励', () => {
      const sys = createAlwaysTrigger();
      const event = sys.forceTrigger('bandit', NOW);
      const result = sys.resolveEvent(event.id, 'ignore');
      expect(result.success).toBe(true);
      expect(result.triggeredBattle).toBe(false);
      expect(result.rewards).toEqual([]);
    });

    it('解决不存在的事件返回失败', () => {
      const sys = createAlwaysTrigger();
      const result = sys.resolveEvent('nonexistent', 'attack');
      expect(result.success).toBe(false);
      expect(result.rewards).toEqual([]);
    });

    it('已解决的事件不能再解决', () => {
      const sys = createAlwaysTrigger();
      const event = sys.forceTrigger('bandit', NOW);
      const r1 = sys.resolveEvent(event.id, 'attack');
      expect(r1.success).toBe(true);
      const r2 = sys.resolveEvent(event.id, 'attack');
      expect(r2.success).toBe(false);
    });

    it('解决后已解决计数递增', () => {
      const sys = createAlwaysTrigger();
      const e1 = sys.forceTrigger('bandit', NOW);
      sys.resolveEvent(e1.id, 'ignore');
      expect(sys.getResolvedCount()).toBe(1);
      const e2 = sys.forceTrigger('caravan', NOW);
      sys.resolveEvent(e2.id, 'negotiate');
      expect(sys.getResolvedCount()).toBe(2);
    });

    it('解决后活跃事件减少', () => {
      const sys = createAlwaysTrigger();
      const e1 = sys.forceTrigger('bandit', NOW);
      const e2 = sys.forceTrigger('caravan', NOW);
      expect(sys.getActiveEventCount()).toBe(2);
      sys.resolveEvent(e1.id, 'ignore');
      expect(sys.getActiveEventCount()).toBe(1);
      sys.resolveEvent(e2.id, 'ignore');
      expect(sys.getActiveEventCount()).toBe(0);
    });

    it('商队经过(caravan)强攻不触发战斗', () => {
      const sys = createAlwaysTrigger();
      const event = sys.forceTrigger('caravan', NOW);
      expect(event.isCombat).toBe(false);
      const result = sys.resolveEvent(event.id, 'attack');
      expect(result.triggeredBattle).toBe(false);
      expect(result.rewards.length).toBeGreaterThan(0);
    });

    it('阵营冲突(conflict)强攻触发战斗', () => {
      const sys = createAlwaysTrigger();
      const event = sys.forceTrigger('conflict', NOW);
      expect(event.isCombat).toBe(true);
      const result = sys.resolveEvent(event.id, 'attack');
      expect(result.triggeredBattle).toBe(true);
    });

    it('遗迹发现(ruins)强攻奖励含科技点', () => {
      const sys = createAlwaysTrigger();
      const event = sys.forceTrigger('ruins', NOW);
      const result = sys.resolveEvent(event.id, 'attack');
      const hasTechPoint = result.rewards.some(r => r.type === 'techPoint');
      expect(hasTechPoint).toBe(true);
    });

    it('天灾降临(disaster)只有谈判和忽略选项', () => {
      const sys = createAlwaysTrigger();
      const event = sys.forceTrigger('disaster', NOW);
      expect(event.choices).toContain('negotiate');
      expect(event.choices).toContain('ignore');
      expect(event.choices).not.toContain('attack');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // §8.3 事件过期自动消失
  // ═══════════════════════════════════════════════════════════════
  describe('§8.3 事件过期自动消失', () => {
    it('流寇入侵持续2小时后过期', () => {
      const sys = createAlwaysTrigger();
      const event = sys.forceTrigger('bandit', NOW);
      expect(event.expiresAt).toBe(NOW + 7200000); // 2小时
      // 过期前仍在
      sys.cleanExpiredEvents(NOW + 7199999);
      expect(sys.getEventById(event.id)).toBeDefined();
      // 过期后消失
      sys.cleanExpiredEvents(NOW + 7200000);
      expect(sys.getEventById(event.id)).toBeUndefined();
    });

    it('商队经过持续1.5小时后过期', () => {
      const sys = createAlwaysTrigger();
      const event = sys.forceTrigger('caravan', NOW);
      expect(event.expiresAt).toBe(NOW + 5400000);
    });

    it('天灾降临持续24小时后过期', () => {
      const sys = createAlwaysTrigger();
      const event = sys.forceTrigger('disaster', NOW);
      expect(event.expiresAt).toBe(NOW + 86400000);
    });

    it('遗迹发现持续4小时后过期', () => {
      const sys = createAlwaysTrigger();
      const event = sys.forceTrigger('ruins', NOW);
      expect(event.expiresAt).toBe(NOW + 14400000);
    });

    it('阵营冲突持续48小时后过期', () => {
      const sys = createAlwaysTrigger();
      const event = sys.forceTrigger('conflict', NOW);
      expect(event.expiresAt).toBe(NOW + 172800000);
    });

    it('checkAndTrigger自动清理过期事件', () => {
      const sys = createAlwaysTrigger();
      const e1 = sys.forceTrigger('bandit', NOW);
      // bandit 2小时后过期
      const e2 = sys.checkAndTrigger(NOW + 7200001);
      // e1应该已被清理
      expect(sys.getEventById(e1.id)).toBeUndefined();
    });

    it('过期清理返回清理数量', () => {
      const sys = createAlwaysTrigger();
      sys.forceTrigger('bandit', NOW);
      sys.forceTrigger('caravan', NOW);
      // 2小时后bandit过期，caravan还有效(1.5h但创建时间相同)
      const cleaned = sys.cleanExpiredEvents(NOW + 7200001);
      expect(cleaned).toBeGreaterThanOrEqual(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // §8.4 事件存档序列化/反序列化
  // ═══════════════════════════════════════════════════════════════
  describe('§8.4 事件存档序列化/反序列化', () => {
    it('空系统序列化后反序列化保持一致', () => {
      const sys = createAlwaysTrigger();
      const data = sys.serialize();
      expect(data.version).toBe(1);
      expect(data.activeEvents).toEqual([]);
      expect(data.resolvedCount).toBe(0);
    });

    it('活跃事件序列化后反序列化保持一致', () => {
      const sys = createAlwaysTrigger();
      const e1 = sys.forceTrigger('bandit', NOW);
      const e2 = sys.forceTrigger('caravan', NOW);
      sys.resolveEvent(e1.id, 'ignore');

      const data = sys.serialize();
      expect(data.activeEvents.length).toBe(1);
      expect(data.resolvedCount).toBe(1);

      // 反序列化到新系统
      const sys2 = createAlwaysTrigger();
      sys2.deserialize(data);
      expect(sys2.getActiveEventCount()).toBe(1);
      expect(sys2.getResolvedCount()).toBe(1);
    });

    it('反序列化后可继续解决事件', () => {
      const sys = createAlwaysTrigger();
      sys.forceTrigger('bandit', NOW);
      const data = sys.serialize();

      const sys2 = createAlwaysTrigger();
      sys2.deserialize(data);
      const events = sys2.getActiveEvents();
      expect(events.length).toBe(1);
      const result = sys2.resolveEvent(events[0].id, 'attack');
      expect(result.success).toBe(true);
    });

    it('无效数据反序列化不崩溃', () => {
      const sys = createAlwaysTrigger();
      expect(() => sys.deserialize(null as any)).not.toThrow();
      expect(() => sys.deserialize({ version: 999 } as any)).not.toThrow();
    });

    it('reset清空所有状态', () => {
      const sys = createAlwaysTrigger();
      sys.forceTrigger('bandit', NOW);
      sys.forceTrigger('caravan', NOW);
      sys.resolveEvent(sys.getActiveEvents()[0].id, 'ignore');
      expect(sys.getActiveEventCount()).toBe(1);
      expect(sys.getResolvedCount()).toBe(1);

      sys.reset();
      expect(sys.getActiveEventCount()).toBe(0);
      expect(sys.getResolvedCount()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // §8.5 强制触发与事件查询
  // ═══════════════════════════════════════════════════════════════
  describe('§8.5 强制触发与事件查询', () => {
    it('forceTrigger每种事件类型都能创建', () => {
      const types: MapEventType[] = ['bandit', 'caravan', 'disaster', 'ruins', 'conflict'];
      for (const type of types) {
        const sys = createAlwaysTrigger();
        const event = sys.forceTrigger(type, NOW);
        expect(event.eventType).toBe(type);
        expect(event.status).toBe('active');
      }
    });

    it('forceTrigger未知类型抛出异常', () => {
      const sys = createAlwaysTrigger();
      expect(() => sys.forceTrigger('unknown' as MapEventType, NOW)).toThrow();
    });

    it('getEventById查找存在的事件', () => {
      const sys = createAlwaysTrigger();
      const event = sys.forceTrigger('bandit', NOW);
      const found = sys.getEventById(event.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(event.id);
    });

    it('getEventById查找不存在的事件返回undefined', () => {
      const sys = createAlwaysTrigger();
      expect(sys.getEventById('nonexistent')).toBeUndefined();
    });

    it('getEventsByType按类型过滤', () => {
      const sys = createAlwaysTrigger();
      sys.forceTrigger('bandit', NOW);
      sys.forceTrigger('caravan', NOW);
      sys.forceTrigger('bandit', NOW + 1);
      const banditEvents = sys.getEventsByType('bandit');
      expect(banditEvents.length).toBe(2);
      const caravanEvents = sys.getEventsByType('caravan');
      expect(caravanEvents.length).toBe(1);
    });

    it('事件实例包含正确字段', () => {
      const sys = createAlwaysTrigger();
      const event = sys.forceTrigger('bandit', NOW);
      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('eventType');
      expect(event).toHaveProperty('name');
      expect(event).toHaveProperty('description');
      expect(event).toHaveProperty('status');
      expect(event).toHaveProperty('choices');
      expect(event).toHaveProperty('isCombat');
      expect(event).toHaveProperty('createdAt');
      expect(event).toHaveProperty('expiresAt');
    });

    it('getEventTypeConfigs返回完整配置', () => {
      const configs = MapEventSystem.getEventTypeConfigs();
      expect(configs.length).toBe(5);
      for (const config of configs) {
        expect(config).toHaveProperty('type');
        expect(config).toHaveProperty('name');
        expect(config).toHaveProperty('weight');
        expect(config).toHaveProperty('duration');
        expect(config).toHaveProperty('attackRewards');
        expect(config).toHaveProperty('negotiateRewards');
        expect(config).toHaveProperty('ignoreRewards');
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // §8.6 事件奖励对比验证
  // ═══════════════════════════════════════════════════════════════
  describe('§8.6 事件奖励对比验证', () => {
    it('强攻奖励 ≥ 谈判奖励 ≥ 忽略奖励（金币维度）', () => {
      for (const config of EVENT_TYPE_CONFIGS) {
        const attackGold = config.attackRewards.filter(r => r.type === 'gold').reduce((s, r) => s + r.amount, 0);
        const negotiateGold = config.negotiateRewards.filter(r => r.type === 'gold').reduce((s, r) => s + r.amount, 0);
        const ignoreGold = config.ignoreRewards.filter(r => r.type === 'gold').reduce((s, r) => s + r.amount, 0);
        // 强攻 ≥ 谈判（如果存在强攻选项）
        if (config.choices.includes('attack')) {
          expect(attackGold).toBeGreaterThanOrEqual(negotiateGold);
        }
        // 谈判 ≥ 忽略
        expect(negotiateGold).toBeGreaterThanOrEqual(ignoreGold);
      }
    });

    it('所有事件配置权重总和 > 0', () => {
      const totalWeight = EVENT_TYPE_CONFIGS.reduce((s, c) => s + c.weight, 0);
      expect(totalWeight).toBeGreaterThan(0);
    });

    it('所有事件至少有1个选项', () => {
      for (const config of EVENT_TYPE_CONFIGS) {
        expect(config.choices.length).toBeGreaterThanOrEqual(1);
      }
    });
  });
});
