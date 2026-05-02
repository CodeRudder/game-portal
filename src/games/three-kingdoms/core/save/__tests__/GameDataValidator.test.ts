// ACC-SAVE: 游戏数据修正系统测试
/**
 * GameDataValidator 单元测试
 *
 * 覆盖：
 * - validate(): 完整数据通过校验
 * - validate(): 缺失必需字段 (resource/building) 报 error
 * - validate(): 数据类型错误
 * - validate(): 负数资源值报 warning
 * - validate(): 缺失可选子系统报 info
 * - validateResource(): 资源系统专项校验
 * - validateBuilding(): 建筑系统专项校验
 * - validateSubSystem(): 通用子系统校验
 * - validateHero(): 武将子系统校验
 */

import { describe, it, expect } from 'vitest';
import { GameDataValidator } from '../GameDataValidator';
import type { ValidationReport } from '../GameDataValidator';

// ── 辅助：构建完整的有效存档数据 ─────────────────────
function makeValidSaveData(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: 1,
    saveTime: Date.now(),
    resource: {
      resources: {
        grain: 100,
        gold: 200,
        troops: 50,
        mandate: 10,
        techPoint: 5,
        recruitToken: 0,
      },
      lastSaveTime: Date.now(),
      productionRates: { grain: 10, gold: 5 },
      caps: { grain: 1000, gold: 500 },
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
  };
}

// ── 辅助：获取指定 severity 的问题 ───────────────────
function getIssues(report: ValidationReport, severity: 'error' | 'warning' | 'info') {
  return report.issues.filter(i => i.severity === severity);
}

// ══════════════════════════════════════════════════════
// 测试主体
// ══════════════════════════════════════════════════════

describe('GameDataValidator', () => {
  const validator = new GameDataValidator();

  // ═══════════════════════════════════════════════════
  // validate() — 完整数据通过校验
  // ═══════════════════════════════════════════════════
  describe('validate() — 完整数据通过校验', () => {
    it('完整的有效数据返回 valid=true（无 error）', () => {
      const data = makeValidSaveData();
      const report = validator.validate(data);

      // 可能有 info 级别（可选子系统缺失），但不应有 error
      expect(report.valid).toBe(true);
      expect(getIssues(report, 'error')).toHaveLength(0);
    });

    it('校验报告 stats 正确统计各类问题数量', () => {
      const data = makeValidSaveData();
      const report = validator.validate(data);

      const totalIssues = report.stats.errors + report.stats.warnings + report.stats.info;
      expect(totalIssues).toBe(report.issues.length);
    });
  });

  // ═══════════════════════════════════════════════════
  // validate() — 顶层结构校验
  // ═══════════════════════════════════════════════════
  describe('validate() — 顶层结构校验', () => {
    it('null 数据报 error', () => {
      const report = validator.validate(null);
      expect(report.valid).toBe(false);
      const errors = getIssues(report, 'error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].field).toBe('root');
      expect(errors[0].message).toContain('空');
    });

    it('undefined 数据报 error', () => {
      const report = validator.validate(undefined);
      expect(report.valid).toBe(false);
      const errors = getIssues(report, 'error');
      expect(errors[0].field).toBe('root');
    });

    it('数组数据报 error（类型错误）', () => {
      const report = validator.validate([1, 2, 3]);
      expect(report.valid).toBe(false);
      const errors = getIssues(report, 'error');
      expect(errors.some(e => e.field === 'root')).toBe(true);
    });

    it('字符串数据报 error', () => {
      const report = validator.validate('not an object');
      expect(report.valid).toBe(false);
    });

    it('缺失 version 字段报 error', () => {
      const data = makeValidSaveData();
      delete (data as Record<string, unknown>).version;
      const report = validator.validate(data);
      const errors = getIssues(report, 'error');
      expect(errors.some(e => e.field === 'version')).toBe(true);
    });

    it('version 为非 number 类型报 error', () => {
      const data = makeValidSaveData({ version: '1' });
      const report = validator.validate(data);
      const errors = getIssues(report, 'error');
      expect(errors.some(e => e.field === 'version')).toBe(true);
    });

    it('缺失 saveTime 字段报 warning', () => {
      const data = makeValidSaveData();
      delete (data as Record<string, unknown>).saveTime;
      const report = validator.validate(data);
      const warnings = getIssues(report, 'warning');
      expect(warnings.some(w => w.field === 'saveTime')).toBe(true);
    });

    it('缺失 resource 报 error', () => {
      const data = makeValidSaveData();
      delete (data as Record<string, unknown>).resource;
      const report = validator.validate(data);
      const errors = getIssues(report, 'error');
      expect(errors.some(e => e.field === 'resource' && e.message.includes('缺失'))).toBe(true);
    });

    it('缺失 building 报 error', () => {
      const data = makeValidSaveData();
      delete (data as Record<string, unknown>).building;
      const report = validator.validate(data);
      const errors = getIssues(report, 'error');
      expect(errors.some(e => e.field === 'building' && e.message.includes('缺失'))).toBe(true);
    });

    it('顶层 error 存在时跳过后续校验', () => {
      const report = validator.validate(null);
      // 只有 root 级别的 error，不应有 resource/building 等字段的问题
      const fields = report.issues.map(i => i.field);
      expect(fields.every(f => f === 'root')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════
  // validate() — 版本校验
  // ═══════════════════════════════════════════════════
  describe('validate() — 版本校验', () => {
    it('存档版本高于引擎版本报 warning（不兼容）', () => {
      const data = makeValidSaveData({ version: 999 });
      const report = validator.validate(data);
      const warnings = getIssues(report, 'warning');
      expect(warnings.some(w => w.field === 'version' && w.message.includes('高于'))).toBe(true);
    });

    it('存档版本低于引擎版本报 info（需要迁移）', () => {
      const data = makeValidSaveData({ version: 0 });
      const report = validator.validate(data);
      const infos = getIssues(report, 'info');
      expect(infos.some(i => i.field === 'version' && i.message.includes('低于'))).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════
  // validate() — 可选子系统缺失报 info
  // ═══════════════════════════════════════════════════
  describe('validate() — 可选子系统缺失', () => {
    it('缺失 hero 子系统报 info', () => {
      const data = makeValidSaveData();
      const report = validator.validate(data);
      const infos = getIssues(report, 'info');
      expect(infos.some(i => i.field === 'hero')).toBe(true);
    });

    it('缺失 tech 子系统报 info', () => {
      const data = makeValidSaveData();
      const report = validator.validate(data);
      const infos = getIssues(report, 'info');
      expect(infos.some(i => i.field === 'tech')).toBe(true);
    });

    it('缺失 campaign 子系统报 info', () => {
      const data = makeValidSaveData();
      const report = validator.validate(data);
      const infos = getIssues(report, 'info');
      expect(infos.some(i => i.field === 'campaign')).toBe(true);
    });

    it('可选子系统数据类型异常报 warning', () => {
      const data = makeValidSaveData({ hero: 'invalid' });
      const report = validator.validate(data);
      const warnings = getIssues(report, 'warning');
      expect(warnings.some(w => w.field === 'hero' && w.message.includes('类型异常'))).toBe(true);
    });

    it('可选子系统为 null 报 warning', () => {
      const data = makeValidSaveData({ hero: null });
      const report = validator.validate(data);
      const warnings = getIssues(report, 'warning');
      expect(warnings.some(w => w.field === 'hero')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════
  // validateResource()
  // ═══════════════════════════════════════════════════
  describe('validateResource()', () => {
    it('resource 为 null 时报 error', () => {
      const issues = validator.validateResource(null);
      expect(issues.some(i => i.severity === 'error' && i.field === 'resource')).toBe(true);
    });

    it('resource 为 undefined 时报 error', () => {
      const issues = validator.validateResource(undefined);
      expect(issues.some(i => i.severity === 'error' && i.field === 'resource')).toBe(true);
    });

    it('缺失 resources 字段报 error（autoFixable=true）', () => {
      const issues = validator.validateResource({ lastSaveTime: 0 });
      expect(issues.some(i => i.severity === 'error' && i.field === 'resource.resources')).toBe(true);
      expect(issues.find(i => i.field === 'resource.resources')!.autoFixable).toBe(true);
    });

    it('grain 为 string 而非 number 时报 error', () => {
      const issues = validator.validateResource({
        resources: { grain: '100', gold: 200, troops: 50, mandate: 10, techPoint: 5, recruitToken: 0 },
        lastSaveTime: Date.now(),
        productionRates: {},
        caps: {},
      });
      const grainIssue = issues.find(i => i.field === 'resource.resources.grain');
      expect(grainIssue).toBeDefined();
      expect(grainIssue!.severity).toBe('error');
      expect(grainIssue!.autoFixable).toBe(true);
    });

    it('负数资源值报 warning', () => {
      const issues = validator.validateResource({
        resources: { grain: -50, gold: 200, troops: 50, mandate: 10, techPoint: 5, recruitToken: 0 },
        lastSaveTime: Date.now(),
        productionRates: {},
        caps: {},
      });
      const grainIssue = issues.find(i => i.field === 'resource.resources.grain');
      expect(grainIssue).toBeDefined();
      expect(grainIssue!.severity).toBe('warning');
      expect(grainIssue!.message).toContain('负数');
    });

    it('Infinity 资源值报 error（非有限数）', () => {
      const issues = validator.validateResource({
        resources: { grain: Infinity, gold: 200, troops: 50, mandate: 10, techPoint: 5, recruitToken: 0 },
        lastSaveTime: Date.now(),
        productionRates: {},
        caps: {},
      });
      const grainIssue = issues.find(i => i.field === 'resource.resources.grain');
      expect(grainIssue).toBeDefined();
      expect(grainIssue!.severity).toBe('error');
      expect(grainIssue!.message).toContain('非有限数');
    });

    it('NaN 资源值报 error（非有限数）', () => {
      const issues = validator.validateResource({
        resources: { grain: NaN, gold: 200, troops: 50, mandate: 10, techPoint: 5, recruitToken: 0 },
        lastSaveTime: Date.now(),
        productionRates: {},
        caps: {},
      });
      const grainIssue = issues.find(i => i.field === 'resource.resources.grain');
      expect(grainIssue).toBeDefined();
      expect(grainIssue!.severity).toBe('error');
    });

    it('缺失 lastSaveTime 报 warning', () => {
      const issues = validator.validateResource({
        resources: { grain: 100, gold: 200, troops: 50, mandate: 10, techPoint: 5, recruitToken: 0 },
        productionRates: {},
        caps: {},
      });
      expect(issues.some(i => i.field === 'resource.lastSaveTime' && i.severity === 'warning')).toBe(true);
    });

    it('lastSaveTime 为负数报 warning', () => {
      const issues = validator.validateResource({
        resources: { grain: 100, gold: 200, troops: 50, mandate: 10, techPoint: 5, recruitToken: 0 },
        lastSaveTime: -100,
        productionRates: {},
        caps: {},
      });
      expect(issues.some(i => i.field === 'resource.lastSaveTime' && i.severity === 'warning')).toBe(true);
    });

    it('缺失 productionRates 报 warning', () => {
      const issues = validator.validateResource({
        resources: { grain: 100, gold: 200, troops: 50, mandate: 10, techPoint: 5, recruitToken: 0 },
        lastSaveTime: Date.now(),
        caps: {},
      });
      expect(issues.some(i => i.field === 'resource.productionRates' && i.severity === 'warning')).toBe(true);
    });

    it('缺失 caps 报 warning', () => {
      const issues = validator.validateResource({
        resources: { grain: 100, gold: 200, troops: 50, mandate: 10, techPoint: 5, recruitToken: 0 },
        lastSaveTime: Date.now(),
        productionRates: {},
      });
      expect(issues.some(i => i.field === 'resource.caps' && i.severity === 'warning')).toBe(true);
    });

    it('所有资源字段齐全且类型正确时无 error', () => {
      const issues = validator.validateResource({
        resources: { grain: 100, gold: 200, troops: 50, mandate: 10, techPoint: 5, recruitToken: 0 },
        lastSaveTime: Date.now(),
        productionRates: {},
        caps: {},
      });
      expect(issues.filter(i => i.severity === 'error')).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════
  // validateBuilding()
  // ═══════════════════════════════════════════════════
  describe('validateBuilding()', () => {
    const validBuildings = {
      castle: { level: 1, status: 'idle' },
      farmland: { level: 2, status: 'idle' },
      market: { level: 1, status: 'idle' },
      barracks: { level: 1, status: 'idle' },
      workshop: { level: 1, status: 'idle' },
      academy: { level: 1, status: 'idle' },
      clinic: { level: 1, status: 'idle' },
      wall: { level: 1, status: 'idle' },
    };

    it('building 为 null 时报 error', () => {
      const issues = validator.validateBuilding(null);
      expect(issues.some(i => i.severity === 'error' && i.field === 'building')).toBe(true);
    });

    it('缺失 buildings 字段报 error', () => {
      const issues = validator.validateBuilding({});
      expect(issues.some(i => i.severity === 'error' && i.field === 'building.buildings')).toBe(true);
    });

    it('buildings 为非 object 时报 error', () => {
      const issues = validator.validateBuilding({ buildings: 'invalid' });
      expect(issues.some(i => i.severity === 'error' && i.field === 'building.buildings')).toBe(true);
    });

    it('缺失某类建筑时报 error', () => {
      const issues = validator.validateBuilding({
        buildings: { castle: { level: 1, status: 'idle' } },
      });
      // 应该有 7 个缺失建筑（farmland, market, barracks, workshop, academy, clinic, wall）
      const missingErrors = issues.filter(i => i.severity === 'error' && i.message.includes('数据缺失'));
      expect(missingErrors.length).toBe(7);
    });

    it('建筑 level 为非 number 时报 error', () => {
      const issues = validator.validateBuilding({
        buildings: {
          ...validBuildings,
          castle: { level: 'one', status: 'idle' },
        },
      });
      expect(issues.some(i => i.field === 'building.buildings.castle.level' && i.severity === 'error')).toBe(true);
    });

    it('建筑 level 为负数时报 warning', () => {
      const issues = validator.validateBuilding({
        buildings: {
          ...validBuildings,
          castle: { level: -1, status: 'idle' },
        },
      });
      expect(issues.some(i => i.field === 'building.buildings.castle.level' && i.severity === 'warning')).toBe(true);
    });

    it('建筑 level 超过上限 (100) 时报 warning', () => {
      const issues = validator.validateBuilding({
        buildings: {
          ...validBuildings,
          castle: { level: 101, status: 'idle' },
        },
      });
      expect(issues.some(i => i.field === 'building.buildings.castle.level' && i.severity === 'warning' && i.message.includes('超过上限'))).toBe(true);
    });

    it('建筑 status 为非法值时报 warning', () => {
      const issues = validator.validateBuilding({
        buildings: {
          ...validBuildings,
          castle: { level: 1, status: 'broken' },
        },
      });
      expect(issues.some(i => i.field === 'building.buildings.castle.status' && i.severity === 'warning')).toBe(true);
    });

    it('有效建筑 status (locked/idle/upgrading) 不报错', () => {
      for (const status of ['locked', 'idle', 'upgrading']) {
        const issues = validator.validateBuilding({
          buildings: {
            ...validBuildings,
            castle: { level: 1, status },
          },
        });
        expect(issues.some(i => i.field === 'building.buildings.castle.status')).toBe(false);
      }
    });

    it('完整的有效建筑数据无 error', () => {
      const issues = validator.validateBuilding({ buildings: validBuildings });
      expect(issues.filter(i => i.severity === 'error')).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════
  // validateSubSystem()
  // ═══════════════════════════════════════════════════
  describe('validateSubSystem()', () => {
    it('数据为 null 时报 info（可自动修复）', () => {
      const issues = validator.validateSubSystem('testSubsystem', null);
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe('info');
      expect(issues[0].autoFixable).toBe(true);
      expect(issues[0].field).toBe('testSubsystem');
    });

    it('数据为 undefined 时报 info', () => {
      const issues = validator.validateSubSystem('testSubsystem', undefined);
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe('info');
    });

    it('数据为非 object 类型时报 warning', () => {
      const issues = validator.validateSubSystem('testSubsystem', 'invalid');
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe('warning');
      expect(issues[0].message).toContain('类型错误');
    });

    it('数据为有效对象时返回空数组', () => {
      const issues = validator.validateSubSystem('testSubsystem', { foo: 'bar' });
      expect(issues).toHaveLength(0);
    });

    it('数据为数字时报 warning', () => {
      const issues = validator.validateSubSystem('testSubsystem', 42);
      expect(issues[0].severity).toBe('warning');
    });

    it('数据为布尔值时报 warning', () => {
      const issues = validator.validateSubSystem('testSubsystem', true);
      expect(issues[0].severity).toBe('warning');
    });
  });

  // ═══════════════════════════════════════════════════
  // validateHero()
  // ═══════════════════════════════════════════════════
  describe('validateHero()', () => {
    it('hero 为 null 时报 warning', () => {
      const issues = validator.validateHero(null);
      expect(issues.some(i => i.severity === 'warning' && i.field === 'hero')).toBe(true);
    });

    it('hero 为 undefined 时报 warning', () => {
      const issues = validator.validateHero(undefined);
      expect(issues.some(i => i.severity === 'warning' && i.field === 'hero')).toBe(true);
    });

    it('generals 为非数组时报 warning', () => {
      const issues = validator.validateHero({ generals: 'not-array' });
      expect(issues.some(i => i.severity === 'warning' && i.field === 'hero.generals')).toBe(true);
    });

    it('fragments 为非对象时报 warning', () => {
      const issues = validator.validateHero({ fragments: 'not-object' });
      expect(issues.some(i => i.severity === 'warning' && i.field === 'hero.fragments')).toBe(true);
    });

    it('generals 为数组时不报错', () => {
      const issues = validator.validateHero({ generals: [] });
      expect(issues.some(i => i.field === 'hero.generals')).toBe(false);
    });

    it('fragments 为对象时不报错', () => {
      const issues = validator.validateHero({ fragments: {} });
      expect(issues.some(i => i.field === 'hero.fragments')).toBe(false);
    });

    it('有效的 hero 数据无 warning', () => {
      const issues = validator.validateHero({ generals: [], fragments: {} });
      expect(issues).toHaveLength(0);
    });
  });
});
