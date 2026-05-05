/**
 * InsiderLetterSystem 单元测试 (MAP-F06-07)
 *
 * 测试内应信生命周期: 获取/存储/查询/消费/堆叠上限
 */

import { InsiderLetterSystem } from '../InsiderLetterSystem';
import type { ISystemDeps, IEventBus } from '../../../core/types';

function createMockDeps(): ISystemDeps {
  const eventBus: IEventBus = { emit: jest.fn(), on: jest.fn(), off: jest.fn() };
  return {
    eventBus,
    registry: { get: jest.fn(), getAll: jest.fn() },
    config: {} as any,
  };
}

describe('InsiderLetterSystem (MAP-F06-07)', () => {
  let system: InsiderLetterSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    system = new InsiderLetterSystem();
    deps = createMockDeps();
    system.init(deps);
  });

  // ── 初始状态 ─────────────────────────────────

  describe('初始状态', () => {
    it('初始数量为0', () => {
      expect(system.getCount()).toBe(0);
    });

    it('堆叠上限为10', () => {
      expect(system.getMaxStack()).toBe(10);
    });

    it('不可消费', () => {
      expect(system.canConsume()).toBe(false);
    });

    it('可获取', () => {
      expect(system.canAcquire()).toBe(true);
    });
  });

  // ── 获取 ─────────────────────────────────────

  describe('概率获取', () => {
    it('100%概率必定获取', () => {
      const result = system.tryAcquire('test', 1.0, () => 0.5);
      expect(result).toBe(true);
      expect(system.getCount()).toBe(1);
    });

    it('0%概率必定失败', () => {
      const result = system.tryAcquire('test', 0.0, () => 0.5);
      expect(result).toBe(false);
      expect(system.getCount()).toBe(0);
    });

    it('20%概率(攻城胜利)大致符合', () => {
      let acquired = 0;
      for (let i = 0; i < 1000; i++) {
        const sys = new InsiderLetterSystem();
        sys.init(deps);
        if (sys.tryAcquire('siege', 0.20, () => Math.random())) acquired++;
      }
      expect(acquired).toBeGreaterThan(150);
      expect(acquired).toBeLessThan(250);
    });

    it('触发acquired事件', () => {
      system.tryAcquire('test', 1.0, () => 0.5);
      expect(deps.eventBus.emit).toHaveBeenCalledWith('insiderLetter:acquired', expect.objectContaining({
        source: 'test',
        newCount: 1,
      }));
    });
  });

  // ── 直接获取 ─────────────────────────────────

  describe('直接获取', () => {
    it('直接获取成功', () => {
      expect(system.acquireDirectly('test')).toBe(true);
      expect(system.getCount()).toBe(1);
    });

    it('累计获取计数', () => {
      system.acquireDirectly('test');
      system.acquireDirectly('test');
      expect(system.getTotalAcquired()).toBe(2);
    });
  });

  // ── 堆叠上限 ─────────────────────────────────

  describe('堆叠上限', () => {
    it('达到上限后不可获取', () => {
      for (let i = 0; i < 10; i++) {
        system.acquireDirectly('test');
      }
      expect(system.canAcquire()).toBe(false);
      expect(system.acquireDirectly('test')).toBe(false);
      expect(system.getCount()).toBe(10);
    });

    it('达到上限后概率获取失败', () => {
      for (let i = 0; i < 10; i++) {
        system.acquireDirectly('test');
      }
      const result = system.tryAcquire('test', 1.0, () => 0.5);
      expect(result).toBe(false);
    });

    it('触发acquireFailed事件', () => {
      for (let i = 0; i < 10; i++) {
        system.acquireDirectly('test');
      }
      system.tryAcquire('test', 1.0, () => 0.5);
      expect(deps.eventBus.emit).toHaveBeenCalledWith('insiderLetter:acquireFailed', expect.objectContaining({
        reason: 'stackFull',
      }));
    });
  });

  // ── 消费 ─────────────────────────────────────

  describe('消费', () => {
    it('有库存时消费成功', () => {
      system.acquireDirectly('test');
      expect(system.consume('siege')).toBe(true);
      expect(system.getCount()).toBe(0);
    });

    it('无库存时消费失败', () => {
      expect(system.consume('siege')).toBe(false);
    });

    it('累计消费计数', () => {
      system.acquireDirectly('test');
      system.acquireDirectly('test');
      system.consume('siege');
      system.consume('siege');
      expect(system.getTotalConsumed()).toBe(2);
    });

    it('触发consumed事件', () => {
      system.acquireDirectly('test');
      system.consume('siege');
      expect(deps.eventBus.emit).toHaveBeenCalledWith('insiderLetter:consumed', expect.objectContaining({
        reason: 'siege',
        newCount: 0,
      }));
    });
  });

  // ── 序列化 ───────────────────────────────────

  describe('序列化', () => {
    it('serialize保存状态', () => {
      system.acquireDirectly('test');
      system.acquireDirectly('test');
      system.consume('test');
      const data = system.serialize();
      expect(data.count).toBe(1);
      expect(data.totalAcquired).toBe(2);
      expect(data.totalConsumed).toBe(1);
    });

    it('deserialize恢复状态', () => {
      const data = { count: 5, totalAcquired: 8, totalConsumed: 3, version: 1 };
      system.deserialize(data);
      expect(system.getCount()).toBe(5);
      expect(system.getTotalAcquired()).toBe(8);
      expect(system.getTotalConsumed()).toBe(3);
    });

    it('deserialize处理null', () => {
      system.acquireDirectly('test');
      system.deserialize(null as any);
      expect(system.getCount()).toBe(0);
    });
  });

  // ── 完整生命周期 ─────────────────────────────

  describe('完整生命周期', () => {
    it('获取→存储→查询→消费闭环', () => {
      // 获取
      system.tryAcquire('siege-victory', 1.0);
      expect(system.getCount()).toBe(1);
      expect(system.canConsume()).toBe(true);

      // 查询
      expect(system.getState().count).toBe(1);
      expect(system.getState().maxStack).toBe(10);

      // 消费
      system.consume('insider-strategy');
      expect(system.getCount()).toBe(0);
      expect(system.canConsume()).toBe(false);

      // 验证累计
      expect(system.getTotalAcquired()).toBe(1);
      expect(system.getTotalConsumed()).toBe(1);
    });
  });
});
