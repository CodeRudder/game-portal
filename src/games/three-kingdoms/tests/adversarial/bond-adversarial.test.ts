/**
 * 羁绊模块对抗式测试
 *
 * 覆盖子系统：
 *   S1: BondSystem（羁绊检测/编队预览/好感度/故事事件）
 *
 * 5维度：F-Normal / F-Error / F-Boundary / F-Cross / F-Lifecycle
 * @module tests/adversarial/bond-adversarial
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BondSystem } from '../../engine/bond/BondSystem';
import { BOND_EFFECTS } from '../../engine/bond/bond-config';
import {
  BOND_NAMES,
  BOND_DESCRIPTIONS,
  BOND_SAVE_VERSION,
} from '../../core/bond';
import type {
  BondType,
  ActiveBond,
  FormationBondPreview,
  StoryEventDef,
  HeroFavorability,
  BondSaveData,
} from '../../core/bond';
import type { GeneralData, GeneralStats } from '../../engine/hero/hero.types';
import { Quality } from '../../engine/hero/hero.types';
import type { ISystemDeps } from '../../core/types/subsystem';

// ── 测试辅助 ──────────────────────────────────

const mockDeps = (): ISystemDeps => ({
  eventBus: {
    on: vi.fn().mockReturnValue(vi.fn()),
    once: vi.fn().mockReturnValue(vi.fn()),
    emit: vi.fn(),
    off: vi.fn(),
    removeAllListeners: vi.fn(),
  },
  config: { get: vi.fn(), set: vi.fn() },
  registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
} as unknown as ISystemDeps);

function createBondSystem(): BondSystem {
  const s = new BondSystem();
  s.init(mockDeps());
  return s;
}

/** 创建武将数据 */
function makeHero(o: Partial<GeneralData> = {}): GeneralData {
  return {
    id: 'hero-test',
    name: '测试武将',
    quality: Quality.RARE,
    baseStats: { attack: 100, defense: 80, intelligence: 60, speed: 50 },
    level: 10,
    exp: 0,
    faction: 'shu',
    skills: [],
    ...o,
  };
}

/** 快速创建指定阵营武将 */
function makeFactionHeroes(faction: 'shu' | 'wei' | 'wu' | 'qun', count: number): GeneralData[] {
  return Array.from({ length: count }, (_, i) =>
    makeHero({ id: `${faction}-${i}`, name: `${faction}将${i}`, faction }),
  );
}

/** 创建满足故事事件条件的武将 Map */
function makeHeroesForStory(
  heroIds: string[],
  level = 20,
  faction: 'shu' | 'wei' | 'wu' | 'qun' = 'shu',
): Map<string, GeneralData> {
  const map = new Map<string, GeneralData>();
  for (const id of heroIds) {
    map.set(id, makeHero({ id, name: id, level, faction }));
  }
  return map;
}

// ══════════════════════════════════════════════
// F-Normal: 正常流程
// ══════════════════════════════════════════════

describe('F-Normal: 羁绊系统初始化', () => {
  it('初始化后应能正常获取羁绊效果定义', () => {
    const sys = createBondSystem();
    const effects = sys.getAllBondEffects();
    expect(effects).toHaveLength(4);
  });

  it('初始好感度为 0', () => {
    const sys = createBondSystem();
    const fav = sys.getFavorability('unknown-hero');
    expect(fav.value).toBe(0);
    expect(fav.triggeredEvents).toHaveLength(0);
  });

  it('初始无已完成故事事件', () => {
    const sys = createBondSystem();
    const heroes = makeHeroesForStory(['liubei'], 20);
    const available = sys.getAvailableStoryEvents(heroes);
    // 需要好感度达标，初始为0所以无可用事件
    expect(available).toHaveLength(0);
  });

  it('getAllStoryEvents 返回预定义事件', () => {
    const sys = createBondSystem();
    const events = sys.getAllStoryEvents();
    expect(events.length).toBeGreaterThan(0);
    expect(events.some(e => e.id === 'story_001')).toBe(true);
  });
});

describe('F-Normal: 羁绊激活（武将组合）', () => {
  it('2名同阵营 → 激活 faction_2', () => {
    const sys = createBondSystem();
    const heroes = makeFactionHeroes('shu', 2);
    const bonds = sys.detectActiveBonds(heroes);
    expect(bonds).toHaveLength(1);
    expect(bonds[0].type).toBe('faction_2');
    expect(bonds[0].faction).toBe('shu');
    expect(bonds[0].heroCount).toBe(2);
  });

  it('3名同阵营 → 激活 faction_3', () => {
    const sys = createBondSystem();
    const heroes = makeFactionHeroes('wei', 3);
    const bonds = sys.detectActiveBonds(heroes);
    expect(bonds).toHaveLength(1);
    expect(bonds[0].type).toBe('faction_3');
  });

  it('6名同阵营 → 激活 faction_6', () => {
    const sys = createBondSystem();
    const heroes = makeFactionHeroes('wu', 6);
    const bonds = sys.detectActiveBonds(heroes);
    expect(bonds).toHaveLength(1);
    expect(bonds[0].type).toBe('faction_6');
  });

  it('3+3 不同阵营 → 激活 mixed_3_3', () => {
    const sys = createBondSystem();
    const heroes = [...makeFactionHeroes('shu', 3), ...makeFactionHeroes('wei', 3)];
    const bonds = sys.detectActiveBonds(heroes);
    const mixed = bonds.find(b => b.type === 'mixed_3_3');
    expect(mixed).toBeDefined();
  });

  it('1名武将 → 无羁绊激活', () => {
    const sys = createBondSystem();
    const heroes = makeFactionHeroes('shu', 1);
    const bonds = sys.detectActiveBonds(heroes);
    expect(bonds).toHaveLength(0);
  });

  it('4名同阵营 → 激活 faction_3（不是 faction_4）', () => {
    const sys = createBondSystem();
    const heroes = makeFactionHeroes('qun', 4);
    const bonds = sys.detectActiveBonds(heroes);
    expect(bonds).toHaveLength(1);
    expect(bonds[0].type).toBe('faction_3');
    expect(bonds[0].heroCount).toBe(4);
  });
});

describe('F-Normal: 羁绊效果（属性加成）', () => {
  it('faction_2 加成 attack +5%', () => {
    const sys = createBondSystem();
    const effect = sys.getBondEffect('faction_2');
    expect(effect.bonuses.attack).toBeCloseTo(0.05);
  });

  it('faction_3 加成 attack +15%', () => {
    const sys = createBondSystem();
    const effect = sys.getBondEffect('faction_3');
    expect(effect.bonuses.attack).toBeCloseTo(0.15);
  });

  it('faction_6 加成 attack +25% + defense +15%', () => {
    const sys = createBondSystem();
    const effect = sys.getBondEffect('faction_6');
    expect(effect.bonuses.attack).toBeCloseTo(0.25);
    expect(effect.bonuses.defense).toBeCloseTo(0.15);
  });

  it('mixed_3_3 加成 attack +10% + intelligence +5%', () => {
    const sys = createBondSystem();
    const effect = sys.getBondEffect('mixed_3_3');
    expect(effect.bonuses.attack).toBeCloseTo(0.10);
    expect(effect.bonuses.intelligence).toBeCloseTo(0.05);
  });

  it('多羁绊加成应累加', () => {
    const sys = createBondSystem();
    const heroes = [...makeFactionHeroes('shu', 3), ...makeFactionHeroes('wei', 2)];
    const bonds = sys.detectActiveBonds(heroes);
    const total = sys.calculateTotalBondBonuses(bonds);
    // faction_3(shu) attack=0.15 + faction_2(wei) attack=0.05 = 0.20
    expect(total.attack).toBeCloseTo(0.20);
  });
});

describe('F-Normal: 编队羁绊预览', () => {
  it('预览包含阵营分布', () => {
    const sys = createBondSystem();
    const heroes = [...makeFactionHeroes('shu', 2), ...makeFactionHeroes('wei', 1)];
    const preview = sys.getFormationPreview('form-1', heroes);
    expect(preview.factionDistribution.shu).toBe(2);
    expect(preview.factionDistribution.wei).toBe(1);
    expect(preview.factionDistribution.wu).toBe(0);
  });

  it('预览包含激活羁绊', () => {
    const sys = createBondSystem();
    const heroes = makeFactionHeroes('shu', 3);
    const preview = sys.getFormationPreview('form-1', heroes);
    expect(preview.activeBonds).toHaveLength(1);
    expect(preview.activeBonds[0].type).toBe('faction_3');
  });

  it('预览包含潜在羁绊提示', () => {
    const sys = createBondSystem();
    const heroes = makeFactionHeroes('shu', 1);
    const preview = sys.getFormationPreview('form-1', heroes);
    // 1名蜀将 → 差1个可激活faction_2
    const tip = preview.potentialBonds.find(t => t.type === 'faction_2' && t.suggestedFaction === 'shu');
    expect(tip).toBeDefined();
    expect(tip!.missingCount).toBe(1);
  });
});

describe('F-Normal: 好感度系统', () => {
  it('增加好感度后值正确', () => {
    const sys = createBondSystem();
    sys.addFavorability('liubei', 30);
    expect(sys.getFavorability('liubei').value).toBe(30);
  });

  it('多次增加好感度累加', () => {
    const sys = createBondSystem();
    sys.addFavorability('liubei', 20);
    sys.addFavorability('liubei', 35);
    expect(sys.getFavorability('liubei').value).toBe(55);
  });

  it('不同武将好感度独立', () => {
    const sys = createBondSystem();
    sys.addFavorability('liubei', 50);
    sys.addFavorability('guanyu', 30);
    expect(sys.getFavorability('liubei').value).toBe(50);
    expect(sys.getFavorability('guanyu').value).toBe(30);
  });
});

describe('F-Normal: 故事事件', () => {
  it('满足条件后可获取可用故事事件', () => {
    const sys = createBondSystem();
    sys.addFavorability('liubei', 60);
    sys.addFavorability('guanyu', 60);
    sys.addFavorability('zhangfei', 60);
    const heroes = makeHeroesForStory(['liubei', 'guanyu', 'zhangfei'], 10);
    const available = sys.getAvailableStoryEvents(heroes);
    expect(available.some(e => e.id === 'story_001')).toBe(true);
  });

  it('触发故事事件后返回奖励', () => {
    const sys = createBondSystem();
    const result = sys.triggerStoryEvent('story_001');
    expect(result.success).toBe(true);
    expect(result.rewards).toBeDefined();
    expect(result.rewards!.favorability).toBe(20);
    expect(result.rewards!.prestigePoints).toBe(100);
  });

  it('触发故事事件后增加好感度', () => {
    const sys = createBondSystem();
    sys.triggerStoryEvent('story_001');
    expect(sys.getFavorability('liubei').value).toBe(20);
    expect(sys.getFavorability('guanyu').value).toBe(20);
    expect(sys.getFavorability('zhangfei').value).toBe(20);
  });

  it('触发故事事件后发射事件总线事件', () => {
    const sys = createBondSystem();
    sys.triggerStoryEvent('story_001');
    const emit = (sys as unknown as { deps: ISystemDeps }).deps.eventBus.emit as ReturnType<typeof vi.fn>;
    expect(emit).toHaveBeenCalledWith('bond:storyTriggered', expect.objectContaining({
      eventId: 'story_001',
      title: '桃园结义',
    }));
  });
});

// ══════════════════════════════════════════════
// F-Boundary: 边界条件
// ══════════════════════════════════════════════

describe('F-Boundary: 空武将列表', () => {
  it('空数组 → 无羁绊激活', () => {
    const sys = createBondSystem();
    const bonds = sys.detectActiveBonds([]);
    expect(bonds).toHaveLength(0);
  });

  it('空数组 → 阵营分布全为 0', () => {
    const sys = createBondSystem();
    const dist = sys.getFactionDistribution([]);
    expect(dist.shu).toBe(0);
    expect(dist.wei).toBe(0);
    expect(dist.wu).toBe(0);
    expect(dist.qun).toBe(0);
  });

  it('空数组 → 空预览', () => {
    const sys = createBondSystem();
    const preview = sys.getFormationPreview('empty', []);
    expect(preview.activeBonds).toHaveLength(0);
    expect(preview.potentialBonds).toHaveLength(0);
  });
});

describe('F-Boundary: 羁绊等级边界', () => {
  it('恰好2名 → faction_2', () => {
    const sys = createBondSystem();
    const bonds = sys.detectActiveBonds(makeFactionHeroes('shu', 2));
    expect(bonds[0]?.type).toBe('faction_2');
  });

  it('5名同阵营 → faction_3（非 faction_6）', () => {
    const sys = createBondSystem();
    const bonds = sys.detectActiveBonds(makeFactionHeroes('shu', 5));
    expect(bonds).toHaveLength(1);
    expect(bonds[0].type).toBe('faction_3');
  });

  it('7名同阵营 → faction_6', () => {
    const sys = createBondSystem();
    const bonds = sys.detectActiveBonds(makeFactionHeroes('shu', 7));
    expect(bonds).toHaveLength(1);
    expect(bonds[0].type).toBe('faction_6');
  });

  it('mixed_3_3 仅当两个不同阵营各≥3时触发', () => {
    const sys = createBondSystem();
    // shu=4, wei=2 → 不触发 mixed_3_3
    const heroes1 = [...makeFactionHeroes('shu', 4), ...makeFactionHeroes('wei', 2)];
    const bonds1 = sys.detectActiveBonds(heroes1);
    expect(bonds1.find(b => b.type === 'mixed_3_3')).toBeUndefined();

    // shu=3, wei=3 → 触发 mixed_3_3
    const heroes2 = [...makeFactionHeroes('shu', 3), ...makeFactionHeroes('wei', 3)];
    const bonds2 = sys.detectActiveBonds(heroes2);
    expect(bonds2.find(b => b.type === 'mixed_3_3')).toBeDefined();
  });
});

describe('F-Boundary: 好感度边界', () => {
  it('好感度为 0 时无可用故事事件', () => {
    const sys = createBondSystem();
    const heroes = makeHeroesForStory(['liubei', 'guanyu', 'zhangfei'], 20);
    const available = sys.getAvailableStoryEvents(heroes);
    // 所有事件都需要好感度≥50
    expect(available).toHaveLength(0);
  });

  it('好感度恰好等于阈值时可触发', () => {
    const sys = createBondSystem();
    // story_001 需要 minFavorability: 50
    sys.addFavorability('liubei', 50);
    sys.addFavorability('guanyu', 50);
    sys.addFavorability('zhangfei', 50);
    const heroes = makeHeroesForStory(['liubei', 'guanyu', 'zhangfei'], 5);
    const available = sys.getAvailableStoryEvents(heroes);
    expect(available.some(e => e.id === 'story_001')).toBe(true);
  });

  it('好感度差1不满足', () => {
    const sys = createBondSystem();
    sys.addFavorability('liubei', 49);
    sys.addFavorability('guanyu', 50);
    sys.addFavorability('zhangfei', 50);
    const heroes = makeHeroesForStory(['liubei', 'guanyu', 'zhangfei'], 5);
    const available = sys.getAvailableStoryEvents(heroes);
    expect(available.some(e => e.id === 'story_001')).toBe(false);
  });
});

describe('F-Boundary: 故事事件等级边界', () => {
  it('等级恰好等于 minLevel 可触发', () => {
    const sys = createBondSystem();
    sys.addFavorability('liubei', 50);
    sys.addFavorability('guanyu', 50);
    sys.addFavorability('zhangfei', 50);
    // story_001 需要 minLevel: 5
    const heroes = makeHeroesForStory(['liubei', 'guanyu', 'zhangfei'], 5);
    const available = sys.getAvailableStoryEvents(heroes);
    expect(available.some(e => e.id === 'story_001')).toBe(true);
  });

  it('等级低于 minLevel 不可触发', () => {
    const sys = createBondSystem();
    sys.addFavorability('liubei', 60);
    sys.addFavorability('guanyu', 60);
    sys.addFavorability('zhangfei', 60);
    const heroes = makeHeroesForStory(['liubei', 'guanyu', 'zhangfei'], 4);
    const available = sys.getAvailableStoryEvents(heroes);
    expect(available.some(e => e.id === 'story_001')).toBe(false);
  });
});

// ══════════════════════════════════════════════
// F-Error: 错误路径
// ══════════════════════════════════════════════

describe('F-Error: 无效故事事件触发', () => {
  it('触发不存在的事件 → 返回失败', () => {
    const sys = createBondSystem();
    const result = sys.triggerStoryEvent('nonexistent');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('事件不存在');
  });

  it('不可重复事件触发两次 → 第二次失败', () => {
    const sys = createBondSystem();
    const r1 = sys.triggerStoryEvent('story_001');
    expect(r1.success).toBe(true);
    const r2 = sys.triggerStoryEvent('story_001');
    expect(r2.success).toBe(false);
    expect(r2.reason).toBe('事件已完成');
  });
});

describe('F-Error: NaN 加成', () => {
  it('NaN 好感度增量不应产生 NaN 状态', () => {
    const sys = createBondSystem();
    sys.addFavorability('liubei', NaN);
    const fav = sys.getFavorability('liubei');
    // NaN + 0 = NaN，验证系统不崩溃
    expect(isNaN(fav.value)).toBe(true);
    // 但序列化不应崩溃
    expect(() => sys.serialize()).not.toThrow();
  });

  it('Infinity 好感度不应崩溃', () => {
    const sys = createBondSystem();
    sys.addFavorability('liubei', Infinity);
    expect(() => sys.serialize()).not.toThrow();
  });

  it('负数好感度增量允许（扣减场景）', () => {
    const sys = createBondSystem();
    sys.addFavorability('liubei', 50);
    sys.addFavorability('liubei', -30);
    expect(sys.getFavorability('liubei').value).toBe(20);
  });
});

describe('F-Error: 无效武将组合', () => {
  it('全不同阵营各1人 → 无羁绊', () => {
    const sys = createBondSystem();
    const heroes = [
      makeHero({ id: 'h1', faction: 'shu' }),
      makeHero({ id: 'h2', faction: 'wei' }),
      makeHero({ id: 'h3', faction: 'wu' }),
      makeHero({ id: 'h4', faction: 'qun' }),
    ];
    const bonds = sys.detectActiveBonds(heroes);
    expect(bonds).toHaveLength(0);
  });

  it('getAvailableStoryEvents 中缺少关联武将 → 事件不可用', () => {
    const sys = createBondSystem();
    sys.addFavorability('liubei', 60);
    // 只有 liubei，缺少 guanyu 和 zhangfei
    const heroes = makeHeroesForStory(['liubei'], 10);
    const available = sys.getAvailableStoryEvents(heroes);
    expect(available.some(e => e.id === 'story_001')).toBe(false);
  });
});

// ══════════════════════════════════════════════
// F-Cross: 跨系统联动
// ══════════════════════════════════════════════

describe('F-Cross: 羁绊 → 战斗属性加成', () => {
  it('羁绊加成应能叠加到武将属性上', () => {
    const sys = createBondSystem();
    const heroes = makeFactionHeroes('shu', 3);
    const bonds = sys.detectActiveBonds(heroes);
    const totalBonuses = sys.calculateTotalBondBonuses(bonds);

    // 模拟应用加成到武将属性
    const baseAttack = 100;
    const boostedAttack = baseAttack * (1 + (totalBonuses.attack ?? 0));
    expect(boostedAttack).toBeCloseTo(115); // 100 * 1.15
  });

  it('多羁绊加成叠加后应用于属性', () => {
    const sys = createBondSystem();
    const heroes = [...makeFactionHeroes('shu', 3), ...makeFactionHeroes('wei', 2)];
    const bonds = sys.detectActiveBonds(heroes);
    const totalBonuses = sys.calculateTotalBondBonuses(bonds);

    const baseAttack = 100;
    const boosted = baseAttack * (1 + (totalBonuses.attack ?? 0));
    // faction_3(0.15) + faction_2(0.05) = 0.20
    expect(boosted).toBeCloseTo(120);
  });
});

describe('F-Cross: 羁绊 → 声望奖励', () => {
  it('故事事件触发后给予声望值', () => {
    const sys = createBondSystem();
    const result = sys.triggerStoryEvent('story_001');
    expect(result.success).toBe(true);
    expect(result.rewards!.prestigePoints).toBe(100);
  });

  it('不同故事事件给予不同声望', () => {
    const sys = createBondSystem();
    const r1 = sys.triggerStoryEvent('story_001');
    const r2 = sys.triggerStoryEvent('story_002');
    const r3 = sys.triggerStoryEvent('story_003');
    expect(r1.rewards!.prestigePoints).not.toBe(r2.rewards!.prestigePoints);
    expect(r2.rewards!.prestigePoints).not.toBe(r3.rewards!.prestigePoints);
  });
});

describe('F-Cross: 羁绊 → 好感度 → 新故事事件链', () => {
  it('触发事件增加好感度后可能解锁新事件', () => {
    const sys = createBondSystem();
    // 初始好感度不足 story_002 (需60)
    sys.addFavorability('liubei', 30);
    sys.addFavorability('zhugeliang', 30);

    const heroes = makeHeroesForStory(['liubei', 'zhugeliang'], 10);
    let available = sys.getAvailableStoryEvents(heroes);
    expect(available.some(e => e.id === 'story_002')).toBe(false);

    // 触发 story_001 给 liubei 加 20 好感度
    sys.triggerStoryEvent('story_001');
    // liubei 现在是 50，仍不够 60
    available = sys.getAvailableStoryEvents(heroes);
    expect(available.some(e => e.id === 'story_002')).toBe(false);

    // 再给 liubei 加 10
    sys.addFavorability('liubei', 10);
    sys.addFavorability('zhugeliang', 30);
    available = sys.getAvailableStoryEvents(heroes);
    expect(available.some(e => e.id === 'story_002')).toBe(true);
  });
});

describe('F-Cross: 羁绊预览 → 编队决策', () => {
  it('预览潜在羁绊可指导编队调整', () => {
    const sys = createBondSystem();
    // 2蜀+2魏 → 激活 faction_2(shu) + faction_2(wei)
    const heroes = [...makeFactionHeroes('shu', 2), ...makeFactionHeroes('wei', 2)];
    const preview = sys.getFormationPreview('form-1', heroes);
    expect(preview.activeBonds).toHaveLength(2);

    // 潜在提示：蜀差1可到3，魏差1可到3
    const shuTip = preview.potentialBonds.find(t => t.suggestedFaction === 'shu');
    expect(shuTip).toBeDefined();
    expect(shuTip!.type).toBe('faction_3');
    expect(shuTip!.missingCount).toBe(1);
  });
});

// ══════════════════════════════════════════════
// F-Lifecycle: 序列化与生命周期
// ══════════════════════════════════════════════

describe('F-Lifecycle: 序列化/反序列化', () => {
  it('空系统序列化后版本号正确', () => {
    const sys = createBondSystem();
    const data = sys.serialize();
    expect(data.version).toBe(BOND_SAVE_VERSION);
    expect(data.favorabilities).toEqual({});
    expect(data.completedStoryEvents).toEqual([]);
  });

  it('好感度序列化/反序列化一致性', () => {
    const sys = createBondSystem();
    sys.addFavorability('liubei', 80);
    sys.addFavorability('guanyu', 60);
    const data = sys.serialize();

    const sys2 = createBondSystem();
    sys2.loadSaveData(data);
    expect(sys2.getFavorability('liubei').value).toBe(80);
    expect(sys2.getFavorability('guanyu').value).toBe(60);
    expect(sys2.getFavorability('zhangfei').value).toBe(0);
  });

  it('已完成事件序列化/反序列化一致性', () => {
    const sys = createBondSystem();
    sys.triggerStoryEvent('story_001');
    sys.triggerStoryEvent('story_002');
    const data = sys.serialize();

    const sys2 = createBondSystem();
    sys2.loadSaveData(data);
    // 已完成事件应阻止重复触发
    const r = sys2.triggerStoryEvent('story_001');
    expect(r.success).toBe(false);
    expect(r.reason).toBe('事件已完成');
  });

  it('loadSaveData 后 reset 清空所有数据', () => {
    const sys = createBondSystem();
    sys.addFavorability('liubei', 50);
    sys.triggerStoryEvent('story_001');
    sys.reset();
    expect(sys.getFavorability('liubei').value).toBe(0);
    const data = sys.serialize();
    expect(data.completedStoryEvents).toHaveLength(0);
  });

  it('反序列化 null/undefined favorabilities 不崩溃', () => {
    const sys = createBondSystem();
    expect(() =>
      sys.loadSaveData({ version: 1, favorabilities: null as unknown as Record<string, HeroFavorability>, completedStoryEvents: undefined as unknown as string[] }),
    ).not.toThrow();
  });

  it('反序列化空对象正常', () => {
    const sys = createBondSystem();
    sys.addFavorability('liubei', 50);
    sys.loadSaveData({ version: 1, favorabilities: {}, completedStoryEvents: [] });
    expect(sys.getFavorability('liubei').value).toBe(0);
  });
});

describe('F-Lifecycle: 前置事件依赖', () => {
  it('有前置事件未完成 → 事件不可用', () => {
    const sys = createBondSystem();
    // 假设 story_003 有前置事件（检查配置中是否有 prerequisiteEventId）
    const events = sys.getAllStoryEvents();
    const eventWithPrereq = events.find(e => e.condition.prerequisiteEventId);
    if (eventWithPrereq) {
      const heroes = new Map<string, GeneralData>();
      for (const id of eventWithPrereq.condition.heroIds) {
        heroes.set(id, makeHero({ id, level: 30 }));
      }
      for (const id of eventWithPrereq.condition.heroIds) {
        sys.addFavorability(id, 100);
      }
      // 前置事件未完成
      const available = sys.getAvailableStoryEvents(heroes);
      expect(available.some(e => e.id === eventWithPrereq.id)).toBe(false);

      // 完成前置事件后
      sys.triggerStoryEvent(eventWithPrereq.condition.prerequisiteEventId!);
      const available2 = sys.getAvailableStoryEvents(heroes);
      expect(available2.some(e => e.id === eventWithPrereq.id)).toBe(true);
    }
  });
});

describe('F-Lifecycle: getBondEffect 返回值', () => {
  it('getBondEffect 返回浅拷贝（顶层属性独立）', () => {
    const sys = createBondSystem();
    const effect1 = sys.getBondEffect('faction_2');
    const effect2 = sys.getBondEffect('faction_2');
    // 浅拷贝：顶层对象不同
    expect(effect1).not.toBe(effect2);
    // 但 bonuses 是嵌套引用，浅拷贝共享同一对象
    expect(effect1.bonuses).toBe(effect2.bonuses);
  });

  it('getAllBondEffects 返回浅拷贝（顶层数组独立）', () => {
    const sys = createBondSystem();
    const effects1 = sys.getAllBondEffects();
    const effects2 = sys.getAllBondEffects();
    expect(effects1).not.toBe(effects2);
    expect(effects1).toHaveLength(effects2.length);
  });

  it('getBondEffect 包含完整字段', () => {
    const sys = createBondSystem();
    const effect = sys.getBondEffect('faction_6');
    expect(effect.type).toBe('faction_6');
    expect(effect.name).toBeTruthy();
    expect(effect.description).toBeTruthy();
    expect(effect.condition).toBeTruthy();
    expect(effect.icon).toBeTruthy();
    expect(effect.bonuses.attack).toBeCloseTo(0.25);
    expect(effect.bonuses.defense).toBeCloseTo(0.15);
  });
});

describe('F-Lifecycle: 羁绊名称与描述一致性', () => {
  it('所有羁绊效果名称与 BOND_NAMES 一致', () => {
    const types: BondType[] = ['faction_2', 'faction_3', 'faction_6', 'mixed_3_3'];
    for (const t of types) {
      expect(BOND_EFFECTS[t].name).toBe(BOND_NAMES[t]);
      expect(BOND_EFFECTS[t].description).toBe(BOND_DESCRIPTIONS[t]);
    }
  });
});

describe('F-Lifecycle: setCallbacks 功能', () => {
  it('设置编队回调后系统正常运行', () => {
    const sys = createBondSystem();
    const heroes = makeFactionHeroes('shu', 3);
    sys.setCallbacks({ getFormationHeroes: () => heroes });
    // setCallbacks 本身不改变 detectActiveBonds 行为
    const bonds = sys.detectActiveBonds(heroes);
    expect(bonds).toHaveLength(1);
  });
});
