/**
 * RandomEncounterModal — 随机遭遇弹窗
 *
 * 展示随机事件的详细信息和选项，玩家可选择不同应对方式。
 * 每个选项有不同的后果（资源变化、好感度变化等）。
 *
 * 设计规范：水墨江山·铜纹霸业
 */
import React, { useMemo, useEffect } from 'react';
import './RandomEncounterModal.css';

import type {
  ActiveGameEvent,
  EventOption,
  EventConsequence,
  EventCategory,
  EventPriority,
} from '@/games/three-kingdoms/core/events';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

export interface RandomEncounterModalProps {
  /** 是否显示 */
  visible: boolean;
  /** 活跃事件数据 */
  event: ActiveGameEvent | null;
  /** 选择选项回调 */
  onSelectOption: (instanceId: string, optionId: string) => void;
  /** 关闭回调（忽略事件） */
  onClose: () => void;
}

/** 分类对应的图标 */
const CATEGORY_ICONS: Record<EventCategory, string> = {
  military: '⚔️',
  diplomatic: '🤝',
  economic: '💰',
  natural: '🌊',
  social: '👥',
  mystery: '❓',
};

/** 分类对应的中文标签 */
const CATEGORY_LABELS: Record<EventCategory, string> = {
  military: '军事',
  diplomatic: '外交',
  economic: '经济',
  natural: '自然',
  social: '社会',
  mystery: '神秘',
};

/** 优先级对应的CSS类 */
const PRIORITY_CLASSES: Record<EventPriority, string> = {
  low: 'tk-encounter--low',
  normal: 'tk-encounter--normal',
  high: 'tk-encounter--high',
  urgent: 'tk-encounter--urgent',
};

/** 后果类型对应的图标和颜色 */
const CONSEQUENCE_DISPLAY: Record<string, { icon: string; positiveColor: string; negativeColor: string }> = {
  resource_change: { icon: '💰', positiveColor: '#52a349', negativeColor: '#b8423a' },
  affinity_change: { icon: '❤️', positiveColor: '#52a349', negativeColor: '#b8423a' },
  territory_effect: { icon: '🗺️', positiveColor: '#3498db', negativeColor: '#b8423a' },
  unlock_content: { icon: '🎁', positiveColor: '#c9a84c', negativeColor: '#a0a0a0' },
  trigger_chain: { icon: '⚡', positiveColor: '#c9a84c', negativeColor: '#a0a0a0' },
  military_effect: { icon: '⚔️', positiveColor: '#52a349', negativeColor: '#b8423a' },
};

// ─────────────────────────────────────────────
// 子组件：后果标签
// ─────────────────────────────────────────────

const ConsequenceTag: React.FC<{ consequence: EventConsequence }> = ({ consequence }) => {
  const display = CONSEQUENCE_DISPLAY[consequence.type] ?? {
    icon: '✨',
    positiveColor: '#52a349',
    negativeColor: '#b8423a',
  };
  const isPositive = consequence.value >= 0;
  const color = isPositive ? display.positiveColor : display.negativeColor;
  const sign = isPositive ? '+' : '';

  return (
    <span className="tk-encounter-consequence" style={{ borderColor: color, color }}>
      {display.icon} {consequence.description} ({sign}{consequence.value})
    </span>
  );
};

// ─────────────────────────────────────────────
// RandomEncounterModal 主组件
// ─────────────────────────────────────────────

const RandomEncounterModal: React.FC<RandomEncounterModalProps> = ({
  visible,
  event,
  onSelectOption,
  onClose,
}) => {
  // ── ESC 键关闭 ──
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!visible || !event) return null;

  const categoryIcon = CATEGORY_ICONS[event.category] ?? '❓';
  const categoryLabel = CATEGORY_LABELS[event.category] ?? event.category;
  const priorityClass = PRIORITY_CLASSES[event.priority] ?? 'tk-encounter--normal';

  return (
    <div className="tk-encounter-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={event.name}>
      <div
        className={`tk-encounter-modal ${priorityClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 关闭按钮 */}
        <button className="tk-encounter-close" onClick={onClose} aria-label="关闭">✕</button>

        {/* 事件头部 */}
        <div className="tk-encounter-header">
          <div className="tk-encounter-category">
            <span className="tk-encounter-category-icon">{categoryIcon}</span>
            <span className="tk-encounter-category-label">{categoryLabel}</span>
          </div>
          <h3 className="tk-encounter-title">{event.name}</h3>
        </div>

        {/* 事件描述 */}
        <div className="tk-encounter-body">
          <p className="tk-encounter-desc">{event.description}</p>
        </div>

        {/* 选项列表 */}
        <div className="tk-encounter-options">
          <div className="tk-encounter-options-title">选择应对方式</div>
          {event.options.map((option) => (
            <button
              key={option.id}
              className="tk-encounter-option-btn"
              onClick={() => onSelectOption(event.instanceId, option.id)}
              aria-label={option.text}
            >
              <div className="tk-encounter-option-main">
                <span className="tk-encounter-option-text">{option.text}</span>
                {option.description && (
                  <span className="tk-encounter-option-desc">{option.description}</span>
                )}
              </div>
              {option.consequences.length > 0 && (
                <div className="tk-encounter-option-consequences">
                  {option.consequences.map((c, idx) => (
                    <ConsequenceTag key={`${c.type}-${c.target}-${idx}`} consequence={c} />
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>

        {/* 忽略按钮 */}
        <div className="tk-encounter-footer">
          <button className="tk-encounter-ignore-btn" onClick={onClose}>
            暂不处理
          </button>
        </div>
      </div>
    </div>
  );
};

export default RandomEncounterModal;
