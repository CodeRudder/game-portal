/**
 * HeroSystem 新功能测试 — 碎片合成
 * 覆盖：fragmentSynthesize、getSynthesizeCost、canSynthesize
 */

import { HeroSystem } from '../HeroSystem';
import { Quality } from '../hero.types';
import { SYNTHESIZE_REQUIRED_FRAGMENTS } from '../hero-config';

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
    it('碎片足够时合成成功', () => {
      heroSystem.addFragment('guanyu', SYNTHESIZE_REQUIRED_FRAGMENTS);
      const result = heroSystem.fragmentSynthesize('guanyu');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('guanyu');
      expect(result!.name).toBe('关羽');
    });

    it('合成后碎片被消耗', () => {
      heroSystem.addFragment('guanyu', SYNTHESIZE_REQUIRED_FRAGMENTS + 5);
      heroSystem.fragmentSynthesize('guanyu');
      expect(heroSystem.getFragments('guanyu')).toBe(5);
    });

    it('碎片刚好够时合成后碎片为 0', () => {
      heroSystem.addFragment('guanyu', SYNTHESIZE_REQUIRED_FRAGMENTS);
      heroSystem.fragmentSynthesize('guanyu');
      expect(heroSystem.getFragments('guanyu')).toBe(0);
    });

    it('碎片不足时返回 null', () => {
      heroSystem.addFragment('guanyu', SYNTHESIZE_REQUIRED_FRAGMENTS - 1);
      expect(heroSystem.fragmentSynthesize('guanyu')).toBeNull();
    });

    it('无碎片时返回 null', () => {
      expect(heroSystem.fragmentSynthesize('guanyu')).toBeNull();
    });

    it('已拥有武将时返回 null', () => {
      heroSystem.addGeneral('guanyu');
      heroSystem.addFragment('guanyu', 100);
      expect(heroSystem.fragmentSynthesize('guanyu')).toBeNull();
    });

    it('不存在的武将ID返回 null', () => {
      heroSystem.addFragment('nobody', 100);
      expect(heroSystem.fragmentSynthesize('nobody')).toBeNull();
    });

    it('合成后武将可在列表中找到', () => {
      heroSystem.addFragment('liubei', SYNTHESIZE_REQUIRED_FRAGMENTS);
      heroSystem.fragmentSynthesize('liubei');
      expect(heroSystem.hasGeneral('liubei')).toBe(true);
      expect(heroSystem.getGeneralCount()).toBe(1);
    });

    it('合成武将初始等级为 1', () => {
      heroSystem.addFragment('caocao', SYNTHESIZE_REQUIRED_FRAGMENTS);
      const result = heroSystem.fragmentSynthesize('caocao');
      expect(result!.level).toBe(1);
      expect(result!.exp).toBe(0);
    });
  });

  // ───────────────────────────────────────────
  // 2. getSynthesizeCost
  // ───────────────────────────────────────────
  describe('getSynthesizeCost', () => {
    it('返回正确的合成消耗', () => {
      expect(heroSystem.getSynthesizeCost()).toBe(SYNTHESIZE_REQUIRED_FRAGMENTS);
    });

    it('合成消耗为正数', () => {
      expect(heroSystem.getSynthesizeCost()).toBeGreaterThan(0);
    });
  });

  // ───────────────────────────────────────────
  // 3. canSynthesize
  // ───────────────────────────────────────────
  describe('canSynthesize', () => {
    it('碎片足够且未拥有时返回 true', () => {
      heroSystem.addFragment('guanyu', SYNTHESIZE_REQUIRED_FRAGMENTS);
      expect(heroSystem.canSynthesize('guanyu')).toBe(true);
    });

    it('碎片不足时返回 false', () => {
      heroSystem.addFragment('guanyu', SYNTHESIZE_REQUIRED_FRAGMENTS - 1);
      expect(heroSystem.canSynthesize('guanyu')).toBe(false);
    });

    it('已拥有武将时返回 false', () => {
      heroSystem.addGeneral('guanyu');
      heroSystem.addFragment('guanyu', 100);
      expect(heroSystem.canSynthesize('guanyu')).toBe(false);
    });

    it('不存在的武将ID返回 false', () => {
      heroSystem.addFragment('nobody', 100);
      expect(heroSystem.canSynthesize('nobody')).toBe(false);
    });

    it('无碎片时返回 false', () => {
      expect(heroSystem.canSynthesize('guanyu')).toBe(false);
    });
  });
});
