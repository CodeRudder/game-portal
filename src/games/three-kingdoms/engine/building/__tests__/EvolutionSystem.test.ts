/**
 * EvolutionSystem 单元测试
 * 覆盖：进化条件、进化执行、保护期、加速恢复、序列化/反序列化
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EvolutionSystem, EVOLUTION_STAGES } from '../EvolutionSystem';

describe('EvolutionSystem', () => {
  let system: EvolutionSystem;
  let buildingLevels: Record<string, number>;
  let resources: Record<string, number>;

  beforeEach(() => {
    system = new EvolutionSystem();
    buildingLevels = {};
    resources = { ore: 0, wood: 0, gold: 0 };

    system.init(
      (type: string) => buildingLevels[type] ?? 0,
      (type: string) => resources[type] ?? 0,
      (type: string, amount: number) => {
        if ((resources[type] ?? 0) >= amount) {
          resources[type] -= amount;
          return true;
        }
        return false;
      },
    );
  });

  // ─────────────────────────────────────────
  // 进化条件检查
  // ─────────────────────────────────────────

  describe('canEvolve', () => {
    it('建筑满级(Lv20)→可进化', () => {
      buildingLevels['farmland'] = 20;
      resources = { ore: 10000, wood: 10000, gold: 100000 };

      const result = system.canEvolve('farmland');
      expect(result.canEvolve).toBe(true);
    });

    it('建筑Lv19→不可进化', () => {
      buildingLevels['farmland'] = 19;
      resources = { ore: 10000, wood: 10000, gold: 100000 };

      const result = system.canEvolve('farmland');
      expect(result.canEvolve).toBe(false);
      expect(result.reason).toContain('20');
    });

    it('未达最高级时不可进化', () => {
      buildingLevels['farmland'] = 10;
      const result = system.canEvolve('farmland');
      expect(result.canEvolve).toBe(false);
    });
  });

  // ─────────────────────────────────────────
  // 进化执行
  // ─────────────────────────────────────────

  describe('evolve', () => {
    it('进化1星→等级重置Lv15，新上限Lv30，加成+10%', () => {
      buildingLevels['farmland'] = 20;
      resources = { ore: 10000, wood: 10000, gold: 100000 };

      const result = system.evolve('farmland');
      expect(result.success).toBe(true);
      expect(result.newLevel).toBe(15);
      expect(result.newMaxLevel).toBe(30);
      expect(result.starBonus).toBeCloseTo(0.10);
    });

    it('进化后材料被扣除', () => {
      buildingLevels['farmland'] = 20;
      resources = { ore: 10000, wood: 10000, gold: 100000 };

      system.evolve('farmland');
      expect(resources.ore).toBe(10000 - 5000);
      expect(resources.wood).toBe(10000 - 5000);
      expect(resources.gold).toBe(100000 - 50000);
    });

    it('材料不足→进化失败', () => {
      buildingLevels['farmland'] = 20;
      resources = { ore: 1000, wood: 10000, gold: 100000 };

      const result = system.evolve('farmland');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不足');
    });

    it('进化后星级查询正确', () => {
      buildingLevels['farmland'] = 20;
      resources = { ore: 10000, wood: 10000, gold: 100000 };

      expect(system.getEvolutionStage('farmland')).toBe(0);
      system.evolve('farmland');
      expect(system.getEvolutionStage('farmland')).toBe(1);
      expect(system.getStarBonus('farmland')).toBeCloseTo(0.10);
    });
  });

  // ─────────────────────────────────────────
  // 多星进化
  // ─────────────────────────────────────────

  describe('multi-stage evolution', () => {
    it('已进化1星→可继续2星进化（到Lv30后）', () => {
      buildingLevels['farmland'] = 20;
      resources = { ore: 100000, wood: 100000, gold: 1000000 };

      // 1星进化
      const r1 = system.evolve('farmland');
      expect(r1.success).toBe(true);
      expect(r1.newMaxLevel).toBe(30);

      // 模拟升到Lv30
      buildingLevels['farmland'] = 30;

      // 2星进化
      const r2 = system.evolve('farmland');
      expect(r2.success).toBe(true);
      expect(r2.newLevel).toBe(15);
      expect(r2.newMaxLevel).toBe(35);
      expect(r2.starBonus).toBeCloseTo(0.12);
    });

    it('1星进化后未满级→不可2星进化', () => {
      buildingLevels['farmland'] = 20;
      resources = { ore: 100000, wood: 100000, gold: 1000000 };

      system.evolve('farmland');
      buildingLevels['farmland'] = 25; // 未到Lv30

      const result = system.canEvolve('farmland');
      expect(result.canEvolve).toBe(false);
    });

    it('3星进化→达到最高', () => {
      buildingLevels['farmland'] = 20;
      resources = { ore: 999999999, wood: 999999999, gold: 999999999 };

      system.evolve('farmland'); // → 1星
      buildingLevels['farmland'] = 30;
      system.evolve('farmland'); // → 2星
      buildingLevels['farmland'] = 35;
      const r3 = system.evolve('farmland'); // → 3星

      expect(r3.success).toBe(true);
      expect(r3.newMaxLevel).toBe(40);
      expect(r3.starBonus).toBeCloseTo(0.15);

      // 3星后不可继续进化
      buildingLevels['farmland'] = 40;
      const check = system.canEvolve('farmland');
      expect(check.canEvolve).toBe(false);
      expect(check.reason).toContain('最高');
    });
  });

  // ─────────────────────────────────────────
  // 保护期
  // ─────────────────────────────────────────

  describe('protection', () => {
    it('进化后72小时保护期', () => {
      const fixedTime = 1000000;
      system._setNow(() => fixedTime);

      buildingLevels['farmland'] = 20;
      resources = { ore: 10000, wood: 10000, gold: 100000 };

      system.evolve('farmland');
      expect(system.getProtectionRemaining('farmland')).toBe(72 * 60 * 60 * 1000);

      // 推进时间
      system._setNow(() => fixedTime + 36 * 60 * 60 * 1000);
      expect(system.getProtectionRemaining('farmland')).toBe(36 * 60 * 60 * 1000);
    });

    it('未进化→无保护期', () => {
      expect(system.getProtectionRemaining('farmland')).toBe(0);
    });
  });

  // ─────────────────────────────────────────
  // 加速恢复
  // ─────────────────────────────────────────

  describe('accelerated recovery', () => {
    it('进化后Lv15→20升级速度+50%', () => {
      const fixedTime = 1000000;
      system._setNow(() => fixedTime);

      buildingLevels['farmland'] = 20;
      resources = { ore: 10000, wood: 10000, gold: 100000 };
      system.evolve('farmland');

      expect(system.getAcceleratedRecovery('farmland', 16)).toBe(0.5);
      expect(system.getAcceleratedRecovery('farmland', 20)).toBe(0.5);
    });

    it('Lv21→无加速', () => {
      const fixedTime = 1000000;
      system._setNow(() => fixedTime);

      buildingLevels['farmland'] = 20;
      resources = { ore: 10000, wood: 10000, gold: 100000 };
      system.evolve('farmland');

      expect(system.getAcceleratedRecovery('farmland', 21)).toBe(0);
    });

    it('保护期结束后→无加速', () => {
      const fixedTime = 1000000;
      system._setNow(() => fixedTime);

      buildingLevels['farmland'] = 20;
      resources = { ore: 10000, wood: 10000, gold: 100000 };
      system.evolve('farmland');

      // 保护期结束
      system._setNow(() => fixedTime + 73 * 60 * 60 * 1000);
      expect(system.getAcceleratedRecovery('farmland', 16)).toBe(0);
    });
  });

  // ─────────────────────────────────────────
  // 序列化 / 反序列化
  // ─────────────────────────────────────────

  describe('serialize / deserialize', () => {
    it('序列化后反序列化恢复一致状态', () => {
      buildingLevels['farmland'] = 20;
      resources = { ore: 100000, wood: 100000, gold: 1000000 };

      system.evolve('farmland');
      const data = system.serialize();

      const system2 = new EvolutionSystem();
      system2.deserialize(data);

      expect(system2.getEvolutionStage('farmland')).toBe(1);
      expect(system2.getStarBonus('farmland')).toBeCloseTo(0.10);
    });

    it('reset 后回到初始状态', () => {
      buildingLevels['farmland'] = 20;
      resources = { ore: 100000, wood: 100000, gold: 1000000 };

      system.evolve('farmland');
      system.reset();

      expect(system.getEvolutionStage('farmland')).toBe(0);
      expect(system.getStarBonus('farmland')).toBe(0);
    });
  });
});
