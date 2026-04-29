/**
 * AllianceSystem P0修复测试
 *
 * 覆盖：
 * - P0-01: 创建联盟时实际扣除元宝
 */

import { AllianceSystem } from '../AllianceSystem';
import { DEFAULT_CREATE_CONFIG } from '../alliance-constants';

describe('P0-01: 创建联盟扣除元宝', () => {
  let allianceSystem: AllianceSystem;
  let ingotBalance: number;

  beforeEach(() => {
    allianceSystem = new AllianceSystem();
    ingotBalance = 1000; // 初始1000元宝
  });

  it('默认创建配置的元宝消耗为500', () => {
    expect(DEFAULT_CREATE_CONFIG.createCostGold).toBe(500);
  });

  it('元宝充足时创建联盟成功并扣除元宝', () => {
    allianceSystem.setCurrencyCallbacks({
      spend: (currency: string, amount: number) => {
        if (currency === 'ingot' && ingotBalance >= amount) {
          ingotBalance -= amount;
          return true;
        }
        return false;
      },
      getBalance: (currency: string) => currency === 'ingot' ? ingotBalance : 0,
    });

    const result = allianceSystem.createAllianceSimple('测试联盟', '玩家1');
    expect(result.success).toBe(true);
    expect(ingotBalance).toBe(500); // 1000 - 500 = 500
  });

  it('元宝不足时创建联盟失败', () => {
    ingotBalance = 100; // 只有100元宝
    allianceSystem.setCurrencyCallbacks({
      spend: (currency: string, amount: number) => {
        if (currency === 'ingot' && ingotBalance >= amount) {
          ingotBalance -= amount;
          return true;
        }
        return false;
      },
      getBalance: (currency: string) => currency === 'ingot' ? ingotBalance : 0,
    });

    const result = allianceSystem.createAllianceSimple('测试联盟', '玩家1');
    expect(result.success).toBe(false);
    expect(result.reason).toContain('元宝不足');
    expect(ingotBalance).toBe(100); // 未扣除
  });

  it('元宝刚好500时创建联盟成功', () => {
    ingotBalance = 500;
    allianceSystem.setCurrencyCallbacks({
      spend: (currency: string, amount: number) => {
        if (currency === 'ingot' && ingotBalance >= amount) {
          ingotBalance -= amount;
          return true;
        }
        return false;
      },
      getBalance: (currency: string) => currency === 'ingot' ? ingotBalance : 0,
    });

    const result = allianceSystem.createAllianceSimple('测试联盟', '玩家1');
    expect(result.success).toBe(true);
    expect(ingotBalance).toBe(0);
  });

  it('未设置货币回调时仍可创建联盟（向后兼容）', () => {
    const result = allianceSystem.createAllianceSimple('测试联盟', '玩家1');
    expect(result.success).toBe(true);
  });

  it('已在联盟中时创建联盟失败', () => {
    allianceSystem.setCurrencyCallbacks({
      spend: () => true,
      getBalance: () => 10000,
    });

    // 第一次创建成功
    const r1 = allianceSystem.createAllianceSimple('联盟1', '玩家1');
    expect(r1.success).toBe(true);

    // 第二次创建失败
    const r2 = allianceSystem.createAllianceSimple('联盟2', '玩家1');
    expect(r2.success).toBe(false);
    expect(r2.reason).toContain('已在联盟中');
  });

  it('联盟名称不符合要求时创建失败且不扣费', () => {
    ingotBalance = 1000;
    allianceSystem.setCurrencyCallbacks({
      spend: (currency: string, amount: number) => {
        if (currency === 'ingot' && ingotBalance >= amount) {
          ingotBalance -= amount;
          return true;
        }
        return false;
      },
      getBalance: (currency: string) => currency === 'ingot' ? ingotBalance : 0,
    });

    // 名称太短
    const result = allianceSystem.createAllianceSimple('一', '玩家1');
    expect(result.success).toBe(false);
    expect(ingotBalance).toBe(1000); // 未扣除
  });
});
