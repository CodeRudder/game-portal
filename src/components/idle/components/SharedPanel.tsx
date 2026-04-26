/**
 * SharedPanel — 共享面板包装组件
 *
 * NEW-R5 审计修复：统一面板的 overlay / header / close / body 结构，
 * 消除各面板重复的弹窗容器代码。
 *
 * 基于已有的 FeaturePanel / Panel / Modal 模式提炼，
 * 提供最小化的 overlay + title + close + ESC + body 容器。
 *
 * 设计规范：水墨江山·铜纹霸业
 *
 * @module components/SharedPanel
 */
import React, { useEffect, useCallback, useRef } from 'react';
import './SharedPanel.css';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

export interface SharedPanelProps {
  /** 是否显示面板 */
  visible: boolean;
  /** 面板标题 */
  title: string;
  /** 标题图标（emoji 或文本） */
  icon?: string;
  /** 关闭回调 */
  onClose?: () => void;
  /** 面板宽度，默认 520px */
  width?: string;
  /** 自定义类名 */
  className?: string;
  /** 是否显示关闭按钮，默认 true */
  showClose?: boolean;
  /** 点击遮罩层是否关闭，默认 true */
  overlayClosable?: boolean;
  /** 标题栏右侧附加内容 */
  headerExtra?: React.ReactNode;
  /** 测试标识 */
  'data-testid'?: string;
  /** 面板内容区域的 testId（默认为 data-testid + '-panel'） */
  'data-testid-panel'?: string;
  /** 面板内容 */
  children: React.ReactNode;
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

const SharedPanel: React.FC<SharedPanelProps> = ({
  visible,
  title,
  icon,
  onClose,
  width = '520px',
  className = '',
  showClose = true,
  overlayClosable = true,
  headerExtra,
  'data-testid': dataTestId,
  'data-testid-panel': dataTestIdPanel,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // ESC 关闭
  useEffect(() => {
    if (!visible) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [visible, onClose]);

  // 焦点管理：面板打开时聚焦容器，方便键盘操作
  useEffect(() => {
    if (!visible || !panelRef.current) return;
    panelRef.current.focus();
  }, [visible]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (overlayClosable && e.target === e.currentTarget) onClose?.();
    },
    [overlayClosable, onClose],
  );

  if (!visible) return null;

  return (
    <div
      className={`tk-shared-panel-overlay ${className}`}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid={dataTestId}
    >
      <div
        ref={panelRef}
        className="tk-shared-panel"
        style={{ '--tk-panel-width': width } as React.CSSProperties}
        tabIndex={-1}
        data-testid={dataTestIdPanel ?? (dataTestId ? `${dataTestId}-panel` : undefined)}
      >
        {/* 标题栏 */}
        <div className="tk-shared-panel-header">
          <div className="tk-shared-panel-title-row">
            {icon && <span className="tk-shared-panel-icon">{icon}</span>}
            <h3 className="tk-shared-panel-title">{title}</h3>
          </div>
          <div className="tk-shared-panel-header-right">
            {headerExtra}
            {showClose && onClose && (
              <button
                className="tk-shared-panel-close"
                onClick={onClose}
                aria-label="关闭面板"
                data-testid={dataTestId ? `${dataTestId}-close` : undefined}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* 内容区 */}
        <div className="tk-shared-panel-body">
          {children}
        </div>
      </div>
    </div>
  );
};

export default SharedPanel;
