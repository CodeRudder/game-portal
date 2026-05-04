/**
 * BattleSpeedControl — 战斗加速控件
 *
 * v3.0 P1：提供四档速度切换（1x / 2x / 3x / 极速），
 * 支持禁用状态、速度指示器、VIP锁图标。
 *
 * VIP等级要求：
 * - 1x / 2x：免费
 * - 3x：VIP3+ 解锁
 * - 极速：VIP5+ 解锁
 */
import React, { useCallback } from 'react';
import './BattleSpeedControl.css';

/** 速度等级类型 */
export type BattleSpeedLevel = 1 | 2 | 3 | 8;

/** VIP锁图标配置 */
export interface VIPLockConfig {
  /** 该速度档位所需的最低VIP等级 */
  requiredVIPLevel: number;
  /** 当前用户的VIP等级 */
  currentVIPLevel: number;
  /** 是否已解锁 */
  isUnlocked: boolean;
}

/** 速度档位元数据 */
export interface SpeedTierMeta {
  speed: BattleSpeedLevel;
  label: string;
  /** VIP锁配置，不传表示免费 */
  vipLock?: VIPLockConfig;
}

export interface BattleSpeedControlProps {
  /** 当前速度 */
  currentSpeed: BattleSpeedLevel;
  /** 速度变更回调 */
  onSpeedChange: (speed: BattleSpeedLevel) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否显示速度指示器 */
  showIndicator?: boolean;
  /** 当前用户VIP等级（用于VIP锁判断） */
  vipLevel?: number;
}

/**
 * 根据VIP等级生成速度档位列表
 *
 * @param vipLevel - 当前用户VIP等级
 * @returns 速度档位元数据数组
 */
export function buildSpeedTiers(vipLevel: number = 0): SpeedTierMeta[] {
  return [
    { speed: 1, label: '1x' },
    { speed: 2, label: '2x' },
    {
      speed: 3,
      label: '3x',
      vipLock: {
        requiredVIPLevel: 3,
        currentVIPLevel: vipLevel,
        isUnlocked: vipLevel >= 3,
      },
    },
    {
      speed: 8,
      label: '极速',
      vipLock: {
        requiredVIPLevel: 5,
        currentVIPLevel: vipLevel,
        isUnlocked: vipLevel >= 5,
      },
    },
  ];
}

const BattleSpeedControl: React.FC<BattleSpeedControlProps> = ({
  currentSpeed,
  onSpeedChange,
  disabled = false,
  showIndicator = false,
  vipLevel = 0,
}) => {
  const speedTiers = buildSpeedTiers(vipLevel);

  const handleClick = useCallback(
    (speed: BattleSpeedLevel, isUnlocked: boolean) => {
      if (!disabled && speed !== currentSpeed && isUnlocked) {
        onSpeedChange(speed);
      }
    },
    [disabled, currentSpeed, onSpeedChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, speed: BattleSpeedLevel, isUnlocked: boolean) => {
      if ((e.key === 'Enter' || e.key === ' ') && !disabled && speed !== currentSpeed && isUnlocked) {
        e.preventDefault();
        onSpeedChange(speed);
      }
    },
    [disabled, currentSpeed, onSpeedChange],
  );

  /** 速度显示文本 */
  const speedLabel = (tier: SpeedTierMeta) => {
    if (tier.speed === 8) return '极速';
    return `${tier.speed}x`;
  };

  return (
    <div data-testid="battle-speed-control" role="radiogroup">
      {speedTiers.map((tier) => {
        const isActive = currentSpeed === tier.speed;
        const isFast = tier.speed >= 3;
        const isLocked = tier.vipLock ? !tier.vipLock.isUnlocked : false;
        const classNames = [
          'tk-speed-btn',
          isActive ? 'tk-speed-btn--active' : '',
          isFast ? 'tk-speed-btn--fast' : '',
          isLocked ? 'tk-speed-btn--locked' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <button
            key={tier.speed}
            data-testid={`speed-btn-${tier.label}`}
            className={classNames}
            role="radio"
            aria-checked={isActive ? 'true' : 'false'}
            aria-label={isLocked ? `${tier.label} - 需要VIP${tier.vipLock!.requiredVIPLevel}解锁` : tier.label}
            disabled={disabled || isLocked}
            onClick={() => handleClick(tier.speed, !isLocked)}
            onKeyDown={(e) => handleKeyDown(e, tier.speed, !isLocked)}
            title={isLocked ? `VIP${tier.vipLock!.requiredVIPLevel} 解锁` : undefined}
          >
            {isLocked && (
              <span className="tk-speed-vip-lock" data-testid={`speed-lock-${tier.label}`}>
                🔒
              </span>
            )}
            <span className="tk-speed-btn-text">{speedLabel(tier)}</span>
            {isLocked && (
              <span className="tk-speed-vip-hint" data-testid={`speed-vip-hint-${tier.label}`}>
                VIP{tier.vipLock!.requiredVIPLevel}
              </span>
            )}
          </button>
        );
      })}
      {showIndicator && (
        <span className="tk-speed-indicator">
          ⏩ <span className="tk-speed-indicator-value">{speedLabel(speedTiers.find(t => t.speed === currentSpeed) || speedTiers[0])}</span>
        </span>
      )}
    </div>
  );
};

export default BattleSpeedControl;
