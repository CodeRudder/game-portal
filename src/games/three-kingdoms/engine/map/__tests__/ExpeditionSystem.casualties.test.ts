/**
 * ExpeditionSystem 伤亡方法测试
 *
 * 测试 applyCasualties / calculateRemainingPower / getForceHealthColor / removeForce
 * 这些方法用于攻城结算后更新编队状态、计算剩余战力、判定血条颜色。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExpeditionSystem } from '../ExpeditionSystem';
import type { ExpeditionDeps } from '../ExpeditionSystem';

describe('ExpeditionSystem — 伤亡方法', () => {
  let system: ExpeditionSystem;
  let mockDeps: ExpeditionDeps;

  beforeEach(() => {
    system = new ExpeditionSystem();
    system.init({
      eventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() },
      config: { get: vi.fn() },
      registry: { get: vi.fn(), register: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
    } as any);

    mockDeps = {
      getHero: vi.fn((id: string) => ({ id, name: `Hero ${id}` })),
      getAvailableTroops: vi.fn(() => 10000),
      consumeTroops: vi.fn(() => true),
      isHeroInFormation: vi.fn(() => true),
    };
    system.setExpeditionDeps(mockDeps);
  });

  /**
   * 辅助：创建一个编队并返回 forceId
   */
  function createTestForce(heroId = 'hero-1', troops = 1000): string {
    const result = system.createForce({ heroId, troops });
    expect(result.valid).toBe(true);
    return result.forceId!;
  }

  // ─── applyCasualties ──────────────────────────

  describe('applyCasualties', () => {
    it('正常扣除伤亡并设置状态为 returning', () => {
      const forceId = createTestForce('hero-1', 1000);

      const updated = system.applyCasualties(forceId, 500, false, 'none');

      expect(updated).not.toBeNull();
      expect(updated!.troops).toBe(500);
      expect(updated!.status).toBe('returning');

      // 内部存储也同步更新
      const force = system.getForce(forceId);
      expect(force!.troops).toBe(500);
      expect(force!.status).toBe('returning');
    });

    it('将领受伤时记录受伤等级', () => {
      const forceId = createTestForce('hero-2', 1000);

      const updated = system.applyCasualties(forceId, 200, true, 'moderate');

      expect(updated).not.toBeNull();
      expect(updated!.troops).toBe(800);
      expect(updated!.status).toBe('returning');

      // 验证将领受伤状态
      const injury = system.getHeroInjury('hero-2');
      expect(injury).toBe('moderate');

      // 验证战力倍率下降
      const multiplier = system.getHeroPowerMultiplier('hero-2');
      expect(multiplier).toBe(0.5);
    });

    it('将领重伤时正确记录', () => {
      const forceId = createTestForce('hero-5', 800);

      const updated = system.applyCasualties(forceId, 100, true, 'severe');

      expect(updated).not.toBeNull();
      expect(system.getHeroInjury('hero-5')).toBe('severe');
      expect(system.getHeroPowerMultiplier('hero-5')).toBe(0.2);
    });

    it('将领轻伤时正确记录', () => {
      const forceId = createTestForce('hero-6', 800);

      const updated = system.applyCasualties(forceId, 50, true, 'minor');

      expect(updated).not.toBeNull();
      expect(system.getHeroInjury('hero-6')).toBe('minor');
      expect(system.getHeroPowerMultiplier('hero-6')).toBe(0.8);
    });

    it('零损失时兵力不变', () => {
      const forceId = createTestForce('hero-3', 1000);

      const updated = system.applyCasualties(forceId, 0, false, 'none');

      expect(updated).not.toBeNull();
      expect(updated!.troops).toBe(1000);
      expect(updated!.status).toBe('returning');
    });

    it('伤亡超过可用兵力时 troops 为 0（Math.max 保护）', () => {
      const forceId = createTestForce('hero-4', 300);

      // 损失 999 远超 300
      const updated = system.applyCasualties(forceId, 999, false, 'none');

      expect(updated).not.toBeNull();
      expect(updated!.troops).toBe(0);
      expect(updated!.status).toBe('returning');
    });

    it('不存在的 forceId 返回 null', () => {
      const result = system.applyCasualties('non-existent-force', 100, false, 'none');
      expect(result).toBeNull();
    });

    it('heroInjured=true 但 injuryLevel=none 时不记录受伤', () => {
      const forceId = createTestForce('hero-7', 500);

      const updated = system.applyCasualties(forceId, 100, true, 'none');

      expect(updated).not.toBeNull();
      // injuryLevel 为 'none' 时 applyHeroInjury 内部直接 return
      expect(system.getHeroInjury('hero-7')).toBe('none');
    });
  });

  // ─── calculateRemainingPower ──────────────────

  describe('calculateRemainingPower', () => {
    it('健康编队战力 = troops × 1.0', () => {
      const forceId = createTestForce('hero-10', 500);

      const power = system.calculateRemainingPower(forceId);
      expect(power).toBe(500);
    });

    it('受伤将领（moderate）战力 = troops × 0.5', () => {
      const forceId = createTestForce('hero-11', 500);

      // 先让将领受伤
      system.applyCasualties(forceId, 100, true, 'moderate');
      // 此时 troops = 400
      const power = system.calculateRemainingPower(forceId);
      expect(power).toBe(400 * 0.5); // 200
    });

    it('受伤将领（severe）战力 = troops × 0.2', () => {
      const forceId = createTestForce('hero-12', 600);

      system.applyCasualties(forceId, 200, true, 'severe');
      // troops = 400
      const power = system.calculateRemainingPower(forceId);
      expect(power).toBe(400 * 0.2); // 80
    });

    it('受伤将领（minor）战力 = troops × 0.8', () => {
      const forceId = createTestForce('hero-13', 1000);

      system.applyCasualties(forceId, 100, true, 'minor');
      // troops = 900
      const power = system.calculateRemainingPower(forceId);
      expect(power).toBe(900 * 0.8); // 720
    });

    it('不存在的 forceId 返回 0', () => {
      const power = system.calculateRemainingPower('non-existent');
      expect(power).toBe(0);
    });

    it('接受数字类型的 forceId', () => {
      // calculateRemainingPower 签名为 number | string
      const forceId = createTestForce('hero-14', 300);
      // 传入字符串形式的 ID
      const power = system.calculateRemainingPower(forceId);
      expect(power).toBe(300);
    });
  });

  // ─── getForceHealthColor ──────────────────────

  describe('getForceHealthColor', () => {
    it('0% 损失 → healthy', () => {
      expect(system.getForceHealthColor(0)).toBe('healthy');
    });

    it('0.29 损失 → healthy', () => {
      expect(system.getForceHealthColor(0.29)).toBe('healthy');
    });

    it('0.30 损失 → healthy（边界值，严格大于 0.3 才进入 damaged）', () => {
      // 代码: if (troopsLostPercent > 0.3) return 'damaged'
      expect(system.getForceHealthColor(0.30)).toBe('healthy');
    });

    it('0.31 损失 → damaged', () => {
      expect(system.getForceHealthColor(0.31)).toBe('damaged');
    });

    it('0.59 损失 → damaged', () => {
      expect(system.getForceHealthColor(0.59)).toBe('damaged');
    });

    it('0.60 损失 → damaged（边界值，严格大于 0.6 才进入 critical）', () => {
      // 代码: if (troopsLostPercent > 0.6) return 'critical'
      expect(system.getForceHealthColor(0.60)).toBe('damaged');
    });

    it('0.61 损失 → critical', () => {
      expect(system.getForceHealthColor(0.61)).toBe('critical');
    });

    it('1.0 损失 → critical', () => {
      expect(system.getForceHealthColor(1.0)).toBe('critical');
    });

    it('0.50 损失 → damaged（中间值）', () => {
      expect(system.getForceHealthColor(0.50)).toBe('damaged');
    });
  });

  // ─── removeForce ──────────────────────────────

  describe('removeForce', () => {
    it('移除已存在的编队返回 true', () => {
      const forceId = createTestForce('hero-20', 500);

      const result = system.removeForce(forceId);

      expect(result).toBe(true);
      expect(system.getForce(forceId)).toBeUndefined();
      expect(system.getAllForces()).not.toContainEqual(
        expect.objectContaining({ id: forceId }),
      );
    });

    it('移除不存在的编队返回 false', () => {
      const result = system.removeForce('non-existent-force');
      expect(result).toBe(false);
    });

    it('移除 returning 状态的编队', () => {
      const forceId = createTestForce('hero-21', 800);
      system.applyCasualties(forceId, 300, false, 'none');
      expect(system.getForce(forceId)!.status).toBe('returning');

      const result = system.removeForce(forceId);
      expect(result).toBe(true);
      expect(system.getForce(forceId)).toBeUndefined();
    });

    it('移除后可以重新创建同将领的编队', () => {
      const forceId = createTestForce('hero-22', 500);

      system.removeForce(forceId);

      // 将领 hero-22 现在应该可以再次使用
      const newResult = system.createForce({ heroId: 'hero-22', troops: 600 });
      expect(newResult.valid).toBe(true);
      expect(newResult.forceId).toBeDefined();
    });
  });

  // ─── 组合场景 ─────────────────────────────────

  describe('伤亡 → 战力 → 血色 链路', () => {
    it('10% 损失: healthy + 战力接近满值', () => {
      const forceId = createTestForce('hero-30', 1000);

      system.applyCasualties(forceId, 100, false, 'none');

      // 剩余兵力
      expect(system.getForce(forceId)!.troops).toBe(900);

      // 战力
      expect(system.calculateRemainingPower(forceId)).toBe(900);

      // 血色
      expect(system.getForceHealthColor(0.10)).toBe('healthy');
    });

    it('40% 损失: damaged', () => {
      const forceId = createTestForce('hero-31', 1000);

      system.applyCasualties(forceId, 400, false, 'none');

      expect(system.getForce(forceId)!.troops).toBe(600);
      expect(system.calculateRemainingPower(forceId)).toBe(600);
      expect(system.getForceHealthColor(0.40)).toBe('damaged');
    });

    it('70% 损失: critical', () => {
      const forceId = createTestForce('hero-32', 1000);

      system.applyCasualties(forceId, 700, false, 'none');

      expect(system.getForce(forceId)!.troops).toBe(300);
      expect(system.calculateRemainingPower(forceId)).toBe(300);
      expect(system.getForceHealthColor(0.70)).toBe('critical');
    });

    it('40% 损失 + moderate 伤: damaged + 战力双降', () => {
      const forceId = createTestForce('hero-33', 1000);

      system.applyCasualties(forceId, 400, true, 'moderate');

      expect(system.getForce(forceId)!.troops).toBe(600);
      // 战力 = 600 × 0.5 = 300
      expect(system.calculateRemainingPower(forceId)).toBe(300);
      expect(system.getForceHealthColor(0.40)).toBe('damaged');
    });
  });

  // ─── H7: 将领受伤影响战力衰减 ─────────────────

  describe('H7: 将领受伤影响战力', () => {
    it('无伤将领 → 系数 1.0', () => {
      const modifier = system.getInjuryPowerModifier('none');
      expect(modifier).toBe(1.0);
    });

    it('轻伤将领 → 系数 0.8', () => {
      const modifier = system.getInjuryPowerModifier('minor');
      expect(modifier).toBe(0.8);
    });

    it('中伤将领 → 系数 0.5', () => {
      const modifier = system.getInjuryPowerModifier('moderate');
      expect(modifier).toBe(0.5);
    });

    it('重伤将领 → 系数 0.2', () => {
      const modifier = system.getInjuryPowerModifier('severe');
      expect(modifier).toBe(0.2);
    });

    it('编队实际战力 = 基础战力 * 受伤系数', () => {
      const forceId = createTestForce('hero-h7-1', 1000);

      // 先让将领受伤（moderate = 0.5）
      system.applyCasualties(forceId, 200, true, 'moderate');
      // troops = 800, injury = moderate (0.5)
      const effectivePower = system.calculateEffectivePower(system.getForce(forceId)!);
      expect(effectivePower).toBe(800 * 0.5); // 400
    });

    it('无将领受伤的编队 → 系数 1.0', () => {
      const forceId = createTestForce('hero-h7-2', 1000);

      // 不受伤
      system.applyCasualties(forceId, 100, false, 'none');
      // troops = 900, 无伤
      const effectivePower = system.calculateEffectivePower(system.getForce(forceId)!);
      expect(effectivePower).toBe(900 * 1.0); // 900
    });
  });
});
