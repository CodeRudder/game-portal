/**
 * 测试域 — 游戏逻辑测试专用类型定义
 *
 * 定义 IGameLogic 接口及其所需的全部数据结构。
 * 这些类型面向测试基础设施（GameTestRunner / MockGameLogic / TestDataProvider），
 * 与引擎内部类型（core/types）解耦，不依赖任何上层组件。
 *
 * @module tests/types
 */

import type { Resources } from '../engine/resource/resource.types';
import type { BuildingType, BuildingState } from '../engine/building/building.types';

// ─────────────────────────────────────────────
// 1. 武将（Hero）
// ─────────────────────────────────────────────

/** 武将数据 */
export interface HeroData {
  /** 唯一标识 */
  id: string;
  /** 武将名称 */
  name: string;
  /** 所属势力（shu / wei / wu / qun） */
  faction: string;
  /** 等级 */
  level: number;
  /** 攻击力 */
  attack: number;
  /** 防御力 */
  defense: number;
  /** 智力 */
  intelligence: number;
  /** 忠诚度（0~100） */
  loyalty: number;
  /** 当前所在城市ID */
  cityId?: string;
  /** 是否已阵亡 */
  isDead?: boolean;
}

// ─────────────────────────────────────────────
// 2. 军队（Army）
// ─────────────────────────────────────────────

/** 军队数据 */
export interface ArmyData {
  /** 唯一标识 */
  id: string;
  /** 所属势力 */
  faction: string;
  /** 主将ID */
  generalId: string;
  /** 当前所在城市ID */
  cityId: string;
  /** 兵力数量 */
  soldiers: number;
  /** 士气（0~100） */
  morale: number;
  /** 训练度（0~100） */
  training: number;
  /** 是否正在行军 */
  isMarching?: boolean;
  /** 行军目标城市ID */
  targetCityId?: string;
}

// ─────────────────────────────────────────────
// 3. 城市（City）
// ─────────────────────────────────────────────

/** 城市数据 */
export interface CityData {
  /** 唯一标识 */
  id: string;
  /** 城市名称 */
  name: string;
  /** 所属势力 */
  faction: string;
  /** 人口 */
  population: number;
  /** 城防值 */
  defense: number;
  /** 城市等级 */
  level: number;
  /** 建筑列表 */
  buildings: BuildingState[];
  /** 城市坐标 */
  position: { x: number; y: number };
}

// ─────────────────────────────────────────────
// 4. 外交（Diplomacy）
// ─────────────────────────────────────────────

/** 外交关系类型 */
export type DiplomacyRelation = 'neutral' | 'ally' | 'enemy' | 'vassal' | 'suzerain';

// ─────────────────────────────────────────────
// 5. 战斗（Battle）
// ─────────────────────────────────────────────

/** 战斗结果 */
export interface BattleResult {
  /** 是否胜利 */
  victory: boolean;
  /** 攻击方剩余兵力 */
  attackerRemaining: number;
  /** 防守方剩余兵力 */
  defenderRemaining: number;
  /** 战斗回合数 */
  rounds: number;
  /** 战斗日志 */
  log: string[];
}

// ─────────────────────────────────────────────
// 6. 游戏逻辑接口（IGameLogic）
// ─────────────────────────────────────────────

/**
 * 游戏逻辑统一接口
 *
 * 定义测试视角下的游戏逻辑操作集合。
 * MockGameLogic 实现此接口，供 GameTestRunner 和 UI 测试使用。
 * 所有方法均为纯数据操作，不涉及渲染或 DOM。
 *
 * @example
 * ```ts
 * const logic: IGameLogic = new MockGameLogic();
 * const hero = logic.getHero('hero-liubei');
 * logic.recruitHero('hero-liubei', 'city-chengdu');
 * ```
 */
export interface IGameLogic {
  // ── 武将 ──
  /** 获取武将信息 */
  getHero(id: string): HeroData | null;
  /** 按势力获取武将列表 */
  getHeroesByFaction(faction: string): HeroData[];
  /** 招募武将 */
  recruitHero(heroId: string, cityId: string): boolean;
  /** 解雇武将 */
  dismissHero(heroId: string): boolean;

  // ── 军队 ──
  /** 获取军队信息 */
  getArmy(id: string): ArmyData | null;
  /** 创建军队，返回军队ID */
  createArmy(generalId: string, cityId: string, soldiers: number): string;
  /** 合并军队，返回合并后的军队ID */
  mergeArmies(armyIds: string[]): string | null;
  /** 行军 */
  marchArmy(armyId: string, targetCityId: string): boolean;

  // ── 城市 ──
  /** 获取城市信息 */
  getCity(id: string): CityData | null;
  /** 按势力获取城市列表 */
  getCitiesByFaction(faction: string): CityData[];
  /** 建造建筑 */
  buildStructure(cityId: string, type: string): boolean;

  // ── 外交 ──
  /** 缔结同盟 */
  formAlliance(from: string, to: string): boolean;
  /** 解除同盟 */
  breakAlliance(from: string, to: string): boolean;
  /** 查询外交关系 */
  getRelationship(a: string, b: string): DiplomacyRelation;

  // ── 经济 ──
  /** 征税，返回税收金额 */
  collectTax(cityId: string): number;
  /** 贸易 */
  trade(from: string, to: string, resource: string, amount: number): boolean;

  // ── 战斗 ──
  /** 模拟战斗 */
  simulateBattle(attacker: ArmyData, defender: ArmyData): BattleResult;

  // ── 回合 ──
  /** 获取当前回合数 */
  getCurrentRound(): number;
  /** 获取当前势力 */
  getCurrentFaction(): string;
  /** 结束回合 */
  endTurn(): void;
}
