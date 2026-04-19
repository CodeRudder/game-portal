/**
 * 三国霸业 — 通用面板组件
 *
 * 可折叠的侧滑面板，用于建筑详情、武将信息等场景。
 * 遵循 PRD：右侧滑入 300ms ease-out，ESC 关闭，遮罩关闭。
 *
 * @module ui/components/Panel
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface PanelProps {
  /** 面板标题 */
  title: string;
  /** 是否打开（受控） */
  isOpen?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
  /** 是否可折叠（显示折叠/展开按钮） */
  collapsible?: boolean;
  /** 初始是否折叠 */
  defaultCollapsed?: boolean;
  /** 额外类名 */
  className?: string;
  /** 面板内容 */
  children: React.ReactNode;
}

/**
 * Panel — 通用面板组件
 *
 * @example
 * ```tsx
 * <Panel title="建筑详情" isOpen={open} onClose={() => setOpen(false)} collapsible>
 *   <BuildingDetail building={currentBuilding} />
 * </Panel>
 * ```
 */
export function Panel({
  title,
  isOpen = true,
  onClose,
  collapsible = false,
  defaultCollapsed = false,
  className = '',
  children,
}: PanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const panelRef = useRef<HTMLDivElement>(null);

  // ESC 关闭
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && onClose) {
        e.preventDefault();
        onClose();
      }
    },
    [isOpen, onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const toggleCollapse = useCallback(() => setCollapsed((v) => !v), []);

  // 遮罩点击关闭
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && onClose) onClose();
    },
    [onClose],
  );

  // 焦点管理：面板打开时聚焦首个可交互元素
  useEffect(() => {
    if (isOpen && panelRef.current) {
      const el = panelRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      el?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={`tk-panel-overlay ${isOpen ? 'tk-panel-overlay--open' : ''} ${className}`.trim()}
      onClick={handleOverlayClick}
    >
      <div
        ref={panelRef}
        className={`tk-panel ${collapsed ? 'tk-panel--collapsed' : 'tk-panel--expanded'}`}
        role="dialog"
        aria-label={title}
      >
        {/* 标题栏 */}
        <div className="tk-panel__header">
          <div className="tk-panel__title">{title}</div>
          <div className="tk-panel__actions">
            {collapsible && (
              <button
                className="tk-panel__btn tk-panel__btn--collapse"
                onClick={toggleCollapse}
                aria-label={collapsed ? '展开面板' : '折叠面板'}
                title={collapsed ? '展开' : '折叠'}
              >
                {collapsed ? '▼' : '▲'}
              </button>
            )}
            {onClose && (
              <button
                className="tk-panel__btn tk-panel__btn--close"
                onClick={onClose}
                aria-label="关闭面板"
                title="关闭"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* 内容区（折叠时隐藏） */}
        {!collapsed && <div className="tk-panel__body">{children}</div>}
      </div>
    </div>
  );
}
