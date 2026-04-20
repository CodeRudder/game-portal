/**
 * 装备套装系统 — 7套套装效果计算
 *
 * 职责：
 *   - 套装定义查询
 *   - 角色已穿戴套装件数统计
 *   - 套装效果激活判定（2件/4件）
 *   - 套装属性加成聚合
 *
 * @module engine/equipment/EquipmentSetSystem
 */

import type { EquipmentSlot, EquipmentInstance } from '../../core/equipment/equipment.types';
import type { SetId, SetBonusTier, ActiveSetBonus, EquipmentSetDef, SetBonusEffect } from '../../core/equipment/equipment-v10.types';
import { EQUIPMENT_SLOTS } from '../../core/equipment/equipment.types';
import {
  EQUIPMENT_SETS,
  SET_MAP,
  SET_IDS,
  TEMPLATE_MAP,
} from '../../core/equipment/equipment-config';
import type { EquipmentSystem } from './EquipmentSystem';

// ─────────────────────────────────────────────
// EquipmentSetSystem
// ─────────────────────────────────────────────

export class EquipmentSetSystem {
  private readonly equipmentSystem: EquipmentSystem;

  constructor(equipmentSystem: EquipmentSystem) {
    this.equipmentSystem = equipmentSystem;
  }

  // ── 套装定义查询 ──

  /** 获取所有套装定义 */
  getAllSetDefs(): EquipmentSetDef[] {
    return [...EQUIPMENT_SETS];
  }

  /** 获取套装定义 */
  getSetDef(setId: SetId): EquipmentSetDef | undefined {
    return SET_MAP.get(setId);
  }

  /** 获取所有套装ID */
  getAllSetIds(): SetId[] {
    return [...SET_IDS];
  }

  // ── 套装件数统计 ──

  /** 计算角色各套装件数 */
  getSetCounts(heroId: string): Map<SetId, number> {
    const slots = this.equipmentSystem.getHeroEquips(heroId);
    const counts = new Map<SetId, number>();

    for (const slot of EQUIPMENT_SLOTS) {
      const uid = slots[slot];
      if (!uid) continue;
      const eq = this.equipmentSystem.getEquipment(uid);
      if (!eq) continue;
      const template = TEMPLATE_MAP.get(eq.templateId);
      if (!template?.setId) continue;
      counts.set(template.setId, (counts.get(template.setId) ?? 0) + 1);
    }

    return counts;
  }

  // ── 套装效果激活 ──

  /** 获取角色已激活的套装效果 */
  getActiveSetBonuses(heroId: string): ActiveSetBonus[] {
    const counts = this.getSetCounts(heroId);
    const result: ActiveSetBonus[] = [];

    for (const [setId, count] of counts) {
      const setDef = SET_MAP.get(setId);
      if (!setDef) continue;

      const activeTiers: SetBonusTier[] = [];
      const totalBonuses: Record<string, number> = {};

      if (count >= 2) {
        activeTiers.push(2);
        this.mergeBonuses(totalBonuses, setDef.bonus2.bonuses);
      }
      if (count >= 4) {
        activeTiers.push(4);
        this.mergeBonuses(totalBonuses, setDef.bonus4.bonuses);
      }

      if (activeTiers.length > 0) {
        result.push({ setId, count, activeTiers, totalBonuses });
      }
    }

    return result;
  }

  /** 获取角色所有套装加成（聚合） */
  getTotalSetBonuses(heroId: string): Record<string, number> {
    const activeSets = this.getActiveSetBonuses(heroId);
    const total: Record<string, number> = {};
    for (const set of activeSets) {
      this.mergeBonuses(total, set.totalBonuses);
    }
    return total;
  }

  // ── 套装建议 ──

  /** 获取当前最接近激活的套装 */
  getClosestSetBonus(heroId: string): { setId: SetId; current: number; target: number; def: EquipmentSetDef } | null {
    const counts = this.getSetCounts(heroId);
    let best: { setId: SetId; current: number; target: number; def: EquipmentSetDef } | null = null;
    let bestGap = Infinity;

    for (const [setId, count] of counts) {
      const def = SET_MAP.get(setId);
      if (!def) continue;

      // 检查下一个未激活的阈值
      const thresholds: SetBonusTier[] = [2, 4];
      for (const t of thresholds) {
        if (count < t) {
          const gap = t - count;
          if (gap < bestGap) {
            bestGap = gap;
            best = { setId, current: count, target: t, def };
          }
          break; // 只看最近的未激活阈值
        }
      }
    }

    return best;
  }

  /** 获取背包中可凑套装的装备列表 */
  getSetCompletionEquipments(heroId: string): EquipmentInstance[] {
    const counts = this.getSetCounts(heroId);
    const unequipped = this.equipmentSystem.filterEquipments({
      slot: null,
      rarity: null,
      unequippedOnly: true,
      setOnly: true,
    });

    const result: EquipmentInstance[] = [];
    for (const eq of unequipped) {
      const template = TEMPLATE_MAP.get(eq.templateId);
      if (!template?.setId) continue;
      const currentCount = counts.get(template.setId) ?? 0;
      // 如果已有该套装，且凑齐后能激活更高阈值
      if (currentCount > 0 && currentCount < 4) {
        result.push(eq);
      }
    }

    return result;
  }

  // ── 内部工具 ──

  private mergeBonuses(target: Record<string, number>, source: Record<string, number>): void {
    for (const [key, value] of Object.entries(source)) {
      target[key] = (target[key] ?? 0) + value;
    }
  }
}
