/**
 * SaveSlotManager 单元测试
 *
 * 覆盖：
 * 1. 槽位查询（3免费+1付费）
 * 2. 保存/加载/删除
 * 3. 付费槽位购买
 * 4. 自动存档
 * 5. 导入导出
 * 6. 云存档模拟
 * 7. 冲突解决策略
 */

import { SaveSlotManager, CloudSyncStatus } from '../SaveSlotManager';
import type { ISaveSlotStorage } from '../SaveSlotManager';
import {
  FREE_SAVE_SLOTS,
  TOTAL_SAVE_SLOTS,
  PAID_SLOT_PRICE,
  ConflictStrategy,
  CloudSyncFrequency,
} from '../../../core/settings';
import type { AccountSettings } from '../../../core/settings';
import { createDefaultAccountSettings } from '../../../core/settings';

// ─────────────────────────────────────────────
// Mock 存储
// ─────────────────────────────────────────────

function createMockStorage(): ISaveSlotStorage & { store: Record<string, string> } {
  const store: Record<string, string> = {};
  return {
    store,
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, val: string) => { store[key] = val; }),
    removeItem: jest.fn((key: string) => { delete store[key]; }),
  };
}

/** 创建 SaveSlotManager */
function createManager(storage?: ISaveSlotStorage): SaveSlotManager {
  return new SaveSlotManager(storage ?? createMockStorage());
}

/** 创建游戏数据 JSON */
function createGameData(index: number): string {
  return JSON.stringify({
    version: '1.0.0',
    resources: { gold: index * 1000 },
    timestamp: Date.now(),
  });
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('SaveSlotManager', () => {
  let storage: ReturnType<typeof createMockStorage>;
  let manager: SaveSlotManager;

  beforeEach(() => {
    storage = createMockStorage();
    manager = createManager(storage);
  });

  // ── 槽位查询 ────────────────────────────

  describe('槽位查询', () => {
    test('初始有 4 个槽位 (3免费+1付费)', () => {
      const slots = manager.getSlots();
      expect(slots).toHaveLength(TOTAL_SAVE_SLOTS);
      expect(slots).toHaveLength(4);
    });

    test('前 3 个槽位为免费', () => {
      const slots = manager.getSlots();
      for (let i = 0; i < FREE_SAVE_SLOTS; i++) {
        expect(slots[i].isPaid).toBe(false);
        expect(slots[i].purchased).toBe(true);
      }
    });

    test('第 4 个槽位为付费', () => {
      const slots = manager.getSlots();
      expect(slots[3].isPaid).toBe(true);
      expect(slots[3].purchased).toBe(false);
    });

    test('初始所有槽位为空', () => {
      expect(manager.getUsedSlotCount()).toBe(0);
      expect(manager.getAvailableSlotCount()).toBe(3); // 只有免费槽位可用
    });

    test('isSlotAvailable 免费槽位可用', () => {
      expect(manager.isSlotAvailable(0)).toBe(true);
      expect(manager.isSlotAvailable(1)).toBe(true);
      expect(manager.isSlotAvailable(2)).toBe(true);
    });

    test('isSlotAvailable 付费槽位不可用', () => {
      expect(manager.isSlotAvailable(3)).toBe(false);
    });

    test('isSlotEmpty 空槽位返回 true', () => {
      expect(manager.isSlotEmpty(0)).toBe(true);
    });

    test('getSlot 无效索引返回 null', () => {
      expect(manager.getSlot(-1)).toBeNull();
      expect(manager.getSlot(99)).toBeNull();
    });
  });

  // ── 保存操作 ────────────────────────────

  describe('保存操作', () => {
    test('saveToSlot 保存到免费槽位', () => {
      const result = manager.saveToSlot(0, createGameData(0), '第一章');
      expect(result.success).toBe(true);
      expect(manager.isSlotEmpty(0)).toBe(false);
      expect(manager.getUsedSlotCount()).toBe(1);
    });

    test('saveToSlot 保存失败：无效索引', () => {
      const result = manager.saveToSlot(99, createGameData(0), 'test');
      expect(result.success).toBe(false);
    });

    test('saveToSlot 保存失败：付费槽位未购买', () => {
      const result = manager.saveToSlot(3, createGameData(3), 'test');
      expect(result.success).toBe(false);
      expect(result.message).toContain('购买');
    });

    test('loadFromSlot 加载存档', () => {
      const data = createGameData(0);
      manager.saveToSlot(0, data, '第一章');
      const loaded = manager.loadFromSlot(0);
      expect(loaded).toBe(data);
    });

    test('loadFromSlot 空槽位返回 null', () => {
      expect(manager.loadFromSlot(0)).toBeNull();
    });

    test('deleteSlot 删除存档', () => {
      manager.saveToSlot(0, createGameData(0), '第一章');
      const result = manager.deleteSlot(0);
      expect(result.success).toBe(true);
      expect(manager.isSlotEmpty(0)).toBe(true);
    });

    test('deleteSlot 空槽位删除失败', () => {
      const result = manager.deleteSlot(0);
      expect(result.success).toBe(false);
    });

    test('保存触发 onChange 回调', () => {
      const cb = jest.fn();
      manager.onChange(cb);
      manager.saveToSlot(0, createGameData(0), 'test');
      expect(cb).toHaveBeenCalledWith(0, 'save');
    });

    test('加载触发 onChange 回调', () => {
      manager.saveToSlot(0, createGameData(0), 'test');
      const cb = jest.fn();
      manager.onChange(cb);
      manager.loadFromSlot(0);
      expect(cb).toHaveBeenCalledWith(0, 'load');
    });

    test('删除触发 onChange 回调', () => {
      manager.saveToSlot(0, createGameData(0), 'test');
      const cb = jest.fn();
      manager.onChange(cb);
      manager.deleteSlot(0);
      expect(cb).toHaveBeenCalledWith(0, 'delete');
    });

    test('覆盖保存同一槽位', () => {
      manager.saveToSlot(0, createGameData(0), '第一章');
      manager.saveToSlot(0, createGameData(1), '第二章');
      const loaded = manager.loadFromSlot(0);
      const parsed = JSON.parse(loaded!);
      expect(parsed.resources.gold).toBe(1000);
    });
  });

  // ── 付费槽位 ────────────────────────────

  describe('付费槽位', () => {
    test('purchasePaidSlot 购买成功', () => {
      const spendFn = jest.fn().mockReturnValue(true);
      const result = manager.purchasePaidSlot(spendFn);
      expect(result.success).toBe(true);
      expect(spendFn).toHaveBeenCalledWith(PAID_SLOT_PRICE);
      expect(manager.isSlotAvailable(3)).toBe(true);
      expect(manager.isPaidSlotPurchased()).toBe(true);
    });

    test('purchasePaidSlot 元宝不足', () => {
      const spendFn = jest.fn().mockReturnValue(false);
      const result = manager.purchasePaidSlot(spendFn);
      expect(result.success).toBe(false);
      expect(result.message).toContain('元宝不足');
    });

    test('购买后可保存到付费槽位', () => {
      const spendFn = jest.fn().mockReturnValue(true);
      manager.purchasePaidSlot(spendFn);
      const result = manager.saveToSlot(3, createGameData(3), '付费存档');
      expect(result.success).toBe(true);
    });
  });

  // ── 自动存档 ────────────────────────────

  describe('自动存档', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('startAutoSave 启动自动存档', () => {
      const getState = jest.fn().mockReturnValue(createGameData(0));
      manager.startAutoSave(getState, 0);
      expect(manager.isAutoSaving()).toBe(true);

      // 快进 15 分钟
      jest.advanceTimersByTime(15 * 60 * 1000);
      expect(getState).toHaveBeenCalled();
      expect(manager.getLastAutoSaveTime()).toBeGreaterThan(0);
    });

    test('stopAutoSave 停止自动存档', () => {
      manager.startAutoSave(() => createGameData(0), 0);
      manager.stopAutoSave();
      expect(manager.isAutoSaving()).toBe(false);
    });
  });

  // ── 导入导出 ────────────────────────────

  describe('导入导出', () => {
    test('exportSaves 导出所有存档', () => {
      manager.saveToSlot(0, createGameData(0), '槽位0');
      manager.saveToSlot(1, createGameData(1), '槽位1');
      const exported = manager.exportSaves();
      expect(exported.version).toBe('1.0.0');
      expect(exported.exportedAt).toBeGreaterThan(0);
      expect(Object.keys(exported.slots)).toHaveLength(2);
    });

    test('importSaves 导入存档', () => {
      manager.saveToSlot(0, createGameData(0), '槽位0');
      const exported = manager.exportSaves();

      // 新管理器导入
      const manager2 = createManager();
      const result = manager2.importSaves(exported);
      expect(result.success).toBe(true);
      expect(manager2.isSlotEmpty(0)).toBe(false);
    });

    test('importSaves 无效数据', () => {
      const result = manager.importSaves(null as any);
      expect(result.success).toBe(false);
    });

    test('导出空存档返回空 slots', () => {
      const exported = manager.exportSaves();
      expect(Object.keys(exported.slots)).toHaveLength(0);
    });
  });

  // ── 云存档 ──────────────────────────────

  describe('云存档', () => {
    test('cloudSync 同步成功', async () => {
      const account = createDefaultAccountSettings();
      const data = createGameData(0);
      const result = await manager.cloudSync(account, data);
      expect(result.status).toBe(CloudSyncStatus.Success);
      expect(result.syncedAt).toBeGreaterThan(0);
      expect(manager.getCloudSyncStatus()).toBe(CloudSyncStatus.Success);
    });

    test('cloudSync 更新最后同步时间', async () => {
      const account = createDefaultAccountSettings();
      await manager.cloudSync(account, createGameData(0));
      expect(manager.getLastCloudSyncTime()).toBeGreaterThan(0);
    });
  });

  // ── 冲突解决 ────────────────────────────

  describe('冲突解决', () => {
    const localData = '{"local":true}';
    const remoteData = '{"remote":true}';

    test('LatestWins: 远程更新 → 使用远程', () => {
      const result = manager.resolveConflict(
        ConflictStrategy.LatestWins,
        1000, 2000, localData, remoteData,
      );
      expect(result).toBe(remoteData);
    });

    test('LatestWins: 本地更新 → 使用本地', () => {
      const result = manager.resolveConflict(
        ConflictStrategy.LatestWins,
        2000, 1000, localData, remoteData,
      );
      expect(result).toBe(localData);
    });

    test('CloudWins: 始终使用远程', () => {
      const result = manager.resolveConflict(
        ConflictStrategy.CloudWins,
        2000, 1000, localData, remoteData,
      );
      expect(result).toBe(remoteData);
    });

    test('AlwaysAsk: 返回本地（由 UI 处理）', () => {
      const result = manager.resolveConflict(
        ConflictStrategy.AlwaysAsk,
        1000, 2000, localData, remoteData,
      );
      expect(result).toBe(localData);
    });
  });

  // ── 重置 ────────────────────────────────

  describe('重置', () => {
    test('reset 清除所有存档', () => {
      manager.saveToSlot(0, createGameData(0), 'test');
      manager.saveToSlot(1, createGameData(1), 'test');
      manager.reset();
      expect(manager.getUsedSlotCount()).toBe(0);
      expect(manager.getSlots()).toHaveLength(TOTAL_SAVE_SLOTS);
    });

    test('reset 停止自动存档', () => {
      manager.startAutoSave(() => createGameData(0), 0);
      manager.reset();
      expect(manager.isAutoSaving()).toBe(false);
    });

    test('取消注册后不再触发回调', () => {
      const cb = jest.fn();
      const unsub = manager.onChange(cb);
      unsub();
      manager.saveToSlot(0, createGameData(0), 'test');
      expect(cb).not.toHaveBeenCalled();
    });
  });
});
