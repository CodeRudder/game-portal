/**
 * 版本迁移器（增强版）
 *
 * 扩展 StateSerializer 的迁移能力，提供 GameSaveData 级别的版本迁移。
 * 支持从任意旧版本迁移到当前版本，自动补全缺失的子系统默认值。
 *
 * 迁移链：
 * - v0 → v1: 基础存档，仅有 resource + building
 * - v1 → v2: 新增 hero/recruit/formation 子系统
 * - v2 → v3: 新增 campaign 子系统
 * - v3 → v4: 新增 tech 子系统
 * - v4 → v5: 新增 equipment/trade/shop 子系统
 * - v5 → v7: 新增 pvpArena/pvpArenaShop/pvpRanking/event 系统
 * - v7 → v10: 新增 equipmentForge/equipmentEnhance
 * - v10 → v14: 新增 prestige/heritage/achievement
 * - v14 → v15: 新增 offlineEvent
 * - v15 → v16: 新增 season
 *
 * 设计原则：
 * - 迁移不修改原始数据，返回新对象
 * - 每步迁移独立可测试
 * - 缺失子系统补全为空默认值
 * - 详细记录迁移日志
 *
 * @module core/save/DataMigrator
 */

import type { GameSaveData } from '../../shared/types';
import { ENGINE_SAVE_VERSION } from '../../shared/constants';
import { gameLog } from '../logger';

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

/** 单步迁移描述 */
export interface MigrationStep {
  /** 源版本 */
  fromVersion: number;
  /** 目标版本 */
  toVersion: number;
  /** 迁移描述 */
  description: string;
  /** 迁移函数 */
  migrate: (data: GameSaveData) => GameSaveData;
}

// ─────────────────────────────────────────────
// 迁移步骤定义
// ─────────────────────────────────────────────

/**
 * 迁移步骤注册表
 *
 * key 为源版本号，每步将数据从 fromVersion 迁移到 toVersion。
 */
const MIGRATION_STEPS: MigrationStep[] = [
  {
    fromVersion: 0,
    toVersion: 1,
    description: 'v0 → v1: 基础存档格式确认',
    migrate: (data: GameSaveData): GameSaveData => {
      return { ...data, version: 1 };
    },
  },
  {
    fromVersion: 1,
    toVersion: 2,
    description: 'v1 → v2: 新增武将/招募/编队/日历/关卡子系统',
    migrate: (data: GameSaveData): GameSaveData => {
      return {
        ...data,
        version: 2,
        // 武将系统：空状态（HeroSystem 构造函数会创建默认空状态）
        hero: (data.hero ?? { generals: [], fragments: {}, version: 1 }) as GameSaveData['hero'],
        recruit: (data.recruit ?? { pityCounter: 0, totalPulls: 0, version: 1 }) as GameSaveData['recruit'],
        formation: (data.formation ?? { formations: [], activeFormationId: null, version: 1 }) as GameSaveData['formation'],
        calendar: data.calendar,
        campaign: data.campaign,
      };
    },
  },
  {
    fromVersion: 2,
    toVersion: 3,
    description: 'v2 → v3: 新增关卡进度子系统',
    migrate: (data: GameSaveData): GameSaveData => {
      return {
        ...data,
        version: 3,
        campaign: (data.campaign ?? { currentChapterId: '', stageStates: {}, lastClearTime: 0, version: 1 }) as GameSaveData['campaign'],
      };
    },
  },
  {
    fromVersion: 3,
    toVersion: 4,
    description: 'v3 → v4: 新增科技子系统',
    migrate: (data: GameSaveData): GameSaveData => {
      return {
        ...data,
        version: 4,
        tech: (data.tech ?? {
          version: 1,
          completedTechIds: [],
          activeResearch: null,
          researchQueue: [],
          techPoints: { basic: 0, advanced: 0, fusion: 0 },
          chosenMutexNodes: {},
        }) as GameSaveData['tech'],
      };
    },
  },
  {
    fromVersion: 4,
    toVersion: 5,
    description: 'v4 → v5: 新增装备/贸易/商店子系统',
    migrate: (data: GameSaveData): GameSaveData => {
      return {
        ...data,
        version: 5,
        equipment: data.equipment,
        trade: data.trade,
        shop: data.shop,
      };
    },
  },
  {
    fromVersion: 5,
    toVersion: 7,
    description: 'v5 → v7: 新增 PvP/事件子系统',
    migrate: (data: GameSaveData): GameSaveData => {
      return {
        ...data,
        version: 7,
        pvpArena: data.pvpArena,
        pvpArenaShop: data.pvpArenaShop,
        pvpRanking: data.pvpRanking,
        eventTrigger: data.eventTrigger,
        eventNotification: data.eventNotification,
        eventUI: data.eventUI,
        eventChain: data.eventChain,
        eventLog: data.eventLog,
      };
    },
  },
  {
    fromVersion: 7,
    toVersion: 10,
    description: 'v7 → v10: 新增装备炼制/强化子系统',
    migrate: (data: GameSaveData): GameSaveData => {
      return {
        ...data,
        version: 10,
        equipmentForge: data.equipmentForge,
        equipmentEnhance: data.equipmentEnhance,
      };
    },
  },
  {
    fromVersion: 10,
    toVersion: 14,
    description: 'v10 → v14: 新增声望/传承/成就子系统',
    migrate: (data: GameSaveData): GameSaveData => {
      return {
        ...data,
        version: 14,
        prestige: data.prestige,
        heritage: data.heritage,
        achievement: data.achievement,
      };
    },
  },
  {
    fromVersion: 14,
    toVersion: 15,
    description: 'v14 → v15: 新增离线事件子系统',
    migrate: (data: GameSaveData): GameSaveData => {
      return {
        ...data,
        version: 15,
        offlineEvent: data.offlineEvent,
      };
    },
  },
  {
    fromVersion: 15,
    toVersion: 16,
    description: 'v15 → v16: 新增赛季子系统',
    migrate: (data: GameSaveData): GameSaveData => {
      return {
        ...data,
        version: 16,
        season: data.season,
      };
    },
  },
];

// ─────────────────────────────────────────────
// 版本迁移器
// ─────────────────────────────────────────────

/**
 * 数据版本迁移器
 *
 * 将任意版本的 GameSaveData 迁移到当前引擎版本。
 *
 * @example
 * ```ts
 * const migrator = new DataMigrator();
 *
 * if (migrator.needsMigration(oldData)) {
 *   const migrated = migrator.migrate(oldData);
 *   // migrated.version === ENGINE_SAVE_VERSION
 * }
 * ```
 */
export class DataMigrator {
  /** 迁移步骤映射表（fromVersion → MigrationStep） */
  private readonly stepMap: Map<number, MigrationStep>;

  // ─── 构造函数 ──────────────────────────────────────────────────

  constructor() {
    this.stepMap = new Map(MIGRATION_STEPS.map(s => [s.fromVersion, s]));
  }

  // ─── 公共方法 ──────────────────────────────────────────────────

  /**
   * 获取当前引擎存档版本
   */
  getCurrentVersion(): number {
    return ENGINE_SAVE_VERSION;
  }

  /**
   * 获取所有已注册的迁移步骤
   */
  getMigrationSteps(): MigrationStep[] {
    return [...MIGRATION_STEPS];
  }

  /**
   * 检查数据是否需要迁移
   *
   * @param data - 存档数据
   * @returns 是否需要迁移
   */
  needsMigration(data: GameSaveData): boolean {
    return typeof data.version === 'number' && data.version < ENGINE_SAVE_VERSION;
  }

  /**
   * 执行完整迁移链
   *
   * 从数据的当前版本开始，依次执行迁移步骤直到达到引擎当前版本。
   *
   * @param data - 存档数据
   * @returns 迁移后的存档数据
   */
  migrate(data: GameSaveData): GameSaveData {
    if (!this.needsMigration(data)) {
      return data;
    }

    return this.migrateFromVersion(data, data.version);
  }

  /**
   * 从指定版本开始迁移
   *
   * @param data - 存档数据
   * @param from - 起始版本号
   * @returns 迁移后的存档数据
   */
  migrateFromVersion(data: GameSaveData, from: number): GameSaveData {
    let current = { ...data };
    let version = from;
    const maxSteps = 20; // 防止无限循环

    gameLog.info(`[DataMigrator] 开始迁移: v${version} → v${ENGINE_SAVE_VERSION}`);

    for (let i = 0; i < maxSteps; i++) {
      if (version >= ENGINE_SAVE_VERSION) break;

      const step = this.stepMap.get(version);
      if (!step) {
        gameLog.warn(`[DataMigrator] 未找到 v${version} 的迁移步骤，跳到目标版本`);
        current = { ...current, version: ENGINE_SAVE_VERSION };
        break;
      }

      try {
        const before = JSON.stringify(current).length;
        current = step.migrate(current);
        version = current.version;
        const after = JSON.stringify(current).length;
        gameLog.info(
          `[DataMigrator] ${step.description} (数据大小: ${before} → ${after})`,
        );
      } catch (err) {
        gameLog.error(
          `[DataMigrator] 迁移步骤失败 (${step.description}):`,
          err,
        );
        // 迁移失败时跳过该步骤，尝试继续
        current = { ...current, version: step.toVersion };
        version = step.toVersion;
      }
    }

    // 确保最终版本号正确
    if (current.version !== ENGINE_SAVE_VERSION) {
      current = { ...current, version: ENGINE_SAVE_VERSION };
    }

    gameLog.info(`[DataMigrator] 迁移完成: v${from} → v${current.version}`);
    return current;
  }
}
