/**
 * 三国霸业 — Toast 上下文管理
 *
 * 提供 ToastContext + useToast() hook。
 * 管理多个 Toast 的堆叠显示与自动移除。
 * ID 生成: Date.now() + Math.random()
 *
 * @module ui/components/ToastProvider
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { Toast, type ToastItem, type ToastType } from './Toast';

// ─────────────────────────────────────────────
// Context 类型
// ─────────────────────────────────────────────

interface ToastContextValue {
  /** 添加一条 Toast */
  addToast: (message: string, type?: ToastType, duration?: number) => void;
  /** 当前 Toast 列表（只读） */
  toasts: ToastItem[];
}

// ─────────────────────────────────────────────
// Context & Hook
// ─────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

/** 最大堆叠数量 */
const MAX_TOASTS = 5;

/**
 * useToast — 获取 Toast 操作方法。
 *
 * @example
 * ```tsx
 * const { addToast } = useToast();
 * addToast('建筑已升级', 'success');
 * ```
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error(
      'useToast must be used within a <ToastProvider>. ' +
        'Wrap your component tree with <ToastProvider>.',
    );
  }
  return ctx;
}

// ─────────────────────────────────────────────
// Provider 组件
// ─────────────────────────────────────────────

interface ToastProviderProps {
  children: ReactNode;
}

/**
 * ToastProvider — 在组件树顶层包裹，提供 Toast 管理能力。
 *
 * @example
 * ```tsx
 * <ToastProvider>
 *   <GameUI />
 * </ToastProvider>
 * ```
 */
export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // 移除单条 Toast
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // 添加 Toast（ID: Date.now() + Math.random()）
  const addToast = useCallback(
    (message: string, type: ToastType = 'info', duration?: number) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const newToast: ToastItem = { id, message, type, duration };
      setToasts((prev) => {
        const next = [...prev, newToast];
        // 超过上限时移除最早的
        return next.length > MAX_TOASTS ? next.slice(-MAX_TOASTS) : next;
      });
    },
    [],
  );

  const value: ToastContextValue = { addToast, toasts };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}
