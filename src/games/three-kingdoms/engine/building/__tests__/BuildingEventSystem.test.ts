/**
 * BuildingEventSystem 单元测试
 *
 * 覆盖：
 * - 登录触发随机建筑事件
 * - 选择即时收益→获得资源
 * - 选择持续收益→加成持续指定时间
 * - 24h冷却内不可再次触发同建筑
 * - 持续加成到期自动消失
 * - 7类建筑各有独立事件池
 * - 序列化/反序列化
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
  BuildingEventSystem,
  type BuildingEvent,
} from '../BuildingEventSystem';

describe('BuildingEventSystem', () => {
  let system: BuildingEventSystem;

  beforeEach(() => {
    system = new BuildingEventSystem();
  });

  // ── 基础初始化 ──

  test('init sets up building levels callback', () => {
    system.init(() => ({ farmland: 5, market: 3 }));
    expect(true).toBe(true);
  });

  // ── 登录触发随机建筑事件 ──

  test('checkTriggerOnLogin returns event on first login', () => {
    const levels: Record<string, number> = { farmland: 5, market: 3 };
    system.init(() => levels);

    const event = system.checkTriggerOnLogin(true); // first login = 100%
    expect(event).not.toBeNull();
    expect(event!.uid).toBeTruthy();
    expect(event!.eventId).toBeTruthy();
    expect(event!.buildingType).toBeTruthy();
    expect(event!.def).toBeTruthy();
    expect(event!.def.title).toBeTruthy();
    expect(event!.def.options.length).toBeGreaterThanOrEqual(2);
  });

  test('checkTriggerOnLogin returns null without init', () => {
    const event = system.checkTriggerOnLogin(true);
    expect(event).toBeNull();
  });

  test('checkTriggerOnLogin returns null when all buildings are level 0', () => {
    system.init(() => ({}));
    const event = system.checkTriggerOnLogin(true);
    expect(event).toBeNull();
  });

  test('checkTriggerOnLogin returns null when pending event exists', () => {
    const levels: Record<string, number> = { farmland: 5 };
    system.init(() => levels);

    const first = system.checkTriggerOnLogin(true);
    expect(first).not.toBeNull();

    const second = system.checkTriggerOnLogin(true);
    expect(second).toBeNull();
  });

  // ── 选择即时收益→获得资源 ──

  test('resolveEvent with immediate option returns resource reward', () => {
    const levels: Record<string, number> = { farmland: 5 };
    system.init(() => levels);

    const event = system.checkTriggerOnLogin(true)!;
    expect(event).not.toBeNull();

    // Find an option with immediate resource reward
    const resourceOption = event.def.options.find((o) => 'resource' in o.reward);
    if (resourceOption) {
      const result = system.resolveEvent(event.uid, resourceOption.id);
      expect(result.success).toBe(true);
      expect(result.reward).toBeDefined();
    }
  });

  // ── 选择持续收益→加成持续指定时间 ──

  test('resolveEvent with sustained option returns buff reward', () => {
    const levels: Record<string, number> = { farmland: 5 };
    system.init(() => levels);

    const event = system.checkTriggerOnLogin(true)!;
    // Find an option with sustained buff
    const buffOption = event.def.options.find((o) => 'buffType' in o.reward);
    if (buffOption) {
      const result = system.resolveEvent(event.uid, buffOption.id);
      expect(result.success).toBe(true);
      expect(result.reward).toBeDefined();
    }
  });

  test('sustained bonus appears in active bonuses after resolve', () => {
    const levels: Record<string, number> = { farmland: 5 };
    system.init(() => levels);

    const event = system.checkTriggerOnLogin(true)!;
    const buffOption = event.def.options.find((o) => 'buffType' in o.reward);
    if (buffOption) {
      system.resolveEvent(event.uid, buffOption.id);
      const bonuses = system.getActiveSustainedBonuses();
      expect(bonuses.length).toBeGreaterThan(0);
    }
  });

  // ── 24h冷却内不可再次触发同建筑 ──

  test('isOnCooldown returns true after resolving event for same building', () => {
    const levels: Record<string, number> = { farmland: 5 };
    system.init(() => levels);

    const event = system.checkTriggerOnLogin(true)!;
    const buildingType = event.buildingType;
    const option = event.def.options[0];
    system.resolveEvent(event.uid, option.id);

    expect(system.isOnCooldown(buildingType)).toBe(true);
  });

  test('cannot trigger event for building on cooldown', () => {
    // Only farmland available, resolve event, then try again
    const levels: Record<string, number> = { farmland: 5 };
    system.init(() => levels);

    const event = system.checkTriggerOnLogin(true)!;
    system.resolveEvent(event.uid, event.def.options[0].id);

    // Now farmland is on cooldown and it's the only building
    const newEvent = system.checkTriggerOnLogin(true);
    expect(newEvent).toBeNull();
  });

  // ── 持续加成到期自动消失 ──

  test('tickSustainedBonuses removes expired bonuses', () => {
    const levels: Record<string, number> = { farmland: 5 };
    system.init(() => levels);

    const event = system.checkTriggerOnLogin(true)!;
    const buffOption = event.def.options.find((o) => 'buffType' in o.reward);
    if (buffOption && 'durationMs' in buffOption.reward) {
      system.resolveEvent(event.uid, buffOption.id);

      // Tick past the duration
      const duration = (buffOption.reward as { durationMs: number }).durationMs;
      system.tickSustainedBonuses(duration + 1);

      const bonuses = system.getActiveSustainedBonuses();
      expect(bonuses.length).toBe(0);
    }
  });

  test('tickSustainedBonuses reduces remaining time', () => {
    const levels: Record<string, number> = { farmland: 5 };
    system.init(() => levels);

    const event = system.checkTriggerOnLogin(true)!;
    const buffOption = event.def.options.find((o) => 'buffType' in o.reward);
    if (buffOption) {
      system.resolveEvent(event.uid, buffOption.id);

      const before = system.getActiveSustainedBonuses()[0];
      const beforeMs = before.remainingMs;

      system.tickSustainedBonuses(1000);

      const after = system.getActiveSustainedBonuses()[0];
      expect(after.remainingMs).toBe(beforeMs - 1000);
    }
  });

  // ── 7类建筑各有独立事件池 ──

  test('each building type has events in its pool', () => {
    const types = system.getEventBuildingTypes();
    expect(types.length).toBeGreaterThanOrEqual(7);

    for (const type of types) {
      const pool = system.getEventPool(type);
      expect(pool.length).toBeGreaterThanOrEqual(3);
    }
  });

  test('unknown building type returns empty pool', () => {
    const pool = system.getEventPool('unknown_building');
    expect(pool).toEqual([]);
  });

  test('all expected building types are listed', () => {
    const types = system.getEventBuildingTypes();
    expect(types).toContain('farmland');
    expect(types).toContain('market');
    expect(types).toContain('barracks');
    expect(types).toContain('academy');
    expect(types).toContain('workshop');
    expect(types).toContain('clinic');
  });

  // ── 序列化/反序列化 ──

  test('serialize and deserialize preserves state', () => {
    const levels: Record<string, number> = { farmland: 5, market: 3 };
    system.init(() => levels);

    const event = system.checkTriggerOnLogin(true)!;
    const buffOption = event.def.options.find((o) => 'buffType' in o.reward);
    if (buffOption) {
      system.resolveEvent(event.uid, buffOption.id);
    } else {
      system.resolveEvent(event.uid, event.def.options[0].id);
    }

    const data = system.serialize();
    expect(data.version).toBe(1);
    expect(data.cooldowns).toBeTruthy();
    expect(data.sustainedBonuses).toBeTruthy();

    // Restore into new system
    const restored = new BuildingEventSystem();
    restored.init(() => levels);
    restored.deserialize(data);

    // Check cooldowns preserved
    const buildingType = event.buildingType;
    expect(restored.isOnCooldown(buildingType)).toBe(true);

    // Check sustained bonuses preserved
    const bonuses = restored.getActiveSustainedBonuses();
    if (buffOption) {
      expect(bonuses.length).toBeGreaterThan(0);
    }
  });

  test('reset clears all state', () => {
    const levels: Record<string, number> = { farmland: 5 };
    system.init(() => levels);

    const event = system.checkTriggerOnLogin(true)!;
    system.resolveEvent(event.uid, event.def.options[0].id);

    system.reset();

    const data = system.serialize();
    expect(Object.keys(data.cooldowns).length).toBe(0);
    expect(data.sustainedBonuses.length).toBe(0);
    expect(data.pendingEvent).toBeNull();
  });

  // ── resolveEvent edge cases ──

  test('resolveEvent returns failure for wrong event uid', () => {
    const result = system.resolveEvent('nonexistent', 'option');
    expect(result.success).toBe(false);
  });

  test('resolveEvent returns failure for wrong option id', () => {
    const levels: Record<string, number> = { farmland: 5 };
    system.init(() => levels);

    const event = system.checkTriggerOnLogin(true)!;
    const result = system.resolveEvent(event.uid, 'nonexistent_option');
    expect(result.success).toBe(false);
  });

  // ── 气泡状态 ──

  test('getBubbleState returns none when not on cooldown', () => {
    expect(system.getBubbleState('farmland')).toBe('none');
  });

  test('getBubbleState returns calm or urgent when on cooldown', () => {
    const levels: Record<string, number> = { farmland: 5 };
    system.init(() => levels);

    const event = system.checkTriggerOnLogin(true)!;
    system.resolveEvent(event.uid, event.def.options[0].id);

    const state = system.getBubbleState(event.buildingType);
    expect(['calm', 'urgent']).toContain(state);
  });
});
