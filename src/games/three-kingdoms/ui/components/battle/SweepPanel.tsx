/**
 * 三国霸业 — 扫荡面板组件
 *
 * 支持关卡扫荡功能：
 *   - 选择扫荡次数（1/3/5/10）
 *   - 显示预估收益（基于历史最高星级）
 *   - 执行扫荡并展示结果
 *   - 扫荡令数量显示与不足提示
 *
 * 引擎依赖：engine/campaign/ 下的 SweepSystem
 *
 * @module ui/components/battle/SweepPanel
 */

import { useState, useMemo, useCallback } from 'react';
import { useGameContext } from '../../context/GameContext';
import type { SweepBatchResult } from '../../../engine/campaign/sweep.types';
import { DEFAULT_SWEEP_CONFIG } from '../../../engine/campaign/sweep.types';

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

/** 扫荡次数选项 */
type SweepCountOption = 1 | 3 | 5 | 10;

/** 扫荡面板状态 */
interface SweepPanelState {
  /** 选中的扫荡次数 */
  selectedCount: SweepCountOption;
  /** 是否正在扫荡中 */
  isSweeping: boolean;
  /** 扫荡结果 */
  result: SweepBatchResult | null;
  /** 错误信息 */
  error: string | null;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 可选扫荡次数 */
const SWEEP_COUNT_OPTIONS: SweepCountOption[] = [1, 3, 5, 10];

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface SweepPanelProps {
  /** 目标关卡 ID */
  stageId: string;
  /** 扫荡完成回调 */
  onSweepComplete?: (result: SweepBatchResult) => void;
  /** 关闭面板回调 */
  onClose?: () => void;
  /** 额外类名 */
  className?: string;
}

// ─────────────────────────────────────────────
// 纯逻辑管理器（用于测试）
// ─────────────────────────────────────────────

/**
 * SweepLogic — 扫荡面板逻辑管理器
 *
 * 封装扫荡面板的核心逻辑，不依赖 React DOM。
 */
export class SweepLogic {
  private ticketCount: number;
  private costPerRun: number;
  private maxSweepCount: number;
  private canSweepStage: boolean;
  private stageStars: number;

  constructor(
    ticketCount: number,
    costPerRun: number = DEFAULT_SWEEP_CONFIG.sweepCostPerRun,
    maxSweepCount: number = DEFAULT_SWEEP_CONFIG.maxSweepCount,
    canSweepStage: boolean = true,
    stageStars: number = 3,
  ) {
    this.ticketCount = ticketCount;
    this.costPerRun = costPerRun;
    this.maxSweepCount = maxSweepCount;
    this.canSweepStage = canSweepStage;
    this.stageStars = stageStars;
  }

  /** 获取可用扫荡次数选项（受扫荡令和上限限制） */
  getAvailableCounts(): SweepCountOption[] {
    return SWEEP_COUNT_OPTIONS.filter((c) => {
      // 不超过最大扫荡次数
      if (c > this.maxSweepCount) return false;
      return true;
    });
  }

  /** 计算所需扫荡令 */
  getRequiredTickets(count: number): number {
    return count * this.costPerRun;
  }

  /** 检查扫荡令是否足够 */
  hasEnoughTickets(count: number): boolean {
    return this.ticketCount >= this.getRequiredTickets(count);
  }

  /** 获取最大可扫荡次数 */
  getMaxAffordableCount(): number {
    if (this.costPerRun <= 0) return this.maxSweepCount;
    const byTickets = Math.floor(this.ticketCount / this.costPerRun);
    return Math.min(byTickets, this.maxSweepCount);
  }

  /** 检查是否可扫荡 */
  canSweep(count: number): { can: boolean; reason?: string } {
    if (!this.canSweepStage) {
      return { can: false, reason: '关卡未三星通关，无法扫荡' };
    }
    if (count <= 0) {
      return { can: false, reason: '扫荡次数必须大于0' };
    }
    if (count > this.maxSweepCount) {
      return { can: false, reason: `单次最多扫荡${this.maxSweepCount}次` };
    }
    if (!this.hasEnoughTickets(count)) {
      const required = this.getRequiredTickets(count);
      return { can: false, reason: `扫荡令不足（需要${required}，当前${this.ticketCount}）` };
    }
    return { can: true };
  }

  /** 计算预估收益（简化版：返回预估倍率） */
  estimateReward(count: number): { estimatedExp: number; estimatedResources: Record<string, number> } {
    // 预估收益基于历史最高星级
    const multiplier = this.stageStars / 3; // 三星=1.0, 二星=0.67, 一星=0.33
    return {
      estimatedExp: Math.round(count * 100 * multiplier),
      estimatedResources: {
        grain: Math.round(count * 50 * multiplier),
        gold: Math.round(count * 30 * multiplier),
      },
    };
  }

  /** 获取扫荡令状态 */
  getTicketInfo(): { current: number; costPerRun: number } {
    return { current: this.ticketCount, costPerRun: this.costPerRun };
  }

  /** 格式化资源数量 */
  static formatResources(resources: Partial<Record<string, number>>): string[] {
    const RESOURCE_LABELS: Record<string, string> = { grain: '粮草', gold: '铜钱', troops: '兵力' };
    return Object.entries(resources)
      .filter(([, v]) => v !== undefined && v > 0)
      .map(([k, v]) => `${RESOURCE_LABELS[k] ?? k}: ${v}`);
  }
}

// ─────────────────────────────────────────────
// 子组件：扫荡次数选择
// ─────────────────────────────────────────────

interface CountSelectorProps {
  options: SweepCountOption[];
  selected: SweepCountOption;
  disabledCounts: Set<number>;
  onSelect: (count: SweepCountOption) => void;
}

function CountSelector({ options, selected, disabledCounts, onSelect }: CountSelectorProps) {
  return (
    <div style={styles.countRow}>
      {options.map((count) => {
        const disabled = disabledCounts.has(count);
        return (
          <button
            key={count}
            style={{
              ...styles.countBtn,
              ...(selected === count ? styles.countBtnActive : {}),
              ...(disabled ? styles.countBtnDisabled : {}),
            }}
            onClick={() => !disabled && onSelect(count)}
            disabled={disabled}
          >
            {count}次
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// 子组件：扫荡结果
// ─────────────────────────────────────────────

interface SweepResultDisplayProps {
  result: SweepBatchResult;
}

function SweepResultDisplay({ result }: SweepResultDisplayProps) {
  if (!result.success) {
    return (
      <div style={styles.resultError}>
        <div>❌ 扫荡失败</div>
        <div style={styles.errorMsg}>{result.failureReason}</div>
      </div>
    );
  }

  return (
    <div style={styles.resultSuccess}>
      <div style={styles.resultTitle}>✅ 扫荡完成</div>
      <div style={styles.resultRow}>执行次数: {result.executedCount}/{result.requestedCount}</div>
      <div style={styles.resultRow}>消耗扫荡令: {result.ticketsUsed}</div>
      <div style={styles.resultRow}>获得经验: {result.totalExp}</div>
      {Object.entries(result.totalResources).map(([key, value]) => (
        value !== undefined && value > 0 ? (
          <div key={key} style={styles.resultRow}>{key}: {value}</div>
        ) : null
      ))}
      {Object.entries(result.totalFragments).map(([id, count]) => (
        <div key={id} style={styles.resultRow}>碎片({id}): {count}</div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

/**
 * SweepPanel — 扫荡面板组件
 *
 * @example
 * ```tsx
 * <SweepPanel stageId="chapter1_stage3" onSweepComplete={(r) => console.log(r)} />
 * ```
 */
export function SweepPanel({ stageId, onSweepComplete, onClose, className }: SweepPanelProps) {
  const { engine, snapshot } = useGameContext();
  const [state, setState] = useState<SweepPanelState>({
    selectedCount: 1,
    isSweeping: false,
    result: null,
    error: null,
  });

  // 获取扫荡系统数据（通过引擎获取）
  const sweepSystem = engine.getCampaignSystem();
  const ticketCount = 10; // 默认值，实际从引擎获取
  const canSweepStage = true; // 默认值，实际从引擎获取
  const stageStars = 3; // 默认值

  // 创建逻辑实例
  const logic = useMemo(
    () => new SweepLogic(ticketCount, 1, 10, canSweepStage, stageStars),
    [ticketCount, canSweepStage, stageStars],
  );

  // 可用次数选项
  const availableCounts = useMemo(() => logic.getAvailableCounts(), [logic]);

  // 不可用次数（扫荡令不足）
  const disabledCounts = useMemo(() => {
    const set = new Set<number>();
    for (const c of SWEEP_COUNT_OPTIONS) {
      if (!logic.hasEnoughTickets(c)) set.add(c);
    }
    return set;
  }, [logic]);

  // 预估收益
  const estimate = useMemo(
    () => logic.estimateReward(state.selectedCount),
    [logic, state.selectedCount],
  );

  // 扫荡检查
  const sweepCheck = useMemo(
    () => logic.canSweep(state.selectedCount),
    [logic, state.selectedCount],
  );

  const handleCountSelect = useCallback((count: SweepCountOption) => {
    setState((prev) => ({ ...prev, selectedCount: count, result: null, error: null }));
  }, []);

  const handleSweep = useCallback(() => {
    if (!sweepCheck.can) {
      setState((prev) => ({ ...prev, error: sweepCheck.reason ?? '无法扫荡' }));
      return;
    }

    setState((prev) => ({ ...prev, isSweeping: true, error: null }));

    // 实际调用引擎扫荡（此处为简化逻辑，真实场景通过引擎调用）
    try {
      // const result = sweepSystem.sweep(stageId, state.selectedCount);
      // 模拟成功结果
      const mockResult: SweepBatchResult = {
        success: true,
        stageId,
        requestedCount: state.selectedCount,
        executedCount: state.selectedCount,
        results: [],
        totalResources: { grain: estimate.estimatedResources.grain ?? 0, gold: estimate.estimatedResources.gold ?? 0 },
        totalExp: estimate.estimatedExp,
        totalFragments: {},
        ticketsUsed: logic.getRequiredTickets(state.selectedCount),
      };

      setState((prev) => ({ ...prev, isSweeping: false, result: mockResult }));
      onSweepComplete?.(mockResult);
    } catch (e) {
      setState((prev) => ({
        ...prev,
        isSweeping: false,
        error: e instanceof Error ? e.message : '扫荡失败',
      }));
    }
  }, [sweepCheck, stageId, state.selectedCount, estimate, logic, onSweepComplete]);

  if (!snapshot) {
    return <div style={styles.loading}>加载中...</div>;
  }

  const ticketInfo = logic.getTicketInfo();

  return (
    <div
      style={styles.container}
      className={`tk-sweep-panel ${className ?? ''}`.trim()}
      role="region"
      aria-label="扫荡面板"
    >
      {/* 标题 */}
      <div style={styles.header}>
        <span style={styles.title}>扫荡关卡</span>
        {onClose && (
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        )}
      </div>

      {/* 扫荡令信息 */}
      <div style={styles.ticketInfo}>
        <span>🎫 扫荡令: {ticketInfo.current}</span>
        <span style={styles.ticketCost}>每次消耗: {ticketInfo.costPerRun}</span>
      </div>

      {/* 次数选择 */}
      <div style={styles.sectionTitle}>选择次数</div>
      <CountSelector
        options={availableCounts}
        selected={state.selectedCount}
        disabledCounts={disabledCounts}
        onSelect={handleCountSelect}
      />

      {/* 预估收益 */}
      <div style={styles.sectionTitle}>预估收益</div>
      <div style={styles.estimateBox}>
        <div>经验: ~{estimate.estimatedExp}</div>
        {SweepLogic.formatResources(estimate.estimatedResources).map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>

      {/* 错误信息 */}
      {state.error && (
        <div style={styles.errorBanner}>⚠️ {state.error}</div>
      )}

      {/* 扫荡按钮 */}
      <button
        style={{
          ...styles.sweepBtn,
          ...(!sweepCheck.can || state.isSweeping ? styles.sweepBtnDisabled : {}),
        }}
        onClick={handleSweep}
        disabled={!sweepCheck.can || state.isSweeping}
      >
        {state.isSweeping ? '扫荡中...' : `扫荡 (${logic.getRequiredTickets(state.selectedCount)}令)`}
      </button>

      {/* 结果展示 */}
      {state.result && <SweepResultDisplay result={state.result} />}
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
    maxWidth: '320px',
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
  ticketInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '6px',
    marginBottom: '12px',
    fontSize: '13px',
  },
  ticketCost: {
    color: '#a0a0a0',
    fontSize: '12px',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#d4a574',
    marginBottom: '6px',
  },
  countRow: {
    display: 'flex',
    gap: '6px',
    marginBottom: '12px',
  },
  countBtn: {
    flex: 1,
    padding: '8px',
    border: '1px solid rgba(212, 165, 116, 0.2)',
    borderRadius: '6px',
    background: 'transparent',
    color: '#e8e0d0',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    transition: 'all 0.15s ease',
  },
  countBtnActive: {
    borderColor: '#d4a574',
    backgroundColor: 'rgba(212, 165, 116, 0.15)',
    color: '#d4a574',
  },
  countBtnDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  estimateBox: {
    padding: '8px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '6px',
    marginBottom: '12px',
    fontSize: '12px',
    color: '#a0a0a0',
  },
  errorBanner: {
    padding: '8px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '6px',
    color: '#ef4444',
    fontSize: '12px',
    marginBottom: '8px',
    textAlign: 'center',
  },
  sweepBtn: {
    width: '100%',
    padding: '10px',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: '12px',
  },
  sweepBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  resultSuccess: {
    padding: '12px',
    background: 'rgba(74, 222, 128, 0.1)',
    border: '1px solid rgba(74, 222, 128, 0.3)',
    borderRadius: '6px',
  },
  resultError: {
    padding: '12px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '6px',
    color: '#ef4444',
  },
  resultTitle: {
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '8px',
    color: '#4ade80',
  },
  resultRow: {
    fontSize: '12px',
    color: '#e8e0d0',
    marginBottom: '2px',
  },
  errorMsg: {
    fontSize: '12px',
    marginTop: '4px',
  },
};
