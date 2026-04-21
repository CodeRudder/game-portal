/**
 * 三国霸业 — 通用防抖 Action Hook
 *
 * 使用 useRef 同步锁防止用户快速重复点击导致多次执行（资产损失风险）。
 * 不依赖 React 异步状态更新，锁在同步代码中立即生效。
 *
 * 特性：
 *   - useRef 同步锁：调用时立即锁定，不依赖 setState 异步队列
 *   - isActing 状态：可绑定到按钮 disabled 属性
 *   - 默认 500ms 防抖间隔
 *   - 支持异步操作（自动在 Promise 完成后解锁）
 *
 * @module ui/hooks/useDebouncedAction
 */

import { useRef, useState, useCallback } from 'react';

/**
 * useDebouncedAction — 防抖操作 Hook
 *
 * 使用场景：招募、升级、扫荡、升星、突破、研究、远征、竞技场挑战
 * 等涉及资源消耗的操作按钮。
 *
 * @typeParam T - 被包裹的函数类型
 * @param action - 需要防抖的原始操作函数
 * @param delay - 防抖间隔（ms），默认 500ms
 * @returns 包含防抖后的 action 函数和 isActing 状态的对象
 *
 * @example
 * ```tsx
 * const { action: debouncedRecruit, isActing } = useDebouncedAction(
 *   (count: 1 | 10) => engine.recruit(type, count),
 *   500,
 * );
 *
 * <button disabled={isActing} onClick={() => debouncedRecruit(1)}>单抽</button>
 * ```
 */
export function useDebouncedAction<T extends (...args: any[]) => any>(
  action: T,
  delay = 500,
): { action: (...args: Parameters<T>) => void; isActing: boolean } {
  // 同步锁：不依赖 React 异步状态更新，调用时立即生效
  const lockRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 供 UI 绑定 disabled 的状态
  const [isActing, setIsActing] = useState(false);

  const wrappedAction = useCallback(
    (...args: Parameters<T>) => {
      // 同步锁检查 — 立即拒绝重复调用
      if (lockRef.current) return;

      // 立即加锁（同步，不经过 React 调度）
      lockRef.current = true;
      setIsActing(true);

      try {
        const result = action(...args);

        // 如果返回 Promise（异步操作），等完成后再解锁
        if (result instanceof Promise) {
          result
            .catch(() => {
              // 异步失败也解锁，由调用方在 catch 中处理 toast
            })
            .finally(() => {
              // 延迟解锁，防止快速连续点击
              timerRef.current = setTimeout(() => {
                lockRef.current = false;
                setIsActing(false);
                timerRef.current = null;
              }, delay);
            });
        } else {
          // 同步操作：延迟解锁
          timerRef.current = setTimeout(() => {
            lockRef.current = false;
            setIsActing(false);
            timerRef.current = null;
          }, delay);
        }
      } catch {
        // 同步异常：立即解锁，允许重试
        lockRef.current = false;
        setIsActing(false);
      }
    },
    [action, delay],
  );

  return { action: wrappedAction, isActing };
}
