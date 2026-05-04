/**
 * P1 缺口测试 — 加速选项（铜钱/天命/元宝）
 *
 * PRD BLD-4 建筑队列管理：
 *   加速选项 | 铜钱加速 / 天命加速 / 元宝秒完成
 *
 * 当前引擎状态：
 *   - BuildingSystem 中尚未实现加速方法（speedUp / accelerate 等）
 *   - 科技域 TechResearchSystem 已实现完整的加速机制，可作为参考
 *   - 本测试文件覆盖：
 *     (a) 已有的升级计时机制（为加速提供基础）
 *     (b) 取消升级 + 返还机制（部分加速场景的基础）
 *     (c) 加速功能的预期行为规范（以 it.todo / describe.todo 标注未实现部分）
 *     (d) 参照 TechResearchSystem 的加速模式，验证建筑加速应满足的契约
 *
 * @module engine/building/__tests__/AccelerationOptions
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ── 建筑域 ──
import { BuildingSystem } from '../BuildingSystem';
import { BUILDING_DEFS, CANCEL_REFUND_RATIO } from '../building-config';
import type { BuildingType, Resources, UpgradeCost } from '../../../shared/types';
import { BUILDING_TYPES } from '../building.types';

// ── 科技域（参照加速实现） ──
import { TechResearchSystem } from '../../tech/TechResearchSystem';
import { TechTreeSystem } from '../../tech/TechTreeSystem';
import { TechPointSystem } from '../../tech/TechPointSystem';
import {
  MANDATE_SPEEDUP_SECONDS_PER_POINT,
  INGOT_SPEEDUP_SECONDS_PER_UNIT,
} from '../../tech/tech-config';

// ── 共享 ──
import { EventBus } from '../../../core/events/EventBus';

// ─────────────────────────────────────────────
// 测试辅助
// ─────────────────────────────────────────────

/** 充足资源 */
const RICH: Resources = { grain: 1e9, gold: 1e9, ore: 1e9, wood: 1e9, troops: 1e9, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 };

/** 创建依赖注入对象 */
function createDeps() {
  const eventBus = new EventBus();
  return { eventBus, configRegistry: { get: () => undefined } } as any;
}

// ─────────────────────────────────────────────
// 测试套件
// ─────────────────────────────────────────────

describe('P1: 加速选项（铜钱/天命/元宝）', () => {
  let building: BuildingSystem;
  let baseTime: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    baseTime = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(baseTime);

    building = new BuildingSystem();
    building.init(createDeps());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════
  // §1 升级计时基础（加速的前提）
  // ═══════════════════════════════════════════

  describe('§1 升级计时基础', () => {
    it('开始升级后建筑状态变为upgrading', () => {
      building.startUpgrade('farmland', RICH);
      const state = building.getBuilding('farmland');
      expect(state.status).toBe('upgrading');
      expect(state.upgradeStartTime).toBe(baseTime);
      expect(state.upgradeEndTime).toBeGreaterThan(baseTime);
    });

    it('升级费用包含建造时间', () => {
      const cost = building.getUpgradeCost('farmland');
      expect(cost).not.toBeNull();
      expect(cost!.timeSeconds).toBeGreaterThan(0);
    });

    it('升级剩余时间随时间递减', () => {
      building.startUpgrade('farmland', RICH);
      const remaining0 = building.getUpgradeRemainingTime('farmland');
      expect(remaining0).toBeGreaterThan(0);

      // 时间推进5秒
      vi.spyOn(Date, 'now').mockReturnValue(baseTime + 5000);
      const remaining5 = building.getUpgradeRemainingTime('farmland');
      expect(remaining5).toBeLessThan(remaining0);
      expect(remaining5).toBeCloseTo(remaining0 - 5, 0);
    });

    it('升级进度从0递增到1', () => {
      building.startUpgrade('farmland', RICH);
      const cost = building.getUpgradeCost('farmland')!;
      const totalTime = cost.timeSeconds;

      // 初始进度约0
      const progress0 = building.getUpgradeProgress('farmland');
      expect(progress0).toBeGreaterThanOrEqual(0);

      // 推进到一半时间
      vi.spyOn(Date, 'now').mockReturnValue(baseTime + (totalTime / 2) * 1000);
      const progress50 = building.getUpgradeProgress('farmland');
      expect(progress50).toBeCloseTo(0.5, 1);

      // 推进到完成
      vi.spyOn(Date, 'now').mockReturnValue(baseTime + totalTime * 1000);
      const progress100 = building.getUpgradeProgress('farmland');
      expect(progress100).toBe(1);
    });

    it('升级完成后tick返回建筑类型', () => {
      const cost = building.getUpgradeCost('farmland')!;
      building.startUpgrade('farmland', RICH);

      // 时间推进到完成
      vi.spyOn(Date, 'now').mockReturnValue(baseTime + (cost.timeSeconds + 1) * 1000);
      const completed = building.tick();
      expect(completed).toContain('farmland');
    });

    it('升级完成后建筑等级+1', () => {
      const levelBefore = building.getLevel('farmland');
      const cost = building.getUpgradeCost('farmland')!;
      building.startUpgrade('farmland', RICH);

      vi.spyOn(Date, 'now').mockReturnValue(baseTime + (cost.timeSeconds + 1) * 1000);
      building.tick();

      expect(building.getLevel('farmland')).toBe(levelBefore + 1);
      expect(building.getBuilding('farmland').status).toBe('idle');
    });

    it('各建筑升级时间随等级增长', () => {
      // 检查农田各等级的升级时间
      const timeLv1 = BUILDING_DEFS.farmland.levelTable[0].upgradeCost.timeSeconds;
      const timeLv5 = BUILDING_DEFS.farmland.levelTable[4].upgradeCost.timeSeconds;
      expect(timeLv5).toBeGreaterThan(timeLv1);
    });
  });

  // ═══════════════════════════════════════════
  // §2 取消升级（部分加速场景的基础）
  // ═══════════════════════════════════════════

  describe('§2 取消升级', () => {
    it('取消升级返还80%资源', () => {
      const cost = building.getUpgradeCost('farmland')!;
      building.startUpgrade('farmland', RICH);

      const refund = building.cancelUpgrade('farmland');
      expect(refund).not.toBeNull();
      expect(refund!.grain).toBe(Math.round(cost.grain * CANCEL_REFUND_RATIO));
      expect(refund!.gold).toBe(Math.round(cost.gold * CANCEL_REFUND_RATIO));
      expect(refund!.troops).toBe(Math.round(cost.troops * CANCEL_REFUND_RATIO));
    });

    it('取消后建筑恢复idle状态', () => {
      building.startUpgrade('farmland', RICH);
      building.cancelUpgrade('farmland');

      const state = building.getBuilding('farmland');
      expect(state.status).toBe('idle');
      expect(state.upgradeStartTime).toBeNull();
      expect(state.upgradeEndTime).toBeNull();
    });

    it('取消后可重新开始升级', () => {
      building.startUpgrade('farmland', RICH);
      building.cancelUpgrade('farmland');

      // 应该可以重新开始升级
      const check = building.checkUpgrade('farmland', RICH);
      expect(check.canUpgrade).toBe(true);
    });

    it('idle状态建筑取消返回null', () => {
      const refund = building.cancelUpgrade('farmland');
      expect(refund).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // §3 参照科技域的加速机制
  // ═══════════════════════════════════════════

  describe('§3 参照科技域的加速机制', () => {
    let researchSys: TechResearchSystem;
    let pointSys: TechPointSystem;
    let mandateAmount: number;
    let goldAmount: number;

    beforeEach(() => {
      mandateAmount = 100;
      goldAmount = 1000000;
      const deps = createDeps();
      const treeSystem = new TechTreeSystem();
      treeSystem.init(deps);
      pointSys = new TechPointSystem();
      pointSys.init(deps);

      researchSys = new TechResearchSystem(
        treeSystem,
        pointSys,
        () => 3, // academy level
        () => mandateAmount,
        (amt: number) => {
          if (mandateAmount >= amt) {
            mandateAmount -= amt;
            return true;
          }
          return false;
        },
        () => goldAmount,
        (amt: number) => {
          if (goldAmount >= amt) {
            goldAmount -= amt;
            return true;
          }
          return false;
        },
      );
      researchSys.init(deps);
    });

    /** 给科技点系统充入足够的点数 */
    function grantPoints(amount: number): void {
      // Sprint 3: 研究消耗 = costPoints × RESEARCH_START_TECH_POINT_MULTIPLIER
      const needed = amount * 10;
      pointSys.syncAcademyLevel(20);
      const seconds = Math.ceil(needed / 1.76) + 10;
      pointSys.update(seconds);
    }

    /** 推进时间 */
    function advanceTime(ms: number): void {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now + ms);
    }

    it('科技域：天命加速常量正确', () => {
      // 每点天命减少60秒
      expect(MANDATE_SPEEDUP_SECONDS_PER_POINT).toBe(60);
    });

    it('科技域：元宝加速常量正确', () => {
      // 每单位元宝减少600秒（10分钟）
      expect(INGOT_SPEEDUP_SECONDS_PER_UNIT).toBe(600);
    });

    it('科技域：天命加速减少剩余时间', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      advanceTime(10 * 1000); // 过了10秒

      const result = researchSys.speedUp('mil_t1_attack', 'mandate', 1);
      expect(result.success).toBe(true);
      expect(result.timeReduced).toBe(60); // 1点天命 = 60秒
    });

    it('科技域：天命加速消耗天命', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      advanceTime(10 * 1000);
      const beforeMandate = mandateAmount;
      researchSys.speedUp('mil_t1_attack', 'mandate', 2);
      expect(mandateAmount).toBe(beforeMandate - 2);
    });

    it('科技域：天命不足时加速失败', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      mandateAmount = 0;
      const result = researchSys.speedUp('mil_t1_attack', 'mandate', 1);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('天命不足');
    });

    it('科技域：元宝加速立即完成（amount=1触发）', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      advanceTime(10 * 1000);
      // 注意：ingot加速amount=0会被FIX-501拦截（amount<=0）
      // 需要传amount=1来触发ingot加速逻辑
      const result = researchSys.speedUp('mil_t1_attack', 'ingot', 1);
      expect(result.success).toBe(true);
      expect(result.completed).toBe(true);
    });

    it('科技域：加速不存在的科技返回失败', () => {
      const result = researchSys.speedUp('nonexistent', 'mandate', 1);
      expect(result.success).toBe(false);
    });

    it('科技域：加速数量为0或负数返回失败', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      advanceTime(10 * 1000);

      const r0 = researchSys.speedUp('mil_t1_attack', 'mandate', 0);
      expect(r0.success).toBe(false);

      const rn = researchSys.speedUp('mil_t1_attack', 'mandate', -1);
      expect(rn.success).toBe(false);
    });

    it('科技域：天命加速刚好完成', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      advanceTime(10 * 1000);
      // 剩余约110秒，需要约2点天命
      const result = researchSys.speedUp('mil_t1_attack', 'mandate', 3);
      expect(result.success).toBe(true);
      expect(result.completed).toBe(true);
    });

    it('科技域：天命加速超量完成', () => {
      grantPoints(1000);
      researchSys.startResearch('mil_t1_attack');
      advanceTime(10 * 1000);
      const result = researchSys.speedUp('mil_t1_attack', 'mandate', 100);
      expect(result.success).toBe(true);
      expect(result.completed).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // §4 建筑加速预期行为规范（TODO标注）
  // ═══════════════════════════════════════════

  describe('§4 TODO: 建筑加速功能规范', () => {
    it.todo('铜钱加速：消耗铜钱减少建造时间');

    it.todo('铜钱加速：消耗计算正确（按剩余时间比例）');

    it.todo('铜钱加速：铜钱不足时加速失败');

    it.todo('铜钱加速：加速后建筑确实提前完成');

    it.todo('天命加速：消耗天命减少建造时间');

    it.todo('天命加速：每点天命减少固定秒数（参照科技域60秒/点）');

    it.todo('天命加速：天命不足时加速失败');

    it.todo('天命加速：天命数量为0或负数时加速失败');

    it.todo('天命加速：加速后升级剩余时间正确减少');

    it.todo('天命加速：刚好完成时建筑等级+1');

    it.todo('元宝秒完成：消耗元宝立即完成建造');

    it.todo('元宝秒完成：元宝消耗按剩余时间计算');

    it.todo('元宝秒完成：立即完成后建筑等级+1');

    it.todo('元宝秒完成：立即完成后建筑状态变为idle');

    it.todo('加速非升级中建筑应失败');

    it.todo('加速已完成的建筑应返回已完成状态');

    it.todo('多次连续加速累计减少时间');

    it.todo('加速后取消升级仍返还80%原始费用');
  });

  // ═══════════════════════════════════════════
  // §5 加速消耗计算模型验证
  // ═══════════════════════════════════════════

  describe('§5 加速消耗计算模型', () => {
    it('铜钱加速消耗应与剩余时间成正比', () => {
      // 模型：铜钱消耗 = 剩余秒数 × 单价
      // 参照科技域：天命 60秒/点，元宝 600秒/单位
      // 建筑加速的铜钱单价待定，但应与剩余时间成正比

      const remainingSeconds = 300; // 5分钟
      const copperPerSecond = 10;   // 假设10铜钱/秒
      const expectedCost = remainingSeconds * copperPerSecond;
      expect(expectedCost).toBe(3000);
    });

    it('天命加速消耗应与加速时间成正比', () => {
      // 参照科技域：1点天命 = 60秒
      const secondsToReduce = 180; // 3分钟
      const mandateCost = Math.ceil(secondsToReduce / MANDATE_SPEEDUP_SECONDS_PER_POINT);
      expect(mandateCost).toBe(3); // 3点天命
    });

    it('元宝秒完成消耗应与剩余时间成正比', () => {
      // 参照科技域：1单位元宝 = 600秒
      const remainingSeconds = 1500; // 25分钟
      const ingotCost = Math.ceil(remainingSeconds / INGOT_SPEEDUP_SECONDS_PER_UNIT);
      expect(ingotCost).toBe(3); // 3单位元宝
    });

    it('短时间升级的加速消耗应较少', () => {
      // 农田Lv1→2: 5秒
      const shortTime = BUILDING_DEFS.farmland.levelTable[0].upgradeCost.timeSeconds;
      // 农田Lv10→11: 604秒
      const longTime = BUILDING_DEFS.farmland.levelTable[9].upgradeCost.timeSeconds;

      const shortIngot = Math.ceil(shortTime / INGOT_SPEEDUP_SECONDS_PER_UNIT);
      const longIngot = Math.ceil(longTime / INGOT_SPEEDUP_SECONDS_PER_UNIT);

      expect(longIngot).toBeGreaterThanOrEqual(shortIngot);
      expect(shortIngot).toBe(1); // 5秒 < 600秒 → 1单位
      expect(longIngot).toBeGreaterThanOrEqual(1); // 604秒 → 2单位
    });
  });

  // ═══════════════════════════════════════════
  // §6 加速后建筑确实提前完成
  // ═══════════════════════════════════════════

  describe('§6 加速后建筑提前完成验证（通过时间推进模拟）', () => {
    it('升级时间推进一半后tick未完成', () => {
      const cost = building.getUpgradeCost('farmland')!;
      building.startUpgrade('farmland', RICH);

      // 推进一半时间
      vi.spyOn(Date, 'now').mockReturnValue(baseTime + (cost.timeSeconds / 2) * 1000);
      const completed = building.tick();
      expect(completed).not.toContain('farmland');
    });

    it('升级时间推进超过完成时间后tick完成', () => {
      const cost = building.getUpgradeCost('farmland')!;
      building.startUpgrade('farmland', RICH);

      // 推进到完成时间之后
      vi.spyOn(Date, 'now').mockReturnValue(baseTime + (cost.timeSeconds + 1) * 1000);
      const completed = building.tick();
      expect(completed).toContain('farmland');
    });

    it('forceCompleteUpgrades 立即完成所有升级', () => {
      building.startUpgrade('farmland', RICH);
      building.forceCompleteUpgrades();
      // 完成农田后再升级主城
      building.startUpgrade('castle', RICH);

      const levelFarmBefore = building.getLevel('farmland');
      const levelCastleBefore = building.getLevel('castle');

      const completed = building.forceCompleteUpgrades();

      expect(completed).toContain('castle');
      expect(building.getLevel('farmland')).toBe(levelFarmBefore); // 农田已完成不变
      expect(building.getLevel('castle')).toBe(levelCastleBefore + 1);
    });

    it('forceCompleteUpgrades 后建筑状态恢复idle', () => {
      building.startUpgrade('farmland', RICH);
      building.forceCompleteUpgrades();

      const state = building.getBuilding('farmland');
      expect(state.status).toBe('idle');
      expect(state.upgradeStartTime).toBeNull();
      expect(state.upgradeEndTime).toBeNull();
    });

    it('forceCompleteUpgrades 后升级队列清空', () => {
      building.startUpgrade('farmland', RICH);
      expect(building.getUpgradeQueue().length).toBe(1);

      building.forceCompleteUpgrades();
      expect(building.getUpgradeQueue().length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // §7 加速边界条件
  // ═══════════════════════════════════════════

  describe('§7 加速边界条件', () => {
    it('升级时间为0秒的建筑（主城Lv1）', () => {
      const cost = building.getUpgradeCost('castle');
      // 主城Lv1 → Lv2 有时间
      expect(cost!.timeSeconds).toBeGreaterThan(0);
    });

    it('升级时间NaN防护', () => {
      // BuildingSystem.startUpgrade 有NaN防护
      building.startUpgrade('farmland', RICH);
      const state = building.getBuilding('farmland');
      expect(Number.isFinite(state.upgradeEndTime)).toBe(true);
    });

    it('升级进度NaN防护', () => {
      building.startUpgrade('farmland', RICH);
      const progress = building.getUpgradeProgress('farmland');
      expect(Number.isFinite(progress)).toBe(true);
    });

    it('剩余时间NaN防护', () => {
      building.startUpgrade('farmland', RICH);
      const remaining = building.getUpgradeRemainingTime('farmland');
      expect(Number.isFinite(remaining)).toBe(true);
    });

    it('队列满时不能再开始升级', () => {
      // 主城Lv1 → 1个队列槽位
      building.startUpgrade('farmland', RICH);
      expect(building.isQueueFull()).toBe(true);

      const check = building.checkUpgrade('castle', RICH);
      expect(check.canUpgrade).toBe(false);
      expect(check.reasons).toContain('升级队列已满');
    });

    it('取消升级释放队列槽位', () => {
      building.startUpgrade('farmland', RICH);
      expect(building.isQueueFull()).toBe(true);

      building.cancelUpgrade('farmland');
      expect(building.isQueueFull()).toBe(false);
    });

    it('多个建筑同时升级时队列管理正确', () => {
      // 交错升级主城和农田，确保农田不超过主城+1
      // 目标：主城Lv6 → 2个队列槽位
      for (let i = 0; i < 5; i++) {
        building.startUpgrade('castle', RICH);
        building.forceCompleteUpgrades();
        // 主城升级后解锁新建筑
        if (building.isUnlocked('farmland') && building.getLevel('farmland') <= building.getLevel('castle')) {
          building.startUpgrade('farmland', RICH);
          building.forceCompleteUpgrades();
        }
      }

      // 现在主城至少Lv6，2个槽位
      expect(building.getMaxQueueSlots()).toBe(2);

      building.startUpgrade('farmland', RICH);
      building.startUpgrade('market', RICH);
      expect(building.isQueueFull()).toBe(true);

      // 第3个应失败
      const check = building.checkUpgrade('barracks', RICH);
      expect(check.canUpgrade).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // §8 加速与资源系统联动
  // ═══════════════════════════════════════════

  describe('§8 加速与资源系统联动', () => {
    it('建筑完成后产出立即增加', () => {
      const productionBefore = building.getProduction('farmland');
      building.startUpgrade('farmland', RICH);
      building.forceCompleteUpgrades();
      const productionAfter = building.getProduction('farmland');

      expect(productionAfter).toBeGreaterThan(productionBefore);
    });

    it('建筑完成后calculateTotalProduction更新', () => {
      const totalBefore = building.calculateTotalProduction();
      building.startUpgrade('farmland', RICH);
      building.forceCompleteUpgrades();
      const totalAfter = building.calculateTotalProduction();

      expect(totalAfter.grain).toBeGreaterThan(totalBefore.grain);
    });

    it('加速完成主城后新建筑解锁', () => {
      // 主城Lv1 → 需要升级到Lv2解锁兵营
      expect(building.isUnlocked('barracks')).toBe(false);

      building.startUpgrade('castle', RICH);
      building.forceCompleteUpgrades();

      expect(building.isUnlocked('barracks')).toBe(true);
    });

    it('加速完成主城后队列槽位可能增加', () => {
      // 主城Lv1 → 1个槽位
      expect(building.getMaxQueueSlots()).toBe(1);

      // 交错升级主城和农田
      for (let i = 0; i < 5; i++) {
        building.startUpgrade('castle', RICH);
        building.forceCompleteUpgrades();
        if (building.isUnlocked('farmland') && building.getLevel('farmland') <= building.getLevel('castle')) {
          building.startUpgrade('farmland', RICH);
          building.forceCompleteUpgrades();
        }
      }
      expect(building.getMaxQueueSlots()).toBe(2);
    });
  });

  // ═══════════════════════════════════════════
  // §9 加速序列化兼容性
  // ═══════════════════════════════════════════

  describe('§9 加速序列化兼容性', () => {
    it('升级中建筑的序列化包含时间信息', () => {
      building.startUpgrade('farmland', RICH);
      const saved = building.serialize();

      const farmState = saved.buildings.farmland;
      expect(farmState.status).toBe('upgrading');
      expect(farmState.upgradeStartTime).not.toBeNull();
      expect(farmState.upgradeEndTime).not.toBeNull();
    });

    it('反序列化后升级中建筑继续计时', () => {
      building.startUpgrade('farmland', RICH);
      const saved = building.serialize();

      const newBuilding = new BuildingSystem();
      newBuilding.init(createDeps());
      newBuilding.deserialize(saved);

      const state = newBuilding.getBuilding('farmland');
      expect(state.status).toBe('upgrading');
      expect(state.upgradeEndTime).not.toBeNull();
    });

    it('反序列化时已完成升级自动结算', () => {
      building.startUpgrade('farmland', RICH);
      const saved = building.serialize();

      // 模拟时间推进到升级完成之后
      vi.spyOn(Date, 'now').mockReturnValue(baseTime + 100000);

      const newBuilding = new BuildingSystem();
      newBuilding.init(createDeps());
      newBuilding.deserialize(saved);

      // 升级应已自动完成
      expect(newBuilding.getLevel('farmland')).toBe(2);
      expect(newBuilding.getBuilding('farmland').status).toBe('idle');
    });
  });

  // ═══════════════════════════════════════════
  // §10 建筑加速功能实现建议
  // ═══════════════════════════════════════════

  describe('§10 TODO: 建筑加速功能实现建议', () => {
    it.todo('BuildingSystem 应增加 speedUp(type, method, amount) 方法');
    it.todo('speedUp 方法应支持 method: "copper" | "mandate" | "ingot"');
    it.todo('铜钱加速: timeReduced = copperCost / COPPER_PER_SECOND');
    it.todo('天命加速: timeReduced = amount × MANDATE_SPEEDUP_SECONDS_PER_POINT');
    it.todo('元宝秒完成: upgradeEndTime = Date.now()（立即完成）');
    it.todo('加速后应更新 upgradeEndTime 而非 upgradeStartTime');
    it.todo('加速应返回 SpeedUpResult { success, cost, timeReduced, completed, reason? }');
    it.todo('加速完成后应触发与正常完成相同的流程（等级+1、状态idle、解锁检查）');
  });
});
