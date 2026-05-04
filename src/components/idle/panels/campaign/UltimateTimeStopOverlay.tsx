/**
 * UltimateTimeStopOverlay — 大招时停UI面板
 *
 * 当 UltimateSkillSystem 检测到大招就绪时显示：
 * - 半透明遮罩覆盖战场
 * - 显示就绪大招列表，玩家点击选择释放哪个
 * - 5秒倒计时超时自动释放第一个就绪大招
 * - 时停期间战斗暂停
 *
 * 设计风格：水墨江山·铜纹霸业（无neon/glow/脉冲动画）
 *
 * P1改进：
 * - 焦点陷阱：打开时焦点移入大招列表，关闭时恢复到触发按钮
 * - Tab 键循环保持在面板内
 *
 * @module components/idle/panels/campaign/UltimateTimeStopOverlay
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { BattleUnit, BattleSkill } from '@/games/three-kingdoms/engine';
import './UltimateTimeStopOverlay.css';

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

/** 就绪大招条目 */
export interface ReadyUltimateItem {
  /** 单位 */
  unit: BattleUnit;
  /** 可释放的技能列表 */
  skills: BattleSkill[];
}

export interface UltimateTimeStopOverlayProps {
  /** 是否显示面板 */
  visible: boolean;
  /** 就绪的大招列表 */
  readyItems: ReadyUltimateItem[];
  /** 玩家确认释放回调 */
  onConfirm: (unitId: string, skillId: string) => void;
  /** 玩家取消回调 */
  onCancel: () => void;
  /** 超时时间（ms），默认5000 */
  timeoutMs?: number;
}

// ─────────────────────────────────────────────
// 组件
// ─────────────────────────────────────────────

/**
 * 大招时停面板
 *
 * 战场中央弹出，显示就绪大招列表，带倒计时。
 */
const UltimateTimeStopOverlay: React.FC<UltimateTimeStopOverlayProps> = ({
  visible,
  readyItems,
  onConfirm,
  onCancel,
  timeoutMs = 5000,
}) => {
  const [countdown, setCountdown] = useState(Math.ceil(timeoutMs / 1000));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── P1：焦点管理 refs ──
  const panelRef = useRef<HTMLDivElement>(null);
  const firstSkillBtnRef = useRef<HTMLButtonElement>(null);

  // ── 倒计时逻辑 ──
  useEffect(() => {
    if (!visible || readyItems.length === 0) {
      // 清理定时器
      if (timerRef.current) clearInterval(timerRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timerRef.current = null;
      timeoutRef.current = null;
      return;
    }

    // 重置倒计时
    setCountdown(Math.ceil(timeoutMs / 1000));

    // 每秒更新倒计时
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // 超时自动释放第一个就绪大招
    timeoutRef.current = setTimeout(() => {
      if (readyItems.length > 0 && readyItems[0].skills.length > 0) {
        onConfirm(readyItems[0].unit.id, readyItems[0].skills[0].id);
      }
    }, timeoutMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timerRef.current = null;
      timeoutRef.current = null;
    };
  }, [visible, readyItems, timeoutMs, onConfirm]);

  // ── P1：打开时焦点移入大招列表 ──
  useEffect(() => {
    if (visible && readyItems.length > 0) {
      // 延迟一帧确保 DOM 已渲染
      requestAnimationFrame(() => {
        firstSkillBtnRef.current?.focus();
      });
    }
  }, [visible, readyItems]);

  // ── P1：焦点陷阱 — Tab 键循环保持在面板内 ──
  const handlePanelKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'Tab' || !panelRef.current) return;

      const focusableSelector = 'button:not([disabled])';
      const focusableElements = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      );
      if (focusableElements.length === 0) return;

      const firstEl = focusableElements[0];
      const lastEl = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    },
    [],
  );

  // ── 处理确认释放 ──
  const handleConfirm = useCallback(
    (unitId: string, skillId: string) => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timerRef.current = null;
      timeoutRef.current = null;
      onConfirm(unitId, skillId);
    },
    [onConfirm],
  );

  // ── 处理取消 ──
  const handleCancel = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timerRef.current = null;
    timeoutRef.current = null;
    onCancel();
  }, [onCancel]);

  if (!visible || readyItems.length === 0) return null;

  // 找到第一个技能按钮的 key，用于 ref 绑定
  let isFirstBtn = true;

  return (
    <div className="tk-ultimate-overlay" data-testid="ultimate-time-stop-overlay">
      {/* 半透明遮罩 */}
      <div className="tk-ultimate-overlay__backdrop" />

      {/* 面板内容 */}
      <div
        ref={panelRef}
        className="tk-ultimate-overlay__panel"
        data-testid="ultimate-panel"
        role="dialog"
        aria-label="大招就绪"
        aria-modal="true"
        onKeyDown={handlePanelKeyDown}
      >
        {/* 标题栏 */}
        <div className="tk-ultimate-overlay__header">
          <span className="tk-ultimate-overlay__title">⚡ 大招就绪</span>
          <span className="tk-ultimate-overlay__countdown" data-testid="ultimate-countdown">
            {countdown}s
          </span>
        </div>

        {/* 就绪大招列表 */}
        <div className="tk-ultimate-overlay__list" data-testid="ultimate-ready-list">
          {readyItems.map((item) =>
            item.skills.map((skill) => {
              const btnKey = `${item.unit.id}-${skill.id}`;
              const isFirst = isFirstBtn;
              if (isFirst) isFirstBtn = false;
              return (
                <button
                  key={btnKey}
                  ref={isFirst ? firstSkillBtnRef : undefined}
                  className="tk-ultimate-overlay__skill-btn"
                  data-testid={`ultimate-skill-btn-${btnKey}`}
                  onClick={() => handleConfirm(item.unit.id, skill.id)}
                >
                  <span className="tk-ultimate-overlay__skill-avatar">
                    {item.unit.name.charAt(0)}
                  </span>
                  <div className="tk-ultimate-overlay__skill-info">
                    <span className="tk-ultimate-overlay__skill-name">{item.unit.name}</span>
                    <span className="tk-ultimate-overlay__skill-detail">{skill.name}</span>
                  </div>
                  <span className="tk-ultimate-overlay__skill-cost">
                    {skill.rageCost}怒
                  </span>
                </button>
              );
            }),
          )}
        </div>

        {/* 底部操作 */}
        <div className="tk-ultimate-overlay__footer">
          <button
            className="tk-ultimate-overlay__cancel-btn"
            data-testid="ultimate-cancel-btn"
            onClick={handleCancel}
          >
            取消（使用普攻）
          </button>
        </div>
      </div>
    </div>
  );
};

UltimateTimeStopOverlay.displayName = 'UltimateTimeStopOverlay';
export default UltimateTimeStopOverlay;
