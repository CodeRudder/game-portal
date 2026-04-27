// ACC-SAVE: 存档蓝图修复系统测试
/**
 * SaveDataRepair 单元测试
 *
 * 覆盖：基础功能、缺失字段补全、类型错误修复、NaN/Infinity 修复、
 * 负数修复、特殊字段保留、数组合并、综合场景
 */

import { describe, it, expect } from 'vitest';
import { repairWithBlueprint } from '../SaveDataRepair';
import type { GameSaveData } from '../../../shared/types';

// ─────────────────────────────────────────────
// 测试数据工厂
// ─────────────────────────────────────────────

const R = { grain: 100, gold: 50, troops: 10, mandate: 0, recruitToken: 10 };
const P = { grain: 1, gold: 0.5, troops: 0.1, mandate: 0, recruitToken: 0 };
const C = { grain: 1000, gold: 500, troops: 200, mandate: 100, recruitToken: 100 };
const BLDG = (c: Partial<Record<string, unknown>> = {}) => ({
  version: 1,
  buildings: {
    castle: { level: 1, status: 'idle', upgradeStartTime: null, upgradeEndTime: null },
    farm: { level: 0, status: 'locked', upgradeStartTime: null, upgradeEndTime: null },
    ...c,
  },
});
const RES = (overrides: Record<string, unknown> = {}) => ({
  version: 1, resources: { ...R, ...overrides }, lastSaveTime: 1000000,
  productionRates: { ...P }, caps: { ...C },
});

function makeBlueprint(): GameSaveData {
  return {
    version: 1, saveTime: 1000000,
    resource: RES(), building: BLDG(),
  } as GameSaveData;
}

function makeLoaded(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { version: 1, saveTime: 1000000, resource: RES(), building: BLDG(), ...overrides };
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('SaveDataRepair', () => {
  const blueprint = makeBlueprint();

  // ═══════════════════════════════════════════
  // 1. 基础功能
  // ═══════════════════════════════════════════

  describe('基础功能', () => {
    it('完整数据无需修复 — repaired=false，logs 为空', () => {
      const result = repairWithBlueprint(makeBlueprint(), blueprint);
      expect(result.repaired).toBe(false);
      expect(result.logs).toHaveLength(0);
      expect(result.data.resource.resources.grain).toBe(100);
      expect(result.data.building.buildings.castle.level).toBe(1);
    });

    it('loaded 为 null 时，返回蓝图数据', () => {
      const result = repairWithBlueprint(null, blueprint);
      expect(result.repaired).toBe(false);
      expect(result.data).toEqual(blueprint);
    });

    it('loaded 为 undefined 时，返回蓝图数据', () => {
      expect(repairWithBlueprint(undefined, blueprint).data).toEqual(blueprint);
    });

    it('loaded 为 string 时，返回蓝图数据', () => {
      expect(repairWithBlueprint('corrupt', blueprint).data).toEqual(blueprint);
    });

    it('loaded 为 number 时，返回蓝图数据', () => {
      expect(repairWithBlueprint(42, blueprint).data).toEqual(blueprint);
    });

    it('loaded 为 boolean 时，返回蓝图数据', () => {
      expect(repairWithBlueprint(true, blueprint).data).toEqual(blueprint);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 缺失字段补全（fill_missing）
  // ═══════════════════════════════════════════

  describe('缺失字段补全 (fill_missing)', () => {
    it('顶层缺失 resource 字段，用蓝图补全', () => {
      const loaded = makeLoaded();
      delete loaded.resource;
      const result = repairWithBlueprint(loaded, blueprint);
      expect(result.repaired).toBe(true);
      expect(result.data.resource).toEqual(blueprint.resource);
      const log = result.logs.find((l) => l.field === 'resource');
      expect(log).toMatchObject({ action: 'fill_missing', oldValue: undefined });
    });

    it('顶层缺失 building 字段，用蓝图补全', () => {
      const loaded = makeLoaded();
      delete loaded.building;
      const result = repairWithBlueprint(loaded, blueprint);
      expect(result.data.building).toEqual(blueprint.building);
      expect(result.logs.find((l) => l.field === 'building')?.action).toBe('fill_missing');
    });

    it('嵌套缺失字段 — resource 存在但缺少 grain，用蓝图补全', () => {
      const { grain: _, ...resourcesWithoutGrain } = { ...R };
      const loaded = makeLoaded({
        resource: {
          version: 1, resources: resourcesWithoutGrain, lastSaveTime: 1000000,
          productionRates: { ...P }, caps: { ...C },
        },
      });
      const result = repairWithBlueprint(loaded, blueprint);
      expect(result.data.resource.resources.grain).toBe(100);
      expect(result.logs.find((l) => l.field === 'resource.resources.grain')).toMatchObject({
        action: 'fill_missing',
      });
    });

    it('深层嵌套缺失 — building.buildings 缺少 farm，用蓝图补全', () => {
      const loaded = makeLoaded({
        building: { version: 1, buildings: { castle: BLDG().buildings.castle } },
      });
      const result = repairWithBlueprint(loaded, blueprint);
      expect(result.data.building.buildings.farm).toEqual({
        level: 0, status: 'locked', upgradeStartTime: null, upgradeEndTime: null,
      });
      expect(result.logs.find((l) => l.field === 'building.buildings.farm')?.action).toBe('fill_missing');
    });

    it('整个可选子系统缺失 — loaded 无 hero，用蓝图补全', () => {
      const bp = { ...structuredClone(blueprint), hero: { version: 1, heroes: [] } } as GameSaveData;
      const result = repairWithBlueprint(makeLoaded(), bp);
      expect(result.data.hero).toEqual({ version: 1, heroes: [] });
      expect(result.logs.find((l) => l.field === 'hero')?.action).toBe('fill_missing');
    });

    it('多个可选子系统缺失 — hero/tech/campaign 同时缺失', () => {
      const bp = {
        ...structuredClone(blueprint),
        hero: { version: 1, heroes: [] },
        tech: { version: 1, levels: {} },
        campaign: { version: 1, progress: {} },
      } as GameSaveData;
      const result = repairWithBlueprint(makeLoaded(), bp);
      expect(result.data.hero).toEqual({ version: 1, heroes: [] });
      expect(result.data.tech).toEqual({ version: 1, levels: {} });
      expect(result.data.campaign).toEqual({ version: 1, progress: {} });
      expect(result.logs.filter((l) => l.action === 'fill_missing').length).toBeGreaterThanOrEqual(3);
    });

    it('嵌套对象中子字段全部缺失，用蓝图递归补全', () => {
      const loaded = makeLoaded({ resource: { version: 1 } });
      const result = repairWithBlueprint(loaded, blueprint);
      expect(result.data.resource.resources).toEqual(blueprint.resource.resources);
      expect(result.data.resource.productionRates).toEqual(blueprint.resource.productionRates);
      expect(result.data.resource.caps).toEqual(blueprint.resource.caps);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 类型错误修复（fix_type）
  // ═══════════════════════════════════════════

  describe('类型错误修复 (fix_type)', () => {
    it('number 字段为 string — resource.resources.grain = "100"，修正', () => {
      const loaded = makeLoaded({ resource: RES({ grain: '100' }) });
      const result = repairWithBlueprint(loaded, blueprint);
      expect(result.data.resource.resources.grain).toBe(100);
      expect(result.logs.find((l) => l.field === 'resource.resources.grain')).toMatchObject({
        action: 'fix_type', oldValue: '100', newValue: 100,
      });
    });

    it('number 字段为 boolean — resource.resources.gold = true，修正', () => {
      const loaded = makeLoaded({ resource: RES({ gold: true }) });
      const result = repairWithBlueprint(loaded, blueprint);
      expect(result.data.resource.resources.gold).toBe(50);
      expect(result.logs.find((l) => l.field === 'resource.resources.gold')).toMatchObject({
        action: 'fix_type', oldValue: true,
      });
    });

    it('object 字段为 string — building.buildings = "corrupt"，修正', () => {
      const loaded = makeLoaded({ building: { version: 1, buildings: 'corrupt' } });
      const result = repairWithBlueprint(loaded, blueprint);
      expect(result.data.building.buildings).toEqual(blueprint.building.buildings);
      expect(result.logs.find((l) => l.field === 'building.buildings')).toMatchObject({
        action: 'fix_type', oldValue: 'corrupt',
      });
    });

    it('嵌套对象中类型错误 — buildings.castle.level = "5"，修正', () => {
      const loaded = makeLoaded({
        building: BLDG({
          castle: { level: '5', status: 'idle', upgradeStartTime: null, upgradeEndTime: null },
        }),
      });
      const result = repairWithBlueprint(loaded, blueprint);
      expect(result.data.building.buildings.castle.level).toBe(1);
      expect(result.logs.find((l) => l.field === 'building.buildings.castle.level')).toMatchObject({
        action: 'fix_type', oldValue: '5', newValue: 1,
      });
    });

    it('string 字段为 number — status = 42，修正', () => {
      const loaded = makeLoaded({
        building: BLDG({
          castle: { level: 1, status: 42, upgradeStartTime: null, upgradeEndTime: null },
        }),
      });
      const result = repairWithBlueprint(loaded, blueprint);
      expect(result.data.building.buildings.castle.status).toBe('idle');
      expect(result.logs.find((l) => l.field === 'building.buildings.castle.status')?.action).toBe('fix_type');
    });

    it('number 字段为 object — resource.resources.gold = {}，修正', () => {
      const loaded = makeLoaded({ resource: RES({ gold: {} }) });
      const result = repairWithBlueprint(loaded, blueprint);
      expect(result.data.resource.resources.gold).toBe(50);
      expect(result.logs.find((l) => l.field === 'resource.resources.gold')?.action).toBe('fix_type');
    });
  });

  // ═══════════════════════════════════════════
  // 4. NaN/Infinity 修复（fix_nan）
  // ═══════════════════════════════════════════

  describe('NaN/Infinity 修复 (fix_nan)', () => {
    it('资源值为 NaN — resource.resources.grain = NaN，修正', () => {
      const loaded = makeLoaded({ resource: RES({ grain: NaN }) });
      const result = repairWithBlueprint(loaded, blueprint);
      expect(result.data.resource.resources.grain).toBe(100);
      const log = result.logs.find((l) => l.field === 'resource.resources.grain')!;
      expect(log.action).toBe('fix_nan');
      expect(Number.isNaN(log.oldValue as number)).toBe(true);
      expect(log.newValue).toBe(100);
    });

    it('资源值为 Infinity — resource.resources.gold = Infinity，修正', () => {
      const loaded = makeLoaded({ resource: RES({ gold: Infinity }) });
      const result = repairWithBlueprint(loaded, blueprint);
      expect(result.data.resource.resources.gold).toBe(50);
      expect(result.logs.find((l) => l.field === 'resource.resources.gold')).toMatchObject({
        action: 'fix_nan', oldValue: Infinity, newValue: 50,
      });
    });

    it('资源值为 -Infinity，修正', () => {
      const loaded = makeLoaded({ resource: RES({ grain: -Infinity }) });
      const result = repairWithBlueprint(loaded, blueprint);
      expect(result.data.resource.resources.grain).toBe(100);
      expect(result.logs.find((l) => l.field === 'resource.resources.grain')?.action).toBe('fix_nan');
    });

    it('嵌套对象中 NaN — productionRates.grain = NaN，修正', () => {
      const loaded = makeLoaded({
        resource: { ...RES(), productionRates: { ...P, grain: NaN } },
      });
      const result = repairWithBlueprint(loaded, blueprint);
      expect(result.data.resource.productionRates.grain).toBe(1);
      expect(result.logs.find((l) => l.field === 'resource.productionRates.grain')?.action).toBe('fix_nan');
    });

    it('caps 中的 NaN — caps.gold = NaN，修正', () => {
      const loaded = makeLoaded({
        resource: { ...RES(), caps: { ...C, gold: NaN } },
      });
      const result = repairWithBlueprint(loaded, blueprint);
      expect(result.data.resource.caps.gold).toBe(500);
      expect(result.logs.find((l) => l.field === 'resource.caps.gold')?.action).toBe('fix_nan');
    });
  });

  // ═══════════════════════════════════════════
  // 5. 负数修复（fix_negative）
  // ═══════════════════════════════════════════

  describe('负数修复 (fix_negative)', () => {
    it('资源值为负数 — resource.resources.grain = -100，修正', () => {
      const loaded = makeLoaded({ resource: RES({ grain: -100 }) });
      const result = repairWithBlueprint(loaded, blueprint);
      expect(result.data.resource.resources.grain).toBe(100);
      expect(result.logs.find((l) => l.field === 'resource.resources.grain')).toMatchObject({
        action: 'fix_negative', oldValue: -100, newValue: 100,
      });
    });

    it('非资源路径的负数保留 — 建筑等级为负数不修正', () => {
      const loaded = makeLoaded({
        building: BLDG({
          castle: { level: -1, status: 'idle', upgradeStartTime: null, upgradeEndTime: null },
        }),
      });
      const result = repairWithBlueprint(loaded, blueprint);
      expect(result.data.building.buildings.castle.level).toBe(-1);
      expect(result.logs.filter((l) => l.action === 'fix_negative')).toHaveLength(0);
    });

    it('productionRates 中负数修正 — productionRates.grain = -0.5', () => {
      const loaded = makeLoaded({
        resource: { ...RES(), productionRates: { ...P, grain: -0.5 } },
      });
      const result = repairWithBlueprint(loaded, blueprint);
      expect(result.data.resource.productionRates.grain).toBe(1);
      expect(result.logs.find((l) => l.field === 'resource.productionRates.grain')?.action).toBe('fix_negative');
    });

    it('caps 中负数修正 — caps.troops = -200', () => {
      const loaded = makeLoaded({
        resource: { ...RES(), caps: { ...C, troops: -200 } },
      });
      const result = repairWithBlueprint(loaded, blueprint);
      expect(result.data.resource.caps.troops).toBe(200);
      expect(result.logs.find((l) => l.field === 'resource.caps.troops')?.action).toBe('fix_negative');
    });

    it('lastSaveTime 为负数修正', () => {
      const loaded = makeLoaded({ resource: { ...RES(), lastSaveTime: -999 } });
      const result = repairWithBlueprint(loaded, blueprint);
      expect(result.data.resource.lastSaveTime).toBe(1000000);
      expect(result.logs.find((l) => l.field === 'resource.lastSaveTime')?.action).toBe('fix_negative');
    });

    it('非资源值路径的负数保留 — resource.version = -1 不修正', () => {
      const loaded = makeLoaded({ resource: { ...RES(), version: -1 } });
      const result = repairWithBlueprint(loaded, blueprint);
      expect(result.data.resource.version).toBe(-1);
      expect(result.logs.filter((l) => l.action === 'fix_negative')).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 特殊字段处理
  // ═══════════════════════════════════════════

  describe('特殊字段保留', () => {
    it('version 字段不修复 — loaded.version = 0，修复后保留 0', () => {
      const result = repairWithBlueprint(makeLoaded({ version: 0 }), blueprint);
      expect(result.data.version).toBe(0);
      expect(result.logs.find((l) => l.field === 'version')).toBeUndefined();
    });

    it('saveTime 字段不修复 — loaded.saveTime = 12345，修复后保留 12345', () => {
      const result = repairWithBlueprint(makeLoaded({ saveTime: 12345 }), blueprint);
      expect(result.data.saveTime).toBe(12345);
      expect(result.logs.find((l) => l.field === 'saveTime')).toBeUndefined();
    });

    it('version 和 saveTime 同时不同于蓝图，均保留', () => {
      const result = repairWithBlueprint(makeLoaded({ version: 99, saveTime: 42 }), blueprint);
      expect(result.data.version).toBe(99);
      expect(result.data.saveTime).toBe(42);
      expect(result.logs.filter((l) => l.field === 'version' || l.field === 'saveTime')).toHaveLength(0);
    });

    it('version 缺失时用蓝图值补全', () => {
      const loaded = makeLoaded();
      delete loaded.version;
      expect(repairWithBlueprint(loaded, blueprint).data.version).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // 7. 数组合并
  // ═══════════════════════════════════════════

  describe('数组合并', () => {
    it('数组长度不足 — 用蓝图补全尾部', () => {
      const bp = { ...structuredClone(blueprint), hero: { version: 1, heroes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] } } as GameSaveData;
      const loaded = makeLoaded({ hero: { version: 1, heroes: [{ id: 'a' }] } });
      const result = repairWithBlueprint(loaded, bp);
      expect(result.data.hero!.heroes).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
      const fillLogs = result.logs.filter((l) => l.action === 'fill_missing' && l.field.startsWith('hero.heroes'));
      expect(fillLogs.length).toBeGreaterThanOrEqual(2);
    });

    it('数组长度一致 — 保留 loaded 的数组', () => {
      const bp = { ...structuredClone(blueprint), hero: { version: 1, heroes: [{ id: 'a' }, { id: 'b' }] } } as GameSaveData;
      const loaded = makeLoaded({ hero: { version: 1, heroes: [{ id: 'x' }, { id: 'y' }] } });
      expect(repairWithBlueprint(loaded, bp).data.hero!.heroes).toEqual([{ id: 'x' }, { id: 'y' }]);
    });

    it('数组长度更长 — 保留 loaded 的额外元素', () => {
      const bp = { ...structuredClone(blueprint), hero: { version: 1, heroes: [{ id: 'a' }] } } as GameSaveData;
      const loaded = makeLoaded({ hero: { version: 1, heroes: [{ id: 'x' }, { id: 'y' }, { id: 'z' }] } });
      expect(repairWithBlueprint(loaded, bp).data.hero!.heroes).toEqual([{ id: 'x' }, { id: 'y' }, { id: 'z' }]);
    });

    it('空数组 vs 蓝图数组 — 用蓝图补全', () => {
      const bp = { ...structuredClone(blueprint), hero: { version: 1, heroes: [{ id: 'a' }, { id: 'b' }] } } as GameSaveData;
      const loaded = makeLoaded({ hero: { version: 1, heroes: [] } });
      const result = repairWithBlueprint(loaded, bp);
      expect(result.data.hero!.heroes).toEqual([{ id: 'a' }, { id: 'b' }]);
      expect(result.logs.filter((l) => l.action === 'fill_missing' && l.field.startsWith('hero.heroes'))).toHaveLength(2);
    });
  });

  // ═══════════════════════════════════════════
  // 8. 综合场景
  // ═══════════════════════════════════════════

  describe('综合场景', () => {
    it('多问题同时修复 — 缺失字段 + 类型错误 + NaN', () => {
      const loaded = makeLoaded({
        resource: RES({ gold: '50', troops: NaN, mandate: 0, recruitToken: 10 }),
      });
      // grain 缺失（从 RES 中移除）
      const res = { ...loaded.resource } as Record<string, unknown>;
      const resources = { ...(res.resources as Record<string, unknown>) };
      delete resources.grain;
      res.resources = resources;
      loaded.resource = res;

      const result = repairWithBlueprint(loaded, blueprint);
      expect(result.repaired).toBe(true);
      expect(result.data.resource.resources.grain).toBe(100);
      expect(result.data.resource.resources.gold).toBe(50);
      expect(result.data.resource.resources.troops).toBe(10);
      const actions = result.logs.map((l) => l.action);
      expect(actions).toContain('fill_missing');
      expect(actions).toContain('fix_type');
      expect(actions).toContain('fix_nan');
    });

    it('修复日志完整性 — 每个 RepairLog 包含 field/action/oldValue/newValue', () => {
      const loaded = makeLoaded({ resource: RES({ grain: -100, gold: 'bad' }) });
      const result = repairWithBlueprint(loaded, blueprint);
      for (const log of result.logs) {
        expect(log).toHaveProperty('field');
        expect(log).toHaveProperty('action');
        expect(log).toHaveProperty('oldValue');
        expect(log).toHaveProperty('newValue');
        expect(typeof log.field).toBe('string');
        expect(log.field.length).toBeGreaterThan(0);
        expect(['fill_missing', 'fix_type', 'fix_nan', 'fix_negative']).toContain(log.action);
      }
    });

    it('修复不覆盖正确值 — loaded 中正确的值保持不变', () => {
      const loaded = makeLoaded({
        resource: { ...RES({ grain: 200, gold: 300, troops: 50, mandate: 5, recruitToken: 20 }), lastSaveTime: 2000000,
          productionRates: { grain: 2, gold: 1, troops: 0.5, mandate: 0, recruitToken: 0 },
          caps: { grain: 2000, gold: 1000, troops: 400, mandate: 200, recruitToken: 200 } },
        building: BLDG({
          castle: { level: 5, status: 'upgrading', upgradeStartTime: 123, upgradeEndTime: 456 },
          farm: { level: 3, status: 'idle', upgradeStartTime: null, upgradeEndTime: null },
        }),
      });
      const result = repairWithBlueprint(loaded, blueprint);
      expect(result.data.resource.resources.grain).toBe(200);
      expect(result.data.resource.resources.gold).toBe(300);
      expect(result.data.building.buildings.castle.level).toBe(5);
      expect(result.data.building.buildings.castle.status).toBe('upgrading');
      expect(result.data.building.buildings.farm.level).toBe(3);
      expect(result.repaired).toBe(false);
      expect(result.logs).toHaveLength(0);
    });

    it('向前兼容 — 保留 loaded 中蓝图不存在的额外字段', () => {
      const result = repairWithBlueprint(makeLoaded({ newFeature: { enabled: true } }), blueprint);
      expect(result.data.newFeature).toEqual({ enabled: true });
    });

    it('null 子字段保留 — loaded 中某字段为 null 时保留', () => {
      const loaded = makeLoaded({
        building: BLDG({
          castle: { level: 1, status: 'idle', upgradeStartTime: null, upgradeEndTime: null },
          farm: { level: null, status: 'locked', upgradeStartTime: null, upgradeEndTime: null },
        }),
      });
      const result = repairWithBlueprint(loaded, blueprint);
      expect(result.data.building.buildings.castle.upgradeStartTime).toBeNull();
      expect(result.data.building.buildings.farm.level).toBeNull();
    });

    it('蓝图值为 null/undefined 时保留 loaded 值', () => {
      const loaded = makeLoaded({ resource: { ...RES(), extraField: 42 } });
      expect(repairWithBlueprint(loaded, blueprint).data.resource.extraField).toBe(42);
    });

    it('空字符串修复 — 蓝图非空但 loaded 为空字符串时修正', () => {
      const loaded = makeLoaded({
        building: BLDG({
          castle: { level: 1, status: '', upgradeStartTime: null, upgradeEndTime: null },
        }),
      });
      const result = repairWithBlueprint(loaded, blueprint);
      expect(result.data.building.buildings.castle.status).toBe('idle');
      expect(result.logs.find((l) => l.field === 'building.buildings.castle.status')).toMatchObject({
        action: 'fill_missing', oldValue: '', newValue: 'idle',
      });
    });

    it('空字符串保留 — 蓝图也是空字符串时不修正', () => {
      const bp = {
        ...structuredClone(blueprint),
        building: BLDG({
          castle: { level: 1, status: '', upgradeStartTime: null, upgradeEndTime: null },
        }),
      } as GameSaveData;
      const loaded = makeLoaded({
        building: BLDG({
          castle: { level: 1, status: '', upgradeStartTime: null, upgradeEndTime: null },
        }),
      });
      expect(repairWithBlueprint(loaded, bp).data.building.buildings.castle.status).toBe('');
    });

    it('boolean 值直接接受', () => {
      const bp = { ...structuredClone(blueprint), flags: { active: true, visible: false } } as GameSaveData;
      const loaded = makeLoaded({ flags: { active: false, visible: true } });
      const result = repairWithBlueprint(loaded, bp);
      expect(result.data.flags).toEqual({ active: false, visible: true });
      expect(result.repaired).toBe(false);
    });

    it('修复结果 data 是深拷贝，不引用蓝图对象', () => {
      const result = repairWithBlueprint(makeLoaded(), blueprint);
      (result.data.resource.resources as Record<string, unknown>).grain = 9999;
      expect(blueprint.resource.resources.grain).toBe(100);
    });

    it('修复日志中 field 路径正确反映嵌套层级', () => {
      const loaded = makeLoaded({ resource: RES({ grain: 'bad' }) });
      const result = repairWithBlueprint(loaded, blueprint);
      expect(result.logs[0].field).toBe('resource.resources.grain');
      expect(result.logs[0].action).toBe('fix_type');
    });

    it('综合：同时存在缺失、类型错误、NaN、负数', () => {
      const loaded = makeLoaded({
        resource: {
          version: 1,
          resources: { gold: 'invalid', troops: NaN, mandate: 0, recruitToken: -5 },
          lastSaveTime: -100,
          productionRates: { grain: Infinity, gold: 0.5, troops: 0.1, mandate: 0, recruitToken: 0 },
          caps: { grain: -1000, gold: 500, troops: 200, mandate: 100, recruitToken: 100 },
        },
        building: { version: 1, buildings: {} },
      });
      const result = repairWithBlueprint(loaded, blueprint);
      expect(result.repaired).toBe(true);
      expect(result.data.resource.resources.grain).toBe(100);
      expect(result.data.resource.resources.gold).toBe(50);
      expect(result.data.resource.resources.troops).toBe(10);
      expect(result.data.resource.resources.recruitToken).toBe(10);
      expect(result.data.resource.lastSaveTime).toBe(1000000);
      expect(result.data.resource.productionRates.grain).toBe(1);
      expect(result.data.resource.caps.grain).toBe(1000);
      expect(result.data.building.buildings.castle).toEqual({
        level: 1, status: 'idle', upgradeStartTime: null, upgradeEndTime: null,
      });
      expect(result.data.building.buildings.farm).toEqual({
        level: 0, status: 'locked', upgradeStartTime: null, upgradeEndTime: null,
      });
      const actions = new Set(result.logs.map((l) => l.action));
      expect(actions).toContain('fill_missing');
      expect(actions).toContain('fix_type');
      expect(actions).toContain('fix_nan');
      expect(actions).toContain('fix_negative');
    });
  });
});
