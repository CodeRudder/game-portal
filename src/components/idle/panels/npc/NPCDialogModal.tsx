/**
 * NPCDialogModal — NPC对话弹窗
 *
 * 展示NPC对话树内容，支持选项选择和对话历史。
 * 基于通用 Modal 组件封装。
 *
 * 设计规范：水墨江山·铜纹霸业
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import SharedPanel from '../../components/SharedPanel';
import './NPCDialogModal.css';

import type {
  DialogNode,
  DialogOption,
  DialogEffect,
  DialogSession,
} from '@/games/three-kingdoms/core/npc';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

export interface NPCDialogModalProps {
  /** 是否显示 */
  visible: boolean;
  /** NPC名称 */
  npcName: string;
  /** NPC职业图标 */
  npcIcon: string;
  /** 当前对话节点 */
  currentNode: DialogNode | null;
  /** 可用选项 */
  availableOptions: DialogOption[];
  /** 对话是否已结束 */
  dialogEnded: boolean;
  /** 选择选项回调 */
  onSelectOption: (optionId: string) => void;
  /** 关闭弹窗回调 */
  onClose: () => void;
}

/** 效果类型对应的图标 */
const EFFECT_ICONS: Record<string, string> = {
  affinity_change: '❤️',
  unlock_item: '🎁',
  unlock_info: '📜',
  trigger_event: '⚡',
  grant_resource: '💰',
};

// ─────────────────────────────────────────────
// NPCDialogModal 主组件
// ─────────────────────────────────────────────

const NPCDialogModal: React.FC<NPCDialogModalProps> = ({
  visible,
  npcName,
  npcIcon,
  currentNode,
  availableOptions,
  dialogEnded,
  onSelectOption,
  onClose,
}) => {
  // ── ESC 键关闭 ──
  useEffect(() => {
    if (!visible) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [visible, onClose]);

  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 打字机效果：逐字显示对话文本 */
  useEffect(() => {
    if (!currentNode?.text) {
      setDisplayedText('');
      return;
    }

    // 清除上次的定时器
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    const fullText = currentNode.text;
    let index = 0;
    setIsTyping(true);
    setDisplayedText('');

    const typeChar = () => {
      if (index < fullText.length) {
        setDisplayedText(fullText.slice(0, index + 1));
        index++;
        typingTimerRef.current = setTimeout(typeChar, 30);
      } else {
        setIsTyping(false);
      }
    };

    typeChar();

    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [currentNode?.id, currentNode?.text]);

  /** 自动滚动到底部 */
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [displayedText, availableOptions]);

  /** 点击跳过打字效果 */
  const handleSkipTyping = useCallback(() => {
    if (isTyping && currentNode?.text) {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      setDisplayedText(currentNode.text);
      setIsTyping(false);
    }
  }, [isTyping, currentNode?.text]);

  /** 渲染效果标签 */
  const renderEffectTag = (effect: DialogEffect) => {
    const icon = EFFECT_ICONS[effect.type] ?? '✨';
    const label = String(effect.value);
    return (
      <span key={`${effect.type}-${effect.value}`} className="tk-dialog-effect-tag">
        {icon} {label}
      </span>
    );
  };

  if (!visible) return null;

  return (
    <div className="tk-dialog-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={`${npcName}对话`} data-testid="npc-dialog-overlay">
      <div className="tk-dialog-modal" onClick={(e) => e.stopPropagation()} data-testid="npc-dialog-modal">
        {/* 对话头部 */}
        <div className="tk-dialog-header">
          <div className="tk-dialog-speaker">
            <span className="tk-dialog-speaker-icon">{npcIcon}</span>
            <span className="tk-dialog-speaker-name">{currentNode?.speaker ?? npcName}</span>
          </div>
          <button className="tk-dialog-close" onClick={onClose} aria-label="关闭对话" data-testid="npc-dialog-close">✕</button>
        </div>

        {/* 对话内容区 */}
        <div className="tk-dialog-content" ref={contentRef} onClick={handleSkipTyping} data-testid="npc-dialog-content">
          {currentNode ? (
            <div className="tk-dialog-bubble">
              <p className="tk-dialog-text">{displayedText}</p>
              {isTyping && <span className="tk-dialog-cursor">▌</span>}
            </div>
          ) : dialogEnded ? (
            <div className="tk-dialog-ended">
              <span className="tk-dialog-ended-icon">👋</span>
              <span className="tk-dialog-ended-text">对话已结束</span>
            </div>
          ) : (
            <div className="tk-dialog-loading">加载中...</div>
          )}
        </div>

        {/* 选项区 */}
        {!dialogEnded && availableOptions.length > 0 && !isTyping && (
          <div className="tk-dialog-options" data-testid="npc-dialog-options">
            {availableOptions.map((option) => (
              <button
                key={option.id}
                className="tk-dialog-option-btn"
                onClick={() => onSelectOption(option.id)}
                aria-label={option.text}
                data-testid={`npc-dialog-option-${option.id}`}
              >
                <span className="tk-dialog-option-text">{option.text}</span>
                {option.effects && option.effects.length > 0 && (
                  <div className="tk-dialog-option-effects">
                    {(option.effects as any[]).map(renderEffectTag)}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* 对话结束操作 */}
        {dialogEnded && (
          <div className="tk-dialog-footer">
            <button className="tk-dialog-end-btn" onClick={onClose} data-testid="npc-dialog-end-btn">
              关闭
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NPCDialogModal;
