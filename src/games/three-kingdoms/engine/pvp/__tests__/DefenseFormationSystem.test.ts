/**
 * DefenseFormationSystem 单元测试
 *
 * 覆盖：
 *   - 防守阵容设置（5阵位/5阵型/4策略）
 *   - 阵容验证
 *   - 防守快照创建
 *   - 防守日志管理（添加/统计/建议）
 *   - 存档序列化/反序列化
 */

import {
  DefenseFormationSystem,
  FORMATION_SLOT_COUNT,
  MAX_DEFENSE_LOGS,
  ALL_FORMATIONS,
  ALL_STRATEGIES,
  FORMATION_NAMES,
  STRATEGY_NAMES,
} from '../DefenseFormationSystem';
import {
  FormationType,
  AIDefenseStrategy,
} from '../../../core/pvp/pvp.types';
import type { DefenseFormation, DefenseLogEntry, ArenaPlayerState } from '../../../core/pvp/pvp.types';
import { createDefaultArenaPlayerState } from '../ArenaSystem';

// ── 辅助函数 ──────────────────────────────

function createFormation(
  heroCount: number = 3,
  formation: FormationType = FormationType.FISH_SCALE,
  strategy: AIDefenseStrategy = AIDefenseStrategy.BALANCED,
): DefenseFormation {
  const slots: [string, string, string, string, string] = ['', '', '', '', ''];
  for (let i = 0; i < Math.min(heroCount, 5); i++) {
    slots[i] = `hero_${i}`;
  }
  return { slots, formation, strategy };
}

let system: DefenseFormationSystem;

beforeEach(() => {
  system = new DefenseFormationSystem();
});

// ── 阵容管理 ──────────────────────────────

describe('DefenseFormationSystem — 阵容管理', () => {
  test('创建默认阵容', () => {
    const formation = system.createDefaultFormation();
    expect(formation.slots).toEqual(['', '', '', '', '']);
    expect(formation.formation).toBe(FormationType.FISH_SCALE);
    expect(formation.strategy).toBe(AIDefenseStrategy.BALANCED);
  });

  test('设置阵容 — 至少1名武将', () => {
    const current = system.createDefaultFormation();
    const emptySlots: [string, string, string, string, string] = ['', '', '', '', ''];
    expect(() => system.setFormation(current, emptySlots)).toThrow('至少需要1名武将');
  });

  test('设置阵容 — 保留原有阵型和策略', () => {
    const current = createFormation(2, FormationType.WEDGE, AIDefenseStrategy.AGGRESSIVE);
    const newSlots: [string, string, string, string, string] = ['h_a', 'h_b', 'h_c', '', ''];
    const result = system.setFormation(current, newSlots);

    expect(result.slots).toEqual(newSlots);
    expect(result.formation).toBe(FormationType.WEDGE);
    expect(result.strategy).toBe(AIDefenseStrategy.AGGRESSIVE);
  });

  test('设置阵容 — 同时更新阵型和策略', () => {
    const current = system.createDefaultFormation();
    const slots: [string, string, string, string, string] = ['h1', '', '', '', ''];
    const result = system.setFormation(current, slots, FormationType.GOOSE, AIDefenseStrategy.CUNNING);

    expect(result.formation).toBe(FormationType.GOOSE);
    expect(result.strategy).toBe(AIDefenseStrategy.CUNNING);
  });

  test('设置阵型', () => {
    const current = system.createDefaultFormation();
    const result = system.setFormationType(current, FormationType.SNAKE);
    expect(result.formation).toBe(FormationType.SNAKE);
    expect(result.slots).toEqual(current.slots);
  });

  test('设置策略', () => {
    const current = system.createDefaultFormation();
    const result = system.setStrategy(current, AIDefenseStrategy.DEFENSIVE);
    expect(result.strategy).toBe(AIDefenseStrategy.DEFENSIVE);
  });

  test('5种阵型全部可用', () => {
    expect(ALL_FORMATIONS.length).toBe(5);
    expect(ALL_FORMATIONS).toContain(FormationType.FISH_SCALE);
    expect(ALL_FORMATIONS).toContain(FormationType.WEDGE);
    expect(ALL_FORMATIONS).toContain(FormationType.GOOSE);
    expect(ALL_FORMATIONS).toContain(FormationType.SNAKE);
    expect(ALL_FORMATIONS).toContain(FormationType.SQUARE);
  });

  test('4种策略全部可用', () => {
    expect(ALL_STRATEGIES.length).toBe(4);
    expect(ALL_STRATEGIES).toContain(AIDefenseStrategy.BALANCED);
    expect(ALL_STRATEGIES).toContain(AIDefenseStrategy.AGGRESSIVE);
    expect(ALL_STRATEGIES).toContain(AIDefenseStrategy.DEFENSIVE);
    expect(ALL_STRATEGIES).toContain(AIDefenseStrategy.CUNNING);
  });

  test('阵型名称映射完整', () => {
    for (const f of ALL_FORMATIONS) {
      expect(FORMATION_NAMES[f]).toBeTruthy();
    }
  });

  test('策略名称映射完整', () => {
    for (const s of ALL_STRATEGIES) {
      expect(STRATEGY_NAMES[s]).toBeTruthy();
    }
  });
});

// ── 阵容验证 ──────────────────────────────

describe('DefenseFormationSystem — 阵容验证', () => {
  test('合法阵容验证通过', () => {
    const formation = createFormation(3);
    const result = system.validateFormation(formation);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('空阵容验证失败', () => {
    const formation = createFormation(0);
    const result = system.validateFormation(formation);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('至少需要1名武将');
  });

  test('重复武将验证失败', () => {
    const formation: DefenseFormation = {
      slots: ['hero_1', 'hero_1', '', '', ''],
      formation: FormationType.FISH_SCALE,
      strategy: AIDefenseStrategy.BALANCED,
    };
    const result = system.validateFormation(formation);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('武将不能重复');
  });

  test('获取武将数量', () => {
    expect(system.getHeroCount(createFormation(0))).toBe(0);
    expect(system.getHeroCount(createFormation(3))).toBe(3);
    expect(system.getHeroCount(createFormation(5))).toBe(5);
  });

  test('获取武将ID列表', () => {
    const formation = createFormation(3);
    const ids = system.getHeroIds(formation);
    expect(ids).toEqual(['hero_0', 'hero_1', 'hero_2']);
  });

  test('满阵容5个武将', () => {
    const formation = createFormation(5);
    expect(system.getHeroCount(formation)).toBe(FORMATION_SLOT_COUNT);
    expect(system.getHeroIds(formation).length).toBe(5);
  });
});

// ── 防守快照 ──────────────────────────────

describe('DefenseFormationSystem — 防守快照', () => {
  test('创建快照包含完整阵容信息', () => {
    const formation = createFormation(3, FormationType.WEDGE, AIDefenseStrategy.AGGRESSIVE);
    const snapshot = system.createSnapshot(formation);

    expect(snapshot.slots).toEqual(['hero_0', 'hero_1', 'hero_2', '', '']);
    expect(snapshot.formation).toBe(FormationType.WEDGE);
    expect(snapshot.aiStrategy).toBe(AIDefenseStrategy.AGGRESSIVE);
  });

  test('快照是独立副本', () => {
    const formation = createFormation(3);
    const snapshot = system.createSnapshot(formation);

    // 修改原始阵容不影响快照
    formation.slots[0] = 'changed';
    expect(snapshot.slots[0]).toBe('hero_0');
  });
});

// ── 防守日志 ──────────────────────────────

describe('DefenseFormationSystem — 防守日志', () => {
  test('添加防守日志', () => {
    const logs: DefenseLogEntry[] = [];
    const now = 1000000;

    const result = system.addDefenseLog(logs, {
      attackerId: 'att1',
      attackerName: '进攻者1',
      defenderWon: true,
      turns: 5,
      attackerRank: 'BRONZE_IV',
      timestamp: now,
      id: '', // 将被覆盖
    });

    expect(result.length).toBe(1);
    expect(result[0].attackerId).toBe('att1');
    expect(result[0].defenderWon).toBe(true);
  });

  test('防守日志最多50条', () => {
    let logs: DefenseLogEntry[] = [];

    for (let i = 0; i < 60; i++) {
      logs = system.addDefenseLog(logs, {
        attackerId: `att_${i}`,
        attackerName: `A${i}`,
        defenderWon: i % 2 === 0,
        turns: 5,
        attackerRank: 'BRONZE_V',
        timestamp: 1000 + i,
        id: '',
      });
    }

    expect(logs.length).toBe(MAX_DEFENSE_LOGS);
    expect(logs[0].attackerId).toBe('att_59'); // 最新的在前
  });

  test('防守统计 — 全胜', () => {
    let logs: DefenseLogEntry[] = [];
    for (let i = 0; i < 5; i++) {
      logs = system.addDefenseLog(logs, {
        attackerId: `a${i}`, attackerName: `A${i}`,
        defenderWon: true, turns: 3, attackerRank: 'BRONZE_V',
        timestamp: 1000 + i, id: '',
      });
    }

    const stats = system.getDefenseStats(logs);
    expect(stats.totalDefenses).toBe(5);
    expect(stats.wins).toBe(5);
    expect(stats.losses).toBe(0);
    expect(stats.winRate).toBe(1);
  });

  test('防守统计 — 全败建议坚守', () => {
    let logs: DefenseLogEntry[] = [];
    for (let i = 0; i < 6; i++) {
      logs = system.addDefenseLog(logs, {
        attackerId: `a${i}`, attackerName: `A${i}`,
        defenderWon: false, turns: 3, attackerRank: 'BRONZE_V',
        timestamp: 1000 + i, id: '',
      });
    }

    const stats = system.getDefenseStats(logs);
    expect(stats.winRate).toBe(0);
    expect(stats.suggestedStrategy).toBe(AIDefenseStrategy.DEFENSIVE);
  });

  test('防守统计 — 中等胜率建议均衡', () => {
    let logs: DefenseLogEntry[] = [];
    for (let i = 0; i < 10; i++) {
      logs = system.addDefenseLog(logs, {
        attackerId: `a${i}`, attackerName: `A${i}`,
        defenderWon: i < 4, turns: 3, attackerRank: 'BRONZE_V',
        timestamp: 1000 + i, id: '',
      });
    }

    const stats = system.getDefenseStats(logs);
    expect(stats.winRate).toBe(0.4);
    expect(stats.suggestedStrategy).toBe(AIDefenseStrategy.BALANCED);
  });

  test('防守统计 — 样本不足不给建议', () => {
    let logs: DefenseLogEntry[] = [];
    logs = system.addDefenseLog(logs, {
      attackerId: 'a1', attackerName: 'A1',
      defenderWon: false, turns: 3, attackerRank: 'BRONZE_V',
      timestamp: 1000, id: '',
    });

    const stats = system.getDefenseStats(logs);
    expect(stats.suggestedStrategy).toBeNull();
  });

  test('获取最近日志', () => {
    let logs: DefenseLogEntry[] = [];
    for (let i = 0; i < 20; i++) {
      logs = system.addDefenseLog(logs, {
        attackerId: `a${i}`, attackerName: `A${i}`,
        defenderWon: true, turns: 3, attackerRank: 'BRONZE_V',
        timestamp: 1000 + i, id: '',
      });
    }

    const recent = system.getRecentLogs(logs, 5);
    expect(recent.length).toBe(5);
    expect(recent[0].attackerId).toBe('a19'); // 最新添加的日志排在最前（prepend）
  });

  test('按进攻方查询日志', () => {
    let logs: DefenseLogEntry[] = [];
    for (let i = 0; i < 5; i++) {
      logs = system.addDefenseLog(logs, {
        attackerId: i < 3 ? 'att1' : 'att2', attackerName: `A${i}`,
        defenderWon: true, turns: 3, attackerRank: 'BRONZE_V',
        timestamp: 1000 + i, id: '',
      });
    }

    const att1Logs = system.getLogsByAttacker(logs, 'att1');
    expect(att1Logs.length).toBe(3);
  });
});

// ── 策略建议 ──────────────────────────────

describe('DefenseFormationSystem — 策略建议', () => {
  test('无建议时返回null', () => {
    const stats = { totalDefenses: 10, wins: 8, losses: 2, winRate: 0.8, suggestedStrategy: null };
    expect(system.getStrategySuggestion(stats)).toBeNull();
  });

  test('低胜率给出建议', () => {
    const stats = { totalDefenses: 10, wins: 2, losses: 8, winRate: 0.2, suggestedStrategy: AIDefenseStrategy.DEFENSIVE };
    const suggestion = system.getStrategySuggestion(stats);
    expect(suggestion).toBeTruthy();
    expect(suggestion).toContain('坚守');
  });

  test('中等胜率给出建议', () => {
    const stats = { totalDefenses: 10, wins: 4, losses: 6, winRate: 0.4, suggestedStrategy: AIDefenseStrategy.BALANCED };
    const suggestion = system.getStrategySuggestion(stats);
    expect(suggestion).toBeTruthy();
    expect(suggestion).toContain('均衡');
  });
});

// ── 存档序列化 ────────────────────────────

describe('DefenseFormationSystem — 存档序列化', () => {
  test('序列化和反序列化保持一致', () => {
    const playerState: ArenaPlayerState = {
      ...createDefaultArenaPlayerState(),
      defenseFormation: createFormation(3, FormationType.WEDGE, AIDefenseStrategy.AGGRESSIVE),
    };

    const data = system.serialize(playerState);
    expect(data.defenseFormation.formation).toBe(FormationType.WEDGE);
    expect(data.defenseFormation.strategy).toBe(AIDefenseStrategy.AGGRESSIVE);

    const restored = system.deserialize(data);
    expect(restored.defenseFormation).toEqual(data.defenseFormation);
    expect(restored.defenseLogs).toEqual([]);
  });

  test('反序列化空数据返回默认值', () => {
    const restored = system.deserialize({} as unknown as Record<string, unknown>);
    expect(restored.defenseFormation).toEqual(system.createDefaultFormation());
    expect(restored.defenseLogs).toEqual([]);
  });
});
