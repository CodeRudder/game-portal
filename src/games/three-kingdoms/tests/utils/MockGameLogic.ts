/**
 * 测试基础设施 — Mock 游戏逻辑
 *
 * 按架构文档 §7.2 实现 IGameLogic 接口的完整 Mock。
 * 提供调用日志记录、默认返回值和自定义行为覆盖能力。
 *
 * 核心特性：
 * - 每个方法调用自动记录到 callLog
 * - 支持通过构造函数 overrides 自定义任意方法的行为
 * - 未覆盖的方法返回合理的默认值（通过 TestDataProvider 生成）
 * - getCallCount / getCalls / reset 用于断言验证
 *
 * @module tests/utils/MockGameLogic
 */

import type {
  IGameLogic,
  HeroData,
  ArmyData,
  CityData,
  BattleResult,
  DiplomacyRelation,
} from '../types';
import { TestDataProvider } from './TestDataProvider';

// ─────────────────────────────────────────────
// MockGameLogic 类
// ─────────────────────────────────────────────

/**
 * IGameLogic 的 Mock 实现
 *
 * 所有方法遵循统一模式：
 * 1. 调用 this.record() 记录方法名和参数
 * 2. 优先使用 overrides 中提供的自定义实现
 * 3. 若无自定义实现，返回默认值
 *
 * @example
 * ```ts
 * // 使用默认行为
 * const mock = new MockGameLogic();
 * mock.recruitHero('hero-0', 'city-0');  // 返回 true
 * expect(mock.getCallCount('recruitHero')).toBe(1);
 *
 * // 自定义行为
 * const mockFail = new MockGameLogic({
 *   recruitHero: () => false,  // 招募总是失败
 * });
 *
 * // 重置日志
 * mock.reset();
 * expect(mock.getCallCount('recruitHero')).toBe(0);
 * ```
 */
export class MockGameLogic implements IGameLogic {
  /** 用户自定义的方法覆盖 */
  private readonly overrides: Partial<IGameLogic>;

  /** 调用日志：方法名 → 参数列表数组 */
  private callLog: Map<string, unknown[][]>;

  /** 内部数据存储（用于默认实现） */
  private heroes: Map<string, HeroData>;
  private armies: Map<string, ArmyData>;
  private cities: Map<string, CityData>;
  private relationships: Map<string, DiplomacyRelation>;
  private currentRound: number;
  private currentFaction: string;

  /**
   * @param overrides - 需要覆盖的方法集合
   */
  constructor(overrides?: Partial<IGameLogic>) {
    this.overrides = overrides ?? {};
    this.callLog = new Map();
    this.heroes = new Map();
    this.armies = new Map();
    this.cities = new Map();
    this.relationships = new Map();
    this.currentRound = 1;
    this.currentFaction = 'shu';

    // 初始化默认数据
    this.initDefaultData();
  }

  // ─────────────────────────────────────────
  // 调用日志
  // ─────────────────────────────────────────

  /**
   * 记录方法调用
   *
   * @param method - 方法名
   * @param args - 参数列表
   */
  private record(method: string, args: unknown[]): void {
    const calls = this.callLog.get(method) ?? [];
    calls.push(args);
    this.callLog.set(method, calls);
  }

  /**
   * 查询指定方法的调用次数
   *
   * @param method - 方法名
   * @returns 调用次数
   */
  getCallCount(method: string): number {
    return this.callLog.get(method)?.length ?? 0;
  }

  /**
   * 查询指定方法的所有调用参数
   *
   * @param method - 方法名
   * @returns 每次调用的参数列表
   */
  getCalls(method: string): unknown[][] {
    return this.callLog.get(method) ?? [];
  }

  /**
   * 重置所有调用日志
   *
   * 保留 overrides 和内部数据，仅清除调用记录。
   */
  reset(): void {
    this.callLog = new Map();
  }

  /**
   * 重置所有状态（包括内部数据和调用日志）
   */
  resetAll(): void {
    this.callLog = new Map();
    this.heroes = new Map();
    this.armies = new Map();
    this.cities = new Map();
    this.relationships = new Map();
    this.currentRound = 1;
    this.currentFaction = 'shu';
    this.initDefaultData();
  }

  // ─────────────────────────────────────────
  // 内部数据初始化
  // ─────────────────────────────────────────

  /** 初始化默认测试数据 */
  private initDefaultData(): void {
    // 默认武将
    const defaultHeroes = TestDataProvider.heroes(3);
    for (const hero of defaultHeroes) {
      this.heroes.set(hero.id, hero);
    }

    // 默认城市
    const defaultCities = TestDataProvider.cities(2);
    for (const city of defaultCities) {
      this.cities.set(city.id, city);
    }

    // 默认军队
    const defaultArmies = TestDataProvider.armies(1);
    for (const army of defaultArmies) {
      this.armies.set(army.id, army);
    }
  }

  // ─────────────────────────────────────────
  // IGameLogic — 武将
  // ─────────────────────────────────────────

  getHero(id: string): HeroData | null {
    this.record('getHero', [id]);
    if (this.overrides.getHero) {
      return this.overrides.getHero(id);
    }
    return this.heroes.get(id) ?? null;
  }

  getHeroesByFaction(faction: string): HeroData[] {
    this.record('getHeroesByFaction', [faction]);
    if (this.overrides.getHeroesByFaction) {
      return this.overrides.getHeroesByFaction(faction);
    }
    return Array.from(this.heroes.values()).filter((h) => h.faction === faction);
  }

  recruitHero(heroId: string, cityId: string): boolean {
    this.record('recruitHero', [heroId, cityId]);
    if (this.overrides.recruitHero) {
      return this.overrides.recruitHero(heroId, cityId);
    }
    const hero = this.heroes.get(heroId);
    if (hero) {
      hero.cityId = cityId;
      return true;
    }
    return false;
  }

  dismissHero(heroId: string): boolean {
    this.record('dismissHero', [heroId]);
    if (this.overrides.dismissHero) {
      return this.overrides.dismissHero(heroId);
    }
    return this.heroes.delete(heroId);
  }

  // ─────────────────────────────────────────
  // IGameLogic — 军队
  // ─────────────────────────────────────────

  getArmy(id: string): ArmyData | null {
    this.record('getArmy', [id]);
    if (this.overrides.getArmy) {
      return this.overrides.getArmy(id);
    }
    return this.armies.get(id) ?? null;
  }

  createArmy(generalId: string, cityId: string, soldiers: number): string {
    this.record('createArmy', [generalId, cityId, soldiers]);
    if (this.overrides.createArmy) {
      return this.overrides.createArmy(generalId, cityId, soldiers);
    }
    const id = `army-mock-${this.armies.size}`;
    const army: ArmyData = {
      id,
      faction: 'shu',
      generalId,
      cityId,
      soldiers,
      morale: 80,
      training: 60,
      isMarching: false,
    };
    this.armies.set(id, army);
    return id;
  }

  mergeArmies(armyIds: string[]): string | null {
    this.record('mergeArmies', [armyIds]);
    if (this.overrides.mergeArmies) {
      return this.overrides.mergeArmies(armyIds);
    }
    if (armyIds.length === 0) return null;

    const armies = armyIds
      .map((id) => this.armies.get(id))
      .filter((a): a is ArmyData => a !== null);
    if (armies.length === 0) return null;

    const mergedId = `army-merged-${this.armies.size}`;
    const merged: ArmyData = {
      id: mergedId,
      faction: armies[0].faction,
      generalId: armies[0].generalId,
      cityId: armies[0].cityId,
      soldiers: armies.reduce((sum, a) => sum + a.soldiers, 0),
      morale: Math.round(armies.reduce((sum, a) => sum + a.morale, 0) / armies.length),
      training: Math.round(armies.reduce((sum, a) => sum + a.training, 0) / armies.length),
    };

    // 删除原军队，添加合并后的军队
    for (const id of armyIds) {
      this.armies.delete(id);
    }
    this.armies.set(mergedId, merged);
    return mergedId;
  }

  marchArmy(armyId: string, targetCityId: string): boolean {
    this.record('marchArmy', [armyId, targetCityId]);
    if (this.overrides.marchArmy) {
      return this.overrides.marchArmy(armyId, targetCityId);
    }
    const army = this.armies.get(armyId);
    if (army && !army.isMarching) {
      army.isMarching = true;
      army.targetCityId = targetCityId;
      return true;
    }
    return false;
  }

  // ─────────────────────────────────────────
  // IGameLogic — 城市
  // ─────────────────────────────────────────

  getCity(id: string): CityData | null {
    this.record('getCity', [id]);
    if (this.overrides.getCity) {
      return this.overrides.getCity(id);
    }
    return this.cities.get(id) ?? null;
  }

  getCitiesByFaction(faction: string): CityData[] {
    this.record('getCitiesByFaction', [faction]);
    if (this.overrides.getCitiesByFaction) {
      return this.overrides.getCitiesByFaction(faction);
    }
    return Array.from(this.cities.values()).filter((c) => c.faction === faction);
  }

  buildStructure(cityId: string, type: string): boolean {
    this.record('buildStructure', [cityId, type]);
    if (this.overrides.buildStructure) {
      return this.overrides.buildStructure(cityId, type);
    }
    const city = this.cities.get(cityId);
    if (city) {
      city.buildings.push({
        type: type as import('../../engine/building/building.types').BuildingType,
        level: 1,
        status: 'idle',
        upgradeStartTime: null,
        upgradeEndTime: null,
      });
      return true;
    }
    return false;
  }

  // ─────────────────────────────────────────
  // IGameLogic — 外交
  // ─────────────────────────────────────────

  formAlliance(from: string, to: string): boolean {
    this.record('formAlliance', [from, to]);
    if (this.overrides.formAlliance) {
      return this.overrides.formAlliance(from, to);
    }
    const key = [from, to].sort().join(':');
    this.relationships.set(key, 'ally');
    return true;
  }

  breakAlliance(from: string, to: string): boolean {
    this.record('breakAlliance', [from, to]);
    if (this.overrides.breakAlliance) {
      return this.overrides.breakAlliance(from, to);
    }
    const key = [from, to].sort().join(':');
    if (this.relationships.get(key) === 'ally') {
      this.relationships.set(key, 'neutral');
      return true;
    }
    return false;
  }

  getRelationship(a: string, b: string): DiplomacyRelation {
    this.record('getRelationship', [a, b]);
    if (this.overrides.getRelationship) {
      return this.overrides.getRelationship(a, b);
    }
    const key = [a, b].sort().join(':');
    return this.relationships.get(key) ?? 'neutral';
  }

  // ─────────────────────────────────────────
  // IGameLogic — 经济
  // ─────────────────────────────────────────

  collectTax(cityId: string): number {
    this.record('collectTax', [cityId]);
    if (this.overrides.collectTax) {
      return this.overrides.collectTax(cityId);
    }
    const city = this.cities.get(cityId);
    return city ? Math.floor(city.population * 0.1) : 0;
  }

  trade(from: string, to: string, resource: string, amount: number): boolean {
    this.record('trade', [from, to, resource, amount]);
    if (this.overrides.trade) {
      return this.overrides.trade(from, to, resource, amount);
    }
    return amount > 0;
  }

  // ─────────────────────────────────────────
  // IGameLogic — 战斗
  // ─────────────────────────────────────────

  simulateBattle(attacker: ArmyData, defender: ArmyData): BattleResult {
    this.record('simulateBattle', [attacker, defender]);
    if (this.overrides.simulateBattle) {
      return this.overrides.simulateBattle(attacker, defender);
    }
    // 简化战斗模拟：兵力多的一方获胜
    const attackerPower = attacker.soldiers * (attacker.morale / 100);
    const defenderPower = defender.soldiers * (defender.morale / 100);
    const victory = attackerPower > defenderPower;

    return {
      victory,
      attackerRemaining: victory
        ? Math.round(attacker.soldiers * 0.7)
        : Math.round(attacker.soldiers * 0.3),
      defenderRemaining: victory
        ? Math.round(defender.soldiers * 0.2)
        : Math.round(defender.soldiers * 0.6),
      rounds: 3 + Math.floor(Math.abs(attackerPower - defenderPower) / 500),
      log: [
        `${attacker.generalId} 率军 ${attacker.soldiers} 人进攻`,
        `${defender.generalId} 率军 ${defender.soldiers} 人防守`,
        victory ? '攻击方获胜' : '防守方获胜',
      ],
    };
  }

  // ─────────────────────────────────────────
  // IGameLogic — 回合
  // ─────────────────────────────────────────

  getCurrentRound(): number {
    this.record('getCurrentRound', []);
    if (this.overrides.getCurrentRound) {
      return this.overrides.getCurrentRound();
    }
    return this.currentRound;
  }

  getCurrentFaction(): string {
    this.record('getCurrentFaction', []);
    if (this.overrides.getCurrentFaction) {
      return this.overrides.getCurrentFaction();
    }
    return this.currentFaction;
  }

  endTurn(): void {
    this.record('endTurn', []);
    if (this.overrides.endTurn) {
      this.overrides.endTurn();
      return;
    }
    this.currentRound++;
    // 轮换势力
    const factions = ['shu', 'wei', 'wu'];
    const idx = factions.indexOf(this.currentFaction);
    this.currentFaction = factions[(idx + 1) % factions.length];
  }
}
