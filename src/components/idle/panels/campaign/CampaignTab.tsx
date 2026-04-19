/**
 * CampaignTab — 关卡Tab主面板
 *
 * 功能：
 * - 关卡地图：PC端横向卷轴，关卡节点按路径排列
 * - 章节切换：顶部章节选择器
 * - 关卡节点状态：未解锁(灰)/可挑战(亮)/已通关(绿)/三星(金)
 * - 点击可挑战关卡→打开战前布阵弹窗
 * - 底部显示当前进度（X/Y关，总星数）
 *
 * @module components/idle/panels/campaign/CampaignTab
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type {
  Chapter,
  Stage,
  StageStatus,
} from '@/games/three-kingdoms/engine/campaign/campaign.types';
import {
  STAGE_TYPE_LABELS,
  MAX_STARS,
} from '@/games/three-kingdoms/engine/campaign/campaign.types';
import type { BattleResult } from '@/games/three-kingdoms/engine/battle/battle.types';
import { BattleOutcome } from '@/games/three-kingdoms/engine/battle/battle.types';
import BattleFormationModal from './BattleFormationModal';
import BattleResultModal from './BattleResultModal';
import './CampaignTab.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface CampaignTabProps {
  engine: ThreeKingdomsEngine;
  snapshotVersion: number;
}

// ─────────────────────────────────────────────
// 关卡节点状态样式映射
// ─────────────────────────────────────────────
const STATUS_CLASS: Record<StageStatus, string> = {
  locked: 'tk-stage-node--locked',
  available: 'tk-stage-node--available',
  cleared: 'tk-stage-node--cleared',
  threeStar: 'tk-stage-node--three-star',
};

/** 关卡类型图标 */
const STAGE_TYPE_ICONS: Record<string, string> = {
  normal: '⚔️',
  elite: '💎',
  boss: '👹',
};

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const CampaignTab: React.FC<CampaignTabProps> = ({ engine, snapshotVersion }) => {
  // ── 数据获取 ──
  const chapters = useMemo(() => engine.getChapters(), [engine]);
  const campaignSystem = useMemo(() => engine.getCampaignSystem(), [engine]);

  // ── 当前选中章节 ──
  const [selectedChapterIdx, setSelectedChapterIdx] = useState(0);

  // ── 战前布阵弹窗 ──
  const [battleSetupStage, setBattleSetupStage] = useState<Stage | null>(null);

  // ── 扫荡结算弹窗 ──
  const [sweepResult, setSweepResult] = useState<BattleResult | null>(null);
  const [sweepStage, setSweepStage] = useState<Stage | null>(null);

  // ── 地图滚动容器 ──
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // ── 计算当前章节数据 ──
  const currentChapter = chapters[selectedChapterIdx] as Chapter | undefined;

  const { stages, progress, chapterStats } = useMemo(() => {
    void snapshotVersion;
    const ch = chapters[selectedChapterIdx];
    if (!ch) {
      return { stages: [] as Stage[], progress: engine.getCampaignProgress(), chapterStats: null };
    }
    const stageList = ch.stages;
    const prog = engine.getCampaignProgress();

    // 计算章节统计
    let cleared = 0;
    let totalStars = 0;
    let maxStars = 0;
    for (const s of stageList) {
      maxStars += MAX_STARS;
      const state = prog.stageStates[s.id];
      if (state) {
        if (state.stars > 0) cleared++;
        totalStars += state.stars;
      }
    }

    return {
      stages: stageList,
      progress: prog,
      chapterStats: { cleared, total: stageList.length, totalStars, maxStars },
    };
  }, [engine, chapters, selectedChapterIdx, snapshotVersion]);

  // ── 获取关卡状态 ──
  const getStageStatus = useCallback(
    (stageId: string): StageStatus => campaignSystem.getStageStatus(stageId),
    [campaignSystem],
  );

  // ── 获取关卡星级 ──
  const getStageStars = useCallback(
    (stageId: string): number => campaignSystem.getStageStars(stageId),
    [campaignSystem],
  );

  // ── 点击关卡节点 ──
  const handleStageClick = useCallback(
    (stage: Stage) => {
      const status = getStageStatus(stage.id);
      if (status === 'locked') return;
      setBattleSetupStage(stage);
    },
    [getStageStatus],
  );

  // ── 扫荡三星关卡 ──
  const handleSweep = useCallback(
    (stage: Stage) => {
      const result = engine.startBattle(stage.id);
      if (result.outcome === BattleOutcome.VICTORY) {
        engine.completeBattle(stage.id, result.stars as number);
      }
      setSweepResult(result);
      setSweepStage(stage);
    },
    [engine],
  );

  // ── 扫荡结算确认 ──
  const handleSweepResultConfirm = useCallback(() => {
    setSweepResult(null);
    setSweepStage(null);
  }, []);

  // ── 章节切换 ──
  const handleChapterChange = useCallback(
    (idx: number) => {
      if (idx >= 0 && idx < chapters.length) {
        setSelectedChapterIdx(idx);
      }
    },
    [chapters.length],
  );

  // ── 地图左右滚动 ──
  const handleScrollLeft = useCallback(() => {
    mapContainerRef.current?.scrollBy({ left: -200, behavior: 'smooth' });
  }, []);

  const handleScrollRight = useCallback(() => {
    mapContainerRef.current?.scrollBy({ left: 200, behavior: 'smooth' });
  }, []);

  // ── 关闭战前布阵弹窗 ──
  const handleCloseBattleSetup = useCallback(() => {
    setBattleSetupStage(null);
  }, []);

  // ── 渲染星级 ──
  const renderStars = (count: number, max: number = MAX_STARS) => {
    const stars: React.ReactNode[] = [];
    for (let i = 0; i < max; i++) {
      stars.push(
        <span
          key={i}
          className={`tk-stage-star ${i < count ? 'tk-stage-star--filled' : 'tk-stage-star--empty'}`}
        >
          ★
        </span>,
      );
    }
    return stars;
  };

  // ── 渲染关卡节点 ──
  const renderStageNode = (stage: Stage, index: number) => {
    const status = getStageStatus(stage.id);
    const stars = getStageStars(stage.id);
    const isClickable = status !== 'locked';
    const icon = STAGE_TYPE_ICONS[stage.type] || '⚔️';

    return (
      <div
        key={stage.id}
        className={`tk-stage-node ${STATUS_CLASS[status]}`}
        role="button"
        tabIndex={isClickable ? 0 : -1}
        onClick={() => handleStageClick(stage)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && isClickable) handleStageClick(stage);
        }}
        aria-label={`${stage.name} - ${status === 'locked' ? '未解锁' : status === 'available' ? '可挑战' : `已通关 ${stars}星`}`}
      >
        {/* 连接线（非第一个节点） */}
        {index > 0 && <div className="tk-stage-connector" />}

        {/* 节点圆形 */}
        <div className="tk-stage-node-circle">
          <span className="tk-stage-node-icon">{icon}</span>
          <span className="tk-stage-node-order">{stage.order}</span>
        </div>

        {/* 关卡名称 */}
        <div className="tk-stage-node-name">{stage.name}</div>

        {/* 关卡类型标签 */}
        <div className="tk-stage-node-type">{STAGE_TYPE_LABELS[stage.type]}</div>

        {/* 推荐战力 */}
        <div className="tk-stage-node-power">
          战力 {stage.recommendedPower.toLocaleString()}
        </div>

        {/* 星级显示（已通关） */}
        {status !== 'locked' && status !== 'available' && (
          <div className="tk-stage-node-stars">{renderStars(stars)}</div>
        )}

        {/* 扫荡按钮（三星通关） */}
        {status === 'threeStar' && (
          <button
            className="tk-stage-sweep-btn"
            onClick={(e) => { e.stopPropagation(); handleSweep(stage); }}
            aria-label={`扫荡 ${stage.name}`}
          >
            ⚡ 扫荡
          </button>
        )}

        {/* 未解锁遮罩 */}
        {status === 'locked' && <div className="tk-stage-node-lock">🔒</div>}
      </div>
    );
  };

  // ── 渲染章节选择器 ──
  const renderChapterSelector = () => (
    <div className="tk-chapter-selector">
      <button
        className="tk-chapter-arrow tk-chapter-arrow--left"
        onClick={() => handleChapterChange(selectedChapterIdx - 1)}
        disabled={selectedChapterIdx <= 0}
        aria-label="上一章"
      >
        ◀
      </button>

      <div className="tk-chapter-info">
        <span className="tk-chapter-title">
          第{currentChapter?.order || ''}章: {currentChapter?.name || ''}
        </span>
        {currentChapter?.subtitle && (
          <span className="tk-chapter-subtitle">{currentChapter.subtitle}</span>
        )}
      </div>

      <button
        className="tk-chapter-arrow tk-chapter-arrow--right"
        onClick={() => handleChapterChange(selectedChapterIdx + 1)}
        disabled={selectedChapterIdx >= chapters.length - 1}
        aria-label="下一章"
      >
        ▶
      </button>
    </div>
  );

  // ── 渲染进度条 ──
  const renderProgressBar = () => {
    if (!chapterStats) return null;
    const { cleared, total, totalStars, maxStars } = chapterStats;
    const percent = total > 0 ? (cleared / total) * 100 : 0;

    return (
      <div className="tk-campaign-progress">
        <div className="tk-campaign-progress-text">
          <span>进度 {cleared}/{total}关</span>
          <span className="tk-campaign-progress-stars">
            {renderStars(0, 0)}
            {' '}{totalStars}/{maxStars} ★
          </span>
        </div>
        <div className="tk-campaign-progress-bar">
          <div
            className="tk-campaign-progress-fill"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="tk-campaign-tab">
      {/* 章节选择器 */}
      {renderChapterSelector()}

      {/* 关卡地图区域 */}
      <div className="tk-campaign-map-wrapper">
        {/* 左箭头 */}
        <button
          className="tk-map-scroll-btn tk-map-scroll-btn--left"
          onClick={handleScrollLeft}
          aria-label="向左滚动"
        >
          ‹
        </button>

        {/* 地图滚动容器 */}
        <div className="tk-campaign-map" ref={mapContainerRef}>
          <div className="tk-campaign-map-track">
            {stages.map((stage, idx) => renderStageNode(stage, idx))}
          </div>
        </div>

        {/* 右箭头 */}
        <button
          className="tk-map-scroll-btn tk-map-scroll-btn--right"
          onClick={handleScrollRight}
          aria-label="向右滚动"
        >
          ›
        </button>
      </div>

      {/* 底部进度 */}
      {renderProgressBar()}

      {/* 战前布阵弹窗 */}
      {battleSetupStage && (
        <BattleFormationModal
          engine={engine}
          stage={battleSetupStage}
          onClose={handleCloseBattleSetup}
          snapshotVersion={snapshotVersion}
        />
      )}

      {/* 扫荡结算弹窗 */}
      {sweepResult && sweepStage && (
        <BattleResultModal
          result={sweepResult}
          stage={sweepStage}
          onConfirm={handleSweepResultConfirm}
        />
      )}
    </div>
  );
};

CampaignTab.displayName = 'CampaignTab';

export default CampaignTab;
