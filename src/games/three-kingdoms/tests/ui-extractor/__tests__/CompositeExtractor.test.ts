// ============================================================
// CompositeExtractor 测试
// 覆盖：构造函数 / extractDOM / extractPixi / extract 合并
//       snapshot 创建 / query 查询 / computeStats / 空树处理
// ============================================================

import { describe, it, expect } from 'vitest';
import { CompositeExtractor } from '../CompositeExtractor';
import { UINodeType } from '../types';
import type { PixiContainerLike } from '../PixiJSAdapter';

// ---------------------------------------------------------------------------
// 辅助：创建 mock HTMLElement
// ---------------------------------------------------------------------------

function createMockElement(overrides: Partial<HTMLElement> = {}): HTMLElement {
  const children: HTMLElement[] = [];
  const style = {
    length: 0,
    display: '',
    visibility: '',
    opacity: '',
    zIndex: '',
    getPropertyValue: () => '',
  };

  const el = {
    tagName: 'DIV',
    nodeName: 'DIV',
    nodeType: 1,
    childNodes: [] as HTMLElement[],
    children: [] as HTMLElement[],
    style,
    className: '',
    id: '',
    getAttribute: () => null,
    hasAttribute: () => false,
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 100, height: 50 }),
    appendChild(child: HTMLElement) {
      children.push(child);
      el.childNodes = children;
      el.children = children as unknown as HTMLCollection;
    },
    ...overrides,
  } as unknown as HTMLElement;

  return el;
}

// ---------------------------------------------------------------------------
// 辅助：创建 mock PixiJS Container
// ---------------------------------------------------------------------------

function createMockPixiContainer(
  overrides: Record<string, unknown> = {},
): PixiContainerLike {
  return {
    children: [],
    visible: true,
    alpha: 1,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    name: 'Container',
    label: null,
    renderable: true,
    ...overrides,
  } as PixiContainerLike;
}

function createMockPixiChild(
  overrides: Record<string, unknown> = {},
): PixiContainerLike {
  return createMockPixiContainer({
    name: 'Child',
    label: 'Child',
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// 辅助：构建简单 DOM 树
// ---------------------------------------------------------------------------

function buildSimpleDOMTree(): HTMLElement {
  const root = createMockElement({ tagName: 'DIV', id: 'app' });
  const child1 = createMockElement({ tagName: 'SPAN', id: 'title' });
  const child2 = createMockElement({ tagName: 'BUTTON', id: 'btn' });
  root.appendChild(child1);
  root.appendChild(child2);
  return root;
}

// ---------------------------------------------------------------------------
// 辅助：构建简单 PixiJS 树
// ---------------------------------------------------------------------------

function buildSimplePixiTree(): PixiContainerLike {
  const child1 = createMockPixiChild({ label: 'Sprite1', isSprite: true, x: 10, y: 10 });
  const child2 = createMockPixiChild({ label: 'Text1', text: 'Hello', x: 20, y: 20 });
  const root = createMockPixiContainer({
    label: 'Stage',
    children: [child1, child2],
  });
  return root;
}

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

describe('CompositeExtractor', () => {
  // ---- 构造函数 ----
  describe('constructor', () => {
    it('should create with default config', () => {
      const extractor = new CompositeExtractor();
      expect(extractor).toBeDefined();
    });

    it('should accept partial config overrides', () => {
      const extractor = new CompositeExtractor({ maxDepth: 5, includeHidden: true });
      expect(extractor).toBeDefined();
    });
  });

  // ---- extractDOM ----
  describe('extractDOM', () => {
    it('should extract a tree from a DOM element', () => {
      const extractor = new CompositeExtractor();
      const dom = buildSimpleDOMTree();
      const tree = extractor.extractDOM(dom);

      expect(tree).toBeDefined();
      expect(tree.source).toBe('react-dom');
      expect(tree.children.length).toBeGreaterThan(0);
    });

    it('should handle null/undefined root gracefully', () => {
      const extractor = new CompositeExtractor();
      const tree = extractor.extractDOM(null as unknown as HTMLElement);

      expect(tree).toBeDefined();
      expect(tree.name).toBe('empty');
      expect(tree.children).toEqual([]);
    });

    it('should respect maxDepth config', () => {
      const extractor = new CompositeExtractor({ maxDepth: 1 });
      const root = createMockElement({ tagName: 'DIV' });
      const child = createMockElement({ tagName: 'SPAN' });
      const grandChild = createMockElement({ tagName: 'P' });

      child.appendChild(grandChild);
      root.appendChild(child);

      const tree = extractor.extractDOM(root);
      // maxDepth=1 → root 的子节点不应有子节点
      if (tree.children.length > 0) {
        expect(tree.children[0].children).toEqual([]);
      }
    });
  });

  // ---- extractPixi ----
  describe('extractPixi', () => {
    it('should extract a tree from a PixiJS container', () => {
      const extractor = new CompositeExtractor();
      const pixiRoot = buildSimplePixiTree();
      const tree = extractor.extractPixi(pixiRoot);

      expect(tree).toBeDefined();
      expect(tree.source).toBe('pixijs');
      expect(tree.children.length).toBe(2);
    });

    it('should handle null/undefined root gracefully', () => {
      const extractor = new CompositeExtractor();
      const tree = extractor.extractPixi(null as unknown as PixiContainerLike);

      expect(tree).toBeDefined();
      expect(tree.name).toBe('empty');
      expect(tree.children).toEqual([]);
    });

    it('should correctly identify sprite and text types', () => {
      const extractor = new CompositeExtractor();
      const pixiRoot = buildSimplePixiTree();
      const tree = extractor.extractPixi(pixiRoot);

      expect(tree.children[0].type).toBe(UINodeType.PixiSprite);
      expect(tree.children[1].type).toBe(UINodeType.PixiText);
    });
  });

  // ---- extract (合并) ----
  describe('extract', () => {
    it('should merge DOM and PixiJS trees under a composite root', () => {
      const extractor = new CompositeExtractor();
      const dom = buildSimpleDOMTree();
      const pixi = buildSimplePixiTree();

      const merged = extractor.extract(dom, pixi);

      expect(merged.id).toBe('composite-root');
      expect(merged.name).toBe('CompositeRoot');
      expect(merged.children).toHaveLength(2);

      // 第一个分支是 React DOM
      expect(merged.children[0].source).toBe('react-dom');
      // 第二个分支是 PixiJS
      expect(merged.children[1].source).toBe('pixijs');
    });

    it('should set composite metadata', () => {
      const extractor = new CompositeExtractor();
      const dom = buildSimpleDOMTree();
      const pixi = buildSimplePixiTree();

      const merged = extractor.extract(dom, pixi);

      expect(merged.metadata?.composite).toBe(true);
      expect(merged.metadata?.sources).toEqual(['react-dom', 'pixijs']);
    });
  });

  // ---- snapshot ----
  describe('snapshot', () => {
    it('should create a snapshot with id, timestamp, and stats', () => {
      const extractor = new CompositeExtractor();
      const dom = buildSimpleDOMTree();
      const pixi = buildSimplePixiTree();
      const merged = extractor.extract(dom, pixi);

      const snap = extractor.snapshot(merged);

      expect(snap.id).toMatch(/^snap-/);
      expect(snap.timestamp).toBeGreaterThan(0);
      expect(snap.root).toBe(merged);
      expect(snap.stats).toBeDefined();
    });

    it('should compute accurate stats', () => {
      const extractor = new CompositeExtractor();
      const pixi = buildSimplePixiTree();
      const tree = extractor.extractPixi(pixi);
      const snap = extractor.snapshot(tree);

      // pixi root + 2 children = 3
      expect(snap.stats.totalNodes).toBe(3);
      expect(snap.stats.pixiNodes).toBe(3);
      expect(snap.stats.reactNodes).toBe(0);
      expect(snap.stats.maxDepth).toBe(1);
    });

    it('should compute stats for composite tree', () => {
      const extractor = new CompositeExtractor();
      const dom = buildSimpleDOMTree();
      const pixi = buildSimplePixiTree();
      const merged = extractor.extract(dom, pixi);
      const snap = extractor.snapshot(merged);

      // composite-root + DOM children + PixiJS children
      expect(snap.stats.totalNodes).toBeGreaterThan(2);
      expect(snap.stats.reactNodes).toBeGreaterThan(0);
      expect(snap.stats.pixiNodes).toBeGreaterThan(0);
    });
  });

  // ---- query ----
  describe('query', () => {
    it('should find nodes by source', () => {
      const extractor = new CompositeExtractor();
      const dom = buildSimpleDOMTree();
      const pixi = buildSimplePixiTree();
      const merged = extractor.extract(dom, pixi);

      const pixiNodes = extractor.query(merged, { source: 'pixijs' });
      expect(pixiNodes.length).toBeGreaterThan(0);
      pixiNodes.forEach(n => expect(n.source).toBe('pixijs'));
    });

    it('should find nodes by name pattern', () => {
      const extractor = new CompositeExtractor();
      const pixi = buildSimplePixiTree();
      const tree = extractor.extractPixi(pixi);

      const results = extractor.query(tree, { namePattern: /Sprite/ });
      expect(results.length).toBeGreaterThan(0);
      results.forEach(n => expect(n.name).toContain('Sprite'));
    });

    it('should find nodes by type', () => {
      const extractor = new CompositeExtractor();
      const pixi = buildSimplePixiTree();
      const tree = extractor.extractPixi(pixi);

      const texts = extractor.query(tree, { type: UINodeType.PixiText });
      expect(texts.length).toBe(1);
      expect(texts[0].type).toBe(UINodeType.PixiText);
    });

    it('should support custom filter', () => {
      const extractor = new CompositeExtractor();
      const pixi = buildSimplePixiTree();
      const tree = extractor.extractPixi(pixi);

      const results = extractor.query(tree, {
        customFilter: (node) => node.bounds.x > 0,
      });
      expect(results.length).toBeGreaterThan(0);
      results.forEach(n => expect(n.bounds.x).toBeGreaterThan(0));
    });

    it('should return empty array when no match', () => {
      const extractor = new CompositeExtractor();
      const pixi = buildSimplePixiTree();
      const tree = extractor.extractPixi(pixi);

      const results = extractor.query(tree, { name: 'NonExistent' });
      expect(results).toEqual([]);
    });
  });

  // ---- 空树处理 ----
  describe('empty tree handling', () => {
    it('should handle empty DOM tree', () => {
      const extractor = new CompositeExtractor();
      const emptyRoot = createMockElement({ tagName: 'DIV' });
      const tree = extractor.extractDOM(emptyRoot);

      expect(tree).toBeDefined();
      expect(tree.children).toEqual([]);
    });

    it('should handle empty PixiJS tree', () => {
      const extractor = new CompositeExtractor();
      const emptyContainer = createMockPixiContainer();
      const tree = extractor.extractPixi(emptyContainer);

      expect(tree).toBeDefined();
      expect(tree.children).toEqual([]);
    });

    it('should compute zero stats for minimal tree', () => {
      const extractor = new CompositeExtractor();
      const emptyContainer = createMockPixiContainer();
      const tree = extractor.extractPixi(emptyContainer);
      const snap = extractor.snapshot(tree);

      expect(snap.stats.totalNodes).toBe(1);
      expect(snap.stats.maxDepth).toBe(0);
    });
  });
});
