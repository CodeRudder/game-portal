// ============================================================
// CompositeExtractor — 合并提取器
// 将 React DOM 树和 PixiJS 显示对象树合并为统一的 UI 树
// ============================================================

import {
  UINodeType,
  DEFAULT_EXTRACTOR_CONFIG,
} from './types';
import type {
  UINodeSource,
  UITreeNode,
  UITreeSnapshot,
  UITreeStats,
  UITreeExtractorConfig,
  UITreeQuery,
} from './types';
import { ReactDOMAdapter } from './ReactDOMAdapter';
import { PixiJSAdapter, type PixiContainerLike } from './PixiJSAdapter';

// ---------------------------------------------------------------------------
// CompositeExtractor
// ---------------------------------------------------------------------------

export class CompositeExtractor {
  private readonly reactAdapter: ReactDOMAdapter;
  private readonly pixiAdapter: PixiJSAdapter;
  private readonly config: UITreeExtractorConfig;

  constructor(config?: Partial<UITreeExtractorConfig>) {
    this.config = { ...DEFAULT_EXTRACTOR_CONFIG, ...config };
    this.reactAdapter = new ReactDOMAdapter(config);
    this.pixiAdapter = new PixiJSAdapter(config);
  }

  // ======================== 公共方法 ========================

  /**
   * 从 React DOM + PixiJS Container 合并提取统一 UI 树
   * 策略：创建虚拟根节点，React DOM 子树和 PixiJS 子树作为两个分支
   */
  extract(domRoot: HTMLElement, pixiRoot: PixiContainerLike): UITreeNode {
    const domTree = this.extractDOM(domRoot);
    const pixiTree = this.extractPixi(pixiRoot);

    return {
      id: 'composite-root',
      source: 'react-dom' as UINodeSource,
      type: UINodeType.Unknown,
      name: 'CompositeRoot',
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      state: { visible: true },
      children: [domTree, pixiTree],
      metadata: {
        composite: true,
        sources: ['react-dom', 'pixijs'],
      },
    };
  }

  /**
   * 仅从 React DOM 提取 UI 树
   */
  extractDOM(domRoot: HTMLElement): UITreeNode {
    return this.reactAdapter.extractFromDOM(domRoot);
  }

  /**
   * 仅从 PixiJS 提取 UI 树
   */
  extractPixi(pixiRoot: PixiContainerLike): UITreeNode {
    return this.pixiAdapter.extractFromContainer(pixiRoot);
  }

  /**
   * 创建 UI 树快照
   */
  snapshot(root: UITreeNode): UITreeSnapshot {
    return {
      id: this.generateSnapshotId(),
      timestamp: Date.now(),
      root,
      stats: this.computeStats(root),
    };
  }

  /**
   * 统一查询：在 UI 树中按条件查找节点
   */
  query(tree: UITreeNode, query: UITreeQuery): UITreeNode[] {
    const results: UITreeNode[] = [];

    const matches = (node: UITreeNode): boolean => {
      // 类型过滤
      if (query.type !== undefined && node.type !== query.type) return false;
      // 来源过滤
      if (query.source !== undefined && node.source !== query.source) return false;
      // 名称精确匹配
      if (query.name !== undefined && node.name !== query.name) return false;
      // 名称正则匹配
      if (query.namePattern !== undefined && !query.namePattern.test(node.name)) return false;

      // 状态属性匹配
      if (query.state) {
        for (const [key, value] of Object.entries(query.state)) {
          if ((node.state as unknown as Record<string, unknown>)[key] !== value) return false;
        }
      }

      // 位置/尺寸匹配
      if (query.bounds) {
        for (const [key, value] of Object.entries(query.bounds)) {
          if ((node.bounds as unknown as Record<string, unknown>)[key] !== value) return false;
        }
      }

      // 自定义过滤器
      if (query.customFilter && !query.customFilter(node)) return false;

      return true;
    };

    const walk = (node: UITreeNode) => {
      if (matches(node)) {
        results.push(node);
      }
      for (const child of node.children) {
        walk(child);
      }
    };

    walk(tree);
    return results;
  }

  // ======================== 私有方法 ========================

  /**
   * 计算 UI 树统计信息
   * 包含：总节点数、React 节点数、PixiJS 节点数、最大深度、类型分布
   */
  private computeStats(root: UITreeNode): UITreeStats {
    let totalNodes = 0;
    let reactNodes = 0;
    let pixiNodes = 0;
    let maxDepth = 0;
    const nodeTypeDistribution: Record<string, number> = {};

    const walk = (node: UITreeNode, depth: number) => {
      totalNodes++;

      // 统计来源
      if (node.source === 'react-dom') {
        reactNodes++;
      } else if (node.source === 'pixijs') {
        pixiNodes++;
      }

      // 更新最大深度
      if (depth > maxDepth) {
        maxDepth = depth;
      }

      // 类型分布
      const typeName = node.type as string;
      nodeTypeDistribution[typeName] = (nodeTypeDistribution[typeName] || 0) + 1;

      // 递归子节点
      for (const child of node.children) {
        walk(child, depth + 1);
      }
    };

    walk(root, 0);

    return {
      totalNodes,
      reactNodes,
      pixiNodes,
      maxDepth,
      nodeTypeDistribution: nodeTypeDistribution as Record<UINodeType, number>,
    };
  }

  /**
   * 生成快照 ID：时间戳 + 随机后缀
   */
  private generateSnapshotId(): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 8);
    return `snap-${ts}-${rand}`;
  }
}
