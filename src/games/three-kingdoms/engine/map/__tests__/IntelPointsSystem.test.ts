/**
 * IntelPointsSystem 单元测试 (情报值系统)
 *
 * 测试情报值获取/上限/每日限制/兑换/约束逻辑
 */

import { IntelPointsSystem } from '../IntelPointsSystem';
import type { ISystemDeps, IEventBus } from '../../../core/types';

function createMockDeps(): ISystemDeps {
  const eventBus: IEventBus = { emit: jest.fn(), on: jest.fn(), off: jest.fn() };
  return {
    eventBus,
    registry: { get: jest.fn(), getAll: jest.fn() },
    config: {} as any,
  };
}

describe('IntelPointsSystem (情报值系统)', () => {
  let system: IntelPointsSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    system = new IntelPointsSystem();
    deps = createMockDeps();
    system.init(deps);
  });

  // ── 初始状态 ─────────────────────────────────

  describe('初始状态', () => {
    it('初始情报值为0', () => {
      expect(system.getCurrent()).toBe(0);
    });

    it('上限为100', () => {
      expect(system.getMaxCap()).toBe(100);
    });

    it('每日获取上限为5', () => {
      expect(system.getDailyLimit()).toBe(5);
    });

    it('重试令牌兑换成本为10', () => {
      expect(system.getRetryTokenCost()).toBe(10);
    });
  });

  // ── 获取 ─────────────────────────────────────

  describe('获取', () => {
    it('每次获取+1', () => {
      const amount = system.acquire('test');
      expect(amount).toBe(1);
      expect(system.getCurrent()).toBe(1);
    });

    it('每日获取上限5', () => {
      for (let i = 0; i < 5; i++) {
        system.acquire('test');
      }
      expect(system.getDailyGained()).toBe(5);
      expect(system.acquire('test')).toBe(0); // 第6次失败
    });

    it('总量上限100', () => {
      // 模拟直接设置到接近上限
      for (let i = 0; i < 20; i++) {
        system.checkDailyReset();
        system.acquire('test');
        system.acquire('test');
        system.acquire('test');
        system.acquire('test');
        system.acquire('test');
        // 模拟跨天
        (system as any).lastResetDate = '';
      }
      // 不会超过100
      expect(system.getCurrent()).toBeLessThanOrEqual(100);
    });

    it('触发acquired事件', () => {
      system.acquire('bandit-quick');
      expect(deps.eventBus.emit).toHaveBeenCalledWith('intelPoints:acquired', expect.objectContaining({
        source: 'bandit-quick',
        amount: 1,
      }));
    });

    it('达上限时触发acquireFailed事件', () => {
      for (let i = 0; i < 5; i++) system.acquire('test');
      system.acquire('test');
      expect(deps.eventBus.emit).toHaveBeenCalledWith('intelPoints:acquireFailed', expect.objectContaining({
        reason: 'dailyLimitReached',
      }));
    });
  });

  // ── 消费 ─────────────────────────────────────

  describe('消费', () => {
    it('有余额时消费成功', () => {
      system.acquire('test');
      expect(system.consume(1, 'test')).toBe(true);
      expect(system.getCurrent()).toBe(0);
    });

    it('余额不足时消费失败', () => {
      expect(system.consume(1, 'test')).toBe(false);
    });

    it('触发consumed事件', () => {
      system.acquire('test');
      system.consume(1, 'test');
      expect(deps.eventBus.emit).toHaveBeenCalledWith('intelPoints:consumed', expect.objectContaining({
        amount: 1,
      }));
    });
  });

  // ── 兑换 ─────────────────────────────────────

  describe('兑换重试令牌', () => {
    it('10点可兑换', () => {
      // 模拟2天获取10点(每日限5)
      for (let i = 0; i < 5; i++) system.acquire('test');
      (system as any).lastResetDate = ''; // 模拟跨天
      for (let i = 0; i < 5; i++) system.acquire('test');
      expect(system.canExchangeRetryToken()).toBe(true);
      expect(system.exchangeRetryToken()).toBe(true);
      expect(system.getCurrent()).toBe(0);
    });

    it('不足10点不可兑换', () => {
      for (let i = 0; i < 9; i++) {
        system.acquire('test');
        if (i === 4) (system as any).lastResetDate = ''; // 模拟跨天
      }
      expect(system.canExchangeRetryToken()).toBe(false);
      expect(system.exchangeRetryToken()).toBe(false);
    });

    it('触发exchange事件', () => {
      for (let i = 0; i < 5; i++) system.acquire('test');
      (system as any).lastResetDate = '';
      for (let i = 0; i < 5; i++) system.acquire('test');
      system.exchangeRetryToken();
      expect(deps.eventBus.emit).toHaveBeenCalledWith('intelPoints:retryTokenExchanged', expect.objectContaining({
        cost: 10,
      }));
    });
  });

  // ── 每日重置 ─────────────────────────────────

  describe('每日重置', () => {
    it('跨天后每日计数重置', () => {
      for (let i = 0; i < 5; i++) system.acquire('test');
      expect(system.getDailyGained()).toBe(5);
      // 模拟跨天
      (system as any).lastResetDate = '2020-01-01';
      system.checkDailyReset();
      expect(system.getDailyGained()).toBe(0);
    });
  });

  // ── 序列化 ───────────────────────────────────

  describe('序列化', () => {
    it('serialize保存状态', () => {
      system.acquire('test');
      system.acquire('test');
      const data = system.serialize();
      expect(data.current).toBe(2);
      expect(data.dailyGained).toBe(2);
    });

    it('deserialize恢复状态', () => {
      const data = { current: 50, dailyGained: 3, lastResetDate: '2026-05-01', version: 1 };
      system.deserialize(data);
      expect(system.getCurrent()).toBe(50);
      expect(system.getDailyGained()).toBe(3);
    });

    it('deserialize处理null', () => {
      system.acquire('test');
      system.deserialize(null as any);
      expect(system.getCurrent()).toBe(0);
    });
  });

  // ── 完整生命周期 ─────────────────────────────

  describe('完整生命周期', () => {
    it('获取→积累→兑换闭环', () => {
      // 模拟2天获取10点
      for (let i = 0; i < 5; i++) system.acquire('bandit');
      // 模拟跨天
      (system as any).lastResetDate = '';
      for (let i = 0; i < 5; i++) system.acquire('bandit');

      expect(system.getCurrent()).toBe(10);
      expect(system.canExchangeRetryToken()).toBe(true);

      // 兑换
      const success = system.exchangeRetryToken();
      expect(success).toBe(true);
      expect(system.getCurrent()).toBe(0);
    });
  });
});
