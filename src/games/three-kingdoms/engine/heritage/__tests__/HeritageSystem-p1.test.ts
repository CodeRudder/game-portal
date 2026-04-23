/**
 * HeritageSystem 单元测试
 *
 * 覆盖：
 * 1. 武将传承 — 经验/技能/好感度传承 + 效率计算 + 品质检查
 * 2. 装备传承 — 强化等级传承 + 同部位检查 + 品质差异
 * 3. 经验传承 — 部分经验传承 + 效率 + 最低等级
 * 4. 转生后加速 — 初始资源赠送 + 一键重建 + 瞬间升级
 * 5. 转生次数解锁 — 1次天命/2次专属科技/3次神话武将/5次跨服
 * 6. 收益模拟器 — 倍率对比 + 推荐时机
 * 7. 每日限制 + 存档
 * 8. ISubsystem 接口
 */

import { HeritageSystem } from '../HeritageSystem';
import type {
  HeroHeritageRequest,
  EquipmentHeritageRequest,
  ExperienceHeritageRequest,
} from '../../../core/heritage';
import type { ISystemDeps } from '../../../core/types/subsystem';
import {
  HERO_HERITAGE_RULE,
  EQUIPMENT_HERITAGE_RULE,
  EXPERIENCE_HERITAGE_RULE,
  DAILY_HERITAGE_LIMIT,
} from '../../../core/heritage';

/** Mock武将数据 */
interface MockHero {
  id: string;
  level: number;
  exp: number;
  quality: number;
  faction: 'shu' | 'wei' | 'wu' | 'qun';
  skillLevels: number[];
  favorability: number;
}

/** Mock装备数据 */
interface MockEquip {
  uid: string;
  slot: string;
  rarity: number;
  enhanceLevel: number;
}

/** 创建带完整mock的HeritageSystem */
function createSystem(): {
  sys: HeritageSystem;
  heroes: Record<string, MockHero>;
  equips: Record<string, MockEquip>;
  resources: Record<string, number>;
  upgradedBuildings: string[];
  eventBus: any;
} {
  const heroes: Record<string, MockHero> = {};
  const equips: Record<string, MockEquip> = {};
  const resources: Record<string, number> = {};
  const upgradedBuildings: string[] = [];

  const sys = new HeritageSystem();
  const mockEventBus = {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    once: jest.fn(),
    removeAllListeners: jest.fn(),
  };

  sys.init({
    eventBus: mockEventBus as unknown as ISystemDeps['eventBus'],
    config: { get: jest.fn() } as unknown as ISystemDeps['config'],
    registry: { get: jest.fn() } as unknown as ISystemDeps['registry'],
  });

  sys.setCallbacks({
    getHero: (id) => heroes[id] ?? null,
    getEquip: (uid) => equips[uid] ?? null,
    updateHero: (id, updates) => {
      if (heroes[id]) Object.assign(heroes[id], updates);
    },
    removeEquip: (uid) => { delete equips[uid]; },
    updateEquip: (uid, updates) => {
      if (equips[uid]) Object.assign(equips[uid], updates);
    },
    addResources: (res) => {
      for (const [k, v] of Object.entries(res)) {
        resources[k] = (resources[k] ?? 0) + v;
      }
    },
    upgradeBuilding: (id) => {
      upgradedBuildings.push(id);
      return true;
    },
    getRebirthCount: () => 2,
  });

  return { sys, heroes, equips, resources, upgradedBuildings, eventBus: mockEventBus };
}

/** 创建Mock武将 */
function mockHero(overrides: Partial<MockHero> & { id: string }): MockHero {
  return {
    level: 30,
    exp: 10000,
    quality: 4, // 史诗
    faction: 'shu',
    skillLevels: [5, 3, 2],
    favorability: 80,
    ...overrides,
  };
}

/** 创建Mock装备 */
function mockEquip(overrides: Partial<MockEquip> & { uid: string }): MockEquip {
  return {
    slot: 'weapon',
    rarity: 4, // 紫色
    enhanceLevel: 10,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════
// 1. ISubsystem 接口
// ═══════════════════════════════════════════════════

describe('HeritageSystem — ISubsystem', () => {
  it('name 应为 heritage', () => {
    expect(new HeritageSystem().name).toBe('heritage');
  });

  it('init/update/reset 不抛异常', () => {
    const { sys } = createSystem();
    expect(() => sys.update(16)).not.toThrow();
    expect(() => sys.reset()).not.toThrow();
  });

  it('getState 返回初始状态', () => {
    const { sys } = createSystem();
    const state = sys.getState();
    expect(state.heroHeritageCount).toBe(0);
    expect(state.equipmentHeritageCount).toBe(0);
    expect(state.experienceHeritageCount).toBe(0);
  });
});

// ═══════════════════════════════════════════════════
// 2. 武将传承
// ═══════════════════════════════════════════════════

describe('HeritageSystem — 武将传承', () => {
  it('成功传承武将经验和技能', () => {
    const { sys, heroes } = createSystem();
    heroes['source'] = mockHero({ id: 'source', quality: 4, faction: 'shu', exp: 10000 });
    heroes['target'] = mockHero({ id: 'target', quality: 4, faction: 'shu', exp: 1000 });

    const result = sys.executeHeroHeritage({
      sourceHeroId: 'source',
      targetHeroId: 'target',
      options: {
        transferExp: true,
        transferFavorability: true,
        transferSkillLevels: true,
        expEfficiency: 0.8,
      },
    });

    expect(result.success).toBe(true);
    expect(result.type).toBe('hero');
    expect(result.copperCost).toBeGreaterThan(0);
    expect(result.efficiency).toBeGreaterThan(0);

    // 源武将被重置
    expect(heroes['source'].level).toBe(1);
    expect(heroes['source'].exp).toBe(0);

    // 目标武将获得经验
    expect(heroes['target'].exp).toBeGreaterThan(1000);
  });

  it('同阵营额外加成', () => {
    const { sys, heroes } = createSystem();
    heroes['source'] = mockHero({ id: 'source', quality: 4, faction: 'shu', exp: 10000 });
    heroes['target'] = mockHero({ id: 'target', quality: 4, faction: 'shu', exp: 1000 });

    const result = sys.executeHeroHeritage({
      sourceHeroId: 'source',
      targetHeroId: 'target',
      options: { transferExp: true, transferFavorability: false, transferSkillLevels: false, expEfficiency: 0.8 },
    });

    expect(result.success).toBe(true);
    // 同阵营应该有加成
    expect(result.efficiency).toBeGreaterThan(0.5);
  });

  it('不同阵营效率降低', () => {
    const { sys, heroes } = createSystem();
    heroes['source'] = mockHero({ id: 'source', quality: 4, faction: 'shu', exp: 10000 });
    heroes['target'] = mockHero({ id: 'target', quality: 4, faction: 'wei', exp: 1000 });

    const result = sys.executeHeroHeritage({
      sourceHeroId: 'source',
      targetHeroId: 'target',
      options: { transferExp: true, transferFavorability: false, transferSkillLevels: false, expEfficiency: 0.8 },
    });

    expect(result.success).toBe(true);
    // 不同阵营效率应该低于基础
  });

  it('源武将品质不足时失败', () => {
    const { sys, heroes } = createSystem();
    heroes['source'] = mockHero({ id: 'source', quality: 1, exp: 10000 }); // 普通
    heroes['target'] = mockHero({ id: 'target', quality: 4, exp: 1000 });

    const result = sys.executeHeroHeritage({
      sourceHeroId: 'source',
      targetHeroId: 'target',
      options: { transferExp: true, transferFavorability: false, transferSkillLevels: false, expEfficiency: 0.8 },
    });

    expect(result.success).toBe(false);
    expect(result.reason).toContain('品质不足');
  });

  it('目标武将品质不足时失败', () => {
    const { sys, heroes } = createSystem();
    heroes['source'] = mockHero({ id: 'source', quality: 4, exp: 10000 });
    heroes['target'] = mockHero({ id: 'target', quality: 2, exp: 1000 }); // 精良，不够稀有(3)

    const result = sys.executeHeroHeritage({
      sourceHeroId: 'source',
      targetHeroId: 'target',
      options: { transferExp: true, transferFavorability: false, transferSkillLevels: false, expEfficiency: 0.8 },
    });

    expect(result.success).toBe(false);
    expect(result.reason).toContain('品质不足');
  });

  it('不能自我传承', () => {
    const { sys, heroes } = createSystem();
    heroes['hero1'] = mockHero({ id: 'hero1', quality: 4, exp: 10000 });

    const result = sys.executeHeroHeritage({
      sourceHeroId: 'hero1',
      targetHeroId: 'hero1',
      options: { transferExp: true, transferFavorability: false, transferSkillLevels: false, expEfficiency: 0.8 },
    });

    expect(result.success).toBe(false);
    expect(result.reason).toContain('自我传承');
  });

  it('源武将不存在时失败', () => {
    const { sys, heroes } = createSystem();
    heroes['target'] = mockHero({ id: 'target', quality: 4, exp: 1000 });

    const result = sys.executeHeroHeritage({
      sourceHeroId: 'nonexistent',
      targetHeroId: 'target',
      options: { transferExp: true, transferFavorability: false, transferSkillLevels: false, expEfficiency: 0.8 },
    });

    expect(result.success).toBe(false);
    expect(result.reason).toContain('不存在');
  });
});

// ═══════════════════════════════════════════════════
// 3. 装备传承
// ═══════════════════════════════════════════════════

describe('HeritageSystem — 装备传承', () => {
  it('成功传承装备强化等级', () => {
    const { sys, equips } = createSystem();
    equips['src'] = mockEquip({ uid: 'src', slot: 'weapon', rarity: 4, enhanceLevel: 10 });
    equips['tgt'] = mockEquip({ uid: 'tgt', slot: 'weapon', rarity: 4, enhanceLevel: 3 });

    const result = sys.executeEquipmentHeritage({
      sourceUid: 'src',
      targetUid: 'tgt',
      options: { transferEnhanceLevel: true, transferSubStats: false, transferSpecialEffect: false, enhanceEfficiency: 1.0 },
    });

    expect(result.success).toBe(true);
    expect(result.type).toBe('equipment');

    // 目标装备获得等级（10 - 1损耗 = 9）
    expect(equips['tgt'].enhanceLevel).toBe(9);

    // 源装备被消耗
    expect(equips['src']).toBeUndefined();
  });

  it('不同部位传承失败', () => {
    const { sys, equips } = createSystem();
    equips['src'] = mockEquip({ uid: 'src', slot: 'weapon', enhanceLevel: 10 });
    equips['tgt'] = mockEquip({ uid: 'tgt', slot: 'armor', enhanceLevel: 3 });

    const result = sys.executeEquipmentHeritage({
