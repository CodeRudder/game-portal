/**
 * R22-3: 武将系统异常路径覆盖
 *
 * 覆盖场景：
 * - 招募满池（重复招募同一武将）
 * - 碎片不足合成
 * - 重复招募处理
 * - 不存在的武将ID
 * - 碎片溢出上限
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HeroSystem } from '../HeroSystem';
import { HeroSystem as HeroSysClass } from '../HeroSystem';
import { SYNTHESIZE_REQUIRED_FRAGMENTS, DUPLICATE_FRAGMENT_COUNT } from '../hero-config';
import { Quality } from '../hero.types';

describe('R22-3: 武将系统异常路径', () => {
  let hs: HeroSystem;
  beforeEach(() => {
    hs = new HeroSystem();
  });

  // ═══════════════════════════════════════════
  // 重复招募
  // ═══════════════════════════════════════════
  describe('重复招募同一武将', () => {
    it('添加已存在的武将返回 null', () => {
      const first = hs.addGeneral('liubei');
      expect(first).not.toBeNull();
      const second = hs.addGeneral('liubei');
      expect(second).toBeNull();
    });

    it('重复添加不增加武将数量', () => {
      hs.addGeneral('liubei');
      expect(hs.getGeneralCount()).toBe(1);
      hs.addGeneral('liubei');
      expect(hs.getGeneralCount()).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // 不存在的武将
  // ═══════════════════════════════════════════
  describe('不存在的武将ID', () => {
    it('addGeneral 不存在的ID返回 null', () => {
      const result = hs.addGeneral('nonexistent_hero');
      expect(result).toBeNull();
    });

    it('getGeneral 不存在的ID返回 undefined', () => {
      const result = hs.getGeneral('nonexistent_hero');
      expect(result).toBeUndefined();
    });

    it('hasGeneral 不存在的ID返回 false', () => {
      expect(hs.hasGeneral('nonexistent_hero')).toBe(false);
    });

    it('removeGeneral 不存在的ID返回 null', () => {
      const result = hs.removeGeneral('nonexistent_hero');
      expect(result).toBeNull();
    });

    it('fragmentSynthesize 不存在的ID返回 null', () => {
      const result = hs.fragmentSynthesize('nonexistent_hero');
      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 碎片不足合成
  // ═══════════════════════════════════════════
  describe('碎片不足合成', () => {
    it('碎片不足时 fragmentSynthesize 返回 null', () => {
      // liubei 是 EPIC 品质，需要 150 碎片
      hs.addFragment('liubei', 10);
      const result = hs.fragmentSynthesize('liubei');
      expect(result).toBeNull();
    });

    it('碎片刚好不足1个时 fragmentSynthesize 返回 null', () => {
      // liubei 是 EPIC 品质，需要 SYNTHESIZE_REQUIRED_FRAGMENTS[EPIC] = 150 碎片
      const required = SYNTHESIZE_REQUIRED_FRAGMENTS['EPIC'];
      hs.addFragment('liubei', required - 1);
      const result = hs.fragmentSynthesize('liubei');
      expect(result).toBeNull();
    });

    it('碎片足够时 fragmentSynthesize 成功', () => {
      const required = SYNTHESIZE_REQUIRED_FRAGMENTS['EPIC'];
      hs.addFragment('liubei', required);
      const result = hs.fragmentSynthesize('liubei');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('liubei');
    });

    it('合成后碎片被扣除', () => {
      const required = SYNTHESIZE_REQUIRED_FRAGMENTS['EPIC'];
      hs.addFragment('liubei', required + 50);
      hs.fragmentSynthesize('liubei');
      expect(hs.getFragments('liubei')).toBe(50);
    });

    it('已拥有武将不能合成', () => {
      hs.addGeneral('liubei');
      hs.addFragment('liubei', 500);
      const result = hs.fragmentSynthesize('liubei');
      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 碎片溢出上限
  // ═══════════════════════════════════════════
  describe('碎片溢出上限', () => {
    it('碎片超过 999 上限时截断', () => {
      const overflow = hs.addFragment('liubei', 1500);
      expect(hs.getFragments('liubei')).toBe(HeroSysClass.FRAGMENT_CAP); // 999
      expect(overflow).toBe(1500 - 999); // 501
    });

    it('多次添加碎片累计不超过上限', () => {
      hs.addFragment('liubei', 800);
      const overflow = hs.addFragment('liubei', 500);
      expect(hs.getFragments('liubei')).toBe(HeroSysClass.FRAGMENT_CAP);
      expect(overflow).toBe(800 + 500 - 999); // 301
    });

    it('碎片为 0 时不溢出', () => {
      const overflow = hs.addFragment('liubei', 0);
      expect(overflow).toBe(0);
    });

    it('碎片为负数时不添加', () => {
      const overflow = hs.addFragment('liubei', -10);
      expect(overflow).toBe(0);
      expect(hs.getFragments('liubei')).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 碎片消耗
  // ═══════════════════════════════════════════
  describe('碎片消耗异常', () => {
    it('碎片不足时 useFragments 返回 false', () => {
      hs.addFragment('liubei', 10);
      expect(hs.useFragments('liubei', 20)).toBe(false);
      expect(hs.getFragments('liubei')).toBe(10); // 未被扣除
    });

    it('碎片刚好足够时 useFragments 成功', () => {
      hs.addFragment('liubei', 20);
      expect(hs.useFragments('liubei', 20)).toBe(true);
      expect(hs.getFragments('liubei')).toBe(0);
    });

    it('碎片消耗完自动清理记录', () => {
      hs.addFragment('liubei', 10);
      hs.useFragments('liubei', 10);
      const all = hs.getAllFragments();
      expect(all['liubei']).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════
  // 重复武将处理
  // ═══════════════════════════════════════════
  describe('重复武将处理', () => {
    it('handleDuplicate 按品质返回碎片', () => {
      // liubei 是 EPIC 品质 → 40 碎片
      const fragments = hs.handleDuplicate('liubei', Quality.EPIC);
      expect(fragments).toBe(DUPLICATE_FRAGMENT_COUNT[Quality.EPIC]);
      expect(hs.getFragments('liubei')).toBe(fragments);
    });
  });

  // ═══════════════════════════════════════════
  // canSynthesize 检查
  // ═══════════════════════════════════════════
  describe('canSynthesize 检查', () => {
    it('未拥有且碎片足够时 canSynthesize 返回 true', () => {
      const required = SYNTHESIZE_REQUIRED_FRAGMENTS['EPIC'];
      hs.addFragment('liubei', required);
      expect(hs.canSynthesize('liubei')).toBe(true);
    });

    it('已拥有时 canSynthesize 返回 false', () => {
      hs.addGeneral('liubei');
      hs.addFragment('liubei', 500);
      expect(hs.canSynthesize('liubei')).toBe(false);
    });

    it('碎片不足时 canSynthesize 返回 false', () => {
      hs.addFragment('liubei', 100);
      expect(hs.canSynthesize('liubei')).toBe(false);
    });
  });
});
