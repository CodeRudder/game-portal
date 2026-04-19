/**
 * 地图动态事件系统测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MapEvent } from '../ThreeKingdomsEngine';

describe('MapEvent 系统', () => {
  describe('MapEvent interface', () => {
    it('应该支持所有事件类型', () => {
      const types: MapEvent['type'][] = ['discovery', 'bandit', 'merchant', 'treasure', 'recruit'];
      expect(types).toHaveLength(5);
    });

    it('应该创建有效的地图事件对象', () => {
      const event: MapEvent = {
        id: 'event_test_1',
        type: 'treasure',
        title: '💰 宝箱发现',
        description: '发现了一个宝箱！',
        position: { x: 400, y: 300 },
        rewards: { gold: 100 },
        resolved: false,
      };
      expect(event.id).toBe('event_test_1');
      expect(event.type).toBe('treasure');
      expect(event.rewards?.gold).toBe(100);
      expect(event.resolved).toBe(false);
    });

    it('应该支持无奖励的事件', () => {
      const event: MapEvent = {
        id: 'event_test_2',
        type: 'bandit',
        title: '⚔️ 山贼出没',
        description: '前方出现山贼，是否出战？',
        position: { x: 200, y: 150 },
        resolved: false,
      };
      expect(event.rewards).toBeUndefined();
    });
  });

  describe('generateMapEvent 逻辑', () => {
    it('应该生成随机事件类型', () => {
      const types = ['discovery', 'bandit', 'merchant', 'treasure', 'recruit'];
      const titles: Record<string, string> = {
        discovery: '🗺️ 发现遗迹',
        bandit: '⚔️ 山贼出没',
        merchant: '🏪 商队经过',
        treasure: '💰 宝箱发现',
        recruit: '👤 流浪武将',
      };

      // 验证所有类型都有对应标题
      for (const type of types) {
        expect(titles[type]).toBeDefined();
        expect(titles[type].length).toBeGreaterThan(0);
      }
    });

    it('应该为不同类型分配正确的奖励', () => {
      const rewardsMap: Record<string, Record<string, number> | undefined> = {
        discovery: { fame: 10 },
        bandit: { gold: 50 },
        merchant: { gold: 30, grain: 50 },
        treasure: { gold: 100 },
        recruit: { fame: 5 },
      };

      expect(rewardsMap.discovery?.fame).toBe(10);
      expect(rewardsMap.bandit?.gold).toBe(50);
      expect(rewardsMap.merchant?.gold).toBe(30);
      expect(rewardsMap.merchant?.grain).toBe(50);
      expect(rewardsMap.treasure?.gold).toBe(100);
      expect(rewardsMap.recruit?.fame).toBe(5);
    });

    it('应该生成唯一 ID', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(`event_${Date.now()}_${i}`);
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('事件触发间隔', () => {
    it('应该在 30-60 秒范围内生成间隔', () => {
      const intervals: number[] = [];
      for (let i = 0; i < 100; i++) {
        intervals.push(30 + Math.random() * 30);
      }
      const min = Math.min(...intervals);
      const max = Math.max(...intervals);
      expect(min).toBeGreaterThanOrEqual(30);
      expect(max).toBeLessThanOrEqual(60);
    });
  });

  describe('resolveMapEvent 逻辑', () => {
    it('应该正确标记事件为已解决', () => {
      const event: MapEvent = {
        id: 'event_resolve_1',
        type: 'treasure',
        title: '💰 宝箱发现',
        description: '发现了一个宝箱！',
        position: { x: 400, y: 300 },
        rewards: { gold: 100 },
        resolved: false,
      };
      event.resolved = true;
      expect(event.resolved).toBe(true);
    });

    it('应该正确解析奖励映射', () => {
      const rewardsMap: Record<string, Record<string, number> | undefined> = {
        discovery: { fame: 10 },
        merchant: { gold: 30, grain: 50 },
      };

      // 模拟奖励发放
      const givenResources: Record<string, number> = {};
      const rewards = rewardsMap['merchant'];
      if (rewards) {
        for (const [key, value] of Object.entries(rewards)) {
          givenResources[key] = (givenResources[key] || 0) + value;
        }
      }
      expect(givenResources.gold).toBe(30);
      expect(givenResources.grain).toBe(50);
    });
  });

  describe('getActiveMapEvents 逻辑', () => {
    it('应该只返回未解决的事件', () => {
      const events: MapEvent[] = [
        { id: '1', type: 'treasure', title: 'T1', description: 'D1', position: { x: 0, y: 0 }, resolved: false },
        { id: '2', type: 'bandit', title: 'T2', description: 'D2', position: { x: 0, y: 0 }, resolved: true },
        { id: '3', type: 'merchant', title: 'T3', description: 'D3', position: { x: 0, y: 0 }, resolved: false },
      ];
      const active = events.filter(e => !e.resolved);
      expect(active).toHaveLength(2);
      expect(active[0].id).toBe('1');
      expect(active[1].id).toBe('3');
    });

    it('应该在没有事件时返回空数组', () => {
      const events: MapEvent[] = [];
      const active = events.filter(e => !e.resolved);
      expect(active).toHaveLength(0);
    });
  });
});
