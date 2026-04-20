/**
 * 三国霸业 — 升星/碎片面板组件
 *
 * 支持武将升星和突破功能：
 *   - 碎片收集进度条
 *   - 升星操作（消耗碎片+铜钱）
 *   - 升星效果预览（属性变化对比）
 *   - 突破界面（等级上限提升）
 *
 * 引擎依赖：engine/hero/ 下的 HeroStarSystem
 *
 * @module ui/components/hero/StarUpPanel
 */

import { useState, useMemo, useCallback } from 'react';
import { useGameContext } from '../../context/GameContext';
import type {
  StarUpPreview,
  StarUpResult,
  FragmentProgress,
  BreakthroughPreview,
  BreakthroughResult,
} from '../../../engine/hero/star-up.types';

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

/** 面板视图模式 */
type ViewMode = 'starUp' | 'breakthrough';

/** 面板状态 */
interface StarUpPanelState {
  /** 当前视图模式 */
  viewMode: ViewMode;
  /** 升星结果 */
  starUpResult: StarUpResult | null;
  /** 突破结果 */
  breakthroughResult: BreakthroughResult | null;
  /** 操作中 */
  isOperating: boolean;
  /** 错误信息 */
  error: string | null;
}

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface StarUpPanelProps {
  /** 目标武将 ID */
  generalId: string;
  /** 升星完成回调 */
  onStarUp?: (result: StarUpResult) => void;
  /** 突破完成回调 */
  onBreakthrough?: (result: BreakthroughResult) => void;
  /** 关闭回调 */
  onClose?: () => void;
  /** 额外类名 */
  className?: string;
}

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 格式化属性变化 */
function formatStatDiff(before: number, after: number): string {
  const diff = after - before;
  if (diff > 0) return `+${diff}`;
  if (diff < 0) return `${diff}`;
  return '0';
}

/** 计算进度条颜色 */
function getProgressColor(percent: number): string {
  if (percent >= 100) return '#4ade80';
  if (percent >= 60) return '#fbbf24';
  return '#60a5fa';
}

/** 星级显示 */
function starDisplay(star: number): string {
  return '★'.repeat(Math.min(star, 6)) + '☆'.repeat(Math.max(0, 6 - star));
}

// ─────────────────────────────────────────────
// 纯逻辑管理器（用于测试）
// ─────────────────────────────────────────────

/**
 * StarUpLogic — 升星面板逻辑管理器
 *
 * 封装升星/突破面板的核心逻辑，不依赖 React DOM。
 */
export class StarUpLogic {
  private fragmentProgress: FragmentProgress | null;
  private starUpPreview: StarUpPreview | null;
  private breakthroughPreview: BreakthroughPreview | null;
  private currentStar: number;
  private maxStar: number;

  constructor(
    fragmentProgress: FragmentProgress | null,
    starUpPreview: StarUpPreview | null,
    breakthroughPreview: BreakthroughPreview | null,
    currentStar: number = 1,
    maxStar: number = 6,
  ) {
    this.fragmentProgress = fragmentProgress;
    this.starUpPreview = starUpPreview;
    this.breakthroughPreview = breakthroughPreview;
    this.currentStar = currentStar;
    this.maxStar = maxStar;
  }

  /** 获取碎片进度百分比 */
  getFragmentPercent(): number {
    return this.fragmentProgress?.percentage ?? 0;
  }

  /** 是否可以升星 */
  canStarUp(): boolean {
    return this.fragmentProgress?.canStarUp ?? false;
  }

  /** 是否已达最高星级 */
  isMaxStar(): boolean {
    return this.currentStar >= this.maxStar;
  }

  /** 获取升星消耗描述 */
  getStarUpCostDesc(): { fragments: string; gold: string } {
    if (!this.starUpPreview) return { fragments: '-', gold: '-' };
    return {
      fragments: `${this.starUpPreview.fragmentOwned}/${this.starUpPreview.fragmentCost}`,
      gold: `${this.starUpPreview.goldCost}`,
    };
  }

  /** 获取属性变化预览 */
  getStatsDiff(): { attack: string; defense: string; intelligence: string; speed: string } | null {
    if (!this.starUpPreview) return null;
    const { before, after } = this.starUpPreview.statsDiff;
    return {
      attack: formatStatDiff(before.attack, after.attack),
      defense: formatStatDiff(before.defense, after.defense),
      intelligence: formatStatDiff(before.intelligence, after.intelligence),
      speed: formatStatDiff(before.speed, after.speed),
    };
  }

  /** 是否可以突破 */
  canBreakthrough(): boolean {
    return this.breakthroughPreview?.canBreakthrough ?? false;
  }

  /** 获取突破描述 */
  getBreakthroughDesc(): string {
    if (!this.breakthroughPreview) return '无突破数据';
    if (this.breakthroughPreview.canBreakthrough) return '可以突破';
    if (!this.breakthroughPreview.levelReady) return `需要达到等级 ${this.breakthroughPreview.currentLevelCap}`;
    if (!this.breakthroughPreview.resourceSufficient) return '资源不足';
    return '条件未满足';
  }

  /** 获取突破消耗 */
  getBreakthroughCost(): { fragments: number; gold: number; stones: number } | null {
    if (!this.breakthroughPreview) return null;
    return {
      fragments: this.breakthroughPreview.fragmentCost,
      gold: this.breakthroughPreview.goldCost,
      stones: this.breakthroughPreview.breakthroughStoneCost,
    };
  }

  /** 获取星级显示 */
  getStarDisplay(): string {
    return starDisplay(this.currentStar);
  }

  /** 获取进度条颜色 */
  getProgressColor(): string {
    return getProgressColor(this.getFragmentPercent());
  }

  /** 检查升星操作是否合法 */
  validateStarUp(): { valid: boolean; reason?: string } {
    if (this.isMaxStar()) return { valid: false, reason: '已达最高星级' };
    if (!this.canStarUp()) return { valid: false, reason: '碎片不足' };
    if (!this.starUpPreview?.fragmentSufficient) return { valid: false, reason: '碎片不足' };
    return { valid: true };
  }

  /** 检查突破操作是否合法 */
  validateBreakthrough(): { valid: boolean; reason?: string } {
    if (!this.breakthroughPreview) return { valid: false, reason: '无突破数据' };
    if (!this.breakthroughPreview.canBreakthrough) {
      if (!this.breakthroughPreview.levelReady) return { valid: false, reason: '等级未达到上限' };
      if (!this.breakthroughPreview.resourceSufficient) return { valid: false, reason: '资源不足' };
      return { valid: false, reason: '条件未满足' };
    }
    return { valid: true };
  }
}

// ─────────────────────────────────────────────
// 子组件：碎片进度条
// ─────────────────────────────────────────────

interface FragmentProgressBarProps {
  current: number;
  required: number;
  percentage: number;
  canStarUp: boolean;
}

function FragmentProgressBar({ current, required, percentage, canStarUp }: FragmentProgressBarProps) {
  const color = getProgressColor(percentage);
  return (
    <div style={styles.progressContainer}>
      <div style={styles.progressLabel}>
        <span>碎片进度</span>
        <span style={{ color }}>{current}/{required}</span>
      </div>
      <div style={styles.progressBg}>
        <div
          style={{
            ...styles.progressFill,
            width: `${Math.min(percentage, 100)}%`,
            backgroundColor: color,
          }}
        />
      </div>
      {canStarUp && (
        <div style={{ ...styles.readyHint, color }}>✅ 碎片充足，可以升星！</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 子组件：属性变化预览
// ─────────────────────────────────────────────

interface StatsPreviewProps {
  statsDiff: NonNullable<ReturnType<StarUpLogic['getStatsDiff']>>;
}

function StatsPreview({ statsDiff }: StatsPreviewProps) {
  const statItems = [
    { label: '攻击', value: statsDiff.attack },
    { label: '防御', value: statsDiff.defense },
    { label: '智力', value: statsDiff.intelligence },
    { label: '速度', value: statsDiff.speed },
  ];

  return (
    <div style={styles.statsGrid}>
      {statItems.map((item) => (
        <div key={item.label} style={styles.statItem}>
          <span style={styles.statLabel}>{item.label}</span>
          <span style={{
            ...styles.statValue,
            color: item.value.startsWith('+') ? '#4ade80' : item.value.startsWith('-') ? '#ef4444' : '#a0a0a0',
          }}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

/**
 * StarUpPanel — 升星/碎片面板组件
 *
 * @example
 * ```tsx
 * <StarUpPanel generalId="guanyu" onStarUp={(r) => console.log(r)} />
 * ```
 */
export function StarUpPanel({ generalId, onStarUp, onBreakthrough, onClose, className }: StarUpPanelProps) {
  const { engine, snapshot } = useGameContext();
  const [panelState, setPanelState] = useState<StarUpPanelState>({
    viewMode: 'starUp',
    starUpResult: null,
    breakthroughResult: null,
    isOperating: false,
    error: null,
  });

  // 获取引擎数据
  const heroSystem = engine.getHeroSystem();
  const general = heroSystem.getGeneral(generalId);
  const currentStar = 1; // 从引擎获取
  const fragmentProgress = null as FragmentProgress | null; // 从引擎获取
  const starUpPreview: StarUpPreview | null = null; // 从引擎获取
  const breakthroughPreview: BreakthroughPreview | null = null; // 从引擎获取

  // 创建逻辑实例
  const logic = useMemo(
    () => new StarUpLogic(fragmentProgress, starUpPreview, breakthroughPreview, currentStar),
    [fragmentProgress, starUpPreview, breakthroughPreview, currentStar],
  );

  const handleStarUp = useCallback(() => {
    const validation = logic.validateStarUp();
    if (!validation.valid) {
      setPanelState((prev) => ({ ...prev, error: validation.reason ?? null }));
      return;
    }
    setPanelState((prev) => ({ ...prev, isOperating: true, error: null }));
    // 实际调用引擎升星
    // const result = engine.heroStarSystem.starUp(generalId);
    setPanelState((prev) => ({ ...prev, isOperating: false }));
  }, [logic, generalId]);

  const handleBreakthrough = useCallback(() => {
    const validation = logic.validateBreakthrough();
    if (!validation.valid) {
      setPanelState((prev) => ({ ...prev, error: validation.reason ?? null }));
      return;
    }
    setPanelState((prev) => ({ ...prev, isOperating: true, error: null }));
    // 实际调用引擎突破
    // const result = engine.heroStarSystem.breakthrough(generalId);
    setPanelState((prev) => ({ ...prev, isOperating: false }));
  }, [logic, generalId]);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setPanelState((prev) => ({ ...prev, viewMode: mode, error: null }));
  }, []);

  if (!snapshot || !general) {
    return <div style={styles.loading}>加载中...</div>;
  }

  const statsDiff = logic.getStatsDiff();
  const costDesc = logic.getStarUpCostDesc();
  const btCost = logic.getBreakthroughCost();

  return (
    <div
      style={styles.container}
      className={`tk-star-up-panel ${className ?? ''}`.trim()}
      role="region"
      aria-label="升星面板"
    >
      {/* 标题 */}
      <div style={styles.header}>
        <span style={styles.title}>{general.name} — 升星</span>
        {onClose && <button style={styles.closeBtn} onClick={onClose}>✕</button>}
      </div>

      {/* 星级显示 */}
      <div style={styles.starRow}>
        <span style={styles.starDisplay}>{logic.getStarDisplay()}</span>
        <span style={styles.starLevel}>{currentStar}星</span>
      </div>

      {/* 模式切换 */}
      <div style={styles.modeTabs}>
        <button
          style={{ ...styles.modeTab, ...(panelState.viewMode === 'starUp' ? styles.modeTabActive : {}) }}
          onClick={() => handleViewModeChange('starUp')}
        >
          升星
        </button>
        <button
          style={{ ...styles.modeTab, ...(panelState.viewMode === 'breakthrough' ? styles.modeTabActive : {}) }}
          onClick={() => handleViewModeChange('breakthrough')}
        >
          突破
        </button>
      </div>

      {panelState.viewMode === 'starUp' ? (
        <>
          {/* 碎片进度 */}
          {fragmentProgress && (
            <FragmentProgressBar
              current={fragmentProgress.currentFragments}
              required={fragmentProgress.requiredFragments}
              percentage={fragmentProgress.percentage}
              canStarUp={fragmentProgress.canStarUp}
            />
          )}

          {/* 升星消耗 */}
          <div style={styles.costSection}>
            <div style={styles.costItem}>碎片: {costDesc.fragments}</div>
            <div style={styles.costItem}>铜钱: {costDesc.gold}</div>
          </div>

          {/* 属性预览 */}
          {statsDiff && <StatsPreview statsDiff={statsDiff} />}

          {/* 升星按钮 */}
          <button
            style={{
              ...styles.actionBtn,
              ...(!logic.canStarUp() || panelState.isOperating ? styles.actionBtnDisabled : {}),
            }}
            onClick={handleStarUp}
            disabled={!logic.canStarUp() || panelState.isOperating}
          >
            {panelState.isOperating ? '升星中...' : logic.isMaxStar() ? '已达最高星级' : '升星'}
          </button>
        </>
      ) : (
        <>
          {/* 突破信息 */}
          <div style={styles.costSection}>
            <div style={styles.sectionLabel}>突破条件</div>
            <div style={styles.costItem}>{logic.getBreakthroughDesc()}</div>
            {btCost && (
              <>
                <div style={styles.costItem}>碎片: {btCost.fragments}</div>
                <div style={styles.costItem}>铜钱: {btCost.gold}</div>
                <div style={styles.costItem}>突破石: {btCost.stones}</div>
              </>
            )}
          </div>

          {/* 突破按钮 */}
          <button
            style={{
              ...styles.actionBtn,
              ...(!logic.canBreakthrough() || panelState.isOperating ? styles.actionBtnDisabled : {}),
            }}
            onClick={handleBreakthrough}
            disabled={!logic.canBreakthrough() || panelState.isOperating}
          >
            {panelState.isOperating ? '突破中...' : '突破'}
          </button>
        </>
      )}

      {/* 错误信息 */}
      {panelState.error && (
        <div style={styles.errorBanner}>⚠️ {panelState.error}</div>
      )}
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
    maxWidth: '340px',
  },
  loading: {
    padding: '24px',
    textAlign: 'center',
    color: '#a0a0a0',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#d4a574',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#a0a0a0',
    cursor: 'pointer',
    fontSize: '16px',
  },
  starRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '12px',
  },
  starDisplay: {
    fontSize: '18px',
    color: '#fbbf24',
    letterSpacing: '2px',
  },
  starLevel: {
    fontSize: '14px',
    color: '#d4a574',
    fontWeight: 700,
  },
  modeTabs: {
    display: 'flex',
    gap: '4px',
    marginBottom: '12px',
  },
  modeTab: {
    flex: 1,
    padding: '6px',
    border: '1px solid rgba(212, 165, 116, 0.2)',
    borderRadius: '4px',
    background: 'transparent',
    color: '#a0a0a0',
    cursor: 'pointer',
    fontSize: '13px',
  },
  modeTabActive: {
    borderColor: '#d4a574',
    color: '#d4a574',
    backgroundColor: 'rgba(212, 165, 116, 0.1)',
  },
  progressContainer: {
    marginBottom: '12px',
  },
  progressLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    marginBottom: '4px',
  },
  progressBg: {
    width: '100%',
    height: '8px',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  readyHint: {
    fontSize: '11px',
    marginTop: '4px',
    textAlign: 'center',
  },
  costSection: {
    padding: '8px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '6px',
    marginBottom: '12px',
  },
  sectionLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#d4a574',
    marginBottom: '4px',
  },
  costItem: {
    fontSize: '12px',
    color: '#e8e0d0',
    marginBottom: '2px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '4px',
    marginBottom: '12px',
  },
  statItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 8px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '4px',
  },
  statLabel: {
    fontSize: '12px',
    color: '#a0a0a0',
  },
  statValue: {
    fontSize: '12px',
    fontWeight: 700,
  },
  actionBtn: {
    width: '100%',
    padding: '10px',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: '8px',
  },
  actionBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  errorBanner: {
    padding: '8px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '6px',
    color: '#ef4444',
    fontSize: '12px',
    textAlign: 'center',
  },
};
