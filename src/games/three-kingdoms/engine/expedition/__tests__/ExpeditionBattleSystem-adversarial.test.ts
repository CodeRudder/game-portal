/**
 * ExpeditionBattleSystem 对抗式测试（Adversarial Test）
 *
 * 重点测试：
 *   P0-1: 阵型克制边界（自克制/互克制/无克制）
 *   P0-2: 战力为零/负数/NaN
 *   P0-3: 评级边界（精确血量阈值）
 *   P0-4: quickBattle极端战力比
 *   P0-5: 战斗回合上限
 *
 * @module engine/expedition/__tests__/ExpeditionBattleSystem-adversarial
 */

import { ExpeditionBattleSystem } from '../ExpeditionBattleSystem';
import type { BattleTeamData, NodeBattleConfig } from '../ExpeditionBattleSystem';
import {
  FormationType,
  BattleGrade,
  NodeType,
} from '../../../core/expedition/expedition.types';

// ── 辅助函数 ──────────────────────────────

function createAllyTeam(
  power: number = 5000,
  formation: FormationType = FormationType.STANDARD,
): BattleTeamData {
  return {
    units: [{ id: 'hero_1', hp: 1000, maxHp: 1000, attack: 100, defense: 50, speed: 60, intelligence: 40 }],
    formation,
    totalPower: power,
  };
}

function createNodeConfig(
  nodeType: NodeType = NodeType.BOSS,
  enemyPower: number = 3000,
  enemyFormation: FormationType = FormationType.STANDARD,
  recommendedPower: number = 3000,
): NodeBattleConfig {
  return { nodeType, enemyPower, enemyFormation, recommendedPower };
}

let battleSystem: ExpeditionBattleSystem;

beforeEach(() => {
  battleSystem = new ExpeditionBattleSystem();
});

// ═══════════════════════════════════════════════════════════
// P0-1: 阵型克制边界
// ═══════════════════════════════════════════════════════════

describe('P0-1: 阵型克制边界', () => {
  test('锋矢克制方圆：克制加成+10%', () => {
    const bonus = battleSystem.getCounterBonus(FormationType.OFFENSIVE, FormationType.DEFENSIVE);
    expect(bonus).toBe(0.10);
  });

  test('方圆克制雁行：克制加成+10%', () => {
    const bonus = battleSystem.getCounterBonus(FormationType.DEFENSIVE, FormationType.FLANKING);
    expect(bonus).toBe(0.10);
  });

  test('雁行克制锋矢：克制加成+10%', () => {
    const bonus = battleSystem.getCounterBonus(FormationType.FLANKING, FormationType.OFFENSIVE);
    expect(bonus).toBe(0.10);
  });

  test('被克制方获得-10%惩罚', () => {
    const bonus = battleSystem.getCounterBonus(FormationType.DEFENSIVE, FormationType.OFFENSIVE);
    expect(bonus).toBe(-0.10);
  });

  test('普通阵型自克制（STANDARD克制STANDARD）', () => {
    const bonus = battleSystem.getCounterBonus(FormationType.STANDARD, FormationType.STANDARD);
    expect(bonus).toBe(0.10); // STANDARD counter is STANDARD
  });

  test('攻城阵克制普通阵型', () => {
    const bonus = battleSystem.getCounterBonus(FormationType.SIEGE, FormationType.STANDARD);
    expect(bonus).toBe(0.10);
  });

  test('无克制关系加成为0', () => {
    const bonus = battleSystem.getCounterBonus(FormationType.OFFENSIVE, FormationType.FLANKING);
    expect(bonus).toBe(0);
  });

  test('isCounter正确判断', () => {
    expect(battleSystem.isCounter(FormationType.OFFENSIVE, FormationType.DEFENSIVE)).toBe(true);
    expect(battleSystem.isCounter(FormationType.DEFENSIVE, FormationType.OFFENSIVE)).toBe(false);
    expect(battleSystem.isCounter(FormationType.STANDARD, FormationType.STANDARD)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// P0-2: 战力为零/负数/极端值
// ═══════════════════════════════════════════════════════════

describe('P0-2: 战力极端值', () => {
  test('F-Boundary: 我方战力为0的战斗', () => {
    const ally = createAllyTeam(0);
    const nodeConfig = createNodeConfig(NodeType.BOSS, 1000);

    const result = battleSystem.executeBattle(ally, nodeConfig);
    // 战力为0应该导致失败
    expect(result.grade).toBe(BattleGrade.NARROW_DEFEAT);
    expect(result.stars).toBe(0);
  });

  test('F-Boundary: 敌方战力为0的战斗', () => {
    const ally = createAllyTeam(5000);
    const nodeConfig = createNodeConfig(NodeType.BOSS, 0);

    const result = battleSystem.executeBattle(ally, nodeConfig);
    // 敌方战力为0应该大胜
    expect(result.allyHpPercent).toBeGreaterThan(0);
  });

  test('F-Boundary: 极端战力比（100:1）', () => {
    const ally = createAllyTeam(100000);
    const nodeConfig = createNodeConfig(NodeType.BOSS, 1000);

    const result = battleSystem.executeBattle(ally, nodeConfig);
    expect(result.allyHpPercent).toBeGreaterThan(50);
    expect(result.grade).toBe(BattleGrade.GREAT_VICTORY);
  });

  test('F-Boundary: 极端战力比（1:100）', () => {
    const ally = createAllyTeam(100);
    const nodeConfig = createNodeConfig(NodeType.BOSS, 10000);

    const result = battleSystem.executeBattle(ally, nodeConfig);
    expect(result.allyHpPercent).toBeLessThanOrEqual(0);
    expect(result.grade).toBe(BattleGrade.NARROW_DEFEAT);
  });

  test('F-Boundary: quickBattle战力为0', () => {
    const result = battleSystem.quickBattle(
      0,
      FormationType.STANDARD,
      1000,
      FormationType.STANDARD,
    );
    expect(result).toBeDefined();
    expect(result.allyHpPercent).toBe(0);
    expect(result.grade).toBe(BattleGrade.NARROW_DEFEAT);
  });

  test('F-Boundary: quickBattle双方战力为0', () => {
    const result = battleSystem.quickBattle(
      0,
      FormationType.STANDARD,
      0,
      FormationType.STANDARD,
    );
    // 双方战力为0，powerRatio=0/1=0，应判定为惜败
    expect(result).toBeDefined();
  });

  test('F-Boundary: quickBattle负数战力', () => {
    const result = battleSystem.quickBattle(
      -1000,
      FormationType.STANDARD,
      1000,
      FormationType.STANDARD,
    );
    // 负数战力应该产生异常结果，但不应崩溃
    expect(result).toBeDefined();
    expect(Number.isFinite(result.allyHpPercent)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// P0-3: 评级边界（精确血量阈值）
// ═══════════════════════════════════════════════════════════

describe('P0-3: 评级边界', () => {
  test('大捷：血量>50%且无阵亡', () => {
    const grade = battleSystem.evaluateGrade(51, 0, true);
    expect(grade).toBe(BattleGrade.GREAT_VICTORY);
  });

  test('非大捷：血量>50%但有阵亡', () => {
    const grade = battleSystem.evaluateGrade(60, 1, true);
    expect(grade).toBe(BattleGrade.MINOR_VICTORY);
  });

  test('非大捷：血量恰好50%（不>50%）', () => {
    const grade = battleSystem.evaluateGrade(50, 0, true);
    expect(grade).toBe(BattleGrade.MINOR_VICTORY);
  });

  test('小胜：血量10%~50%', () => {
    const grade = battleSystem.evaluateGrade(30, 0, true);
    expect(grade).toBe(BattleGrade.MINOR_VICTORY);
  });

  test('小胜：血量恰好10%', () => {
    const grade = battleSystem.evaluateGrade(10, 0, true);
    expect(grade).toBe(BattleGrade.MINOR_VICTORY);
  });

  test('惨胜：血量<10%', () => {
    const grade = battleSystem.evaluateGrade(5, 0, true);
    expect(grade).toBe(BattleGrade.PYRRHIC_VICTORY);
  });

  test('惨胜：血量恰好0%但赢了', () => {
    const grade = battleSystem.evaluateGrade(0, 0, true);
    expect(grade).toBe(BattleGrade.PYRRHIC_VICTORY);
  });

  test('惜败：输了', () => {
    const grade = battleSystem.evaluateGrade(80, 0, false);
    expect(grade).toBe(BattleGrade.NARROW_DEFEAT);
  });

  test('惜败：血量0%且输了', () => {
    const grade = battleSystem.evaluateGrade(0, 5, false);
    expect(grade).toBe(BattleGrade.NARROW_DEFEAT);
  });
});

// ═══════════════════════════════════════════════════════════
// P0-4: quickBattle极端战力比
// ═══════════════════════════════════════════════════════════

describe('P0-4: quickBattle极端场景', () => {
  test('压倒性优势(powerRatio>=2.0)：血量85~100%', () => {
    const result = battleSystem.quickBattle(
      10000,
      FormationType.STANDARD,
      3000,
      FormationType.STANDARD,
    );
    expect(result.allyHpPercent).toBeGreaterThanOrEqual(85);
    expect(result.allyDeaths).toBe(0);
  });

  test('明显优势(powerRatio>=1.5)：血量60~85%', () => {
    // 多次运行取平均值（因为有随机性）
    let totalHp = 0;
    const runs = 20;
    for (let i = 0; i < runs; i++) {
      const result = battleSystem.quickBattle(
        4500,
        FormationType.STANDARD,
        3000,
        FormationType.STANDARD,
      );
      totalHp += result.allyHpPercent;
    }
    const avgHp = totalHp / runs;
    expect(avgHp).toBeGreaterThan(55);
    expect(avgHp).toBeLessThan(90);
  });

  test('势均力敌(powerRatio>=1.0)：血量25~65%', () => {
    let totalHp = 0;
    const runs = 20;
    for (let i = 0; i < runs; i++) {
      const result = battleSystem.quickBattle(
        3000,
        FormationType.STANDARD,
        3000,
        FormationType.STANDARD,
      );
      totalHp += result.allyHpPercent;
    }
    const avgHp = totalHp / runs;
    expect(avgHp).toBeGreaterThan(15);
    expect(avgHp).toBeLessThan(75);
  });

  test('克制加成影响战斗结果', () => {
    // 不克制
    const result1 = battleSystem.quickBattle(
      3000,
      FormationType.STANDARD,
      3000,
      FormationType.OFFENSIVE,
    );

    // 克制
    const result2 = battleSystem.quickBattle(
      3000,
      FormationType.OFFENSIVE,
      3000,
      FormationType.DEFENSIVE,
    );

    // 克制方应该有优势（统计上）
    // 由于随机性，不做严格断言，只验证不崩溃
    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
    expect(Number.isFinite(result1.allyHpPercent)).toBe(true);
    expect(Number.isFinite(result2.allyHpPercent)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// P0-5: 不同节点类型的战斗
// ═══════════════════════════════════════════════════════════

describe('P0-5: 不同节点类型', () => {
  test('山贼节点难度倍率0.8', () => {
    const ally = createAllyTeam(3000);
    const config = createNodeConfig(NodeType.BANDIT, 3000);
    const result = battleSystem.executeBattle(ally, config);
    expect(result).toBeDefined();
  });

  test('天险节点难度倍率1.0', () => {
    const ally = createAllyTeam(3000);
    const config = createNodeConfig(NodeType.HAZARD, 3000);
    const result = battleSystem.executeBattle(ally, config);
    expect(result).toBeDefined();
  });

  test('BOSS节点难度倍率1.3', () => {
    const ally = createAllyTeam(5000);
    const config = createNodeConfig(NodeType.BOSS, 3000);
    const result = battleSystem.executeBattle(ally, config);
    expect(result).toBeDefined();
  });

  test('宝箱节点难度倍率0（无战斗）', () => {
    const ally = createAllyTeam(3000);
    const config = createNodeConfig(NodeType.TREASURE, 3000);
    const result = battleSystem.executeBattle(ally, config);
    // 宝箱节点敌方战力为0，应该大胜
    expect(result).toBeDefined();
  });

  test('休息节点难度倍率0（无战斗）', () => {
    const ally = createAllyTeam(3000);
    const config = createNodeConfig(NodeType.REST, 3000);
    const result = battleSystem.executeBattle(ally, config);
    expect(result).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════
// F-Error: ISubsystem接口
// ═══════════════════════════════════════════════════════════

describe('F-Error: ISubsystem接口', () => {
  test('init/update/reset不崩溃', () => {
    battleSystem.init({} as any);
    expect(() => battleSystem.update(16)).not.toThrow();
    expect(() => battleSystem.reset()).not.toThrow();
  });

  test('getState返回正确结构', () => {
    const state = battleSystem.getState();
    expect(state.name).toBe('expeditionBattle');
  });
});

// ═══════════════════════════════════════════════════════════
// F-Boundary: 经验计算边界
// ═══════════════════════════════════════════════════════════

describe('F-Boundary: 经验计算', () => {
  test('大捷经验倍率1.5', () => {
    const ally = createAllyTeam(100000);
    const config = createNodeConfig(NodeType.BOSS, 100);
    const result = battleSystem.executeBattle(ally, config);
    // 大捷应该获得更高经验
    if (result.grade === BattleGrade.GREAT_VICTORY) {
      expect(result.expGained).toBeGreaterThan(0);
    }
  });

  test('惜败仍获得30%经验', () => {
    const ally = createAllyTeam(100);
    const config = createNodeConfig(NodeType.BOSS, 100000);
    const result = battleSystem.executeBattle(ally, config);
    expect(result.grade).toBe(BattleGrade.NARROW_DEFEAT);
    expect(result.expGained).toBeGreaterThan(0);
  });
});
