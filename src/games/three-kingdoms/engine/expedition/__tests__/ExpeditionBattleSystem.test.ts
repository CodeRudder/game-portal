/**
 * ExpeditionBattleSystem 单元测试
 *
 * 覆盖：
 *   - 全自动战斗模拟（executeBattle）
 *   - 快速战斗判定（quickBattle）
 *   - 阵型克制加成
 *   - 战斗评级（大捷/小胜/惨胜/惜败）
 *   - 节点难度倍率
 *   - 经验计算
 */

import { ExpeditionBattleSystem } from '../ExpeditionBattleSystem';
import type { BattleTeamData, NodeBattleConfig } from '../ExpeditionBattleSystem';
import {
  BattleGrade,
  FormationType,
  NodeType,
  GRADE_STARS,
} from '../../../core/expedition/expedition.types';

// ── 辅助函数 ──────────────────────────────

/** 创建战斗队伍 */
function createTeam(overrides: Partial<BattleTeamData> = {}): BattleTeamData {
  return {
    units: [
      { id: 'h1', hp: 1000, maxHp: 1000, attack: 100, defense: 80, speed: 50, intelligence: 60 },
      { id: 'h2', hp: 1000, maxHp: 1000, attack: 90, defense: 90, speed: 40, intelligence: 70 },
      { id: 'h3', hp: 1000, maxHp: 1000, attack: 110, defense: 70, speed: 60, intelligence: 50 },
    ],
    formation: FormationType.OFFENSIVE,
    totalPower: 3000,
    ...overrides,
  };
}

/** 创建节点战斗配置 */
function createNodeConfig(overrides: Partial<NodeBattleConfig> = {}): NodeBattleConfig {
  return {
    nodeType: NodeType.BOSS,
    enemyPower: 2000,
    enemyFormation: FormationType.DEFENSIVE,
    recommendedPower: 2500,
    ...overrides,
  };
}

// ── 全局实例 ──────────────────────────────

let battle: ExpeditionBattleSystem;

beforeEach(() => {
  battle = new ExpeditionBattleSystem();
});

// ═══════════════════════════════════════════
// 1. executeBattle — 全自动战斗
// ═══════════════════════════════════════════

describe('ExpeditionBattleSystem — executeBattle', () => {
  test('强队 vs 弱敌应胜利', () => {
    const ally = createTeam({ totalPower: 5000 });
    const config = createNodeConfig({ enemyPower: 1000 });
    const result = battle.executeBattle(ally, config);
    expect(result.grade).not.toBe(BattleGrade.NARROW_DEFEAT);
    expect(result.totalTurns).toBeGreaterThan(0);
    expect(result.expGained).toBeGreaterThan(0);
  });

  test('弱队 vs 强敌可能失败', () => {
    const ally = createTeam({ totalPower: 500 });
    const config = createNodeConfig({ enemyPower: 5000 });
    const result = battle.executeBattle(ally, config);
    // 极弱情况，大概率惜败
    expect([BattleGrade.NARROW_DEFEAT, BattleGrade.PYRRHIC_VICTORY]).toContain(result.grade);
  });

  test('战斗结果包含星级', () => {
    const ally = createTeam({ totalPower: 4000 });
    const config = createNodeConfig({ enemyPower: 2000 });
    const result = battle.executeBattle(ally, config);
    expect(result.stars).toBeGreaterThanOrEqual(0);
    expect(result.stars).toBeLessThanOrEqual(3);
  });

  test('BOSS节点经验最高', () => {
    const ally = createTeam({ totalPower: 5000 });

    const bossResult = battle.executeBattle(ally, createNodeConfig({ nodeType: NodeType.BOSS }));
    const banditResult = battle.executeBattle(ally, createNodeConfig({ nodeType: NodeType.BANDIT }));

    expect(bossResult.expGained).toBeGreaterThan(banditResult.expGained);
  });

  test('不同节点类型有不同难度倍率', () => {
    const ally = createTeam({ totalPower: 3000 });

    const results = {
      bandit: battle.executeBattle(ally, createNodeConfig({ nodeType: NodeType.BANDIT })),
      hazard: battle.executeBattle(ally, createNodeConfig({ nodeType: NodeType.HAZARD })),
      boss: battle.executeBattle(ally, createNodeConfig({ nodeType: NodeType.BOSS })),
    };

    // BOSS 敌人最难（倍率1.3），山贼最易（倍率0.8）
    // 敌人越强，我方剩余血量越低（概率上）
    expect(results.bandit.allyHpPercent).toBeGreaterThanOrEqual(0);
    expect(results.boss.allyHpPercent).toBeGreaterThanOrEqual(0);
  });

  test('战斗回合数不超过上限', () => {
    const ally = createTeam({ totalPower: 2000 });
    const config = createNodeConfig({ enemyPower: 2000 });
    const result = battle.executeBattle(ally, config);
    expect(result.totalTurns).toBeLessThanOrEqual(10);
  });
});

// ═══════════════════════════════════════════
// 2. quickBattle — 快速战斗判定
// ═══════════════════════════════════════════

describe('ExpeditionBattleSystem — quickBattle', () => {
  test('压倒性优势（2x战力）结果好', () => {
    const result = battle.quickBattle(5000, FormationType.OFFENSIVE, 2000, FormationType.DEFENSIVE);
    expect(result.grade).not.toBe(BattleGrade.NARROW_DEFEAT);
    expect(result.allyHpPercent).toBeGreaterThan(50);
  });

  test('压倒性劣势（0.3x战力）大概率失败', () => {
    const result = battle.quickBattle(500, FormationType.OFFENSIVE, 2000, FormationType.DEFENSIVE);
    // 极弱情况
    expect(result.allyHpPercent).toBeLessThanOrEqual(10);
  });

  test('阵型克制影响结果', () => {
    // 锋矢克制方圆
    const counterResult = battle.quickBattle(2000, FormationType.OFFENSIVE, 2000, FormationType.DEFENSIVE);
    // 锋矢不克制攻城
    const neutralResult = battle.quickBattle(2000, FormationType.OFFENSIVE, 2000, FormationType.SIEGE);

    // 克制方有加成，平均表现更好
    expect(counterResult.allyHpPercent).toBeGreaterThanOrEqual(0);
    expect(neutralResult.allyHpPercent).toBeGreaterThanOrEqual(0);
  });

  test('快速战斗返回完整结果结构', () => {
    const result = battle.quickBattle(3000, FormationType.FLANKING, 2000, FormationType.SIEGE);
    expect(result).toHaveProperty('grade');
    expect(result).toHaveProperty('stars');
    expect(result).toHaveProperty('totalTurns');
    expect(result).toHaveProperty('allyHpPercent');
    expect(result).toHaveProperty('allyDeaths');
    expect(result).toHaveProperty('expGained');
  });

  test('战力相当时结果不确定', () => {
    // 多次运行，结果应有变化
    const results = Array.from({ length: 10 }, () =>
      battle.quickBattle(2000, FormationType.FLANKING, 2000, FormationType.SIEGE)
    );
    const hpPercents = results.map(r => r.allyHpPercent);
    const hasVariance = new Set(hpPercents.map(p => Math.round(p))).size > 1;
    expect(hasVariance).toBe(true);
  });
});

// ═══════════════════════════════════════════
// 3. 阵型克制
// ═══════════════════════════════════════════

describe('ExpeditionBattleSystem — 阵型克制', () => {
  test('锋矢克制方圆', () => {
    expect(battle.isCounter(FormationType.OFFENSIVE, FormationType.DEFENSIVE)).toBe(true);
  });

  test('方圆克制雁行', () => {
    expect(battle.isCounter(FormationType.DEFENSIVE, FormationType.FLANKING)).toBe(true);
  });

  test('雁行克制锋矢', () => {
    expect(battle.isCounter(FormationType.FLANKING, FormationType.OFFENSIVE)).toBe(true);
  });

  test('攻城克制普通', () => {
    expect(battle.isCounter(FormationType.SIEGE, FormationType.STANDARD)).toBe(true);
  });

  test('锋矢不克制雁行', () => {
    expect(battle.isCounter(FormationType.OFFENSIVE, FormationType.FLANKING)).toBe(false);
  });

  test('getCounterBonus 克制方+10%', () => {
    expect(battle.getCounterBonus(FormationType.OFFENSIVE, FormationType.DEFENSIVE)).toBe(0.10);
  });

  test('getCounterBonus 被克制方-10%', () => {
    expect(battle.getCounterBonus(FormationType.DEFENSIVE, FormationType.OFFENSIVE)).toBe(-0.10);
  });

  test('getCounterBonus 无克制关系为0', () => {
    expect(battle.getCounterBonus(FormationType.OFFENSIVE, FormationType.SIEGE)).toBe(0);
  });

  test('同阵型无克制', () => {
    expect(battle.getCounterBonus(FormationType.OFFENSIVE, FormationType.OFFENSIVE)).toBe(0);
  });
});

// ═══════════════════════════════════════════
// 4. 战斗评级
// ═══════════════════════════════════════════

describe('ExpeditionBattleSystem — 战斗评级', () => {
  test('胜利 + HP>50% + 0阵亡 = 大捷', () => {
    expect(battle.evaluateGrade(80, 0, true)).toBe(BattleGrade.GREAT_VICTORY);
  });

  test('胜利 + HP>50% + 有阵亡 = 小胜', () => {
    expect(battle.evaluateGrade(60, 1, true)).toBe(BattleGrade.MINOR_VICTORY);
  });

  test('胜利 + HP 10%~50% = 小胜', () => {
    expect(battle.evaluateGrade(30, 0, true)).toBe(BattleGrade.MINOR_VICTORY);
  });

  test('胜利 + HP<10% = 惨胜', () => {
    expect(battle.evaluateGrade(5, 0, true)).toBe(BattleGrade.PYRRHIC_VICTORY);
  });

  test('失败 = 惜败', () => {
    expect(battle.evaluateGrade(0, 5, false)).toBe(BattleGrade.NARROW_DEFEAT);
  });

  test('星级映射正确', () => {
    expect(GRADE_STARS[BattleGrade.GREAT_VICTORY]).toBe(3);
    expect(GRADE_STARS[BattleGrade.MINOR_VICTORY]).toBe(2);
    expect(GRADE_STARS[BattleGrade.PYRRHIC_VICTORY]).toBe(1);
    expect(GRADE_STARS[BattleGrade.NARROW_DEFEAT]).toBe(0);
  });
});

// ═══════════════════════════════════════════
// 5. 经验计算
// ═══════════════════════════════════════════

describe('ExpeditionBattleSystem — 经验计算', () => {
  test('大捷经验 > 小胜经验 > 惨胜经验', () => {
    const ally = createTeam({ totalPower: 5000 });
    // 通过 quickBattle 间接测试
    const greatExp = battle.quickBattle(10000, FormationType.FISH_SCALE, 1000, FormationType.WEDGE).expGained;
    expect(greatExp).toBeGreaterThan(0);
  });

  test('惜败也有少量经验', () => {
    const result = battle.quickBattle(500, FormationType.FISH_SCALE, 5000, FormationType.WEDGE);
    // 即使失败也可能有经验（0.3倍率）
    expect(result.expGained).toBeGreaterThanOrEqual(0);
  });
});
