// ============================================================
// PixiJSAdapter — 单元测试（mock 对象，不依赖真实 PixiJS）
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PixiJSAdapter } from '../PixiJSAdapter';
import type { PixiDisplayObjectLike, PixiContainerLike } from '../PixiJSAdapter';
import { UINodeType } from '../types';
import type { UITreeNode } from '../types';

// ---------------------------------------------------------------------------
// Mock 工厂 — 所有 mock 共享基础属性，按需覆盖
// ---------------------------------------------------------------------------

const BASE = { visible: true, alpha: 1, x: 0, y: 0, zIndex: 0, renderable: true, name: null, label: null };

function createMockContainer(overrides?: Partial<PixiContainerLike>): PixiContainerLike {
  return { children: [], width: 100, height: 100, ...BASE, ...overrides } as PixiContainerLike;
}

function createMockSprite(overrides?: Partial<PixiDisplayObjectLike>): PixiDisplayObjectLike {
  return { width: 50, height: 50, ...BASE, isSprite: true, ...overrides } as PixiDisplayObjectLike;
}

function createMockText(text: string, overrides?: Partial<PixiDisplayObjectLike>): PixiDisplayObjectLike {
  return { width: 80, height: 20, ...BASE, text, ...overrides } as PixiDisplayObjectLike;
}

function createMockGraphics(overrides?: Partial<PixiDisplayObjectLike>): PixiDisplayObjectLike {
  return { width: 60, height: 40, ...BASE, ...overrides } as PixiDisplayObjectLike;
}

function flattenTree(node: UITreeNode): UITreeNode[] {
  return [node, ...node.children.flatMap(flattenTree)];
}

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

describe('PixiJSAdapter', () => {
  let adapter: PixiJSAdapter;
  beforeEach(() => { adapter = new PixiJSAdapter(); });

  // ---- 构造函数 ----

  describe('constructor', () => {
    it('默认配置', () => {
      const tree = adapter.extractFromContainer(createMockContainer());
      expect(tree.source).toBe('pixijs');
    });
    it('合并自定义配置', () => {
      const a = new PixiJSAdapter({ maxDepth: 1 });
      const tree = a.extractFromContainer(
        createMockContainer({ children: [createMockContainer({ children: [createMockSprite()] })] }),
      );
      expect(tree.children[0].children.length).toBe(0);
    });
  });

  // ---- extractFromContainer ----

  describe('extractFromContainer', () => {
    it('简单 Container（1层 children）', () => {
      const tree = adapter.extractFromContainer(
        createMockContainer({ label: 'root', width: 200, height: 150,
          children: [createMockSprite({ x: 10, y: 20 }), createMockText('Hi', { x: 10, y: 80 })] }),
      );
      expect(tree.name).toBe('root');
      expect(tree.bounds).toEqual({ x: 0, y: 0, width: 200, height: 150 });
      expect(tree.children.length).toBe(2);
      expect(tree.children[0].type).toBe(UINodeType.PixiSprite);
      expect(tree.children[1].type).toBe(UINodeType.PixiText);
    });

    it('嵌套 Container（3层深度）', () => {
      const deco = createMockGraphics({ label: 'deco' });
      const panel = createMockContainer({ label: 'panel', children: [deco] });
      const tree = adapter.extractFromContainer(
        createMockContainer({ label: 'stage', children: [panel] }),
      );
      expect(tree.name).toBe('stage');
      expect(tree.children[0].name).toBe('panel');
      expect(tree.children[0].children[0].name).toBe('deco');
    });

    it('空 Container', () => {
      const tree = adapter.extractFromContainer(createMockContainer({ label: 'empty' }));
      expect(tree.children.length).toBe(0);
      expect(tree.type).toBe(UINodeType.PixiGraphics);
    });

    it('null 输入', () => {
      const tree = adapter.extractFromContainer(null as unknown as PixiContainerLike);
      expect(tree.id).toBe('empty-root');
      expect(tree.type).toBe(UINodeType.Unknown);
    });
  });

  // ---- 类型识别 ----

  describe('resolvePixiType', () => {
    it('children.length > 0 → PixiContainer', () => {
      const tree = adapter.extractFromContainer(createMockContainer({ children: [createMockSprite()] }));
      expect(tree.type).toBe(UINodeType.PixiContainer);
    });
    it('isSprite=true → PixiSprite', () => {
      const tree = adapter.extractFromContainer(createMockContainer({ children: [createMockSprite()] }));
      expect(tree.children[0].type).toBe(UINodeType.PixiSprite);
    });
    it('有 text → PixiText', () => {
      const tree = adapter.extractFromContainer(createMockContainer({ children: [createMockText('Hi')] }));
      expect(tree.children[0].type).toBe(UINodeType.PixiText);
    });
    it('有 _text → PixiText', () => {
      const obj: PixiDisplayObjectLike = { visible: true, alpha: 1, x: 0, y: 0, width: 100, height: 20, _text: 'fb' };
      const tree = adapter.extractFromContainer(createMockContainer({ children: [obj] }));
      expect(tree.children[0].type).toBe(UINodeType.PixiText);
    });
    it('其他 → PixiGraphics', () => {
      const tree = adapter.extractFromContainer(createMockContainer({ children: [createMockGraphics()] }));
      expect(tree.children[0].type).toBe(UINodeType.PixiGraphics);
    });
    it('空 Container → PixiGraphics', () => {
      expect(adapter.extractFromContainer(createMockContainer()).type).toBe(UINodeType.PixiGraphics);
    });
  });

  // ---- 位置获取 ----

  describe('getPixiBounds', () => {
    it('优先使用 getBounds()', () => {
      const tree = adapter.extractFromContainer(createMockContainer({ children: [
        createMockSprite({ x: 5, y: 5, getBounds: () => ({ x: 10, y: 20, width: 100, height: 80 }) }),
      ] }));
      expect(tree.children[0].bounds).toEqual({ x: 10, y: 20, width: 100, height: 80 });
    });

    it('无 getBounds 回退 x/y/width/height', () => {
      const tree = adapter.extractFromContainer(createMockContainer({ children: [
        createMockSprite({ x: 15, y: 25, width: 60, height: 40 }),
      ] }));
      expect(tree.children[0].bounds).toEqual({ x: 15, y: 25, width: 60, height: 40 });
    });

    it('getBounds 抛异常时回退', () => {
      const tree = adapter.extractFromContainer(createMockContainer({ children: [
        createMockSprite({ x: 30, y: 40, width: 70, height: 50, getBounds: () => { throw new Error('e'); } }),
      ] }));
      expect(tree.children[0].bounds).toEqual({ x: 30, y: 40, width: 70, height: 50 });
    });

    it('captureBounds=false → 零值', () => {
      const a = new PixiJSAdapter({ captureBounds: false });
      const tree = a.extractFromContainer(createMockContainer({ x: 100, y: 200, width: 300, height: 400 }));
      expect(tree.bounds).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    });
  });

  // ---- 节点状态 ----

  describe('getPixiState', () => {
    it('visible', () => {
      expect(adapter.extractFromContainer(createMockContainer()).state.visible).toBe(true);
    });
    it('alpha（非默认值）', () => {
      const tree = adapter.extractFromContainer(createMockContainer({ children: [createMockSprite({ alpha: 0.5 })] }));
      expect(tree.children[0].state.alpha).toBe(0.5);
    });
    it('alpha=1 不写入', () => {
      expect(adapter.extractFromContainer(createMockContainer()).state.alpha).toBeUndefined();
    });
    it('renderable → enabled', () => {
      const a = new PixiJSAdapter({ includeHidden: true });
      const tree = a.extractFromContainer(createMockContainer({ children: [createMockSprite({ renderable: false })] }));
      expect(tree.children[0].state.enabled).toBe(false);
    });
    it('text 内容', () => {
      const tree = adapter.extractFromContainer(createMockContainer({ children: [createMockText('Hello')] }));
      expect(tree.children[0].state.text).toBe('Hello');
    });
    it('_text 内容', () => {
      const obj: PixiDisplayObjectLike = { visible: true, alpha: 1, x: 0, y: 0, width: 100, height: 20, _text: 'fb' };
      const tree = adapter.extractFromContainer(createMockContainer({ children: [obj] }));
      expect(tree.children[0].state.text).toBe('fb');
    });
    it('zIndex', () => {
      const tree = adapter.extractFromContainer(createMockContainer({ children: [createMockSprite({ zIndex: 5 })] }));
      expect(tree.children[0].state.zIndex).toBe(5);
    });
    it('captureState=false → 最小状态', () => {
      const a = new PixiJSAdapter({ captureState: false });
      const tree = a.extractFromContainer(createMockContainer({ children: [createMockText('x')] }));
      expect(tree.state.visible).toBe(true);
      expect(tree.state.text).toBeUndefined();
    });
  });

  // ---- maxDepth ----

  describe('maxDepth', () => {
    it('限制处停止遍历', () => {
      const a = new PixiJSAdapter({ maxDepth: 2 });
      const tree = a.extractFromContainer(
        createMockContainer({ label: 'outer', children: [
          createMockContainer({ label: 'mid', children: [createMockGraphics({ label: 'inner' })] }),
        ] }),
      );
      expect(tree.children[0].children[0].name).toBe('inner');
      expect(tree.children[0].children[0].children.length).toBe(0);
    });
    it('maxDepth=0 → 无子节点', () => {
      const a = new PixiJSAdapter({ maxDepth: 0 });
      expect(a.extractFromContainer(createMockContainer({ children: [createMockSprite()] })).children.length).toBe(0);
    });
  });

  // ---- includeHidden ----

  describe('includeHidden', () => {
    it('过滤 visible=false', () => {
      const tree = adapter.extractFromContainer(
        createMockContainer({ children: [createMockSprite({ visible: false }), createMockSprite()] }),
      );
      expect(tree.children.length).toBe(1);
    });
    it('过滤 alpha=0', () => {
      const tree = adapter.extractFromContainer(
        createMockContainer({ children: [createMockSprite({ alpha: 0 }), createMockSprite()] }),
      );
      expect(tree.children.length).toBe(1);
    });
    it('过滤 renderable=false', () => {
      const tree = adapter.extractFromContainer(
        createMockContainer({ children: [createMockSprite({ renderable: false }), createMockSprite()] }),
      );
      expect(tree.children.length).toBe(1);
    });
    it('includeHidden=true 保留全部', () => {
      const a = new PixiJSAdapter({ includeHidden: true });
      const tree = a.extractFromContainer(
        createMockContainer({ children: [
          createMockSprite({ visible: false }), createMockSprite({ alpha: 0 }), createMockSprite(),
        ] }),
      );
      expect(tree.children.length).toBe(3);
    });
  });

  // ---- 自定义 filter ----

  describe('custom filter', () => {
    it('filter 过滤节点时清空 children', () => {
      const filter = vi.fn((n: UITreeNode) => n.type !== UINodeType.PixiSprite);
      const a = new PixiJSAdapter({ filter });
      const tree = a.extractFromContainer(
        createMockContainer({ children: [createMockSprite({ label: 'skip' }), createMockText('keep')] }),
      );
      const sprites = tree.children.filter(c => c.type === UINodeType.PixiSprite);
      expect(sprites[0].children.length).toBe(0);
      expect(tree.children.filter(c => c.type === UINodeType.PixiText).length).toBe(1);
    });
  });

  // ---- query ----

  describe('query', () => {
    let tree: UITreeNode;
    beforeEach(() => {
      tree = adapter.extractFromContainer(
        createMockContainer({ label: 'game', children: [
          createMockSprite({ label: 'hero' }),
          createMockText('Score: 100', { label: 'score' }),
          createMockGraphics({ label: 'bg' }),
        ] }),
      );
    });

    it('按 type', () => {
      const r = adapter.query(tree, { type: UINodeType.PixiSprite });
      expect(r.length).toBe(1);
      expect(r[0].name).toBe('hero');
    });
    it('按 name', () => {
      expect(adapter.query(tree, { name: 'score' }).length).toBe(1);
    });
    it('按 namePattern 正则', () => {
      expect(adapter.query(tree, { namePattern: /^(hero|bg)$/ }).length).toBe(2);
    });
    it('按 source', () => {
      expect(adapter.query(tree, { source: 'pixijs' }).length).toBe(4);
    });
    it('按 state', () => {
      expect(adapter.query(tree, { state: { visible: true } }).length).toBe(4);
    });
    it('按 customFilter', () => {
      const r = adapter.query(tree, { customFilter: n => n.state.text === 'Score: 100' });
      expect(r.length).toBe(1);
      expect(r[0].name).toBe('score');
    });
    it('多条件取交集', () => {
      const r = adapter.query(tree, { type: UINodeType.PixiText, source: 'pixijs' });
      expect(r.length).toBe(1);
    });
    it('无匹配 → []', () => {
      expect(adapter.query(tree, { name: 'none' })).toEqual([]);
    });
    it('按 bounds', () => {
      expect(adapter.query(tree, { bounds: { width: 100 } }).length).toBeGreaterThan(0);
    });
  });

  // ---- name / label 语义 ----

  describe('name / label 语义', () => {
    it('优先 label', () => {
      expect(adapter.extractFromContainer(createMockContainer({ label: 'lbl', name: 'nm' })).name).toBe('lbl');
    });
    it('label 空回退 name', () => {
      expect(adapter.extractFromContainer(createMockContainer({ label: null, name: 'nm' })).name).toBe('nm');
    });
    it('都空 → 类型回退', () => {
      const tree = adapter.extractFromContainer(createMockContainer({ children: [createMockSprite()] }));
      expect(tree.children[0].name).toBe('Sprite');
    });
    it('空字符串 label 视为无值', () => {
      expect(adapter.extractFromContainer(createMockContainer({ label: '', name: 'fb' })).name).toBe('fb');
    });
  });

  // ---- metadata ----

  describe('metadata', () => {
    it('path 和 pixiType', () => {
      const tree = adapter.extractFromContainer(
        createMockContainer({ label: 'root', children: [createMockSprite({ label: 'child' })] }),
      );
      expect(tree.metadata?.path).toBe('0');
      expect(tree.metadata?.pixiType).toBe(UINodeType.PixiContainer);
      expect(tree.children[0].metadata?.path).toBe('0.0');
    });
    it('_raw 引用原始对象', () => {
      const c = createMockContainer({ label: 'raw' });
      expect(adapter.extractFromContainer(c)._raw).toBe(c);
    });
  });

  // ---- 节点 ID ----

  describe('generateId', () => {
    it('相同对象 → 相同 ID', () => {
      const c = createMockContainer({ label: 's' });
      expect(adapter.extractFromContainer(c).id).toBe(adapter.extractFromContainer(c).id);
    });
    it('不同对象 → 不同 ID', () => {
      expect(adapter.extractFromContainer(createMockContainer({ label: 'a' })).id)
        .not.toBe(adapter.extractFromContainer(createMockContainer({ label: 'b' })).id);
    });
    it('pixi- 前缀', () => {
      expect(adapter.extractFromContainer(createMockContainer({ label: 't' })).id).toMatch(/^pixi-/);
    });
  });

  // ---- 统计信息正确性 ----

  describe('统计信息正确性', () => {
    it('完整树结构', () => {
      const tree = adapter.extractFromContainer(
        createMockContainer({ label: 'stage', children: [
          createMockContainer({ label: 'panel', children: [
            createMockText('HP', { label: 'hp' }),
            createMockSprite({ label: 'avatar' }),
            createMockGraphics({ label: 'border' }),
          ] }),
        ] }),
      );
      const all = flattenTree(tree);
      expect(all.length).toBe(5);
      expect(all.every(n => n.source === 'pixijs')).toBe(true);
      expect(all.filter(n => n.type === UINodeType.PixiText).length).toBe(1);
      expect(all.filter(n => n.type === UINodeType.PixiSprite).length).toBe(1);
      expect(all.filter(n => n.type === UINodeType.PixiGraphics).length).toBe(1);
    });

    it('深度嵌套（5层）', () => {
      let cur: PixiDisplayObjectLike = createMockGraphics({ label: 'leaf' });
      for (let i = 4; i >= 0; i--) cur = createMockContainer({ label: `l${i}`, children: [cur] });
      let node = adapter.extractFromContainer(cur as PixiContainerLike);
      for (let i = 0; i < 5; i++) { expect(node.name).toBe(`l${i}`); node = node.children[0]; }
      expect(node.name).toBe('leaf');
    });
  });
});
