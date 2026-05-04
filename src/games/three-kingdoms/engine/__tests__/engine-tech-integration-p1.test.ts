/**
 * 科技系统引擎集成测试
 *
 * 覆盖：
 * 1. 引擎初始化时科技系统正确创建
 * 2. 科技系统通过引擎 API 可访问
 * 3. 科技点随 tick 产出（需要书院等级）
 * 4. 研究流程通过引擎 API 完成
 * 5. 科技加成影响资源产出
 * 6. 存档/读档包含科技数据
 * 7. 旧存档兼容（无科技数据）
 * 8. reset 清理科技系统
 */

import { ThreeKingdomsEngine } from '../ThreeKingdomsEngine';
import type { TechPath, TechState } from '../tech/tech.types';
import { TECH_PATHS } from '../tech/tech.types';

// ── localStorage mock ──
const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => storage[key] ?? null),
  setItem: vi.fn((key: string, val: string) => { storage[key] = val; }),
  removeItem: vi.fn((key: string) => { delete storage[key]; }),
  clear: vi.fn(() => { Object.keys(storage).forEach(k => delete storage[k]); }),
  get length() { return Object.keys(storage).length; },
  key: vi.fn((_: number) => null),
};

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true, configurable: true });

describe('科技系统引擎集成', () => {
  let engine: ThreeKingdomsEngine;
  let baseTime: number;

  beforeEach(() => {
    engine = new ThreeKingdomsEngine();
    localStorageMock.clear();
    vi.clearAllMocks();
    baseTime = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(baseTime);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    engine.destroy();
  });

  // 辅助：推进时间
  function advanceTime(ms: number): void {
    vi.spyOn(Date, 'now').mockReturnValue(baseTime + ms);
  }

  // 辅助：设置书院等级 + 铜钱，使研究流程可正常工作
  function setupResearchEnv(academyLv: number = 5, gold: number = 100000): void {
    // 模拟书院等级（通过建筑系统 getLevel）
    vi.spyOn(engine['building'], 'getLevel').mockImplementation((type: string) => {
      if (type === 'academy') return academyLv;
      return engine['building'].getLevel(type);
    });
    // 提高铜钱上限并补充铜钱
    engine['resource'].setCap('gold', gold);
    engine['resource'].addResource('gold', gold);
  }

  // ═══════════════════════════════════════════
  // 1. 引擎初始化
  // ═══════════════════════════════════════════
  describe('引擎初始化', () => {
    it('初始化后科技系统可访问', () => {
      engine.init();
      expect(engine.getTechTreeSystem()).toBeDefined();
      expect(engine.getTechPointSystem()).toBeDefined();
      expect(engine.getTechResearchSystem()).toBeDefined();
    });

    it('getTechState 返回完整状态', () => {
      engine.init();
      const state = engine.getTechState();
      expect(state.nodes).toBeDefined();
      expect(state.researchQueue).toBeDefined();
      expect(state.techPoints).toBeDefined();
      expect(state.techPoints.current).toBe(0);
    });

    it('getSnapshot 包含科技状态', () => {
      engine.init();
      const snap = engine.getSnapshot();
      expect(snap.techState).toBeDefined();
      expect(snap.techState.nodes).toBeDefined();
    });

    it('科技树初始状态正确', () => {
      engine.init();
      const treeSys = engine.getTechTreeSystem();
      // Tier 1 节点应为 available
      for (const path of TECH_PATHS) {
        const t1Nodes = treeSys.getTierNodes(path, 1);
        for (const node of t1Nodes) {
          const state = treeSys.getNodeState(node.id);
          expect(state?.status).toBe('available');
        }
      }
    });
  });

  // ═══════════════════════════════════════════
  // 2. 三条科技路线
  // ═══════════════════════════════════════════
  describe('三条科技路线', () => {
    it('三条路线全部存在', () => {
      engine.init();
      const treeSys = engine.getTechTreeSystem();
      for (const path of TECH_PATHS) {
        const nodes = treeSys.getPathNodes(path);
        expect(nodes.length).toBeGreaterThan(0);
      }
    });

    it('军事路线有 8 个节点', () => {
      engine.init();
      const treeSys = engine.getTechTreeSystem();
      const milNodes = treeSys.getPathNodes('military');
      expect(milNodes).toHaveLength(8);
    });

    it('经济路线有 8 个节点', () => {
      engine.init();
      const treeSys = engine.getTechTreeSystem();
      const ecoNodes = treeSys.getPathNodes('economy');
      expect(ecoNodes).toHaveLength(8);
    });

    it('文化路线有 8 个节点', () => {
      engine.init();
      const treeSys = engine.getTechTreeSystem();
      const culNodes = treeSys.getPathNodes('culture');
      expect(culNodes).toHaveLength(8);
    });

    it('每条路线有 4 个层级', () => {
      engine.init();
      const treeSys = engine.getTechTreeSystem();
      for (const path of TECH_PATHS) {
        for (let tier = 1; tier <= 4; tier++) {
          const nodes = treeSys.getTierNodes(path, tier);
          expect(nodes.length).toBeGreaterThan(0);
        }
      }
    });
  });

  // ═══════════════════════════════════════════
  // 3. 科技点产出
  // ═══════════════════════════════════════════
  describe('科技点产出', () => {
    it('无书院时科技点不产出', () => {
      engine.init();
      engine.tick(1000);
      const pointSys = engine.getTechPointSystem();
      expect(pointSys.getCurrentPoints()).toBe(0);
    });

    it('通过科技点系统直接产出', () => {
      engine.init();
      const pointSys = engine.getTechPointSystem();
      pointSys.syncAcademyLevel(5);
      pointSys.update(100); // 100 秒

      // Lv5 = 0.08/秒 × 100 = 8 点
      expect(pointSys.getCurrentPoints()).toBeCloseTo(8);
    });

    it('科技点产出速率正确', () => {
      engine.init();
      const pointSys = engine.getTechPointSystem();
      pointSys.syncAcademyLevel(10);
      expect(pointSys.getProductionRate()).toBeCloseTo(0.33);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 研究流程
  // ═══════════════════════════════════════════
  describe('研究流程', () => {
    it('科技点不足时无法研究', () => {
      engine.init();
      setupResearchEnv(5);
      const result = engine.startTechResearch('mil_t1_attack');
      expect(result.success).toBe(false);
      // Sprint 3: 可能因科技点不足或铜钱不足
      expect(result.reason).toMatch(/不足|上限/);
    });

    it('有足够科技点时可以开始研究', () => {
      engine.init();
      setupResearchEnv(20);
      const pointSys = engine.getTechPointSystem();
      pointSys.syncAcademyLevel(20);
      // 给足够时间积累科技点（Sprint 3: costPoints × 10 倍率，需要更多点数）
      for (let i = 0; i < 500; i++) {
        pointSys.update(10);
      }

      const result = engine.startTechResearch('mil_t1_attack');
      expect(result.success).toBe(true);
    });

    it('研究完成后节点变为 completed', () => {
      engine.init();
      setupResearchEnv(20);
      const pointSys = engine.getTechPointSystem();
      const treeSys = engine.getTechTreeSystem();
      const researchSys = engine.getTechResearchSystem();

      pointSys.syncAcademyLevel(20);
      for (let i = 0; i < 500; i++) {
        pointSys.update(10);
      }

      engine.startTechResearch('mil_t1_attack');

      // 推进时间（超过研究时间 120 秒）
      advanceTime(200 * 1000);

      // 手动触发研究系统检查完成
      researchSys.update(0);

      const state = treeSys.getNodeState('mil_t1_attack');
      expect(state?.status).toBe('completed');
    });

    it('取消研究返还科技点', () => {
      engine.init();
      setupResearchEnv(20);
      const pointSys = engine.getTechPointSystem();

      pointSys.syncAcademyLevel(20);
      for (let i = 0; i < 500; i++) {
        pointSys.update(10);
      }

      const pointsBefore = pointSys.getCurrentPoints();
      engine.startTechResearch('mil_t1_attack');
      const pointsAfterStart = pointSys.getCurrentPoints();

      // Sprint 3: costPoints × RESEARCH_START_TECH_POINT_MULTIPLIER (10)
      expect(pointsAfterStart).toBeCloseTo(pointsBefore - 50, 0);

      const cancelResult = engine.cancelTechResearch('mil_t1_attack');
      expect(cancelResult.success).toBe(true);
      expect(pointSys.getCurrentPoints()).toBeCloseTo(pointsBefore, 0);

    });
  });

  // ═══════════════════════════════════════════
  // 5. 互斥分支
  // ═══════════════════════════════════════════
  describe('互斥分支', () => {
    it('完成一个互斥节点后另一个被锁定', () => {
      engine.init();
      const treeSys = engine.getTechTreeSystem();

      // 直接完成节点（绕过研究流程）
      treeSys.completeNode('mil_t1_attack');

      // mil_t1_defense 应被锁定
      const defenseState = treeSys.getNodeState('mil_t1_defense');
      expect(defenseState?.status).toBe('locked');
      expect(treeSys.isMutexLocked('mil_t1_defense')).toBe(true);
    });

    it('被互斥锁定的节点无法研究', () => {
});
});
});
