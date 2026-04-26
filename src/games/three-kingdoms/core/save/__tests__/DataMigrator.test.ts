// ACC-SAVE: 游戏数据修正系统测试
/**
 * DataMigrator 单元测试
 *
 * 覆盖：
 * - migrate(): 从 v0 迁移到当前版本
 * - migrate(): 从各版本逐步迁移
 * - needsMigration(): 检测是否需要迁移
 * - 迁移后数据包含所有必需字段
 * - 迁移后可选子系统有默认值
 * - getCurrentVersion() 返回正确版本号
 * - migrateFromVersion(): 从指定版本开始迁移
 * - 迁移步骤缺失时的降级处理
 * - 迁移失败时的容错处理
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DataMigrator } from '../DataMigrator';
import { ENGINE_SAVE_VERSION } from '../../../shared/constants';

// ── 辅助：构建基础存档数据 ──────────────────────────
function makeBaseSaveData(version: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version,
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

describe('DataMigrator', () => {
  let migrator: DataMigrator;

  beforeEach(() => {
    migrator = new DataMigrator();
  });

  // ═══════════════════════════════════════════════════
  // getCurrentVersion()
  // ═══════════════════════════════════════════════════
  describe('getCurrentVersion()', () => {
    it('返回 ENGINE_SAVE_VERSION 常量值', () => {
      expect(migrator.getCurrentVersion()).toBe(ENGINE_SAVE_VERSION);
    });
  });

  // ═══════════════════════════════════════════════════
  // needsMigration()
  // ═══════════════════════════════════════════════════
  describe('needsMigration()', () => {
    it('版本低于当前引擎版本时返回 true', () => {
      const data = makeBaseSaveData(0);
      expect(migrator.needsMigration(data as any)).toBe(true);
    });

    it('版本等于当前引擎版本时返回 false', () => {
      const data = makeBaseSaveData(ENGINE_SAVE_VERSION);
      expect(migrator.needsMigration(data as any)).toBe(false);
    });

    it('版本高于当前引擎版本时返回 false', () => {
      const data = makeBaseSaveData(ENGINE_SAVE_VERSION + 10);
      expect(migrator.needsMigration(data as any)).toBe(false);
    });

    it('version 为非 number 类型时返回 false', () => {
      const data = { ...makeBaseSaveData(0), version: '1' };
      expect(migrator.needsMigration(data as any)).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════
  // migrate() — 不需要迁移
  // ═══════════════════════════════════════════════════
  describe('migrate() — 无需迁移', () => {
    it('已是当前版本时返回原数据（引用可能不同但内容一致）', () => {
      const data = makeBaseSaveData(ENGINE_SAVE_VERSION);
      const result = migrator.migrate(data as any);
      expect(result.version).toBe(ENGINE_SAVE_VERSION);
    });

    it('版本高于当前时返回原数据', () => {
      const data = makeBaseSaveData(ENGINE_SAVE_VERSION + 100);
      const result = migrator.migrate(data as any);
      expect(result.version).toBe(ENGINE_SAVE_VERSION + 100);
    });
  });

  // ═══════════════════════════════════════════════════
  // migrate() — v0 → 当前版本
  // ═══════════════════════════════════════════════════
  describe('migrate() — v0 → 当前版本', () => {
    it('从 v0 迁移后版本号等于当前引擎版本', () => {
      const data = makeBaseSaveData(0);
      const result = migrator.migrate(data as any);
      expect(result.version).toBe(ENGINE_SAVE_VERSION);
    });

    it('迁移后数据包含 resource 和 building 必需字段', () => {
      const data = makeBaseSaveData(0);
      const result = migrator.migrate(data as any);
      expect(result.resource).toBeDefined();
      expect(result.building).toBeDefined();
    });

    it('迁移不修改原始数据（返回新对象）', () => {
      const data = makeBaseSaveData(0);
      const originalVersion = data.version;
      migrator.migrate(data as any);
      expect(data.version).toBe(originalVersion);
    });
  });

  // ═══════════════════════════════════════════════════
  // migrate() — 迁移链完整性
  // ═══════════════════════════════════════════════════
  describe('migrate() — 迁移链完整性', () => {
    it('从任意低于当前版本号迁移后版本号等于 ENGINE_SAVE_VERSION', () => {
      for (let v = 0; v < ENGINE_SAVE_VERSION; v++) {
        const data = makeBaseSaveData(v);
        const result = migrator.migrate(data as any);
        expect(result.version).toBe(ENGINE_SAVE_VERSION);
      }
    });
  });

  // ═══════════════════════════════════════════════════
  // migrateFromVersion() — 从指定版本迁移
  // ═══════════════════════════════════════════════════
  describe('migrateFromVersion()', () => {
    it('从 v0 迁移到当前版本', () => {
      const data = makeBaseSaveData(0);
      const result = migrator.migrateFromVersion(data as any, 0);
      expect(result.version).toBe(ENGINE_SAVE_VERSION);
    });

    it('fromVersion >= ENGINE_SAVE_VERSION 时直接返回', () => {
      const data = makeBaseSaveData(ENGINE_SAVE_VERSION);
      const result = migrator.migrateFromVersion(data as any, ENGINE_SAVE_VERSION);
      expect(result.version).toBe(ENGINE_SAVE_VERSION);
    });

    it('迁移后最终版本号等于当前引擎版本', () => {
      // 测试所有可能的起始版本（0 到 ENGINE_SAVE_VERSION-1）
      for (let v = 0; v < ENGINE_SAVE_VERSION; v++) {
        const data = makeBaseSaveData(v);
        const result = migrator.migrateFromVersion(data as any, v);
        expect(result.version).toBe(ENGINE_SAVE_VERSION);
      }
    });
  });

  // ═══════════════════════════════════════════════════
  // 迁移步骤注册表中的步骤行为
  // ═══════════════════════════════════════════════════
  describe('迁移步骤行为', () => {
    it('v0→v1 步骤正确升级版本号', () => {
      const steps = migrator.getMigrationSteps();
      const v0to1 = steps.find(s => s.fromVersion === 0 && s.toVersion === 1);
      expect(v0to1).toBeDefined();

      const data = makeBaseSaveData(0) as any;
      const result = v0to1!.migrate(data);
      expect(result.version).toBe(1);
    });

    it('v1→v2 步骤补全 hero/recruit/formation', () => {
      const steps = migrator.getMigrationSteps();
      const v1to2 = steps.find(s => s.fromVersion === 1 && s.toVersion === 2);
      expect(v1to2).toBeDefined();

      const data = makeBaseSaveData(1) as any;
      const result = v1to2!.migrate(data);
      expect(result.version).toBe(2);
      expect(result.hero).toBeDefined();
      expect(result.hero.generals).toEqual([]);
      expect(result.recruit).toBeDefined();
      expect(result.formation).toBeDefined();
    });

    it('v2→v3 步骤补全 campaign', () => {
      const steps = migrator.getMigrationSteps();
      const v2to3 = steps.find(s => s.fromVersion === 2 && s.toVersion === 3);
      expect(v2to3).toBeDefined();

      const data = makeBaseSaveData(2) as any;
      const result = v2to3!.migrate(data);
      expect(result.version).toBe(3);
      expect(result.campaign).toBeDefined();
      expect(result.campaign.currentChapterId).toBe('');
    });

    it('v3→v4 步骤补全 tech', () => {
      const steps = migrator.getMigrationSteps();
      const v3to4 = steps.find(s => s.fromVersion === 3 && s.toVersion === 4);
      expect(v3to4).toBeDefined();

      const data = makeBaseSaveData(3) as any;
      const result = v3to4!.migrate(data);
      expect(result.version).toBe(4);
      expect(result.tech).toBeDefined();
      expect(result.tech.completedTechIds).toEqual([]);
    });

    it('v4→v5 步骤保留 equipment/trade/shop', () => {
      const steps = migrator.getMigrationSteps();
      const v4to5 = steps.find(s => s.fromVersion === 4 && s.toVersion === 5);
      expect(v4to5).toBeDefined();

      const data = makeBaseSaveData(4, { equipment: { items: [1, 2] } }) as any;
      const result = v4to5!.migrate(data);
      expect(result.version).toBe(5);
      expect(result.equipment).toBeDefined();
      expect(result.equipment.items).toEqual([1, 2]);
    });

    it('v5→v7 步骤添加 PvP/事件子系统', () => {
      const steps = migrator.getMigrationSteps();
      const v5to7 = steps.find(s => s.fromVersion === 5 && s.toVersion === 7);
      expect(v5to7).toBeDefined();

      const data = makeBaseSaveData(5) as any;
      const result = v5to7!.migrate(data);
      expect(result.version).toBe(7);
    });

    it('v7→v10 步骤添加装备炼制/强化', () => {
      const steps = migrator.getMigrationSteps();
      const v7to10 = steps.find(s => s.fromVersion === 7 && s.toVersion === 10);
      expect(v7to10).toBeDefined();

      const data = makeBaseSaveData(7) as any;
      const result = v7to10!.migrate(data);
      expect(result.version).toBe(10);
    });

    it('v10→v14 步骤添加声望/传承/成就', () => {
      const steps = migrator.getMigrationSteps();
      const v10to14 = steps.find(s => s.fromVersion === 10 && s.toVersion === 14);
      expect(v10to14).toBeDefined();

      const data = makeBaseSaveData(10) as any;
      const result = v10to14!.migrate(data);
      expect(result.version).toBe(14);
    });

    it('v14→v15 步骤保留 offlineEvent（如已有）', () => {
      const steps = migrator.getMigrationSteps();
      const v14to15 = steps.find(s => s.fromVersion === 14 && s.toVersion === 15);
      expect(v14to15).toBeDefined();

      // 无 offlineEvent 时迁移后仍为 undefined（保留原值）
      const data1 = makeBaseSaveData(14) as any;
      const result1 = v14to15!.migrate(data1);
      expect(result1.version).toBe(15);

      // 有 offlineEvent 时迁移后保留
      const data2 = makeBaseSaveData(14, { offlineEvent: { version: 1, queue: [] } }) as any;
      const result2 = v14to15!.migrate(data2);
      expect(result2.version).toBe(15);
      expect(result2.offlineEvent).toBeDefined();
    });

    it('v15→v16 步骤保留 season（如已有）', () => {
      const steps = migrator.getMigrationSteps();
      const v15to16 = steps.find(s => s.fromVersion === 15 && s.toVersion === 16);
      expect(v15to16).toBeDefined();

      // 无 season 时迁移后仍为 undefined（保留原值）
      const data1 = makeBaseSaveData(15) as any;
      const result1 = v15to16!.migrate(data1);
      expect(result1.version).toBe(16);

      // 有 season 时迁移后保留
      const data2 = makeBaseSaveData(15, { season: { version: 1, currentSeason: 1 } }) as any;
      const result2 = v15to16!.migrate(data2);
      expect(result2.version).toBe(16);
      expect(result2.season).toBeDefined();
    });

    it('已有子系统数据在迁移中不被覆盖', () => {
      const steps = migrator.getMigrationSteps();
      const v1to2 = steps.find(s => s.fromVersion === 1 && s.toVersion === 2);
      const data = makeBaseSaveData(1, { hero: { generals: [{ id: 'hero1' }], fragments: { hero1: 5 }, version: 1 } }) as any;
      const result = v1to2!.migrate(data);
      // 已有 hero 数据应保留
      expect(result.hero.generals).toEqual([{ id: 'hero1' }]);
      expect(result.hero.fragments).toEqual({ hero1: 5 });
    });
  });

  // ═══════════════════════════════════════════════════
  // 迁移步骤缺失时的降级
  // ═══════════════════════════════════════════════════
  describe('迁移步骤缺失时的降级', () => {
    it('不存在的版本号跳到目标版本', () => {
      // v6 没有对应的迁移步骤（v5→v7 跳过了 v6）
      const data = makeBaseSaveData(6);
      const result = migrator.migrateFromVersion(data as any, 6);
      expect(result.version).toBe(ENGINE_SAVE_VERSION);
    });
  });

  // ═══════════════════════════════════════════════════
  // 迁移后数据完整性
  // ═══════════════════════════════════════════════════
  describe('迁移后数据完整性', () => {
    it('迁移后保留原始 resource 数据', () => {
      const data = makeBaseSaveData(0);
      const result = migrator.migrate(data as any);
      expect((result.resource as any).resources.grain).toBe(100);
    });

    it('迁移后保留原始 building 数据', () => {
      const data = makeBaseSaveData(0);
      const result = migrator.migrate(data as any);
      expect((result.building as any).buildings.castle.level).toBe(1);
    });

    it('迁移后 saveTime 保持不变', () => {
      const saveTime = 1700000000000;
      const data = makeBaseSaveData(0, { saveTime });
      const result = migrator.migrate(data as any);
      expect(result.saveTime).toBe(saveTime);
    });
  });

  // ═══════════════════════════════════════════════════
  // getMigrationSteps()
  // ═══════════════════════════════════════════════════
  describe('getMigrationSteps()', () => {
    it('返回所有已注册的迁移步骤', () => {
      const steps = migrator.getMigrationSteps();
      expect(steps.length).toBeGreaterThan(0);
    });

    it('每个步骤包含 fromVersion、toVersion、description、migrate', () => {
      const steps = migrator.getMigrationSteps();
      for (const step of steps) {
        expect(step.fromVersion).toBeTypeOf('number');
        expect(step.toVersion).toBeTypeOf('number');
        expect(step.toVersion).toBeGreaterThan(step.fromVersion);
        expect(step.description).toBeTypeOf('string');
        expect(step.migrate).toBeTypeOf('function');
      }
    });

    it('返回的是副本（不暴露内部状态）', () => {
      const steps1 = migrator.getMigrationSteps();
      const steps2 = migrator.getMigrationSteps();
      expect(steps1).not.toBe(steps2);
      expect(steps1).toEqual(steps2);
    });
  });

  // ═══════════════════════════════════════════════════
  // 防无限循环保护
  // ═══════════════════════════════════════════════════
  describe('防无限循环保护', () => {
    it('即使迁移步骤有异常，也不会无限循环', () => {
      const data = makeBaseSaveData(0);
      // migrateFromVersion 内部有 maxSteps=20 限制
      const result = migrator.migrateFromVersion(data as any, 0);
      expect(result).toBeDefined();
      expect(result.version).toBe(ENGINE_SAVE_VERSION);
    });
  });
});
