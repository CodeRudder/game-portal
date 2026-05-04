/**
 * 兵营编队管理系统 — 引擎层
 *
 * 职责：兵营编队的创建/删除、兵力分配/回收、兵种配置、编队解锁
 * 规则：
 *   - 编队1默认解锁
 *   - 编队2需兵营Lv10
 *   - 编队3需兵营Lv20
 *   - 兵力从全局资源池分配到编队，移除时返还资源池
 *
 * 与 HeroFormation 是平行关系，互不依赖。
 *
 * @module engine/barracks/BarracksFormationSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types/subsystem';
import type {
  BarracksFormation,
  BarracksFormationState,
  BarracksFormationSaveData,
  TroopType,
  TrainingMode,
  TrainingResult,
} from './barracks.types';
import {
  MAX_BARRACKS_FORMATIONS,
  FORMATION_1_UNLOCK_LEVEL,
  FORMATION_2_UNLOCK_LEVEL,
  FORMATION_3_UNLOCK_LEVEL,
  DEFAULT_FORMATION_NAMES,
} from './barracks.types';

// Re-export for convenience
export type {
  BarracksFormation,
  BarracksFormationState,
  BarracksFormationSaveData,
  TroopType,
  TrainingMode,
  TrainingResult,
} from './barracks.types';
export {
  MAX_BARRACKS_FORMATIONS,
  FORMATION_1_UNLOCK_LEVEL,
  FORMATION_2_UNLOCK_LEVEL,
  FORMATION_3_UNLOCK_LEVEL,
} from './barracks.types';

/** 编队解锁所需兵营等级映射 */
const FORMATION_UNLOCK_LEVELS: Record<number, number> = {
  1: FORMATION_1_UNLOCK_LEVEL,
  2: FORMATION_2_UNLOCK_LEVEL,
  3: FORMATION_3_UNLOCK_LEVEL,
};

/** 资源池接口 — 由外部注入 */
export interface BarracksResourcePool {
  /** 获取资源池中可用兵力数量 */
  getTroops: () => number;
  /** 从资源池扣除兵力（分配到编队），成功返回true */
  spendTroops: (amount: number) => boolean;
  /** 将兵力返还资源池（从编队移除） */
  returnTroops: (amount: number) => void;
}

export class BarracksFormationSystem implements ISubsystem {
  readonly name = 'barracksFormation' as const;

  private deps: ISystemDeps | null = null;
  private state: BarracksFormationState;
  private barracksLevel: number = 1;
  private resourcePool: BarracksResourcePool | null = null;
  /** 自增ID计数器 */
  private nextFormationIndex: number = 1;

  constructor() {
    this.state = {
      formations: {},
    };
  }

  // ── ISubsystem ──

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    // 兵营编队系统无需每帧更新
  }

  getState(): unknown {
    return this.serialize();
  }

  reset(): void {
    this.state = { formations: {} };
    this.barracksLevel = 1;
    this.resourcePool = null;
    this.nextFormationIndex = 1;
  }

  // ── 初始化配置 ──

  /**
   * 配置兵营编队系统（简便方式）
   *
   * @param barracksLevel - 兵营等级
   * @param getTroops - 获取资源池可用兵力
   * @param spendTroops - 从资源池扣除兵力
   */
  setup(
    barracksLevel: number,
    getTroops: () => number,
    spendTroops: (n: number) => boolean,
  ): void {
    this.barracksLevel = Math.max(1, Math.floor(barracksLevel));
    this.resourcePool = {
      getTroops,
      spendTroops,
      returnTroops: () => {
        // 简便方式不支持返还，请使用 initWithPool 注入完整资源池
      },
    };
  }

  /**
   * 使用 BarracksResourcePool 初始化（推荐方式）
   */
  initWithPool(barracksLevel: number, pool: BarracksResourcePool): void {
    this.barracksLevel = Math.max(1, Math.floor(barracksLevel));
    this.resourcePool = pool;
  }

  // ── 编队管理 ──

  /**
   * 创建新编队
   *
   * 编队1默认解锁，编队2需兵营Lv10，编队3需兵营Lv20。
   *
   * @param name - 编队名称（可选，默认使用 "第N营"）
   * @param commander - 主将ID（可选）
   * @param troopType - 兵种类型（默认 infantry）
   * @returns 创建结果
   */
  createFormation(
    name?: string,
    commander?: string,
    troopType: TroopType = 'infantry',
  ): { success: boolean; formationId?: string; reason?: string } {
    // 检查编队数量上限
    const currentCount = Object.keys(this.state.formations).length;
    const maxFormations = this.getMaxFormations();

    if (currentCount >= maxFormations) {
      return {
        success: false,
        reason: `编队已满（上限${maxFormations}个），需提升兵营等级解锁更多编队`,
      };
    }

    // 分配下一个可用编队ID
    const formationId = this.allocateNextFormationId();
    if (formationId === null) {
      return {
        success: false,
        reason: '无可用编队槽位',
      };
    }

    // 检查该编队ID是否已解锁
    const requiredLevel = FORMATION_UNLOCK_LEVELS[Number(formationId)] ?? 999;
    if (this.barracksLevel < requiredLevel) {
      return {
        success: false,
        reason: `编队${formationId}需要兵营等级${requiredLevel}，当前等级${this.barracksLevel}`,
      };
    }

    const formationName = name ?? DEFAULT_FORMATION_NAMES[formationId] ?? `编队${formationId}`;

    const formation: BarracksFormation = {
      id: formationId,
      name: formationName,
      commander: commander ?? '',
      troops: 0,
      troopType,
      heroes: [],
    };

    this.state.formations[formationId] = formation;

    return {
      success: true,
      formationId,
    };
  }

  /**
   * 删除编队（兵力自动返还资源池）
   */
  deleteFormation(formationId: string): { success: boolean; reason?: string } {
    const formation = this.state.formations[formationId];
    if (!formation) {
      return { success: false, reason: `编队${formationId}不存在` };
    }

    // 返还兵力到资源池
    if (formation.troops > 0 && this.resourcePool) {
      this.resourcePool.returnTroops(formation.troops);
    }

    delete this.state.formations[formationId];
    return { success: true };
  }

  // ── 兵力分配 ──

  /**
   * 从资源池分配兵力到编队
   *
   * @param formationId - 编队ID
   * @param amount - 分配数量
   */
  assignTroops(formationId: string, amount: number): { success: boolean; reason?: string } {
    // 参数校验
    if (amount <= 0) {
      return { success: false, reason: '分配兵力必须大于0' };
    }

    const formation = this.state.formations[formationId];
    if (!formation) {
      return { success: false, reason: `编队${formationId}不存在` };
    }

    if (!this.resourcePool) {
      return { success: false, reason: '资源池未初始化' };
    }

    // 检查资源池兵力是否充足
    const available = this.resourcePool.getTroops();
    if (available < amount) {
      return {
        success: false,
        reason: `兵力不足（需要${amount}，可用${available}）`,
      };
    }

    // 从资源池扣除
    const spent = this.resourcePool.spendTroops(amount);
    if (!spent) {
      return { success: false, reason: '兵力扣除失败' };
    }

    // 增加编队兵力
    formation.troops += amount;

    return { success: true };
  }

  /**
   * 从编队移除兵力并返还资源池
   *
   * @param formationId - 编队ID
   * @param amount - 移除数量
   */
  removeTroops(formationId: string, amount: number): { success: boolean; reason?: string } {
    // 参数校验
    if (amount <= 0) {
      return { success: false, reason: '移除兵力必须大于0' };
    }

    const formation = this.state.formations[formationId];
    if (!formation) {
      return { success: false, reason: `编队${formationId}不存在` };
    }

    if (formation.troops < amount) {
      return {
        success: false,
        reason: `编队兵力不足（编队有${formation.troops}，请求移除${amount}）`,
      };
    }

    // 返还资源池
    if (this.resourcePool) {
      this.resourcePool.returnTroops(amount);
    }

    // 减少编队兵力
    formation.troops -= amount;

    return { success: true };
  }

  // ── 兵种配置 ──

  /**
   * 切换编队兵种类型
   *
   * @param formationId - 编队ID
   * @param troopType - 新兵种类型
   */
  changeTroopType(formationId: string, troopType: TroopType): boolean {
    const formation = this.state.formations[formationId];
    if (!formation) {
      return false;
    }

    formation.troopType = troopType;
    return true;
  }

  // ── 查询 ──

  /**
   * 获取指定编队
   */
  getFormation(id: string): BarracksFormation | null {
    return this.state.formations[id] ?? null;
  }

  /**
   * 获取所有编队
   */
  getAllFormations(): BarracksFormation[] {
    return Object.values(this.state.formations);
  }

  /**
   * 获取当前编队数量上限（根据兵营等级）
   *
   * - 兵营Lv1~9:  最多1个编队
   * - 兵营Lv10~19: 最多2个编队
   * - 兵营Lv20+:   最多3个编队
   */
  getMaxFormations(): number {
    if (this.barracksLevel >= FORMATION_3_UNLOCK_LEVEL) return 3;
    if (this.barracksLevel >= FORMATION_2_UNLOCK_LEVEL) return 2;
    return 1;
  }

  /**
   * 获取所有编队中的总兵力
   */
  getTotalTroopsInFormations(): number {
    return Object.values(this.state.formations).reduce(
      (sum, f) => sum + f.troops,
      0,
    );
  }

  /**
   * 获取兵营等级
   */
  getBarracksLevel(): number {
    return this.barracksLevel;
  }

  // ── 序列化 ──

  /**
   * 序列化为JSON字符串
   */
  serialize(): string {
    const saveData: BarracksFormationSaveData = {
      version: 1,
      state: {
        formations: { ...this.state.formations },
      },
    };
    return JSON.stringify(saveData);
  }

  /**
   * 从JSON字符串反序列化
   */
  deserialize(data: string): void {
    try {
      const saveData: BarracksFormationSaveData = JSON.parse(data);
      if (saveData.version === 1 && saveData.state) {
        this.state = {
          formations: saveData.state.formations,
        };
        // 重建 nextFormationIndex
        const existingIds = Object.keys(this.state.formations).map(Number).sort();
        this.nextFormationIndex = existingIds.length > 0
          ? existingIds[existingIds.length - 1] + 1
          : 1;
      }
    } catch {
      // 反序列化失败时保持当前状态不变
    }
  }

  // ── 内部方法 ──

  /**
   * 分配下一个可用的编队ID
   *
   * 按顺序查找 '1', '2', '3' 中第一个未被占用且已解锁的ID
   */
  private allocateNextFormationId(): string | null {
    for (let i = 1; i <= MAX_BARRACKS_FORMATIONS; i++) {
      const id = String(i);
      if (!this.state.formations[id]) {
        const requiredLevel = FORMATION_UNLOCK_LEVELS[i] ?? 999;
        if (this.barracksLevel >= requiredLevel) {
          return id;
        }
      }
    }
    return null;
  }
}
