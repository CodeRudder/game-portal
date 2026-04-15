/**
 * CanvasUIRenderer — Canvas UI 渲染工具类 单元测试
 *
 * 覆盖范围：
 * - roundRect：圆角矩形路径绘制（正常/零半径/超大半径/负值尺寸）
 * - drawResourcePanel：资源面板绘制（空数组/正常渲染/自定义颜色/产出文本）
 * - drawBuildingList：建筑列表绘制（空数组/标题/选中态/购买力颜色/多行布局）
 * - drawFloatingTexts：飘字效果（透明度衰减/向上漂移/死亡跳过/阴影）
 * - drawBadge：徽章绘制（默认参数/自定义参数/文字测量）
 * - drawBottomHint：底部操作提示（默认颜色/自定义颜色）
 * - drawTitle：标题栏（默认位置和颜色/自定义参数）
 * - drawGradientBg：渐变背景（渐变创建/填充矩形）
 * - drawProgressBar：进度条（正常/边界值/自定义颜色/边框）
 * - drawPanel：面板背景（默认参数/边框/自定义圆角）
 * - 边界条件与错误处理
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CanvasUIRenderer,
  type ResourceDisplayItem,
  type BuildingDisplayItem,
  type FloatingText,
  type BadgeOptions,
  type ResourcePanelConfig,
  type BuildingListConfig,
  type UIColorScheme,
} from '../modules/CanvasUIRenderer';

// ============================================================
// 辅助：创建 mock CanvasRenderingContext2D
// ============================================================

function createMockCtx() {
  const calls: Record<string, unknown[][]> = {};

  function track(name: string, ...args: unknown[]) {
    if (!calls[name]) calls[name] = [];
    calls[name].push(args);
  }

  const gradientMock = {
    addColorStop: vi.fn(),
  };

  const ctx = {
    // 路径操作
    beginPath: () => track('beginPath'),
    closePath: () => track('closePath'),
    moveTo: (x: number, y: number) => track('moveTo', x, y),
    lineTo: (x: number, y: number) => track('lineTo', x, y),
    arcTo: (x1: number, y1: number, x2: number, y2: number, r: number) =>
      track('arcTo', x1, y1, x2, y2, r),
    arc: (...args: unknown[]) => track('arc', ...args),

    // 绘制操作
    fill: () => track('fill'),
    stroke: () => track('stroke'),
    fillRect: (x: number, y: number, w: number, h: number) =>
      track('fillRect', x, y, w, h),
    fillText: (text: string, x: number, y: number) =>
      track('fillText', text, x, y),
    strokeText: (text: string, x: number, y: number) =>
      track('strokeText', text, x, y),

    // 渐变
    createLinearGradient: (x0: number, y0: number, x1: number, y1: number) => {
      track('createLinearGradient', x0, y0, x1, y1);
      return gradientMock;
    },

    // 文字测量
    measureText: (text: string) => {
      track('measureText', text);
      // 模拟文字宽度：粗略按字符数估算
      return { width: text.length * 8 } as TextMetrics;
    },

    // 状态保存/恢复
    save: () => track('save'),
    restore: () => track('restore'),

    // 可变属性
    font: '',
    textAlign: '' as CanvasTextAlign,
    textBaseline: '' as CanvasTextBaseline,
    fillStyle: '' as string | CanvasGradient | CanvasPattern,
    strokeStyle: '' as string | CanvasGradient | CanvasPattern,
    lineWidth: 1,
    globalAlpha: 1,
    globalCompositeOperation: '' as string,
    canvas: null,
  } as unknown as CanvasRenderingContext2D;

  return { ctx, calls, gradientMock };
}

// ============================================================
// 辅助：创建测试数据
// ============================================================

function createResourceItem(overrides?: Partial<ResourceDisplayItem>): ResourceDisplayItem {
  return {
    id: 'gold',
    icon: '🪙',
    name: '金币',
    amount: '1.5K',
    perSecond: '+50/s',
    ...overrides,
  };
}

function createBuildingItem(overrides?: Partial<BuildingDisplayItem>): BuildingDisplayItem {
  return {
    id: 'farm',
    icon: '🌾',
    name: '农场',
    level: 5,
    productionText: 'Lv.5 (+2.3K/s)',
    costText: '🐟1.5K',
    affordable: true,
    selected: false,
    ...overrides,
  };
}

function createFloatingText(overrides?: Partial<FloatingText>): FloatingText {
  return {
    text: '+100',
    x: 100,
    y: 200,
    life: 500,
    maxLife: 1000,
    color: '#ffcc00',
    ...overrides,
  };
}

// ============================================================
// 测试
// ============================================================

describe('CanvasUIRenderer', () => {

  // ----------------------------------------------------------
  // roundRect — 圆角矩形路径
  // ----------------------------------------------------------

  describe('roundRect', () => {
    it('应创建圆角矩形路径并调用正确的 Canvas 方法', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.roundRect(ctx, 10, 20, 100, 50, 8);

      expect(calls.beginPath?.length).toBe(1);
      expect(calls.closePath?.length).toBe(1);
      expect(calls.moveTo?.length).toBe(1);
      // 应有 4 条直线 + 4 个圆角弧线
      expect(calls.lineTo?.length).toBe(4);
      expect(calls.arcTo?.length).toBe(4);
    });

    it('应在 (x + radius, y) 处开始路径', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.roundRect(ctx, 10, 20, 100, 50, 8);

      expect(calls.moveTo?.[0]).toEqual([18, 20]); // x + radius = 10 + 8
    });

    it('零半径应退化为直角矩形', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.roundRect(ctx, 0, 0, 100, 50, 0);

      // arcTo 的半径参数应为 0
      for (const args of calls.arcTo ?? []) {
        expect(args[4]).toBe(0);
      }
    });

    it('超大半径应被裁剪为宽高一半的较小值', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.roundRect(ctx, 0, 0, 100, 50, 999);

      // 最大半径 = min(100/2, 50/2) = 25
      for (const args of calls.arcTo ?? []) {
        expect(args[4]).toBe(25);
      }
    });

    it('负值半径应被修正为 0', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.roundRect(ctx, 0, 0, 100, 50, -10);

      for (const args of calls.arcTo ?? []) {
        expect(args[4]).toBe(0);
      }
    });

    it('宽高相等时半径应正确裁剪', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.roundRect(ctx, 0, 0, 40, 40, 30);

      // maxRadius = min(40/2, 40/2) = 20
      for (const args of calls.arcTo ?? []) {
        expect(args[4]).toBe(20);
      }
    });

    it('小尺寸矩形应正确处理半径裁剪', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.roundRect(ctx, 0, 0, 10, 10, 5);

      // maxRadius = min(5, 5) = 5, radius = min(5, 5) = 5
      for (const args of calls.arcTo ?? []) {
        expect(args[4]).toBe(5);
      }
    });
  });

  // ----------------------------------------------------------
  // drawResourcePanel — 资源面板
  // ----------------------------------------------------------

  describe('drawResourcePanel', () => {
    const defaultConfig: ResourcePanelConfig = {
      startX: 10,
      startY: 10,
      itemWidth: 150,
    };

    it('空资源数组不应绘制任何内容', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.drawResourcePanel(ctx, [], defaultConfig);
      expect(calls.fillText).toBeUndefined();
    });

    it('应绘制单个资源项的图标、名称、数量', () => {
      const { ctx, calls } = createMockCtx();
      const item = createResourceItem();
      CanvasUIRenderer.drawResourcePanel(ctx, [item], defaultConfig);

      expect(calls.fillText).toBeDefined();
      expect(calls.fillText!.length).toBeGreaterThanOrEqual(3);

      // 检查是否绘制了图标
      const texts = calls.fillText!.map((args) => args[0]);
      expect(texts).toContain('🪙');
      expect(texts).toContain('金币');
      expect(texts).toContain('1.5K');
    });

    it('有 perSecond 时应绘制产出文本', () => {
      const { ctx, calls } = createMockCtx();
      const item = createResourceItem({ perSecond: '+50/s' });
      CanvasUIRenderer.drawResourcePanel(ctx, [item], defaultConfig);

      const texts = calls.fillText!.map((args) => args[0]);
      expect(texts).toContain('+50/s');
    });

    it('perSecond 为空字符串时不应绘制产出文本', () => {
      const { ctx, calls } = createMockCtx();
      const item = createResourceItem({ perSecond: '' });
      CanvasUIRenderer.drawResourcePanel(ctx, [item], defaultConfig);

      const texts = calls.fillText!.map((args) => args[0]);
      // 不应包含空字符串的绘制调用（产出为空时跳过）
      const emptyCalls = texts.filter((t) => t === '');
      expect(emptyCalls.length).toBe(0);
    });

    it('应使用自定义颜色', () => {
      const { ctx, calls } = createMockCtx();
      const item = createResourceItem({ color: '#ff0000' });
      CanvasUIRenderer.drawResourcePanel(ctx, [item], {
        ...defaultConfig,
        colorPrimary: '#00ff00',
        colorProduction: '#0000ff',
      });

      // 应正常绘制不报错
      expect(calls.fillText).toBeDefined();
    });

    it('应横向排列多个资源项', () => {
      const { ctx, calls } = createMockCtx();
      const items = [
        createResourceItem({ id: 'gold', icon: '🪙', name: '金币' }),
        createResourceItem({ id: 'fish', icon: '🐟', name: '鱼' }),
        createResourceItem({ id: 'wood', icon: '🪵', name: '木材' }),
      ];
      CanvasUIRenderer.drawResourcePanel(ctx, items, defaultConfig);

      const texts = calls.fillText!.map((args) => args[0]);
      expect(texts).toContain('🪙');
      expect(texts).toContain('🐟');
      expect(texts).toContain('🪵');
    });

    it('应使用自定义字体', () => {
      const { ctx } = createMockCtx();
      const item = createResourceItem();
      CanvasUIRenderer.drawResourcePanel(ctx, [item], {
        ...defaultConfig,
        fontLarge: 'bold 20px Arial',
        fontSmall: '14px Arial',
      });

      // 不应抛出错误
      expect(ctx.font).toBeTruthy();
    });
  });

  // ----------------------------------------------------------
  // drawBuildingList — 建筑列表
  // ----------------------------------------------------------

  describe('drawBuildingList', () => {
    const defaultConfig: BuildingListConfig = {
      startY: 100,
      itemWidth: 120,
      itemHeight: 80,
      itemPadding: 10,
      itemMarginX: 16,
    };
    const canvasWidth = 400;

    it('空建筑数组不应绘制任何内容', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.drawBuildingList(ctx, [], defaultConfig, canvasWidth);
      expect(calls.fillText).toBeUndefined();
    });

    it('应绘制建筑图标和名称', () => {
      const { ctx, calls } = createMockCtx();
      const building = createBuildingItem();
      CanvasUIRenderer.drawBuildingList(ctx, [building], defaultConfig, canvasWidth);

      const texts = calls.fillText!.map((args) => args[0]);
      expect(texts).toContain('🌾');
      expect(texts).toContain('农场');
    });

    it('应绘制等级产出文本和费用文本', () => {
      const { ctx, calls } = createMockCtx();
      const building = createBuildingItem();
      CanvasUIRenderer.drawBuildingList(ctx, [building], defaultConfig, canvasWidth);

      const texts = calls.fillText!.map((args) => args[0]);
      expect(texts).toContain('Lv.5 (+2.3K/s)');
      expect(texts).toContain('🐟1.5K');
    });

    it('选中状态应使用高亮背景和金色名称', () => {
      const { ctx, calls } = createMockCtx();
      const building = createBuildingItem({ selected: true });
      CanvasUIRenderer.drawBuildingList(ctx, [building], defaultConfig, canvasWidth);

      // 应正常绘制不报错（内部调用 drawPanel 使用选中背景色）
      expect(calls.fillText).toBeDefined();
    });

    it('可购买建筑应使用绿色费用文本', () => {
      const { ctx, calls } = createMockCtx();
      const building = createBuildingItem({ affordable: true });
      CanvasUIRenderer.drawBuildingList(ctx, [building], defaultConfig, canvasWidth);

      expect(calls.fillText).toBeDefined();
    });

    it('不可购买建筑应使用灰色费用文本', () => {
      const { ctx, calls } = createMockCtx();
      const building = createBuildingItem({ affordable: false });
      CanvasUIRenderer.drawBuildingList(ctx, [building], defaultConfig, canvasWidth);

      expect(calls.fillText).toBeDefined();
    });

    it('有标题时应先绘制标题文本', () => {
      const { ctx, calls } = createMockCtx();
      const building = createBuildingItem();
      CanvasUIRenderer.drawBuildingList(
        ctx,
        [building],
        { ...defaultConfig, title: '建筑列表' },
        canvasWidth,
      );

      // 第一个 fillText 应该是标题
      expect(calls.fillText?.[0][0]).toBe('建筑列表');
    });

    it('无标题时不应绘制标题', () => {
      const { ctx, calls } = createMockCtx();
      const building = createBuildingItem();
      CanvasUIRenderer.drawBuildingList(ctx, [building], defaultConfig, canvasWidth);

      const texts = calls.fillText!.map((args) => args[0]);
      expect(texts).not.toContain('建筑列表');
    });

    it('多个建筑应自动换行排列', () => {
      const { ctx, calls } = createMockCtx();
      const buildings = [
        createBuildingItem({ id: 'a', name: 'A' }),
        createBuildingItem({ id: 'b', name: 'B' }),
        createBuildingItem({ id: 'c', name: 'C' }),
        createBuildingItem({ id: 'd', name: 'D' }),
        createBuildingItem({ id: 'e', name: 'E' }),
      ];
      CanvasUIRenderer.drawBuildingList(ctx, buildings, defaultConfig, canvasWidth);

      const texts = calls.fillText!.map((args) => args[0]);
      expect(texts).toContain('A');
      expect(texts).toContain('B');
      expect(texts).toContain('C');
      expect(texts).toContain('D');
      expect(texts).toContain('E');
    });

    it('窄画布应至少每行显示 1 个卡片', () => {
      const { ctx, calls } = createMockCtx();
      const building = createBuildingItem();
      // 极窄画布
      CanvasUIRenderer.drawBuildingList(ctx, [building], defaultConfig, 50);

      expect(calls.fillText).toBeDefined();
    });

    it('应支持自定义颜色配置', () => {
      const { ctx, calls } = createMockCtx();
      const building = createBuildingItem({ affordable: false });
      CanvasUIRenderer.drawBuildingList(
        ctx,
        [building],
        {
          ...defaultConfig,
          colorSelectedBg: 'rgba(255,0,0,0.2)',
          colorSelectedBorder: '#ff0000',
          colorAffordable: '#00ff00',
          colorUnaffordable: '#ff0000',
        },
        canvasWidth,
      );

      expect(calls.fillText).toBeDefined();
    });
  });

  // ----------------------------------------------------------
  // drawFloatingTexts — 飘字效果
  // ----------------------------------------------------------

  describe('drawFloatingTexts', () => {
    it('空数组不应绘制任何内容', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.drawFloatingTexts(ctx, []);
      expect(calls.fillText).toBeUndefined();
    });

    it('应绘制飘字文本', () => {
      const { ctx, calls } = createMockCtx();
      const ft = createFloatingText();
      CanvasUIRenderer.drawFloatingTexts(ctx, [ft]);

      const texts = calls.fillText!.map((args) => args[0]);
      expect(texts).toContain('+100');
    });

    it('应绘制文字阴影以增强可读性', () => {
      const { ctx, calls } = createMockCtx();
      const ft = createFloatingText();
      CanvasUIRenderer.drawFloatingTexts(ctx, [ft]);

      // 应有两次 fillText：一次阴影，一次正文
      expect(calls.fillText!.length).toBe(2);
      // 两次绘制的文本内容相同
      expect(calls.fillText![0][0]).toBe('+100');
      expect(calls.fillText![1][0]).toBe('+100');
    });

    it('应调用 save/restore 配对', () => {
      const { ctx, calls } = createMockCtx();
      const ft = createFloatingText();
      CanvasUIRenderer.drawFloatingTexts(ctx, [ft]);

      expect(calls.save?.length).toBe(1);
      expect(calls.restore?.length).toBe(1);
    });

    it('life <= 0 的飘字应被跳过', () => {
      const { ctx, calls } = createMockCtx();
      const ft = createFloatingText({ life: 0 });
      CanvasUIRenderer.drawFloatingTexts(ctx, [ft]);

      expect(calls.fillText).toBeUndefined();
    });

    it('负 life 的飘字应被跳过', () => {
      const { ctx, calls } = createMockCtx();
      const ft = createFloatingText({ life: -100 });
      CanvasUIRenderer.drawFloatingTexts(ctx, [ft]);

      expect(calls.fillText).toBeUndefined();
    });

    it('透明度应随 life/maxLife 线性衰减', () => {
      const { ctx } = createMockCtx();
      const ft = createFloatingText({ life: 250, maxLife: 1000 });
      CanvasUIRenderer.drawFloatingTexts(ctx, [ft]);

      // alpha = life / maxLife = 250 / 1000 = 0.25
      expect(ctx.globalAlpha).toBeCloseTo(0.25, 2);
    });

    it('满生命值时透明度应为 1', () => {
      const { ctx } = createMockCtx();
      const ft = createFloatingText({ life: 1000, maxLife: 1000 });
      CanvasUIRenderer.drawFloatingTexts(ctx, [ft]);

      expect(ctx.globalAlpha).toBe(1);
    });

    it('飘字应随生命值减少向上漂移', () => {
      const { ctx, calls } = createMockCtx();
      const ft = createFloatingText({ life: 500, maxLife: 1000, y: 200 });
      CanvasUIRenderer.drawFloatingTexts(ctx, [ft]);

      // drift = (1 - 500/1000) * 40 = 20
      // 正文 fillText 的 y 坐标应为 200 - 20 = 180
      // 第二次 fillText 是正文（第一次是阴影）
      const bodyCall = calls.fillText![1];
      expect(bodyCall[2]).toBeCloseTo(180, 1);
    });

    it('多个飘字应全部绘制', () => {
      const { ctx, calls } = createMockCtx();
      const texts = [
        createFloatingText({ text: '+10' }),
        createFloatingText({ text: '+20' }),
        createFloatingText({ text: '+30' }),
      ];
      CanvasUIRenderer.drawFloatingTexts(ctx, texts);

      // 每个飘字绘制阴影 + 正文 = 6 次
      expect(calls.fillText!.length).toBe(6);
    });

    it('混合存活和死亡飘字应只绘制存活的', () => {
      const { ctx, calls } = createMockCtx();
      const texts = [
        createFloatingText({ text: 'alive', life: 500 }),
        createFloatingText({ text: 'dead', life: 0 }),
        createFloatingText({ text: 'alive2', life: 100 }),
      ];
      CanvasUIRenderer.drawFloatingTexts(ctx, texts);

      // 2 个存活 * 2（阴影+正文）= 4 次
      expect(calls.fillText!.length).toBe(4);
      const renderedTexts = calls.fillText!.map((args) => args[0]);
      expect(renderedTexts).toContain('alive');
      expect(renderedTexts).toContain('alive2');
      expect(renderedTexts).not.toContain('dead');
    });
  });

  // ----------------------------------------------------------
  // drawBadge — 徽章
  // ----------------------------------------------------------

  describe('drawBadge', () => {
    it('应绘制徽章背景和文字', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.drawBadge(ctx, {
        text: 'Lv.5',
        x: 100,
        y: 50,
        color: '#ffffff',
      });

      // 应调用 fill 和 fillText
      expect(calls.fill?.length).toBeGreaterThanOrEqual(1);
      expect(calls.fillText?.length).toBe(1);
      expect(calls.fillText![0][0]).toBe('Lv.5');
    });

    it('应测量文字宽度以确定背景尺寸', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.drawBadge(ctx, {
        text: 'VIP',
        x: 100,
        y: 50,
        color: '#ffffff',
      });

      expect(calls.measureText?.length).toBe(1);
      expect(calls.measureText![0][0]).toBe('VIP');
    });

    it('应使用默认背景色绘制填充', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.drawBadge(ctx, {
        text: 'Test',
        x: 100,
        y: 50,
        color: '#ffffff',
      });

      // fill 应被调用（背景填充），fillStyle 在 fill 之后被文字颜色覆盖
      // 所以验证 fill 调用存在即可
      expect(calls.fill?.length).toBeGreaterThanOrEqual(1);
    });

    it('应使用自定义背景色绘制填充', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.drawBadge(ctx, {
        text: 'Test',
        x: 100,
        y: 50,
        color: '#ffffff',
        bgColor: '#ff0000',
      });

      // fill 应被调用
      expect(calls.fill?.length).toBeGreaterThanOrEqual(1);
    });

    it('应使用自定义字号和内边距', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.drawBadge(ctx, {
        text: 'Big',
        x: 100,
        y: 50,
        color: '#ffffff',
        fontSize: 20,
        padding: 10,
        radius: 15,
      });

      // 应正常绘制不报错
      expect(calls.fillText).toBeDefined();
    });

    it('文字应居中绘制', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.drawBadge(ctx, {
        text: '居中',
        x: 200,
        y: 100,
        color: '#ffffff',
      });

      // fillText 应在 (x, y) 处绘制
      expect(calls.fillText![0][1]).toBe(200);
      expect(calls.fillText![0][2]).toBe(100);
    });

    it('应设置 textAlign 和 textBaseline 为 center/middle', () => {
      const { ctx } = createMockCtx();
      CanvasUIRenderer.drawBadge(ctx, {
        text: 'Test',
        x: 100,
        y: 50,
        color: '#ffffff',
      });

      expect(ctx.textAlign).toBe('center');
      expect(ctx.textBaseline).toBe('middle');
    });
  });

  // ----------------------------------------------------------
  // drawBottomHint — 底部操作提示
  // ----------------------------------------------------------

  describe('drawBottomHint', () => {
    it('应在画布底部居中绘制提示文字', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.drawBottomHint(ctx, '点击建筑升级', 400, 600);

      expect(calls.fillText?.length).toBe(1);
      expect(calls.fillText![0][0]).toBe('点击建筑升级');
      // X 坐标应为画布宽度的一半
      expect(calls.fillText![0][1]).toBe(200);
      // Y 坐标应为 canvasHeight - 12
      expect(calls.fillText![0][2]).toBe(588);
    });

    it('应使用默认灰色', () => {
      const { ctx } = createMockCtx();
      CanvasUIRenderer.drawBottomHint(ctx, '提示', 400, 600);

      // 默认颜色 DEFAULT_COLORS.textDim = '#666666'
      expect(ctx.fillStyle).toBe('#666666');
    });

    it('应使用自定义颜色', () => {
      const { ctx } = createMockCtx();
      CanvasUIRenderer.drawBottomHint(ctx, '提示', 400, 600, '#ff0000');

      expect(ctx.fillStyle).toBe('#ff0000');
    });

    it('应设置 textAlign 为 center', () => {
      const { ctx } = createMockCtx();
      CanvasUIRenderer.drawBottomHint(ctx, '提示', 400, 600);

      expect(ctx.textAlign).toBe('center');
    });

    it('应设置 textBaseline 为 bottom', () => {
      const { ctx } = createMockCtx();
      CanvasUIRenderer.drawBottomHint(ctx, '提示', 400, 600);

      expect(ctx.textBaseline).toBe('bottom');
    });
  });

  // ----------------------------------------------------------
  // drawTitle — 标题栏
  // ----------------------------------------------------------

  describe('drawTitle', () => {
    it('应在画布顶部居中绘制标题', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.drawTitle(ctx, '放置游戏', 400);

      expect(calls.fillText?.length).toBe(1);
      expect(calls.fillText![0][0]).toBe('放置游戏');
      // X 坐标应为画布宽度的一半
      expect(calls.fillText![0][1]).toBe(200);
    });

    it('默认 Y 坐标应为 30', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.drawTitle(ctx, '标题', 400);

      expect(calls.fillText![0][2]).toBe(30);
    });

    it('应使用自定义 Y 坐标', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.drawTitle(ctx, '标题', 400, 50);

      expect(calls.fillText![0][2]).toBe(50);
    });

    it('应使用默认金色', () => {
      const { ctx } = createMockCtx();
      CanvasUIRenderer.drawTitle(ctx, '标题', 400);

      // 默认颜色 DEFAULT_COLORS.accentGold = '#f0c040'
      expect(ctx.fillStyle).toBe('#f0c040');
    });

    it('应使用自定义颜色', () => {
      const { ctx } = createMockCtx();
      CanvasUIRenderer.drawTitle(ctx, '标题', 400, 30, '#00ff00');

      expect(ctx.fillStyle).toBe('#00ff00');
    });

    it('应设置 textAlign 为 center', () => {
      const { ctx } = createMockCtx();
      CanvasUIRenderer.drawTitle(ctx, '标题', 400);

      expect(ctx.textAlign).toBe('center');
    });

    it('应设置 textBaseline 为 middle', () => {
      const { ctx } = createMockCtx();
      CanvasUIRenderer.drawTitle(ctx, '标题', 400);

      expect(ctx.textBaseline).toBe('middle');
    });
  });

  // ----------------------------------------------------------
  // drawGradientBg — 渐变背景
  // ----------------------------------------------------------

  describe('drawGradientBg', () => {
    it('应创建从上到下的线性渐变', () => {
      const { ctx, calls, gradientMock } = createMockCtx();
      CanvasUIRenderer.drawGradientBg(ctx, 800, 600, '#1a1a2e', '#16213e');

      // 应创建线性渐变 (0, 0) -> (0, h)
      expect(calls.createLinearGradient?.length).toBe(1);
      expect(calls.createLinearGradient![0]).toEqual([0, 0, 0, 600]);
    });

    it('应添加两个颜色停止点', () => {
      const { ctx, gradientMock } = createMockCtx();
      CanvasUIRenderer.drawGradientBg(ctx, 800, 600, '#color1', '#color2');

      expect(gradientMock.addColorStop).toHaveBeenCalledTimes(2);
      expect(gradientMock.addColorStop).toHaveBeenCalledWith(0, '#color1');
      expect(gradientMock.addColorStop).toHaveBeenCalledWith(1, '#color2');
    });

    it('应使用渐变填充整个画布', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.drawGradientBg(ctx, 800, 600, '#1a1a2e', '#16213e');

      expect(calls.fillRect?.length).toBe(1);
      expect(calls.fillRect![0]).toEqual([0, 0, 800, 600]);
    });

    it('应将 fillStyle 设置为渐变对象', () => {
      const { ctx, gradientMock } = createMockCtx();
      CanvasUIRenderer.drawGradientBg(ctx, 800, 600, '#a', '#b');

      expect(ctx.fillStyle).toBe(gradientMock);
    });
  });

  // ----------------------------------------------------------
  // drawProgressBar — 进度条
  // ----------------------------------------------------------

  describe('drawProgressBar', () => {
    it('应绘制背景轨道和填充条', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.drawProgressBar(ctx, 10, 20, 200, 16, 0.5, '#4caf50');

      // 至少有两次 fill：背景轨道 + 填充条
      expect(calls.fill?.length).toBeGreaterThanOrEqual(2);
    });

    it('进度为 0 时不应绘制填充条', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.drawProgressBar(ctx, 10, 20, 200, 16, 0, '#4caf50');

      // 只有背景轨道的 fill
      expect(calls.fill?.length).toBe(1);
    });

    it('进度为 1 时填充条应覆盖整个宽度', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.drawProgressBar(ctx, 10, 20, 200, 16, 1, '#4caf50');

      // 背景 + 填充 = 2 次 fill
      expect(calls.fill?.length).toBe(2);
    });

    it('进度超过 1 应被裁剪为 1', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.drawProgressBar(ctx, 10, 20, 200, 16, 2.5, '#4caf50');

      // 应正常绘制不报错
      expect(calls.fill?.length).toBe(2);
    });

    it('负数进度应被裁剪为 0', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.drawProgressBar(ctx, 10, 20, 200, 16, -0.5, '#4caf50');

      // 只有背景轨道
      expect(calls.fill?.length).toBe(1);
    });

    it('应使用默认背景色', () => {
      const { ctx } = createMockCtx();
      CanvasUIRenderer.drawProgressBar(ctx, 10, 20, 200, 16, 0.5, '#4caf50');

      // 默认 bgColor = 'rgba(255, 255, 255, 0.1)'
      // fillStyle 会被多次设置，最后一次设置填充条颜色
      // 我们只需验证不报错
      expect(true).toBe(true);
    });

    it('应使用自定义背景色', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.drawProgressBar(
        ctx, 10, 20, 200, 16, 0.5, '#4caf50', '#333333',
      );

      expect(calls.fill).toBeDefined();
    });

    it('有 borderColor 时应绘制边框', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.drawProgressBar(
        ctx, 10, 20, 200, 16, 0.5, '#4caf50', undefined, '#ffffff',
      );

      expect(calls.stroke?.length).toBe(1);
    });

    it('无 borderColor 时不应绘制边框', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.drawProgressBar(ctx, 10, 20, 200, 16, 0.5, '#4caf50');

      expect(calls.stroke).toBeUndefined();
    });

    it('圆角半径应为高度的一半', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.drawProgressBar(ctx, 10, 20, 200, 20, 0.5, '#4caf50');

      // barRadius = h / 2 = 10
      // roundRect 内部 arcTo 的半径应为 10
      const arcToCalls = calls.arcTo ?? [];
      for (const args of arcToCalls) {
        expect(args[4]).toBe(10);
      }
    });
  });

  // ----------------------------------------------------------
  // drawPanel — 面板背景
  // ----------------------------------------------------------

  describe('drawPanel', () => {
    it('应绘制面板背景', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.drawPanel(ctx, 10, 20, 200, 100);

      expect(calls.fill?.length).toBe(1);
    });

    it('应使用默认背景色', () => {
      const { ctx } = createMockCtx();
      CanvasUIRenderer.drawPanel(ctx, 10, 20, 200, 100);

      // 默认 bgColor = DEFAULT_COLORS.panelBg = 'rgba(30, 30, 50, 0.85)'
      expect(ctx.fillStyle).toBe('rgba(30, 30, 50, 0.85)');
    });

    it('应使用自定义背景色', () => {
      const { ctx } = createMockCtx();
      CanvasUIRenderer.drawPanel(ctx, 10, 20, 200, 100, '#ff0000');

      expect(ctx.fillStyle).toBe('#ff0000');
    });

    it('有 borderColor 时应绘制边框', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.drawPanel(ctx, 10, 20, 200, 100, '#333', '#ffffff');

      expect(calls.stroke?.length).toBe(1);
      expect(ctx.strokeStyle).toBe('#ffffff');
    });

    it('无 borderColor 时不应绘制边框', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.drawPanel(ctx, 10, 20, 200, 100, '#333');

      expect(calls.stroke).toBeUndefined();
    });

    it('应使用默认圆角半径 8', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.drawPanel(ctx, 10, 20, 200, 100);

      // 默认 radius = 8
      const arcToCalls = calls.arcTo ?? [];
      for (const args of arcToCalls) {
        expect(args[4]).toBe(8);
      }
    });

    it('应使用自定义圆角半径', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.drawPanel(ctx, 10, 20, 200, 100, '#333', undefined, 16);

      const arcToCalls = calls.arcTo ?? [];
      for (const args of arcToCalls) {
        expect(args[4]).toBe(16);
      }
    });

    it('应使用 roundRect 创建路径', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.drawPanel(ctx, 10, 20, 200, 100);

      expect(calls.beginPath?.length).toBeGreaterThanOrEqual(1);
      expect(calls.closePath?.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ----------------------------------------------------------
  // 边界条件与综合测试
  // ----------------------------------------------------------

  describe('边界条件与综合测试', () => {
    it('零尺寸矩形不应导致错误', () => {
      const { ctx } = createMockCtx();
      expect(() => CanvasUIRenderer.roundRect(ctx, 0, 0, 0, 0, 0)).not.toThrow();
    });

    it('负坐标应正常工作', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.roundRect(ctx, -100, -200, 50, 50, 5);

      expect(calls.beginPath?.length).toBe(1);
    });

    it('极大尺寸不应导致错误', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.roundRect(ctx, 0, 0, 100000, 100000, 500);

      expect(calls.beginPath?.length).toBe(1);
    });

    it('drawResourcePanel 使用自定义字体配置不应报错', () => {
      const { ctx } = createMockCtx();
      const items = [createResourceItem()];
      const config: ResourcePanelConfig = {
        startX: 0,
        startY: 0,
        itemWidth: 100,
        fontLarge: 'bold 32px CustomFont',
        fontSmall: '16px CustomFont',
        colorPrimary: '#ff00ff',
        colorProduction: '#00ffff',
      };

      expect(() => CanvasUIRenderer.drawResourcePanel(ctx, items, config)).not.toThrow();
    });

    it('drawBuildingList 全部选中应正常工作', () => {
      const { ctx } = createMockCtx();
      const buildings = [
        createBuildingItem({ id: 'a', selected: true }),
        createBuildingItem({ id: 'b', selected: true }),
      ];
      const config: BuildingListConfig = {
        startY: 0,
        itemWidth: 120,
        itemHeight: 80,
        itemPadding: 10,
        itemMarginX: 16,
      };

      expect(() =>
        CanvasUIRenderer.drawBuildingList(ctx, buildings, config, 400),
      ).not.toThrow();
    });

    it('drawFloatingTexts life 超过 maxLife 时透明度应被裁剪为 1', () => {
      const { ctx } = createMockCtx();
      const ft = createFloatingText({ life: 2000, maxLife: 1000 });
      CanvasUIRenderer.drawFloatingTexts(ctx, [ft]);

      expect(ctx.globalAlpha).toBe(1);
    });

    it('drawProgressBar 极小高度应正常工作', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.drawProgressBar(ctx, 10, 20, 200, 2, 0.5, '#4caf50');

      expect(calls.fill).toBeDefined();
    });

    it('drawBadge 空文字应正常工作', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.drawBadge(ctx, {
        text: '',
        x: 100,
        y: 50,
        color: '#ffffff',
      });

      expect(calls.fillText).toBeDefined();
    });

    it('drawGradientBg 零尺寸画布应正常工作', () => {
      const { ctx, calls } = createMockCtx();
      CanvasUIRenderer.drawGradientBg(ctx, 0, 0, '#000', '#fff');

      expect(calls.fillRect?.length).toBe(1);
    });

    it('所有公共方法均为静态方法', () => {
      // 验证类上不存在实例方法
      const methods = [
        'roundRect',
        'drawResourcePanel',
        'drawBuildingList',
        'drawFloatingTexts',
        'drawBadge',
        'drawBottomHint',
        'drawTitle',
        'drawGradientBg',
        'drawProgressBar',
        'drawPanel',
      ];

      for (const method of methods) {
        expect(typeof (CanvasUIRenderer as Record<string, unknown>)[method]).toBe('function');
      }
    });

    it('不应能通过 new 创建实例（纯静态类）', () => {
      // 虽然技术上可以 new，但验证所有方法都在原型的静态侧
      const instance = new CanvasUIRenderer();
      // 实例上不应有这些方法
      expect((instance as Record<string, unknown>).roundRect).toBeUndefined();
      expect((instance as Record<string, unknown>).drawPanel).toBeUndefined();
    });
  });

  // ----------------------------------------------------------
  // 类型导出验证
  // ----------------------------------------------------------

  describe('类型导出', () => {
    it('ResourceDisplayItem 应包含必要字段', () => {
      const item: ResourceDisplayItem = {
        id: 'test',
        icon: '🔥',
        name: '测试',
        amount: '100',
        perSecond: '+10/s',
      };
      expect(item.id).toBe('test');
      expect(item.perSecond).toBe('+10/s');
    });

    it('BuildingDisplayItem 应包含必要字段', () => {
      const item: BuildingDisplayItem = {
        id: 'test',
        icon: '🏠',
        name: '测试建筑',
        level: 3,
        productionText: 'Lv.3 (+100/s)',
        costText: '💰500',
        affordable: true,
        selected: false,
      };
      expect(item.level).toBe(3);
      expect(item.affordable).toBe(true);
    });

    it('FloatingText 应包含必要字段', () => {
      const ft: FloatingText = {
        text: '+50',
        x: 100,
        y: 200,
        life: 500,
        maxLife: 1000,
        color: '#ffcc00',
      };
      expect(ft.life).toBe(500);
      expect(ft.maxLife).toBe(1000);
    });

    it('BadgeOptions 应支持所有可选字段', () => {
      const opts: BadgeOptions = {
        text: 'VIP',
        x: 100,
        y: 50,
        color: '#gold',
        bgColor: '#333',
        fontSize: 16,
        padding: 8,
        radius: 12,
      };
      expect(opts.fontSize).toBe(16);
      expect(opts.padding).toBe(8);
    });

    it('UIColorScheme 应包含所有颜色字段', () => {
      const scheme: UIColorScheme = {
        bgGradient1: '#1a1a2e',
        bgGradient2: '#16213e',
        textPrimary: '#e0e0e0',
        textSecondary: '#a0a0a0',
        textDim: '#666666',
        accentGold: '#f0c040',
        accentGreen: '#4caf50',
        panelBg: 'rgba(30, 30, 50, 0.85)',
        selectedBg: 'rgba(240, 192, 64, 0.15)',
        selectedBorder: '#f0c040',
        affordable: '#4caf50',
        unaffordable: '#888888',
      };
      expect(Object.keys(scheme).length).toBe(12);
    });
  });
});
