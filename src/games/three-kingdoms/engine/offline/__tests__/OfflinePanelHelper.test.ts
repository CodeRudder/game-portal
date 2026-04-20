/**
 * OfflinePanelHelper 单元测试
 *
 * 覆盖：
 *   - 格式化离线时长
 *   - 静默判定（≤5分钟不弹窗）
 *   - 回归面板数据生成
 *   - 离线预估
 */

import {
  formatOfflineDuration,
  shouldShowOfflinePopup,
  generateReturnPanelData,
  estimateOfflineReward,
} from '../OfflinePanelHelper';
import type { OfflineSnapshot } from '../offline.types';
import { MAX_OFFLINE_SECONDS } from '../offline-config';

// ── 辅助 ──

function makeSnapshot(overrides: Partial<OfflineSnapshot> = {}): OfflineSnapshot {
  return {
    timestamp: Date.now(),
    offlineSeconds: 3600,
    tierDetails: [],
    totalEarned: { grain: 36000, gold: 18000, troops: 7200, mandate: 3600 },
    overallEfficiency: 1.0,
    isCapped: false,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════
// 1. 格式化离线时长
// ═══════════════════════════════════════════════

describe('formatOfflineDuration', () => {
  it('0秒 → "刚刚"', () => {
    expect(formatOfflineDuration(0)).toBe('刚刚');
  });

  it('30秒 → "30秒"', () => {
    expect(formatOfflineDuration(30)).toBe('30秒');
  });

  it('90秒 → "1分钟"', () => {
    expect(formatOfflineDuration(90)).toBe('1分钟');
  });

  it('3661秒 → "1小时1分钟"', () => {
    expect(formatOfflineDuration(3661)).toBe('1小时1分钟');
  });

  it('90000秒 → "1天1小时"', () => {
    expect(formatOfflineDuration(90000)).toBe('1天1小时');
  });

  it('172800秒 → "2天"', () => {
    expect(formatOfflineDuration(172800)).toBe('2天');
  });

  it('负数 → "刚刚"', () => {
    expect(formatOfflineDuration(-10)).toBe('刚刚');
  });
});

// ═══════════════════════════════════════════════
// 2. 静默判定
// ═══════════════════════════════════════════════

describe('shouldShowOfflinePopup', () => {
  it('≤5分钟不弹窗', () => {
    expect(shouldShowOfflinePopup(0)).toBe(false);
    expect(shouldShowOfflinePopup(299)).toBe(false);
    expect(shouldShowOfflinePopup(300)).toBe(false);
  });

  it('>5分钟弹窗', () => {
    expect(shouldShowOfflinePopup(301)).toBe(true);
    expect(shouldShowOfflinePopup(3600)).toBe(true);
    expect(shouldShowOfflinePopup(86400)).toBe(true);
  });
});

// ═══════════════════════════════════════════════
// 3. 回归面板数据
// ═══════════════════════════════════════════════

describe('generateReturnPanelData', () => {
  it('基本面板数据生成', () => {
    const snapshot = makeSnapshot();
    const panel = generateReturnPanelData(snapshot, 0);

    expect(panel.offlineSeconds).toBe(3600);
    expect(panel.formattedTime).toBe('1小时');
    expect(panel.efficiencyPercent).toBe(100);
    expect(panel.isCapped).toBe(false);
    expect(panel.availableDoubles.length).toBeGreaterThanOrEqual(2); // ad + item
  });

  it('广告翻倍次数用完后不显示', () => {
    const snapshot = makeSnapshot();
    const panel = generateReturnPanelData(snapshot, 3);
    const adDouble = panel.availableDoubles.find(d => d.source === 'ad');
    expect(adDouble).toBeUndefined();
  });

  it('离线>24h显示回归奖励', () => {
    const snapshot = makeSnapshot({ offlineSeconds: 25 * 3600 });
    const panel = generateReturnPanelData(snapshot, 0);
    const returnBonus = panel.availableDoubles.find(d => d.source === 'return_bonus');
    expect(returnBonus).toBeDefined();
    expect(returnBonus!.multiplier).toBe(2);
  });

  it('离线<24h不显示回归奖励', () => {
    const snapshot = makeSnapshot({ offlineSeconds: 23 * 3600 });
    const panel = generateReturnPanelData(snapshot, 0);
    const returnBonus = panel.availableDoubles.find(d => d.source === 'return_bonus');
    expect(returnBonus).toBeUndefined();
  });

  it('元宝翻倍始终可用', () => {
    const snapshot = makeSnapshot();
    const panel = generateReturnPanelData(snapshot, 0);
    const itemDouble = panel.availableDoubles.find(d => d.source === 'item');
    expect(itemDouble).toBeDefined();
  });

  it('封顶标记正确传递', () => {
    const snapshot = makeSnapshot({ isCapped: true });
    const panel = generateReturnPanelData(snapshot, 0);
    expect(panel.isCapped).toBe(true);
  });
});

// ═══════════════════════════════════════════════
// 4. 离线预估
// ═══════════════════════════════════════════════

describe('estimateOfflineReward', () => {
  const mockCalculateSnapshot = (seconds: number) => makeSnapshot({
    offlineSeconds: seconds,
    totalEarned: { grain: seconds * 10, gold: 0, troops: 0, mandate: 0 },
  });

  it('预估1小时收益', () => {
    const result = estimateOfflineReward(1, { grain: 10, gold: 0, troops: 0, mandate: 0 }, {}, mockCalculateSnapshot as any);
    expect(result.offlineSeconds).toBe(3600);
    expect(result.totalEarned.grain).toBe(36000);
  });

  it('预估8小时收益', () => {
    const result = estimateOfflineReward(8, { grain: 10, gold: 0, troops: 0, mandate: 0 }, {}, mockCalculateSnapshot as any);
    expect(result.offlineSeconds).toBe(8 * 3600);
  });
});
