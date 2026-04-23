/**
 * HeroSystem 新功能测试 — 碎片合成
 * 覆盖：fragmentSynthesize、getSynthesizeCost、canSynthesize
 *
 * P0-6 修复后：碎片合成阈值按品质区分
 *   COMMON=20 / FINE=40 / RARE=80 / EPIC=150 / LEGENDARY=300
 */

import { HeroSystem } from '../HeroSystem';
import { Quality } from '../hero.types';
import { SYNTHESIZE_REQUIRED_FRAGMENTS } from '../hero-config';

/** 获取指定武将品质的合成所需碎片数 */
function getRequired(generalId: string): number {
  // 直接从配置表查询
  const def = new HeroSystem().getAllGeneralDefs().find((d) => d.id === generalId);
  return def ? SYNTHESIZE_REQUIRED_FRAGMENTS[def.quality] : 0;
}

// ═══════════════════════════════════════════════════════════════
describe('HeroSystem — 碎片合成', () => {
  let heroSystem: HeroSystem;

  beforeEach(() => {
    heroSystem = new HeroSystem();
  });

  // ───────────────────────────────────────────
  // 1. fragmentSynthesize
  // ───────────────────────────────────────────
  describe('fragmentSynthesize', () => {
    it('碎片足够时合成成功（传说品质 — 关羽）', () => {
      const required = getRequired('guanyu'); // LEGENDARY = 300
      heroSystem.addFragment('guanyu', required);
      const result = heroSystem.fragmentSynthesize('guanyu');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('guanyu');
      expect(result!.name).toBe('关羽');
    });

    it('合成后碎片被消耗', () => {
      const required = getRequired('guanyu'); // LEGENDARY = 300
      heroSystem.addFragment('guanyu', required + 5);
      heroSystem.fragmentSynthesize('guanyu');
      expect(heroSystem.getFragments('guanyu')).toBe(5);
    });

    it('碎片刚好够时合成后碎片为 0', () => {
      const required = getRequired('guanyu'); // LEGENDARY = 300
      heroSystem.addFragment('guanyu', required);
      heroSystem.fragmentSynthesize('guanyu');
      expect(heroSystem.getFragments('guanyu')).toBe(0);
    });

    it('碎片不足时返回 null', () => {
      const required = getRequired('guanyu'); // LEGENDARY = 300
      heroSystem.addFragment('guanyu', required - 1);
      expect(heroSystem.fragmentSynthesize('guanyu')).toBeNull();
    });

    it('无碎片时返回 null', () => {
      expect(heroSystem.fragmentSynthesize('guanyu')).toBeNull();
    });

    it('已拥有武将时返回 null', () => {
      heroSystem.addGeneral('guanyu');
      heroSystem.addFragment('guanyu', 1000);
      expect(heroSystem.fragmentSynthesize('guanyu')).toBeNull();
    });

    it('不存在的武将ID返回 null', () => {
      heroSystem.addFragment('nobody', 100);
      expect(heroSystem.fragmentSynthesize('nobody')).toBeNull();
    });

    it('合成后武将可在列表中找到', () => {
      const required = getRequired('liubei'); // EPIC = 150
      heroSystem.addFragment('liubei', required);
      heroSystem.fragmentSynthesize('liubei');
      expect(heroSystem.hasGeneral('liubei')).toBe(true);
      expect(heroSystem.getGeneralCount()).toBe(1);
    });

    it('合成武将初始等级为 1', () => {
      const required = getRequired('caocao'); // LEGENDARY = 300
      heroSystem.addFragment('caocao', required);
      const result = heroSystem.fragmentSynthesize('caocao');
      expect(result!.level).toBe(1);
      expect(result!.exp).toBe(0);
    });

    it('不同品质武将合成阈值不同', () => {
      // COMMON: 民兵队长 = 20
      const commonRequired = getRequired('minbingduizhang');
      expect(commonRequired).toBe(20);

      // FINE: 郡守 = 40
      const fineRequired = getRequired('junshou');
      expect(fineRequired).toBe(40);

      // RARE: 典韦 = 80
      const rareRequired = getRequired('dianwei');
      expect(rareRequired).toBe(80);

      // EPIC: 刘备 = 150
      const epicRequired = getRequired('liubei');
      expect(epicRequired).toBe(150);

      // LEGENDARY: 关羽 = 300
      const legendaryRequired = getRequired('guanyu');
      expect(legendaryRequired).toBe(300);
    });

    it('普通品质武将合成只需20碎片', () => {
      heroSystem.addFragment('minbingduizhang', 20);
      const result = heroSystem.fragmentSynthesize('minbingduizhang');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('minbingduizhang');
    });

    it('精良品质武将合成只需40碎片', () => {
      heroSystem.addFragment('junshou', 40);
      const result = heroSystem.fragmentSynthesize('junshou');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('junshou');
    });

    it('稀有品质武将合成只需80碎片', () => {
      heroSystem.addFragment('dianwei', 80);
      const result = heroSystem.fragmentSynthesize('dianwei');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('dianwei');
    });
  });

  // ───────────────────────────────────────────
  // 2. getSynthesizeCost
  // ───────────────────────────────────────────
  describe('getSynthesizeCost', () => {
    it('返回正确的合成消耗（按品质区分）', () => {
      // guanyu 是 LEGENDARY 品质 → 300
      expect(heroSystem.getSynthesizeCost('guanyu')).toBe(300);
      // liubei 是 EPIC 品质 → 150
      expect(heroSystem.getSynthesizeCost('liubei')).toBe(150);
      // dianwei 是 RARE 品质 → 80
      expect(heroSystem.getSynthesizeCost('dianwei')).toBe(80);
      // junshou 是 FINE 品质 → 40
      expect(heroSystem.getSynthesizeCost('junshou')).toBe(40);
      // minbingduizhang 是 COMMON 品质 → 20
      expect(heroSystem.getSynthesizeCost('minbingduizhang')).toBe(20);
    });

    it('合成消耗为正数', () => {
      expect(heroSystem.getSynthesizeCost('guanyu')).toBeGreaterThan(0);
    });

    it('不存在的武将返回 0', () => {
      expect(heroSystem.getSynthesizeCost('nobody')).toBe(0);
    });
  });

  // ───────────────────────────────────────────
  // 3. canSynthesize
  // ───────────────────────────────────────────
  describe('canSynthesize', () => {
    it('碎片足够且未拥有时返回 true', () => {
      heroSystem.addFragment('guanyu', 300); // LEGENDARY = 300
      expect(heroSystem.canSynthesize('guanyu')).toBe(true);
    });

    it('碎片不足时返回 false', () => {
      heroSystem.addFragment('guanyu', 299); // LEGENDARY = 300, 差1个
      expect(heroSystem.canSynthesize('guanyu')).toBe(false);
    });

    it('已拥有武将时返回 false', () => {
      heroSystem.addGeneral('guanyu');
      heroSystem.addFragment('guanyu', 1000);
      expect(heroSystem.canSynthesize('guanyu')).toBe(false);
    });

    it('不存在的武将ID返回 false', () => {
      heroSystem.addFragment('nobody', 100);
      expect(heroSystem.canSynthesize('nobody')).toBe(false);
    });

    it('无碎片时返回 false', () => {
      expect(heroSystem.canSynthesize('guanyu')).toBe(false);
    });

    it('不同品质武将合成判定正确', () => {
      // COMMON 武将：20 碎片
      heroSystem.addFragment('minbingduizhang', 20);
      expect(heroSystem.canSynthesize('minbingduizhang')).toBe(true);

      // EPIC 武将：150 碎片
      heroSystem.addFragment('liubei', 150);
      expect(heroSystem.canSynthesize('liubei')).toBe(true);

      // EPIC 武将碎片不足
      heroSystem.addFragment('zhangfei', 149);
      expect(heroSystem.canSynthesize('zhangfei')).toBe(false);
    });
  });
});
