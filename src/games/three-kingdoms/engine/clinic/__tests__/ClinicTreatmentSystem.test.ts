/**
 * ClinicTreatmentSystem 单元测试
 *
 * 覆盖：
 * - 伤兵入池
 * - 治疗：消耗grain→恢复10%伤兵
 * - 治疗冷却30分钟内不可再次治疗
 * - 被动恢复速率
 * - tick被动恢复
 * - 治疗后产出Buff+10%持续10分钟
 * - Buff过期后产出恢复正常
 * - 序列化/反序列化
 */

import { ClinicTreatmentSystem } from '../ClinicTreatmentSystem';
import {
  TREATMENT_COOLDOWN_MS,
  PRODUCTION_BUFF_DURATION_MS,
  PRODUCTION_BUFF_BONUS,
} from '../clinic.types';

// ── 辅助：创建 mock 资源系统 ──
function makeResources(initialGrain: number) {
  const resources: Record<string, number> = {
    grain: initialGrain,
  };

  return {
    getResource: (type: string) => resources[type] ?? 0,
    spendResource: (type: string, amount: number): boolean => {
      if ((resources[type] ?? 0) < amount) return false;
      resources[type] -= amount;
      return true;
    },
    getRemaining: (type: string) => resources[type] ?? 0,
  };
}

describe('ClinicTreatmentSystem', () => {
  let system: ClinicTreatmentSystem;
  let resources: ReturnType<typeof makeResources>;
  const baseTime = 1000000;

  beforeEach(() => {
    system = new ClinicTreatmentSystem();
    resources = makeResources(10000);
    system.init(1, resources.getResource, resources.spendResource);
    system.setNow(baseTime);
  });

  // ═══════════════════════════════════════════
  // 1. 伤兵入池
  // ═══════════════════════════════════════════
  describe('伤兵入池', () => {
    it('伤兵入池100→totalWounded=100', () => {
      system.addWounded(100);

      const pool = system.getWoundedPool();
      expect(pool.totalWounded).toBe(100);
    });

    it('按兵种分类入池', () => {
      system.addWounded(50, 'infantry');
      system.addWounded(30, 'cavalry');
      system.addWounded(20, 'archer');

      const pool = system.getWoundedPool();
      expect(pool.totalWounded).toBe(100);
      expect(pool.woundedByType.infantry).toBe(50);
      expect(pool.woundedByType.cavalry).toBe(30);
      expect(pool.woundedByType.archer).toBe(20);
    });

    it('入池数量为0时不影响', () => {
      system.addWounded(0);
      expect(system.getWoundedPool().totalWounded).toBe(0);
    });

    it('入池数量为负时不影响', () => {
      system.addWounded(-10);
      expect(system.getWoundedPool().totalWounded).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 治疗
  // ═══════════════════════════════════════════
  describe('治疗', () => {
    it('消耗grain→恢复10%伤兵(10人)', () => {
      system.addWounded(100);

      const result = system.treat();

      expect(result.success).toBe(true);
      expect(result.healed).toBe(10);
      expect(result.cost.grain).toBe(1000); // 10% × 10000
      expect(result.buffActive).toBe(true);
    });

    it('治疗后伤兵池减少', () => {
      system.addWounded(100);
      system.treat();

      const pool = system.getWoundedPool();
      expect(pool.totalWounded).toBe(90);
    });

    it('没有伤兵时治疗失败', () => {
      const result = system.treat();

      expect(result.success).toBe(false);
      expect(result.reason).toBe('没有伤兵需要治疗');
    });
  });

  // ═══════════════════════════════════════════
  // 3. 治疗冷却
  // ═══════════════════════════════════════════
  describe('治疗冷却', () => {
    it('治疗冷却30分钟内不可再次治疗', () => {
      system.addWounded(200);

      // 第一次治疗成功
      const result1 = system.treat();
      expect(result1.success).toBe(true);

      // 冷却中，第二次治疗失败
      const result2 = system.treat();
      expect(result2.success).toBe(false);
      expect(result2.reason).toBe('治疗冷却中');
    });

    it('冷却结束后可以再次治疗', () => {
      system.addWounded(200);

      system.treat();

      // 推进时间超过冷却
      system.setNow(baseTime + TREATMENT_COOLDOWN_MS + 1);

      const result = system.treat();
      expect(result.success).toBe(true);
    });

    it('isTreatmentOnCooldown返回正确状态', () => {
      system.addWounded(200);

      expect(system.isTreatmentOnCooldown()).toBe(false);

      system.treat();
      expect(system.isTreatmentOnCooldown()).toBe(true);

      system.setNow(baseTime + TREATMENT_COOLDOWN_MS + 1);
      expect(system.isTreatmentOnCooldown()).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 被动恢复速率
  // ═══════════════════════════════════════════
  describe('被动恢复速率', () => {
    it('被动恢复速率=clinicLevel×2%', () => {
      expect(system.passiveHealRate()).toBe(0.02); // level 1
    });

    it('医馆等级5时被动恢复速率=10%', () => {
      system.init(5, resources.getResource, resources.spendResource);
      expect(system.passiveHealRate()).toBe(0.1);
    });

    it('医馆等级10时被动恢复速率=20%', () => {
      system.init(10, resources.getResource, resources.spendResource);
      expect(system.passiveHealRate()).toBe(0.2);
    });
  });

  // ═══════════════════════════════════════════
  // 5. tick被动恢复
  // ═══════════════════════════════════════════
  describe('tick被动恢复', () => {
    it('tick被动恢复伤兵', () => {
      system.addWounded(1000);

      // level 1: rate = 0.02/s, delta=1000ms → fraction=0.02, healed=20
      const healed = system.tickPassiveHeal(1000);

      expect(healed).toBe(20);
      expect(system.getWoundedPool().totalWounded).toBe(980);
    });

    it('没有伤兵时tick恢复0', () => {
      const healed = system.tickPassiveHeal(1000);
      expect(healed).toBe(0);
    });

    it('delta为0时恢复0', () => {
      system.addWounded(100);
      const healed = system.tickPassiveHeal(0);
      expect(healed).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 产出Buff
  // ═══════════════════════════════════════════
  describe('产出Buff', () => {
    it('治疗后产出Buff+10%持续10分钟', () => {
      system.addWounded(100);
      system.treat();

      // Buff激活中
      expect(system.getProductionBuff()).toBe(PRODUCTION_BUFF_BONUS);
    });

    it('Buff过期后产出恢复正常', () => {
      system.addWounded(100);
      system.treat();

      // 推进时间超过Buff持续时间
      system.setNow(baseTime + PRODUCTION_BUFF_DURATION_MS + 1);

      expect(system.getProductionBuff()).toBe(0);
    });

    it('未治疗时无产出Buff', () => {
      expect(system.getProductionBuff()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 7. 序列化/反序列化
  // ═══════════════════════════════════════════
  describe('序列化/反序列化', () => {
    it('序列化后反序列化恢复状态', () => {
      system.addWounded(100, 'infantry');
      system.addWounded(50, 'cavalry');
      system.treat();

      const data = system.serialize();
      const newSystem = new ClinicTreatmentSystem();
      newSystem.deserialize(data);
      newSystem.setNow(baseTime); // 保持同一时间线

      const pool = newSystem.getWoundedPool();
      // 150 total, heal 10% = 15, remaining = 135
      expect(pool.totalWounded).toBe(135);
    });

    it('反序列化无效数据不崩溃', () => {
      expect(() => system.deserialize('invalid json')).not.toThrow();
    });

    it('反序列化恢复医馆等级', () => {
      system.init(5, resources.getResource, resources.spendResource);
      system.addWounded(50);

      const data = system.serialize();
      const newSystem = new ClinicTreatmentSystem();
      newSystem.deserialize(data);

      expect(newSystem.getClinicLevel()).toBe(5);
    });
  });

  // ═══════════════════════════════════════════
  // 8. 重置
  // ═══════════════════════════════════════════
  describe('重置', () => {
    it('重置后伤兵池清空', () => {
      system.addWounded(100);
      system.reset();

      expect(system.getWoundedPool().totalWounded).toBe(0);
    });

    it('重置后医馆等级恢复为1', () => {
      system.init(5, resources.getResource, resources.spendResource);
      expect(system.getClinicLevel()).toBe(5);

      system.reset();
      expect(system.getClinicLevel()).toBe(1);
    });

    it('重置后冷却清除', () => {
      system.addWounded(100);
      system.treat();
      expect(system.isTreatmentOnCooldown()).toBe(true);

      system.reset();
      expect(system.isTreatmentOnCooldown()).toBe(false);
    });

    it('重置后Buff清除', () => {
      system.addWounded(100);
      system.treat();
      expect(system.getProductionBuff()).toBe(PRODUCTION_BUFF_BONUS);

      system.reset();
      expect(system.getProductionBuff()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 9. 未初始化
  // ═══════════════════════════════════════════
  describe('未初始化', () => {
    it('未初始化时治疗失败', () => {
      const uninitialized = new ClinicTreatmentSystem();
      uninitialized.addWounded(100);
      uninitialized.setNow(baseTime);

      const result = uninitialized.treat();
      expect(result.success).toBe(false);
      expect(result.reason).toBe('系统未初始化');
    });
  });
});
