/**
 * TradePanel — 商贸路线面板
 *
 * 展示所有可用贸易路线与活跃商队列表。
 * 玩家可点击"发送商队"按钮派遣商队沿路线贸易。
 *
 * 数据来源：engine.getTradeSystem() / engine.trade
 *
 * @module panels/trade/TradePanel
 */
import React, { useState, useMemo } from 'react';

// ─── 类型 ────────────────────────────────────
interface TradePanelProps {
  engine: any;
}

// ─── 主组件 ──────────────────────────────────
const TradePanel: React.FC<TradePanelProps> = ({ engine }) => {
  const [message, setMessage] = useState<string | null>(null);

  // 获取贸易系统
  const tradeSystem = engine?.getTradeSystem?.() ?? engine?.trade;
  const state = tradeSystem?.getState?.();

  // 贸易路线列表
  const routes = state?.routes ?? [];
  // 商队列表
  const caravans = state?.caravans ?? [];

  /** 发送商队 */
  const handleSendCaravan = (routeId: string) => {
    try {
      const result = tradeSystem?.sendCaravan?.(routeId);
      setMessage(result?.success ? '🚃 商队已出发！' : result?.reason ?? '发送失败');
    } catch (e: any) {
      setMessage(e?.message ?? '操作失败');
    }
    setTimeout(() => setMessage(null), 2000);
  };

  return (
    <div style={styles.wrap} data-testid="trade-panel">
      <h3 style={styles.heading}>商贸路线</h3>

      {/* 操作反馈消息 */}
      {message && (
        <div style={styles.message}>{message}</div>
      )}

      {/* 路线列表 */}
      {routes.length === 0 ? (
        <div style={styles.empty}>暂无可用贸易路线</div>
      ) : (
        <div style={styles.routeList}>
          {routes.map((route: any, i: number) => (
            <div key={route.id ?? i} style={styles.routeCard}>
              <div style={styles.routeInfo}>
                <div style={styles.routeName}>{route.name ?? `路线${i + 1}`}</div>
                <div style={styles.routeMeta}>
                  利润: {route.profit ?? '???'} | 时长: {route.duration ?? '???'}分钟
                </div>
              </div>
              <button style={styles.sendBtn} onClick={() => handleSendCaravan(route.id)}>
                发送商队
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 活跃商队 */}
      <h4 style={styles.subHeading}>活跃商队 ({caravans.length})</h4>
      {caravans.length === 0 ? (
        <div style={styles.emptySmall}>暂无活跃商队</div>
      ) : (
        <div style={styles.caravanList}>
          {caravans.map((c: any, i: number) => (
            <div key={i} style={styles.caravanCard}>
              🚃 {c.routeName ?? '商队'} — 剩余 {c.remainingTime ?? '???'} 分钟
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

TradePanel.displayName = 'TradePanel';

export default TradePanel;

// ─── 样式 ────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  wrap: {
    padding: 16,
    color: '#e0d5c0',
  },
  heading: {
    fontSize: 16,
    marginBottom: 12,
    color: '#d4a574',
  },
  message: {
    padding: '8px 12px',
    background: 'rgba(212,165,116,0.2)',
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 13,
  },
  empty: {
    textAlign: 'center',
    padding: 32,
    color: '#8a7e6e',
  },
  emptySmall: {
    textAlign: 'center',
    padding: 16,
    color: '#8a7e6e',
    fontSize: 13,
  },
  routeList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  routeCard: {
    padding: 12,
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    border: '1px solid rgba(212,165,116,0.2)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routeInfo: {
    flex: 1,
  },
  routeName: {
    fontWeight: 'bold',
    color: '#e0d5c0',
  },
  routeMeta: {
    fontSize: 12,
    color: '#8a7e6e',
    marginTop: 4,
  },
  sendBtn: {
    padding: '6px 16px',
    background: '#d4a574',
    color: '#1a1a2e',
    border: 'none',
    borderRadius: 6,
    fontWeight: 'bold',
    fontSize: 13,
    cursor: 'pointer',
  },
  subHeading: {
    fontSize: 14,
    marginTop: 16,
    marginBottom: 8,
    color: '#d4a574',
  },
  caravanList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  caravanCard: {
    padding: 8,
    background: 'rgba(76,175,80,0.1)',
    borderRadius: 6,
    fontSize: 13,
    color: '#e0d5c0',
  },
};
