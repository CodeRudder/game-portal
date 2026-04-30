/**
 * 关卡/战斗系统依赖注入辅助
 *
 * 从 ThreeKingdomsEngine 中拆分出的关卡/战斗子系统初始化和资源回调。
 * 职责：关卡系统初始化、奖励分发回调注入、战斗阵容构建
 *
 * @module engine/engine-campaign-deps
 */

import type { ResourceSystem } from './resource/ResourceSystem';
import type { HeroSystem } from './hero/HeroSystem';
import type { HeroFormation } from './hero/HeroFormation';
import { CampaignProgressSystem } from './campaign/CampaignProgressSystem';
import { RewardDistributor } from './campaign/RewardDistributor';
import { BattleEngine } from './battle/BattleEngine';
import type { BattleTeam, BattleUnit, BattleSkill } from './battle/battle.types';
import type { EnemyUnitDef, RewardDistributorDeps, Stage } from './campaign/campaign.types';
import type { ISystemDeps } from '../core/types';
import { campaignDataProvider } from './campaign/campaign-config';
import { TroopType, SkillTargetType } from './battle/battle.types';
import type { GeneralStats } from '../shared/types';

// ─────────────────────────────────────────────
// 关卡/战斗子系统集合
// ─────────────────────────────────────────────

/** 关卡/战斗子系统集合 */
export interface CampaignSystems {
  battleEngine: BattleEngine;
  campaignSystem: CampaignProgressSystem;
  rewardDistributor: RewardDistributor;
}

// ─────────────────────────────────────────────
// 创建与初始化
// ─────────────────────────────────────────────

/** 创建关卡/战斗子系统实例 */
export function createCampaignSystems(
  resource: ResourceSystem,
  hero: HeroSystem,
): CampaignSystems {
  const battleEngine = new BattleEngine();
  const campaignSystem = new CampaignProgressSystem(campaignDataProvider);
  const rewardDeps = buildRewardDeps(resource, hero);
  const rewardDistributor = new RewardDistributor(campaignDataProvider, rewardDeps);
  return { battleEngine, campaignSystem, rewardDistributor };
}

/** 初始化关卡子系统（注入依赖） */
export function initCampaignSystems(
  systems: CampaignSystems,
  deps: ISystemDeps,
): void {
  systems.campaignSystem.init(deps);
}

// ─────────────────────────────────────────────
// 奖励分发回调
// ─────────────────────────────────────────────

/** 构建 RewardDistributor 的依赖回调 */
export function buildRewardDeps(
  resource: ResourceSystem,
  hero: HeroSystem,
): RewardDistributorDeps {
  return {
    addResource: (type, amount) => resource.addResource(type, amount),
    addFragment: (generalId, count) => hero.addFragment(generalId, count),
    addExp: (exp: number) => {
      // 将经验平均分给所有已拥有的武将
      const generals = hero.getAllGenerals();
      if (generals.length === 0) return;
      const perHero = Math.floor(exp / generals.length);
      if (perHero <= 0) return;
      for (const g of generals) {
        hero.addExp(g.id, perHero);
      }
    },
  };
}

// ─────────────────────────────────────────────
// 战斗阵容构建
// ─────────────────────────────────────────────

/**
 * 从编队 + 武将数据构建我方 BattleTeam
 *
 * @param formation - 武将编队
 * @param hero - 武将系统
 * @param getTotalStats - 可选回调，获取武将含装备/羁绊加成的总属性
 *   若未提供则回退到 baseStats（兼容旧调用方式）
 */
export function buildAllyTeam(
  formation: HeroFormation,
  hero: HeroSystem,
  getTotalStats?: (generalId: string) => GeneralStats | undefined,
): BattleTeam {
  const active = formation.getActiveFormation();
  const slots = active?.slots ?? [];
  const units: BattleUnit[] = [];
  for (let i = 0; i < slots.length; i++) {
    const gid = slots[i];
    if (!gid) continue;
    const g = hero.getGeneral(gid);
    if (!g) continue;
    // 优先使用含装备/羁绊加成的总属性，回退到 baseStats
    const stats = getTotalStats?.(gid) ?? g.baseStats;
    units.push(generalToBattleUnit(g, 'ally', i < 3 ? 'front' : 'back', stats));
  }
  return { units, side: 'ally' };
}

/** 从关卡敌方配置构建 BattleTeam */
export function buildEnemyTeam(stage: Stage): BattleTeam {
  const units = stage.enemyFormation.units.map((e, i) =>
    enemyDefToBattleUnit(e, i < 3 ? 'front' : 'back'),
  );
  return { units, side: 'enemy' };
}

// ─────────────────────────────────────────────
// 内部辅助
// ─────────────────────────────────────────────

/** 根据武将四维属性推断兵种（最高属性决定） */
function inferTroopType(stats: { attack: number; defense: number; intelligence: number; speed: number }): TroopType {
  const { attack, defense, intelligence, speed } = stats;
  const max = Math.max(attack, defense, intelligence, speed);
  if (max === attack) return TroopType.CAVALRY;       // 武力最高 → 骑兵（猛将）
  if (max === intelligence) return TroopType.STRATEGIST; // 智力最高 → 谋士
  if (max === speed) return TroopType.ARCHER;          // 速度最高 → 弓兵
  if (max === defense) return TroopType.SPEARMAN;      // 统率最高 → 枪兵
  return TroopType.INFANTRY; // 兜底
}

/**
 * 将武将数据转换为战斗单位
 *
 * @param g - 武将数据（含 baseStats）
 * @param side - 阵营
 * @param position - 前排/后排
 * @param stats - 用于战斗的四维属性（默认为 baseStats，可传入含装备加成的 totalStats）
 */
function generalToBattleUnit(
  g: { id: string; name: string; faction: any; baseStats: any; level: number; skills: any[] },
  side: 'ally' | 'enemy',
  position: 'front' | 'back',
  stats?: { attack: number; defense: number; intelligence: number; speed: number },
): BattleUnit {
  // DEF-007: 使用传入的 stats（含装备/羁绊加成），若无则回退到 baseStats
  const effectiveStats = stats ?? g.baseStats;
  const maxHp = 500 + g.level * 100 + effectiveStats.defense * 10;
  const normalAttack: BattleSkill = {
    id: 'normal_attack', name: '普攻', type: 'active', level: 1,
    description: '普通攻击', multiplier: 1.0,
    targetType: SkillTargetType.SINGLE_ENEMY,
    rageCost: 0, cooldown: 0, currentCooldown: 0,
  };
  const skills: BattleSkill[] = (g.skills ?? []).map((s) => ({
    id: s.id, name: s.name, type: s.type, level: s.level,
    description: s.description, multiplier: 1.5,
    targetType: SkillTargetType.SINGLE_ENEMY,
    rageCost: 50, cooldown: 3, currentCooldown: 0,
  }));
  return {
    id: g.id, name: g.name, faction: g.faction,
    troopType: inferTroopType(effectiveStats), position, side,
    attack: effectiveStats.attack, baseAttack: g.baseStats.attack,
    defense: effectiveStats.defense, baseDefense: g.baseStats.defense,
    intelligence: effectiveStats.intelligence, speed: effectiveStats.speed,
    hp: maxHp, maxHp, isAlive: true, rage: 0, maxRage: 100,
    normalAttack, skills, buffs: [],
  };
}

function enemyDefToBattleUnit(e: EnemyUnitDef, position: 'front' | 'back'): BattleUnit {
  const normalAttack: BattleSkill = {
    id: `${e.id}_normal`, name: '普攻', type: 'active', level: 1,
    description: '普通攻击', multiplier: 1.0,
    targetType: SkillTargetType.SINGLE_ENEMY,
    rageCost: 0, cooldown: 0, currentCooldown: 0,
  };
  return {
    id: e.id, name: e.name, faction: e.faction,
    troopType: e.troopType, position, side: 'enemy',
    attack: e.attack, baseAttack: e.attack,
    defense: e.defense, baseDefense: e.defense,
    intelligence: e.intelligence, speed: e.speed,
    hp: e.maxHp, maxHp: e.maxHp, isAlive: true,
    rage: 0, maxRage: 100, normalAttack, skills: [], buffs: [],
  };
}
