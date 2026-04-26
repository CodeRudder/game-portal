/**
 * 武将羁绊系统 — 引擎层
 *
 * 职责：计算编队中激活的羁绊、羁绊系数（第5乘区）
 * 规则：
 *   - 阵营羁绊：编队中同阵营武将达2/3/4人激活对应等级
 *   - 搭档羁绊：编队中包含羁绊所需武将（部分需minRequired人）即激活
 *   - 羁绊等级：由参与武将最低星级决定（1星→Lv1, 3星→Lv2, 5星→Lv3）
 *   - 羁绊系数 = 1 + Σ(激活羁绊的效果值之和 × 羁绊等级倍率)，上限2.0
 *   - 派驻武将效果减半（50%）
 *
 * @module engine/hero/BondSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { Faction } from '../../shared/types';
import {
  FACTION_BONDS,
  PARTNER_BONDS,
  BOND_MULTIPLIER_CAP,
  DISPATCH_FACTOR,
  ACTIVE_FACTOR,
  BondType,
} from './bond-config';
import {
  getBondLevelByMinStar,
  getBondLevelMultiplier,
} from './bond-config';
import type {
  FactionBondDefinition,
  PartnerBondDefinition,
  BondEffect,
} from './bond-config';

// ─────────────────────────────────────────────
// 1. 运行时类型
// ─────────────────────────────────────────────

/** 激活的羁绊信息 */
export interface ActiveBond {
  /** 羁绊ID */
  bondId: string;
  /** 羁绊名称 */
  name: string;
  /** 羁绊类型 */
  type: BondType;
  /** 羁绊等级（1/2/3） */
  level: number;
  /** 等级效果倍率 */
  levelMultiplier: number;
  /** 实际生效的效果列表（已乘等级倍率） */
  effects: ReadonlyArray<BondEffect>;
  /** 参与的武将ID列表 */
  participants: ReadonlyArray<string>;
  /** 派驻系数（0.5~1.0，基于参与武将中派驻占比） */
  dispatchFactor: number;
}

/** 武将元信息（供 BondSystem 查询） */
export interface GeneralMeta {
  /** 武将ID */
  id: string;
  /** 阵营 */
  faction: Faction;
  /** 星级 */
  star: number;
  /** 是否为上阵状态（true=上阵, false=派驻） */
  isActive: boolean;
}

/** BondSystem 依赖的回调接口 */
export interface BondSystemDeps {
  /** 获取武将元信息（阵营、星级、是否上阵） */
  getGeneralMeta: (generalId: string) => GeneralMeta | undefined;
}

// ─────────────────────────────────────────────
// 2. 羁绊事件载荷类型（R8 新增）
// ─────────────────────────────────────────────

/** 羁绊激活事件载荷 */
export interface BondActivatedPayload {
  /** 激活的羁绊ID */
  bondId: string;
  /** 羁绊名称 */
  name: string;
  /** 羁绊类型 */
  type: BondType;
  /** 羁绊等级 */
  level: number;
  /** 参与的武将ID列表 */
  participants: ReadonlyArray<string>;
  /** 所属编队武将ID列表 */
  formationIds: ReadonlyArray<string>;
}

/** 羁绊失效事件载荷 */
export interface BondDeactivatedPayload {
  /** 失效的羁绊ID */
  bondId: string;
  /** 羁绊名称 */
  name: string;
  /** 羁绊类型 */
  type: BondType;
  /** 失效前的羁绊等级（用于 UI 显示"XX羁绊Lv3已失效"） */
  lastLevel: number;
  /** 所属编队武将ID列表 */
  formationIds: ReadonlyArray<string>;
}

/** 羁绊升级事件载荷 */
export interface BondLevelUpPayload {
  /** 羁绊ID */
  bondId: string;
  /** 羁绊名称 */
  name: string;
  /** 羁绊类型 */
  type: BondType;
  /** 旧等级 */
  previousLevel: number;
  /** 新等级 */
  newLevel: number;
  /** 参与的武将ID列表 */
  participants: ReadonlyArray<string>;
  /** 所属编队武将ID列表 */
  formationIds: ReadonlyArray<string>;
}

// ─────────────────────────────────────────────
// 2. BondSystem 类
// ─────────────────────────────────────────────

/**
 * 武将羁绊系统
 *
 * 独立子系统，计算编队中激活的羁绊及羁绊系数。
 * 羁绊系数作为战力公式的第5个独立乘区。
 */
export class BondSystem implements ISubsystem {
  readonly name = 'bond' as const;
  private deps: ISystemDeps | null = null;
  private bondDeps: BondSystemDeps | null = null;
  /** 上一次评估的羁绊快照（bondId → ActiveBond），用于事件去重 */
  private previousBonds: Map<string, ActiveBond> = new Map();

  /** 防抖窗口（毫秒），0 表示禁用防抖 */
  private debounceMs: number = 0;

  /** 防抖定时器 */
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // 无状态子系统，每次调用实时计算
  }

  // ── ISubsystem ──

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  /** 注入羁绊系统专用依赖 */
  initBondDeps(bondDeps: BondSystemDeps): void {
    this.bondDeps = bondDeps;
  }

  update(_dt: number): void { /* 羁绊系统无需每帧更新 */ }
  getState(): unknown { return {}; }

  // ── 核心计算 ──

  /**
   * 计算编队中激活的所有羁绊
   *
   * @param generalIds - 编队中的武将ID列表
   * @returns 激活的羁绊列表
   */
  calculateBonds(generalIds: string[]): ActiveBond[] {
    if (!this.bondDeps) return [];
    const bonds: ActiveBond[] = [];

    // 1. 收集武将元信息
    const metas = this.collectMetas(generalIds);
    if (metas.length === 0) return [];

    // 2. 计算阵营羁绊
    const factionBonds = this.calculateFactionBonds(metas);
    bonds.push(...factionBonds);

    // 3. 计算搭档羁绊
    const partnerBonds = this.calculatePartnerBonds(metas, generalIds);
    bonds.push(...partnerBonds);

    return bonds;
  }

  /**
   * 获取羁绊总系数
   *
   * 羁绊系数 = 1 + Σ(所有激活羁绊的效果值之和 × 等级倍率 × 派驻系数)
   * 上限为 BOND_MULTIPLIER_CAP (2.0)
   *
   * **NaN/Infinity 防护（R9 新增）**：
   * 当输入或计算过程中出现非有限数值时，返回安全默认值 1.0。
   *
   * @param generalIds - 编队中的武将ID列表
   * @returns 羁绊系数（1.0 ~ 2.0）
   */
  getBondMultiplier(generalIds: string[]): number {
    const bonds = this.calculateBonds(generalIds);
    if (bonds.length === 0) return 1.0;

    let totalBonus = 0;
    for (const bond of bonds) {
      // NaN/Infinity 防护：跳过非有限的羁绊
      if (!Number.isFinite(bond.levelMultiplier) || !Number.isFinite(bond.dispatchFactor)) {
        continue;
      }
      const effectSum = bond.effects.reduce((sum, e) => {
        const v = Number.isFinite(e.value) ? e.value : 0;
        return sum + v;
      }, 0);
      totalBonus += effectSum * bond.levelMultiplier * bond.dispatchFactor;
    }

    // NaN/Infinity 防护：totalBonus 非有限时返回默认值 1.0
    if (!Number.isFinite(totalBonus)) return 1.0;

    // 羁绊系数 = 1 + 总加成，上限 BOND_MULTIPLIER_CAP
    const result = Math.min(1 + totalBonus, BOND_MULTIPLIER_CAP);
    return Number.isFinite(result) ? result : 1.0;
  }

  /**
   * 获取激活羁绊详情（calculateBonds 的别名，语义更清晰）
   */
  getActiveBonds(generalIds: string[]): ActiveBond[] {
    return this.calculateBonds(generalIds);
  }

  // ── 羁绊事件系统（R8 新增） ──

  /**
   * 评估编队羁绊变化并触发事件
   *
   * 对比上一次评估结果，检测羁绊激活/失效/升级变化，
   * 通过事件总线发布对应事件。
   *
   * **去重机制（R9 新增）**：
   * 只有羁绊状态真正变化时才触发事件：
   * - 新羁绊出现 → `bond:activated`
   * - 已有羁绊消失 → `bond:deactivated`
   * - 羁绊等级提升 → `bond:levelUp`
   * - 羁绊等级不变、参与者不变 → 不触发任何事件
   *
   * **防抖机制（R9 新增）**：
   * 通过 `debounceMs` 配置，在指定时间窗口内的重复调用会被合并，
   * 仅在窗口结束时执行一次评估。适用于快速编队切换场景。
   *
   * 触发的事件：
   * - `bond:activated` — 新羁绊激活
   * - `bond:deactivated` — 已有羁绊失效
   * - `bond:levelUp` — 羁绊等级提升
   *
   * @param generalIds - 编队中的武将ID列表
   */
  evaluateAndEmit(generalIds: string[]): void {
    if (!this.deps) return;

    // 防抖：如果配置了 debounceMs 且在窗口内，则延迟执行
    if (this.debounceMs > 0) {
      this.scheduleDebounced(generalIds);
      return;
    }

    this.doEvaluateAndEmit(generalIds);
  }

  /**
   * 立即执行评估并触发事件（跳过防抖）
   *
   * 适用于测试场景或需要立即反馈的场景。
   *
   * @param generalIds - 编队中的武将ID列表
   */
  evaluateAndEmitImmediate(generalIds: string[]): void {
    this.doEvaluateAndEmit(generalIds);
  }

  /**
   * 配置防抖参数
   *
   * @param debounceMs - 防抖窗口（毫秒），0 表示禁用防抖
   */
  setDebounce(debounceMs: number): void {
    this.debounceMs = Number.isFinite(debounceMs) && debounceMs >= 0 ? debounceMs : 0;
    if (this.debounceMs === 0 && this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /** 内部：执行评估并触发事件 */
  private doEvaluateAndEmit(generalIds: string[]): void {
    if (!this.deps) return;

    const currentBonds = this.calculateBonds(generalIds);
    const currentMap = new Map<string, ActiveBond>();
    for (const bond of currentBonds) {
      currentMap.set(bond.bondId, bond);
    }

    // 检测失效羁绊（previous 有，current 无）
    for (const [bondId, prevBond] of this.previousBonds) {
      if (!currentMap.has(bondId)) {
        this.deps.eventBus.emit<BondDeactivatedPayload>('bond:deactivated', {
          bondId: prevBond.bondId,
          name: prevBond.name,
          type: prevBond.type,
          lastLevel: prevBond.level,
          formationIds: generalIds,
        });
      }
    }

    // 检测激活和升级（去重：仅等级真正提升时才触发 levelUp）
    for (const [bondId, currBond] of currentMap) {
      const prevBond = this.previousBonds.get(bondId);
      if (!prevBond) {
        // 新激活
        this.deps.eventBus.emit<BondActivatedPayload>('bond:activated', {
          bondId: currBond.bondId,
          name: currBond.name,
          type: currBond.type,
          level: currBond.level,
          participants: currBond.participants,
          formationIds: generalIds,
        });
      } else if (currBond.level > prevBond.level) {
        // 等级提升（去重：等级不变不触发）
        this.deps.eventBus.emit<BondLevelUpPayload>('bond:levelUp', {
          bondId: currBond.bondId,
          name: currBond.name,
          type: currBond.type,
          previousLevel: prevBond.level,
          newLevel: currBond.level,
          participants: currBond.participants,
          formationIds: generalIds,
        });
      }
      // else: 羁绊已存在且等级未变 → 不触发事件（去重）
    }

    // 更新快照
    this.previousBonds = currentMap;
  }

  /** 内部：防抖调度 */
  private scheduleDebounced(generalIds: string[]): void {
    // 快照当前 generalIds，避免闭包引用变化
    const snapshot = [...generalIds];
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.doEvaluateAndEmit(snapshot);
    }, this.debounceMs);
  }

  /**
   * 获取上一次评估的羁绊快照（只读）
   *
   * 用于测试和调试，返回上一次 evaluateAndEmit 调用后的羁绊状态。
   */
  getPreviousBonds(): ReadonlyMap<string, ActiveBond> {
    return this.previousBonds;
  }

  /**
   * 判断指定羁绊是否激活
   *
   * @param bondId - 羁绊ID
   * @param generalIds - 编队中的武将ID列表
   */
  isBondActive(bondId: string, generalIds: string[]): boolean {
    const bonds = this.calculateBonds(generalIds);
    return bonds.some((b) => b.bondId === bondId);
  }

  // ── 阵营羁绊计算 ──

  /**
   * 计算阵营羁绊
   *
   * 按阵营分组统计人数，匹配最高激活的等级门槛
   */
  private calculateFactionBonds(metas: GeneralMeta[]): ActiveBond[] {
    const bonds: ActiveBond[] = [];

    // 按阵营分组
    const factionGroups = this.groupByFaction(metas);

    for (const bondDef of FACTION_BONDS) {
      const group = factionGroups.get(bondDef.faction);
      if (!group || group.length === 0) continue;

      const count = group.length;

      // 找到最高匹配的 tier（tiers 按 requiredCount 升序）
      let matchedTier: typeof bondDef.tiers[number] | null = null;
      for (const tier of bondDef.tiers) {
        if (count >= tier.requiredCount) {
          matchedTier = tier;
        }
      }

      if (!matchedTier) continue;

      // 计算羁绊等级（基于参与武将最低星级）
      const minStar = Math.min(...group.map((m) => m.star));
      const level = getBondLevelByMinStar(minStar);
      const levelMultiplier = getBondLevelMultiplier(level);

      // 计算派驻系数
      const dispatchFactor = this.calcDispatchFactor(group);

      bonds.push({
        bondId: bondDef.id,
        name: bondDef.name,
        type: BondType.FACTION,
        level,
        levelMultiplier,
        effects: matchedTier.effects,
        participants: group.map((m) => m.id),
        dispatchFactor,
      });
    }

    return bonds;
  }

  // ── 搭档羁绊计算 ──

  /**
   * 计算搭档羁绊
   *
   * 检查编队中是否包含搭档羁绊所需的武将（至少minRequired人）
   */
  private calculatePartnerBonds(
    metas: GeneralMeta[],
    generalIds: string[],
  ): ActiveBond[] {
    const bonds: ActiveBond[] = [];
    const idSet = new Set(generalIds);

    for (const bondDef of PARTNER_BONDS) {
      // 找出编队中包含的搭档武将
      const matched = bondDef.generalIds.filter((gid) => idSet.has(gid));

      // 需要达到最低人数要求
      if (matched.length < bondDef.minRequired) continue;

      // 获取匹配武将的元信息
      const matchedMetas = matched
        .map((id) => metas.find((m) => m.id === id))
        .filter((m): m is GeneralMeta => m !== undefined);

      // 计算羁绊等级（基于匹配武将最低星级）
      const minStar = Math.min(...matchedMetas.map((m) => m.star));
      const level = getBondLevelByMinStar(minStar);
      const levelMultiplier = getBondLevelMultiplier(level);

      // 计算派驻系数
      const dispatchFactor = this.calcDispatchFactor(matchedMetas);

      bonds.push({
        bondId: bondDef.id,
        name: bondDef.name,
        type: BondType.PARTNER,
        level,
        levelMultiplier,
        effects: bondDef.effects,
        participants: matched,
        dispatchFactor,
      });
    }

    return bonds;
  }

  // ── 辅助方法 ──

  /** 收集武将元信息 */
  private collectMetas(generalIds: string[]): GeneralMeta[] {
    if (!this.bondDeps) return [];
    const metas: GeneralMeta[] = [];
    for (const id of generalIds) {
      const meta = this.bondDeps.getGeneralMeta(id);
      if (meta) metas.push(meta);
    }
    return metas;
  }

  /** 按阵营分组 */
  private groupByFaction(metas: GeneralMeta[]): Map<Faction, GeneralMeta[]> {
    const groups = new Map<Faction, GeneralMeta[]>();
    for (const meta of metas) {
      const group = groups.get(meta.faction) ?? [];
      group.push(meta);
      groups.set(meta.faction, group);
    }
    return groups;
  }

  /**
   * 计算派驻系数
   *
   * 上阵武将系数1.0，派驻武将系数0.5
   * 综合系数 = Σ(各武将系数) / 武将总数
   */
  private calcDispatchFactor(participants: GeneralMeta[]): number {
    if (participants.length === 0) return ACTIVE_FACTOR;
    const totalFactor = participants.reduce(
      (sum, m) => sum + (m.isActive ? ACTIVE_FACTOR : DISPATCH_FACTOR),
      0,
    );
    return totalFactor / participants.length;
  }

  /** 重置 */
  reset(): void {
    this.bondDeps = null;
    this.previousBonds.clear();
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}
