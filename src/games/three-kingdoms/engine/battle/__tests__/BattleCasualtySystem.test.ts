/**
 * BattleCasualtySystem 单元测试
 *
 * 覆盖：
 * - 胜利战斗：killed=5%, wounded=10%
 * - 失败战斗：killed=15%, wounded=25%
 * - 伤兵发送到医馆
 * - 伤亡报告统计
 */

import { BattleCasualtySystem } from '../BattleCasualtySystem';

describe('BattleCasualtySystem', () => {
  let system: BattleCasualtySystem;

  beforeEach(() => {
    system = new BattleCasualtySystem();
  });

  // ═══════════════════════════════════════════
  // 1. 胜利战斗
  // ═══════════════════════════════════════════
  describe('胜利战斗', () => {
    it('killed=5%, wounded=10%', () => {
      const result = system.computeCasualties({
        victory: true,
        troopCount: 1000,
      });

      expect(result.killed).toBe(50);   // 5% of 1000
      expect(result.wounded).toBe(100);  // 10% of 1000
    });

    it('小规模胜利战斗', () => {
      const result = system.computeCasualties({
        victory: true,
        troopCount: 100,
      });

      expect(result.killed).toBe(5);
      expect(result.wounded).toBe(10);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 失败战斗
  // ═══════════════════════════════════════════
  describe('失败战斗', () => {
    it('killed=15%, wounded=25%', () => {
      const result = system.computeCasualties({
        victory: false,
        troopCount: 1000,
      });

      expect(result.killed).toBe(150);  // 15% of 1000
      expect(result.wounded).toBe(250);  // 25% of 1000
    });

    it('小规模失败战斗', () => {
      const result = system.computeCasualties({
        victory: false,
        troopCount: 100,
      });

      expect(result.killed).toBe(15);
      expect(result.wounded).toBe(25);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 伤兵发送到医馆
  // ═══════════════════════════════════════════
  describe('伤兵发送到医馆', () => {
    it('调用医馆addWounded方法', () => {
      const clinicMock = { addWounded: vi.fn() };

      system.sendWoundedToClinic(100, clinicMock);

      expect(clinicMock.addWounded).toHaveBeenCalledWith(100);
    });

    it('不发送0伤兵', () => {
      const clinicMock = { addWounded: vi.fn() };

      system.sendWoundedToClinic(0, clinicMock);

      expect(clinicMock.addWounded).not.toHaveBeenCalled();
    });

    it('完整流程：战斗→计算→转发', () => {
      const clinicMock = { addWounded: vi.fn() };

      const result = system.computeCasualties({
        victory: false,
        troopCount: 1000,
      });

      system.sendWoundedToClinic(result.wounded, clinicMock);

      expect(clinicMock.addWounded).toHaveBeenCalledWith(250);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 伤亡报告统计
  // ═══════════════════════════════════════════
  describe('伤亡报告统计', () => {
    it('单场战斗统计', () => {
      system.computeCasualties({ victory: true, troopCount: 1000 });

      const report = system.getCasualtyReport();
      expect(report.totalKilled).toBe(50);
      expect(report.totalWounded).toBe(100);
      expect(report.battles).toBe(1);
    });

    it('多场战斗累计统计', () => {
      system.computeCasualties({ victory: true, troopCount: 1000 });
      system.computeCasualties({ victory: false, troopCount: 1000 });

      const report = system.getCasualtyReport();
      expect(report.totalKilled).toBe(200);  // 50 + 150
      expect(report.totalWounded).toBe(350);  // 100 + 250
      expect(report.battles).toBe(2);
    });

    it('重置后统计清零', () => {
      system.computeCasualties({ victory: true, troopCount: 1000 });
      system.reset();

      const report = system.getCasualtyReport();
      expect(report.totalKilled).toBe(0);
      expect(report.totalWounded).toBe(0);
      expect(report.battles).toBe(0);
    });
  });
});
