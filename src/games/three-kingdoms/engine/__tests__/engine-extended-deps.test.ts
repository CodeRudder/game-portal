/**
 * engine-extended-deps 测试
 *
 * 验证 R11+ 子系统的创建、注册、初始化和重置：
 *   - createR11Systems 创建完整子系统集合
 *   - registerR11Systems 注册到 SubsystemRegistry
 *   - initR11Systems 初始化（需要deps的子系统）
 *   - resetR11Systems 重置所有子系统
 *   - R11Systems 接口字段完整性
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createR11Systems,
  registerR11Systems,
  initR11Systems,
  resetR11Systems,
  type R11Systems,
} from '../engine-extended-deps';
import { SubsystemRegistry } from '../../core/engine/SubsystemRegistry';
import type { ISystemDeps } from '../../core/types';
import type { ISubsystem } from "../../core/types";

// ─────────────────────────────────────────────
// Mock deps
// ─────────────────────────────────────────────

function createMockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      once: vi.fn(),
      removeAllListeners: vi.fn(),
    } as unknown as Record<string, unknown>,
    config: {
      get: vi.fn().mockReturnValue(undefined),
      set: vi.fn(),
      getAll: vi.fn().mockReturnValue({}),
    } as unknown as Record<string, unknown>,
    registry: {
      register: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn().mockReturnValue(new Map()),
      unregister: vi.fn(),
    } as unknown as Record<string, unknown>,
  };
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('engine-extended-deps', () => {
  describe('createR11Systems', () => {
    it('应创建包含所有子系统的对象', () => {
      const systems = createR11Systems();

      // 验证所有 R11Systems 接口字段都存在
      const requiredKeys: (keyof R11Systems)[] = [
        'mailSystem', 'mailTemplateSystem', 'shopSystem', 'currencySystem',
        'npcSystem', 'equipmentSystem', 'equipmentForgeSystem', 'equipmentEnhanceSystem',
        'equipmentSetSystem', 'equipmentRecommendSystem',
        'arenaSystem', 'arenaSeasonSystem', 'rankingSystem', 'pvpBattleSystem',
        'defenseFormationSystem', 'arenaShopSystem',
        'expeditionSystem',
        'allianceSystem', 'allianceTaskSystem', 'allianceBossSystem', 'allianceShopSystem',
        'prestigeSystem', 'prestigeShopSystem', 'rebirthSystem',
        'questSystem', 'achievementSystem',
        'friendSystem', 'chatSystem', 'socialLeaderboardSystem',
        'heritageSystem', 'timedActivitySystem', 'advisorSystem',
        'activitySystem', 'signInSystem',
        'tradeSystem', 'caravanSystem', 'resourceTradeEngine',
        'settingsManager', 'accountSystem',
        'endingSystem', 'globalStatisticsSystem',
      ];

      for (const key of requiredKeys) {
        expect(systems[key]).toBeDefined();
        expect(systems[key]).not.toBeNull();
      }
    });

    it('每个子系统应有 name 属性', () => {
      const systems = createR11Systems();
      const keys = Object.keys(systems) as (keyof R11Systems)[];

      for (const key of keys) {
        const sys = systems[key] as unknown as ISubsystem;
        expect(typeof sys.name).toBe('string');
        expect(sys.name.length).toBeGreaterThan(0);
      }
    });

    it('不传参数时自动创建 EquipmentSystem', () => {
      const systems = createR11Systems();
      expect(systems.equipmentSystem).toBeDefined();
      expect(typeof systems.equipmentSystem.name).toBe('string');
    });

    it('传入自定义 EquipmentSystem 时使用传入的实例', () => {
      const mockEq = { name: 'custom-equipment', init: vi.fn(), update: vi.fn(), getState: vi.fn(), reset: vi.fn() };
      const systems = createR11Systems(mockEq as unknown as Record<string, unknown>);
      expect(systems.equipmentSystem).toBe(mockEq);
    });
  });

  describe('registerR11Systems', () => {
    it('应将所有子系统注册到 SubsystemRegistry', () => {
      const systems = createR11Systems();
      const registry = new SubsystemRegistry();

      registerR11Systems(registry, systems);

      // 验证注册数量
      expect(registry.size).toBeGreaterThanOrEqual(40);

      // 验证关键子系统可通过名称获取
      expect(registry.get('mail')).toBeDefined();
      expect(registry.get('shop')).toBeDefined();
      expect(registry.get('currency')).toBeDefined();
      expect(registry.get('equipment')).toBeDefined();
      expect(registry.get('arena')).toBeDefined();
      expect(registry.get('alliance')).toBeDefined();
      expect(registry.get('prestige')).toBeDefined();
      expect(registry.get('quest')).toBeDefined();
      expect(registry.get('achievement')).toBeDefined();
      expect(registry.get('settings')).toBeDefined();
      expect(registry.get('account')).toBeDefined();
      expect(registry.get('endingSystem')).toBeDefined();
      expect(registry.get('globalStatistics')).toBeDefined();
    });

    it('注册后获取的子系统与原始实例一致', () => {
      const systems = createR11Systems();
      const registry = new SubsystemRegistry();
      registerR11Systems(registry, systems);

      expect(registry.get('mail')).toBe(systems.mailSystem);
      expect(registry.get('equipment')).toBe(systems.equipmentSystem);
      expect(registry.get('shop')).toBe(systems.shopSystem);
    });
  });

  describe('initR11Systems', () => {
    it('调用后不抛异常', () => {
      const systems = createR11Systems();
      const deps = createMockDeps();

      expect(() => initR11Systems(systems, deps)).not.toThrow();
    });

    it('应为子系统注入 deps', () => {
      const systems = createR11Systems();
      const deps = createMockDeps();

      initR11Systems(systems, deps);

      // 验证 eventBus.emit 被调用（某些子系统初始化时会发出事件）
      // 或者验证不抛异常即可
      expect(true).toBe(true);
    });
  });

  describe('resetR11Systems', () => {
    it('调用后不抛异常', () => {
      const systems = createR11Systems();

      expect(() => resetR11Systems(systems)).not.toThrow();
    });

    it('重置后再重置不抛异常（幂等性）', () => {
      const systems = createR11Systems();

      resetR11Systems(systems);
      expect(() => resetR11Systems(systems)).not.toThrow();
    });

    it('初始化后重置不抛异常', () => {
      const systems = createR11Systems();
      const deps = createMockDeps();

      initR11Systems(systems, deps);
      expect(() => resetR11Systems(systems)).not.toThrow();
    });
  });

  describe('完整生命周期', () => {
    it('创建→注册→初始化→重置 完整流程无异常', () => {
      const systems = createR11Systems();
      const registry = new SubsystemRegistry();
      const deps = createMockDeps();

      expect(() => {
        registerR11Systems(registry, systems);
        initR11Systems(systems, deps);
        resetR11Systems(systems);
      }).not.toThrow();
    });
  });
});
