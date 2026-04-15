/**
 * 三国霸业 — 渲染状态适配器
 *
 * 将引擎（ThreeKingdomsEngine）内部子系统状态转换为
 * 渲染器可消费的 GameRenderState 数据包。
 *
 * 职责：
 * - 面板 → 场景类型映射
 * - 资源栏数据组装
 * - 阶段信息映射
 * - 地图/领土数据组装
 * - 战斗场景数据组装
 * - 科技树数据组装
 * - 武将列表数据组装
 * - 声望转生数据组装
 * - 建筑列表数据组装
 *
 * @module games/three-kingdoms/ThreeKingdomsRenderStateAdapter
 */

import type {
  GameRenderState, SceneType, MapRenderData, TerritoryRenderData,
  BuildingRenderData, CombatRenderData, CombatUnitRenderData,
  ResourceBarRenderData, ResourceItemRenderData, StageRenderData,
  PrestigeRenderData, HeroRenderData, TechTreeRenderData, TechNodeRenderData,
} from '@/renderer/types';
import type { ThreeKingdomsEngine } from './ThreeKingdomsEngine';
import {
  BUILDINGS, GENERALS, TERRITORIES, TECHS, BATTLES, STAGES,
  RESOURCES, PRESTIGE_CONFIG,
} from './constants';

// ═══════════════════════════════════════════════════════════════
// 领土类型映射
// ═══════════════════════════════════════════════════════════════

/** 将引擎领土类型映射为渲染层领土类型 */
const TERRITORY_TYPE_MAP: Record<string, TerritoryRenderData['type']> = {
  plains: 'village',
  mountain: 'fortress',
  forest: 'village',
  desert: 'wilderness',
  coastal: 'city',
  capital: 'capital',
};

// ═══════════════════════════════════════════════════════════════
// 科技树分支 X 坐标配置
// ═══════════════════════════════════════════════════════════════

/** 科技树分支水平位置 */
const BRANCH_X: Record<string, number> = {
  military: 300,
  economy: 600,
  culture: 900,
};

/** 科技树节点垂直起始位置和间距 */
const TECH_START_Y = 100;
const TECH_SPACING_Y = 120;

// ═══════════════════════════════════════════════════════════════
// 建筑网格布局常量
// ═══════════════════════════════════════════════════════════════

/** 建筑网格列数 */
const BUILDING_COLS = 4;
/** 建筑格子宽度 */
const BUILDING_CELL_W = 160;
/** 建筑格子高度 */
const BUILDING_CELL_H = 120;
/** 建筑网格起始 X */
const BUILDING_GRID_X = 100;
/** 建筑网格起始 Y */
const BUILDING_GRID_Y = 450;

// ═══════════════════════════════════════════════════════════════
// 战斗角色位置布局
// ═══════════════════════════════════════════════════════════════

/** 玩家方角色 X 坐标 */
const PLAYER_X = 300;
/** 敌方角色 X 坐标 */
const ENEMY_X = 1200;
/** 角色垂直间距 */
const UNIT_SPACING_Y = 120;
/** 角色起始 Y */
const UNIT_START_Y = 150;

// ═══════════════════════════════════════════════════════════════
// 适配器
// ═══════════════════════════════════════════════════════════════

/**
 * 三国霸业渲染状态适配器
 *
 * 将引擎内部子系统状态转换为渲染器可消费的 GameRenderState。
 * 通过 `(engine as any)` 访问引擎私有字段以读取子系统数据。
 */
export class ThreeKingdomsRenderStateAdapter {
  private engine: ThreeKingdomsEngine;

  constructor(engine: ThreeKingdomsEngine) {
    this.engine = engine;
  }

  // ─── 公共接口 ───────────────────────────────────────────

  /**
   * 将引擎状态转换为完整的 GameRenderState
   *
   * 根据当前面板状态决定激活哪个场景，并按需组装对应数据。
   */
  toRenderState(): GameRenderState {
    const e = this.engine as any;
    const activeScene = this.panelToScene(e.panel);

    return {
      activeScene,
      resources: this.toResourceBar(e),
      currentStage: this.toStageData(e),
      map: activeScene === 'map' ? this.toMapData(e) : undefined,
      combat: activeScene === 'combat' ? this.toCombatData(e) : undefined,
      techTree: activeScene === 'tech-tree' ? this.toTechTreeData(e) : undefined,
      heroes: activeScene === 'hero-detail' ? this.toHeroList(e) : undefined,
      prestige: activeScene === 'prestige' ? this.toPrestigeData(e) : undefined,
      buildings: activeScene === 'building-detail' ? this.toBuildingList(e) : undefined,
    };
  }

  // ─── 面板 → 场景映射 ───────────────────────────────────

  /**
   * 将引擎面板标识映射为渲染层场景类型
   *
   * - 'none' / 'territory' → 'map'（默认显示地图/领土）
   * - 'battle' → 'combat'
   * - 'tech' → 'tech-tree'
   * - 'generals' → 'hero-detail'
   * - 'prestige' → 'prestige'
   */
  private panelToScene(panel: string): SceneType {
    switch (panel) {
      case 'battle':
        return 'combat';
      case 'tech':
        return 'tech-tree';
      case 'generals':
        return 'hero-detail';
      case 'prestige':
        return 'prestige';
      case 'none':
      case 'territory':
      default:
        return 'map';
    }
  }

  // ─── 资源栏 ─────────────────────────────────────────────

  /**
   * 组装资源栏渲染数据
   *
   * 遍历 RESOURCES 常量，从引擎内部读取当前数量和每秒产出。
   * 三国霸业所有资源始终可见。
   */
  private toResourceBar(e: any): ResourceBarRenderData {
    const resources: ResourceItemRenderData[] = RESOURCES.map((r) => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      amount: e.res[r.id] || 0,
      perSecond: e.psCache[r.id] || 0,
      unlocked: true, // 三国霸业所有资源始终可见
    }));

    return { resources };
  }

  // ─── 阶段数据 ───────────────────────────────────────────

  /**
   * 组装当前阶段渲染数据
   *
   * 从 stages 子系统获取当前阶段定义并映射为 StageRenderData。
   */
  private toStageData(e: any): StageRenderData | null {
    const current = e.stages.getCurrent();
    if (!current) return null;

    return {
      id: current.id,
      name: current.name,
      description: current.description,
      iconAsset: current.iconAsset,
      themeColor: current.themeColor,
      multiplier: current.productionMultiplier,
      requiredResources: current.requiredResources,
      isCurrent: true,
    };
  }

  // ─── 地图数据（核心） ───────────────────────────────────

  /**
   * 组装地图渲染数据
   *
   * 合并 TERRITORIES 常量与引擎领土子系统状态，构建完整的
   * 地图渲染数据包，包含领土节点、连接线、建筑和摄像机位置。
   */
  private toMapData(e: any): MapRenderData {
    // ── 领土节点 ──
    const territories: TerritoryRenderData[] = TERRITORIES.map((t) => {
      const conquered = e.terr.isConquered(t.id);
      return {
        id: t.id,
        name: t.name,
        type: TERRITORY_TYPE_MAP[t.type] || 'village',
        position: { ...t.position },
        conquered,
        powerRequired: t.powerRequired,
        income: { ...t.rewards },
        neighbors: [...t.adjacent],
        color: conquered ? '#4ecdc4' : '#e74c3c',
      };
    });

    // ── 连接线（双向去重） ──
    const connectionSet = new Set<string>();
    const connections: { from: string; to: string }[] = [];

    for (const t of TERRITORIES) {
      for (const adj of t.adjacent) {
        // 用排序后的 ID 对作为唯一键，避免重复
        const key = [t.id, adj].sort().join('|');
        if (!connectionSet.has(key)) {
          connectionSet.add(key);
          connections.push({ from: t.id, to: adj });
        }
      }
    }

    // ── 地图上的建筑（2行4列网格布局） ──
    const buildings: BuildingRenderData[] = BUILDINGS.map((b, idx) => {
      const col = idx % BUILDING_COLS;
      const row = Math.floor(idx / BUILDING_COLS);
      const level = e.bldg.getLevel(b.id);
      const cost = e.bldg.getCost(b.id);
      const unlocked = e.bldg.isUnlocked(b.id);

      // 建筑状态判定
      let state: BuildingRenderData['state'];
      if (level > 0) {
        state = 'producing';
      } else if (unlocked) {
        state = 'idle';
      } else {
        state = 'locked';
      }

      // 升级费用和可购买性
      const canUpgrade = unlocked && this.canPayResources(e, cost);

      return {
        id: b.id,
        type: b.id,
        name: b.name,
        level,
        maxLevel: b.maxLevel || 999, // maxLevel=0 表示无上限
        position: {
          x: BUILDING_GRID_X + col * BUILDING_CELL_W,
          y: BUILDING_GRID_Y + row * BUILDING_CELL_H,
        },
        size: { width: BUILDING_CELL_W - 10, height: BUILDING_CELL_H - 10 },
        state,
        productionResource: b.productionResource,
        productionRate: level > 0 ? b.baseProduction * level : 0,
        upgradeCost: cost,
        canUpgrade,
        iconAsset: b.icon,
      };
    });

    return {
      territories,
      connections,
      cameraPosition: { x: 350, y: 200 }, // 默认居中
      zoom: 1,
      buildings,
    };
  }

  // ─── 战斗数据 ───────────────────────────────────────────

  /**
   * 组装战斗场景渲染数据
   *
   * 从战斗子系统获取当前战斗状态，将已招募武将构造为玩家角色，
   * 将当前波次敌人构造为敌方角色。
   * 若无活跃战斗，构造默认首波战斗。
   */
  private toCombatData(e: any): CombatRenderData {
    const battleState = e.battles.getCurrentState();

    // ── 玩家角色：从已招募武将中取前6个 ──
    const playerUnits: CombatUnitRenderData[] = GENERALS
      .filter((g) => e.units.isUnlocked(g.id))
      .slice(0, 6)
      .map((g, idx) => {
        const unitState = e.units.getState(g.id);
        const level = unitState?.level || 1;
        const stats = g.baseStats;

        return {
          id: g.id,
          name: g.name,
          faction: 'player' as const,
          position: {
            x: PLAYER_X,
            y: UNIT_START_Y + idx * UNIT_SPACING_Y,
          },
          currentHp: stats.defense * level * 10,
          maxHp: stats.defense * level * 10,
          attack: stats.attack * level,
          defense: stats.defense * level,
          alive: true,
          rarity: g.rarity,
          animState: 'idle' as const,
        };
      });

    // ── 敌方角色：从当前战斗波次构造 ──
    let battleId = '';
    let currentWave = 0;
    let totalWaves = 0;
    let combatState: CombatRenderData['state'] = 'preparing';
    let enemyUnits: CombatUnitRenderData[] = [];

    if (battleState?.currentWave) {
      // 有活跃战斗
      battleId = battleState.currentWave;
      combatState = 'fighting';

      // 查找当前战斗定义
      const battleDef = BATTLES.find((b) => b.id === battleState.currentWave);
      if (battleDef) {
        currentWave = battleDef.wave;

        // 计算当前阶段总波次数
        const stageBattles = BATTLES.filter((b) => b.stageId === battleDef.stageId);
        totalWaves = stageBattles.length;

        // 构造敌方角色（使用运行时存活的敌人数据）
        enemyUnits = battleState.aliveEnemies.map((enemy: any, idx: number) => ({
          id: enemy.instanceId || enemy.defId,
          name: enemy.defId, // 使用 defId 作为名称，后续可从定义表查找
          faction: 'enemy' as const,
          position: {
            x: ENEMY_X,
            y: UNIT_START_Y + idx * UNIT_SPACING_Y,
          },
          currentHp: enemy.currentHp,
          maxHp: enemy.maxHp,
          attack: 0, // 运行时敌人实例不含攻击力，从定义补充
          defense: 0,
          alive: enemy.isAlive,
          animState: 'idle' as const,
        }));

        // 补充敌人攻击/防御数据（从定义表查找）
        for (const eu of enemyUnits) {
          const defId = eu.id.split('_')[0]; // 从 instanceId 中提取 defId
          const enemyDef = battleDef.enemies.find((en) => en.id === defId);
          if (enemyDef) {
            eu.name = enemyDef.name;
            eu.attack = enemyDef.attack;
            eu.defense = enemyDef.defense;
          }
        }
      }
    } else {
      // 无活跃战斗，构造默认首波
      const firstBattle = BATTLES[0];
      if (firstBattle) {
        battleId = firstBattle.id;
        currentWave = 1;
        const stageBattles = BATTLES.filter((b) => b.stageId === firstBattle.stageId);
        totalWaves = stageBattles.length;
        combatState = 'preparing';

        enemyUnits = firstBattle.enemies.map((en, idx) => ({
          id: en.id,
          name: en.name,
          faction: 'enemy' as const,
          position: {
            x: ENEMY_X,
            y: UNIT_START_Y + idx * UNIT_SPACING_Y,
          },
          currentHp: en.hp,
          maxHp: en.hp,
          attack: en.attack,
          defense: en.defense,
          alive: true,
          animState: 'idle' as const,
        }));
      }
    }

    return {
      battleId,
      currentWave,
      totalWaves,
      playerUnits,
      enemyUnits,
      damageNumbers: [],
      skillEffects: [],
      state: combatState,
    };
  }

  // ─── 科技树数据 ─────────────────────────────────────────

  /**
   * 组装科技树渲染数据
   *
   * 遍历 TECHS 常量，根据引擎科技子系统状态判定每个节点状态，
   * 按 3 个分支（military/economy/culture）垂直排列。
   */
  private toTechTreeData(e: any): TechTreeRenderData {
    const currentResearch = e.techs.getCurrentResearch();

    // ── 科技节点 ──
    const nodes: TechNodeRenderData[] = TECHS.map((t) => {
      const isResearched = e.techs.isResearched(t.id);
      const isActive = currentResearch?.techId === t.id;
      const canResearch = !isResearched && !isActive && e.techs.canResearch(t.id, e.res);

      // 状态判定
      let state: TechNodeRenderData['state'];
      if (isResearched) {
        state = 'completed';
      } else if (isActive) {
        state = 'researching';
      } else if (canResearch) {
        state = 'available';
      } else {
        state = 'locked';
      }

      // 研究进度
      let progress = 0;
      if (isActive && currentResearch) {
        progress = currentResearch.progress || 0;
      } else if (isResearched) {
        progress = 1;
      }

      // 位置计算：按分支和层级排列
      const branch = t.branch || 'military';
      const x = BRANCH_X[branch] || 300;
      const y = TECH_START_Y + (t.tier - 1) * TECH_SPACING_Y;

      return {
        id: t.id,
        name: t.name,
        description: t.description,
        tier: t.tier,
        position: { x, y },
        state,
        progress,
        cost: { ...t.cost },
        prerequisites: [...t.requires],
        iconAsset: t.icon,
      };
    });

    // ── 依赖连线 ──
    const connections: { from: string; to: string }[] = [];
    for (const t of TECHS) {
      for (const reqId of t.requires) {
        connections.push({ from: reqId, to: t.id });
      }
    }

    return {
      nodes,
      connections,
      cameraPosition: { x: 600, y: 300 },
      zoom: 1,
    };
  }

  // ─── 武将列表 ───────────────────────────────────────────

  /**
   * 组装武将列表渲染数据
   *
   * 遍历 GENERALS 常量，从武将子系统获取招募状态和等级信息。
   */
  private toHeroList(e: any): HeroRenderData[] {
    return GENERALS.map((g) => {
      const unlocked = e.units.isUnlocked(g.id);
      const unitState = e.units.getState(g.id);
      const level = unlocked && unitState ? unitState.level : 0;
      const exp = unlocked && unitState ? unitState.exp : 0;

      // 经验值上限：简化公式，每级需要 level * 100 经验
      const maxExp = level > 0 ? level * 100 : 100;

      // 是否可招募
      const canRecruit = !unlocked && this.canPayResources(e, g.recruitCost);

      return {
        id: g.id,
        name: g.name,
        rarity: g.rarity,
        faction: g.faction,
        level,
        exp,
        maxExp,
        unlocked,
        stats: { ...g.baseStats },
        recruitCost: { ...g.recruitCost },
        canRecruit,
      };
    });
  }

  // ─── 声望数据 ───────────────────────────────────────────

  /**
   * 组装声望转生渲染数据
   *
   * 从声望子系统获取当前状态和转生预览。
   */
  private toPrestigeData(e: any): PrestigeRenderData {
    const state = e.prest.getState();

    // 计算总资源用于预览
    const total = (e.res.grain || 0) + (e.res.gold || 0) + (e.res.troops || 0);
    const preview = e.prest.getPreview(total);

    return {
      currency: state.currency,
      count: state.count,
      multiplier: state.multiplier,
      previewGain: preview.gain,
      previewNewMultiplier: preview.newMultiplier,
      retentionRate: preview.retentionRate,
      canPrestige: preview.canPrestige,
      warning: preview.warning,
    };
  }

  // ─── 建筑列表 ───────────────────────────────────────────

  /**
   * 组装建筑列表渲染数据（建筑详情面板）
   *
   * 遍历所有建筑定义，输出详细的建筑渲染数据。
   */
  private toBuildingList(e: any): BuildingRenderData[] {
    return BUILDINGS.map((b, idx) => {
      const col = idx % BUILDING_COLS;
      const row = Math.floor(idx / BUILDING_COLS);
      const level = e.bldg.getLevel(b.id);
      const cost = e.bldg.getCost(b.id);
      const unlocked = e.bldg.isUnlocked(b.id);

      // 建筑状态判定
      let state: BuildingRenderData['state'];
      if (level > 0) {
        state = 'producing';
      } else if (unlocked) {
        state = 'idle';
      } else {
        state = 'locked';
      }

      const canUpgrade = unlocked && this.canPayResources(e, cost);

      return {
        id: b.id,
        type: b.id,
        name: b.name,
        level,
        maxLevel: b.maxLevel || 999,
        position: {
          x: col * 200 + 50,
          y: row * 150 + 50,
        },
        size: { width: 180, height: 130 },
        state,
        productionResource: b.productionResource,
        productionRate: level > 0 ? b.baseProduction * level : 0,
        upgradeCost: cost,
        canUpgrade,
        iconAsset: b.icon,
      };
    });
  }

  // ─── 工具方法 ───────────────────────────────────────────

  /**
   * 检查当前资源是否足以支付指定费用
   *
   * @param e - 引擎实例（any）
   * @param cost - 费用映射：资源ID → 数量
   * @returns 是否足以支付
   */
  private canPayResources(e: any, cost: Record<string, number>): boolean {
    return Object.entries(cost).every(
      ([id, amount]) => (e.res[id] || 0) >= amount,
    );
  }
}
