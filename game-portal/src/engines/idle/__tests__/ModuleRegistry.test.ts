/**
 * ModuleRegistry 单元测试
 *
 * 覆盖范围：
 * - register() 注册与重复注册
 * - unregister() 注销与不存在模块
 * - get() 获取模块实例（泛型、不存在）
 * - has() 检查模块存在性
 * - getAll() 获取所有模块
 * - getDescriptor() 获取模块描述符
 * - size() 模块数量
 * - validateDependencies() 依赖验证（满足、不满足、空依赖）
 * - initAll() 批量初始化
 * - updateAll() 批量更新
 * - resetAll() 批量重置
 * - reset() 重置注册中心
 * - snapshot() 生成快照（含/不含可序列化模块）
 * - restore() 从快照恢复
 * - 边界条件和错误处理
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ModuleRegistry,
  type ModuleDescriptor,
  type RegistrySnapshot,
} from '../modules/ModuleRegistry';

// ============================================================
// 测试用辅助工具
// ============================================================

/** 创建一个简单的测试模块 */
function createTestModule(id: string, methods?: Record<string, unknown>) {
  return {
    id,
    ...methods,
  };
}

/** 创建一个支持完整生命周期的模块 */
function createFullModule(id: string) {
  return {
    id,
    inited: false,
    updated: false,
    resetted: false,
    state: { count: 0 },

    init() { this.inited = true; },
    update(dt: number) { this.updated = true; },
    reset() { this.resetted = true; this.state.count = 0; },
    getState() { return { ...this.state }; },
    setState(s: unknown) { this.state = s as { count: number }; },
  };
}

/** 创建模块描述符 */
function createDescriptor<T>(
  id: string,
  module: T,
  deps?: string[],
): ModuleDescriptor<T> {
  return {
    id,
    name: `测试模块-${id}`,
    version: '1.0.0',
    dependencies: deps,
    module,
  };
}

// ============================================================
// 测试套件
// ============================================================

describe('ModuleRegistry', () => {
  let registry: ModuleRegistry;

  beforeEach(() => {
    registry = new ModuleRegistry();
  });

  // ========== register() ==========

  describe('register()', () => {
    it('应成功注册模块', () => {
      const mod = createTestModule('mod-a');
      registry.register(createDescriptor('mod-a', mod));

      expect(registry.has('mod-a')).toBe(true);
      expect(registry.size()).toBe(1);
    });

    it('应支持泛型注册和获取', () => {
      const mod = { name: '建筑系统', level: 5 };
      registry.register(createDescriptor('building', mod));

      const result = registry.get<{ name: string; level: number }>('building');
      expect(result).toEqual({ name: '建筑系统', level: 5 });
    });

    it('应在重复注册时抛出错误', () => {
      registry.register(createDescriptor('mod-a', createTestModule('mod-a')));

      expect(() => {
        registry.register(createDescriptor('mod-a', createTestModule('mod-a-2')));
      }).toThrow('已注册');
    });

    it('应支持注册多个不同模块', () => {
      registry.register(createDescriptor('mod-a', createTestModule('mod-a')));
      registry.register(createDescriptor('mod-b', createTestModule('mod-b')));
      registry.register(createDescriptor('mod-c', createTestModule('mod-c')));

      expect(registry.size()).toBe(3);
    });

    it('应支持注册无依赖的模块', () => {
      registry.register(createDescriptor('mod-a', createTestModule('mod-a'), undefined));
      expect(registry.size()).toBe(1);
    });
  });

  // ========== unregister() ==========

  describe('unregister()', () => {
    it('应成功注销已注册的模块', () => {
      registry.register(createDescriptor('mod-a', createTestModule('mod-a')));
      const result = registry.unregister('mod-a');

      expect(result).toBe(true);
      expect(registry.has('mod-a')).toBe(false);
    });

    it('应在注销不存在的模块时返回 false', () => {
      const result = registry.unregister('nonexistent');
      expect(result).toBe(false);
    });

    it('注销后应允许重新注册相同 ID', () => {
      registry.register(createDescriptor('mod-a', createTestModule('mod-a')));
      registry.unregister('mod-a');
      registry.register(createDescriptor('mod-a', createTestModule('mod-a-2')));

      expect(registry.has('mod-a')).toBe(true);
    });

    it('注销一个模块不应影响其他模块', () => {
      registry.register(createDescriptor('mod-a', createTestModule('mod-a')));
      registry.register(createDescriptor('mod-b', createTestModule('mod-b')));
      registry.unregister('mod-a');

      expect(registry.has('mod-a')).toBe(false);
      expect(registry.has('mod-b')).toBe(true);
    });
  });

  // ========== get() ==========

  describe('get()', () => {
    it('应返回已注册的模块实例', () => {
      const mod = createTestModule('mod-a');
      registry.register(createDescriptor('mod-a', mod));

      expect(registry.get('mod-a')).toBe(mod);
    });

    it('应在模块不存在时返回 undefined', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });

    it('应支持泛型类型获取', () => {
      const mod = createFullModule('full');
      registry.register(createDescriptor('full', mod));

      const result = registry.get<ReturnType<typeof createFullModule>>('full');
      expect(result?.id).toBe('full');
      expect(typeof result?.init).toBe('function');
    });
  });

  // ========== has() ==========

  describe('has()', () => {
    it('应在模块已注册时返回 true', () => {
      registry.register(createDescriptor('mod-a', createTestModule('mod-a')));
      expect(registry.has('mod-a')).toBe(true);
    });

    it('应在模块未注册时返回 false', () => {
      expect(registry.has('nonexistent')).toBe(false);
    });

    it('应在注销后返回 false', () => {
      registry.register(createDescriptor('mod-a', createTestModule('mod-a')));
      registry.unregister('mod-a');
      expect(registry.has('mod-a')).toBe(false);
    });
  });

  // ========== getAll() ==========

  describe('getAll()', () => {
    it('应在无模块时返回空 Map', () => {
      const all = registry.getAll();
      expect(all.size).toBe(0);
    });

    it('应返回所有已注册模块', () => {
      const modA = createTestModule('mod-a');
      const modB = createTestModule('mod-b');
      registry.register(createDescriptor('mod-a', modA));
      registry.register(createDescriptor('mod-b', modB));

      const all = registry.getAll();
      expect(all.size).toBe(2);
      expect(all.get('mod-a')).toBe(modA);
      expect(all.get('mod-b')).toBe(modB);
    });

    it('返回的 Map 应为浅拷贝', () => {
      registry.register(createDescriptor('mod-a', createTestModule('mod-a')));
      const all = registry.getAll();
      all.delete('mod-a');

      // 原注册中心不受影响
      expect(registry.has('mod-a')).toBe(true);
    });
  });

  // ========== getDescriptor() ==========

  describe('getDescriptor()', () => {
    it('应返回模块的完整描述符', () => {
      const mod = createTestModule('mod-a');
      const deps = ['mod-b', 'mod-c'];
      registry.register(createDescriptor('mod-a', mod, deps));

      const desc = registry.getDescriptor('mod-a');
      expect(desc).toBeDefined();
      expect(desc?.id).toBe('mod-a');
      expect(desc?.name).toBe('测试模块-mod-a');
      expect(desc?.version).toBe('1.0.0');
      expect(desc?.dependencies).toEqual(['mod-b', 'mod-c']);
      expect(desc?.module).toBe(mod);
    });

    it('应在模块不存在时返回 undefined', () => {
      expect(registry.getDescriptor('nonexistent')).toBeUndefined();
    });
  });

  // ========== size() ==========

  describe('size()', () => {
    it('初始状态应为 0', () => {
      expect(registry.size()).toBe(0);
    });

    it('注册后应正确反映数量', () => {
      registry.register(createDescriptor('a', {}));
      registry.register(createDescriptor('b', {}));
      registry.register(createDescriptor('c', {}));

      expect(registry.size()).toBe(3);
    });

    it('注销后应正确减少', () => {
      registry.register(createDescriptor('a', {}));
      registry.register(createDescriptor('b', {}));
      registry.unregister('a');

      expect(registry.size()).toBe(1);
    });
  });

  // ========== validateDependencies() ==========

  describe('validateDependencies()', () => {
    it('无依赖时应返回空数组', () => {
      registry.register(createDescriptor('a', {}));
      expect(registry.validateDependencies()).toEqual([]);
    });

    it('所有依赖满足时应返回空数组', () => {
      registry.register(createDescriptor('a', {}));
      registry.register(createDescriptor('b', {}, ['a']));

      expect(registry.validateDependencies()).toEqual([]);
    });

    it('依赖不满足时应返回未满足的模块 ID', () => {
      registry.register(createDescriptor('b', {}, ['a'])); // a 未注册

      const result = registry.validateDependencies();
      expect(result).toEqual(['b']);
    });

    it('应返回所有依赖不满足的模块', () => {
      registry.register(createDescriptor('a', {}, ['x']));
      registry.register(createDescriptor('b', {}, ['y']));
      registry.register(createDescriptor('c', {})); // 无依赖

      const result = registry.validateDependencies();
      expect(result).toContain('a');
      expect(result).toContain('b');
      expect(result).not.toContain('c');
    });

    it('部分依赖不满足时也应报告', () => {
      registry.register(createDescriptor('a', {}));
      registry.register(createDescriptor('b', {}, ['a', 'missing']));

      const result = registry.validateDependencies();
      expect(result).toEqual(['b']);
    });
  });

  // ========== 生命周期 ==========

  describe('initAll()', () => {
    it('应调用所有支持 init 的模块', () => {
      const mod = createFullModule('full');
      registry.register(createDescriptor('full', mod));

      expect(mod.inited).toBe(false);
      registry.initAll();
      expect(mod.inited).toBe(true);
    });

    it('应跳过不支持 init 的模块', () => {
      const mod = createTestModule('simple');
      expect(() => registry.initAll()).not.toThrow();
    });
  });

  describe('updateAll()', () => {
    it('应调用所有支持 update 的模块', () => {
      const mod = createFullModule('full');
      registry.register(createDescriptor('full', mod));

      registry.updateAll(0.016);
      expect(mod.updated).toBe(true);
    });
  });

  describe('resetAll()', () => {
    it('应调用所有支持 reset 的模块', () => {
      const mod = createFullModule('full');
      mod.state.count = 42;
      registry.register(createDescriptor('full', mod));

      registry.resetAll();
      expect(mod.resetted).toBe(true);
      expect(mod.state.count).toBe(0);
    });
  });

  describe('reset()', () => {
    it('应清除所有已注册模块', () => {
      registry.register(createDescriptor('a', createFullModule('a')));
      registry.register(createDescriptor('b', createFullModule('b')));

      registry.reset();
      expect(registry.size()).toBe(0);
    });

    it('应先调用各模块的 reset 方法', () => {
      const mod = createFullModule('full');
      registry.register(createDescriptor('full', mod));

      registry.reset();
      expect(mod.resetted).toBe(true);
    });
  });

  // ========== 快照 ==========

  describe('snapshot()', () => {
    it('应生成包含版本和时间戳的快照', () => {
      const snap = registry.snapshot();

      expect(snap.version).toBe('1.0.0');
      expect(snap.timestamp).toBeGreaterThan(0);
      expect(snap.modules).toEqual([]);
    });

    it('应包含所有支持 getState 的模块', () => {
      const mod = createFullModule('full');
      mod.state.count = 42;
      registry.register(createDescriptor('full', mod));

      const snap = registry.snapshot();
      expect(snap.modules).toHaveLength(1);
      expect(snap.modules[0].moduleId).toBe('full');
      expect(snap.modules[0].state).toEqual({ count: 42 });
    });

    it('应跳过不支持 getState 的模块', () => {
      registry.register(createDescriptor('simple', createTestModule('simple')));

      const snap = registry.snapshot();
      expect(snap.modules).toHaveLength(0);
    });

    it('应包含多个可序列化模块', () => {
      registry.register(createDescriptor('a', createFullModule('a')));
      registry.register(createDescriptor('b', createFullModule('b')));
      registry.register(createDescriptor('c', createTestModule('c')));

      const snap = registry.snapshot();
      expect(snap.modules).toHaveLength(2);
    });
  });

  describe('restore()', () => {
    it('应恢复支持 setState 的模块状态', () => {
      const mod = createFullModule('full');
      registry.register(createDescriptor('full', mod));

      const snapshot: RegistrySnapshot = {
        version: '1.0.0',
        timestamp: Date.now(),
        modules: [{ moduleId: 'full', state: { count: 99 } }],
      };

      registry.restore(snapshot);
      expect(mod.state.count).toBe(99);
    });

    it('应跳过快照中未注册的模块', () => {
      const snapshot: RegistrySnapshot = {
        version: '1.0.0',
        timestamp: Date.now(),
        modules: [{ moduleId: 'nonexistent', state: {} }],
      };

      expect(() => registry.restore(snapshot)).not.toThrow();
    });

    it('应跳过不支持 setState 的已注册模块', () => {
      registry.register(createDescriptor('simple', createTestModule('simple')));

      const snapshot: RegistrySnapshot = {
        version: '1.0.0',
        timestamp: Date.now(),
        modules: [{ moduleId: 'simple', state: { foo: 'bar' } }],
      };

      expect(() => registry.restore(snapshot)).not.toThrow();
    });

    it('快照 → 恢复的往返测试', () => {
      const mod = createFullModule('full');
      mod.state.count = 100;
      registry.register(createDescriptor('full', mod));

      const snap = registry.snapshot();
      mod.state.count = 0; // 修改状态

      registry.restore(snap);
      expect(mod.state.count).toBe(100);
    });
  });
});
