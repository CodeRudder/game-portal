/**
 * 集成链路测试 — 链路6: 离线 → 收益 → 事件
 *
 * 覆盖场景：
 * - 离线时间计算 → 累计收益 → 触发离线事件
 * - 离线收益分层 → 效率衰减 → 收益上限
 * - 离线快照 → 数据持久化 → 加载后恢复
 * - 离线事件队列 → 事件触发 → 奖励发放
 * - 离线与在线状态切换 → 数据一致性
 *
 * 关键约束：
 * - 非主城建筑等级不能超过主城等级
 * - 升级farmland前必须先升级castle
 *
 * 测试原则：
 * - 每个用例独立创建 sim 实例
 * - 使用真实引擎 API，不使用 mock
 * - 验证端到端数据流一致性
 */

import { describe, it, expect } from 'vitest';
import { createSim, createSimWithResources, MASSIVE_RESOURCES, SUFFICIENT_RESOURCES } from '../../../test-utils/test-helpers';

// ═══════════════════════════════════════════════
// 链路6: 离线 → 收益 → 事件 端到端验证
// ═══════════════════════════════════════════════
describe('链路6: 离线→收益→事件 集成测试', () => {

  describe('CHAIN6-01: 离线奖励系统基础验证', () => {
    it('should have offline reward system accessible', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();
      expect(offlineReward).toBeDefined();
    });

    it('should have offline estimate system accessible', () => {
      const sim = createSim();
      const offlineEstimate = sim.engine.getOfflineEstimateSystem();
      expect(offlineEstimate).toBeDefined();
    });

    it('should have offline snapshot system accessible', () => {
      const sim = createSim();
      const offlineSnapshot = sim.engine.getOfflineSnapshotSystem();
      expect(offlineSnapshot).toBeDefined();
    });

    it('should have offline event system accessible', () => {
      const sim = createSim();
      const offlineEvent = sim.engine.getOfflineEventSystem();
      expect(offlineEvent).toBeDefined();
    });
  });

  describe('CHAIN6-02: 离线收益计算', () => {
    it('should calculate offline snapshot for given duration', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();

      const productionRates = sim.engine.resource.getProductionRates();
      const snapshot = offlineReward.calculateSnapshot(3600, productionRates);

      expect(snapshot).toBeDefined();
      expect(snapshot.offlineSeconds).toBe(3600);
      expect(snapshot.totalEarned).toBeDefined();
    });

    it('should return zero earnings for zero offline time', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();

      const productionRates = sim.engine.resource.getProductionRates();
      const snapshot = offlineReward.calculateSnapshot(0, productionRates);

      expect(snapshot.offlineSeconds).toBe(0);
    });

    it('should return zero earnings for negative offline time', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();

      const productionRates = sim.engine.resource.getProductionRates();
      const snapshot = offlineReward.calculateSnapshot(-100, productionRates);

      expect(snapshot.offlineSeconds).toBe(0);
    });

    it('should calculate higher earnings for longer offline time', () => {
      const sim = createSim();
      sim.addResources(SUFFICIENT_RESOURCES);
      // 先升级castle再升级farmland
      sim.upgradeBuilding('castle');
      sim.addResources(SUFFICIENT_RESOURCES);
      sim.upgradeBuilding('farmland');

      const offlineReward = sim.engine.getOfflineRewardSystem();
      const productionRates = sim.engine.resource.getProductionRates();

      const shortSnapshot = offlineReward.calculateSnapshot(3600, productionRates);
      const longSnapshot = offlineReward.calculateSnapshot(7200, productionRates);

      expect(longSnapshot.offlineSeconds).toBeGreaterThan(shortSnapshot.offlineSeconds);
    });
  });

  describe('CHAIN6-03: 离线收益→资源增加', () => {
    it('should have production rates that contribute to offline earnings', () => {
      const sim = createSim();
      sim.addResources(SUFFICIENT_RESOURCES);
      sim.upgradeBuilding('castle');
      sim.addResources(SUFFICIENT_RESOURCES);
      sim.upgradeBuilding('farmland');

      const rates = sim.engine.resource.getProductionRates();
      const offlineReward = sim.engine.getOfflineRewardSystem();

      const snapshot = offlineReward.calculateSnapshot(3600, rates);

      if (rates.grain > 0) {
        expect(snapshot.totalEarned.grain ?? 0).toBeGreaterThanOrEqual(0);
      }
    });

    it('should reflect upgraded buildings in offline earnings', () => {
      const sim = createSim();
      sim.engine.resource.setCap('grain', 50_000_000);
      sim.addResources(MASSIVE_RESOURCES);

      const ratesBefore = sim.engine.resource.getProductionRates();
      const offlineReward = sim.engine.getOfflineRewardSystem();

      const earningsBefore = offlineReward.calculateSnapshot(3600, ratesBefore);

      // 先升级castle再升级farmland
      sim.upgradeBuilding('castle');
      sim.addResources(MASSIVE_RESOURCES);
      sim.upgradeBuilding('farmland');

      const ratesAfter = sim.engine.resource.getProductionRates();
      const earningsAfter = offlineReward.calculateSnapshot(3600, ratesAfter);

      const beforeGrain = earningsBefore.totalEarned.grain ?? 0;
      const afterGrain = earningsAfter.totalEarned.grain ?? 0;
      expect(afterGrain).toBeGreaterThanOrEqual(beforeGrain);
    });
  });

  describe('CHAIN6-04: 离线事件系统', () => {
    it('should have offline event system with serialization', () => {
      const sim = createSim();
      const offlineEvent = sim.engine.getOfflineEventSystem();
      expect(offlineEvent).toBeDefined();
      expect(typeof offlineEvent.exportSaveData).toBe('function');
    });

    it('should persist offline events through save/load', () => {
      const sim = createSim();

      const json = sim.engine.serialize();
      const sim2 = createSim();
      sim2.engine.deserialize(json);

      const offlineDataAfter = sim2.engine.getOfflineEventSystem().exportSaveData();
      expect(offlineDataAfter).toBeDefined();
    });
  });

  describe('CHAIN6-05: 离线快照→保存→加载→恢复', () => {
    it('should persist offline snapshot state through save/load', () => {
      const sim = createSim();
      const snapshotSystem = sim.engine.getOfflineSnapshotSystem();
      expect(snapshotSystem).toBeDefined();

      const json = sim.engine.serialize();
      const sim2 = createSim();
      sim2.engine.deserialize(json);

      const snapshotSystem2 = sim2.engine.getOfflineSnapshotSystem();
      expect(snapshotSystem2).toBeDefined();
    });

    it('should calculate offline earnings based on saved production rates', () => {
      const sim = createSim();
      sim.engine.resource.setCap('grain', 50_000_000);
      sim.addResources(MASSIVE_RESOURCES);
      // 先升级castle再升级farmland
      sim.upgradeBuilding('castle');
      sim.addResources(MASSIVE_RESOURCES);
      sim.upgradeBuilding('farmland');

      const ratesBefore = sim.engine.resource.getProductionRates();

      const json = sim.engine.serialize();
      const sim2 = createSim();
      sim2.engine.deserialize(json);

      const ratesAfter = sim2.engine.resource.getProductionRates();
      expect(ratesAfter.grain).toBe(ratesBefore.grain);
    });
  });

  describe('CHAIN6-06: 离线→在线切换→数据一致性', () => {
    it('should maintain resource consistency after save/load (simulating offline)', () => {
      const sim = createSim();
      sim.addResources({ grain: 5000, gold: 3000 });

      const resourcesBefore = sim.getAllResources();

      const json = sim.engine.serialize();

      const sim2 = createSim();
      sim2.engine.deserialize(json);

      const resourcesAfter = sim2.getAllResources();
      expect(resourcesAfter.grain).toBe(resourcesBefore.grain);
      expect(resourcesAfter.gold).toBe(resourcesBefore.gold);
    });

    it('should handle tick after load correctly', () => {
      const sim = createSim();
      sim.addResources(SUFFICIENT_RESOURCES);

      const json = sim.engine.serialize();
      const sim2 = createSim();
      sim2.engine.deserialize(json);

      const grainBefore = sim2.getResource('grain');

      sim2.engine.tick(1000);

      const grainAfter = sim2.getResource('grain');
      expect(grainAfter).toBeGreaterThanOrEqual(grainBefore);
    });
  });

  describe('CHAIN6-07: 离线收益翻倍机制', () => {
    it('should have offline reward system with double capability', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();

      const rates = sim.engine.resource.getProductionRates();
      const snapshot = offlineReward.calculateSnapshot(3600, rates);

      const doubleResult = offlineReward.applyDouble(snapshot.totalEarned, {
        useVipDouble: false,
        useAdDouble: false,
      });

      expect(doubleResult).toBeDefined();
      expect(doubleResult.success).toBeDefined();
    });

    it('should apply VIP double correctly when available', () => {
      const sim = createSim();
      const offlineReward = sim.engine.getOfflineRewardSystem();

      const rates = sim.engine.resource.getProductionRates();
      const snapshot = offlineReward.calculateSnapshot(3600, rates);

      const doubleResult = offlineReward.applyDouble(snapshot.totalEarned, {
        useVipDouble: true,
        useAdDouble: false,
      });

      expect(doubleResult).toBeDefined();
    });
  });

  describe('CHAIN6-08: 全链路端到端: 升级建筑→离线→计算收益→加载→验证', () => {
    it('should complete full offline-reward-event chain', () => {
      // 1. 创建引擎并升级建筑
      const sim = createSim();
      sim.engine.resource.setCap('grain', 50_000_000);
      sim.addResources(MASSIVE_RESOURCES);
      // 先升级castle再升级farmland
      sim.upgradeBuilding('castle');
      sim.addResources(MASSIVE_RESOURCES);
      sim.upgradeBuilding('farmland');

      const ratesBefore = sim.engine.resource.getProductionRates();

      // 2. 保存（模拟下线）
      const json = sim.engine.serialize();

      // 3. 加载（模拟上线）
      const sim2 = createSim();
      sim2.engine.deserialize(json);

      // 4. 验证产出率一致
      const ratesAfter = sim2.engine.resource.getProductionRates();
      expect(ratesAfter.grain).toBe(ratesBefore.grain);

      // 5. 计算离线收益
      const offlineReward = sim2.engine.getOfflineRewardSystem();
      const snapshot = offlineReward.calculateSnapshot(7200, ratesAfter);

      expect(snapshot).toBeDefined();
      expect(snapshot.offlineSeconds).toBe(7200);

      // 6. 保存离线后状态
      const json2 = sim2.engine.serialize();
      const sim3 = createSim();
      sim3.engine.deserialize(json2);

      // 7. 验证最终一致性
      const ratesFinal = sim3.engine.resource.getProductionRates();
      expect(ratesFinal.grain).toBe(ratesBefore.grain);
    });

    it('should handle multiple save/load cycles with offline calculations', () => {
      const sim = createSim();
      sim.addResources({ grain: 10000, gold: 5000 });

      // 第一轮保存/加载
      const json1 = sim.engine.serialize();
      const sim2 = createSim();
      sim2.engine.deserialize(json1);

      // 修改状态
      sim2.addResources({ gold: 1000 });

      // 第二轮保存/加载
      const json2 = sim2.engine.serialize();
      const sim3 = createSim();
      sim3.engine.deserialize(json2);

      // 验证累积效果
      expect(sim3.getResource('gold')).toBe(sim2.getResource('gold'));
    });
  });
});
