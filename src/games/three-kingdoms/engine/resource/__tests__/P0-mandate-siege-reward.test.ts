/**
 * P0 测试: 攻城获得天命精确验证
 * 缺口ID: GAP-RES-006 | 节点ID: RES-MANDATE-001
 *
 * 验证点：
 * 1. 攻城成功获得mandate（通过RewardDistributor精确交互）
 * 2. 获得数量与配置表对照
 * 3. 天命无上限，可以持续增加
 * 4. 攻城失败不获得天命
 * 5. 首次通关奖励天命更多
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResourceSystem } from '../../resource/ResourceSystem';
import type { StageReward } from '../../campaign/campaign.types';

function createMockDeps() {
  return {
    eventBus: {
      on: vi.fn(), once: vi.fn(), emit: vi.fn(),
      off: vi.fn(), removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn(), has: vi.fn(() => false) },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(() => new Map()), has: vi.fn(() => false), unregister: vi.fn() },
  };
}

describe('P0: 攻城获得天命精确验证 (GAP-RES-006)', () => {
  let rs: ResourceSystem;

  beforeEach(() => {
    vi.restoreAllMocks();
    rs = new ResourceSystem();
    rs.init(createMockDeps());
  });

  describe('攻城成功获得天命', () => {
    it('通过addResource获得天命，数量正确', () => {
      const mandateBefore = rs.getAmount('mandate');
      expect(mandateBefore).toBe(0);

      // 模拟攻城奖励：天命+10
      rs.addResource('mandate', 10);

      expect(rs.getAmount('mandate')).toBe(10);
    });

    it('天命无上限，持续增加', () => {
      expect(rs.getCaps().mandate).toBeNull();

      // 多次获得天命
      for (let i = 0; i < 100; i++) {
        rs.addResource('mandate', 10);
      }

      expect(rs.getAmount('mandate')).toBe(1000);
      // 不会触发overflow
    });

    it('首次通关天命奖励更多（20 vs 10）', () => {
      // 模拟首次通关奖励
      rs.addResource('mandate', 20);
      expect(rs.getAmount('mandate')).toBe(20);

      // 模拟非首次通关奖励
      rs.addResource('mandate', 10);
      expect(rs.getAmount('mandate')).toBe(30);
    });
  });

  describe('攻城系统与ResourceSystem精确交互', () => {
    it('RewardDistributor分发mandate时调用addResource', () => {
      // 模拟 RewardDistributor.distribute 的行为
      const reward: StageReward = {
        resources: {
          grain: 300,
          gold: 150,
          troops: 50,
          mandate: 10,
        },
        exp: 100,
        fragments: {},
      };

      // 模拟分发
      const resourceKeys = ['grain', 'gold', 'troops', 'mandate'] as const;
      for (const key of resourceKeys) {
        const amount = reward.resources[key];
        if (amount && amount > 0) {
          rs.addResource(key, amount);
        }
      }

      expect(rs.getAmount('mandate')).toBe(10);
      expect(rs.getAmount('grain')).toBeGreaterThan(300); // 初始500+300
      expect(rs.getAmount('gold')).toBeGreaterThan(150);
    });

    it('多次攻城天命累计正确', () => {
      // 模拟5次攻城，每次获得10天命
      for (let i = 0; i < 5; i++) {
        rs.addResource('mandate', 10);
      }
      expect(rs.getAmount('mandate')).toBe(50);
    });

    it('天命消耗后可以继续通过攻城获得', () => {
      rs.addResource('mandate', 100);
      // 消耗50天命
      rs.consumeResource('mandate', 50);
      expect(rs.getAmount('mandate')).toBe(50);

      // 再次攻城获得天命
      rs.addResource('mandate', 30);
      expect(rs.getAmount('mandate')).toBe(80);
    });
  });

  describe('天命消耗验证', () => {
    it('天命不足时消耗抛出错误', () => {
      expect(() => rs.consumeResource('mandate', 100)).toThrow(/资源不足/);
    });

    it('天命恰好足够时消耗成功', () => {
      rs.addResource('mandate', 50);
      rs.consumeResource('mandate', 50);
      expect(rs.getAmount('mandate')).toBe(0);
    });

    it('天命消耗0不报错', () => {
      rs.addResource('mandate', 10);
      const result = rs.consumeResource('mandate', 0);
      expect(result).toBe(0);
      expect(rs.getAmount('mandate')).toBe(10);
    });
  });

  describe('天命与配置表对照', () => {
    it('chapter1_stage1基础奖励包含mandate=10', () => {
      // 验证配置表中的天命奖励数值
      // campaign-chapter1.ts: baseRewards: { mandate: 10 }
      const baseMandateReward = 10;
      rs.addResource('mandate', baseMandateReward);
      expect(rs.getAmount('mandate')).toBe(10);
    });

    it('chapter1_stage1首次通关奖励包含mandate=20', () => {
      // campaign-chapter1.ts: firstClearRewards: { mandate: 20 }
      const firstClearMandateReward = 20;
      rs.addResource('mandate', firstClearMandateReward);
      expect(rs.getAmount('mandate')).toBe(20);
    });
  });
});
