/**
 * 资源系统 Play 流程集成测试 (v1.0 RES-FLOW-1~5)
 *
 * 覆盖范围：
 * - RES-FLOW-1: 资源自动增长验证
 * - RES-FLOW-2: 资源消耗验证
 * - RES-FLOW-3: 容量上限与警告验证
 * - RES-FLOW-4: 天命资源特殊验证
 * - RES-FLOW-5: 资源产出粒子效果（引擎层事件验证）
 *
 * 测试原则：
 * - 每个用例创建独立的 sim 实例
 * - 使用真实引擎 API，不使用 mock
 * - 以实际代码行为为准
 *
 * 关键约束：
 * - 非主城建筑等级不能超过主城等级（初始 castle=1, farmland=1）
 * - 升级 farmland 前必须先升级 castle
 * - [P1-2 说明] 容量警告阈值（见 resource-config.ts CAP_WARNING_THRESHOLDS）：
 *   PRD 定义5级（安全0-70%/注意70-90%/警告90-95%/紧急95-100%/已满100%）。
 *   引擎 CAP_WARNING_THRESHOLDS 定义了 safe=0.7/notice=0.9/warning=0.95/urgent=1.0，
 *   但 getWarningLevel() 中 safe=0.7 仅作为 notice(>=0.9) 的隐式边界，
 *   urgent(>=1.0) 被 full(>=1.0) 先拦截。实际可触发的4级：
 *   safe(<90%) → notice(90%~95%) → warning(95%~100%) → full(100%)
 */

import { describe, it, expect } from 'vitest';
import { createSim, SUFFICIENT_RESOURCES } from '../../../test-utils/test-helpers';
import type { ResourceType } from '../../../shared/types';

// ═══════════════════════════════════════════════
// RES-FLOW-1: 资源自动增长验证
// ═══════════════════════════════════════════════
describe('V1 RES-FLOW 资源系统', () => {
  describe('RES-FLOW-1: 资源自动增长验证', () => {
    it('should auto-grow grain after time passes', () => {
      // RES-FLOW-1 步骤1: 初始化游戏
      const sim = createSim();

      // 记录初始资源值
      const grainBefore = sim.getResource('grain');

      // RES-FLOW-1 步骤2: fastForward 3000ms
      sim.fastForward(3000);

      // 验证 grain 自动增长（农田 Lv1 产出 0.8/s，3秒 ≈ 2.4）
      const grainAfter = sim.getResource('grain');
      expect(grainAfter).toBeGreaterThan(grainBefore);
    });

    it('should NOT auto-grow gold/troops/techPoint when their buildings are locked', () => {
      // 初始状态：市集/兵营/书院未解锁，对应资源无产出
      const sim = createSim();

      const goldBefore = sim.getResource('gold');
      const troopsBefore = sim.getResource('troops');
      const techPointBefore = sim.getResource('techPoint');

      sim.fastForwardSeconds(5);

      // 市集未解锁，gold 不增长
      expect(sim.getResource('gold')).toBe(goldBefore);
      // 兵营未解锁，troops 不增长
      expect(sim.getResource('troops')).toBe(troopsBefore);
      // 书院未解锁，techPoint 不增长
      expect(sim.getResource('techPoint')).toBe(techPointBefore);
    });

    it('should grow gold after market is unlocked and upgraded', () => {
      // 解锁市集需要主城 Lv2，升级市集后 gold 开始产出
      const sim = createSim();

      // 给足资源升级主城到 Lv2 并升级市集
      sim.addResources({ grain: 10000, gold: 10000, troops: 5000 });
      sim.upgradeBuildingTo('castle', 2);
      sim.upgradeBuilding('market');

      const goldBefore = sim.getResource('gold');

      // 快进 5 秒
      sim.fastForwardSeconds(5);

      const goldAfter = sim.getResource('gold');
      // 市集 Lv1 产出 0.6/s，5秒 ≈ 3.0
      expect(goldAfter).toBeGreaterThan(goldBefore);
    });

    it('should NOT auto-grow mandate (天命)', () => {
      // RES-FLOW-1 步骤3: 验证天命不自动增长
      const sim = createSim();

      const mandateBefore = sim.getResource('mandate');

      // 快进 10 秒
      sim.fastForwardSeconds(10);

      const mandateAfter = sim.getResource('mandate');
      expect(mandateAfter).toBe(mandateBefore);
    });

    it('should have positive production rates for grain', () => {
      // RES-FLOW-1 步骤4: 验证产出速率 > 0
      const sim = createSim();

      const snapshot = sim.getSnapshot();
      // 初始状态农田 Lv1 产出 0.8/s
      expect(snapshot.productionRates.grain).toBeGreaterThan(0);
    });

    it('should accumulate recruitToken over time (passive production)', () => {
      // recruitToken 有基础被动产出（INITIAL_PRODUCTION_RATES.recruitToken = 0.002）
      const sim = createSim();

      const tokenBefore = sim.getResource('recruitToken');

      // 快进 100 秒
      sim.fastForwardSeconds(100);

      const tokenAfter = sim.getResource('recruitToken');
      expect(tokenAfter).toBeGreaterThan(tokenBefore);
    });

    it('should have recruitToken initial value of 10 (newbie pack) [RES-FLOW-1 步骤8]', () => {
      // R5: 新手礼包 +10 个求贤令，让新玩家立即体验招募功能
      // recruitToken 初始值从 0 改为 10
      const sim = createSim();

      expect(sim.getResource('recruitToken')).toBe(10);
    });
  });

  // ═══════════════════════════════════════════════
  // RES-FLOW-2: 资源消耗验证
  // ═══════════════════════════════════════════════
  describe('RES-FLOW-2: 资源消耗验证', () => {
    it('should deduct grain and gold when upgrading farmland', () => {
      // RES-FLOW-2: addResources → upgradeBuilding → 验证资源扣除
      // 关键约束：farmland Lv1 → Lv2 需要 castle >= Lv2
      const sim = createSim();

      // 给足资源，先升级主城再升级农田
      sim.addResources({ grain: 5000, gold: 5000, troops: 5000 });
      sim.upgradeBuilding('castle'); // castle Lv1 → Lv2

      // 获取农田升级费用（此时 farmland 仍为 Lv1）
      const cost = sim.engine.getUpgradeCost('farmland');
      expect(cost).not.toBeNull();

      // 补充资源（升级主城消耗了一部分）
      sim.addResources({ grain: 5000, gold: 5000 });

      // 记录当前资源
      const grainBefore = sim.getResource('grain');
      const goldBefore = sim.getResource('gold');

      // 升级农田
      sim.upgradeBuilding('farmland');

      // 验证资源扣除精确等于升级费用
      const grainAfter = sim.getResource('grain');
      const goldAfter = sim.getResource('gold');
      expect(grainBefore - grainAfter).toBe(cost!.grain);
      expect(goldBefore - goldAfter).toBe(cost!.gold);
    });

    it('should deduct troops when upgrading barracks', () => {
      // 兵营升级需要 troops
      const sim = createSim();

      // 先升级主城到 Lv2 解锁兵营
      sim.addResources(SUFFICIENT_RESOURCES);
      sim.upgradeBuildingTo('castle', 2);

      // 获取兵营升级费用
      const cost = sim.engine.getUpgradeCost('barracks');
      expect(cost).not.toBeNull();

      // 重新补充资源（升级主城消耗了一部分）
      sim.addResources(SUFFICIENT_RESOURCES);

      const troopsBefore = sim.getResource('troops');
      const grainBefore = sim.getResource('grain');
      const goldBefore = sim.getResource('gold');

      // 升级兵营
      sim.upgradeBuilding('barracks');

      const troopsAfter = sim.getResource('troops');
      const grainAfter = sim.getResource('grain');
      const goldAfter = sim.getResource('gold');

      // 验证各项扣除精确等于升级费用
      expect(troopsBefore - troopsAfter).toBe(cost!.troops);
      expect(grainBefore - grainAfter).toBe(cost!.grain);
      expect(goldBefore - goldAfter).toBe(cost!.gold);
    });

    it('should throw error when resources are insufficient', () => {
      // RES-FLOW-2: 资源不足时 checkUpgrade 返回不可升级
      const sim = createSim();

      // 先升级主城（使 farmland 可以升级到 Lv2）
      sim.addResources({ grain: 5000, gold: 5000 });
      sim.upgradeBuilding('castle');

      // 消耗掉大部分资源，使农田无法升级
      const currentGrain = sim.getResource('grain');
      if (currentGrain > 20) {
        sim.engine.resource.consumeResource('grain', currentGrain - 20);
      }

      // 检查是否可以升级农田（资源不足）
      const check = sim.engine.checkUpgrade('farmland');
      expect(check.canUpgrade).toBe(false);
      expect(check.reasons.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════
  // RES-FLOW-3: 容量上限与警告验证
  // ═══════════════════════════════════════════════
  describe('RES-FLOW-3: 容量上限与警告验证', () => {
    it('should return cap warnings when grain is near capacity', () => {
      // RES-FLOW-3: setResource 接近上限 → 验证 getCapWarnings
      const sim = createSim();

      // 初始 grain 上限为 2000（农田 Lv1）
      // 设置 grain 到 92%（1840），触发 warning 级别（阈值 90%）
      sim.setResource('grain', 1840);

      const warnings = sim.engine.getCapWarnings();
      const grainWarning = warnings.find(w => w.resourceType === 'grain');
      expect(grainWarning).toBeDefined();
      expect(grainWarning!.level).not.toBe('safe');
    });

    it('should detect different warning levels: safe, notice, warning, full', () => {
      // 容量警告阈值（来自 resource-calculator.ts getWarningLevel）：
      // [P1-2 说明] CAP_WARNING_THRESHOLDS 定义了5个阈值（safe=0.7, notice=0.9,
      // warning=0.95, urgent=1.0），但 getWarningLevel() 中 safe 阈值仅作为
      // notice 判断的隐式边界（< notice 即 safe），urgent 被 full 先拦截。
      // 实际可触发的4级：
      // safe: percentage < 0.9
      // notice: 0.9 <= percentage < 0.95
      // warning: 0.95 <= percentage < 1.0
      // full: percentage >= 1.0
      const sim = createSim();

      // 初始 grain 上限 = 2000
      const cap = 2000;

      // safe: < 90% = < 1800
      sim.setResource('grain', 1000);
      let warnings = sim.engine.getCapWarnings();
      let grainWarning = warnings.find(w => w.resourceType === 'grain');
      expect(grainWarning).toBeDefined();
      expect(grainWarning!.level).toBe('safe');

      // notice: 90%~95% = 1800~1900
      sim.setResource('grain', 1840);
      warnings = sim.engine.getCapWarnings();
      grainWarning = warnings.find(w => w.resourceType === 'grain');
      expect(grainWarning).toBeDefined();
      expect(grainWarning!.level).toBe('notice');

      // warning: 95%~100% = 1900~2000
      sim.setResource('grain', 1960);
      warnings = sim.engine.getCapWarnings();
      grainWarning = warnings.find(w => w.resourceType === 'grain');
      expect(grainWarning).toBeDefined();
      expect(grainWarning!.level).toBe('warning');

      // full: 100% = 2000
      sim.setResource('grain', cap);
      warnings = sim.engine.getCapWarnings();
      grainWarning = warnings.find(w => w.resourceType === 'grain');
      expect(grainWarning).toBeDefined();
      expect(grainWarning!.level).toBe('full');
    });

    it('should stop growing when resource reaches cap', () => {
      // RES-FLOW-3: 资源达到上限后停止增长
      const sim = createSim();

      // 初始 grain 上限 = 2000，设置到上限
      sim.setResource('grain', 2000);

      const grainBefore = sim.getResource('grain');
      expect(grainBefore).toBe(2000); // 确认已到上限

      // 快进 10 秒（农田 Lv1 产出 0.8/s，理论上应增加 8，但被上限截断）
      sim.fastForwardSeconds(10);

      const grainAfter = sim.getResource('grain');
      // 资源不应超过上限
      expect(grainAfter).toBeLessThanOrEqual(2000);
      // 资源应保持在上限值（不再增长）
      expect(grainAfter).toBe(2000);
    });

    it('should include troops cap warnings', () => {
      const sim = createSim();

      // 初始 troops 上限 = 500
      // 95% = 475
      sim.setResource('troops', 475);

      const warnings = sim.engine.getCapWarnings();
      const troopsWarning = warnings.find(w => w.resourceType === 'troops');
      expect(troopsWarning).toBeDefined();
      expect(troopsWarning!.level).toBe('warning');
    });
  });

  // ═══════════════════════════════════════════════
  // RES-FLOW-4: 天命资源特殊验证
  // ═══════════════════════════════════════════════
  describe('RES-FLOW-4: 天命资源特殊验证', () => {
    it('should have mandate cap as null (no upper limit)', () => {
      // RES-FLOW-4: 验证 mandate 无上限
      const sim = createSim();

      // SimulatorSnapshot 没有 caps 字段，需要直接访问 engine.resource
      const caps = sim.engine.resource.getCaps();
      expect(caps.mandate).toBeNull();
    });

    it('should NOT auto-grow mandate', () => {
      // RES-FLOW-4: 验证 mandate 不自动增长
      const sim = createSim();

      const mandateBefore = sim.getResource('mandate');
      expect(mandateBefore).toBe(0); // 初始值为 0

      // 快进 60 秒
      sim.fastForwardSeconds(60);

      const mandateAfter = sim.getResource('mandate');
      expect(mandateAfter).toBe(0); // 仍然为 0
    });

    it('should have mandate initial value of 0', () => {
      // RES-FLOW-4: 验证 mandate 初始值为 0
      const sim = createSim();

      const mandate = sim.getResource('mandate');
      expect(mandate).toBe(0);
    });

    it('should allow setting mandate to very high values (no cap)', () => {
      // RES-FLOW-4: mandate 无上限，可以设置为非常大的值
      const sim = createSim();

      sim.setResource('mandate', 999999);
      expect(sim.getResource('mandate')).toBe(999999);
    });

    it('should not include mandate in cap warnings', () => {
      // mandate 无上限，不应出现在 cap warnings 中
      const sim = createSim();

      sim.setResource('mandate', 999999);
      const warnings = sim.engine.getCapWarnings();
      const mandateWarning = warnings.find(w => w.resourceType === 'mandate');
      expect(mandateWarning).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════
  // RES-FLOW-5: 资源产出粒子效果（引擎层事件验证）
  // ═══════════════════════════════════════════════
  describe('RES-FLOW-5: 资源产出粒子效果（引擎层事件验证）', () => {
    it('should record resource change events in event log after fastForward', () => {
      // RES-FLOW-5: 验证 fastForward 后 getEventLog() 中有资源变化记录
      const sim = createSim();

      // 清空初始化阶段的事件日志
      sim.clearEventLog();

      // 快进 5 秒
      sim.fastForwardSeconds(5);

      const eventLog = sim.getEventLog();
      // 应该有 fastForward 事件记录
      const ffEvents = eventLog.filter(e => e.event === 'fastForward');
      expect(ffEvents.length).toBeGreaterThan(0);
    });

    it('should verify resource values actually changed after fastForward', () => {
      // RES-FLOW-5: 如果没有事件记录，则验证 getSnapshot() 资源值确实变化
      const sim = createSim();

      const snapshotBefore = sim.getSnapshot();
      const grainBefore = snapshotBefore.resources.grain;

      // 快进 5 秒
      sim.fastForwardSeconds(5);

      const snapshotAfter = sim.getSnapshot();
      const grainAfter = snapshotAfter.resources.grain;

      // 资源值确实变化了（grain 有产出）
      expect(grainAfter).toBeGreaterThan(grainBefore);
    });

    it('should emit resource:changed event via engine event bus when resources change', () => {
      // RES-FLOW-5: 验证引擎事件总线发出资源变化事件
      const sim = createSim();

      let resourceChangedFired = false;
      sim.engine.on('resource:changed', () => {
        resourceChangedFired = true;
      });

      // 快进 2 秒触发资源产出
      sim.fastForwardSeconds(2);

      // 引擎应该发出 resource:changed 事件
      expect(resourceChangedFired).toBe(true);
    });

    it('should emit resource:rate-changed event when production rates change', () => {
      // RES-FLOW-5: 升级建筑后产出速率变化应触发事件
      // 关键约束：升级 farmland 前需要先升级 castle
      const sim = createSim();

      let rateChangedFired = false;
      sim.engine.on('resource:rate-changed', () => {
        rateChangedFired = true;
      });

      // 给足资源并先升级主城
      sim.addResources({ grain: 5000, gold: 5000 });
      sim.upgradeBuilding('castle'); // castle Lv1 → Lv2

      // 再升级农田（产出变化）
      sim.addResources({ grain: 5000, gold: 5000 });
      sim.upgradeBuilding('farmland');

      // 升级后快进触发事件检测
      sim.fastForwardSeconds(1);

      expect(rateChangedFired).toBe(true);
    });
  });
});
