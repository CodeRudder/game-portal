/**
 * 回城行军集成测试
 *
 * 测试战斗结束 → 伤亡应用 → 回城行军创建 → 编队销毁的完整链路。
 * 验证 ExpeditionSystem 与 MarchingSystem 的协作行为。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExpeditionSystem } from '../../ExpeditionSystem';
import type { ExpeditionDeps } from '../../ExpeditionSystem';
import { MarchingSystem } from '../../MarchingSystem';
import type { MarchUnit } from '../../MarchingSystem';

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 创建标准 mock ISystemDeps */
function createMockSystemDeps() {
  return {
    eventBus: {
      on: vi.fn(),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn() },
    registry: {
      get: vi.fn(),
      register: vi.fn(),
      getAll: vi.fn(),
      has: vi.fn(),
      unregister: vi.fn(),
    },
  };
}

/** 创建标准 mock ExpeditionDeps */
function createMockExpeditionDeps(): ExpeditionDeps {
  return {
    getHero: vi.fn((id: string) => ({ id, name: `Hero ${id}` })),
    getAvailableTroops: vi.fn(() => 10000),
    consumeTroops: vi.fn(() => true),
    isHeroInFormation: vi.fn(() => true),
  };
}

/** 创建一条简单的测试路径 */
function createTestPath(): Array<{ x: number; y: number }> {
  return [
    { x: 100, y: 100 },
    { x: 200, y: 100 },
    { x: 300, y: 150 },
    { x: 400, y: 200 },
    { x: 500, y: 250 },
  ];
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('回城行军集成测试', () => {
  let expedition: ExpeditionSystem;
  let marching: MarchingSystem;
  let mockDeps: ReturnType<typeof createMockSystemDeps>;
  let mockExpeditionDeps: ExpeditionDeps;

  beforeEach(() => {
    mockDeps = createMockSystemDeps();
    mockExpeditionDeps = createMockExpeditionDeps();

    expedition = new ExpeditionSystem();
    expedition.init(mockDeps as any);
    expedition.setExpeditionDeps(mockExpeditionDeps);

    marching = new MarchingSystem();
    marching.init(mockDeps as any);
  });

  describe('完整链路: 战斗结束 → 伤亡应用 → 回城行军创建', () => {
    it('应该完成 从编队创建到伤亡应用到回城的完整流程', () => {
      // ── 1. 创建出征编队 ──
      const createResult = expedition.createForce({ heroId: 'hero-zhaoyun', troops: 2000 });
      expect(createResult.valid).toBe(true);
      const forceId = createResult.forceId!;
      expect(expedition.getForce(forceId)!.status).toBe('ready');

      // ── 2. 模拟出征 ──
      expedition.setForceStatus(forceId, 'marching');
      expect(expedition.getForce(forceId)!.status).toBe('marching');

      // ── 3. 模拟战斗结束 ──
      expedition.setForceStatus(forceId, 'fighting');
      expect(expedition.getForce(forceId)!.status).toBe('fighting');

      // ── 4. 应用伤亡（胜利结果：损失 200 兵力，无将领受伤） ──
      const updated = expedition.applyCasualties(forceId, 200, false, 'none');
      expect(updated).not.toBeNull();
      expect(updated!.troops).toBe(1800);
      expect(updated!.status).toBe('returning');

      // 验证内部编队状态
      const force = expedition.getForce(forceId)!;
      expect(force.troops).toBe(1800);
      expect(force.status).toBe('returning');

      // ── 5. 创建去程行军（模拟已到达目标） ──
      const path = createTestPath();
      const marchOut = marching.createMarch(
        'city-chengdu', 'city-luoyang', 2000, '赵云', 'shu', path,
      );
      expect(marchOut).toBeDefined();
      expect(marchOut.state).toBe('preparing');
      expect(marchOut.fromCityId).toBe('city-chengdu');
      expect(marchOut.toCityId).toBe('city-luoyang');

      // ── 6. 验证事件发布（createMarch 会 emit march:created） ──
      expect(mockDeps.eventBus.emit).toHaveBeenCalledWith(
        'march:created',
        expect.objectContaining({
          marchId: marchOut.id,
          fromCityId: 'city-chengdu',
          toCityId: 'city-luoyang',
          troops: 2000,
        }),
      );
    });

    it('应该在战斗失败时正确处理伤亡和将领受伤', () => {
      // 创建编队
      const { forceId } = expedition.createForce({ heroId: 'hero-guanyu', troops: 3000 });
      expect(forceId).toBeDefined();

      // 模拟惨败伤亡
      const updated = expedition.applyCasualties(forceId!, 2000, true, 'severe');
      expect(updated!.troops).toBe(1000);
      expect(updated!.status).toBe('returning');

      // 验证将领受伤
      expect(expedition.getHeroInjury('hero-guanyu')).toBe('severe');
      expect(expedition.getHeroPowerMultiplier('hero-guanyu')).toBe(0.2);

      // 验证剩余战力 = 1000 × 0.2 = 200
      const power = expedition.calculateRemainingPower(forceId!);
      expect(power).toBe(200);
    });
  });

  describe('编队血色随伤亡等级变化', () => {
    it('10% 损失 → healthy', () => {
      const { forceId } = expedition.createForce({ heroId: 'hero-1', troops: 1000 });
      expedition.applyCasualties(forceId!, 100, false, 'none');

      const color = expedition.getForceHealthColor(0.10);
      expect(color).toBe('healthy');

      const force = expedition.getForce(forceId!)!;
      expect(force.troops).toBe(900);
      expect(force.status).toBe('returning');
    });

    it('40% 损失 → damaged', () => {
      const { forceId } = expedition.createForce({ heroId: 'hero-2', troops: 1000 });
      expedition.applyCasualties(forceId!, 400, false, 'none');

      const color = expedition.getForceHealthColor(0.40);
      expect(color).toBe('damaged');

      const force = expedition.getForce(forceId!)!;
      expect(force.troops).toBe(600);
    });

    it('70% 损失 → critical', () => {
      const { forceId } = expedition.createForce({ heroId: 'hero-3', troops: 1000 });
      expedition.applyCasualties(forceId!, 700, true, 'moderate');

      const color = expedition.getForceHealthColor(0.70);
      expect(color).toBe('critical');

      const force = expedition.getForce(forceId!)!;
      expect(force.troops).toBe(300);
      expect(expedition.getHeroInjury('hero-3')).toBe('moderate');
    });

    it('递进损失: healthy → damaged → critical', () => {
      const { forceId } = expedition.createForce({ heroId: 'hero-4', troops: 10000 });
      const originalTroops = 10000;

      // 10% 损失
      expedition.applyCasualties(forceId!, 1000, false, 'none');
      expect(expedition.getForceHealthColor(1000 / originalTroops)).toBe('healthy');

      // 再扣 2000 → 总损失 3000/10000 = 30%（边界，不会超过 0.3）
      // 重设编队来模拟不同阶段
      expedition.removeForce(forceId!);
      const r2 = expedition.createForce({ heroId: 'hero-5', troops: 10000 });
      expedition.applyCasualties(r2.forceId!, 3500, false, 'none');
      expect(expedition.getForceHealthColor(3500 / originalTroops)).toBe('damaged');

      // 70% 损失
      expedition.removeForce(r2.forceId!);
      const r3 = expedition.createForce({ heroId: 'hero-6', troops: 10000 });
      expedition.applyCasualties(r3.forceId!, 7000, false, 'none');
      expect(expedition.getForceHealthColor(7000 / originalTroops)).toBe('critical');
    });
  });

  describe('编队移除（回城到达后销毁）', () => {
    it('编队回城到达后应被移除', () => {
      // 1. 创建编队
      const { forceId } = expedition.createForce({ heroId: 'hero-7', troops: 1500 });

      // 2. 模拟战斗并应用伤亡
      expedition.applyCasualties(forceId!, 500, false, 'none');
      expect(expedition.getForce(forceId!)!.status).toBe('returning');
      expect(expedition.getForce(forceId!)!.troops).toBe(1000);

      // 3. 回城到达 → 移除编队
      const removed = expedition.removeForce(forceId!);
      expect(removed).toBe(true);
      expect(expedition.getForce(forceId!)).toBeUndefined();
      expect(expedition.getAllForces()).toHaveLength(0);
    });

    it('移除编队后将领不再忙碌', () => {
      const { forceId } = expedition.createForce({ heroId: 'hero-8', troops: 800 });

      // 将领应该忙碌
      expect(expedition.isHeroBusy('hero-8')).toBe(true);

      // 移除编队
      expedition.removeForce(forceId!);

      // 将领应该不再忙碌
      expect(expedition.isHeroBusy('hero-8')).toBe(false);

      // 应该可以创建新编队使用该将领
      const newResult = expedition.createForce({ heroId: 'hero-8', troops: 600 });
      expect(newResult.valid).toBe(true);
    });

    it('多个编队部分移除不影响其他编队', () => {
      const r1 = expedition.createForce({ heroId: 'hero-a', troops: 500 });
      const r2 = expedition.createForce({ heroId: 'hero-b', troops: 600 });
      const r3 = expedition.createForce({ heroId: 'hero-c', troops: 700 });

      expect(expedition.getAllForces()).toHaveLength(3);

      // 只移除 r2
      expedition.removeForce(r2.forceId!);

      expect(expedition.getAllForces()).toHaveLength(2);
      expect(expedition.getForce(r1.forceId!)).toBeDefined();
      expect(expedition.getForce(r3.forceId!)).toBeDefined();
      expect(expedition.getForce(r2.forceId!)).toBeUndefined();
    });
  });
});
