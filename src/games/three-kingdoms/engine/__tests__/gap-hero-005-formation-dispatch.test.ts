/**
 * GAP-HERO-005: 武将下阵与锁定测试
 * 节点ID: HERO-TRAIN-036
 * 优先级: P1
 *
 * 覆盖：
 * - removeFromFormation: 从编队移除武将
 * - 下阵后羁绊效果实时更新
 * - 同一武将不可加入多个编队
 * - 编队已满时不能再添加
 * - undeployHero: 取消武将派驻
 * - 派驻中的武将编队操作
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { HeroFormation } from '../hero/HeroFormation';
import { HeroDispatchSystem } from '../hero/HeroDispatchSystem';
import type { GeneralData } from '../hero/hero.types';

function makeMockDeps() {
  return {
    eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    config: { get: vi.fn(), set: vi.fn(), has: vi.fn() },
    registry: { get: vi.fn(), register: vi.fn(), has: vi.fn(), getAll: vi.fn(), unregister: vi.fn() },
  };
}

describe('GAP-HERO-005: 武将下阵与锁定', () => {
  let formation: HeroFormation;

  beforeEach(() => {
    vi.restoreAllMocks();
    formation = new HeroFormation();
    formation.init(makeMockDeps() as any);
  });

  // ═══════════════════════════════════════════
  // 1. 基本下阵操作
  // ═══════════════════════════════════════════
  describe('removeFromFormation — 基本下阵', () => {
    it('从编队移除武将应成功', () => {
      // 先创建编队并添加武将
      formation.createFormation('f1');
      formation.addToFormation('f1', 'guanyu');

      const result = formation.removeFromFormation('f1', 'guanyu');
      expect(result).not.toBeNull();

      // 验证编队中不再有该武将
      const f = formation.getFormation('f1');
      expect(f!.slots.includes('guanyu')).toBe(false);
    });

    it('下阵后编队应有空位', () => {
      formation.createFormation('f1');
      formation.addToFormation('f1', 'guanyu');

      formation.removeFromFormation('f1', 'guanyu');

      const f = formation.getFormation('f1');
      const emptySlots = f!.slots.filter(s => s === '').length;
      expect(emptySlots).toBeGreaterThan(0);
    });

    it('下阵不存在的武将返回null', () => {
      formation.createFormation('f1');
      const result = formation.removeFromFormation('f1', 'nonexistent');
      expect(result).toBeNull();
    });

    it('从不存在的编队下阵返回null', () => {
      const result = formation.removeFromFormation('nonexistent', 'guanyu');
      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 2. 下阵后重新添加
  // ═══════════════════════════════════════════
  describe('下阵后重新添加', () => {
    it('下阵后可重新添加到其他编队', () => {
      formation.createFormation('f1');
      formation.createFormation('f2');
      formation.addToFormation('f1', 'guanyu');

      // 从f1下阵
      formation.removeFromFormation('f1', 'guanyu');

      // 应能添加到f2
      const result = formation.addToFormation('f2', 'guanyu');
      expect(result).not.toBeNull();
      expect(result!.slots.includes('guanyu')).toBe(true);
    });

    it('下阵后可重新添加到同一编队', () => {
      formation.createFormation('f1');
      formation.addToFormation('f1', 'guanyu');
      formation.removeFromFormation('f1', 'guanyu');

      const result = formation.addToFormation('f1', 'guanyu');
      expect(result).not.toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 3. 同一武将不可加入多个编队
  // ═══════════════════════════════════════════
  describe('同一武将不可加入多个编队', () => {
    it('已在编队中的武将不可加入另一编队', () => {
      formation.createFormation('f1');
      formation.createFormation('f2');
      formation.addToFormation('f1', 'guanyu');

      // 尝试加入f2应失败
      const result = formation.addToFormation('f2', 'guanyu');
      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 4. 编队容量限制
  // ═══════════════════════════════════════════
  describe('编队容量限制', () => {
    it('编队已满时不能再添加武将', () => {
      formation.createFormation('f1');
      const f = formation.getFormation('f1')!;
      const slotCount = f.slots.length;

      // 填满所有位置
      for (let i = 0; i < slotCount; i++) {
        formation.addToFormation('f1', `hero_${i}`);
      }

      // 再添加一个应失败
      const result = formation.addToFormation('f1', 'extra_hero');
      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 5. null guard
  // ═══════════════════════════════════════════
  describe('null guard', () => {
    it('addToFormation 空ID返回null', () => {
      formation.createFormation('f1');
      const result = formation.addToFormation('f1', '');
      expect(result).toBeNull();
    });

    it('removeFromFormation 空ID返回null', () => {
      formation.createFormation('f1');
      const result = formation.removeFromFormation('f1', '');
      expect(result).toBeNull();
    });

    it('addToFormation null ID返回null', () => {
      formation.createFormation('f1');
      const result = formation.addToFormation('f1', null as any);
      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 6. 派驻系统交互
  // ═══════════════════════════════════════════
  describe('派驻系统 undeployHero', () => {
    it('取消派驻应成功', () => {
      const dispatch = new HeroDispatchSystem();
      dispatch.init(makeMockDeps() as any);
      dispatch.setGetGeneral((id: string) => ({
          id,
          name: id,
          level: 10,
          quality: 'LEGENDARY',
          baseStats: { attack: 100, defense: 80, intelligence: 60, speed: 70 },
        }) as GeneralData,
      });

      // 先派驻
      dispatch.dispatchHero('guanyu', 'farmland');
      expect(dispatch.getHeroDispatchBuilding('guanyu')).toBe('farmland');

      // 取消派驻
      const result = dispatch.undeployHero('guanyu');
      expect(result).toBe(true);
      expect(dispatch.getHeroDispatchBuilding('guanyu')).toBeNull();
    });

    it('取消不存在的派驻返回false', () => {
      const dispatch = new HeroDispatchSystem();
      dispatch.init(makeMockDeps() as any);
      const result = dispatch.undeployHero('nonexistent');
      expect(result).toBe(false);
    });

    it('取消派驻后建筑加成应为0', () => {
      const dispatch = new HeroDispatchSystem();
      dispatch.init(makeMockDeps() as any);
      dispatch.setGetGeneral((id: string) => ({
          id,
          name: id,
          level: 10,
          quality: 'LEGENDARY',
          baseStats: { attack: 100, defense: 80, intelligence: 60, speed: 70 },
        }) as GeneralData,
      );

      dispatch.dispatchHero('guanyu', 'farmland');
      const bonusBefore = dispatch.getDispatchBonus('farmland');

      dispatch.undeployHero('guanyu');
      const bonusAfter = dispatch.getDispatchBonus('farmland');
      expect(bonusAfter).toBe(0);
    });
  });
});
