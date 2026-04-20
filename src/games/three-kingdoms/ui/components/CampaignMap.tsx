/**
 * 三国霸业 — 关卡地图组件
 *
 * 显示章节选择 + 关卡节点 + 星评显示：
 *   - 顶部章节选择 Tab
 *   - 关卡节点路径图（纵向滚动）
 *   - 每个节点显示名称、类型、星级、状态
 *   - 点击可挑战关卡触发战斗
 *
 * @module ui/components/CampaignMap
 */

import { useState, useMemo, useCallback } from 'react';
import { useGameContext } from '../context/GameContext';
import type { Chapter, Stage, StageStatus } from '../../engine/campaign/campaign.types';
import { MAX_STARS } from '../../engine/campaign/campaign.types';
import { StarRating } from '../../engine/battle/battle.types';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface CampaignMapProps {
  /** 点击关卡回调 */
  onStageClick?: (stageId: string) => void;
  /** 额外类名 */
  className?: string;
}

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 获取关卡状态 */
function getStageStatus(
  stageId: string,
  stageStates: Record<string, { stars: StarRating; firstCleared: boolean; clearCount: number }>,
  allStages: Stage[],
): StageStatus {
  const state = stageStates[stageId];
  if (state) {
    return state.stars >= 3 ? 'threeStar' : 'cleared';
  }
  // 检查前置关卡是否已通关
  const idx = allStages.findIndex((s) => s.id === stageId);
  if (idx === 0) return 'available';
  const prevStage = allStages[idx - 1];
  const prevState = stageStates[prevStage.id];
  if (prevState && prevState.firstCleared) return 'available';
  return 'locked';
}

/** 关卡类型图标 */
function getStageIcon(type: string): string {
  switch (type) {
    case 'elite': return '🔷';
    case 'boss': return '👹';
    default: return '⚔️';
  }
}

/** 状态对应颜色 */
function getStatusColor(status: StageStatus): string {
  switch (status) {
    case 'threeStar': return '#C9A84C';
    case 'cleared': return '#7EC850';
    case 'available': return '#5B9BD5';
    case 'locked': return '#555';
    default: return '#555';
  }
}

// ─────────────────────────────────────────────
// 子组件：星级显示
// ─────────────────────────────────────────────

function StarDisplay({ count }: { count: number }) {
  return (
    <span style={starStyles.container}>
      {Array.from({ length: MAX_STARS }, (_, i) => (
        <span
          key={i}
          style={{
            ...starStyles.star,
            color: i < count ? '#C9A84C' : '#444',
          }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

// ─────────────────────────────────────────────
// 子组件：关卡节点
// ─────────────────────────────────────────────

interface StageNodeProps {
  stage: Stage;
  status: StageStatus;
  stars: StarRating;
  onClick: (stageId: string) => void;
}

function StageNode({ stage, status, stars, onClick }: StageNodeProps) {
  const color = getStatusColor(status);
  const isLocked = status === 'locked';

  return (
    <div
      style={{
        ...nodeStyles.container,
        borderColor: color + '60',
        opacity: isLocked ? 0.45 : 1,
      }}
      onClick={() => !isLocked && onClick(stage.id)}
      role="button"
      tabIndex={isLocked ? -1 : 0}
      aria-label={`${stage.name} ${status}`}
    >
      {/* 连接线 */}
      <div style={{ ...nodeStyles.connector, backgroundColor: color + '30' }} />

      {/* 节点内容 */}
      <div style={nodeStyles.content}>
        <div style={nodeStyles.icon}>{getStageIcon(stage.type)}</div>
        <div style={nodeStyles.info}>
          <div style={{ ...nodeStyles.name, color }}>{stage.name}</div>
          <div style={nodeStyles.desc}>{stage.description}</div>
          {status !== 'locked' && status !== 'available' && (
            <StarDisplay count={stars} />
          )}
        </div>
        <div style={nodeStyles.power}>
          {stage.recommendedPower > 0 && (
            <span style={nodeStyles.powerText}>
              ⚔️{stage.recommendedPower}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

/**
 * CampaignMap — 关卡地图
 *
 * @example
 * ```tsx
 * <CampaignMap onStageClick={(id) => handleBattle(id)} />
 * ```
 */
export function CampaignMap({ onStageClick, className }: CampaignMapProps) {
  const { engine, snapshot } = useGameContext();
  const chapters = engine.getChapters();
  const [selectedChapterId, setSelectedChapterId] = useState(chapters[0]?.id ?? '');

  // 当前章节
  const currentChapter = useMemo(
    () => chapters.find((c) => c.id === selectedChapterId) ?? chapters[0],
    [chapters, selectedChapterId],
  );

  // 关卡状态
  const stageStates = useMemo(() => {
    if (!snapshot) return {} as Record<string, { stars: StarRating; firstCleared: boolean; clearCount: number }>;
    return snapshot.campaignProgress.stageStates;
  }, [snapshot]);

  const handleStageClick = useCallback(
    (stageId: string) => onStageClick?.(stageId),
    [onStageClick],
  );

  if (!snapshot) {
    return <div style={styles.loading}>加载中...</div>;
  }

  return (
    <div
      style={styles.container}
      className={`tk-campaign-map ${className ?? ''}`.trim()}
      role="region"
      aria-label="关卡地图"
    >
      {/* 章节选择 */}
      <div style={styles.chapterTabs}>
        {chapters.map((ch) => (
          <button
            key={ch.id}
            style={{
              ...styles.chapterTab,
              ...(ch.id === selectedChapterId ? styles.chapterTabActive : {}),
            }}
            onClick={() => setSelectedChapterId(ch.id)}
          >
            {ch.name}
          </button>
        ))}
      </div>

      {/* 章节信息 */}
      {currentChapter && (
        <div style={styles.chapterInfo}>
          <div style={styles.chapterSubtitle}>{currentChapter.subtitle}</div>
          <div style={styles.chapterDesc}>{currentChapter.description}</div>
        </div>
      )}

      {/* 关卡列表 */}
      <div style={styles.stageList}>
        {currentChapter?.stages.map((stage) => {
          const status = getStageStatus(stage.id, stageStates, currentChapter.stages);
          const state = stageStates[stage.id];
          return (
            <StageNode
              key={stage.id}
              stage={stage}
              status={status}
              stars={state?.stars ?? StarRating.NONE}
              onClick={handleStageClick}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 样式
// ─────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '12px',
    color: '#e8e0d0',
  },
  loading: {
    padding: '24px',
    textAlign: 'center',
    color: '#a0a0a0',
  },
  chapterTabs: {
    display: 'flex',
    gap: '4px',
    marginBottom: '12px',
    overflowX: 'auto',
  },
  chapterTab: {
    padding: '6px 12px',
    fontSize: '12px',
    border: '1px solid rgba(212, 165, 116, 0.2)',
    borderRadius: '6px',
    background: 'transparent',
    color: '#a0a0a0',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  },
  chapterTabActive: {
    borderColor: '#d4a574',
    color: '#d4a574',
    backgroundColor: 'rgba(212, 165, 116, 0.1)',
  },
  chapterInfo: {
    marginBottom: '12px',
    padding: '8px 12px',
    background: 'rgba(212, 165, 116, 0.06)',
    borderRadius: '6px',
  },
  chapterSubtitle: {
    fontSize: '13px',
    color: '#d4a574',
    fontWeight: 600,
  },
  chapterDesc: {
    fontSize: '11px',
    color: '#a0a0a0',
    marginTop: '4px',
    lineHeight: 1.4,
  },
  stageList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
  },
};

const nodeStyles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    border: '1px solid',
    borderRadius: '8px',
    margin: '0 8px',
    cursor: 'pointer',
    transition: 'border-color 0.15s ease',
  },
  connector: {
    position: 'absolute' as const,
    left: '24px',
    top: '-1px',
    width: '2px',
    height: '8px',
  },
  content: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
  },
  icon: {
    fontSize: '22px',
    flexShrink: 0,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: '14px',
    fontWeight: 600,
  },
  desc: {
    fontSize: '11px',
    color: '#a0a0a0',
    marginTop: '2px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  power: {
    flexShrink: 0,
  },
  powerText: {
    fontSize: '11px',
    color: '#d4a574',
    fontWeight: 600,
  },
};

const starStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'inline-flex',
    gap: '2px',
    marginTop: '4px',
  },
  star: {
    fontSize: '12px',
  },
};
