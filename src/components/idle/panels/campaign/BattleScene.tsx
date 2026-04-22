/**
 * BattleScene — 全屏战斗场景主组件
 *
 * 功能：
 * - 全屏覆盖主界面，展示战斗过程
 * - 我方武将左侧（前排3+后排3），敌方右侧
 * - 每个武将显示：头像/名称/血条/怒气条
 * - 回合数显示、战斗速度控制（1x/2x）、跳过按钮
 * - 战斗结束自动关闭，触发结算
 * - 完整战斗动画：攻击前冲、受击闪烁、伤害飘字、暴击震动、死亡倒下、技能发光
 *
 * 动画逻辑拆分至 BattleAnimation.tsx（useBattleAnimation hook）。
 *
 * @module components/idle/panels/campaign/BattleScene
 */

import React, { useMemo, useState } from 'react';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine';
import type {
  BattleResult,
  BattleUnit,
  BattleTeam,
} from '@/games/three-kingdoms/engine';
import { BattleOutcome } from '@/games/three-kingdoms/engine';
import type { Stage } from '@/games/three-kingdoms/engine';
import { STAGE_TYPE_LABELS } from '@/games/three-kingdoms/engine';
import { useBattleAnimation } from './BattleAnimation';
import type { LogEntry } from './BattleAnimation';
import './BattleScene.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface BattleSceneProps {
  /** 游戏引擎实例 */
  engine: ThreeKingdomsEngine;
  /** 关卡信息 */
  stage: Stage;
  /** 战斗结束回调 */
  onBattleEnd: (result: BattleResult) => void;
}

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 获取血条颜色等级 */
function getHpLevel(hp: number, maxHp: number): string {
  if (hp <= 0) return 'dead';
  const r = hp / maxHp;
  return r > 0.6 ? 'high' : r > 0.25 ? 'mid' : 'low';
}

/** 格式化HP显示 */
function formatHp(hp: number, maxHp: number): string {
  return `${Math.max(0, Math.round(hp))}/${maxHp}`;
}

// ─────────────────────────────────────────────
// 武将卡片子组件
// ─────────────────────────────────────────────

interface UnitCardProps {
  unit: BattleUnit;
  side: 'ally' | 'enemy';
  isActing: boolean;
  isHit: boolean;
  isDying: boolean;
  isSkill: boolean;
}

const UnitCard: React.FC<UnitCardProps> = React.memo(({ unit, side, isActing, isHit, isDying, isSkill }) => {
  const hpLevel = getHpLevel(unit.hp, unit.maxHp);
  const hpPct = Math.max(0, (unit.hp / unit.maxHp) * 100);
  const ragePct = Math.max(0, (unit.rage / unit.maxRage) * 100);
  const rageFull = unit.rage >= unit.maxRage;

  // 组合 CSS 类名
  const classNames = [
    'tk-bs-unit',
    !unit.isAlive && !isDying ? 'tk-bs-unit--dead' : '',
    isActing && !isSkill ? (side === 'ally' ? 'tk-bs-unit--attacking-ally' : 'tk-bs-unit--attacking-enemy') : '',
    isHit ? 'tk-bs-unit--hit' : '',
    isDying ? 'tk-bs-unit--dying' : '',
    isSkill ? 'tk-bs-unit--skill' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={classNames}>
      <div className="tk-bs-unit-avatar">{unit.name.charAt(0)}</div>
      <div className="tk-bs-unit-name">{unit.name}</div>
      <div className="tk-bs-hp-bar">
        <div className={`tk-bs-hp-fill tk-bs-hp-fill--${hpLevel}`} style={{ width: `${hpPct}%` }} />
      </div>
      <div className="tk-bs-hp-text">{formatHp(unit.hp, unit.maxHp)}</div>
      <div className="tk-bs-rage-bar">
        <div className={`tk-bs-rage-fill ${rageFull ? 'tk-bs-rage-fill--full' : ''}`} style={{ width: `${ragePct}%` }} />
      </div>
    </div>
  );
});
UnitCard.displayName = 'UnitCard';

// ─────────────────────────────────────────────
// 战斗日志组件（可折叠）
// ─────────────────────────────────────────────

interface BattleLogProps {
  logs: LogEntry[];
  logAreaRef: React.RefObject<HTMLDivElement>;
}

const BattleLog: React.FC<BattleLogProps> = React.memo(({ logs, logAreaRef }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`tk-bs-log-area ${expanded ? 'tk-bs-log-area--expanded' : ''}`}>
      <div className="tk-bs-log-header">
        <span className="tk-bs-log-title">📜 战斗播报</span>
        <button
          className="tk-bs-log-toggle"
          onClick={() => setExpanded((p) => !p)}
          aria-label={expanded ? '收起日志' : '展开日志'}
        >
          {expanded ? '▼ 收起' : '▲ 展开'}
        </button>
      </div>
      <div className="tk-bs-log-content" ref={logAreaRef}>
        {logs.map((log) => (
          <div key={log.id} className={`tk-bs-log-entry tk-bs-log-entry--${log.type}`}
            dangerouslySetInnerHTML={{ __html: log.html }} />
        ))}
      </div>
    </div>
  );
});
BattleLog.displayName = 'BattleLog';

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

const BattleScene: React.FC<BattleSceneProps> = ({ engine, stage, onBattleEnd }) => {
  const battleEngine = engine.getBattleEngine();
  const { allyTeam, enemyTeam } = useMemo(() => engine.buildTeamsForStage(stage), [engine, stage]);

  const {
    battleState, battleResult, isFinished,
    actingUnitId, actingUnitSide, hitUnitIds, dyingUnitIds,
    skillActiveUnitId, critShake, damageFloats,
    logs, logAreaRef, speed, toggleSpeed, skip,
  } = useBattleAnimation(battleEngine, allyTeam, enemyTeam, onBattleEnd);

  // ── 渲染武将行 ──
  const renderUnitRow = (units: BattleUnit[], side: 'ally' | 'enemy', position: 'front' | 'back') => {
    const padded = [...units];
    while (padded.length < 3) padded.push(null as unknown as BattleUnit);
    return padded.map((unit, idx) => {
      if (!unit) return <div key={`empty-${side}-${position}-${idx}`} className="tk-bs-unit-empty" />;
      const floats = damageFloats.filter((f) => f.unitId === unit.id);
      return (
        <div key={unit.id} style={{ position: 'relative' }}>
          <UnitCard
            unit={unit}
            side={side}
            isActing={actingUnitId === unit.id}
            isHit={hitUnitIds.has(unit.id)}
            isDying={dyingUnitIds.has(unit.id)}
            isSkill={skillActiveUnitId === unit.id}
          />
          {floats.map((f) => (
            <div key={f.id} className={[
              'tk-bs-damage-float',
              f.isCritical ? 'tk-bs-damage-float--critical' : '',
              f.isHeal ? 'tk-bs-damage-float--heal' : 'tk-bs-damage-float--normal',
            ].filter(Boolean).join(' ')}>
              {f.isHeal ? '+' : '-'}{f.value.toLocaleString()}
            </div>
          ))}
        </div>
      );
    });
  };

  // ── 渲染阵营 ──
  const renderSide = (team: BattleTeam, side: 'ally' | 'enemy') => (
    <div className={`tk-bs-side tk-bs-side--${side}`}>
      <div className="tk-bs-row-label">后排</div>
      <div className="tk-bs-units-row">{renderUnitRow(team.units.filter((u) => u.position === 'back'), side, 'back')}</div>
      <div className="tk-bs-row-label">前排</div>
      <div className="tk-bs-units-row">{renderUnitRow(team.units.filter((u) => u.position === 'front'), side, 'front')}</div>
    </div>
  );

  // ── 加载中 ──
  if (!battleState) {
    return (
      <div className="tk-bs-overlay">
        <div style={{ color: 'var(--tk-text-secondary)', textAlign: 'center', marginTop: '40vh' }}>
          正在准备战斗...
        </div>
      </div>
    );
  }

  const endTextMap = {
    [BattleOutcome.VICTORY]: '胜 利',
    [BattleOutcome.DEFEAT]: '失 败',
    [BattleOutcome.DRAW]: '平 局',
  };

  return (
    <div className="tk-bs-overlay">
      {/* 顶部信息栏 */}
      <div className="tk-bs-top-bar">
        <div className="tk-bs-stage-info">
          <span className="tk-bs-stage-type">{STAGE_TYPE_LABELS[stage.type]}</span>
          <span className="tk-bs-stage-name">{stage.name}</span>
        </div>
        <div className="tk-bs-turn-display">
          回合 {battleState.currentTurn}/{battleState.maxTurns}
        </div>
        <div className="tk-bs-controls">
          <button className={`tk-bs-speed-btn ${speed === 2 ? 'tk-bs-speed-btn--active' : ''}`} onClick={toggleSpeed}>
            {speed}x
          </button>
          {!isFinished && <button className="tk-bs-skip-btn" onClick={skip}>跳过</button>}
        </div>
      </div>

      {/* 战场主区域 */}
      <div className={`tk-bs-battlefield ${critShake ? 'tk-bs-battlefield--crit-shake' : ''}`}>
        {renderSide(battleState.allyTeam, 'ally')}
        <div className="tk-bs-vs-divider">VS</div>
        {renderSide(battleState.enemyTeam, 'enemy')}

        {/* 战斗结束覆盖 */}
        {isFinished && battleResult && (
          <div className="tk-bs-end-overlay">
            <div className={`tk-bs-end-text tk-bs-end-text--${
              battleResult.outcome === BattleOutcome.VICTORY ? 'victory'
                : battleResult.outcome === BattleOutcome.DEFEAT ? 'defeat' : 'draw'
            }`}>
              {endTextMap[battleResult.outcome]}
            </div>
          </div>
        )}
      </div>

      {/* 战斗播报 */}
      <BattleLog logs={logs} logAreaRef={logAreaRef} />
    </div>
  );
};

BattleScene.displayName = 'BattleScene';
export default BattleScene;
