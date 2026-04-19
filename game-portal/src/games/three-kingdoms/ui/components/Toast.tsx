/**
 * 三国霸业 — Toast 提示组件
 *
 * 堆叠显示多条 Toast，支持 success / error / warning / info 四种类型。
 * 自动消失（默认 3000ms）+ 手动关闭，飞鸽传书风格。
 * CSS 类名前缀: tk-toast-
 *
 * @module ui/components/Toast
 */

import { useEffect, useCallback, useState } from 'react';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  /** 唯一 ID */
  id: string;
  /** 提示消息 */
  message: string;
  /** 提示类型 */
  type: ToastType;
  /** 自动关闭时间（ms），默认 3000 */
  duration?: number;
}

export interface ToastProps {
  /** 当前显示的 Toast 列表 */
  toasts: ToastItem[];
  /** 移除回调 */
  onRemove: (id: string) => void;
}

// ─────────────────────────────────────────────
// 默认时长 & 图标
// ─────────────────────────────────────────────

const DEFAULT_DURATION = 3000;

const TOAST_ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

// ─────────────────────────────────────────────
// 单条 Toast 子组件
// ─────────────────────────────────────────────

function ToastEntry({
  item,
  onRemove,
}: {
  item: ToastItem;
  onRemove: (id: string) => void;
}) {
  const [exiting, setExiting] = useState(false);
  const duration = item.duration ?? DEFAULT_DURATION;

  // 退出动画完成后移除
  const handleClose = useCallback(() => {
    setExiting(true);
    setTimeout(() => onRemove(item.id), 200);
  }, [item.id, onRemove]);

  // 自动消失
  useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(handleClose, duration);
    return () => clearTimeout(timer);
  }, [duration, handleClose]);

  const animClass = exiting ? 'tk-toast--exit' : 'tk-toast--enter';

  return (
    <div
      className={`tk-toast tk-toast-${item.type} ${animClass}`}
      role="alert"
      aria-live="polite"
    >
      <span className="tk-toast__icon">{TOAST_ICONS[item.type]}</span>
      <span className="tk-toast__message">{item.message}</span>
      <button className="tk-toast__close" onClick={handleClose} aria-label="关闭提示">
        ✕
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Toast 容器组件（堆叠显示）
// ─────────────────────────────────────────────

/**
 * Toast — 堆叠提示容器
 *
 * @example
 * ```tsx
 * <Toast toasts={toastList} onRemove={removeToast} />
 * ```
 */
export function Toast({ toasts, onRemove }: ToastProps) {
  return (
    <div className="tk-toast-container" aria-label="消息提示">
      {toasts.map((item) => (
        <ToastEntry key={item.id} item={item} onRemove={onRemove} />
      ))}
    </div>
  );
}
