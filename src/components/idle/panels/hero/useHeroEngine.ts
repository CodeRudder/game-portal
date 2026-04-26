/**
 * useHeroEngine — 武将系统统一数据桥接 Hook
 *
 * 职责：
 * - 从 ThreeKingdomsEngine 提取武将/技能/羁绊/建筑/编队推荐数据
 * - 将引擎层数据转换为 UI 组件 Props 所需格式
 * - 提供统一的操作方法（升级技能、派遣武将、应用编队等）
 *
 * 使用方式：
 * 1. 在 Container 组件中调用 useHeroEngine(engine, snapshotVersion)
 * 2. 将返回的数据和方法传递给子组件
 *
 * @module components/idle/panels/hero/useHeroEngine
 */

import { useMemo, useCallback } from 'react';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type { GeneralData, Quality, Faction } from '@/games/three-kingdoms/engine';
import type { ActiveBond } from '@/games/three-kingdoms/engine/hero/BondSystem';
import type { SkillItem, SkillUpgradeCost, SkillUnlockCondition } from './SkillUpgradePanel';
import type { HeroBrief, BuildingBrief } from './HeroDispatchPanel';
import type { HeroInfo, RecommendPlan } from './FormationRecommendPanel';
import type { BondCatalogItem } from './BondCollectionPanel';
import { BondType, FACTION_BONDS, PARTNER_BONDS } from '@/games/three-kingdoms/engine/hero/bond-config';
import type {
  HeroStarSystemLike,
  ResourceSystemLike,
  BuildingSystemLike,
  SkillDataWithCooldown,
} from './hero-ui.types';
import { adaptBondEffects as adaptEffects } from './hero-ui.types';

// ─────────────────────────────────────────────
// 辅助：品质排序权重
// ─────────────────────────────────────────────
const QUALITY_ORDER: Record<string, number> = {
  LEGENDARY: 5,
  EPIC: 4,
  RARE: 3,
  FINE: 2,
  COMMON: 1,
};

/** 技能等级 → 消耗表（与引擎对齐） */
const UPGRADE_COST_TABLE: Record<number, { copper: number; skillBook: number }> = {
  1: { copper: 500, skillBook: 1 },
  2: { copper: 1500, skillBook: 1 },
  3: { copper: 4000, skillBook: 2 },
  4: { copper: 10000, skillBook: 2 },
};
const DEFAULT_COST = { copper: 10000, skillBook: 2 };

/** 属性标签映射 */
const STAT_LABELS: Record<string, string> = {
  attack: '攻击',
  defense: '防御',
  intelligence: '智力',
  speed: '速度',
  hp: '生命',
  critRate: '暴击率',
  critDamage: '暴击伤害',
  skillDamage: '技能伤害',
};

// ─────────────────────────────────────────────
// Hook 参数与返回类型
// ─────────────────────────────────────────────

export interface UseHeroEngineParams {
  /** ThreeKingdomsEngine 实例 */
  engine: ThreeKingdomsEngine;
  /** 快照版本号，用于触发重渲染 */
  snapshotVersion: number;
  /** 当前选中的武将ID（用于技能面板等） */
  selectedHeroId?: string;
  /** 编队中的武将ID列表 */
  formationHeroIds?: string[];
}

export interface UseHeroEngineReturn {
  // ── 武将列表 ──
  /** 所有武将数据 */
  allGenerals: GeneralData[];
  /** 已拥有的武将ID列表 */
  ownedHeroIds: string[];

  // ── 武将简要数据（供 HeroDispatchPanel 使用） ──
  heroBriefs: HeroBrief[];

  // ── 武将详细信息（供 FormationRecommendPanel 使用） ──
  heroInfos: HeroInfo[];

  // ── 技能数据（供 SkillUpgradePanel 使用） ──
  /** 当前选中武将的技能列表 */
  skills: SkillItem[];
  /** 当前技能书数量 */
  skillBookAmount: number;
  /** 当前铜钱数量 */
  goldAmount: number;

  // ── 羁绊数据（供 BondCollectionPanel 使用） ──
  /** 已激活羁绊列表 */
  activeBonds: ActiveBond[];
  /** 羁绊图鉴数据 */
  bondCatalog: BondCatalogItem[];
  /** 武将→阵营映射 */
  heroFactionMap: Record<string, string>;

  // ── 建筑数据（供 HeroDispatchPanel 使用） ──
  buildings: BuildingBrief[];

  // ── 编队推荐数据 ──
  /** 当前编队 */
  currentFormation: (string | null)[];
  /** 战力计算回调（对接引擎） */
  powerCalculator: (heroes: HeroInfo[]) => number;
  /**
   * 引擎驱动的推荐方案生成器
   *
   * 调用引擎的 calculateTotalPower 计算实际战力，
   * 调用引擎的 BondSystem 检测可激活羁绊，
   * 综合战力+羁绊评分生成3套方案。
   */
  generateRecommendations: () => RecommendPlan[];

  // ── 操作方法 ──
  /** 升级技能 */
  upgradeSkill: (heroId: string, skillIndex: number) => void;
  /** 派遣武将到建筑 */
  dispatchHero: (heroId: string, buildingId: string) => void;
  /** 召回武将 */
  recallHero: (buildingId: string) => void;
  /** 应用推荐编队 */
  applyRecommend: (heroIds: (string | null)[]) => void;
}

// ─────────────────────────────────────────────
// Hook 实现
// ─────────────────────────────────────────────

/**
 * 武将系统统一数据桥接 Hook
 *
 * 从 ThreeKingdomsEngine 中提取所有武将相关数据，
 * 并转换为各 UI 组件所需的 Props 格式。
 */
export function useHeroEngine(params: UseHeroEngineParams): UseHeroEngineReturn {
  const { engine, snapshotVersion, selectedHeroId, formationHeroIds } = params;

  // ── 1. 获取所有武将 ──
  const allGenerals = useMemo(() => {
    void snapshotVersion;
    try {
      const raw = engine?.getGenerals?.() ?? [];
      return Array.isArray(raw) ? raw : raw ? Object.values(raw as Record<string, GeneralData>) : [];
    } catch {
      return [];
    }
  }, [engine, snapshotVersion]);

  const ownedHeroIds = useMemo(
    () => allGenerals.map((g) => g.id),
    [allGenerals],
  );

  // ── 2. 武将简要数据（HeroBrief） ──
  const heroBriefs = useMemo((): HeroBrief[] => {
    // 通过引擎的 HeroStarSystem 获取星级信息
    let starSystem: HeroStarSystemLike | null = null;
    try {
      starSystem = (engine as unknown as { getHeroStarSystem(): HeroStarSystemLike }).getHeroStarSystem() ?? null;
    } catch { /* 引擎未初始化 */ }

    return allGenerals.map((g): HeroBrief => ({
      id: g.id,
      name: g.name,
      level: g.level,
      quality: g.quality as string,
      stars: starSystem?.getStar(g.id) ?? 1,
    }));
  }, [allGenerals, engine]);

  // ── 3. 武将详细信息（HeroInfo） ──
  const heroInfos = useMemo((): HeroInfo[] => {
    let starSystem: HeroStarSystemLike | null = null;
    try {
      starSystem = (engine as unknown as { getHeroStarSystem(): HeroStarSystemLike }).getHeroStarSystem() ?? null;
    } catch { /* 引擎未初始化 */ }

    return allGenerals.map((g): HeroInfo => ({
      id: g.id,
      name: g.name,
      level: g.level,
      quality: g.quality as string,
      stars: starSystem?.getStar(g.id) ?? 1,
      faction: g.faction as string,
    }));
  }, [allGenerals, engine]);

  // ── 4. 武将→阵营映射 ──
  const heroFactionMap = useMemo(() => {
    const map: Record<string, string> = {};
    allGenerals.forEach((g) => {
      map[g.id] = g.faction as string;
    });
    return map;
  }, [allGenerals]);

  // ── 5. 技能数据 ──
  const skills = useMemo((): SkillItem[] => {
    if (!selectedHeroId) return [];
    try {
      const general = engine.getGeneral(selectedHeroId);
      if (!general) return [];
      const skillSystem = engine.getSkillUpgradeSystem();

      // 通过引擎 getter 获取 HeroStarSystem
      const heroStarSystem = (engine as unknown as { getHeroStarSystem(): HeroStarSystemLike }).getHeroStarSystem();

      return (general.skills ?? []).map((skill, index) => {
        const levelCap = heroStarSystem
          ? heroStarSystem.getLevelCap(selectedHeroId)
          : 100;
        const skillCap = Math.min(5, Math.floor(levelCap / 10));

        // 判断是否解锁（突破阶段检查）
        const breakthroughStage = heroStarSystem?.getBreakthroughStage?.(selectedHeroId) ?? 0;
        const unlockStage = index >= 3 ? index - 2 : 0;
        const unlocked = breakthroughStage >= unlockStage;

        // 消耗
        const costTable = UPGRADE_COST_TABLE[skill.level] ?? DEFAULT_COST;
        const upgradeCost: SkillUpgradeCost = {
          skillBook: costTable.skillBook,
          gold: costTable.copper,
        };

        // 安全获取 cooldown：引擎 SkillData 无此字段，通过扩展接口访问
        const skillExt = skill as unknown as SkillDataWithCooldown;
        const cooldown = skillExt.cooldown ?? (skill.type === 'active' ? 8 : 0);

        return {
          ...skill,
          upgradeCost,
          levelCap: skillCap,
          unlocked: index < 2 || unlocked,
          unlockCondition: !unlocked ? {
            breakthroughStage: unlockStage,
            description: `突破阶段 ${unlockStage} 解锁`,
          } as SkillUnlockCondition : undefined,
          cooldown,
        } as SkillItem;
      });
    } catch {
      return [];
    }
  }, [engine, selectedHeroId, snapshotVersion]);

  // ── 6. 资源数量 ──
  const skillBookAmount = useMemo(() => {
    try {
      const resource = (engine as unknown as { readonly resource: ResourceSystemLike }).resource;
      return resource?.getAmount?.('skillBook') ?? 0;
    } catch {
      return 0;
    }
  }, [engine, snapshotVersion]);

  const goldAmount = useMemo(() => {
    try {
      const resource = (engine as unknown as { readonly resource: ResourceSystemLike }).resource;
      return resource?.getAmount?.('gold') ?? 0;
    } catch {
      return 0;
    }
  }, [engine, snapshotVersion]);

  // ── 7. 羁绊数据 ──
  const activeBonds = useMemo((): ActiveBond[] => {
    try {
      const bondSystem = engine.getBondSystem();
      const ids = formationHeroIds ?? allGenerals.map((g) => g.id);
      return bondSystem.getActiveBonds(ids);
    } catch {
      return [];
    }
  }, [engine, formationHeroIds, allGenerals, snapshotVersion]);

  const bondCatalog = useMemo((): BondCatalogItem[] => {
    const items: BondCatalogItem[] = [];
    const activeBondIds = new Set(activeBonds.map((b) => b.bondId));
    const ids = formationHeroIds ?? ownedHeroIds;

    // 阵营羁绊
    for (const fb of FACTION_BONDS) {
      const isActive = activeBondIds.has(fb.id);
      const activeBond = activeBonds.find((b) => b.bondId === fb.id);
      const highestTier = fb.tiers[fb.tiers.length - 1];

      // 过滤出属于该阵营的已拥有武将
      const factionHeroIds = ids.filter((heroId) => heroFactionMap[heroId] === fb.faction);

      const desc = fb.tiers.map((t) =>
        `${t.requiredCount}人: ${t.effects.map((e) => `${STAT_LABELS[e.stat] ?? e.stat}+${Math.round(e.value * 100)}%`).join(', ')}`
      ).join(' | ');

      items.push({
        id: fb.id,
        name: fb.name,
        type: BondType.FACTION,
        faction: fb.faction,
        heroIds: factionHeroIds,
        heroNames: [],
        description: desc,
        level: activeBond?.level ?? 0,
        effects: adaptEffects(highestTier.effects),
        isActive,
        minRequired: fb.tiers[0]?.requiredCount ?? 2,
      });
    }

    // 搭档羁绊
    for (const pb of PARTNER_BONDS) {
      const isActive = activeBondIds.has(pb.id);
      const activeBond = activeBonds.find((b) => b.bondId === pb.id);

      const desc = pb.effects.map((e) =>
        `${STAT_LABELS[e.stat] ?? e.stat}+${Math.round(e.value * 100)}%`
      ).join(', ');

      items.push({
        id: pb.id,
        name: pb.name,
        type: BondType.PARTNER,
        heroIds: [...pb.generalIds],
        heroNames: [],
        description: desc,
        level: activeBond?.level ?? 0,
        effects: adaptEffects(pb.effects),
        isActive,
        minRequired: pb.minRequired,
      });
    }

    return items;
  }, [activeBonds, formationHeroIds, ownedHeroIds, heroFactionMap]);

  // ── 8. 建筑数据 ──
  const buildings = useMemo((): BuildingBrief[] => {
    try {
      const buildingSystem = (engine as unknown as { readonly building: BuildingSystemLike }).building;
      if (!buildingSystem) return [];
      const allBuildings = buildingSystem.getAllBuildings();
      const dispatchSystem = engine.getHeroDispatchSystem();
      const dispatchState = dispatchSystem.getState() as {
        buildingDispatch?: Record<string, { heroId: string }>;
      };

      return Object.entries(allBuildings).map(
        ([id, bld]): BuildingBrief => ({
          id,
          name: buildingSystem.getBuildingDef?.(id)?.name ?? id,
          level: bld.level,
          dispatchHeroId: dispatchState?.buildingDispatch?.[id]?.heroId ?? null,
        }),
      );
    } catch {
      return [];
    }
  }, [engine, snapshotVersion]);

  // ── 9. 当前编队 ──
  const currentFormation = useMemo((): (string | null)[] => {
    try {
      const formationSystem = engine.getFormationSystem();
      const formations = engine.getFormations();
      if (formations.length === 0) return Array(6).fill(null);
      const active = formations[0];
      return active.slots.map((s: { heroId?: string | null } | string | null) =>
        (s != null && typeof s === 'object' && 'heroId' in s) ? s.heroId ?? null : typeof s === 'string' ? s : null
      );
    } catch {
      return Array(6).fill(null);
    }
  }, [engine, snapshotVersion]);

  // ── 10. 战力计算回调（对接引擎） ──
  const powerCalculator = useCallback(
    (heroes: HeroInfo[]): number => {
      try {
        const heroSystem = engine.getHeroSystem();
        return heroes.reduce((sum, h) => {
          const general = engine.getGeneral(h.id);
          if (general) {
            return sum + heroSystem.calculatePower(general);
          }
          // 回退：简易估算
          const qWeight = QUALITY_ORDER[h.quality] ?? 1;
          const starFactor = 1 + h.stars * 0.15;
          return sum + Math.round(h.level * qWeight * starFactor * 10);
        }, 0);
      } catch {
        return heroes.reduce((sum, h) => {
          const qWeight = QUALITY_ORDER[h.quality] ?? 1;
          return sum + h.level * qWeight * 10;
        }, 0);
      }
    },
    [engine],
  );

  // ── 操作方法 ──

  const upgradeSkill = useCallback(
    (heroId: string, skillIndex: number) => {
      try {
        const skillSystem = engine.getSkillUpgradeSystem();
        const general = engine.getGeneral(heroId);
        if (!general) return;
        const skill = general.skills[skillIndex];
        if (!skill) return;

        const cost = UPGRADE_COST_TABLE[skill.level] ?? DEFAULT_COST;
        skillSystem.upgradeSkill(heroId, skillIndex, {
          skillBook: cost.skillBook,
          copper: cost.copper,
        });
      } catch {
        // 引擎操作失败，静默处理
      }
    },
    [engine],
  );

  const dispatchHero = useCallback(
    (heroId: string, buildingId: string) => {
      try {
        const dispatchSystem = engine.getHeroDispatchSystem();
        dispatchSystem.dispatchHero(heroId, buildingId as import('@/games/three-kingdoms/shared/types').BuildingType);
      } catch {
        // 引擎操作失败，静默处理
      }
    },
    [engine],
  );

  const recallHero = useCallback(
    (buildingId: string) => {
      try {
        const dispatchSystem = engine.getHeroDispatchSystem();
        const state = dispatchSystem.getState() as {
          buildingDispatch?: Record<string, { heroId: string }>;
        };
        const record = state?.buildingDispatch?.[buildingId];
        if (record?.heroId) {
          dispatchSystem.undispatchHero(record.heroId);
        }
      } catch {
        // 引擎操作失败，静默处理
      }
    },
    [engine],
  );

  const applyRecommend = useCallback(
    (heroIds: (string | null)[]) => {
      try {
        const formationSystem = engine.getFormationSystem();
        const formations = engine.getFormations();
        if (formations.length > 0) {
          const validIds = heroIds.filter((id): id is string => id != null);
          formationSystem.setFormation(0, validIds);
        }
      } catch {
        // 引擎操作失败，静默处理
      }
    },
    [engine],
  );

  // ── 12. 引擎驱动的推荐方案生成 ──
  const generateRecommendations = useCallback((): RecommendPlan[] => {
    const MAX_SLOTS = 6;
    if (heroInfos.length === 0) return [];

    // 辅助：计算一组武将的实际战力（调用引擎）
    const calcTeamPower = (ids: string[]): number => {
      try {
        const heroSystem = engine.getHeroSystem();
        return ids.reduce((sum, id) => {
          const general = engine.getGeneral(id);
          if (general) return sum + heroSystem.calculatePower(general);
          return sum;
        }, 0);
      } catch {
        return ids.reduce((sum, id) => {
          const h = heroInfos.find((info) => info.id === id);
          if (!h) return sum;
          const qWeight = QUALITY_ORDER[h.quality] ?? 1;
          return sum + Math.round(h.level * qWeight * (1 + h.stars * 0.15) * 10);
        }, 0);
      }
    };

    // 辅助：检测羁绊（调用引擎 BondSystem）
    const detectBondsForHeroes = (ids: string[]): string[] => {
      const bondNames: string[] = [];
      try {
        const bondSystem = engine.getBondSystem();
        const activeBonds = bondSystem.getActiveBonds(ids);
        for (const bond of activeBonds) {
          bondNames.push(bond.name);
        }
      } catch {
        // 回退：简易阵营羁绊检测
        const factionCounts: Record<string, number> = {};
        ids.forEach((id) => {
          const h = heroInfos.find((info) => info.id === id);
          if (h) factionCounts[h.faction] = (factionCounts[h.faction] || 0) + 1;
        });
        const factionNames: Record<string, string> = {
          shu: '蜀国羁绊', wei: '魏国羁绊', wu: '吴国羁绊', qun: '群雄羁绊',
        };
        for (const [faction, count] of Object.entries(factionCounts)) {
          if (count >= 2) bondNames.push(`${factionNames[faction] || faction}(${count}人)`);
        }
      }
      return bondNames;
    };

    // 按引擎战力排序
    const sorted = [...heroInfos]
      .map((h) => ({ hero: h, power: calcTeamPower([h.id]) }))
      .sort((a, b) => b.power - a.power);

    const plans: RecommendPlan[] = [];

    // 方案1：战力最优 — 取引擎战力最高的武将
    const bestCount = Math.min(MAX_SLOTS, sorted.length);
    const bestIds = sorted.slice(0, bestCount).map((h) => h.hero.id);
    const bestPower = calcTeamPower(bestIds);
    const bestBonds = detectBondsForHeroes(bestIds);
    plans.push({
      id: 'best-power',
      name: '战力最优',
      description: `选择战力最高的${bestCount}名武将`,
      heroIds: bestIds,
      estimatedPower: bestPower,
      score: Math.min(100, Math.round(bestPower / 50)),
      bonds: bestBonds,
      basis: '基于引擎战力计算，选取最高战力组合',
    });

    // 方案2：羁绊最优 — 调用引擎 BondSystem 检测可激活羁绊最多的组合
    if (sorted.length > 2) {
      // 按阵营分组
      const factionGroups: Record<string, typeof sorted> = {};
      sorted.forEach((item) => {
        const f = item.hero.faction;
        if (!factionGroups[f]) factionGroups[f] = [];
        factionGroups[f].push(item);
      });

      // 尝试每个阵营为核心，找羁绊最多的方案
      let bestSynergyIds: string[] = [];
      let bestSynergyBondCount = -1;
      let bestSynergyPower = 0;

      for (const [, items] of Object.entries(factionGroups)) {
        const coreIds = items.slice(0, MAX_SLOTS).map((h) => h.hero.id);
        // 补充其他阵营武将
        const coreIdSet = new Set(coreIds);
        const remaining = sorted.filter((h) => !coreIdSet.has(h.hero.id));
        const fullIds = [...coreIds];
        for (const r of remaining) {
          if (fullIds.length >= MAX_SLOTS) break;
          fullIds.push(r.hero.id);
        }

        const bonds = detectBondsForHeroes(fullIds);
        const power = calcTeamPower(fullIds);
        if (
          bonds.length > bestSynergyBondCount ||
          (bonds.length === bestSynergyBondCount && power > bestSynergyPower)
        ) {
          bestSynergyIds = fullIds;
          bestSynergyBondCount = bonds.length;
          bestSynergyPower = power;
        }
      }

      const synergyBonds = detectBondsForHeroes(bestSynergyIds);
      plans.push({
        id: 'best-synergy',
        name: '羁绊最优',
        description: `优先激活羁绊，检测到${synergyBonds.length}个羁绊`,
        heroIds: bestSynergyIds,
        estimatedPower: bestSynergyPower,
        score: Math.min(100, Math.round(bestSynergyPower / 55) + synergyBonds.length * 5),
        bonds: synergyBonds,
        basis: '基于引擎羁绊检测，最大化激活羁绊数量',
      });
    }

    // 方案3：平衡编队 — 综合引擎战力 + 羁绊评分
    if (sorted.length > 3) {
      // 按品质分层选取
      const byQuality: Record<string, typeof sorted> = {};
      sorted.forEach((item) => {
        const q = item.hero.quality;
        if (!byQuality[q]) byQuality[q] = [];
        byQuality[q].push(item);
      });

      const balancedIds: string[] = [];
      for (const q of ['LEGENDARY', 'EPIC', 'RARE', 'FINE', 'COMMON']) {
        const items = byQuality[q] || [];
        for (const item of items) {
          if (balancedIds.length >= MAX_SLOTS) break;
          balancedIds.push(item.hero.id);
        }
        if (balancedIds.length >= MAX_SLOTS) break;
      }

      const balancedPower = calcTeamPower(balancedIds);
      const balancedBonds = detectBondsForHeroes(balancedIds);
      plans.push({
        id: 'balanced',
        name: '平衡编队',
        description: '兼顾品质与覆盖面的均衡阵容',
        heroIds: balancedIds,
        estimatedPower: balancedPower,
        score: Math.min(100, Math.round(balancedPower / 52) + balancedBonds.length * 3),
        bonds: balancedBonds,
        basis: '基于品质分层选取，综合引擎战力与羁绊平衡',
      });
    }

    return plans;
  }, [engine, heroInfos]);

  return {
    allGenerals,
    ownedHeroIds,
    heroBriefs,
    heroInfos,
    skills,
    skillBookAmount,
    goldAmount,
    activeBonds,
    bondCatalog,
    heroFactionMap,
    buildings,
    currentFormation,
    powerCalculator,
    generateRecommendations,
    upgradeSkill,
    dispatchHero,
    recallHero,
    applyRecommend,
  };
}
