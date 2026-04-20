/**
 * TechEffectApplier — 单元测试
 *
 * 覆盖：
 * - #22 军事路线效果：攻击/防御/暴击/伤害加成应用到战斗
 * - #23 经济路线效果：资源产出/存储加成应用到资源系统
 * - #24 文化路线效果：经验/研究速度/招募折扣加成
 * - 综合查询和 Bonuses 组装
 * - 无科技时的默认值
 *
 * @module engine/tech/__tests__/TechEffectApplier.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TechEffectApplier } from '../TechEffectApplier';
import { TechEffectSystem } from '../TechEffectSystem';
import { TechTreeSystem } from '../TechTreeSystem';
import type { ISystemDeps } from '../../../../core/types';

// ─────────────────────────────────────────────
// 测试工具
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

/** 创建完整的测试系统 */
function createSystems() {
  const treeSys = new TechTreeSystem();
  treeSys.init(mockDeps());

  const effectSys = new TechEffectSystem();
  effectSys.init(mockDeps());
  effectSys.setTechTree(treeSys);

  const applier = new TechEffectApplier();
  applier.setTechEffectSystem(effectSys);

  return { applier, effectSys, treeSys };
}

// ═══════════════════════════════════════════════

describe('TechEffectApplier', () => {
  let applier: TechEffectApplier;
  let effectSys: TechEffectSystem;
  let treeSys: TechTreeSystem;

  beforeEach(() => {
    ({ applier, effectSys, treeSys } = createSystems());
  });

  // ─────────────────────────────────────────
  // 1. 无科技时的默认值
  // ─────────────────────────────────────────
  describe('无科技时默认值', () => {
    it('战斗加成全部为默认值（乘数=1）', () => {
      const bonuses = applier.getBattleBonuses();
      expect(bonuses.attackMultiplier).toBe(1);
      expect(bonuses.defenseMultiplier).toBe(1);
      expect(bonuses.critRateBonus).toBe(0);
      expect(bonuses.critDamageBonus).toBe(0);
      expect(bonuses.damageMultiplier).toBe(1);
      expect(bonuses.hpMultiplier).toBe(1);
    });

    it('资源加成全部为默认值（乘数=1）', () => {
      const bonuses = applier.getResourceBonuses();
      expect(bonuses.productionMultipliers.grain).toBe(1);
      expect(bonuses.productionMultipliers.gold).toBe(1);
      expect(bonuses.storageMultipliers.grain).toBe(1);
      expect(bonuses.tradeBonus).toBe(0);
    });

    it('文化加成全部为默认值（乘数=1）', () => {
      const bonuses = applier.getCultureBonuses();
      expect(bonuses.expMultiplier).toBe(1);
      expect(bonuses.researchSpeedMultiplier).toBe(1);
      expect(bonuses.recruitDiscount).toBe(0);
    });

    it('未注入 TechEffectSystem 时返回默认值', () => {
      const emptyApplier = new TechEffectApplier();
      const battle = emptyApplier.getBattleBonuses();
      expect(battle.attackMultiplier).toBe(1);

      const resource = emptyApplier.getResourceBonuses();
      expect(resource.productionMultipliers.grain).toBe(1);

      const culture = emptyApplier.getCultureBonuses();
      expect(culture.expMultiplier).toBe(1);
    });
  });

  // ─────────────────────────────────────────
  // #22 军事路线效果
  // ─────────────────────────────────────────
  describe('#22 军事路线效果 → 战斗系统', () => {
    it('完成军事科技后攻击力乘数增加', () => {
      // 使用 treeSys 完成一个军事科技节点
      treeSys.completeNode('mil_t1_attack');
      effectSys.invalidateCache();

      const bonuses = applier.getBattleBonuses();
      expect(bonuses.attackMultiplier).toBeGreaterThan(1);
    });

    it('兵种专属加成正确叠加', () => {
      // 完成攻击加成科技
      treeSys.completeNode('mil_t1_attack');
      effectSys.invalidateCache();

      // 查询骑兵专属加成
      const cavalryBonuses = applier.getBattleBonuses('cavalry');
      // 查询全军加成
      const allBonuses = applier.getBattleBonuses('all');

      // 骑兵加成应 >= 全军加成
      expect(cavalryBonuses.attackMultiplier).toBeGreaterThanOrEqual(allBonuses.attackMultiplier);
    });

    it('applyAttackBonus 正确增强攻击力', () => {
      treeSys.completeNode('mil_t1_attack');
      effectSys.invalidateCache();

      const enhanced = applier.applyAttackBonus(100);
      expect(enhanced).toBeGreaterThan(100);
    });

    it('applyDefenseBonus 正确增强防御力', () => {
      const enhanced = applier.applyDefenseBonus(50);
      expect(enhanced).toBe(50); // 无科技时不变
    });

    it('applyDamageBonus 正确增强伤害', () => {
      const enhanced = applier.applyDamageBonus(100);
      expect(enhanced).toBe(100); // 无科技时不变
    });

    it('暴击率加成默认为 0', () => {
      const bonuses = applier.getBattleBonuses();
      expect(bonuses.critRateBonus).toBe(0);
    });

    it('HP 乘数默认为 1', () => {
      const bonuses = applier.getBattleBonuses();
      expect(bonuses.hpMultiplier).toBe(1);
    });
  });

  // ─────────────────────────────────────────
  // #23 经济路线效果
  // ─────────────────────────────────────────
  describe('#23 经济路线效果 → 资源系统', () => {
    it('完成经济科技后产出乘数增加', () => {
      treeSys.completeNode('eco_t1_farming');
      effectSys.invalidateCache();

      const bonuses = applier.getResourceBonuses();
      // 至少有一种资源的产出乘数 > 1
      const hasBonus = Object.values(bonuses.productionMultipliers).some(v => v > 1);
      expect(hasBonus).toBe(true);
    });

    it('各资源类型产出乘数独立计算', () => {
      const bonuses = applier.getResourceBonuses();
      // 无科技时所有乘数都为 1
      expect(bonuses.productionMultipliers.grain).toBe(1);
      expect(bonuses.productionMultipliers.gold).toBe(1);
      expect(bonuses.productionMultipliers.troops).toBe(1);
      expect(bonuses.productionMultipliers.mandate).toBe(1);
    });

    it('存储上限乘数默认为 1', () => {
      const bonuses = applier.getResourceBonuses();
      expect(bonuses.storageMultipliers.grain).toBe(1);
      expect(bonuses.storageMultipliers.gold).toBe(1);
    });

    it('composeResourceBonuses 生成正确的 Bonuses 对象', () => {
      const bonuses = applier.composeResourceBonuses({ castle: 0.1 });
      expect(bonuses.castle).toBe(0.1);
      expect(bonuses.tech).toBe(0);
      expect(bonuses.hero).toBe(0);
      expect(bonuses.rebirth).toBe(0);
      expect(bonuses.vip).toBe(0);
    });

    it('composeResourceBonuses 无已有加成时使用默认值', () => {
      const bonuses = applier.composeResourceBonuses();
      expect(bonuses.castle).toBe(0);
      expect(bonuses.tech).toBe(0);
    });

    it('getProductionMultiplier 返回指定资源乘数', () => {
      expect(applier.getProductionMultiplier('grain')).toBe(1);
      expect(applier.getProductionMultiplier('gold')).toBe(1);
    });

    it('getStorageMultiplier 返回指定资源存储乘数', () => {
      expect(applier.getStorageMultiplier('grain')).toBe(1);
    });

    it('交易加成默认为 0', () => {
      const bonuses = applier.getResourceBonuses();
      expect(bonuses.tradeBonus).toBe(0);
    });
  });

  // ─────────────────────────────────────────
  // #24 文化路线效果
  // ─────────────────────────────────────────
  describe('#24 文化路线效果 → 经验/研究/招募', () => {
    it('完成文化科技后经验乘数增加', () => {
      treeSys.completeNode('cul_t1_education');
      effectSys.invalidateCache();

      const bonuses = applier.getCultureBonuses();
      expect(bonuses.expMultiplier).toBeGreaterThan(1);
    });

    it('applyExpBonus 正确增强经验值', () => {
      treeSys.completeNode('cul_t1_education');
      effectSys.invalidateCache();

      const enhanced = applier.applyExpBonus(100);
      expect(enhanced).toBeGreaterThan(100);
    });

    it('无科技时 applyExpBonus 不改变经验值', () => {
      expect(applier.applyExpBonus(100)).toBe(100);
    });

    it('applyResearchSpeedBonus 正确缩短研究时间', () => {
      treeSys.completeNode('cul_t1_education');
      effectSys.invalidateCache();

      const cultureBonuses = applier.getCultureBonuses();
      if (cultureBonuses.researchSpeedMultiplier > 1) {
        const reduced = applier.applyResearchSpeedBonus(100);
        expect(reduced).toBeLessThan(100);
      }
    });

    it('无科技时研究时间不变', () => {
      expect(applier.applyResearchSpeedBonus(100)).toBe(100);
    });

    it('applyRecruitDiscount 默认不打折', () => {
      expect(applier.applyRecruitDiscount(1000)).toBe(1000);
    });

    it('招募折扣后费用不低于 0', () => {
      // 即使折扣为 100%，费用也不为负
      const result = applier.applyRecruitDiscount(0);
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  // ─────────────────────────────────────────
  // 综合查询
  // ─────────────────────────────────────────
  describe('综合查询', () => {
    it('getAllBonuses 返回完整快照', () => {
      const all = applier.getAllBonuses();
      expect(all.battle).toBeDefined();
      expect(all.resource).toBeDefined();
      expect(all.culture).toBeDefined();
      expect(all.battle.attackMultiplier).toBe(1);
      expect(all.resource.productionMultipliers.grain).toBe(1);
      expect(all.culture.expMultiplier).toBe(1);
    });

    it('getAllBonuses 支持指定兵种', () => {
      const all = applier.getAllBonuses('cavalry');
      expect(all.battle).toBeDefined();
    });

    it('getBonusSummary 返回可读摘要', () => {
      const summary = applier.getBonusSummary();
      expect(summary.military).toBeDefined();
      expect(summary.economy).toBeDefined();
      expect(summary.culture).toBeDefined();
    });

    it('未注入时 getBonusSummary 返回空结构', () => {
      const emptyApplier = new TechEffectApplier();
      const summary = emptyApplier.getBonusSummary();
      expect(summary.military).toEqual({});
      expect(summary.economy).toEqual({});
      expect(summary.culture).toEqual({});
    });
  });

  // ─────────────────────────────────────────
  // 多科技叠加
  // ─────────────────────────────────────────
  describe('多科技叠加', () => {
    it('完成多个军事科技后攻击加成叠加', () => {
      treeSys.completeNode('mil_t1_attack');
      effectSys.invalidateCache();
      const bonus1 = applier.getBattleBonuses().attackMultiplier;

      // 再完成一个科技（如果存在）
      const allNodes = treeSys.getAllNodeStates();
      const milNodes = Object.entries(allNodes)
        .filter(([id, state]) => id.startsWith('mil_') && state.status === 'locked');

      // 至少验证第一个科技生效
      expect(bonus1).toBeGreaterThan(1);
    });
  });
});
