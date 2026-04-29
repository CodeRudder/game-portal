/**
 * SaveManager 边界条件测试
 *
 * 覆盖场景：
 * 1. 保存空数据
 * 2. 加载不存在的存档
 * 3. 保存超大数据
 * 4. 存档版本不匹配
 * 5. 损坏的存档数据
 * 6. 删除后加载
 * 7. 连续多次保存
 * 8. 自动保存启停
 * 9. 旧格式JSON加载
 * 10. 自定义saveKey
 * 11. 循环引用数据保存
 * 12. 重复删除不崩溃
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SaveManager } from '../SaveManager';
import type { IGameState } from '../../types/state';
import type { IConfigRegistry } from '../../types/config';

// ── 辅助函数 ──

/** 创建最小可用的游戏状态 */
function createState(overrides: Partial<IGameState> = {}): IGameState {
  return {
    version: '1.0.0',
    timestamp: Date.now(),
    subsystems: {},
    metadata: {
      totalPlayTime: 0,
      saveCount: 0,
      lastVersion: '1.0.0',
    },
    ...overrides,
  };
}

/** 创建 mock 配置注册表 */
function createConfig(kv: Record<string, unknown> = {}): IConfigRegistry {
  return {
    has: (key: string) => key in kv,
    get: (key: string) => kv[key],
    set: vi.fn(),
    delete: vi.fn(),
    loadFromConstants: vi.fn(),
    getAll: () => kv,
  };
}

describe('SaveManager 边界条件测试', () => {
  let sm: SaveManager;

  beforeEach(() => {
    localStorage.clear();
    sm = new SaveManager();
  });

  // ── 1. 保存空数据 ──
  it('保存最小空数据应成功', () => {
    const state = createState();
    expect(sm.save(state)).toBe(true);
    expect(sm.hasSaveData()).toBe(true);
  });

  // ── 2. 加载不存在的存档 ──
  it('加载不存在的存档应返回null', () => {
    expect(sm.load()).toBeNull();
    expect(sm.hasSaveData()).toBe(false);
  });

  // ── 3. 保存超大数据 ──
  it('保存超大subsystems数据应返回boolean而不崩溃', () => {
    const bigSubsystems: Record<string, unknown> = {};
    for (let i = 0; i < 5000; i++) {
      bigSubsystems[`key_${i}`] = 'x'.repeat(100);
    }
    const state = createState({ subsystems: bigSubsystems });
    const result = sm.save(state);
    expect(typeof result).toBe('boolean');
  });

  // ── 4. 存档版本不匹配（新格式存入旧版本号） ──
  it('存入不同版本号后加载应能正确恢复', () => {
    const state = createState({ version: '2.0.0' });
    sm.save(state);
    const loaded = sm.load();
    // 新格式序列化 → 版本由序列化器管理，加载后版本应为 '1.0.0'
    expect(loaded).not.toBeNull();
    if (loaded) {
      expect(loaded.version).toBe('1.0.0');
    }
  });

  // ── 5. 损坏的存档数据 ──
  it('localStorage中损坏的JSON加载应返回null', () => {
    localStorage.setItem('three-kingdoms-save', '{invalid json!!!');
    expect(sm.load()).toBeNull();
  });

  // ── 6. 删除后加载 ──
  it('删除存档后加载应返回null', () => {
    sm.save(createState());
    sm.deleteSave();
    expect(sm.load()).toBeNull();
    expect(sm.hasSaveData()).toBe(false);
  });

  // ── 7. 连续多次保存 ──
  it('连续保存3次后saveCount应为3', () => {
    sm.save(createState());
    sm.save(createState());
    sm.save(createState());
    expect(sm.getSaveCount()).toBe(3);
  });

  // ── 8. 自动保存启停 ──
  it('启动自动保存后isAutoSaving应为true，停止后为false', () => {
    vi.useFakeTimers();
    sm.startAutoSave(() => createState(), 1000);
    expect(sm.isAutoSaving).toBe(true);
    vi.advanceTimersByTime(2500);
    expect(sm.getSaveCount()).toBeGreaterThanOrEqual(2);
    sm.stopAutoSave();
    expect(sm.isAutoSaving).toBe(false);
    vi.useRealTimers();
  });

  // ── 9. 旧格式JSON加载 ──
  it('旧格式JSON（非新序列化格式）加载应返回null', () => {
    const legacy = JSON.stringify({
      version: '0.9.0',
      timestamp: Date.now(),
      subsystems: {},
      metadata: { totalPlayTime: 0, saveCount: 1, lastVersion: '0.9.0' },
    });
    localStorage.setItem('three-kingdoms-save', legacy);
    expect(sm.load()).toBeNull();
  });

  // ── 10. 自定义saveKey ──
  it('自定义saveKey应使用不同的localStorage键', () => {
    const config = createConfig({ SAVE_KEY: 'my-custom-save' });
    const customSm = new SaveManager(config);
    customSm.save(createState());
    expect(localStorage.getItem('my-custom-save')).not.toBeNull();
    expect(localStorage.getItem('three-kingdoms-save')).toBeNull();
  });

  // ── 11. 循环引用数据保存 ──
  it('保存含循环引用的对象应返回false而不崩溃', () => {
    const state = createState();
    (state as Record<string, unknown>).self = state;
    expect(sm.save(state)).toBe(false);
  });

  // ── 12. 重复删除不崩溃 ──
  it('连续多次删除存档不应崩溃', () => {
    sm.save(createState());
    sm.deleteSave();
    sm.deleteSave();
    sm.deleteSave();
    expect(sm.hasSaveData()).toBe(false);
    expect(sm.getSaveCount()).toBe(0);
  });
});
