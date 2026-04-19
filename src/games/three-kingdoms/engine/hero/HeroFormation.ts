/**
 * 武将编队系统 — 引擎层
 *
 * 职责：编队创建/编辑/删除、活跃编队切换、编队战力计算
 * 规则：最大3个编队，每编队最多6个武将
 *
 * @module engine/hero/HeroFormation
 */

import type { GeneralData } from './hero.types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 最大编队数量 */
export const MAX_FORMATIONS = 3;

/** 每个编队最大武将数 */
export const MAX_SLOTS_PER_FORMATION = 6;

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

/** 编队数据 */
export interface FormationData {
  /** 编队ID（'1' | '2' | '3'） */
  id: string;
  /** 编队名称 */
  name: string;
  /** 武将ID列表（最多6个，空位为空字符串） */
  slots: string[];
}

/** 编队系统状态 */
export interface FormationState {
  /** 所有编队 */
  formations: Record<string, FormationData>;
  /** 当前激活的编队ID */
  activeFormationId: string | null;
}

/** 编队系统存档数据 */
export interface FormationSaveData {
  version: number;
  state: FormationState;
}

// ─────────────────────────────────────────────
// 默认编队名称
// ─────────────────────────────────────────────

const DEFAULT_NAMES: Record<string, string> = {
  '1': '第一队',
  '2': '第二队',
  '3': '第三队',
};

// ─────────────────────────────────────────────
// HeroFormation
// ─────────────────────────────────────────────

/**
 * 武将编队系统
 *
 * 管理编队的创建、编辑、切换和战力计算。
 * 编队中的武将ID需要通过 HeroSystem 校验。
 */
export class HeroFormation {
  private state: FormationState;

  constructor() {
    this.state = {
      formations: {},
      activeFormationId: null,
    };
  }

  // ── 编队管理 ──

  /** 创建新编队（如果未达上限） */
  createFormation(id?: string): FormationData | null {
    const formationId = id ?? this.nextAvailableId();
    if (!formationId) return null;
    if (this.state.formations[formationId]) return null;

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
    return formation.slots
      .filter((id) => id !== '')
      .reduce((sum, id) => {
        const g = getGeneral(id);
        return sum + (g ? calcPower(g) : 0);
      }, 0);
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
