/**
 * PrestigeSystem 单元测试
 */
import {
  PrestigeSystem,
  type PrestigeConfig,
  type PrestigeState,
} from '@/engines/idle/modules/PrestigeSystem';

// ============================================================
// 测试用默认配置
// ============================================================

const defaultConfig: PrestigeConfig = {
  currencyName: '星尘',
  currencyIcon: '✨',
  base: 10,
  threshold: 100,
  bonusMultiplier: 0.25,
  retention: 0.1,
};

function createSystem(config: Partial<PrestigeConfig> = {}): PrestigeSystem {
  return new PrestigeSystem({ ...defaultConfig, ...config });
}

// ============================================================
// 构造函数
// ============================================================

describe('PrestigeSystem', () => {
  describe('constructor', () => {
    it('应使用默认值初始化状态', () => {
      const sys = createSystem();
      const state = sys.getState();
      expect(state.currency).toBe(0);
      expect(state.count).toBe(0);
      expect(state.multiplier).toBe(1);
      expect(state.bestGain).toBe(0);
    });

    it('应正确存储配置', () => {
      const sys = createSystem();
      expect(sys.getCurrencyName()).toBe('星尘');
      expect(sys.getCurrencyIcon()).toBe('✨');
      expect(sys.getRetentionRate()).toBe(0.1);
    });
  });

  // ============================================================
  // canPrestige
  // ============================================================

  describe('canPrestige', () => {
    it('资源低于阈值时返回 false', () => {
      const sys = createSystem({ threshold: 100 });
      expect(sys.canPrestige(0)).toBe(false);
      expect(sys.canPrestige(50)).toBe(false);
      expect(sys.canPrestige(99)).toBe(false);
    });

    it('资源等于阈值时返回 true', () => {
      const sys = createSystem({ threshold: 100 });
      expect(sys.canPrestige(100)).toBe(true);
    });

    it('资源超过阈值时返回 true', () => {
      const sys = createSystem({ threshold: 100 });
      expect(sys.canPrestige(1000)).toBe(true);
      expect(sys.canPrestige(1_000_000)).toBe(true);
    });

    it('负数资源返回 false', () => {
      const sys = createSystem({ threshold: 100 });
      expect(sys.canPrestige(-1)).toBe(false);
      expect(sys.canPrestige(-100)).toBe(false);
    });
  });

  // ============================================================
  // calculateGain
  // ============================================================

  describe('calculateGain', () => {
    it('资源为 0 或负数时返回 0', () => {
      const sys = createSystem();
      expect(sys.calculateGain(0)).toBe(0);
      expect(sys.calculateGain(-1)).toBe(0);
      expect(sys.calculateGain(-100)).toBe(0);
    });

    it('资源低于阈值时返回 0', () => {
      const sys = createSystem({ base: 10, threshold: 100 });
      // threshold + 50 = 150, log10(150) ≈ 2.176, floor = 2
      // log10(100) = 2, floor = 2
      // gain = 2 - 2 = 0
      expect(sys.calculateGain(50)).toBe(0);
    });

    it('资源刚好使 gain = 1 的情况', () => {
      const sys = createSystem({ base: 10, threshold: 100 });
      // 需要 threshold + total > 1000, 即 total > 900
      // log10(100 + 901) = log10(1001) ≈ 3.0004, floor = 3
      // log10(100) = 2, floor = 2
      // gain = 3 - 2 = 1
      expect(sys.calculateGain(901)).toBe(1);
    });

    it('大量资源时获得更多声望货币', () => {
      const sys = createSystem({ base: 10, threshold: 100 });
      // threshold + 10000 = 10100, log10(10100) ≈ 4.004, floor = 4
      // gain = 4 - 2 = 2
      expect(sys.calculateGain(10000)).toBe(2);

      // threshold + 100000 = 100100, log10(100100) ≈ 5.0004, floor = 5
      // gain = 5 - 2 = 3
      expect(sys.calculateGain(100000)).toBe(3);
    });

    it('不同 base 值影响获取曲线', () => {
      const sysBase2 = createSystem({ base: 2, threshold: 100 });

      // base=2: log2(100 + 900) = log2(1000) ≈ 9.97, floor = 9
      //         log2(100) ≈ 6.64, floor = 6
      //         gain = 9 - 6 = 3
      expect(sysBase2.calculateGain(900)).toBe(3);
    });

    it('返回值始终为非负整数', () => {
      const sys = createSystem();
      for (const total of [0, 1, 10, 100, 1000, 10000, 100000, 1e9]) {
        const gain = sys.calculateGain(total);
        expect(gain).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(gain)).toBe(true);
      }
    });
  });

  // ============================================================
  // getMultiplier
  // ============================================================

  describe('getMultiplier', () => {
    it('初始状态返回 1', () => {
      const sys = createSystem();
      expect(sys.getMultiplier()).toBe(1);
    });

    it('公式正确：1 + currency * bonusMultiplier', () => {
      const sys = createSystem({ bonusMultiplier: 0.5 });
      // 手动设置 currency 通过 loadState
      sys.loadState({ currency: 10 });
      // 1 + 10 * 0.5 = 6
      expect(sys.getMultiplier()).toBe(6);
    });

    it('不同 bonusMultiplier 值', () => {
      const sys = createSystem({ bonusMultiplier: 1.0 });
      sys.loadState({ currency: 5 });
      // 1 + 5 * 1.0 = 6
      expect(sys.getMultiplier()).toBe(6);

      const sys2 = createSystem({ bonusMultiplier: 0.1 });
      sys2.loadState({ currency: 100 });
      // 1 + 100 * 0.1 = 11
      expect(sys2.getMultiplier()).toBe(11);
    });
  });

  // ============================================================
  // getPreview
  // ============================================================

  describe('getPreview', () => {
    it('资源不足时 canPrestige 为 false', () => {
      const sys = createSystem({ threshold: 1000 });
      const preview = sys.getPreview(500);
      expect(preview.canPrestige).toBe(false);
      // threshold=1000, total=500 → canPrestige=false (500 < 1000)
      // 但 calculateGain 仍可能返回 >0（因为 log 公式不依赖阈值比较）
      // canPrestige 由阈值判定，gain 由公式计算，两者独立
      expect(preview.warning).toBeDefined();
    });

    it('资源充足时返回正确的预览信息', () => {
      const sys = createSystem({ base: 10, threshold: 100, bonusMultiplier: 0.25 });
      // totalResource = 10000 → gain = 2
      const preview = sys.getPreview(10000);
      expect(preview.canPrestige).toBe(true);
      expect(preview.gain).toBe(2);
      expect(preview.newMultiplier).toBe(1.5); // 1 + 2 * 0.25
      expect(preview.multiplierIncrease).toBe(0.5); // 1.5 - 1.0
      expect(preview.retentionRate).toBe(0.1);
    });

    it('已有声望货币时 multiplierIncrease 正确计算', () => {
      const sys = createSystem({ base: 10, threshold: 100, bonusMultiplier: 0.25 });
      sys.loadState({ currency: 4 }); // multiplier = 1 + 4 * 0.25 = 2

      const preview = sys.getPreview(10000);
      // gain = 2, newCurrency = 4 + 2 = 6
      // newMultiplier = 1 + 6 * 0.25 = 2.5
      // increase = 2.5 - 2.0 = 0.5
      expect(preview.gain).toBe(2);
      expect(preview.newMultiplier).toBe(2.5);
      expect(preview.multiplierIncrease).toBe(0.5);
    });

    it('首次声望时显示首次警告', () => {
      const sys = createSystem({ threshold: 100, base: 10 });
      // 需要足够资源获得 gain > 0
      const preview = sys.getPreview(1000);
      expect(preview.canPrestige).toBe(true);
      expect(preview.warning).toContain('首次声望');
    });

    it('收益远低于历史最高时显示警告', () => {
      const sys = createSystem({ base: 10, threshold: 100 });
      sys.loadState({ count: 5, bestGain: 100 });

      // gain 会远小于 bestGain
      const preview = sys.getPreview(1000);
      expect(preview.warning).toBeDefined();
      expect(preview.warning).toContain('远低于历史最高');
    });

    it('gain 为 0 但资源达到阈值时 canPrestige 为 false', () => {
      const sys = createSystem({ base: 10, threshold: 100 });
      // totalResource = 100 刚好达到阈值，但 gain = 0
      const preview = sys.getPreview(100);
      expect(preview.canPrestige).toBe(false);
      expect(preview.gain).toBe(0);
    });
  });

  // ============================================================
  // doPrestige
  // ============================================================

  describe('doPrestige', () => {
    it('资源不足时返回 null', () => {
      const sys = createSystem({ threshold: 100 });
      expect(sys.doPrestige(50)).toBeNull();
      expect(sys.doPrestige(0)).toBeNull();
      expect(sys.doPrestige(-10)).toBeNull();
    });

    it('资源达到阈值但 gain 为 0 时返回 null', () => {
      const sys = createSystem({ base: 10, threshold: 100 });
      // totalResource = 100, gain = 0
      expect(sys.doPrestige(100)).toBeNull();
    });

    it('成功执行声望并更新状态', () => {
      const sys = createSystem({ base: 10, threshold: 100, bonusMultiplier: 0.25 });
      // totalResource = 10000 → gain = 2
      const result = sys.doPrestige(10000);

      expect(result).not.toBeNull();
      expect(result!.gainedCurrency).toBe(2);
      expect(result!.retentionRate).toBe(0.1);

      const state = result!.newState;
      expect(state.currency).toBe(2);
      expect(state.count).toBe(1);
      expect(state.multiplier).toBe(1.5); // 1 + 2 * 0.25
      expect(state.bestGain).toBe(2);
    });

    it('多次声望累加货币和次数', () => {
      const sys = createSystem({ base: 10, threshold: 100, bonusMultiplier: 0.5 });

      // 第一次声望
      const r1 = sys.doPrestige(10000);
      expect(r1!.gainedCurrency).toBe(2);
      expect(r1!.newState.count).toBe(1);
      expect(r1!.newState.currency).toBe(2);

      // 第二次声望（模拟重置后重新积累）
      const r2 = sys.doPrestige(100000);
      expect(r2!.gainedCurrency).toBe(3);
      expect(r2!.newState.count).toBe(2);
      expect(r2!.newState.currency).toBe(5); // 2 + 3

      // 验证内部状态一致
      const state = sys.getState();
      expect(state.currency).toBe(5);
      expect(state.count).toBe(2);
    });

    it('bestGain 只在超过时更新', () => {
      const sys = createSystem({ base: 10, threshold: 100 });

      // 第一次获得 2 点
      sys.doPrestige(10000);
      expect(sys.getState().bestGain).toBe(2);

      // 第二次获得 1 点（低于 bestGain）
      sys.doPrestige(1000);
      expect(sys.getState().bestGain).toBe(2); // 不更新

      // 第三次获得 5 点（超过 bestGain）
      sys.doPrestige(1_000_000_000);
      expect(sys.getState().bestGain).toBeGreaterThanOrEqual(5);
    });
  });

  // ============================================================
  // loadState
  // ============================================================

  describe('loadState', () => {
    it('完整恢复状态', () => {
      const sys = createSystem({ bonusMultiplier: 0.5 });
      sys.loadState({
        currency: 20,
        count: 5,
        multiplier: 999, // 应被重新计算覆盖
        bestGain: 10,
      });

      const state = sys.getState();
      expect(state.currency).toBe(20);
      expect(state.count).toBe(5);
      expect(state.bestGain).toBe(10);
      // multiplier 应重新计算：1 + 20 * 0.5 = 11
      expect(state.multiplier).toBe(11);
    });

    it('部分恢复：仅更新传入的字段', () => {
      const sys = createSystem();
      // 先执行一次声望设置初始状态
      sys.doPrestige(10000);

      const before = sys.getState();
      expect(before.currency).toBe(2);
      expect(before.count).toBe(1);

      // 仅恢复 currency
      sys.loadState({ currency: 50 });
      const after = sys.getState();
      expect(after.currency).toBe(50);
      expect(after.count).toBe(1); // 保持不变
      expect(after.multiplier).toBe(1 + 50 * 0.25); // 重新计算
    });

    it('空对象不改变任何状态', () => {
      const sys = createSystem();
      sys.loadState({ currency: 10, count: 3, bestGain: 5 });

      const before = sys.getState();
      sys.loadState({});
      const after = sys.getState();

      expect(after.currency).toBe(before.currency);
      expect(after.count).toBe(before.count);
      expect(after.bestGain).toBe(before.bestGain);
    });

    it('multiplier 始终根据 currency 重新计算', () => {
      const sys = createSystem({ bonusMultiplier: 0.25 });

      // 传入错误的 multiplier 值
      sys.loadState({ currency: 8, multiplier: 999 });
      expect(sys.getState().multiplier).toBe(3); // 1 + 8 * 0.25 = 3

      // 仅传入 multiplier（不传 currency）
      sys.loadState({ multiplier: 100 });
      // currency 仍为 8，multiplier 仍被重新计算
      expect(sys.getState().multiplier).toBe(3);
    });
  });

  // ============================================================
  // reset
  // ============================================================

  describe('reset', () => {
    it('完全重置所有状态到初始值', () => {
      const sys = createSystem();
      sys.doPrestige(10000);
      sys.doPrestige(100000);

      // 确认状态已被修改
      const beforeReset = sys.getState();
      expect(beforeReset.currency).toBeGreaterThan(0);
      expect(beforeReset.count).toBeGreaterThan(0);

      sys.reset();

      const after = sys.getState();
      expect(after.currency).toBe(0);
      expect(after.count).toBe(0);
      expect(after.multiplier).toBe(1);
      expect(after.bestGain).toBe(0);
    });

    it('重置后可以重新声望', () => {
      const sys = createSystem();
      sys.doPrestige(10000);
      sys.reset();

      // 重置后应能正常声望
      const result = sys.doPrestige(10000);
      expect(result).not.toBeNull();
      expect(result!.newState.count).toBe(1);
    });
  });

  // ============================================================
  // getConfig / 配置访问
  // ============================================================

  describe('配置访问方法', () => {
    it('getCurrencyName 返回配置的名称', () => {
      const sys = createSystem({ currencyName: '钻石' });
      expect(sys.getCurrencyName()).toBe('钻石');
    });

    it('getCurrencyIcon 返回配置的图标', () => {
      const sys = createSystem({ currencyIcon: '💎' });
      expect(sys.getCurrencyIcon()).toBe('💎');
    });

    it('getRetentionRate 返回配置的保留比例', () => {
      const sys = createSystem({ retention: 0.5 });
      expect(sys.getRetentionRate()).toBe(0.5);
    });

    it('getConfig 返回完整配置快照', () => {
      const sys = createSystem();
      const config = sys.getConfig();
      expect(config.currencyName).toBe(defaultConfig.currencyName);
      expect(config.base).toBe(defaultConfig.base);
      expect(config.threshold).toBe(defaultConfig.threshold);
      expect(config.bonusMultiplier).toBe(defaultConfig.bonusMultiplier);
      expect(config.retention).toBe(defaultConfig.retention);
      expect(config.offlineBonusPerPoint).toBeUndefined();
    });

    it('getConfig 返回的是副本，修改不影响内部', () => {
      const sys = createSystem();
      const config = sys.getConfig();
      config.base = 999;
      expect(sys.getConfig().base).toBe(defaultConfig.base);
    });
  });

  // ============================================================
  // getOfflineBonus
  // ============================================================

  describe('getOfflineBonus', () => {
    it('未配置 offlineBonusPerPoint 时返回 1', () => {
      const sys = createSystem();
      expect(sys.getOfflineBonus()).toBe(1);
    });

    it('配置了 offlineBonusPerPoint 时正确计算', () => {
      const sys = createSystem({ offlineBonusPerPoint: 0.05 });
      sys.loadState({ currency: 20 });
      // 1 + 20 * 0.05 = 2
      expect(sys.getOfflineBonus()).toBe(2);
    });

    it('currency 为 0 时即使有配置也返回 1', () => {
      const sys = createSystem({ offlineBonusPerPoint: 0.1 });
      expect(sys.getOfflineBonus()).toBe(1);
    });
  });

  // ============================================================
  // getState 不可变性
  // ============================================================

  describe('getState 不可变性', () => {
    it('返回的状态是副本，修改不影响内部', () => {
      const sys = createSystem();
      sys.doPrestige(10000);

      const state1 = sys.getState();
      const originalCurrency = state1.currency;

      // 修改返回的状态
      state1.currency = 9999;
      state1.count = 9999;

      // 内部状态应不变
      const state2 = sys.getState();
      expect(state2.currency).toBe(originalCurrency);
      expect(state2.count).toBe(1);
    });
  });

  // ============================================================
  // 综合场景
  // ============================================================

  describe('综合场景', () => {
    it('完整声望循环：初始化 → 积累 → 预览 → 声望 → 重置', () => {
      const sys = createSystem({
        currencyName: '重生点',
        currencyIcon: '🔄',
        base: 10,
        threshold: 100,
        bonusMultiplier: 0.5,
        retention: 0.15,
        offlineBonusPerPoint: 0.02,
      });

      // 1. 初始状态
      expect(sys.getState().currency).toBe(0);
      expect(sys.getMultiplier()).toBe(1);
      expect(sys.getOfflineBonus()).toBe(1);

      // 2. 资源不足，无法声望
      expect(sys.canPrestige(50)).toBe(false);
      expect(sys.doPrestige(50)).toBeNull();

      // 3. 积累到足够资源，查看预览
      const preview = sys.getPreview(10000);
      expect(preview.canPrestige).toBe(true);
      expect(preview.gain).toBe(2);
      expect(preview.newMultiplier).toBe(2); // 1 + 2 * 0.5

      // 4. 执行声望
      const result = sys.doPrestige(10000);
      expect(result).not.toBeNull();
      expect(result!.gainedCurrency).toBe(2);
      expect(result!.retentionRate).toBe(0.15);

      // 5. 验证声望后状态
      expect(sys.getState().currency).toBe(2);
      expect(sys.getState().count).toBe(1);
      expect(sys.getMultiplier()).toBe(2);
      expect(sys.getOfflineBonus()).toBe(1.04); // 1 + 2 * 0.02

      // 6. 存档和恢复
      const savedState = sys.getState();
      const sys2 = createSystem({
        currencyName: '重生点',
        currencyIcon: '🔄',
        base: 10,
        threshold: 100,
        bonusMultiplier: 0.5,
        retention: 0.15,
        offlineBonusPerPoint: 0.02,
      });
      sys2.loadState(savedState);
      expect(sys2.getState().currency).toBe(2);
      expect(sys2.getMultiplier()).toBe(2);

      // 7. 再次声望
      const result2 = sys.doPrestige(1_000_000);
      expect(result2).not.toBeNull();
      expect(sys.getState().count).toBe(2);

      // 8. 完全重置
      sys.reset();
      expect(sys.getState().currency).toBe(0);
      expect(sys.getState().count).toBe(0);
      expect(sys.getMultiplier()).toBe(1);
    });

    it('多次声望后倍率持续增长', () => {
      const sys = createSystem({ base: 10, threshold: 100, bonusMultiplier: 0.1 });

      // 模拟多次声望循环
      const resources = [10000, 100000, 1_000_000, 10_000_000];
      let expectedMultiplier = 1;

      for (const res of resources) {
        sys.doPrestige(res);
        const state = sys.getState();
        expectedMultiplier = 1 + state.currency * 0.1;
        expect(sys.getMultiplier()).toBe(expectedMultiplier);
      }

      // 验证最终状态
      const finalState = sys.getState();
      expect(finalState.count).toBe(4);
      expect(finalState.currency).toBeGreaterThan(0);
      expect(finalState.multiplier).toBeGreaterThan(1);
    });
  });
});
