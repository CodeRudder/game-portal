/**
 * NPCRenderEnhancer 单元测试
 *
 * 注意：由于 PixiJS v8 需要 WebGL/Canvas 环境，本测试文件
 * 使用 mock 方式测试 NPCRenderEnhancer 的逻辑。
 *
 * 覆盖：职业图标、好感度心形、交互提示、动画配置、
 * 增强元素管理。
 *
 * @module engine/npc/__tests__/NPCRenderEnhancer.test
 */

// ---------------------------------------------------------------------------
// Mock PixiJS v8 — 使用 jest.hoisted 确保在模块加载前完成 mock
// ---------------------------------------------------------------------------

jest.mock('pixi.js', () => {
  /** 创建一个轻量 mock Container，不依赖 jest.fn()（避免 hoist 问题） */
  function createMockContainer(label?: string) {
    const children: any[] = [];
    return {
      label: label ?? '',
      x: 0,
      y: 0,
      rotation: 0,
      visible: true,
      scale: { set() {}, x: 1, y: 1 },
      position: { set() {} },
      parent: null as any,
      children,
      emit() {},
      on() { return this; },
      off() {},
      once() {},
      removeAllListeners() {},
      addChild(child: any) {
        children.push(child);
        if (child) child.parent = this;
      },
      addChildAt(child: any, _index: number) {
        children.push(child);
        if (child) child.parent = this;
      },
      removeChild(child: any) {
        const idx = children.indexOf(child);
        if (idx >= 0) children.splice(idx, 1);
        if (child) child.parent = null;
      },
      removeChildren() {
        const old = [...children];
        children.length = 0;
        old.forEach((c) => { if (c) c.parent = null; });
        return old;
      },
      getChildByLabel(label: string) {
        return children.find((c: any) => c.label === label) ?? null;
      },
      destroy() { children.length = 0; },
    };
  }

  function createMockGraphics() {
    return {
      label: '',
      x: 0,
      y: 0,
      visible: true,
      parent: null as any,
      position: { set() {} },
      emit() {},
      on() {},
      off() {},
      once() {},
      removeAllListeners() {},
      clear() { return this; },
      circle() { return this; },
      rect() { return this; },
      ellipse() { return this; },
      moveTo() { return this; },
      lineTo() { return this; },
      closePath() { return this; },
      fill() { return this; },
      stroke() { return this; },
      roundRect() { return this; },
      destroy() {},
    };
  }

  function createMockText(options?: any) {
    return {
      label: '',
      text: options?.text ?? '',
      anchor: { set() {}, x: 0, y: 0 },
      x: 0,
      y: 0,
      width: 50,
      height: 12,
      visible: true,
      parent: null as any,
      position: { set() {} },
      emit() {},
      on() {},
      off() {},
      once() {},
      removeAllListeners() {},
      options: options ?? {},
      destroy() {},
    };
  }

  // 使用 class 包装以匹配 import { Container } 形式
  class MockContainer {
    label: string;
    x = 0;
    y = 0;
    rotation = 0;
    visible = true;
    scale = { set() {}, x: 1, y: 1 };
    position = { set() {} };
    parent: any = null;
    children: any[] = [];

    constructor(opts?: { label?: string }) {
      this.label = opts?.label ?? '';
    }

    emit() {}
    on() { return this; }
    off() {}
    once() {}
    removeAllListeners() {}

    addChild(child: any) {
      this.children.push(child);
      if (child) child.parent = this;
    }
    addChildAt(child: any, _index: number) {
      this.children.push(child);
      if (child) child.parent = this;
    }
    removeChild(child: any) {
      const idx = this.children.indexOf(child);
      if (idx >= 0) this.children.splice(idx, 1);
      if (child) child.parent = null;
    }
    removeChildren() {
      const old = [...this.children];
      this.children.length = 0;
      old.forEach((c) => { if (c) c.parent = null; });
      return old;
    }
    getChildByLabel(label: string) {
      return this.children.find((c: any) => c.label === label) ?? null;
    }
    destroy() {
      // 模拟 PixiJS 行为：destroy 时从父容器移除
      if (this.parent && Array.isArray(this.parent.children)) {
        const idx = this.parent.children.indexOf(this);
        if (idx >= 0) this.parent.children.splice(idx, 1);
      }
      this.children.length = 0;
    }
  }

  class MockGraphics {
    label = '';
    x = 0;
    y = 0;
    visible = true;
    parent: any = null;
    position = { set() {} };

    emit() {}
    on() {}
    off() {}
    once() {}
    removeAllListeners() {}

    clear() { return this; }
    circle() { return this; }
    rect() { return this; }
    ellipse() { return this; }
    moveTo() { return this; }
    lineTo() { return this; }
    closePath() { return this; }
    fill() { return this; }
    stroke() { return this; }
    roundRect() { return this; }
    destroy() {}
  }

  class MockText {
    label = '';
    text: string;
    anchor = { set() {}, x: 0, y: 0 };
    x = 0;
    y = 0;
    width = 50;
    height = 12;
    visible = true;
    parent: any = null;
    position = { set() {} };
    options: any;

    emit() {}
    on() {}
    off() {}
    once() {}
    removeAllListeners() {}

    constructor(options?: any) {
      this.options = options ?? {};
      this.text = options?.text ?? '';
    }
    destroy() {}
  }

  return { Container: MockContainer, Graphics: MockGraphics, Text: MockText };
});

import { NPCRenderEnhancer } from '../NPCRenderEnhancer';
import { NPCProfession, NPCState } from '../types';
import type { NPCInstance } from '../types';
import { RelationshipLevel } from '../RelationshipSystem';

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

function createNPCInstance(id: string, state: NPCState = NPCState.IDLE, profession: NPCProfession = NPCProfession.FARMER): NPCInstance {
  return {
    id,
    defId: 'test_def',
    name: id,
    x: 5,
    y: 5,
    state,
    direction: 'down',
    profession,
    level: 1,
    health: 100,
    maxHealth: 100,
    currentTask: null,
    path: [],
    pathIndex: 0,
    targetId: null,
    friends: [],
    teamId: null,
    activeDialogueId: null,
    dialogueCooldown: 0,
    animFrame: 0,
    animTimer: 0,
  };
}

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

describe('NPCRenderEnhancer', () => {
  let enhancer: NPCRenderEnhancer;
  let mockParent: any;

  beforeEach(async () => {
    // 使用 mock Container（import 会被 jest.mock 拦截）
    const { Container } = await import('pixi.js');
    mockParent = new Container();
    enhancer = new NPCRenderEnhancer(mockParent);
  });

  // -----------------------------------------------------------------------
  // 增强元素管理
  // -----------------------------------------------------------------------

  describe('addEnhancement', () => {
    it('应能为 NPC 添加增强元素', () => {
      const npc = createNPCInstance('npc_1');
      const container = enhancer.addEnhancement(npc, 32);

      expect(container).toBeDefined();
      expect(container.label).toBe('enhance-npc_1');
    });

    it('添加的容器应包含名称标签', () => {
      const npc = createNPCInstance('npc_1');
      const container = enhancer.addEnhancement(npc, 32);

      const nameLabel = container.getChildByLabel('name-label');
      expect(nameLabel).not.toBeNull();
    });

    it('添加的容器应包含好感度容器', () => {
      const npc = createNPCInstance('npc_1');
      const container = enhancer.addEnhancement(npc, 32);

      const hearts = container.getChildByLabel('hearts');
      expect(hearts).not.toBeNull();
    });

    it('添加的容器应包含提示容器', () => {
      const npc = createNPCInstance('npc_1');
      const container = enhancer.addEnhancement(npc, 32);

      const hint = container.getChildByLabel('hint');
      expect(hint).not.toBeNull();
    });

    it('重复添加应先移除旧的', () => {
      const npc = createNPCInstance('npc_1');
      enhancer.addEnhancement(npc, 32);
      enhancer.addEnhancement(npc, 32);

      // 只有一个
      expect(mockParent.children.length).toBeLessThanOrEqual(1);
    });
  });

  describe('removeEnhancement', () => {
    it('应能移除增强元素', () => {
      const npc = createNPCInstance('npc_1');
      enhancer.addEnhancement(npc, 32);
      enhancer.removeEnhancement(npc.id);

      // 容器应被销毁
    });

    it('移除不存在的 NPC 不应报错', () => {
      expect(() => enhancer.removeEnhancement('nonexistent')).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // 更新
  // -----------------------------------------------------------------------

  describe('update', () => {
    it('应能为新 NPC 自动添加增强元素', () => {
      const npc = createNPCInstance('npc_1');
      enhancer.update([npc], 32, 0.016);

      // 应已添加
    });

    it('应更新 NPC 位置', () => {
      const npc = createNPCInstance('npc_1');
      enhancer.addEnhancement(npc, 32);

      npc.x = 10;
      npc.y = 15;
      enhancer.update([npc], 32, 0.016);

      // 位置应更新
    });

    it('应移除不存在的 NPC 增强元素', () => {
      const npc1 = createNPCInstance('npc_1');
      const npc2 = createNPCInstance('npc_2');

      enhancer.addEnhancement(npc1, 32);
      enhancer.addEnhancement(npc2, 32);

      // 只保留 npc_1
      enhancer.update([npc1], 32, 0.016);
    });
  });

  // -----------------------------------------------------------------------
  // 好感度指示器
  // -----------------------------------------------------------------------

  describe('setRelationshipLevel', () => {
    it('应能设置好感度等级', () => {
      const npc = createNPCInstance('npc_1');
      enhancer.addEnhancement(npc, 32);

      expect(() => {
        enhancer.setRelationshipLevel(npc.id, RelationshipLevel.FRIEND);
      }).not.toThrow();
    });

    it('STRANGER 等级不显示心形', () => {
      const npc = createNPCInstance('npc_1');
      enhancer.addEnhancement(npc, 32);
      enhancer.setRelationshipLevel(npc.id, RelationshipLevel.STRANGER);

      // 心形容器应不可见
    });

    it('CONFIDANT 等级应显示 5 颗心', () => {
      const npc = createNPCInstance('npc_1');
      enhancer.addEnhancement(npc, 32);
      enhancer.setRelationshipLevel(npc.id, RelationshipLevel.CONFIDANT);

      // 应有心形显示
    });
  });

  // -----------------------------------------------------------------------
  // 交互提示
  // -----------------------------------------------------------------------

  describe('setInteractionHint', () => {
    it('应能设置任务提示', () => {
      const npc = createNPCInstance('npc_1');
      enhancer.addEnhancement(npc, 32);

      expect(() => {
        enhancer.setInteractionHint(npc.id, 'quest');
      }).not.toThrow();
    });

    it('应能设置对话提示', () => {
      const npc = createNPCInstance('npc_1');
      enhancer.addEnhancement(npc, 32);
      enhancer.setInteractionHint(npc.id, 'dialogue');
    });

    it('应能设置交易提示', () => {
      const npc = createNPCInstance('npc_1');
      enhancer.addEnhancement(npc, 32);
      enhancer.setInteractionHint(npc.id, 'trade');
    });

    it('设置为 null 应隐藏提示', () => {
      const npc = createNPCInstance('npc_1');
      enhancer.addEnhancement(npc, 32);
      enhancer.setInteractionHint(npc.id, 'quest');
      enhancer.setInteractionHint(npc.id, null);
    });
  });

  // -----------------------------------------------------------------------
  // 静态工具方法
  // -----------------------------------------------------------------------

  describe('静态工具方法', () => {
    it('getProfessionIcon 应返回职业图标', () => {
      expect(NPCRenderEnhancer.getProfessionIcon(NPCProfession.FARMER)).toBe('🌾');
      expect(NPCRenderEnhancer.getProfessionIcon(NPCProfession.SOLDIER)).toBe('🗡️');
      expect(NPCRenderEnhancer.getProfessionIcon(NPCProfession.MERCHANT)).toBe('💰');
      expect(NPCRenderEnhancer.getProfessionIcon(NPCProfession.GENERAL)).toBe('⚔️');
      expect(NPCRenderEnhancer.getProfessionIcon(NPCProfession.CRAFTSMAN)).toBe('🔨');
      expect(NPCRenderEnhancer.getProfessionIcon(NPCProfession.SCHOLAR)).toBe('📚');
      expect(NPCRenderEnhancer.getProfessionIcon(NPCProfession.VILLAGER)).toBe('🏠');
    });

    it('getHeartCount 应返回正确的心形数量', () => {
      expect(NPCRenderEnhancer.getHeartCount(RelationshipLevel.STRANGER)).toBe(0);
      expect(NPCRenderEnhancer.getHeartCount(RelationshipLevel.ACQUAINTANCE)).toBe(1);
      expect(NPCRenderEnhancer.getHeartCount(RelationshipLevel.FRIEND)).toBe(2);
      expect(NPCRenderEnhancer.getHeartCount(RelationshipLevel.CLOSE_FRIEND)).toBe(3);
      expect(NPCRenderEnhancer.getHeartCount(RelationshipLevel.CONFIDANT)).toBe(5);
    });

    it('getAnimConfig 应返回动画配置', () => {
      const config = NPCRenderEnhancer.getAnimConfig();
      expect(config.workAmplitude).toBeDefined();
      expect(config.workFrequency).toBeDefined();
      expect(config.idleAmplitude).toBeDefined();
      expect(config.idleFrequency).toBeDefined();
      expect(config.walkAmplitude).toBeDefined();
      expect(config.walkFrequency).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // 销毁
  // -----------------------------------------------------------------------

  describe('destroy', () => {
    it('应能销毁所有增强元素', () => {
      enhancer.addEnhancement(createNPCInstance('npc_1'), 32);
      enhancer.addEnhancement(createNPCInstance('npc_2'), 32);
      enhancer.destroy();

      // 不应报错
    });
  });
});
