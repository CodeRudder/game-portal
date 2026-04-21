/**
 * 商店系统面板 — 商品列表、购买、货币显示
 *
 * 读取引擎 ShopSystem 数据，展示商店商品与购买操作。
 *
 * @module panels/shop/ShopPanel
 */
import React, { useState, useMemo, useCallback } from 'react';

// ─── Props ──────────────────────────────────
interface ShopPanelProps {
  engine: any;
}

// ─── 货币中文名 ─────────────────────────────
const CUR_LABELS: Record<string, string> = {
  copper: '铜钱', mandate: '天命', recruit: '招贤榜', summon: '求贤令',
  expedition: '远征币', guild: '公会币', reputation: '声望值', ingot: '元宝',
};

/** 商店类型标签 */
const SHOP_TABS = [
  { id: 'general', label: '杂货铺', icon: '🏪' },
  { id: 'arena', label: '竞技商店', icon: '⚔️' },
  { id: 'expedition', label: '远征商店', icon: '🚀' },
  { id: 'guild', label: '联盟商店', icon: '🏰' },
] as const;

// ─── 主组件 ─────────────────────────────────
export default function ShopPanel({ engine }: ShopPanelProps) {
  const [activeTab, setActiveTab] = useState<string>('general');
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // 获取商店系统
  const shopSystem = engine?.getShopSystem?.() ?? engine?.shop;

  // 获取货币系统
  const currencySystem = engine?.getCurrencySystem?.() ?? engine?.currency;

  // 获取当前货币数量
  const currencies = useMemo(() => {
    if (!currencySystem) return {};
    try {
      const ids = ['copper', 'mandate', 'recruit', 'summon', 'expedition', 'guild', 'reputation', 'ingot'];
      const result: Record<string, number> = {};
      for (const id of ids) {
        result[id] = currencySystem.getBalance?.(id) ?? 0;
      }
      return result;
    } catch {
      return {};
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currencySystem, activeTab, message]);

  // 获取当前商店商品列表
  const goods = useMemo(() => {
    if (!shopSystem) return [];
    try {
      return shopSystem.getShopGoods?.(activeTab) ?? [];
    } catch {
      return [];
    }
  }, [shopSystem, activeTab]);

  // 获取商品定义
  const getGoodsDef = useCallback((defId: string) => {
    return shopSystem?.getGoodsDef?.(defId);
  }, [shopSystem]);

  // 格式化价格
  const formatPrice = useCallback((price: Record<string, number>) => {
    return Object.entries(price)
      .map(([cur, amt]) => `${CUR_LABELS[cur] ?? cur} ${amt}`)
      .join(' + ');
  }, []);

  // 购买商品
  const handleBuy = useCallback((defId: string) => {
    if (!shopSystem) return;
    try {
      const result = shopSystem.executeBuy?.({ goodsId: defId, quantity: 1, shopType: activeTab });
      if (result?.success) {
        setMessage('购买成功！');
      } else {
        setMessage(result?.reason ?? '购买失败');
      }
    } catch (e: any) {
      setMessage(e?.message ?? '购买失败');
    }
    setBuyingId(null);
    setTimeout(() => setMessage(null), 2000);
  }, [shopSystem, activeTab]);

  return (
    <div style={styles.container}>
      {/* 商店Tab */}
      <div style={styles.tabBar}>
        {SHOP_TABS.map(tab => (
          <button
            key={tab.id}
            style={{ ...styles.tabBtn, ...(activeTab === tab.id ? styles.activeTab : {}) }}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 货币显示 */}
      {Object.keys(currencies).length > 0 && (
        <div style={styles.currencyBar}>
          {Object.entries(currencies)
            .filter(([, amt]) => amt > 0)
            .slice(0, 4)
            .map(([cur, amt]) => (
              <span key={cur} style={styles.currencyItem}>
                {CUR_LABELS[cur] ?? cur}: {amt.toLocaleString()}
              </span>
            ))}
        </div>
      )}

      {/* 提示消息 */}
      {message && (
        <div style={styles.toast}>{message}</div>
      )}

      {/* 商品列表 */}
      <div style={styles.goodsGrid}>
        {goods.map((item: any) => {
          const def = getGoodsDef(item.defId);
          if (!def) return null;
          const outOfStock = item.stock !== -1 && item.stock <= 0;
          const isDiscounted = item.discount < 1;
          const finalPrice = shopSystem?.calculateFinalPrice?.(item.defId, activeTab) ?? def.basePrice;

          return (
            <div key={item.defId} style={{ ...styles.goodsCard, opacity: outOfStock ? 0.5 : 1 }}>
              <div style={styles.goodsIcon}>{def.icon ?? '📦'}</div>
              <div style={styles.goodsInfo}>
                <div style={styles.goodsName}>{def.name}</div>
                <div style={styles.goodsDesc}>{def.description}</div>
                {/* 价格 */}
                <div style={styles.priceRow}>
                  {isDiscounted && (
                    <span style={styles.originalPrice}>{formatPrice(def.basePrice)}</span>
                  )}
                  <span style={{ ...styles.price, ...(isDiscounted ? { color: '#ff6464' } : {}) }}>
                    {formatPrice(finalPrice)}
                  </span>
                </div>
                {/* 限购信息 */}
                {item.dailyLimit > 0 && (
                  <div style={styles.limitInfo}>
                    今日: {item.dailyPurchased}/{item.dailyLimit}
                  </div>
                )}
              </div>
              <button
                style={{ ...styles.buyBtn, ...(outOfStock ? styles.buyBtnDisabled : {}) }}
                disabled={outOfStock}
                onClick={() => setBuyingId(item.defId)}
              >
                {outOfStock ? '售罄' : '购买'}
              </button>
            </div>
          );
        })}
      </div>

      {goods.length === 0 && (
        <div style={styles.empty}>暂无商品</div>
      )}

      {/* 购买确认弹窗 */}
      {buyingId && (
        <div style={styles.overlay} onClick={() => setBuyingId(null)}>
          <div style={styles.confirmPanel} onClick={e => e.stopPropagation()}>
            <div style={styles.confirmTitle}>确认购买？</div>
            <div style={styles.confirmActions}>
              <button style={styles.cancelBtn} onClick={() => setBuyingId(null)}>取消</button>
              <button style={styles.confirmBtn} onClick={() => handleBuy(buyingId)}>确认</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 样式 ───────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: { padding: 12, color: '#e8e0d0', minHeight: '100%' },
  tabBar: { display: 'flex', gap: 4, marginBottom: 12, overflowX: 'auto' },
  tabBtn: {
    display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
    background: 'transparent', color: '#a0a0a0', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  activeTab: { background: 'rgba(212,165,116,0.2)', color: '#d4a574', borderColor: '#d4a574' },
  currencyBar: {
    display: 'flex', gap: 12, padding: '6px 10px', marginBottom: 8,
    background: 'rgba(255,255,255,0.04)', borderRadius: 6, flexWrap: 'wrap',
  },
  currencyItem: { fontSize: 12, color: '#d4a574', fontWeight: 600 },
  toast: {
    padding: '8px 12px', marginBottom: 8, borderRadius: 6,
    background: 'rgba(212,165,116,0.2)', color: '#d4a574', fontSize: 12, textAlign: 'center',
  },
  goodsGrid: { display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: '60vh' },
  goodsCard: {
    display: 'flex', alignItems: 'center', gap: 10, padding: 10,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(212,165,116,0.15)',
    borderRadius: 8,
  },
  goodsIcon: { fontSize: 28, width: 40, textAlign: 'center' },
  goodsInfo: { flex: 1, minWidth: 0 },
  goodsName: { fontSize: 14, fontWeight: 600, color: '#e8e0d0' },
  goodsDesc: { fontSize: 11, color: '#888', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  priceRow: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 12 },
  originalPrice: { textDecoration: 'line-through', color: '#666', fontSize: 11 },
  price: { color: '#d4a574', fontWeight: 600 },
  limitInfo: { fontSize: 10, color: '#888', marginTop: 2 },
  buyBtn: {
    padding: '6px 14px', border: '1px solid rgba(212,165,116,0.3)', borderRadius: 6,
    background: 'rgba(212,165,116,0.15)', color: '#d4a574', fontSize: 12, cursor: 'pointer',
  },
  buyBtnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  empty: { textAlign: 'center', padding: 24, color: '#666', fontSize: 13 },
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 'var(--tk-z-modal)' as any,
  },
  confirmPanel: {
    background: '#1a1a2e', border: '1px solid #d4a574', borderRadius: 12,
    padding: 20, minWidth: 260, textAlign: 'center',
  },
  confirmTitle: { fontSize: 15, color: '#e8e0d0', marginBottom: 16 },
  confirmActions: { display: 'flex', gap: 10 },
  cancelBtn: {
    flex: 1, padding: 8, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
    background: 'transparent', color: '#a0a0a0', cursor: 'pointer',
  },
  confirmBtn: {
    flex: 1, padding: 8, border: '1px solid rgba(212,165,116,0.3)', borderRadius: 6,
    background: 'rgba(212,165,116,0.2)', color: '#d4a574', cursor: 'pointer',
  },
};
