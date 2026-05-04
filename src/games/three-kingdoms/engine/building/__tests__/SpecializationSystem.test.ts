/**
 * SpecializationSystem 单元测试
 * 覆盖：特化解锁、选择、加成、重置、序列化/反序列化
 */

import { describe, it, expect } from 'vitest';
import { SpecializationSystem, SPECIALIZATIONS } from '../SpecializationSystem';

describe('SpecializationSystem', () => {
  let system: SpecializationSystem;
  let levels: Record<string, number>;

  beforeEach(() => {
    system = new SpecializationSystem();
    levels = {};
    system.init((type: string) => levels[type] ?? 0);
  });

  // ─────────────────────────────────────────
  // 特化资格检查
  // ─────────────────────────────────────────

  describe('canSpecialize', () => {
    it('建筑Lv10 → 可特化', () => {
      levels.farmland = 10;
      expect(system.canSpecialize('farmland')).toBe(true);
    });

    it('建筑Lv9 → 不可特化', () => {
      levels.farmland = 9;
      expect(system.canSpecialize('farmland')).toBe(false);
    });

    it('不支持的建筑类型 → 不可特化', () => {
      levels.castle = 10;
      expect(system.canSpecialize('castle')).toBe(false);
    });

    it('已特化建筑不可再次特化', () => {
      levels.farmland = 10;
      system.chooseSpecialization('farmland', 'quantity');
      expect(system.canSpecialize('farmland')).toBe(false);
    });
  });

  // ─────────────────────────────────────────
  // 特化选项
  // ─────────────────────────────────────────

  describe('getSpecializationOptions', () => {
    it('农田有2个特化方向', () => {
      const options = system.getSpecializationOptions('farmland');
      expect(options).toHaveLength(2);
      expect(options.map(o => o.id)).toEqual(['quantity', 'quality']);
    });

    it('主城无特化方向', () => {
      const options = system.getSpecializationOptions('castle');
      expect(options).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────
  // 选择特化
  // ─────────────────────────────────────────

  describe('chooseSpecialization', () => {
    it('选择丰产 → 产出+15%', () => {
      levels.farmland = 10;
      const result = system.chooseSpecialization('farmland', 'quantity');
      expect(result.success).toBe(true);

      const bonus = system.getSpecializationBonus('farmland');
      expect(bonus.productionMultiplier).toBeCloseTo(0.15);
    });

    it('选择精耕 → 产出+10%+解锁精英资源', () => {
      levels.farmland = 10;
      const result = system.chooseSpecialization('farmland', 'quality');
      expect(result.success).toBe(true);

      const bonus = system.getSpecializationBonus('farmland');
      expect(bonus.productionMultiplier).toBeCloseTo(0.10);
      expect(bonus.unlockEliteResource).toBe(true);
    });

    it('已特化建筑不可再次选择', () => {
      levels.farmland = 10;
      system.chooseSpecialization('farmland', 'quantity');

      const result = system.chooseSpecialization('farmland', 'quality');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('已选择');
    });

    it('等级不足不可选择', () => {
      levels.farmland = 9;
      const result = system.chooseSpecialization('farmland', 'quantity');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('等级不足');
    });

    it('无效的特化方向', () => {
      levels.farmland = 10;
      const result = system.chooseSpecialization('farmland', 'invalid_spec');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('无效');
    });
  });

  // ─────────────────────────────────────────
  // 获取特化信息
  // ─────────────────────────────────────────

  describe('getSpecialization', () => {
    it('未特化 → null', () => {
      expect(system.getSpecialization('farmland')).toBeNull();
    });

    it('已特化 → 返回选项', () => {
      levels.farmland = 10;
      system.chooseSpecialization('farmland', 'quantity');
      const spec = system.getSpecialization('farmland');
      expect(spec).not.toBeNull();
      expect(spec!.id).toBe('quantity');
      expect(spec!.label).toBe('丰产');
    });
  });

  // ─────────────────────────────────────────
  // 重置特化
  // ─────────────────────────────────────────

  describe('resetSpecialization', () => {
    it('重置需道具', () => {
      levels.farmland = 10;
      system.chooseSpecialization('farmland', 'quantity');

      // 没有道具 → 重置失败
      expect(system.resetSpecialization('farmland', false)).toBe(false);
      expect(system.getSpecialization('farmland')).not.toBeNull();

      // 有道具 → 重置成功
      expect(system.resetSpecialization('farmland', true)).toBe(true);
      expect(system.getSpecialization('farmland')).toBeNull();
    });

    it('未特化建筑重置 → 失败', () => {
      expect(system.resetSpecialization('farmland', true)).toBe(false);
    });
  });

  // ─────────────────────────────────────────
  // 序列化 / 反序列化
  // ─────────────────────────────────────────

  describe('serialize / deserialize', () => {
    it('序列化后反序列化恢复一致状态', () => {
      levels.farmland = 10;
      levels.barracks = 10;
      system.chooseSpecialization('farmland', 'quantity');
      system.chooseSpecialization('barracks', 'assault');

      const data = system.serialize();
      expect(data.choices.farmland).toBe('quantity');
      expect(data.choices.barracks).toBe('assault');

      const system2 = new SpecializationSystem();
      system2.deserialize(data);

      expect(system2.getSpecialization('farmland')?.id).toBe('quantity');
      expect(system2.getSpecialization('barracks')?.id).toBe('assault');
      expect(system2.getSpecializationBonus('farmland').productionMultiplier).toBeCloseTo(0.15);
    });

    it('reset 后清除所有选择', () => {
      levels.farmland = 10;
      system.chooseSpecialization('farmland', 'quantity');
      system.reset();
      expect(system.getSpecialization('farmland')).toBeNull();
    });
  });

  // ─────────────────────────────────────────
  // 7建筑完整性
  // ─────────────────────────────────────────

  describe('completeness', () => {
    it('7种建筑各有2个特化方向', () => {
      const buildingTypes = Object.keys(SPECIALIZATIONS);
      expect(buildingTypes).toHaveLength(7);
      for (const bt of buildingTypes) {
        expect(SPECIALIZATIONS[bt]).toHaveLength(2);
      }
    });
  });
});
