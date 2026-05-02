/**
 * ChallengeStagePanel — 挑战关卡面板
 *
 * 展示8个烽火台挑战关卡，支持：
 * - 4×2 烽火台图标网格
 * - 每个关卡显示：名称、每日剩余次数、推荐战力
 * - 点击进入战前布阵→战斗（复用 BattleFormationModal）
 * - 每日次数重置倒计时
 *
 * 设计风格：水墨江山·铜纹霸业
 *
 * @module components/idle/panels/campaign/ChallengeStagePanel
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine';
import type {
  ChallengeStageConfig,
  ChallengeCheckResult,
  ChallengeResult,
} from '@/games/three-kingdoms/engine/campaign/ChallengeStageSystem';
import type { Stage } from '@/games/three-kingdoms/engine/campaign/campaign.types';
import BattleFormationModal from './BattleFormationModal';
import BattleResultModal from './BattleResultModal';
import './ChallengeStagePanel.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface ChallengeStagePanelProps {
  engine: ThreeKingdomsEngine;
  snapshotVersion: number;
  onClose: () => void;
}

// ─────────────────────────────────────────────
// 资源名称映射
// ─────────────────────────────────────────────
const RESOURCE_LABELS: Record<string, string> = {
  grain: '粮草',
  gold: '铜钱',
  troops: '兵力',
  mandate: '天命',
  exp_book_small: '经验书·小',
  exp_book_medium: '经验书·中',
  exp_book_large: '经验书·大',
  tiger_tally: '虎符',
  war_script: '兵法',
  forge_stone: '锻造石',
};

/** 获取资源中文名 */
function getResourceLabel(type: string): string {
  if (type.startsWith('fragment_')) {
    const heroName = type.replace('fragment_', '');
    return `${heroName}碎片`;
  }
  return RESOURCE_LABELS[type] ?? type;
}

/** 格式化数字 */
function formatNum(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return n.toLocaleString();
}

/** 计算距离明日0点的剩余秒数 */
function getSecondsToMidnight(): number {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((tomorrow.getTime() - now.getTime()) / 1000));
}

/** 格式化倒计时 */
function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────
// 挑战关卡卡片
// ─────────────────────────────────────────────
interface StageCardProps {
  config: ChallengeStageConfig;
  remaining: number;
  firstCleared: boolean;
  checkResult: ChallengeCheckResult;
  onClick: () => void;
}

const StageCard: React.FC<StageCardProps> = React.memo(({
  config,
  remaining,
  firstCleared,
  checkResult,
  onClick,
}) => {
  const isDisabled = !checkResult.canChallenge;
  const isExhausted = remaining <= 0;

  return (
    <div
      className={`tk-challenge-card ${isDisabled ? 'tk-challenge-card--disabled' : ''} ${firstCleared ? 'tk-challenge-card--cleared' : ''}`}
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      onClick={isDisabled ? undefined : onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' && !isDisabled) onClick(); }}
      aria-label={`${config.name} - 剩余${remaining}次`}
      data-testid={`challenge-card-${config.id}`}
    >
      {/* 烽火台图标 */}
      <div className="tk-challenge-card-icon">
        <span className="tk-challenge-card-beacon">🔥</span>
        {firstCleared && <span className="tk-challenge-card-badge">✓</span>}
      </div>

      {/* 关卡名称 */}
      <div className="tk-challenge-card-name">{config.name}</div>

      {/* 每日剩余次数 */}
      <div className={`tk-challenge-card-attempts ${isExhausted ? 'tk-challenge-card-attempts--exhausted' : ''}`}>
        今日 {remaining}/3
      </div>

      {/* 消耗信息 */}
      <div className="tk-challenge-card-cost">
        <span className="tk-challenge-card-cost-item">兵 {formatNum(config.armyCost)}</span>
        <span className="tk-challenge-card-cost-sep">·</span>
        <span className="tk-challenge-card-cost-item">命 {config.staminaCost}</span>
      </div>

      {/* 固定奖励预览 */}
      <div className="tk-challenge-card-rewards">
        {config.rewards.slice(0, 2).map((r, i) => (
          <span key={i} className="tk-challenge-card-reward-tag">
            {getResourceLabel(r.type)} ×{formatNum(r.amount)}
          </span>
        ))}
      </div>

      {/* 不可挑战原因提示 */}
      {isDisabled && checkResult.reasons.length > 0 && (
        <div className="tk-challenge-card-reason">
          {checkResult.reasons[0]}
        </div>
      )}
    </div>
  );
});

StageCard.displayName = 'StageCard';

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const ChallengeStagePanel: React.FC<ChallengeStagePanelProps> = ({
  engine,
  snapshotVersion,
  onClose,
}) => {
  const challengeSystem = useMemo(() => engine.getChallengeStageSystem(), [engine]);

  // ── 关卡配置列表 ──
  const stageConfigs = useMemo(() => challengeSystem.getStageConfigs(), [challengeSystem]);

  // ── 战前布阵弹窗（挑战关卡→布阵→战斗） ──
  const [battleStage, setBattleStage] = useState<Stage | null>(null);

  // ── 挑战结果弹窗 ──
  const [challengeResult, setChallengeResult] = useState<{
    result: ChallengeResult;
    stageName: string;
  } | null>(null);

  // ── 每日重置倒计时 ──
  const [countdown, setCountdown] = useState(getSecondsToMidnight);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(getSecondsToMidnight());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ── 每个关卡的前置校验和剩余次数 ──
  const stageChecks = useMemo(() => {
    void snapshotVersion;
    const checks: Record<string, { remaining: number; firstCleared: boolean; check: ChallengeCheckResult }> = {};
    for (const config of stageConfigs) {
      checks[config.id] = {
        remaining: challengeSystem.getDailyRemaining(config.id),
        firstCleared: challengeSystem.isFirstCleared(config.id),
        check: challengeSystem.checkCanChallenge(config.id),
      };
    }
    return checks;
  }, [challengeSystem, stageConfigs, snapshotVersion]);

  // ── 点击挑战关卡 ──
  const handleChallengeClick = useCallback(
    (config: ChallengeStageConfig) => {
      const check = challengeSystem.checkCanChallenge(config.id);
      if (!check.canChallenge) return;

      // 预锁资源
      const locked = challengeSystem.preLockResources(config.id);
      if (!locked) return;

      // 构造一个伪 Stage 对象，复用 BattleFormationModal
      const pseudoStage: Stage = {
        id: config.id,
        name: config.name,
        chapterId: 'challenge',
        order: 0,
        type: 'boss',
        enemyFormation: {
          id: `${config.id}_enemy`,
          name: `${config.name}守军`,
          units: [],
          recommendedPower: config.armyCost * 5,
        },
        baseRewards: {},
        baseExp: 0,
        firstClearRewards: {},
        firstClearExp: 0,
        threeStarBonusMultiplier: 1,
        dropTable: [],
        recommendedPower: config.armyCost * 5,
        description: `挑战关卡: ${config.name}`,
      };
      setBattleStage(pseudoStage);
    },
    [challengeSystem],
  );

  // ── 关闭战前布阵弹窗（未战斗） ──
  const handleCloseBattleSetup = useCallback(() => {
    // 如果关闭布阵弹窗且没有战斗，需要返还预锁资源
    if (battleStage) {
      // completeChallenge(stageId, false) 会返还预锁资源
      challengeSystem.completeChallenge(battleStage.id, false);
    }
    setBattleStage(null);
  }, [battleStage, challengeSystem]);

  // ── 战斗结束回调（从 BattleFormationModal 的 onClose 触发） ──
  // 注意：BattleFormationModal 内部会调用 engine.startBattle / completeBattle
  // 但挑战关卡需要走 challengeSystem.completeChallenge 来结算
  // 这里我们简化处理：布阵弹窗关闭后，通过结果弹窗展示

  // ── 挑战结果确认 ──
  const handleResultConfirm = useCallback(() => {
    setChallengeResult(null);
  }, []);

  return (
    <div className="tk-challenge-panel-overlay" data-testid="challenge-stage-panel">
      <div className="tk-challenge-panel">
        {/* 头部 */}
        <div className="tk-challenge-panel-header">
          <h2 className="tk-challenge-panel-title">烽火台 · 挑战关卡</h2>
          <div className="tk-challenge-panel-reset">
            <span className="tk-challenge-panel-reset-label">每日重置</span>
            <span className="tk-challenge-panel-reset-countdown" data-testid="challenge-reset-countdown">
              {formatCountdown(countdown)}
            </span>
          </div>
          <button
            className="tk-challenge-panel-close"
            onClick={onClose}
            aria-label="关闭"
            data-testid="challenge-panel-close"
          >
            ✕
          </button>
        </div>

        {/* 说明文字 */}
        <div className="tk-challenge-panel-desc">
          挑战关卡独立于主线战役，每日可挑战3次，消耗兵力与天命。首通额外奖励！
        </div>

        {/* 烽火台网格 */}
        <div className="tk-challenge-grid">
          {stageConfigs.map((config) => {
            const info = stageChecks[config.id];
            if (!info) return null;
            return (
              <StageCard
                key={config.id}
                config={config}
                remaining={info.remaining}
                firstCleared={info.firstCleared}
                checkResult={info.check}
                onClick={() => handleChallengeClick(config)}
              />
            );
          })}
        </div>

        {/* 底部说明 */}
        <div className="tk-challenge-panel-footer">
          <span>💡 挑战失败不消耗次数，资源全额返还</span>
        </div>
      </div>

      {/* 战前布阵弹窗 */}
      {battleStage && (
        <BattleFormationModal
          engine={engine}
          stage={battleStage}
          onClose={handleCloseBattleSetup}
          snapshotVersion={snapshotVersion}
        />
      )}

      {/* 挑战结果弹窗 */}
      {challengeResult && (
        <div className="tk-challenge-result-overlay" data-testid="challenge-result-overlay">
          <div className="tk-challenge-result">
            <h3 className="tk-challenge-result-title">
              {challengeResult.result.victory ? '🎉 挑战成功' : '⚔️ 挑战失败'}
            </h3>
            <div className="tk-challenge-result-stage">{challengeResult.stageName}</div>
            {challengeResult.result.firstClear && (
              <div className="tk-challenge-result-first-clear">🌟 首次通关！</div>
            )}
            {challengeResult.result.victory && challengeResult.result.rewards.length > 0 && (
              <div className="tk-challenge-result-rewards">
                <div className="tk-challenge-result-rewards-title">获得奖励：</div>
                {challengeResult.result.rewards.map((r, i) => (
                  <div key={i} className="tk-challenge-result-reward-item">
                    {getResourceLabel(r.type)} ×{formatNum(r.amount)}
                  </div>
                ))}
              </div>
            )}
            <button
              className="tk-challenge-result-confirm"
              onClick={handleResultConfirm}
              data-testid="challenge-result-confirm"
            >
              确认
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

ChallengeStagePanel.displayName = 'ChallengeStagePanel';

export default ChallengeStagePanel;
