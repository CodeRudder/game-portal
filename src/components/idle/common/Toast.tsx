/**
 * Toast — 通用 Toast 提示组件
 * PLAN #22-23: 时长（2s/3s/5s），位置（顶部居中），类型（success/warning/danger/info）
 * 最大堆叠3条
 */
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import './Toast.css';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────
export type ToastType = 'success' | 'warning' | 'danger' | 'info';
export type ToastDuration = 2000 | 3000 | 5000;

export interface ToastConfig {
  message: string;
  type?: ToastType;
  duration?: ToastDuration;
  className?: string;
}

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  duration: ToastDuration;
  className?: string;
  visible: boolean;
}

// ─────────────────────────────────────────────
// Toast 容器管理
// ─────────────────────────────────────────────
let toastId = 0;
const MAX_STACK = 3;
let containerEl: HTMLDivElement | null = null;
let root: Root | null = null;
const activeToasts: ToastItem[] = [];
const listeners: Array<() => void> = [];

function getContainer(): HTMLDivElement {
  if (!containerEl) {
    containerEl = document.createElement('div');
    containerEl.className = 'tk-toast-portal';
    document.body.appendChild(containerEl);
    root = createRoot(containerEl);
  }
  return containerEl;
}

function notifyListeners() {
  listeners.forEach(fn => fn());
}

function addToast(config: ToastConfig): number {
  const id = ++toastId;
  const item: ToastItem = {
    ...config,
    id,
    type: config.type ?? 'info',
    duration: config.duration ?? 3000,
    visible: true,
  };

  while (activeToasts.length >= MAX_STACK) {
    activeToasts.shift();
  }

  activeToasts.push(item);
  notifyListeners();

  setTimeout(() => removeToast(id), item.duration);
  return id;
}

function removeToast(id: number) {
  const idx = activeToasts.findIndex(t => t.id === id);
  if (idx === -1) return;
  activeToasts[idx].visible = false;
  notifyListeners();
  setTimeout(() => {
    const removeIdx = activeToasts.findIndex(t => t.id === id);
    if (removeIdx !== -1) activeToasts.splice(removeIdx, 1);
    notifyListeners();
  }, 200);
}

// ─────────────────────────────────────────────
// Toast 容器渲染组件
// ─────────────────────────────────────────────
const TOAST_ICONS: Record<ToastType, string> = {
  success: '✅',
  warning: '⚠️',
  danger: '❌',
  info: 'ℹ️',
};

function ToastContainer({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="tk-toast-container">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`tk-toast tk-toast--${toast.type} ${toast.visible ? 'tk-toast--visible' : 'tk-toast--exiting'} ${toast.className || ''}`}
          role="alert"
        >
          <span className="tk-toast-icon">{TOAST_ICONS[toast.type]}</span>
          <span className="tk-toast-message">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}

function renderToasts() {
  if (!root) getContainer();
  root!.render(<ToastContainer toasts={[...activeToasts]} />);
}

listeners.push(renderToasts);

// ─────────────────────────────────────────────
// 公开 API
// ─────────────────────────────────────────────
export const Toast = {
  show(config: ToastConfig): number { return addToast(config); },
  success(message: string, duration: ToastDuration = 3000): number {
    return addToast({ message, type: 'success', duration });
  },
  warning(message: string, duration: ToastDuration = 3000): number {
    return addToast({ message, type: 'warning', duration });
  },
  danger(message: string, duration: ToastDuration = 5000): number {
    return addToast({ message, type: 'danger', duration });
  },
  info(message: string, duration: ToastDuration = 3000): number {
    return addToast({ message, type: 'info', duration });
  },
};

export default Toast;
