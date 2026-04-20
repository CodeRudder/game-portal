// ============================================================
// ReactDOMAdapter — React DOM 树提取适配器
// 从 React 渲染的 DOM 结构中提取统一的 UITreeNode 树
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

/** 非可视元素标签集合，遍历时跳过 */
const NON_VISUAL_TAGS = new Set([
  'SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT',
  'TITLE', 'TEMPLATE', 'BR', 'WBR',
]);

// ---------------------------------------------------------------------------
// React Fiber 内部键类型
// ---------------------------------------------------------------------------
interface ReactFiber {
  type?: unknown;
  elementType?: unknown;
  name?: string;
  return?: ReactFiber;
  child?: ReactFiber;
  stateNode?: unknown;
}

// ---------------------------------------------------------------------------
// ReactDOMAdapter
// ---------------------------------------------------------------------------

export class ReactDOMAdapter {
  private readonly config: UITreeExtractorConfig;

  constructor(config?: Partial<UITreeExtractorConfig>) {
    this.config = { ...DEFAULT_EXTRACTOR_CONFIG, ...config };
  }

  // ======================== 公共方法 ========================

  /**
   * 从 React DOM 根节点提取 UI 树
   */
  extractFromDOM(rootElement: HTMLElement): UITreeNode {
    if (!rootElement) {
      return this.createEmptyNode('empty-root');
    }
    return this.traverse(rootElement, 0, '0');
  }

  /**
   * 从 React Root 容器提取 UI 树（与 extractFromDOM 逻辑一致）
   */
  extractFromReactRoot(reactRoot: HTMLElement): UITreeNode {
    return this.extractFromDOM(reactRoot);
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
   * 通过 React Fiber 获取组件名
   * 优先从 Fiber.type.name / Fiber.elementType 取名，回退到 tagName
   */
  private getComponentName(element: HTMLElement): string {
    const fiber = this.getReactFiber(element);
    if (fiber) {
      // 函数组件或类组件
      const type = fiber.type as Record<string, unknown> | string | null | undefined;
      if (typeof type === 'function') {
        const fn = type as (...args: unknown[]) => unknown;
        return (fn as unknown as Record<string, unknown>).displayName as string || fn.name || 'Anonymous';
      }
      if (typeof type === 'string') {
        // 原生 HTML 标签（如 'div'）
        return type.toUpperCase();
      }
      if (typeof type === 'object' && type !== null) {
        // memo / forwardRef 等包装组件
        const render = (type as Record<string, unknown>).render;
        if (typeof render === 'function') {
          const rFn = render as (...args: unknown[]) => unknown;
          return (rFn as unknown as Record<string, unknown>).displayName as string || rFn.name || 'WrappedComponent';
        }
      }
    }

    // 回退：使用 aria-label 或 tagName
    const ariaLabel = element.getAttribute?.('aria-label');
    if (ariaLabel) return ariaLabel;

    return element.tagName?.toLowerCase() ?? 'unknown';
  }

  /**
   * 获取节点位置信息（通过 getBoundingClientRect）
   */
  private getBounds(element: HTMLElement): UIBounds {
    if (!this.config.captureBounds) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const rect = element.getBoundingClientRect();
    return {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  }

  /**
   * 采集节点状态：visible / enabled / className / style / attributes / text
   */
  private getNodeState(element: HTMLElement): UINodeState {
    if (!this.config.captureState) {
      return { visible: true };
    }

    const style = element.style;
    const computedVisible = this.isElementVisible(element);

    const state: UINodeState = {
      visible: computedVisible,
    };

    // enabled — 基于 disabled 属性
    if ('disabled' in element) {
      state.enabled = !(element as HTMLInputElement).disabled;
    }

    // active — 基于 :active 伪类或 aria-pressed
    if (element.getAttribute('aria-pressed') === 'true') {
      state.active = true;
    }

    // alpha — 基于 opacity
    if (style?.opacity !== undefined && style.opacity !== '') {
      state.alpha = parseFloat(style.opacity);
    }

    // zIndex
    if (style?.zIndex !== undefined && style.zIndex !== '') {
      state.zIndex = parseInt(style.zIndex, 10);
    }

    // text — 取直接文本（不含子元素文本）
    const directText = this.getDirectTextContent(element);
    if (directText) {
      state.text = directText;
    }

    // className
    if (element.className && typeof element.className === 'string') {
      state.className = element.className;
    }

    // style — 序列化为 Record<string, string>
    if (style && style.length > 0) {
      const styleMap: Record<string, string> = {};
      for (let i = 0; i < style.length; i++) {
        const prop = style[i] as string;
        styleMap[prop] = style.getPropertyValue(prop);
      }
      state.style = styleMap;
    }

    // attributes — 收集常用属性
    const attrs: Record<string, string> = {};
    const attrNames = ['id', 'role', 'data-testid', 'aria-label', 'aria-hidden', 'tabindex', 'href', 'src', 'alt', 'title', 'placeholder'];
    for (const attr of attrNames) {
      const val = element.getAttribute(attr);
      if (val !== null) {
        attrs[attr] = val;
      }
    }
    if (Object.keys(attrs).length > 0) {
      state.attributes = attrs;
    }

    return state;
  }

  /**
   * 判断节点类型：ReactComponent | HtmlElement | TextNode | Unknown
   */
  private resolveNodeType(element: HTMLElement): UINodeType {
    const fiber = this.getReactFiber(element);

    if (fiber) {
      const type = fiber.type;
      // 函数组件 / 类组件 / 包装组件
      if (typeof type === 'function') {
        return UINodeType.ReactComponent;
      }
      if (typeof type === 'object' && type !== null) {
        return UINodeType.ReactComponent;
      }
    }

    // 普通 HTML 元素
    if (element.tagName) {
      return UINodeType.HtmlElement;
    }

    return UINodeType.Unknown;
  }

  /**
   * 生成唯一节点 ID：基于 source + tagName + path 的哈希
   */
  private generateNodeId(element: HTMLElement, path: string): string {
    const tag = element.tagName?.toLowerCase() ?? 'unknown';
    const name = element.getAttribute('id') || element.getAttribute('data-testid') || '';
    // 简易哈希，避免过长 ID
    const raw = `react-dom:${tag}:${name}:${path}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
    }
    return `node-${Math.abs(hash).toString(36)}`;
  }

  /**
   * 递归遍历 DOM 树，构建 UITreeNode
   */
  private traverse(element: HTMLElement, depth: number, path: string): UITreeNode {
    // 超出最大深度，返回叶子节点
    if (depth >= this.config.maxDepth) {
      return this.buildNode(element, path, []);
    }

    const children: UITreeNode[] = [];

    // 遍历子元素
    const childNodes = element.childNodes;
    let childIndex = 0;

    for (let i = 0; i < childNodes.length; i++) {
      const child = childNodes[i] as HTMLElement;

      // 跳过纯文本节点（只保留有标签的元素）
      if (child.nodeType === Node.TEXT_NODE) {
        continue;
      }

      // 跳过非元素节点
      if (child.nodeType !== Node.ELEMENT_NODE) {
        continue;
      }

      // 跳过非可视元素
      if (NON_VISUAL_TAGS.has(child.tagName)) {
        continue;
      }

      // 跳过隐藏节点（如果配置要求）
      if (!this.config.includeHidden && !this.isElementVisible(child)) {
        continue;
      }

      const childPath = `${path}.${childIndex}`;
      const childNode = this.traverse(child as HTMLElement, depth + 1, childPath);
      children.push(childNode);
      childIndex++;
    }

    return this.buildNode(element, path, children);
  }

  // ======================== 辅助方法 ========================

  /**
   * 构建单个 UITreeNode
   */
  private buildNode(element: HTMLElement, path: string, children: UITreeNode[]): UITreeNode {
    const node: UITreeNode = {
      id: this.generateNodeId(element, path),
      source: 'react-dom' as UINodeSource,
      type: this.resolveNodeType(element),
      name: this.getComponentName(element),
      bounds: this.getBounds(element),
      state: this.getNodeState(element),
      children,
      _raw: element,
      metadata: {
        path,
        tagName: element.tagName?.toLowerCase() ?? '',
      },
    };

    // 应用自定义过滤器
    if (this.config.filter && !this.config.filter(node)) {
      // 过滤时返回空节点（保留结构）
      return { ...node, children: [] };
    }

    return node;
  }

  /**
   * 获取 React Fiber 实例
   */
  private getReactFiber(element: HTMLElement): ReactFiber | null {
    if (!element || typeof element !== 'object') return null;

    const keys = Object.keys(element);
    const fiberKey = keys.find(k => k.startsWith('__reactFiber$'));

    if (fiberKey) {
      return (element as unknown as Record<string, unknown>)[fiberKey] as ReactFiber ?? null;
    }

    return null;
  }

  /**
   * 判断元素是否可见
   */
  private isElementVisible(element: HTMLElement): boolean {
    // display: none
    if (element.style?.display === 'none') return false;
    // visibility: hidden / collapse
    if (element.style?.visibility === 'hidden' || element.style?.visibility === 'collapse') {
      return false;
    }
    // hidden 属性
    if (element.hasAttribute?.('hidden')) return false;
    // aria-hidden="true"
    if (element.getAttribute?.('aria-hidden') === 'true') return false;
    // opacity: 0 视为不可见
    if (element.style?.opacity === '0') return false;

    return true;
  }

  /**
   * 获取元素直接文本内容（不包含子元素文本）
   */
  private getDirectTextContent(element: HTMLElement): string {
    let text = '';
    const childNodes = element.childNodes;
    for (let i = 0; i < childNodes.length; i++) {
      const node = childNodes[i];
      if (node.nodeType === Node.TEXT_NODE && node.textContent) {
        text += node.textContent;
      }
    }
    return text.trim();
  }

  /**
   * 创建空占位节点
   */
  private createEmptyNode(id: string): UITreeNode {
    return {
      id,
      source: 'react-dom' as UINodeSource,
      type: UINodeType.Unknown,
      name: 'empty',
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      state: { visible: false },
      children: [],
    };
  }
}
