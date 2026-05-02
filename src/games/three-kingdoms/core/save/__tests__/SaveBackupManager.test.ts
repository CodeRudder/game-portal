// ACC-SAVE: 游戏数据修正系统测试
/**
 * SaveBackupManager 单元测试
 *
 * 覆盖：
 * - createBackup() / autoBackup()
 * - restoreBackup() / restoreLatest()
 * - listBackups()
 * - deleteBackup()
 * - 自动淘汰超出上限的旧备份
 * - 边界情况: localStorage 不可用、无存档数据、备份ID不存在
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SaveBackupManager } from '../SaveBackupManager';

// ── 常量（与源码保持一致）──────────────────────────
const SAVE_KEY = 'three-kingdoms-save';
const BACKUP_KEY_PREFIX = 'three-kingdoms-backup-';
const BACKUP_INDEX_KEY = 'three-kingdoms-backup-index';

// ── 辅助：构建有效存档 JSON ─────────────────────────
function makeSaveData(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 1,
    saveTime: Date.now(),
    resource: {
      resources: { grain: 100, gold: 200, troops: 50, mandate: 10, techPoint: 5, recruitToken: 0 },
      lastSaveTime: Date.now(),
      productionRates: {},
      caps: {},
    },
    building: {
      buildings: {
        castle: { level: 1, status: 'idle' },
        farmland: { level: 2, status: 'idle' },
        market: { level: 1, status: 'idle' },
        barracks: { level: 1, status: 'idle' },
        workshop: { level: 1, status: 'idle' },
        academy: { level: 1, status: 'idle' },
        clinic: { level: 1, status: 'idle' },
        wall: { level: 1, status: 'idle' },
      },
    },
    ...overrides,
  });
}

// ── 辅助：获取 localStorage 中的原始值 ──────────────
function getRaw(key: string): string | null {
  return localStorage.getItem(key);
}

// ── 辅助：获取备份索引 ─────────────────────────────
function getBackupIndex(): Array<{ id: string; timestamp: number; version: number; label?: string }> {
  const raw = getRaw(BACKUP_INDEX_KEY);
  return raw ? JSON.parse(raw) : [];
}

// ══════════════════════════════════════════════════════
// 测试主体
// ══════════════════════════════════════════════════════

describe('SaveBackupManager', () => {
  let manager: SaveBackupManager;

  beforeEach(() => {
    localStorage.clear();
    manager = new SaveBackupManager(3);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════════════
  // createBackup()
  // ═══════════════════════════════════════════════════
  describe('createBackup()', () => {
    it('无存档数据时返回 null', () => {
      expect(manager.createBackup()).toBeNull();
    });

    it('有存档数据时返回备份ID（时间戳字符串）', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T10:00:00Z'));
      localStorage.setItem(SAVE_KEY, makeSaveData());

      const id = manager.createBackup();
      expect(id).toBe(String(new Date('2025-01-15T10:00:00Z').getTime()));
    });

    it('备份ID为时间戳，备份内容与存档一致', () => {
      const saveData = makeSaveData();
      localStorage.setItem(SAVE_KEY, saveData);

      const id = manager.createBackup();
      expect(id).not.toBeNull();

      const backupContent = getRaw(BACKUP_KEY_PREFIX + id!);
      expect(backupContent).toBe(saveData);
    });

    it('带标签时，备份索引中包含 label', () => {
      localStorage.setItem(SAVE_KEY, makeSaveData());
      const id = manager.createBackup('升级前');

      const index = getBackupIndex();
      const entry = index.find(e => e.id === id);
      expect(entry).toBeDefined();
      expect(entry!.label).toBe('升级前');
    });

    it('不带标签时，备份索引中 label 为 undefined', () => {
      localStorage.setItem(SAVE_KEY, makeSaveData());
      const id = manager.createBackup();

      const index = getBackupIndex();
      const entry = index.find(e => e.id === id);
      expect(entry).toBeDefined();
      expect(entry!.label).toBeUndefined();
    });

    it('备份索引正确记录 version（从存档解析）', () => {
      localStorage.setItem(SAVE_KEY, makeSaveData({ version: 5 }));
      const id = manager.createBackup();

      const index = getBackupIndex();
      const entry = index.find(e => e.id === id);
      expect(entry!.version).toBe(5);
    });

    it('localStorage 写入失败时返回 null（模拟 localStorage 故障）', () => {
      localStorage.setItem(SAVE_KEY, makeSaveData());
      // Mock localStorage.setItem to throw on next call
      const originalSetItem = localStorage.setItem;
      let callCount = 0;
      localStorage.setItem = function(key: string, value: string) {
        callCount++;
        if (callCount > 1) throw new Error('QuotaExceeded'); // First call is for backup data
        return originalSetItem.call(this, key, value);
      };

      // createBackup calls setItem for backup data first, then addToIndex calls setItem again
      // Actually it calls setItem for BACKUP_KEY_PREFIX + id first
      expect(manager.createBackup()).toBeNull();
      localStorage.setItem = originalSetItem;
    });
  });

  // ═══════════════════════════════════════════════════
  // restoreBackup()
  // ═══════════════════════════════════════════════════
  describe('restoreBackup()', () => {
    it('备份ID不存在时返回 false', () => {
      expect(manager.restoreBackup('nonexistent')).toBe(false);
    });

    it('备份存在时恢复到 SAVE_KEY 并返回 true', () => {
      const backupData = makeSaveData({ version: 2 });
      const backupId = '12345';
      localStorage.setItem(BACKUP_KEY_PREFIX + backupId, backupData);

      expect(manager.restoreBackup(backupId)).toBe(true);
      expect(getRaw(SAVE_KEY)).toBe(backupData);
    });

    it('恢复成功后覆盖当前存档', () => {
      localStorage.setItem(SAVE_KEY, makeSaveData({ version: 1 }));
      const backupData = makeSaveData({ version: 3 });
      const backupId = '99999';
      localStorage.setItem(BACKUP_KEY_PREFIX + backupId, backupData);

      manager.restoreBackup(backupId);
      expect(JSON.parse(getRaw(SAVE_KEY)!).version).toBe(3);
    });

    it('localStorage.getItem 失败时返回 false', () => {
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = () => { throw new Error('unavailable'); };
      expect(manager.restoreBackup('some-id')).toBe(false);
      localStorage.getItem = originalGetItem;
    });

    it('localStorage.setItem 失败时返回 false', () => {
      const backupId = '12345';
      localStorage.setItem(BACKUP_KEY_PREFIX + backupId, makeSaveData());
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = () => { throw new Error('QuotaExceeded'); };

      expect(manager.restoreBackup(backupId)).toBe(false);
      localStorage.setItem = originalSetItem;
    });
  });

  // ═══════════════════════════════════════════════════
  // listBackups()
  // ═══════════════════════════════════════════════════
  describe('listBackups()', () => {
    it('无备份时返回空数组', () => {
      expect(manager.listBackups()).toEqual([]);
    });

    it('返回所有备份，按时间降序排列', () => {
      vi.useFakeTimers();

      localStorage.setItem(SAVE_KEY, makeSaveData());
      vi.setSystemTime(new Date('2025-01-10T10:00:00Z'));
      manager.createBackup();

      vi.setSystemTime(new Date('2025-01-12T10:00:00Z'));
      manager.createBackup();

      vi.setSystemTime(new Date('2025-01-11T10:00:00Z'));
      manager.createBackup();

      const backups = manager.listBackups();
      expect(backups).toHaveLength(3);

      // 验证降序排列
      for (let i = 1; i < backups.length; i++) {
        expect(backups[i].timestamp).toBeLessThanOrEqual(backups[i - 1].timestamp);
      }
    });

    it('索引数据损坏时返回空数组', () => {
      localStorage.setItem(BACKUP_INDEX_KEY, 'invalid-json');
      expect(manager.listBackups()).toEqual([]);
    });

    it('localStorage.getItem 失败时返回空数组', () => {
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = () => { throw new Error('fail'); };
      expect(manager.listBackups()).toEqual([]);
      localStorage.getItem = originalGetItem;
    });
  });

  // ═══════════════════════════════════════════════════
  // deleteBackup()
  // ═══════════════════════════════════════════════════
  describe('deleteBackup()', () => {
    it('删除存在的备份返回 true', () => {
      localStorage.setItem(SAVE_KEY, makeSaveData());
      const id = manager.createBackup();
      expect(id).not.toBeNull();

      expect(manager.deleteBackup(id!)).toBe(true);
      expect(manager.listBackups()).toHaveLength(0);
    });

    it('删除后备份数据从 localStorage 中移除', () => {
      localStorage.setItem(SAVE_KEY, makeSaveData());
      const id = manager.createBackup();

      expect(getRaw(BACKUP_KEY_PREFIX + id!)).toBeDefined();
      manager.deleteBackup(id!);
      expect(getRaw(BACKUP_KEY_PREFIX + id!)).toBeNull();
    });

    it('删除不存在的备份仍返回 true（幂等）', () => {
      expect(manager.deleteBackup('nonexistent')).toBe(true);
    });

    it('localStorage.removeItem 失败时返回 false', () => {
      const originalRemoveItem = localStorage.removeItem;
      localStorage.removeItem = () => { throw new Error('fail'); };
      expect(manager.deleteBackup('some-id')).toBe(false);
      localStorage.removeItem = originalRemoveItem;
    });
  });

  // ═══════════════════════════════════════════════════
  // restoreLatest()
  // ═══════════════════════════════════════════════════
  describe('restoreLatest()', () => {
    it('无备份时返回 false', () => {
      expect(manager.restoreLatest()).toBe(false);
    });

    it('恢复最新（时间戳最大）的备份', () => {
      vi.useFakeTimers();
      localStorage.setItem(SAVE_KEY, makeSaveData());

      vi.setSystemTime(new Date('2025-01-10T10:00:00Z'));
      const oldId = manager.createBackup();

      vi.setSystemTime(new Date('2025-01-15T10:00:00Z'));
      const newId = manager.createBackup();

      // 清空当前存档
      localStorage.removeItem(SAVE_KEY);

      expect(manager.restoreLatest()).toBe(true);
      // 验证恢复的是最新的备份
      expect(getRaw(SAVE_KEY)).toBe(getRaw(BACKUP_KEY_PREFIX + newId!));
    });

    it('只有一个备份时正常恢复', () => {
      localStorage.setItem(SAVE_KEY, makeSaveData());
      const id = manager.createBackup();
      localStorage.removeItem(SAVE_KEY);

      expect(manager.restoreLatest()).toBe(true);
      expect(getRaw(SAVE_KEY)).toBe(getRaw(BACKUP_KEY_PREFIX + id!));
    });
  });

  // ═══════════════════════════════════════════════════
  // autoBackup()
  // ═══════════════════════════════════════════════════
  describe('autoBackup()', () => {
    it('与 createBackup() 行为一致', () => {
      localStorage.setItem(SAVE_KEY, makeSaveData());
      const id = manager.autoBackup();
      expect(id).not.toBeNull();
      expect(getRaw(BACKUP_KEY_PREFIX + id!)).toBeDefined();
    });

    it('无存档时返回 null', () => {
      expect(manager.autoBackup()).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════
  // 自动淘汰超出上限的旧备份
  // ═══════════════════════════════════════════════════
  describe('自动淘汰超出上限的旧备份', () => {
    it('备份数量超过 maxBackups 时淘汰最旧的', () => {
      vi.useFakeTimers();
      const mgr = new SaveBackupManager(2);
      localStorage.setItem(SAVE_KEY, makeSaveData());

      vi.setSystemTime(new Date('2025-01-10T10:00:00Z'));
      const id1 = mgr.createBackup();

      vi.setSystemTime(new Date('2025-01-11T10:00:00Z'));
      const id2 = mgr.createBackup();

      vi.setSystemTime(new Date('2025-01-12T10:00:00Z'));
      const id3 = mgr.createBackup();

      // 应该只剩 2 个备份
      const backups = mgr.listBackups();
      expect(backups).toHaveLength(2);

      // 最旧的 id1 应该被淘汰
      expect(getRaw(BACKUP_KEY_PREFIX + id1!)).toBeNull();
      expect(getRaw(BACKUP_KEY_PREFIX + id2!)).toBeDefined();
      expect(getRaw(BACKUP_KEY_PREFIX + id3!)).toBeDefined();
    });

    it('maxBackups=1 时只保留最新一个', () => {
      vi.useFakeTimers();
      const mgr = new SaveBackupManager(1);
      localStorage.setItem(SAVE_KEY, makeSaveData());

      vi.setSystemTime(new Date('2025-01-10T10:00:00Z'));
      mgr.createBackup();

      vi.setSystemTime(new Date('2025-01-11T10:00:00Z'));
      const id2 = mgr.createBackup();

      expect(mgr.listBackups()).toHaveLength(1);
      expect(mgr.listBackups()[0].id).toBe(id2);
    });

    it('备份数量未达上限时不淘汰', () => {
      vi.useFakeTimers();
      const mgr = new SaveBackupManager(5);
      localStorage.setItem(SAVE_KEY, makeSaveData());

      vi.setSystemTime(new Date('2025-01-10T10:00:00Z'));
      const id1 = mgr.createBackup();
      vi.setSystemTime(new Date('2025-01-11T10:00:00Z'));
      const id2 = mgr.createBackup();

      expect(mgr.listBackups()).toHaveLength(2);
      expect(getRaw(BACKUP_KEY_PREFIX + id1!)).toBeDefined();
      expect(getRaw(BACKUP_KEY_PREFIX + id2!)).toBeDefined();
    });

    it('构造函数传入 maxBackups < 1 时至少为 1', () => {
      vi.useFakeTimers();
      const mgr = new SaveBackupManager(0);
      localStorage.setItem(SAVE_KEY, makeSaveData());

      vi.setSystemTime(new Date('2025-01-10T10:00:00Z'));
      mgr.createBackup();
      vi.setSystemTime(new Date('2025-01-11T10:00:00Z'));
      mgr.createBackup();

      expect(mgr.listBackups()).toHaveLength(1);
    });

    it('构造函数传入负数 maxBackups 时至少为 1', () => {
      const mgr = new SaveBackupManager(-5);
      localStorage.setItem(SAVE_KEY, makeSaveData());
      const id = mgr.createBackup();
      expect(id).not.toBeNull();
      expect(mgr.listBackups()).toHaveLength(1);
    });
  });

  // ═══════════════════════════════════════════════════
  // getBackupData()
  // ═══════════════════════════════════════════════════
  describe('getBackupData()', () => {
    it('返回备份数据的原始 JSON 字符串', () => {
      const saveData = makeSaveData();
      localStorage.setItem(SAVE_KEY, saveData);
      const id = manager.createBackup();
      const data = manager.getBackupData(id!);
      expect(data).toBe(saveData);
    });

    it('备份不存在时返回 null', () => {
      expect(manager.getBackupData('nonexistent')).toBeNull();
    });

    it('localStorage 不可用时返回 null', () => {
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = () => { throw new Error('fail'); };
      expect(manager.getBackupData('any')).toBeNull();
      localStorage.getItem = originalGetItem;
    });
  });

  // ═══════════════════════════════════════════════════
  // buildEntry — 版本解析（间接测试）
  // ═══════════════════════════════════════════════════
  describe('buildEntry 版本解析', () => {
    it('旧格式存档（直接 GameSaveData）正确解析版本', () => {
      localStorage.setItem(SAVE_KEY, makeSaveData({ version: 3 }));
      const id = manager.createBackup();

      const index = getBackupIndex();
      const entry = index.find(e => e.id === id);
      expect(entry).toBeDefined();
      expect(entry!.version).toBe(3);
    });

    it('新格式存档（{ v, checksum, data }）正确解析版本', () => {
      const innerData = makeSaveData({ version: 5 });
      const newFormat = JSON.stringify({
        v: '1.0',
        checksum: 'abc',
        data: innerData,
      });
      localStorage.setItem(SAVE_KEY, newFormat);
      const id = manager.createBackup();

      const index = getBackupIndex();
      const entry = index.find(e => e.id === id);
      expect(entry).toBeDefined();
      expect(entry!.version).toBe(5);
    });

    it('无法解析的 JSON 数据使用默认版本号 0', () => {
      localStorage.setItem(SAVE_KEY, 'not-valid-json');
      const id = manager.createBackup();

      const index = getBackupIndex();
      const entry = index.find(e => e.id === id);
      expect(entry).toBeDefined();
      expect(entry!.version).toBe(0);
    });
  });
});
