/**
 * OfflineTradeAndBoost 单元测试
 *
 * 覆盖：
 *   - 加速道具列表获取
 *   - 加速道具使用（成功/失败）
 *   - 离线贸易模拟
 */

import { describe, it, expect } from 'vitest';
import { getBoostItemList, useBoostItem, simulateOfflineTrade } from '../OfflineTradeAndBoost';

const RATES = { grain: 10, gold: 5, troops: 2, mandate: 1 };
const HOUR_S = 3600;

// ═══════════════════════════════════════════════

describe('OfflineTradeAndBoost — 加速道具', () => {
  describe('getBoostItemList', () => {
    it('应返回4种道具', () => {
      const inventory = new Map<string, number>();
      const items = getBoostItemList(inventory);
      expect(items).toHaveLength(4);
    });

    it('空库存时数量为0', () => {
      const inventory = new Map<string, number>();
      const items = getBoostItemList(inventory);
      expect(items.every(i => i.count === 0)).toBe(true);
    });

    it('有库存时返回正确数量', () => {
      const inventory = new Map<string, number>();
      inventory.set('offline_boost_1h', 3);
      inventory.set('offline_boost_4h', 1);
      const items = getBoostItemList(inventory);
      const item1h = items.find(i => i.id === 'offline_boost_1h');
      const item4h = items.find(i => i.id === 'offline_boost_4h');
      expect(item1h!.count).toBe(3);
      expect(item4h!.count).toBe(1);
    });
  });

  describe('useBoostItem', () => {
    it('使用1小时加速道具成功', () => {
      const inventory = new Map<string, number>();
      inventory.set('offline_boost_1h', 2);
      const result = useBoostItem('offline_boost_1h', inventory, RATES);

      expect(result.success).toBe(true);
      expect(result.addedSeconds).toBe(HOUR_S);
      expect(result.addedEarned.grain).toBeCloseTo(36000, 2);
      expect(result.remainingCount).toBe(1);
      expect(inventory.get('offline_boost_1h')).toBe(1);
    });

    it('使用4小时加速道具成功', () => {
      const inventory = new Map<string, number>();
      inventory.set('offline_boost_4h', 1);
      const result = useBoostItem('offline_boost_4h', inventory, RATES);

      expect(result.success).toBe(true);
      expect(result.addedSeconds).toBe(4 * HOUR_S);
    });

    it('使用8小时加速道具成功', () => {
      const inventory = new Map<string, number>();
      inventory.set('offline_boost_8h', 1);
      const result = useBoostItem('offline_boost_8h', inventory, RATES);

      expect(result.success).toBe(true);
      expect(result.addedSeconds).toBe(8 * HOUR_S);
    });

    it('道具不足时失败', () => {
      const inventory = new Map<string, number>();
      const result = useBoostItem('offline_boost_1h', inventory, RATES);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不足');
    });

    it('无效道具ID失败', () => {
      const inventory = new Map<string, number>();
      inventory.set('invalid_item', 1);
      const result = useBoostItem('invalid_item', inventory, RATES);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('无效');
    });

    it('使用后库存正确减少', () => {
      const inventory = new Map<string, number>();
      inventory.set('offline_boost_1h', 1);
      useBoostItem('offline_boost_1h', inventory, RATES);
      expect(inventory.get('offline_boost_1h')).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════

describe('OfflineTradeAndBoost — 离线贸易', () => {
  const profit = { grain: 0, gold: 100, troops: 0, mandate: 0 };
  const now = Date.now();

  it('离线不足1小时无贸易', () => {
    const summary = simulateOfflineTrade(1800, profit, now);
    expect(summary.completedTrades).toBe(0);
    expect(summary.events).toHaveLength(0);
  });

  it('离线1小时完成1次贸易', () => {
    const summary = simulateOfflineTrade(HOUR_S, profit, now);
    expect(summary.completedTrades).toBe(1);
    expect(summary.events).toHaveLength(1);
    // 100 * 0.6 = 60
    expect(summary.totalProfit.gold).toBeCloseTo(60, 2);
  });

  it('贸易次数不超过MAX_OFFLINE_TRADES(3)', () => {
    const summary = simulateOfflineTrade(10 * HOUR_S, profit, now);
    expect(summary.completedTrades).toBe(3);
  });

  it('贸易事件时间正确', () => {
    const summary = simulateOfflineTrade(2 * HOUR_S, profit, now);
    expect(summary.events[0].startTime).toBe(now);
    expect(summary.events[0].completeTime).toBe(now + HOUR_S);
  });

  it('0秒离线无贸易', () => {
    const summary = simulateOfflineTrade(0, profit, now);
    expect(summary.completedTrades).toBe(0);
  });
});
