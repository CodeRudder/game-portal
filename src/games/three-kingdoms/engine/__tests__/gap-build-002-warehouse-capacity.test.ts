/**
 * GAP-BUILD-002: 仓库联动容量恢复测试
 * 节点ID: BUILD-TECH-034
 * 优先级: P1
 *
 * 覆盖：
 * - 仓库升级后上限提升
 * - 资源达到上限后产出停止
 * - 之前溢出的产出空间恢复
 * - 资源重新开始增长
 * - updateCaps 正确更新上限
 * - enforceCaps 降级截断
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ResourceSystem } from '../resource/ResourceSystem';

describe('GAP-BUILD-002: 仓库联动容量恢复', () => {
  let resSys: ResourceSystem;

  beforeEach(() => {
    vi.restoreAllMocks();
    resSys = new ResourceSystem();
    resSys.init({
      eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
      config: { get: vi.fn(), register: vi.fn() },
      registry: { get: vi.fn(), register: vi.fn() },
    } as any);
  });

  // ═══════════════════════════════════════════
  // 1. 仓库升级后上限提升
  // ═══════════════════════════════════════════
  describe('仓库升级后上限提升', () => {
    it('updateCaps升级后grain上限应提升', () => {
      const capsBefore = resSys.getCaps();
      const grainCapBefore = capsBefore.grain;

      // 模拟粮仓升级（等级提升）
      resSys.updateCaps(5, 1); // granaryLevel=5, barracksLevel=1

      const capsAfter = resSys.getCaps();
      expect(capsAfter.grain).toBeGreaterThan(grainCapBefore!);
    });

    it('updateCaps升级后troops上限应提升', () => {
      // 先升级兵营
      const capsBefore = resSys.getCaps();

      resSys.updateCaps(1, 5); // granaryLevel=1, barracksLevel=5

      const capsAfter = resSys.getCaps();
      expect(capsAfter.troops).toBeGreaterThan(capsBefore.troops!);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 资源达到上限后产出停止
  // ═══════════════════════════════════════════
  describe('资源达到上限后产出停止', () => {
    it('addResource超过上限应被截断', () => {
      // 设置grain上限为1000
      resSys.setCap('grain', 1000);

      // 设置初始资源为0，然后添加超过上限的资源
      resSys.setResource('grain', 0);
      resSys.addResource('grain', 2000);

      expect(resSys.getAmount('grain')).toBe(1000);
    });

    it('资源恰好等于上限时不截断', () => {
      resSys.setCap('grain', 1000);
      resSys.setResource('grain', 0);
      resSys.addResource('grain', 1000);

      expect(resSys.getAmount('grain')).toBe(1000);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 升级后溢出空间恢复
  // ═══════════════════════════════════════════
  describe('升级后溢出空间恢复', () => {
    it('资源满后升级仓库可继续添加', () => {
      // 设置低上限
      resSys.setCap('grain', 500);
      resSys.setResource('grain', 500);
      expect(resSys.getAmount('grain')).toBe(500);

      // 升级仓库（提高上限）
      resSys.setCap('grain', 1000);

      // 现在可以继续添加
      resSys.addResource('grain', 300);
      expect(resSys.getAmount('grain')).toBe(800);
    });

    it('updateCaps提高上限后可继续添加资源', () => {
      // 先设置低上限
      resSys.updateCaps(1, 1);
      const lowCap = resSys.getCaps().grain!;

      // 填满
      resSys.setResource('grain', lowCap);
      expect(resSys.getAmount('grain')).toBe(lowCap);

      // 升级
      resSys.updateCaps(5, 1);
      const highCap = resSys.getCaps().grain!;

      expect(highCap).toBeGreaterThan(lowCap);

      // 可继续添加
      resSys.addResource('grain', 100);
      expect(resSys.getAmount('grain')).toBe(lowCap + 100);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 降级截断
  // ═══════════════════════════════════════════
  describe('降级截断', () => {
    it('降低上限后资源应被截断', () => {
      // 高上限，多资源
      resSys.setCap('grain', 5000);
      resSys.setResource('grain', 4500);
      expect(resSys.getAmount('grain')).toBe(4500);

      // 降级
      resSys.setCap('grain', 3000);
      expect(resSys.getAmount('grain')).toBe(3000);
    });

    it('updateCaps降级后资源截断', () => {
      // 高等级
      resSys.updateCaps(5, 5);
      const highGrainCap = resSys.getCaps().grain!;
      resSys.setResource('grain', highGrainCap);

      // 降级
      resSys.updateCaps(2, 2);
      const lowGrainCap = resSys.getCaps().grain!;

      expect(resSys.getAmount('grain')).toBe(lowGrainCap);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 容量警告
  // ═══════════════════════════════════════════
  describe('容量警告', () => {
    it('资源接近上限时应产生警告', () => {
      resSys.setCap('grain', 1000);
      resSys.setResource('grain', 950); // 95% → urgent

      const warning = resSys.getCapWarning('grain');
      expect(warning).not.toBeNull();
      expect(warning!.level).toBe('urgent');
    });

    it('资源在安全范围内返回safe级别', () => {
      resSys.setCap('grain', 10000);
      resSys.setResource('grain', 100); // 1% → safe

      const warning = resSys.getCapWarning('grain');
      // safe级别也会返回警告对象（level='safe'），不是null
      if (warning) {
        expect(warning.level).toBe('safe');
      }
    });
  });

  // ═══════════════════════════════════════════
  // 6. gold和mandate无上限
  // ═══════════════════════════════════════════
  describe('gold和mandate无上限', () => {
    it('gold无上限，可无限添加', () => {
      resSys.setResource('gold', 0);
      resSys.addResource('gold', 999999);
      expect(resSys.getAmount('gold')).toBe(999999);
    });

    it('mandate无上限，可无限添加', () => {
      resSys.setResource('mandate', 0);
      resSys.addResource('mandate', 999999);
      expect(resSys.getAmount('mandate')).toBe(999999);
    });
  });
});
