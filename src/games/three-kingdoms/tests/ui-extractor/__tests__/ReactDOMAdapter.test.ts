// ============================================================
// ReactDOMAdapter — 单元测试
// 环境：jsdom（需 mock getBoundingClientRect）
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReactDOMAdapter } from '../ReactDOMAdapter';
import { UINodeType } from '../types';
import type { UITreeNode, UITreeExtractorConfig } from '../types';

// ---------------------------------------------------------------------------
// 辅助：mock getBoundingClientRect
// ---------------------------------------------------------------------------

function mockBounds(el: HTMLElement, overrides: Partial<DOMRect> = {}) {
  el.getBoundingClientRect = vi.fn().mockReturnValue({
    x: 0, y: 0, width: 100, height: 50,
    top: 0, right: 100, bottom: 50, left: 0,
    toJSON: () => ({}),
    ...overrides,
  });
}

/** 快速创建带 mock 的 DOM 元素 */
function createElement(
  tag: string,
  options: {
    id?: string;
    className?: string;
    text?: string;
    attrs?: Record<string, string>;
    style?: Partial<CSSStyleDeclaration>;
    children?: HTMLElement[];
  } = {},
): HTMLElement {
  const el = document.createElement(tag);
  if (options.id) el.id = options.id;
  if (options.className) el.className = options.className;
  if (options.text) el.textContent = options.text;
  if (options.attrs) {
    for (const [k, v] of Object.entries(options.attrs)) {
      el.setAttribute(k, v);
    }
  }
  if (options.style) {
    for (const [k, v] of Object.entries(options.style)) {
      if (v !== undefined) (el.style as Record<string, string>)[k] = v;
    }
  }
  if (options.children) {
    for (const child of options.children) {
      el.appendChild(child);
    }
  }
  mockBounds(el);
  return el;
}

/** 注入 React Fiber mock */
function injectFiber(el: HTMLElement, fiberType: unknown) {
  const key = '__reactFiber$test123';
  Object.defineProperty(el, key, {
    value: {
      type: fiberType,
      elementType: fiberType,
      return: null,
      child: null,
      stateNode: el,
    },
    configurable: true,
    enumerable: true,
  });
}

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

describe('ReactDOMAdapter', () => {
  let adapter: ReactDOMAdapter;

  beforeEach(() => {
    adapter = new ReactDOMAdapter();
    document.body.innerHTML = '';
  });

  // ======================== 构造函数 ========================

  describe('constructor', () => {
    it('应使用默认配置', () => {
      const a = new ReactDOMAdapter();
      const root = createElement('div');
      // 默认 maxDepth=20, includeHidden=false
      // 无报错即可
      const tree = a.extractFromDOM(root);
      expect(tree).toBeDefined();
      expect(tree.source).toBe('react-dom');
    });

    it('应合并自定义配置', () => {
      const a = new ReactDOMAdapter({ maxDepth: 1 });
      const inner = createElement('span');
      const outer = createElement('div', { children: [inner] });
      mockBounds(outer);
      mockBounds(inner);

      const tree = a.extractFromDOM(outer);
      // maxDepth=1 → 不应遍历到 span 的子节点（但 outer 的直接子 span 应该在）
      expect(tree.children.length).toBe(1);
      expect(tree.children[0].children.length).toBe(0);
    });
  });

  // ======================== extractFromDOM ========================

  describe('extractFromDOM', () => {
    it('应从简单 DOM 提取（div > span > text）', () => {
      const span = createElement('span', { text: 'Hello' });
      const div = createElement('div', {
        id: 'root',
        children: [span],
      });
      mockBounds(div, { width: 200, height: 100 });
      mockBounds(span, { x: 10, y: 10, width: 50, height: 20 });

      const tree = adapter.extractFromDOM(div);

      expect(tree.name).toBe('div');
      expect(tree.bounds.width).toBe(200);
      expect(tree.bounds.height).toBe(100);
      expect(tree.children.length).toBe(1);
      expect(tree.children[0].name).toBe('span');
      expect(tree.children[0].bounds.x).toBe(10);
      expect(tree.children[0].state.text).toBe('Hello');
    });

    it('应从多层嵌套 DOM 提取', () => {
      const leaf = createElement('em', { text: 'deep' });
      const mid = createElement('p', { children: [leaf] });
      const top = createElement('section', { children: [mid] });
      mockBounds(top);
      mockBounds(mid);
      mockBounds(leaf);

      const tree = adapter.extractFromDOM(top);

      expect(tree.name).toBe('section');
      expect(tree.children.length).toBe(1);
      expect(tree.children[0].name).toBe('p');
      expect(tree.children[0].children.length).toBe(1);
      expect(tree.children[0].children[0].name).toBe('em');
      expect(tree.children[0].children[0].state.text).toBe('deep');
    });

    it('应处理空 DOM（null）', () => {
      const tree = adapter.extractFromDOM(null as unknown as HTMLElement);
      expect(tree.id).toBe('empty-root');
      expect(tree.type).toBe(UINodeType.Unknown);
      expect(tree.children.length).toBe(0);
    });

    it('应处理无子节点的空元素', () => {
      const div = createElement('div');
      const tree = adapter.extractFromDOM(div);
      expect(tree.children.length).toBe(0);
      expect(tree.name).toBe('div');
    });
  });

  // ======================== extractFromReactRoot ========================

  describe('extractFromReactRoot', () => {
    it('应与 extractFromDOM 行为一致', () => {
      const div = createElement('div', {
        id: 'react-root',
        children: [createElement('h1', { text: 'Title' })],
      });
      mockBounds(div);

      const tree = adapter.extractFromReactRoot(div);
      expect(tree.source).toBe('react-dom');
      expect(tree.children.length).toBe(1);
      expect(tree.children[0].name).toBe('h1');
    });
  });

  // ======================== React Fiber 组件名解析 ========================

  describe('getComponentName (via Fiber)', () => {
    it('应从函数组件 Fiber 获取组件名', () => {
      function MyButton() { return null; }
      const el = createElement('button');
      injectFiber(el, MyButton);

      const tree = adapter.extractFromDOM(el);
      expect(tree.name).toBe('MyButton');
      expect(tree.type).toBe(UINodeType.ReactComponent);
    });

    it('应从匿名函数 Fiber 获取 "Anonymous"', () => {
      const el = createElement('div');
      injectFiber(el, () => null);

      const tree = adapter.extractFromDOM(el);
      expect(tree.name).toBe('Anonymous');
    });

    it('应从 displayName 函数获取名称', () => {
      const Comp = () => null;
      Comp.displayName = 'CustomName';
      const el = createElement('div');
      injectFiber(el, Comp);

      const tree = adapter.extractFromDOM(el);
      expect(tree.name).toBe('CustomName');
    });

    it('无 Fiber 时回退到 tagName', () => {
      const el = createElement('div');
      const tree = adapter.extractFromDOM(el);
      expect(tree.name).toBe('div');
      expect(tree.type).toBe(UINodeType.HtmlElement);
    });

    it('有 aria-label 时作为名称', () => {
      const el = createElement('div', { attrs: { 'aria-label': 'Submit Button' } });
      // 不注入 Fiber → 走 aria-label 回退
      const tree = adapter.extractFromDOM(el);
      expect(tree.name).toBe('Submit Button');
    });
  });

  // ======================== 位置获取 ========================

  describe('getBounds', () => {
    it('应从 getBoundingClientRect 获取位置', () => {
      const el = createElement('div');
      mockBounds(el, { x: 50, y: 30, width: 200, height: 80 });

      const tree = adapter.extractFromDOM(el);
      expect(tree.bounds).toEqual({
        x: 50, y: 30, width: 200, height: 80,
      });
    });

    it('captureBounds=false 时返回零值', () => {
      const a = new ReactDOMAdapter({ captureBounds: false });
      const el = createElement('div');
      mockBounds(el, { x: 100, y: 200, width: 300, height: 400 });

      const tree = a.extractFromDOM(el);
      expect(tree.bounds).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    });
  });

  // ======================== 节点状态 ========================

  describe('getNodeState', () => {
    it('应采集 visible 状态', () => {
      const el = createElement('div');
      const tree = adapter.extractFromDOM(el);
      expect(tree.state.visible).toBe(true);
    });

    it('应检测 display:none 为不可见', () => {
      const el = createElement('div', { style: { display: 'none' } });
      const tree = adapter.extractFromDOM(el);
      expect(tree.state.visible).toBe(false);
    });

    it('应检测 visibility:hidden 为不可见', () => {
      const el = createElement('div', { style: { visibility: 'hidden' } });
      const tree = adapter.extractFromDOM(el);
      expect(tree.state.visible).toBe(false);
    });

    it('应采集 className', () => {
      const el = createElement('div', { className: 'btn primary' });
      const tree = adapter.extractFromDOM(el);
      expect(tree.state.className).toBe('btn primary');
    });

    it('应采集 style 属性', () => {
      const el = createElement('div', { style: { color: 'red', fontSize: '16px' } });
      const tree = adapter.extractFromDOM(el);
      expect(tree.state.style).toBeDefined();
      expect(tree.state.style!['color']).toBe('red');
    });

    it('应采集 enabled 状态（表单元素）', () => {
      const input = document.createElement('input') as HTMLInputElement;
      input.type = 'text';
      mockBounds(input);

      const tree = adapter.extractFromDOM(input);
      expect(tree.state.enabled).toBe(true);

      input.disabled = true;
      const tree2 = adapter.extractFromDOM(input);
      expect(tree2.state.enabled).toBe(false);
    });

    it('应采集 opacity 作为 alpha', () => {
      const el = createElement('div', { style: { opacity: '0.5' } });
      const tree = adapter.extractFromDOM(el);
      expect(tree.state.alpha).toBe(0.5);
    });

    it('应采集常用 attributes', () => {
      const el = createElement('div', {
        attrs: {
          id: 'my-el',
          role: 'button',
          'data-testid': 'submit-btn',
        },
      });
      const tree = adapter.extractFromDOM(el);
      expect(tree.state.attributes).toBeDefined();
      expect(tree.state.attributes!['id']).toBe('my-el');
      expect(tree.state.attributes!['role']).toBe('button');
      expect(tree.state.attributes!['data-testid']).toBe('submit-btn');
    });

    it('captureState=false 时返回最小状态', () => {
      const a = new ReactDOMAdapter({ captureState: false });
      const el = createElement('div', { className: 'test' });
      const tree = a.extractFromDOM(el);
      expect(tree.state.visible).toBe(true);
      expect(tree.state.className).toBeUndefined();
    });
  });

  // ======================== maxDepth ========================

  describe('maxDepth', () => {
    it('应在 maxDepth 限制处停止遍历', () => {
      const a = new ReactDOMAdapter({ maxDepth: 2 });
      // depth=0: outer, depth=1: mid, depth=2: inner (leaf)
      const inner = createElement('em');
      const mid = createElement('p', { children: [inner] });
      const outer = createElement('div', { children: [mid] });
      mockBounds(outer);
      mockBounds(mid);
      mockBounds(inner);

      const tree = a.extractFromDOM(outer);
      // depth 0 → div, depth 1 → p, depth 2 → em (should be leaf)
      expect(tree.name).toBe('div');
      expect(tree.children[0].name).toBe('p');
      expect(tree.children[0].children[0].name).toBe('em');
      // em 不应继续遍历子节点（但 em 本身被包含）
      expect(tree.children[0].children[0].children.length).toBe(0);
    });

    it('maxDepth=0 时根节点不应有子节点', () => {
      const a = new ReactDOMAdapter({ maxDepth: 0 });
      const child = createElement('span');
      const root = createElement('div', { children: [child] });
      mockBounds(root);
      mockBounds(child);

      const tree = a.extractFromDOM(root);
      expect(tree.children.length).toBe(0);
    });
  });

  // ======================== includeHidden ========================

  describe('includeHidden', () => {
    it('默认应过滤隐藏节点', () => {
      const hidden = createElement('div', { style: { display: 'none' } });
      const visible = createElement('div');
      const root = createElement('div', { children: [hidden, visible] });
      mockBounds(root);

      const tree = adapter.extractFromDOM(root);
      expect(tree.children.length).toBe(1);
      expect(tree.children[0].state.visible).toBe(true);
    });

    it('includeHidden=true 时保留隐藏节点', () => {
      const a = new ReactDOMAdapter({ includeHidden: true });
      const hidden = createElement('div', { style: { display: 'none' } });
      const visible = createElement('div');
      const root = createElement('div', { children: [hidden, visible] });
      mockBounds(root);

      const tree = a.extractFromDOM(root);
      expect(tree.children.length).toBe(2);
    });

    it('应过滤 hidden 属性的元素', () => {
      const el = createElement('div', { attrs: { hidden: '' } });
      const root = createElement('div', { children: [el] });
      mockBounds(root);

      const tree = adapter.extractFromDOM(root);
      expect(tree.children.length).toBe(0);
    });

    it('应过滤 aria-hidden=true 的元素', () => {
      const el = createElement('div', { attrs: { 'aria-hidden': 'true' } });
      const root = createElement('div', { children: [el] });
      mockBounds(root);

      const tree = adapter.extractFromDOM(root);
      expect(tree.children.length).toBe(0);
    });
  });

  // ======================== 自定义 filter ========================

  describe('custom filter', () => {
    it('应通过 filter 过滤节点', () => {
      const filter = vi.fn((node: UITreeNode) => node.name !== 'span');

      const a = new ReactDOMAdapter({ filter });
      const span = createElement('span', { text: 'skip' });
      const p = createElement('p', { text: 'keep' });
      const root = createElement('div', { children: [span, p] });
      mockBounds(root);
      mockBounds(span);
      mockBounds(p);

      const tree = a.extractFromDOM(root);
      // span 被过滤 → children 清空
      // p 保留
      const spanNodes = tree.children.filter(c => c.metadata?.tagName === 'span');
      const pNodes = tree.children.filter(c => c.metadata?.tagName === 'p');

      expect(spanNodes.length).toBe(1);
      expect(spanNodes[0].children.length).toBe(0); // filter strips children
      expect(pNodes.length).toBe(1);
    });
  });

  // ======================== query ========================

  describe('query', () => {
    let tree: UITreeNode;

    beforeEach(() => {
      const btn = createElement('button', { text: 'Click', className: 'primary' });
      const input = document.createElement('input') as HTMLInputElement;
      input.type = 'text';
      input.placeholder = 'Enter name';
      mockBounds(input);

      const span = createElement('span', { text: 'Label' });
      const root = createElement('div', { id: 'app', children: [btn, input, span] });
      mockBounds(root);

      tree = adapter.extractFromDOM(root);
    });

    it('应按 type 查询', () => {
      const results = adapter.query(tree, { type: UINodeType.HtmlElement });
      // 所有节点都是 HtmlElement（无 Fiber mock）
      expect(results.length).toBeGreaterThan(0);
    });

    it('应按 name 查询', () => {
      const results = adapter.query(tree, { name: 'button' });
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('button');
    });

    it('应按 namePattern 正则查询', () => {
      const results = adapter.query(tree, { namePattern: /^(button|span)$/ });
      expect(results.length).toBe(2);
    });

    it('应按 state 查询', () => {
      const results = adapter.query(tree, { state: { visible: true } });
      expect(results.length).toBeGreaterThan(0);
    });

    it('应按 customFilter 查询', () => {
      const results = adapter.query(tree, {
        customFilter: (node) => node.state.text === 'Click',
      });
      expect(results.length).toBe(1);
      expect(results[0].state.text).toBe('Click');
    });

    it('应按 source 查询', () => {
      const results = adapter.query(tree, { source: 'react-dom' });
      expect(results.length).toBeGreaterThan(0);
    });

    it('应按 bounds 查询', () => {
      const results = adapter.query(tree, { bounds: { width: 100 } });
      expect(results.length).toBeGreaterThan(0);
    });

    it('多条件组合应取交集', () => {
      const results = adapter.query(tree, {
        name: 'button',
        source: 'react-dom',
      });
      expect(results.length).toBe(1);
    });

    it('无匹配时返回空数组', () => {
      const results = adapter.query(tree, { name: 'nonexistent' });
      expect(results).toEqual([]);
    });
  });

  // ======================== 非可视元素过滤 ========================

  describe('非可视元素过滤', () => {
    it('应过滤 script 元素', () => {
      const script = document.createElement('script');
      script.textContent = 'console.log("test")';
      const root = createElement('div', { children: [script] });
      mockBounds(root);

      const tree = adapter.extractFromDOM(root);
      expect(tree.children.length).toBe(0);
    });

    it('应过滤 style 元素', () => {
      const style = document.createElement('style');
      style.textContent = '.x { color: red; }';
      const root = createElement('div', { children: [style] });
      mockBounds(root);

      const tree = adapter.extractFromDOM(root);
      expect(tree.children.length).toBe(0);
    });

    it('应过滤 link 元素', () => {
      const link = document.createElement('link');
      const root = createElement('div', { children: [link] });
      mockBounds(root);

      const tree = adapter.extractFromDOM(root);
      expect(tree.children.length).toBe(0);
    });

    it('应保留常规元素', () => {
      const span = createElement('span');
      const root = createElement('div', { children: [span] });
      mockBounds(root);

      const tree = adapter.extractFromDOM(root);
      expect(tree.children.length).toBe(1);
    });
  });

  // ======================== 节点 ID 生成 ========================

  describe('generateNodeId', () => {
    it('相同元素相同路径应生成相同 ID', () => {
      const el = createElement('div', { id: 'test' });
      const tree1 = adapter.extractFromDOM(el);
      const tree2 = adapter.extractFromDOM(el);
      expect(tree1.id).toBe(tree2.id);
    });

    it('不同元素应生成不同 ID', () => {
      const el1 = createElement('div', { id: 'a' });
      const el2 = createElement('div', { id: 'b' });
      const tree1 = adapter.extractFromDOM(el1);
      const tree2 = adapter.extractFromDOM(el2);
      expect(tree1.id).not.toBe(tree2.id);
    });
  });

  // ======================== metadata ========================

  describe('metadata', () => {
    it('应包含 path 和 tagName', () => {
      const child = createElement('span');
      const root = createElement('div', { children: [child] });
      mockBounds(root);
      mockBounds(child);

      const tree = adapter.extractFromDOM(root);
      expect(tree.metadata?.path).toBe('0');
      expect(tree.metadata?.tagName).toBe('div');
      expect(tree.children[0].metadata?.path).toBe('0.0');
      expect(tree.children[0].metadata?.tagName).toBe('span');
    });

    it('_raw 应引用原始 DOM 元素', () => {
      const el = createElement('div');
      const tree = adapter.extractFromDOM(el);
      expect(tree._raw).toBe(el);
    });
  });
});
