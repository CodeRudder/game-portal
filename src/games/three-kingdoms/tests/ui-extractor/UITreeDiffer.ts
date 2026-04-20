// ============================================================
// UITreeDiffer — 差异对比引擎
// 对比两个 UI 树快照，检测新增/删除/变更/移动的节点
// ============================================================

import { DiffType } from './types';
import type {
  UITreeNode,
  UITreeSnapshot,
  UITreeDiff,
  UITreeDiffNode,
} from './types';

// ---------------------------------------------------------------------------
// 属性对比辅助：需要检测变化的属性键列表
// ---------------------------------------------------------------------------

const STATE_KEYS_TO_COMPARE: (keyof import('./types').UINodeState)[] = [
  'visible', 'enabled', 'active', 'alpha', 'zIndex', 'text', 'className',
];

const BOUNDS_KEYS_TO_COMPARE: (keyof import('./types').UIBounds)[] = [
  'x', 'y', 'width', 'height',
];

// ---------------------------------------------------------------------------
// UITreeDiffer
// ---------------------------------------------------------------------------

export class UITreeDiffer {
  // ======================== 公共方法 ========================

  /**
   * 对比两个快照，返回完整差异结果
   */
  diff(base: UITreeSnapshot, target: UITreeSnapshot): UITreeDiff {
    const diffs = this.diffTrees(base.root, target.root);

    return {
      baseSnapshotId: base.id,
      targetSnapshotId: target.id,
      diffs,
      summary: this.summarize(diffs),
    };
  }

  /**
   * 对比两棵树，返回差异节点列表
   * @param basePath 路径前缀，默认为 'root'
   */
  diffTrees(base: UITreeNode, target: UITreeNode, basePath = 'root'): UITreeDiffNode[] {
    const diffs: UITreeDiffNode[] = [];

    // 1. 对比根节点自身属性
    diffs.push(...this.diffNodeState(base, target, basePath));

    // 2. 对比子节点列表
    diffs.push(...this.diffChildren(base, target, basePath));

    return diffs;
  }

  // ======================== 私有方法 ========================

  /**
   * 对比单个节点的属性变化
   * 检测 visible / text / bounds / className / alpha / enabled 等属性差异
   */
  private diffNodeState(base: UITreeNode, target: UITreeNode, path: string): UITreeDiffNode[] {
    const diffs: UITreeDiffNode[] = [];

    // 如果 nodeId 不同，说明不是同一节点，跳过属性对比
    if (base.id !== target.id) {
      return diffs;
    }

    // 对比 state 属性
    for (const key of STATE_KEYS_TO_COMPARE) {
      const baseVal = (base.state as unknown as Record<string, unknown>)[key];
      const targetVal = (target.state as unknown as Record<string, unknown>)[key];

      if (!this.deepEqual(baseVal, targetVal)) {
        diffs.push({
          diffType: DiffType.Changed,
          path: `${path}.state.${key}`,
          nodeId: base.id,
          nodeName: base.name,
          property: `state.${key}`,
          oldValue: baseVal,
          newValue: targetVal,
        });
      }
    }

    // 对比 bounds 属性
    for (const key of BOUNDS_KEYS_TO_COMPARE) {
      const baseVal = (base.bounds as unknown as Record<string, unknown>)[key];
      const targetVal = (target.bounds as unknown as Record<string, unknown>)[key];

      if (baseVal !== targetVal) {
        diffs.push({
          diffType: DiffType.Changed,
          path: `${path}.bounds.${key}`,
          nodeId: base.id,
          nodeName: base.name,
          property: `bounds.${key}`,
          oldValue: baseVal,
          newValue: targetVal,
        });
      }
    }

    // 对比 name 变化
    if (base.name !== target.name) {
      diffs.push({
        diffType: DiffType.Changed,
        path: `${path}.name`,
        nodeId: base.id,
        nodeName: base.name,
        property: 'name',
        oldValue: base.name,
        newValue: target.name,
      });
    }

    return diffs;
  }

  /**
   * 对比子节点列表
   * 策略：按 nodeId 匹配 base 和 target 中的子节点
   * - base 中存在但 target 中不存在 → Removed
   * - target 中存在但 base 中不存在 → Added
   * - 两者都存在 → 递归对比
   * - 子节点顺序变化 → Moved
   */
  private diffChildren(base: UITreeNode, target: UITreeNode, path: string): UITreeDiffNode[] {
    const diffs: UITreeDiffNode[] = [];

    // 建立 nodeId → index 的映射
    const baseChildMap = new Map<string, { node: UITreeNode; index: number }>();
    const targetChildMap = new Map<string, { node: UITreeNode; index: number }>();

    base.children.forEach((child, index) => {
      baseChildMap.set(child.id, { node: child, index });
    });

    target.children.forEach((child, index) => {
      targetChildMap.set(child.id, { node: child, index });
    });

    // 检测已删除的节点（base 有，target 没有）
    for (const [nodeId, { node, index }] of baseChildMap) {
      if (!targetChildMap.has(nodeId)) {
        diffs.push({
          diffType: DiffType.Removed,
          path: `${path}.children[${index}]`,
          nodeId: node.id,
          nodeName: node.name,
          oldValue: node,
        });
      }
    }

    // 检测新增的节点和移动的节点，并递归对比已存在的节点
    for (const [nodeId, { node: targetNode, index: targetIndex }] of targetChildMap) {
      const baseEntry = baseChildMap.get(nodeId);

      if (!baseEntry) {
        // target 有，base 没有 → Added
        diffs.push({
          diffType: DiffType.Added,
          path: `${path}.children[${targetIndex}]`,
          nodeId: targetNode.id,
          nodeName: targetNode.name,
          newValue: targetNode,
        });
      } else {
        // 两者都有，检测位置变化
        if (baseEntry.index !== targetIndex) {
          diffs.push({
            diffType: DiffType.Moved,
            path: `${path}.children[${targetIndex}]`,
            nodeId: targetNode.id,
            nodeName: targetNode.name,
            property: 'index',
            oldValue: baseEntry.index,
            newValue: targetIndex,
          });
        }

        // 递归对比子树
        const childPath = `${path}.children[${targetIndex}]`;
        diffs.push(...this.diffTrees(baseEntry.node, targetNode, childPath));
      }
    }

    return diffs;
  }

  /**
   * 生成差异摘要统计
   */
  private summarize(diffs: UITreeDiffNode[]): UITreeDiff['summary'] {
    const summary = {
      added: 0,
      removed: 0,
      changed: 0,
      moved: 0,
    };

    for (const diff of diffs) {
      switch (diff.diffType) {
        case DiffType.Added:
          summary.added++;
          break;
        case DiffType.Removed:
          summary.removed++;
          break;
        case DiffType.Changed:
          summary.changed++;
          break;
        case DiffType.Moved:
          summary.moved++;
          break;
      }
    }

    return summary;
  }

  // ======================== 辅助方法 ========================

  /**
   * 深度相等比较（支持 primitive / undefined / null）
   */
  private deepEqual(a: unknown, b: unknown): boolean {
    // 严格相等（包含 undefined === undefined）
    if (a === b) return true;

    // null / undefined 交叉比较
    if (a == null && b == null) return true;

    // 对象类型比较
    if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
      const keysA = Object.keys(a as object);
      const keysB = Object.keys(b as object);
      if (keysA.length !== keysB.length) return false;
      for (const key of keysA) {
        if (!this.deepEqual(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
        )) {
          return false;
        }
      }
      return true;
    }

    return false;
  }
}
