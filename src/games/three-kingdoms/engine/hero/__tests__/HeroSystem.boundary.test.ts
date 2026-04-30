/**
 * HeroSystem 边界条件测试（R04 回合）
 *
 * 覆盖场景（13个）：
 * 1. 升级不存在的武将
 * 2. 武将等级超过上限时setLevelAndExp
 * 3. 编队中放入不存在的武将计算战力
 * 4. 空编队计算战力
 * 5. 武将属性为NaN时计算战力
 * 6. 武将属性为Infinity时计算战力
 * 7. 添加不存在的武将ID
 * 8. 重复添加同一武将
 * 9. 移除不存在的武将
 * 10. 碎片数量为0时消耗
 * 11. 碎片数量为负数时添加
 * 12. 碎片达到上限后继续添加溢出
 * 13. 合成不存在的武将碎片
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HeroSystem } from '../HeroSystem';
import { HERO_MAX_LEVEL } from '../hero-config';
import { GENERAL_DEF_MAP } from '../hero-config';
import type { GeneralData } from '../hero.types';
import { Quality } from '../hero.types';

// ── 辅助函数 ──

/** 获取一个存在于定义表中的武将ID */
function getExistingGeneralId(): string | null {
  const keys = [...GENERAL_DEF_MAP.keys()];
  return keys.length > 0 ? keys[0] : null;
}

/** 获取多个存在的武将ID */
function getExistingGeneralIds(count: number): string[] {
  return [...GENERAL_DEF_MAP.keys()].slice(0, count);
}

/** 创建一个最小化的 GeneralData（用于战力计算测试） */
function makeGeneral(overrides: Partial<GeneralData> = {}): GeneralData {
  return {
    id: 'test_hero',
    name: '测试武将',
    quality: Quality.COMMON,
    baseStats: { attack: 100, defense: 80, intelligence: 70, speed: 60 },
    level: 1,
    exp: 0,
    faction: 'shu',
    skills: [],
    ...overrides,
  };
}

describe('HeroSystem 边界条件测试', () => {
  let hs: HeroSystem;

  beforeEach(() => {
    hs = new HeroSystem();
  });

  // ── 1. 升级不存在的武将 ──
  it('setLevelAndExp对不存在的武将应返回undefined', () => {
    const result = hs.setLevelAndExp('nonexistent_hero_99999', 10, 500);
    expect(result).toBeUndefined();
  });

  // ── 2. 武将等级超过上限时setLevelAndExp ──
  it('setLevelAndExp允许设置超过上限的等级（引擎层不做硬限制）', () => {
    const generalId = getExistingGeneralId();
    if (!generalId) return;

    const added = hs.addGeneral(generalId);
    expect(added).not.toBeNull();

    // 设置超过默认上限(50)的等级
    const result = hs.setLevelAndExp(generalId, 999, 0);
    expect(result).toBeDefined();
    expect(result!.level).toBe(999);
  });

  // ── 3. 编队中放入不存在的武将计算战力 ──
  it('编队中包含不存在武将时战力应忽略该武将', () => {
    const ids = ['nonexistent_1', 'nonexistent_2'];
    const power = hs.calculateFormationPower(ids);
    expect(power).toBe(0);
  });

  // ── 4. 空编队计算战力 ──
  it('空编队战力应为0', () => {
    const power = hs.calculateFormationPower([]);
    expect(power).toBe(0);
  });

  // ── 5. 武将属性为NaN时计算战力 ──
  it('武将属性含NaN时计算战力应返回0（R2-FIX-P05: NaN防护）', () => {
    const general = makeGeneral({
      baseStats: { attack: NaN, defense: 80, intelligence: 70, speed: 60 },
    });
    const power = hs.calculatePower(general);
    // R2-FIX-P05: NaN 最终输出防护，返回 0 防止异常值传播到排序/编队/UI
    expect(Number.isFinite(power)).toBe(true);
    expect(power).toBe(0);
  });

  // ── 6. 武将属性为Infinity时计算战力 ──
  it('武将属性含Infinity时计算战力应返回0（R2-FIX-P05: 非有限值防护）', () => {
    const general = makeGeneral({
      baseStats: { attack: Infinity, defense: 80, intelligence: 70, speed: 60 },
    });
    const power = hs.calculatePower(general);
    // R2-FIX-P05: Infinity 最终输出防护，返回 0 防止异常值传播
    expect(Number.isFinite(power)).toBe(true);
    expect(power).toBe(0);
  });

  // ── 7. 添加不存在的武将ID ──
  it('添加不存在的武将ID应返回null', () => {
    const result = hs.addGeneral('nonexistent_hero_99999');
    expect(result).toBeNull();
  });

  // ── 8. 重复添加同一武将 ──
  it('重复添加同一武将第二次应返回null', () => {
    const generalId = getExistingGeneralId();
    if (!generalId) return;

    const first = hs.addGeneral(generalId);
    expect(first).not.toBeNull();

    const second = hs.addGeneral(generalId);
    expect(second).toBeNull();
  });

  // ── 9. 移除不存在的武将 ──
  it('移除不存在的武将应返回null', () => {
    const result = hs.removeGeneral('nonexistent_hero_99999');
    expect(result).toBeNull();
  });

  // ── 10. 碎片数量为0时消耗 ──
  it('碎片数量为0时消耗应返回false', () => {
    const result = hs.useFragments('some_hero', 1);
    expect(result).toBe(false);
  });

  // ── 11. 碎片数量为负数时添加 ──
  it('添加负数碎片应返回0（不操作）', () => {
    const overflow = hs.addFragment('some_hero', -10);
    expect(overflow).toBe(0);
    expect(hs.getFragments('some_hero')).toBe(0);
  });

  // ── 12. 碎片达到上限后继续添加溢出 ──
  it('碎片达到上限后继续添加应返回溢出数量', () => {
    const cap = HeroSystem.FRAGMENT_CAP; // 999
    // 先添加到接近上限
    const overflow1 = hs.addFragment('test_hero', cap);
    expect(overflow1).toBe(0);
    expect(hs.getFragments('test_hero')).toBe(cap);

    // 再添加应全部溢出
    const overflow2 = hs.addFragment('test_hero', 100);
    expect(overflow2).toBe(100);
    expect(hs.getFragments('test_hero')).toBe(cap);
  });

  // ── 13. 合成不存在的武将碎片 ──
  it('合成不存在的武将碎片应返回null', () => {
    const result = hs.fragmentSynthesize('nonexistent_hero_99999');
    expect(result).toBeNull();
  });
});
