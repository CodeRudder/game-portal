/**
 * TechOfflineSystem 增强测试 — Round2: 回归面板增强 + 领土离线产出
 *
 * 测试离线研究回归面板的完整数据展示和领土离线产出集成。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TechTreeSystem } from '../TechTreeSystem';
import { TechPointSystem } from '../TechPointSystem';
import { TechResearchSystem } from '../TechResearchSystem';
import { TechOfflineSystem } from '../TechOfflineSystem';
import type { ISystemDeps } from '../../../../core/types';
import type { OfflineResearchPanel } from '../../../../core/tech/offline-research.types';

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
  const researchSys = new TechResearchSystem(treeSys, pointSys, () => 3, () => 100, () => true);
  const offlineSys = new TechOfflineSystem(treeSys, researchSys);
  const deps = mockDeps();
  treeSys.init(deps); pointSys.init(deps); researchSys.init(deps); offlineSys.init(deps);
  return { treeSys, pointSys, researchSys, offlineSys, deps };
}

function grantPoints(pointSys: TechPointSystem, amount: number): void {
  pointSys.syncAcademyLevel(20);
  pointSys.update(Math.ceil(amount / 1.76) + 10);
}

const H = (h: number) => h * 3600;

/** 辅助：执行一次完整的离线→回归流程 */
function doOfflineCycle(
  env: ReturnType<typeof createTestEnv>,
  baseTime: number,
  offlineMs: number,
): OfflineResearchPanel | null {
  env.offlineSys.onGoOffline(baseTime);
  return env.offlineSys.onComeBackOnline(baseTime + offlineMs);
}

// ═══════════════════════════════════════════════════════════

describe('TechOfflineSystem Round2 增强', () => {
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
  // 1. 回归面板数据完整性验证
  // ═══════════════════════════════════════════
  describe('回归面板数据完整性', () => {
    it('面板包含完整的研究进度信息', () => {
      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('mil_t1_attack');
      const panel = doOfflineCycle(env, baseTime, H(1) * 1000);

      expect(panel).not.toBeNull();
      const progress = panel!.techProgressList[0];
      expect(progress).toHaveProperty('techId', 'mil_t1_attack');
      expect(progress).toHaveProperty('techName', '锐兵术');
      expect(progress).toHaveProperty('progressBefore');
      expect(progress).toHaveProperty('progressAfter');
      expect(progress).toHaveProperty('progressDelta');
      expect(progress).toHaveProperty('completed');
      expect(progress).toHaveProperty('remainingSeconds');
    });

    it('面板包含效率曲线数据', () => {
      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('mil_t1_attack');
      const panel = doOfflineCycle(env, baseTime, H(5) * 1000);

      expect(panel!.efficiencyCurve.length).toBeGreaterThanOrEqual(2);
      expect(panel!.efficiencyCurve[0].seconds).toBe(0);
      expect(panel!.efficiencyCurve[0].efficiency).toBe(1.0);
    });

    it('面板格式化时间文本正确', () => {
      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('mil_t1_attack');

      // 1小时
      const p1 = doOfflineCycle(env, baseTime, H(1) * 1000);
      expect(p1!.offlineTimeText).toBe('1小时');

      // 重新设置研究
      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('eco_t1_farming');
      const p2 = doOfflineCycle(env, baseTime + H(2) * 1000, H(2) * 1000);
      expect(p2!.offlineTimeText).toBe('2小时');
    });

    it('面板综合效率随离线时长递减', () => {
      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('mil_t1_attack');
      const p1 = doOfflineCycle(env, baseTime, H(1) * 1000);

      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('eco_t1_farming');
      const p2 = doOfflineCycle(env, baseTime + H(2) * 1000, H(8) * 1000);

      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('cul_t1_education');
      const p3 = doOfflineCycle(env, baseTime + H(12) * 1000, H(24) * 1000);

      expect(p1!.overallEfficiency).toBeGreaterThan(p2!.overallEfficiency);
      expect(p2!.overallEfficiency).toBeGreaterThan(p3!.overallEfficiency);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 效率衰减分段验证
  // ═══════════════════════════════════════════
  describe('效率衰减分段验证', () => {
    it('2小时内100%效率 — 进度等于实际时间', () => {
      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('mil_t1_attack'); // 120s
      const panel = doOfflineCycle(env, baseTime, 60 * 1000); // 60s
      const progress = panel!.techProgressList[0];
      // 60s / 120s = 50%
      expect(progress.progressDelta).toBeCloseTo(0.5, 3);
    });

    it('2~8小时70%效率 — 进度低于实际时间', () => {
      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('mil_t1_attack');
      // 从第2小时开始，3小时 × 70% = 2.1h 有效
      // 总有效 = 2h × 100% + 3h × 70% = 2 + 2.1 = 4.1h
      const panel = doOfflineCycle(env, baseTime, H(5) * 1000);
      const progress = panel!.techProgressList[0];
      // 有效秒数 = 2*3600 + 3*3600*0.7 = 14760s
      // 进度 = 14760 / 120 = 远超100%
      expect(progress.completed).toBe(true);
    });

    it('8~24小时40%效率', () => {
      // 验证效率曲线在 8~24h 段为 40%
      const eff10 = env.offlineSys.getEfficiencyAtTime(H(10));
      expect(eff10).toBe(0.4);
    });

    it('24小时后20%效率', () => {
      const eff30 = env.offlineSys.getEfficiencyAtTime(H(30));
      expect(eff30).toBe(0.2);
    });

    it('效率曲线在分段边界处有跳变', () => {
      const curve = env.offlineSys.generateEfficiencyCurve(H(10));
      // 应包含 0→100%, 2h→70%, 8h→40% 的跳变
      const at2h = curve.find(p => p.seconds === H(2));
      expect(at2h).toBeDefined();
      expect(at2h!.efficiency).toBe(0.7);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 多科技并行离线研究
  // ═══════════════════════════════════════════
  describe('多科技并行离线研究', () => {
    it('多个研究队列分别计算进度', () => {
      // 使用快照直接测试多科技场景
      const snapshot = [
        { techId: 'mil_t1_attack', startTime: baseTime, endTime: baseTime + 120 * 1000 },
        { techId: 'eco_t1_farming', startTime: baseTime, endTime: baseTime + 180 * 1000 },
        { techId: 'cul_t1_education', startTime: baseTime, endTime: baseTime + 240 * 1000 },
      ];
      env.offlineSys.onGoOffline(baseTime);
      const list = env.offlineSys.calculateOfflineProgress(snapshot, 60);

      expect(list.length).toBe(3);
      // mil_t1_attack: 60/120 = 50%
      expect(list[0].progressDelta).toBeCloseTo(0.5, 3);
      // eco_t1_farming: 60/180 = 33.3%
      expect(list[1].progressDelta).toBeCloseTo(1 / 3, 3);
      // cul_t1_education: 60/240 = 25%
      expect(list[2].progressDelta).toBeCloseTo(0.25, 3);
    });

    it('部分完成、部分未完成', () => {
      const snapshot = [
        { techId: 'mil_t1_attack', startTime: baseTime, endTime: baseTime + 60 * 1000 },   // 60s
        { techId: 'eco_t1_farming', startTime: baseTime, endTime: baseTime + 3600 * 1000 }, // 1h
      ];
      env.offlineSys.onGoOffline(baseTime);
      const list = env.offlineSys.calculateOfflineProgress(snapshot, 120); // 2min

      expect(list[0].completed).toBe(true);  // 120s > 60s
      expect(list[1].completed).toBe(false); // 120s < 3600s
    });

    it('完成的科技在 completedTechIds 中', () => {
      const snapshot = [
        { techId: 'mil_t1_attack', startTime: baseTime, endTime: baseTime + 60 * 1000 },
        { techId: 'eco_t1_farming', startTime: baseTime, endTime: baseTime + 3600 * 1000 },
      ];
      env.offlineSys.onGoOffline(baseTime);
      const list = env.offlineSys.calculateOfflineProgress(snapshot, 120);
      const completedIds = list.filter(p => p.completed).map(p => p.techId);
      expect(completedIds).toEqual(['mil_t1_attack']);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 离线研究进度正确性
  // ═══════════════════════════════════════════
  describe('离线研究进度正确性', () => {
    it('progressBefore 基于离线开始时间正确计算', () => {
      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('mil_t1_attack'); // 120s
      // 研究开始于 baseTime，30s 后离线
      const offlineStart = baseTime + 30 * 1000;
      env.offlineSys.onGoOffline(offlineStart);
      const panel = env.offlineSys.onComeBackOnline(offlineStart + 60 * 1000);

      const progress = panel!.techProgressList[0];
      // 离线前已研究 30s/120s = 25%
      expect(progress.progressBefore).toBeCloseTo(0.25, 3);
    });

    it('progressAfter = progressBefore + progressDelta', () => {
      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('mil_t1_attack');
      const offlineStart = baseTime + 30 * 1000;
      env.offlineSys.onGoOffline(offlineStart);
      const panel = env.offlineSys.onComeBackOnline(offlineStart + 60 * 1000);

      const progress = panel!.techProgressList[0];
      expect(progress.progressAfter).toBeCloseTo(
        progress.progressBefore + progress.progressDelta,
        5,
      );
    });

    it('progressAfter 不超过 1', () => {
      const snapshot = [
        { techId: 'mil_t1_attack', startTime: baseTime, endTime: baseTime + 60 * 1000 },
      ];
      env.offlineSys.onGoOffline(baseTime);
      const list = env.offlineSys.calculateOfflineProgress(snapshot, H(72));
      expect(list[0].progressAfter).toBeLessThanOrEqual(1);
      expect(list[0].completed).toBe(true);
    });

    it('remainingSeconds 完成时为 0', () => {
      const snapshot = [
        { techId: 'mil_t1_attack', startTime: baseTime, endTime: baseTime + 60 * 1000 },
      ];
      env.offlineSys.onGoOffline(baseTime);
      const list = env.offlineSys.calculateOfflineProgress(snapshot, 120);
      expect(list[0].remainingSeconds).toBe(0);
    });

    it('remainingSeconds 未完成时为正数', () => {
      const snapshot = [
        { techId: 'mil_t1_attack', startTime: baseTime, endTime: baseTime + 120 * 1000 },
      ];
      env.offlineSys.onGoOffline(baseTime);
      const list = env.offlineSys.calculateOfflineProgress(snapshot, 30);
      expect(list[0].remainingSeconds).toBeGreaterThan(0);
      expect(list[0].remainingSeconds).toBeCloseTo(90, 1);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 查询方法
  // ═══════════════════════════════════════════
  describe('查询方法', () => {
    it('getEfficiencyPercent 返回百分比', () => {
      expect(env.offlineSys.getEfficiencyPercent(H(1))).toBe(100);
      expect(env.offlineSys.getEfficiencyPercent(H(5))).toBeLessThan(100);
      expect(env.offlineSys.getEfficiencyPercent(H(5))).toBeGreaterThan(0);
    });

    it('getLastPanelData 初始为 null', () => {
      expect(env.offlineSys.getLastPanelData()).toBeNull();
    });

    it('getLastPanelData 回归后保留', () => {
      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('mil_t1_attack');
      doOfflineCycle(env, baseTime, H(1) * 1000);
      expect(env.offlineSys.getLastPanelData()).not.toBeNull();
      expect(env.offlineSys.getLastPanelData()!.offlineSeconds).toBe(H(1));
    });
  });

  // ═══════════════════════════════════════════
  // 6. 格式化时间边界
  // ═══════════════════════════════════════════
  describe('格式化时间边界', () => {
    it('负数显示"刚刚"', () => {
      expect(env.offlineSys.formatOfflineTime(-1)).toBe('刚刚');
    });

    it('1秒', () => {
      expect(env.offlineSys.formatOfflineTime(1)).toBe('1秒');
    });

    it('59秒', () => {
      expect(env.offlineSys.formatOfflineTime(59)).toBe('59秒');
    });

    it('1分钟', () => {
      expect(env.offlineSys.formatOfflineTime(60)).toBe('1分钟');
    });

    it('整小时无分钟', () => {
      expect(env.offlineSys.formatOfflineTime(H(4))).toBe('4小时');
    });

    it('3天12小时', () => {
      expect(env.offlineSys.formatOfflineTime(H(84))).toBe('3天12小时');
    });
  });
});
