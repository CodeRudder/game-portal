import { vi } from 'vitest';
/**
 * TechOfflineSystem 单元测试 — Part 2: 生命周期 + 回归面板 + 集成 + 边界
 */

import { TechTreeSystem } from '../TechTreeSystem';
import { TechPointSystem } from '../TechPointSystem';
import { TechResearchSystem } from '../TechResearchSystem';
import { TechOfflineSystem } from '../TechOfflineSystem';
import type { ISystemDeps } from '../../../../core/types';

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

describe('TechOfflineSystem 生命周期与面板', () => {
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
  // 1. 离线/上线生命周期
  // ═══════════════════════════════════════════
  describe('离线/上线生命周期', () => {
    it('onGoOffline 记录离线时间和研究快照', () => {
      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('mil_t1_attack');
      env.offlineSys.onGoOffline(baseTime);
      expect(env.offlineSys.isOffline()).toBe(true);
      expect(env.offlineSys.getOfflineStartTime()).toBe(baseTime);
      expect(env.offlineSys.getState().researchSnapshot.length).toBe(1);
    });

    it('onGoOffline 无活跃研究时快照为空', () => {
      env.offlineSys.onGoOffline(baseTime);
      expect(env.offlineSys.getState().researchSnapshot).toEqual([]);
    });

    it('onComeBackOnline 无快照时返回 null', () => {
      env.offlineSys.onGoOffline(baseTime);
      expect(env.offlineSys.onComeBackOnline(baseTime + H(2) * 1000)).toBeNull();
    });

    it('onComeBackOnline 从未离线时返回 null', () => {
      expect(env.offlineSys.onComeBackOnline(baseTime + H(2) * 1000)).toBeNull();
    });

    it('onComeBackOnline 0 秒离线返回 null', () => {
      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('mil_t1_attack');
      env.offlineSys.onGoOffline(baseTime);
      expect(env.offlineSys.onComeBackOnline(baseTime)).toBeNull();
    });

    it('onComeBackOnline 正常回归返回面板数据', () => {
      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('mil_t1_attack');
      env.offlineSys.onGoOffline(baseTime);
      const result = env.offlineSys.onComeBackOnline(baseTime + H(1) * 1000);
      expect(result).not.toBeNull();
      expect(result!.offlineSeconds).toBe(H(1));
      expect(result!.techProgressList.length).toBe(1);
    });

    it('onComeBackOnline 清除离线状态', () => {
      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('mil_t1_attack');
      env.offlineSys.onGoOffline(baseTime);
      env.offlineSys.onComeBackOnline(baseTime + H(1) * 1000);
      expect(env.offlineSys.isOffline()).toBe(false);
      expect(env.offlineSys.getOfflineStartTime()).toBeNull();
    });

    it('onComeBackOnline 保存面板数据到 lastPanelData', () => {
      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('mil_t1_attack');
      env.offlineSys.onGoOffline(baseTime);
      env.offlineSys.onComeBackOnline(baseTime + H(1) * 1000);
      expect(env.offlineSys.getLastPanelData()).not.toBeNull();
      expect(env.offlineSys.getLastPanelData()!.offlineSeconds).toBe(H(1));
    });

    it('onComeBackOnline 发出事件', () => {
      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('mil_t1_attack');
      env.offlineSys.onGoOffline(baseTime);
      env.offlineSys.onComeBackOnline(baseTime + H(1) * 1000);
      expect(env.deps.eventBus.emit).toHaveBeenCalledWith(
        'tech:offlineResearchCompleted',
        expect.objectContaining({ offlineSeconds: H(1) }),
      );
    });
  });

  // ═══════════════════════════════════════════
  // 2. 回归面板数据完整性
  // ═══════════════════════════════════════════
  describe('回归面板数据完整性', () => {
    it('面板包含所有必要字段', () => {
      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('mil_t1_attack');
      env.offlineSys.onGoOffline(baseTime);
      const panel = env.offlineSys.onComeBackOnline(baseTime + H(1) * 1000);
      expect(panel).toHaveProperty('offlineSeconds');
      expect(panel).toHaveProperty('offlineTimeText');
      expect(panel).toHaveProperty('overallEfficiency');
      expect(panel).toHaveProperty('techProgressList');
      expect(panel).toHaveProperty('completedTechIds');
      expect(panel).toHaveProperty('efficiencyCurve');
    });

    it('offlineTimeText 格式正确', () => {
      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('mil_t1_attack');
      env.offlineSys.onGoOffline(baseTime);
      const panel = env.offlineSys.onComeBackOnline(baseTime + 90 * 60 * 1000);
      expect(panel!.offlineTimeText).toBe('1小时30分钟');
    });

    it('overallEfficiency 在合理范围内', () => {
      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('mil_t1_attack');
      env.offlineSys.onGoOffline(baseTime);
      const panel = env.offlineSys.onComeBackOnline(baseTime + H(5) * 1000);
      expect(panel!.overallEfficiency).toBeGreaterThan(0);
      expect(panel!.overallEfficiency).toBeLessThanOrEqual(1);
    });

    it('efficiencyCurve 包含起始点', () => {
      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('mil_t1_attack');
      env.offlineSys.onGoOffline(baseTime);
      const panel = env.offlineSys.onComeBackOnline(baseTime + H(5) * 1000);
      expect(panel!.efficiencyCurve[0]).toEqual({ seconds: 0, efficiency: 1.0 });
    });

    it('completedTechIds 包含完成的科技', () => {
      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('mil_t1_attack');
      env.offlineSys.onGoOffline(baseTime);
      const panel = env.offlineSys.onComeBackOnline(baseTime + H(3) * 1000);
      expect(panel!.completedTechIds).toEqual(['mil_t1_attack']);
    });

    it('未完成时 completedTechIds 为空', () => {
      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('mil_t1_attack');
      env.offlineSys.onGoOffline(baseTime);
      const panel = env.offlineSys.onComeBackOnline(baseTime + 30 * 1000);
      expect(panel!.completedTechIds).toEqual([]);
    });

    it('techProgressList 包含科技名称', () => {
      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('mil_t1_attack');
      env.offlineSys.onGoOffline(baseTime);
      const panel = env.offlineSys.onComeBackOnline(baseTime + H(1) * 1000);
      expect(panel!.techProgressList[0].techName).toBe('锐兵术');
    });
  });

  // ═══════════════════════════════════════════
  // 3. 与研究系统的集成
  // ═══════════════════════════════════════════
  describe('与研究系统的集成', () => {
    it('离线完成科技后节点状态正确', () => {
      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('mil_t1_attack');
      env.offlineSys.onGoOffline(baseTime);
      env.offlineSys.onComeBackOnline(baseTime + H(3) * 1000);
      expect(env.treeSys.getNodeState('mil_t1_attack')?.status).toBe('completed');
    });

    it('离线未完成科技后节点仍为 researching', () => {
      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('mil_t1_attack');
      env.offlineSys.onGoOffline(baseTime);
      env.offlineSys.onComeBackOnline(baseTime + 30 * 1000);
      expect(env.treeSys.getNodeState('mil_t1_attack')?.status).toBe('researching');
    });
  });

  // ═══════════════════════════════════════════
  // 4. 边界场景
  // ═══════════════════════════════════════════
  describe('边界场景', () => {
    it('未来时间戳（离线秒数为负）返回 null', () => {
      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('mil_t1_attack');
      env.offlineSys.onGoOffline(baseTime);
      expect(env.offlineSys.onComeBackOnline(baseTime - 1000)).toBeNull();
    });

    it('离线 72h 后封顶不再增长', () => {
      // 验证 72h 和 100h 的有效秒数相同
      const eff72 = env.offlineSys.calculateEffectiveSeconds(H(72));
      const eff100 = env.offlineSys.calculateEffectiveSeconds(H(100));
      expect(eff72).toBeCloseTo(eff100, 1);
    });

    it('重复调用 onGoOffline 覆盖之前的快照', () => {
      grantPoints(env.pointSys, 100);
      env.researchSys.startResearch('mil_t1_attack');
      env.offlineSys.onGoOffline(baseTime);
      env.offlineSys.onGoOffline(baseTime + 1000);
      expect(env.offlineSys.getOfflineStartTime()).toBe(baseTime + 1000);
      expect(env.offlineSys.getState().researchSnapshot.length).toBe(1);
    });

    it('长时间衰减下高阶科技进度有限但最终完成', () => {
      env.treeSys.completeNode('mil_t1_attack');
      env.treeSys.completeNode('mil_t2_charge');
      env.treeSys.completeNode('mil_t3_blitz');
      grantPoints(env.pointSys, 1000);
      env.researchSys.startResearch('mil_t4_dominance'); // 1800s
      env.offlineSys.onGoOffline(baseTime);
      const result = env.offlineSys.onComeBackOnline(baseTime + H(48) * 1000);
      expect(result!.techProgressList[0].completed).toBe(true);
    });
  });
});
