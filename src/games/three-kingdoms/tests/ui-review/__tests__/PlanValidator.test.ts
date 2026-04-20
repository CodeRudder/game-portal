// ============================================================
// PlanValidator 测试
// 覆盖：构造函数 / parsePlanDocument / validate / parseFeatureId
//       空文档与边界情况
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  PlanValidator,
  type VersionPlan,
  type PlanValidationResult,
} from '../PlanValidator';

// ---------------------------------------------------------------------------
// 模拟 PLAN Markdown 文档
// ---------------------------------------------------------------------------

/** 包含模块 A/B/C 共6个功能点的完整 PLAN 文档 */
const MOCK_PLAN_MD = `# v1.0 基业初立

## 版本概述

三国题材放置游戏首个版本，覆盖主界面导航、资源系统、建筑系统。

### 模块A: 主界面导航 (NAV)

| # | 功能点 | PRD引用 | UI引用 | 优先级 |
|---|--------|---------|--------|--------|
| 1 | 资源栏显示资源图标与数值 | [PRD: NAV-1 资源栏](./prd/nav.md) | [UI: 资源栏](./ui/nav.md) | P0 |
| 2 | Tab切换导航栏 | [PRD: NAV-2 Tab栏](./prd/nav.md) | — | P0 |

### 模块B: 资源系统 (RES)

| # | 功能点 | PRD引用 | UI引用 | 优先级 |
|---|--------|---------|--------|--------|
| 1 | 资源定义：粮草、铜钱、兵力、天命 | [PRD: RES-1 资源定义](./prd/res.md) | [UI: 资源图标](./ui/res.md) | P0 |
| 2 | 产出公式与资源产出速率 | [PRD: RES-2 产出公式](./prd/res.md) | — | P1 |
| 3 | 资源消耗场景列表 | — | — | P1 |

### 模块C: 建筑系统 (BLD)

| # | 功能点 | PRD引用 | UI引用 | 优先级 |
|---|--------|---------|--------|--------|
| 1 | 建筑总览与类型定义 | [PRD: BLD-1 建筑总览](./prd/bld.md) | [UI: 建筑列表](./ui/bld.md) | P0 |
`;

/** 无模块标题的文档（功能点无模块归属） */
const PLAN_NO_MODULES = `# v2.0 乱世争锋

| # | 功能点 | PRD引用 | UI引用 | 优先级 |
|---|--------|---------|--------|--------|
| 1 | 武将招募系统 | — | — | P0 |
| 2 | 科技研究树 | — | — | P1 |
`;

/** 空文档 */
const EMPTY_PLAN = '';

/** 只有标题没有功能表格的文档 */
const TITLE_ONLY_PLAN = `# v3.0 天下归一

仅有标题，无功能表格。
`;

// ---------------------------------------------------------------------------
// 模拟源码文件内容
// ---------------------------------------------------------------------------

/** 全覆盖源码：包含所有模块的关键词 */
function makeFullCoverageSources(): Map<string, string> {
  const sources = new Map<string, string>();
  sources.set('src/ResourceBar.tsx', `
    export const ResourceBar = () => {
      // 资源栏组件，显示资源图标与资源数值
      return <div className="resource-bar" />;
    };
  `);
  sources.set('src/TabBar.tsx', `
    export const TabBar = () => {
      // Tab切换导航栏
      return <nav className="tab-bar" />;
    };
  `);
  sources.set('src/engine/ResourceSystem.ts', `
    export class ResourceSystem {
      // 资源定义：粮草、铜钱、兵力、天命
      private resources: Map<string, number>;
      // 产出公式与资源产出速率
      calculateProduction() {}
      // 资源消耗
      consume() {}
    }
  `);
  sources.set('src/engine/BuildingSystem.ts', `
    export class BuildingSystem {
      // 建筑总览与类型定义
      private buildings: Building[];
    }
  `);
  return sources;
}

/** 部分覆盖源码：只包含部分模块关键词 */
function makePartialCoverageSources(): Map<string, string> {
  const sources = new Map<string, string>();
  sources.set('src/ResourceBar.tsx', `
    export const ResourceBar = () => {
      // 资源栏组件
      return <div />;
    };
  `);
  sources.set('src/BuildingSystem.ts', `
    export class BuildingSystem {
      // 建筑总览
    }
  `);
  return sources;
}

/** 空源码 */
function makeEmptySources(): Map<string, string> {
  return new Map<string, string>();
}

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

describe('PlanValidator', () => {
  const validator = new PlanValidator();

  // =======================================================================
  // 构造函数
  // =======================================================================

  describe('constructor', () => {
    it('应能正常创建实例', () => {
      const v = new PlanValidator();
      expect(v).toBeDefined();
      expect(v).toBeInstanceOf(PlanValidator);
    });
  });

  // =======================================================================
  // parsePlanDocument
  // =======================================================================

  describe('parsePlanDocument', () => {
    it('应正确解析完整PLAN文档的版本号和标题', () => {
      const plan = validator.parsePlanDocument(MOCK_PLAN_MD);

      expect(plan.version).toBe('v1.0');
      expect(plan.title).toBe('基业初立');
    });

    it('应正确提取功能点数量（3个模块共6个功能点）', () => {
      const plan = validator.parsePlanDocument(MOCK_PLAN_MD);

      expect(plan.totalFeatures).toBe(6);
      expect(plan.features).toHaveLength(6);
    });

    it('应正确解析每个功能点的id字段（模块代码+序号）', () => {
      const plan = validator.parsePlanDocument(MOCK_PLAN_MD);
      const ids = plan.features.map((f) => f.id);

      expect(ids).toEqual(['A1', 'A2', 'B1', 'B2', 'B3', 'C1']);
    });

    it('应正确解析每个功能点的module字段', () => {
      const plan = validator.parsePlanDocument(MOCK_PLAN_MD);

      expect(plan.features[0].module).toBe('主界面导航'); // A1
      expect(plan.features[2].module).toBe('资源系统');   // B1
      expect(plan.features[5].module).toBe('建筑系统');   // C1
    });

    it('应正确解析每个功能点的description字段', () => {
      const plan = validator.parsePlanDocument(MOCK_PLAN_MD);

      expect(plan.features[0].description).toBe('资源栏显示资源图标与数值');
      expect(plan.features[1].description).toBe('Tab切换导航栏');
      expect(plan.features[3].description).toBe('产出公式与资源产出速率');
    });

    it('应正确解析每个功能点的priority字段', () => {
      const plan = validator.parsePlanDocument(MOCK_PLAN_MD);

      expect(plan.features[0].priority).toBe('P0');
      expect(plan.features[3].priority).toBe('P1');
    });

    it('应正确解析PRD引用（提取链接显示文本）', () => {
      const plan = validator.parsePlanDocument(MOCK_PLAN_MD);

      expect(plan.features[0].prdRef).toBe('PRD: NAV-1 资源栏');
    });

    it('应正确处理"—"引用为undefined', () => {
      const plan = validator.parsePlanDocument(MOCK_PLAN_MD);

      // A2的UI引用是"—"
      expect(plan.features[1].uiRef).toBeUndefined();
      // B3的PRD引用是"—"
      expect(plan.features[4].prdRef).toBeUndefined();
    });

    it('无模块标题时应使用 F+序号 作为id', () => {
      const plan = validator.parsePlanDocument(PLAN_NO_MODULES);

      expect(plan.features).toHaveLength(2);
      expect(plan.features[0].id).toBe('F1');
      expect(plan.features[1].id).toBe('F2');
      expect(plan.features[0].module).toBe('');
    });

    it('空文档应返回unknown版本和空功能列表', () => {
      const plan = validator.parsePlanDocument(EMPTY_PLAN);

      expect(plan.version).toBe('unknown');
      expect(plan.title).toBe('unknown');
      expect(plan.features).toHaveLength(0);
      expect(plan.totalFeatures).toBe(0);
    });

    it('只有标题没有表格时应返回版本信息但功能列表为空', () => {
      const plan = validator.parsePlanDocument(TITLE_ONLY_PLAN);

      expect(plan.version).toBe('v3.0');
      expect(plan.title).toBe('天下归一');
      expect(plan.features).toHaveLength(0);
    });
  });

  // =======================================================================
  // validate
  // =======================================================================

  describe('validate', () => {
    it('全覆盖场景：所有功能点在源码中找到证据', () => {
      const plan = validator.parsePlanDocument(MOCK_PLAN_MD);
      const sources = makeFullCoverageSources();
      const filePaths = Array.from(sources.keys());

      const result = validator.validate(plan, filePaths, sources);

      expect(result.version).toBe('v1.0');
      expect(result.totalFeatures).toBe(6);
      // 全覆盖或接近全覆盖
      expect(result.coveragePercent).toBeGreaterThanOrEqual(50);
      expect(result.verifiedFeatures).toBeGreaterThan(0);
    });

    it('部分覆盖场景：只有部分功能点在源码中找到证据', () => {
      const plan = validator.parsePlanDocument(MOCK_PLAN_MD);
      const sources = makePartialCoverageSources();
      const filePaths = Array.from(sources.keys());

      const result = validator.validate(plan, filePaths, sources);

      expect(result.totalFeatures).toBe(6);
      expect(result.coveragePercent).toBeGreaterThan(0);
      expect(result.coveragePercent).toBeLessThan(100);
    });

    it('未覆盖场景：源码为空时所有功能点缺失', () => {
      const plan = validator.parsePlanDocument(MOCK_PLAN_MD);
      const sources = makeEmptySources();

      const result = validator.validate(plan, [], sources);

      expect(result.totalFeatures).toBe(6);
      expect(result.verifiedFeatures).toBe(0);
      expect(result.coveragePercent).toBe(0);
      expect(result.missingFeatures).toHaveLength(6);
    });

    it('coveragePercent计算正确（整数百分比）', () => {
      const plan = validator.parsePlanDocument(MOCK_PLAN_MD);
      const sources = makeFullCoverageSources();
      const filePaths = Array.from(sources.keys());

      const result = validator.validate(plan, filePaths, sources);

      // 覆盖率应为 0~100 的整数
      expect(result.coveragePercent).toBeGreaterThanOrEqual(0);
      expect(result.coveragePercent).toBeLessThanOrEqual(100);
      expect(Number.isInteger(result.coveragePercent)).toBe(true);
    });

    it('details数组长度应等于功能点总数', () => {
      const plan = validator.parsePlanDocument(MOCK_PLAN_MD);
      const sources = makeFullCoverageSources();
      const filePaths = Array.from(sources.keys());

      const result = validator.validate(plan, filePaths, sources);

      expect(result.details).toHaveLength(plan.totalFeatures);
    });

    it('每个detail应包含feature、status和evidence', () => {
      const plan = validator.parsePlanDocument(MOCK_PLAN_MD);
      const sources = makeFullCoverageSources();
      const filePaths = Array.from(sources.keys());

      const result = validator.validate(plan, filePaths, sources);

      for (const detail of result.details) {
        expect(detail.feature).toBeDefined();
        expect(detail.feature.id).toBeTruthy();
        expect(['verified', 'missing', 'partial']).toContain(detail.status);
        expect(Array.isArray(detail.evidence)).toBe(true);
      }
    });

    it('verified状态需要至少2个证据文件', () => {
      const plan = validator.parsePlanDocument(MOCK_PLAN_MD);
      const sources = makeFullCoverageSources();
      const filePaths = Array.from(sources.keys());

      const result = validator.validate(plan, filePaths, sources);

      // 至少检查一些 detail 的 status 合理性
      const verifiedDetails = result.details.filter((d) => d.status === 'verified');
      for (const d of verifiedDetails) {
        expect(d.evidence.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('partial状态需要恰好1个证据文件', () => {
      const plan = validator.parsePlanDocument(MOCK_PLAN_MD);
      const sources = makePartialCoverageSources();
      const filePaths = Array.from(sources.keys());

      const result = validator.validate(plan, filePaths, sources);

      const partialDetails = result.details.filter((d) => d.status === 'partial');
      for (const d of partialDetails) {
        expect(d.evidence.length).toBe(1);
      }
    });

    it('missing状态应有空证据列表', () => {
      const plan = validator.parsePlanDocument(MOCK_PLAN_MD);
      const sources = makeEmptySources();

      const result = validator.validate(plan, [], sources);

      const missingDetails = result.details.filter((d) => d.status === 'missing');
      expect(missingDetails.length).toBeGreaterThan(0);
      for (const d of missingDetails) {
        expect(d.evidence).toHaveLength(0);
      }
    });

    it('空plan验证时覆盖率应为0', () => {
      const plan: VersionPlan = {
        version: 'v0.0',
        title: 'empty',
        features: [],
        totalFeatures: 0,
      };

      const result = validator.validate(plan, [], new Map());

      expect(result.coveragePercent).toBe(0);
      expect(result.totalFeatures).toBe(0);
      expect(result.verifiedFeatures).toBe(0);
      expect(result.missingFeatures).toHaveLength(0);
    });
  });

  // =======================================================================
  // parseFeatureId
  // =======================================================================

  describe('parseFeatureId', () => {
    it('应正确解析 A1 → 模块A（主界面导航）序号1', () => {
      const result = validator.parseFeatureId('A1');
      expect(result.module).toBe('主界面导航');
      expect(result.number).toBe(1);
    });

    it('应正确解析 B3 → 模块B（资源系统）序号3', () => {
      const result = validator.parseFeatureId('B3');
      expect(result.module).toBe('资源系统');
      expect(result.number).toBe(3);
    });

    it('应正确解析 C1 → 模块C（建筑系统）序号1', () => {
      const result = validator.parseFeatureId('C1');
      expect(result.module).toBe('建筑系统');
      expect(result.number).toBe(1);
    });

    it('无效ID应返回unknown模块和0序号', () => {
      const result = validator.parseFeatureId('invalid');
      expect(result.module).toBe('unknown');
      expect(result.number).toBe(0);
    });

    it('空字符串应返回unknown', () => {
      const result = validator.parseFeatureId('');
      expect(result.module).toBe('unknown');
      expect(result.number).toBe(0);
    });
  });
});
