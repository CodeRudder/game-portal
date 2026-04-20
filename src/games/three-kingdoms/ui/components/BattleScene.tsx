/**
 * 三国霸业 — 战斗场景组件
 *
 * 自动战斗可视化，显示：
 *   - 我方/敌方队伍血条
 *   - 伤害数字弹出
 *   - 回合进度
 *   - 战斗结算面板（胜负/星级/统计）
 *
 * @module ui/components/BattleScene
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGameContext } from '../context/GameContext';
import type { BattleResult, BattleUnit } from '../../engine/battle/battle.types';
import { BattleOutcome, StarRating, BattlePhase } from '../../engine/battle/battle.types';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface BattleSceneProps {
  /** 关卡ID */
  stageId: string;
  /** 战斗结束回调 */
  onBattleEnd?: (result: BattleResult) => void;
  /** 关闭回调 */
  onClose?: () => void;
}

// ─────────────────────────────────────────────
// 子组件：血条
// ─────────────────────────────────────────────

function HealthBar({ current, max, side }: { current: number; max: number; side: 'ally' | 'enemy' }) {
  const pct = max > 0 ? Math.max((current / max) * 100, 0) : 0;
  const bgColor = side === 'ally' ? '#7EC850' : '#B8423A';

  return (
    <div style={hpStyles.container}>
      <div style={hpStyles.barBg}>
        <div style={{ ...hpStyles.barFill, width: `${pct}%`, backgroundColor: bgColor }} />
      </div>
      <span style={hpStyles.text}>{Math.max(0, Math.round(current))}/{max}</span>
    </div>
  );
}

// ─────────────────────────────────────────────
// 子组件：战斗单位卡片
// ─────────────────────────────────────────────

function UnitCard({ unit }: { unit: BattleUnit }) {
  const hpPct = unit.maxHp > 0 ? (unit.hp / unit.maxHp) * 100 : 0;
  const isDead = !unit.isAlive;

  return (
    <div style={{
      ...unitStyles.container,
      opacity: isDead ? 0.4 : 1,
    }}>
      <div style={unitStyles.name}>{unit.name}</div>
      <div style={unitStyles.hpBarBg}>
        <div style={{
          ...unitStyles.hpBarFill,
          width: `${hpPct}%`,
          backgroundColor: unit.side === 'ally' ? '#7EC850' : '#B8423A',
        }} />
      </div>
      {/* 怒气条 */}
      {unit.isAlive && (
        <div style={unitStyles.rageBarBg}>
          <div style={{
            ...unitStyles.rageBarFill,
            width: `${(unit.rage / unit.maxRage) * 100}%`,
          }} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 子组件：结算面板
// ─────────────────────────────────────────────

function SettlementPanel({ result, onClose }: { result: BattleResult; onClose: () => void }) {
  const isVictory = result.outcome === BattleOutcome.VICTORY;

  return (
    <div style={settlementStyles.overlay}>
      <div style={settlementStyles.panel}>
        <div style={{
          ...settlementStyles.title,
          color: isVictory ? '#C9A84C' : '#B8423A',
        }}>
          {isVictory ? '胜利' : '失败'}
        </div>

        {/* 星级 */}
        <div style={settlementStyles.stars}>
          {Array.from({ length: 3 }, (_, i) => (
            <span key={i} style={{
              fontSize: '28px',
              color: i < result.stars ? '#C9A84C' : '#444',
            }}>
              ★
            </span>
          ))}
        </div>

        {/* 统计 */}
        <div style={settlementStyles.stats}>
          <div style={settlementStyles.statRow}>
            <span>总回合数</span>
            <span style={settlementStyles.statValue}>{result.totalTurns}</span>
          </div>
          <div style={settlementStyles.statRow}>
            <span>我方存活</span>
            <span style={settlementStyles.statValue}>{result.allySurvivors}</span>
          </div>
          <div style={settlementStyles.statRow}>
            <span>我方总伤害</span>
            <span style={settlementStyles.statValue}>{result.allyTotalDamage.toLocaleString()}</span>
          </div>
          <div style={settlementStyles.statRow}>
            <span>最大单次伤害</span>
            <span style={settlementStyles.statValue}>{result.maxSingleDamage.toLocaleString()}</span>
          </div>
        </div>

        <button style={settlementStyles.btn} onClick={onClose}>
          确认
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

/**
 * BattleScene — 战斗场景
 *
 * @example
 * ```tsx
 * <BattleScene stageId="chapter1_stage1" onBattleEnd={(r) => console.log(r)} onClose={() => setShow(false)} />
 * ```
 */
export function BattleScene({ stageId, onBattleEnd, onClose }: BattleSceneProps) {
  const { engine } = useGameContext();
  const [phase, setPhase] = useState<'loading' | 'fighting' | 'settling'>('loading');
  const [result, setResult] = useState<BattleResult | null>(null);
  const [turn, setTurn] = useState(0);
  const [maxTurns] = useState(20);
  const hasRun = useRef(false);

  // 执行战斗
  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    // 短暂加载动画
    const loadTimer = setTimeout(() => {
      setPhase('fighting');
      setTurn(1);

      try {
        const battleResult = engine.startBattle(stageId);

        // 模拟回合推进动画
        const totalTurns = battleResult.totalTurns;
        let currentTurn = 0;

        const turnInterval = setInterval(() => {
          currentTurn++;
          setTurn(currentTurn);
          if (currentTurn >= totalTurns) {
            clearInterval(turnInterval);
            setResult(battleResult);
            setPhase('settling');
            onBattleEnd?.(battleResult);
          }
        }, 200);
      } catch {
        // 战斗失败（关卡未解锁等）
        setPhase('settling');
        setResult({
          outcome: BattleOutcome.DEFEAT,
          stars: StarRating.NONE,
          totalTurns: 0,
          allySurvivors: 0,
          enemySurvivors: 0,
          allyTotalDamage: 0,
          enemyTotalDamage: 0,
          maxSingleDamage: 0,
          maxCombo: 0,
          summary: '战斗失败',
        });
      }
    }, 500);

    return () => clearTimeout(loadTimer);
  }, [stageId, engine, onBattleEnd]);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  return (
    <div style={styles.container} role="region" aria-label="战斗场景">
      {/* 加载阶段 */}
      {phase === 'loading' && (
        <div style={styles.loadingOverlay}>
          <div style={styles.loadingText}>⚔️ 部阵中...</div>
        </div>
      )}

      {/* 战斗阶段 */}
      {phase === 'fighting' && (
        <div style={styles.battleArea}>
          {/* 回合信息 */}
          <div style={styles.turnInfo}>
            回合 {turn}/{maxTurns}
          </div>

          {/* 进度条 */}
          <div style={styles.progressBarBg}>
            <div style={{
              ...styles.progressBarFill,
              width: `${(turn / maxTurns) * 100}%`,
            }} />
          </div>

          {/* 战斗动画占位 */}
          <div style={styles.battleAnimation}>
            <div style={styles.fightingIcon}>⚔️</div>
            <div style={styles.fightingText}>战斗进行中...</div>
          </div>
        </div>
      )}

      {/* 结算阶段 */}
      {phase === 'settling' && result && (
        <SettlementPanel result={result} onClose={handleClose} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 样式
// ─────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(13, 17, 23, 0.98)',
    zIndex: 300,
    display: 'flex',
    flexDirection: 'column',
    color: '#e8e0d0',
  },
  loadingOverlay: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: '20px',
    color: '#d4a574',
    fontWeight: 600,
    animation: 'tk-fade-in 0.5s ease-out',
  },
  battleArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '16px',
  },
  turnInfo: {
    fontSize: '14px',
    color: '#d4a574',
    fontWeight: 600,
    textAlign: 'center',
    marginBottom: '8px',
  },
  progressBarBg: {
    width: '100%',
    height: '4px',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: '2px',
    overflow: 'hidden',
    marginBottom: '24px',
  },
  progressBarFill: {
    height: '100%',
    background: '#d4a574',
    borderRadius: '2px',
    transition: 'width 0.2s ease',
  },
  battleAnimation: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
  },
  fightingIcon: {
    fontSize: '48px',
  },
  fightingText: {
    fontSize: '16px',
    color: '#a0a0a0',
  },
};

const hpStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  barBg: {
    flex: 1,
    height: '6px',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  text: {
    fontSize: '10px',
    color: '#a0a0a0',
    whiteSpace: 'nowrap',
  },
};

const unitStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '6px 8px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '4px',
    transition: 'opacity 0.3s ease',
  },
  name: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#e8e0d0',
  },
  hpBarBg: {
    width: '100%',
    height: '4px',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  hpBarFill: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 0.3s ease',
  },
  rageBarBg: {
    width: '100%',
    height: '2px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '1px',
    overflow: 'hidden',
  },
  rageBarFill: {
    height: '100%',
    background: '#5B9BD5',
    borderRadius: '1px',
    transition: 'width 0.2s ease',
  },
};

const settlementStyles: Record<string, React.CSSProperties> = {
  overlay: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    background: 'rgba(13, 17, 23, 0.95)',
    border: '1px solid rgba(212, 165, 116, 0.3)',
    borderRadius: '12px',
    padding: '24px',
    width: '360px',
    maxWidth: '90vw',
    textAlign: 'center',
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    marginBottom: '12px',
  },
  stars: {
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '16px',
  },
  stats: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '16px',
    textAlign: 'left',
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    color: '#a0a0a0',
  },
  statValue: {
    color: '#e8e0d0',
    fontWeight: 600,
  },
  btn: {
    width: '100%',
    padding: '10px',
    border: 'none',
    borderRadius: '6px',
    background: 'linear-gradient(135deg, #d4a574, #C9A84C)',
    color: '#1a1a2e',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
