/**
 * GeneralData 武将数据完整性测试
 *
 * 覆盖范围：
 * - 12位武将数据完整性验证
 * - 属性值范围校验
 * - 对话数据非空校验
 * - 查询函数正确性
 * - portraitColors 有效性
 */

import { describe, it, expect } from 'vitest';
import {
  GENERALS,
  getGeneralById,
  getGeneralsByFaction,
  getRandomDialogue,
  type GeneralInfo,
} from '../GeneralData';

/** 所有预期的武将 ID */
const EXPECTED_IDS = [
  'liubei', 'guanyu', 'zhangfei', 'zhugeliang', 'zhaoyun',
  'huangzhong', 'machao', 'caocao', 'xuchu', 'sunquan',
  'zhouyu', 'lvbu',
];

describe('GeneralData', () => {
  // ==================== 基础数据完整性 ====================

  it('应包含恰好12位武将', () => {
    expect(GENERALS).toHaveLength(12);
  });

  it('所有武将 ID 应唯一且符合预期', () => {
    const ids = GENERALS.map((g) => g.id);
    // 唯一性
    expect(new Set(ids).size).toBe(12);
    // 包含所有预期 ID
    EXPECTED_IDS.forEach((id) => {
      expect(ids).toContain(id);
    });
  });

  it('每位武将应有完整的非空基础字段', () => {
    GENERALS.forEach((g) => {
      expect(g.id).toBeTruthy();
      expect(g.name).toBeTruthy();
      expect(g.title).toBeTruthy();
      expect(g.weapon).toBeTruthy();
      expect(['shu', 'wei', 'wu', 'other']).toContain(g.faction);
    });
  });

  // ==================== 阵营分布 ====================

  it('蜀国应有7位武将', () => {
    const shu = getGeneralsByFaction('shu');
    expect(shu).toHaveLength(7);
    expect(shu.map((g) => g.id).sort()).toEqual(
      ['liubei', 'guanyu', 'zhangfei', 'zhugeliang', 'zhaoyun', 'huangzhong', 'machao'].sort(),
    );
  });

  it('魏国应有2位武将', () => {
    const wei = getGeneralsByFaction('wei');
    expect(wei).toHaveLength(2);
    expect(wei.map((g) => g.id).sort()).toEqual(['caocao', 'xuchu'].sort());
  });

  it('吴国应有2位武将', () => {
    const wu = getGeneralsByFaction('wu');
    expect(wu).toHaveLength(2);
    expect(wu.map((g) => g.id).sort()).toEqual(['sunquan', 'zhouyu'].sort());
  });

  it('其他阵营应有1位武将（吕布）', () => {
    const other = getGeneralsByFaction('other');
    expect(other).toHaveLength(1);
    expect(other[0].id).toBe('lvbu');
  });

  // ==================== 属性值范围 ====================

  it('每位武将的四维属性应在 1-100 范围内', () => {
    GENERALS.forEach((g) => {
      const { strength, intelligence, leadership, charisma } = g.stats;
      expect(strength).toBeGreaterThanOrEqual(1);
      expect(strength).toBeLessThanOrEqual(100);
      expect(intelligence).toBeGreaterThanOrEqual(1);
      expect(intelligence).toBeLessThanOrEqual(100);
      expect(leadership).toBeGreaterThanOrEqual(1);
      expect(leadership).toBeLessThanOrEqual(100);
      expect(charisma).toBeGreaterThanOrEqual(1);
      expect(charisma).toBeLessThanOrEqual(100);
    });
  });

  it('吕布武力应为最高值100', () => {
    const lvbu = getGeneralById('lvbu')!;
    expect(lvbu.stats.strength).toBe(100);
  });

  it('诸葛亮智力应为最高值100', () => {
    const zhugeliang = getGeneralById('zhugeliang')!;
    expect(zhugeliang.stats.intelligence).toBe(100);
  });

  // ==================== 对话数据 ====================

  it('每位武将闲聊对话应至少5句', () => {
    GENERALS.forEach((g) => {
      expect(g.dialogues.idle.length).toBeGreaterThanOrEqual(5);
      g.dialogues.idle.forEach((line) => {
        expect(line).toBeTruthy();
        expect(line.length).toBeGreaterThan(0);
      });
    });
  });

  it('每位武将战斗对话应至少3句', () => {
    GENERALS.forEach((g) => {
      expect(g.dialogues.battle.length).toBeGreaterThanOrEqual(3);
      g.dialogues.battle.forEach((line) => {
        expect(line).toBeTruthy();
      });
    });
  });

  it('每位武将招募对话应至少2句', () => {
    GENERALS.forEach((g) => {
      expect(g.dialogues.recruit.length).toBeGreaterThanOrEqual(2);
      g.dialogues.recruit.forEach((line) => {
        expect(line).toBeTruthy();
      });
    });
  });

  // ==================== portraitColors 有效性 ====================

  it('每位武将的 portraitColors 所有字段应为有效数字', () => {
    GENERALS.forEach((g) => {
      const { skin, hair, armor, weapon, accent } = g.portraitColors;
      // 所有值应为有限数字
      expect(Number.isFinite(skin)).toBe(true);
      expect(Number.isFinite(hair)).toBe(true);
      expect(Number.isFinite(armor)).toBe(true);
      expect(Number.isFinite(weapon)).toBe(true);
      expect(Number.isFinite(accent)).toBe(true);
      // 所有值应为非负（十六进制颜色）
      expect(skin).toBeGreaterThanOrEqual(0);
      expect(hair).toBeGreaterThanOrEqual(0);
      expect(armor).toBeGreaterThanOrEqual(0);
      expect(weapon).toBeGreaterThanOrEqual(0);
      expect(accent).toBeGreaterThanOrEqual(0);
      // 不超过 0xFFFFFF（24位颜色）
      expect(skin).toBeLessThanOrEqual(0xffffff);
      expect(hair).toBeLessThanOrEqual(0xffffff);
      expect(armor).toBeLessThanOrEqual(0xffffff);
      expect(weapon).toBeLessThanOrEqual(0xffffff);
      expect(accent).toBeLessThanOrEqual(0xffffff);
    });
  });

  // ==================== getGeneralById ====================

  it('getGeneralById 应正确查找已存在的武将', () => {
    const liubei = getGeneralById('liubei');
    expect(liubei).toBeDefined();
    expect(liubei!.name).toBe('刘备');
    expect(liubei!.faction).toBe('shu');
  });

  it('getGeneralById 对不存在的 ID 应返回 undefined', () => {
    expect(getGeneralById('nonexistent')).toBeUndefined();
    expect(getGeneralById('')).toBeUndefined();
  });

  // ==================== getGeneralsByFaction ====================

  it('getGeneralsByFaction 对不存在的阵营应返回空数组', () => {
    expect(getGeneralsByFaction('han')).toEqual([]);
  });

  // ==================== getRandomDialogue ====================

  it('getRandomDialogue 应返回指定武将的有效对话', () => {
    const line = getRandomDialogue('guanyu', 'idle');
    expect(line).toBeTruthy();
    expect(typeof line).toBe('string');
    // 应是关羽的闲聊对话之一
    const guanyu = getGeneralById('guanyu')!;
    expect(guanyu.dialogues.idle).toContain(line);
  });

  it('getRandomDialogue 对不存在的武将应返回 "..."', () => {
    expect(getRandomDialogue('nobody', 'idle')).toBe('...');
    expect(getRandomDialogue('nobody', 'battle')).toBe('...');
    expect(getRandomDialogue('nobody', 'recruit')).toBe('...');
  });

  it('getRandomDialogue 多次调用应能返回不同对话', () => {
    // 由于随机性，多次调用至少有一次不同（概率极高）
    const results = new Set<string>();
    for (let i = 0; i < 20; i++) {
      results.add(getRandomDialogue('zhangfei', 'idle'));
    }
    // 张飞有5句闲聊，20次调用应至少命中2句以上
    expect(results.size).toBeGreaterThanOrEqual(2);
  });
});
