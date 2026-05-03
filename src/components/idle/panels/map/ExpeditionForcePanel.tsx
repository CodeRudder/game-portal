/**
 * ExpeditionForcePanel — 出征编队选择面板
 *
 * 用于攻城前选择将领和分配兵力。
 * 集成到 SiegeConfirmModal 中。
 *
 * @module components/idle/panels/map/ExpeditionForcePanel
 */

import React, { useState, useMemo } from 'react';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 将领信息 */
export interface HeroInfo {
  id: string;
  name: string;
  level: number;
  injured: boolean;
  injuryLevel?: 'none' | 'minor' | 'moderate' | 'severe';
  injuryRecoveryTime?: number; // 毫秒
  busy: boolean; // 是否在其他编队中
}

/** 编队选择结果 */
export interface ExpeditionForceSelection {
  heroId: string;
  troops: number;
}

/** 组件属性 */
export interface ExpeditionForcePanelProps {
  /** 可用将领列表 */
  heroes: HeroInfo[];
  /** 可调用兵力上限 */
  maxTroops: number;
  /** 已选编队（用于编辑） */
  selection?: ExpeditionForceSelection;
  /** 选择变更回调 */
  onChange: (selection: ExpeditionForceSelection | null) => void;
  /** 是否禁用 */
  disabled?: boolean;
}

// ─────────────────────────────────────────────
// 受伤等级配置
// ─────────────────────────────────────────────

const INJURY_CONFIG = {
  none: { label: '无', color: '#4caf50', icon: '' },
  minor: { label: '轻伤', color: '#ff9800', icon: '🩹' },
  moderate: { label: '中伤', color: '#f44336', icon: '🤕' },
  severe: { label: '重伤', color: '#9c27b0', icon: '🏥' },
};

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/** 格式化恢复时间 */
function formatRecoveryTime(ms: number): string {
  if (ms <= 0) return '已恢复';
  const minutes = Math.ceil(ms / (60 * 1000));
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.ceil(minutes / 60);
  return `${hours}小时`;
}

// ─────────────────────────────────────────────
// 组件
// ─────────────────────────────────────────────

export const ExpeditionForcePanel: React.FC<ExpeditionForcePanelProps> = ({
  heroes,
  maxTroops,
  selection,
  onChange,
  disabled = false,
}) => {
  const [selectedHeroId, setSelectedHeroId] = useState<string>(selection?.heroId || '');
  const [troops, setTroops] = useState<number>(selection?.troops || 0);

  // 过滤可用将领（排除受伤和繁忙的）
  const availableHeroes = useMemo(() => {
    return heroes.filter(h => !h.injured && !h.busy);
  }, [heroes]);

  // 受伤将领
  const injuredHeroes = useMemo(() => {
    return heroes.filter(h => h.injured);
  }, [heroes]);

  // 繁忙将领
  const busyHeroes = useMemo(() => {
    return heroes.filter(h => h.busy && !h.injured);
  }, [heroes]);

  // 选择将领
  const handleHeroSelect = (heroId: string) => {
    if (disabled) return;
    setSelectedHeroId(heroId);
    onChange({ heroId, troops });
  };

  // 调整兵力
  const handleTroopsChange = (value: number) => {
    if (disabled) return;
    const clampedValue = Math.max(0, Math.min(value, maxTroops));
    setTroops(clampedValue);
    if (selectedHeroId) {
      onChange({ heroId: selectedHeroId, troops: clampedValue });
    }
  };

  // 清除选择
  const handleClear = () => {
    setSelectedHeroId('');
    setTroops(0);
    onChange(null);
  };

  // 是否有效
  const isValid = selectedHeroId && troops >= 100;

  return (
    <div className="expedition-force-panel" style={{ padding: '12px', background: '#1a1a2e', borderRadius: '8px' }}>
      {/* 标题 */}
      <div style={{ marginBottom: '12px', fontSize: '14px', fontWeight: 'bold', color: '#e0e0e0' }}>
        ⚔️ 出征编队
      </div>

      {/* 将领选择 */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ marginBottom: '8px', fontSize: '12px', color: '#9e9e9e' }}>
          选择将领 (必须)
        </div>

        {/* 可用将领 */}
        {availableHeroes.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {availableHeroes.map(hero => (
              <button
                key={hero.id}
                onClick={() => handleHeroSelect(hero.id)}
                disabled={disabled}
                style={{
                  padding: '8px 12px',
                  background: selectedHeroId === hero.id ? '#1976d2' : '#2d2d44',
                  border: selectedHeroId === hero.id ? '2px solid #42a5f5' : '2px solid #3d3d54',
                  borderRadius: '6px',
                  color: '#e0e0e0',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  opacity: disabled ? 0.5 : 1,
                }}
              >
                <div style={{ fontWeight: 'bold' }}>{hero.name}</div>
                <div style={{ fontSize: '10px', color: '#9e9e9e' }}>Lv.{hero.level}</div>
              </button>
            ))}
          </div>
        ) : (
          <div style={{ color: '#f44336', fontSize: '12px' }}>
            没有可用的将领
          </div>
        )}

        {/* 受伤将领 */}
        {injuredHeroes.length > 0 && (
          <div style={{ marginTop: '8px' }}>
            <div style={{ fontSize: '10px', color: '#9e9e9e', marginBottom: '4px' }}>
              受伤中:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {injuredHeroes.map(hero => {
                const config = INJURY_CONFIG[hero.injuryLevel || 'none'];
                return (
                  <div
                    key={hero.id}
                    style={{
                      padding: '6px 10px',
                      background: '#2d2d44',
                      border: `1px solid ${config.color}`,
                      borderRadius: '6px',
                      opacity: 0.6,
                      fontSize: '11px',
                    }}
                  >
                    <div style={{ color: '#e0e0e0' }}>{hero.name}</div>
                    <div style={{ color: config.color }}>
                      {config.icon} {config.label}
                      {hero.injuryRecoveryTime && hero.injuryRecoveryTime > 0 && (
                        <span> ({formatRecoveryTime(hero.injuryRecoveryTime)})</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 繁忙将领 */}
        {busyHeroes.length > 0 && (
          <div style={{ marginTop: '8px' }}>
            <div style={{ fontSize: '10px', color: '#9e9e9e', marginBottom: '4px' }}>
              已出征:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {busyHeroes.map(hero => (
                <div
                  key={hero.id}
                  style={{
                    padding: '6px 10px',
                    background: '#2d2d44',
                    border: '1px solid #616161',
                    borderRadius: '6px',
                    opacity: 0.6,
                    fontSize: '11px',
                    color: '#9e9e9e',
                  }}
                >
                  {hero.name} (出征中)
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 兵力分配 */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ marginBottom: '8px', fontSize: '12px', color: '#9e9e9e' }}>
          分配兵力 (最少100)
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input
            type="range"
            min={0}
            max={maxTroops}
            step={100}
            value={troops}
            onChange={(e) => handleTroopsChange(Number(e.target.value))}
            disabled={disabled || !selectedHeroId}
            style={{ flex: 1 }}
          />
          <input
            type="number"
            min={0}
            max={maxTroops}
            step={100}
            value={troops}
            onChange={(e) => handleTroopsChange(Number(e.target.value))}
            disabled={disabled || !selectedHeroId}
            style={{
              width: '80px',
              padding: '6px',
              background: '#2d2d44',
              border: '1px solid #3d3d54',
              borderRadius: '4px',
              color: '#e0e0e0',
              textAlign: 'center',
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
          <span style={{ fontSize: '10px', color: '#9e9e9e' }}>
            可用: {maxTroops.toLocaleString()}
          </span>
          <span style={{ fontSize: '10px', color: troops < 100 ? '#f44336' : '#4caf50' }}>
            {troops < 100 ? '最少需要100' : `出征: ${troops.toLocaleString()}`}
          </span>
        </div>
      </div>

      {/* 操作按钮 */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={handleClear}
          disabled={disabled || (!selectedHeroId && troops === 0)}
          style={{
            flex: 1,
            padding: '10px',
            background: '#424242',
            border: 'none',
            borderRadius: '6px',
            color: '#e0e0e0',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          清除
        </button>
      </div>

      {/* 提示信息 */}
      {!isValid && selectedHeroId && troops > 0 && troops < 100 && (
        <div style={{ marginTop: '8px', color: '#f44336', fontSize: '11px', textAlign: 'center' }}>
          兵力不足100，无法出征
        </div>
      )}
    </div>
  );
};

export default ExpeditionForcePanel;
