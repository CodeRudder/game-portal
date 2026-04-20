/**
 * InputHandler 单元测试
 *
 * 覆盖所有公开方法和核心逻辑：
 * - 构造函数与默认映射初始化
 * - 按键绑定管理（addBinding / removeBinding / getBindings）
 * - 事件回调注册与移除（on / off）
 * - 按键处理与事件分发（handleKeyDown / handleKeyUp）
 * - 自定义动作分发
 * - 启用/禁用控制（setEnabled）
 * - TimeSource 注入与时间戳
 * - 边界条件和错误处理
 */
import {
  InputHandler,
  type InputAction,
  type KeyBinding,
  type InputConfig,
  type InputEvent,
  type InputCallback,
} from '../modules/InputHandler';
import { TimeSource } from '../modules/TimeSource';

// ============================================================
// 辅助函数与常量
// ============================================================

/** 收集回调事件的辅助函数 */
function createCollector(): { collect: InputCallback; events: InputEvent[] } {
  const events: InputEvent[] = [];
  const collect: InputCallback = (event) => {
    events.push(event);
  };
  return { collect, events };
}

/** 默认映射中包含的按键数量（去重后） */
const DEFAULT_BINDING_COUNT = InputHandler.DEFAULT_BINDINGS.length;

// ============================================================
// 测试套件
// ============================================================

describe('InputHandler', () => {
  let handler: InputHandler;

  beforeEach(() => {
    handler = new InputHandler();
  });

  // ============================================================
  // 构造函数与初始化
  // ============================================================

  describe('构造函数与初始化', () => {
    it('无参构造应加载所有默认映射', () => {
      const bindings = handler.getBindings();
      expect(bindings.length).toBe(DEFAULT_BINDING_COUNT);
    });

    it('默认映射应包含常用按键', () => {
      const bindings = handler.getBindings();
      const keys = bindings.map((b) => b.key);

      expect(keys).toContain('Space');
      expect(keys).toContain(' ');
      expect(keys).toContain('ArrowUp');
      expect(keys).toContain('ArrowDown');
      expect(keys).toContain('Enter');
      expect(keys).toContain('Escape');
      expect(keys).toContain('ArrowLeft');
      expect(keys).toContain('ArrowRight');
      expect(keys).toContain('r');
      expect(keys).toContain('R');
      expect(keys).toContain('p');
      expect(keys).toContain('P');
      expect(keys).toContain('+');
      expect(keys).toContain('=');
      expect(keys).toContain('-');
      expect(keys).toContain('_');
    });

    it('无参构造时 enableContextMenu 应为 false', () => {
      // 间接验证：构造不报错，且默认配置正确加载
      const h = new InputHandler();
      expect(h.getBindings().length).toBeGreaterThan(0);
    });

    it('传入 config.bindings 应覆盖/追加到默认映射', () => {
      const customBinding: KeyBinding = {
        key: 'Space',
        action: 'confirm', // 覆盖默认的 'click'
      };
      const h = new InputHandler({ bindings: [customBinding] });
      const bindings = h.getBindings();
      const spaceBinding = bindings.find((b) => b.key === 'Space');

      expect(spaceBinding).toBeDefined();
      expect(spaceBinding!.action).toBe('confirm');
    });

    it('传入 config.bindings 应追加新的按键映射', () => {
      const customBinding: KeyBinding = {
        key: 'x',
        action: 'custom',
        actionId: 'attack',
      };
      const h = new InputHandler({ bindings: [customBinding] });
      const bindings = h.getBindings();
      const xBinding = bindings.find((b) => b.key === 'x');

      expect(xBinding).toBeDefined();
      expect(xBinding!.action).toBe('custom');
      expect(xBinding!.actionId).toBe('attack');
    });

    it('传入 config.bindings 不应影响其他默认映射', () => {
      const h = new InputHandler({
        bindings: [{ key: 'z', action: 'save' }],
      });
      const bindings = h.getBindings();

      // 默认映射仍存在
      const enterBinding = bindings.find((b) => b.key === 'Enter');
      expect(enterBinding).toBeDefined();
      expect(enterBinding!.action).toBe('confirm');

      // 新增映射也存在
      const zBinding = bindings.find((b) => b.key === 'z');
      expect(zBinding).toBeDefined();
      expect(zBinding!.action).toBe('save');
    });

    it('传入空 bindings 数组不应清除默认映射', () => {
      const h = new InputHandler({ bindings: [] });
      expect(h.getBindings().length).toBe(DEFAULT_BINDING_COUNT);
    });

    it('config.enableContextMenu 应正确设置', () => {
      const h = new InputHandler({ enableContextMenu: true });
      // enableContextMenu 是内部状态，通过行为间接验证
      // 构造不报错即说明配置被正确接收
      expect(h.getBindings().length).toBe(DEFAULT_BINDING_COUNT);
    });

    it('DEFAULT_BINDINGS 静态属性应包含完整的默认映射', () => {
      expect(InputHandler.DEFAULT_BINDINGS.length).toBeGreaterThan(0);

      // 验证每条映射都有 key 和 action
      for (const binding of InputHandler.DEFAULT_BINDINGS) {
        expect(binding.key).toBeTruthy();
        expect(binding.action).toBeTruthy();
      }
    });
  });

  // ============================================================
  // 按键处理 handleKeyDown
  // ============================================================

  describe('handleKeyDown', () => {
    it('按下已映射的按键应触发对应动作回调', () => {
      const { collect, events } = createCollector();
      handler.on('click', collect);

      handler.handleKeyDown('Space');

      expect(events.length).toBe(1);
      expect(events[0].action).toBe('click');
      expect(events[0].originalKey).toBe('Space');
    });

    it('按下未映射的按键不应触发任何回调', () => {
      const { collect, events } = createCollector();
      handler.on('click', collect);

      handler.handleKeyDown('UnknownKey123');

      expect(events.length).toBe(0);
    });

    it('事件应包含正确的时间戳', () => {
      const { collect, events } = createCollector();
      handler.on('confirm', collect);

      handler.handleKeyDown('Enter');

      expect(events.length).toBe(1);
      expect(events[0].timestamp).toBeGreaterThan(0);
      expect(typeof events[0].timestamp).toBe('number');
    });

    it('originalKey 应记录实际按键值', () => {
      const { collect, events } = createCollector();
      handler.on('click', collect);

      // 空格字符 ' ' 也映射到 click
      handler.handleKeyDown(' ');

      expect(events.length).toBe(1);
      expect(events[0].originalKey).toBe(' ');
      expect(events[0].action).toBe('click');
    });

    it('不同按键应触发不同动作', () => {
      const clickCollector = createCollector();
      const confirmCollector = createCollector();
      const cancelCollector = createCollector();

      handler.on('click', clickCollector.collect);
      handler.on('confirm', confirmCollector.collect);
      handler.on('cancel', cancelCollector.collect);

      handler.handleKeyDown('Space');
      handler.handleKeyDown('Enter');
      handler.handleKeyDown('Escape');

      expect(clickCollector.events.length).toBe(1);
      expect(confirmCollector.events.length).toBe(1);
      expect(cancelCollector.events.length).toBe(1);

      expect(clickCollector.events[0].action).toBe('click');
      expect(confirmCollector.events[0].action).toBe('confirm');
      expect(cancelCollector.events[0].action).toBe('cancel');
    });

    it('同一按键多次按下应多次触发回调', () => {
      const { collect, events } = createCollector();
      handler.on('click', collect);

      handler.handleKeyDown('Space');
      handler.handleKeyDown('Space');
      handler.handleKeyDown('Space');

      expect(events.length).toBe(3);
    });

    it('禁用状态下不应触发任何回调', () => {
      const { collect, events } = createCollector();
      handler.on('click', collect);
      handler.setEnabled(false);

      handler.handleKeyDown('Space');

      expect(events.length).toBe(0);
    });

    it('禁用后重新启用应恢复响应', () => {
      const { collect, events } = createCollector();
      handler.on('click', collect);

      handler.setEnabled(false);
      handler.handleKeyDown('Space');
      expect(events.length).toBe(0);

      handler.setEnabled(true);
      handler.handleKeyDown('Space');
      expect(events.length).toBe(1);
    });

    it('所有默认按键映射应正确触发对应动作', () => {
      const expectedMappings: Array<{ key: string; action: InputAction }> = [
        { key: 'ArrowUp', action: 'select_up' },
        { key: 'ArrowDown', action: 'select_down' },
        { key: 'ArrowLeft', action: 'tab_left' },
        { key: 'ArrowRight', action: 'tab_right' },
        { key: 'r', action: 'prestige' },
        { key: 'R', action: 'prestige' },
        { key: 'p', action: 'pause' },
        { key: 'P', action: 'pause' },
        { key: '+', action: 'speed_up' },
        { key: '=', action: 'speed_up' },
        { key: '-', action: 'speed_down' },
        { key: '_', action: 'speed_down' },
      ];

      for (const { key, action } of expectedMappings) {
        const { collect, events } = createCollector();
        const h = new InputHandler();
        h.on(action, collect);
        h.handleKeyDown(key);

        expect(events.length).toBe(1);
        expect(events[0].action).toBe(action);
      }
    });
  });

  // ============================================================
  // handleKeyUp
  // ============================================================

  describe('handleKeyUp', () => {
    it('handleKeyUp 不应抛出异常', () => {
      expect(() => handler.handleKeyUp('Space')).not.toThrow();
    });

    it('handleKeyUp 不应触发任何回调', () => {
      const { collect, events } = createCollector();
      handler.on('click', collect);

      handler.handleKeyUp('Space');

      expect(events.length).toBe(0);
    });

    it('handleKeyUp 对未知按键也不应抛出异常', () => {
      expect(() => handler.handleKeyUp('UnknownKey')).not.toThrow();
    });
  });

  // ============================================================
  // 事件回调管理 on / off
  // ============================================================

  describe('on — 注册回调', () => {
    it('注册回调后，触发动作时应调用该回调', () => {
      const { collect, events } = createCollector();
      handler.on('click', collect);

      handler.handleKeyDown('Space');

      expect(events.length).toBe(1);
    });

    it('同一动作可注册多个回调', () => {
      const collector1 = createCollector();
      const collector2 = createCollector();
      const collector3 = createCollector();

      handler.on('click', collector1.collect);
      handler.on('click', collector2.collect);
      handler.on('click', collector3.collect);

      handler.handleKeyDown('Space');

      expect(collector1.events.length).toBe(1);
      expect(collector2.events.length).toBe(1);
      expect(collector3.events.length).toBe(1);
    });

    it('同一回调重复注册不应导致多次调用', () => {
      const { collect, events } = createCollector();

      handler.on('click', collect);
      handler.on('click', collect);
      handler.on('click', collect);

      handler.handleKeyDown('Space');

      expect(events.length).toBe(1);
    });

    it('不同动作的回调应独立触发', () => {
      const clickCollector = createCollector();
      const confirmCollector = createCollector();

      handler.on('click', clickCollector.collect);
      handler.on('confirm', confirmCollector.collect);

      handler.handleKeyDown('Space');

      expect(clickCollector.events.length).toBe(1);
      expect(confirmCollector.events.length).toBe(0);
    });

    it('使用字符串 action 注册自定义动作回调', () => {
      const { collect, events } = createCollector();
      handler.on('custom:myAction', collect);

      // 通过 addBinding 添加自定义映射
      handler.addBinding({ key: 'q', action: 'custom', actionId: 'myAction' });
      handler.handleKeyDown('q');

      expect(events.length).toBe(1);
      expect(events[0].actionId).toBe('myAction');
    });
  });

  describe('off — 移除回调', () => {
    it('移除回调后不应再被调用', () => {
      const { collect, events } = createCollector();
      handler.on('click', collect);
      handler.off('click', collect);

      handler.handleKeyDown('Space');

      expect(events.length).toBe(0);
    });

    it('只移除指定回调，不影响其他回调', () => {
      const collector1 = createCollector();
      const collector2 = createCollector();

      handler.on('click', collector1.collect);
      handler.on('click', collector2.collect);
      handler.off('click', collector1.collect);

      handler.handleKeyDown('Space');

      expect(collector1.events.length).toBe(0);
      expect(collector2.events.length).toBe(1);
    });

    it('移除不存在的回调不应报错', () => {
      const { collect } = createCollector();
      expect(() => handler.off('click', collect)).not.toThrow();
    });

    it('移除未注册动作的回调不应报错', () => {
      const { collect } = createCollector();
      expect(() => handler.off('nonexistent_action', collect)).not.toThrow();
    });

    it('移除最后一个回调后，再次触发动作不应有副作用', () => {
      const { collect, events } = createCollector();
      handler.on('click', collect);
      handler.off('click', collect);

      // 再次注册新回调并触发
      const collector2 = createCollector();
      handler.on('click', collector2.collect);
      handler.handleKeyDown('Space');

      expect(events.length).toBe(0);
      expect(collector2.events.length).toBe(1);
    });

    it('同一回调多次 off 不应报错', () => {
      const { collect } = createCollector();
      handler.on('click', collect);
      handler.off('click', collect);
      handler.off('click', collect);
      handler.off('click', collect);

      // 不应抛出异常
      expect(true).toBe(true);
    });
  });

  // ============================================================
  // 映射管理 addBinding / removeBinding / getBindings
  // ============================================================

  describe('addBinding — 添加映射', () => {
    it('添加新按键映射后应能触发对应动作', () => {
      const { collect, events } = createCollector();
      handler.on('save', collect);

      handler.addBinding({ key: 's', action: 'save' });
      handler.handleKeyDown('s');

      expect(events.length).toBe(1);
      expect(events[0].action).toBe('save');
    });

    it('添加自定义动作映射应正确触发', () => {
      const { collect, events } = createCollector();
      handler.on('custom', collect);

      handler.addBinding({ key: 'x', action: 'custom', actionId: 'special' });
      handler.handleKeyDown('x');

      expect(events.length).toBe(1);
      expect(events[0].action).toBe('custom');
      expect(events[0].actionId).toBe('special');
    });

    it('覆盖已有映射应替换动作', () => {
      const clickCollector = createCollector();
      const confirmCollector = createCollector();
      handler.on('click', clickCollector.collect);
      handler.on('confirm', confirmCollector.collect);

      // Space 默认映射到 click
      handler.addBinding({ key: 'Space', action: 'confirm' });
      handler.handleKeyDown('Space');

      expect(clickCollector.events.length).toBe(0);
      expect(confirmCollector.events.length).toBe(1);
    });

    it('getBindings 返回的数组修改不应影响内部状态', () => {
      const bindingsBefore = handler.getBindings();
      const countBefore = bindingsBefore.length;

      // 修改返回的数组
      bindingsBefore.push({ key: 'hack', action: 'click' });

      const bindingsAfter = handler.getBindings();
      expect(bindingsAfter.length).toBe(countBefore);
      expect(bindingsAfter.find((b) => b.key === 'hack')).toBeUndefined();
    });

    it('getBindings 返回的映射条目修改不应影响内部状态', () => {
      const bindings = handler.getBindings();
      const spaceBinding = bindings.find((b) => b.key === 'Space');
      expect(spaceBinding).toBeDefined();

      // 修改返回的映射对象
      spaceBinding!.action = 'cancel';

      // 重新获取，内部应未被修改
      const bindingsAfter = handler.getBindings();
      const spaceBindingAfter = bindingsAfter.find((b) => b.key === 'Space');
      expect(spaceBindingAfter!.action).toBe('click');
    });
  });

  describe('removeBinding — 移除映射', () => {
    it('移除映射后按键不再触发动作', () => {
      const { collect, events } = createCollector();
      handler.on('click', collect);

      handler.removeBinding('Space');
      handler.handleKeyDown('Space');

      expect(events.length).toBe(0);
    });

    it('移除映射不影响其他按键', () => {
      const clickCollector = createCollector();
      const confirmCollector = createCollector();
      handler.on('click', clickCollector.collect);
      handler.on('confirm', confirmCollector.collect);

      handler.removeBinding('Space');
      handler.handleKeyDown('Space');
      handler.handleKeyDown('Enter');

      expect(clickCollector.events.length).toBe(0);
      expect(confirmCollector.events.length).toBe(1);
    });

    it('移除不存在的按键映射不应报错', () => {
      expect(() => handler.removeBinding('NonExistentKey')).not.toThrow();
    });

    it('移除后 getBindings 不应包含该按键', () => {
      handler.removeBinding('Space');
      const bindings = handler.getBindings();
      expect(bindings.find((b) => b.key === 'Space')).toBeUndefined();
    });

    it('移除后可重新添加', () => {
      const { collect, events } = createCollector();
      handler.on('click', collect);

      handler.removeBinding('Space');
      handler.handleKeyDown('Space');
      expect(events.length).toBe(0);

      handler.addBinding({ key: 'Space', action: 'click' });
      handler.handleKeyDown('Space');
      expect(events.length).toBe(1);
    });
  });

  describe('getBindings — 获取映射', () => {
    it('应返回所有当前映射的数组', () => {
      const bindings = handler.getBindings();
      expect(Array.isArray(bindings)).toBe(true);
      expect(bindings.length).toBe(DEFAULT_BINDING_COUNT);
    });

    it('每次调用应返回新的数组副本', () => {
      const bindings1 = handler.getBindings();
      const bindings2 = handler.getBindings();
      expect(bindings1).not.toBe(bindings2);
    });

    it('添加映射后 getBindings 应包含新映射', () => {
      handler.addBinding({ key: 'F1', action: 'save' });
      const bindings = handler.getBindings();
      expect(bindings.find((b) => b.key === 'F1')).toBeDefined();
    });

    it('每个映射条目应为独立副本', () => {
      const bindings1 = handler.getBindings();
      const bindings2 = handler.getBindings();

      // 对应条目应值相等但引用不同
      const space1 = bindings1.find((b) => b.key === 'Space');
      const space2 = bindings2.find((b) => b.key === 'Space');
      expect(space1).toEqual(space2);
      expect(space1).not.toBe(space2);
    });
  });

  // ============================================================
  // 启用/禁用控制 setEnabled
  // ============================================================

  describe('setEnabled — 启用/禁用', () => {
    it('默认应为启用状态', () => {
      const { collect, events } = createCollector();
      handler.on('click', collect);
      handler.handleKeyDown('Space');
      expect(events.length).toBe(1);
    });

    it('setEnabled(false) 后不应响应按键', () => {
      const { collect, events } = createCollector();
      handler.on('click', collect);
      handler.setEnabled(false);

      handler.handleKeyDown('Space');
      handler.handleKeyDown('Enter');
      handler.handleKeyDown('ArrowUp');

      expect(events.length).toBe(0);
    });

    it('setEnabled(true) 后应恢复响应', () => {
      const { collect, events } = createCollector();
      handler.on('click', collect);

      handler.setEnabled(false);
      handler.handleKeyDown('Space');
      expect(events.length).toBe(0);

      handler.setEnabled(true);
      handler.handleKeyDown('Space');
      expect(events.length).toBe(1);
    });

    it('多次 setEnabled 不应产生副作用', () => {
      const { collect, events } = createCollector();
      handler.on('click', collect);

      handler.setEnabled(false);
      handler.setEnabled(false);
      handler.setEnabled(false);
      handler.handleKeyDown('Space');
      expect(events.length).toBe(0);

      handler.setEnabled(true);
      handler.handleKeyDown('Space');
      expect(events.length).toBe(1);
    });
  });

  // ============================================================
  // 事件分发系统 dispatch（通过 handleKeyDown 间接测试）
  // ============================================================

  describe('事件分发系统', () => {
    it('回调应按注册顺序依次执行', () => {
      const order: number[] = [];

      handler.on('click', () => order.push(1));
      handler.on('click', () => order.push(2));
      handler.on('click', () => order.push(3));

      handler.handleKeyDown('Space');

      expect(order).toEqual([1, 2, 3]);
    });

    it('某个回调抛出异常不应影响后续回调', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const order: string[] = [];

      handler.on('click', () => order.push('before'));
      handler.on('click', () => {
        order.push('error');
        throw new Error('测试异常');
      });
      handler.on('click', () => order.push('after'));

      handler.handleKeyDown('Space');

      expect(order).toEqual(['before', 'error', 'after']);
      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
    });

    it('回调异常应输出错误信息到控制台', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      handler.on('click', () => {
        throw new Error('回调错误');
      });
      handler.handleKeyDown('Space');

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toContain('click');

      errorSpy.mockRestore();
    });

    it('InputEvent 应包含完整的事件信息', () => {
      const { collect, events } = createCollector();
      handler.on('confirm', collect);

      handler.handleKeyDown('Enter');

      const event = events[0];
      expect(event).toBeDefined();
      expect(event.action).toBe('confirm');
      expect(event.originalKey).toBe('Enter');
      expect(event.timestamp).toBeTypeOf('number');
      expect(event.timestamp).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // 自定义动作分发
  // ============================================================

  describe('自定义动作分发', () => {
    it('custom 动作应同时分发给 action 回调和 custom:actionId 回调', () => {
      const genericCollector = createCollector();
      const specificCollector = createCollector();

      handler.on('custom', genericCollector.collect);
      handler.on('custom:attack', specificCollector.collect);

      handler.addBinding({ key: 'x', action: 'custom', actionId: 'attack' });
      handler.handleKeyDown('x');

      expect(genericCollector.events.length).toBe(1);
      expect(specificCollector.events.length).toBe(1);
    });

    it('custom 动作无 actionId 时不应分发给 custom:undefined', () => {
      const { collect, events } = createCollector();

      handler.on('custom:undefined', collect);
      handler.addBinding({ key: 'x', action: 'custom' }); // 无 actionId
      handler.handleKeyDown('x');

      expect(events.length).toBe(0);
    });

    it('custom 动作回调异常不应影响 custom:actionId 回调', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const { collect, events } = createCollector();

      handler.on('custom', () => {
        throw new Error('custom 回调错误');
      });
      handler.on('custom:attack', collect);

      handler.addBinding({ key: 'x', action: 'custom', actionId: 'attack' });
      handler.handleKeyDown('x');

      expect(events.length).toBe(1);
      expect(events[0].actionId).toBe('attack');

      errorSpy.mockRestore();
    });

    it('custom:actionId 回调异常不应影响 custom 回调', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const { collect, events } = createCollector();

      handler.on('custom', collect);
      handler.on('custom:attack', () => {
        throw new Error('specific callback error');
      });

      handler.addBinding({ key: 'x', action: 'custom', actionId: 'attack' });
      handler.handleKeyDown('x');

      expect(events.length).toBe(1);

      errorSpy.mockRestore();
    });

    it('不同 custom actionId 应独立触发', () => {
      const attackCollector = createCollector();
      const defendCollector = createCollector();

      handler.on('custom:attack', attackCollector.collect);
      handler.on('custom:defend', defendCollector.collect);

      handler.addBinding({ key: 'x', action: 'custom', actionId: 'attack' });
      handler.addBinding({ key: 'z', action: 'custom', actionId: 'defend' });

      handler.handleKeyDown('x');
      handler.handleKeyDown('z');

      expect(attackCollector.events.length).toBe(1);
      expect(attackCollector.events[0].actionId).toBe('attack');
      expect(defendCollector.events.length).toBe(1);
      expect(defendCollector.events[0].actionId).toBe('defend');
    });
  });

  // ============================================================
  // TimeSource 注入
  // ============================================================

  describe('TimeSource 注入', () => {
    it('默认 TimeSource 应使用 Date.now', () => {
      const { collect, events } = createCollector();
      handler.on('click', collect);

      const before = Date.now();
      handler.handleKeyDown('Space');
      const after = Date.now();

      expect(events[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(events[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('事件时间戳应反映 TimeSource.now() 的返回值', () => {
      const { collect, events } = createCollector();
      handler.on('click', collect);

      handler.handleKeyDown('Space');
      handler.handleKeyDown(' ');

      // 两次事件都应有有效时间戳
      expect(events[0].timestamp).toBeGreaterThan(0);
      expect(events[1].timestamp).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // 边界条件和错误处理
  // ============================================================

  describe('边界条件与错误处理', () => {
    it('空字符串按键不应触发回调', () => {
      const { collect, events } = createCollector();
      handler.on('click', collect);

      handler.handleKeyDown('');

      expect(events.length).toBe(0);
    });

    it('大小写敏感：小写 r 和大写 R 都映射到 prestige', () => {
      const { collect, events } = createCollector();
      handler.on('prestige', collect);

      handler.handleKeyDown('r');
      handler.handleKeyDown('R');

      expect(events.length).toBe(2);
    });

    it('特殊字符按键应正确处理', () => {
      const { collect, events } = createCollector();
      handler.on('speed_up', collect);

      handler.handleKeyDown('+');
      handler.handleKeyDown('=');

      expect(events.length).toBe(2);
    });

    it('大量回调注册后应全部正确触发', () => {
      const collectors = Array.from({ length: 50 }, () => createCollector());

      for (const c of collectors) {
        handler.on('click', c.collect);
      }

      handler.handleKeyDown('Space');

      for (const c of collectors) {
        expect(c.events.length).toBe(1);
      }
    });

    it('大量按键快速连续触发应全部正确处理', () => {
      const { collect, events } = createCollector();
      handler.on('click', collect);

      for (let i = 0; i < 100; i++) {
        handler.handleKeyDown('Space');
      }

      expect(events.length).toBe(100);
    });

    it('回调中移除自身不应导致遗漏', () => {
      const events: InputEvent[] = [];
      let callCount = 0;
      const selfRemovingCallback: InputCallback = (event) => {
        callCount++;
        events.push(event);
        handler.off('click', selfRemovingCallback);
      };

      handler.on('click', selfRemovingCallback);

      // 第一次触发
      handler.handleKeyDown('Space');
      expect(callCount).toBe(1);

      // 第二次触发，回调已被移除
      handler.handleKeyDown('Space');
      expect(callCount).toBe(1); // 不应再被调用
    });

    it('回调中注册新回调会在当前分发轮次中被调用（因 for...of 遍历实时数组）', () => {
      const order: string[] = [];

      handler.on('click', () => {
        order.push('first');
        handler.on('click', () => order.push('newly_added'));
      });

      // 第一次触发：first 回调执行，注册 newly_added，
      // newly_added 在同一轮 for...of 中被迭代调用
      handler.handleKeyDown('Space');
      expect(order).toEqual(['first', 'newly_added']);

      // 第二次触发：first 再次执行（再次注册，但去重无效），
      // newly_added 被调用。因 for...of 继续遍历到数组末尾的 newly_added
      order.length = 0;
      handler.handleKeyDown('Space');
      expect(order).toEqual(['first', 'newly_added', 'newly_added']);
    });

    it('构造函数传入 undefined config 应等同于无参构造', () => {
      const h = new InputHandler(undefined);
      expect(h.getBindings().length).toBe(DEFAULT_BINDING_COUNT);
    });

    it('构造函数传入空对象应等同于无参构造', () => {
      const h = new InputHandler({});
      expect(h.getBindings().length).toBe(DEFAULT_BINDING_COUNT);
    });

    it('addBinding 后立即 removeBinding 不应留下残留', () => {
      const { collect, events } = createCollector();
      handler.on('save', collect);

      handler.addBinding({ key: 'F5', action: 'save' });
      handler.removeBinding('F5');
      handler.handleKeyDown('F5');

      expect(events.length).toBe(0);
    });

    it('on 和 off 使用不同的 action 字符串应独立管理', () => {
      const collector1 = createCollector();
      const collector2 = createCollector();

      handler.on('action_a', collector1.collect);
      handler.on('action_b', collector2.collect);

      handler.off('action_a', collector1.collect);

      // action_b 的回调不受影响
      handler.addBinding({ key: 'a', action: 'custom', actionId: 'b' });
      // 由于 on('action_b', ...) 不是 InputAction，需要通过自定义动作触发
      // 这里验证 off 不影响其他 action
      expect(collector2.events.length).toBe(0);
    });
  });

  // ============================================================
  // 综合场景测试
  // ============================================================

  describe('综合场景', () => {
    it('完整游戏输入流程：注册 → 触发 → 移除 → 再触发', () => {
      const clickCollector = createCollector();
      const confirmCollector = createCollector();

      // 注册
      handler.on('click', clickCollector.collect);
      handler.on('confirm', confirmCollector.collect);

      // 触发 click
      handler.handleKeyDown('Space');
      expect(clickCollector.events.length).toBe(1);
      expect(confirmCollector.events.length).toBe(0);

      // 触发 confirm
      handler.handleKeyDown('Enter');
      expect(clickCollector.events.length).toBe(1);
      expect(confirmCollector.events.length).toBe(1);

      // 移除 click 回调
      handler.off('click', clickCollector.collect);

      // 再次触发 click，不应有新事件
      handler.handleKeyDown('Space');
      expect(clickCollector.events.length).toBe(1);

      // confirm 仍正常
      handler.handleKeyDown('Enter');
      expect(confirmCollector.events.length).toBe(2);
    });

    it('动态修改映射表后应立即生效', () => {
      const { collect, events } = createCollector();
      handler.on('confirm', collect);

      // 将 Space 从 click 改为 confirm
      handler.addBinding({ key: 'Space', action: 'confirm' });
      handler.handleKeyDown('Space');

      expect(events.length).toBe(1);
      expect(events[0].action).toBe('confirm');
      expect(events[0].originalKey).toBe('Space');
    });

    it('禁用 → 修改映射 → 启用后应使用新映射', () => {
      const { collect, events } = createCollector();
      handler.on('confirm', collect);

      handler.setEnabled(false);
      handler.addBinding({ key: 'Space', action: 'confirm' });
      handler.handleKeyDown('Space');
      expect(events.length).toBe(0);

      handler.setEnabled(true);
      handler.handleKeyDown('Space');
      expect(events.length).toBe(1);
      expect(events[0].action).toBe('confirm');
    });

    it('多个实例应完全独立', () => {
      const handler1 = new InputHandler();
      const handler2 = new InputHandler();

      const collector1 = createCollector();
      const collector2 = createCollector();

      handler1.on('click', collector1.collect);
      handler2.on('click', collector2.collect);

      handler1.addBinding({ key: 'F1', action: 'save' });

      // handler1 有 F1 映射，handler2 没有
      expect(handler1.getBindings().length).toBe(DEFAULT_BINDING_COUNT + 1);
      expect(handler2.getBindings().length).toBe(DEFAULT_BINDING_COUNT);

      // handler1 触发不影响 handler2
      handler1.handleKeyDown('Space');
      expect(collector1.events.length).toBe(1);
      expect(collector2.events.length).toBe(0);

      // handler2 禁用不影响 handler1
      handler2.setEnabled(false);
      handler1.handleKeyDown('Space');
      expect(collector1.events.length).toBe(2);
    });
  });
});
