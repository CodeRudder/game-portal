// ============================================================
// UITreeDiffer 测试
// 覆盖：相同树对比 / 新增 / 删除 / 属性变化 / 位置变化
//       深层嵌套 / 空树对比 / 摘要统计准确性
// ============================================================

import { describe, it, expect } from 'vitest';
import { UITreeDiffer } from '../UITreeDiffer';
import { DiffType, UINodeType } from '../types';
import type {
  UITreeNode,
  UITreeSnapshot,
  UITreeDiff,
  UITreeDiffNode,
} from '../types';

// ---------------------------------------------------------------------------
// 辅助：创建 UI 树节点
// ---------------------------------------------------------------------------

function makeNode(
  id: string,
  overrides: Partial<UITreeNode> = {},
): UITreeNode {
  return {
    id,
    source: 'pixijs',
    type: UINodeType.PixiContainer,
    name: overrides.name ?? id,
    bounds: { x: 0, y: 0, width: 100, height: 50 },
    state: { visible: true },
    children: [],
    ...overrides,
  };
}

/** 创建快照的辅助函数 */
function makeSnapshot(root: UITreeNode, id = 'snap-0'): UITreeSnapshot {
  return {
    id,
    timestamp: Date.now(),
    root,
    stats: {
      totalNodes: 0,
      reactNodes: 0,
      pixiNodes: 0,
      maxDepth: 0,
      nodeTypeDistribution: {} as Record<UINodeType, number>,
    },
  };
}

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

describe('UITreeDiffer', () => {
  const differ = new UITreeDiffer();

  // ---- 相同树对比（零差异） ----
  describe('identical trees', () => {
    it('should report zero diffs for identical single-node trees', () => {
      const node = makeNode('root');
      const base = makeSnapshot(node, 'base');
      const target = makeSnapshot(node, 'target');

      const result = differ.diff(base, target);

      expect(result.diffs).toEqual([]);
      expect(result.summary.added).toBe(0);
      expect(result.summary.removed).toBe(0);
      expect(result.summary.changed).toBe(0);
      expect(result.summary.moved).toBe(0);
    });

    it('should report zero diffs for identical nested trees', () => {
      const tree = makeNode('root', {
        children: [
          makeNode('child-a'),
          makeNode('child-b', {
            children: [makeNode('grandchild-1')],
          }),
        ],
      });

      const base = makeSnapshot(tree, 'base');
      const target = makeSnapshot(tree, 'target');

      const result = differ.diff(base, target);

      expect(result.diffs).toEqual([]);
    });
  });

  // ---- 新增节点检测 ----
  describe('added nodes', () => {
    it('should detect a newly added child', () => {
      const baseTree = makeNode('root', {
        children: [makeNode('child-a')],
      });
      const targetTree = makeNode('root', {
        children: [makeNode('child-a'), makeNode('child-b')],
      });

      const base = makeSnapshot(baseTree, 'base');
      const target = makeSnapshot(targetTree, 'target');

      const result = differ.diff(base, target);

      const added = result.diffs.filter(d => d.diffType === DiffType.Added);
      expect(added.length).toBe(1);
      expect(added[0].nodeId).toBe('child-b');
      expect(added[0].nodeName).toBe('child-b');
      expect(result.summary.added).toBe(1);
    });

    it('should detect multiple added children', () => {
      const baseTree = makeNode('root', { children: [] });
      const targetTree = makeNode('root', {
        children: [makeNode('c1'), makeNode('c2'), makeNode('c3')],
      });

      const result = differ.diff(
        makeSnapshot(baseTree, 'b'),
        makeSnapshot(targetTree, 't'),
      );

      expect(result.summary.added).toBe(3);
    });
  });

  // ---- 删除节点检测 ----
  describe('removed nodes', () => {
    it('should detect a removed child', () => {
      const baseTree = makeNode('root', {
        children: [makeNode('child-a'), makeNode('child-b')],
      });
      const targetTree = makeNode('root', {
        children: [makeNode('child-a')],
      });

      const result = differ.diff(
        makeSnapshot(baseTree, 'b'),
        makeSnapshot(targetTree, 't'),
      );

      const removed = result.diffs.filter(d => d.diffType === DiffType.Removed);
      expect(removed.length).toBe(1);
      expect(removed[0].nodeId).toBe('child-b');
      expect(result.summary.removed).toBe(1);
    });

    it('should detect all children removed', () => {
      const baseTree = makeNode('root', {
        children: [makeNode('a'), makeNode('b')],
      });
      const targetTree = makeNode('root', { children: [] });

      const result = differ.diff(
        makeSnapshot(baseTree, 'b'),
        makeSnapshot(targetTree, 't'),
      );

      expect(result.summary.removed).toBe(2);
    });
  });

  // ---- 属性变化检测 ----
  describe('property changes', () => {
    it('should detect visible state change', () => {
      const baseTree = makeNode('root', {
        state: { visible: true },
      });
      const targetTree = makeNode('root', {
        state: { visible: false },
      });

      const result = differ.diff(
        makeSnapshot(baseTree, 'b'),
        makeSnapshot(targetTree, 't'),
      );

      const changed = result.diffs.filter(d => d.diffType === DiffType.Changed);
      expect(changed.length).toBeGreaterThan(0);

      const visChange = changed.find(d => d.property === 'state.visible');
      expect(visChange).toBeDefined();
      expect(visChange!.oldValue).toBe(true);
      expect(visChange!.newValue).toBe(false);
    });

    it('should detect text change', () => {
      const baseTree = makeNode('root', {
        state: { visible: true, text: 'Hello' },
      });
      const targetTree = makeNode('root', {
        state: { visible: true, text: 'World' },
      });

      const result = differ.diff(
        makeSnapshot(baseTree, 'b'),
        makeSnapshot(targetTree, 't'),
      );

      const textChange = result.diffs.find(d => d.property === 'state.text');
      expect(textChange).toBeDefined();
      expect(textChange!.oldValue).toBe('Hello');
      expect(textChange!.newValue).toBe('World');
    });

    it('should detect bounds change', () => {
      const baseTree = makeNode('root', {
        bounds: { x: 0, y: 0, width: 100, height: 50 },
      });
      const targetTree = makeNode('root', {
        bounds: { x: 10, y: 20, width: 100, height: 50 },
      });

      const result = differ.diff(
        makeSnapshot(baseTree, 'b'),
        makeSnapshot(targetTree, 't'),
      );

      const xChange = result.diffs.find(d => d.property === 'bounds.x');
      expect(xChange).toBeDefined();
      expect(xChange!.oldValue).toBe(0);
      expect(xChange!.newValue).toBe(10);

      const yChange = result.diffs.find(d => d.property === 'bounds.y');
      expect(yChange).toBeDefined();
      expect(yChange!.oldValue).toBe(0);
      expect(yChange!.newValue).toBe(20);
    });

    it('should detect className change', () => {
      const baseTree = makeNode('root', {
        state: { visible: true, className: 'old-class' },
      });
      const targetTree = makeNode('root', {
        state: { visible: true, className: 'new-class' },
      });

      const result = differ.diff(
        makeSnapshot(baseTree, 'b'),
        makeSnapshot(targetTree, 't'),
      );

      const clsChange = result.diffs.find(d => d.property === 'state.className');
      expect(clsChange).toBeDefined();
      expect(clsChange!.oldValue).toBe('old-class');
      expect(clsChange!.newValue).toBe('new-class');
    });

    it('should detect alpha change', () => {
});
});
});
