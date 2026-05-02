/**
 * ChapterSelectPanel — 章节选择面板
 *
 * 替代原有简单箭头切换，提供更直观的章节选择体验。
 *
 * 功能：
 * - 6个章节卡片横向排列（黄巾之乱→讨伐董卓→...→一统天下）
 * - 每个卡片显示：章节名、关卡数、完成进度（如 8/12）、星级汇总
 * - 当前章节高亮，已通关章节显示✓，未解锁章节灰显
 * - 点击切换到对应章节
 * - 响应式：PC端横排，手机端可横向滚动
 *
 * 设计风格：水墨江山·铜纹霸业（三国古风，无neon/glow/脉冲）
 *
 * @module components/idle/panels/campaign/ChapterSelectPanel
 */

import React, { useMemo, useCallback } from 'react';
import type { Chapter, StageStatus } from '@/games/three-kingdoms/engine';
import { MAX_STARS } from '@/games/three-kingdoms/engine';
import styles from './ChapterSelectPanel.module.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
export interface ChapterSelectPanelProps {
  /** 所有章节配置 */
  chapters: Chapter[];
  /** 当前选中章节索引 */
  selectedIdx: number;
  /** 切换章节回调 */
  onSelect: (idx: number) => void;
  /** 获取关卡状态 */
  getStageStatus: (stageId: string) => StageStatus;
  /** 获取关卡星级 */
  getStageStars: (stageId: string) => number;
}

// ─────────────────────────────────────────────
// 章节状态枚举
// ─────────────────────────────────────────────
type ChapterCardStatus = 'current' | 'completed' | 'locked';

// ─────────────────────────────────────────────
// 章节进度计算
// ─────────────────────────────────────────────
interface ChapterProgress {
  /** 已通关关卡数 */
  cleared: number;
  /** 总关卡数 */
  total: number;
  /** 已获得星级 */
  totalStars: number;
  /** 最大可获星级 */
  maxStars: number;
  /** 章节状态 */
  status: ChapterCardStatus;
}

/**
 * 计算单个章节的进度信息
 */
function computeChapterProgress(
  chapter: Chapter,
  isSelected: boolean,
  getStageStatus: (stageId: string) => StageStatus,
  getStageStars: (stageId: string) => number,
): ChapterProgress {
  let cleared = 0;
  let totalStars = 0;
  let maxStars = 0;
  let hasAvailable = false;

  for (const stage of chapter.stages) {
    maxStars += MAX_STARS;
    const status = getStageStatus(stage.id);
    const stars = getStageStars(stage.id);

    if (status === 'cleared' || status === 'threeStar') {
      cleared++;
      totalStars += stars;
    } else if (status === 'available') {
      hasAvailable = true;
    }
  }

  // 判断章节状态
  const allCleared = cleared === chapter.stages.length && chapter.stages.length > 0;
  let status: ChapterCardStatus;

  if (isSelected) {
    status = 'current';
  } else if (allCleared) {
    status = 'completed';
  } else if (hasAvailable || cleared > 0 || chapter.prerequisiteChapterId === null) {
    // 有可挑战关卡，或有已通关关卡，或第1章 → 视为已解锁
    status = 'completed'; // 非当前但已解锁
  } else {
    status = 'locked';
  }

  // 更精确的锁定判断：如果该章第一关是locked且没有任何已通关关卡，则章节锁定
  const firstStageStatus = chapter.stages.length > 0
    ? getStageStatus(chapter.stages[0].id)
    : 'locked';
  if (firstStageStatus === 'locked' && cleared === 0 && !isSelected) {
    status = 'locked';
  }

  return { cleared, total: chapter.stages.length, totalStars, maxStars, status };
}

// ─────────────────────────────────────────────
// 章节卡片组件
// ─────────────────────────────────────────────
interface ChapterCardProps {
  chapter: Chapter;
  progress: ChapterProgress;
  isSelected: boolean;
  onClick: () => void;
}

const ChapterCard: React.FC<ChapterCardProps> = React.memo(({
  chapter,
  progress,
  isSelected,
  onClick,
}) => {
  const { cleared, total, totalStars, maxStars, status } = progress;
  const isLocked = status === 'locked';
  const isCompleted = status === 'completed' && !isSelected;
  const percent = total > 0 ? (cleared / total) * 100 : 0;

  // 星级汇总文本（如 "12/18"）
  const starsText = `${totalStars}/${maxStars}`;

  return (
    <button
      className={[
        styles.card,
        isSelected ? styles.cardCurrent : '',
        isCompleted ? styles.cardCompleted : '',
        isLocked ? styles.cardLocked : '',
      ].filter(Boolean).join(' ')}
      onClick={onClick}
      disabled={isLocked}
      aria-label={`第${chapter.order}章 ${chapter.name}${isLocked ? '（未解锁）' : isSelected ? '（当前）' : ''}`}
      data-testid={`chapter-card-${chapter.id}`}
    >
      {/* 章节序号角标 */}
      <span className={styles.cardOrder}>
        {isCompleted ? '✓' : chapter.order}
      </span>

      {/* 章节名称 */}
      <span className={styles.cardName}>{chapter.name}</span>

      {/* 副标题 */}
      <span className={styles.cardSubtitle}>{chapter.subtitle}</span>

      {/* 进度信息 */}
      <span className={styles.cardProgress}>
        {cleared}/{total}关
      </span>

      {/* 星级汇总 */}
      <span className={styles.cardStars}>
        ★ {starsText}
      </span>

      {/* 进度条 */}
      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${percent}%` }}
        />
      </div>
    </button>
  );
});

ChapterCard.displayName = 'ChapterCard';

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const ChapterSelectPanel: React.FC<ChapterSelectPanelProps> = ({
  chapters,
  selectedIdx,
  onSelect,
  getStageStatus,
  getStageStars,
}) => {
  // 计算每个章节的进度
  const chapterProgressList = useMemo(() => {
    return chapters.map((chapter, idx) =>
      computeChapterProgress(
        chapter,
        idx === selectedIdx,
        getStageStatus,
        getStageStars,
      ),
    );
  }, [chapters, selectedIdx, getStageStatus, getStageStars]);

  // 点击卡片
  const handleClick = useCallback(
    (idx: number) => {
      if (idx !== selectedIdx) {
        onSelect(idx);
      }
    },
    [selectedIdx, onSelect],
  );

  return (
    <div className={styles.panel} data-testid="chapter-select-panel">
      <div className={styles.scrollTrack}>
        {chapters.map((chapter, idx) => (
          <ChapterCard
            key={chapter.id}
            chapter={chapter}
            progress={chapterProgressList[idx]}
            isSelected={idx === selectedIdx}
            onClick={() => handleClick(idx)}
          />
        ))}
      </div>
    </div>
  );
};

ChapterSelectPanel.displayName = 'ChapterSelectPanel';

export default ChapterSelectPanel;
