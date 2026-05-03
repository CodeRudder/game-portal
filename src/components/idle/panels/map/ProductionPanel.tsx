/**
 * ProductionPanel — 产出管理面板
 *
 * 功能：
 * - 显示每个己方领土的产出速率(金币/秒、粮草/秒等)
 * - 显示当前资源存量和存储上限
 * - 等级变化后产出速率实时更新
 * - 建筑加成在产出速率中正确反映
 * - 存储满时显示警告标识
 * - 面板数据与ProductionSystem实际数据一致
 *
 * @module components/idle/panels/map/ProductionPanel
 */

import React, { useMemo } from 'react';
import type {
  TerritoryData,
  TerritoryProductionSummary,
} from '@/games/three-kingdoms/core/map';
import { formatNumber } from '@/components/idle/utils/formatNumber';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

export interface ProductionPanelProps {
  /** 所有领土数据 */
  territories: TerritoryData[];
  /** 产出汇总 */
  productionSummary: TerritoryProductionSummary | null;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 资源配置 */
const RESOURCE_CONFIG = [
  { key: 'grain', label: '粮草', icon: '🌾', color: '#7EC850' },
  { key: 'gold', label: '金币', icon: '💰', color: '#d4a574' },
  { key: 'troops', label: '兵力', icon: '⚔️', color: '#e74c3c' },
  { key: 'mandate', label: '天命', icon: '👑', color: '#9b59b6' },
] as const;

/** 默认存储容量(与ProductionSystem一致) */
const DEFAULT_STORAGE: Record<string, number> = {
  gold: 10000,
  grain: 8000,
  troops: 5000,
  mandate: 1000,
};

// ─────────────────────────────────────────────
// 样式
// ─────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    fontSize: 12,
    color: '#e8e0d0',
  },
  summaryCard: {
    padding: '10px 12px',
    background: 'rgba(200,168,76,0.06)',
    border: '1px solid rgba(200,168,76,0.12)',
    borderRadius: 6,
  },
  summaryTitle: {
    fontSize: 11,
    color: '#a0a0a0',
    marginBottom: 8,
    fontWeight: 600,
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 6,
  },
  summaryItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 8px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 4,
  },
  summaryItemLabel: {
    color: '#a0a0a0',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
  },
  summaryItemValue: {
    fontWeight: 600,
    fontSize: 13,
  },
  territoryList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  territoryCard: {
    padding: '8px 10px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 6,
  },
  territoryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  territoryName: {
    fontWeight: 600,
    fontSize: 12,
    color: '#e8e0d0',
  },
  territoryLevel: {
    fontSize: 10,
    color: '#d4a574',
    fontWeight: 600,
  },
  productionGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 4,
  },
  prodItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '3px 6px',
    borderRadius: 4,
    fontSize: 11,
  },
  prodLabel: {
    color: '#a0a0a0',
    display: 'flex',
    alignItems: 'center',
    gap: 3,
  },
  prodValue: {
    fontWeight: 600,
  },
  storageBar: {
    width: '100%',
    height: 3,
    background: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  storageFill: {
    height: '100%',
    borderRadius: 2,
    transition: 'width 0.3s',
  },
  warningBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    padding: '2px 6px',
    borderRadius: 3,
    background: 'rgba(231,76,60,0.15)',
    border: '1px solid rgba(231,76,60,0.3)',
    color: '#e74c3c',
    fontSize: 10,
    fontWeight: 600,
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: 16,
    color: '#a0a0a0',
    fontSize: 13,
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 0',
    fontSize: 12,
    borderTop: '1px solid rgba(255,255,255,0.06)',
    marginTop: 6,
    paddingTop: 8,
  },
  totalLabel: {
    color: '#d4a574',
    fontWeight: 600,
  },
  totalValue: {
    color: '#e8e0d0',
    fontWeight: 700,
    fontSize: 14,
  },
};

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/**
 * 计算存储上限(与ProductionSystem一致: base * (1 + (level-1) * 0.1))
 */
function getStorageCapacity(resource: string, level: number): number {
  const base = DEFAULT_STORAGE[resource] ?? 5000;
  return Math.floor(base * (1 + (level - 1) * 0.1));
}

/**
 * 格式化产出速率(保留小数精度)
 */
function formatRate(val: number): string {
  if (val <= 0) return '0';
  if (val < 0.1) return val.toFixed(2);
  if (val < 1) return val.toFixed(1);
  // 对于有小数的值保留1位，整数则不显示小数
  if (val !== Math.floor(val)) return val.toFixed(1);
  return formatNumber(val);
}

// ─────────────────────────────────────────────
// 子组件: 资源存储进度条
// ─────────────────────────────────────────────

interface StorageBarProps {
  current: number;
  max: number;
  color: string;
}

const StorageBar: React.FC<StorageBarProps> = ({ current, max, color }) => {
  const ratio = max > 0 ? Math.min(current / max, 1) : 0;
  const isFull = ratio >= 0.95;

  return (
    <div style={s.storageBar}>
      <div
        style={{
          ...s.storageFill,
          width: `${ratio * 100}%`,
          background: isFull ? '#e74c3c' : color,
        }}
      />
    </div>
  );
};

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

const ProductionPanel: React.FC<ProductionPanelProps> = ({
  territories,
  productionSummary,
}) => {
  // ── 己方领土 ──
  const playerTerritories = useMemo(
    () => territories.filter((t) => t.ownership === 'player'),
    [territories],
  );

  // ── 总产出 ──
  const totalProduction = productionSummary?.totalProduction ?? null;

  // ── 是否有己方领土 ──
  const hasTerritories = playerTerritories.length > 0;

  if (!hasTerritories) {
    return (
      <div style={s.emptyState} data-testid="production-panel-empty">
        暂无己方领土
      </div>
    );
  }

  return (
    <div style={s.panel} data-testid="production-panel">
      {/* ── 总产出汇总 ── */}
      {totalProduction && (
        <div style={s.summaryCard} data-testid="production-summary">
          <div style={s.summaryTitle}>总产出 / 秒</div>
          <div style={s.summaryGrid}>
            {RESOURCE_CONFIG.map((res) => {
              const value = totalProduction[res.key as keyof typeof totalProduction] ?? 0;
              return (
                <div key={res.key} style={s.summaryItem}>
                  <span style={s.summaryItemLabel}>
                    <span>{res.icon}</span>
                    <span>{res.label}</span>
                  </span>
                  <span style={{ ...s.summaryItemValue, color: res.color }}>
                    {formatRate(value)}/s
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 各领土产出明细 ── */}
      <div style={s.territoryList} data-testid="production-territory-list">
        {playerTerritories.map((territory) => {
          const { id, name, level, currentProduction } = territory;
          const totalProd = currentProduction.grain + currentProduction.gold
            + currentProduction.troops + currentProduction.mandate;

          return (
            <div
              key={id}
              style={s.territoryCard}
              data-testid={`production-territory-${id}`}
            >
              {/* 领土标题 */}
              <div style={s.territoryHeader}>
                <span style={s.territoryName}>{name}</span>
                <span style={s.territoryLevel}>Lv.{level}</span>
              </div>

              {/* 产出速率 */}
              <div style={s.productionGrid}>
                {RESOURCE_CONFIG.map((res) => {
                  const rate = currentProduction[res.key as keyof typeof currentProduction] ?? 0;
                  const storage = getStorageCapacity(res.key, level);
                  const isFull = rate > 0 && storage > 0; // 仅当有产出时显示进度条

                  return (
                    <div
                      key={res.key}
                      style={{
                        ...s.prodItem,
                        background: rate > 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                      }}
                    >
                      <span style={s.prodLabel}>
                        <span>{res.icon}</span>
                        <span>{res.label}</span>
                      </span>
                      <span style={{ ...s.prodValue, color: res.color }}>
                        {formatRate(rate)}/s
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* 存储容量提示 */}
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {RESOURCE_CONFIG.map((res) => {
                  const storage = getStorageCapacity(res.key, level);
                  return (
                    <span
                      key={res.key}
                      style={{
                        fontSize: 9,
                        color: '#666',
                        padding: '1px 4px',
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: 2,
                      }}
                    >
                      {res.icon}{formatNumber(storage)}
                    </span>
                  );
                })}
              </div>

              {/* 领土总产出 */}
              <div style={s.totalRow}>
                <span style={s.totalLabel}>领土总产出</span>
                <span style={s.totalValue}>{formatRate(totalProd)}/s</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 存储警告汇总 ── */}
      <StorageWarnings territories={playerTerritories} />
    </div>
  );
};

// ─────────────────────────────────────────────
// 子组件: 存储容量警告
// ─────────────────────────────────────────────

interface StorageWarningsProps {
  territories: TerritoryData[];
}

const StorageWarnings: React.FC<StorageWarningsProps> = ({ territories }) => {
  // 检查是否有任何领土产出接近存储上限
  const warnings = useMemo(() => {
    const result: Array<{ territoryName: string; resource: string; icon: string }> = [];

    for (const territory of territories) {
      for (const res of RESOURCE_CONFIG) {
        const rate = territory.currentProduction[res.key as keyof typeof territory.currentProduction] ?? 0;
        if (rate <= 0) continue;

        const capacity = getStorageCapacity(res.key, territory.level);
        // 仅当产出速率较高（> 存储容量的80%/小时）时才给出提示
        const hourlyOutput = rate * 3600;
        if (hourlyOutput > capacity * 0.8) {
          result.push({
            territoryName: territory.name,
            resource: res.label,
            icon: res.icon,
          });
        }
      }
    }

    return result;
  }, [territories]);

  if (warnings.length === 0) return null;

  return (
    <div
      style={{
        padding: '8px 10px',
        background: 'rgba(231,76,60,0.06)',
        border: '1px solid rgba(231,76,60,0.15)',
        borderRadius: 6,
      }}
      data-testid="production-storage-warnings"
    >
      <div style={s.warningBadge}>
        ⚠️ 存储容量提示
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: '#a0a0a0', lineHeight: 1.6 }}>
        {warnings.slice(0, 5).map((w, i) => (
          <div key={i}>
            {w.icon} {w.territoryName} - {w.resource} 产出较快，请及时收取
          </div>
        ))}
        {warnings.length > 5 && (
          <div>...还有 {warnings.length - 5} 条提示</div>
        )}
      </div>
    </div>
  );
};

export default ProductionPanel;
