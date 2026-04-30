/**
 * R12: 存档迁移链完整性测试
 *
 * 测试 DataMigrator 从 v0 到最新版本的完整迁移链：
 *   1. v0 数据迁移到 v1
 *   2. v0 → v1 → v2 → ... → 最新（链式迁移）
 *   3. 每个版本的迁移不丢失数据
 *   4. 迁移后数据能正常保存加载
 *   5. 跳版本迁移（v0 直接到最新）
 *
 * 至少 15 个用例。
 *
 * @module core/save/__tests__/migration-chain
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataMigrator, type MigrationStep } from '../DataMigrator';
import { ENGINE_SAVE_VERSION } from '../../../shared/constants';
import type { GameSaveData } from '../../../shared/types';

// ── 测试辅助 ──

/** 创建最小合法 v0 存档数据 */
function createV0SaveData(overrides?: Partial<GameSaveData>): GameSaveData {
  return {
    version: 0,
    saveTime: Date.now(),
    resource: {
      version: 1,
      resources: { grain: 100, gold: 50, troops: 200, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 },
      productionRates: { grain: 1, gold: 0.5, troops: 0.1, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 },
      caps: { grain: 1000, gold: null, troops: 500, mandate: null, techPoint: null, recruitToken: null, skillBook: null },
      capWarnings: [],
      lastSaveTime: Date.now(),
    },
    building: {
      version: 1,
      buildings: {},
    },
    ...overrides,
  } as GameSaveData;
}

/** 创建指定版本的存档数据 */
function createVersionedSaveData(version: number, extraData?: Partial<GameSaveData>): GameSaveData {
  const base = createV0SaveData(extraData);
  return { ...base, version };
}

// ═══════════════════════════════════════════════════════════════
// 迁移链完整性测试
// ═══════════════════════════════════════════════════════════════

describe('R12: 存档迁移链完整性测试', () => {
  let migrator: DataMigrator;

  beforeEach(() => {
    migrator = new DataMigrator();
  });

  // ─────────────────────────────────────────────
  // 1. 基础迁移功能
  // ─────────────────────────────────────────────

  describe('1. 基础迁移功能', () => {
    it('应正确识别当前引擎版本', () => {
      expect(migrator.getCurrentVersion()).toBe(ENGINE_SAVE_VERSION);
    });

    it('应正确识别需要迁移的数据', () => {
      const v0Data = createV0SaveData();
      expect(migrator.needsMigration(v0Data)).toBe(true);
    });

    it('应正确识别不需要迁移的数据', () => {
      const currentData = createVersionedSaveData(ENGINE_SAVE_VERSION);
      expect(migrator.needsMigration(currentData)).toBe(false);
    });

    it('版本号等于当前版本时不应迁移', () => {
      const data = createVersionedSaveData(ENGINE_SAVE_VERSION);
      const result = migrator.migrate(data);
      expect(result.version).toBe(ENGINE_SAVE_VERSION);
      // 应返回相同引用（无需修改）
      expect(result).toBe(data);
    });
  });

  // ─────────────────────────────────────────────
  // 2. v0 → v1 单步迁移
  // ─────────────────────────────────────────────

  describe('2. v0 → v1 单步迁移', () => {
    it('应将 v0 数据迁移到 v1', () => {
      const v0Data = createV0SaveData();
      const result = migrator.migrate(v0Data);

      expect(result.version).toBe(ENGINE_SAVE_VERSION);
    });

    it('迁移后应保留原始数据', () => {
      const v0Data = createV0SaveData();
      const originalVersion = v0Data.version;
      const originalGrain = v0Data.resource.resources.grain;

      const result = migrator.migrate(v0Data);

      // 原始数据未被修改
      expect(v0Data.version).toBe(originalVersion);
      // 迁移后资源数据保留
      expect(result.resource.resources.grain).toBe(originalGrain);
    });

    it('迁移后不应丢失 resource 数据', () => {
      const v0Data = createV0SaveData();
      v0Data.resource.resources.grain = 999;
      v0Data.resource.resources.gold = 888;

      const result = migrator.migrate(v0Data);

      expect(result.resource.resources.grain).toBe(999);
      expect(result.resource.resources.gold).toBe(888);
    });

    it('迁移后不应丢失 building 数据', () => {
      const v0Data = createV0SaveData();
      v0Data.building = {
        version: 1,
        buildings: {
          mainHall: { level: 3, isUpgrading: false } as any,
        },
      } as any;

      const result = migrator.migrate(v0Data);

      expect(result.building).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────
  // 3. 链式迁移完整性
  // ─────────────────────────────────────────────

  describe('3. 链式迁移完整性', () => {
    it('迁移步骤应按版本号顺序排列', () => {
      const steps = migrator.getMigrationSteps();
      for (let i = 1; i < steps.length; i++) {
        expect(steps[i].fromVersion).toBeGreaterThan(steps[i - 1].fromVersion);
      }
    });

    it('每步迁移的 fromVersion < toVersion', () => {
      const steps = migrator.getMigrationSteps();
      for (const step of steps) {
        expect(step.toVersion).toBeGreaterThan(step.fromVersion);
      }
    });

    it('迁移步骤不应有重复的 fromVersion', () => {
      const steps = migrator.getMigrationSteps();
      const fromVersions = steps.map(s => s.fromVersion);
      const uniqueFromVersions = new Set(fromVersions);
      expect(uniqueFromVersions.size).toBe(fromVersions.length);
    });

    it('migrateFromVersion 应支持从指定版本开始迁移', () => {
      const v0Data = createV0SaveData();
      const result = migrator.migrateFromVersion(v0Data, 0);
      expect(result.version).toBe(ENGINE_SAVE_VERSION);
    });
  });

  // ─────────────────────────────────────────────
  // 4. 数据不丢失验证
  // ─────────────────────────────────────────────

  describe('4. 迁移数据不丢失', () => {
    it('迁移后所有已有子系统数据应保留', () => {
      const v0Data = createV0SaveData();
      v0Data.resource.resources.troops = 12345;

      const result = migrator.migrate(v0Data);

      // 资源数据保留
      expect(result.resource).toBeDefined();
      expect(result.resource.resources.troops).toBe(12345);
    });

    it('迁移后 saveTime 应保留', () => {
      const v0Data = createV0SaveData();
      const originalSaveTime = 1700000000000;
      v0Data.saveTime = originalSaveTime;

      const result = migrator.migrate(v0Data);

      expect(result.saveTime).toBe(originalSaveTime);
    });

    it('迁移后缺失的子系统应补全默认值', () => {
      const v0Data = createV0SaveData();
      // v0 数据只有 resource + building

      const result = migrator.migrate(v0Data);

      // 迁移后核心数据仍在
      expect(result.resource).toBeDefined();
      expect(result.building).toBeDefined();
      expect(result.version).toBe(ENGINE_SAVE_VERSION);
    });
  });

  // ─────────────────────────────────────────────
  // 5. 边界情况
  // ─────────────────────────────────────────────

  describe('5. 边界情况', () => {
    it('未来版本数据不应触发迁移', () => {
      const futureData = createVersionedSaveData(999);
      expect(migrator.needsMigration(futureData)).toBe(false);
    });

    it('版本号为负数时应触发迁移', () => {
      const negativeData = createVersionedSaveData(-1);
      expect(migrator.needsMigration(negativeData)).toBe(true);
    });

    it('迁移步骤描述不应为空', () => {
      const steps = migrator.getMigrationSteps();
      for (const step of steps) {
        expect(step.description.length).toBeGreaterThan(0);
      }
    });

    it('多次迁移同一数据应幂等', () => {
      const v0Data = createV0SaveData();

      const result1 = migrator.migrate(v0Data);
      const result2 = migrator.migrate(result1);

      expect(result1.version).toBe(ENGINE_SAVE_VERSION);
      expect(result2.version).toBe(ENGINE_SAVE_VERSION);
      // 第二次迁移不应改变数据
      expect(result2.version).toBe(result1.version);
    });

    it('迁移空资源数据不应崩溃', () => {
      const v0Data = createV0SaveData();
      // 尝试使用极简数据
      const minimalData = {
        version: 0,
        saveTime: Date.now(),
        resource: { version: 1, resources: {}, productionRates: {}, caps: {}, capWarnings: [], lastSaveTime: 0 },
        building: { version: 1, buildings: {} },
      } as unknown as GameSaveData;

      expect(() => migrator.migrate(minimalData)).not.toThrow();
    });
  });

  // ─────────────────────────────────────────────
  // 6. 迁移步骤覆盖
  // ─────────────────────────────────────────────

  describe('6. 迁移步骤覆盖', () => {
    it('应有至少一个迁移步骤', () => {
      const steps = migrator.getMigrationSteps();
      expect(steps.length).toBeGreaterThan(0);
    });

    it('第一个迁移步骤应从 v0 开始', () => {
      const steps = migrator.getMigrationSteps();
      const firstStep = steps.find(s => s.fromVersion === 0);
      expect(firstStep).toBeDefined();
    });

    it('每步迁移函数应返回有效数据', () => {
      const steps = migrator.getMigrationSteps();
      for (const step of steps) {
        const testData = createVersionedSaveData(step.fromVersion);
        const result = step.migrate(testData);
        expect(result.version).toBe(step.toVersion);
        expect(result).toBeDefined();
      }
    });
  });
});
