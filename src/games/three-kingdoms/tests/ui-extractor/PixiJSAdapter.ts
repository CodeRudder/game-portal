// ============================================================
// PixiJSAdapter — PixiJS v8 显示对象树提取适配器
// 从 PixiJS Container 层级中提取统一的 UITreeNode 树
// ============================================================

import {
  UINodeType,
  DEFAULT_EXTRACTOR_CONFIG,
} from './types';
import type {
  UINodeSource,
  UITreeNode,
  UITreeExtractorConfig,
  UITreeQuery,
  UIBounds,
  UINodeState,
} from './types';

// ---------------------------------------------------------------------------
// PixiJS v8 轻量级接口（避免直接依赖 @pixi/node）
// ---------------------------------------------------------------------------

/** PixiJS v8 DisplayObject 最小接口 */
export interface PixiDisplayObjectLike {
  readonly children?: PixiDisplayObjectLike[];
  name?: string | null;
  label?: string | null;
  visible: boolean;
  alpha: number;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex?: number;
  renderable?: boolean;
  getBounds?(skipUpdate?: boolean): { x: number; y: number; width: number; height: number };
  // 类型检测辅助属性
  isSprite?: boolean;
  text?: string;
  _text?: string;
}

/** PixiJS v8 Container 最小接口 */
export interface PixiContainerLike extends PixiDisplayObjectLike {
  readonly children: PixiDisplayObjectLike[];
}

// ---------------------------------------------------------------------------
// PixiJSAdapter
// ---------------------------------------------------------------------------

export class PixiJSAdapter {
  private readonly config: UITreeExtractorConfig;
  private idCounter: number;

  constructor(config?: Partial<UITreeExtractorConfig>) {
    this.config = { ...DEFAULT_EXTRACTOR_CONFIG, ...config };
    this.idCounter = 0;
  }

  // ======================== 公共方法 ========================

  /**
   * 从 PixiJS Container 根节点提取 UI 树
   */
  extractFromContainer(container: PixiContainerLike): UITreeNode {
    if (!container) {
      return this.createEmptyNode('empty-root');
    }
    this.idCounter = 0;
    return this.traverse(container, 0, '0');
  }

  /**
   * 在已有 UI 树中按条件查询节点
   */
  query(tree: UITreeNode, query: UITreeQuery): UITreeNode[] {
    const results: UITreeNode[] = [];

    const matches = (node: UITreeNode): boolean => {
      if (query.type !== undefined && node.type !== query.type) return false;
      if (query.source !== undefined && node.source !== query.source) return false;
      if (query.name !== undefined && node.name !== query.name) return false;
      if (query.namePattern !== undefined && !query.namePattern.test(node.name)) return false;

      if (query.state) {
        for (const [key, value] of Object.entries(query.state)) {
          if ((node.state as unknown as Record<string, unknown>)[key] !== value) return false;
        }
      }

      if (query.bounds) {
        for (const [key, value] of Object.entries(query.bounds)) {
          if ((node.bounds as unknown as Record<string, unknown>)[key] !== value) return false;
        }
      }

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
   * 判断 PixiJS 显示对象的类型
   * 优先级：Container > Sprite > Text > Graphics（默认）
   */
  private resolvePixiType(obj: PixiDisplayObjectLike): UINodeType {
    // 有 children 且长度 > 0 → Container
    if (obj.children && obj.children.length > 0) {
      return UINodeType.PixiContainer;
    }
    // isSprite 标记 → Sprite
    if (obj.isSprite === true) {
      return UINodeType.PixiSprite;
    }
    // 有 text 或 _text 属性 → Text
    if (obj.text !== undefined || obj._text !== undefined) {
      return UINodeType.PixiText;
    }
    // 默认 → Graphics
    return UINodeType.PixiGraphics;
  }

  /**
   * 获取节点位置信息
   * 优先使用 getBounds()，回退到 x/y/width/height
   */
  private getPixiBounds(obj: PixiDisplayObjectLike): UIBounds {
    if (!this.config.captureBounds) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    // 优先使用 getBounds()
    if (typeof obj.getBounds === 'function') {
      try {
        const bounds = obj.getBounds(false);
        return {
          x: Math.round(bounds.x),
          y: Math.round(bounds.y),
          width: Math.round(bounds.width),
          height: Math.round(bounds.height),
        };
      } catch {
        // getBounds 可能抛出异常，回退到 x/y/width/height
      }
    }

    // 回退：使用 x/y/width/height
    return {
      x: Math.round(obj.x),
      y: Math.round(obj.y),
      width: Math.round(obj.width),
      height: Math.round(obj.height),
    };
  }

  /**
   * 采集节点状态：visible / alpha / renderable / zIndex / text
   */
  private getPixiState(obj: PixiDisplayObjectLike): UINodeState {
    if (!this.config.captureState) {
      return { visible: true };
    }

    const state: UINodeState = {
      visible: obj.visible,
    };

    // alpha
    if (obj.alpha !== undefined && obj.alpha !== 1) {
      state.alpha = obj.alpha;
    }

    // zIndex
    if (obj.zIndex !== undefined) {
      state.zIndex = obj.zIndex;
    }

    // renderable → enabled 语义映射
    if (obj.renderable !== undefined) {
      state.enabled = obj.renderable;
    }

    // text 内容
    const textContent = obj.text ?? obj._text;
    if (textContent !== undefined && textContent !== null) {
      state.text = String(textContent);
    }

    return state;
  }

  /**
   * 获取节点显示名称
   * 优先级：label > name > 类型回退
   */
  private getPixiName(obj: PixiDisplayObjectLike): string {
    // PixiJS v8 优先使用 label
    if (obj.label !== undefined && obj.label !== null && obj.label !== '') {
      return obj.label;
    }
    // 回退到 name
    if (obj.name !== undefined && obj.name !== null && obj.name !== '') {
      return obj.name;
    }
    // 类型回退
    const type = this.resolvePixiType(obj);
    switch (type) {
      case UINodeType.PixiContainer:
        return 'Container';
      case UINodeType.PixiSprite:
        return 'Sprite';
      case UINodeType.PixiText:
        return 'Text';
      case UINodeType.PixiGraphics:
        return 'Graphics';
      default:
        return 'Unknown';
    }
  }

  /**
   * 递归遍历 PixiJS 显示对象树，构建 UITreeNode
   */
  private traverse(obj: PixiDisplayObjectLike, depth: number, path: string): UITreeNode {
    // 超出最大深度，返回叶子节点
    if (depth >= this.config.maxDepth) {
      return this.buildNode(obj, path, []);
    }

    const children: UITreeNode[] = [];

    // 遍历子对象
    if (obj.children && obj.children.length > 0) {
      for (let i = 0; i < obj.children.length; i++) {
        const child = obj.children[i] as PixiDisplayObjectLike;

        // 跳过隐藏节点（如果配置要求）
        if (!this.config.includeHidden && !this.isPixiVisible(child)) {
          continue;
        }

        const childPath = `${path}.${i}`;
        const childNode = this.traverse(child, depth + 1, childPath);
        children.push(childNode);
      }
    }

    return this.buildNode(obj, path, children);
  }

  /**
   * 生成唯一节点 ID
   */
  private generateId(obj: PixiDisplayObjectLike, path: string): string {
    const name = this.getPixiName(obj);
    const type = this.resolvePixiType(obj);
    const raw = `pixijs:${type}:${name}:${path}`;
    // 简易哈希
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
    }
    return `pixi-${Math.abs(hash).toString(36)}`;
  }

  // ======================== 辅助方法 ========================

  /**
   * 构建单个 UITreeNode
   */
  private buildNode(
    obj: PixiDisplayObjectLike,
    path: string,
    children: UITreeNode[],
  ): UITreeNode {
    const node: UITreeNode = {
      id: this.generateId(obj, path),
      source: 'pixijs' as UINodeSource,
      type: this.resolvePixiType(obj),
      name: this.getPixiName(obj),
      bounds: this.getPixiBounds(obj),
      state: this.getPixiState(obj),
      children,
      _raw: obj,
      metadata: {
        path,
        pixiType: this.resolvePixiType(obj),
      },
    };

    // 应用自定义过滤器
    if (this.config.filter && !this.config.filter(node)) {
      return { ...node, children: [] };
    }

    return node;
  }

  /**
   * 判断 PixiJS 显示对象是否可见
   */
  private isPixiVisible(obj: PixiDisplayObjectLike): boolean {
    // visible=false → 不可见
    if (obj.visible === false) return false;
    // alpha=0 → 不可见
    if (obj.alpha === 0) return false;
    // renderable=false → 视为不可见
    if (obj.renderable === false) return false;

    return true;
  }

  /**
   * 创建空占位节点
   */
  private createEmptyNode(id: string): UITreeNode {
    return {
      id,
      source: 'pixijs' as UINodeSource,
      type: UINodeType.Unknown,
      name: 'empty',
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      state: { visible: false },
      children: [],
    };
  }
}
