/**
 * 对抗式测试 — 前置条件链
 *
 * 维度：F-Normal + F-Error
 * 重点：前置依赖检查、跳级研究、部分前置、融合科技前置
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TechTreeSystem } from '../TechTreeSystem';
import { TechPointSystem } from '../TechPointSystem';
import { TechResearchSystem } from '../TechResearchSystem';
import { FusionTechSystem } from '../FusionTechSystem';
import { createRealDeps } from '../../../test-utils/test-helpers';

describe('对抗式测试: 前置条件链', () => {
  let treeSys: TechTreeSystem;
  let pointSys: TechPointSystem;
  let researchSys: TechResearchSystem;
  let fusionSys: FusionTechSystem;
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
    );
    fusionSys = new FusionTechSystem();
    fusionSys.setTechTree(treeSys);

    const deps = createRealDeps();
    treeSys.init(deps);
    pointSys.init(deps);
    researchSys.init(deps);
    fusionSys.init(deps);
  });

  afterEach(() => vi.restoreAllMocks());

  function grantPoints(amount: number) {
    pointSys.syncAcademyLevel(20);
    pointSys.update(Math.ceil(amount / 1.76) + 10);
  }

  function advanceTime(ms: number) {
    currentTime += ms;
    vi.spyOn(Date, 'now').mockReturnValue(currentTime);
  }

  function completeTech(techId: string) {
    grantPoints(1000);
    researchSys.startResearch(techId);
    advanceTime(2000 * 1000);
    researchSys.update(0);
  }

  // ═══════════════════════════════════════════
  // 军事路线前置链
  // ═══════════════════════════════════════════
  describe('军事路线前置链', () => {
    it('Tier1无前置，直接available', () => {
      expect(treeSys.arePrerequisitesMet('mil_t1_attack')).toBe(true);
      expect(treeSys.arePrerequisitesMet('mil_t1_defense')).toBe(true);
    });

    it('Tier2需要Tier1完成', () => {
      // mil_t2_charge 前置: mil_t1_attack
      expect(treeSys.arePrerequisitesMet('mil_t2_charge')).toBe(false);
      expect(treeSys.getUnmetPrerequisites('mil_t2_charge')).toContain('mil_t1_attack');
    });

    it('跳级研究Tier2应失败', () => {
      grantPoints(1000);
      const result = researchSys.startResearch('mil_t2_charge');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('前置');
    });

    it('完成Tier1后Tier2解锁', () => {
      completeTech('mil_t1_attack');
      expect(treeSys.arePrerequisitesMet('mil_t2_charge')).toBe(true);
      expect(treeSys.getNodeState('mil_t2_charge')?.status).toBe('available');
    });

    it('Tier3需要Tier2完成（攻击线）', () => {
      completeTech('mil_t1_attack');
      expect(treeSys.arePrerequisitesMet('mil_t3_blitz')).toBe(false);
      completeTech('mil_t2_charge');
      // mil_t3_blitz 前置满足，但它有互斥组 mil_t3
      // 需要确认它不被互斥锁定
      expect(treeSys.arePrerequisitesMet('mil_t3_blitz')).toBe(true);
    });

    it('Tier4需要Tier3完成（攻击线）', () => {
      completeTech('mil_t1_attack');
      completeTech('mil_t2_charge');
      expect(treeSys.arePrerequisitesMet('mil_t4_dominance')).toBe(false);
      completeTech('mil_t3_blitz');
      expect(treeSys.arePrerequisitesMet('mil_t4_dominance')).toBe(true);
    });

    it('完整攻击线链路: mil_t1_attack → mil_t2_charge → mil_t3_blitz → mil_t4_dominance', () => {
      completeTech('mil_t1_attack');
      expect(treeSys.getNodeState('mil_t2_charge')?.status).toBe('available');

      completeTech('mil_t2_charge');
      expect(treeSys.getNodeState('mil_t3_blitz')?.status).toBe('available');

      completeTech('mil_t3_blitz');
      expect(treeSys.getNodeState('mil_t4_dominance')?.status).toBe('available');

      completeTech('mil_t4_dominance');
      expect(treeSys.getNodeState('mil_t4_dominance')?.status).toBe('completed');
    });

    it('完整防御线链路: mil_t1_defense → mil_t2_fortify → mil_t3_endurance → mil_t4_fortress', () => {
      completeTech('mil_t1_defense');
      expect(treeSys.getNodeState('mil_t2_fortify')?.status).toBe('available');

      completeTech('mil_t2_fortify');
      expect(treeSys.getNodeState('mil_t3_endurance')?.status).toBe('available');

      completeTech('mil_t3_endurance');
      expect(treeSys.getNodeState('mil_t4_fortress')?.status).toBe('available');

      completeTech('mil_t4_fortress');
      expect(treeSys.getNodeState('mil_t4_fortress')?.status).toBe('completed');
    });
  });

  // ═══════════════════════════════════════════
  // 经济路线前置链
  // ═══════════════════════════════════════════
  describe('经济路线前置链', () => {
    it('eco_t1_farming → eco_t2_irrigation → eco_t3_granary → eco_t4_prosperity', () => {
      expect(treeSys.arePrerequisitesMet('eco_t2_irrigation')).toBe(false);
      completeTech('eco_t1_farming');
      expect(treeSys.arePrerequisitesMet('eco_t2_irrigation')).toBe(true);

      completeTech('eco_t2_irrigation');
      expect(treeSys.arePrerequisitesMet('eco_t3_granary')).toBe(true);

      completeTech('eco_t3_granary');
      expect(treeSys.arePrerequisitesMet('eco_t4_prosperity')).toBe(true);
    });

    it('eco_t1_trade → eco_t2_minting → eco_t3_marketplace → eco_t4_golden_age', () => {
      completeTech('eco_t1_trade');
      completeTech('eco_t2_minting');
      expect(treeSys.arePrerequisitesMet('eco_t3_marketplace')).toBe(true);
      completeTech('eco_t3_marketplace');
      expect(treeSys.arePrerequisitesMet('eco_t4_golden_age')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 文化路线前置链
  // ═══════════════════════════════════════════
  describe('文化路线前置链', () => {
    it('cul_t1_education → cul_t2_academy → cul_t3_scholar → cul_t4_wisdom', () => {
      completeTech('cul_t1_education');
      completeTech('cul_t2_academy');
      completeTech('cul_t3_scholar');
      expect(treeSys.arePrerequisitesMet('cul_t4_wisdom')).toBe(true);
    });

    it('cul_t1_recruit → cul_t2_talent → cul_t3_general → cul_t4_legacy', () => {
      completeTech('cul_t1_recruit');
      completeTech('cul_t2_talent');
      completeTech('cul_t3_general');
      expect(treeSys.arePrerequisitesMet('cul_t4_legacy')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 对抗: 不存在的节点
  // ═══════════════════════════════════════════
  describe('对抗: 不存在的节点', () => {
    it('arePrerequisitesMet 对不存在的节点返回 false', () => {
      expect(treeSys.arePrerequisitesMet('nonexistent')).toBe(false);
    });

    it('getUnmetPrerequisites 对不存在的节点返回空数组', () => {
      expect(treeSys.getUnmetPrerequisites('nonexistent')).toEqual([]);
    });

    it('canResearch 对不存在的节点返回失败', () => {
      const check = treeSys.canResearch('nonexistent');
      expect(check.can).toBe(false);
      expect(check.reason).toContain('不存在');
    });

    it('getNodeDef 对不存在的节点返回 undefined', () => {
      expect(treeSys.getNodeDef('nonexistent')).toBeUndefined();
    });

    it('getNodeState 对不存在的节点返回 undefined', () => {
      expect(treeSys.getNodeState('nonexistent')).toBeUndefined();
    });

    it('startResearch 对不存在的节点返回失败', () => {
      grantPoints(100);
      const result = researchSys.startResearch('nonexistent');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不存在');
    });

    it('空字符串techId应失败', () => {
      grantPoints(100);
      const result = researchSys.startResearch('');
      expect(result.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 融合科技前置条件
  // ═══════════════════════════════════════════
  describe('融合科技前置条件', () => {
    it('融合科技初始为 locked', () => {
      expect(fusionSys.getFusionState('fusion_mil_eco_1')?.status).toBe('locked');
    });

    it('只完成一条路线前置，融合科技仍为 locked', () => {
      completeTech('mil_t1_attack');
      completeTech('mil_t2_charge');
      // 只完成了军事路线前置，经济路线未完成
      expect(fusionSys.arePrerequisitesMet('fusion_mil_eco_1')).toBe(false);
      fusionSys.refreshAllAvailability();
      expect(fusionSys.getFusionState('fusion_mil_eco_1')?.status).toBe('locked');
    });

    it('两条路线前置都完成后，融合科技变为 available', () => {
      completeTech('mil_t1_attack');
      completeTech('mil_t2_charge');
      completeTech('eco_t1_farming');
      completeTech('eco_t2_irrigation');
      fusionSys.refreshAllAvailability();
      expect(fusionSys.arePrerequisitesMet('fusion_mil_eco_1')).toBe(true);
      expect(fusionSys.getFusionState('fusion_mil_eco_1')?.status).toBe('available');
    });

    it('融合科技 canResearch 在前置未满足时返回失败', () => {
      const check = fusionSys.canResearch('fusion_mil_eco_1');
      expect(check.can).toBe(false);
      expect(check.reason).toContain('前置');
    });

    it('融合科技 getUnmetPrerequisites 正确反映完成状态', () => {
      const unmet = fusionSys.getUnmetPrerequisites('fusion_mil_eco_1');
      expect(unmet.pathA).toBe(false);
      expect(unmet.pathB).toBe(false);

      completeTech('mil_t1_attack');
      completeTech('mil_t2_charge');
      const unmet2 = fusionSys.getUnmetPrerequisites('fusion_mil_eco_1');
      expect(unmet2.pathA).toBe(true);
      expect(unmet2.pathB).toBe(false);
    });

    it('融合科技跨路线组合: fusion_mil_cul_1', () => {
      completeTech('mil_t1_defense');
      completeTech('mil_t2_fortify');
      completeTech('cul_t1_education');
      completeTech('cul_t2_academy');
      fusionSys.refreshAllAvailability();
      expect(fusionSys.arePrerequisitesMet('fusion_mil_cul_1')).toBe(true);
    });

    it('融合科技跨路线组合: fusion_eco_cul_1', () => {
      completeTech('eco_t1_farming');
      completeTech('eco_t2_irrigation');
      completeTech('cul_t1_education');
      completeTech('cul_t2_academy');
      fusionSys.refreshAllAvailability();
      expect(fusionSys.arePrerequisitesMet('fusion_eco_cul_1')).toBe(true);
    });

    it('不存在的融合科技ID', () => {
      expect(fusionSys.arePrerequisitesMet('nonexistent')).toBe(false);
      expect(fusionSys.canResearch('nonexistent').can).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 对抗: 部分前置完成
  // ═══════════════════════════════════════════
  describe('对抗: 部分前置完成', () => {
    it('mil_t4_dominance 需要完整3级链路', () => {
      // 只完成Tier1
      completeTech('mil_t1_attack');
      expect(treeSys.arePrerequisitesMet('mil_t4_dominance')).toBe(false);

      // 完成Tier2
      completeTech('mil_t2_charge');
      expect(treeSys.arePrerequisitesMet('mil_t4_dominance')).toBe(false);

      // 完成Tier3
      completeTech('mil_t3_blitz');
      expect(treeSys.arePrerequisitesMet('mil_t4_dominance')).toBe(true);
    });

    it('getUnmetPrerequisites 返回正确的未完成列表', () => {
      const unmet = treeSys.getUnmetPrerequisites('mil_t2_charge');
      expect(unmet).toEqual(['mil_t1_attack']);

      completeTech('mil_t1_attack');
      const unmet2 = treeSys.getUnmetPrerequisites('mil_t2_charge');
      expect(unmet2).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════
  // 对抗: 路线独立性
  // ═══════════════════════════════════════════
  describe('对抗: 路线独立性', () => {
    it('军事路线完成不影响经济路线Tier1', () => {
      completeTech('mil_t1_attack');
      expect(treeSys.getNodeState('eco_t1_farming')?.status).toBe('available');
      expect(treeSys.getNodeState('eco_t1_trade')?.status).toBe('available');
    });

    it('经济路线完成不影响文化路线Tier1', () => {
      completeTech('eco_t1_farming');
      expect(treeSys.getNodeState('cul_t1_education')?.status).toBe('available');
      expect(treeSys.getNodeState('cul_t1_recruit')?.status).toBe('available');
    });

    it('三条路线可以各自独立推进', () => {
      grantPoints(5000);
      // 军事
      researchSys.startResearch('mil_t1_attack');
      advanceTime(200 * 1000);
      researchSys.update(0);
      // 经济
      researchSys.startResearch('eco_t1_farming');
      advanceTime(400 * 1000);
      researchSys.update(0);
      // 文化
      researchSys.startResearch('cul_t1_education');
      advanceTime(600 * 1000);
      researchSys.update(0);

      expect(treeSys.getNodeState('mil_t1_attack')?.status).toBe('completed');
      expect(treeSys.getNodeState('eco_t1_farming')?.status).toBe('completed');
      expect(treeSys.getNodeState('cul_t1_education')?.status).toBe('completed');
    });
  });
});
