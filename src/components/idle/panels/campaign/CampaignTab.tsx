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
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine';
import type {
  Chapter,
  Stage,
  StageStatus,
} from '@/games/three-kingdoms/engine';
import {
  STAGE_TYPE_LABELS,
  MAX_STARS,
} from '@/games/three-kingdoms/engine';
import type { BattleResult } from '@/games/three-kingdoms/engine';
import { BattleOutcome } from '@/games/three-kingdoms/engine';
import BattleFormationModal from './BattleFormationModal';
import BattleResultModal from './BattleResultModal';
import SweepModal from './SweepModal';
import ChallengeStagePanel from './ChallengeStagePanel';
import OfflinePushPanel from './OfflinePushPanel';
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

  // ── 扫荡弹窗 ──
  const [sweepTarget, setSweepTarget] = useState<Stage | null>(null);

  // ── 扫荡结算弹窗 ──
  const [sweepResult, setSweepResult] = useState<BattleResult | null>(null);
  const [sweepStage, setSweepStage] = useState<Stage | null>(null);

  // ── 挑战关卡面板 ──
  const [showChallengePanel, setShowChallengePanel] = useState(false);

  // ── 离线推图面板 ──
  const [showOfflinePushPanel, setShowOfflinePushPanel] = useState(false);

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

  // ── 扫荡三星关卡（打开SweepModal让玩家选择次数） ──
  const handleSweep = useCallback(
    (stage: Stage) => {
      setSweepTarget(stage);
    },
    [],
  );

  // ── SweepModal 执行扫荡回调 ──
  const handleSweepExecute = useCallback(
    (stageId: string, count: number) => {
      try {
        const sweepSystem = engine.getSweepSystem?.();
        if (sweepSystem?.sweep) {
          const batchResult = sweepSystem.sweep(stageId, count);
          if (!batchResult.success) {
            console.warn('扫荡失败:', batchResult.failureReason ?? '未知原因');
            return batchResult;
          }
          // 将 SweepBatchResult 转换为 BattleResult 格式以复用弹窗
          const result: BattleResult = {
            outcome: BattleOutcome.VICTORY,
            stars: 3 as any,
            totalTurns: batchResult.executedCount ?? count,
            allySurvivors: 0,
            enemySurvivors: 0,
            allyTotalDamage: 0,
            enemyTotalDamage: 0,
            maxSingleDamage: 0,
            maxCombo: 0,
            summary: `扫荡成功！执行${batchResult.executedCount ?? count}次，消耗${batchResult.ticketsUsed}扫荡令`,
            fragmentRewards: batchResult.totalFragments ?? {},
          };
          setSweepResult(result);
          const stage = sweepTarget;
          if (stage) setSweepStage(stage);
          setSweepTarget(null);
          return batchResult;
        } else {
          // 降级：走普通战斗流程
          const result = engine.startBattle(stageId);
          if (result.outcome === BattleOutcome.VICTORY) {
            engine.completeBattle(stageId, result.stars as number);
          }
          setSweepResult(result);
          const stage = sweepTarget;
          if (stage) setSweepStage(stage);
          setSweepTarget(null);
          return null as any;
        }
      } catch (e) {
        console.error('扫荡失败:', e);
        setSweepTarget(null);
        return null as any;
      }
    },
    [engine, sweepTarget],
  );

  // ── 关闭 SweepModal ──
  const handleCloseSweepModal = useCallback(() => {
    setSweepTarget(null);
  }, []);

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
            data-testid="sweep-btn"
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
    <div className="tk-chapter-selector" data-testid="chapter-selector">
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
            {renderStars(totalStars, maxStars)}
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
    <div className="tk-campaign-tab" data-testid="campaign-tab">
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

      {/* 底部功能入口 */}
      <div className="tk-campaign-bottom-actions">
        <button
          className="tk-campaign-action-btn tk-campaign-action-btn--challenge"
          onClick={() => setShowChallengePanel(true)}
          data-testid="btn-open-challenge-panel"
        >
          🔥 烽火台
        </button>
        <button
          className="tk-campaign-action-btn tk-campaign-action-btn--offline"
          onClick={() => setShowOfflinePushPanel(true)}
          data-testid="btn-open-offline-push"
        >
          ⏳ 离线推图
        </button>
      </div>

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

      {/* 扫荡弹窗（选择次数） */}
      {sweepTarget && (
        <SweepModal
          stageId={sweepTarget.id}
          stageName={sweepTarget.name}
          chapterName={currentChapter?.name ?? ''}
          stars={getStageStars(sweepTarget.id)}
          ticketCount={(() => {
            try {
              const sweepSystem = engine.getSweepSystem?.();
              return sweepSystem?.getTicketCount?.() ?? 0;
            } catch { return 0; }
          })()}
          canSweep={getStageStars(sweepTarget.id) >= 3}
          onClose={handleCloseSweepModal}
          onSweep={handleSweepExecute}
        />
      )}

      {/* 挑战关卡面板 */}
      {showChallengePanel && (
        <ChallengeStagePanel
          engine={engine}
          snapshotVersion={snapshotVersion}
          onClose={() => setShowChallengePanel(false)}
        />
      )}

      {/* 离线推图面板 */}
      {showOfflinePushPanel && (
        <OfflinePushPanel
          engine={engine}
          snapshotVersion={snapshotVersion}
          onClose={() => setShowOfflinePushPanel(false)}
        />
      )}
    </div>
  );
};

CampaignTab.displayName = 'CampaignTab';

export default CampaignTab;
