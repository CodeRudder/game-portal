/**
 * TrapSystem 单元测试
 * 覆盖：部署、上限、触发、一次性/持续、序列化/反序列化
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TrapSystem, TRAP_TYPES } from '../TrapSystem';

describe('TrapSystem', () => {
  let system: TrapSystem;
  let ore: number;

  beforeEach(() => {
    system = new TrapSystem();
    ore = 0;

    system.init(
      10, // wallLevel = 10
      () => ore,
      (n: number) => {
        if (ore >= n) {
          ore -= n;
          return true;
        }
        return false;
      },
    );
  });

  // ─────────────────────────────────────────
  // 部署
  // ─────────────────────────────────────────

  describe('deployTrap', () => {
    it('部署箭塔→消耗矿石200→库存+1', () => {
      ore = 1000;
      const result = system.deployTrap('arrow_tower');
      expect(result.success).toBe(true);
      expect(ore).toBe(800); // 1000 - 200
      expect(system.getTrapInventory().arrow_tower).toBe(1);
    });

    it('部署拒马→消耗矿石150', () => {
      ore = 1000;
      const result = system.deployTrap('barricade');
      expect(result.success).toBe(true);
      expect(ore).toBe(850); // 1000 - 150
    });

    it('部署陷坑→消耗矿石300', () => {
      ore = 1000;
      const result = system.deployTrap('pitfall');
      expect(result.success).toBe(true);
      expect(ore).toBe(700); // 1000 - 300
    });

    it('矿石不足→部署失败', () => {
      ore = 100;
      const result = system.deployTrap('arrow_tower');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('矿石不足');
      expect(system.getTrapInventory().arrow_tower).toBeUndefined();
    });

    it('未知陷阱类型→失败', () => {
      ore = 10000;
      const result = system.deployTrap('unknown');
      expect(result.success).toBe(false);
    });
  });

  // ─────────────────────────────────────────
  // 上限
  // ─────────────────────────────────────────

  describe('max traps', () => {
    it('陷阱上限=wallLevel×5', () => {
      expect(system.getMaxTraps()).toBe(50); // 10 × 5
    });

    it('超过上限→部署失败', () => {
      ore = 999999;

      // wallLevel=10, max=50
      for (let i = 0; i < 50; i++) {
        system.deployTrap('arrow_tower');
      }

      expect(system.getTrapInventory().arrow_tower).toBe(50);
      const result = system.deployTrap('arrow_tower');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('上限');
    });

    it('不同wallLevel上限不同', () => {
      system.init(
        5,
        () => ore,
        (n) => {
          if (ore >= n) { ore -= n; return true; }
          return false;
        },
      );
      expect(system.getMaxTraps()).toBe(25); // 5 × 5
    });
  });

  // ─────────────────────────────────────────
  // 触发
  // ─────────────────────────────────────────

  describe('triggerTraps', () => {
    it('触发陷阱→造成伤害→一次性陷阱库存-1', () => {
      ore = 999999;
      system.deployTrap('pitfall'); // 1500 damage, single_use

      const result = system.triggerTraps();
      expect(result.totalDamage).toBe(1500);
      expect(result.trapsUsed.pitfall).toBe(1);

      // 陷坑(一次性)触发后消失
      expect(system.getTrapInventory().pitfall).toBe(0);
    });

    it('箭塔(持续)触发后保留', () => {
      ore = 999999;
      system.deployTrap('arrow_tower'); // 500 damage, persistent

      const result = system.triggerTraps();
      expect(result.totalDamage).toBe(500);
      expect(result.trapsUsed.arrow_tower).toBe(1);

      // 箭塔(持续)触发后保留
      expect(system.getTrapInventory().arrow_tower).toBe(1);
    });

    it('拒马(持续)触发后保留', () => {
      ore = 999999;
      system.deployTrap('barricade'); // 200 damage, persistent

      const result = system.triggerTraps();
      expect(result.totalDamage).toBe(200);

      // 拒马(持续)触发后保留
      expect(system.getTrapInventory().barricade).toBe(1);
    });

    it('混合陷阱触发', () => {
      ore = 999999;
      system.deployTrap('arrow_tower'); // 500
      system.deployTrap('arrow_tower'); // 500
      system.deployTrap('pitfall');     // 1500
      system.deployTrap('barricade');   // 200

      const result = system.triggerTraps();
      expect(result.totalDamage).toBe(500 + 500 + 1500 + 200);

      // 陷坑消失，其余保留
      expect(system.getTrapInventory().pitfall).toBe(0);
      expect(system.getTrapInventory().arrow_tower).toBe(2);
      expect(system.getTrapInventory().barricade).toBe(1);
    });

    it('无陷阱→触发0伤害', () => {
      const result = system.triggerTraps();
      expect(result.totalDamage).toBe(0);
      expect(Object.keys(result.trapsUsed).length).toBe(0);
    });
  });

  // ─────────────────────────────────────────
  // 陷阱总效果
  // ─────────────────────────────────────────

  describe('getTrapBonus', () => {
    it('计算总伤害和减速', () => {
      ore = 999999;
      system.deployTrap('arrow_tower'); // 500 damage
      system.deployTrap('barricade');   // 200 damage, 30% slow

      const bonus = system.getTrapBonus();
      expect(bonus.damage).toBe(700);
      expect(bonus.slow).toBe(30);
    });

    it('无陷阱→0效果', () => {
      const bonus = system.getTrapBonus();
      expect(bonus.damage).toBe(0);
      expect(bonus.slow).toBe(0);
    });
  });

  // ─────────────────────────────────────────
  // 序列化 / 反序列化
  // ─────────────────────────────────────────

  describe('serialize / deserialize', () => {
    it('序列化后反序列化恢复一致', () => {
      ore = 999999;
      system.deployTrap('arrow_tower');
      system.deployTrap('pitfall');

      const data = system.serialize();
      const system2 = new TrapSystem();
      system2.init(10, () => 0, () => false);
      system2.deserialize(data);

      expect(system2.getTrapInventory().arrow_tower).toBe(1);
      expect(system2.getTrapInventory().pitfall).toBe(1);
    });

    it('reset 后回到初始状态', () => {
      ore = 999999;
      system.deployTrap('arrow_tower');
      system.reset();

      expect(system.getTrapInventory().arrow_tower).toBeUndefined();
    });
  });
});
