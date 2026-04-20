/**
 * 三国霸业 — 底部 Tab 导航组件
 *
 * 5 个 Tab 页：主城 / 武将 / 出征 / 科技 / 更多
 * 支持键盘导航、激活态高亮、未读角标。
 *
 * @module ui/components/TabNav
 */

import { useCallback } from 'react';

// ─────────────────────────────────────────────
// Tab 定义
// ─────────────────────────────────────────────

export interface TabItem {
  id: string;
  label: string;
  icon: string;
  /** 角标数字（0 = 不显示） */
  badge?: number;
}

export const DEFAULT_TABS: TabItem[] = [
  { id: 'castle', label: '主城', icon: '🏰' },
  { id: 'heroes', label: '武将', icon: '👤' },
  { id: 'campaign', label: '出征', icon: '⚔️' },
  { id: 'tech', label: '科技', icon: '🔬' },
  { id: 'more', label: '更多', icon: '⋯' },
];

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface TabNavProps {
  /** 当前激活的 Tab ID */
  activeTab: string;
  /** Tab 切换回调 */
  onTabChange: (tabId: string) => void;
  /** 自定义 Tab 列表 */
  tabs?: TabItem[];
  /** 额外类名 */
  className?: string;
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

/**
 * TabNav — 底部 Tab 导航
 *
 * @example
 * ```tsx
 * const [tab, setTab] = useState('castle');
 * <TabNav activeTab={tab} onTabChange={setTab} />
 * ```
 */
export function TabNav({
  activeTab,
  onTabChange,
  tabs = DEFAULT_TABS,
  className,
}: TabNavProps) {
  const handleClick = useCallback(
    (id: string) => () => onTabChange(id),
    [onTabChange],
  );

  return (
    <nav
      style={styles.container}
      className={`tk-tab-nav ${className ?? ''}`.trim()}
      role="tablist"
      aria-label="主导航"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            style={{
              ...styles.tab,
              ...(isActive ? styles.tabActive : {}),
            }}
            onClick={handleClick(tab.id)}
          >
            {/* 图标 */}
            <span style={styles.icon}>{tab.icon}</span>

            {/* 标签 */}
            <span style={{
              ...styles.label,
              color: isActive ? '#d4a574' : '#a0a0a0',
            }}>
              {tab.label}
            </span>

            {/* 角标 */}
            {tab.badge && tab.badge > 0 && (
              <span style={styles.badge}>
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

// ─────────────────────────────────────────────
// 样式
// ─────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'space-around',
    height: '56px',
    background: 'rgba(13, 17, 23, 0.95)',
    borderTop: '1px solid rgba(212, 165, 116, 0.3)',
    flexShrink: 0,
  },
  tab: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    position: 'relative',
    transition: 'background-color 0.15s ease',
    padding: '4px 0',
    outline: 'none',
  },
  tabActive: {
    backgroundColor: 'rgba(212, 165, 116, 0.08)',
  },
  icon: {
    fontSize: '20px',
    lineHeight: 1,
  },
  label: {
    fontSize: '11px',
    fontWeight: 600,
    lineHeight: 1,
    transition: 'color 0.15s ease',
  },
  badge: {
    position: 'absolute',
    top: '4px',
    right: 'calc(50% - 22px)',
    minWidth: '16px',
    height: '16px',
    lineHeight: '16px',
    textAlign: 'center',
    fontSize: '10px',
    fontWeight: 700,
    color: '#fff',
    background: '#b8423a',
    borderRadius: '8px',
    padding: '0 4px',
  },
};
