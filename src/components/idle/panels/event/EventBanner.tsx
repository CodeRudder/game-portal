/**
 * EventBanner — 急报横幅通知
 *
 * 展示游戏事件的急报横幅，支持优先级排序、自动过期、队列管理。
 * 从顶部滑入，显示事件标题和简要内容。
 *
 * 设计规范：水墨江山·铜纹霸业
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import './EventBanner.css';

import type {
  EventBanner as EventBannerData,
  EventPriority,
} from '@/games/three-kingdoms/core/events';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

export interface EventBannerProps {
  /** 横幅数据（null表示不显示） */
  banner: EventBannerData | null;
  /** 点击横幅回调 */
  onClick?: (bannerId: string) => void;
  /** 关闭横幅回调 */
  onDismiss?: (bannerId: string) => void;
  /** 自动消失时间（毫秒），默认5000 */
  autoHideDuration?: number;
}

/** 优先级对应的图标 */
const PRIORITY_ICONS: Record<EventPriority, string> = {
  low: '📢',
  normal: '📨',
  high: '⚡',
  urgent: '🚨',
};

/** 优先级对应的CSS类名 */
const PRIORITY_CLASSES: Record<EventPriority, string> = {
  low: 'tk-ebanner--low',
  normal: 'tk-ebanner--normal',
  high: 'tk-ebanner--high',
  urgent: 'tk-ebanner--urgent',
};

// ─────────────────────────────────────────────
// EventBanner 主组件
// ─────────────────────────────────────────────

const EventBanner: React.FC<EventBannerProps> = ({
  banner,
  onClick,
  onDismiss,
  autoHideDuration = 5000,
}) => {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 横幅出现时的入场动画 */
  useEffect(() => {
    if (banner) {
      setVisible(true);
      setExiting(false);

      // 自动隐藏计时
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        handleDismiss();
      }, autoHideDuration);
    } else {
      setVisible(false);
      setExiting(false);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [banner?.id, autoHideDuration]);

  /** 关闭横幅（带退出动画） */
  const handleDismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      setExiting(false);
      if (banner && onDismiss) onDismiss(banner.id);
    }, 300);
  }, [banner, onDismiss]);

  /** 点击横幅 */
  const handleClick = useCallback(() => {
    if (banner && onClick) onClick(banner.id);
  }, [banner, onClick]);

  if (!banner || !visible) return null;

  const priorityClass = PRIORITY_CLASSES[banner.priority] ?? 'tk-ebanner--normal';
  const icon = PRIORITY_ICONS[banner.priority] ?? '📨';

  return (
    <div
      className={`tk-ebanner ${priorityClass} ${exiting ? 'tk-ebanner--exiting' : 'tk-ebanner--entering'}`}
      role="alert"
      aria-live="assertive"
      data-testid="event-banner"
    >
      <div className="tk-ebanner-content" onClick={handleClick}>
        <span className="tk-ebanner-icon">{banner.icon ?? icon}</span>
        <div className="tk-ebanner-text">
          <span className="tk-ebanner-title">{banner.title}</span>
          <span className="tk-ebanner-body">{banner.content}</span>
        </div>
      </div>
      <button
        className="tk-ebanner-dismiss"
        onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
        aria-label="关闭通知"
        data-testid="event-banner-dismiss"
      >
        ✕
      </button>
    </div>
  );
};

export default EventBanner;
