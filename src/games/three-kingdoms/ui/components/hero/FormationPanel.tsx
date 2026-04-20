/**
 * 三国霸业 — 编队面板组件
 *
 * 支持6人编队管理（前3后3）：
 *   - 编队创建/切换/删除
 *   - 一键布阵（按战力自动选人）
 *   - 武将拖拽换位
 *   - 编队总战力显示
 *
 * 引擎依赖：engine/hero/ 下的 HeroFormation
 *
 * @module ui/components/hero/FormationPanel
 */

import { useState, useMemo, useCallback } from 'react';
import { useGameContext } from '../../context/GameContext';
import type { FormationData } from '../../../engine/hero/HeroFormation';
import { MAX_FORMATIONS, MAX_SLOTS_PER_FORMATION } from '../../../engine/hero/HeroFormation';
import type { GeneralData } from '../../../engine/hero/hero.types';

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

/** 站位类型 */
type SlotPosition = 'front' | 'back';

/** 编队面板状态 */
interface FormationPanelState {
  /** 当前选中的编队 ID */
  activeFormationId: string;
  /** 拖拽中的武将 ID */
  draggingGeneralId: string | null;
  /** 拖拽源位置索引 */
  dragSourceIndex: number | null;
}

/** 武将战力计算函数 */
type CalcPowerFn = (hero: GeneralData) => number;

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 前排索引 (0, 1, 2) */
const FRONT_ROW_INDICES = [0, 1, 2];
/** 后排索引 (3, 4, 5) */
const BACK_ROW_INDICES = [3, 4, 5];

/** 位置标签 */
const POSITION_LABELS: Record<number, string> = {
  0: '前排左', 1: '前排中', 2: '前排右',
  3: '后排左', 4: '后排中', 5: '后排右',
};

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface FormationPanelProps {
  /** 编队变更回调 */
  onFormationChange?: (formation: FormationData) => void;
  /** 额外类名 */
  className?: string;
}

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 简化版战力计算 */
function calcPower(hero: GeneralData): number {
  const s = hero.baseStats;
  return Math.round((s.attack + s.defense + s.intelligence + s.speed) * (1 + hero.level * 0.1));
}

/** 获取位置类型 */
function getSlotPosition(index: number): SlotPosition {
  return index < 3 ? 'front' : 'back';
}

/** 格式化战力 */
function formatPower(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return n.toLocaleString();
}

// ─────────────────────────────────────────────
// 纯逻辑管理器（用于测试）
// ─────────────────────────────────────────────

/**
 * FormationLogic — 编队面板逻辑管理器
 *
 * 封装编队面板的核心逻辑，不依赖 React DOM。
 */
export class FormationLogic {
  private formations: Record<string, FormationData>;
  private activeFormationId: string | null;
  private heroes: GeneralData[];
  private calcPowerFn: CalcPowerFn;

  constructor(
    formations: FormationData[],
    activeFormationId: string | null,
    heroes: GeneralData[],
    calcPowerFn: CalcPowerFn = calcPower,
  ) {
    this.formations = {};
    for (const f of formations) {
      this.formations[f.id] = f;
    }
    this.activeFormationId = activeFormationId;
    this.heroes = heroes;
    this.calcPowerFn = calcPowerFn;
  }

  /** 获取当前激活编队 */
  getActiveFormation(): FormationData | null {
    if (!this.activeFormationId) return null;
    return this.formations[this.activeFormationId] ?? null;
  }

  /** 获取所有编队 */
  getAllFormations(): FormationData[] {
    return Object.values(this.formations);
  }

  /** 获取编队数量 */
  getFormationCount(): number {
    return Object.keys(this.formations).length;
  }

  /** 是否可以创建新编队 */
  canCreateFormation(): boolean {
    return this.getFormationCount() < MAX_FORMATIONS;
  }

  /** 计算编队总战力 */
  calcFormationPower(formation: FormationData): number {
    return formation.slots
      .filter((id) => id !== '')
      .reduce((sum, id) => {
        const hero = this.heroes.find((h) => h.id === id);
        return sum + (hero ? this.calcPowerFn(hero) : 0);
      }, 0);
  }

  /** 获取编队中的武将数量 */
  getMemberCount(formationId: string): number {
    const f = this.formations[formationId];
    if (!f) return 0;
    return f.slots.filter((s) => s !== '').length;
  }

  /** 获取编队中指定位置的武将 */
  getSlotGeneral(formationId: string, slotIndex: number): GeneralData | null {
    const f = this.formations[formationId];
    if (!f || slotIndex < 0 || slotIndex >= MAX_SLOTS_PER_FORMATION) return null;
    const heroId = f.slots[slotIndex];
    if (!heroId) return null;
    return this.heroes.find((h) => h.id === heroId) ?? null;
  }

  /** 获取未上阵的武将列表（按战力降序） */
  getUnassignedHeroes(): GeneralData[] {
    const activeFormation = this.getActiveFormation();
    if (!activeFormation) return [...this.heroes].sort((a, b) => this.calcPowerFn(b) - this.calcPowerFn(a));

    const assignedIds = new Set(activeFormation.slots.filter((s) => s !== ''));
    return this.heroes
      .filter((h) => !assignedIds.has(h.id))
      .sort((a, b) => this.calcPowerFn(b) - this.calcPowerFn(a));
  }

  /** 切换编队 */
  switchFormation(formationId: string): FormationData | null {
    if (!this.formations[formationId]) return null;
    this.activeFormationId = formationId;
    return this.formations[formationId];
  }

  /** 交换两个位置的武将 */
  swapSlots(formationId: string, indexA: number, indexB: number): FormationData | null {
    const f = this.formations[formationId];
    if (!f) return null;
    if (indexA < 0 || indexA >= MAX_SLOTS_PER_FORMATION) return null;
    if (indexB < 0 || indexB >= MAX_SLOTS_PER_FORMATION) return null;

    const temp = f.slots[indexA];
    f.slots[indexA] = f.slots[indexB];
    f.slots[indexB] = temp;
    return { ...f, slots: [...f.slots] };
  }

  /** 将武将放入指定位置 */
  placeHero(formationId: string, heroId: string, slotIndex: number): FormationData | null {
    const f = this.formations[formationId];
    if (!f) return null;
    if (slotIndex < 0 || slotIndex >= MAX_SLOTS_PER_FORMATION) return null;

    // 如果该武将已在其他位置，先移除
    const existingIndex = f.slots.indexOf(heroId);
    if (existingIndex >= 0) {
      f.slots[existingIndex] = '';
    }

    f.slots[slotIndex] = heroId;
    return { ...f, slots: [...f.slots] };
  }

  /** 从编队移除武将 */
  removeHero(formationId: string, slotIndex: number): FormationData | null {
    const f = this.formations[formationId];
    if (!f) return null;
    if (slotIndex < 0 || slotIndex >= MAX_SLOTS_PER_FORMATION) return null;

    f.slots[slotIndex] = '';
    return { ...f, slots: [...f.slots] };
  }

  /** 一键布阵：按战力自动选前5个武将 */
  autoFormation(formationId: string): FormationData | null {
    const f = this.formations[formationId];
    if (!f) return null;

    const sorted = [...this.heroes].sort((a, b) => this.calcPowerFn(b) - this.calcPowerFn(a));
    const selected = sorted.slice(0, Math.min(5, MAX_SLOTS_PER_FORMATION));

    f.slots = Array(MAX_SLOTS_PER_FORMATION).fill('');
    selected.forEach((hero, i) => {
      f.slots[i] = hero.id;
    });

    return { ...f, slots: [...f.slots] };
  }

  /** 获取编队布局描述 */
  getFormationLayout(formationId: string): { front: (string | null)[]; back: (string | null)[] } {
    const f = this.formations[formationId];
    if (!f) return { front: [null, null, null], back: [null, null, null] };

    const getName = (id: string) => {
      if (!id) return null;
      return this.heroes.find((h) => h.id === id)?.name ?? null;
    };

    return {
      front: f.slots.slice(0, 3).map(getName),
      back: f.slots.slice(3, 6).map(getName),
    };
  }
}

// ─────────────────────────────────────────────
// 子组件：编队格子
// ─────────────────────────────────────────────

interface FormationSlotProps {
  index: number;
  hero: GeneralData | null;
  isDragging: boolean;
  onDrop: (targetIndex: number) => void;
  onDragStart: (index: number) => void;
  onRemove: (index: number) => void;
}

function FormationSlot({ index, hero, isDragging, onDrop, onDragStart, onRemove }: FormationSlotProps) {
  const position = getSlotPosition(index);
  const borderColor = position === 'front' ? '#d4a574' : '#60a5fa';

  return (
    <div
      style={{
        ...styles.slot,
        borderColor,
        background: isDragging ? 'rgba(212, 165, 116, 0.1)' : 'rgba(255,255,255,0.04)',
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => onDrop(index)}
      role="gridcell"
      aria-label={hero ? `${hero.name} - ${POSITION_LABELS[index]}` : `空位 - ${POSITION_LABELS[index]}`}
    >
      {hero ? (
        <>
          <div style={styles.slotName}>{hero.name}</div>
          <div style={styles.slotPower}>⚔️ {formatPower(calcPower(hero))}</div>
          <button style={styles.slotRemove} onClick={() => onRemove(index)}>✕</button>
        </>
      ) : (
        <div style={styles.slotEmpty}>{POSITION_LABELS[index]}</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

/**
 * FormationPanel — 编队面板组件
 *
 * @example
 * ```tsx
 * <FormationPanel onFormationChange={(f) => console.log(f)} />
 * ```
 */
export function FormationPanel({ onFormationChange, className }: FormationPanelProps) {
  const { engine, snapshot } = useGameContext();
  const [panelState, setPanelState] = useState<FormationPanelState>({
    activeFormationId: '1',
    draggingGeneralId: null,
    dragSourceIndex: null,
  });

  if (!snapshot) {
    return <div style={styles.loading}>加载中...</div>;
  }

  // 获取引擎数据
  const formations = engine.getFormations();
  const activeFormationId = snapshot.activeFormationId ?? '1';
  const heroes = snapshot.heroes as unknown as GeneralData[];

  // 创建逻辑实例
  const logic = useMemo(
    () => new FormationLogic(formations, activeFormationId, heroes),
    [formations, activeFormationId, heroes],
  );

  // 当前编队
  const activeFormation = logic.getActiveFormation();
  const formationPower = activeFormation ? logic.calcFormationPower(activeFormation) : 0;

  // 未上阵武将
  const unassignedHeroes = useMemo(() => logic.getUnassignedHeroes(), [logic]);

  const handleFormationSwitch = useCallback((id: string) => {
    setPanelState((prev) => ({ ...prev, activeFormationId: id }));
    const formation = logic.switchFormation(id);
    if (formation) onFormationChange?.(formation);
  }, [logic, onFormationChange]);

  const handleAutoFormation = useCallback(() => {
    const formation = logic.autoFormation(panelState.activeFormationId);
    if (formation) onFormationChange?.(formation);
  }, [logic, panelState.activeFormationId, onFormationChange]);

  const handleSwapSlots = useCallback((targetIndex: number) => {
    if (panelState.dragSourceIndex === null) return;
    const formation = logic.swapSlots(panelState.activeFormationId, panelState.dragSourceIndex, targetIndex);
    if (formation) onFormationChange?.(formation);
    setPanelState((prev) => ({ ...prev, draggingGeneralId: null, dragSourceIndex: null }));
  }, [logic, panelState.dragSourceIndex, panelState.activeFormationId, onFormationChange]);

  const handleDragStart = useCallback((index: number) => {
    setPanelState((prev) => ({ ...prev, dragSourceIndex: index }));
  }, []);

  const handleRemove = useCallback((index: number) => {
    const formation = logic.removeHero(panelState.activeFormationId, index);
    if (formation) onFormationChange?.(formation);
  }, [logic, panelState.activeFormationId, onFormationChange]);

  return (
    <div
      style={styles.container}
      className={`tk-formation-panel ${className ?? ''}`.trim()}
      role="region"
      aria-label="编队面板"
    >
      {/* 标题 + 战力 */}
      <div style={styles.header}>
        <span style={styles.title}>编队</span>
        <span style={styles.power}>总战力: ⚔️ {formatPower(formationPower)}</span>
      </div>

      {/* 编队切换 */}
      <div style={styles.formationTabs}>
        {logic.getAllFormations().map((f) => (
          <button
            key={f.id}
            style={{
              ...styles.formationTab,
              ...(panelState.activeFormationId === f.id ? styles.formationTabActive : {}),
            }}
            onClick={() => handleFormationSwitch(f.id)}
          >
            {f.name}
          </button>
        ))}
        {logic.canCreateFormation() && (
          <button style={styles.addTab} onClick={() => engine.createFormation()}>+</button>
        )}
      </div>

      {/* 一键布阵 */}
      <button style={styles.autoBtn} onClick={handleAutoFormation}>
        🤖 一键布阵
      </button>

      {/* 编队布局 */}
      <div style={styles.formationGrid} role="grid">
        {/* 后排 */}
        <div style={styles.row}>
          <span style={styles.rowLabel}>后排</span>
          {BACK_ROW_INDICES.map((i) => (
            <FormationSlot
              key={i}
              index={i}
              hero={logic.getSlotGeneral(panelState.activeFormationId, i)}
              isDragging={panelState.dragSourceIndex === i}
              onDrop={handleSwapSlots}
              onDragStart={handleDragStart}
              onRemove={handleRemove}
            />
          ))}
        </div>
        {/* 前排 */}
        <div style={styles.row}>
          <span style={styles.rowLabel}>前排</span>
          {FRONT_ROW_INDICES.map((i) => (
            <FormationSlot
              key={i}
              index={i}
              hero={logic.getSlotGeneral(panelState.activeFormationId, i)}
              isDragging={panelState.dragSourceIndex === i}
              onDrop={handleSwapSlots}
              onDragStart={handleDragStart}
              onRemove={handleRemove}
            />
          ))}
        </div>
      </div>

      {/* 候选武将 */}
      <div style={styles.candidateSection}>
        <div style={styles.candidateTitle}>未上阵武将 ({unassignedHeroes.length})</div>
        <div style={styles.candidateList}>
          {unassignedHeroes.map((hero) => (
            <div key={hero.id} style={styles.candidateItem}>
              <span style={styles.candidateName}>{hero.name}</span>
              <span style={styles.candidatePower}>⚔️ {formatPower(calcPower(hero))}</span>
            </div>
          ))}
          {unassignedHeroes.length === 0 && (
            <div style={styles.candidateEmpty}>所有武将已上阵</div>
          )}
        </div>
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
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#d4a574',
  },
  power: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#fbbf24',
  },
  formationTabs: {
    display: 'flex',
    gap: '4px',
    marginBottom: '8px',
  },
  formationTab: {
    padding: '4px 12px',
    border: '1px solid rgba(212, 165, 116, 0.2)',
    borderRadius: '4px',
    background: 'transparent',
    color: '#a0a0a0',
    cursor: 'pointer',
    fontSize: '12px',
  },
  formationTabActive: {
    borderColor: '#d4a574',
    color: '#d4a574',
    backgroundColor: 'rgba(212, 165, 116, 0.1)',
  },
  addTab: {
    padding: '4px 8px',
    border: '1px dashed rgba(212, 165, 116, 0.3)',
    borderRadius: '4px',
    background: 'transparent',
    color: '#d4a574',
    cursor: 'pointer',
    fontSize: '14px',
  },
  autoBtn: {
    width: '100%',
    padding: '6px',
    marginBottom: '8px',
    background: 'rgba(96, 165, 250, 0.15)',
    border: '1px solid rgba(96, 165, 250, 0.3)',
    borderRadius: '6px',
    color: '#60a5fa',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
  },
  formationGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginBottom: '12px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  rowLabel: {
    fontSize: '11px',
    color: '#666',
    minWidth: '28px',
  },
  slot: {
    flex: 1,
    minHeight: '48px',
    border: '1px solid',
    borderRadius: '6px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    cursor: 'pointer',
    transition: 'background 0.15s ease',
  },
  slotName: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#e8e0d0',
  },
  slotPower: {
    fontSize: '10px',
    color: '#d4a574',
  },
  slotRemove: {
    position: 'absolute',
    top: '2px',
    right: '2px',
    background: 'transparent',
    border: 'none',
    color: '#ef4444',
    cursor: 'pointer',
    fontSize: '10px',
  },
  slotEmpty: {
    fontSize: '10px',
    color: '#555',
  },
  candidateSection: {
    borderTop: '1px solid rgba(212, 165, 116, 0.15)',
    paddingTop: '8px',
  },
  candidateTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#d4a574',
    marginBottom: '6px',
  },
  candidateList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
  },
  candidateItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  candidateName: {
    fontSize: '12px',
    color: '#e8e0d0',
  },
  candidatePower: {
    fontSize: '10px',
    color: '#d4a574',
  },
  candidateEmpty: {
    fontSize: '12px',
    color: '#666',
    padding: '8px',
  },
};
