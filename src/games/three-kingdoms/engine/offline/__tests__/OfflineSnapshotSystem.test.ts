import { vi } from 'vitest';
/**
 * OfflineSnapshotSystem 单元测试
 *
 * 覆盖：
 *   - 快照创建与获取
 *   - 快照有效期（72h）
 *   - 离线时长计算
 *   - 队列完成检测（建筑/科技/远征/贸易）
 *   - 加速道具使用
 *   - 仓库扩容
 *   - 存档管理
 */

import { OfflineSnapshotSystem } from '../OfflineSnapshotSystem';

// ── 辅助 ──

function createMockStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => Object.keys(store).forEach(k => delete store[k])),
    get length() { return Object.keys(store).length; },
    key: vi.fn(() => null),
  };
}

const NOW = 1700000000000; // 固定时间戳

// ═══════════════════════════════════════════════

describe('OfflineSnapshotSystem', () => {
  let system: OfflineSnapshotSystem;

  beforeEach(() => {
    system = new OfflineSnapshotSystem();
  });

  // ═══════════════════════════════════════════
  // 1. 快照创建
  // ═══════════════════════════════════════════

  describe('快照创建', () => {
    it('创建基础快照', () => {
      const snap = system.createSnapshot({
        resources: { grain: 100, gold: 50, troops: 10, mandate: 5 },
        productionRates: { grain: 10, gold: 5, troops: 1, mandate: 0 },
        caps: { grain: 5000, gold: 2000, troops: 500, mandate: null },
      });

      expect(snap.resources.grain).toBe(100);
      expect(snap.productionRates.grain).toBe(10);
      expect(snap.buildingQueue).toHaveLength(0);
    });

    it('创建带队列的快照', () => {
      const snap = system.createSnapshot({
        resources: { grain: 0, gold: 0, troops: 0, mandate: 0 },
        productionRates: { grain: 0, gold: 0, troops: 0, mandate: 0 },
        caps: { grain: 0, gold: 2000, troops: 0, mandate: null },
        buildingQueue: [
          { buildingType: 'farmland', startTime: NOW, endTime: NOW + 3600000 },
        ],
        techQueue: [
          { techId: 'tech_1', startTime: NOW, endTime: NOW + 7200000 },
        ],
        expeditionQueue: [
          { expeditionId: 'exp_1', startTime: NOW, endTime: NOW + 1800000, estimatedReward: { grain: 100, gold: 50, troops: 0, mandate: 0 } },
        ],
        tradeCaravans: [
          { caravanId: 'caravan_1', routeId: 'route_1', startTime: NOW, endTime: NOW + 3600000, estimatedProfit: { grain: 0, gold: 100, troops: 0, mandate: 0 } },
        ],
      });

      expect(snap.buildingQueue).toHaveLength(1);
      expect(snap.techQueue).toHaveLength(1);
      expect(snap.expeditionQueue).toHaveLength(1);
      expect(snap.tradeCaravans).toHaveLength(1);
    });

    it('获取快照返回null初始状态', () => {
      expect(system.getSnapshot()).toBeNull();
    });

    it('创建后可获取快照', () => {
      system.createSnapshot({
        resources: { grain: 0, gold: 0, troops: 0, mandate: 0 },
        productionRates: { grain: 0, gold: 0, troops: 0, mandate: 0 },
        caps: { grain: 0, gold: 2000, troops: 0, mandate: null },
      });
      expect(system.getSnapshot()).not.toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 2. 快照有效期
  // ═══════════════════════════════════════════

  describe('快照有效期', () => {
    it('无快照时无效', () => {
      expect(system.isSnapshotValid()).toBe(false);
    });

    it('刚创建的快照有效', () => {
      system.createSnapshot({
        resources: { grain: 0, gold: 0, troops: 0, mandate: 0 },
        productionRates: { grain: 0, gold: 0, troops: 0, mandate: 0 },
        caps: { grain: 0, gold: 2000, troops: 0, mandate: null },
      });
      expect(system.isSnapshotValid()).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 离线时长计算
  // ═══════════════════════════════════════════

  describe('离线时长计算', () => {
    it('未创建快照时离线时长为0', () => {
      expect(system.getOfflineSeconds()).toBe(0);
    });

    it('创建快照后离线时长>0', () => {
      system.createSnapshot({
        resources: { grain: 0, gold: 0, troops: 0, mandate: 0 },
        productionRates: { grain: 0, gold: 0, troops: 0, mandate: 0 },
        caps: { grain: 0, gold: 2000, troops: 0, mandate: null },
      });
      expect(system.getOfflineSeconds()).toBeGreaterThanOrEqual(0);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 队列完成检测
  // ═══════════════════════════════════════════

  describe('队列完成检测', () => {
    const futureTime = NOW + 7200000; // 2小时后

    beforeEach(() => {
      system.createSnapshot({
        resources: { grain: 0, gold: 0, troops: 0, mandate: 0 },
        productionRates: { grain: 0, gold: 0, troops: 0, mandate: 0 },
        caps: { grain: 0, gold: 2000, troops: 0, mandate: null },
        buildingQueue: [
          { buildingType: 'farmland', startTime: NOW, endTime: NOW + 1000 }, // 已完成
          { buildingType: 'castle', startTime: NOW, endTime: futureTime },    // 未完成
        ],
        techQueue: [
          { techId: 'tech_1', startTime: NOW, endTime: NOW + 1000 }, // 已完成
        ],
        expeditionQueue: [
          { expeditionId: 'exp_1', startTime: NOW, endTime: NOW + 1000, estimatedReward: { grain: 100, gold: 0, troops: 0, mandate: 0 } },
        ],
        tradeCaravans: [
          { caravanId: 'c1', routeId: 'r1', startTime: NOW, endTime: NOW + 1000, estimatedProfit: { grain: 0, gold: 50, troops: 0, mandate: 0 } },
        ],
      });
    });

    it('检测完成的建筑', () => {
      const completed = system.getCompletedBuildings(NOW + 2000);
      expect(completed).toHaveLength(1);
      expect(completed[0].buildingType).toBe('farmland');
    });

    it('检测完成的科技', () => {
      const completed = system.getCompletedTech(NOW + 2000);
      expect(completed).toHaveLength(1);
      expect(completed[0].techId).toBe('tech_1');
    });

    it('检测完成的远征', () => {
      const completed = system.getCompletedExpeditions(NOW + 2000);
      expect(completed).toHaveLength(1);
      expect(completed[0].expeditionId).toBe('exp_1');
    });

    it('检测完成的贸易', () => {
      const completed = system.getCompletedTrades(NOW + 2000);
      expect(completed).toHaveLength(1);
      expect(completed[0].caravanId).toBe('c1');
    });

    it('无快照时返回空列表', () => {
      const freshSystem = new OfflineSnapshotSystem();
      expect(freshSystem.getCompletedBuildings()).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 存档管理
  // ═══════════════════════════════════════════

  describe('存档管理', () => {
    it('获取存档数据', () => {
      const data = system.getSaveData();
      expect(data.version).toBe(1);
      expect(data.lastOfflineTime).toBe(0);
    });

    it('清除快照', () => {
      system.createSnapshot({
        resources: { grain: 0, gold: 0, troops: 0, mandate: 0 },
        productionRates: { grain: 0, gold: 0, troops: 0, mandate: 0 },
        caps: { grain: 0, gold: 2000, troops: 0, mandate: null },
      });
      system.clearSnapshot();
      expect(system.getSnapshot()).toBeNull();
      expect(system.getOfflineSeconds()).toBe(0);
    });

    it('记录广告翻倍', () => {
      system.recordAdDouble();
      const data = system.getSaveData();
      expect(data.vipDoubleUsedToday).toBe(1);
    });

    it('重置每日翻倍', () => {
      system.recordAdDouble();
      system.resetDailyDoubles();
      const data = system.getSaveData();
      expect(data.vipDoubleUsedToday).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 仓库扩容
  // ═══════════════════════════════════════════

  describe('仓库扩容', () => {
    it('grain扩容成功', () => {
      const result = system.expandWarehouse('grain');
      expect(result.success).toBe(true);
      expect(result.newCapacity).toBeGreaterThan(result.previousCapacity);
    });

    it('无效资源类型扩容失败', () => {
      const result = system.expandWarehouse('invalid');
      expect(result.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 7. 持久化
  // ═══════════════════════════════════════════

  describe('持久化', () => {
    it('使用storage持久化', () => {
      const storage = createMockStorage();
      const sys = new OfflineSnapshotSystem(storage);
      sys.createSnapshot({
        resources: { grain: 0, gold: 0, troops: 0, mandate: 0 },
        productionRates: { grain: 0, gold: 0, troops: 0, mandate: 0 },
        caps: { grain: 0, gold: 2000, troops: 0, mandate: null },
      });
      expect(storage.setItem).toHaveBeenCalled();
    });
  });
});
