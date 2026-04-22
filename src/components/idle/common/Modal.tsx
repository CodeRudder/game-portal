/**
 * Modal — 通用弹窗组件
 * PLAN #21: 类型（info/success/warning/danger），打开/关闭动画，遮罩层
 */
import React, { useEffect, useCallback, useRef } from 'react';
import './Modal.css';

export type ModalType = 'info' | 'success' | 'warning' | 'danger';

export interface ModalProps {
  visible: boolean;
  type?: ModalType;
  title: string;
  children: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmDisabled?: boolean;
  dangerConfirm?: boolean;
  className?: string;
  width?: string;
  /** 测试标识，会传递到弹窗容器 div 上 */
  'data-testid'?: string;
}

const TYPE_ICONS: Record<ModalType, string> = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  danger: '❌',
};

const Modal: React.FC<ModalProps> = ({
  visible,
  type = 'info',
  title,
  children,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  confirmDisabled = false,
  dangerConfirm = false,
  className = '',
  width,
  'data-testid': dataTestId,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onCancel) onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [visible, onCancel]);

  useEffect(() => {
    if (!visible || !modalRef.current) return;
    const firstFocusable = modalRef.current.querySelector<HTMLElement>('button, [tabindex]');
    firstFocusable?.focus();
  }, [visible]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && onCancel) onCancel();
    },
    [onCancel],
  );

  if (!visible) return null;

  return (
    <div
      className={`tk-modal-overlay tk-modal-overlay--visible ${className}`}
      onClick={handleOverlayClick}
    >
      <div
        ref={modalRef}
        className={`tk-modal tk-modal--${type}`}
        style={width ? { width } : undefined}
        data-testid={dataTestId}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {onCancel && (
          <button className="tk-modal-close" onClick={onCancel} aria-label="关闭">✕</button>
        )}
        <div className="tk-modal-header">
          <span className="tk-modal-type-icon">{TYPE_ICONS[type]}</span>
          <h3 className="tk-modal-title">{title}</h3>
        </div>
        <div className="tk-modal-body">{children}</div>
        {(confirmText || cancelText) && (
          <div className="tk-modal-actions">
            {cancelText && onCancel && (
              <button className="tk-modal-btn tk-modal-btn--cancel" onClick={onCancel}>
                {cancelText}
              </button>
            )}
            {confirmText && onConfirm && (
              <button
                className={`tk-modal-btn tk-modal-btn--confirm ${dangerConfirm ? 'tk-modal-btn--danger' : ''}`}
                onClick={onConfirm}
                disabled={confirmDisabled}
              >
                {confirmText}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
