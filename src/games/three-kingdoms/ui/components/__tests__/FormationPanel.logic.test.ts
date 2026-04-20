/**
 * FormationPanel 逻辑测试 — 不依赖 DOM 渲染
 *
 * 测试 FormationLogic 的核心逻辑：
 * - 编队管理（创建/切换/删除）
 * - 武将上阵/下阵
 * - 战力计算
 * - 位置交换
 * - 一键布阵
 * - 未上阵武将列表
 */

import { FormationLogic } from '../hero/FormationPanel';
import type { FormationData } from '../../../../engine/hero/HeroFormation';
import type { GeneralData } from '../../../../engine/hero/hero.types';

// ─────────────────────────────────────────────
// 测试数据工厂
// ─────────────────────────────────────────────

function createHero(id: string, name: string, atk: number, level: number = 10): GeneralData {
  return {
    id,
    name,
    faction: 'shu',
    quality: 'epic',
    level,
    baseStats: { attack: atk, defense: 50, intelligence: 40, speed: 60 },
    troopType: 'CAVALRY',
    position: 'front',
    skills: [],
  } as unknown as GeneralData;
}

function createFormation(id: string, slots: string[] = ['', '', '', '', '', '']): FormationData {
  return { id, name: `第${id}队`, slots };
}

function createTestHeroes(): GeneralData[] {
  return [
    createHero('guanyu', '关羽', 200, 30),
    createHero('zhangfei', '张飞', 180, 28),
    createHero('zhaoyun', '赵云', 190, 29),
    createHero('machao', '马超', 170, 25),
    createHero('huangzhong', '黄忠', 160, 27),
    createHero('zhugeliang', '诸葛亮', 150, 32),
  ];
}

function createTestFormations(): FormationData[] {
  return [
    createFormation('1', ['guanyu', 'zhangfei', 'zhaoyun', '', '', '']),
  ];
}

function createLogic(
  formations?: FormationData[],
  heroes?: GeneralData[],
): FormationLogic {
  return new FormationLogic(
    formations ?? createTestFormations(),
    '1',
    heroes ?? createTestHeroes(),
  );
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('FormationLogic — 编队管理', () => {
  it('获取当前激活编队', () => {
    const logic = createLogic();
    const active = logic.getActiveFormation();
    expect(active).not.toBeNull();
    expect(active!.id).toBe('1');
  });

  it('获取所有编队', () => {
    const logic = createLogic();
    const all = logic.getAllFormations();
    expect(all.length).toBe(1);
  });

  it('编队数量', () => {
    const logic = createLogic();
    expect(logic.getFormationCount()).toBe(1);
  });

  it('可以创建新编队', () => {
    const logic = createLogic();
    expect(logic.canCreateFormation()).toBe(true);
  });

  it('达到上限不可创建', () => {
    const formations = [
      createFormation('1'), createFormation('2'), createFormation('3'),
    ];
    const logic = createLogic(formations);
    expect(logic.canCreateFormation()).toBe(false);
  });

  it('切换编队', () => {
    const formations = [createFormation('1'), createFormation('2')];
    const logic = createLogic(formations);
    const result = logic.switchFormation('2');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('2');
  });

  it('切换不存在的编队返回 null', () => {
    const logic = createLogic();
    const result = logic.switchFormation('99');
    expect(result).toBeNull();
  });
});

describe('FormationLogic — 武将上阵/下阵', () => {
  it('获取编队成员数量', () => {
    const logic = createLogic();
    expect(logic.getMemberCount('1')).toBe(3);
  });

  it('获取指定位置武将', () => {
    const logic = createLogic();
    const hero = logic.getSlotGeneral('1', 0);
    expect(hero).not.toBeNull();
    expect(hero!.id).toBe('guanyu');
  });

  it('获取空位置返回 null', () => {
    const logic = createLogic();
    const hero = logic.getSlotGeneral('1', 3);
    expect(hero).toBeNull();
  });

  it('越界索引返回 null', () => {
    const logic = createLogic();
    expect(logic.getSlotGeneral('1', -1)).toBeNull();
    expect(logic.getSlotGeneral('1', 6)).toBeNull();
  });

  it('放入武将到空位', () => {
    const logic = createLogic();
    const result = logic.placeHero('1', 'machao', 3);
    expect(result).not.toBeNull();
    expect(result!.slots[3]).toBe('machao');
  });

  it('放入武将时如果已在其他位置则先移除', () => {
    const logic = createLogic();
    // guanyu 在位置 0，移到位置 3
    const result = logic.placeHero('1', 'guanyu', 3);
    expect(result).not.toBeNull();
    expect(result!.slots[0]).toBe('');
    expect(result!.slots[3]).toBe('guanyu');
  });

  it('移除武将', () => {
    const logic = createLogic();
    const result = logic.removeHero('1', 0);
    expect(result).not.toBeNull();
    expect(result!.slots[0]).toBe('');
  });

  it('移除空位置无变化', () => {
    const logic = createLogic();
    const result = logic.removeHero('1', 3);
    expect(result).not.toBeNull();
    expect(result!.slots[3]).toBe('');
  });
});

describe('FormationLogic — 位置交换', () => {
  it('交换两个武将位置', () => {
    const logic = createLogic();
    const result = logic.swapSlots('1', 0, 1);
    expect(result).not.toBeNull();
    expect(result!.slots[0]).toBe('zhangfei');
    expect(result!.slots[1]).toBe('guanyu');
  });

  it('交换空位和武将', () => {
    const logic = createLogic();
    const result = logic.swapSlots('1', 0, 3);
    expect(result).not.toBeNull();
    expect(result!.slots[0]).toBe('');
    expect(result!.slots[3]).toBe('guanyu');
  });

  it('越界索引返回 null', () => {
    const logic = createLogic();
    expect(logic.swapSlots('1', -1, 0)).toBeNull();
    expect(logic.swapSlots('1', 0, 6)).toBeNull();
  });

  it('不存在编队返回 null', () => {
    const logic = createLogic();
    expect(logic.swapSlots('99', 0, 1)).toBeNull();
  });
});

describe('FormationLogic — 战力计算', () => {
  it('计算编队总战力', () => {
    const logic = createLogic();
    const active = logic.getActiveFormation()!;
    const power = logic.calcFormationPower(active);
    expect(power).toBeGreaterThan(0);
  });

  it('空编队战力为0', () => {
    const logic = createLogic([createFormation('1')]);
    const active = logic.getActiveFormation()!;
    expect(logic.calcFormationPower(active)).toBe(0);
  });

  it('自定义战力函数', () => {
    const customCalc = (_g: GeneralData) => 100;
    const logic = new FormationLogic(
      createTestFormations(), '1', createTestHeroes(), customCalc,
    );
    const active = logic.getActiveFormation()!;
    expect(logic.calcFormationPower(active)).toBe(300); // 3个武将 × 100
  });
});

describe('FormationLogic — 未上阵武将', () => {
  it('获取未上阵武将', () => {
    const logic = createLogic();
    const unassigned = logic.getUnassignedHeroes();
    expect(unassigned.length).toBe(3); // 6个武将 - 3个已上阵
    expect(unassigned.map((h) => h.id)).not.toContain('guanyu');
  });

  it('全部上阵时返回空数组', () => {
    const fullFormation = createFormation('1', [
      'guanyu', 'zhangfei', 'zhaoyun', 'machao', 'huangzhong', 'zhugeliang',
    ]);
    const logic = createLogic([fullFormation]);
    expect(logic.getUnassignedHeroes()).toEqual([]);
  });

  it('未上阵武将按战力降序排列', () => {
    const logic = createLogic();
    const unassigned = logic.getUnassignedHeroes();
    for (let i = 1; i < unassigned.length; i++) {
      const prev = unassigned[i - 1];
      const curr = unassigned[i];
      const prevPower = (prev.baseStats.attack + prev.baseStats.defense + prev.baseStats.intelligence + prev.baseStats.speed) * (1 + prev.level * 0.1);
      const currPower = (curr.baseStats.attack + curr.baseStats.defense + curr.baseStats.intelligence + curr.baseStats.speed) * (1 + curr.level * 0.1);
      expect(prevPower).toBeGreaterThanOrEqual(currPower);
    }
  });
});

describe('FormationLogic — 一键布阵', () => {
  it('一键布阵选前5个武将', () => {
    const logic = createLogic([createFormation('1')]);
    const result = logic.autoFormation('1');
    expect(result).not.toBeNull();
    const filled = result!.slots.filter((s) => s !== '').length;
    expect(filled).toBe(5);
  });

  it('一键布阵按战力排序', () => {
    const logic = createLogic([createFormation('1')]);
    const result = logic.autoFormation('1');
    expect(result).not.toBeNull();
    // 第一个位置应该是战力最高的武将
    expect(result!.slots[0]).toBe('guanyu'); // attack 200
  });

  it('不存在编队返回 null', () => {
    const logic = createLogic();
    expect(logic.autoFormation('99')).toBeNull();
  });
});

describe('FormationLogic — 编队布局', () => {
  it('获取编队布局描述', () => {
    const logic = createLogic();
    const layout = logic.getFormationLayout('1');
    expect(layout.front).toEqual(['关羽', '张飞', '赵云']);
    expect(layout.back).toEqual([null, null, null]);
  });

  it('不存在编队返回空布局', () => {
    const logic = createLogic();
    const layout = logic.getFormationLayout('99');
    expect(layout.front).toEqual([null, null, null]);
    expect(layout.back).toEqual([null, null, null]);
  });
});
