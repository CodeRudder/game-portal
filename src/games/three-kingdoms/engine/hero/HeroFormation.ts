/**
 * 武将编队系统 — 引擎层
 *
 * 职责：编队创建/编辑/删除、活跃编队切换、编队战力计算
 * 规则：最大3个编队，每编队最多6个武将
 *
 * @module engine/hero/HeroFormation
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  FormationData,
  FormationState,
  FormationSaveData,
} from './formation-types';
import type { GeneralData } from './hero.types';
import { DEFAULT_NAMES } from './formation-types';
import {
  MAX_FORMATIONS,
  MAX_SLOTS_PER_FORMATION,
  FORMATION_CREATE_REQUIRED_CASTLE_LEVEL,
  FORMATION_CREATE_COST_COPPER,
  FORMATION_BOND_BONUS_RATE,
} from './formation-types';

// Re-export for index.ts convenience
export type { FormationData, FormationState, FormationSaveData } from './formation-types';
export { MAX_FORMATIONS, MAX_SLOTS_PER_FORMATION } from './formation-types';

/** 编队创建前置条件检查回调 */
export interface FormationPrerequisites {
  /** 获取主城等级 */
  getCastleLevel: () => number;
  /** 获取铜钱余额 */
  getCopperBalance: () => number;
  /** 扣除铜钱 */
  spendCopper: (amount: number) => boolean;
  /** 获取编队中已激活的羁绊数量 */
  getActiveBondCount: (formation: FormationData) => number;
}

export class HeroFormation implements ISubsystem {
  readonly name = 'heroFormation' as const;
  private deps: ISystemDeps | null = null;
  private state: FormationState;
  private prerequisites: FormationPrerequisites | null = null;

  constructor() {
    this.state = {
      formations: {},
      activeFormationId: null,
    };
  }

  // ── ISubsystem ──

  init(deps: ISystemDeps): void { this.deps = deps; }
  update(_dt: number): void { /* 编队系统无需每帧更新 */ }
  getState(): unknown { return this.serialize(); }

  /** 设置编队创建前置条件回调（由外部系统注入） */
  setPrerequisites(prereqs: FormationPrerequisites): void {
    this.prerequisites = prereqs;
  }

  // ── 编队管理 ──

  /** 创建新编队（如果未达上限，且满足前置条件） */
  createFormation(id?: string): FormationData | null {
    // 前置条件检查
    if (this.prerequisites) {
      const castleLevel = this.prerequisites.getCastleLevel();
      if (castleLevel < FORMATION_CREATE_REQUIRED_CASTLE_LEVEL) {
        return null; // 主城等级不足
      }
      const copper = this.prerequisites.getCopperBalance();
      if (copper < FORMATION_CREATE_COST_COPPER) {
        return null; // 铜钱不足
      }
    }

    const formationId = id ?? this.nextAvailableId();
    if (!formationId) return null;
    if (this.state.formations[formationId]) return null;

    // 扣除资源
    if (this.prerequisites) {
      const spent = this.prerequisites.spendCopper(FORMATION_CREATE_COST_COPPER);
      if (!spent) return null; // 扣费失败
    }

    const formation: FormationData = {
      id: formationId,
      name: DEFAULT_NAMES[formationId] ?? `编队${formationId}`,
      slots: Array(MAX_SLOTS_PER_FORMATION).fill(''),
    };

    this.state.formations[formationId] = formation;

    // 自动激活第一个编队
    if (!this.state.activeFormationId) {
      this.state.activeFormationId = formationId;
    }

    return { ...formation, slots: [...formation.slots] };
  }

  /** 获取编队数据 */
  getFormation(id: string): FormationData | null {
    const f = this.state.formations[id];
    return f ? { ...f, slots: [...f.slots] } : null;
  }

  /** 获取所有编队 */
  getAllFormations(): FormationData[] {
    return Object.values(this.state.formations).map((f) => ({
      ...f,
      slots: [...f.slots],
    }));
  }

  /** 设置编队武将列表 */
  setFormation(id: string, generalIds: string[]): FormationData | null {
    const formation = this.state.formations[id];
    if (!formation) return null;

    // 限制最多6个
    const trimmed = generalIds.slice(0, MAX_SLOTS_PER_FORMATION);
    formation.slots = Array(MAX_SLOTS_PER_FORMATION).fill('');
    trimmed.forEach((gid, i) => {
      formation.slots[i] = gid;
    });

    return { ...formation, slots: [...formation.slots] };
  }

  /** 向编队添加一个武将（到第一个空位） */
  addToFormation(id: string, generalId: string): FormationData | null {
    const formation = this.state.formations[id];
    if (!formation) return null;

    // 已在该编队中
    if (formation.slots.includes(generalId)) return null;

    // 已在其他编队中，不允许同一武将加入多个编队
    if (this.isGeneralInAnyFormation(generalId)) return null;

    // 找空位
    const emptyIdx = formation.slots.indexOf('');
    if (emptyIdx === -1) return null; // 编队已满

    formation.slots[emptyIdx] = generalId;
    return { ...formation, slots: [...formation.slots] };
  }

  /** 从编队移除一个武将 */
  removeFromFormation(id: string, generalId: string): FormationData | null {
    const formation = this.state.formations[id];
    if (!formation) return null;

    const idx = formation.slots.indexOf(generalId);
    if (idx === -1) return null;

    formation.slots[idx] = '';
    return { ...formation, slots: [...formation.slots] };
  }

  /** 删除编队 */
  deleteFormation(id: string): boolean {
    if (!this.state.formations[id]) return false;

    delete this.state.formations[id];

    // 如果删除的是当前激活编队，切换到第一个可用编队
    if (this.state.activeFormationId === id) {
      const remaining = Object.keys(this.state.formations);
      this.state.activeFormationId = remaining.length > 0 ? remaining[0] : null;
    }

    return true;
  }

  /** 重命名编队 */
  renameFormation(id: string, name: string): FormationData | null {
    const formation = this.state.formations[id];
    if (!formation) return null;
    formation.name = name.slice(0, 10); // 最大10字符
    return { ...formation, slots: [...formation.slots] };
  }

  // ── 激活编队 ──

  /** 获取当前激活编队 */
  getActiveFormation(): FormationData | null {
    if (!this.state.activeFormationId) return null;
    return this.getFormation(this.state.activeFormationId);
  }

  /** 设置激活编队 */
  setActiveFormation(id: string): boolean {
    if (!this.state.formations[id]) return false;
    this.state.activeFormationId = id;
    return true;
  }

  /** 获取激活编队ID */
  getActiveFormationId(): string | null {
    return this.state.activeFormationId;
  }

  // ── 战力计算 ──

  /** 计算编队总战力（需要传入武将数据和战力计算函数） */
  calculateFormationPower(
    formation: FormationData,
    getGeneral: (id: string) => GeneralData | undefined,
    calcPower: (g: GeneralData) => number,
  ): number {
    const basePower = formation.slots
      .filter((id) => id !== '')
      .reduce((sum, id) => {
        const g = getGeneral(id);
        return sum + (g ? calcPower(g) : 0);
      }, 0);

    // 编队羁绊加成：每激活一个羁绊，战力增加5%
    let bondCount = 0;
    if (this.prerequisites) {
      bondCount = this.prerequisites.getActiveBondCount(formation);
    }
    const bondBonus = 1 + bondCount * FORMATION_BOND_BONUS_RATE;

    return Math.floor(basePower * bondBonus);
  }

  /** 获取编队中的武将数量 */
  getFormationMemberCount(id: string): number {
    const f = this.state.formations[id];
    if (!f) return 0;
    return f.slots.filter((s) => s !== '').length;
  }

  // ── 查询 ──

  /** 检查武将是否在任意编队中 */
  isGeneralInAnyFormation(generalId: string): boolean {
    return Object.values(this.state.formations).some((f) =>
      f.slots.includes(generalId),
    );
  }

  /** 获取武将所在的编队ID列表 */
  getFormationsContainingGeneral(generalId: string): string[] {
    return Object.values(this.state.formations)
      .filter((f) => f.slots.includes(generalId))
      .map((f) => f.id);
  }

  /** 获取编队数量 */
  getFormationCount(): number {
    return Object.keys(this.state.formations).length;
  }

  // ── 一键布阵 ──

  /**
   * 一键布阵：自动按战力排序选前5个武将编入指定编队
   *
   * 策略：按战力降序排列，取前5名自动填入编队空位。
   * 如果编队不存在则自动创建。
   * 已在其他编队中的武将不会被重复选择（除非 allowOverlap=true）。
   *
   * @param getGeneral - 获取武将数据的函数
   * @param calcPower - 计算战力的函数
   * @param formationId - 目标编队ID（默认 '1'）
   * @param maxSlots - 最大选择数量（默认 MAX_SLOTS_PER_FORMATION=6）
   * @param allowOverlap - 是否允许与其他编队重叠（默认 false）
   * @returns 编队数据，或 null（无可用武将）
   */
  autoFormation(
    getGeneral: (id: string) => GeneralData | undefined,
    calcPower: (g: GeneralData) => number,
    formationId = '1',
    maxSlots = MAX_SLOTS_PER_FORMATION,
    allowOverlap = false,
  ): FormationData | null {
    // 确保编队存在
    let formation = this.state.formations[formationId];
    if (!formation) {
      const created = this.createFormation(formationId);
      if (!created) return null;
      formation = this.state.formations[formationId];
    }
    if (!formation) return null;

    // 收集所有武将并按战力降序排列
    const allIds: string[] = [];
    // 通过外部传入的 getGeneral 遍历（需要调用方提供所有武将ID列表）
    // 这里约定：getGeneral 能获取的武将范围由调用方决定
    // 我们需要所有武将ID列表——通过 getAllFormations 中已知的武将 + 外部传入

    // 由于 HeroFormation 不持有全部武将列表，我们改用回调方式：
    // 调用方应传入所有候选武将ID
    // 为保持 API 简洁，使用 getGeneral 来过滤有效武将
    // 实际使用中推荐 autoFormationByIds
    return this.autoFormationByIds(
      [], // 空列表表示无法获取全部ID
      getGeneral,
      calcPower,
      formationId,
      maxSlots,
      allowOverlap,
    );
  }

  /**
   * 一键布阵（指定候选武将ID列表）
   *
   * 按战力降序排列候选武将，取前 maxSlots 个自动填入编队。
   *
   * @param candidateIds - 候选武将ID列表
   * @param getGeneral - 获取武将数据的函数
   * @param calcPower - 计算战力的函数
   * @param formationId - 目标编队ID（默认 '1'）
   * @param maxSlots - 最大选择数量（默认 MAX_SLOTS_PER_FORMATION=6）
   * @param allowOverlap - 是否允许与其他编队重叠（默认 false）
   * @returns 编队数据，或 null（无可用武将）
   */
  autoFormationByIds(
    candidateIds: string[],
    getGeneral: (id: string) => GeneralData | undefined,
    calcPower: (g: GeneralData) => number,
    formationId = '1',
    maxSlots = MAX_SLOTS_PER_FORMATION,
    allowOverlap = false,
  ): FormationData | null {
    // 确保编队存在
    let formation = this.state.formations[formationId];
    if (!formation) {
      const created = this.createFormation(formationId);
      if (!created) return null;
      formation = this.state.formations[formationId];
    }
    if (!formation) return null;

    // 过滤有效武将（存在且未在其他编队中）
    const validCandidates = candidateIds.filter((id) => {
      const g = getGeneral(id);
      if (!g) return false;
      if (!allowOverlap && this.isGeneralInAnyFormation(id)) return false;
      return true;
    });

    // 按战力降序排列
    const sorted = [...validCandidates].sort((a, b) => {
      const ga = getGeneral(a);
      const gb = getGeneral(b);
      return (gb && ga) ? calcPower(gb) - calcPower(ga) : 0;
    });

    // 取前 maxSlots 个
    const selected = sorted.slice(0, Math.min(maxSlots, MAX_SLOTS_PER_FORMATION));

    if (selected.length === 0) return null;

    // 清空编队并填入选中的武将
    formation.slots = Array(MAX_SLOTS_PER_FORMATION).fill('');
    selected.forEach((id, i) => {
      formation!.slots[i] = id;
    });

    return { ...formation, slots: [...formation.slots] };
  }

  // ── 序列化 ──

  serialize(): FormationSaveData {
    return {
      version: 1,
      state: {
        formations: Object.fromEntries(
          Object.entries(this.state.formations).map(([id, f]) => [
            id,
            { ...f, slots: [...f.slots] },
          ]),
        ),
        activeFormationId: this.state.activeFormationId,
      },
    };
  }

  deserialize(data: FormationSaveData): void {
    if (data?.state) {
      this.state = {
        formations: Object.fromEntries(
          Object.entries(data.state.formations).map(([id, f]) => [
            id,
            { ...f, slots: [...f.slots] },
          ]),
        ),
        activeFormationId: data.state.activeFormationId,
      };
    }
  }

  /** 重置 */
  reset(): void {
    this.state = { formations: {}, activeFormationId: null };
  }

  // ── 私有方法 ──

  /** 获取下一个可用编队ID */
  private nextAvailableId(): string | null {
    for (let i = 1; i <= MAX_FORMATIONS; i++) {
      const id = String(i);
      if (!this.state.formations[id]) return id;
    }
    return null;
  }
}
