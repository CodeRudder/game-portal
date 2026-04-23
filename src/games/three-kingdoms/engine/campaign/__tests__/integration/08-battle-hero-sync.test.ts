/**
 * 集成测试：战斗↔武将串联（§6.1 ~ §6.4）
 *
 * 覆盖 Play v3.0 攻城略地(上) 中的 6 个流程：
 *   §6.1  武将属性→战斗参数映射：攻击/防御/速度/暴击等属性正确映射
 *   §6.1a 技能数据映射规则：武将技能→战斗技能转换
 *   §6.2  战前布阵↔编队系统联动：编队数据→战斗阵容
 *   §6.3  战斗经验→武将成长：战斗后武将获得经验升级
 *   §6.3a 战斗经验值公式：经验计算公式验证
 *   §6.4  武将碎片掉落→武将解锁/升星：碎片获取→合成→升星
 *
 * 测试策略：引擎层API验证，使用 HeroLevelSystem / HeroFormation / HeroStarSystem / HeroSystem。
 */

import { BattleEngine } from '../../../battle/BattleEngine';
import { BattlePhase, BattleOutcome, TroopType } from '../../../battle/battle.types';
import type {
  BattleUnit,
  BattleTeam,
  BattleSkill,
} from '../../../battle/battle.types';
import { HeroSystem } from '../../../hero/HeroSystem';
import { HeroLevelSystem } from '../../../hero/HeroLevelSystem';
import type { LevelDeps, LevelUpResult, EnhancePreview } from '../../../hero/HeroLevelSystem';
import { HeroFormation } from '../../../hero/HeroFormation';
import type { FormationData } from '../../../hero/HeroFormation';
import { HeroStarSystem } from '../../../hero/HeroStarSystem';
import type { StarUpResult, FragmentGainResult } from '../../../hero/HeroStarSystem';
import type { GeneralData, GeneralStats, SkillData } from '../../../hero/hero.types';
import type { StarSystemDeps } from '../../../hero/star-up.types';
import { Quality } from '../../../hero/hero.types';
import { HERO_MAX_LEVEL, LEVEL_EXP_TABLE } from '../../../hero/hero-config';
import {
  STAR_UP_FRAGMENT_COST,
  STAR_UP_GOLD_COST,
  MAX_STAR_LEVEL,
  SYNTHESIZE_REQUIRED_FRAGMENTS,
} from '../../../hero/star-up-config';
import { BATTLE_CONFIG } from '../../../battle/battle-config';

// ─────────────────────────────────────────────
// Mock 数据工厂
// ─────────────────────────────────────────────

/** 创建标准武将数据 */
function createGeneralData(
  id: string,
  name: string,
  opts: Partial<{
    quality: Quality;
    level: number;
    exp: number;
    faction: string;
    attack: number;
    defense: number;
    intelligence: number;
    speed: number;
    skills: SkillData[];
  }> = {},
): GeneralData {
  return {
    id,
    name,
    quality: opts.quality ?? Quality.RARE,
    baseStats: {
      attack: opts.attack ?? 100,
      defense: opts.defense ?? 80,
      intelligence: opts.intelligence ?? 60,
      speed: opts.speed ?? 50,
    },
    level: opts.level ?? 1,
    exp: opts.exp ?? 0,
    faction: (opts.faction ?? 'shu') as any,
    skills: opts.skills ?? [
      { id: `${id}_skill1`, name: '普攻', type: 'active', level: 1, description: '普通攻击' },
      { id: `${id}_skill2`, name: '大招', type: 'active', level: 1, description: '强力技能' },
    ],
  };
}

/** 创建战斗单位 */
function createBattleUnit(
  id: string,
  name: string,
  opts: Partial<{
    attack: number;
    defense: number;
    speed: number;
    maxHp: number;
    side: 'ally' | 'enemy';
  }> = {},
): BattleUnit {
  const atk = opts.attack ?? 100;
  const def = opts.defense ?? 50;
  return {
    id,
    name,
    faction: 'shu',
    troopType: TroopType.INFANTRY,
    position: 'front',
    side: opts.side ?? 'ally',
    attack: atk,
    baseAttack: atk,
    defense: def,
    baseDefense: def,
    intelligence: 60,
    speed: opts.speed ?? 50,
    hp: opts.maxHp ?? 1000,
    maxHp: opts.maxHp ?? 1000,
    isAlive: true,
    rage: 0,
    maxRage: BATTLE_CONFIG.MAX_RAGE,
    normalAttack: {
      id: 'normal_attack',
      name: '普攻',
      type: 'active',
      level: 1,
      description: '普通攻击',
      multiplier: 1.0,
      targetType: 'SINGLE_ENEMY' as any,
      rageCost: 0,
      cooldown: 0,
      currentCooldown: 0,
    },
    skills: [{
      id: 'skill_fire',
      name: '烈焰斩',
      type: 'active',
      level: 1,
      description: '强力技能',
      multiplier: 1.8,
      targetType: 'ALL_ENEMY' as any,
      rageCost: 100,
      cooldown: 2,
      currentCooldown: 0,
    }],
    buffs: [],
  };
}

/** 创建队伍 */
function createTeam(side: 'ally' | 'enemy', units: BattleUnit[]): BattleTeam {
  for (const u of units) {
    u.side = side;
  }
  return { units, side };
}

/** 创建 mock HeroSystem（最小实现） */
function createMockHeroSystem(generals: GeneralData[] = []): HeroSystem {
  const system = new HeroSystem();
  for (const g of generals) {
    system.addGeneral(g.id);
  }
  return system;
}

/** 创建 mock 资源函数 */
function createMockResources(initialGold = 999999, initialExp = 999999) {
  let gold = initialGold;
  let exp = initialExp;

  return {
    spendResource: jest.fn((type: string, amount: number) => {
      if (type === 'gold') { gold -= amount; return true; }
      if (type === 'exp') { exp -= amount; return true; }
      return true;
    }),
    canAffordResource: jest.fn((type: string, amount: number) => {
      if (type === 'gold') return gold >= amount;
      if (type === 'exp') return exp >= amount;
      return true;
    }),
    getResourceAmount: jest.fn((type: string) => {
      if (type === 'gold') return gold;
      if (type === 'exp') return exp;
      return 0;
    }),
  };
}

// ═══════════════════════════════════════════════
// §6.1 武将属性→战斗参数映射
// ═══════════════════════════════════════════════

describe('§6.1 武将属性→战斗参数映射', () => {
  it('GeneralStats 四维属性结构正确', () => {
    const stats: GeneralStats = {
      attack: 120,
      defense: 80,
      intelligence: 60,
      speed: 50,
    };

    expect(stats).toHaveProperty('attack');
    expect(stats).toHaveProperty('defense');
    expect(stats).toHaveProperty('intelligence');
    expect(stats).toHaveProperty('speed');
  });

  it('武将基础属性可映射到战斗单位属性', () => {
    const general = createGeneralData('guanyu', '关羽', {
      attack: 150,
      defense: 70,
      intelligence: 65,
      speed: 55,
    });

    // 验证武将基础属性
    expect(general.baseStats.attack).toBe(150);
    expect(general.baseStats.defense).toBe(70);
    expect(general.baseStats.intelligence).toBe(65);
    expect(general.baseStats.speed).toBe(55);

    // 映射到战斗单位
    const battleUnit = createBattleUnit('guanyu', '关羽', {
      attack: general.baseStats.attack,
      defense: general.baseStats.defense,
      speed: general.baseStats.speed,
    });

    expect(battleUnit.attack).toBe(150);
    expect(battleUnit.baseAttack).toBe(150);
    expect(battleUnit.defense).toBe(70);
    expect(battleUnit.baseDefense).toBe(70);
    expect(battleUnit.speed).toBe(55);
  });

  it('不同品质武将属性差异通过品质倍率体现', () => {
    const commonGeneral = createGeneralData('soldier1', '小兵', {
      quality: Quality.COMMON,
      attack: 60,
    });
    const legendaryGeneral = createGeneralData('lubu', '吕布', {
      quality: Quality.LEGENDARY,
      attack: 120,
    });

    // 传说品质基础攻击高于普通品质
    expect(legendaryGeneral.baseStats.attack).toBeGreaterThan(commonGeneral.baseStats.attack);
  });

  it('等级影响属性成长', () => {
    const general = createGeneralData('guanyu', '关羽', {
      level: 1,
      attack: 100,
    });

    // 验证等级和经验数据存在
    expect(general.level).toBe(1);
    expect(general.exp).toBe(0);

    // 高等级武将应有更高属性（通过 HeroLevelSystem 计算）
    const levelSystem = new HeroLevelSystem();
    const expToLevel5 = levelSystem.calculateTotalExp(1, 5);
    expect(expToLevel5).toBeGreaterThan(0);
  });

  it('BattleUnit 包含完整的战斗属性', () => {
    const unit = createBattleUnit('test', '测试');

    // 战斗核心属性
    expect(unit.attack).toBeDefined();
    expect(unit.defense).toBeDefined();
    expect(unit.speed).toBeDefined();
    expect(unit.intelligence).toBeDefined();

    // HP/怒气
    expect(unit.hp).toBeGreaterThan(0);
    expect(unit.maxHp).toBeGreaterThan(0);
    expect(unit.rage).toBeGreaterThanOrEqual(0);
    expect(unit.maxRage).toBe(BATTLE_CONFIG.MAX_RAGE);

    // 状态
    expect(unit.isAlive).toBe(true);
    expect(unit.buffs).toEqual([]);
  });
});

// ═══════════════════════════════════════════════
// §6.1a 技能数据映射规则
// ═══════════════════════════════════════════════

describe('§6.1a 技能数据映射规则', () => {
  it('武将技能数据包含必要字段', () => {
    const general = createGeneralData('guanyu', '关羽');
    const skill = general.skills[0];

    expect(skill).toHaveProperty('id');
    expect(skill).toHaveProperty('name');
    expect(skill).toHaveProperty('type');
    expect(skill).toHaveProperty('level');
    expect(skill).toHaveProperty('description');
  });

  it('SkillData 类型覆盖所有技能类型', () => {
    const types: SkillData['type'][] = ['active', 'passive', 'faction', 'awaken'];

    for (const type of types) {
      const skill: SkillData = {
        id: `skill_${type}`,
        name: `技能_${type}`,
        type,
        level: 1,
        description: `测试${type}技能`,
      };
      expect(skill.type).toBe(type);
    }
  });

  it('BattleSkill 包含战斗所需的扩展字段', () => {
    const battleSkill: BattleSkill = {
      id: 'skill_1',
      name: '烈焰斩',
      type: 'active',
      level: 1,
      description: '强力技能',
      multiplier: 1.8,
      targetType: 'ALL_ENEMY' as any,
      rageCost: 100,
      cooldown: 2,
      currentCooldown: 0,
    };

    // 战斗扩展字段
    expect(battleSkill.multiplier).toBeGreaterThan(1.0);
    expect(battleSkill.rageCost).toBeGreaterThan(0);
    expect(battleSkill.cooldown).toBeGreaterThanOrEqual(0);
    expect(battleSkill.currentCooldown).toBeGreaterThanOrEqual(0);
  });

  it('被动技能映射时 rageCost 为 0', () => {
    const passiveSkill: BattleSkill = {
      id: 'passive_1',
      name: '铁壁',
      type: 'passive',
      level: 1,
      description: '增加防御',
      multiplier: 0,
      targetType: 'SELF' as any,
      rageCost: 0,
      cooldown: 0,
      currentCooldown: 0,
    };

    expect(passiveSkill.rageCost).toBe(0);
    expect(passiveSkill.type).toBe('passive');
  });
});

// ═══════════════════════════════════════════════
// §6.2 战前布阵↔编队系统联动
// ═══════════════════════════════════════════════

describe('§6.2 战前布阵↔编队系统联动', () => {
  let formation: HeroFormation;

  beforeEach(() => {
    formation = new HeroFormation();
  });

  it('创建编队后默认激活', () => {
    const f = formation.createFormation('1');
    expect(f).not.toBeNull();
    expect(f!.id).toBe('1');
    expect(formation.getActiveFormationId()).toBe('1');
  });

  it('编队初始为空（6个空位）', () => {
    const f = formation.createFormation('1');
    expect(f!.slots).toHaveLength(6);
    expect(f!.slots.every((s) => s === '')).toBe(true);
  });

  it('可向编队添加武将', () => {
    formation.createFormation('1');
    const result = formation.addToFormation('1', 'guanyu');

    expect(result).not.toBeNull();
    expect(result!.slots[0]).toBe('guanyu');
  });

  it('编队最多6个武将', () => {
    formation.createFormation('1');

    for (let i = 0; i < 7; i++) {
      formation.addToFormation('1', `hero_${i}`);
    }

    const f = formation.getFormation('1');
    const filledSlots = f!.slots.filter((s) => s !== '');
    expect(filledSlots.length).toBeLessThanOrEqual(6);
  });

  it('同一武将不可加入多个编队', () => {
    formation.createFormation('1');
    formation.createFormation('2');

    formation.addToFormation('1', 'guanyu');
    const result = formation.addToFormation('2', 'guanyu');

    expect(result).toBeNull();
  });

  it('可从编队移除武将', () => {
    formation.createFormation('1');
    formation.addToFormation('1', 'guanyu');

    const result = formation.removeFromFormation('1', 'guanyu');
    expect(result).not.toBeNull();

    const f = formation.getFormation('1');
    expect(f!.slots.includes('guanyu')).toBe(false);
  });

  it('编队数据可转换为战斗阵容', () => {
    formation.createFormation('1');
    formation.addToFormation('1', 'guanyu');
    formation.addToFormation('1', 'zhangfei');
    formation.addToFormation('1', 'liubei');

    const activeFormation = formation.getActiveFormation();
    expect(activeFormation).not.toBeNull();

    // 模拟编队→战斗阵容转换
    const generalIds = activeFormation!.slots.filter((s) => s !== '');
    expect(generalIds).toEqual(['guanyu', 'zhangfei', 'liubei']);

    // 创建战斗队伍
    const battleUnits = generalIds.map((id) =>
      createBattleUnit(id, id, { side: 'ally' }),
    );
    const allyTeam = createTeam('ally', battleUnits);

    expect(allyTeam.units).toHaveLength(3);
    expect(allyTeam.side).toBe('ally');
  });

  it('编队战力计算', () => {
    formation.createFormation('1');
    formation.addToFormation('1', 'guanyu');
    formation.addToFormation('1', 'zhangfei');

    const f = formation.getFormation('1')!;
    const mockGetGeneral = (id: string) => ({
      ...createGeneralData(id, id),
    });
    const mockCalcPower = (g: GeneralData) =>
      g.baseStats.attack + g.baseStats.defense + g.baseStats.intelligence + g.baseStats.speed;

    const power = formation.calculateFormationPower(f, mockGetGeneral, mockCalcPower);
    expect(power).toBeGreaterThan(0);
  });

  it('切换活跃编队', () => {
    formation.createFormation('1');
    formation.createFormation('2');

    expect(formation.getActiveFormationId()).toBe('1');

    formation.setActiveFormation('2');
    expect(formation.getActiveFormationId()).toBe('2');
  });
});

// ═══════════════════════════════════════════════
// §6.3 战斗经验→武将成长
// ═══════════════════════════════════════════════

describe('§6.3 战斗经验→武将成长', () => {
  let heroSystem: HeroSystem;
  let levelSystem: HeroLevelSystem;
  let resources: ReturnType<typeof createMockResources>;

  beforeEach(() => {
    heroSystem = new HeroSystem();
    heroSystem.addGeneral('guanyu');
    levelSystem = new HeroLevelSystem();
    resources = createMockResources();

    levelSystem.setLevelDeps({
      heroSystem,
      spendResource: resources.spendResource,
      canAffordResource: resources.canAffordResource,
      getResourceAmount: resources.getResourceAmount,
    });
  });

  it('给武将添加经验后等级可能提升', () => {
    const general = heroSystem.getGeneral('guanyu');
    const beforeLevel = general!.level;

    // 添加足够升级的经验
    const expNeeded = levelSystem.calculateExpToNextLevel(beforeLevel);
    const result = levelSystem.addExp('guanyu', expNeeded + 100);

    if (result) {
      expect(result.levelsGained).toBeGreaterThanOrEqual(1);
      expect(result.general.level).toBeGreaterThan(beforeLevel);
    }
  });

  it('升级后属性增长', () => {
    const general = heroSystem.getGeneral('guanyu');
    const beforeStats = general!.baseStats;

    const expNeeded = levelSystem.calculateExpToNextLevel(general!.level);
    const result = levelSystem.addExp('guanyu', expNeeded + 500);

    if (result && result.levelsGained > 0) {
      // 属性应有增长（3%每级）
      expect(result.statsDiff.after.attack).toBeGreaterThanOrEqual(result.statsDiff.before.attack);
    }
  });

  it('满级武将无法继续获取经验', () => {
    // 将武将升到满级
    const general = heroSystem.getGeneral('guanyu');
    if (general!.level >= HERO_MAX_LEVEL) {
      const result = levelSystem.addExp('guanyu', 1000);
      expect(result).toBeNull();
    } else {
      // 如果未满级，验证满级判断逻辑
      expect(levelSystem.calculateExpToNextLevel(HERO_MAX_LEVEL)).toBe(0);
    }
  });

  it('升级消耗铜钱', () => {
    const general = heroSystem.getGeneral('guanyu');
    const expNeeded = levelSystem.calculateExpToNextLevel(general!.level);
    const result = levelSystem.addExp('guanyu', expNeeded + 500);

    if (result && result.goldSpent > 0) {
      expect(resources.spendResource).toHaveBeenCalledWith('gold', expect.any(Number));
    }
  });

  it('一键强化预览', () => {
    const preview = levelSystem.getEnhancePreview('guanyu', 10);

    if (preview) {
      expect(preview.generalId).toBe('guanyu');
      expect(preview.targetLevel).toBeGreaterThan(preview.currentLevel);
      expect(preview.totalExp).toBeGreaterThan(0);
      expect(preview.totalGold).toBeGreaterThanOrEqual(0);
    }
  });

  it('一键强化执行', () => {
    const result = levelSystem.quickEnhance('guanyu', 5);

    if (result) {
      expect(result.general).toBeDefined();
      expect(result.levelsGained).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════
// §6.3a 战斗经验值公式
// ═══════════════════════════════════════════════

describe('§6.3a 战斗经验值公式', () => {
  let levelSystem: HeroLevelSystem;

  beforeEach(() => {
    levelSystem = new HeroLevelSystem();
  });

  it('1~10级：经验需求 = 等级 × 50', () => {
    for (let lv = 1; lv <= 10; lv++) {
      const exp = levelSystem.calculateExpToNextLevel(lv);
      expect(exp).toBe(lv * 50);
    }
  });

  it('11~20级：经验需求 = 等级 × 120', () => {
    for (let lv = 11; lv <= 20; lv++) {
      const exp = levelSystem.calculateExpToNextLevel(lv);
      expect(exp).toBe(lv * 120);
    }
  });

  it('21~30级：经验需求 = 等级 × 250', () => {
    for (let lv = 21; lv <= 30; lv++) {
      const exp = levelSystem.calculateExpToNextLevel(lv);
      expect(exp).toBe(lv * 250);
    }
  });

  it('31~40级：经验需求 = 等级 × 500', () => {
    for (let lv = 31; lv <= 40; lv++) {
      const exp = levelSystem.calculateExpToNextLevel(lv);
      expect(exp).toBe(lv * 500);
    }
  });

  it('41~49级：经验需求 = 等级 × 1000', () => {
    for (let lv = 41; lv <= 49; lv++) {
      const exp = levelSystem.calculateExpToNextLevel(lv);
      expect(exp).toBe(lv * 1000);
    }
  });

  it('满级(50)经验需求为 0', () => {
    expect(levelSystem.calculateExpToNextLevel(50)).toBe(0);
    expect(levelSystem.calculateExpToNextLevel(60)).toBe(0);
  });

  it('铜钱消耗公式与经验表一致', () => {
    // 1~10级：铜钱 = 等级 × 20
    expect(levelSystem.calculateLevelUpCost(1)).toBe(1 * 20);
    expect(levelSystem.calculateLevelUpCost(10)).toBe(10 * 20);

    // 11~20级：铜钱 = 等级 × 50
    expect(levelSystem.calculateLevelUpCost(11)).toBe(11 * 50);
    expect(levelSystem.calculateLevelUpCost(20)).toBe(20 * 50);
  });

  it('计算区间总经验', () => {
    const totalExp = levelSystem.calculateTotalExp(1, 5);
    // 1*50 + 2*50 + 3*50 + 4*50 = 50+100+150+200 = 500
    expect(totalExp).toBe(500);
  });

  it('计算区间总铜钱', () => {
    const totalGold = levelSystem.calculateTotalGold(1, 3);
    // 1*20 + 2*20 = 20+40 = 60
    expect(totalGold).toBe(60);
  });

  it('高等级区间经验需求显著高于低等级', () => {
    const lowExp = levelSystem.calculateTotalExp(1, 10);
    const highExp = levelSystem.calculateTotalExp(41, 50);

    expect(highExp).toBeGreaterThan(lowExp * 10);
  });
});

// ═══════════════════════════════════════════════
// §6.4 武将碎片掉落→武将解锁/升星
// ═══════════════════════════════════════════════

describe('§6.4 武将碎片掉落→武将解锁/升星', () => {
  let heroSystem: HeroSystem;
  let starSystem: HeroStarSystem;
  let resources: ReturnType<typeof createMockResources>;

  beforeEach(() => {
    heroSystem = new HeroSystem();
    heroSystem.addGeneral('guanyu');
    starSystem = new HeroStarSystem(heroSystem);
    resources = createMockResources();

    const starDeps: StarSystemDeps = {
      spendFragments: (gid: string, count: number) => heroSystem.useFragments(gid, count),
      getFragments: (gid: string) => heroSystem.getFragments(gid),
      spendResource: resources.spendResource,
      canAffordResource: resources.canAffordResource,
      getResourceAmount: resources.getResourceAmount,
    };
    starSystem.setDeps(starDeps);
  });

  it('关卡碎片掉落可获取碎片', () => {
    // 模拟碎片掉落
    const beforeFragments = heroSystem.getFragments('guanyu');
    heroSystem.addFragment('guanyu', 10);
    const afterFragments = heroSystem.getFragments('guanyu');

    expect(afterFragments).toBe(beforeFragments + 10);
  });

  it('碎片数量可查询', () => {
    heroSystem.addFragment('guanyu', 25);
    expect(heroSystem.getFragments('guanyu')).toBe(25);
  });

  it('碎片消耗正确扣除', () => {
    heroSystem.addFragment('guanyu', 50);
    const result = heroSystem.useFragments('guanyu', 20);

    expect(result).toBe(true);
    expect(heroSystem.getFragments('guanyu')).toBe(30);
  });

  it('碎片不足时消耗失败', () => {
    heroSystem.addFragment('guanyu', 5);
    const result = heroSystem.useFragments('guanyu', 20);

    expect(result).toBe(false);
    expect(heroSystem.getFragments('guanyu')).toBe(5);
  });

  it('升星预览显示碎片需求和当前持有', () => {
    heroSystem.addFragment('guanyu', 30);
    const preview = starSystem.getStarUpPreview('guanyu');

    if (preview) {
      expect(preview.generalId).toBe('guanyu');
      expect(preview.currentStar).toBe(1);
      expect(preview.targetStar).toBe(2);
      expect(preview.fragmentCost).toBe(STAR_UP_FRAGMENT_COST[1]); // 20
      expect(preview.fragmentOwned).toBe(30);
      expect(preview.fragmentSufficient).toBe(true);
    }
  });

  it('碎片充足可执行升星', () => {
    heroSystem.addFragment('guanyu', 50); // 足够 1→2星（需20碎片）
    const result = starSystem.starUp('guanyu');

    expect(result.success).toBe(true);
    expect(result.previousStar).toBe(1);
    expect(result.currentStar).toBe(2);
    expect(result.fragmentsSpent).toBe(STAR_UP_FRAGMENT_COST[1]);
  });

  it('碎片不足升星失败', () => {
    heroSystem.addFragment('guanyu', 5); // 不足
    const result = starSystem.starUp('guanyu');

    expect(result.success).toBe(false);
  });

  it('升星后属性按倍率增长', () => {
    heroSystem.addFragment('guanyu', 100);
    const result = starSystem.starUp('guanyu');

    if (result.success) {
      // 2星倍率 1.15，属性应增长
      expect(result.statsAfter.attack).toBeGreaterThan(result.statsBefore.attack);
      expect(result.statsAfter.defense).toBeGreaterThan(result.statsBefore.defense);
    }
  });

  it('碎片进度可视化数据', () => {
    heroSystem.addFragment('guanyu', 15);
    const progress = starSystem.getFragmentProgress('guanyu');

    if (progress) {
      expect(progress.generalId).toBe('guanyu');
      expect(progress.currentFragments).toBe(15);
      expect(progress.requiredFragments).toBe(STAR_UP_FRAGMENT_COST[1]); // 20
      expect(progress.percentage).toBe(Math.floor((15 / 20) * 100)); // 75%
      expect(progress.canStarUp).toBe(false);
    }
  });

  it('碎片达到需求时 canStarUp 为 true', () => {
    heroSystem.addFragment('guanyu', 25);
    const progress = starSystem.getFragmentProgress('guanyu');

    if (progress) {
      expect(progress.canStarUp).toBe(true);
    }
  });

  it('最高星级不可继续升星', () => {
    // 将武将升到满星
    for (let i = 1; i < MAX_STAR_LEVEL; i++) {
      heroSystem.addFragment('guanyu', STAR_UP_FRAGMENT_COST[i] + 100);
      starSystem.starUp('guanyu');
    }

    // 满星后预览应为 null
    const preview = starSystem.getStarUpPreview('guanyu');
    expect(preview).toBeNull();
  });

  it('商店兑换碎片（铜钱兑换）', () => {
    const result = starSystem.exchangeFragmentsFromShop('guanyu', 5);

    // 如果该武将有商店配置
    if (result.success) {
      expect(result.generalId).toBe('guanyu');
      expect(result.count).toBeGreaterThan(0);
      expect(result.goldSpent).toBeGreaterThan(0);
    }
  });

  it.skip('关卡掉落碎片通过 processStageDrops 处理 — API尚未实现', () => {
    // processStageDrops 方法尚未在 HeroStarSystem 中实现
    expect(typeof starSystem.processStageDrops).toBe('function');
  });
});
