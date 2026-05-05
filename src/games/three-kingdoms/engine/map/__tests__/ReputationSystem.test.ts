/**
 * ReputationSystem 单元测试 (声望衰减系统)
 *
 * 测试声望获取/衰减/豁免条件/per-faction判定
 */

import { ReputationSystem } from '../ReputationSystem';
import type { ISystemDeps, IEventBus } from '../../../core/types';

function createMockDeps(): ISystemDeps {
  const eventBus: IEventBus = { emit: jest.fn(), on: jest.fn(), off: jest.fn() };
  return {
    eventBus,
    registry: { get: jest.fn(), getAll: jest.fn() },
    config: {} as any,
  };
}

describe('ReputationSystem (声望衰减系统)', () => {
  let system: ReputationSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    system = new ReputationSystem();
    deps = createMockDeps();
    system.init(deps);
  });

  // ── 初始状态 ─────────────────────────────────

  describe('初始状态', () => {
    it('三阵营初始声望50', () => {
      expect(system.getReputation('wei')).toBe(50);
      expect(system.getReputation('shu')).toBe(50);
      expect(system.getReputation('wu')).toBe(50);
    });

    it('初始等级为中立', () => {
      expect(system.getLevel('wei')).toBe('neutral');
      expect(system.getLevel('shu')).toBe('neutral');
      expect(system.getLevel('wu')).toBe('neutral');
    });
  });

  // ── 声望等级 ─────────────────────────────────

  describe('声望等级', () => {
    it('80~100: 崇敬', () => {
      system.addReputation('wei', 30, 'test'); // 50+30=80
      expect(system.getLevel('wei')).toBe('revered');
    });

    it('60~79: 友好', () => {
      system.addReputation('wei', 15, 'test'); // 50+15=65
      expect(system.getLevel('wei')).toBe('friendly');
    });

    it('40~59: 中立', () => {
      expect(system.getLevel('wei')).toBe('neutral');
    });

    it('20~39: 冷淡', () => {
      system.reduceReputation('wei', 15, 'test'); // 50-15=35
      expect(system.getLevel('wei')).toBe('cold');
    });

    it('0~19: 敌对', () => {
      system.reduceReputation('wei', 35, 'test'); // 50-35=15
      expect(system.getLevel('wei')).toBe('hostile');
    });
  });

  // ── 声望效果 ─────────────────────────────────

  describe('声望效果', () => {
    it('崇敬: 商店折扣-20%', () => {
      system.addReputation('wei', 30, 'test');
      expect(system.getEffects('wei').shopDiscount).toBe(-0.20);
    });

    it('敌对: 商店价格+20%', () => {
      system.reduceReputation('wei', 35, 'test');
      expect(system.getEffects('wei').shopDiscount).toBe(0.20);
    });
  });

  // ── 声望变更 ─────────────────────────────────

  describe('声望变更', () => {
    it('增加声望不超过上限100', () => {
      system.addReputation('wei', 100, 'test');
      expect(system.getReputation('wei')).toBe(100);
    });

    it('减少声望不低于下限0', () => {
      system.reduceReputation('wei', 100, 'test');
      expect(system.getReputation('wei')).toBe(0);
    });

    it('触发changed事件', () => {
      system.addReputation('wei', 10, 'test');
      expect(deps.eventBus.emit).toHaveBeenCalledWith('reputation:changed', expect.objectContaining({
        faction: 'wei',
        amount: 10,
        source: 'test',
      }));
    });

    it('标记今日声望事件', () => {
      system.addReputation('wei', 10, 'test');
      expect(system.hasFactionEventToday('wei')).toBe(true);
      expect(system.hasFactionEventToday('shu')).toBe(false);
    });
  });

  // ── 每日衰减 ─────────────────────────────────

  describe('每日衰减', () => {
    it('无豁免: 声望-1', () => {
      system.executeDailyDecay();
      expect(system.getReputation('wei')).toBe(49);
      expect(system.getReputation('shu')).toBe(49);
      expect(system.getReputation('wu')).toBe(49);
    });

    it('声望为0时不衰减(下限保护)', () => {
      system.reduceReputation('wei', 50, 'test');
      expect(system.getReputation('wei')).toBe(0);
      system.executeDailyDecay();
      expect(system.getReputation('wei')).toBe(0);
    });

    it('昨日活跃豁免', () => {
      system.markActive();
      system.executeDailyDecay();
      expect(system.getReputation('wei')).toBe(50); // 不衰减
    });

    it('当日声望事件豁免(per-faction)', () => {
      system.markFactionEvent('wei');
      system.executeDailyDecay();
      expect(system.getReputation('wei')).toBe(50); // 魏不衰减
      expect(system.getReputation('shu')).toBe(49); // 蜀衰减
      expect(system.getReputation('wu')).toBe(49); // 吴衰减
    });

    it('衰减后重置今日事件标记', () => {
      system.markFactionEvent('wei');
      system.executeDailyDecay();
      expect(system.hasFactionEventToday('wei')).toBe(false);
    });

    it('触发衰减事件', () => {
      system.executeDailyDecay();
      expect(deps.eventBus.emit).toHaveBeenCalledWith('reputation:decayed', expect.objectContaining({
        faction: 'wei',
        amount: 1,
      }));
    });
  });

  // ── 序列化 ───────────────────────────────────

  describe('序列化', () => {
    it('serialize保存状态', () => {
      system.addReputation('wei', 10, 'test');
      system.markActive();
      const data = system.serialize();
      expect(data.reputation.wei).toBe(60);
      expect(data.lastActiveDate).toBeTruthy();
    });

    it('deserialize恢复状态', () => {
      const data = {
        reputation: { wei: 80, shu: 30, wu: 50 },
        lastActiveDate: '2026-05-01',
        factionEventToday: 0b011,
        version: 1,
      };
      system.deserialize(data);
      expect(system.getReputation('wei')).toBe(80);
      expect(system.getReputation('shu')).toBe(30);
      expect(system.hasFactionEventToday('wei')).toBe(true);
      expect(system.hasFactionEventToday('shu')).toBe(true);
      expect(system.hasFactionEventToday('wu')).toBe(false);
    });

    it('deserialize处理null', () => {
      system.addReputation('wei', 10, 'test');
      system.deserialize(null as any);
      expect(system.getReputation('wei')).toBe(50);
    });
  });
});
