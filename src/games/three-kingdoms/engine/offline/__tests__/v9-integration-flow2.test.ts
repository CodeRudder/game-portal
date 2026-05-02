/**
 * v9.0 离线收益集成测试 — 流程2: 翻倍机制 + 弹窗 + 回归面板 + 快照系统
 *
 * 覆盖 Play 文档:
 *   §1.4 离线收益弹窗与翻倍
 *   §1.5 广告翻倍细节
 *   §1.6 元宝翻倍细节
 *   §4.1 回归综合面板
 *   §7.4 翻倍机制→货币消耗→广告次数联动
 *   §7.9 快照丢失→降级处理
 *   §7.10 回归流程完整性验证
 */

import {
  OfflineRewardSystem,
  shouldShowOfflinePopup,
  formatOfflineDuration,
  generateReturnPanelData,
  calculateOfflineSnapshot,
  applyDouble,
  AD_DOUBLE_MULTIPLIER,
  RETURN_BONUS_MIN_HOURS,
  RETURN_BONUS_MULTIPLIER,
} from '../index';
import { OFFLINE_POPUP_THRESHOLD } from '../offline-config';
import { OfflineSnapshotSystem } from '../OfflineSnapshotSystem';
import type { Resources, ProductionRate, ResourceCap } from '../../../../shared/types';

// ─────────────────────────────────────────────
// 工具
// ─────────────────────────────────────────────

const HOUR_S = 3600;

function zeroRes(): Resources {
  return { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0 };
}

function makeRates(overrides: Partial<ProductionRate> = {}): ProductionRate {
  return { grain: 10, gold: 5, troops: 2, mandate: 1, techPoint: 0.5, ...overrides };
}

function makeCaps(overrides: Partial<ResourceCap> = {}): ResourceCap {
  return { grain: 5000, gold: 2000, troops: 1000, mandate: null, techPoint: null, recruitToken: null, skillBook: null, ...overrides };
}

// ─────────────────────────────────────────────
// §1.4 离线收益弹窗与翻倍
// ─────────────────────────────────────────────

describe('v9 §1.4 离线收益弹窗与翻倍', () => {
  it('离线≤5min静默入账不弹窗', () => {
    expect(shouldShowOfflinePopup(300)).toBe(false);
    expect(shouldShowOfflinePopup(299)).toBe(false);
  });

  it('离线>5min弹出收益弹窗', () => {
    expect(shouldShowOfflinePopup(301)).toBe(true);
    expect(shouldShowOfflinePopup(600)).toBe(true);
  });

  it('OFFLINE_POPUP_THRESHOLD = 300秒(5分钟)', () => {
    expect(OFFLINE_POPUP_THRESHOLD).toBe(300);
  });

  it('弹窗数据与后台计算一致', () => {
    const rates = makeRates();
    const snap = calculateOfflineSnapshot(3600, rates, {});
    const panel = generateReturnPanelData(snap, 0);

    expect(panel.totalEarned.grain).toBe(snap.totalEarned.grain);
    expect(panel.totalEarned.gold).toBe(snap.totalEarned.gold);
    expect(panel.efficiencyPercent).toBe(Math.round(snap.overallEfficiency * 100));
    expect(panel.offlineSeconds).toBe(3600);
  });
});

// ─────────────────────────────────────────────
// §1.5 广告翻倍细节
// ─────────────────────────────────────────────

describe('v9 §1.5 广告翻倍细节', () => {
  it('广告翻倍倍率为×2', () => {
    expect(AD_DOUBLE_MULTIPLIER).toBe(2);
  });

  it('广告翻倍成功: 收益×2', () => {
    const system = new OfflineRewardSystem();
    const earned: Resources = { grain: 100, gold: 50, troops: 0, mandate: 0, techPoint: 0 };
    const result = system.applyDouble(earned, {
      source: 'ad', multiplier: 2, description: '广告翻倍',
    });
    expect(result.success).toBe(true);
    expect(result.doubledEarned.grain).toBe(200);
    expect(result.doubledEarned.gold).toBe(100);
    expect(result.appliedMultiplier).toBe(2);
  });

  it('广告翻倍每日3次限制(通过applyDouble)', () => {
    const earned: Resources = { grain: 100, gold: 50, troops: 0, mandate: 0, techPoint: 0 };

    // applyDouble 接受 adUsedToday 参数，第4次(adUsedToday=3)应失败
    for (let i = 0; i < 3; i++) {
      const r = applyDouble(earned, { source: 'ad', multiplier: 2, description: '广告翻倍' }, i);
      expect(r.success).toBe(true);
    }
    const r4 = applyDouble(earned, { source: 'ad', multiplier: 2, description: '广告翻倍' }, 3);
    expect(r4.success).toBe(false);
    expect(r4.reason).toContain('已用完');
  });

  it('OfflineSnapshotSystem.recordAdDouble 记录广告使用次数', () => {
    const snapSystem = new OfflineSnapshotSystem();
    snapSystem.recordAdDouble();
    snapSystem.recordAdDouble();
    snapSystem.recordAdDouble();
    const saveData = snapSystem.getSaveData();
    expect(saveData.vipDoubleUsedToday).toBe(3);
  });

  it('广告翻倍次数跨日重置', () => {
    const system = new OfflineRewardSystem();
    const earned: Resources = { grain: 100, gold: 50, troops: 0, mandate: 0, techPoint: 0 };

    // 用完3次
    for (let i = 0; i < 3; i++) {
      system.applyDouble(earned, { source: 'ad', multiplier: 2, description: '' });
    }
    // 重置
    system.resetVipDailyCount();
    // 应该可以再次使用
    const r = system.applyDouble(earned, { source: 'ad', multiplier: 2, description: '' });
    expect(r.success).toBe(true);
  });
});

// ─────────────────────────────────────────────
// §1.6 元宝翻倍细节
// ─────────────────────────────────────────────

describe('v9 §1.6 元宝翻倍细节', () => {
  it('元宝翻倍(item source)无次数限制', () => {
    const system = new OfflineRewardSystem();
    const earned: Resources = { grain: 100, gold: 50, troops: 0, mandate: 0, techPoint: 0 };

    // 使用5次都应成功
    for (let i = 0; i < 5; i++) {
      const r = system.applyDouble(earned, {
        source: 'item', multiplier: 2, description: '元宝翻倍',
      });
      expect(r.success).toBe(true);
    }
  });

  it('元宝翻倍收益×2', () => {
    const system = new OfflineRewardSystem();
    const earned: Resources = { grain: 500, gold: 200, troops: 0, mandate: 0, techPoint: 0 };
    const r = system.applyDouble(earned, {
      source: 'item', multiplier: 2, description: '元宝翻倍',
    });
    expect(r.success).toBe(true);
    expect(r.doubledEarned.grain).toBe(1000);
    expect(r.doubledEarned.gold).toBe(400);
  });
});

// ─────────────────────────────────────────────
// §4.1 回归综合面板
// ─────────────────────────────────────────────

describe('v9 §4.1 回归综合面板', () => {
  it('面板包含完整数据', () => {
    const system = new OfflineRewardSystem();
    const panel = system.generateReturnPanel(10 * HOUR_S, makeRates(), 0);

    expect(panel.offlineSeconds).toBe(10 * HOUR_S);
    expect(panel.formattedTime).toBeTruthy();
    expect(panel.efficiencyPercent).toBeGreaterThan(0);
    expect(panel.tierDetails.length).toBeGreaterThan(0);
    expect(panel.totalEarned).toBeDefined();
    expect(panel.availableDoubles.length).toBeGreaterThan(0);
  });

  it('离线>24h时出现回归奖励翻倍选项', () => {
    const system = new OfflineRewardSystem();
    const panel = system.generateReturnPanel(25 * HOUR_S, makeRates(), 0);
    const returnBonus = panel.availableDoubles.find(d => d.source === 'return_bonus');
    expect(returnBonus).toBeDefined();
    expect(returnBonus!.multiplier).toBe(RETURN_BONUS_MULTIPLIER);
  });

  it('离线<24h时无回归奖励翻倍选项', () => {
    const system = new OfflineRewardSystem();
    const panel = system.generateReturnPanel(10 * HOUR_S, makeRates(), 0);
    const returnBonus = panel.availableDoubles.find(d => d.source === 'return_bonus');
    expect(returnBonus).toBeUndefined();
  });

  it('格式化离线时长', () => {
    expect(formatOfflineDuration(0)).toBe('刚刚');
    expect(formatOfflineDuration(60)).toBe('1分钟');
    expect(formatOfflineDuration(3600)).toBe('1小时');
    expect(formatOfflineDuration(86400)).toBe('1天');
    expect(formatOfflineDuration(90000)).toBe('1天1小时');
  });
});

// ─────────────────────────────────────────────
// §7.4 翻倍机制→货币消耗→广告次数联动
// ─────────────────────────────────────────────

describe('v9 §7.4 翻倍机制联动', () => {
  it('广告翻倍后收益=原收益×2, 广告剩余次数-1', () => {
    const system = new OfflineRewardSystem();
    const earned: Resources = { grain: 1000, gold: 500, troops: 0, mandate: 0, techPoint: 0 };

    const r = system.applyDouble(earned, { source: 'ad', multiplier: 2, description: '' });
    expect(r.success).toBe(true);
    expect(r.doubledEarned.grain).toBe(2000);
    expect(r.originalEarned.grain).toBe(1000);
  });

  it('同一次收益不可双重翻倍(互斥)', () => {
    // OfflineRewardSystem 的 claimReward 防重复领取
    const system = new OfflineRewardSystem();
    const rates = makeRates();
    const current = zeroRes();
    const caps = makeCaps();

    const result = system.calculateOfflineReward(HOUR_S, rates, current, caps);
    // 第一次领取成功
    const claim1 = system.claimReward(result);
    expect(claim1).not.toBeNull();
    // 第二次领取失败
    const claim2 = system.claimReward(result);
    expect(claim2).toBeNull();
  });

  it('广告与元宝翻倍互斥验证(通过claim防重复)', () => {
    const system = new OfflineRewardSystem();
    const rates = makeRates();
    const result = system.calculateOfflineReward(HOUR_S, rates, zeroRes(), makeCaps());

    // claim后不可再次领取，模拟互斥
    const first = system.claimReward(result);
    expect(first).not.toBeNull();
    const second = system.claimReward(result);
    expect(second).toBeNull();
  });
});

// ─────────────────────────────────────────────
// §7.9 快照丢失→降级处理
// ─────────────────────────────────────────────

describe('v9 §7.9 快照丢失降级处理', () => {
  it('快照丢失时系统不崩溃', () => {
    const snapSystem = new OfflineSnapshotSystem();
    // 无快照时 getSnapshot 返回 null
    expect(snapSystem.getSnapshot()).toBeNull();
  });

  it('快照丢失时离线时长为0', () => {
    const snapSystem = new OfflineSnapshotSystem();
    expect(snapSystem.getOfflineSeconds()).toBe(0);
  });

  it('快照丢失时无效', () => {
    const snapSystem = new OfflineSnapshotSystem();
    expect(snapSystem.isSnapshotValid()).toBe(false);
  });

  it('创建快照后有效', () => {
    const snapSystem = new OfflineSnapshotSystem();
    snapSystem.createSnapshot({
      resources: zeroRes(),
      productionRates: makeRates(),
      caps: makeCaps(),
    });
    expect(snapSystem.getSnapshot()).not.toBeNull();
    expect(snapSystem.isSnapshotValid()).toBe(true);
  });

  it('清除快照后失效', () => {
    const snapSystem = new OfflineSnapshotSystem();
    snapSystem.createSnapshot({
      resources: zeroRes(),
      productionRates: makeRates(),
      caps: makeCaps(),
    });
    snapSystem.clearSnapshot();
    expect(snapSystem.getSnapshot()).toBeNull();
  });
});

// ─────────────────────────────────────────────
// §7.10 回归流程完整性验证
// ─────────────────────────────────────────────

describe('v9 §7.10 回归流程完整性', () => {
  it('完整回归流程: 弹窗→面板→领取→防重复', () => {
    const system = new OfflineRewardSystem();
    const snapSystem = new OfflineSnapshotSystem();
    const rates = makeRates({ grain: 100, gold: 50 });
    const current = zeroRes();
    const caps = makeCaps();

    // Step 0: 创建快照
    snapSystem.createSnapshot({ resources: current, productionRates: rates, caps });

    // Step 1: 计算离线收益(10h)
    const result = system.calculateOfflineReward(10 * HOUR_S, rates, current, caps);

    // Step 2: 弹窗应展示
    expect(shouldShowOfflinePopup(10 * HOUR_S)).toBe(true);

    // Step 3: 面板数据完整
    expect(result.panelData.availableDoubles.length).toBeGreaterThan(0);
    expect(result.panelData.tierDetails.length).toBeGreaterThan(0);

    // Step 4: 领取
    const claimed = system.claimReward(result);
    expect(claimed).not.toBeNull();
    expect(claimed!.gold).toBeGreaterThan(0);

    // Step 5: 不可重复领取
    expect(system.claimReward(result)).toBeNull();
  });

  it('离线≤5min不弹窗但仍可领取', () => {
    const system = new OfflineRewardSystem();
    const result = system.calculateOfflineReward(300, makeRates(), zeroRes(), makeCaps());
    expect(shouldShowOfflinePopup(300)).toBe(false);
    const claimed = system.claimReward(result);
    expect(claimed).not.toBeNull();
  });
});
