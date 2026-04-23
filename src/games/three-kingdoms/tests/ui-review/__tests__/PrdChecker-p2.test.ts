import { describe, it, expect } from 'vitest';
import {

    });

    it('应检测未实现的需求', () => {
      const prd: PrdDocument = {
        module: '量子系统',
        moduleCode: 'QTU',
        requirements: [
          {
            id: 'QTU-99',
            section: '量子传送',
            description: '量子传送门纠缠态坍缩',
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

      expect(result.coveragePercent).toBe(0);
      expect(result.unsatisfied).toHaveLength(1);
      expect(result.unsatisfied[0].requirement.id).toBe('QTU-99');
      expect(result.unsatisfied[0].reason).toContain('QTU-99');
    });

    it('应正确计算部分覆盖率', () => {
      const prd: PrdDocument = {
        module: '资源系统',
        moduleCode: 'RES',
        requirements: [
          {
            id: 'RES-1',
            section: '资源类型',
            description: '4种核心资源定义',
            acceptance: [],
            priority: 'P0',
          },
          {
            id: 'QTU-1',
            section: '未知功能',
            description: '量子纠缠态坍缩传送',
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

      expect(result.totalRequirements).toBe(2);
      expect(result.coveragePercent).toBe(50);
      expect(result.satisfiedRequirements).toBe(1);
      expect(result.unsatisfied).toHaveLength(1);
    });

    it('应正确处理完整PRD文档的检查', () => {
      const prd = checker.parsePrdDocument(RES_PRD_MARKDOWN);
      const result = checker.check(
        prd,
        MOCK_SOURCE_FILES,
        createMockSourceContents()
      );

      expect(result.module).toBe('资源系统');
      expect(result.totalRequirements).toBe(5);
      expect(result.coveragePercent).toBeGreaterThanOrEqual(0);
      expect(result.coveragePercent).toBeLessThanOrEqual(100);
    });

    it('应为未满足的需求提供原因说明', () => {
      const prd: PrdDocument = {
        module: '测试',
        moduleCode: 'TST',
        requirements: [
          {
            id: 'TST-1',
            section: '测试章节',
            description: '完全不存在的功能',
            acceptance: [],
            priority: 'P0',
          },
        ],
      };

      const result = checker.check(prd, [], new Map());

      expect(result.unsatisfied).toHaveLength(1);
      expect(result.unsatisfied[0].reason).toContain('TST-1');
      expect(result.unsatisfied[0].reason).toContain('未找到');
    });
  });

  // -------------------------------------------------------------------------
  describe('覆盖率计算', () => {
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
});
