/**
 * HeroFormation.autoFormation 一键布阵测试
 *
 * 覆盖：自动按战力排序选前5个武将编队、空列表、
 * 编队不存在时自动创建、不允许重叠、允许重叠
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HeroFormation } from '../HeroFormation';
import type { GeneralData } from '../hero.types';

// ── Mock 武将 ──

function makeGeneral(id: string, power: number): GeneralData {
  return {
    id,
    name: id,
    quality: 'RARE' as any,
    level: Math.floor(power / 100),
    exp: 0,
    faction: 'shu',
    baseStats: { attack: power, defense: 80, intelligence: 60, speed: 50 },
    skills: [],
  };
}

describe('HeroFormation.autoFormationByIds — 一键布阵', () => {
  let formation: HeroFormation;
  let getGeneral: (id: string) => GeneralData | undefined;
  let calcPower: (g: GeneralData) => number;

  const heroes = [
    makeGeneral('guanyu', 5000),
    makeGeneral('zhangfei', 4500),
    makeGeneral('zhaoyun', 4000),
    makeGeneral('machao', 3500),
    makeGeneral('huangzhong', 3000),
    makeGeneral('liubei', 2500),
    makeGeneral('zhugeliang', 2000),
  ];

  beforeEach(() => {
    formation = new HeroFormation();
    const map = new Map(heroes.map((h) => [h.id, h]));
    getGeneral = vi.fn((id: string) => map.get(id));
    calcPower = vi.fn((g: GeneralData) => g.baseStats.attack);
  });

  it('自动按战力排序选前5个武将编队', () => {
    const result = formation.autoFormationByIds(
      heroes.map((h) => h.id),
      getGeneral,
      calcPower,
    );

    expect(result).not.toBeNull();
    expect(result!.slots.filter((s) => s !== '')).toHaveLength(5);
    // 战力最高的5个
    expect(result!.slots[0]).toBe('guanyu');
    expect(result!.slots[1]).toBe('zhangfei');
    expect(result!.slots[2]).toBe('zhaoyun');
    expect(result!.slots[3]).toBe('machao');
    expect(result!.slots[4]).toBe('huangzhong');
    // 第6个空位
    expect(result!.slots[5]).toBe('');
  });

  it('编队不存在时自动创建', () => {
    expect(formation.getFormation('1')).toBeNull();
    const result = formation.autoFormationByIds(
      heroes.map((h) => h.id),
      getGeneral,
      calcPower,
      '1',
    );
    expect(result).not.toBeNull();
    expect(formation.getFormation('1')).not.toBeNull();
  });

  it('空候选列表返回 null', () => {
    const result = formation.autoFormationByIds([], getGeneral, calcPower);
    expect(result).toBeNull();
  });

  it('不存在的武将被过滤', () => {
    const result = formation.autoFormationByIds(
      ['guanyu', 'nonexistent', 'zhaoyun'],
      getGeneral,
      calcPower,
    );
    expect(result).not.toBeNull();
    expect(result!.slots.filter((s) => s !== '')).toHaveLength(2);
    expect(result!.slots).toContain('guanyu');
    expect(result!.slots).toContain('zhaoyun');
    expect(result!.slots).not.toContain('nonexistent');
  });

  it('默认不允许与其他编队重叠', () => {
    // 先把 guanyu 放入编队2
    formation.createFormation('2');
    formation.addToFormation('2', 'guanyu');

    const result = formation.autoFormationByIds(
      heroes.map((h) => h.id),
      getGeneral,
      calcPower,
      '1',
      5,
      false,
    );

    expect(result).not.toBeNull();
    // guanyu 已在编队2，不应出现在编队1
    expect(result!.slots).not.toContain('guanyu');
    // 应选战力次高的5个
    expect(result!.slots.filter((s) => s !== '')).toHaveLength(5);
    expect(result!.slots[0]).toBe('zhangfei');
  });

  it('allowOverlap=true 允许与其他编队重叠', () => {
    formation.createFormation('2');
    formation.addToFormation('2', 'guanyu');

    const result = formation.autoFormationByIds(
      heroes.map((h) => h.id),
      getGeneral,
      calcPower,
      '1',
      5,
      true,
    );

    expect(result).not.toBeNull();
    expect(result!.slots).toContain('guanyu');
  });

  it('maxSlots 参数限制选择数量', () => {
    const result = formation.autoFormationByIds(
      heroes.map((h) => h.id),
      getGeneral,
      calcPower,
      '1',
      3,
    );

    expect(result).not.toBeNull();
    expect(result!.slots.filter((s) => s !== '')).toHaveLength(3);
  });

  it('候选武将不足 maxSlots 时全部选中', () => {
    const result = formation.autoFormationByIds(
      ['guanyu', 'zhangfei'],
      getGeneral,
      calcPower,
      '1',
      5,
    );

    expect(result).not.toBeNull();
    expect(result!.slots.filter((s) => s !== '')).toHaveLength(2);
  });

  it('编队满后剩余空位为空字符串', () => {
    const result = formation.autoFormationByIds(
      heroes.map((h) => h.id),
      getGeneral,
      calcPower,
      '1',
      5,
    );

    expect(result).not.toBeNull();
    // 6个槽位，选了5个
    expect(result!.slots).toHaveLength(6);
    expect(result!.slots[5]).toBe('');
  });

  it('清空编队原有武将后填入新武将', () => {
    formation.createFormation('1');
    formation.addToFormation('1', 'liubei');

    const result = formation.autoFormationByIds(
      ['guanyu', 'zhaoyun'],
      getGeneral,
      calcPower,
      '1',
    );

    expect(result).not.toBeNull();
    expect(result!.slots).not.toContain('liubei');
    expect(result!.slots).toContain('guanyu');
    expect(result!.slots).toContain('zhaoyun');
  });
});
