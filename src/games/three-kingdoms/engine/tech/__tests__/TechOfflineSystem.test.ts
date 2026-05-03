import { vi } from 'vitest';
/**
 * TechOfflineSystem 单元测试 — Part 1: 效率衰减 + 进度计算 + 序列化
 */

import { TechTreeSystem } from '../TechTreeSystem';
import { TechPointSystem } from '../TechPointSystem';
import { TechResearchSystem } from '../TechResearchSystem';
import { TechOfflineSystem } from '../TechOfflineSystem';
import type { ISystemDeps } from '../../../../core/types';
import type { ResearchSnapshotItem } from '../../../../core/tech/offline-research.types';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
}

function createTestEnv() {
  const treeSys = new TechTreeSystem();
  const pointSys = new TechPointSystem();
  let goldAmount = 1000000;
  const researchSys = new TechResearchSystem(
    treeSys, pointSys, () => 3,
    () => 100, () => true,
    () => goldAmount, (a: number) => { if (goldAmount >= a) { goldAmount -= a; return true; } return false; },
  );
  const offlineSys = new TechOfflineSystem(treeSys, researchSys);
  const deps = mockDeps();
  treeSys.init(deps); pointSys.init(deps); researchSys.init(deps); offlineSys.init(deps);
  return { treeSys, pointSys, researchSys, offlineSys, deps };
}

function grantPoints(pointSys: TechPointSystem, amount: number): void {
  // Sprint 3: 研究消耗 = costPoints × RESEARCH_START_TECH_POINT_MULTIPLIER
  const RESEARCH_START_TECH_POINT_MULTIPLIER = 10;
  const needed = amount * RESEARCH_START_TECH_POINT_MULTIPLIER;
  pointSys.syncAcademyLevel(20);
  pointSys.update(Math.ceil(needed / 1.76) + 10);
}

const H = (h: number) => h * 3600;

// ═══════════════════════════════════════════════════════════

describe('TechOfflineSystem', () => {
  let env: ReturnType<typeof createTestEnv>;
  let baseTime: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    baseTime = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(baseTime);
    env = createTestEnv();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  // ═══════════════════════════════════════════
  // 1. ISubsystem 接口
  // ═══════════════════════════════════════════
  describe('ISubsystem 接口', () => {
    it('name 为 tech-offline', () => {
      expect(env.offlineSys.name).toBe('tech-offline');
    });

    it('初始状态 isOffline 为 false', () => {
      const state = env.offlineSys.getState();
      expect(state.isOffline).toBe(false);
      expect(state.offlineStartTime).toBeNull();
      expect(state.researchSnapshot).toEqual([]);
      expect(state.lastPanelData).toBeNull();
    });

    it('reset 清除所有状态', () => {
      env.offlineSys.onGoOffline(baseTime);
      env.offlineSys.reset();
      const state = env.offlineSys.getState();
      expect(state.isOffline).toBe(false);
      expect(state.offlineStartTime).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 2. 效率衰减计算
  // ═══════════════════════════════════════════
  describe('效率衰减计算', () => {
    it('0 秒离线：有效秒数为 0', () => {
      expect(env.offlineSys.calculateEffectiveSeconds(0)).toBe(0);
    });

    it('负数离线：有效秒数为 0', () => {
      expect(env.offlineSys.calculateEffectiveSeconds(-100)).toBe(0);
    });

    it('前 2 小时 100% 效率', () => {
      expect(env.offlineSys.calculateEffectiveSeconds(H(2))).toBe(H(2));
    });

    it('2~8 小时 70% 效率', () => {
      const result = env.offlineSys.calculateEffectiveSeconds(H(5));
      expect(result).toBeCloseTo(H(2) + H(3) * 0.7, 1);
    });

    it('8~24 小时 40% 效率', () => {
      const result = env.offlineSys.calculateEffectiveSeconds(H(12));
      expect(result).toBeCloseTo(H(2) * 1.0 + H(6) * 0.7 + H(4) * 0.4, 1);
    });

    it('24~72 小时 20% 效率', () => {
      const result = env.offlineSys.calculateEffectiveSeconds(H(30));
      expect(result).toBeCloseTo(H(2) * 1.0 + H(6) * 0.7 + H(16) * 0.4 + H(6) * 0.2, 1);
    });

    it('超过 72 小时封顶', () => {
      const capped = env.offlineSys.calculateEffectiveSeconds(H(72));
      const overflow = env.offlineSys.calculateEffectiveSeconds(H(100));
      expect(overflow).toBeCloseTo(capped, 1);
    });

    it('72 小时完整计算', () => {
      const expected = H(2) * 1.0 + H(6) * 0.7 + H(16) * 0.4 + H(48) * 0.2;
      expect(env.offlineSys.calculateEffectiveSeconds(H(72))).toBeCloseTo(expected, 1);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 综合效率
  // ═══════════════════════════════════════════
  describe('综合效率', () => {
    it('0 秒综合效率为 0', () => {
      expect(env.offlineSys.calculateOverallEfficiency(0)).toBe(0);
    });

    it('2 小时综合效率为 1.0', () => {
      expect(env.offlineSys.calculateOverallEfficiency(H(2))).toBeCloseTo(1.0, 3);
    });

    it('5 小时综合效率', () => {
      const eff = env.offlineSys.calculateOverallEfficiency(H(5));
      expect(eff).toBeGreaterThan(0.8);
      expect(eff).toBeLessThan(0.85);
    });

    it('getEfficiencyPercent 返回 0~100 的整数', () => {
      expect(env.offlineSys.getEfficiencyPercent(H(2))).toBe(100);
    });

    it('getEfficiencyPercent 超长离线效率较低', () => {
      expect(env.offlineSys.getEfficiencyPercent(H(48))).toBeLessThan(50);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 效率曲线
  // ═══════════════════════════════════════════
  describe('效率曲线', () => {
    it('0 秒只有一个起始点', () => {
      expect(env.offlineSys.generateEfficiencyCurve(0)).toEqual([{ seconds: 0, efficiency: 1.0 }]);
    });

    it('2 小时曲线包含 100% 和 70% 点', () => {
      const curve = env.offlineSys.generateEfficiencyCurve(H(2));
      expect(curve[0]).toEqual({ seconds: 0, efficiency: 1.0 });
      expect(curve[1].seconds).toBe(H(2));
      expect(curve[1].efficiency).toBe(0.7);
    });

    it('10 小时曲线包含多个分段', () => {
      const curve = env.offlineSys.generateEfficiencyCurve(H(10));
      expect(curve.length).toBeGreaterThanOrEqual(3);
      expect(curve[0].efficiency).toBe(1.0);
    });

    it('getEfficiencyAtTime 返回正确分段效率', () => {
      expect(env.offlineSys.getEfficiencyAtTime(H(0.5))).toBe(1.0);
      expect(env.offlineSys.getEfficiencyAtTime(H(1))).toBe(1.0);
      expect(env.offlineSys.getEfficiencyAtTime(H(3))).toBe(0.7);
      expect(env.offlineSys.getEfficiencyAtTime(H(10))).toBe(0.4);
      expect(env.offlineSys.getEfficiencyAtTime(H(30))).toBe(0.2);
      expect(env.offlineSys.getEfficiencyAtTime(H(100))).toBe(0.2);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 离线进度计算
  // ═══════════════════════════════════════════
  describe('离线进度计算', () => {
    it('正确计算单科技进度增量', () => {
      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('mil_t1_attack'); // 120s nominal
      // academyLevel=3 → academySpeedMultiplier=1.3 → actualTime=120/1.3≈92.3s
      const queue = env.researchSys.getQueue();
      const actualDuration = (queue[0]!.endTime - queue[0]!.startTime) / 1000;
      env.offlineSys.onGoOffline(baseTime);
      const result = env.offlineSys.onComeBackOnline(baseTime + 60 * 1000);
      const progress = result!.techProgressList[0];
      expect(progress.progressDelta).toBeCloseTo(60 / actualDuration, 3);
      expect(progress.completed).toBe(false);
      expect(progress.remainingSeconds).toBeCloseTo(actualDuration - 60, 1);
    });

    it('离线时间足够长时科技完成', () => {
      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('mil_t1_attack');
      env.offlineSys.onGoOffline(baseTime);
      const result = env.offlineSys.onComeBackOnline(baseTime + H(3) * 1000);
      expect(result!.techProgressList[0].completed).toBe(true);
      expect(result!.techProgressList[0].progressAfter).toBe(1);
      expect(result!.completedTechIds).toContain('mil_t1_attack');
    });

    it('效率衰减导致进度增长变慢', () => {
      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('mil_t1_attack');
      env.offlineSys.onGoOffline(baseTime);
      const result = env.offlineSys.onComeBackOnline(baseTime + H(5) * 1000);
      expect(result!.techProgressList[0].completed).toBe(true);
    });

    it('多个研究队列项分别计算', () => {
      const snapshot: ResearchSnapshotItem[] = [
        { techId: 'mil_t1_attack', startTime: baseTime, endTime: baseTime + 120 * 1000 },
        { techId: 'eco_t1_farming', startTime: baseTime, endTime: baseTime + 120 * 1000 },
      ];
      env.offlineSys.onGoOffline(baseTime);
      const list = env.offlineSys.calculateOfflineProgress(snapshot, 60);
      expect(list.length).toBe(2);
      expect(list[0].progressDelta).toBeCloseTo(60 / 120, 3);
    });

    it('快照中无效 techId 被跳过', () => {
      const snapshot: ResearchSnapshotItem[] = [
        { techId: 'non_existent', startTime: baseTime, endTime: baseTime + 120 * 1000 },
      ];
      env.offlineSys.onGoOffline(baseTime);
      expect(env.offlineSys.calculateOfflineProgress(snapshot, 60)).toEqual([]);
    });

    it('研究时间为 0 的快照被跳过', () => {
      const snapshot: ResearchSnapshotItem[] = [
        { techId: 'mil_t1_attack', startTime: baseTime, endTime: baseTime },
      ];
      env.offlineSys.onGoOffline(baseTime);
      expect(env.offlineSys.calculateOfflineProgress(snapshot, 60)).toEqual([]);
    });

    it('progressBefore 基于离线开始时间计算', () => {
      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('mil_t1_attack');
      // academyLevel=3 → academySpeedMultiplier=1.3 → actualTime=120/1.3≈92.3s
      const queue = env.researchSys.getQueue();
      const actualDuration = (queue[0]!.endTime - queue[0]!.startTime) / 1000;
      const offlineStart = baseTime + 30 * 1000;
      env.offlineSys.onGoOffline(offlineStart);
      const result = env.offlineSys.onComeBackOnline(offlineStart + 60 * 1000);
      expect(result!.techProgressList[0].progressBefore).toBeCloseTo(30 / actualDuration, 3);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 格式化离线时间
  // ═══════════════════════════════════════════
  describe('formatOfflineTime', () => {
    it('0 秒显示"刚刚"', () => { expect(env.offlineSys.formatOfflineTime(0)).toBe('刚刚'); });
    it('30 秒显示秒数', () => { expect(env.offlineSys.formatOfflineTime(30)).toBe('30秒'); });
    it('90 秒显示分钟', () => { expect(env.offlineSys.formatOfflineTime(90)).toBe('1分钟'); });
    it('90 分钟显示小时+分钟', () => { expect(env.offlineSys.formatOfflineTime(90 * 60)).toBe('1小时30分钟'); });
    it('整小时', () => { expect(env.offlineSys.formatOfflineTime(H(3))).toBe('3小时'); });
    it('25 小时显示天+小时', () => { expect(env.offlineSys.formatOfflineTime(H(25))).toBe('1天1小时'); });
    it('整天', () => { expect(env.offlineSys.formatOfflineTime(H(48))).toBe('2天'); });
  });

  // ═══════════════════════════════════════════
  // 7. 序列化/反序列化
  // ═══════════════════════════════════════════
  describe('序列化/反序列化', () => {
    it('序列化空状态', () => {
      const data = env.offlineSys.serialize();
      expect(data.offlineStartTime).toBeNull();
      expect(data.researchSnapshot).toEqual([]);
    });

    it('序列化离线状态', () => {
      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('mil_t1_attack');
      env.offlineSys.onGoOffline(baseTime);
      const data = env.offlineSys.serialize();
      expect(data.offlineStartTime).toBe(baseTime);
      expect(data.researchSnapshot.length).toBe(1);
    });

    it('反序列化恢复离线状态', () => {
      env.offlineSys.deserialize({
        offlineStartTime: 12345,
        researchSnapshot: [{ techId: 'mil_t1_attack', startTime: 12300, endTime: 12500 }],
      });
      expect(env.offlineSys.isOffline()).toBe(true);
      expect(env.offlineSys.getOfflineStartTime()).toBe(12345);
    });

    it('反序列化清除 lastPanelData', () => {
      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('mil_t1_attack');
      env.offlineSys.onGoOffline(baseTime);
      env.offlineSys.onComeBackOnline(baseTime + H(1) * 1000);
      expect(env.offlineSys.getLastPanelData()).not.toBeNull();
      env.offlineSys.deserialize({ offlineStartTime: null, researchSnapshot: [] });
      expect(env.offlineSys.getLastPanelData()).toBeNull();
    });

    it('反序列化处理缺失字段', () => {
      env.offlineSys.deserialize({
        offlineStartTime: undefined as unknown as null,
        researchSnapshot: undefined as unknown as [],
      });
      expect(env.offlineSys.isOffline()).toBe(false);
    });
  });
});
