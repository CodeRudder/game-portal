/**
 * 对抗式测试 — 互斥分支
 *
 * 维度：F-Normal + F-Boundary
 * 重点：互斥组选择、锁定、解锁、跨路线互斥
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TechTreeSystem } from '../TechTreeSystem';
import { TechPointSystem } from '../TechPointSystem';
import { TechResearchSystem } from '../TechResearchSystem';
import { createRealDeps } from '../../../test-utils/test-helpers';

describe('对抗式测试: 互斥分支', () => {
  let treeSys: TechTreeSystem;
  let pointSys: TechPointSystem;
  let researchSys: TechResearchSystem;
  let baseTime: number;
  let currentTime: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    baseTime = 1_000_000_000_000;
    currentTime = baseTime;
    vi.spyOn(Date, 'now').mockReturnValue(currentTime);

    treeSys = new TechTreeSystem();
    pointSys = new TechPointSystem();
    researchSys = new TechResearchSystem(
      treeSys, pointSys, () => 20, () => 100, () => true,
      () => 100000, () => true,
    );
    const deps = createRealDeps();
    treeSys.init(deps);
    pointSys.init(deps);
    researchSys.init(deps);
  });

  afterEach(() => vi.restoreAllMocks());

  function grantPoints(amount: number) {
    const actualNeeded = amount * 10;
    pointSys.syncAcademyLevel(20);
    pointSys.update(Math.ceil(actualNeeded / 1.76) + 10);
  }

  function advanceTime(ms: number) {
    currentTime += ms;
    vi.spyOn(Date, 'now').mockReturnValue(currentTime);
  }

  /** 辅助：完成一个科技（累积时间推进） */
  function completeTech(techId: string) {
    grantPoints(1000);
    researchSys.startResearch(techId);
    advanceTime(2000 * 1000);
    researchSys.update(0);
  }

  // ═══════════════════════════════════════════
  // 军事路线 Tier1 互斥组
  // ═══════════════════════════════════════════
  describe('军事路线 Tier1 互斥组', () => {
    it('初始状态：两个Tier1节点都为 available', () => {
      expect(treeSys.getNodeState('mil_t1_attack')?.status).toBe('available');
      expect(treeSys.getNodeState('mil_t1_defense')?.status).toBe('available');
    });

    it('选择 mil_t1_attack 后，mil_t1_defense 被互斥锁定', () => {
      completeTech('mil_t1_attack');
      expect(treeSys.getNodeState('mil_t1_attack')?.status).toBe('completed');
      expect(treeSys.getNodeState('mil_t1_defense')?.status).toBe('locked');
    });

    it('选择 mil_t1_defense 后，mil_t1_attack 被互斥锁定', () => {
      completeTech('mil_t1_defense');
      expect(treeSys.getNodeState('mil_t1_defense')?.status).toBe('completed');
      expect(treeSys.getNodeState('mil_t1_attack')?.status).toBe('locked');
    });

    it('互斥锁定后 cannot research 被锁定的节点', () => {
      completeTech('mil_t1_attack');
      const check = treeSys.canResearch('mil_t1_defense');
      expect(check.can).toBe(false);
      expect(check.reason).toContain('互斥');
    });

    it('尝试研究被互斥锁定的节点应失败', () => {
      completeTech('mil_t1_attack');
      grantPoints(100);
      const result = researchSys.startResearch('mil_t1_defense');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('互斥');
    });

    it('互斥锁定是永久的：完成后续节点后仍锁定', () => {
      completeTech('mil_t1_attack');
      completeTech('mil_t2_charge');
      expect(treeSys.getNodeState('mil_t1_defense')?.status).toBe('locked');
    });
  });

  // ═══════════════════════════════════════════
  // 经济/文化路线 Tier1 互斥组
  // ═══════════════════════════════════════════
  describe('经济路线 Tier1 互斥组', () => {
    it('选择 eco_t1_farming 后 eco_t1_trade 被锁定', () => {
      completeTech('eco_t1_farming');
      expect(treeSys.getNodeState('eco_t1_trade')?.status).toBe('locked');
    });

    it('选择 eco_t1_trade 后 eco_t1_farming 被锁定', () => {
      completeTech('eco_t1_trade');
      expect(treeSys.getNodeState('eco_t1_farming')?.status).toBe('locked');
    });
  });

  describe('文化路线 Tier1 互斥组', () => {
    it('选择 cul_t1_education 后 cul_t1_recruit 被锁定', () => {
      completeTech('cul_t1_education');
      expect(treeSys.getNodeState('cul_t1_recruit')?.status).toBe('locked');
    });

    it('选择 cul_t1_recruit 后 cul_t1_education 被锁定', () => {
      completeTech('cul_t1_recruit');
      expect(treeSys.getNodeState('cul_t1_education')?.status).toBe('locked');
    });
  });

  // ═══════════════════════════════════════════
  // Tier3 互斥组
  // ═══════════════════════════════════════════
  describe('Tier3 互斥组（军事）', () => {
    it('mil_t3_blitz 和 mil_t3_endurance 属于同一互斥组', () => {
      const blitzDef = treeSys.getNodeDef('mil_t3_blitz');
      const enduranceDef = treeSys.getNodeDef('mil_t3_endurance');
      expect(blitzDef?.mutexGroup).toBeTruthy();
      expect(blitzDef?.mutexGroup).toBe(enduranceDef?.mutexGroup);
    });

    it('攻击线: blitz 可用，endurance 前置不可达', () => {
      completeTech('mil_t1_attack');
      completeTech('mil_t2_charge');
      expect(treeSys.getNodeState('mil_t3_blitz')?.status).toBe('available');
      expect(treeSys.getNodeState('mil_t3_endurance')?.status).toBe('locked');
    });

    it('攻击线: 完成 blitz 后 endurance 被互斥锁定', () => {
      completeTech('mil_t1_attack');
      completeTech('mil_t2_charge');
      completeTech('mil_t3_blitz');
      expect(treeSys.isMutexLocked('mil_t3_endurance')).toBe(true);
    });

    it('防御线: endurance 可用，blitz 前置不可达', () => {
      completeTech('mil_t1_defense');
      completeTech('mil_t2_fortify');
      expect(treeSys.getNodeState('mil_t3_endurance')?.status).toBe('available');
      expect(treeSys.getNodeState('mil_t3_blitz')?.status).toBe('locked');
    });

    it('Tier3互斥选择后Tier4只能走对应分支', () => {
      completeTech('mil_t1_attack');
      completeTech('mil_t2_charge');
      completeTech('mil_t3_blitz');
      expect(treeSys.getNodeState('mil_t4_dominance')?.status).toBe('available');
      expect(treeSys.getNodeState('mil_t4_fortress')?.status).toBe('locked');
    });
  });

  // ═══════════════════════════════════════════
  // 互斥选择的不可逆性
  // ═══════════════════════════════════════════
  describe('互斥选择不可逆', () => {
    it('完成互斥节点后 chosenMutexNodes 记录正确', () => {
      completeTech('mil_t1_attack');
      const chosen = treeSys.getChosenMutexNodes();
      expect(chosen['mil_t1']).toBe('mil_t1_attack');
    });

    it('序列化/反序列化后互斥选择保持', () => {
      completeTech('mil_t1_attack');
      const data = treeSys.serialize();
      const newTree = new TechTreeSystem();
      newTree.init(createRealDeps());
      newTree.deserialize(data);
      expect(newTree.getNodeState('mil_t1_attack')?.status).toBe('completed');
      expect(newTree.getNodeState('mil_t1_defense')?.status).toBe('locked');
    });

    it('reset后互斥选择清空', () => {
      completeTech('mil_t1_attack');
      treeSys.reset();
      expect(treeSys.getNodeState('mil_t1_attack')?.status).toBe('available');
      expect(treeSys.getNodeState('mil_t1_defense')?.status).toBe('available');
    });
  });

  // ═══════════════════════════════════════════
  // 互斥替代节点查询
  // ═══════════════════════════════════════════
  describe('互斥替代节点查询', () => {
    it('mil_t1_attack 的互斥替代是 mil_t1_defense', () => {
      const alts = treeSys.getMutexAlternatives('mil_t1_attack');
      expect(alts).toContain('mil_t1_defense');
    });

    it('无互斥组的节点返回空数组', () => {
      expect(treeSys.getMutexAlternatives('mil_t2_charge')).toEqual([]);
    });

    it('isMutexLocked 对无互斥组节点返回 false', () => {
      expect(treeSys.isMutexLocked('mil_t2_charge')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 对抗：同时研究互斥节点（设计边界）
  // ═══════════════════════════════════════════
  describe('对抗: 同时研究互斥节点', () => {
    it('两个互斥节点可以同时入队（互斥在完成时才生效）', () => {
      grantPoints(200);
      const r1 = researchSys.startResearch('mil_t1_attack');
      expect(r1.success).toBe(true);
      // mil_t1_defense 仍为 available（互斥在completeNode时才锁定）
      const r2 = researchSys.startResearch('mil_t1_defense');
      // 队列大小5，两个都能入队 — 这是设计边界
      // 标记为已知行为
      expect(r2.success).toBe(true);
    });
  });
});
