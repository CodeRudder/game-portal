/**
 * engine-tick — 攻城系统集成测试
 *
 * 验证 P1-4: engine tick 中调用 siege.update() 实现每日攻城次数自动重置
 *
 * @module engine/__tests__/engine-tick-siege.integration.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeTick, type TickContext } from '../engine-tick';
import { SiegeSystem } from '../map/SiegeSystem';
import type { ISystemDeps } from '../../core/types';
import type { ISubsystemRegistry } from '../../core/types/subsystem';

// ── Mock 子系统 ──

function createMockSystem(updateFn?: (dt: number) => void) {
  return {
    update: updateFn ?? vi.fn(),
    init: vi.fn(),
    getState: vi.fn().mockReturnValue({}),
    reset: vi.fn(),
  };
}

function createMockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: {
      register: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn().mockReturnValue(new Map()),
      has: vi.fn(),
      unregister: vi.fn(),
    } as unknown as ISubsystemRegistry,
  };
}

function createMockTickCtx(overrides: Partial<TickContext> = {}): TickContext {
  const mockResource = {
    tick: vi.fn(),
    recalculateProduction: vi.fn(),
    updateCaps: vi.fn(),
    getResources: vi.fn().mockReturnValue({}),
    getProductionRates: vi.fn().mockReturnValue({}),
  } as unknown as Record<string, unknown>;

  return {
    resource: mockResource,
    building: {
      tick: vi.fn().mockReturnValue([]),
      getLevel: vi.fn().mockReturnValue(1),
      getCastleBonusMultiplier: vi.fn().mockReturnValue(1),
      calculateTotalProduction: vi.fn().mockReturnValue({}),
      getProductionBuildingLevels: vi.fn().mockReturnValue({}),
    } as unknown as Record<string, unknown>,
    calendar: createMockSystem() as unknown as ISubsystem,
    hero: createMockSystem() as unknown as ISubsystem,
    campaign: createMockSystem() as unknown as ISubsystem,
    techTree: { getTechBonusMultiplier: vi.fn().mockReturnValue(1), getEffectValue: vi.fn().mockReturnValue(0) } as unknown as Record<string, unknown>,
    techPoint: { syncAcademyLevel: vi.fn(), update: vi.fn(), syncResearchSpeedBonus: vi.fn() } as unknown as Record<string, unknown>,
    techResearch: { update: vi.fn() } as unknown as Record<string, unknown>,
    eventTrigger: createMockSystem() as unknown as ISubsystem,
    eventNotification: createMockSystem() as unknown as ISubsystem,
    eventUI: createMockSystem() as unknown as ISubsystem,
    eventChain: createMockSystem() as unknown as ISubsystem,
    eventLog: createMockSystem() as unknown as ISubsystem,
    offlineEvent: createMockSystem() as unknown as ISubsystem,
    bus: { emit: vi.fn() } as unknown as Record<string, unknown>,
    prevResourcesJson: '',
    prevRatesJson: '',
    ...overrides,
  };
}

describe('engine-tick — siege 集成', () => {
  it('executeTick 调用 siege.update()', () => {
    const siegeUpdateSpy = vi.fn();
    const siege = {
      update: siegeUpdateSpy,
    } as unknown as SiegeSystem;

    const ctx = createMockTickCtx({ siege });
    executeTick(ctx, 0.016);

    expect(siegeUpdateSpy).toHaveBeenCalledWith(0.016);
  });

  it('executeTick 无 siege 时不报错', () => {
    const ctx = createMockTickCtx();
    expect(() => executeTick(ctx, 0.016)).not.toThrow();
  });

  it('siege.update 在 tick 流程中被调用实现每日重置', () => {
    // 创建真实的 SiegeSystem
    const siege = new SiegeSystem();
    const deps = createMockDeps();
    siege.init(deps);

    // 模拟已使用2次攻城
    const saveData = siege.serialize();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    saveData.lastSiegeDate = yesterday.toISOString().slice(0, 10);
    saveData.dailySiegeCount = 2;
    siege.deserialize(saveData);

    expect(siege.getRemainingDailySieges()).toBe(1); // 3 - 2 = 1

    // 通过 tick 触发 siege.update
    const ctx = createMockTickCtx({ siege });
    executeTick(ctx, 0.016);

    // 每日次数应已重置为3
    expect(siege.getRemainingDailySieges()).toBe(3);
  });
});
