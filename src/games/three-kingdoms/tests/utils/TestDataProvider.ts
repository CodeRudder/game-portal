/**
 * 测试基础设施 — 测试数据工厂
 *
 * 按架构文档 §3.2 实现，提供标准化的测试数据生成方法。
 * 所有工厂方法支持 overrides 参数覆盖默认值，
 * 确保测试数据一致性的同时保留灵活性。
 *
 * @module tests/utils/TestDataProvider
 */

import type { Resources } from '../../engine/resource/resource.types';
import type { BuildingType, BuildingState } from '../../engine/building/building.types';
import type { HeroData, ArmyData, CityData, DiplomacyRelation } from '../types';

// ─────────────────────────────────────────────
// 计数器（确保批量生成的 ID 唯一）
// ─────────────────────────────────────────────

let heroCounter = 0;
let armyCounter = 0;
let cityCounter = 0;

/** 重置所有计数器（在 beforeEach 中调用） */
export function resetCounters(): void {
  heroCounter = 0;
  armyCounter = 0;
  cityCounter = 0;
}

// ─────────────────────────────────────────────
// 默认值常量
// ─────────────────────────────────────────────

/** 势力列表 */
const FACTIONS = ['shu', 'wei', 'wu', 'qun'] as const;

/** 武将名池（按势力分组） */
const HERO_NAMES: Record<string, string[]> = {
  shu: ['刘备', '关羽', '张飞', '赵云', '诸葛亮', '马超', '黄忠'],
  wei: ['曹操', '司马懿', '夏侯惇', '张辽', '许褚', '荀彧', '郭嘉'],
  wu: ['孙权', '周瑜', '鲁肃', '陆逊', '甘宁', '太史慈', '黄盖'],
  qun: ['吕布', '董卓', '袁绍', '貂蝉', '华佗', '左慈', '张角'],
};

// ─────────────────────────────────────────────
// TestDataProvider 类
// ─────────────────────────────────────────────

/**
 * 测试数据工厂
 *
 * 提供标准化的测试数据生成方法，每个方法返回一份完整、有效的数据对象。
 * 通过 overrides 参数可灵活覆盖任意字段。
 *
 * @example
 * ```ts
 * // 使用默认值
 * const hero = TestDataProvider.hero();
 *
 * // 覆盖部分字段
 * const strongHero = TestDataProvider.hero({ attack: 99, level: 10 });
 *
 * // 批量生成
 * const heroes = TestDataProvider.heroes(5, { faction: 'wei' });
 * ```
 */
export class TestDataProvider {
  // ── 武将 ──

  /**
   * 生成单个武将数据
   *
   * @param overrides - 需要覆盖的字段
   * @returns 完整的 HeroData 对象
   */
  static hero(overrides?: Partial<HeroData>): HeroData {
    const idx = heroCounter++;
    const faction = overrides?.faction ?? FACTIONS[idx % FACTIONS.length];
    const names = HERO_NAMES[faction] ?? HERO_NAMES.qun;
    return {
      id: `hero-${idx}`,
      name: names[idx % names.length] ?? `武将${idx}`,
      faction,
      level: 1,
      attack: 50 + (idx % 30),
      defense: 40 + (idx % 25),
      intelligence: 45 + (idx % 35),
      loyalty: 80 + (idx % 20),
      isDead: false,
      ...overrides,
    };
  }

  /**
   * 批量生成武将数据
   *
   * @param count - 数量
   * @param overrides - 应用于每个武将的覆盖字段
   * @returns HeroData 数组
   */
  static heroes(count: number, overrides?: Partial<HeroData>): HeroData[] {
    return Array.from({ length: count }, () => TestDataProvider.hero(overrides));
  }

  // ── 军队 ──

  /**
   * 生成单个军队数据
   *
   * @param overrides - 需要覆盖的字段
   * @returns 完整的 ArmyData 对象
   */
  static army(overrides?: Partial<ArmyData>): ArmyData {
    const idx = armyCounter++;
    return {
      id: `army-${idx}`,
      faction: 'shu',
      generalId: `hero-${idx}`,
      cityId: 'city-chengdu',
      soldiers: 1000 + idx * 100,
      morale: 80,
      training: 60,
      isMarching: false,
      ...overrides,
    };
  }

  /**
   * 批量生成军队数据
   *
   * @param count - 数量
   * @param overrides - 应用于每个军队的覆盖字段
   * @returns ArmyData 数组
   */
  static armies(count: number, overrides?: Partial<ArmyData>): ArmyData[] {
    return Array.from({ length: count }, () => TestDataProvider.army(overrides));
  }

  // ── 城市 ──

  /**
   * 生成单个城市数据
   *
   * @param overrides - 需要覆盖的字段
   * @returns 完整的 CityData 对象
   */
  static city(overrides?: Partial<CityData>): CityData {
    const idx = cityCounter++;
    return {
      id: `city-${idx}`,
      name: `城市${idx}`,
      faction: 'shu',
      population: 10000 + idx * 1000,
      defense: 50,
      level: 1,
      buildings: [],
      position: { x: idx * 100, y: idx * 50 },
      ...overrides,
    };
  }

  /**
   * 批量生成城市数据
   *
   * @param count - 数量
   * @param overrides - 应用于每个城市的覆盖字段
   * @returns CityData 数组
   */
  static cities(count: number, overrides?: Partial<CityData>): CityData[] {
    return Array.from({ length: count }, () => TestDataProvider.city(overrides));
  }

  // ── 资源 ──

  /**
   * 生成标准资源数据
   *
   * @param overrides - 需要覆盖的资源字段
   * @returns 完整的 Resources 对象
   */
  static resources(overrides?: Partial<Resources>): Resources {
    return {
      grain: 5000,
      gold: 3000,
      troops: 2000,
      mandate: 100,
      techPoint: 0,
      ...(overrides ?? {}),
    } as Resources;
  }

  // ── 建筑 ──

  /**
   * 生成单个建筑状态数据
   *
   * @param type - 建筑类型
   * @param overrides - 需要覆盖的字段
   * @returns 完整的 BuildingState 对象
   */
  static building(
    type: BuildingType = 'castle',
    overrides?: Partial<BuildingState>,
  ): BuildingState {
    return {
      type,
      level: 1,
      status: 'idle',
      upgradeStartTime: null,
      upgradeEndTime: null,
      ...overrides,
    };
  }

  /**
   * 生成全部8种建筑的状态映射
   *
   * @param overrides - 按建筑类型覆盖指定字段
   * @returns 建筑类型到状态的映射
   */
  static buildings(
    overrides?: Partial<Record<BuildingType, Partial<BuildingState>>>,
  ): Record<BuildingType, BuildingState> {
    const allTypes: BuildingType[] = [
      'castle', 'farmland', 'market', 'barracks',
      'smithy', 'academy', 'clinic', 'wall',
    ];
    const result = {} as Record<BuildingType, BuildingState>;
    for (const t of allTypes) {
      result[t] = TestDataProvider.building(t, overrides?.[t]);
    }
    return result;
  }

  // ── 外交 ──

  /**
   * 生成外交关系
   *
   * @param relation - 关系类型，默认 neutral
   */
  static diplomacyRelation(relation: DiplomacyRelation = 'neutral'): DiplomacyRelation {
    return relation;
  }

  // ── 标准三方初始数据 ──

  /**
   * 生成三国标准初始数据集
   *
   * 包含三个势力（蜀/魏/吴）的初始武将、城市和军队数据，
   * 适合用于集成测试和 E2E 测试的场景初始化。
   *
   * @returns 包含 factions、cities、heroes、armies 的完整初始数据
   */
  static threeKingdomsSetup(): {
    factions: string[];
    cities: CityData[];
    heroes: HeroData[];
    armies: ArmyData[];
    resources: Resources;
  } {
    // 重置计数器确保数据一致性
    resetCounters();

    const factions = ['shu', 'wei', 'wu'];

    // 每个势力2座城市
    const cityNames: Record<string, string[]> = {
      shu: ['成都', '汉中'],
      wei: ['许昌', '邺城'],
      wu: ['建业', '柴桑'],
    };

    const cities: CityData[] = [];
    let cityIdx = 0;
    for (const faction of factions) {
      for (const name of cityNames[faction]) {
        cities.push({
          id: `city-${faction}-${cityIdx}`,
          name,
          faction,
          population: 10000 + cityIdx * 2000,
          defense: 50,
          level: 1,
          buildings: [TestDataProvider.building('castle')],
          position: { x: cityIdx * 200, y: cityIdx * 100 },
        });
        cityIdx++;
      }
    }

    // 每个势力3名武将
    const heroes: HeroData[] = [];
    for (const faction of factions) {
      const names = HERO_NAMES[faction];
      for (let i = 0; i < 3; i++) {
        heroes.push({
          id: `hero-${faction}-${i}`,
          name: names[i] ?? `武将${i}`,
          faction,
          level: 1 + i,
          attack: 60 + i * 5,
          defense: 50 + i * 5,
          intelligence: 55 + i * 5,
          loyalty: 90,
          cityId: cities.find((c) => c.faction === faction)?.id,
          isDead: false,
        });
      }
    }

    // 每个势力1支军队
    const armies: ArmyData[] = factions.map((faction, idx) => ({
      id: `army-${faction}-0`,
      faction,
      generalId: `hero-${faction}-0`,
      cityId: cities.find((c) => c.faction === faction)!.id,
      soldiers: 2000 + idx * 500,
      morale: 80,
      training: 60,
      isMarching: false,
    }));

    return {
      factions,
      cities,
      heroes,
      armies,
      resources: TestDataProvider.resources(),
    };
  }
}
