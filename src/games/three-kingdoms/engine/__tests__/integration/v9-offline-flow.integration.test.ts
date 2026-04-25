/**
 * v9.0 离线收益 Play 流程集成测试
 *
 * 覆盖范围（按 play 文档章节组织）：
 * - §1 离线收益系统: 5档衰减率、72h封顶、翻倍、加成系数
 * - §2 离线经验: 经验产出快照、经验溢出
 * - §3 离线资源: 资源产出、溢出规则、资源保护
 * - §4 离线快照系统: 保存/恢复、完成检测、快照有效性
 * - §5 离线估算系统: 预估收益、效率曲线、推荐时长
 * - §6 跨系统联动: 快照→奖励→翻倍→入账
 *
 * 测试原则：
 * - 每个用例创建独立的 sim 实例
 * - 使用真实引擎 API，不使用 mock
 * - 以实际代码行为为准
 *
 * @see docs/games/three-kingdoms/play/v9-play.md
 */

import { describe, it, expect } from 'vitest';
import { createSim, SUFFICIENT_RESOURCES, MASSIVE_RESOURCES } from '../../../test-utils/test-helpers';
import type { Resources } from '../../../../shared/types';

// ── 辅助函数 ──

/** 创建标准产出速率用于离线测试 */
function createProductionRates(): Resources {
  return {
    grain: 100,
    gold: 50,
    troops: 10,
    mandate: 0,
    techPoint: 0,
    recruitToken: 0,
  };
}

/** 创建包含上限的快照参数 */
function createSnapshotParams() {
  return {
    resources: { grain: 1000, gold: 500, troops: 100, mandate: 50, techPoint: 0, recruitToken: 0 },
    productionRates: createProductionRates(),
    caps: { grain: 50000, gold: null, troops: 10000, mandate: null, techPoint: null, recruitToken: null },
    buildingQueue: [],
    techQueue: [],
    expeditionQueue: [],
    tradeCaravans: [],
  };
}

// ═══════════════════════════════════════════════════════════════
// §1 离线收益系统
// ═══════════════════════════════════════════════════════════════
describe('v9.0 离线收益 — §1 离线收益系统', () => {

  it('should access offline reward system via engine getter', () => {
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    expect(offlineReward).toBeDefined();
    expect(typeof offlineReward.calculateSnapshot).toBe('function');
    expect(typeof offlineReward.generateReturnPanel).toBe('function');
  });

  // ── §1.1 离线计算核心 ──
  it('should calculate offline snapshot with production rates', () => {
    // Play §1.1: 基础收益 = 净产出速率 × 离线秒数
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();

    const snapshot = offlineReward.calculateSnapshot(3600, rates);
    expect(snapshot).toBeDefined();
    expect(snapshot.grain ?? 0).toBeGreaterThanOrEqual(0);
  });

  // ── §1.2 五档衰减系数 ──
  it('should apply tier1 decay (0~2h → 100%) for 1h offline', () => {
    // Play §1.2: 0~2h→100%
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();

    const snapshot = offlineReward.calculateSnapshot(3600, rates); // 1h
    expect(snapshot).toBeDefined();
    expect(snapshot.totalEarned).toBeDefined();
    // 1小时应完全在100%档位
    expect(snapshot.overallEfficiency).toBeCloseTo(1.0, 1);
  });

  it('should apply tier2 decay (2~8h → 80%) for 5h offline', () => {
    // Play §1.2: 2~8h→80%
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();

    const snapshot = offlineReward.calculateSnapshot(18000, rates); // 5h
    expect(snapshot).toBeDefined();
    // 5h = 2h@100% + 3h@80%, 效率应在0.8~1.0之间
    expect(snapshot.overallEfficiency).toBeGreaterThan(0.8);
    expect(snapshot.overallEfficiency).toBeLessThan(1.0);
  });

  it('should apply tier3 decay (8~24h → 60%) for 15h offline', () => {
    // Play §1.2: 8~24h→60%
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();

    const snapshot = offlineReward.calculateSnapshot(54000, rates); // 15h
    expect(snapshot).toBeDefined();
    expect(snapshot.overallEfficiency).toBeGreaterThan(0.5);
    expect(snapshot.overallEfficiency).toBeLessThan(0.9);
  });

  it('should apply tier4 decay (24~48h → 40%) for 36h offline', () => {
    // Play §1.2: 24~48h→40%
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();

    const snapshot = offlineReward.calculateSnapshot(129600, rates); // 36h
    expect(snapshot).toBeDefined();
    expect(snapshot.overallEfficiency).toBeGreaterThan(0.3);
    expect(snapshot.overallEfficiency).toBeLessThan(0.7);
  });

  it('should apply tier5 decay (48~72h → 20%) for 60h offline', () => {
    // Play §1.2: 48~72h→20%
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();

    const snapshot = offlineReward.calculateSnapshot(216000, rates); // 60h
    expect(snapshot).toBeDefined();
    expect(snapshot.overallEfficiency).toBeGreaterThan(0.1);
    expect(snapshot.overallEfficiency).toBeLessThan(0.5);
  });

  it('should cap offline rewards at 72 hours', () => {
    // Play §1.2: >72h→封顶，不新增收益
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();

    const snap72h = offlineReward.calculateSnapshot(259200, rates);
    const snap200h = offlineReward.calculateSnapshot(720000, rates);

    const total72h = snap72h.totalEarned.grain + snap72h.totalEarned.gold;
    const total200h = snap200h.totalEarned.grain + snap200h.totalEarned.gold;
    // 200h收益不应超过72h（封顶）
    expect(total200h).toBeLessThanOrEqual(total72h * 1.01);
  });

  it('should show longer offline yields more total but with diminishing returns', () => {
    // Play §1.2: 衰减分档平滑递减
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();

    const snap1h = offlineReward.calculateSnapshot(3600, rates);
    const snap24h = offlineReward.calculateSnapshot(86400, rates);
    const snap72h = offlineReward.calculateSnapshot(259200, rates);

    const total1h = snap1h.totalEarned.grain + snap1h.totalEarned.gold;
    const total24h = snap24h.totalEarned.grain + snap24h.totalEarned.gold;
    const total72h = snap72h.totalEarned.grain + snap72h.totalEarned.gold;

    // 时间越长总收益越多
    expect(total24h).toBeGreaterThan(total1h);
    expect(total72h).toBeGreaterThanOrEqual(total24h);
  });

  // ── §1.3 加成系数叠加 ──
  it('should calculate VIP bonus for offline rewards', () => {
    // Play §1.3: VIP加成(VIP1 +5% / VIP3 +10% / VIP5 +20%)
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();

    const vipBonus0 = offlineReward.getVipBonus(0);
    const vipBonus3 = offlineReward.getVipBonus(3);
    const vipBonus5 = offlineReward.getVipBonus(5);

    expect(vipBonus0).toBeDefined();
    expect(vipBonus3).toBeDefined();
    expect(vipBonus5).toBeDefined();

    // 更高VIP等级应有更高加成
    expect(vipBonus3.efficiencyBonus).toBeGreaterThanOrEqual(vipBonus0.efficiencyBonus);
    expect(vipBonus5.efficiencyBonus).toBeGreaterThanOrEqual(vipBonus3.efficiencyBonus);
  });

  it('should apply VIP bonus to earned resources', () => {
    // Play §1.3: 三项加成加法累加
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();

    const snapshot = offlineReward.calculateSnapshot(3600, rates);
    const boosted = offlineReward.applyVipBonus(snapshot.totalEarned, 3);

    expect(boosted).toBeDefined();
    expect(boosted.grain).toBeGreaterThanOrEqual(snapshot.totalEarned.grain);
  });

  it('should get system efficiency modifiers', () => {
    // Play §1.3: 系统差异化修正系数
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();

    const modifiers = offlineReward.getAllSystemModifiers();
    expect(Array.isArray(modifiers)).toBe(true);
  });

  it('should apply system modifier to earned resources', () => {
    // Play §1.3: 资源×1.0 / 建筑×1.2 / 科技×1.0 / 远征×0.85
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();

    const snapshot = offlineReward.calculateSnapshot(3600, rates);
    const modified = offlineReward.applySystemModifier(snapshot.totalEarned, 'building');

    expect(modified).toBeDefined();
  });

  // ── §1.4 离线收益弹窗与翻倍 ──
  it('should generate return panel data', () => {
    // Play §1.4: 弹窗展示离线时长/效率系数/各资源收益/来源占比饼图
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();

    const panel = offlineReward.generateReturnPanel(3600, rates, 0);
    expect(panel).toBeDefined();
  });

  it('should handle ad double reward request', () => {
    // Play §1.4: 广告翻倍(3次/天)
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();

    const snapshot = offlineReward.calculateSnapshot(3600, rates);
    const doubleResult = offlineReward.applyDouble(snapshot.totalEarned, {
      source: 'ad',
      multiplier: 2,
    });

    expect(doubleResult).toBeDefined();
    expect(doubleResult.success).toBe(true);
    expect(doubleResult.doubledEarned).toBeDefined();
  });

  it('should handle VIP double reward request', () => {
    // Play §1.4: 元宝翻倍(无限制)
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();

    const snapshot = offlineReward.calculateSnapshot(3600, rates);
    const doubleResult = offlineReward.applyDouble(snapshot.totalEarned, {
      source: 'vip',
      multiplier: 2,
    });

    expect(doubleResult).toBeDefined();
    expect(typeof doubleResult.success).toBe('boolean');
  });

  it('should list available double options', () => {
    // Play §1.4: 广告翻倍和元宝翻倍二选一
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();

    const doubles = offlineReward.getAvailableDoubles(3600, 0);
    expect(Array.isArray(doubles)).toBe(true);
  });

  // ── §1.5 加速道具 ──
  it('should manage boost items', () => {
    // Play §1.5: 加速道具
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();

    const items = offlineReward.getBoostItems();
    expect(Array.isArray(items)).toBe(true);

    offlineReward.addBoostItem('boost_001', 1);
    const itemsAfter = offlineReward.getBoostItems();
    expect(itemsAfter.length).toBeGreaterThanOrEqual(items.length);
  });

  // ── 离线贸易 ──
  it('should simulate offline trade', () => {
    // Play §3: 离线贸易
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();

    const tradeProfit = { grain: 100, gold: 50, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 };
    const summary = offlineReward.simulateOfflineTrade(3600, tradeProfit);
    expect(summary).toBeDefined();
  });

  // ── 资源保护 ──
  it('should apply resource protection', () => {
    // Play §3: 资源保护机制
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();

    const protection = offlineReward.getResourceProtection('grain', 1000);
    expect(typeof protection).toBe('number');
  });

  it('should apply cap and overflow correctly', () => {
    // Play §3: 溢出规则
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();

    const earned: Resources = { grain: 50000, gold: 1000, troops: 20000, mandate: 100, techPoint: 0, recruitToken: 0 };
    const current: Resources = { grain: 40000, gold: 500, troops: 8000, mandate: 50, techPoint: 0, recruitToken: 0 };
    const caps: Record<string, number | null> = { grain: 50000, gold: null, troops: 10000, mandate: null };

    const result = offlineReward.applyCapAndOverflow(earned, current, caps);
    expect(result).toBeDefined();
    expect(result.cappedEarned).toBeDefined();
    expect(result.overflowResources).toBeDefined();
  });

});

// ═══════════════════════════════════════════════════════════════
// §4 离线快照系统
// ═══════════════════════════════════════════════════════════════
describe('v9.0 离线收益 — §4 离线快照系统', () => {

  it('should access offline snapshot system via engine getter', () => {
    const sim = createSim();
    const snapshotSys = sim.engine.getOfflineSnapshotSystem();
    expect(snapshotSys).toBeDefined();
    expect(typeof snapshotSys.createSnapshot).toBe('function');
    expect(typeof snapshotSys.getSnapshot).toBe('function');
  });

  it('should create and retrieve snapshot', () => {
    // Play §1.1: 系统立即记录快照
    const sim = createSim();
    const snapshotSys = sim.engine.getOfflineSnapshotSystem();

    snapshotSys.createSnapshot(createSnapshotParams());

    const snapshot = snapshotSys.getSnapshot();
    expect(snapshot).toBeDefined();
    expect(snapshot).not.toBeNull();
  });

  it('should check snapshot validity', () => {
    // Play §1.1: 快照72h有效期
    const sim = createSim();
    const snapshotSys = sim.engine.getOfflineSnapshotSystem();

    const validBefore = snapshotSys.isSnapshotValid();
    expect(typeof validBefore).toBe('boolean');

    snapshotSys.createSnapshot(createSnapshotParams());

    const validAfter = snapshotSys.isSnapshotValid();
    expect(typeof validAfter).toBe('boolean');
  });

  it('should calculate offline seconds from snapshot', () => {
    // Play §1.1: 离线时长计算
    const sim = createSim();
    const snapshotSys = sim.engine.getOfflineSnapshotSystem();

    snapshotSys.createSnapshot(createSnapshotParams());

    const seconds = snapshotSys.getOfflineSeconds();
    expect(typeof seconds).toBe('number');
  });

  it('should clear snapshot', () => {
    // Play: 领取后清理快照
    const sim = createSim();
    const snapshotSys = sim.engine.getOfflineSnapshotSystem();

    snapshotSys.createSnapshot(createSnapshotParams());

    snapshotSys.clearSnapshot();
    const snapshot = snapshotSys.getSnapshot();
    expect(snapshot).toBeNull();
  });

  it('should detect completed buildings from snapshot', () => {
    // Play §1.1: 建筑队列状态
    const sim = createSim();
    const snapshotSys = sim.engine.getOfflineSnapshotSystem();

    snapshotSys.createSnapshot(createSnapshotParams());

    const completed = snapshotSys.getCompletedBuildings();
    expect(Array.isArray(completed)).toBe(true);
  });

  it('should detect completed tech from snapshot', () => {
    // Play §1.1: 科技队列状态
    const sim = createSim();
    const snapshotSys = sim.engine.getOfflineSnapshotSystem();

    snapshotSys.createSnapshot(createSnapshotParams());

    const completed = snapshotSys.getCompletedTech();
    expect(Array.isArray(completed)).toBe(true);
  });

  it('should detect completed expeditions from snapshot', () => {
    // Play §1.1: 远征队列状态
    const sim = createSim();
    const snapshotSys = sim.engine.getOfflineSnapshotSystem();

    snapshotSys.createSnapshot(createSnapshotParams());

    const completed = snapshotSys.getCompletedExpeditions();
    expect(Array.isArray(completed)).toBe(true);
  });

  it('should detect completed trades from snapshot', () => {
    // Play §1.1: 商队运输状态
    const sim = createSim();
    const snapshotSys = sim.engine.getOfflineSnapshotSystem();

    snapshotSys.createSnapshot(createSnapshotParams());

    const completed = snapshotSys.getCompletedTrades();
    expect(Array.isArray(completed)).toBe(true);
  });

});

// ═══════════════════════════════════════════════════════════════
// §5 离线估算系统
// ═══════════════════════════════════════════════════════════════
describe('v9.0 离线收益 — §5 离线估算系统', () => {

  it('should access offline estimate system via engine getter', () => {
    const sim = createSim();
    const estimate = sim.engine.getOfflineEstimateSystem();
    expect(estimate).toBeDefined();
    expect(typeof estimate.estimate).toBe('function');
    expect(typeof estimate.getEfficiencyCurve).toBe('function');
  });

  it('should estimate offline earnings from production rates', () => {
    // Play §1.1: 预估收益计算
    const sim = createSim();
    const estimate = sim.engine.getOfflineEstimateSystem();
    const rates = createProductionRates();

    const result = estimate.estimate(rates);
    expect(result).toBeDefined();
    expect(result.timeline).toBeDefined();
    expect(Array.isArray(result.timeline)).toBe(true);
    expect(typeof result.recommendedHours).toBe('number');
  });

  it('should recommend optimal offline hours (≤72h)', () => {
    // Play §1.2: 温和引导玩家2天内回归
    const sim = createSim();
    const estimate = sim.engine.getOfflineEstimateSystem();
    const rates = createProductionRates();

    const result = estimate.estimate(rates);
    expect(result.recommendedHours).toBeGreaterThan(0);
    expect(result.recommendedHours).toBeLessThanOrEqual(72);
  });

  it('should generate efficiency curve showing decay over time', () => {
    // Play §1.2: 衰减系数采用分段计算
    const sim = createSim();
    const estimate = sim.engine.getOfflineEstimateSystem();

    const curve = estimate.getEfficiencyCurve(72);
    expect(Array.isArray(curve)).toBe(true);
    // 效率应该随时间递减
    if (curve.length >= 2) {
      expect(curve[0].efficiency).toBeGreaterThanOrEqual(curve[curve.length - 1].efficiency);
    }
  });

});

// ═══════════════════════════════════════════════════════════════
// §6 跨系统联动
// ═══════════════════════════════════════════════════════════════
describe('v9.0 离线收益 — §6 跨系统联动', () => {

  it('should coordinate offline reward with snapshot system', () => {
    // Play §1.1: 快照→计算→收益
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const snapshotSys = sim.engine.getOfflineSnapshotSystem();
    const rates = createProductionRates();

    snapshotSys.createSnapshot(createSnapshotParams());

    const offlineSeconds = snapshotSys.getOfflineSeconds();
    const snapshot = offlineReward.calculateSnapshot(offlineSeconds || 3600, rates);
    expect(snapshot).toBeDefined();
  });

  it('should integrate estimate with reward calculation', () => {
    // Play §1.1: 先估算→再计算
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const estimate = sim.engine.getOfflineEstimateSystem();
    const rates = createProductionRates();

    const estimateResult = estimate.estimate(rates);
    expect(estimateResult.recommendedHours).toBeGreaterThan(0);

    const snapshot = offlineReward.calculateSnapshot(
      estimateResult.recommendedHours * 3600,
      rates,
    );
    expect(snapshot).toBeDefined();
  });

  it('should complete full offline flow: snapshot → calculate → double → claim', () => {
    // Play §1.4: 完整离线收益领取流程
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const snapshotSys = sim.engine.getOfflineSnapshotSystem();
    const rates = createProductionRates();

    // 1. 创建快照
    snapshotSys.createSnapshot(createSnapshotParams());

    // 2. 计算离线收益
    const snapshot = offlineReward.calculateSnapshot(7200, rates); // 2h
    expect(snapshot.totalEarned).toBeDefined();

    // 3. 翻倍
    const doubleResult = offlineReward.applyDouble(snapshot.totalEarned, {
      source: 'ad',
      multiplier: 2,
    });
    expect(doubleResult.success).toBe(true);

    // 4. 清理快照
    snapshotSys.clearSnapshot();
    expect(snapshotSys.getSnapshot()).toBeNull();
  });

});
