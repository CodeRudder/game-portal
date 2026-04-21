/**
 * FeatureMenu — 功能菜单组件
 *
 * 主界面右上角的"更多功能"入口按钮，点击弹出功能面板。
 * 列出所有已实现但尚未在主Tab栏中展示的功能模块：
 * - 世界地图
 * - 装备背包
 * - 竞技场
 * - 远征
 * - 事件
 * - NPC名册
 *
 * 每个功能项点击后触发回调，由父组件打开对应面板/弹窗。
 *
 * 设计规范：水墨江山·铜纹霸业
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import './FeatureMenu.css';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 功能菜单项定义 */
export interface FeatureMenuItem {
  /** 功能唯一标识 */
  id: string;
  /** 显示图标 */
  icon: string;
  /** 功能名称 */
  label: string;
  /** 简短描述 */
  description?: string;
  /** 是否可用（灰显但可见） */
  available?: boolean;
  /** 角标数字（如未读事件数） */
  badge?: number;
}

export interface FeatureMenuProps {
  /** 菜单项列表 */
  items: FeatureMenuItem[];
  /** 点击菜单项回调 */
  onSelect: (id: string) => void;
  /** 额外类名 */
  className?: string;
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

const FeatureMenu: React.FC<FeatureMenuProps> = ({
  items,
  onSelect,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // ── 点击外部关闭 ──
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // ── ESC 关闭 ──
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open]);

  const handleToggle = useCallback(() => {
    setOpen(prev => !prev);
  }, []);

  const handleSelect = useCallback((id: string) => {
    onSelect(id);
    setOpen(false);
  }, [onSelect]);

  // 计算总角标数
  const totalBadge = items.reduce((sum, item) => sum + (item.badge ?? 0), 0);

  return (
    <div
      ref={menuRef}
      className={`tk-feature-menu ${open ? 'tk-feature-menu--open' : ''} ${className}`.trim()}
    >
      {/* 触发按钮 */}
      <button
        className="tk-feature-menu-trigger"
        onClick={handleToggle}
        aria-label="功能菜单"
        aria-expanded={open}
        aria-haspopup="menu"
        data-testid="feature-menu-trigger"
      >
        <span className="tk-feature-menu-icon">⚔️</span>
        <span className="tk-feature-menu-label">更多</span>
        {/* 角标 */}
        {totalBadge > 0 && (
          <span className="tk-feature-menu-badge" data-testid="feature-menu-badge">
            {totalBadge > 99 ? '99+' : totalBadge}
          </span>
        )}
        {/* 展开箭头 */}
        <span className={`tk-feature-menu-arrow ${open ? 'tk-feature-menu-arrow--up' : ''}`}>
          ▾
        </span>
      </button>

      {/* 下拉面板 */}
      {open && (
        <div
          className="tk-feature-menu-dropdown"
          role="menu"
          aria-label="功能列表"
          data-testid="feature-menu-dropdown"
        >
          <div className="tk-feature-menu-header">
            <span className="tk-feature-menu-header-title">功能大厅</span>
            <span className="tk-feature-menu-header-count">{items.length}项功能</span>
          </div>

          <div className="tk-feature-menu-list">
            {items.map(item => (
              <button
                key={item.id}
                className={`tk-feature-menu-item ${!item.available ? 'tk-feature-menu-item--disabled' : ''}`}
                onClick={() => handleSelect(item.id)}
                role="menuitem"
                disabled={!item.available}
                data-testid={`feature-menu-item-${item.id}`}
              >
                <span className="tk-feature-menu-item-icon">{item.icon}</span>
                <div className="tk-feature-menu-item-info">
                  <span className="tk-feature-menu-item-label">{item.label}</span>
                  {item.description && (
                    <span className="tk-feature-menu-item-desc">{item.description}</span>
                  )}
                </div>
                {/* 角标 */}
                {item.badge && item.badge > 0 ? (
                  <span className="tk-feature-menu-item-badge">{item.badge}</span>
                ) : null}
                {/* 不可用标记 */}
                {!item.available && (
                  <span className="tk-feature-menu-item-locked">🔒</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FeatureMenu;
