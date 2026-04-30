/**
 * 集成测试：战前布阵（§2.1 ~ §2.6）
 *
 * 覆盖 Play v3.0 攻城略地(上) 中的 6 个流程：
 *   §2.1 进入布阵界面：编队数据正确加载
 *   §2.2 一键布阵：autoFormation 按战力自动排列
 *   §2.3 手动调整阵容：拖拽换位逻辑
 *   §2.4 查看战力预估：总战力计算正确
 *   §2.5 智能推荐：根据敌方阵容推荐克制阵容
 *   §2.6 查看敌方预览：敌方阵容数据正确获取
 *
 * 测试策略：使用 HeroFormation + autoFormation 引擎 API，
 * 通过 mock 数据构造各种布阵场景。
 */

import { HeroFormation } from '../../../hero/HeroFormation';
import { autoFormation } from '../../../battle/autoFormation';
import type { FormationData, GeneralData } from '../../../hero/hero.types';
import type { BattleUnit, BattleTeam } from '../../../battle/battle.types';
import { TroopType, BuffType } from '../../../battle/battle.types';
import type { EnemyFormation } from '../../../campaign/campaign.types';
import { getStage, getChapters } from '../../../campaign/campaign-config';

/** 所有章节 */
const allChapters = getChapters();

// ─────────────────────────────────────────────
// Mock 数据工厂
// ─────────────────────────────────────────────

/** 创建 mock GeneralData */
function createMockGeneral(
  id: string,
  name: string,
  opts: Partial<{
    attack: number;
    defense: number;
    intelligence: number;
    speed: number;
    faction: 'shu' | 'wei' | 'wu' | 'qun';
  }> = {},
): GeneralData {
  return {
    id,
    name,
    quality: 'RARE' as unknown as string,
    baseStats: {
      attack: opts.attack ?? 100,
      defense: opts.defense ?? 80,
      intelligence: opts.intelligence ?? 60,
      speed: opts.speed ?? 50,
    },
    level: 10,
    exp: 0,
    faction: opts.faction ?? 'shu',
    skills: [],
  };
}

/** 创建 mock BattleUnit */
function createMockBattleUnit(
  id: string,
  name: string,
  opts: Partial<{
    attack: number;
    defense: number;
    speed: number;
    maxHp: number;
    troopType: TroopType;
    isAlive: boolean;
  }> = {},
): BattleUnit {
  const atk = opts.attack ?? 100;
  const def = opts.defense ?? 80;
  return {
    id,
    name,
    faction: 'shu',
    troopType: opts.troopType ?? TroopType.INFANTRY,
    position: 'front',
    side: 'ally',
    attack: atk,
    baseAttack: atk,
    defense: def,
    baseDefense: def,
    intelligence: 60,
    speed: opts.speed ?? 50,
    hp: opts.maxHp ?? 1000,
    maxHp: opts.maxHp ?? 1000,
    isAlive: opts.isAlive ?? true,
    rage: 0,
    maxRage: 100,
    normalAttack: {
      id: 'normal',
      name: '普攻',
      type: 'active',
      level: 1,
      description: '',
      multiplier: 1.0,
      targetType: 'SINGLE_ENEMY' as unknown as string,
      rageCost: 0,
      cooldown: 0,
      currentCooldown: 0,
    },
    skills: [],
    buffs: [],
  };
}

/** 简单战力计算函数 */
function calcPower(g: GeneralData): number {
  const s = g.baseStats;
  return Math.round(s.attack * 2 + s.defense * 1.5 + s.intelligence + s.speed);
}

/** Mock 武将数据库 */
const mockGenerals: Record<string, GeneralData> = {
  liubei: createMockGeneral('liubei', '刘备', { attack: 120, defense: 100, speed: 60 }),
  guanyu: createMockGeneral('guanyu', '关羽', { attack: 180, defense: 90, speed: 70 }),
  zhangfei: createMockGeneral('zhangfei', '张飞', { attack: 160, defense: 70, speed: 55 }),
  zhaoyun: createMockGeneral('zhaoyun', '赵云', { attack: 150, defense: 110, speed: 80 }),
  zhugeliang: createMockGeneral('zhugeliang', '诸葛亮', { attack: 130, defense: 60, speed: 90 }),
  machao: createMockGeneral('machao', '马超', { attack: 170, defense: 85, speed: 75 }),
};

function getMockGeneral(id: string): GeneralData | undefined {
  return mockGenerals[id];
}

// ═══════════════════════════════════════════════
// §2.1 进入布阵界面
// ═══════════════════════════════════════════════

describe('§2.1 进入布阵界面', () => {
  let formation: HeroFormation;

  beforeEach(() => {
    formation = new HeroFormation();
  });

  it('§2.1 创建编队后能正确获取编队数据', () => {
    const f = formation.createFormation('1');
    expect(f).not.toBeNull();
    expect(f!.id).toBe('1');
    expect(f!.name).toBe('第一队');
    expect(f!.slots).toHaveLength(6);
  });

  it('§2.1 编队初始为6个空位', () => {
    formation.createFormation('1');
    const f = formation.getFormation('1');
    expect(f!.slots.every((s) => s === '')).toBe(true);
  });

  it('§2.1 自动激活第一个创建的编队', () => {
    formation.createFormation('1');
    expect(formation.getActiveFormationId()).toBe('1');
  });

  it('§2.1 能创建最多3个编队', () => {
    const f1 = formation.createFormation('1');
    const f2 = formation.createFormation('2');
    const f3 = formation.createFormation('3');
    expect(f1).not.toBeNull();
    expect(f2).not.toBeNull();
    expect(f3).not.toBeNull();
    expect(formation.getFormationCount()).toBe(3);
  });

  it('§2.1 编队ID重复时返回 null', () => {
    formation.createFormation('1');
    const dup = formation.createFormation('1');
    expect(dup).toBeNull();
  });

  it('§2.1 getAllFormations 返回所有编队', () => {
    formation.createFormation('1');
    formation.createFormation('2');
    const all = formation.getAllFormations();
    expect(all).toHaveLength(2);
  });

  it('§2.1 序列化/反序列化后编队数据一致', () => {
    formation.createFormation('1');
    formation.addToFormation('1', 'liubei');
    formation.addToFormation('1', 'guanyu');

    const saved = formation.serialize();
    const newFormation = new HeroFormation();
    newFormation.deserialize(saved);

    const f = newFormation.getFormation('1');
    expect(f!.slots[0]).toBe('liubei');
    expect(f!.slots[1]).toBe('guanyu');
  });
});

// ═══════════════════════════════════════════════
// §2.2 一键布阵
// ═══════════════════════════════════════════════

describe('§2.2 一键布阵', () => {
  let formation: HeroFormation;

  beforeEach(() => {
    formation = new HeroFormation();
    formation.createFormation('1');
  });

  it('§2.2 autoFormationByIds 按战力降序选择武将', () => {
    const candidateIds = ['liubei', 'guanyu', 'zhangfei', 'zhaoyun', 'zhugeliang'];
    const result = formation.autoFormationByIds(
      candidateIds,
      getMockGeneral,
      calcPower,
      '1',
      5,
    );

    expect(result).not.toBeNull();
    // guanyu (180*2+90*1.5+70 = 525) 应排第一
    expect(result!.slots[0]).toBe('guanyu');
  });

  it('§2.2 autoFormationByIds 最多选择指定数量', () => {
    const candidateIds = Object.keys(mockGenerals);
    const result = formation.autoFormationByIds(
      candidateIds,
      getMockGeneral,
      calcPower,
      '1',
      3,
    );

    expect(result).not.toBeNull();
    const filled = result!.slots.filter((s) => s !== '');
    expect(filled).toHaveLength(3);
  });

  it('§2.2 autoFormationByIds 不允许重复选择（allowOverlap=false）', () => {
    // 先加入编队2
    formation.createFormation('2');
    formation.addToFormation('2', 'guanyu');

    const candidateIds = Object.keys(mockGenerals);
    const result = formation.autoFormationByIds(
      candidateIds,
      getMockGeneral,
      calcPower,
      '1',
      5,
      false,
    );

    expect(result).not.toBeNull();
    // guanyu 已在编队2中，不应出现在编队1
    expect(result!.slots.includes('guanyu')).toBe(false);
  });

  it('§2.2 autoFormationByIds 空候选列表返回 null', () => {
    const result = formation.autoFormationByIds(
      [],
      getMockGeneral,
      calcPower,
      '1',
    );
    expect(result).toBeNull();
  });

  it('§2.2 autoFormation（BattleUnit版）按防御排序分配前后排', () => {
    const units = [
      createMockBattleUnit('u1', '张飞', { defense: 70, maxHp: 800 }),
      createMockBattleUnit('u2', '赵云', { defense: 110, maxHp: 1200 }),
      createMockBattleUnit('u3', '刘备', { defense: 100, maxHp: 1000 }),
      createMockBattleUnit('u4', '诸葛亮', { defense: 60, maxHp: 600 }),
    ];

    const result = autoFormation(units);
    // 防御最高的3个应在前排
    expect(result.frontLine).toContain('u2'); // 赵云 def=110
    expect(result.frontLine).toContain('u3'); // 刘备 def=100
    expect(result.frontLine).toContain('u1'); // 张飞 def=70
    expect(result.backLine).toContain('u4'); // 诸葛亮 def=60
  });

  it('§2.2 autoFormation 空单位列表返回 score=0', () => {
    const result = autoFormation([]);
    expect(result.score).toBe(0);
    expect(result.frontLine).toHaveLength(0);
    expect(result.backLine).toHaveLength(0);
  });

  it('§2.2 autoFormation 最多处理6个单位', () => {
    const units = Array.from({ length: 8 }, (_, i) =>
      createMockBattleUnit(`u${i}`, `单位${i}`, { defense: 50 + i * 10 }),
    );
    const result = autoFormation(units);
    expect(result.team.units.length).toBeLessThanOrEqual(6);
  });
});

// ═══════════════════════════════════════════════
// §2.3 手动调整阵容
// ═══════════════════════════════════════════════

describe('§2.3 手动调整阵容', () => {
  let formation: HeroFormation;

  beforeEach(() => {
    formation = new HeroFormation();
    formation.createFormation('1');
  });

  it('§2.3 addToFormation 添加武将到第一个空位', () => {
    formation.addToFormation('1', 'liubei');
    const f = formation.getFormation('1');
    expect(f!.slots[0]).toBe('liubei');
  });

  it('§2.3 addToFormation 连续添加到不同位置', () => {
    formation.addToFormation('1', 'liubei');
    formation.addToFormation('1', 'guanyu');
    const f = formation.getFormation('1');
    expect(f!.slots[0]).toBe('liubei');
    expect(f!.slots[1]).toBe('guanyu');
  });

  it('§2.3 addToFormation 重复添加同一武将返回 null', () => {
    formation.addToFormation('1', 'liubei');
    const result = formation.addToFormation('1', 'liubei');
    expect(result).toBeNull();
  });

  it('§2.3 removeFromFormation 移除武将', () => {
    formation.addToFormation('1', 'liubei');
    formation.removeFromFormation('1', 'liubei');
    const f = formation.getFormation('1');
    expect(f!.slots[0]).toBe('');
  });

  it('§2.3 setFormation 直接设置武将列表（模拟拖拽换位）', () => {
    // 模拟拖拽：先添加，然后用 setFormation 重排
    formation.addToFormation('1', 'liubei');
    formation.addToFormation('1', 'guanyu');
    formation.addToFormation('1', 'zhangfei');

    // 拖拽换位：guanyu → 位置0, zhangfei → 位置1, liubei → 位置2
    const result = formation.setFormation('1', ['guanyu', 'zhangfei', 'liubei']);
    expect(result).not.toBeNull();
    expect(result!.slots[0]).toBe('guanyu');
    expect(result!.slots[1]).toBe('zhangfei');
    expect(result!.slots[2]).toBe('liubei');
  });

  it('§2.3 setFormation 最多接受6个武将', () => {
    const seven = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const result = formation.setFormation('1', seven);
    expect(result).not.toBeNull();
    const filled = result!.slots.filter((s) => s !== '');
    expect(filled).toHaveLength(6);
  });

  it('§2.3 编队满时 addToFormation 返回 null', () => {
    formation.setFormation('1', ['a', 'b', 'c', 'd', 'e', 'f']);
    const result = formation.addToFormation('1', 'g');
    expect(result).toBeNull();
  });

  it('§2.3 不允许同一武将加入多个编队', () => {
    formation.createFormation('2');
    formation.addToFormation('1', 'liubei');
    const result = formation.addToFormation('2', 'liubei');
    expect(result).toBeNull();
  });
});

// ═══════════════════════════════════════════════
// §2.4 查看战力预估
// ═══════════════════════════════════════════════

describe('§2.4 查看战力预估', () => {
  let formation: HeroFormation;

  beforeEach(() => {
    formation = new HeroFormation();
    formation.createFormation('1');
  });

  it('§2.4 空编队战力为0', () => {
    const f = formation.getFormation('1')!;
    const power = formation.calculateFormationPower(f, getMockGeneral, calcPower);
    expect(power).toBe(0);
  });

  it('§2.4 单武将战力计算正确', () => {
    formation.addToFormation('1', 'liubei');
    const f = formation.getFormation('1')!;
    const liubeiPower = calcPower(mockGenerals.liubei);
    const power = formation.calculateFormationPower(f, getMockGeneral, calcPower);
    expect(power).toBe(liubeiPower);
  });

  it('§2.4 多武将总战力为各武将战力之和', () => {
    formation.addToFormation('1', 'liubei');
    formation.addToFormation('1', 'guanyu');
    formation.addToFormation('1', 'zhangfei');

    const f = formation.getFormation('1')!;
    const power = formation.calculateFormationPower(f, getMockGeneral, calcPower);

    const expected =
      calcPower(mockGenerals.liubei) +
      calcPower(mockGenerals.guanyu) +
      calcPower(mockGenerals.zhangfei);
    expect(power).toBe(expected);
  });

  it('§2.4 不存在的武将不计入战力', () => {
    formation.setFormation('1', ['liubei', 'nonexistent_hero']);
    const f = formation.getFormation('1')!;
    const power = formation.calculateFormationPower(f, getMockGeneral, calcPower);
    expect(power).toBe(calcPower(mockGenerals.liubei));
  });

  it('§2.4 getFormationMemberCount 正确统计', () => {
    formation.addToFormation('1', 'liubei');
    formation.addToFormation('1', 'guanyu');
    expect(formation.getFormationMemberCount('1')).toBe(2);
  });
});

// ═══════════════════════════════════════════════
// §2.5 智能推荐（根据敌方阵容推荐克制阵容）
// ═══════════════════════════════════════════════

describe('§2.5 智能推荐', () => {
  /**
   * 智能推荐的核心逻辑：利用兵种克制关系选择最优阵容
   * 骑兵 > 步兵 > 枪兵 > 骑兵
   * 弓兵、谋士无特殊克制
   *
   * 当前引擎未提供专门的"智能推荐"API，
   * 但可以通过 autoFormation + 克制系数手动组合实现。
   * 此处验证克制关系基础设施的正确性。
   */

  it('§2.5 应能根据敌方兵种选择克制兵种', async () => {
    const { getRestraintMultiplier } = await import('../../../battle/DamageCalculator');
    // 骑兵克制步兵
    expect(getRestraintMultiplier(TroopType.CAVALRY, TroopType.INFANTRY)).toBe(1.5);
    // 步兵克制枪兵
    expect(getRestraintMultiplier(TroopType.INFANTRY, TroopType.SPEARMAN)).toBe(1.5);
    // 枪兵克制骑兵
    expect(getRestraintMultiplier(TroopType.SPEARMAN, TroopType.CAVALRY)).toBe(1.5);
  });

  it('§2.5 被克制时系数为0.7', async () => {
    const { getRestraintMultiplier } = await import('../../../battle/DamageCalculator');
    // 步兵被骑兵克制
    expect(getRestraintMultiplier(TroopType.INFANTRY, TroopType.CAVALRY)).toBe(0.7);
    // 枪兵被步兵克制
    expect(getRestraintMultiplier(TroopType.SPEARMAN, TroopType.INFANTRY)).toBe(0.7);
    // 骑兵被枪兵克制
    expect(getRestraintMultiplier(TroopType.CAVALRY, TroopType.SPEARMAN)).toBe(0.7);
  });

  it('§2.5 弓兵/谋士无特殊克制关系', async () => {
    const { getRestraintMultiplier } = await import('../../../battle/DamageCalculator');
    expect(getRestraintMultiplier(TroopType.ARCHER, TroopType.INFANTRY)).toBe(1.0);
    expect(getRestraintMultiplier(TroopType.STRATEGIST, TroopType.CAVALRY)).toBe(1.0);
    expect(getRestraintMultiplier(TroopType.INFANTRY, TroopType.ARCHER)).toBe(1.0);
    expect(getRestraintMultiplier(TroopType.CAVALRY, TroopType.STRATEGIST)).toBe(1.0);
  });

  it('§2.5 autoFormation 能为不同兵种分配前后排', () => {
    const units = [
      createMockBattleUnit('cavalry1', '骑兵A', { defense: 90, troopType: TroopType.CAVALRY }),
      createMockBattleUnit('spear1', '枪兵A', { defense: 120, troopType: TroopType.SPEARMAN }),
      createMockBattleUnit('infantry1', '步兵A', { defense: 100, troopType: TroopType.INFANTRY }),
    ];
    const result = autoFormation(units);
    // 防御最高的枪兵应在frontLine
    expect(result.frontLine.length).toBeGreaterThan(0);
    expect(result.frontLine).toContain('spear1');
  });
});

// ═══════════════════════════════════════════════
// §2.6 查看敌方预览
// ═══════════════════════════════════════════════

describe('§2.6 查看敌方预览', () => {
  it('§2.6 关卡配置中包含敌方阵容数据', () => {
    const stage = getStage('chapter1_stage1');
    expect(stage).not.toBeUndefined();
    expect(stage!.enemyFormation).toBeDefined();
    expect(stage!.enemyFormation.units.length).toBeGreaterThan(0);
  });

  it('§2.6 敌方阵容包含必要字段：id/name/units/recommendedPower', () => {
    const stage = getStage('chapter1_stage1');
    const enemy = stage!.enemyFormation;
    expect(enemy.id).toBeTruthy();
    expect(enemy.name).toBeTruthy();
    expect(Array.isArray(enemy.units)).toBe(true);
    expect(typeof enemy.recommendedPower).toBe('number');
  });

  it('§2.6 敌方单位包含完整属性', () => {
    const stage = getStage('chapter1_stage1');
    for (const unit of stage!.enemyFormation.units) {
      expect(unit.id).toBeTruthy();
      expect(unit.name).toBeTruthy();
      expect(typeof unit.attack).toBe('number');
      expect(typeof unit.defense).toBe('number');
      expect(typeof unit.maxHp).toBe('number');
      expect(typeof unit.troopType).toBe('string');
      expect(typeof unit.level).toBe('number');
    }
  });

  it('§2.7 BOSS关敌方阵容更强（推荐战力更高）', () => {
    const stage1 = getStage('chapter1_stage1');
    const bossStage = getStage('chapter1_stage5');
    if (stage1 && bossStage) {
      expect(bossStage.enemyFormation.recommendedPower).toBeGreaterThan(
        stage1.enemyFormation.recommendedPower,
      );
    }
  });

  it('§2.6 每章关卡推荐战力递增', () => {
    const stages = getStage('chapter1_stage1');
    const ch1Stages = allChapters[0].stages;
    for (let i = 1; i < ch1Stages.length; i++) {
      expect(ch1Stages[i].recommendedPower).toBeGreaterThanOrEqual(
        ch1Stages[i - 1].recommendedPower,
      );
    }
  });
});
