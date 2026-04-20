/**
 * TechPointSystem 单元测试
 * 覆盖：科技点产出、消耗、查询、序列化
 */

import { TechPointSystem } from '../TechPointSystem';
import { ACADEMY_TECH_POINT_PRODUCTION, getTechPointProduction } from '../tech-config';
import type { ISystemDeps } from '../../../../core/types';

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: jest.fn().mockReturnValue(jest.fn()),
      once: jest.fn().mockReturnValue(jest.fn()),
      emit: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn(),
    },
    config: { get: jest.fn(), set: jest.fn() },
    registry: { register: jest.fn(), get: jest.fn(), getAll: jest.fn(), has: jest.fn(), unregister: jest.fn() },
  } as unknown as ISystemDeps;
}

describe('TechPointSystem', () => {
  let sys: TechPointSystem;

  beforeEach(() => {
    sys = new TechPointSystem();
    sys.init(mockDeps());
  });

  // ═══════════════════════════════════════════
  // 1. 初始化
  // ═══════════════════════════════════════════
  describe('初始化', () => {
    it('初始科技点为 0', () => {
      expect(sys.getCurrentPoints()).toBe(0);
    });

    it('初始累计获得为 0', () => {
      expect(sys.getTotalEarned()).toBe(0);
    });

    it('初始累计消耗为 0', () => {
      expect(sys.getTotalSpent()).toBe(0);
    });

    it('无书院时产出为 0', () => {
      expect(sys.getProductionRate()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 产出
  // ═══════════════════════════════════════════
  describe('科技点产出', () => {
    it('书院等级 0 时不产出', () => {
      sys.syncAcademyLevel(0);
      sys.update(1);
      expect(sys.getCurrentPoints()).toBe(0);
    });

    it('书院等级 1 时正确产出', () => {
      sys.syncAcademyLevel(1);
      sys.update(1); // 1秒
      expect(sys.getCurrentPoints()).toBeCloseTo(0.01);
    });

    it('书院等级 10 时产出更高', () => {
      sys.syncAcademyLevel(10);
      sys.update(1);
      expect(sys.getCurrentPoints()).toBeCloseTo(0.33);
    });

    it('书院等级 20 时产出最高', () => {
      sys.syncAcademyLevel(20);
      sys.update(1);
      expect(sys.getCurrentPoints()).toBeCloseTo(1.76);
    });

    it('多帧累积正确', () => {
      sys.syncAcademyLevel(5);
      for (let i = 0; i < 100; i++) {
        sys.update(0.1); // 每帧 0.1秒，共 10 秒
      }
      // Lv5 = 0.08/秒 × 10秒 = 0.8
      expect(sys.getCurrentPoints()).toBeCloseTo(0.8);
    });

    it('累计获得随产出增加', () => {
      sys.syncAcademyLevel(1);
      sys.update(100);
      expect(sys.getTotalEarned()).toBeCloseTo(1); // 0.01 * 100
    });

    it('getProductionRate 返回正确值', () => {
      sys.syncAcademyLevel(5);
      expect(sys.getProductionRate()).toBeCloseTo(0.08);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 消耗
  // ═══════════════════════════════════════════
  describe('科技点消耗', () => {
    it('canAfford 不足时返回 false', () => {
      expect(sys.canAfford(10)).toBe(false);
    });

    it('canAfford 足够时返回 true', () => {
      sys.syncAcademyLevel(10);
      sys.update(200); // 0.33 * 200 = 66 点
      expect(sys.canAfford(50)).toBe(true);
    });

    it('trySpend 成功时扣除科技点', () => {
      sys.syncAcademyLevel(10);
      sys.update(200);
      const before = sys.getCurrentPoints();
      const result = sys.trySpend(50);
      expect(result.success).toBe(true);
      expect(sys.getCurrentPoints()).toBeCloseTo(before - 50);
    });

    it('trySpend 失败时不扣除', () => {
      const result = sys.trySpend(100);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不足');
      expect(sys.getCurrentPoints()).toBe(0);
    });

    it('消耗后 totalSpent 增加', () => {
      sys.syncAcademyLevel(10);
      sys.update(200);
      sys.trySpend(50);
      expect(sys.getTotalSpent()).toBeCloseTo(50);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 研究速度加成
  // ═══════════════════════════════════════════
  describe('研究速度加成', () => {
    it('初始无加成', () => {
      expect(sys.getResearchSpeedMultiplier()).toBe(1);
    });

    it('同步加成后倍率正确', () => {
      sys.syncResearchSpeedBonus(25);
      expect(sys.getResearchSpeedMultiplier()).toBeCloseTo(1.25);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 序列化
  // ═══════════════════════════════════════════
  describe('序列化/反序列化', () => {
    it('序列化保存科技点状态', () => {
      sys.syncAcademyLevel(10);
      sys.update(100);
      const data = sys.serialize();
      expect(data.techPoints.current).toBeCloseTo(33);
      expect(data.techPoints.totalEarned).toBeCloseTo(33);
    });

    it('反序列化恢复状态', () => {
      sys.syncAcademyLevel(10);
      sys.update(100);
      const data = sys.serialize();

      const newSys = new TechPointSystem();
      newSys.init(mockDeps());
      newSys.deserialize(data);
      expect(newSys.getCurrentPoints()).toBeCloseTo(33);
    });

    it('reset 恢复初始状态', () => {
      sys.syncAcademyLevel(10);
      sys.update(100);
      sys.reset();
      expect(sys.getCurrentPoints()).toBe(0);
      expect(sys.getTotalEarned()).toBe(0);
      expect(sys.getTotalSpent()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 配置验证
  // ═══════════════════════════════════════════
  describe('配置验证', () => {
    it('书院产出配置覆盖 1~20 级', () => {
      for (let i = 1; i <= 20; i++) {
        const prod = getTechPointProduction(i);
        expect(prod).toBeGreaterThan(0);
      }
    });

    it('高等级产出大于低等级', () => {
      for (let i = 2; i <= 20; i++) {
        const prev = getTechPointProduction(i - 1);
        const curr = getTechPointProduction(i);
        expect(curr).toBeGreaterThanOrEqual(prev);
      }
    });
  });
});
