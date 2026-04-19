/**
 * 测试固件 — 标准测试数据集合
 *
 * 提供预定义的测试数据固件，用于快速搭建测试场景。
 * 所有数据通过 TestDataProvider 生成，确保与工厂方法的一致性。
 *
 * @module tests/fixtures
 */

import { TestDataProvider } from '../utils/TestDataProvider';
import type {
  HeroData,
  ArmyData,
  CityData,
  BattleResult,
  DiplomacyRelation,
} from '../types';
import type { Resources } from '../../engine/resource/resource.types';
import type { BuildingState } from '../../engine/building/building.types';

// ─────────────────────────────────────────────
// 武将固件
// ─────────────────────────────────────────────

/** 蜀国标准武将 */
export const mockHeroes = {
  liubei: TestDataProvider.hero({
    id: 'hero-liubei',
    name: '刘备',
    faction: 'shu',
    level: 5,
    attack: 75,
    defense: 60,
    intelligence: 80,
    loyalty: 100,
  }),

  guanyu: TestDataProvider.hero({
    id: 'hero-guanyu',
    name: '关羽',
    faction: 'shu',
    level: 8,
    attack: 95,
    defense: 85,
    intelligence: 70,
    loyalty: 100,
  }),

  zhangfei: TestDataProvider.hero({
    id: 'hero-zhangfei',
    name: '张飞',
    faction: 'shu',
    level: 6,
    attack: 90,
    defense: 65,
    intelligence: 40,
    loyalty: 95,
  }),

  caocao: TestDataProvider.hero({
    id: 'hero-caocao',
    name: '曹操',
    faction: 'wei',
    level: 10,
    attack: 85,
    defense: 80,
    intelligence: 95,
    loyalty: 100,
  }),

  sunquan: TestDataProvider.hero({
    id: 'hero-sunquan',
    name: '孙权',
    faction: 'wu',
    level: 7,
    attack: 70,
    defense: 75,
    intelligence: 85,
    loyalty: 100,
  }),
} as const;

// ─────────────────────────────────────────────
// 军队固件
// ─────────────────────────────────────────────

/** 标准军队 */
export const mockArmies = {
  shuMain: TestDataProvider.army({
    id: 'army-shu-main',
    faction: 'shu',
    generalId: 'hero-liubei',
    cityId: 'city-chengdu',
    soldiers: 5000,
    morale: 85,
    training: 70,
  }),

  weiMain: TestDataProvider.army({
    id: 'army-wei-main',
    faction: 'wei',
    generalId: 'hero-caocao',
    cityId: 'city-xuchang',
    soldiers: 8000,
    morale: 90,
    training: 80,
  }),

  wuMain: TestDataProvider.army({
    id: 'army-wu-main',
    faction: 'wu',
    generalId: 'hero-sunquan',
    cityId: 'city-jianye',
    soldiers: 6000,
    morale: 80,
    training: 75,
  }),
} as const;

// ─────────────────────────────────────────────
// 城市固件
// ─────────────────────────────────────────────

/** 标准城市 */
export const mockCities = {
  chengdu: TestDataProvider.city({
    id: 'city-chengdu',
    name: '成都',
    faction: 'shu',
    population: 50000,
    defense: 80,
    level: 3,
    position: { x: 200, y: 400 },
  }),

  xuchang: TestDataProvider.city({
    id: 'city-xuchang',
    name: '许昌',
    faction: 'wei',
    population: 80000,
    defense: 90,
    level: 5,
    position: { x: 500, y: 200 },
  }),

  jianye: TestDataProvider.city({
    id: 'city-jianye',
    name: '建业',
    faction: 'wu',
    population: 60000,
    defense: 75,
    level: 4,
    position: { x: 700, y: 500 },
  }),
} as const;

// ─────────────────────────────────────────────
// 资源固件
// ─────────────────────────────────────────────

/** 标准资源 */
export const mockResources: Resources = TestDataProvider.resources({
  grain: 10000,
  gold: 5000,
  troops: 8000,
  mandate: 200,
});

/** 贫乏资源（用于测试资源不足场景） */
export const scarceResources: Resources = TestDataProvider.resources({
  grain: 100,
  gold: 50,
  troops: 100,
  mandate: 10,
});

/** 丰富资源（用于测试资源充足场景） */
export const abundantResources: Resources = TestDataProvider.resources({
  grain: 100000,
  gold: 50000,
  troops: 80000,
  mandate: 1000,
});

// ─────────────────────────────────────────────
// 建筑固件
// ─────────────────────────────────────────────

/** 标准建筑状态集合 */
export const mockBuildings = TestDataProvider.buildings({
  castle: { level: 3, status: 'idle' },
  farmland: { level: 2, status: 'idle' },
  market: { level: 2, status: 'idle' },
  barracks: { level: 1, status: 'idle' },
});

/** 升级中的建筑 */
export const upgradingBuilding: BuildingState = TestDataProvider.building('castle', {
  level: 3,
  status: 'upgrading',
  upgradeStartTime: Date.now() - 10000,
  upgradeEndTime: Date.now() + 50000,
});

// ─────────────────────────────────────────────
// 战斗结果固件
// ─────────────────────────────────────────────

/** 标准胜利结果 */
export const victoryResult: BattleResult = {
  victory: true,
  attackerRemaining: 3500,
  defenderRemaining: 1000,
  rounds: 5,
  log: ['刘备 率军 5000 人进攻', '曹操 率军 8000 人防守', '攻击方获胜'],
};

/** 标准失败结果 */
export const defeatResult: BattleResult = {
  victory: false,
  attackerRemaining: 1500,
  defenderRemaining: 4800,
  rounds: 4,
  log: ['刘备 率军 5000 人进攻', '曹操 率军 8000 人防守', '防守方获胜'],
};

// ─────────────────────────────────────────────
// 三国初始数据固件
// ─────────────────────────────────────────────

/** 完整的三国初始数据集 */
export const threeKingdomsSetup = TestDataProvider.threeKingdomsSetup();
