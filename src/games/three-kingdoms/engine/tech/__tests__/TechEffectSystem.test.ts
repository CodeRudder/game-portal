/**
 * TechEffectSystem — 单元测试
 *
 * 覆盖：
 * - 三条科技路线效果正确计算
 * - getEffectBonus(category, stat) 查询
 * - 全局效果汇总
 * - 按 target 精确查询
 * - 乘数接口
 * - 缓存机制
 * - 快捷方法
 *
 * @module engine/tech/__tests__/TechEffectSystem.test
 */

import { TechEffectSystem } from '../TechEffectSystem';
import type { EffectCategory, EffectStat } from '../TechEffectSystem';
import { TechTreeSystem } from '../TechTreeSystem';
import type { ISystemDeps } from '../../../../core/types';

// ─────────────────────────────────────────────
// 测试工具
// ─────────────────────────────────────────────

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: jest.fn().mockReturnValue(jest.fn()),
      once: jest.fn().mockReturnValue(jest.fn()),
      emit: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn(),
    },
    config: { get: jest.fn(), set: jest.fn() },
    registry: { register: jest.fn(), get: jest.fn(), getAll: jest.fn(), has: jest.fn(), unregister: jest.fn() },
  } as unknown as ISystemDeps;
}

/** 创建已初始化的 TechEffectSystem + TechTreeSystem */
function createSystems(): { effectSys: TechEffectSystem; treeSys: TechTreeSystem } {
  const treeSys = new TechTreeSystem();
  treeSys.init(mockDeps());

  const effectSys = new TechEffectSystem();
  effectSys.init(mockDeps());
  effectSys.setTechTree(treeSys);

  return { effectSys, treeSys };
}

// ═══════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════

describe('TechEffectSystem', () => {
  let effectSys: TechEffectSystem;
  let treeSys: TechTreeSystem;

  beforeEach(() => {
    ({ effectSys, treeSys } = createSystems());
  });

  // ─────────────────────────────────────────
  // 1. 初始化 & 基础查询
  // ─────────────────────────────────────────
  describe('初始化与基础查询', () => {
    it('无科技完成时所有加成为 0', () => {
      expect(effectSys.getEffectBonus('military', 'attack')).toBe(0);
      expect(effectSys.getEffectBonus('economy', 'production')).toBe(0);
      expect(effectSys.getEffectBonus('culture', 'expBonus')).toBe(0);
    });

    it('全局加成在无科技时为 0', () => {
      expect(effectSys.getGlobalBonus('attack')).toBe(0);
      expect(effectSys.getGlobalBonus('production')).toBe(0);
    });

    it('getState 返回正确结构', () => {
      const state = effectSys.getState();
      expect(state).toHaveProperty('military');
      expect(state).toHaveProperty('economy');
      expect(state).toHaveProperty('culture');
      expect(state).toHaveProperty('global');
    });

    it('无 TechTree 时所有查询返回 0', () => {
      const standalone = new TechEffectSystem();
      standalone.init(mockDeps());
      // 不注入 TechTree
      expect(standalone.getEffectBonus('military', 'attack')).toBe(0);
      expect(standalone.getAttackBonus()).toBe(0);
    });
  });

  // ─────────────────────────────────────────
  // 2. 军事路线效果
  // ─────────────────────────────────────────
  describe('军事路线效果（#22）', () => {
    it('完成锐兵术后攻击力 +10%', () => {
      treeSys.completeNode('mil_t1_attack');
      effectSys.invalidateCache();

      const bonus = effectSys.getEffectBonus('military', 'attack');
      expect(bonus).toBe(10);
    });

    it('完成铁壁术后防御力 +10%', () => {
      treeSys.completeNode('mil_t1_defense');
      effectSys.invalidateCache();

      const bonus = effectSys.getEffectBonus('military', 'defense');
      expect(bonus).toBe(10);
    });

    it('完成冲锋术后骑兵攻击 +15%', () => {
      // 需要先完成前置
      treeSys.completeNode('mil_t1_attack');
      treeSys.completeNode('mil_t2_charge');
      effectSys.invalidateCache();

      // 全军攻击 = 10 (锐兵术)
      expect(effectSys.getAttackBonus('all')).toBe(10);
      // 骑兵攻击 = 10 (全军) + 15 (骑兵) = 25
      expect(effectSys.getAttackBonus('cavalry')).toBe(25);
    });

    it('完成闪电战后全军攻击 +20%', () => {
      treeSys.completeNode('mil_t1_attack');
      treeSys.completeNode('mil_t2_charge');
      treeSys.completeNode('mil_t3_blitz');
      effectSys.invalidateCache();

      // 全军攻击 = 10 (锐兵术) + 20 (闪电战) = 30
      expect(effectSys.getAttackBonus('all')).toBe(30);
      // 全军防御 = -5 (闪电战副作用)
      expect(effectSys.getDefenseBonus('all')).toBe(-5);
    });

    it('完成霸王之师后攻击 +25%，防御 +15%，生命 +15%', () => {
      treeSys.completeNode('mil_t1_attack');
      treeSys.completeNode('mil_t2_charge');
      treeSys.completeNode('mil_t3_blitz');
      treeSys.completeNode('mil_t4_dominance');
      effectSys.invalidateCache();

      // 全军攻击 = 10 + 20 + 25 = 55
      expect(effectSys.getAttackBonus('all')).toBe(55);
      // 全军防御 = -5 + 15 = 10
      expect(effectSys.getDefenseBonus('all')).toBe(10);
      // 全军生命 = 15
      expect(effectSys.getHpBonus('all')).toBe(15);
    });

    it('完成铜墙铁壁后防御 +25%，生命 +25%', () => {
      treeSys.completeNode('mil_t1_defense');
      treeSys.completeNode('mil_t2_fortify');
      treeSys.completeNode('mil_t3_endurance');
      treeSys.completeNode('mil_t4_fortress');
      effectSys.invalidateCache();

      // 全军防御 = 10 (铁壁术) + 10 (持久战) + 25 (铜墙铁壁) + 15 (步兵) = 60
      // 注意: 固守战术的步兵防御 +15 只对 infantry 有效
      expect(effectSys.getDefenseBonus('all')).toBe(45);
      expect(effectSys.getDefenseBonus('infantry')).toBe(60);
      // 全军生命 = 20 (持久战) + 25 (铜墙铁壁) = 45
      expect(effectSys.getHpBonus('all')).toBe(45);
    });

    it('行军速度加成正确', () => {
      treeSys.completeNode('mil_t1_attack');
      treeSys.completeNode('mil_t2_charge');
      effectSys.invalidateCache();

      expect(effectSys.getMarchSpeedBonus()).toBe(5);
    });
  });

  // ─────────────────────────────────────────
  // 3. 经济路线效果
  // ─────────────────────────────────────────
  describe('经济路线效果（#23）', () => {
    it('完成精耕细作后粮草产出 +15%', () => {
      treeSys.completeNode('eco_t1_farming');
      effectSys.invalidateCache();

      expect(effectSys.getProductionBonus('grain')).toBe(15);
    });

    it('完成商路开拓后铜钱产出 +15%', () => {
      treeSys.completeNode('eco_t1_trade');
      effectSys.invalidateCache();

      expect(effectSys.getProductionBonus('gold')).toBe(15);
    });

    it('完成水利灌溉后粮草产出 +20%，上限 +15%', () => {
      treeSys.completeNode('eco_t1_farming');
      treeSys.completeNode('eco_t2_irrigation');
      effectSys.invalidateCache();

      // 粮草产出 = 15 + 20 = 35
      expect(effectSys.getProductionBonus('grain')).toBe(35);
      // 粮草上限 = 15
      expect(effectSys.getStorageBonus('grain')).toBe(15);
    });

    it('完成天下粮仓后全资源产出 +25%，上限 +20%', () => {
      treeSys.completeNode('eco_t1_farming');
      treeSys.completeNode('eco_t2_irrigation');
      treeSys.completeNode('eco_t3_granary');
      treeSys.completeNode('eco_t4_prosperity');
      effectSys.invalidateCache();

      // 全资源产出 = 25
      expect(effectSys.getProductionBonus('all')).toBe(25);
      // 全资源上限 = 20
      expect(effectSys.getStorageBonus('all')).toBe(20);
      // 粮草产出 = 15 + 20 + 30 + 25(all) = 90
      expect(effectSys.getProductionBonus('grain')).toBe(90);
    });

    it('完成黄金时代后铜钱产出 +40%', () => {
      treeSys.completeNode('eco_t1_trade');
      treeSys.completeNode('eco_t2_minting');
      treeSys.completeNode('eco_t3_marketplace');
      treeSys.completeNode('eco_t4_golden_age');
      effectSys.invalidateCache();

      // 铜钱产出 = 15 + 20 + 30 + 10(all) + 40 + 15(all) = 130
      expect(effectSys.getProductionBonus('gold')).toBe(130);
      // 全资源产出 = 10 (大集市) + 15 (黄金时代) = 25
      expect(effectSys.getProductionBonus('all')).toBe(25);
    });

    it('经济路线 getEffectBonus 正确', () => {
      treeSys.completeNode('eco_t1_farming');
      effectSys.invalidateCache();

      expect(effectSys.getEffectBonus('economy', 'production')).toBe(15);
      expect(effectSys.getEffectBonus('economy', 'storage')).toBe(0);
    });
  });

  // ─────────────────────────────────────────
  // 4. 文化路线效果
  // ─────────────────────────────────────────
  describe('文化路线效果（#24）', () => {
    it('完成兴学令后经验 +15%', () => {
      treeSys.completeNode('cul_t1_education');
      effectSys.invalidateCache();

      expect(effectSys.getExpBonus()).toBe(15);
    });

    it('完成招贤令后招募折扣 10%', () => {
      treeSys.completeNode('cul_t1_recruit');
      effectSys.invalidateCache();

      expect(effectSys.getRecruitDiscount()).toBe(10);
    });

    it('完成书院扩建后研究速度 +15%', () => {
      treeSys.completeNode('cul_t1_education');
      treeSys.completeNode('cul_t2_academy');
      effectSys.invalidateCache();

      expect(effectSys.getResearchSpeedBonus()).toBe(15);
    });

    it('完成百家争鸣后研究速度 +25%，经验 +20%', () => {
      treeSys.completeNode('cul_t1_education');
      treeSys.completeNode('cul_t2_academy');
      treeSys.completeNode('cul_t3_scholar');
      effectSys.invalidateCache();

      expect(effectSys.getResearchSpeedBonus()).toBe(40); // 15 + 25
      expect(effectSys.getExpBonus()).toBe(35); // 15 + 20
    });

    it('完成天下归心后研究速度 +30%，经验 +10%', () => {
      treeSys.completeNode('cul_t1_education');
      treeSys.completeNode('cul_t2_academy');
      treeSys.completeNode('cul_t3_scholar');
      treeSys.completeNode('cul_t4_wisdom');
      effectSys.invalidateCache();

      // 研究速度 = 15 + 25 + 30 = 70
      expect(effectSys.getResearchSpeedBonus()).toBe(70);
      // 经验 = 15 + 20 + 10 = 45
      expect(effectSys.getExpBonus()).toBe(45);
    });

    it('完成千秋万代后招募折扣 30%，经验 +30%', () => {
      treeSys.completeNode('cul_t1_recruit');
      treeSys.completeNode('cul_t2_talent');
      treeSys.completeNode('cul_t3_general');
      treeSys.completeNode('cul_t4_legacy');
      effectSys.invalidateCache();

      // 招募折扣 = 10 + 15 + 25 + 30 = 80
      expect(effectSys.getRecruitDiscount()).toBe(80);
      // 经验 = 10 + 15 + 30 = 55
      expect(effectSys.getExpBonus()).toBe(55);
    });

    it('文化路线 getEffectBonus 正确', () => {
      treeSys.completeNode('cul_t1_education');
      effectSys.invalidateCache();

      expect(effectSys.getEffectBonus('culture', 'expBonus')).toBe(15);
      expect(effectSys.getEffectBonus('culture', 'researchSpeed')).toBe(0);
    });
  });

  // ─────────────────────────────────────────
  // 5. 全局效果 & 路线汇总
  // ─────────────────────────────────────────
  describe('全局效果与路线汇总', () => {
    it('跨路线全局加成正确', () => {
      // 完成军事和文化各一个
      treeSys.completeNode('mil_t1_attack');
      treeSys.completeNode('cul_t1_education');
      effectSys.invalidateCache();

      expect(effectSys.getGlobalBonus('attack')).toBe(10);
      expect(effectSys.getGlobalBonus('expBonus')).toBe(15);
    });

    it('getPathBonuses 返回正确结构', () => {
      treeSys.completeNode('mil_t1_attack');
      effectSys.invalidateCache();

      const bonuses = effectSys.getPathBonuses('military');
      expect(bonuses.attack).toBe(10);
    });

    it('getAllBonuses 返回三条路线', () => {
      treeSys.completeNode('mil_t1_attack');
      treeSys.completeNode('eco_t1_farming');
      treeSys.completeNode('cul_t1_education');
      effectSys.invalidateCache();

      const all = effectSys.getAllBonuses();
      expect(all.military.attack).toBe(10);
      expect(all.economy.production).toBe(15);
      expect(all.culture.expBonus).toBe(15);
    });
  });

  // ─────────────────────────────────────────
  // 6. 乘数接口
  // ─────────────────────────────────────────
  describe('乘数接口', () => {
    it('getAttackMultiplier 正确', () => {
      treeSys.completeNode('mil_t1_attack');
      effectSys.invalidateCache();

      // 1 + 10/100 = 1.1
      expect(effectSys.getAttackMultiplier()).toBeCloseTo(1.1);
    });

    it('getDefenseMultiplier 正确', () => {
      treeSys.completeNode('mil_t1_defense');
      effectSys.invalidateCache();

      expect(effectSys.getDefenseMultiplier()).toBeCloseTo(1.1);
    });

    it('getProductionMultiplier 正确', () => {
      treeSys.completeNode('eco_t1_farming');
      effectSys.invalidateCache();

      expect(effectSys.getProductionMultiplier('grain')).toBeCloseTo(1.15);
    });

    it('getExpMultiplier 正确', () => {
      treeSys.completeNode('cul_t1_education');
      effectSys.invalidateCache();

      expect(effectSys.getExpMultiplier()).toBeCloseTo(1.15);
    });

    it('getResearchSpeedMultiplier 正确', () => {
      treeSys.completeNode('cul_t1_education');
      treeSys.completeNode('cul_t2_academy');
      effectSys.invalidateCache();

      expect(effectSys.getResearchSpeedMultiplier()).toBeCloseTo(1.15);
    });

    it('无加成时乘数为 1.0', () => {
      expect(effectSys.getAttackMultiplier()).toBe(1);
      expect(effectSys.getDefenseMultiplier()).toBe(1);
      expect(effectSys.getProductionMultiplier()).toBe(1);
      expect(effectSys.getExpMultiplier()).toBe(1);
      expect(effectSys.getResearchSpeedMultiplier()).toBe(1);
    });
  });

  // ─────────────────────────────────────────
  // 7. 缓存机制
  // ─────────────────────────────────────────
  describe('缓存机制', () => {
    it('缓存失效后重新计算', () => {
      // 初始为 0
      expect(effectSys.getAttackBonus()).toBe(0);

      // 完成科技 + 失效缓存
      treeSys.completeNode('mil_t1_attack');
      effectSys.invalidateCache();

      expect(effectSys.getAttackBonus()).toBe(10);
    });

    it('不失效缓存时 getEffectBonus 返回旧值', () => {
      expect(effectSys.getEffectBonus('military', 'attack')).toBe(0);

      treeSys.completeNode('mil_t1_attack');
      // 不调用 invalidateCache

      // getEffectBonus 使用缓存，应返回旧值 0
      expect(effectSys.getEffectBonus('military', 'attack')).toBe(0);
    });

    it('reset 清除缓存', () => {
      treeSys.completeNode('mil_t1_attack');
      effectSys.invalidateCache();
      expect(effectSys.getAttackBonus()).toBe(10);

      effectSys.reset();
      // reset 后没有 TechTree，返回 0
      expect(effectSys.getAttackBonus()).toBe(0);
    });
  });

  // ─────────────────────────────────────────
  // 8. 按 target 精确查询
  // ─────────────────────────────────────────
  describe('按 target 精确查询', () => {
    it('getEffectValueByTarget 正确', () => {
      treeSys.completeNode('mil_t1_attack');
      effectSys.invalidateCache();

      // troop_attack + all = 10
      expect(effectSys.getEffectValueByTarget('troop_attack', 'all')).toBe(10);
      // troop_attack + cavalry = 0 (锐兵术是全军)
      expect(effectSys.getEffectValueByTarget('troop_attack', 'cavalry')).toBe(10);
    });

    it('兵种专属加成精确查询', () => {
      treeSys.completeNode('mil_t1_attack');
      treeSys.completeNode('mil_t2_charge');
      effectSys.invalidateCache();

      // 骑兵攻击 = 全军10 + 骑兵15 = 25
      expect(effectSys.getEffectValueByTarget('troop_attack', 'cavalry')).toBe(25);
      // 步兵攻击 = 全军10
      expect(effectSys.getEffectValueByTarget('troop_attack', 'infantry')).toBe(10);
    });
  });

  // ─────────────────────────────────────────
  // 9. ISubsystem 接口
  // ─────────────────────────────────────────
  describe('ISubsystem 接口', () => {
    it('name 正确', () => {
      expect(effectSys.name).toBe('tech-effect');
    });

    it('update 不报错', () => {
      expect(() => effectSys.update(16)).not.toThrow();
    });
  });
});
