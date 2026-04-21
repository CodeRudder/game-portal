/**
 * 三国霸业 — 建筑面板组件
 *
 * 展示 8 种建筑卡片，每张卡片显示：
 *   - 建筑图标 + 名称 + 等级
 *   - 升级按钮（可升级/升级中/资源不足/已满级）
 *   - 升级资源消耗
 *   - 升级进度条（升级中状态）
 *
 * @module ui/components/BuildingPanel
 */

import { useCallback, useMemo } from 'react';
import { useGameContext } from '../context/GameContext';
import { useDebouncedAction } from '../hooks/useDebouncedAction';
import { useToast } from './ToastProvider';
import type { BuildingType, BuildingState, UpgradeCost } from '../../shared/types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

const BUILDING_META: Record<BuildingType, { label: string; icon: string; color: string }> = {
  castle:   { label: '主城',   icon: '🏛️', color: '#C9A84C' },
  farmland: { label: '农田',   icon: '🌾', color: '#7EC850' },
  market:   { label: '市集',   icon: '💰', color: '#D4A574' },
  barracks: { label: '兵营',   icon: '⚔️', color: '#B8423A' },
  smithy:   { label: '铁匠铺', icon: '🔨', color: '#8B7355' },
  academy:  { label: '书院',   icon: '📚', color: '#5B9BD5' },
  clinic:   { label: '医馆',   icon: '🏥', color: '#7EC850' },
  wall:     { label: '城墙',   icon: '🏯', color: '#A0A0A0' },
};

const BUILDING_ORDER: BuildingType[] = [
  'castle', 'farmland', 'market', 'barracks',
  'smithy', 'academy', 'clinic', 'wall',
];

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface BuildingPanelProps {
  /** 点击建筑卡片回调 */
  onBuildingClick?: (type: BuildingType) => void;
  /** 额外类名 */
  className?: string;
}

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

function formatCost(n: number): string {
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}万`;
  return n.toLocaleString();
}

function formatTime(s: number): string {
  if (s <= 0) return '';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  if (m > 0) return `${m}分${sec}秒`;
  return `${sec}秒`;
}

// ─────────────────────────────────────────────
// 子组件：建筑卡片
// ─────────────────────────────────────────────

interface BuildingCardProps {
  type: BuildingType;
  state: BuildingState;
  cost: UpgradeCost | null;
  canUpgrade: boolean;
  reasons: string[];
  progress: number;
  remainingMs: number;
  onUpgrade: (type: BuildingType) => void;
  onClick: (type: BuildingType) => void;
}

function BuildingCard({
  type, state, cost, canUpgrade, reasons, progress, remainingMs, onUpgrade, onClick,
}: BuildingCardProps) {
  const meta = BUILDING_META[type];
  const isUpgrading = state.status === 'upgrading';
  const isLocked = state.status === 'locked';

  const handleUpgrade = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onUpgrade(type);
    },
    [onUpgrade, type],
  );

  const handleClick = useCallback(() => onClick(type), [onClick, type]);

  // 按钮文案和状态
  let btnLabel: string;
  let btnDisabled: boolean;
  if (isLocked) {
    btnLabel = '未解锁';
    btnDisabled = true;
  } else if (isUpgrading) {
    btnLabel = `升级中 ${formatTime(remainingMs / 1000)}`;
    btnDisabled = true;
  } else if (!cost) {
    btnLabel = '已满级';
    btnDisabled = true;
  } else if (!canUpgrade) {
    btnLabel = '资源不足';
    btnDisabled = true;
  } else {
    btnLabel = '升级';
    btnDisabled = false;
  }

  return (
    <div
      style={{
        ...cardStyles.container,
        borderColor: meta.color + '40',
        opacity: isLocked ? 0.5 : 1,
      }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`${meta.label} 等级${state.level}`}
    >
      {/* 顶部：图标 + 名称 + 等级 */}
      <div style={cardStyles.header}>
        <span style={cardStyles.icon}>{meta.icon}</span>
        <div style={cardStyles.titleArea}>
          <div style={cardStyles.name}>{meta.label}</div>
          <div style={cardStyles.level}>Lv.{state.level}</div>
        </div>
      </div>

      {/* 升级进度条 */}
      {isUpgrading && (
        <div style={cardStyles.barBg}>
          <div style={{ ...cardStyles.barFill, width: `${progress * 100}%`, backgroundColor: meta.color }} />
        </div>
      )}

      {/* 费用显示 */}
      {cost && !isLocked && (
        <div style={cardStyles.costRow}>
          {cost.grain > 0 && <span style={cardStyles.costItem}>🌾{formatCost(cost.grain)}</span>}
          {cost.gold > 0 && <span style={cardStyles.costItem}>💰{formatCost(cost.gold)}</span>}
          {cost.troops > 0 && <span style={cardStyles.costItem}>⚔️{formatCost(cost.troops)}</span>}
          {cost.timeSeconds > 0 && <span style={cardStyles.costItem}>⏱{formatTime(cost.timeSeconds)}</span>}
        </div>
      )}

      {/* 升级按钮 */}
      <button
        style={{
          ...cardStyles.btn,
          ...(btnDisabled ? cardStyles.btnDisabled : {}),
          backgroundColor: btnDisabled ? 'transparent' : meta.color,
          color: btnDisabled ? '#a0a0a0' : '#1a1a2e',
        }}
        disabled={btnDisabled}
        onClick={handleUpgrade}
      >
        {btnLabel}
      </button>

      {/* 失败原因提示 */}
      {!canUpgrade && reasons.length > 0 && !isUpgrading && !isLocked && (
        <div style={cardStyles.reasons}>
          {reasons[0]}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

/**
 * BuildingPanel — 建筑面板
 *
 * @example
 * ```tsx
 * <BuildingPanel onBuildingClick={(t) => console.log(t)} />
 * ```
 */
export function BuildingPanel({ onBuildingClick, className }: BuildingPanelProps) {
  const { engine, snapshot } = useGameContext();
  const { addToast } = useToast();

  // 预计算所有建筑的状态
  const buildingInfos = useMemo(() => {
    if (!snapshot?.buildings) return [];
    return BUILDING_ORDER.map((type) => {
      const state = snapshot.buildings[type];
      const check = engine.checkUpgrade(type) ?? { canUpgrade: false, reasons: [] };
      const cost = engine.getUpgradeCost(type) ?? null;
      const progress = engine.getUpgradeProgress(type) ?? 0;
      const remaining = engine.getUpgradeRemainingTime(type) ?? 0;
      return { type, state, check, cost, progress, remaining };
    });
  }, [snapshot, engine]);

  const handleUpgrade = useCallback(
    (type: BuildingType) => {
      try {
        engine.upgradeBuilding(type);
      } catch {
        // P0-UI-05: 升级失败时 Toast 反馈
        addToast('建筑升级失败', 'error');
      }
    },
    [engine, addToast],
  );

  // P0-UI-02: 防抖包裹
  const { action: debouncedUpgrade, isActing: isUpgrading } = useDebouncedAction(handleUpgrade, 500);

  const handleClick = useCallback(
    (type: BuildingType) => {
      onBuildingClick?.(type);
    },
    [onBuildingClick],
  );

  if (!snapshot) {
    return <div style={styles.loading}>加载中...</div>;
  }

  return (
    <div
      style={styles.container}
      className={`tk-building-panel ${className ?? ''}`.trim()}
      role="region"
      aria-label="建筑面板"
    >
      <div style={styles.title}>城建设施</div>
      <div style={styles.grid}>
        {buildingInfos.map((info) => (
          <BuildingCard
            key={info.type}
            type={info.type}
            state={info.state}
            cost={info.cost}
            canUpgrade={info.check.canUpgrade}
            reasons={info.check.reasons}
            progress={info.progress}
            remainingMs={info.remaining}
            onUpgrade={debouncedUpgrade}
            onClick={handleClick}
          />
        ))}
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
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#d4a574',
    marginBottom: '12px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: '8px',
  },
};

const cardStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '10px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(212, 165, 116, 0.2)',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'border-color 0.15s ease',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  icon: {
    fontSize: '24px',
  },
  titleArea: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#e8e0d0',
  },
  level: {
    fontSize: '11px',
    color: '#d4a574',
  },
  barBg: {
    width: '100%',
    height: '4px',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 0.3s ease',
  },
  costRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    fontSize: '11px',
    color: '#a0a0a0',
  },
  costItem: {
    whiteSpace: 'nowrap',
  },
  btn: {
    width: '100%',
    padding: '6px 0',
    border: '1px solid rgba(212, 165, 116, 0.3)',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  btnDisabled: {
    cursor: 'not-allowed',
    borderStyle: 'dashed',
  },
  reasons: {
    fontSize: '10px',
    color: '#b8423a',
    lineHeight: 1.3,
  },
};
