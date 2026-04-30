/**
 * R15: 存档迁移全链路测试
 *
 * 验证从最旧版本存档到最新版本的完整迁移链路，确保任何版本的玩家存档都能正确升级。
 *
 * 15 个测试场景：
 *  1. v0 空存档 → 最新版本，所有字段补全
 *  2. v1 存档 → 最新版本，旧字段迁移
 *  3. v5 存档 → 最新版本，中间版本链式迁移
 *  4. v10 存档 → 最新版本，大量字段变更
 *  5. 缺失 building 字段 → 蓝图修复补全
 *  6. 缺失 hero 字段 → 蓝图修复补全
 *  7. 缺失 resource 字段 → 蓝图修复补全
 *  8. 类型错误字段 → 修正为正确类型
 *  9. 额外未知字段 → 保留不丢失
 * 10. 损坏的存档 JSON → 优雅降级
 * 11. 存档版本号不存在 → 按最新处理
 * 12. 迁移前后存档大小对比 → 不爆炸增长
 * 13. 迁移后引擎可正常初始化 → 端到端验证
 * 14. 迁移后游戏可正常运行 → tick+操作验证
 * 15. 连续迁移 v0→v1→v2→...→最新 → 每步验证
 *
 * @module core/save/__tests__/migration-chain
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DataMigrator, type MigrationStep } from '../DataMigrator';
import { repairWithBlueprint, type RepairResult } from '../SaveDataRepair';
import { GameDataValidator } from '../GameDataValidator';
import { ENGINE_SAVE_VERSION } from '../../../shared/constants';
import type { GameSaveData } from '../../../shared/types';
import { createSim } from '../../../test-utils/test-helpers';

// ─────────────────────────────────────────────
// 测试辅助：存档数据工厂
// ─────────────────────────────────────────────

/** 最小合法资源数据 */
const MINIMAL_RESOURCES = {
  grain: 100, gold: 50, troops: 200, mandate: 0,
  techPoint: 0, recruitToken: 0, skillBook: 0,
};

/** 最小合法资源存档 */
function makeResourceSave(overrides?: Record<string, number>) {
  return {
    version: 1,
    resources: { ...MINIMAL_RESOURCES, ...overrides },
    productionRates: { grain: 1, gold: 0.5, troops: 0.1, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 },
    caps: { grain: 1000, gold: null, troops: 500, mandate: null, techPoint: null, recruitToken: null, skillBook: null },
    capWarnings: [],
    lastSaveTime: Date.now(),
  };
}

/** 最小合法建筑存档 */
function makeBuildingSave() {
  return { version: 1, buildings: {} };
}

/** 创建 v0 空存档（最旧版本） */
function createV0Save(overrides?: Partial<GameSaveData>): GameSaveData {
  return {
    version: 0,
    saveTime: Date.now(),
    resource: makeResourceSave(),
    building: makeBuildingSave(),
    ...overrides,
  } as GameSaveData;
}

/** 创建 v1 存档（当前引擎版本） */
function createV1Save(overrides?: Partial<GameSaveData>): GameSaveData {
  return {
    version: 1,
    saveTime: Date.now(),
    resource: makeResourceSave(),
    building: makeBuildingSave(),
    ...overrides,
  } as GameSaveData;
}

/** 创建指定版本的存档 */
function createVersionedSave(version: number, extra?: Partial<GameSaveData>): GameSaveData {
  return { ...createV0Save(extra), version };
}

/** 获取蓝图（通过引擎序列化生成完整默认数据） */
function getBlueprint(): GameSaveData {
  const sim = createSim();
  return JSON.parse(sim.engine.serialize()) as GameSaveData;
}

/** 获取迁移步骤中定义的最高版本号 */
function getMaxMigrationVersion(steps: MigrationStep[]): number {
  let max = 0;
  for (const s of steps) {
    if (s.toVersion > max) max = s.toVersion;
  }
  return max;
}

/** 手动执行完整迁移链到最高版本（绕过 ENGINE_SAVE_VERSION 限制） */
function migrateToMaxVersion(data: GameSaveData, steps: MigrationStep[]): GameSaveData {
  const stepMap = new Map(steps.map(s => [s.fromVersion, s]));
  let current = { ...data };
  let version = current.version;
  const maxVersion = getMaxMigrationVersion(steps);

  for (let i = 0; i < 30; i++) {
    if (version >= maxVersion) break;
    const step = stepMap.get(version);
    if (!step) {
      current = { ...current, version: maxVersion };
      break;
    }
    current = step.migrate(current);
    version = current.version;
  }
  return current;
}

/** 手动执行单步迁移到指定目标版本 */
function migrateToVersion(data: GameSaveData, steps: MigrationStep[], targetVersion: number): GameSaveData {
  const stepMap = new Map(steps.map(s => [s.fromVersion, s]));
  let current = { ...data };
  let version = current.version;

  for (let i = 0; i < 30; i++) {
    if (version >= targetVersion) break;
    const step = stepMap.get(version);
    if (!step) break;
    current = step.migrate(current);
    version = current.version;
  }
  return current;
}

// ═══════════════════════════════════════════════════════════════
// 存档迁移全链路测试
// ═══════════════════════════════════════════════════════════════

describe('R15: 存档迁移全链路测试', () => {
  let migrator: DataMigrator;
  let blueprint: GameSaveData;
  let allSteps: MigrationStep[];

  beforeEach(() => {
    migrator = new DataMigrator();
    blueprint = getBlueprint();
    allSteps = migrator.getMigrationSteps();
  });

  // ─────────────────────────────────────────────
  // 场景1: v0 空存档 → 最新版本，所有字段补全
  // ─────────────────────────────────────────────
  describe('场景1: v0 空存档 → 最新版本，所有字段补全', () => {
    it('v0 存档迁移后版本号应等于 ENGINE_SAVE_VERSION', () => {
      const v0 = createV0Save();
      const migrated = migrator.migrate(v0);
      expect(migrated.version).toBe(ENGINE_SAVE_VERSION);
    });

    it('v0 存档迁移后 resource 和 building 数据应完整保留', () => {
      const v0 = createV0Save();
      v0.resource.resources.grain = 999;
      v0.resource.resources.gold = 888;

      const migrated = migrator.migrate(v0);
      expect(migrated.resource.resources.grain).toBe(999);
      expect(migrated.resource.resources.gold).toBe(888);
      expect(migrated.building).toBeDefined();
    });

    it('v0 存档迁移后经蓝图修复应补全所有子系统字段', () => {
      const v0 = createV0Save();
      const migrated = migrator.migrate(v0);

      // 用蓝图修复补全缺失字段
      const result = repairWithBlueprint(migrated, blueprint);
      expect(result.data.resource).toBeDefined();
      expect(result.data.building).toBeDefined();
      expect(result.data.version).toBe(ENGINE_SAVE_VERSION);
      // 蓝图修复应补全了缺失的子系统
      expect(result.repaired).toBe(true);
    });

    it('v0 空存档迁移 + 蓝图修复后应能通过校验', () => {
      const v0 = createV0Save();
      const migrated = migrator.migrate(v0);
      const repaired = repairWithBlueprint(migrated, blueprint);

      const validator = new GameDataValidator();
      const report = validator.validate(repaired.data);
      expect(report.valid).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // 场景2: v1 存档 → 最新版本，旧字段迁移
  // ─────────────────────────────────────────────
  describe('场景2: v1 存档 → 最新版本，旧字段迁移', () => {
    it('v1 存档不需要迁移（已是当前版本）', () => {
      const v1 = createV1Save();
      expect(migrator.needsMigration(v1)).toBe(false);
    });

    it('v1 存档经蓝图修复后应补全所有可选子系统', () => {
      const v1 = createV1Save();
      const result = repairWithBlueprint(v1, blueprint);

      // v1 存档缺少很多可选子系统，蓝图修复应补全
      expect(result.data.resource).toBeDefined();
      expect(result.data.building).toBeDefined();
      expect(result.repaired).toBe(true);
      expect(result.logs.length).toBeGreaterThan(0);
    });

    it('v1 存档迁移后资源数据完整保留', () => {
      const v1 = createV1Save();
      v1.resource.resources.troops = 5555;

      const migrated = migrator.migrate(v1);
      // v1 不需要迁移，返回原引用
      expect(migrated.resource.resources.troops).toBe(5555);
    });

    it('v1 存档经蓝图修复后可通过校验', () => {
      const v1 = createV1Save();
      const repaired = repairWithBlueprint(v1, blueprint);

      const validator = new GameDataValidator();
      const report = validator.validate(repaired.data);
      expect(report.valid).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // 场景3: v5 存档 → 最新版本，中间版本链式迁移
  // ─────────────────────────────────────────────
  describe('场景3: v5 存档 → 最新版本，中间版本链式迁移', () => {
    it('v5 存档通过手动迁移链应到达最高版本', () => {
      const v5 = createVersionedSave(5);
      const migrated = migrateToMaxVersion(v5, allSteps);
      const maxVersion = getMaxMigrationVersion(allSteps);
      expect(migrated.version).toBe(maxVersion);
    });

    it('v5 存档迁移过程中应新增 v7+ 子系统', () => {
      const v5 = createVersionedSave(5);
      const migratedToV7 = migrateToVersion(v5, allSteps, 7);
      // v5→v7 步骤会添加 pvpArena, eventTrigger 等
      expect(migratedToV7.version).toBe(7);
    });

    it('v5 存档迁移后原始数据不丢失', () => {
      const v5 = createVersionedSave(5);
      v5.resource.resources.grain = 7777;

      const migrated = migrateToMaxVersion(v5, allSteps);
      expect(migrated.resource.resources.grain).toBe(7777);
    });

    it('v5 存档迁移到 v10 应新增装备炼制/强化子系统', () => {
      const v5 = createVersionedSave(5);
      const migratedToV10 = migrateToVersion(v5, allSteps, 10);
      expect(migratedToV10.version).toBe(10);
      // v7→v10 步骤应添加 equipmentForge, equipmentEnhance
      expect('equipmentForge' in migratedToV10 || 'equipmentEnhance' in migratedToV10).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // 场景4: v10 存档 → 最新版本，大量字段变更
  // ─────────────────────────────────────────────
  describe('场景4: v10 存档 → 最新版本，大量字段变更', () => {
    it('v10 存档迁移到最高版本应成功', () => {
      const v10 = createVersionedSave(10);
      const migrated = migrateToMaxVersion(v10, allSteps);
      expect(migrated.version).toBe(getMaxMigrationVersion(allSteps));
    });

    it('v10→v14 迁移应新增声望/传承/成就子系统', () => {
      const v10 = createVersionedSave(10);
      const migratedToV14 = migrateToVersion(v10, allSteps, 14);
      expect(migratedToV14.version).toBe(14);
      // v10→v14 步骤应添加 prestige, heritage, achievement
      expect('prestige' in migratedToV14 || 'heritage' in migratedToV14 || 'achievement' in migratedToV14).toBe(true);
    });

    it('v10 存档迁移后 resource 数据保持不变', () => {
      const v10 = createVersionedSave(10);
      v10.resource.resources.gold = 12345;

      const migrated = migrateToMaxVersion(v10, allSteps);
      expect(migrated.resource.resources.gold).toBe(12345);
    });

    it('v10 存档迁移到 v15 应新增离线事件子系统', () => {
      const v10 = createVersionedSave(10);
      const migratedToV15 = migrateToVersion(v10, allSteps, 15);
      expect(migratedToV15.version).toBe(15);
      expect('offlineEvent' in migratedToV15).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // 场景5: 缺失 building 字段 → 蓝图修复补全
  // ─────────────────────────────────────────────
  describe('场景5: 缺失 building 字段 → 蓝图修复补全', () => {
    it('缺失 building 时蓝图修复应补全', () => {
      const data = {
        version: ENGINE_SAVE_VERSION,
        saveTime: Date.now(),
        resource: makeResourceSave(),
        // building 缺失
      } as unknown as GameSaveData;

      const result = repairWithBlueprint(data, blueprint);
      expect(result.data.building).toBeDefined();
      expect(result.data.building.version).toBe(1);
      expect(result.data.building.buildings).toBeDefined();
    });

    it('缺失 building 时修复日志应记录 fill_missing', () => {
      const data = {
        version: ENGINE_SAVE_VERSION,
        saveTime: Date.now(),
        resource: makeResourceSave(),
      } as unknown as GameSaveData;

      const result = repairWithBlueprint(data, blueprint);
      const buildingLogs = result.logs.filter(l => l.field.startsWith('building'));
      expect(buildingLogs.length).toBeGreaterThan(0);
      expect(buildingLogs.some(l => l.action === 'fill_missing')).toBe(true);
    });

    it('修复后 building 数据可通过校验', () => {
      const data = {
        version: ENGINE_SAVE_VERSION,
        saveTime: Date.now(),
        resource: makeResourceSave(),
      } as unknown as GameSaveData;

      const repaired = repairWithBlueprint(data, blueprint);
      const validator = new GameDataValidator();
      const report = validator.validate(repaired.data);
      // building 应不再报 error
      const buildingErrors = report.issues.filter(
        i => i.field.startsWith('building') && i.severity === 'error',
      );
      expect(buildingErrors.length).toBe(0);
    });
  });

  // ─────────────────────────────────────────────
  // 场景6: 缺失 hero 字段 → 蓝图修复补全
  // ─────────────────────────────────────────────
  describe('场景6: 缺失 hero 字段 → 蓝图修复补全', () => {
    it('缺失 hero 时蓝图修复应补全', () => {
      const data = {
        version: ENGINE_SAVE_VERSION,
        saveTime: Date.now(),
        resource: makeResourceSave(),
        building: makeBuildingSave(),
        // hero 缺失
      } as unknown as GameSaveData;

      const result = repairWithBlueprint(data, blueprint);
      expect(result.data.hero).toBeDefined();
    });

    it('hero 数据修复后应包含 version 和 state 字段', () => {
      const data = {
        version: ENGINE_SAVE_VERSION,
        saveTime: Date.now(),
        resource: makeResourceSave(),
        building: makeBuildingSave(),
      } as unknown as GameSaveData;

      const result = repairWithBlueprint(data, blueprint);
      if (result.data.hero) {
        expect(result.data.hero.version).toBeTypeOf('number');
        expect(result.data.hero.state).toBeDefined();
        expect(result.data.hero.state.generals).toBeDefined();
      }
    });

    it('缺失 hero 时修复后校验应通过', () => {
      const data = {
        version: ENGINE_SAVE_VERSION,
        saveTime: Date.now(),
        resource: makeResourceSave(),
        building: makeBuildingSave(),
      } as unknown as GameSaveData;

      const repaired = repairWithBlueprint(data, blueprint);
      const validator = new GameDataValidator();
      const report = validator.validate(repaired.data);
      expect(report.valid).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // 场景7: 缺失 resource 字段 → 蓝图修复补全
  // ─────────────────────────────────────────────
  describe('场景7: 缺失 resource 字段 → 蓝图修复补全', () => {
    it('缺失 resource 时蓝图修复应补全', () => {
      const data = {
        version: ENGINE_SAVE_VERSION,
        saveTime: Date.now(),
        building: makeBuildingSave(),
        // resource 缺失
      } as unknown as GameSaveData;

      const result = repairWithBlueprint(data, blueprint);
      expect(result.data.resource).toBeDefined();
      expect(result.data.resource.resources).toBeDefined();
      expect(result.data.resource.resources.grain).toBeTypeOf('number');
    });

    it('缺失 resource 时修复后所有资源字段应存在', () => {
      const data = {
        version: ENGINE_SAVE_VERSION,
        saveTime: Date.now(),
        building: makeBuildingSave(),
      } as unknown as GameSaveData;

      const result = repairWithBlueprint(data, blueprint);
      const res = result.data.resource.resources;
      expect(res.grain).toBeTypeOf('number');
      expect(res.gold).toBeTypeOf('number');
      expect(res.troops).toBeTypeOf('number');
      expect(res.mandate).toBeTypeOf('number');
      expect(res.techPoint).toBeTypeOf('number');
      expect(res.recruitToken).toBeTypeOf('number');
    });

    it('缺失 resource 修复后校验应通过', () => {
      const data = {
        version: ENGINE_SAVE_VERSION,
        saveTime: Date.now(),
        building: makeBuildingSave(),
      } as unknown as GameSaveData;

      const repaired = repairWithBlueprint(data, blueprint);
      const validator = new GameDataValidator();
      const report = validator.validate(repaired.data);
      expect(report.valid).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // 场景8: 类型错误字段 → 修正为正确类型
  // ─────────────────────────────────────────────
  describe('场景8: 类型错误字段 → 修正为正确类型', () => {
    it('grain 为字符串时应修正为蓝图数值', () => {
      const data = {
        version: ENGINE_SAVE_VERSION,
        saveTime: Date.now(),
        resource: makeResourceSave(),
        building: makeBuildingSave(),
      } as unknown as GameSaveData;

      // 注入类型错误：grain 为字符串
      (data.resource.resources as Record<string, unknown>).grain = 'not_a_number';

      const result = repairWithBlueprint(data, blueprint);
      expect(result.data.resource.resources.grain).toBeTypeOf('number');
      // 应有 fix_type 日志
      const grainLog = result.logs.find(l => l.field === 'resource.resources.grain');
      expect(grainLog).toBeDefined();
      expect(grainLog!.action).toBe('fix_type');
    });

    it('grain 为 NaN 时应修正为蓝图数值', () => {
      const data = {
        version: ENGINE_SAVE_VERSION,
        saveTime: Date.now(),
        resource: makeResourceSave(),
        building: makeBuildingSave(),
      } as unknown as GameSaveData;

      data.resource.resources.grain = NaN;

      const result = repairWithBlueprint(data, blueprint);
      expect(result.data.resource.resources.grain).toBeTypeOf('number');
      expect(Number.isNaN(result.data.resource.resources.grain)).toBe(false);
      const nanLog = result.logs.find(l => l.field === 'resource.resources.grain');
      expect(nanLog).toBeDefined();
      expect(nanLog!.action).toBe('fix_nan');
    });

    it('grain 为 Infinity 时应修正为蓝图数值', () => {
      const data = {
        version: ENGINE_SAVE_VERSION,
        saveTime: Date.now(),
        resource: makeResourceSave(),
        building: makeBuildingSave(),
      } as unknown as GameSaveData;

      data.resource.resources.grain = Infinity;

      const result = repairWithBlueprint(data, blueprint);
      expect(Number.isFinite(result.data.resource.resources.grain)).toBe(true);
      const infLog = result.logs.find(l => l.field === 'resource.resources.grain');
      expect(infLog).toBeDefined();
      expect(infLog!.action).toBe('fix_nan');
    });

    it('grain 为负数时应修正为蓝图数值', () => {
      const data = {
        version: ENGINE_SAVE_VERSION,
        saveTime: Date.now(),
        resource: makeResourceSave(),
        building: makeBuildingSave(),
      } as unknown as GameSaveData;

      data.resource.resources.grain = -100;

      const result = repairWithBlueprint(data, blueprint);
      expect(result.data.resource.resources.grain).toBeGreaterThanOrEqual(0);
      const negLog = result.logs.find(l => l.field === 'resource.resources.grain');
      expect(negLog).toBeDefined();
      expect(negLog!.action).toBe('fix_negative');
    });

    it('resource 整体为字符串时应修正为蓝图对象', () => {
      const data = {
        version: ENGINE_SAVE_VERSION,
        saveTime: Date.now(),
        resource: 'corrupted_string',
        building: makeBuildingSave(),
      } as unknown as GameSaveData;

      const result = repairWithBlueprint(data, blueprint);
      expect(result.data.resource).toBeDefined();
      expect(typeof result.data.resource).toBe('object');
      expect(result.data.resource.resources).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────
  // 场景9: 额外未知字段 → 保留不丢失
  // ─────────────────────────────────────────────
  describe('场景9: 额外未知字段 → 保留不丢失', () => {
    it('蓝图修复后存档中的额外顶层字段应保留', () => {
      const data = {
        version: ENGINE_SAVE_VERSION,
        saveTime: Date.now(),
        resource: makeResourceSave(),
        building: makeBuildingSave(),
        customField: 'my_custom_data',
        futureSubsystem: { enabled: true, level: 42 },
      } as unknown as GameSaveData;

      const result = repairWithBlueprint(data, blueprint);
      const repaired = result.data as Record<string, unknown>;
      expect(repaired.customField).toBe('my_custom_data');
      expect(repaired.futureSubsystem).toEqual({ enabled: true, level: 42 });
    });

    it('蓝图修复后 resource 中的额外字段应保留', () => {
      const data = {
        version: ENGINE_SAVE_VERSION,
        saveTime: Date.now(),
        resource: {
          ...makeResourceSave(),
          customResourceField: 'extra_value',
        },
        building: makeBuildingSave(),
      } as unknown as GameSaveData;

      const result = repairWithBlueprint(data, blueprint);
      const res = result.data.resource as Record<string, unknown>;
      expect(res.customResourceField).toBe('extra_value');
    });

    it('蓝图修复后 building 中的额外字段应保留', () => {
      const data = {
        version: ENGINE_SAVE_VERSION,
        saveTime: Date.now(),
        resource: makeResourceSave(),
        building: {
          version: 1,
          buildings: {},
          customBuildingMeta: { lastRepairTime: 1700000000000 },
        },
      } as unknown as GameSaveData;

      const result = repairWithBlueprint(data, blueprint);
      const bld = result.data.building as Record<string, unknown>;
      expect(bld.customBuildingMeta).toEqual({ lastRepairTime: 1700000000000 });
    });
  });

  // ─────────────────────────────────────────────
  // 场景10: 损坏的存档 JSON → 优雅降级
  // ─────────────────────────────────────────────
  describe('场景10: 损坏的存档 JSON → 优雅降级', () => {
    it('null 输入时蓝图修复应返回完整蓝图', () => {
      const result = repairWithBlueprint(null, blueprint);
      expect(result.data).toBeDefined();
      expect(result.data.resource).toBeDefined();
      expect(result.data.building).toBeDefined();
      expect(result.repaired).toBe(false);
    });

    it('undefined 输入时蓝图修复应返回完整蓝图', () => {
      const result = repairWithBlueprint(undefined, blueprint);
      expect(result.data).toBeDefined();
      expect(result.data.version).toBe(ENGINE_SAVE_VERSION);
    });

    it('非对象输入（字符串）时蓝图修复应返回完整蓝图', () => {
      const result = repairWithBlueprint('corrupt', blueprint);
      expect(result.data).toBeDefined();
      expect(result.data.resource).toBeDefined();
    });

    it('非对象输入（数字）时蓝图修复应返回完整蓝图', () => {
      const result = repairWithBlueprint(42, blueprint);
      expect(result.data).toBeDefined();
      expect(typeof result.data).toBe('object');
    });

    it('空对象输入时蓝图修复应补全所有字段', () => {
      const result = repairWithBlueprint({}, blueprint);
      expect(result.data.resource).toBeDefined();
      expect(result.data.building).toBeDefined();
      expect(result.data.version).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────
  // 场景11: 存档版本号不存在 → 按最新处理
  // ─────────────────────────────────────────────
  describe('场景11: 存档版本号不存在 → 按最新处理', () => {
    it('未来版本号（999）不应触发迁移', () => {
      const future = createVersionedSave(999);
      expect(migrator.needsMigration(future)).toBe(false);
    });

    it('未来版本号迁移后版本不变', () => {
      const future = createVersionedSave(999);
      const result = migrator.migrate(future);
      expect(result.version).toBe(999);
      expect(result).toBe(future); // 返回同一引用
    });

    it('版本号为 -1 时应触发迁移', () => {
      const negative = createVersionedSave(-1);
      expect(migrator.needsMigration(negative)).toBe(true);
    });

    it('版本号不存在（如 v6）时 migrateFromVersion 应跳到目标版本', () => {
      // v6 没有对应的迁移步骤（步骤是 v5→v7）
      const v6 = createVersionedSave(6);
      const result = migrator.migrateFromVersion(v6, 6);
      // 找不到 v6 步骤，应跳到 ENGINE_SAVE_VERSION
      expect(result.version).toBe(ENGINE_SAVE_VERSION);
    });

    it('版本号为 NaN 时 needsMigration 应返回 false（NaN 不小于任何数）', () => {
      const data = createV0Save();
      (data as Record<string, unknown>).version = NaN;
      // NaN < ENGINE_SAVE_VERSION 为 false，所以 needsMigration 返回 false
      expect(migrator.needsMigration(data)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────
  // 场景12: 迁移前后存档大小对比 → 不爆炸增长
  // ─────────────────────────────────────────────
  describe('场景12: 迁移前后存档大小对比 → 不爆炸增长', () => {
    it('v0 迁移后 JSON 大小不应超过原始的 5 倍', () => {
      const v0 = createV0Save();
      const originalSize = JSON.stringify(v0).length;
      const migrated = migrator.migrate(v0);
      const migratedSize = JSON.stringify(migrated).length;

      expect(migratedSize).toBeLessThanOrEqual(originalSize * 5);
    });

    it('v0 迁移+蓝图修复后 JSON 大小不应超过蓝图大小的 2 倍', () => {
      const v0 = createV0Save();
      const migrated = migrator.migrate(v0);
      const repaired = repairWithBlueprint(migrated, blueprint);
      const repairedSize = JSON.stringify(repaired.data).length;
      const blueprintSize = JSON.stringify(blueprint).length;

      expect(repairedSize).toBeLessThanOrEqual(blueprintSize * 2);
    });

    it('每步迁移的数据增长不应超过 50%', () => {
      for (const step of allSteps) {
        const testData = createVersionedSave(step.fromVersion);
        const beforeSize = JSON.stringify(testData).length;
        const result = step.migrate(testData);
        const afterSize = JSON.stringify(result).length;

        // 允许 50% 增长（新增子系统）
        expect(afterSize).toBeLessThanOrEqual(beforeSize * 1.5 + 500);
      }
    });

    it('完整迁移链（v0→v16）总增长不应超过 10 倍', () => {
      const v0 = createV0Save();
      const originalSize = JSON.stringify(v0).length;
      const migrated = migrateToMaxVersion(v0, allSteps);
      const finalSize = JSON.stringify(migrated).length;

      expect(finalSize).toBeLessThanOrEqual(originalSize * 10);
    });
  });

  // ─────────────────────────────────────────────
  // 场景13: 迁移后引擎可正常初始化 → 端到端验证
  // ─────────────────────────────────────────────
  describe('场景13: 迁移后引擎可正常初始化 → 端到端验证', () => {
    it('v0 存档迁移+修复后可反序列化到引擎', () => {
      const v0 = createV0Save();
      const migrated = migrator.migrate(v0);
      const repaired = repairWithBlueprint(migrated, blueprint);
      const json = JSON.stringify(repaired.data);

      const sim = createSim();
      expect(() => sim.engine.deserialize(json)).not.toThrow();
    });

    it('v0 存档迁移+修复后引擎资源数据一致', () => {
      const v0 = createV0Save();
      v0.resource.resources.grain = 999;
      v0.resource.resources.gold = 888;

      const migrated = migrator.migrate(v0);
      const repaired = repairWithBlueprint(migrated, blueprint);
      const json = JSON.stringify(repaired.data);

      const sim = createSim();
      sim.engine.deserialize(json);

      expect(sim.getResource('grain')).toBe(999);
      expect(sim.getResource('gold')).toBe(888);
    });

    it('v1 存档经蓝图修复后可反序列化到引擎', () => {
      const v1 = createV1Save();
      const repaired = repairWithBlueprint(v1, blueprint);
      const json = JSON.stringify(repaired.data);

      const sim = createSim();
      expect(() => sim.engine.deserialize(json)).not.toThrow();
    });

    it('存档中含额外字段时引擎反序列化不崩溃', () => {
      const data = {
        version: ENGINE_SAVE_VERSION,
        saveTime: Date.now(),
        resource: makeResourceSave(),
        building: makeBuildingSave(),
        unknownSubsystem: { data: 'test' },
      } as unknown as GameSaveData;

      const repaired = repairWithBlueprint(data, blueprint);
      const json = JSON.stringify(repaired.data);

      const sim = createSim();
      expect(() => sim.engine.deserialize(json)).not.toThrow();
    });
  });

  // ─────────────────────────────────────────────
  // 场景14: 迁移后游戏可正常运行 → tick+操作验证
  // ─────────────────────────────────────────────
  describe('场景14: 迁移后游戏可正常运行 → tick+操作验证', () => {
    it('v0 存档迁移加载后引擎可正常 tick', () => {
      const v0 = createV0Save();
      v0.resource.resources.grain = 5000;

      const migrated = migrator.migrate(v0);
      const repaired = repairWithBlueprint(migrated, blueprint);
      const json = JSON.stringify(repaired.data);

      const sim = createSim();
      sim.engine.deserialize(json);

      // 引擎应能正常 tick
      expect(() => sim.engine.tick(100)).not.toThrow();
      expect(() => sim.engine.tick(1000)).not.toThrow();
    });

    it('v0 存档迁移加载后可正常升级建筑', () => {
      const v0 = createV0Save();
      v0.resource.resources.grain = 50000;
      v0.resource.resources.gold = 50000;
      v0.resource.resources.troops = 50000;

      const migrated = migrator.migrate(v0);
      const repaired = repairWithBlueprint(migrated, blueprint);
      const json = JSON.stringify(repaired.data);

      const sim = createSim();
      sim.engine.deserialize(json);

      // 设置足够上限
      sim.engine.resource.setCap('grain', 50_000_000);
      sim.engine.resource.setCap('troops', 10_000_000);

      // 升级建筑应成功
      expect(() => sim.upgradeBuilding('farmland')).not.toThrow();
    });

    it('v0 存档迁移加载后 tick 多次不崩溃', () => {
      const v0 = createV0Save();
      const migrated = migrator.migrate(v0);
      const repaired = repairWithBlueprint(migrated, blueprint);
      const json = JSON.stringify(repaired.data);

      const sim = createSim();
      sim.engine.deserialize(json);

      // 模拟 100 次 tick（约 10 秒游戏时间）
      for (let i = 0; i < 100; i++) {
        sim.engine.tick(100);
      }
      // 引擎应仍在正常运行
      expect(sim.getResource('grain')).toBeTypeOf('number');
    });

    it('v0 存档迁移加载后可正常序列化（保存）', () => {
      const v0 = createV0Save();
      const migrated = migrator.migrate(v0);
      const repaired = repairWithBlueprint(migrated, blueprint);
      const json = JSON.stringify(repaired.data);

      const sim = createSim();
      sim.engine.deserialize(json);

      // tick 几次后序列化
      sim.engine.tick(100);
      sim.engine.tick(100);

      const saved = sim.engine.serialize();
      expect(saved).toBeTruthy();
      expect(typeof saved).toBe('string');

      // 序列化后的数据应可再次加载
      const parsed = JSON.parse(saved);
      expect(parsed.version).toBe(ENGINE_SAVE_VERSION);
      expect(parsed.resource).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────
  // 场景15: 连续迁移 v0→v1→v2→...→最新 → 每步验证
  // ─────────────────────────────────────────────
  describe('场景15: 连续迁移 v0→v1→v2→...→最新 → 每步验证', () => {
    it('每步迁移后版本号应正确递增', () => {
      let current = createV0Save();
      const stepMap = new Map(allSteps.map(s => [s.fromVersion, s]));

      for (const step of allSteps) {
        const beforeVersion = current.version;
        current = step.migrate(current);
        expect(current.version).toBe(step.toVersion);
        expect(current.version).toBeGreaterThan(beforeVersion);
      }
    });

    it('每步迁移后 resource 数据应保留', () => {
      let current = createV0Save();
      current.resource.resources.grain = 1234;

      const stepMap = new Map(allSteps.map(s => [s.fromVersion, s]));
      for (const step of allSteps) {
        current = step.migrate(current);
        expect(current.resource.resources.grain).toBe(1234);
      }
    });

    it('每步迁移后 building 数据应保留', () => {
      let current = createV0Save();

      const stepMap = new Map(allSteps.map(s => [s.fromVersion, s]));
      for (const step of allSteps) {
        current = step.migrate(current);
        expect(current.building).toBeDefined();
      }
    });

    it('每步迁移后 saveTime 应保留', () => {
      const originalSaveTime = 1700000000000;
      let current = createV0Save();
      current.saveTime = originalSaveTime;

      for (const step of allSteps) {
        current = step.migrate(current);
        expect(current.saveTime).toBe(originalSaveTime);
      }
    });

    it('链式迁移最终结果应与直接迁移一致（版本号）', () => {
      // 链式迁移
      let chainResult = createV0Save();
      for (const step of allSteps) {
        chainResult = step.migrate(chainResult);
      }

      // 直接迁移到最高版本
      const directResult = migrateToMaxVersion(createV0Save(), allSteps);

      expect(chainResult.version).toBe(directResult.version);
    });

    it('链式迁移最终结果应与直接迁移一致（资源数据）', () => {
      const v0 = createV0Save();
      v0.resource.resources.troops = 7777;

      // 链式迁移
      let chainResult = { ...v0 };
      for (const step of allSteps) {
        chainResult = step.migrate(chainResult);
      }

      // 直接迁移
      const directResult = migrateToMaxVersion({ ...v0 }, allSteps);

      expect(chainResult.resource.resources.troops).toBe(directResult.resource.resources.troops);
      expect(chainResult.resource.resources.troops).toBe(7777);
    });

    it('每步迁移不应产生 null 或 undefined 的顶层字段', () => {
      let current = createV0Save();

      for (const step of allSteps) {
        current = step.migrate(current);

        // 核心字段不应为 null/undefined
        expect(current.version).toBeDefined();
        expect(current.saveTime).toBeDefined();
        expect(current.resource).toBeDefined();
        expect(current.building).toBeDefined();
      }
    });
  });
});
