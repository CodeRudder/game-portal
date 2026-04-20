/**
 * AutoPlayController 单元测试
 */

import {
  AutoPlayController,
  type AutoPlayState,
  type AutoPlayEvent,
} from '../modules/AutoPlayController';

describe('AutoPlayController', () => {
  let controller: AutoPlayController;

  beforeEach(() => {
    controller = new AutoPlayController();
  });

  // ============================================================
  // 初始化
  // ============================================================

  describe('初始化', () => {
    it('应创建空控制器', () => {
      expect(controller.isGlobalEnabled()).toBe(false);
      expect(controller.getState().rules).toEqual({});
    });
  });

  // ============================================================
  // addRule
  // ============================================================

  describe('addRule', () => {
    it('应成功添加规则', () => {
      controller.addRule({
        id: 'auto_upgrade',
        name: '自动升级',
        enabled: true,
        cooldownMs: 1000,
        condition: () => true,
        action: () => {},
      });
      const state = controller.getState();
      expect(state.rules['auto_upgrade']).toBeDefined();
      expect(state.rules['auto_upgrade'].enabled).toBe(true);
    });

    it('应拒绝重复 ID 的规则', () => {
      controller.addRule({
        id: 'r1',
        name: '规则1',
        enabled: true,
        cooldownMs: 1000,
        condition: () => true,
        action: () => {},
      });
      expect(() =>
        controller.addRule({
          id: 'r1',
          name: '规则1重复',
          enabled: false,
          cooldownMs: 500,
          condition: () => true,
          action: () => {},
        }),
      ).toThrow();
    });

    it('添加的规则 lastExecutedAt 应为 0', () => {
      controller.addRule({
        id: 'r1',
        name: '规则1',
        enabled: true,
        cooldownMs: 1000,
        condition: () => true,
        action: () => {},
      });
      expect(controller.getState().rules['r1'].lastExecutedAt).toBe(0);
    });
  });

  // ============================================================
  // removeRule
  // ============================================================

  describe('removeRule', () => {
    it('应成功移除已存在的规则', () => {
      controller.addRule({
        id: 'r1',
        name: '规则1',
        enabled: true,
        cooldownMs: 1000,
        condition: () => true,
        action: () => {},
      });
      expect(controller.removeRule('r1')).toBe(true);
      expect(controller.getState().rules['r1']).toBeUndefined();
    });

    it('移除不存在的规则应返回 false', () => {
      expect(controller.removeRule('nonexistent')).toBe(false);
    });
  });

  // ============================================================
  // enableRule / disableRule
  // ============================================================

  describe('enableRule / disableRule', () => {
    it('enableRule 应启用已禁用的规则', () => {
      controller.addRule({
        id: 'r1',
        name: '规则1',
        enabled: false,
        cooldownMs: 1000,
        condition: () => true,
        action: () => {},
      });
      controller.enableRule('r1');
      expect(controller.getState().rules['r1'].enabled).toBe(true);
    });

    it('disableRule 应禁用已启用的规则', () => {
      controller.addRule({
        id: 'r1',
        name: '规则1',
        enabled: true,
        cooldownMs: 1000,
        condition: () => true,
        action: () => {},
      });
      controller.disableRule('r1');
      expect(controller.getState().rules['r1'].enabled).toBe(false);
    });

    it('enableRule 对不存在的规则应安全无操作', () => {
      expect(() => controller.enableRule('nonexistent')).not.toThrow();
    });

    it('disableRule 对不存在的规则应安全无操作', () => {
      expect(() => controller.disableRule('nonexistent')).not.toThrow();
    });

    it('重复 enableRule 不应重复触发事件', () => {
      controller.addRule({
        id: 'r1',
        name: '规则1',
        enabled: true,
        cooldownMs: 1000,
        condition: () => true,
        action: () => {},
      });
      const handler = jest.fn();
      controller.on(handler);
      controller.enableRule('r1');
      expect(handler).not.toHaveBeenCalled();
    });

    it('重复 disableRule 不应重复触发事件', () => {
      controller.addRule({
        id: 'r1',
        name: '规则1',
        enabled: false,
        cooldownMs: 1000,
        condition: () => true,
        action: () => {},
      });
      const handler = jest.fn();
      controller.on(handler);
      controller.disableRule('r1');
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // setGlobalEnabled
  // ============================================================

  describe('setGlobalEnabled', () => {
    it('应正确设置全局开关', () => {
      controller.setGlobalEnabled(true);
      expect(controller.isGlobalEnabled()).toBe(true);
    });

    it('设置相同值不应触发事件', () => {
      const handler = jest.fn();
      controller.on(handler);
      controller.setGlobalEnabled(false);
      expect(handler).not.toHaveBeenCalled();
    });

    it('切换值应触发 global_toggled 事件', () => {
      const handler = jest.fn();
      controller.on(handler);
      controller.setGlobalEnabled(true);
      expect(handler).toHaveBeenCalledWith({
        type: 'global_toggled',
        data: { enabled: true },
      });
    });
  });

  // ============================================================
  // update
  // ============================================================

  describe('update', () => {
    it('全局关闭时不应执行任何规则', () => {
      const action = jest.fn();
      controller.addRule({
        id: 'r1',
        name: '规则1',
        enabled: true,
        cooldownMs: 0,
        condition: () => true,
        action,
      });
      controller.update(1000);
      expect(action).not.toHaveBeenCalled();
    });

    it('应执行满足条件的规则', () => {
      const action = jest.fn();
      controller.addRule({
        id: 'r1',
        name: '规则1',
        enabled: true,
        cooldownMs: 0,
        condition: () => true,
        action,
      });
      controller.setGlobalEnabled(true);
      controller.update(1000);
      expect(action).toHaveBeenCalledTimes(1);
    });

    it('应跳过禁用的规则', () => {
      const action = jest.fn();
      controller.addRule({
        id: 'r1',
        name: '规则1',
        enabled: false,
        cooldownMs: 0,
        condition: () => true,
        action,
      });
      controller.setGlobalEnabled(true);
      controller.update(1000);
      expect(action).not.toHaveBeenCalled();
    });

    it('应遵守冷却时间', () => {
      const action = jest.fn();
      controller.addRule({
        id: 'r1',
        name: '规则1',
        enabled: true,
        cooldownMs: 5000,
        condition: () => true,
        action,
      });
      controller.setGlobalEnabled(true);
      controller.update(10000);
      expect(action).toHaveBeenCalledTimes(1);
      // 冷却期内不应再次执行（10000 + 3000 = 13000 < 15000）
      controller.update(13000);
      expect(action).toHaveBeenCalledTimes(1);
      // 冷却期后应再次执行（16000 >= 15000）
      controller.update(16000);
      expect(action).toHaveBeenCalledTimes(2);
    });

    it('condition 返回 false 时不应执行', () => {
      const action = jest.fn();
      controller.addRule({
        id: 'r1',
        name: '规则1',
        enabled: true,
        cooldownMs: 0,
        condition: () => false,
        action,
      });
      controller.setGlobalEnabled(true);
      controller.update(1000);
      expect(action).not.toHaveBeenCalled();
    });

    it('应触发 rule_executed 事件', () => {
      const handler = jest.fn();
      controller.addRule({
        id: 'r1',
        name: '规则1',
        enabled: true,
        cooldownMs: 0,
        condition: () => true,
        action: () => {},
      });
      controller.setGlobalEnabled(true);
      controller.on(handler);
      controller.update(1000);
      expect(handler).toHaveBeenCalledWith({
        type: 'rule_executed',
        data: { ruleId: 'r1', ruleName: '规则1' },
      });
    });

    it('应按顺序执行多条规则', () => {
      const order: string[] = [];
      controller.addRule({
        id: 'r1',
        name: '规则1',
        enabled: true,
        cooldownMs: 0,
        condition: () => true,
        action: () => order.push('r1'),
      });
      controller.addRule({
        id: 'r2',
        name: '规则2',
        enabled: true,
        cooldownMs: 0,
        condition: () => true,
        action: () => order.push('r2'),
      });
      controller.setGlobalEnabled(true);
      controller.update(1000);
      expect(order).toEqual(['r1', 'r2']);
    });
  });

  // ============================================================
  // 事件系统
  // ============================================================

  describe('事件系统', () => {
    it('enableRule 应触发 rule_enabled 事件', () => {
      const handler = jest.fn();
      controller.addRule({
        id: 'r1',
        name: '规则1',
        enabled: false,
        cooldownMs: 1000,
        condition: () => true,
        action: () => {},
      });
      controller.on(handler);
      controller.enableRule('r1');
      expect(handler).toHaveBeenCalledWith({
        type: 'rule_enabled',
        data: { ruleId: 'r1' },
      });
    });

    it('disableRule 应触发 rule_disabled 事件', () => {
      const handler = jest.fn();
      controller.addRule({
        id: 'r1',
        name: '规则1',
        enabled: true,
        cooldownMs: 1000,
        condition: () => true,
        action: () => {},
      });
      controller.on(handler);
      controller.disableRule('r1');
      expect(handler).toHaveBeenCalledWith({
        type: 'rule_disabled',
        data: { ruleId: 'r1' },
      });
    });

    it('off 应正确注销监听器', () => {
      const handler = jest.fn();
      controller.on(handler);
      controller.off(handler);
      controller.setGlobalEnabled(true);
      expect(handler).not.toHaveBeenCalled();
    });

    it('注销未注册的监听器应安全无操作', () => {
      const handler = jest.fn();
      expect(() => controller.off(handler)).not.toThrow();
    });
  });

  // ============================================================
  // getState / loadState
  // ============================================================

  describe('getState / loadState', () => {
    it('getState 应返回正确状态', () => {
      controller.addRule({
        id: 'r1',
        name: '规则1',
        enabled: true,
        cooldownMs: 1000,
        condition: () => true,
        action: () => {},
      });
      controller.setGlobalEnabled(true);
      const state = controller.getState();
      expect(state.globalEnabled).toBe(true);
      expect(state.rules['r1'].enabled).toBe(true);
      expect(state.rules['r1'].lastExecutedAt).toBe(0);
    });

    it('loadState 应正确恢复状态', () => {
      controller.addRule({
        id: 'r1',
        name: '规则1',
        enabled: true,
        cooldownMs: 1000,
        condition: () => true,
        action: () => {},
      });
      const state: AutoPlayState = {
        globalEnabled: true,
        rules: {
          r1: { enabled: false, lastExecutedAt: 5000 },
        },
      };
      controller.loadState(state);
      expect(controller.isGlobalEnabled()).toBe(true);
      expect(controller.getState().rules['r1'].enabled).toBe(false);
      expect(controller.getState().rules['r1'].lastExecutedAt).toBe(5000);
    });

    it('loadState 应忽略未注册的规则', () => {
      const state: AutoPlayState = {
        globalEnabled: true,
        rules: {
          unknown_rule: { enabled: true, lastExecutedAt: 0 },
        },
      };
      expect(() => controller.loadState(state)).not.toThrow();
    });

    it('loadState 应拒绝不合法的 globalEnabled', () => {
      expect(() =>
        controller.loadState({ globalEnabled: 'true' as unknown as boolean, rules: {} }),
      ).toThrow();
    });

    it('loadState 应拒绝不合法的 rules', () => {
      expect(() =>
        controller.loadState({ globalEnabled: true, rules: null as unknown as AutoPlayState['rules'] }),
      ).toThrow();
    });

    it('loadState 应拒绝不合法的规则状态', () => {
      controller.addRule({
        id: 'r1',
        name: '规则1',
        enabled: true,
        cooldownMs: 1000,
        condition: () => true,
        action: () => {},
      });
      expect(() =>
        controller.loadState({
          globalEnabled: true,
          rules: { r1: { enabled: 'yes' as unknown as boolean, lastExecutedAt: 0 } },
        }),
      ).toThrow();
      expect(() =>
        controller.loadState({
          globalEnabled: true,
          rules: { r1: { enabled: true, lastExecutedAt: -1 } },
        }),
      ).toThrow();
    });
  });

  // ============================================================
  // reset
  // ============================================================

  describe('reset', () => {
    it('应重置全局开关', () => {
      controller.setGlobalEnabled(true);
      controller.reset();
      expect(controller.isGlobalEnabled()).toBe(false);
    });

    it('应重置规则的 lastExecutedAt', () => {
      controller.addRule({
        id: 'r1',
        name: '规则1',
        enabled: true,
        cooldownMs: 0,
        condition: () => true,
        action: () => {},
      });
      controller.setGlobalEnabled(true);
      controller.update(1000);
      expect(controller.getState().rules['r1'].lastExecutedAt).toBe(1000);
      controller.reset();
      expect(controller.getState().rules['r1'].lastExecutedAt).toBe(0);
    });

    it('应保留规则定义', () => {
      controller.addRule({
        id: 'r1',
        name: '规则1',
        enabled: true,
        cooldownMs: 1000,
        condition: () => true,
        action: () => {},
      });
      controller.reset();
      expect(controller.getState().rules['r1']).toBeDefined();
    });
  });
});
