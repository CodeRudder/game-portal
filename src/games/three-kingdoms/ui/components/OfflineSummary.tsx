/**
 * 三国霸业 — 回归综合面板组件
 *
 * 离线回归后展示建筑/科技/远征/事件摘要。
 * 提供一站式回顾，帮助玩家快速了解离线期间发生的变化。
 *
 * @module ui/components/OfflineSummary
 */

import { useMemo } from 'react';
import { useGameContext } from '../context/GameContext';

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

/** 摘要条目 */
export interface SummaryItem {
  /** 图标 */
  icon: string;
  /** 标题 */
  title: string;
  /** 描述 */
  description: string;
  /** 数量变化（可选） */
  valueChange?: string;
  /** 颜色 */
  color?: string;
}

/** 摘要分类 */
export interface SummarySection {
  /** 分类标题 */
  title: string;
  /** 分类图标 */
  icon: string;
  /** 条目列表 */
  items: SummaryItem[];
}

export interface OfflineSummaryProps {
  /** 自定义摘要数据（可选，不传则从引擎推断） */
  sections?: SummarySection[];
  /** 额外类名 */
  className?: string;
}

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}万`;
  return Math.floor(n).toString();
}

// ─────────────────────────────────────────────
// 子组件：摘要条目
// ─────────────────────────────────────────────

interface SummaryItemRowProps {
  item: SummaryItem;
}

function SummaryItemRow({ item }: SummaryItemRowProps) {
  return (
    <div style={styles.item}>
      <span style={styles.itemIcon}>{item.icon}</span>
      <div style={styles.itemContent}>
        <div style={styles.itemTitle}>{item.title}</div>
        <div style={styles.itemDesc}>{item.description}</div>
      </div>
      {item.valueChange && (
        <span style={{ ...styles.itemValue, color: item.color ?? '#7EC850' }}>
          {item.valueChange}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 子组件：摘要分类
// ─────────────────────────────────────────────

interface SummarySectionBlockProps {
  section: SummarySection;
}

function SummarySectionBlock({ section }: SummarySectionBlockProps) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <span>{section.icon}</span>
        <span style={styles.sectionTitle}>{section.title}</span>
      </div>
      {section.items.length > 0 ? (
        section.items.map((item, idx) => <SummaryItemRow key={idx} item={item} />)
      ) : (
        <div style={styles.emptyText}>暂无变化</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

/**
 * OfflineSummary — 回归综合面板
 *
 * @example
 * ```tsx
 * <OfflineSummary />
 * ```
 */
export function OfflineSummary({ sections: propSections, className }: OfflineSummaryProps) {
  const { snapshot } = useGameContext();

  const sections = useMemo<SummarySection[]>(() => {
    if (propSections) return propSections;
    if (!snapshot) return [];

    // 从引擎快照推断摘要
    const buildingItems: SummaryItem[] = [];
    const techItems: SummaryItem[] = [];
    const generalItems: SummaryItem[] = [];

    // 建筑摘要
    const buildingTypes = Object.keys(snapshot.buildings) as Array<keyof typeof snapshot.buildings>;
    for (const bt of buildingTypes) {
      const b = snapshot.buildings[bt];
      if (b.status === 'upgrading') {
        buildingItems.push({
          icon: '🔨',
          title: `${bt}升级中`,
          description: `当前等级 Lv.${b.level}`,
          valueChange: '进行中',
          color: '#d4a574',
        });
      }
    }

    // 科技摘要
    if (snapshot.techState) {
      const researching = snapshot.techState.researchingTechId;
      if (researching) {
        techItems.push({
          icon: '🔬',
          title: '科技研究中',
          description: researching,
          valueChange: '进行中',
          color: '#5B9BD5',
        });
      }
    }

    // 武将/战力摘要
    if (snapshot.totalPower > 0) {
      generalItems.push({
        icon: '⚔️',
        title: '总战力',
        description: `${snapshot.heroes.length}名武将`,
        valueChange: formatNumber(snapshot.totalPower),
        color: '#C9A84C',
      });
    }

    return [
      { title: '建筑动态', icon: '🏛️', items: buildingItems },
      { title: '科技进度', icon: '📚', items: techItems },
      { title: '武将概况', icon: '🦸', items: generalItems },
    ];
  }, [propSections, snapshot]);

  if (!snapshot && !propSections) {
    return <div style={styles.loading}>加载中...</div>;
  }

  return (
    <div
      style={styles.container}
      className={`tk-offline-summary ${className ?? ''}`.trim()}
      role="region"
      aria-label="离线回归摘要"
    >
      <div style={styles.title}>📋 离线回归摘要</div>
      {sections.map((section, idx) => (
        <SummarySectionBlock key={idx} section={section} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// 样式
// ─────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '12px',
    color: '#e8e0d0',
    maxHeight: '60vh',
    overflowY: 'auto',
  },
  loading: {
    padding: '24px',
    textAlign: 'center',
    color: '#a0a0a0',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#d4a574',
    marginBottom: '12px',
  },
  section: {
    marginBottom: '12px',
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '8px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#d4a574',
  },
  sectionTitle: { flex: 1 },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 0',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  itemIcon: { fontSize: '16px', flexShrink: 0 },
  itemContent: { flex: 1, minWidth: 0 },
  itemTitle: { fontSize: '13px', color: '#e8e0d0' },
  itemDesc: { fontSize: '11px', color: '#a0a0a0' },
  itemValue: {
    fontSize: '13px',
    fontWeight: 600,
    flexShrink: 0,
  },
  emptyText: {
    fontSize: '12px',
    color: '#666',
    textAlign: 'center',
    padding: '8px',
  },
};
