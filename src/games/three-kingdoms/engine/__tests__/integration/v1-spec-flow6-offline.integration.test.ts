/**
 * SPEC-FLOW-6 离线收益验证 — 完整集成测试
 *
 * 覆盖 v1-play.md 中 SPEC-FLOW-6 定义的 13 个 TC：
 *   TC-1  ~ TC-2  : 短暂离开，不触发弹窗
 *   TC-3  ~ TC-5  : 5分钟弹窗阈值 + 0~2h 全额收益
 *   TC-6  ~ TC-7  : 2~8h 轻度衰减（80%）
 *   TC-8  ~ TC-9  : 8~24h 中度衰减（60%）
 *   TC-10 ~ TC-11 : 24~72h 明显/大幅衰减（40%/20%）+ 72h 封顶
 *   TC-12 ~ TC-13 : 超过72h 封顶机制
 *
 * 验证维度：
 *   - shouldShowOfflinePopup 弹窗阈值（5分钟）
 *   - calculateSnapshot 衰减系数（5档）
 *   - 72小时封顶机制
 *   - 各档位衰减比例精确验证
 *   - 离线收益计算正确性
 *   - formatOfflineDuration 时长格式化
 *
 * 引擎层测试原则：
 *   - 每个用例创建独立 sim 实例
 *   - 使用真实引擎 API，不使用 mock
 *   - 不依赖 UI 渲染
 */

import { describe, it, expect } from 'vitest';
import { createSim } from '../../../test-utils/test-helpers';
import {
  shouldShowOfflinePopup,
  formatOfflineDuration,
} from '../../offline/OfflinePanelHelper';
import {
  DECAY_TIERS,
  OFFLINE_POPUP_THRESHOLD,
  MAX_OFFLINE_HOURS,
  MAX_OFFLINE_SECONDS,
} from '../../offline/offline-config';

// ═══════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════

const HOUR_S = 3600;
const MIN_S = 60;

/** 固定产出速率（便于精确计算预期值） */
const FIXED_RATES = { grain: 10, gold: 5, troops: 2, mandate: 0 } as const;

// ═══════════════════════════════════════════════
// SPEC-FLOW-6: 离线收益验证
// ═══════════════════════════════════════════════
describe('SPEC-FLOW-6: 离线收益验证 — 完整13个TC', () => {

  // ═══════════════════════════════════════════════
  // A. 弹窗阈值验证（shouldShowOfflinePopup）
  // ═══════════════════════════════════════════════
  describe('A. 弹窗阈值验证', () => {

    it('TC-1: 离线10秒 — 不触发弹窗', () => {
      expect(shouldShowOfflinePopup(10)).toBe(false);
    });

    it('TC-2: 离线2分钟(120秒) — 不触发弹窗', () => {
      expect(shouldShowOfflinePopup(2 * MIN_S)).toBe(false);
    });

    it('TC-3: 离线恰好5分钟(300秒) — 不触发弹窗（> 严格比较）', () => {
      // PRD: 离线>5分钟弹窗；恰好5分钟不触发
      expect(shouldShowOfflinePopup(OFFLINE_POPUP_THRESHOLD)).toBe(false);
    });

    it('TC-3补充: 离线5分01秒(301秒) — 触发弹窗', () => {
      expect(shouldShowOfflinePopup(OFFLINE_POPUP_THRESHOLD + 1)).toBe(true);
    });

    it('TC-4: 离线30分钟 — 触发弹窗', () => {
      expect(shouldShowOfflinePopup(30 * MIN_S)).toBe(true);
    });

    it('TC-6: 离线3小时 — 触发弹窗', () => {
      expect(shouldShowOfflinePopup(3 * HOUR_S)).toBe(true);
    });

    it('TC-8: 离线12小时 — 触发弹窗', () => {
      expect(shouldShowOfflinePopup(12 * HOUR_S)).toBe(true);
    });

    it('TC-11: 离线72小时 — 触发弹窗', () => {
      expect(shouldShowOfflinePopup(72 * HOUR_S)).toBe(true);
    });

    it('TC-12: 离线100小时 — 触发弹窗', () => {
      expect(shouldShowOfflinePopup(100 * HOUR_S)).toBe(true);
    });

    it('TC-13: 离线30天(720小时) — 触发弹窗', () => {
      expect(shouldShowOfflinePopup(30 * 24 * HOUR_S)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════
  // B. 衰减系数精确验证（5档 + 边界）
  // ═══════════════════════════════════════════════
  describe('B. 衰减系数精确验证', () => {

    it('TC-1: 离线10秒 — 100%效率，极小收益', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();
      const snapshot = offlineReward.calculateSnapshot(10, FIXED_RATES);

      // 10秒在 tier1 (0~2h, 100%) 内
      expect(snapshot.tierDetails).toHaveLength(1);
      expect(snapshot.tierDetails[0].efficiency).toBe(1.0);
      expect(snapshot.tierDetails[0].seconds).toBe(10);
      // grain = 10 * 10 * 1.0 = 100
      expect(snapshot.totalEarned.grain).toBeCloseTo(100, 2);
      expect(snapshot.overallEfficiency).toBe(1.0);
    });

    it('TC-2: 离线2分钟(120秒) — 100%效率', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();
      const snapshot = offlineReward.calculateSnapshot(2 * MIN_S, FIXED_RATES);

      expect(snapshot.tierDetails).toHaveLength(1);
      expect(snapshot.tierDetails[0].efficiency).toBe(1.0);
      // grain = 10 * 120 * 1.0 = 1200
      expect(snapshot.totalEarned.grain).toBeCloseTo(1200, 2);
    });

    it('TC-3: 离线5分钟(300秒) — 100%效率', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();
      const snapshot = offlineReward.calculateSnapshot(5 * MIN_S, FIXED_RATES);

      expect(snapshot.tierDetails).toHaveLength(1);
      expect(snapshot.tierDetails[0].efficiency).toBe(1.0);
      // grain = 10 * 300 * 1.0 = 3000
      expect(snapshot.totalEarned.grain).toBeCloseTo(3000, 2);
    });

    it('TC-4: 离线30分钟(1800秒) — 100%效率', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();
      const snapshot = offlineReward.calculateSnapshot(30 * MIN_S, FIXED_RATES);

      expect(snapshot.tierDetails).toHaveLength(1);
      expect(snapshot.tierDetails[0].efficiency).toBe(1.0);
      // grain = 10 * 1800 * 1.0 = 18000
      expect(snapshot.totalEarned.grain).toBeCloseTo(18000, 2);
    });

    it('TC-5: 离线2小时(7200秒) — 100%效率，仅tier1', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();
      const snapshot = offlineReward.calculateSnapshot(2 * HOUR_S, FIXED_RATES);

      // 恰好2小时 — 只有tier1
      expect(snapshot.tierDetails).toHaveLength(1);
      expect(snapshot.tierDetails[0].tierId).toBe('tier1');
      expect(snapshot.tierDetails[0].efficiency).toBe(1.0);
      expect(snapshot.tierDetails[0].seconds).toBe(2 * HOUR_S);
      expect(snapshot.overallEfficiency).toBe(1.0);
      // grain = 10 * 7200 * 1.0 = 72000
      expect(snapshot.totalEarned.grain).toBeCloseTo(72000, 2);
    });

    it('TC-6: 离线3小时(10800秒) — 混合100%+80%衰减', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();
      const snapshot = offlineReward.calculateSnapshot(3 * HOUR_S, FIXED_RATES);

      // 3小时 = tier1(2h, 100%) + tier2(1h, 80%)
      expect(snapshot.tierDetails).toHaveLength(2);
      expect(snapshot.tierDetails[0].tierId).toBe('tier1');
      expect(snapshot.tierDetails[0].efficiency).toBe(1.0);
      expect(snapshot.tierDetails[0].seconds).toBe(2 * HOUR_S);
      expect(snapshot.tierDetails[1].tierId).toBe('tier2');
      expect(snapshot.tierDetails[1].efficiency).toBe(0.8);
      expect(snapshot.tierDetails[1].seconds).toBe(1 * HOUR_S);

      // grain: tier1 = 10 * 7200 * 1.0 = 72000, tier2 = 10 * 3600 * 0.8 = 28800
      // total = 100800
      expect(snapshot.totalEarned.grain).toBeCloseTo(100800, 2);
      // overallEfficiency = (7200*1.0 + 3600*0.8) / 10800 = (7200+2880)/10800 ≈ 0.9333
      expect(snapshot.overallEfficiency).toBeCloseTo(0.9333, 2);
    });

    it('TC-7: 离线8小时(28800秒) — tier1(100%)+tier2(80%)边界', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();
      const snapshot = offlineReward.calculateSnapshot(8 * HOUR_S, FIXED_RATES);

      // 恰好8小时 = tier1(2h, 100%) + tier2(6h, 80%)
      expect(snapshot.tierDetails).toHaveLength(2);
      expect(snapshot.tierDetails[0].efficiency).toBe(1.0);
      expect(snapshot.tierDetails[1].efficiency).toBe(0.8);
      // overallEfficiency = (2*1.0 + 6*0.8) / 8 = (2+4.8)/8 = 0.85
      expect(snapshot.overallEfficiency).toBeCloseTo(0.85, 2);
    });

    it('TC-7补充: 离线8小时+10秒 — 触发tier3(60%)', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();
      const snapshot = offlineReward.calculateSnapshot(8 * HOUR_S + 10, FIXED_RATES);

      expect(snapshot.tierDetails).toHaveLength(3);
      expect(snapshot.tierDetails[2].tierId).toBe('tier3');
      expect(snapshot.tierDetails[2].efficiency).toBe(0.6);
      expect(snapshot.tierDetails[2].seconds).toBe(10);
    });

    it('TC-8: 离线12小时(43200秒) — tier1+tier2+tier3混合', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();
      const snapshot = offlineReward.calculateSnapshot(12 * HOUR_S, FIXED_RATES);

      // 12小时 = tier1(2h, 100%) + tier2(6h, 80%) + tier3(4h, 60%)
      expect(snapshot.tierDetails).toHaveLength(3);
      expect(snapshot.tierDetails[0].tierId).toBe('tier1');
      expect(snapshot.tierDetails[1].tierId).toBe('tier2');
      expect(snapshot.tierDetails[2].tierId).toBe('tier3');

      // 各档位秒数
      expect(snapshot.tierDetails[0].seconds).toBe(2 * HOUR_S);
      expect(snapshot.tierDetails[1].seconds).toBe(6 * HOUR_S);
      expect(snapshot.tierDetails[2].seconds).toBe(4 * HOUR_S);

      // grain: 10*(7200*1.0 + 21600*0.8 + 14400*0.6) = 10*(7200+17280+8640) = 331200
      expect(snapshot.totalEarned.grain).toBeCloseTo(331200, 2);
      // overallEfficiency = (7200*1.0 + 21600*0.8 + 14400*0.6) / 43200
      //                   = (7200+17280+8640) / 43200 = 33120/43200 ≈ 0.7667
      expect(snapshot.overallEfficiency).toBeCloseTo(0.7667, 2);
    });

    it('TC-9: 离线24小时(86400秒) — tier1+tier2+tier3边界', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();
      const snapshot = offlineReward.calculateSnapshot(24 * HOUR_S, FIXED_RATES);

      // 24小时 = tier1(2h, 100%) + tier2(6h, 80%) + tier3(16h, 60%)
      expect(snapshot.tierDetails).toHaveLength(3);
      expect(snapshot.tierDetails[2].tierId).toBe('tier3');
      expect(snapshot.tierDetails[2].efficiency).toBe(0.6);
      expect(snapshot.tierDetails[2].seconds).toBe(16 * HOUR_S);

      // overallEfficiency = (2*1.0 + 6*0.8 + 16*0.6) / 24 = (2+4.8+9.6)/24 ≈ 0.6833
      expect(snapshot.overallEfficiency).toBeCloseTo(0.6833, 2);
    });

    it('TC-9补充: 离线24小时+10秒 — 触发tier4(40%)', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();
      const snapshot = offlineReward.calculateSnapshot(24 * HOUR_S + 10, FIXED_RATES);

      expect(snapshot.tierDetails).toHaveLength(4);
      expect(snapshot.tierDetails[3].tierId).toBe('tier4');
      expect(snapshot.tierDetails[3].efficiency).toBe(0.4);
      expect(snapshot.tierDetails[3].seconds).toBe(10);
    });

    it('TC-10: 离线48小时(172800秒) — tier1~tier4', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();
      const snapshot = offlineReward.calculateSnapshot(48 * HOUR_S, FIXED_RATES);

      // 48小时 = tier1(2h,100%) + tier2(6h,80%) + tier3(16h,60%) + tier4(24h,40%)
      expect(snapshot.tierDetails).toHaveLength(4);
      expect(snapshot.tierDetails[3].tierId).toBe('tier4');
      expect(snapshot.tierDetails[3].efficiency).toBe(0.4);
      expect(snapshot.tierDetails[3].seconds).toBe(24 * HOUR_S);

      // overallEfficiency = (2*1.0 + 6*0.8 + 16*0.6 + 24*0.4) / 48
      //                   = (2+4.8+9.6+9.6)/48 = 26/48 ≈ 0.5417
      expect(snapshot.overallEfficiency).toBeCloseTo(0.5417, 2);
    });

    it('TC-10补充: 离线48小时+10秒 — 触发tier5(20%)', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();
      const snapshot = offlineReward.calculateSnapshot(48 * HOUR_S + 10, FIXED_RATES);

      expect(snapshot.tierDetails).toHaveLength(5);
      expect(snapshot.tierDetails[4].tierId).toBe('tier5');
      expect(snapshot.tierDetails[4].efficiency).toBe(0.2);
      expect(snapshot.tierDetails[4].seconds).toBe(10);
    });

    it('TC-11: 离线72小时(259200秒) — 全部5档', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();
      const snapshot = offlineReward.calculateSnapshot(72 * HOUR_S, FIXED_RATES);

      // 72小时 = 全部5档
      expect(snapshot.tierDetails).toHaveLength(5);
      expect(snapshot.tierDetails[4].tierId).toBe('tier5');
      expect(snapshot.tierDetails[4].efficiency).toBe(0.2);
      expect(snapshot.tierDetails[4].seconds).toBe(24 * HOUR_S);
      expect(snapshot.isCapped).toBe(false);

      // overallEfficiency = (2*1.0 + 6*0.8 + 16*0.6 + 24*0.4 + 24*0.2) / 72
      //                   = (2+4.8+9.6+9.6+4.8)/72 = 30.8/72 ≈ 0.4278
      expect(snapshot.overallEfficiency).toBeCloseTo(0.4278, 2);
    });
  });

  // ═══════════════════════════════════════════════
  // C. 72小时封顶机制
  // ═══════════════════════════════════════════════
  describe('C. 72小时封顶机制', () => {

    it('TC-12: 离线100小时 — 收益等同于72小时', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();

      const snapshot100h = offlineReward.calculateSnapshot(100 * HOUR_S, FIXED_RATES);
      const snapshot72h = offlineReward.calculateSnapshot(72 * HOUR_S, FIXED_RATES);

      // 标记为封顶
      expect(snapshot100h.isCapped).toBe(true);
      // 72h不封顶
      expect(snapshot72h.isCapped).toBe(false);
      // 收益相同
      expect(snapshot100h.totalEarned.grain).toBeCloseTo(snapshot72h.totalEarned.grain, 3);
      expect(snapshot100h.totalEarned.gold).toBeCloseTo(snapshot72h.totalEarned.gold, 3);
      expect(snapshot100h.totalEarned.troops).toBeCloseTo(snapshot72h.totalEarned.troops, 3);
    });

    it('TC-12: 离线100小时 — tierDetails仍为5档', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();

      const snapshot = offlineReward.calculateSnapshot(100 * HOUR_S, FIXED_RATES);
      // 封顶后仍然只计算5档
      expect(snapshot.tierDetails).toHaveLength(5);
    });

    it('TC-13: 离线30天(720小时) — 收益等同于72小时', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();

      const snapshot30d = offlineReward.calculateSnapshot(30 * 24 * HOUR_S, FIXED_RATES);
      const snapshot72h = offlineReward.calculateSnapshot(72 * HOUR_S, FIXED_RATES);

      expect(snapshot30d.isCapped).toBe(true);
      expect(snapshot30d.totalEarned.grain).toBeCloseTo(snapshot72h.totalEarned.grain, 3);
      expect(snapshot30d.totalEarned.gold).toBeCloseTo(snapshot72h.totalEarned.gold, 3);
    });

    it('TC-13: 离线30天 — offlineSeconds记录原始值', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();

      const thirtyDaysSeconds = 30 * 24 * HOUR_S;
      const snapshot = offlineReward.calculateSnapshot(thirtyDaysSeconds, FIXED_RATES);

      // 原始离线秒数保留
      expect(snapshot.offlineSeconds).toBe(thirtyDaysSeconds);
      // 但收益等同于72h
      expect(snapshot.isCapped).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════
  // D. 离线收益计算正确性验证
  // ═══════════════════════════════════════════════
  describe('D. 离线收益计算正确性', () => {

    it('收益 = 产出速率 × 离线时长 × 衰减系数（单档位）', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();

      // 1小时，100%效率
      const snapshot = offlineReward.calculateSnapshot(1 * HOUR_S, FIXED_RATES);

      // grain = 10 * 3600 * 1.0 = 36000
      expect(snapshot.totalEarned.grain).toBeCloseTo(36000, 2);
      // gold = 5 * 3600 * 1.0 = 18000
      expect(snapshot.totalEarned.gold).toBeCloseTo(18000, 2);
      // troops = 2 * 3600 * 1.0 = 7200
      expect(snapshot.totalEarned.troops).toBeCloseTo(7200, 2);
      // mandate = 0
      expect(snapshot.totalEarned.mandate).toBe(0);
    });

    it('收益 = 产出速率 × 离线时长 × 衰减系数（多档位）', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();

      // 5小时 = tier1(2h,100%) + tier2(3h,80%)
      const snapshot = offlineReward.calculateSnapshot(5 * HOUR_S, FIXED_RATES);

      // grain: tier1 = 10*7200*1.0 = 72000, tier2 = 10*10800*0.8 = 86400
      // total = 158400
      expect(snapshot.totalEarned.grain).toBeCloseTo(158400, 2);

      // gold: tier1 = 5*7200*1.0 = 36000, tier2 = 5*10800*0.8 = 43200
      // total = 79200
      expect(snapshot.totalEarned.gold).toBeCloseTo(79200, 2);
    });

    it('使用引擎真实产出速率计算离线收益', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();

      // 使用引擎真实的产出速率
      const productionRates = sim.engine.resource.getProductionRates();

      // 1小时离线
      const snapshot1h = offlineReward.calculateSnapshot(1 * HOUR_S, productionRates);

      // 收益应该 > 0（引擎有初始产出）
      expect(snapshot1h.totalEarned.grain).toBeGreaterThan(0);
      // 效率100%
      expect(snapshot1h.overallEfficiency).toBe(1.0);
    });

    it('收益随离线时长递增但效率递减', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();
      const rates = sim.engine.resource.getProductionRates();

      const snap1h = offlineReward.calculateSnapshot(1 * HOUR_S, rates);
      const snap8h = offlineReward.calculateSnapshot(8 * HOUR_S, rates);
      const snap24h = offlineReward.calculateSnapshot(24 * HOUR_S, rates);
      const snap72h = offlineReward.calculateSnapshot(72 * HOUR_S, rates);

      // 收益递增
      expect(snap8h.totalEarned.grain).toBeGreaterThan(snap1h.totalEarned.grain);
      expect(snap24h.totalEarned.grain).toBeGreaterThan(snap8h.totalEarned.grain);
      expect(snap72h.totalEarned.grain).toBeGreaterThan(snap24h.totalEarned.grain);

      // 效率递减
      expect(snap1h.overallEfficiency).toBeGreaterThan(snap8h.overallEfficiency);
      expect(snap8h.overallEfficiency).toBeGreaterThan(snap24h.overallEfficiency);
      expect(snap24h.overallEfficiency).toBeGreaterThan(snap72h.overallEfficiency);
    });
  });

  // ═══════════════════════════════════════════════
  // E. 各档位衰减比例精确验证
  // ═══════════════════════════════════════════════
  describe('E. 各档位衰减比例精确验证', () => {

    it('DECAY_TIERS 应有5档', () => {
      expect(DECAY_TIERS).toHaveLength(5);
    });

    it('tier1: 0~2h, efficiency=1.0', () => {
      const tier = DECAY_TIERS[0];
      expect(tier.id).toBe('tier1');
      expect(tier.startHours).toBe(0);
      expect(tier.endHours).toBe(2);
      expect(tier.efficiency).toBe(1.0);
    });

    it('tier2: 2~8h, efficiency=0.8', () => {
      const tier = DECAY_TIERS[1];
      expect(tier.id).toBe('tier2');
      expect(tier.startHours).toBe(2);
      expect(tier.endHours).toBe(8);
      expect(tier.efficiency).toBe(0.8);
    });

    it('tier3: 8~24h, efficiency=0.6', () => {
      const tier = DECAY_TIERS[2];
      expect(tier.id).toBe('tier3');
      expect(tier.startHours).toBe(8);
      expect(tier.endHours).toBe(24);
      expect(tier.efficiency).toBe(0.6);
    });

    it('tier4: 24~48h, efficiency=0.4', () => {
      const tier = DECAY_TIERS[3];
      expect(tier.id).toBe('tier4');
      expect(tier.startHours).toBe(24);
      expect(tier.endHours).toBe(48);
      expect(tier.efficiency).toBe(0.4);
    });

    it('tier5: 48~72h, efficiency=0.2', () => {
      const tier = DECAY_TIERS[4];
      expect(tier.id).toBe('tier5');
      expect(tier.startHours).toBe(48);
      expect(tier.endHours).toBe(72);
      expect(tier.efficiency).toBe(0.2);
    });

    it('MAX_OFFLINE_HOURS 应为72', () => {
      expect(MAX_OFFLINE_HOURS).toBe(72);
    });

    it('OFFLINE_POPUP_THRESHOLD 应为300(5分钟)', () => {
      expect(OFFLINE_POPUP_THRESHOLD).toBe(300);
    });

    it('MAX_OFFLINE_SECONDS 应为259200(72小时)', () => {
      expect(MAX_OFFLINE_SECONDS).toBe(72 * 3600);
    });
  });

  // ═══════════════════════════════════════════════
  // F. 时长格式化验证
  // ═══════════════════════════════════════════════
  describe('F. 时长格式化验证', () => {

    it('TC-1: 10秒格式化', () => {
      expect(formatOfflineDuration(10)).toBe('10秒');
    });

    it('TC-2: 2分钟格式化', () => {
      expect(formatOfflineDuration(2 * MIN_S)).toBe('2分钟');
    });

    it('TC-3: 5分钟格式化', () => {
      expect(formatOfflineDuration(5 * MIN_S)).toBe('5分钟');
    });

    it('TC-4: 30分钟格式化', () => {
      expect(formatOfflineDuration(30 * MIN_S)).toBe('30分钟');
    });

    it('TC-5: 2小时格式化', () => {
      expect(formatOfflineDuration(2 * HOUR_S)).toBe('2小时');
    });

    it('TC-6: 3小时格式化', () => {
      expect(formatOfflineDuration(3 * HOUR_S)).toBe('3小时');
    });

    it('TC-8: 12小时格式化', () => {
      expect(formatOfflineDuration(12 * HOUR_S)).toBe('12小时');
    });

    it('TC-9: 24小时格式化', () => {
      expect(formatOfflineDuration(24 * HOUR_S)).toBe('1天');
    });

    it('TC-10: 48小时格式化', () => {
      expect(formatOfflineDuration(48 * HOUR_S)).toBe('2天');
    });

    it('TC-11: 72小时格式化', () => {
      expect(formatOfflineDuration(72 * HOUR_S)).toBe('3天');
    });

    it('TC-12: 100小时格式化', () => {
      // 100h = 4天4小时
      expect(formatOfflineDuration(100 * HOUR_S)).toBe('4天4小时');
    });

    it('TC-13: 30天格式化', () => {
      expect(formatOfflineDuration(30 * 24 * HOUR_S)).toBe('30天');
    });
  });

  // ═══════════════════════════════════════════════
  // G. 离线收益领取流程验证
  // ═══════════════════════════════════════════════
  describe('G. 离线收益领取流程', () => {

    it('calculateOfflineReward + claimReward 完整流程', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();

      const rates = sim.engine.resource.getProductionRates();
      const currentRes = sim.getAllResources();
      const caps = { grain: 1000000, gold: 1000000, troops: 1000000, mandate: null };

      // 计算离线奖励
      const reward = offlineReward.calculateOfflineReward(
        2 * HOUR_S, rates, currentRes, caps,
      );

      expect(reward).toBeDefined();
      expect(reward.cappedEarned).toBeDefined();
      expect(reward.cappedEarned.grain).toBeGreaterThan(0);

      // 领取奖励
      const claimed = offlineReward.claimReward(reward);
      expect(claimed).not.toBeNull();
      expect(claimed!.grain).toBeGreaterThan(0);
    });

    it('防重复领取：第二次claimReward返回null', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();

      const rates = sim.engine.resource.getProductionRates();
      const currentRes = sim.getAllResources();
      const caps = { grain: 1000000, gold: 1000000, troops: 1000000, mandate: null };

      const reward = offlineReward.calculateOfflineReward(
        1 * HOUR_S, rates, currentRes, caps,
      );

      // 第一次领取成功
      const first = offlineReward.claimReward(reward);
      expect(first).not.toBeNull();

      // 第二次领取失败
      const second = offlineReward.claimReward(reward);
      expect(second).toBeNull();
    });

    it('重新calculate后可以再次领取', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();

      const rates = sim.engine.resource.getProductionRates();
      const currentRes = sim.getAllResources();
      const caps = { grain: 1000000, gold: 1000000, troops: 1000000, mandate: null };

      // 第一次计算+领取
      const reward1 = offlineReward.calculateOfflineReward(
        1 * HOUR_S, rates, currentRes, caps,
      );
      offlineReward.claimReward(reward1);

      // 重新计算+领取（新一轮）
      const reward2 = offlineReward.calculateOfflineReward(
        2 * HOUR_S, rates, currentRes, caps,
      );
      const second = offlineReward.claimReward(reward2);
      expect(second).not.toBeNull();
    });
  });

  // ═══════════════════════════════════════════════
  // H. 离线收益弹窗优先级验证（引擎层）
  // ═══════════════════════════════════════════════
  describe('H. 离线收益弹窗优先级验证', () => {

    it('离线>5分钟触发离线收益弹窗（优先级1，不可跳过）', () => {
      // 引擎层验证：shouldShowOfflinePopup返回true
      expect(shouldShowOfflinePopup(6 * MIN_S)).toBe(true);
      expect(shouldShowOfflinePopup(30 * MIN_S)).toBe(true);
      expect(shouldShowOfflinePopup(2 * HOUR_S)).toBe(true);
    });

    it('离线≤5分钟不触发离线收益弹窗（静默补算）', () => {
      expect(shouldShowOfflinePopup(0)).toBe(false);
      expect(shouldShowOfflinePopup(1 * MIN_S)).toBe(false);
      expect(shouldShowOfflinePopup(5 * MIN_S)).toBe(false);
    });

    it('离线>1小时可触发回归欢迎面板（优先级4）', () => {
      // 引擎层验证：generateReturnPanel在离线>1h时可用
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();
      const rates = sim.engine.resource.getProductionRates();

      // 2小时离线 — 回归面板应包含数据
      const panel = offlineReward.generateReturnPanel(2 * HOUR_S, rates, 0);
      expect(panel).toBeDefined();
      expect(panel.formattedTime).toBeTruthy();
      expect(panel.totalEarned).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════
  // I. 边界条件与健壮性
  // ═══════════════════════════════════════════════
  describe('I. 边界条件与健壮性', () => {

    it('0秒离线 — 空快照', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();
      const snapshot = offlineReward.calculateSnapshot(0, FIXED_RATES);

      expect(snapshot.offlineSeconds).toBe(0);
      expect(snapshot.tierDetails).toHaveLength(0);
      expect(snapshot.totalEarned.grain).toBe(0);
      expect(snapshot.isCapped).toBe(false);
    });

    it('负数秒离线 — 空快照', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();
      const snapshot = offlineReward.calculateSnapshot(-100, FIXED_RATES);

      expect(snapshot.offlineSeconds).toBe(0);
      expect(snapshot.tierDetails).toHaveLength(0);
    });

    it('1秒离线 — 有效快照', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();
      const snapshot = offlineReward.calculateSnapshot(1, FIXED_RATES);

      expect(snapshot.tierDetails).toHaveLength(1);
      expect(snapshot.totalEarned.grain).toBeCloseTo(10, 2);
    });

    it('零产出速率 — 零收益', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();
      const zeroRates = { grain: 0, gold: 0, troops: 0, mandate: 0 };
      const snapshot = offlineReward.calculateSnapshot(10 * HOUR_S, zeroRates);

      expect(snapshot.totalEarned.grain).toBe(0);
      expect(snapshot.totalEarned.gold).toBe(0);
    });

    it('OfflineRewardSystem在引擎注册表中', () => {
      const sim = createSim();
      const registry = sim.engine.getSubsystemRegistry();

      expect(registry.has('offlineReward')).toBe(true);
      expect(registry.has('offlineEstimate')).toBe(true);
    });
  });
});
