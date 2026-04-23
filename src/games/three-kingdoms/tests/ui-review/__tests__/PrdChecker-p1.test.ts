/**
 * PrdChecker 单元测试
 *
 * 测试覆盖：
 * - 解析PRD文档
 * - 检查需求满足度
 * - 关键词搜索
 * - 覆盖率计算
 * - 空文档处理
 */

import { describe, it, expect } from 'vitest';
import {
  PrdChecker,
  type PrdDocument,
  type PrdRequirement,
  type PrdCheckResult,
} from '../PrdChecker';

// ---------------------------------------------------------------------------
// 测试数据：模拟 RES PRD文档
// ---------------------------------------------------------------------------

const RES_PRD_MARKDOWN = `# [RES] 资源系统 — 玩法设计 (PRD)

> **版本**: v1.0 | **日期**: 2026-04-18
> 🎨 **UI布局**: → [UI: 资源布局](../ui-layout/RES-resources.md)

---

## [RES-1] 资源类型 {#res-1}

### 功能描述

游戏包含4种核心资源 + 1种付费货币，构成完整的经济体系。

> 🎨 → [UI: 资源栏布局](../ui-layout/RES-resources.md#res-1)

### 核心资源定义

| 资源 | 图标 | 色彩标识 | 存储上限 | 核心用途 | 获取方式 |
|------|:----:|---------|:--------:|---------|---------|
| 🌾 粮草 | 稻穗水墨小品 | 翠竹绿 \`#7EC850\` | 粮仓容量（初始2,000） | 建筑升级、军队消耗 | 农田产出 |
| 💰 铜钱 | 方孔铜钱水墨 | 古铜金 \`#C9A84C\` | ∞（无上限） | 科技研究、武将招募 | 市集产出 |
| ⚔️ 兵力 | 刀盾水墨小品 | 赤焰红 \`#B8423A\` | 兵营容量（初始500） | 出征编队 | 兵营产出 |
| 👑 天命 | 帝王玉玺水墨 | 天命紫 \`#7B5EA7\` | ∞（无上限） | 高级招募 | 转生奖励 |

---

## [RES-2] 资源产出 {#res-2}

### 功能描述

资源通过建筑、领土、科技、武将等多来源产出，各来源独立计算后汇总。

### 基础产出公式

\`\`\`
资源净产出 = Σ(各来源产出) - Σ(各消耗项)
资源实际获得/秒 = 净产出 × (1 + 科技加成) × (1 + 主城加成)
\`\`\`

---

## [RES-3] 资源消耗 {#res-3}

### 功能描述

资源消耗涵盖建筑升级、科技研究、武将招募等核心玩法。

---

## [RES-4] 资源存储 {#res-4}

### 功能描述

部分资源有存储上限，超出后产出停止。存储上限通过建筑升级和科技研究提升。

---

## [RES-5] 资源交易 {#res-5}

### 功能描述

资源交易系统允许玩家在不同资源之间进行转换。

### 验收标准

- [ ] 玩家可以在市集进行资源转换
- [ ] 交易汇率随市集等级提升而改善
- [ ] 每日交易次数有限制
`;

// ---------------------------------------------------------------------------
// 测试用源码内容
// ---------------------------------------------------------------------------

const MOCK_SOURCE_FILES = [
  'src/engine/resource/ResourceSystem.ts',
  'src/engine/resource/ResourceCapSystem.ts',
  'src/engine/building/BuildingSystem.ts',
  'src/ui/components/ResourceBar.tsx',
];

function createMockSourceContents(): Map<string, string> {
  const contents = new Map<string, string>();
  contents.set('src/engine/resource/ResourceSystem.ts', `
    // 资源系统
    export class ResourceSystem {
      // 4种核心资源: 粮草, 铜钱, 兵力, 天命
      private resources: Map<ResourceType, number> = new Map();
      private productionRate: Map<ResourceType, number> = new Map();
      private capacity: Map<ResourceType, number> = new Map();

      getResources() { return this.resources; }
      getResourceRate() { return this.productionRate; }
      getResourceCap() { return this.capacity; }

      // 资源产出计算
      calculateProduction() {
        // 基础产出 + 建筑加成 + 科技加成
      }

      // 资源消耗
      consume(type: ResourceType, amount: number): boolean {
        const current = this.resources.get(type) || 0;
        if (current < amount) return false;
        this.resources.set(type, current - amount);
        return true;
      }
    }
  `);
  contents.set('src/engine/resource/ResourceCapSystem.ts', `
    export class ResourceCapSystem {
      // 资源上限计算
      calculateCap(buildingLevel: number): number {
        return 2000 + buildingLevel * 500;
      }
      // 溢出检测
      checkOverflow(current: number, cap: number): boolean {
        return current >= cap;
      }
    }
  `);
  contents.set('src/engine/building/BuildingSystem.ts', `
    export class BuildingSystem {
      private buildings: Building[] = [];
      upgrade(buildingId: string): void { }
      getProduction(buildingId: string): ResourceProduction { }
    }
  `);
  contents.set('src/ui/components/ResourceBar.tsx', `
    export const ResourceBar = () => {
      // 顶部资源栏
      return <div className="resource-bar">
        <ResourceIcon type="food" />
        <ResourceIcon type="copper" />
        <ResourceIcon type="troops" />
        <ResourceIcon type="destiny" />
      </div>;
    };
  `);
  return contents;
}

// ===========================================================================
// 测试套件
// ===========================================================================

describe('PrdChecker', () => {
  const checker = new PrdChecker();

  // -------------------------------------------------------------------------
  describe('parsePrdDocument', () => {
    it('应正确解析模块代码和模块名称', () => {
      const prd = checker.parsePrdDocument(RES_PRD_MARKDOWN);

      expect(prd.moduleCode).toBe('RES');
      expect(prd.module).toBe('资源系统');
    });

    it('应正确提取所有需求章节', () => {
      const prd = checker.parsePrdDocument(RES_PRD_MARKDOWN);

      expect(prd.requirements.length).toBe(5);
    });

    it('应正确提取需求ID', () => {
      const prd = checker.parsePrdDocument(RES_PRD_MARKDOWN);
      const ids = prd.requirements.map((r) => r.id);

      expect(ids).toContain('RES-1');
      expect(ids).toContain('RES-2');
      expect(ids).toContain('RES-3');
      expect(ids).toContain('RES-4');
      expect(ids).toContain('RES-5');
    });

    it('应正确提取需求描述', () => {
      const prd = checker.parsePrdDocument(RES_PRD_MARKDOWN);
      const res1 = prd.requirements.find((r) => r.id === 'RES-1');

      expect(res1).toBeDefined();
      expect(res1!.description).toContain('核心资源');
    });

    it('应提取验收标准', () => {
      const prd = checker.parsePrdDocument(RES_PRD_MARKDOWN);
      const res5 = prd.requirements.find((r) => r.id === 'RES-5');

      expect(res5).toBeDefined();
      expect(res5!.acceptance.length).toBeGreaterThan(0);
      expect(res5!.acceptance[0]).toContain('资源转换');
    });

    it('应为没有明确验收标准的章节提供空数组', () => {
      const prd = checker.parsePrdDocument(RES_PRD_MARKDOWN);
      const res1 = prd.requirements.find((r) => r.id === 'RES-1');

      expect(res1).toBeDefined();
      // RES-1 没有明确的验收标准标记
      expect(Array.isArray(res1!.acceptance)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('check — 需求满足度检查', () => {
    it('应对已实现的需求返回高覆盖率', () => {
      const prd: PrdDocument = {
        module: '资源系统',
        moduleCode: 'RES',
        requirements: [
          {
            id: 'RES-1',
            section: '资源类型',
            description: '游戏包含4种核心资源',
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
      expect(result.satisfiedRequirements).toBe(1);
      expect(result.unsatisfied).toHaveLength(0);
