/**
 * 更多功能 Tab — 2列网格展示所有附加功能入口
 *
 * 点击功能卡片后通过 onOpenPanel 回调打开对应面板弹窗。
 * 支持红点提示（未读/可领取数量）。
 *
 * @module panels/more/MoreTab
 */
import React, { useMemo } from 'react';

// ─── 类型 ────────────────────────────────────
interface MoreTabProps {
  engine: any;
  snapshotVersion?: number;
  onOpenPanel: (panelId: string) => void;
}

/** 功能项配置 */
interface MoreItem {
  id: string;
  icon: string;
  label: string;
  /** 获取红点数的函数 */
  getBadge: (engine: any) => number;
}

// ─── 功能项列表 ──────────────────────────────
const MORE_ITEMS: MoreItem[] = [
  { id: 'quest',       icon: '📋', label: '任务',   getBadge: (e) => { const q = e?.getQuestSystem?.() ?? e?.quest; return q?.getClaimableCount?.() ?? 0; } },
  { id: 'shop',        icon: '🏪', label: '商店',   getBadge: () => 0 },
  { id: 'mail',        icon: '📬', label: '邮件',   getBadge: (e) => { const m = e?.getMailSystem?.() ?? e?.mail; return m?.getUnreadCount?.() ?? 0; } },
  { id: 'achievement', icon: '🏆', label: '成就',   getBadge: (e) => { const a = e?.getAchievementSystem?.() ?? e?.achievement; return a?.getClaimableCount?.() ?? 0; } },
  { id: 'activity',    icon: '🎪', label: '活动',   getBadge: (e) => { const a = e?.getActivitySystem?.() ?? e?.activity; return a?.getActiveCount?.() ?? 0; } },
  { id: 'alliance',    icon: '🤝', label: '联盟',   getBadge: () => 0 },
  { id: 'prestige',    icon: '📊', label: '声望',   getBadge: () => 0 },
  { id: 'heritage',    icon: '👨‍👩‍👧', label: '传承', getBadge: () => 0 },
  { id: 'social',      icon: '💬', label: '社交',   getBadge: (e) => { const s = e?.getFriendSystem?.() ?? e?.friend; return s?.getUnreadCount?.() ?? 0; } },
];

// ─── 主组件 ──────────────────────────────────
const MoreTab: React.FC<MoreTabProps> = ({ engine, snapshotVersion, onOpenPanel }) => {
  // 快照版本变化时重新计算红点
  const items = useMemo(() => {
    void snapshotVersion;
    return MORE_ITEMS.map(item => ({
      ...item,
      badge: item.getBadge(engine),
    }));
  }, [engine, snapshotVersion]);

  return (
    <div style={styles.wrap}>
      <div style={styles.title}>🎮 更多功能</div>
      <div style={styles.grid}>
        {items.map(item => (
          <button
            key={item.id}
            style={styles.card}
            onClick={() => onOpenPanel(item.id)}
            aria-label={item.label}
          >
            <span style={styles.icon}>{item.icon}</span>
            <span style={styles.label}>{item.label}</span>
            {item.badge > 0 && (
              <span style={styles.badge}>
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

MoreTab.displayName = 'MoreTab';

export default MoreTab;

// ─── 样式 ────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  wrap: {
    padding: 16,
    color: '#e8e0d0',
    minHeight: '100%',
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    color: '#d4a574',
    marginBottom: 16,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  card: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '18px 10px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'background 0.15s, border-color 0.15s',
    color: 'inherit',
  },
  icon: {
    fontSize: 30,
  },
  label: {
    fontSize: 13,
    fontWeight: 500,
    color: '#c8c0b0',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    lineHeight: '18px',
    padding: '0 5px',
    borderRadius: 9,
    background: '#e84040',
    color: '#fff',
    fontSize: 10,
    fontWeight: 700,
    textAlign: 'center',
    boxSizing: 'border-box',
  },
};
