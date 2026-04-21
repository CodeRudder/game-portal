/**
 * FeaturePanel — 功能面板弹窗容器
 *
 * 用于承载功能菜单中各功能的弹窗面板。
 * 提供统一的标题栏、关闭按钮和内容区域。
 *
 * 设计规范：水墨江山·铜纹霸业
 */

import React, { useEffect, useCallback, useRef } from 'react';
import './FeaturePanel.css';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

export interface FeaturePanelProps {
  /** 是否显示 */
  visible: boolean;
  /** 面板标题 */
  title: string;
  /** 标题图标 */
  icon?: string;
  /** 面板宽度 */
  width?: string;
  /** 关闭回调 */
  onClose: () => void;
  /** 面板内容 */
  children: React.ReactNode;
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

const FeaturePanel: React.FC<FeaturePanelProps> = ({
  visible,
  title,
  icon,
  width,
  onClose,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // ESC 关闭
  useEffect(() => {
    if (!visible) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [visible, onClose]);

  // 焦点管理
  useEffect(() => {
    if (!visible || !panelRef.current) return;
    panelRef.current.focus();
  }, [visible]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  if (!visible) return null;

  return (
    <div
      className="tk-feature-panel-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={panelRef}
        className="tk-feature-panel"
        style={width ? { width } : undefined}
        tabIndex={-1}
      >
        {/* 标题栏 */}
        <div className="tk-feature-panel-header">
          <div className="tk-feature-panel-title-row">
            {icon && <span className="tk-feature-panel-icon">{icon}</span>}
            <h3 className="tk-feature-panel-title">{title}</h3>
          </div>
          <button
            className="tk-feature-panel-close"
            onClick={onClose}
            aria-label="关闭面板"
          >
            ✕
          </button>
        </div>

        {/* 内容区 */}
        <div className="tk-feature-panel-body">
          {children}
        </div>
      </div>
    </div>
  );
};

export default FeaturePanel;
