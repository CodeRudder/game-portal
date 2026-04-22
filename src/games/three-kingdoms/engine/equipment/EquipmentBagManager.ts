/**
 * 装备域 — 背包管理器
 *
 * 职责：背包CRUD、排序、筛选、分组、扩容
 * 从 EquipmentSystem 拆分，降低主聚合根行数
 *
 * @module engine/equipment/EquipmentBagManager
 */

import type {
  EquipmentSlot,
  EquipmentRarity,
  EquipmentInstance,
  BagSortMode,
  BagFilter,
  BagOperationResult,
} from '../../core/equipment';
import {
  EQUIPMENT_SLOTS,
  RARITY_ORDER,
} from '../../core/equipment';
import {
  DEFAULT_BAG_CAPACITY,
  MAX_BAG_CAPACITY,
  BAG_EXPAND_INCREMENT,
  BAG_EXPAND_COST,
} from '../../core/equipment';

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

/** 事件发射回调 */
export type EventEmitFn = (event: string, payload: unknown) => void;

/** 模板查询回调（用于套装筛选） */
export type TemplateQueryFn = (templateId: string) => { setId?: string } | undefined;

// ─────────────────────────────────────────────
// EquipmentBagManager
// ─────────────────────────────────────────────

export class EquipmentBagManager {
  /** 背包装备列表 */
  private equipments: Map<string, EquipmentInstance> = new Map();
  /** 背包容量 */
  private bagCapacity: number = DEFAULT_BAG_CAPACITY;
  /** 事件发射回调 */
  private emitEvent: EventEmitFn;
  /** 模板查询回调 */
  private getTemplate: TemplateQueryFn;

  constructor(emitEvent: EventEmitFn, getTemplate: TemplateQueryFn) {
    this.emitEvent = emitEvent;
    this.getTemplate = getTemplate;
  }

  // ─── 背包CRUD ─────────────────────────────

  /** 添加装备到背包 */
  add(equipment: EquipmentInstance): BagOperationResult {
    if (this.equipments.size >= this.bagCapacity) {
      return { success: false, reason: '背包已满' };
    }
    if (this.equipments.has(equipment.uid)) {
      // 幂等：已存在视为成功
      return { success: true };
    }
    this.equipments.set(equipment.uid, equipment);
    this.emitEvent('equipment:added', { uid: equipment.uid });
    return { success: true };
  }

  /** 删除装备（removeFromBag 的别名） */
  remove(uid: string): boolean {
    return this.removeFromBag(uid).success;
  }

  /** 从背包移除装备 */
  removeFromBag(uid: string): BagOperationResult {
    const eq = this.equipments.get(uid);
    if (!eq) return { success: false, reason: '装备不存在' };
    if (eq.isEquipped) return { success: false, reason: '已穿戴装备不可移除' };
    this.equipments.delete(uid);
    this.emitEvent('equipment:removed', { uid });
    return { success: true };
  }

  /** 按UID获取装备 */
  get(uid: string): EquipmentInstance | undefined {
    return this.equipments.get(uid);
  }

  /** 更新装备数据 */
  update(eq: EquipmentInstance): void {
    if (this.equipments.has(eq.uid)) {
      this.equipments.set(eq.uid, eq);
    }
  }

  /** 获取所有装备 */
  getAll(): EquipmentInstance[] {
    return Array.from(this.equipments.values());
  }

  /** 获取装备Map（内部引用，用于序列化） */
  getMap(): Map<string, EquipmentInstance> {
    return this.equipments;
  }

  /** 获取背包已用数量 */
  getUsedCount(): number {
    return this.equipments.size;
  }

  /** 获取背包大小（别名） */
  getSize(): number {
    return this.equipments.size;
  }

  /** 获取背包容量 */
  getCapacity(): number {
    return this.bagCapacity;
  }

  /** 设置背包容量（反序列化用） */
  setCapacity(capacity: number): void {
    this.bagCapacity = capacity;
  }

  /** 背包是否已满 */
  isFull(): boolean {
    return this.equipments.size >= this.bagCapacity;
  }

  /** 扩容背包 */
  expand(): BagOperationResult {
    if (this.bagCapacity >= MAX_BAG_CAPACITY) {
      return { success: false, reason: '已达最大容量' };
    }
    this.emitEvent('equipment:bag_expand_cost', {
      cost: BAG_EXPAND_COST,
      currency: 'copper',
    });
    this.bagCapacity = Math.min(this.bagCapacity + BAG_EXPAND_INCREMENT, MAX_BAG_CAPACITY);
    this.emitEvent('equipment:bag_expanded', { capacity: this.bagCapacity });
    return { success: true };
  }

  // ─── 排序/筛选 ─────────────────────────────

  /** 排序装备 */
  sort(mode: BagSortMode, list?: EquipmentInstance[]): EquipmentInstance[] {
    const sorted = [...(list ?? this.getAll())];
    switch (mode) {
      case 'rarity_desc':
        sorted.sort((a, b) => RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity]);
        break;
      case 'rarity_asc':
        sorted.sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]);
        break;
      case 'level_desc':
        sorted.sort((a, b) => b.enhanceLevel - a.enhanceLevel);
        break;
      case 'level_asc':
        sorted.sort((a, b) => a.enhanceLevel - b.enhanceLevel);
        break;
      case 'slot_type':
        sorted.sort((a, b) => EQUIPMENT_SLOTS.indexOf(a.slot) - EQUIPMENT_SLOTS.indexOf(b.slot));
        break;
      case 'acquired_time':
        sorted.sort((a, b) => a.acquiredAt - b.acquiredAt);
        break;
    }
    return sorted;
  }

  /** 筛选装备 */
  filter(filter: BagFilter): EquipmentInstance[] {
    let list = this.getAll();
    if (filter.slot) list = list.filter(e => e.slot === filter.slot);
    if (filter.rarity) list = list.filter(e => e.rarity === filter.rarity);
    if (filter.unequippedOnly) list = list.filter(e => !e.isEquipped);
    if (filter.setOnly) {
      list = list.filter(e => {
        const tpl = this.getTemplate(e.templateId);
        return tpl?.setId != null;
      });
    }
    return list;
  }

  /** 按部位分组 */
  groupBySlot(): Record<string, EquipmentInstance[]> {
    const groups: Record<string, EquipmentInstance[]> = {
      weapon: [], armor: [], accessory: [], mount: [],
    };
    for (const eq of this.getAll()) {
      groups[eq.slot]?.push(eq);
    }
    return groups;
  }

  // ─── 重置 ─────────────────────────────────

  /** 重置背包 */
  reset(): void {
    this.equipments.clear();
    this.bagCapacity = DEFAULT_BAG_CAPACITY;
  }
}
