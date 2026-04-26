/**
 * BondCardItem — 羁绊卡片组件（支持展开/收起详情）
 *
 * 从 BondPanel.tsx 拆分而来，解决单文件超过500行的问题。
 *
 * 功能：
 * - 显示羁绊名称、效果、进度、阵营标签
 * - 点击展开/收起详情区域（描述、类型、条件、提示）
 * - 展开/收起双向过渡动画
 * - 阵营羁绊等级效果对比（当前等级 vs 下一等级）
 *
 * @module components/idle/panels/hero/BondCardItem
 */

import React from 'react';
import type { FactionId } from '@/games/three-kingdoms/engine/hero/faction-bond-config';
import { FACTION_NAMES, FACTION_TIER_MAP } from '@/games/three-kingdoms/engine/hero/faction-bond-config';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 阵营 CSS class 映射 */
const FACTION_CLASS: Record<FactionId, string> = {
  wei: 'bond-faction-wei',
  shu: 'bond-faction-shu',
  wu: 'bond-faction-wu',
  neutral: 'bond-faction-qun',
};

/** 属性中英文映射 */
const STAT_LABELS: Record<string, string> = {
  attackBonus: '攻击',
  defenseBonus: '防御',
  hpBonus: '生命',
  critBonus: '暴击',
  strategyBonus: '策略',
};

/** 格式化效果为可读文本 */
function formatEffectShort(effect: Record<string, number>): string {
  const parts: string[] = [];
  if (effect.attackBonus > 0) parts.push(`攻击+${Math.round(effect.attackBonus * 100)}%`);
  if (effect.defenseBonus > 0) parts.push(`防御+${Math.round(effect.defenseBonus * 100)}%`);
  if (effect.hpBonus > 0) parts.push(`生命+${Math.round(effect.hpBonus * 100)}%`);
  if (effect.critBonus > 0) parts.push(`暴击+${Math.round(effect.critBonus * 100)}%`);
  if (effect.strategyBonus > 0) parts.push(`策略+${Math.round(effect.strategyBonus * 100)}%`);
  return parts.join('，') || '无';
}

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

/** 羁绊等级效果对比（用于阵营羁绊展示当前/下一级效果） */
export interface BondTierComparison {
  /** 当前激活等级名称 */
  currentTier: string;
  /** 当前等级效果文本 */
  currentEffect: string;
  /** 下一等级名称（null 表示已满级） */
  nextTier: string | null;
  /** 下一等级效果文本（null 表示已满级） */
  nextEffect: string | null;
  /** 下一等级所需人数（null 表示已满级） */
  nextRequired: number | null;
}

/** 羁绊卡片数据 */
export interface BondCardData {
  id: string;
  name: string;
  type: 'faction' | 'partner';
  description: string;
  effectText: string;
  isActive: boolean;
  faction?: FactionId;
  minRequired: number;
  currentCount: number;
  /** 阵营羁绊等级效果对比（仅阵营羁绊有值） */
  tierComparison?: BondTierComparison;
}

export interface BondCardItemProps {
  bond: BondCardData;
  isExpanded?: boolean;
  onToggle?: (id: string) => void;
}

// ─────────────────────────────────────────────
// 组件
// ─────────────────────────────────────────────

/**
 * BondCardItem — 羁绊卡片（支持展开/收起详情）
 *
 * 展开/收起动画：
 * - 展开时使用 bond-card-detail-expand 动画
 * - 收起时先添加 bond-card__detail--collapsing 类播放收起动画，
 *   动画结束后再移除详情区域
 */
const BondCardItem: React.FC<BondCardItemProps> = React.memo(({ bond, isExpanded, onToggle }) => {
  // 收起动画状态管理
  const [isCollapsing, setIsCollapsing] = React.useState(false);
  const [showDetail, setShowDetail] = React.useState(false);
  const prevExpandedRef = React.useRef(false);

  // 同步展开/收起状态，处理收起动画
  React.useEffect(() => {
    if (isExpanded && !prevExpandedRef.current) {
      // 展开：立即显示详情
      setIsCollapsing(false);
      setShowDetail(true);
    } else if (!isExpanded && prevExpandedRef.current) {
      // 收起：先播放收起动画，动画结束后隐藏详情
      setIsCollapsing(true);
      const timer = setTimeout(() => {
        setShowDetail(false);
        setIsCollapsing(false);
      }, 200); // 与 CSS 动画时长一致
      return () => clearTimeout(timer);
    }
    prevExpandedRef.current = isExpanded ?? false;
  }, [isExpanded]);

  return (
  <div
    className={`bond-card ${bond.isActive ? 'bond-card--active' : 'bond-card--inactive'} ${isExpanded ? 'bond-card--expanded' : ''}`}
    data-testid={`bond-card-${bond.id}`}
    role="button"
    tabIndex={0}
    aria-expanded={isExpanded ?? false}
    onClick={() => onToggle?.(bond.id)}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle?.(bond.id); } }}
  >
    <div className="bond-card__header">
      <span className="bond-card__name">{bond.name}</span>
      <span
        className={`bond-card__status ${bond.isActive ? 'bond-card__status--active' : ''}`}
        data-testid={`bond-status-${bond.id}`}
      >
        {bond.isActive ? '已激活' : '未激活'}
      </span>
      <span className="bond-card__expand-indicator">▼</span>
    </div>
    <div className="bond-card__effect" data-testid={`bond-effect-${bond.id}`}>
      {bond.effectText}
    </div>
    <div className="bond-card__progress">
      <span data-testid={`bond-progress-${bond.id}`}>
        {bond.currentCount}/{bond.minRequired}
      </span>
    </div>
    {bond.faction && (
      <span className={`bond-card__faction-tag ${FACTION_CLASS[bond.faction]}`}>
        {FACTION_NAMES[bond.faction]}
      </span>
    )}
    {/* 展开详情区域 — 支持展开/收起双向动画 */}
    {(showDetail || isCollapsing) && (
      <div
        className={`bond-card__detail ${isCollapsing ? 'bond-card__detail--collapsing' : ''}`}
        data-testid={`bond-card-detail-${bond.id}`}
      >
        <div className="bond-card__detail-desc">{bond.description}</div>
        <div className="bond-card__detail-type">
          类型：{bond.type === 'faction' ? '阵营羁绊' : '搭档羁绊'}
        </div>
        <div className="bond-card__detail-condition">
          激活条件：{bond.minRequired} 名{bond.type === 'faction' ? '同阵营武将' : '指定武将'}
          {bond.isActive
            ? '（✓ 已满足）'
            : `（还差 ${Math.max(0, bond.minRequired - bond.currentCount)} 个）`
          }
        </div>
        {/* 阵营羁绊等级效果对比 */}
        {bond.tierComparison && (
          <div className="bond-card__detail-tiers" data-testid={`bond-tier-comparison-${bond.id}`}>
            <div className="bond-card__tier-current">
              <span className="bond-card__tier-label">当前等级：</span>
              <span className="bond-card__tier-name">{bond.tierComparison.currentTier}</span>
              <span className="bond-card__tier-effect">{bond.tierComparison.currentEffect}</span>
            </div>
            {bond.tierComparison.nextTier && (
              <div className="bond-card__tier-next">
                <span className="bond-card__tier-label">下一等级：</span>
                <span className="bond-card__tier-name">{bond.tierComparison.nextTier}</span>
                <span className="bond-card__tier-effect">{bond.tierComparison.nextEffect}</span>
                <span className="bond-card__tier-required">（需{bond.tierComparison.nextRequired}人）</span>
              </div>
            )}
            {!bond.tierComparison.nextTier && (
              <div className="bond-card__tier-max">🏆 已达最高等级</div>
            )}
          </div>
        )}
        <div className="bond-card__detail-hint">
          {bond.isActive ? '✅ 羁绊效果已生效' : '💡 添加更多武将到编队以激活此羁绊'}
        </div>
      </div>
    )}
  </div>
  );
});
BondCardItem.displayName = 'BondCardItem';
export default BondCardItem;
