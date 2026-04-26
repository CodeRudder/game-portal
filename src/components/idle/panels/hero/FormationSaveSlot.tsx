/**
 * FormationSaveSlot — 阵容收藏
 *
 * 功能：
 * - 保存当前编队方案
 * - 最多3个收藏位（可配置）
 * - 显示方案名称+武将列表缩略
 * - 加载/删除按钮
 *
 * 嵌入位置：编队面板底部保存区域
 *
 * @module components/idle/panels/hero/FormationSaveSlot
 */

import React, { useState, useCallback } from 'react';
import './FormationSaveSlot.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface FormationSlotData {
  /** 方案ID */
  id: string;
  /** 方案名称 */
  name: string;
  /** 武将ID列表 */
  heroIds: string[];
}

export interface FormationSaveSlotProps {
  /** 已保存的方案列表 */
  slots: FormationSlotData[];
  /** 保存回调 */
  onSave: (name: string) => void;
  /** 加载回调 */
  onLoad: (slotId: string) => void;
  /** 删除回调 */
  onDelete: (slotId: string) => void;
  /** 最大收藏位数（默认3） */
  maxSlots?: number;
}

// ─────────────────────────────────────────────
// 子组件：单个收藏位
// ─────────────────────────────────────────────

interface SlotItemProps {
  slot: FormationSlotData;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
}

const SlotItem: React.FC<SlotItemProps> = ({ slot, onLoad, onDelete }) => {
  const handleLoad = useCallback(() => {
    onLoad(slot.id);
  }, [onLoad, slot.id]);

  const handleDelete = useCallback(() => {
    onDelete(slot.id);
  }, [onDelete, slot.id]);

  return (
    <div className="tk-formation-slot__item" data-testid={`formation-slot-${slot.id}`}>
      <div className="tk-formation-slot__item-info">
        <span className="tk-formation-slot__item-name">{slot.name}</span>
        <span className="tk-formation-slot__item-heroes">
          {slot.heroIds.length > 0 ? `武将 x${slot.heroIds.length}` : '空阵容'}
        </span>
      </div>
      <div className="tk-formation-slot__item-actions">
        <button
          className="tk-formation-slot__btn tk-formation-slot__btn--load"
          onClick={handleLoad}
          data-testid={`btn-load-slot-${slot.id}`}
        >
          加载
        </button>
        <button
          className="tk-formation-slot__btn tk-formation-slot__btn--delete"
          onClick={handleDelete}
          data-testid={`btn-delete-slot-${slot.id}`}
        >
          删除
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

const FormationSaveSlot: React.FC<FormationSaveSlotProps> = ({
  slots,
  onSave,
  onLoad,
  onDelete,
  maxSlots = 3,
}) => {
  const [newSlotName, setNewSlotName] = useState('');
  const isFull = slots.length >= maxSlots;
  const canSave = !isFull && newSlotName.trim().length > 0;

  const handleSave = useCallback(() => {
    if (canSave) {
      onSave(newSlotName.trim());
      setNewSlotName('');
    }
  }, [canSave, newSlotName, onSave]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewSlotName(e.target.value);
  }, []);

  return (
    <div
      className="tk-formation-slot"
      role="region"
      aria-label="阵容收藏"
      data-testid="formation-save-slot"
    >
      {/* 标题 */}
      <div className="tk-formation-slot__header">
        <span className="tk-formation-slot__title">💾 阵容收藏</span>
        <span className="tk-formation-slot__count">
          {slots.length}/{maxSlots}
        </span>
      </div>

      {/* 已保存方案列表 */}
      {slots.length > 0 && (
        <div className="tk-formation-slot__list" role="list">
          {slots.map((slot) => (
            <SlotItem key={slot.id} slot={slot} onLoad={onLoad} onDelete={onDelete} />
          ))}
        </div>
      )}

      {/* 空状态 */}
      {slots.length === 0 && (
        <div className="tk-formation-slot__empty">暂无保存的阵容方案</div>
      )}

      {/* 新建方案 */}
      {!isFull && (
        <div className="tk-formation-slot__new">
          <input
            className="tk-formation-slot__input"
            type="text"
            value={newSlotName}
            onChange={handleInputChange}
            placeholder="输入方案名称"
            maxLength={20}
            data-testid="formation-slot-name-input"
          />
          <button
            className="tk-formation-slot__btn tk-formation-slot__btn--save"
            onClick={handleSave}
            disabled={!canSave}
            data-testid="btn-save-formation"
          >
            保存
          </button>
        </div>
      )}

      {/* 已满提示 */}
      {isFull && (
        <div className="tk-formation-slot__full-hint">收藏位已满（{maxSlots}/{maxSlots}）</div>
      )}
    </div>
  );
};

FormationSaveSlot.displayName = 'FormationSaveSlot';

export default FormationSaveSlot;
