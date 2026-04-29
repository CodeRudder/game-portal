/**
 * 更多功能 Tab — 4列网格展示所有附加功能入口
 *
 * v2 改造：
 * - 使用 FEATURE_ITEMS（16项）替代 MORE_ITEMS（11项）
 * - 4列网格布局（PC端），2列（手机端）
 * - 按4区分组显示，每组有分组标题
 * - 点击功能卡片 → 调用 onOpenPanel(id) 打开功能面板
 *
 * @module panels/more/MoreTab
 */
import React, { useMemo } from 'react';
import { FEATURE_ITEMS } from '@/components/idle/three-kingdoms/TabBar';

// ─── 类型 ────────────────────────────────────
interface MoreTabProps {
  engine: any;
  snapshotVersion?: number;
  onOpenPanel: (panelId: string) => void;
}

/** 功能项配置（含 badge） */
interface MoreItemWithBadge {
  id: string;
  icon: string;
  label: string;
  description?: string;
  available?: boolean;
  badge: number;
}

/** 分组定义 */
interface FeatureGroup {
  title: string;
  items: MoreItemWithBadge[];
}

// ─── 分组映射 ──────────────────────────────

/** 功能项 ID → 分组 */
const GROUP_MAP: Record<string, number> = {
  // A区-核心功能
  quest: 0,
  activity: 0,
  mail: 0,
  shop: 0,
  // B区-社交互动
  social: 1,
  alliance: 1,
  achievement: 1,
  // C区-扩展系统
  expedition: 2,
  equipment: 2,
  npc: 2,
  arena: 2,
  army: 2,
  // D区-系统功能
  events: 3,
  heritage: 3,
  trade: 3,
  settings: 3,
};

/** 分组标题 */
const GROUP_TITLES = [
  '🎯 核心功能',
  '👥 社交互动',
  '⚔️ 扩展系统',
  '⚙️ 系统功能',
];

// ─── Badge 计算函数 ──────────────────────────
const BADGE_GETTERS: Record<string, (engine: any) => number> = {
  quest: (e) => { const q = e?.getQuestSystem?.() ?? e?.quest; return q?.getClaimableCount?.() ?? 0; },
  mail: (e) => { const m = e?.getMailSystem?.() ?? e?.mail; return m?.getUnreadCount?.() ?? 0; },
  achievement: (e) => { const a = e?.getAchievementSystem?.() ?? e?.achievement; return a?.getClaimableCount?.() ?? 0; },
  activity: (e) => { const a = e?.getActivitySystem?.() ?? e?.activity; return a?.getActiveCount?.() ?? 0; },
  social: (e) => { const s = e?.getFriendSystem?.() ?? e?.friend; return s?.getUnreadCount?.() ?? 0; },
  trade: (e) => { const t = e?.getTradeSystem?.() ?? e?.trade; return t?.getActiveCaravanCount?.() ?? 0; },
  events: (e) => { const ev = e?.getSubsystemRegistry?.()?.get?.('eventTrigger') as any; return ev?.getActiveEventCount?.() ?? 0; },
};

// ─── 主组件 ──────────────────────────────────
const MoreTab: React.FC<MoreTabProps> = ({ engine, snapshotVersion, onOpenPanel }) => {
  // 快照版本变化时重新计算红点 & 分组
  const groups = useMemo(() => {
    void snapshotVersion;

    // 构建 badge 数据
    const itemsWithBadge: MoreItemWithBadge[] = FEATURE_ITEMS.map(item => ({
      id: item.id,
      icon: item.icon,
      label: item.label,
      description: item.description,
      available: item.available,
      badge: (BADGE_GETTERS[item.id] ?? (() => 0))(engine),
    }));

    // 按4区分组
    const result: FeatureGroup[] = GROUP_TITLES.map(title => ({ title, items: [] as MoreItemWithBadge[] }));
    itemsWithBadge.forEach(item => {
      const groupIdx = GROUP_MAP[item.id] ?? 3; // 默认归入D区
      result[groupIdx].items.push(item);
    });

    return result;
  }, [engine, snapshotVersion]);

  return (
    <div className="tk-more-tab" data-testid="more-tab">
      <div className="tk-more-title">🎮 更多功能</div>
      {groups.map((group, gi) => (
        <div key={gi} className="tk-more-group" data-testid={`more-group-${gi}`}>
          <div className="tk-more-group-title">{group.title}</div>
          <div className="tk-more-grid">
            {group.items.map(item => (
              <button
                key={item.id}
                className={`tk-more-card ${!item.available ? 'tk-more-card--disabled' : ''} ${item.id === 'alliance' ? 'tk-more-card--alliance' : ''}`}
                onClick={() => onOpenPanel(item.id)}
                aria-label={item.label}
                disabled={!item.available}
                data-testid={`more-item-${item.id}`}
              >
                <span className="tk-more-card-icon">{item.icon}</span>
                <span className="tk-more-card-label">{item.label}</span>
                {item.badge > 0 && (
                  <span className="tk-more-card-badge">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

MoreTab.displayName = 'MoreTab';

export default MoreTab;
