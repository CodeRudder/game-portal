/**
 * CombatResolver 单元测试 (MAP-F09-02)
 *
 * 测试山贼战斗公式(R6/R7/R8修正)和遗迹探索三档判定(R6/R7修正)
 */

import { CombatResolver } from '../CombatResolver';

describe('CombatResolver (MAP-F09-02)', () => {
  const resolver = new CombatResolver();

  // ── 山贼战斗 ─────────────────────────────────

  describe('山贼难度判定', () => {
    it('Lv1~20: 弱匪(×0.3)', () => {
      expect(resolver.getBanditDifficulty(1)).toBe('weak');
      expect(resolver.getBanditDifficulty(20)).toBe('weak');
    });

    it('Lv21~40: 悍匪(×0.5)', () => {
      expect(resolver.getBanditDifficulty(21)).toBe('fierce');
      expect(resolver.getBanditDifficulty(40)).toBe('fierce');
    });

    it('Lv41~60: 精锐(×0.7)', () => {
      expect(resolver.getBanditDifficulty(41)).toBe('elite');
      expect(resolver.getBanditDifficulty(60)).toBe('elite');
    });

    it('Lv61+: 山贼王(×0.9)', () => {
      expect(resolver.getBanditDifficulty(61)).toBe('king');
      expect(resolver.getBanditDifficulty(100)).toBe('king');
    });
  });

  describe('山贼战力计算(R6修正: 独立数值)', () => {
    it('Lv10弱匪: max(100,1000)×0.3 = 300', () => {
      expect(resolver.calculateBanditPower(10)).toBe(300);
    });

    it('Lv30悍匪: max(100,3000)×0.5 = 1500', () => {
      expect(resolver.calculateBanditPower(30)).toBe(1500);
    });

    it('Lv50精锐: max(100,5000)×0.7 = 3500', () => {
      expect(resolver.calculateBanditPower(50)).toBe(3500);
    });

    it('Lv70山贼王: max(100,7000)×0.9 = 6300', () => {
      expect(resolver.calculateBanditPower(70)).toBe(6300);
    });

    it('Lv1弱匪: max(100,100)×0.3 = 30', () => {
      expect(resolver.calculateBanditPower(1)).toBe(30);
    });
  });

  describe('山贼战斗胜率(R6修正)', () => {
    it('兵力相等时胜率≈50%', () => {
      const rate = resolver.calculateBanditWinRate(1000, 1000);
      expect(rate).toBeCloseTo(0.50, 2);
    });

    it('兵力2倍时胜率≈100%(截断95%)', () => {
      const rate = resolver.calculateBanditWinRate(2000, 1000);
      expect(rate).toBe(0.95);
    });

    it('兵力0.5倍时胜率≈25%', () => {
      const rate = resolver.calculateBanditWinRate(500, 1000);
      expect(rate).toBeCloseTo(0.25, 2);
    });

    it('兵力为0时胜率=5%', () => {
      expect(resolver.calculateBanditWinRate(0, 1000)).toBe(0.05);
    });

    it('地形修正: 森林+10%', () => {
      const base = resolver.calculateBanditWinRate(1000, 1000);
      const forest = resolver.calculateBanditWinRate(1000, 1000, 0.10);
      expect(forest).toBeCloseTo(base + 0.10, 2);
    });

    it('科技加成: 攻城术Lv5→+10%', () => {
      const base = resolver.calculateBanditWinRate(1000, 1000);
      const tech = resolver.calculateBanditWinRate(1000, 1000, 0, 0.10);
      expect(tech).toBeCloseTo(base + 0.10, 2);
    });
  });

  describe('胜利损耗(R8修正: 上限35%)', () => {
    it('兵力充足: 损耗=5%(下限保护)', () => {
      const loss = resolver.calculateWinLoss(10000, 300);
      expect(loss / 10000).toBe(0.05);
    });

    it('兵力相等: 损耗=20%(20%×1.0)', () => {
      const loss = resolver.calculateWinLoss(1000, 1000);
      expect(loss / 1000).toBeCloseTo(0.20, 1);
    });

    it('低兵力: 损耗截断至35%', () => {
      const loss = resolver.calculateWinLoss(1000, 6300);
      expect(loss / 1000).toBe(0.35);
    });

    it('极低兵力: 损耗仍为35%', () => {
      const loss = resolver.calculateWinLoss(500, 6300);
      expect(loss / 500).toBe(0.35);
    });

    it('胜/败损耗比≤1.75x(极端场景)', () => {
      // 极端: 1000兵 vs 6300山贼王 → 胜利损耗35%, 失败损耗20% → 比值1.75
      const winLoss = resolver.calculateWinLoss(1000, 6300);
      const defeatLoss = resolver.calculateDefeatLoss(1000);
      expect(winLoss / defeatLoss).toBeCloseTo(1.75, 1);
    });
  });

  describe('失败损耗', () => {
    it('固定20%', () => {
      expect(resolver.calculateDefeatLoss(1000)).toBe(200);
      expect(resolver.calculateDefeatLoss(5000)).toBe(1000);
    });
  });

  describe('完整山贼战斗流程', () => {
    it('高胜率场景: 大概率胜利', () => {
      const result = resolver.executeBanditCombat(10000, 10, 0, 0, () => 0.1);
      expect(result.victory).toBe(true);
      expect(result.banditPower).toBe(300);
      expect(result.troopLoss).toBeGreaterThan(0);
    });

    it('低胜率场景: 大概率失败', () => {
      const result = resolver.executeBanditCombat(100, 70, 0, 0, () => 0.99);
      expect(result.victory).toBe(false);
      expect(result.banditPower).toBe(6300);
      expect(result.troopLoss).toBe(20); // 100×20%
    });
  });

  // ── 遗迹探索 ─────────────────────────────────

  describe('遗迹探索阈值(R6/R7修正)', () => {
    it('无科技无地形: 失败30%, 部分成功50%', () => {
      const { failThreshold, partialThreshold } = resolver.calculateExploreThresholds();
      expect(failThreshold).toBeCloseTo(0.30, 2);
      expect(partialThreshold).toBeCloseTo(0.50, 2);
    });

    it('攻城术Lv5(+10%): 失败20%, 部分成功45%', () => {
      const { failThreshold, partialThreshold } = resolver.calculateExploreThresholds(0.10);
      expect(failThreshold).toBeCloseTo(0.20, 2);
      expect(partialThreshold).toBeCloseTo(0.45, 2);
    });

    it('攻城术Lv10(+20%): 失败10%, 部分成功40%', () => {
      const { failThreshold, partialThreshold } = resolver.calculateExploreThresholds(0.20);
      expect(failThreshold).toBeCloseTo(0.10, 2);
      expect(partialThreshold).toBeCloseTo(0.40, 2);
    });
  });

  describe('遗迹探索三档判定', () => {
    it('roll<失败阈值: 失败', () => {
      const result = resolver.executeRuinsExplore(0, 0, () => 0.05);
      expect(result.tier).toBe('fail');
      expect(result.rewardMultiplier).toBe(0);
      expect(result.troopLossRate).toBe(0.10);
    });

    it('失败阈值≤roll<部分成功阈值: 部分成功', () => {
      const result = resolver.executeRuinsExplore(0, 0, () => 0.40);
      expect(result.tier).toBe('partial');
      expect(result.rewardMultiplier).toBe(0.5);
      expect(result.troopLossRate).toBe(0);
    });

    it('roll≥部分成功阈值: 成功', () => {
      const result = resolver.executeRuinsExplore(0, 0, () => 0.80);
      expect(result.tier).toBe('success');
      expect(result.rewardMultiplier).toBe(1.0);
      expect(result.troopLossRate).toBe(0);
    });

    it('科技提升成功概率', () => {
      // 无科技: roll=0.45 → 部分成功
      const noTech = resolver.executeRuinsExplore(0, 0, () => 0.45);
      expect(noTech.tier).toBe('partial');

      // 有科技: roll=0.45 → 成功(阈值降低)
      const withTech = resolver.executeRuinsExplore(0.20, 0, () => 0.45);
      expect(withTech.tier).toBe('success');
    });
  });

  // ── 装备掉落 ─────────────────────────────────

  describe('装备掉落', () => {
    it('大概率掉落白色装备', () => {
      const drops = Array.from({ length: 100 }, () =>
        resolver.rollEquipmentDrop(30, () => 0.1),
      );
      const whiteDrops = drops.filter(d => d.rarity === 'common');
      expect(whiteDrops.length).toBeGreaterThan(40);
    });

    it('小概率掉落紫色装备', () => {
      const drops = Array.from({ length: 100 }, () =>
        resolver.rollEquipmentDrop(30, () => 0.98),
      );
      const epicDrops = drops.filter(d => d.rarity === 'epic');
      expect(epicDrops.length).toBeGreaterThan(0);
    });
  });

  // ── 内应信掉落 ───────────────────────────────

  describe('内应信掉落', () => {
    it('15%概率掉落(山贼)', () => {
      let drops = 0;
      for (let i = 0; i < 1000; i++) {
        if (resolver.rollInsiderLetterDrop(0.15, () => Math.random())) drops++;
      }
      expect(drops).toBeGreaterThan(100);
      expect(drops).toBeLessThan(200);
    });

    it('25%概率掉落(遗迹)', () => {
      let drops = 0;
      for (let i = 0; i < 1000; i++) {
        if (resolver.rollInsiderLetterDrop(0.25, () => Math.random())) drops++;
      }
      expect(drops).toBeGreaterThan(200);
      expect(drops).toBeLessThan(300);
    });
  });
});
