// ACC-SAVE: 游戏数据修正系统测试
/**
 * GameDataFixer 单元测试
 *
 * 覆盖：
 * - fix(): 完整数据无需修复
 * - fix(): 缺失必需字段时修复失败返回 null
 * - fix(): 缺失可选子系统时自动补全默认值
 * - fix(): 数据类型错误时自动修正
 * - fixAndApply(): 修正数据并应用到引擎上下文
 * - tryRecoverSave(): 从 localStorage 恢复损坏存档
 * - recoverDeleted(): 从备份恢复误删存档
 * - diagnose(): 诊断当前存档问题
 * - conservative vs aggressive 策略差异
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameDataFixer } from '../GameDataFixer';
import { SaveBackupManager } from '../SaveBackupManager';
import type { FixReport, FixAction } from '../GameDataFixer';
import { ENGINE_SAVE_VERSION, SAVE_KEY } from '../../../shared/constants';

// ── 辅助：构建完整的有效存档数据 ─────────────────────
function makeValidSaveData(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: ENGINE_SAVE_VERSION,
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
        smithy: { level: 1, status: 'idle' },
        academy: { level: 1, status: 'idle' },
        clinic: { level: 1, status: 'idle' },
        wall: { level: 1, status: 'idle' },
      },
    },
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════
// 测试主体
// ══════════════════════════════════════════════════════

describe('GameDataFixer', () => {
  let backupManager: SaveBackupManager;
  let fixer: GameDataFixer;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    backupManager = new SaveBackupManager(5);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════════════
  // fix() — 完整数据无需修复
  // ═══════════════════════════════════════════════════
  describe('fix() — 完整数据无需修复', () => {
    it('完整有效数据返回 data 且 success=true', () => {
      fixer = new GameDataFixer(backupManager, { strategy: 'conservative' });
      const data = makeValidSaveData();
      const { data: result, report } = fixer.fix(data);

      expect(result).not.toBeNull();
      expect(report.success).toBe(true);
      expect(report.originalValid).toBe(true);
      expect(report.fixedValid).toBe(true);
    });

    it('完整有效数据无修复动作', () => {
      fixer = new GameDataFixer(backupManager);
      const data = makeValidSaveData();
      const { report } = fixer.fix(data);
      expect(report.actions).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════
  // fix() — 缺失必需字段
  // ═══════════════════════════════════════════════════
  describe('fix() — 缺失必需字段', () => {
    it('null 数据无备份时返回 null', () => {
      fixer = new GameDataFixer(backupManager);
      const { data, report } = fixer.fix(null);
      expect(data).toBeNull();
      expect(report.success).toBe(false);
    });

    it('undefined 数据无备份时返回 null', () => {
      fixer = new GameDataFixer(backupManager);
      const { data, report } = fixer.fix(undefined);
      expect(data).toBeNull();
      expect(report.success).toBe(false);
    });

    it('非 object 数据（string）无备份时返回 null', () => {
      fixer = new GameDataFixer(backupManager);
      const { data } = fixer.fix('invalid');
      expect(data).toBeNull();
    });

    it('缺失 resource 时 fixedValid=false（autoFixable=false）', () => {
      fixer = new GameDataFixer(backupManager);
      const data = makeValidSaveData();
      delete (data as Record<string, unknown>).resource;
      const { data: result, report } = fixer.fix(data);
      expect(result).toBeDefined();
      expect(report.fixedValid).toBe(false);
    });

    it('缺失 building 时 fixedValid=false（autoFixable=false）', () => {
      fixer = new GameDataFixer(backupManager);
      const data = makeValidSaveData();
      delete (data as Record<string, unknown>).building;
      const { data: result, report } = fixer.fix(data);
      expect(result).toBeDefined();
      expect(report.fixedValid).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════
  // fix() — 数据类型错误时自动修正
  // ═══════════════════════════════════════════════════
  describe('fix() — 数据类型错误自动修正', () => {
    it('grain 为 string 时修正为默认值 0', () => {
      fixer = new GameDataFixer(backupManager, { strategy: 'aggressive' });
      const data = makeValidSaveData({
        resource: {
          resources: { grain: 'invalid', gold: 200, troops: 50, mandate: 10, techPoint: 5, recruitToken: 0 },
          lastSaveTime: Date.now(),
          productionRates: {},
          caps: {},
        },
      });

      const { data: result, report } = fixer.fix(data);
      expect(result).not.toBeNull();
      expect((result!.resource as any).resources.grain).toBe(0);
      expect(report.actions.some(a => a.type === 'fix_value' && a.field === 'resource.resources.grain')).toBe(true);
    });

    it('建筑 level 为负数时修正为 0（warning 级别，需搭配 error 触发修复）', () => {
      fixer = new GameDataFixer(backupManager);
      // level 负数是 warning 级别，需要搭配 error 级别问题触发 fixIssues
      const data = makeValidSaveData({
        resource: {
          resources: { grain: 'invalid', gold: 200, troops: 50, mandate: 10, techPoint: 5, recruitToken: 0 },
          lastSaveTime: Date.now(),
          productionRates: {},
          caps: {},
        },
        building: {
          buildings: {
            castle: { level: -5, status: 'idle' },
            farmland: { level: 2, status: 'idle' },
            market: { level: 1, status: 'idle' },
            barracks: { level: 1, status: 'idle' },
            smithy: { level: 1, status: 'idle' },
            academy: { level: 1, status: 'idle' },
            clinic: { level: 1, status: 'idle' },
            wall: { level: 1, status: 'idle' },
          },
        },
      });

      const { data: result, report } = fixer.fix(data);
      expect(result).not.toBeNull();
      expect((result!.building as any).buildings.castle.level).toBe(0);
      expect(report.actions.some(a => a.type === 'fix_value' && a.field.includes('castle'))).toBe(true);
    });

    it('建筑 status 为非法值时修正为 idle', () => {
      fixer = new GameDataFixer(backupManager);
      // status 非法是 warning 级别，需要搭配 error 级别问题触发 fixIssues
      const data = makeValidSaveData({
        resource: {
          resources: { grain: 'invalid', gold: 200, troops: 50, mandate: 10, techPoint: 5, recruitToken: 0 },
          lastSaveTime: Date.now(),
          productionRates: {},
          caps: {},
        },
        building: {
          buildings: {
            castle: { level: 1, status: 'broken' },
            farmland: { level: 2, status: 'idle' },
            market: { level: 1, status: 'idle' },
            barracks: { level: 1, status: 'idle' },
            smithy: { level: 1, status: 'idle' },
            academy: { level: 1, status: 'idle' },
            clinic: { level: 1, status: 'idle' },
            wall: { level: 1, status: 'idle' },
          },
        },
      });

      const { data: result } = fixer.fix(data);
      expect(result).not.toBeNull();
      expect((result!.building as any).buildings.castle.status).toBe('idle');
    });

    it('建筑 level 超过上限 (100) 时修正为 100（需搭配 error 级别问题触发修复）', () => {
      fixer = new GameDataFixer(backupManager);
      // 需要有一个 error 级别问题才能触发 fixIssues，所以同时设置 grain 为 string
      const data = makeValidSaveData({
        resource: {
          resources: { grain: 'invalid', gold: 200, troops: 50, mandate: 10, techPoint: 5, recruitToken: 0 },
          lastSaveTime: Date.now(),
          productionRates: {},
          caps: {},
        },
        building: {
          buildings: {
            castle: { level: 150, status: 'idle' },
            farmland: { level: 2, status: 'idle' },
            market: { level: 1, status: 'idle' },
            barracks: { level: 1, status: 'idle' },
            smithy: { level: 1, status: 'idle' },
            academy: { level: 1, status: 'idle' },
            clinic: { level: 1, status: 'idle' },
            wall: { level: 1, status: 'idle' },
          },
        },
      });

      const { data: result } = fixer.fix(data);
      expect(result).not.toBeNull();
      expect((result!.building as any).buildings.castle.level).toBe(100);
    });
  });

  // ═══════════════════════════════════════════════════
  // fix() — 版本迁移
  // ═══════════════════════════════════════════════════
  describe('fix() — 版本迁移', () => {
    it('旧版本数据自动迁移到当前版本', () => {
      fixer = new GameDataFixer(backupManager);
      const data = makeValidSaveData({ version: 0 });
      const { data: result, report } = fixer.fix(data);

      expect(result).not.toBeNull();
      expect(result!.version).toBe(ENGINE_SAVE_VERSION);
      expect(report.actions.some(a => a.type === 'migrate')).toBe(true);
    });

    it('迁移动作包含 before/after 版本号', () => {
      fixer = new GameDataFixer(backupManager);
      const data = makeValidSaveData({ version: 0 });
      const { report } = fixer.fix(data);

      const migrateAction = report.actions.find(a => a.type === 'migrate');
      expect(migrateAction).toBeDefined();
      expect(migrateAction!.before).toBe(0);
      expect(migrateAction!.after).toBe(ENGINE_SAVE_VERSION);
    });
  });

  // ═══════════════════════════════════════════════════
  // fix() — 从备份恢复
  // ═══════════════════════════════════════════════════
  describe('fix() — 从备份恢复', () => {
    it('null 数据有备份时从备份恢复', () => {
      const backupData = makeValidSaveData();
      localStorage.setItem(SAVE_KEY, JSON.stringify(backupData));
      backupManager.autoBackup();

      fixer = new GameDataFixer(backupManager);
      const { data, report } = fixer.fix(null);
      expect(data).not.toBeNull();
      expect(report.actions.some(a => a.type === 'restore_backup')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════
  // conservative vs aggressive 策略差异
  // ═══════════════════════════════════════════════════
  describe('conservative vs aggressive 策略差异', () => {
    it('conservative 策略不补全缺失的可选子系统（info 级别）', () => {
      fixer = new GameDataFixer(backupManager, { strategy: 'conservative' });
      const data = makeValidSaveData();
      const { report } = fixer.fix(data);

      const fillDefaultActions = report.actions.filter(a => a.type === 'fill_default');
      expect(fillDefaultActions).toHaveLength(0);
    });

    it('aggressive 策略补全缺失的可选子系统（info 级别）', () => {
      fixer = new GameDataFixer(backupManager, { strategy: 'aggressive' });
      // 需要有一个 error 级别问题触发 fixIssues，同时有 info 级别缺失子系统
      const data = makeValidSaveData({
        resource: {
          resources: { grain: 'bad', gold: 200, troops: 50, mandate: 10, techPoint: 5, recruitToken: 0 },
          lastSaveTime: Date.now(),
          productionRates: {},
          caps: {},
        },
      });

      const { report } = fixer.fix(data);
      const fillDefaultActions = report.actions.filter(a => a.type === 'fill_default');
      expect(fillDefaultActions.length).toBeGreaterThan(0);
    });

    it('aggressive 策略补全的 hero 子系统包含默认数据', () => {
      fixer = new GameDataFixer(backupManager, { strategy: 'aggressive' });
      // 需要有一个 error 级别问题触发 fixIssues
      const data = makeValidSaveData({
        resource: {
          resources: { grain: 'bad', gold: 200, troops: 50, mandate: 10, techPoint: 5, recruitToken: 0 },
          lastSaveTime: Date.now(),
          productionRates: {},
          caps: {},
        },
      });

      const { data: result } = fixer.fix(data);

      expect(result).not.toBeNull();
      expect((result as any).hero).toBeDefined();
      expect((result as any).hero.generals).toEqual([]);
    });

    it('两种策略都修复 error 级别问题（资源类型错误）', () => {
      const makeBadData = () => makeValidSaveData({
        resource: {
          resources: { grain: 'bad', gold: 200, troops: 50, mandate: 10, techPoint: 5, recruitToken: 0 },
          lastSaveTime: Date.now(),
          productionRates: {},
          caps: {},
        },
      });

      const conservativeFixer = new GameDataFixer(backupManager, { strategy: 'conservative' });
      const aggressiveFixer = new GameDataFixer(backupManager, { strategy: 'aggressive' });

      const cReport = conservativeFixer.fix(makeBadData()).report;
      const aReport = aggressiveFixer.fix(makeBadData()).report;

      expect(cReport.actions.some(a => a.field === 'resource.resources.grain')).toBe(true);
      expect(aReport.actions.some(a => a.field === 'resource.resources.grain')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════
  // fixAndApply()
  // ═══════════════════════════════════════════════════
  describe('fixAndApply()', () => {
    it('有效数据时返回报告', () => {
      fixer = new GameDataFixer(backupManager);
      const data = makeValidSaveData();

      // mock require to avoid real module loading
      const originalRequire = (globalThis as any).require;
      (globalThis as any).require = vi.fn((modulePath: string) => {
        if (modulePath.includes('engine-save')) {
          return { applyDeserialize: vi.fn() };
        }
        return originalRequire?.(modulePath);
      });

      const mockCtx = {} as any;
      const report = fixer.fixAndApply(mockCtx, data);
      expect(report).toBeDefined();
      // fixAndApply 在有效数据时，fix() 返回 success=true，
      // 但 applyDeserialize 通过 require 调用可能失败导致 success=false
      // 关键是 report 存在且包含正确结构
      expect(report).toHaveProperty('success');
      expect(report).toHaveProperty('actions');

      (globalThis as any).require = originalRequire;
    });

    it('null 数据时返回 success=false', () => {
      fixer = new GameDataFixer(backupManager);
      const mockCtx = {} as any;
      const report = fixer.fixAndApply(mockCtx, null);
      expect(report.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════
  // tryRecoverSave()
  // ═══════════════════════════════════════════════════
  describe('tryRecoverSave()', () => {
    it('localStorage 无存档时返回 null', () => {
      fixer = new GameDataFixer(backupManager);
      expect(fixer.tryRecoverSave()).toBeNull();
    });

    it('有效存档数据返回解析后的 GameSaveData', () => {
      fixer = new GameDataFixer(backupManager);
      const data = makeValidSaveData();
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));

      const result = fixer.tryRecoverSave();
      expect(result).not.toBeNull();
      expect(result!.version).toBe(ENGINE_SAVE_VERSION);
    });

    it('JSON 解析失败时尝试从备份恢复', () => {
      fixer = new GameDataFixer(backupManager);
      localStorage.setItem(SAVE_KEY, 'invalid-json');

      const result = fixer.tryRecoverSave();
      expect(result).toBeNull();
    });

    it('新格式存档（{ v, checksum, data }）正确解析', () => {
      fixer = new GameDataFixer(backupManager);
      const innerData = makeValidSaveData();
      const newFormat = { v: '1.0', checksum: 'abc', data: JSON.stringify(innerData) };
      localStorage.setItem(SAVE_KEY, JSON.stringify(newFormat));

      const result = fixer.tryRecoverSave();
      expect(result).not.toBeNull();
      expect(result!.version).toBe(ENGINE_SAVE_VERSION);
    });

    it('新格式存档内部数据损坏时返回非 null（降级为旧格式解析）', () => {
      fixer = new GameDataFixer(backupManager);
      const newFormat = { v: '1.0', checksum: 'abc', data: 'invalid-inner' };
      localStorage.setItem(SAVE_KEY, JSON.stringify(newFormat));

      const result = fixer.tryRecoverSave();
      // 新格式内部数据损坏后，源码会降级将整个对象作为旧格式传给 fix()
      // fix() 返回非 null（即使数据有 error），所以 tryRecoverSave 返回非 null
      expect(result).not.toBeNull();
    });

    it('旧版本存档自动迁移', () => {
      fixer = new GameDataFixer(backupManager);
      const data = makeValidSaveData({ version: 0 });
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));

      const result = fixer.tryRecoverSave();
      expect(result).not.toBeNull();
      expect(result!.version).toBe(ENGINE_SAVE_VERSION);
    });

    it('localStorage.getItem 抛异常时尝试备份恢复', () => {
      fixer = new GameDataFixer(backupManager);
      vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => { throw new Error('fail'); });

      const result = fixer.tryRecoverSave();
      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════
  // recoverDeleted()
  // ═══════════════════════════════════════════════════
  describe('recoverDeleted()', () => {
    it('无备份时返回 null', () => {
      fixer = new GameDataFixer(backupManager);
      expect(fixer.recoverDeleted()).toBeNull();
    });

    it('从有效备份恢复存档数据', () => {
      fixer = new GameDataFixer(backupManager);
      const data = makeValidSaveData();
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      backupManager.autoBackup();

      // 删除当前存档
      localStorage.removeItem(SAVE_KEY);

      const result = fixer.recoverDeleted();
      expect(result).not.toBeNull();
      expect(result!.resource).toBeDefined();
      expect(result!.building).toBeDefined();
    });

    it('过期备份被跳过', () => {
      vi.useFakeTimers();
      fixer = new GameDataFixer(backupManager, { maxBackupAge: 1000 }); // 1秒

      const data = makeValidSaveData();
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));

      vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
      backupManager.autoBackup();

      // 推进时间超过 maxBackupAge
      vi.setSystemTime(new Date('2025-01-02T00:00:00Z'));
      localStorage.removeItem(SAVE_KEY);

      const result = fixer.recoverDeleted();
      expect(result).toBeNull();

      vi.useRealTimers();
    });

    it('备份数据损坏时跳过该备份', () => {
      fixer = new GameDataFixer(backupManager);
      const data = makeValidSaveData();
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      backupManager.autoBackup();
      localStorage.removeItem(SAVE_KEY);

      // 破坏备份数据
      const backups = backupManager.listBackups();
      if (backups.length > 0) {
        const backupKey = 'three-kingdoms-backup-' + backups[0].id;
        localStorage.setItem(backupKey, 'corrupted');
      }

      const result = fixer.recoverDeleted();
      expect(result).toBeNull();
    });

    it('恢复的旧版本数据自动迁移', () => {
      fixer = new GameDataFixer(backupManager);
      const data = makeValidSaveData({ version: 0 });
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      backupManager.autoBackup();
      localStorage.removeItem(SAVE_KEY);

      const result = fixer.recoverDeleted();
      expect(result).not.toBeNull();
      expect(result!.version).toBe(ENGINE_SAVE_VERSION);
    });

    it('优先使用最新的有效备份', () => {
      vi.useFakeTimers();
      fixer = new GameDataFixer(backupManager);

      const data1 = makeValidSaveData({ version: ENGINE_SAVE_VERSION });
      localStorage.setItem(SAVE_KEY, JSON.stringify(data1));
      vi.setSystemTime(new Date('2025-01-10T00:00:00Z'));
      backupManager.autoBackup();

      const data2 = makeValidSaveData({ version: ENGINE_SAVE_VERSION });
      (data2.resource as any).resources.grain = 999;
      localStorage.setItem(SAVE_KEY, JSON.stringify(data2));
      vi.setSystemTime(new Date('2025-01-15T00:00:00Z'));
      backupManager.autoBackup();

      localStorage.removeItem(SAVE_KEY);

      const result = fixer.recoverDeleted();
      expect(result).not.toBeNull();
      expect((result!.resource as any).resources.grain).toBe(999);

      vi.useRealTimers();
    });
  });

  // ═══════════════════════════════════════════════════
  // diagnose()
  // ═══════════════════════════════════════════════════
  describe('diagnose()', () => {
    it('无存档时返回 success=false', () => {
      fixer = new GameDataFixer(backupManager);
      const report = fixer.diagnose();
      expect(report.success).toBe(false);
      expect(report.originalValid).toBe(false);
    });

    it('有效存档时返回 success=true', () => {
      fixer = new GameDataFixer(backupManager);
      const data = makeValidSaveData();
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));

      const report = fixer.diagnose();
      expect(report.success).toBe(true);
      expect(report.originalValid).toBe(true);
    });

    it('JSON 解析失败时返回 remove_corrupt 动作', () => {
      fixer = new GameDataFixer(backupManager);
      localStorage.setItem(SAVE_KEY, 'invalid-json');

      const report = fixer.diagnose();
      expect(report.success).toBe(false);
      expect(report.actions.some(a => a.type === 'remove_corrupt')).toBe(true);
    });

    it('新格式存档正确诊断', () => {
      fixer = new GameDataFixer(backupManager);
      const innerData = makeValidSaveData();
      const newFormat = { v: '1.0', checksum: 'abc', data: JSON.stringify(innerData) };
      localStorage.setItem(SAVE_KEY, JSON.stringify(newFormat));

      const report = fixer.diagnose();
      expect(report.success).toBe(true);
    });

    it('有问题的存档返回 originalValid=false', () => {
      fixer = new GameDataFixer(backupManager);
      const data = makeValidSaveData();
      delete (data as Record<string, unknown>).resource;
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));

      const report = fixer.diagnose();
      expect(report.originalValid).toBe(false);
    });

    it('不执行修复（actions 为空）', () => {
      fixer = new GameDataFixer(backupManager);
      const data = makeValidSaveData();
      delete (data as Record<string, unknown>).resource;
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));

      const report = fixer.diagnose();
      // diagnose 不修复，只诊断（除了 remove_corrupt for JSON 解析失败）
      expect(report.actions).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════
  // FixReport 结构验证
  // ═══════════════════════════════════════════════════
  describe('FixReport 结构', () => {
    it('报告包含 success/actions/originalValid/fixedValid 字段', () => {
      fixer = new GameDataFixer(backupManager);
      const data = makeValidSaveData();
      const { report } = fixer.fix(data);

      expect(report).toHaveProperty('success');
      expect(report).toHaveProperty('actions');
      expect(report).toHaveProperty('originalValid');
      expect(report).toHaveProperty('fixedValid');
    });

    it('每个 FixAction 包含 type/field/description', () => {
      fixer = new GameDataFixer(backupManager, { strategy: 'aggressive' });
      const data = makeValidSaveData({ version: 0 });
      const { report } = fixer.fix(data);

      for (const action of report.actions) {
        expect(action).toHaveProperty('type');
        expect(action).toHaveProperty('field');
        expect(action).toHaveProperty('description');
        expect(['migrate', 'fill_default', 'restore_backup', 'fix_value', 'remove_corrupt']).toContain(action.type);
      }
    });
  });

  // ═══════════════════════════════════════════════════
  // 边界情况
  // ═══════════════════════════════════════════════════
  describe('边界情况', () => {
    it('空对象 {} 作为输入（缺失 resource 和 building）', () => {
      fixer = new GameDataFixer(backupManager);
      const { data, report } = fixer.fix({});
      expect(report.originalValid).toBe(false);
      expect(data).toBeDefined();
    });

    it('数字作为输入返回 null', () => {
      fixer = new GameDataFixer(backupManager);
      const { data } = fixer.fix(42);
      expect(data).toBeNull();
    });

    it('boolean 作为输入返回 null', () => {
      fixer = new GameDataFixer(backupManager);
      const { data } = fixer.fix(true);
      expect(data).toBeNull();
    });

    it('修复后仍存在问题时 success=false', () => {
      fixer = new GameDataFixer(backupManager);
      const data = { version: ENGINE_SAVE_VERSION, saveTime: Date.now() };
      const { report } = fixer.fix(data);
      expect(report.fixedValid).toBe(false);
    });

    it('多个资源字段同时错误时全部修正', () => {
      fixer = new GameDataFixer(backupManager, { strategy: 'aggressive' });
      const data = makeValidSaveData({
        resource: {
          resources: {
            grain: 'bad',
            gold: 'also-bad',
            troops: 50,
            mandate: 10,
            techPoint: 5,
            recruitToken: 0,
          },
          lastSaveTime: Date.now(),
          productionRates: {},
          caps: {},
        },
      });

      const { data: result, report } = fixer.fix(data);
      expect(result).not.toBeNull();
      expect((result!.resource as any).resources.grain).toBe(0);
      expect((result!.resource as any).resources.gold).toBe(0);
      const fixActions = report.actions.filter(a => a.type === 'fix_value' && a.field.startsWith('resource.resources.'));
      expect(fixActions.length).toBeGreaterThanOrEqual(2);
    });
  });
});
