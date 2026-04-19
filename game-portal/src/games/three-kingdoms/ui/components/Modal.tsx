/**
 * 三国霸业 — 通用弹窗组件
 *
 * 支持 info / confirm / warning 三种类型。
 * 遵循 PRD：居中 420px，60% 遮罩，ESC 关闭，
 * 弹出动画 250ms spring，关闭动画 200ms ease-in。
 *
 * @module ui/components/Modal
 */

import { useEffect, useCallback, useRef } from 'react';

export type ModalType = 'info' | 'confirm' | 'warning';

export interface ModalProps {
  /** 是否显示弹窗 */
  isOpen: boolean;
  /** 关闭回调（点击遮罩 / 取消 / ESC） */
  onClose: () => void;
  /** 弹窗标题 */
  title: string;
  /** 弹窗类型：info 仅关闭按钮，confirm 显示确认+取消，warning 红色警告 */
  type?: ModalType;
  /** 确认回调（仅 confirm / warning 类型） */
  onConfirm?: () => void;
  /** 确认按钮文字 */
  confirmText?: string;
  /** 取消按钮文字 */
  cancelText?: string;
  /** 弹窗内容 */
  children: React.ReactNode;
}

/**
 * Modal — 通用弹窗组件
 *
 * @example
 * ```tsx
 * <Modal isOpen={show} onClose={() => setShow(false)} title="提示">
 *   <p>操作成功！</p>
 * </Modal>
 * ```
 */
export function Modal({
  isOpen,
  onClose,
  title,
  type = 'info',
  onConfirm,
  confirmText = '确认',
  cancelText = '取消',
  children,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // ESC 关闭
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      // Enter 确认（仅 confirm/warning）
      if (type !== 'info' && onConfirm && (e.key === 'Enter' || e.key === 'y')) {
        e.preventDefault();
        onConfirm();
      }
    },
    [isOpen, onClose, onConfirm, type],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // 遮罩点击关闭
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => { if (e.target === e.currentTarget) onClose(); },
    [onClose],
  );

  // 焦点锁定：Tab 仅在弹窗内循环
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;
    const modal = modalRef.current;
    const sel = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = modal.querySelectorAll<HTMLElement>(sel);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    modal.addEventListener('keydown', trap);
    modal.querySelector<HTMLElement>(sel)?.focus();
    return () => modal.removeEventListener('keydown', trap);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="tk-modal-overlay" onClick={handleOverlayClick}>
      <div
        ref={modalRef}
        className={`tk-modal tk-modal--${type}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* 标题栏 */}
        <div className="tk-modal__header">
          <div className="tk-modal__title">{title}</div>
          <button className="tk-modal__btn tk-modal__btn--close" onClick={onClose} aria-label="关闭弹窗">✕</button>
        </div>

        {/* 内容区 */}
        <div className="tk-modal__body">{children}</div>

        {/* 底部按钮 */}
        <div className="tk-modal__footer">
          {type === 'info' ? (
            <button className="tk-modal__btn tk-modal__btn--primary" onClick={onClose}>{confirmText}</button>
          ) : (
            <>
              <button className="tk-modal__btn tk-modal__btn--cancel" onClick={onClose}>{cancelText}</button>
              <button
                className={`tk-modal__btn tk-modal__btn--primary ${type === 'warning' ? 'tk-modal__btn--danger' : ''}`}
                onClick={onConfirm}
              >
                {confirmText}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
