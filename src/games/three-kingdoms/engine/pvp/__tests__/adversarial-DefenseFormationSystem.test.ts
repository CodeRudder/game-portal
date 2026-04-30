/**
 * 对抗式测试 — DefenseFormationSystem 防守阵容系统
 *
 * 测试策略：
 *   - 阵容校验绕过
 *   - 重复武将注入
 *   - 无效阵型/策略枚举
 *   - 日志溢出与统计欺骗
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DefenseFormationSystem,
  FORMATION_SLOT_COUNT,
  MAX_DEFENSE_LOGS,
  ALL_FORMATIONS,
  ALL_STRATEGIES,
} from '../DefenseFormationSystem';
import { FormationType, AIDefenseStrategy } from '../../../core/pvp/pvp.types';
import type { DefenseFormation, DefenseLogEntry } from '../../../core/pvp/pvp.types';

describe('DefenseFormationSystem 对抗式测试', () => {
  let system: DefenseFormationSystem;

  beforeEach(() => {
    system = new DefenseFormationSystem();
  });

  // ═══════════════════════════════════════
  // 1. 阵容设置 — 对抗测试
  // ═══════════════════════════════════════

  describe('setFormation — 阵容注入', () => {
    const defaultFormation: DefenseFormation = {
      slots: ['', '', '', '', ''],
      formation: FormationType.FISH_SCALE,
      strategy: AIDefenseStrategy.BALANCED,
    };

    it('A-001: 空阵容应抛异常', () => {
      expect(() =>
        system.setFormation(defaultFormation, ['', '', '', '', '']),
      ).toThrow('至少需要1名武将');
    });

    it('A-002: 1名武将应成功', () => {
      const result = system.setFormation(defaultFormation, ['hero1', '', '', '', '']);
      expect(result.slots[0]).toBe('hero1');
    });

    it('A-003: 5名武将应成功', () => {
      const result = system.setFormation(defaultFormation, ['h1', 'h2', 'h3', 'h4', 'h5']);
      expect(result.slots.filter(s => s !== '').length).toBe(5);
    });

    it('A-004: 重复武将ID应被接受（当前无去重）', () => {
      const result = system.setFormation(defaultFormation, ['hero1', 'hero1', 'hero1', '', '']);
      expect(result.slots.filter(s => s === 'hero1').length).toBe(3);
    });

    it('A-005: 特殊字符武将ID应被接受', () => {
      const result = system.setFormation(defaultFormation, ['<script>alert(1)</script>', '', '', '', '']);
      expect(result.slots[0]).toBe('<script>alert(1)</script>');
    });

    it('A-006: 超长武将ID应被接受', () => {
      const longId = 'a'.repeat(10000);
      const result = system.setFormation(defaultFormation, [longId, '', '', '', '']);
      expect(result.slots[0].length).toBe(10000);
    });

    it('A-007: 不传formation参数应保持原阵型', () => {
      const result = system.setFormation(defaultFormation, ['h1', '', '', '', '']);
      expect(result.formation).toBe(FormationType.FISH_SCALE);
    });

    it('A-008: 不传strategy参数应保持原策略', () => {
      const result = system.setFormation(defaultFormation, ['h1', '', '', '', '']);
      expect(result.strategy).toBe(AIDefenseStrategy.BALANCED);
    });

    it('A-009: 传入新formation和strategy应更新', () => {
      const result = system.setFormation(
        defaultFormation,
        ['h1', '', '', '', ''],
        FormationType.SNAKE,
        AIDefenseStrategy.CUNNING,
      );
      expect(result.formation).toBe(FormationType.SNAKE);
      expect(result.strategy).toBe(AIDefenseStrategy.CUNNING);
    });
  });

  // ═══════════════════════════════════════
  // 2. 阵容验证 — 对抗测试
  // ═══════════════════════════════════════

  describe('validateFormation — 校验绕过', () => {
    it('B-001: 空阵容应不合法', () => {
      const formation: DefenseFormation = {
        slots: ['', '', '', '', ''],
        formation: FormationType.FISH_SCALE,
        strategy: AIDefenseStrategy.BALANCED,
      };
      const result = system.validateFormation(formation);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('至少需要1名武将');
    });

    it('B-002: 重复武将应不合法', () => {
      const formation: DefenseFormation = {
        slots: ['hero1', 'hero1', '', '', ''],
        formation: FormationType.FISH_SCALE,
        strategy: AIDefenseStrategy.BALANCED,
      };
      const result = system.validateFormation(formation);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('武将不能重复');
    });

    it('B-003: slots长度不等于5应不合法', () => {
      const formation = {
        slots: ['h1', '', ''] as any,
        formation: FormationType.FISH_SCALE,
        strategy: AIDefenseStrategy.BALANCED,
      };
      const result = system.validateFormation(formation);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('阵位数量必须为5');
    });

    it('B-004: 合法阵容应通过验证', () => {
      const formation: DefenseFormation = {
        slots: ['h1', 'h2', 'h3', '', ''],
        formation: FormationType.FISH_SCALE,
        strategy: AIDefenseStrategy.BALANCED,
      };
      const result = system.validateFormation(formation);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('B-005: 所有合法阵型应通过验证', () => {
      for (const fmt of ALL_FORMATIONS) {
        const formation: DefenseFormation = {
          slots: ['h1', '', '', '', ''],
          formation: fmt,
          strategy: AIDefenseStrategy.BALANCED,
        };
        expect(system.validateFormation(formation).valid).toBe(true);
      }
    });

    it('B-006: 所有合法策略应通过验证', () => {
      for (const strategy of ALL_STRATEGIES) {
        const formation: DefenseFormation = {
          slots: ['h1', '', '', '', ''],
          formation: FormationType.FISH_SCALE,
          strategy,
        };
        expect(system.validateFormation(formation).valid).toBe(true);
      }
    });
  });

  // ═══════════════════════════════════════
  // 3. 防守日志 — 溢出攻击
  // ═══════════════════════════════════════

  describe('addDefenseLog — 日志溢出', () => {
    it('C-001: 超过50条日志应截断', () => {
      let logs: DefenseLogEntry[] = [];
      for (let i = 0; i < 60; i++) {
        logs = system.addDefenseLog(logs, {
          attackerId: `att_${i}`,
          attackerName: `攻击者${i}`,
          defenderWon: true,
          turns: 5,
          attackerRank: 'BRONZE_V',
          timestamp: Date.now(),
        });
      }
      expect(logs.length).toBe(50);
    });

    it('C-002: 日志应按时间倒序排列', () => {
      let logs: DefenseLogEntry[] = [];
      for (let i = 0; i < 5; i++) {
        logs = system.addDefenseLog(logs, {
          attackerId: `att_${i}`,
          attackerName: `攻击者${i}`,
          defenderWon: true,
          turns: 5,
          attackerRank: 'BRONZE_V',
          timestamp: 1000 + i,
        });
      }
      // 最新的在前面
      expect(logs[0].attackerId).toBe('att_4');
    });

    it('C-003: 空字符串攻击者ID应被接受', () => {
      const logs: DefenseLogEntry[] = [];
      const result = system.addDefenseLog(logs, {
        attackerId: '',
        attackerName: '',
        defenderWon: true,
        turns: 0,
        attackerRank: '',
        timestamp: 0,
      });
      expect(result.length).toBe(1);
      expect(result[0].attackerId).toBe('');
    });
  });

  // ═══════════════════════════════════════
  // 4. 防守统计 — 欺骗攻击
  // ═══════════════════════════════════════

  describe('getDefenseStats — 统计欺骗', () => {
    it('D-001: 空日志应返回全0统计', () => {
      const stats = system.getDefenseStats([]);
      expect(stats.totalDefenses).toBe(0);
      expect(stats.wins).toBe(0);
      expect(stats.losses).toBe(0);
      expect(stats.winRate).toBe(0);
      expect(stats.suggestedStrategy).toBeNull();
    });

    it('D-002: 4场不足5场不应给建议', () => {
      const logs: DefenseLogEntry[] = Array.from({ length: 4 }, (_, i) => ({
        id: `log_${i}`,
        attackerId: `att_${i}`,
        attackerName: `攻击者${i}`,
        defenderWon: false,
        turns: 5,
        attackerRank: 'BRONZE_V',
        timestamp: Date.now(),
      }));
      const stats = system.getDefenseStats(logs);
      expect(stats.suggestedStrategy).toBeNull();
    });

    it('D-003: 5场全败应建议坚守', () => {
      const logs: DefenseLogEntry[] = Array.from({ length: 5 }, (_, i) => ({
        id: `log_${i}`,
        attackerId: `att_${i}`,
        attackerName: `攻击者${i}`,
        defenderWon: false,
        turns: 5,
        attackerRank: 'BRONZE_V',
        timestamp: Date.now(),
      }));
      const stats = system.getDefenseStats(logs);
      expect(stats.winRate).toBe(0);
      expect(stats.suggestedStrategy).toBe(AIDefenseStrategy.DEFENSIVE);
    });

    it('D-004: 5场全胜不应给建议', () => {
      const logs: DefenseLogEntry[] = Array.from({ length: 5 }, (_, i) => ({
        id: `log_${i}`,
        attackerId: `att_${i}`,
        attackerName: `攻击者${i}`,
        defenderWon: true,
        turns: 5,
        attackerRank: 'BRONZE_V',
        timestamp: Date.now(),
      }));
      const stats = system.getDefenseStats(logs);
      expect(stats.winRate).toBe(1);
      expect(stats.suggestedStrategy).toBeNull();
    });
  });

  // ═══════════════════════════════════════
  // 5. 快照 — 对抗测试
  // ═══════════════════════════════════════

  describe('createSnapshot — 快照隔离', () => {
    it('E-001: 快照应深拷贝slots', () => {
      const formation: DefenseFormation = {
        slots: ['h1', 'h2', '', '', ''],
        formation: FormationType.FISH_SCALE,
        strategy: AIDefenseStrategy.BALANCED,
      };
      const snapshot = system.createSnapshot(formation);
      // 修改原阵容不应影响快照
      formation.slots[0] = 'h99';
      expect(snapshot.slots[0]).toBe('h1');
    });
  });

  // ═══════════════════════════════════════
  // 6. 辅助方法 — 对抗测试
  // ═══════════════════════════════════════

  describe('getHeroCount / getHeroIds — 边界', () => {
    it('F-001: 空阵容武将数应为0', () => {
      const formation: DefenseFormation = {
        slots: ['', '', '', '', ''],
        formation: FormationType.FISH_SCALE,
        strategy: AIDefenseStrategy.BALANCED,
      };
      expect(system.getHeroCount(formation)).toBe(0);
      expect(system.getHeroIds(formation)).toEqual([]);
    });

    it('F-002: 满阵容武将数应为5', () => {
      const formation: DefenseFormation = {
        slots: ['h1', 'h2', 'h3', 'h4', 'h5'],
        formation: FormationType.FISH_SCALE,
        strategy: AIDefenseStrategy.BALANCED,
      };
      expect(system.getHeroCount(formation)).toBe(5);
      expect(system.getHeroIds(formation)).toEqual(['h1', 'h2', 'h3', 'h4', 'h5']);
    });
  });

  // ═══════════════════════════════════════
  // 7. 序列化 — 对抗测试
  // ═══════════════════════════════════════

  describe('serialize / deserialize — 数据篡改', () => {
    it('G-001: 反序列化null应抛异常（BUG记录：无null防御）', () => {
      // BUG: deserialize不检查data是否为null
      expect(() => system.deserialize(null as any)).toThrow();
    });

    it('G-002: 反序列化undefined字段应使用默认值', () => {
      const result = system.deserialize({ defenseFormation: undefined as any, defenseLogs: undefined as any });
      expect(result.defenseFormation.formation).toBe(FormationType.FISH_SCALE);
      expect(result.defenseLogs).toEqual([]);
    });
  });

  // ═══════════════════════════════════════
  // 8. 常量验证 — 对抗测试
  // ═══════════════════════════════════════

  describe('常量完整性', () => {
    it('H-001: 阵位数量应为5', () => {
      expect(FORMATION_SLOT_COUNT).toBe(5);
    });

    it('H-002: 阵型数量应为5', () => {
      expect(ALL_FORMATIONS.length).toBe(5);
    });

    it('H-003: 策略数量应为4', () => {
      expect(ALL_STRATEGIES.length).toBe(4);
    });

    it('H-004: 日志上限应为50', () => {
      expect(MAX_DEFENSE_LOGS).toBe(50);
    });
  });
});
