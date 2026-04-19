/**
 * ConfigRegistry 单元测试
 *
 * 覆盖：get/set 基本功能、类型安全 get<T>、loadFromConstants 批量加载、
 * has/delete、getOrDefault 默认值、validate 校验、getAll 快照、
 * clear/size、ConfigError、边界条件。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigRegistry, ConfigError } from '../ConfigRegistry';

// ─────────────────────────────────────────────
// 1. get / set 基本功能
// ─────────────────────────────────────────────
describe('ConfigRegistry — get / set 基本功能', () => {
  let registry: ConfigRegistry;

  beforeEach(() => {
    registry = new ConfigRegistry();
  });

  it('set 后 get 应返回设置的值', () => {
    registry.set('KEY', 'value');
    expect(registry.get('KEY')).toBe('value');
  });

  it('set 数字值', () => {
    registry.set('NUM', 42);
    expect(registry.get('NUM')).toBe(42);
  });

  it('set 布尔值', () => {
    registry.set('FLAG', true);
    expect(registry.get('FLAG')).toBe(true);
  });

  it('set 对象值', () => {
    const obj = { a: 1, b: 'hello' };
    registry.set('OBJ', obj);
    expect(registry.get('OBJ')).toEqual(obj);
  });

  it('set null 值', () => {
    registry.set('NULL_KEY', null);
    expect(registry.get('NULL_KEY')).toBeNull();
  });

  it('set undefined 值', () => {
    registry.set('UNDEF_KEY', undefined);
    expect(registry.get('UNDEF_KEY')).toBeUndefined();
  });

  it('覆盖已有值应返回最新值', () => {
    registry.set('OVERRIDE', 'old');
    registry.set('OVERRIDE', 'new');
    expect(registry.get('OVERRIDE')).toBe('new');
  });

  it('get 不存在的 key 应抛出 ConfigError', () => {
    expect(() => registry.get('NON_EXISTENT')).toThrow(ConfigError);
  });

  it('ConfigError 应包含正确的 key', () => {
    try {
      registry.get('MISSING_KEY');
      expect.unreachable('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigError);
      expect((e as ConfigError).key).toBe('MISSING_KEY');
      expect((e as ConfigError).message).toContain('MISSING_KEY');
    }
  });
});

// ─────────────────────────────────────────────
// 2. 类型安全的 get<T>
// ─────────────────────────────────────────────
describe('ConfigRegistry — 类型安全 get<T>', () => {
  let registry: ConfigRegistry;

  beforeEach(() => {
    registry = new ConfigRegistry();
  });

  it('get<number> 应返回数字类型', () => {
    registry.set('PORT', 3000);
    const port: number = registry.get<number>('PORT');
    expect(typeof port).toBe('number');
    expect(port).toBe(3000);
  });

  it('get<string> 应返回字符串类型', () => {
    registry.set('HOST', 'localhost');
    const host: string = registry.get<string>('HOST');
    expect(typeof host).toBe('string');
    expect(host).toBe('localhost');
  });

  it('get<Record<string, number>> 应返回对象', () => {
    const config = { maxRetries: 3, timeout: 5000 };
    registry.set('RETRY_CONFIG', config);
    const result = registry.get<Record<string, number>>('RETRY_CONFIG');
    expect(result.maxRetries).toBe(3);
    expect(result.timeout).toBe(5000);
  });
});

// ─────────────────────────────────────────────
// 3. loadFromConstants 批量加载
// ─────────────────────────────────────────────
describe('ConfigRegistry — loadFromConstants', () => {
  let registry: ConfigRegistry;

  beforeEach(() => {
    registry = new ConfigRegistry();
  });

  it('应批量导入键值对', () => {
    registry.loadFromConstants({
      TICK_INTERVAL_MS: 1000,
      MAX_LEVEL: 30,
      GAME_NAME: 'Three Kingdoms',
    });

    expect(registry.get('TICK_INTERVAL_MS')).toBe(1000);
    expect(registry.get('MAX_LEVEL')).toBe(30);
    expect(registry.get('GAME_NAME')).toBe('Three Kingdoms');
  });

  it('应覆盖已存在的键', () => {
    registry.set('EXISTING', 'old');
    registry.loadFromConstants({ EXISTING: 'new' });

    expect(registry.get('EXISTING')).toBe('new');
  });

  it('空对象不应影响已有配置', () => {
    registry.set('KEEP', 'value');
    registry.loadFromConstants({});

    expect(registry.get('KEEP')).toBe('value');
  });

  it('应支持 loadFromConstants 后继续 set', () => {
    registry.loadFromConstants({ A: 1 });
    registry.set('B', 2);

    expect(registry.get('A')).toBe(1);
    expect(registry.get('B')).toBe(2);
  });

  it('多次 loadFromConstants 应合并', () => {
    registry.loadFromConstants({ A: 1 });
    registry.loadFromConstants({ B: 2 });

    expect(registry.get('A')).toBe(1);
    expect(registry.get('B')).toBe(2);
  });
});

// ─────────────────────────────────────────────
// 4. has / delete
// ─────────────────────────────────────────────
describe('ConfigRegistry — has / delete', () => {
  let registry: ConfigRegistry;

  beforeEach(() => {
    registry = new ConfigRegistry();
  });

  it('has 对存在的键应返回 true', () => {
    registry.set('EXISTS', true);
    expect(registry.has('EXISTS')).toBe(true);
  });

  it('has 对不存在的键应返回 false', () => {
    expect(registry.has('NOT_EXISTS')).toBe(false);
  });

  it('delete 应移除指定键', () => {
    registry.set('DEL_ME', 'value');
    registry.delete('DEL_ME');

    expect(registry.has('DEL_ME')).toBe(false);
    expect(() => registry.get('DEL_ME')).toThrow(ConfigError);
  });

  it('delete 不存在的键应静默忽略', () => {
    expect(() => registry.delete('GHOST')).not.toThrow();
  });

  it('delete 后 size 应减少', () => {
    registry.set('A', 1);
    registry.set('B', 2);
    expect(registry.size).toBe(2);

    registry.delete('A');
    expect(registry.size).toBe(1);
  });
});

// ─────────────────────────────────────────────
// 5. getOrDefault — 默认值处理
// ─────────────────────────────────────────────
describe('ConfigRegistry — getOrDefault', () => {
  let registry: ConfigRegistry;

  beforeEach(() => {
    registry = new ConfigRegistry();
  });

  it('键存在时应返回实际值', () => {
    registry.set('PORT', 8080);
    expect(registry.getOrDefault('PORT', 3000)).toBe(8080);
  });

  it('键不存在时应返回默认值', () => {
    expect(registry.getOrDefault('MISSING', 42)).toBe(42);
  });

  it('默认值为对象时应正确返回', () => {
    const defaultObj = { retries: 3 };
    expect(registry.getOrDefault('CONFIG', defaultObj)).toEqual(defaultObj);
  });

  it('默认值为 null 时应正确返回', () => {
    expect(registry.getOrDefault('NULL_KEY', null)).toBeNull();
  });

  it('键存在但值为 undefined 时应返回 undefined（非默认值）', () => {
    registry.set('UNDEF', undefined);
    expect(registry.getOrDefault('UNDEF', 'fallback')).toBeUndefined();
  });

  it('键存在但值为 null 时应返回 null（非默认值）', () => {
    registry.set('NULL_VAL', null);
    expect(registry.getOrDefault('NULL_VAL', 'fallback')).toBeNull();
  });
});

// ─────────────────────────────────────────────
// 6. validate — 配置校验
// ─────────────────────────────────────────────
describe('ConfigRegistry — validate', () => {
  let registry: ConfigRegistry;

  beforeEach(() => {
    registry = new ConfigRegistry();
  });

  it('校验通过应返回 true', () => {
    registry.set('PORT', 3000);
    expect(registry.validate('PORT', (v) => typeof v === 'number' && v > 0)).toBe(true);
  });

  it('校验失败应返回 false', () => {
    registry.set('PORT', -1);
    expect(registry.validate('PORT', (v) => typeof v === 'number' && v > 0)).toBe(false);
  });

  it('键不存在时应返回 false', () => {
    expect(registry.validate('MISSING', () => true)).toBe(false);
  });

  it('复杂校验逻辑应正常工作', () => {
    registry.set('CONFIG', { maxLevel: 50, minLevel: 1 });
    const isValid = registry.validate('CONFIG', (v) => {
      const cfg = v as { maxLevel: number; minLevel: number };
      return cfg.maxLevel > cfg.minLevel;
    });
    expect(isValid).toBe(true);
  });
});

// ─────────────────────────────────────────────
// 7. getAll — 快照导出
// ─────────────────────────────────────────────
describe('ConfigRegistry — getAll', () => {
  let registry: ConfigRegistry;

  beforeEach(() => {
    registry = new ConfigRegistry();
  });

  it('应返回所有配置的浅拷贝', () => {
    registry.set('A', 1);
    registry.set('B', 'hello');

    const all = registry.getAll();

    expect(all).toEqual({ A: 1, B: 'hello' });
  });

  it('修改返回值不应影响注册表', () => {
    registry.set('IMMUTABLE', 'value');
    const all = registry.getAll();
    all['IMMUTABLE'] = 'changed';
    all['NEW_KEY'] = 'new';

    expect(registry.get('IMMUTABLE')).toBe('value');
    expect(registry.has('NEW_KEY')).toBe(false);
  });

  it('空注册表应返回空对象', () => {
    expect(registry.getAll()).toEqual({});
  });
});

// ─────────────────────────────────────────────
// 8. clear / size
// ─────────────────────────────────────────────
describe('ConfigRegistry — clear / size', () => {
  let registry: ConfigRegistry;

  beforeEach(() => {
    registry = new ConfigRegistry();
  });

  it('size 应返回配置项数量', () => {
    expect(registry.size).toBe(0);

    registry.set('A', 1);
    expect(registry.size).toBe(1);

    registry.set('B', 2);
    expect(registry.size).toBe(2);
  });

  it('clear 应清空所有配置', () => {
    registry.set('A', 1);
    registry.set('B', 2);
    registry.set('C', 3);

    registry.clear();

    expect(registry.size).toBe(0);
    expect(() => registry.get('A')).toThrow(ConfigError);
    expect(() => registry.get('B')).toThrow(ConfigError);
    expect(() => registry.get('C')).toThrow(ConfigError);
  });

  it('clear 后可重新 set', () => {
    registry.set('X', 'old');
    registry.clear();
    registry.set('X', 'new');

    expect(registry.get('X')).toBe('new');
    expect(registry.size).toBe(1);
  });
});

// ─────────────────────────────────────────────
// 9. ConfigError 类
// ─────────────────────────────────────────────
describe('ConfigRegistry — ConfigError', () => {
  it('应包含正确的 name 属性', () => {
    const err = new ConfigError('TEST_KEY', 'test message');
    expect(err.name).toBe('ConfigError');
  });

  it('应包含正确的 key 属性', () => {
    const err = new ConfigError('MY_KEY', 'something wrong');
    expect(err.key).toBe('MY_KEY');
  });

  it('message 应包含 key 和描述', () => {
    const err = new ConfigError('MY_KEY', 'something wrong');
    expect(err.message).toContain('MY_KEY');
    expect(err.message).toContain('something wrong');
  });

  it('应是 Error 的子类', () => {
    const err = new ConfigError('KEY', 'msg');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ConfigError);
  });
});

// ─────────────────────────────────────────────
// 10. 边界条件
// ─────────────────────────────────────────────
describe('ConfigRegistry — 边界条件', () => {
  let registry: ConfigRegistry;

  beforeEach(() => {
    registry = new ConfigRegistry();
  });

  it('空字符串作为 key 应正常工作', () => {
    registry.set('', 'empty key');
    expect(registry.get('')).toBe('empty key');
    expect(registry.has('')).toBe(true);
  });

  it('特殊字符作为 key 应正常工作', () => {
    registry.set('a:b:c:d', 'nested key');
    expect(registry.get('a:b:c:d')).toBe('nested key');
  });

  it('数组作为值应正常工作', () => {
    registry.set('ARRAY', [1, 2, 3]);
    expect(registry.get<number[]>('ARRAY')).toEqual([1, 2, 3]);
  });

  it('Map / Set 作为值应正常工作', () => {
    const map = new Map([['a', 1]]);
    const set = new Set([1, 2, 3]);
    registry.set('MAP', map);
    registry.set('SET', set);

    expect(registry.get('MAP')).toBe(map);
    expect(registry.get('SET')).toBe(set);
  });

  it('大量配置项应正常工作', () => {
    const data: Record<string, number> = {};
    for (let i = 0; i < 1000; i++) {
      data[`KEY_${i}`] = i;
    }
    registry.loadFromConstants(data);

    expect(registry.size).toBe(1000);
    expect(registry.get('KEY_500')).toBe(500);
  });

  it('set 覆盖为不同类型应正常工作', () => {
    registry.set('TYPE_CHANGE', 'string');
    registry.set('TYPE_CHANGE', 42);
    expect(registry.get('TYPE_CHANGE')).toBe(42);
  });
});
