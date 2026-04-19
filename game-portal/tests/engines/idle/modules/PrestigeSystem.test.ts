import { describe, it, expect } from 'vitest';
import { PrestigeSystem, type PrestigeConfig } from '../../../../src/engines/idle/modules/PrestigeSystem';

// ============================================================
// 测试用配置
// ============================================================

const defaultConfig: PrestigeConfig = {
  currencyName: '星尘',
  currencyIcon: '✨',
  base: 10,
  threshold: 100,
  bonusMultiplier: 0.25,
  retention: 0.1,
};

function createSystem(): PrestigeSystem {
  return new PrestigeSystem(defaultConfig);
}

// ============================================================
// loadState 数据校验测试
// ============================================================

describe('PrestigeSystem — loadState 数据校验', () => {
  it('正常数据应正确恢复', () => {
    const sys = createSystem();
    sys.loadState({ currency: 10, count: 3, bestGain: 5 });
    const state = sys.getState();
    expect(state.currency).toBe(10);
    expect(state.count).toBe(3);
    expect(state.bestGain).toBe(5);
    // multiplier = 1 + 10 * 0.25 = 3.5
    expect(state.multiplier).toBeCloseTo(3.5);
  });

  it('负数 currency 应回退到默认值 0', () => {
    const sys = createSystem();
    sys.loadState({ currency: -5 });
    expect(sys.getState().currency).toBe(0);
  });

  it('负数 count 应回退到默认值 0', () => {
    const sys = createSystem();
    sys.loadState({ count: -1 });
    expect(sys.getState().count).toBe(0);
  });

  it('负数 bestGain 应回退到默认值 0', () => {
    const sys = createSystem();
    sys.loadState({ bestGain: -10 });
    expect(sys.getState().bestGain).toBe(0);
  });

  it('NaN currency 应回退到默认值 0', () => {
    const sys = createSystem();
    sys.loadState({ currency: NaN });
    expect(sys.getState().currency).toBe(0);
  });

  it('NaN count 应回退到默认值 0', () => {
    const sys = createSystem();
    sys.loadState({ count: NaN });
    expect(sys.getState().count).toBe(0);
  });

  it('NaN bestGain 应回退到默认值 0', () => {
    const sys = createSystem();
    sys.loadState({ bestGain: NaN });
    expect(sys.getState().bestGain).toBe(0);
  });

  it('Infinity currency 应回退到默认值 0', () => {
    const sys = createSystem();
    sys.loadState({ currency: Infinity });
    expect(sys.getState().currency).toBe(0);
  });

  it('-Infinity count 应回退到默认值 0', () => {
    const sys = createSystem();
    sys.loadState({ count: -Infinity });
    expect(sys.getState().count).toBe(0);
  });

  it('字符串类型的 currency 应回退到默认值 0', () => {
    const sys = createSystem();
    // @ts-expect-error 故意传入错误类型
    sys.loadState({ currency: 'abc' });
    expect(sys.getState().currency).toBe(0);
  });

  it('null 类型的 count 应回退到默认值 0', () => {
    const sys = createSystem();
    // @ts-expect-error 故意传入错误类型
    sys.loadState({ count: null });
    expect(sys.getState().count).toBe(0);
  });

  it('undefined 字段应保持当前值不变', () => {
    const sys = createSystem();
    sys.loadState({ currency: 5, count: 2, bestGain: 3 });
    sys.loadState({ currency: 8 }); // 只更新 currency
    const state = sys.getState();
    expect(state.currency).toBe(8);
    expect(state.count).toBe(2); // 保持不变
    expect(state.bestGain).toBe(3); // 保持不变
  });

  it('部分合法部分非法应分别处理', () => {
    const sys = createSystem();
    sys.loadState({ currency: -1, count: 5, bestGain: NaN });
    const state = sys.getState();
    expect(state.currency).toBe(0); // 非法，回退
    expect(state.count).toBe(5); // 合法，保留
    expect(state.bestGain).toBe(0); // 非法，回退
  });

  it('空对象不应改变任何状态', () => {
    const sys = createSystem();
    sys.loadState({ currency: 10, count: 2, bestGain: 7 });
    sys.loadState({});
    const state = sys.getState();
    expect(state.currency).toBe(10);
    expect(state.count).toBe(2);
    expect(state.bestGain).toBe(7);
  });

  it('零值应被接受（边界值）', () => {
    const sys = createSystem();
    sys.loadState({ currency: 0, count: 0, bestGain: 0 });
    const state = sys.getState();
    expect(state.currency).toBe(0);
    expect(state.count).toBe(0);
    expect(state.bestGain).toBe(0);
    expect(state.multiplier).toBe(1);
  });

  it('非法 loadState 后 multiplier 仍正确计算', () => {
    const sys = createSystem();
    sys.loadState({ currency: 'bad' as unknown as number, count: 5 });
    const state = sys.getState();
    expect(state.currency).toBe(0);
    // multiplier = 1 + 0 * 0.25 = 1
    expect(state.multiplier).toBe(1);
  });
});

// ============================================================
// 基本功能回归测试
// ============================================================

describe('PrestigeSystem — 基本功能回归', () => {
  it('初始状态正确', () => {
    const sys = createSystem();
    const state = sys.getState();
    expect(state.currency).toBe(0);
    expect(state.count).toBe(0);
    expect(state.multiplier).toBe(1);
    expect(state.bestGain).toBe(0);
  });

  it('canPrestige 在资源不足时返回 false', () => {
    const sys = createSystem();
    expect(sys.canPrestige(50)).toBe(false);
  });

  it('canPrestige 在资源充足时返回 true', () => {
    const sys = createSystem();
    expect(sys.canPrestige(100)).toBe(true);
  });

  it('doPrestige 成功执行', () => {
    const sys = createSystem();
    const result = sys.doPrestige(10000);
    expect(result).not.toBeNull();
    expect(result!.gainedCurrency).toBeGreaterThan(0);
    expect(result!.newState.count).toBe(1);
  });

  it('reset 恢复初始状态', () => {
    const sys = createSystem();
    sys.doPrestige(10000);
    sys.reset();
    const state = sys.getState();
    expect(state.currency).toBe(0);
    expect(state.count).toBe(0);
    expect(state.multiplier).toBe(1);
    expect(state.bestGain).toBe(0);
  });
});
