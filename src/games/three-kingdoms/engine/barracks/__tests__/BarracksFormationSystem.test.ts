/**
 * BarracksFormationSystem 单元测试
 *
 * 覆盖：
 * - 编队创建（解锁规则）
 * - 兵力分配/移除
 * - 兵种切换
 * - 编队删除（兵力返还）
 * - 序列化/反序列化
 * - 边界情况
 */

import {
  BarracksFormationSystem,
  type BarracksResourcePool,
} from '../BarracksFormationSystem';
import type { TroopType } from '../barracks.types';

// ── 辅助：创建 mock 资源池 ──
function makeResourcePool(initialTroops: number): BarracksResourcePool & { troops: number } {
  const pool = {
    troops: initialTroops,
    getTroops() { return pool.troops; },
    spendTroops(amount: number): boolean {
      if (pool.troops < amount) return false;
      pool.troops -= amount;
      return true;
    },
    returnTroops(amount: number): void {
      pool.troops += amount;
    },
  };
  return pool;
}

describe('BarracksFormationSystem', () => {
  let system: BarracksFormationSystem;
  let pool: ReturnType<typeof makeResourcePool>;

  beforeEach(() => {
    system = new BarracksFormationSystem();
    pool = makeResourcePool(1000);
  });

  // ═══════════════════════════════════════════
  // 1. 编队创建 & 解锁
  // ═══════════════════════════════════════════
  describe('编队创建 & 解锁', () => {
    it('兵营Lv1默认解锁编队1', () => {
      system.initWithPool(1, pool);
      const result = system.createFormation();
      expect(result.success).toBe(true);
      expect(result.formationId).toBe('1');

      const formation = system.getFormation('1');
      expect(formation).not.toBeNull();
      expect(formation!.name).toBe('第一营');
      expect(formation!.troopType).toBe('infantry');
      expect(formation!.troops).toBe(0);
    });

    it('兵营Lv10解锁编队2', () => {
      system.initWithPool(10, pool);

      const r1 = system.createFormation();
      expect(r1.success).toBe(true);
      expect(r1.formationId).toBe('1');

      const r2 = system.createFormation();
      expect(r2.success).toBe(true);
      expect(r2.formationId).toBe('2');
    });

    it('兵营Lv20解锁编队3', () => {
      system.initWithPool(20, pool);

      const r1 = system.createFormation();
      const r2 = system.createFormation();
      const r3 = system.createFormation();
      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);
      expect(r3.success).toBe(true);
      expect(r3.formationId).toBe('3');
      expect(system.getAllFormations()).toHaveLength(3);
    });

    it('兵营Lv5只能创建1个编队', () => {
      system.initWithPool(5, pool);

      const r1 = system.createFormation();
      expect(r1.success).toBe(true);

      const r2 = system.createFormation();
      expect(r2.success).toBe(false);
      expect(r2.reason).toContain('编队已满');
    });

    it('编队已满时无法创建', () => {
      system.initWithPool(20, pool);
      system.createFormation();
      system.createFormation();
      system.createFormation();

      const r4 = system.createFormation();
      expect(r4.success).toBe(false);
      expect(r4.reason).toContain('编队已满');
    });

    it('创建编队时指定名称、主将和兵种', () => {
      system.initWithPool(1, pool);
      const result = system.createFormation('虎豹骑', '曹操', 'cavalry');
      expect(result.success).toBe(true);

      const f = system.getFormation(result.formationId!);
      expect(f!.name).toBe('虎豹骑');
      expect(f!.commander).toBe('曹操');
      expect(f!.troopType).toBe('cavalry');
    });
  });

  // ═══════════════════════════════════════════
  // 2. 兵力分配
  // ═══════════════════════════════════════════
  describe('兵力分配', () => {
    it('分配100兵力到编队', () => {
      system.initWithPool(1, pool);
      system.createFormation();

      const result = system.assignTroops('1', 100);
      expect(result.success).toBe(true);
      expect(system.getFormation('1')!.troops).toBe(100);
      expect(pool.troops).toBe(900);
    });

    it('兵力不足时分配失败', () => {
      system.initWithPool(1, pool);
      system.createFormation();

      const result = system.assignTroops('1', 2000);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('兵力不足');
      expect(system.getFormation('1')!.troops).toBe(0);
      expect(pool.troops).toBe(1000);
    });

    it('分配兵力到不存在的编队失败', () => {
      system.initWithPool(1, pool);
      const result = system.assignTroops('99', 100);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不存在');
    });

    it('分配0或负数兵力失败', () => {
      system.initWithPool(1, pool);
      system.createFormation();

      expect(system.assignTroops('1', 0).success).toBe(false);
      expect(system.assignTroops('1', -50).success).toBe(false);
    });

    it('多次分配兵力累加', () => {
      system.initWithPool(1, pool);
      system.createFormation();

      system.assignTroops('1', 100);
      system.assignTroops('1', 200);

      expect(system.getFormation('1')!.troops).toBe(300);
      expect(pool.troops).toBe(700);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 兵力移除
  // ═══════════════════════════════════════════
  describe('兵力移除', () => {
    it('移除50兵力从编队', () => {
      system.initWithPool(1, pool);
      system.createFormation();
      system.assignTroops('1', 200);

      const result = system.removeTroops('1', 50);
      expect(result.success).toBe(true);
      expect(system.getFormation('1')!.troops).toBe(150);
      expect(pool.troops).toBe(850);
    });

    it('移除兵力超过编队拥有量时失败', () => {
      system.initWithPool(1, pool);
      system.createFormation();
      system.assignTroops('1', 100);

      const result = system.removeTroops('1', 200);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('编队兵力不足');
      expect(system.getFormation('1')!.troops).toBe(100);
    });

    it('移除全部兵力', () => {
      system.initWithPool(1, pool);
      system.createFormation();
      system.assignTroops('1', 300);

      const result = system.removeTroops('1', 300);
      expect(result.success).toBe(true);
      expect(system.getFormation('1')!.troops).toBe(0);
      expect(pool.troops).toBe(1000);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 兵种切换
  // ═══════════════════════════════════════════
  describe('兵种切换', () => {
    it('切换兵种步兵→骑兵', () => {
      system.initWithPool(1, pool);
      system.createFormation(undefined, undefined, 'infantry');

      const result = system.changeTroopType('1', 'cavalry');
      expect(result).toBe(true);
      expect(system.getFormation('1')!.troopType).toBe('cavalry');
    });

    it('切换不存在的编队返回false', () => {
      system.initWithPool(1, pool);
      const result = system.changeTroopType('99', 'archer');
      expect(result).toBe(false);
    });

    it('切换兵种不影响兵力', () => {
      system.initWithPool(1, pool);
      system.createFormation();
      system.assignTroops('1', 150);

      system.changeTroopType('1', 'archer');
      expect(system.getFormation('1')!.troops).toBe(150);
      expect(system.getFormation('1')!.troopType).toBe('archer');
    });
  });

  // ═══════════════════════════════════════════
  // 5. 查询
  // ═══════════════════════════════════════════
  describe('查询', () => {
    it('getMaxFormations根据兵营等级返回正确上限', () => {
      system.initWithPool(1, pool);
      expect(system.getMaxFormations()).toBe(1);

      system.initWithPool(10, pool);
      expect(system.getMaxFormations()).toBe(2);

      system.initWithPool(20, pool);
      expect(system.getMaxFormations()).toBe(3);

      system.initWithPool(25, pool);
      expect(system.getMaxFormations()).toBe(3);
    });

    it('getTotalTroopsInFormations统计所有编队兵力', () => {
      system.initWithPool(20, pool);
      system.createFormation();
      system.createFormation();
      system.createFormation();

      system.assignTroops('1', 100);
      system.assignTroops('2', 200);
      system.assignTroops('3', 300);

      expect(system.getTotalTroopsInFormations()).toBe(600);
    });

    it('getFormation返回null当编队不存在', () => {
      system.initWithPool(1, pool);
      expect(system.getFormation('99')).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 6. 编队删除
  // ═══════════════════════════════════════════
  describe('编队删除', () => {
    it('删除编队时兵力返还资源池', () => {
      system.initWithPool(1, pool);
      system.createFormation();
      system.assignTroops('1', 200);

      const result = system.deleteFormation('1');
      expect(result.success).toBe(true);
      expect(pool.troops).toBe(1000);
      expect(system.getFormation('1')).toBeNull();
    });

    it('删除不存在的编队失败', () => {
      system.initWithPool(1, pool);
      const result = system.deleteFormation('99');
      expect(result.success).toBe(false);
    });

    it('删除编队后可以重新创建', () => {
      system.initWithPool(1, pool);
      system.createFormation();
      system.deleteFormation('1');

      const result = system.createFormation();
      expect(result.success).toBe(true);
      expect(result.formationId).toBe('1');
    });
  });

  // ═══════════════════════════════════════════
  // 7. 序列化/反序列化
  // ═══════════════════════════════════════════
  describe('序列化/反序列化', () => {
    it('序列化后反序列化恢复状态', () => {
      system.initWithPool(20, pool);
      system.createFormation('第一营', '关羽', 'infantry');
      system.createFormation('虎豹骑', '曹操', 'cavalry');
      system.assignTroops('1', 150);
      system.assignTroops('2', 300);

      const data = system.serialize();

      const system2 = new BarracksFormationSystem();
      system2.initWithPool(20, pool);
      system2.deserialize(data);

      expect(system2.getFormation('1')!.name).toBe('第一营');
      expect(system2.getFormation('1')!.commander).toBe('关羽');
      expect(system2.getFormation('1')!.troops).toBe(150);
      expect(system2.getFormation('1')!.troopType).toBe('infantry');
      expect(system2.getFormation('2')!.name).toBe('虎豹骑');
      expect(system2.getFormation('2')!.troopType).toBe('cavalry');
      expect(system2.getFormation('2')!.troops).toBe(300);
      expect(system2.getAllFormations()).toHaveLength(2);
    });

    it('反序列化无效数据时保持当前状态', () => {
      system.initWithPool(1, pool);
      system.createFormation();

      system.deserialize('invalid json');
      expect(system.getFormation('1')).not.toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 8. reset
  // ═══════════════════════════════════════════
  describe('reset', () => {
    it('重置系统到初始状态', () => {
      system.initWithPool(20, pool);
      system.createFormation();
      system.assignTroops('1', 500);

      system.reset();

      expect(system.getAllFormations()).toHaveLength(0);
      expect(system.getTotalTroopsInFormations()).toBe(0);
      expect(system.getBarracksLevel()).toBe(1);
    });
  });
});
