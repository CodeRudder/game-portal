/**
 * TutorialMaskSystem 单元测试
 * 覆盖：#15 聚焦遮罩、#16 引导气泡
 */

import type { ISystemDeps } from '../../../core/types';
import { TutorialMaskSystem } from '../TutorialMaskSystem';
import type { HighlightBounds, ElementBoundsProvider } from '../TutorialMaskSystem';

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: jest.fn().mockReturnValue(jest.fn()),
      once: jest.fn().mockReturnValue(jest.fn()),
      emit: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn(),
    },
    config: { get: jest.fn(), set: jest.fn() },
    registry: { register: jest.fn(), get: jest.fn(), getAll: jest.fn(), has: jest.fn(), unregister: jest.fn() },
  } as unknown as ISystemDeps;
}

/** 模拟元素位置查询 */
const mockBoundsProvider: ElementBoundsProvider = (selector: string): HighlightBounds | null => {
  const boundsMap: Record<string, HighlightBounds> = {
    '#main-castle': { x: 50, y: 100, width: 200, height: 150 },
    '#resource-bar': { x: 0, y: 0, width: 375, height: 44 },
    '#nav-tab': { x: 0, y: 620, width: 375, height: 48 },
    '#building-area': { x: 20, y: 200, width: 335, height: 300 },
    '#confirm-build': { x: 100, y: 400, width: 175, height: 44 },
    '#battle-start': { x: 120, y: 500, width: 135, height: 50 },
  };
  return boundsMap[selector] ?? null;
};

describe('TutorialMaskSystem', () => {
  let mask: TutorialMaskSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    jest.restoreAllMocks();
    mask = new TutorialMaskSystem();
    deps = mockDeps();
    mask.init(deps);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 遮罩控制 (#15)
  // ═══════════════════════════════════════════
  describe('遮罩控制', () => {
    it('初始不激活', () => {
      expect(mask.isActive()).toBe(false);
    });

    it('激活遮罩', () => {
      mask.activate();
      expect(mask.isActive()).toBe(true);
    });

    it('停用遮罩', () => {
      mask.activate();
      mask.deactivate();
      expect(mask.isActive()).toBe(false);
    });

    it('自定义遮罩配置', () => {
      mask.activate({ opacity: 0.9, showHandAnimation: false });
      const renderData = mask.getMaskRenderData();
      expect(renderData.opacity).toBe(0.9);
      expect(renderData.showHandAnimation).toBe(false);
    });

    it('激活后渲染数据可见', () => {
      mask.activate();
      const renderData = mask.getMaskRenderData();
      expect(renderData.visible).toBe(true);
    });

    it('停用后渲染数据不可见', () => {
      mask.activate();
      mask.deactivate();
      const renderData = mask.getMaskRenderData();
      expect(renderData.visible).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 高亮目标 (#15)
  // ═══════════════════════════════════════════
  describe('高亮目标', () => {
    it('设置高亮目标', () => {
      mask.activate();
      const result = mask.setHighlightTarget('#main-castle', mockBoundsProvider);
      expect(result.success).toBe(true);
      expect(mask.getTargetSelector()).toBe('#main-castle');
    });

    it('高亮区域包含内边距', () => {
      mask.activate();
      mask.setHighlightTarget('#main-castle', mockBoundsProvider);
      const bounds = mask.getHighlightBounds();
      expect(bounds).not.toBeNull();
      // 默认 padding=8
      expect(bounds!.x).toBe(50 - 8);
      expect(bounds!.y).toBe(100 - 8);
      expect(bounds!.width).toBe(200 + 16);
      expect(bounds!.height).toBe(150 + 16);
    });

    it('不存在的元素返回失败', () => {
      mask.activate();
      const result = mask.setHighlightTarget('#nonexistent', mockBoundsProvider);
      expect(result.success).toBe(false);
    });

    it('未激活时设置高亮失败', () => {
      const result = mask.setHighlightTarget('#main-castle', mockBoundsProvider);
      expect(result.success).toBe(false);
    });

    it('清除高亮目标', () => {
      mask.activate();
      mask.setHighlightTarget('#main-castle', mockBoundsProvider);
      mask.clearHighlightTarget();
      expect(mask.getTargetSelector()).toBeNull();
      expect(mask.getHighlightBounds()).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 3. 引导手指动画 (#15)
  // ═══════════════════════════════════════════
  describe('引导手指动画', () => {
    it('有高亮目标时显示手指动画', () => {
      mask.activate();
      mask.setHighlightTarget('#main-castle', mockBoundsProvider);
      const renderData = mask.getMaskRenderData();
      expect(renderData.showHandAnimation).toBe(true);
      expect(renderData.handTarget).not.toBeNull();
    });

    it('手指动画目标在高亮区域中心', () => {
      mask.activate();
      mask.setHighlightTarget('#main-castle', mockBoundsProvider);
      const renderData = mask.getMaskRenderData();
      // bounds with padding: x=42, y=92, w=216, h=166
      expect(renderData.handTarget!.x).toBe(42 + 216 / 2);
      expect(renderData.handTarget!.y).toBe(92 + 166 / 2);
    });

    it('无高亮目标时无手指动画', () => {
      mask.activate();
      const renderData = mask.getMaskRenderData();
      expect(renderData.handTarget).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 4. 点击穿透控制 (#15)
  // ═══════════════════════════════════════════
  describe('点击穿透控制', () => {
    it('正常模式屏蔽非目标区域点击', () => {
      mask.activate();
      const renderData = mask.getMaskRenderData();
      expect(renderData.blockNonTargetClicks).toBe(true);
    });

    it('简化模式不屏蔽点击', () => {
      mask.activate();
      mask.setSimplifiedMode(true);
      const renderData = mask.getMaskRenderData();
      expect(renderData.blockNonTargetClicks).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 简化遮罩模式 (#13 重玩)
  // ═══════════════════════════════════════════
  describe('简化遮罩模式', () => {
    it('启用简化模式', () => {
      mask.activate();
      mask.setSimplifiedMode(true);
      expect(mask.isSimplifiedMode()).toBe(true);
    });

    it('简化模式透明度50%', () => {
      mask.activate();
      mask.setSimplifiedMode(true);
      const renderData = mask.getMaskRenderData();
      expect(renderData.opacity).toBe(0.5);
    });

    it('简化模式不显示手指动画', () => {
      mask.activate();
      mask.setSimplifiedMode(true);
      const renderData = mask.getMaskRenderData();
      expect(renderData.showHandAnimation).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 引导气泡 (#16)
  // ═══════════════════════════════════════════
  describe('引导气泡', () => {
    it('显示气泡', () => {
      mask.activate();
      mask.showBubble({
        text: '这是你的主城',
        position: 'bottom',
        arrowTarget: '#main-castle',
        autoPosition: false,
        maxWidth: 280,
      });
      const bubbleData = mask.getBubbleRenderData();
      expect(bubbleData.visible).toBe(true);
      expect(bubbleData.text).toBe('这是你的主城');
    });

    it('隐藏气泡', () => {
      mask.activate();
      mask.showBubble({
        text: '测试',
        position: 'top',
        arrowTarget: '#test',
        autoPosition: false,
        maxWidth: 200,
      });
      mask.hideBubble();
      const bubbleData = mask.getBubbleRenderData();
      expect(bubbleData.visible).toBe(false);
    });

    it('未激活时气泡不可见', () => {
      mask.showBubble({
        text: '测试',
        position: 'top',
        arrowTarget: '#test',
        autoPosition: false,
        maxWidth: 200,
      });
      const bubbleData = mask.getBubbleRenderData();
      expect(bubbleData.visible).toBe(false);
    });

    it('气泡箭头指向高亮区域中心', () => {
      mask.activate();
      mask.setHighlightTarget('#main-castle', mockBoundsProvider);
      mask.showBubble({
        text: '主城',
        position: 'bottom',
        arrowTarget: '#main-castle',
        autoPosition: false,
        maxWidth: 280,
      });
      const bubbleData = mask.getBubbleRenderData();
      expect(bubbleData.arrowTarget).not.toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 7. 自动定位 (#16)
  // ═══════════════════════════════════════════
  describe('自动定位', () => {
    it('高亮区域下方空间充足时定位到底部', () => {
      mask.activate();
      mask.setViewportSize({ width: 375, height: 667 });
      // resource-bar 在顶部 (y=0, h=44)，下方空间充足
      mask.setHighlightTarget('#resource-bar', mockBoundsProvider);
      mask.showBubble({
        text: '资源栏',
        position: 'auto',
        arrowTarget: '#resource-bar',
        autoPosition: true,
        maxWidth: 280,
      });
      const bubbleData = mask.getBubbleRenderData();
      expect(bubbleData.computedPosition).toBe('bottom');
    });

    it('高亮区域下方空间不足时定位到顶部', () => {
      mask.activate();
      mask.setViewportSize({ width: 375, height: 667 });
      // nav-tab 在底部 (y=620, h=48)，下方空间不足
      mask.setHighlightTarget('#nav-tab', mockBoundsProvider);
      mask.showBubble({
        text: '导航',
        position: 'auto',
        arrowTarget: '#nav-tab',
        autoPosition: true,
        maxWidth: 280,
      });
      const bubbleData = mask.getBubbleRenderData();
      // 上方空间充足
      expect(['top', 'right']).toContain(bubbleData.computedPosition);
    });
  });

  // ═══════════════════════════════════════════
  // 8. 子步骤设置
  // ═══════════════════════════════════════════
  describe('setupForSubStep', () => {
    it('为子步骤设置遮罩和气泡', () => {
      const result = mask.setupForSubStep(
        {
          id: '1-1',
          text: '欢迎来到三国乱世！',
          targetSelector: '#main-castle',
          unskippable: true,
          completionType: 'click',
        },
        mockBoundsProvider,
      );
      expect(result.success).toBe(true);
      expect(mask.isActive()).toBe(true);
      expect(mask.getTargetSelector()).toBe('#main-castle');

      const renderData = mask.getRenderData();
      expect(renderData.mask.visible).toBe(true);
      expect(renderData.bubble.visible).toBe(true);
      expect(renderData.bubble.text).toBe('欢迎来到三国乱世！');
    });

    it('子步骤目标不存在时返回失败', () => {
      const result = mask.setupForSubStep(
        {
          id: '1-1',
          text: '测试',
          targetSelector: '#nonexistent',
          unskippable: false,
          completionType: 'click',
        },
        mockBoundsProvider,
      );
      expect(result.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 9. 完整渲染数据
  // ═══════════════════════════════════════════
  describe('完整渲染数据', () => {
    it('getRenderData 返回完整数据', () => {
      mask.activate();
      mask.setHighlightTarget('#main-castle', mockBoundsProvider);
      mask.showBubble({
        text: '主城',
        position: 'bottom',
        arrowTarget: '#main-castle',
        autoPosition: false,
        maxWidth: 280,
      });

      const renderData = mask.getRenderData();
      expect(renderData.mask.visible).toBe(true);
      expect(renderData.mask.highlightBounds).not.toBeNull();
      expect(renderData.bubble.visible).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 10. 重置
  // ═══════════════════════════════════════════
  describe('重置', () => {
    it('reset 恢复初始状态', () => {
      mask.activate();
      mask.setHighlightTarget('#main-castle', mockBoundsProvider);
      mask.reset();
      expect(mask.isActive()).toBe(false);
      expect(mask.getTargetSelector()).toBeNull();
    });
  });
});
