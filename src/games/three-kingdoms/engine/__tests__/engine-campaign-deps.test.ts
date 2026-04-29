/**
 * engine-campaign-deps.ts 单元测试
 *
 * 覆盖：
 * - createCampaignSystems: 创建关卡/战斗子系统
 * - buildRewardDeps: 奖励分发回调
 * - buildAllyTeam: 从编队构建我方战斗阵容
 * - buildEnemyTeam: 从关卡配置构建敌方阵容
 * - inferTroopType: 根据属性推断兵种（通过 buildAllyTeam 间接测试）
 */

import { vi, describe, it, expect } from 'vitest';
import {
  createCampaignSystems,
  buildRewardDeps,
  buildAllyTeam,
  buildEnemyTeam,
} from '../engine-campaign-deps';
import type { ResourceSystem } from '../resource/ResourceSystem';
import type { HeroSystem } from '../hero/HeroSystem';
import type { HeroFormation } from '../hero/HeroFormation';
import { TroopType } from '../battle/battle.types';
import type { Stage, EnemyUnitDef } from '../campaign/campaign.types';
import type { ISystemDeps } from '../../core/types';

// ── Mock factories ──────────────────────────────────

function createMockResourceSystem(): ResourceSystem {
  return {
    addResource: vi.fn(),
  } as unknown as ResourceSystem;
}

function createMockHeroSystem(): HeroSystem {
  const generals = [
    {
      id: 'hero1',
      name: '关羽',
      faction: 'shu',
      level: 10,
      baseStats: { attack: 95, defense: 80, intelligence: 60, speed: 70 },
      skills: [
        { id: 'skill1', name: '青龙偃月', type: 'active', level: 1, description: 'desc' },
      ],
    },
    {
      id: 'hero2',
      name: '诸葛亮',
      faction: 'shu',
      level: 8,
      baseStats: { attack: 30, defense: 40, intelligence: 98, speed: 65 },
      skills: [],
    },
    {
      id: 'hero3',
      name: '赵云',
      faction: 'shu',
      level: 12,
      baseStats: { attack: 85, defense: 70, intelligence: 55, speed: 90 },
      skills: [
        { id: 'skill2', name: '龙胆', type: 'active', level: 2, description: 'desc' },
      ],
    },
  ];

  return {
    getAllGenerals: vi.fn(() => generals),
    getGeneral: vi.fn((id: string) => generals.find((g) => g.id === id)),
    addFragment: vi.fn(),
    addExp: vi.fn(),
  } as unknown as HeroSystem;
}

function createMockFormation(): HeroFormation {
  return {
    getActiveFormation: vi.fn(() => ({
      id: 'default',
      slots: ['hero1', 'hero2', 'hero3', null, null, null],
      isActive: true,
    })),
  } as unknown as HeroFormation;
}

function createMockStage(): Stage {
  return {
    id: 'stage_1_1',
    name: '黄巾之乱',
    chapterId: 'chapter_1',
    difficulty: 1,
    enemyFormation: {
      units: [
        { id: 'e1', name: '黄巾兵', faction: 'yellow', troopType: TroopType.INFANTRY, attack: 30, defense: 20, intelligence: 10, speed: 15, maxHp: 500 },
        { id: 'e2', name: '黄巾弓手', faction: 'yellow', troopType: TroopType.ARCHER, attack: 25, defense: 15, intelligence: 20, speed: 30, maxHp: 400 },
        { id: 'e3', name: '黄巾力士', faction: 'yellow', troopType: TroopType.SPEARMAN, attack: 40, defense: 35, intelligence: 5, speed: 10, maxHp: 800 },
      ],
    },
  } as unknown as Stage;
}

function createMockDeps(): ISystemDeps {
  return {
    eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } as unknown,
    config: { get: vi.fn(), register: vi.fn() } as unknown,
    registry: { get: vi.fn(), register: vi.fn() } as unknown,
  } as unknown as ISystemDeps;
}

// ═══════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════

describe('engine-campaign-deps', () => {
  // ── createCampaignSystems ──────────────────────────

  describe('createCampaignSystems()', () => {
    it('创建包含 battleEngine、campaignSystem、rewardDistributor 的集合', () => {
      const resource = createMockResourceSystem();
      const hero = createMockHeroSystem();
      const systems = createCampaignSystems(resource, hero);

      expect(systems.battleEngine).toBeDefined();
      expect(systems.campaignSystem).toBeDefined();
      expect(systems.rewardDistributor).toBeDefined();
    });
  });

  // ── buildRewardDeps ────────────────────────────────

  describe('buildRewardDeps()', () => {
    it('返回包含 addResource、addFragment、addExp 的依赖对象', () => {
      const resource = createMockResourceSystem();
      const hero = createMockHeroSystem();
      const deps = buildRewardDeps(resource, hero);

      expect(typeof deps.addResource).toBe('function');
      expect(typeof deps.addFragment).toBe('function');
      expect(typeof deps.addExp).toBe('function');
    });

    it('addResource 委托给 resource.addResource', () => {
      const resource = createMockResourceSystem();
      const hero = createMockHeroSystem();
      const deps = buildRewardDeps(resource, hero);

      deps.addResource('gold', 100);
      expect(resource.addResource).toHaveBeenCalledWith('gold', 100);
    });

    it('addFragment 委托给 hero.addFragment', () => {
      const resource = createMockResourceSystem();
      const hero = createMockHeroSystem();
      const deps = buildRewardDeps(resource, hero);

      deps.addFragment('hero1', 5);
      expect(hero.addFragment).toHaveBeenCalledWith('hero1', 5);
    });

    it('addExp 平均分配给所有武将', () => {
      const resource = createMockResourceSystem();
      const hero = createMockHeroSystem();
      const deps = buildRewardDeps(resource, hero);

      deps.addExp(300);

      // 300 / 3 heroes = 100 per hero
      expect(hero.addExp).toHaveBeenCalledWith('hero1', 100);
      expect(hero.addExp).toHaveBeenCalledWith('hero2', 100);
      expect(hero.addExp).toHaveBeenCalledWith('hero3', 100);
    });

    it('addExp 在无武将时不执行操作', () => {
      const resource = createMockResourceSystem();
      const hero = createMockHeroSystem();
      (hero.getAllGenerals as ReturnType<typeof vi.fn>).mockReturnValue([]);
      const deps = buildRewardDeps(resource, hero);

      expect(() => deps.addExp(100)).not.toThrow();
      expect(hero.addExp).not.toHaveBeenCalled();
    });

    it('addExp 经验不足 1 时跳过', () => {
      const resource = createMockResourceSystem();
      const hero = createMockHeroSystem();
      const deps = buildRewardDeps(resource, hero);

      // 2 exp / 3 heroes = 0 per hero (floor)
      deps.addExp(2);
      expect(hero.addExp).not.toHaveBeenCalled();
    });
  });

  // ── buildAllyTeam ──────────────────────────────────

  describe('buildAllyTeam()', () => {
    it('从编队构建我方 BattleTeam', () => {
      const formation = createMockFormation();
      const hero = createMockHeroSystem();

      const team = buildAllyTeam(formation, hero);

      expect(team.side).toBe('ally');
      expect(team.units.length).toBe(3); // hero1, hero2, hero3
    });

    it('武将属性正确映射到 BattleUnit', () => {
      const formation = createMockFormation();
      const hero = createMockHeroSystem();

      const team = buildAllyTeam(formation, hero);
      const guanYu = team.units.find((u) => u.id === 'hero1');

      expect(guanYu).toBeDefined();
      expect(guanYu!.name).toBe('关羽');
      expect(guanYu!.attack).toBe(95);
      expect(guanYu!.defense).toBe(80);
      expect(guanYu!.isAlive).toBe(true);
      expect(guanYu!.side).toBe('ally');
    });

    it('前 3 个武将为 front，后 3 个为 back', () => {
      const formation = createMockFormation();
      const hero = createMockHeroSystem();

      const team = buildAllyTeam(formation, hero);

      // hero1(0), hero2(1), hero3(2) → front
      expect(team.units[0].position).toBe('front');
      expect(team.units[1].position).toBe('front');
      expect(team.units[2].position).toBe('front');
    });

    it('跳过 null 槽位', () => {
      const formation = createMockFormation();
      const hero = createMockHeroSystem();

      const team = buildAllyTeam(formation, hero);
      // 只有 3 个有效武将，null 槽位被跳过
      expect(team.units.length).toBe(3);
    });

    it('跳过不存在的武将 ID', () => {
      const formation = {
        getActiveFormation: vi.fn(() => ({
          id: 'default',
          slots: ['hero1', 'nonexistent', null, null, null, null],
          isActive: true,
        })),
      } as unknown as HeroFormation;
      const hero = createMockHeroSystem();

      const team = buildAllyTeam(formation, hero);
      expect(team.units.length).toBe(1);
      expect(team.units[0].id).toBe('hero1');
    });

    it('无活跃编队时返回空阵容', () => {
      const formation = {
        getActiveFormation: vi.fn(() => null),
      } as unknown as HeroFormation;
      const hero = createMockHeroSystem();

      const team = buildAllyTeam(formation, hero);
      expect(team.units.length).toBe(0);
      expect(team.side).toBe('ally');
    });

    it('HP 计算包含等级和防御加成', () => {
      const formation = createMockFormation();
      const hero = createMockHeroSystem();

      const team = buildAllyTeam(formation, hero);
      const guanYu = team.units.find((u) => u.id === 'hero1')!;
      // maxHp = 500 + level*100 + defense*10 = 500 + 10*100 + 80*10 = 2300
      expect(guanYu.maxHp).toBe(2300);
      expect(guanYu.hp).toBe(2300);
    });

    it('武将技能正确映射为 BattleSkill', () => {
      const formation = createMockFormation();
      const hero = createMockHeroSystem();

      const team = buildAllyTeam(formation, hero);
      const guanYu = team.units.find((u) => u.id === 'hero1')!;

      expect(guanYu.skills.length).toBe(1);
      expect(guanYu.skills[0].id).toBe('skill1');
      expect(guanYu.skills[0].multiplier).toBe(1.5);
    });

    it('攻击最高 → 骑兵（关羽 attack=95）', () => {
      const formation = createMockFormation();
      const hero = createMockHeroSystem();

      const team = buildAllyTeam(formation, hero);
      const guanYu = team.units.find((u) => u.id === 'hero1')!;
      // attack(95) > defense(80) > speed(70) > intelligence(60)
      expect(guanYu.troopType).toBe(TroopType.CAVALRY);
    });

    it('智力最高 → 谋士（诸葛亮 intelligence=98）', () => {
      const formation = createMockFormation();
      const hero = createMockHeroSystem();

      const team = buildAllyTeam(formation, hero);
      const zhuge = team.units.find((u) => u.id === 'hero2')!;
      expect(zhuge.troopType).toBe(TroopType.STRATEGIST);
    });

    it('速度最高 → 弓兵（赵云 speed=90）', () => {
      const formation = createMockFormation();
      const hero = createMockHeroSystem();

      const team = buildAllyTeam(formation, hero);
      const zhaoYun = team.units.find((u) => u.id === 'hero3')!;
      // attack(85) < speed(90) → 弓兵
      expect(zhaoYun.troopType).toBe(TroopType.ARCHER);
    });
  });

  // ── buildEnemyTeam ─────────────────────────────────

  describe('buildEnemyTeam()', () => {
    it('从关卡配置构建敌方 BattleTeam', () => {
      const stage = createMockStage();
      const team = buildEnemyTeam(stage);

      expect(team.side).toBe('enemy');
      expect(team.units.length).toBe(3);
    });

    it('敌方单位属性正确映射', () => {
      const stage = createMockStage();
      const team = buildEnemyTeam(stage);
      const first = team.units[0];

      expect(first.id).toBe('e1');
      expect(first.name).toBe('黄巾兵');
      expect(first.attack).toBe(30);
      expect(first.defense).toBe(20);
      expect(first.hp).toBe(500);
      expect(first.maxHp).toBe(500);
      expect(first.isAlive).toBe(true);
      expect(first.side).toBe('enemy');
    });

    it('前 3 个为 front，之后为 back', () => {
      const stage = createMockStage();
      const team = buildEnemyTeam(stage);

      expect(team.units[0].position).toBe('front');
      expect(team.units[1].position).toBe('front');
      expect(team.units[2].position).toBe('front');
    });

    it('敌方单位无技能', () => {
      const stage = createMockStage();
      const team = buildEnemyTeam(stage);

      for (const unit of team.units) {
        expect(unit.skills).toEqual([]);
      }
    });

    it('敌方单位有普攻', () => {
      const stage = createMockStage();
      const team = buildEnemyTeam(stage);

      for (const unit of team.units) {
        expect(unit.normalAttack).toBeDefined();
        expect(unit.normalAttack.multiplier).toBe(1.0);
      }
    });
  });
});
