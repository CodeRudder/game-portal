/**
 * R3 Fixer 验证测试
 *
 * FIX-301: 引擎保存/加载流程缺失6个子系统
 * FIX-302: 编队null guard
 * FIX-303: 武将存在性验证
 * FIX-304: 深拷贝问题
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HeroFormation } from '../HeroFormation';
import { HeroDispatchSystem } from '../HeroDispatchSystem';
import { SkillUpgradeSystem, type SkillUpgradeSaveData } from '../SkillUpgradeSystem';
import { AwakeningSystem } from '../AwakeningSystem';
import { HeroStarSystem } from '../HeroStarSystem';
import { HeroSystem } from '../HeroSystem';
import { cloneGeneral } from '../HeroSerializer';
import type { GeneralData, SkillData } from '../hero.types';

// ── FIX-301: 保存/加载覆盖测试 ──

describe('FIX-301: 子系统 serialize/deserialize 覆盖', () => {
  it('SkillUpgradeSystem 应能 serialize/deserialize', () => {
    const sys = new SkillUpgradeSystem();
    const saved: SkillUpgradeSaveData = sys.serialize();
    expect(saved.version).toBe(1);
    expect(saved.upgradeHistory).toEqual({});
    expect(saved.breakthroughSkillUnlocks).toEqual({});

    // 反序列化空数据应正常工作
    const sys2 = new SkillUpgradeSystem();
    sys2.deserialize(saved);
    expect(sys2.serialize()).toEqual(saved);
  });

  it('SkillUpgradeSystem deserialize null 应重置状态', () => {
    const sys = new SkillUpgradeSystem();
    sys.deserialize(null as unknown as SkillUpgradeSaveData);
    const saved = sys.serialize();
    expect(saved.upgradeHistory).toEqual({});
  });

  it('HeroDispatchSystem 应能 serialize/deserialize 结构化数据', () => {
    const sys = new HeroDispatchSystem();
    const saved = sys.serialize();
    expect(saved.version).toBe(1);
    expect(saved.buildingDispatch).toEqual({});
    expect(saved.heroDispatch).toEqual({});

    // 反序列化
    const sys2 = new HeroDispatchSystem();
    sys2.deserialize(saved);
    expect(sys2.serialize()).toEqual(saved);
  });

  it('HeroDispatchSystem deserialize null 应重置状态', () => {
    const sys = new HeroDispatchSystem();
    sys.deserialize(null as unknown as import('../HeroDispatchSystem').DispatchSaveData);
    expect(sys.serialize().buildingDispatch).toEqual({});
  });

  it('HeroStarSystem 应能 serialize/deserialize', () => {
    const heroSystem = new HeroSystem();
    const sys = new HeroStarSystem(heroSystem);
    const saved = sys.serialize();
    expect(saved.version).toBeDefined();
    expect(saved.state.stars).toEqual({});

    const sys2 = new HeroStarSystem(heroSystem);
    sys2.deserialize(saved);
    expect(sys2.serialize()).toEqual(saved);
  });

  it('AwakeningSystem 应能 serialize/deserialize', () => {
    const heroSystem = new HeroSystem();
    const starSystem = new HeroStarSystem(heroSystem);
    const sys = new AwakeningSystem(heroSystem, starSystem);
    const saved = sys.serialize();
    expect(saved.version).toBeDefined();
    expect(saved.state.heroes).toEqual({});

    const sys2 = new AwakeningSystem(heroSystem, starSystem);
    sys2.deserialize(saved);
    expect(sys2.serialize()).toEqual(saved);
  });

  it('RecruitTokenEconomySystem 应能 serialize/deserialize', async () => {
    const { RecruitTokenEconomySystem } = await import('../recruit-token-economy-system');
    const sys = new RecruitTokenEconomySystem();
    const saved = sys.serialize();
    expect(saved.version).toBeDefined();

    const sys2 = new RecruitTokenEconomySystem();
    sys2.deserialize(saved);
    expect(sys2.serialize()).toEqual(saved);
  });
});

// ── FIX-302: 编队 null guard 测试 ──

describe('FIX-302: 编队 null guard', () => {
  let formation: HeroFormation;

  beforeEach(() => {
    formation = new HeroFormation();
  });

  it('addToFormation 应拒绝 null/undefined 武将ID', () => {
    // 创建编队
    formation.createFormation('1');

    // null/undefined/空字符串应被拒绝
    expect(formation.addToFormation('1', null as unknown as string)).toBeNull();
    expect(formation.addToFormation('1', undefined as unknown as string)).toBeNull();
    expect(formation.addToFormation('1', '')).toBeNull();
  });

  it('removeFromFormation 应拒绝 null/undefined 武将ID', () => {
    formation.createFormation('1');
    expect(formation.removeFromFormation('1', null as unknown as string)).toBeNull();
    expect(formation.removeFromFormation('1', undefined as unknown as string)).toBeNull();
  });

  it('setFormation 应过滤 null/undefined 武将ID', () => {
    formation.createFormation('1');

    // 传入包含 null/undefined 的数组
    const result = formation.setFormation('1', [
      'guanyu',
      null as unknown as string,
      undefined as unknown as string,
      '',
      'zhangfei',
    ]);

    expect(result).not.toBeNull();
    // 只有有效ID应被保留
    const validSlots = result!.slots.filter((s) => s !== '');
    expect(validSlots).toEqual(['guanyu', 'zhangfei']);
  });

  it('setFormation 空数组应清空编队', () => {
    formation.createFormation('1');
    formation.addToFormation('1', 'guanyu');

    const result = formation.setFormation('1', []);
    expect(result).not.toBeNull();
    expect(result!.slots.every((s) => s === '')).toBe(true);
  });
});

// ── FIX-303: 武将存在性验证测试 ──

describe('FIX-303: 武将存在性验证', () => {
  it('HeroDispatchSystem.dispatchHero 应拒绝不存在的武将', () => {
    const sys = new HeroDispatchSystem();
    // 未设置 getGeneralFn
    const result = sys.dispatchHero('nonexistent', 'farm' as any);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('未初始化');
  });

  it('HeroDispatchSystem.dispatchHero 应拒绝不存在的武将（有 getGeneralFn）', () => {
    const sys = new HeroDispatchSystem();
    sys.setGetGeneral(() => undefined);

    const result = sys.dispatchHero('nonexistent', 'farm' as any);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('不存在');
  });

  it('HeroDispatchSystem.dispatchHero 应接受存在的武将', () => {
    const sys = new HeroDispatchSystem();
    const mockGeneral: GeneralData = {
      id: 'guanyu',
      name: '关羽',
      quality: 'LEGENDARY' as any,
      baseStats: { attack: 100, defense: 80, intelligence: 70, speed: 60 },
      level: 10,
      exp: 0,
      faction: 'shu' as any,
      skills: [],
    };
    sys.setGetGeneral(() => mockGeneral);

    const result = sys.dispatchHero('guanyu', 'farm' as any);
    expect(result.success).toBe(true);
    expect(result.bonusPercent).toBeGreaterThan(0);
  });

  it('AwakeningSystem.awaken 应拒绝不存在的武将', () => {
    const heroSystem = new HeroSystem();
    const starSystem = new HeroStarSystem(heroSystem);
    const sys = new AwakeningSystem(heroSystem, starSystem);

    // 武将不存在时，checkAwakeningEligible 应返回不满足条件
    const result = sys.awaken('nonexistent');
    expect(result.success).toBe(false);
  });
});

// ── FIX-304: 深拷贝测试 ──

describe('FIX-304: cloneGeneral 深拷贝', () => {
  it('cloneGeneral 应完全独立于原对象', () => {
    const original: GeneralData = {
      id: 'guanyu',
      name: '关羽',
      quality: 'LEGENDARY' as any,
      baseStats: { attack: 100, defense: 80, intelligence: 70, speed: 60 },
      level: 10,
      exp: 500,
      faction: 'shu' as any,
      skills: [
        { id: 'skill1', name: '青龙偃月', type: 'active' as any, level: 3, description: '主动技' },
      ],
    };

    const cloned = cloneGeneral(original);

    // 修改克隆体不应影响原对象
    cloned.level = 99;
    cloned.exp = 9999;
    cloned.baseStats.attack = 999;
    cloned.skills[0].level = 99;
    cloned.skills[0].name = '修改后';

    expect(original.level).toBe(10);
    expect(original.exp).toBe(500);
    expect(original.baseStats.attack).toBe(100);
    expect(original.skills[0].level).toBe(3);
    expect(original.skills[0].name).toBe('青龙偃月');
  });

  it('cloneGeneral 应处理空技能列表', () => {
    const original: GeneralData = {
      id: 'test',
      name: '测试',
      quality: 'COMMON' as any,
      baseStats: { attack: 10, defense: 10, intelligence: 10, speed: 10 },
      level: 1,
      exp: 0,
      faction: 'wei' as any,
      skills: [],
    };

    const cloned = cloneGeneral(original);
    expect(cloned.skills).toEqual([]);
    expect(cloned.skills).not.toBe(original.skills);
  });

  it('cloneGeneral 应返回 null 安全防护', () => {
    const result = cloneGeneral(null as unknown as GeneralData);
    expect(result).toBeNull();
  });
});
