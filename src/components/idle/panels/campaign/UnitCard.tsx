/**
 * UnitCard — 武将卡片子组件
 *
 * 从 BattleScene.tsx 提取的单个武将卡片渲染逻辑：
 * - 头像（首字）
 * - 名称
 * - 血条（带颜色等级）
 * - 怒气条（满怒闪烁）
 * - 死亡/行动中/受击状态样式
 *
 * @module components/idle/panels/campaign/UnitCard
 */

import React from 'react';
import type { BattleUnit } from '@/games/three-kingdoms/engine/battle/battle.types';
import { getHpLevel, formatHp } from './battle-scene-utils';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface UnitCardProps {
  unit: BattleUnit;
  side: 'ally' | 'enemy';
  isActing: boolean;
  isHit: boolean;
}

// ─────────────────────────────────────────────
// 组件
// ─────────────────────────────────────────────

const UnitCard: React.FC<UnitCardProps> = React.memo(({ unit, side, isActing, isHit }) => {
  const hpLevel = getHpLevel(unit.hp, unit.maxHp);
  const hpPercent = Math.max(0, (unit.hp / unit.maxHp) * 100);
  const ragePercent = Math.max(0, (unit.rage / unit.maxRage) * 100);
  const isRageFull = unit.rage >= unit.maxRage;

  return (
    <div
      className={[
        'tk-bs-unit',
        !unit.isAlive ? 'tk-bs-unit--dead' : '',
        isActing ? 'tk-bs-unit--acting' : '',
        isHit ? 'tk-bs-unit--hit' : '',
      ].filter(Boolean).join(' ')}
    >
      {/* 头像 */}
      <div className="tk-bs-unit-avatar">
        {unit.name.charAt(0)}
      </div>

      {/* 名称 */}
      <div className="tk-bs-unit-name">{unit.name}</div>

      {/* 血条 */}
      <div className="tk-bs-hp-bar">
        <div
          className={`tk-bs-hp-fill tk-bs-hp-fill--${hpLevel}`}
          style={{ width: `${hpPercent}%` }}
        />
      </div>
      <div className="tk-bs-hp-text">{formatHp(unit.hp, unit.maxHp)}</div>

      {/* 怒气条 */}
      <div className="tk-bs-rage-bar">
        <div
          className={`tk-bs-rage-fill ${isRageFull ? 'tk-bs-rage-fill--full' : ''}`}
          style={{ width: `${ragePercent}%` }}
        />
      </div>
    </div>
  );
});

UnitCard.displayName = 'UnitCard';

export default UnitCard;
