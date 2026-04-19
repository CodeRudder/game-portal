/**
 * RecruitModal — 招募弹窗
 *
 * 功能：
 * - 选择普通/高级招募
 * - 选择单抽/十连
 * - 消耗显示
 * - 结果展示（品质揭示动画）
 *   - 普通 → 淡入
 *   - 精良 → 蓝色闪光
 *   - 稀有 → 紫色脉冲
 *   - 史诗 → 红色爆发
 *   - 传说 → 金色光芒
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { RecruitType, RecruitOutput, RecruitResult, Quality } from '@/games/three-kingdoms/engine';
import { QUALITY_LABELS, QUALITY_BORDER_COLORS } from '@/games/three-kingdoms/engine';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import { Toast } from '@/components/idle/common/Toast';
import './RecruitModal.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface RecruitModalProps {
  /** 引擎实例 */
  engine: ThreeKingdomsEngine;
  /** 关闭回调 */
  onClose: () => void;
  /** 招募完成后回调 */
  onRecruitComplete?: () => void;
}

// ─────────────────────────────────────────────
// 招募类型标签
// ─────────────────────────────────────────────
const RECRUIT_TYPE_LABELS: Record<RecruitType, string> = {
  normal: '普通招贤',
  advanced: '高级招贤',
};

const RECRUIT_TYPE_DESC: Record<RecruitType, string> = {
  normal: '消耗铜钱，概率获得武将',
  advanced: '消耗求贤令，更高品质概率',
};

const RECRUIT_TYPE_ICONS: Record<RecruitType, string> = {
  normal: '📜',
  advanced: '🏆',
};

// ─────────────────────────────────────────────
// 品质揭示动画 CSS class 映射
// ─────────────────────────────────────────────
const QUALITY_REVEAL_ANIM: Record<Quality, string> = {
  COMMON: 'tk-reveal-common',
  FINE: 'tk-reveal-fine',
  RARE: 'tk-reveal-rare',
  EPIC: 'tk-reveal-epic',
  LEGENDARY: 'tk-reveal-legendary',
};

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const RecruitModal: React.FC<RecruitModalProps> = ({ engine, onClose, onRecruitComplete }) => {
  const [recruitType, setRecruitType] = useState<RecruitType>('normal');
  const [results, setResults] = useState<RecruitOutput | null>(null);
  const [isRecruiting, setIsRecruiting] = useState(false);
  const [revealPhase, setRevealPhase] = useState(false);

  const recruitSystem = engine.getRecruitSystem();

  // 计算消耗
  const singleCost = useMemo(() => recruitSystem.getRecruitCost(recruitType, 1), [recruitSystem, recruitType]);
  const tenCost = useMemo(() => recruitSystem.getRecruitCost(recruitType, 10), [recruitSystem, recruitType]);

  // 检查资源是否充足
  const canSingle = useMemo(() => recruitSystem.canRecruit(recruitType, 1), [recruitSystem, recruitType]);
  const canTen = useMemo(() => recruitSystem.canRecruit(recruitType, 10), [recruitSystem, recruitType]);

  // 保底进度
  const pityInfo = useMemo(() => {
    const state = recruitSystem.getGachaState();
    const isNormal = recruitType === 'normal';
    const tenPity = isNormal ? state.normalPity : state.advancedPity;
    const hardPity = isNormal ? state.normalHardPity : state.advancedHardPity;
    return {
      tenPull: { current: tenPity, max: 10 },
      hardPity: { current: hardPity, max: 50 },
    };
  }, [recruitSystem, recruitType]);

  // 执行招募
  const handleRecruit = useCallback((count: 1 | 10) => {
    setIsRecruiting(true);
    setRevealPhase(false);
    try {
      const output = engine.recruit(recruitType, count);
      if (output) {
        setResults(output);
        setRevealPhase(true);
        onRecruitComplete?.();
      } else {
        Toast.danger('资源不足，无法招募');
      }
    } catch (e: any) {
      Toast.danger(e?.message || '招募失败');
    } finally {
      setIsRecruiting(false);
    }
  }, [engine, recruitType, onRecruitComplete]);

  // 关闭结果面板
  const handleCloseResults = useCallback(() => {
    setResults(null);
    setRevealPhase(false);
  }, []);

  // 资源名称映射
  const resourceNameMap: Record<string, string> = {
    gold: '铜钱',
    recruitToken: '求贤令',
  };

  return (
    <div className="tk-recruit-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tk-recruit-modal" role="dialog" aria-modal="true" aria-label="招募武将">
        {/* 关闭按钮 */}
        <button className="tk-recruit-close" onClick={onClose} aria-label="关闭">✕</button>

        {/* 标题 */}
        <div className="tk-recruit-header">
          <h3 className="tk-recruit-title">⚔️ 招贤纳士</h3>
        </div>

        {/* 招募类型选择 */}
        <div className="tk-recruit-types">
          {(['normal', 'advanced'] as RecruitType[]).map((type) => (
            <button
              key={type}
              className={`tk-recruit-type-btn ${recruitType === type ? 'tk-recruit-type-btn--active' : ''}`}
              onClick={() => { setRecruitType(type); setResults(null); setRevealPhase(false); }}
            >
              <span className="tk-recruit-type-icon">{RECRUIT_TYPE_ICONS[type]}</span>
              <span className="tk-recruit-type-label">{RECRUIT_TYPE_LABELS[type]}</span>
              <span className="tk-recruit-type-desc">{RECRUIT_TYPE_DESC[type]}</span>
            </button>
          ))}
        </div>

        {/* 保底进度 */}
        <div className="tk-recruit-pity">
          <div className="tk-recruit-pity-item">
            <span className="tk-recruit-pity-label">十连保底（稀有+）</span>
            <div className="tk-recruit-pity-bar">
              <div
                className="tk-recruit-pity-fill tk-recruit-pity-fill--ten"
                style={{ width: `${(pityInfo.tenPull.current / pityInfo.tenPull.max) * 100}%` }}
              />
            </div>
            <span className="tk-recruit-pity-count">
              {pityInfo.tenPull.current}/{pityInfo.tenPull.max}
            </span>
          </div>
          <div className="tk-recruit-pity-item">
            <span className="tk-recruit-pity-label">硬保底（史诗+）</span>
            <div className="tk-recruit-pity-bar">
              <div
                className="tk-recruit-pity-fill tk-recruit-pity-fill--hard"
                style={{ width: `${(pityInfo.hardPity.current / pityInfo.hardPity.max) * 100}%` }}
              />
            </div>
            <span className="tk-recruit-pity-count">
              {pityInfo.hardPity.current}/{pityInfo.hardPity.max}
            </span>
          </div>
        </div>

        {/* 消耗 + 按钮 */}
        <div className="tk-recruit-actions">
          {/* 单抽 */}
          <div className="tk-recruit-action-item">
            <div className="tk-recruit-cost">
              {resourceNameMap[singleCost.resourceType] || singleCost.resourceType} ×{singleCost.amount}
            </div>
            <button
              className="tk-recruit-btn"
              disabled={!canSingle || isRecruiting}
              onClick={() => handleRecruit(1)}
            >
              {isRecruiting ? '招募中...' : '单次招募'}
            </button>
          </div>

          {/* 十连 */}
          <div className="tk-recruit-action-item">
            <div className="tk-recruit-cost">
              {resourceNameMap[tenCost.resourceType] || tenCost.resourceType} ×{tenCost.amount}
            </div>
            <button
              className="tk-recruit-btn tk-recruit-btn--ten"
              disabled={!canTen || isRecruiting}
              onClick={() => handleRecruit(10)}
            >
              {isRecruiting ? '招募中...' : '十连招募'}
            </button>
          </div>
        </div>

        {/* 招募结果 */}
        {results && (
          <div className="tk-recruit-results">
            <div className="tk-recruit-results-header">
              <span>招募结果</span>
              <div className="tk-recruit-results-total-cost">
                总计消耗: {resourceNameMap[results.cost.resourceType] || results.cost.resourceType} ×{results.cost.amount}
              </div>
              <button className="tk-recruit-results-close" onClick={handleCloseResults}>✕</button>
            </div>
            <div className="tk-recruit-results-grid">
              {results.results.map((result, idx) => (
                <RecruitResultCard
                  key={`${result.general?.id ?? idx}-${idx}`}
                  result={result}
                  reveal={revealPhase}
                  delay={idx * 80}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// 招募结果卡片子组件（含品质揭示动画）
// ─────────────────────────────────────────────
interface RecruitResultCardProps {
  result: RecruitResult;
  reveal: boolean;
  delay: number;
}

const RecruitResultCard: React.FC<RecruitResultCardProps> = ({ result, reveal, delay }) => {
  const qualityLabel = QUALITY_LABELS[result.quality];
  const borderColor = QUALITY_BORDER_COLORS[result.quality];
  const animClass = QUALITY_REVEAL_ANIM[result.quality];

  return (
    <div
      className={`tk-recruit-result-card ${animClass} ${reveal ? 'tk-recruit-result-card--revealed' : ''}`}
      style={{
        borderColor,
        animationDelay: reveal ? `${delay}ms` : undefined,
      }}
    >
      {/* 品质揭示光效层 */}
      <div className="tk-recruit-result-glow" style={{ background: borderColor }} />

      <div className="tk-recruit-result-quality" style={{ background: borderColor }}>
        {qualityLabel}
      </div>
      <div className="tk-recruit-result-name">
        {result.general?.name ?? '???'}
      </div>
      {result.isDuplicate ? (
        <div className="tk-recruit-result-dup">
          已拥有 → 碎片×{result.fragmentCount}
        </div>
      ) : (
        <div className="tk-recruit-result-new">✨ 新获得</div>
      )}
    </div>
  );
};

RecruitModal.displayName = 'RecruitModal';

export default RecruitModal;
