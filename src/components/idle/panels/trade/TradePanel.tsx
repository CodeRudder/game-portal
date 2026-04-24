/**
 * TradePanel — 商贸路线面板 (v8.0 增强版)
 *
 * 展示所有可用贸易路线、商品价格波动、活跃商队列表。
 * 玩家可开通商路、查看繁荣度、派遣商队沿路线贸易。
 *
 * 数据来源：engine.getTradeSystem() / engine.getCaravanSystem()
 *
 * @module panels/trade/TradePanel
 */
import React, { useState, useMemo, useCallback } from 'react';
import SharedPanel from '@/components/idle/components/SharedPanel';

// ─── 类型 ────────────────────────────────────
interface TradePanelProps {
  engine: any;
  /** 是否显示面板 */
  visible?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
}

/** 繁荣度等级标签 */
const PROSPERITY_LABELS: Record<string, string> = {
  barren: '荒芜',
  developing: '发展中',
  prosperous: '繁荣',
  golden: '黄金时代',
};

/** 繁荣度颜色 */
const PROSPERITY_COLORS: Record<string, string> = {
  barren: '#888',
  developing: '#4CAF50',
  prosperous: '#FFB74D',
  golden: '#FFD700',
};

/** 商队状态标签 */
const CARAVAN_STATUS_LABELS: Record<string, string> = {
  idle: '待命',
  traveling: '运输中',
  trading: '交易中',
  returning: '返回中',
};

/** 商队状态颜色 */
const CARAVAN_STATUS_COLORS: Record<string, string> = {
  idle: '#888',
  traveling: '#4CAF50',
  trading: '#FFB74D',
  returning: '#64B5F6',
};

// ─── 主组件 ──────────────────────────────────
const TradePanel: React.FC<TradePanelProps> = ({ engine, visible = true, onClose }) => {
  const [message, setMessage] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'routes' | 'caravans' | 'prices'>('routes');

  // 获取贸易系统
  const tradeSystem = engine?.getTradeSystem?.() ?? engine?.trade;
  const caravanSystem = engine?.getCaravanSystem?.() ?? engine?.caravan;

  // 贸易路线状态
  const tradeState = useMemo(() => {
    if (!tradeSystem) return null;
    try { return tradeSystem.getState?.(); } catch { return null; }
  }, [tradeSystem, message]);

  // 路线定义
  const routeDefs = useMemo(() => {
    if (!tradeSystem) return [];
    try { return tradeSystem.getRouteDefs?.() ?? []; } catch { return []; }
  }, [tradeSystem]);

  // 路线状态Map
  const routeStates = useMemo(() => {
    if (!tradeSystem) return new Map();
    try {
      const all = tradeSystem.getAllRouteStates?.();
      return all instanceof Map ? all : new Map(Object.entries(all ?? {}));
    } catch { return new Map(); }
  }, [tradeSystem, message]);

  // 商品价格
  const goodsPrices = useMemo(() => {
    if (!tradeSystem) return new Map();
    try {
      const all = tradeSystem.getAllPrices?.();
      return all instanceof Map ? all : new Map(Object.entries(all ?? {}));
    } catch { return new Map(); }
  }, [tradeSystem]);

  // 商品定义
  const goodsDefs = useMemo(() => {
    if (!tradeSystem) return [];
    try { return tradeSystem.getAllGoodsDefs?.() ?? []; } catch { return []; }
  }, [tradeSystem]);

  // 商队列表
  const caravans = useMemo(() => {
    if (!caravanSystem) return [];
    try { return caravanSystem.getCaravans?.() ?? []; } catch { return []; }
  }, [caravanSystem, message]);

  // 空闲商队
  const idleCaravans = useMemo(() => {
    if (!caravanSystem) return [];
    try { return caravanSystem.getIdleCaravans?.() ?? []; } catch { return []; }
  }, [caravanSystem, message]);

  // 显示消息
  const showMessage = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 2500);
  }, []);

  // 开通商路
  const handleOpenRoute = useCallback((routeId: string) => {
    if (!tradeSystem) return;
    try {
      const castleLevel = engine?.building?.getCastleLevel?.() ?? 1;
      const result = tradeSystem.openRoute?.(routeId, castleLevel);
      showMessage(result?.success ? '✅ 商路已开通！' : `❌ ${result?.reason ?? '开通失败'}`);
    } catch (e: any) {
      showMessage(`❌ ${e?.message ?? '操作失败'}`);
    }
  }, [tradeSystem, showMessage]);

  // 派遣商队
  const handleDispatch = useCallback((routeId: string) => {
    if (!caravanSystem || idleCaravans.length === 0) {
      showMessage('❌ 没有空闲商队');
      return;
    }
    try {
      const caravanId = idleCaravans[0].id;
      const result = caravanSystem.dispatch?.({
        caravanId,
        routeId,
        cargo: { 'silk': 10 }, // 默认货物，后续版本增加货物选择UI
      });
      showMessage(result?.success
        ? `🚃 商队已出发！预计利润: ${result.estimatedProfit ?? '???'} 铜钱`
        : `❌ ${result?.reason ?? '派遣失败'}`
      );
    } catch (e: any) {
      showMessage(`❌ ${e?.message ?? '操作失败'}`);
    }
  }, [caravanSystem, idleCaravans, showMessage]);

  // 刷新价格
  const handleRefreshPrices = useCallback(() => {
    if (!tradeSystem) return;
    try {
      tradeSystem.refreshPrices?.();
      showMessage('🔄 价格已刷新');
    } catch (e: any) {
      showMessage(`❌ ${e?.message ?? '刷新失败'}`);
    }
  }, [tradeSystem, showMessage]);

  return (
    <SharedPanel
      visible={visible}
      title="商贸"
      icon="🚃"
      onClose={onClose}
      width="560px"
    >
      <div style={styles.wrap} data-testid="trade-panel">
        {/* 操作反馈消息 */}
        {message && (
          <div style={styles.message}>{message}</div>
        )}

        {/* Tab切换 */}
        <div style={styles.tabBar}>
          <button
            style={{ ...styles.tabBtn, ...(activeTab === 'routes' ? styles.activeTab : {}) }}
            onClick={() => setActiveTab('routes')}
          >
            🗺️ 商路 ({routeDefs.length})
          </button>
          <button
            style={{ ...styles.tabBtn, ...(activeTab === 'caravans' ? styles.activeTab : {}) }}
            onClick={() => setActiveTab('caravans')}
          >
            🚃 商队 ({caravans.length})
          </button>
          <button
            style={{ ...styles.tabBtn, ...(activeTab === 'prices' ? styles.activeTab : {}) }}
            onClick={() => setActiveTab('prices')}
          >
            📊 行情
          </button>
        </div>

        {/* 商路Tab */}
        {activeTab === 'routes' && (
          <div style={styles.tabContent}>
            {routeDefs.length === 0 ? (
              <div style={styles.empty}>暂无可用贸易路线</div>
            ) : (
              <div style={styles.routeList}>
                {routeDefs.map((def: any, i: number) => {
                  const state = routeStates.get(def.id);
                  const isOpened = state?.opened ?? false;
                  const prosperity = state?.prosperity ?? 0;
                  const completedTrades = state?.completedTrades ?? 0;
                  const tier = tradeSystem?.getProsperityTier?.(def.id);
                  const prosperityLevel = tier?.level ?? 'barren';
                  const multiplier = tier?.outputMultiplier ?? 1;

                  return (
                    <div key={def.id ?? i} style={{
                      ...styles.routeCard,
                      border: isOpened ? '1px solid rgba(212,165,116,0.3)' : '1px solid rgba(255,255,255,0.1)',
                    }}>
                      <div style={styles.routeInfo}>
                        <div style={styles.routeName}>
                          {def.from ?? '???'} → {def.to ?? '???'}
                          {isOpened && <span style={styles.openedBadge}>已开通</span>}
                        </div>
                        <div style={styles.routeMeta}>
                          繁荣度: <span style={{ color: PROSPERITY_COLORS[prosperityLevel] }}>
                            {PROSPERITY_LABELS[prosperityLevel] ?? '未知'} ({Math.floor(prosperity)}%)
                          </span>
                          {multiplier > 1 && <span style={styles.bonus}> ×{multiplier}产出</span>}
                        </div>
                        <div style={styles.routeMeta}>
                          完成贸易: {completedTrades}次 | 需要主城{def.requiredCastleLevel ?? 1}级
                        </div>
                      </div>
                      <div style={styles.routeActions}>
                        {!isOpened ? (
                          <button style={styles.openBtn} onClick={() => handleOpenRoute(def.id)}>
                            开通
                          </button>
                        ) : (
                          <button
                            style={{ ...styles.sendBtn, ...(idleCaravans.length === 0 ? styles.sendBtnDisabled : {}) }}
                            disabled={idleCaravans.length === 0}
                            onClick={() => handleDispatch(def.id)}
                          >
                            派遣商队
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 商队Tab */}
        {activeTab === 'caravans' && (
          <div style={styles.tabContent}>
            <div style={styles.caravanSummary}>
              空闲: <span style={{ color: '#4CAF50' }}>{idleCaravans.length}</span> / {caravans.length}
            </div>
            {caravans.length === 0 ? (
              <div style={styles.empty}>暂无商队</div>
            ) : (
              <div style={styles.caravanList}>
                {caravans.map((c: any, i: number) => {
                  const status = c.status ?? 'idle';
                  const hasGuard = c.guardHeroId != null;
                  const remainingMs = c.arrivalTime ? Math.max(0, c.arrivalTime - Date.now()) : 0;
                  const remainingMin = Math.ceil(remainingMs / 60000);

                  return (
                    <div key={c.id ?? i} style={styles.caravanCard}>
                      <div style={styles.caravanHeader}>
                        <span style={styles.caravanName}>🚃 {c.name ?? `商队${i + 1}`}</span>
                        <span style={{ ...styles.statusBadge, color: CARAVAN_STATUS_COLORS[status] }}>
                          {CARAVAN_STATUS_LABELS[status] ?? status}
                        </span>
                      </div>
                      <div style={styles.caravanMeta}>
                        载重: {c.attributes?.currentLoad ?? 0}/{c.attributes?.capacity ?? '?'}
                        {hasGuard && <span style={styles.guardBadge}>🛡️ 有护卫</span>}
                      </div>
                      {status !== 'idle' && remainingMin > 0 && (
                        <div style={styles.caravanTimer}>
                          ⏱️ 剩余 {remainingMin} 分钟
                        </div>
                      )}
                      {c.currentRouteId && (
                        <div style={styles.caravanRoute}>
                          路线: {c.currentRouteId}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 行情Tab */}
        {activeTab === 'prices' && (
          <div style={styles.tabContent}>
            <div style={styles.priceHeader}>
              <span>商品价格波动</span>
              <button style={styles.refreshBtn} onClick={handleRefreshPrices}>🔄 刷新</button>
            </div>
            {goodsDefs.length === 0 ? (
              <div style={styles.empty}>暂无商品数据</div>
            ) : (
              <div style={styles.priceList}>
                {goodsDefs.map((def: any) => {
                  const price = goodsPrices.get(def.id);
                  const currentPrice = price?.currentPrice ?? def.basePrice;
                  const lastPrice = price?.lastPrice ?? def.basePrice;
                  const change = currentPrice - lastPrice;
                  const changePercent = lastPrice > 0 ? ((change / lastPrice) * 100).toFixed(1) : '0';
                  const isUp = change > 0;
                  const isDown = change < 0;

                  return (
                    <div key={def.id} style={styles.priceCard}>
                      <div style={styles.priceInfo}>
                        <span style={styles.goodsName}>{def.name ?? def.id}</span>
                        <span style={styles.goodsBase}>基础价: {def.basePrice}</span>
                      </div>
                      <div style={styles.priceValues}>
                        <span style={styles.currentPrice}>{currentPrice}</span>
                        <span style={{
                          ...styles.priceChange,
                          color: isUp ? '#4CAF50' : isDown ? '#f44336' : '#888',
                        }}>
                          {isUp ? '▲' : isDown ? '▼' : '─'} {Math.abs(change)} ({changePercent}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </SharedPanel>
  );
};

TradePanel.displayName = 'TradePanel';

export default TradePanel;

// ─── 样式 ────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  wrap: {
    padding: 12,
    color: '#e0d5c0',
    minHeight: '100%',
  },
  tabBar: {
    display: 'flex',
    gap: 4,
    marginBottom: 12,
  },
  tabBtn: {
    padding: '6px 12px',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 'var(--tk-radius-md)' as any,
    background: 'transparent',
    color: '#a0a0a0',
    fontSize: 12,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  activeTab: {
    background: 'rgba(212,165,116,0.2)',
    color: '#d4a574',
    border: '1px solid #d4a574',
  },
  tabContent: {
    overflowY: 'auto' as const,
    maxHeight: '60vh',
  },
  message: {
    padding: '8px 12px',
    background: 'rgba(212,165,116,0.2)',
    borderRadius: 'var(--tk-radius-lg)' as any,
    marginBottom: 12,
    fontSize: 13,
    textAlign: 'center' as const,
  },
  empty: {
    textAlign: 'center' as const,
    padding: 32,
    color: '#8a7e6e',
  },
  routeList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  routeCard: {
    padding: 12,
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 'var(--tk-radius-lg)' as any,
    border: '1px solid rgba(212,165,116,0.2)',
  },
  routeInfo: {
    marginBottom: 8,
  },
  routeName: {
    fontWeight: 'bold' as const,
    color: '#e0d5c0',
    fontSize: 14,
    display: 'flex',
    alignItems: 'center' as const,
    gap: 6,
  },
  openedBadge: {
    fontSize: 10,
    padding: '1px 6px',
    background: 'rgba(76,175,80,0.2)',
    color: '#4CAF50',
    borderRadius: 4,
  },
  routeMeta: {
    fontSize: 12,
    color: '#8a7e6e',
    marginTop: 4,
  },
  bonus: {
    color: '#FFD700',
    fontWeight: 'bold' as const,
  },
  routeActions: {
    display: 'flex',
    justifyContent: 'flex-end' as const,
    gap: 8,
  },
  openBtn: {
    padding: '6px 16px',
    background: 'rgba(255,183,77,0.2)',
    color: '#FFB74D',
    border: '1px solid rgba(255,183,77,0.3)',
    borderRadius: 'var(--tk-radius-md)' as any,
    fontWeight: 'bold' as const,
    fontSize: 12,
    cursor: 'pointer',
  },
  sendBtn: {
    padding: '6px 16px',
    background: '#d4a574',
    color: '#1a1a2e',
    border: 'none',
    borderRadius: 'var(--tk-radius-md)' as any,
    fontWeight: 'bold' as const,
    fontSize: 12,
    cursor: 'pointer',
  },
  sendBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed' as const,
  },
  caravanSummary: {
    fontSize: 13,
    color: '#a0a0a0',
    marginBottom: 10,
    textAlign: 'center' as const,
  },
  caravanList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  caravanCard: {
    padding: 10,
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 'var(--tk-radius-lg)' as any,
    border: '1px solid rgba(212,165,116,0.15)',
  },
  caravanHeader: {
    display: 'flex',
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 4,
  },
  caravanName: {
    fontWeight: 'bold' as const,
    color: '#e0d5c0',
    fontSize: 13,
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: 'bold' as const,
  },
  caravanMeta: {
    fontSize: 12,
    color: '#8a7e6e',
    display: 'flex',
    alignItems: 'center' as const,
    gap: 8,
  },
  guardBadge: {
    fontSize: 10,
    padding: '1px 6px',
    background: 'rgba(100,181,246,0.2)',
    borderRadius: 4,
    color: '#64B5F6',
  },
  caravanTimer: {
    fontSize: 11,
    color: '#FFB74D',
    marginTop: 4,
  },
  caravanRoute: {
    fontSize: 11,
    color: '#8a7e6e',
    marginTop: 2,
  },
  priceHeader: {
    display: 'flex',
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 10,
    fontSize: 13,
    color: '#a0a0a0',
  },
  refreshBtn: {
    padding: '4px 10px',
    background: 'rgba(212,165,116,0.15)',
    color: '#d4a574',
    border: '1px solid rgba(212,165,116,0.2)',
    borderRadius: 'var(--tk-radius-md)' as any,
    fontSize: 11,
    cursor: 'pointer',
  },
  priceList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },
  priceCard: {
    display: 'flex',
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    padding: '8px 10px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 'var(--tk-radius-md)' as any,
    border: '1px solid rgba(255,255,255,0.06)',
  },
  priceInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  goodsName: {
    fontSize: 13,
    color: '#e0d5c0',
    fontWeight: 600,
  },
  goodsBase: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  priceValues: {
    display: 'flex',
    alignItems: 'center' as const,
    gap: 8,
  },
  currentPrice: {
    fontSize: 14,
    color: '#d4a574',
    fontWeight: 'bold' as const,
  },
  priceChange: {
    fontSize: 11,
    fontWeight: 600,
  },
};
