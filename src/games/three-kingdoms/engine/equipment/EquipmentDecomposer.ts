/**
 * 装备域 — 分解与图鉴管理器
 *
 * 从 EquipmentSystem.ts 拆分，降低主聚合根行数。
 * 职责：装备分解（单件/批量/全部分解）、分解奖励计算、图鉴发现与查询
 *
 * @module engine/equipment/EquipmentDecomposer
 */

import type { EquipmentInstance, DecomposeResult, BatchDecomposeResult } from '../../core/equipment/equipment.types';
import type { CodexEntry } from '../../core/equipment/equipment-v10.types';
import type { EquipmentBagManager } from './EquipmentBagManager';

/** 分解基础铜钱 */
const DECOMPOSE_COPPER_BASE: Record<string, number> = {
  white: 100, green: 300, blue: 800, purple: 2000, orange: 5000, red: 12000,
};

/** 分解基础强化石 */
const DECOMPOSE_STONE_BASE: Record<string, number> = {
  white: 1, green: 3, blue: 8, purple: 20, orange: 50, red: 120,
};

/** 强化等级额外奖励系数 */
const DECOMPOSE_ENHANCE_BONUS = 0.1;

/**
 * 装备分解与图鉴管理器
 */
export class EquipmentDecomposer {
  private bag: EquipmentBagManager;
  private codex: Map<string, CodexEntry>;
  private emitEvent: (event: string, payload: unknown) => void;

  constructor(
    bag: EquipmentBagManager,
    codex: Map<string, CodexEntry>,
    emitEvent: (event: string, payload: unknown) => void,
  ) {
    this.bag = bag;
    this.codex = codex;
    this.emitEvent = emitEvent;
  }

  // ── 分解 ──

  /** 计算分解奖励 */
  calculateDecomposeReward(eq: EquipmentInstance): DecomposeResult {
    const enhanceBonus = 1 + eq.enhanceLevel * DECOMPOSE_ENHANCE_BONUS;
    return {
      copper: Math.floor(DECOMPOSE_COPPER_BASE[eq.rarity] * enhanceBonus),
      enhanceStone: Math.floor(DECOMPOSE_STONE_BASE[eq.rarity] * enhanceBonus),
    };
  }

  /** 获取分解预览 */
  getDecomposePreview(uid: string): DecomposeResult | null {
    const eq = this.bag.get(uid);
    if (!eq) return null;
    return this.calculateDecomposeReward(eq);
  }

  /** 分解单件装备 */
  decomposeSingle(uid: string): { success: boolean; result?: DecomposeResult; reason?: string } {
    const eq = this.bag.get(uid);
    if (!eq) return { success: false, reason: '装备不存在' };
    if (eq.isEquipped) return { success: false, reason: '已穿戴装备不可分解' };
    const reward = this.calculateDecomposeReward(eq);
    this.bag.removeFromBag(uid);
    this.emitEvent('equipment:decomposed', { uid, reward });
    return { success: true, result: reward };
  }

  /** 分解装备（单件或批量） */
  decompose(uidOrUids: string | string[]): { success: boolean; result?: DecomposeResult; reason?: string } | BatchDecomposeResult {
    if (Array.isArray(uidOrUids)) return this.batchDecompose(uidOrUids);
    return this.decomposeSingle(uidOrUids);
  }

  /** 批量分解 */
  batchDecompose(uids: string[]): BatchDecomposeResult {
    const total: DecomposeResult = { copper: 0, enhanceStone: 0 };
    const decomposedUids: string[] = [];
    const skippedUids: string[] = [];
    for (const uid of uids) {
      const r = this.decomposeSingle(uid);
      if ('success' in r && r.success && r.result) {
        total.copper += r.result.copper;
        total.enhanceStone += r.result.enhanceStone;
        decomposedUids.push(uid);
      } else { skippedUids.push(uid); }
    }
    return { total, decomposedUids, skippedUids };
  }

  /** 分解所有未穿戴装备 */
  decomposeAllUnequipped(getAllEquipments: () => EquipmentInstance[]): BatchDecomposeResult {
    const uids = getAllEquipments().filter(e => !e.isEquipped).map(e => e.uid);
    return this.batchDecompose(uids);
  }

  // ── 图鉴 ──

  /** 检查图鉴是否已发现 */
  isCodexDiscovered(templateId: string): boolean { return this.codex.has(templateId); }

  /** 获取图鉴条目 */
  getCodexEntry(templateId: string): CodexEntry | null { return this.codex.get(templateId) ?? null; }

  /** 更新图鉴 */
  updateCodex(eq: EquipmentInstance): void {
    if (!this.codex.has(eq.templateId)) {
      this.codex.set(eq.templateId, {
        templateId: eq.templateId,
        discovered: true,
        bestRarity: eq.rarity,
        obtainCount: 1,
      });
    } else {
      const entry = this.codex.get(eq.templateId)!;
      entry.obtainCount++;
      entry.discovered = true;
      const rarityOrder: Record<string, number> = { white: 0, green: 1, blue: 2, purple: 3, orange: 4, red: 5 };
      if (rarityOrder[eq.rarity] > rarityOrder[entry.bestRarity ?? 'white']) {
        entry.bestRarity = eq.rarity;
      }
    }
  }
}
