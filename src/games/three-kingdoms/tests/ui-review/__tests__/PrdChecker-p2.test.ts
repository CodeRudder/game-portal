import { describe, it, expect } from 'vitest';
import {
  PrdChecker,
  type PrdDocument,
  type PrdRequirement,
  type PrdCheckResult,
} from '../PrdChecker';

const MOCK_SOURCE_FILES = [
  'src/engine/resource/ResourceSystem.ts',
  'src/engine/resource/ResourceTypes.ts',
];

function createMockSourceContents(): Map<string, string> {
  const map = new Map<string, string>();
  map.set('src/engine/resource/ResourceSystem.ts', `
    // 资源系统
    export class ResourceSystem {
      // 4种核心资源: 粮草, 铜钱, 兵力, 天命
      private resources: Map<ResourceType, number> = new Map();
      private productionRate: Map<ResourceType, number> = new Map();
      // 资源产出 production rate 计算
      calculateProduction() {}
    }
  `);
  map.set('src/engine/resource/ResourceTypes.ts', `
    // 资源类型定义
    export interface Resource { id: string; }
    // 核心资源定义 粮草 铜钱 兵力 天命
  `);
  return map;
}

describe('覆盖率计算', () => {
  let checker: PrdChecker;

  beforeEach(() => {
    checker = new PrdChecker();
  });

  it('应对空需求列表返回0%覆盖率', () => {
    const prd: PrdDocument = {
      module: '空模块',
      moduleCode: 'EMP',
      requirements: [],
    };

    const result = checker.check(prd, MOCK_SOURCE_FILES, createMockSourceContents());

    expect(result.coveragePercent).toBe(0);
    expect(result.totalRequirements).toBe(0);
    expect(result.satisfiedRequirements).toBe(0);
  });

  it('应对全部满足的需求返回100%覆盖率', () => {
    const prd: PrdDocument = {
      module: '资源系统',
      moduleCode: 'RES',
      requirements: [
        {
          id: 'RES-1',
          section: '资源类型',
          description: '核心资源定义 粮草 铜钱 兵力',
          acceptance: [],
          priority: 'P0',
        },
        {
          id: 'RES-2',
          section: '资源产出',
          description: '资源产出 production rate 计算',
          acceptance: [],
          priority: 'P0',
        },
      ],
    };

    const result = checker.check(
      prd,
      MOCK_SOURCE_FILES,
      createMockSourceContents()
    );

    expect(result.coveragePercent).toBe(100);
  });

  it('应四舍五入覆盖率到整数', () => {
    const prd: PrdDocument = {
      module: '资源系统',
      moduleCode: 'RES',
      requirements: [
        {
          id: 'RES-1',
          section: '资源类型',
          description: '核心资源定义 粮草 铜钱',
          acceptance: [],
          priority: 'P0',
        },
        {
          id: 'RES-2',
          section: '资源产出',
          description: '资源产出 production',
          acceptance: [],
          priority: 'P0',
        },
        {
          id: 'QTU-3',
          section: '量子功能',
          description: '量子纠缠态坍缩传送门',
          acceptance: [],
          priority: 'P2',
        },
      ],
    };

    const result = checker.check(
      prd,
      MOCK_SOURCE_FILES,
      createMockSourceContents()
    );

    // 2/3 = 66.67% → 67%
    expect(result.coveragePercent).toBe(67);
  });
});

// -------------------------------------------------------------------------
describe('空文档和边界情况处理', () => {
  let checker: PrdChecker;

  beforeEach(() => {
    checker = new PrdChecker();
  });

  it('应处理空文档', () => {
    const prd = checker.parsePrdDocument('');

    expect(prd.moduleCode).toBe('unknown');
    expect(prd.module).toBe('unknown');
    expect(prd.requirements).toHaveLength(0);
  });

  it('应处理只有标题没有章节的文档', () => {
    const prd = checker.parsePrdDocument('# [BLD] 建筑系统 — PRD\n\n没有章节内容');

    expect(prd.moduleCode).toBe('BLD');
    expect(prd.module).toBe('建筑系统');
    expect(prd.requirements).toHaveLength(0);
  });

  it('应处理无源码文件的情况', () => {
    const prd: PrdDocument = {
      module: '资源系统',
      moduleCode: 'RES',
      requirements: [
        {
          id: 'RES-1',
          section: '资源类型',
          description: '核心资源',
          acceptance: [],
          priority: 'P0',
        },
      ],
    };

    const result = checker.check(prd, [], new Map());

    expect(result.coveragePercent).toBe(0);
    expect(result.unsatisfied).toHaveLength(1);
  });

  it('应处理包含特殊字符的PRD文档', () => {
    const specialPrd = `# [EVT] 事件系统 — PRD

## [EVT-1] 随机事件触发 {#evt-1}

### 功能描述

玩家在游戏中会随机触发各种事件，包括天气变化、NPC拜访等。

## [EVT-2] 事件奖励 {#evt-2}

### 功能描述

完成事件后获得奖励，奖励类型包括资源、道具、声望等。
`;

    const prd = checker.parsePrdDocument(specialPrd);

    expect(prd.moduleCode).toBe('EVT');
    expect(prd.requirements.length).toBe(2);
    expect(prd.requirements[0].id).toBe('EVT-1');
    expect(prd.requirements[1].id).toBe('EVT-2');
  });
});
