/**
 * Panel — 通用面板组件
 * PLAN #20: 打开/关闭/折叠动画，标题栏+内容区
 * 设计规范：水墨江山·铜纹霸业
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import './Panel.css';

export interface PanelProps {
  /** 面板标题 */
  title: string;
  /** 是否显示面板（控制打开/关闭） */
  visible: boolean;
  /** 关闭回调 */
  onClose?: () => void;
  /** 是否可折叠 */
  collapsible?: boolean;
  /** 默认折叠状态 */
  defaultCollapsed?: boolean;
  /** 面板宽度 */
  width?: string;
  /** 面板高度 */
  height?: string;
  /** 自定义类名 */
  className?: string;
  /** 标题栏右侧附加内容 */
  headerExtra?: React.ReactNode;
  /** 面板内容 */
  children: React.ReactNode;
  /** 是否显示遮罩 */
  showOverlay?: boolean;
  /** 遮罩点击关闭 */
  overlayClosable?: boolean;
}

const Panel: React.FC<PanelProps> = ({
  title,
  visible,
  onClose,
  collapsible = false,
  defaultCollapsed = false,
  width,
  height,
  className = '',
  headerExtra,
  children,
  showOverlay = false,
  overlayClosable = true,
}) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const panelRef = useRef<HTMLDivElement>(null);

  // ESC 关闭
  useEffect(() => {
    if (!visible) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [visible, onClose]);

  const handleToggleCollapse = useCallback(() => {
    setCollapsed(prev => !prev);
  }, []);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (overlayClosable && onClose && e.target === e.currentTarget) {
        onClose();
      }
    },
    [overlayClosable, onClose],
  );

  if (!visible) return null;

  const rootClass = [
    'tk-panel-overlay',
    showOverlay ? 'tk-panel-overlay--visible' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass} onClick={showOverlay ? handleOverlayClick : undefined}>
      <div
        ref={panelRef}
        className={`tk-panel ${collapsed ? 'tk-panel--collapsed' : ''}`}
        style={{ width, height }}
        role="region"
        aria-label={title}
      >
        {/* 标题栏 */}
        <div className="tk-panel-header">
          <div className="tk-panel-header-left">
            {collapsible && (
              <button
                className="tk-panel-collapse-btn"
                onClick={handleToggleCollapse}
                aria-label={collapsed ? '展开' : '折叠'}
              >
                <span className={`tk-panel-collapse-icon ${collapsed ? 'tk-panel-collapse-icon--collapsed' : ''}`}>
                  ▼
                </span>
              </button>
            )}
            <h3 className="tk-panel-title">{title}</h3>
          </div>
          <div className="tk-panel-header-right">
            {headerExtra}
            {onClose && (
              <button className="tk-panel-close-btn" onClick={onClose} aria-label="关闭">
                ✕
              </button>
            )}
          </div>
        </div>

        {/* 内容区 */}
        <div className={`tk-panel-content ${collapsed ? 'tk-panel-content--hidden' : ''}`}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default Panel;
