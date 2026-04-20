/**
 * 三国霸业 — 招募弹窗组件
 *
 * 支持单抽/十连招募，显示：
 *   - 招募类型选择（普通/高级）
 *   - 单抽/十连按钮
 *   - 保底进度条
 *   - 招募结果展示（动画）
 *   - 消耗资源显示
 *
 * @module ui/components/RecruitModal
 */

import { useState, useCallback } from 'react';
import { useGameContext } from '../context/GameContext';
import type { RecruitType } from '../../engine/hero/hero-recruit-config';
import { QUALITY_LABELS, QUALITY_BORDER_COLORS } from '../../engine/hero/hero.types';
import type { RecruitOutput, RecruitResult } from '../../engine/hero/HeroRecruitSystem';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

const RECRUIT_CONFIG: Record<RecruitType, { label: string; costLabel: string; icon: string }> = {
  normal: { label: '普通招募', costLabel: '100 铜钱/次', icon: '📜' },
  advanced: { label: '高级招募', costLabel: '1 求贤令/次', icon: '🎯' },
};

// 保底阈值
const PITY_SOFT = 10;
const PITY_HARD = 50;

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface RecruitModalProps {
  /** 是否显示 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
}

// ─────────────────────────────────────────────
// 子组件：招募结果卡片
// ─────────────────────────────────────────────

interface ResultCardProps {
  result: RecruitResult;
  index: number;
}

function ResultCard({ result, index }: ResultCardProps) {
  const borderColor = QUALITY_BORDER_COLORS[result.quality];
  const qualityLabel = QUALITY_LABELS[result.quality];

  return (
    <div
      style={{
        ...resultStyles.card,
        borderLeftColor: borderColor,
        animationDelay: `${index * 0.08}s`,
      }}
    >
      <div style={{ ...resultStyles.quality, color: borderColor }}>{qualityLabel}</div>
      <div style={resultStyles.name}>{result.general.name}</div>
      {result.isDuplicate && (
        <div style={resultStyles.duplicate}>
          +{result.fragmentCount} 碎片
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

/**
 * RecruitModal — 招募弹窗
 *
 * @example
 * ```tsx
 * <RecruitModal isOpen={showRecruit} onClose={() => setShowRecruit(false)} />
 * ```
 */
export function RecruitModal({ isOpen, onClose }: RecruitModalProps) {
  const { engine } = useGameContext();
  const [recruitType, setRecruitType] = useState<RecruitType>('normal');
  const [results, setResults] = useState<RecruitOutput | null>(null);
  const [isRecruiting, setIsRecruiting] = useState(false);

  // 保底进度
  const pityState = engine.getRecruitSystem().getGachaState();
  const pityCount = recruitType === 'normal' ? pityState.normalPity : pityState.advancedPity;
  const hardCount = recruitType === 'normal' ? pityState.normalHardPity : pityState.advancedHardPity;
  const pityPercent = Math.min((pityCount / PITY_SOFT) * 100, 100);
  const hardPercent = Math.min((hardCount / PITY_HARD) * 100, 100);

  const handleRecruit = useCallback(
    (count: 1 | 10) => {
      setIsRecruiting(true);
      setResults(null);

      // 使用 setTimeout 模拟短暂延迟动画
      setTimeout(() => {
        try {
          const output = engine.recruit(recruitType, count);
          setResults(output);
        } catch {
          // 资源不足等情况
          setResults(null);
        }
        setIsRecruiting(false);
      }, 300);
    },
    [engine, recruitType],
  );

  const handleClose = useCallback(() => {
    setResults(null);
    setIsRecruiting(false);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  const cfg = RECRUIT_CONFIG[recruitType];

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div style={styles.modal} role="dialog" aria-modal="true" aria-label="招募">
        {/* 头部 */}
        <div style={styles.header}>
          <span style={styles.title}>招贤纳士</span>
          <button style={styles.closeBtn} onClick={handleClose} aria-label="关闭">✕</button>
        </div>

        {/* 招募类型切换 */}
        <div style={styles.typeSwitch}>
          {(['normal', 'advanced'] as RecruitType[]).map((t) => (
            <button
              key={t}
              style={{
                ...styles.typeBtn,
                ...(recruitType === t ? styles.typeBtnActive : {}),
              }}
              onClick={() => { setRecruitType(t); setResults(null); }}
            >
              {RECRUIT_CONFIG[t].icon} {RECRUIT_CONFIG[t].label}
            </button>
          ))}
        </div>

        {/* 消耗提示 */}
        <div style={styles.costInfo}>{cfg.costLabel}</div>

        {/* 保底进度 */}
        <div style={styles.pitySection}>
          <div style={styles.pityRow}>
            <span style={styles.pityLabel}>软保底</span>
            <div style={styles.pityBarBg}>
              <div style={{ ...styles.pityBarFill, width: `${pityPercent}%`, background: '#d4a574' }} />
            </div>
            <span style={styles.pityCount}>{pityCount}/{PITY_SOFT}</span>
          </div>
          <div style={styles.pityRow}>
            <span style={styles.pityLabel}>硬保底</span>
            <div style={styles.pityBarBg}>
              <div style={{ ...styles.pityBarFill, width: `${hardPercent}%`, background: '#C9A84C' }} />
            </div>
            <span style={styles.pityCount}>{hardCount}/{PITY_HARD}</span>
          </div>
        </div>

        {/* 招募按钮 */}
        <div style={styles.btnRow}>
          <button
            style={{
              ...styles.recruitBtn,
              ...(isRecruiting ? styles.recruitBtnDisabled : {}),
            }}
            disabled={isRecruiting}
            onClick={() => handleRecruit(1)}
          >
            {isRecruiting ? '招募中...' : '单抽'}
          </button>
          <button
            style={{
              ...styles.recruitBtn,
              ...styles.recruitBtnTen,
              ...(isRecruiting ? styles.recruitBtnDisabled : {}),
            }}
            disabled={isRecruiting}
            onClick={() => handleRecruit(10)}
          >
            {isRecruiting ? '招募中...' : '十连抽'}
          </button>
        </div>

        {/* 结果展示 */}
        {results && (
          <div style={styles.resultsSection}>
            <div style={styles.resultsTitle}>招募结果</div>
            <div style={styles.resultsGrid}>
              {results.results.map((r, i) => (
                <ResultCard key={`${r.general.id}-${i}`} result={r} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 样式
// ─────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  modal: {
    background: 'rgba(13, 17, 23, 0.98)',
    border: '1px solid rgba(212, 165, 116, 0.3)',
    borderRadius: '12px',
    width: '420px',
    maxWidth: '90vw',
    maxHeight: '85vh',
    overflowY: 'auto',
    padding: '16px',
    color: '#e8e0d0',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  title: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#d4a574',
  },
  closeBtn: {
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: '4px',
    background: 'transparent',
    color: '#a0a0a0',
    cursor: 'pointer',
  },
  typeSwitch: {
    display: 'flex',
    gap: '8px',
    marginBottom: '8px',
  },
  typeBtn: {
    flex: 1,
    padding: '8px',
    border: '1px solid rgba(212, 165, 116, 0.2)',
    borderRadius: '6px',
    background: 'transparent',
    color: '#a0a0a0',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  typeBtnActive: {
    borderColor: '#d4a574',
    color: '#d4a574',
    backgroundColor: 'rgba(212, 165, 116, 0.1)',
  },
  costInfo: {
    fontSize: '12px',
    color: '#a0a0a0',
    marginBottom: '12px',
  },
  pitySection: {
    marginBottom: '12px',
  },
  pityRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px',
  },
  pityLabel: {
    fontSize: '11px',
    color: '#a0a0a0',
    width: '48px',
  },
  pityBarBg: {
    flex: 1,
    height: '6px',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  pityBarFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  pityCount: {
    fontSize: '11px',
    color: '#a0a0a0',
    width: '48px',
    textAlign: 'right',
  },
  btnRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
  },
  recruitBtn: {
    flex: 1,
    padding: '10px',
    border: '1px solid rgba(212, 165, 116, 0.3)',
    borderRadius: '6px',
    background: 'transparent',
    color: '#d4a574',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  recruitBtnTen: {
    background: 'linear-gradient(135deg, #d4a574, #C9A84C)',
    color: '#1a1a2e',
    border: 'none',
  },
  recruitBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  resultsSection: {
    borderTop: '1px solid rgba(212, 165, 116, 0.2)',
    paddingTop: '12px',
  },
  resultsTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#d4a574',
    marginBottom: '8px',
  },
  resultsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
    gap: '6px',
  },
};

const resultStyles: Record<string, React.CSSProperties> = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '8px 6px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderLeft: '3px solid',
    borderRadius: '6px',
    animation: 'tk-fade-in 0.3s ease-out both',
  },
  quality: {
    fontSize: '10px',
    fontWeight: 700,
  },
  name: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#e8e0d0',
    textAlign: 'center',
  },
  duplicate: {
    fontSize: '10px',
    color: '#d4a017',
  },
};
