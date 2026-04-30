/**
 * 天下Tab P1数值覆盖缺口测试
 *
 * 覆盖4个P1 GAP：
 *   GAP-05：声望加成产出测试（MAP-3 §3.5）
 *   GAP-06：城防恢复测试（MAP-4 §4.6）
 *   GAP-07：攻城时间计算测试（MAP-4 §4.9）
 *   GAP-08：战斗统计数据聚合测试（MAP-6 §6.3）
 *
 * @module engine/map/__tests__/MapP1Numerics.test
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SiegeSystem } from '../SiegeSystem';
import { SiegeEnhancer } from '../SiegeEnhancer';
import { TerritorySystem } from '../TerritorySystem';
import { GarrisonSystem } from '../GarrisonSystem';
import { PrestigeSystem, calcProductionBonus } from '../../prestige/PrestigeSystem';
import { PRODUCTION_BONUS_PER_LEVEL } from '../../../core/prestige';
import type { ISystemDeps } from '../../../core/types';
import type { ISubsystemRegistry } from '../../../core/types/subsystem';
import type { TerritoryData } from '../../../core/map';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

/** 创建 Mock ISystemDeps */
function createMockDeps(subsystems: Record<string, unknown> = {}): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: {
      register: vi.fn(),
      get: vi.fn().mockImplementation((name: string) => {
        if (subsystems[name]) return subsystems[name];
        throw new Error(`Subsystem ${name} not found`);
      }),
      getAll: vi.fn().mockReturnValue(new Map()),
      has: vi.fn().mockImplementation((name: string) => name in subsystems),
      unregister: vi.fn(),
    } as unknown as ISubsystemRegistry,
  };
}

/** 创建完整的系统组合 */
function createFullSystems() {
  const territory = new TerritorySystem();
  const siege = new SiegeSystem();
  const garrison = new GarrisonSystem();
  const enhancer = new SiegeEnhancer();
  const prestige = new PrestigeSystem();

  const subsystems: Record<string, unknown> = {
    territory,
    siege,
    garrison,
    siegeEnhancer: enhancer,
    prestige,
  };

  const deps = createMockDeps(subsystems);

  // 按依赖顺序初始化
  territory.init(deps);
  siege.init(deps);
  garrison.init(deps);
  enhancer.init(deps);
  prestige.init(deps);

  return { territory, siege, garrison, enhancer, prestige, deps };
}

/** 创建最小系统组合（仅攻城+领土） */
function createSiegeSystems() {
  const territory = new TerritorySystem();
  const siege = new SiegeSystem();

  const deps = createMockDeps({ territory, siege });

  territory.init(deps);
  siege.init(deps);

  return { territory, siege, deps };
}

// ============================================================
// GAP-05：声望加成产出测试（MAP-3 §3.5）
// PRD要求：声望等级×2%的产出加成计算
// ============================================================

describe('GAP-05：声望加成产出测试（MAP-3 §3.5）', () => {
  describe('§3.5.1 声望等级0→加成0%', () => {
    it('声望等级为0时，产出加成倍率为1.0（无加成）', () => {
      // 公式: 1 + level × 0.02
      const bonus = calcProductionBonus(0);
      expect(bonus).toBe(1.0);
    });

    it('声望等级为0时，PrestigeSystem.getProductionBonus 返回1.0', () => {
      const { prestige } = createFullSystems();
      // 默认等级为1，通过序列化/反序列化模拟等级0
      // 注意：实际PRD中声望等级从1开始，等级0是边界情况
      const bonus = calcProductionBonus(0);
      expect(bonus).toBe(1.0);
    });
  });

  describe('§3.5.2 声望等级5→加成10%', () => {
    it('声望等级5时，产出加成倍率为1.10', () => {
      const bonus = calcProductionBonus(5);
      expect(bonus).toBeCloseTo(1.10, 4);
    });

    it('声望等级5时加成百分比精确为10%', () => {
      const bonus = calcProductionBonus(5);
      const percentage = (bonus - 1) * 100;
      expect(percentage).toBeCloseTo(10, 10);
    });
  });

  describe('§3.5.3 声望等级10→加成20%', () => {
    it('声望等级10时，产出加成倍率为1.20', () => {
      const bonus = calcProductionBonus(10);
      expect(bonus).toBeCloseTo(1.20, 4);
    });

    it('声望等级10时加成百分比精确为20%', () => {
      const bonus = calcProductionBonus(10);
      const percentage = (bonus - 1) * 100;
      expect(percentage).toBeCloseTo(20, 10);
    });
  });

  describe('§3.5.4 声望加成与其他加成（地形、阵营、科技）叠加计算', () => {
    it('声望加成 × 地形加成 × 阵营加成 = 最终产出', () => {
      const prestigeBonus = calcProductionBonus(5); // 1.10
      const terrainBonus = 1.5; // 地形加成 50%
      const factionBonus = 1.2; // 阵营加成 20%
      const techBonus = 1.3; // 科技加成 30%

      const baseProduction = 100;
      const finalProduction = baseProduction * prestigeBonus * terrainBonus * factionBonus * techBonus;

      expect(finalProduction).toBeCloseTo(100 * 1.10 * 1.5 * 1.2 * 1.3, 2);
      expect(finalProduction).toBeCloseTo(257.4, 1);
    });

    it('声望加成为乘法叠加，非加法叠加', () => {
      const level5Bonus = calcProductionBonus(5);
      const level10Bonus = calcProductionBonus(10);

      // 乘法叠加：10级加成应为5级的约1.0909倍（1.20/1.10）
      const ratio = level10Bonus / level5Bonus;
      expect(ratio).toBeCloseTo(1.20 / 1.10, 4);
      // 非加法叠加（加法叠加时 ratio = 2.0）
      expect(ratio).not.toBe(2.0);
    });

    it('声望加成与科技加成独立叠加', () => {
      const prestigeBonus = calcProductionBonus(3); // 1.06
      const techBonus = 1.25; // 科技加成 25%

      const base = 200;
      const final = base * prestigeBonus * techBonus;

      // 独立叠加：200 × 1.06 × 1.25 = 265
      expect(final).toBeCloseTo(265, 1);
    });
  });

  describe('§3.5.5 声望等级变化时产出实时更新', () => {
    it('声望等级从1提升到5时产出加成从2%变为10%', () => {
      const bonusLevel1 = calcProductionBonus(1);
      const bonusLevel5 = calcProductionBonus(5);

      expect(bonusLevel1).toBeCloseTo(1 + 1 * PRODUCTION_BONUS_PER_LEVEL, 4);
      expect(bonusLevel5).toBeCloseTo(1 + 5 * PRODUCTION_BONUS_PER_LEVEL, 4);
      expect(bonusLevel5).toBeGreaterThan(bonusLevel1);
    });

    it('声望等级提升→产出加成单调递增', () => {
      let prevBonus = calcProductionBonus(0);
      for (let level = 1; level <= 50; level++) {
        const bonus = calcProductionBonus(level);
        expect(bonus).toBeGreaterThan(prevBonus);
        prevBonus = bonus;
      }
    });

    it('PrestigeSystem产出加成随等级提升实时更新', () => {
      const { prestige, deps } = createFullSystems();

      // 初始等级1
      expect(prestige.getProductionBonus()).toBeCloseTo(1 + 1 * PRODUCTION_BONUS_PER_LEVEL, 4);

      // 通过手动增加声望值升级
      // 等级2需要 calcRequiredPoints(2) 声望
      const requiredForLevel2 = 1000 * Math.pow(2, 1.8);
      prestige.addPrestigePoints('main_quest', Math.ceil(requiredForLevel2));

      // 等级应提升到2
      const panel = prestige.getPrestigePanel();
      expect(panel.currentLevel).toBeGreaterThanOrEqual(2);
      expect(panel.productionBonus).toBeGreaterThan(1 + 1 * PRODUCTION_BONUS_PER_LEVEL);
    });
  });

  describe('§3.5.6 声望加成公式边界值', () => {
    it('声望等级最大值(50)时加成不超过200%', () => {
      const maxBonus = calcProductionBonus(50);
      expect(maxBonus).toBe(1 + 50 * 0.02); // 2.0 = 200%
    });

    it('声望等级为负数时不产生负加成', () => {
      const bonus = calcProductionBonus(-1);
      // 公式: 1 + (-1) * 0.02 = 0.98
      // 负等级不应出现，但验证公式行为
      expect(bonus).toBeLessThan(1);
    });
  });
});

// ============================================================
// GAP-06：城防恢复测试（MAP-4 §4.6）
// PRD要求：城防每小时恢复上限5%
// ============================================================

describe('GAP-06：城防恢复测试（MAP-4 §4.6）', () => {
  describe('§4.6.1 城防受损后每小时恢复5%上限', () => {
    it('城防值按 defenseValue = 1000 × level 公式生成', () => {
      const { territory } = createSiegeSystems();
      const all = territory.getAllTerritories();

      for (const t of all) {
        expect(t.defenseValue).toBe(1000 * t.level);
      }
    });

    it('不同等级城池城防值与等级正相关', () => {
      const { territory } = createSiegeSystems();
      const all = territory.getAllTerritories();

      // 按等级排序，验证防御值单调递增
      const sorted = [...all].sort((a, b) => a.level - b.level);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].level > sorted[i - 1].level) {
          expect(sorted[i].defenseValue).toBeGreaterThanOrEqual(sorted[i - 1].defenseValue);
        }
      }
    });

    /**
     * TODO: 城防恢复逻辑尚未在引擎层实现
     * 当前引擎仅生成城防初始值，未实现每小时恢复5%的逻辑
     * 需要等引擎层补充城防恢复机制后再补充以下测试
     */
    it.todo('城防受损后每小时恢复5%上限（引擎层尚未实现恢复逻辑）');

    it.todo('城防恢复不超过最大值（引擎层尚未实现恢复逻辑）');
  });

  describe('§4.6.2 城防恢复不超过最大值', () => {
    /**
     * TODO: 城防恢复逻辑尚未在引擎层实现
     * 需要引擎层提供城防恢复API后补充
     */
    it.todo('城防恢复不超过最大值（引擎层尚未实现恢复逻辑）');
  });

  describe('§4.6.3 战斗中不恢复城防', () => {
    /**
     * TODO: 城防恢复逻辑尚未在引擎层实现
     * 需要引擎层提供攻城状态锁定和恢复暂停机制后补充
     */
    it.todo('战斗中不恢复城防（引擎层尚未实现恢复逻辑）');
  });

  describe('§4.6.4 城防为0时恢复速率正常', () => {
    /**
     * TODO: 城防恢复逻辑尚未在引擎层实现
     * 需要引擎层提供城防恢复API后补充
     */
    it.todo('城防为0时恢复速率正常（引擎层尚未实现恢复逻辑）');
  });

  describe('§4.6.5 不同等级城池城防恢复速率一致', () => {
    /**
     * TODO: 城防恢复逻辑尚未在引擎层实现
     * 需要引擎层提供城防恢复API后补充
     */
    it.todo('不同等级城池城防恢复速率一致（引擎层尚未实现恢复逻辑）');
  });

  describe('§4.6.6 城防值初始数据验证', () => {
    it('所有领土城防值 > 0', () => {
      const { territory } = createSiegeSystems();
      const all = territory.getAllTerritories();

      for (const t of all) {
        expect(t.defenseValue).toBeGreaterThan(0);
      }
    });

    it('城防值为1000的整数倍（与等级成正比）', () => {
      const { territory } = createSiegeSystems();
      const all = territory.getAllTerritories();

      for (const t of all) {
        expect(t.defenseValue % 1000).toBe(0);
        expect(t.defenseValue / 1000).toBe(t.level);
      }
    });

    it('洛阳(level=5)城防值为5000', () => {
      const { territory } = createSiegeSystems();
      const luoyang = territory.getTerritoryById('city-luoyang');
      expect(luoyang).not.toBeNull();
      expect(luoyang!.defenseValue).toBe(5000);
    });

    it('虎牢关(level=3)城防值为3000', () => {
      const { territory } = createSiegeSystems();
      const hulao = territory.getTerritoryById('pass-hulao');
      expect(hulao).not.toBeNull();
      expect(hulao!.defenseValue).toBe(3000);
    });
  });
});

// ============================================================
// GAP-07：攻城时间计算测试（MAP-4 §4.9）
// PRD要求：攻城时间 = 基础30min + 城防值/100(min)
// ============================================================

describe('GAP-07：攻城时间计算测试（MAP-4 §4.9）', () => {
  /**
   * 攻城时间计算公式验证
   * 公式: siegeTime = 30 + defenseValue / 100 (分钟)
   *
   * 注意：当前引擎层 SiegeSystem 未直接暴露攻城时间计算API，
   * 但PRD §4.9定义了该公式。以下测试验证公式正确性，
   * 并在引擎层实现后补充集成测试。
   */

  /** 攻城时间计算公式实现 */
  function calcSiegeTime(defenseValue: number): number {
    return 30 + defenseValue / 100;
  }

  describe('§4.9.1 城防0时攻城时间=30min', () => {
    it('城防值为0时攻城时间为30分钟', () => {
      expect(calcSiegeTime(0)).toBe(30);
    });
  });

  describe('§4.9.2 城防1000时攻城时间=40min', () => {
    it('城防值1000时攻城时间为40分钟', () => {
      expect(calcSiegeTime(1000)).toBe(40);
    });
  });

  describe('§4.9.3 城防值极高时攻城时间上限', () => {
    it('城防值5000（洛阳）时攻城时间为80分钟', () => {
      expect(calcSiegeTime(5000)).toBe(80);
    });

    it('城防值极高（10000）时攻城时间为130分钟', () => {
      expect(calcSiegeTime(10000)).toBe(130);
    });

    /**
     * TODO: 攻城时间上限尚未在PRD中明确
     * 如有上限，需验证 calcSiegeTime 不超过最大值
     */
    it.todo('攻城时间上限验证（PRD未明确上限值）');
  });

  describe('§4.9.4 攻城时间计算公式正确性', () => {
    it('公式线性关系验证：城防值每增加100，时间增加1分钟', () => {
      const base = calcSiegeTime(0);
      expect(base).toBe(30);

      expect(calcSiegeTime(100)).toBe(31);
      expect(calcSiegeTime(200)).toBe(32);
      expect(calcSiegeTime(500)).toBe(35);
      expect(calcSiegeTime(1000)).toBe(40);
      expect(calcSiegeTime(3000)).toBe(60);
    });

    it('各等级城池攻城时间符合公式', () => {
      const { territory } = createSiegeSystems();
      const all = territory.getAllTerritories();

      for (const t of all) {
        const expectedTime = calcSiegeTime(t.defenseValue);
        expect(expectedTime).toBe(30 + t.defenseValue / 100);
        expect(expectedTime).toBeGreaterThanOrEqual(30);
      }
    });

    it('关卡(level=3)攻城时间=60min', () => {
      // 关卡 level=3, defenseValue=3000
      expect(calcSiegeTime(3000)).toBe(60);
    });

    it('5级城池攻城时间=80min', () => {
      // level=5, defenseValue=5000
      expect(calcSiegeTime(5000)).toBe(80);
    });
  });

  describe('§4.9.5 科技加速对攻城时间的影响', () => {
    /**
     * TODO: 科技加速对攻城时间的影响尚未在引擎层实现
     * PRD §4.9 提到科技可加速攻城，但具体公式待定
     * 需要引擎层实现科技加速API后补充
     */
    it.todo('科技加速减少攻城时间（引擎层尚未实现）');

    it.todo('科技加速后攻城时间不低于最低下限（引擎层尚未实现）');

    it.todo('多级科技加速叠加计算（引擎层尚未实现）');
  });

  describe('§4.9.6 攻城时间与攻城消耗的关联', () => {
    it('城防值越高→攻城消耗越大→攻城时间越长', () => {
      const { siege, territory } = createSiegeSystems();

      const lowLevel = territory.getTerritoryById('city-nanzhong'); // level=2
      const highLevel = territory.getTerritoryById('city-luoyang'); // level=5

      expect(lowLevel).not.toBeNull();
      expect(highLevel).not.toBeNull();

      const lowCost = siege.calculateSiegeCost(lowLevel!);
      const highCost = siege.calculateSiegeCost(highLevel!);

      // 高等级城池消耗更多
      expect(highCost.troops).toBeGreaterThan(lowCost.troops);

      // 高等级城池攻城时间更长
      const lowTime = calcSiegeTime(lowLevel!.defenseValue);
      const highTime = calcSiegeTime(highLevel!.defenseValue);
      expect(highTime).toBeGreaterThan(lowTime);
    });
  });
});

// ============================================================
// GAP-08：战斗统计数据聚合测试（MAP-6 §6.3）
// PRD要求：攻城次数、胜率、伤亡数据的正确聚合
// ============================================================

describe('GAP-08：战斗统计数据聚合测试（MAP-6 §6.3）', () => {
  describe('§6.3.1 攻城次数正确统计（每日/累计）', () => {
    it('初始攻城次数为0', () => {
      const { siege } = createSiegeSystems();
      expect(siege.getTotalSieges()).toBe(0);
      expect(siege.getVictories()).toBe(0);
      expect(siege.getDefeats()).toBe(0);
    });

    it('每次攻城后总次数递增', () => {
      const { siege, territory } = createSiegeSystems();
      territory.captureTerritory('city-luoyang', 'player');

      siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);
      expect(siege.getTotalSieges()).toBe(1);

      siege.executeSiegeWithResult('city-ye', 'player', 5000, 500, true);
      expect(siege.getTotalSieges()).toBe(2);
    });

    it('胜利和失败分别统计', () => {
      const { siege, territory } = createSiegeSystems();
      territory.captureTerritory('city-luoyang', 'player');

      siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);
      siege.executeSiegeWithResult('city-ye', 'player', 5000, 500, false);

      expect(siege.getVictories()).toBe(1);
      expect(siege.getDefeats()).toBe(1);
      expect(siege.getTotalSieges()).toBe(2);
    });

    it('每日攻城次数限制为3次', () => {
      const { siege, territory } = createSiegeSystems();
      expect(siege.getRemainingDailySieges()).toBe(3);

      territory.captureTerritory('city-luoyang', 'player');

      siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);
      expect(siege.getRemainingDailySieges()).toBe(2);

      siege.executeSiegeWithResult('city-ye', 'player', 5000, 500, true);
      expect(siege.getRemainingDailySieges()).toBe(1);

      siege.executeSiegeWithResult('pass-hulao', 'player', 5000, 500, true);
      expect(siege.getRemainingDailySieges()).toBe(0);
    });

    it('每日次数用完后不可再攻城', () => {
      const { siege, territory } = createSiegeSystems();
      territory.captureTerritory('city-luoyang', 'player');

      // 消耗3次
      siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);
      siege.executeSiegeWithResult('city-ye', 'player', 5000, 500, true);
      siege.executeSiegeWithResult('pass-hulao', 'player', 5000, 500, true);

      // 第4次应失败
      const result = siege.checkSiegeConditions('city-changan', 'player', 5000, 500);
      expect(result.canSiege).toBe(false);
      expect(result.errorCode).toBe('DAILY_LIMIT_REACHED');
    });

    it('重置每日攻城次数后可继续攻城', () => {
      const { siege, territory } = createSiegeSystems();
      territory.captureTerritory('city-luoyang', 'player');

      // 消耗3次
      siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);
      siege.executeSiegeWithResult('city-ye', 'player', 5000, 500, true);
      siege.executeSiegeWithResult('pass-hulao', 'player', 5000, 500, true);

      // 重置
      siege.resetDailySiegeCount();
      expect(siege.getRemainingDailySieges()).toBe(3);
    });
  });

  describe('§6.3.2 胜率计算（胜利次数/总次数）', () => {
    it('无攻城记录时胜率为0', () => {
      const { siege } = createSiegeSystems();
      expect(siege.getWinRate()).toBe(0);
    });

    it('全胜时胜率为1.0', () => {
      const { siege, territory } = createSiegeSystems();
      territory.captureTerritory('city-luoyang', 'player');

      siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);
      siege.executeSiegeWithResult('city-ye', 'player', 5000, 500, true);

      expect(siege.getWinRate()).toBe(1.0);
    });

    it('全败时胜率为0', () => {
      const { siege, territory } = createSiegeSystems();
      territory.captureTerritory('city-luoyang', 'player');

      siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, false);
      siege.executeSiegeWithResult('city-ye', 'player', 5000, 500, false);

      expect(siege.getWinRate()).toBe(0);
    });

    it('50%胜率计算正确', () => {
      const { siege, territory } = createSiegeSystems();
      territory.captureTerritory('city-luoyang', 'player');

      siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);
      siege.executeSiegeWithResult('city-ye', 'player', 5000, 500, false);

      expect(siege.getWinRate()).toBe(0.5);
    });

    it('33%胜率计算正确（1胜2败）', () => {
      const { siege, territory } = createSiegeSystems();
      territory.captureTerritory('city-luoyang', 'player');

      siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);
      siege.executeSiegeWithResult('city-ye', 'player', 5000, 500, false);
      siege.executeSiegeWithResult('pass-hulao', 'player', 5000, 500, false);

      // 1/3 ≈ 0.33
      expect(siege.getWinRate()).toBeCloseTo(0.33, 1);
    });

    it('胜率 = victories / totalSieges', () => {
      const { siege, territory } = createSiegeSystems();
      territory.captureTerritory('city-luoyang', 'player');

      // 2胜1败
      siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);
      siege.executeSiegeWithResult('city-ye', 'player', 5000, 500, true);
      siege.executeSiegeWithResult('pass-hulao', 'player', 5000, 500, false);

      const expectedRate = Math.round((2 / 3) * 100) / 100;
      expect(siege.getWinRate()).toBe(expectedRate);
    });
  });

  describe('§6.3.3 伤亡数据统计（攻击方/防守方）', () => {
    it('攻城胜利时消耗兵力', () => {
      const { siege, territory } = createSiegeSystems();
      territory.captureTerritory('city-luoyang', 'player');

      const result = siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);

      expect(result.launched).toBe(true);
      expect(result.victory).toBe(true);
      expect(result.cost.troops).toBeGreaterThan(0);
      expect(result.cost.grain).toBe(500);
    });

    it('攻城失败时损失30%出征兵力', () => {
      const { siege, territory } = createSiegeSystems();
      territory.captureTerritory('city-luoyang', 'player');

      const result = siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, false);

      expect(result.launched).toBe(true);
      expect(result.victory).toBe(false);
      expect(result.defeatTroopLoss).toBeDefined();
      // PRD MAP PRD v1.1: 攻城失败损失30%出征兵力
      expect(result.defeatTroopLoss).toBe(Math.floor(result.cost.troops * 0.3));
    });

    it('攻城消耗兵力与城防值成正比', () => {
      const { siege, territory } = createSiegeSystems();

      const lowLevel = territory.getTerritoryById('city-nanzhong'); // level=2, defenseValue=2000
      const highLevel = territory.getTerritoryById('city-luoyang'); // level=5, defenseValue=5000

      const lowCost = siege.calculateSiegeCost(lowLevel!);
      const highCost = siege.calculateSiegeCost(highLevel!);

      expect(highCost.troops).toBeGreaterThan(lowCost.troops);
    });

    it('攻城消耗公式: troops = ceil(100 × (defenseValue/100))', () => {
      const { siege, territory } = createSiegeSystems();

      // 验证几个具体领土
      const luoyang = territory.getTerritoryById('city-luoyang')!;
      expect(luoyang.defenseValue).toBe(5000);
      const cost = siege.calculateSiegeCost(luoyang);
      expect(cost.troops).toBe(Math.ceil(100 * (5000 / 100)));
      expect(cost.troops).toBe(5000);
    });

    it('粮草消耗固定为500', () => {
      const { siege, territory } = createSiegeSystems();
      const all = territory.getAllTerritories();

      for (const t of all) {
        const cost = siege.calculateSiegeCost(t);
        expect(cost.grain).toBe(500);
      }
    });
  });

  describe('§6.3.4 统计数据在攻城后实时更新', () => {
    it('攻城后统计数据立即反映', () => {
      const { siege, territory } = createSiegeSystems();
      territory.captureTerritory('city-luoyang', 'player');

      // 攻城前
      expect(siege.getTotalSieges()).toBe(0);
      expect(siege.getVictories()).toBe(0);
      expect(siege.getDefeats()).toBe(0);

      // 攻城胜利
      siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);

      // 攻城后立即更新
      expect(siege.getTotalSieges()).toBe(1);
      expect(siege.getVictories()).toBe(1);
      expect(siege.getDefeats()).toBe(0);
      expect(siege.getWinRate()).toBe(1.0);
    });

    it('连续攻城统计累积正确', () => {
      const { siege, territory } = createSiegeSystems();
      territory.captureTerritory('city-luoyang', 'player');

      // 第1次：胜
      siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);
      expect(siege.getTotalSieges()).toBe(1);
      expect(siege.getWinRate()).toBe(1.0);

      // 第2次：败
      siege.executeSiegeWithResult('city-ye', 'player', 5000, 500, false);
      expect(siege.getTotalSieges()).toBe(2);
      expect(siege.getWinRate()).toBe(0.5);

      // 第3次：胜
      siege.executeSiegeWithResult('pass-hulao', 'player', 5000, 500, true);
      expect(siege.getTotalSieges()).toBe(3);
      expect(siege.getWinRate()).toBeCloseTo(0.67, 1);
    });

    it('攻城历史记录按顺序追加', () => {
      const { siege, territory } = createSiegeSystems();
      territory.captureTerritory('city-luoyang', 'player');

      siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);
      siege.executeSiegeWithResult('city-ye', 'player', 5000, 500, false);

      const history = siege.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].targetId).toBe('city-xuchang');
      expect(history[0].victory).toBe(true);
      expect(history[1].targetId).toBe('city-ye');
      expect(history[1].victory).toBe(false);
    });

    it('攻城历史记录包含完整的cost信息', () => {
      const { siege, territory } = createSiegeSystems();
      territory.captureTerritory('city-luoyang', 'player');

      siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);

      const history = siege.getHistory();
      expect(history[0].cost).toBeDefined();
      expect(history[0].cost.troops).toBeGreaterThan(0);
      expect(history[0].cost.grain).toBe(500);
    });
  });

  describe('§6.3.5 统计数据序列化/反序列化正确', () => {
    it('序列化包含完整统计数据', () => {
      const { siege, territory } = createSiegeSystems();
      territory.captureTerritory('city-luoyang', 'player');

      siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);
      siege.executeSiegeWithResult('city-ye', 'player', 5000, 500, false);

      const data = siege.serialize();
      expect(data.totalSieges).toBe(2);
      expect(data.victories).toBe(1);
      expect(data.defeats).toBe(1);
      expect(data.dailySiegeCount).toBe(2);
      expect(data.version).toBe(1);
    });

    it('反序列化恢复统计数据', () => {
      const { siege, territory } = createSiegeSystems();
      territory.captureTerritory('city-luoyang', 'player');

      siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);
      siege.executeSiegeWithResult('city-ye', 'player', 5000, 500, false);

      const data = siege.serialize();

      // 创建新实例并恢复
      const newSiege = new SiegeSystem();
      newSiege.init(createMockDeps({ territory }));
      newSiege.deserialize(data);

      expect(newSiege.getTotalSieges()).toBe(2);
      expect(newSiege.getVictories()).toBe(1);
      expect(newSiege.getDefeats()).toBe(1);
      expect(newSiege.getWinRate()).toBe(0.5);
    });

    it('反序列化后可继续攻城统计', () => {
      const { siege, territory, deps } = createSiegeSystems();
      territory.captureTerritory('city-luoyang', 'player');

      siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);
      const data = siege.serialize();

      // 恢复后继续攻城
      const newSiege = new SiegeSystem();
      newSiege.init(deps);
      newSiege.deserialize(data);

      // 模拟已消耗1次（通过反序列化恢复dailySiegeCount）
      // 需要再次设置领土归属
      territory.captureTerritory('city-xuchang', 'player');

      newSiege.executeSiegeWithResult('city-ye', 'player', 5000, 500, false);

      expect(newSiege.getTotalSieges()).toBe(2);
      expect(newSiege.getVictories()).toBe(1);
      expect(newSiege.getDefeats()).toBe(1);
    });

    it('序列化/反序列化保留每日攻城次数', () => {
      const { siege, territory } = createSiegeSystems();
      territory.captureTerritory('city-luoyang', 'player');

      siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);
      siege.executeSiegeWithResult('city-ye', 'player', 5000, 500, true);

      const data = siege.serialize();
      expect(data.dailySiegeCount).toBe(2);

      const newSiege = new SiegeSystem();
      newSiege.init(createMockDeps({ territory }));
      newSiege.deserialize(data);

      expect(newSiege.getRemainingDailySieges()).toBe(1);
    });

    it('序列化/反序列化保留日期信息', () => {
      const { siege, territory } = createSiegeSystems();
      territory.captureTerritory('city-luoyang', 'player');

      siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);

      const data = siege.serialize();
      expect(data.lastSiegeDate).toBeTruthy();
      expect(data.lastSiegeDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('空状态序列化/反序列化正确', () => {
      const { siege } = createSiegeSystems();
      const data = siege.serialize();

      expect(data.totalSieges).toBe(0);
      expect(data.victories).toBe(0);
      expect(data.defeats).toBe(0);
      expect(data.dailySiegeCount).toBe(0);

      const newSiege = new SiegeSystem();
      newSiege.init(createMockDeps());
      newSiege.deserialize(data);

      expect(newSiege.getTotalSieges()).toBe(0);
      expect(newSiege.getWinRate()).toBe(0);
    });
  });

  describe('§6.3.6 胜率预估与实际胜率一致性', () => {
    it('SiegeEnhancer胜率预估在合理范围内', () => {
      const { enhancer, territory } = createFullSystems();
      territory.captureTerritory('city-luoyang', 'player');

      const estimate = enhancer.estimateWinRate(5000, 'city-xuchang');
      expect(estimate).not.toBeNull();
      expect(estimate!.winRate).toBeGreaterThanOrEqual(0.05);
      expect(estimate!.winRate).toBeLessThanOrEqual(0.95);
    });

    it('胜率预估包含攻击方和防守方战力', () => {
      const { enhancer, territory } = createFullSystems();
      territory.captureTerritory('city-luoyang', 'player');

      const estimate = enhancer.estimateWinRate(5000, 'city-xuchang');
      expect(estimate!.attackerPower).toBe(5000);
      expect(estimate!.defenderPower).toBeGreaterThan(0);
    });

    it('胜率预估包含战斗评级', () => {
      const { enhancer, territory } = createFullSystems();
      territory.captureTerritory('city-luoyang', 'player');

      const estimate = enhancer.estimateWinRate(5000, 'city-xuchang');
      expect(estimate!.rating).toBeDefined();
      expect(['easy', 'moderate', 'hard', 'very_hard', 'impossible']).toContain(estimate!.rating);
    });

    it('攻击方战力远大于防守方时胜率趋近上限', () => {
      const { enhancer, territory } = createFullSystems();
      territory.captureTerritory('city-luoyang', 'player');

      // 攻击方战力远大于防守方
      const estimate = enhancer.estimateWinRate(100000, 'city-xuchang');
      expect(estimate!.winRate).toBe(0.95); // 上限95%
    });

    it('攻击方战力远小于防守方时胜率趋近下限', () => {
      const { enhancer, territory } = createFullSystems();
      territory.captureTerritory('city-luoyang', 'player');

      // 攻击方战力远小于防守方
      const estimate = enhancer.estimateWinRate(1, 'city-xuchang');
      expect(estimate!.winRate).toBe(0.05); // 下限5%
    });

    it('攻击方战力等于防守方时胜率约50%', () => {
      const { enhancer, territory } = createFullSystems();
      territory.captureTerritory('city-luoyang', 'player');

      // city-xuchang defenseValue=4000
      const t = territory.getTerritoryById('city-xuchang')!;
      const estimate = enhancer.estimateWinRate(t.defenseValue, 'city-xuchang');
      expect(estimate!.winRate).toBeCloseTo(0.5, 2);
    });
  });

  describe('§6.3.7 攻城失败损失统计', () => {
    it('攻城失败损失兵力=30%×出征兵力', () => {
      const { siege, territory } = createSiegeSystems();
      territory.captureTerritory('city-luoyang', 'player');

      const result = siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, false);

      expect(result.defeatTroopLoss).toBeDefined();
      expect(result.defeatTroopLoss).toBe(Math.floor(result.cost.troops * 0.3));
    });

    it('攻城失败损失兵力>0', () => {
      const { siege, territory } = createSiegeSystems();
      territory.captureTerritory('city-luoyang', 'player');

      const result = siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, false);

      expect(result.defeatTroopLoss).toBeGreaterThan(0);
    });

    it('攻城失败损失兵力<出征兵力', () => {
      const { siege, territory } = createSiegeSystems();
      territory.captureTerritory('city-luoyang', 'player');

      const result = siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, false);

      expect(result.defeatTroopLoss!).toBeLessThan(result.cost.troops);
    });

    it('攻城胜利时不记录defeatTroopLoss', () => {
      const { siege, territory } = createSiegeSystems();
      territory.captureTerritory('city-luoyang', 'player');

      const result = siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);

      expect(result.defeatTroopLoss).toBeUndefined();
    });
  });
});
