import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReactDOMAdapter } from '../ReactDOMAdapter';
import { UINodeType } from '../types';
import type { UITreeNode, UITreeExtractorConfig } from '../types';


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
