import { describe, it, expect } from 'vitest';
import { UITreeDiffer } from '../UITreeDiffer';
import { DiffType, UINodeType } from '../types';
import type {

      const baseTree = makeNode('root', {
        state: { visible: true, alpha: 1 },
      const targetTree = makeNode('root', {
        state: { visible: true, alpha: 0.5 },

      const result = differ.diff(
        makeSnapshot(baseTree, 'b'),
        makeSnapshot(targetTree, 't'),
      );

      const alphaChange = result.diffs.find(d => d.property === 'state.alpha');
      expect(alphaChange).toBeDefined();
      expect(alphaChange!.oldValue).toBe(1);
      expect(alphaChange!.newValue).toBe(0.5);
    });
  });

  // ---- 位置变化检测 ----
  describe('moved nodes', () => {
    it('should detect child position change', () => {
      const baseTree = makeNode('root', {
        children: [makeNode('a'), makeNode('b'), makeNode('c')],
      });
      const targetTree = makeNode('root', {
        children: [makeNode('c'), makeNode('a'), makeNode('b')],
      });

      const result = differ.diff(
        makeSnapshot(baseTree, 'b'),
        makeSnapshot(targetTree, 't'),
      );

      const moved = result.diffs.filter(d => d.diffType === DiffType.Moved);
      expect(moved.length).toBeGreaterThan(0);
      expect(result.summary.moved).toBeGreaterThan(0);
    });

    it('should include old and new index for moved nodes', () => {
      const baseTree = makeNode('root', {
        children: [makeNode('a'), makeNode('b')],
      });
      const targetTree = makeNode('root', {
        children: [makeNode('b'), makeNode('a')],
      });

      const result = differ.diff(
        makeSnapshot(baseTree, 'b'),
        makeSnapshot(targetTree, 't'),
      );

      const moved = result.diffs.filter(d => d.diffType === DiffType.Moved);
      const bMoved = moved.find(d => d.nodeId === 'b');
      expect(bMoved).toBeDefined();
      expect(bMoved!.oldValue).toBe(1); // 原来在 index 1
      expect(bMoved!.newValue).toBe(0); // 现在在 index 0
    });
  });

  // ---- 深层嵌套差异 ----
  describe('deep nesting', () => {
    it('should detect changes in deeply nested nodes', () => {
      const baseTree = makeNode('root', {
        children: [
          makeNode('level1', {
            children: [
              makeNode('level2', {
                children: [
                  makeNode('level3', {
                    state: { visible: true, text: 'deep' },
                  }),
                ],
              }),
            ],
          }),
        ],
      });

      const targetTree = makeNode('root', {
        children: [
          makeNode('level1', {
            children: [
              makeNode('level2', {
                children: [
                  makeNode('level3', {
                    state: { visible: true, text: 'changed' },
                  }),
                ],
              }),
            ],
          }),
        ],
      });

      const result = differ.diff(
        makeSnapshot(baseTree, 'b'),
        makeSnapshot(targetTree, 't'),
      );

      const textChange = result.diffs.find(d => d.property === 'state.text');
      expect(textChange).toBeDefined();
      expect(textChange!.oldValue).toBe('deep');
      expect(textChange!.newValue).toBe('changed');
    });

    it('should detect added node in deep hierarchy', () => {
      const baseTree = makeNode('root', {
        children: [makeNode('a', { children: [] })],
      });
      const targetTree = makeNode('root', {
        children: [
          makeNode('a', {
            children: [makeNode('deep-new')],
          }),
        ],
      });

      const result = differ.diff(
        makeSnapshot(baseTree, 'b'),
        makeSnapshot(targetTree, 't'),
      );

      const added = result.diffs.filter(d => d.diffType === DiffType.Added);
      expect(added.length).toBe(1);
      expect(added[0].nodeId).toBe('deep-new');
    });
  });

  // ---- 空树对比 ----
  describe('empty trees', () => {
    it('should report zero diffs for two empty single-node trees', () => {
      const node = makeNode('single');
      const result = differ.diff(
        makeSnapshot(node, 'b'),
        makeSnapshot(node, 't'),
      );

      expect(result.diffs).toEqual([]);
      expect(result.summary.added).toBe(0);
      expect(result.summary.removed).toBe(0);
      expect(result.summary.changed).toBe(0);
      expect(result.summary.moved).toBe(0);
    });

    it('should detect all children as added when base has no children', () => {
      const baseTree = makeNode('root', { children: [] });
      const targetTree = makeNode('root', {
        children: [makeNode('new-1'), makeNode('new-2')],
      });

      const result = differ.diff(
        makeSnapshot(baseTree, 'b'),
        makeSnapshot(targetTree, 't'),
      );

      expect(result.summary.added).toBe(2);
      expect(result.summary.removed).toBe(0);
    });

    it('should detect all children as removed when target has no children', () => {
      const baseTree = makeNode('root', {
        children: [makeNode('old-1'), makeNode('old-2')],
      });
      const targetTree = makeNode('root', { children: [] });

      const result = differ.diff(
        makeSnapshot(baseTree, 'b'),
        makeSnapshot(targetTree, 't'),
      );

      expect(result.summary.removed).toBe(2);
      expect(result.summary.added).toBe(0);
    });
  });

  // ---- 摘要统计准确性 ----
  describe('summary accuracy', () => {
    it('should correctly count mixed diff types', () => {
      const baseTree = makeNode('root', {
        state: { visible: true, text: 'old' },
        bounds: { x: 0, y: 0, width: 100, height: 50 },
        children: [makeNode('a'), makeNode('b'), makeNode('c')],
      });
      const targetTree = makeNode('root', {
        state: { visible: false, text: 'new' },
        bounds: { x: 0, y: 0, width: 100, height: 50 },
        children: [makeNode('a'), makeNode('d')], // removed b,c; added d
      });

      const result = differ.diff(
        makeSnapshot(baseTree, 'b'),
        makeSnapshot(targetTree, 't'),
      );

      // state.visible changed, state.text changed
      expect(result.summary.changed).toBeGreaterThanOrEqual(2);
      // removed b and c
      expect(result.summary.removed).toBe(2);
      // added d
      expect(result.summary.added).toBe(1);
    });

    it('should include snapshot IDs in diff result', () => {
      const node = makeNode('root');
      const result = differ.diff(
        makeSnapshot(node, 'snap-base-001'),
        makeSnapshot(node, 'snap-target-002'),
      );

      expect(result.baseSnapshotId).toBe('snap-base-001');
      expect(result.targetSnapshotId).toBe('snap-target-002');
    });

    it('should produce correct total = added + removed + changed + moved', () => {
      const baseTree = makeNode('root', {
        children: [makeNode('a'), makeNode('b')],
      });
      const targetTree = makeNode('root', {
        children: [makeNode('b'), makeNode('c')], // a removed, c added, b moved
      });

      const result = differ.diff(
        makeSnapshot(baseTree, 'b'),
        makeSnapshot(targetTree, 't'),
      );

      const total = result.summary.added + result.summary.removed +
                    result.summary.changed + result.summary.moved;
      expect(total).toBe(result.diffs.length);
    });
  });

  // ---- diffTrees 直接调用 ----
  describe('diffTrees', () => {
    it('should accept custom basePath', () => {
      const base = makeNode('root', { state: { visible: true } });
      const target = makeNode('root', { state: { visible: false } });

      const diffs = differ.diffTrees(base, target, 'custom-path');

      expect(diffs.length).toBeGreaterThan(0);
      expect(diffs[0].path).toContain('custom-path');
    });

    it('should default basePath to root', () => {
      const base = makeNode('root', { state: { visible: true } });
      const target = makeNode('root', { state: { visible: false } });

      const diffs = differ.diffTrees(base, target);

      expect(diffs[0].path).toContain('root');
    });
  });
});
