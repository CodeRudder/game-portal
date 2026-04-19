/**
 * BattleScene — 全屏战斗场景主组件
 *
 * 功能：
 * - 全屏覆盖主界面，展示战斗过程
 * - 我方武将左侧（前排3+后排3），敌方右侧
 * - 每个武将显示：头像/名称/血条/怒气条
 * - 回合数显示、战斗速度控制（1x/2x）、跳过按钮
 * - 战斗结束自动关闭，触发结算
 *
 * 动画逻辑拆分至 BattleAnimation.tsx（useBattleAnimation hook）。
 *
 * @module components/idle/panels/campaign/BattleScene
 */

import React, { useMemo } from 'react';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type {
  BattleResult,
  BattleUnit,
  BattleTeam,
} from '@/games/three-kingdoms/engine/battle/battle.types';
import { BattleOutcome } from '@/games/three-kingdoms/engine/battle/battle.types';
import type { Stage } from '@/games/three-kingdoms/engine/campaign/campaign.types';
import { STAGE_TYPE_LABELS } from '@/games/three-kingdoms/engine/campaign/campaign.types';
import { buildAllyTeam, buildEnemyTeam } from '@/games/three-kingdoms/engine/engine-campaign-deps';
import { useBattleAnimation } from './BattleAnimation';
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
  isActing: boolean;
  isHit: boolean;
}

const UnitCard: React.FC<UnitCardProps> = React.memo(({ unit, isActing, isHit }) => {
  const hpLevel = getHpLevel(unit.hp, unit.maxHp);
  const hpPct = Math.max(0, (unit.hp / unit.maxHp) * 100);
  const ragePct = Math.max(0, (unit.rage / unit.maxRage) * 100);
  const rageFull = unit.rage >= unit.maxRage;

  return (
    <div className={[
      'tk-bs-unit',
      !unit.isAlive ? 'tk-bs-unit--dead' : '',
      isActing ? 'tk-bs-unit--acting' : '',
      isHit ? 'tk-bs-unit--hit' : '',
    ].filter(Boolean).join(' ')}>
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
// 主组件
// ─────────────────────────────────────────────

const BattleScene: React.FC<BattleSceneProps> = ({ engine, stage, onBattleEnd }) => {
  const battleEngine = engine.getBattleEngine();
  const allyTeam = useMemo(() => buildAllyTeam(engine.getFormationSystem(), engine.getHeroSystem()), [engine]);
  const enemyTeam = useMemo(() => buildEnemyTeam(stage), [stage]);

  const {
    battleState, battleResult, isFinished,
    actingUnitId, hitUnitIds, damageFloats,
    logs, logAreaRef, speed, toggleSpeed, skip,
  } = useBattleAnimation(battleEngine, allyTeam, enemyTeam, onBattleEnd);

  // ── 渲染武将行 ──
  const renderUnitRow = (units: BattleUnit[]) => {
    const padded = [...units];
    while (padded.length < 3) padded.push(null as any);
    return padded.map((unit, idx) => {
      if (!unit) return <div key={`e${idx}`} className="tk-bs-unit-empty" />;
      const floats = damageFloats.filter((f) => f.unitId === unit.id);
      return (
        <div key={unit.id} style={{ position: 'relative' }}>
          <UnitCard unit={unit} isActing={actingUnitId === unit.id} isHit={hitUnitIds.has(unit.id)} />
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
      <div className="tk-bs-units-row">{renderUnitRow(team.units.filter((u) => u.position === 'back'))}</div>
      <div className="tk-bs-row-label">前排</div>
      <div className="tk-bs-units-row">{renderUnitRow(team.units.filter((u) => u.position === 'front'))}</div>
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
      <div className="tk-bs-battlefield">
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
      <div className="tk-bs-log-area" ref={logAreaRef}>
        {logs.map((log) => (
          <div key={log.id} className={`tk-bs-log-entry tk-bs-log-entry--${log.type}`}
            dangerouslySetInnerHTML={{ __html: log.html }} />
        ))}
      </div>
    </div>
  );
};

BattleScene.displayName = 'BattleScene';
export default BattleScene;
