/**
 * 商店系统面板 — 商品列表、购买、货币显示、手动刷新
 *
 * R5 修复清单：
 * - [P0] 收藏持久化到 localStorage ✅
 * - [P0] 商品排序功能（默认/价格/收藏/折扣） ✅
 * - [P1] 购买数量选择（1/5/10批量购买） ✅
 * - [P1] 手机端适配增强：Tab指示器、卡片触控优化、横屏适配 ✅
 * - [P1] 商品售罄/限购完成视觉强化 ✅
 * - [P2] 空状态引导提示优化 ✅
 * - [P2] 购买成功动画反馈 ✅
 * - [P2] 确认弹窗余额对比显示 ✅
 *
 * @module panels/shop/ShopPanel
 */
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import SharedPanel from '@/components/idle/components/SharedPanel';
import './ShopPanel.css';

// ─── Props ──────────────────────────────────
interface ShopPanelProps {
  engine: any;
  visible?: boolean;
  onClose?: () => void;
  snapshotVersion?: number;
}

// ─── 常量 ───────────────────────────────────
const CUR_LABELS: Record<string, string> = {
  copper: '铜钱', mandate: '天命', recruit: '招贤令', summon: '求贤令',
  expedition: '远征币', guild: '公会币', reputation: '声望值', ingot: '元宝',
};

const SHOP_TABS = [
  { id: 'normal', label: '杂货铺', icon: '🏪' },
  { id: 'black_market', label: '竞技商店', icon: '⚔️' },
  { id: 'limited_time', label: '远征商店', icon: '🚀' },
  { id: 'vip', label: '联盟商店', icon: '🏰' },
] as const;

/** 排序选项 */
const SORT_OPTIONS = [
  { id: 'default', label: '默认' },
  { id: 'price-asc', label: '价格↑' },
  { id: 'price-desc', label: '价格↓' },
  { id: 'favorite', label: '收藏优先' },
  { id: 'discount', label: '折扣优先' },
] as const;

type SortOption = typeof SORT_OPTIONS[number]['id'];

/** 购买数量选项 */
const BUY_QUANTITY_OPTIONS = [1, 5, 10] as const;

/** localStorage key */
const FAVORITES_KEY = 'tk-shop-favorites';
const SORT_KEY = 'tk-shop-sort';

const skeletonKeyframe = `
@keyframes shop-skeleton-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}
@keyframes shop-buy-success {
  0% { transform: scale(1); }
  30% { transform: scale(1.05); }
  100% { transform: scale(1); }
}
`;

// ─── 骨架屏卡片 ─────────────────────────────
function SkeletonCard() {
  return (
    <div className="tk-shop-goods-card tk-shop-skeleton-card">
      <div className="tk-shop-goods-icon tk-shop-skeleton-block" style={{ width: 40, height: 40, borderRadius: 8 }} />
      <div className="tk-shop-goods-info" style={{ gap: 6 }}>
        <div className="tk-shop-skeleton-block" style={{ width: '60%', height: 14, borderRadius: 4 }} />
        <div className="tk-shop-skeleton-block" style={{ width: '80%', height: 11, borderRadius: 4 }} />
        <div className="tk-shop-skeleton-block" style={{ width: '40%', height: 12, borderRadius: 4 }} />
      </div>
      <div className="tk-shop-skeleton-block" style={{ width: 52, height: 32, borderRadius: 6, flexShrink: 0 }} />
    </div>
  );
}

// ─── 主组件 ─────────────────────────────────
export default function ShopPanel({ engine, visible = true, onClose, snapshotVersion }: ShopPanelProps) {
  const [activeTab, setActiveTab] = useState<string>('normal');
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [buyQuantity, setBuyQuantity] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [isLoading, setIsLoading] = useState(true);
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch { return new Set(); }
  });
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    try {
      const saved = localStorage.getItem(SORT_KEY);
      if (saved && SORT_OPTIONS.some(o => o.id === saved)) return saved as SortOption;
    } catch { /* ignore */ }
    return 'default';
  });
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [buySuccessId, setBuySuccessId] = useState<string | null>(null);
  const [refreshCooldown, setRefreshCooldown] = useState(0);

  const isOperatingRef = useRef(false);
  const lastSnapshotRef = useRef<number>(snapshotVersion ?? 0);
  const loadedTabsRef = useRef<Set<string>>(new Set());
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── 刷新冷却倒计时 ──
  useEffect(() => {
    if (refreshCooldown > 0) {
      cooldownTimerRef.current = setInterval(() => {
        setRefreshCooldown(prev => {
          if (prev <= 1) { if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current); return 0; }
          return prev - 1;
        });
      }, 1000);
      return () => { if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current); };
    }
  }, [refreshCooldown > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const shopSystem = engine?.getShopSystem?.() ?? engine?.shop;
  const currencySystem = engine?.getCurrencySystem?.() ?? engine?.currency;

  // ── 收藏持久化 ──
  useEffect(() => {
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites])); } catch { /* 静默 */ }
  }, [favorites]);

  // ── 排序状态持久化 ──
  useEffect(() => {
    try { localStorage.setItem(SORT_KEY, sortBy); } catch { /* 静默 */ }
  }, [sortBy]);

  // ── 骨架屏加载条件 ──
  // 只在 activeTab 变化时显示骨架屏，不响应 snapshotVersion 变化
  // 避免 snapshotVersion 每次 tick 变化时清除缓存导致重复闪烁
  useEffect(() => {
    if (loadedTabsRef.current.has(activeTab)) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const t = setTimeout(() => {
      setIsLoading(false);
      loadedTabsRef.current.add(activeTab);
    }, 300);
    return () => clearTimeout(t);
  }, [activeTab]);

  // ── 刷新信息（按Tab维度） ──
  const refreshInfo = useMemo(() => {
    if (!shopSystem) return { count: 0, limit: 5 };
    try {
      const s = shopSystem.getState?.()?.[activeTab];
      return { count: s?.manualRefreshCount ?? 0, limit: s?.manualRefreshLimit ?? 5 };
    } catch { return { count: 0, limit: 5 }; }
  }, [shopSystem, activeTab, message, snapshotVersion]);

  // ── 货币 ──
  const currencies = useMemo(() => {
    if (!currencySystem) return {};
    try {
      const ids = ['copper', 'mandate', 'recruit', 'summon', 'expedition', 'guild', 'reputation', 'ingot'];
      const r: Record<string, number> = {};
      for (const id of ids) r[id] = currencySystem.getBalance?.(id) ?? 0;
      return r;
    } catch { return {}; }
  }, [currencySystem, activeTab, message, snapshotVersion]);

  // ── 商品列表 ──
  const goods = useMemo(() => {
    if (!shopSystem) return [];
    try {
      const raw = shopSystem.getShopGoods?.(activeTab) ?? [];
      return Array.isArray(raw) ? raw : raw ? Object.values(raw as Record<string, any>) : [];
    } catch { return []; }
  }, [shopSystem, activeTab, message, snapshotVersion]);

  // ── 排序后商品 ──
  const sortedGoods = useMemo(() => {
    if (sortBy === 'default') return goods;
    return [...goods].sort((a: any, b: any) => {
      const defA = shopSystem?.getGoodsDef?.(a.defId);
      const defB = shopSystem?.getGoodsDef?.(b.defId);
      if (!defA || !defB) return 0;
      switch (sortBy) {
        case 'price-asc': return getTotalPrice(defA.basePrice) - getTotalPrice(defB.basePrice);
        case 'price-desc': return getTotalPrice(defB.basePrice) - getTotalPrice(defA.basePrice);
        case 'favorite': {
          const fa = favorites.has(a.defId) ? 0 : 1;
          const fb = favorites.has(b.defId) ? 0 : 1;
          return fa - fb;
        }
        case 'discount': return (b.discount ?? 1) - (a.discount ?? 1);
        default: return 0;
      }
    });
  }, [goods, sortBy, shopSystem, favorites]);

  /** 计算总价（多货币取最大值用于排序） */
  function getTotalPrice(price: Record<string, number>): number {
    return Object.values(price).reduce((s, v) => s + v, 0);
  }

  const getGoodsDef = useCallback((defId: string) => shopSystem?.getGoodsDef?.(defId), [shopSystem]);

  const formatPrice = useCallback((price: Record<string, number>) =>
    Object.entries(price).map(([c, a]) => `${CUR_LABELS[c] ?? c} ${a}`).join(' + '), []);

  const formatPriceWithBalance = useCallback((price: Record<string, number>) =>
    Object.entries(price).map(([cur, amt]) => ({
      label: CUR_LABELS[cur] ?? cur, amount: amt,
      balance: currencies[cur] ?? 0,
      sufficient: (currencies[cur] ?? 0) >= amt,
      deficit: Math.max(0, amt - (currencies[cur] ?? 0)),
    })), [currencies]);

  const showMessage = useCallback((msg: string, type: 'success' | 'error') => {
    setMessage(msg); setMessageType(type);
    setTimeout(() => setMessage(null), 2500);
  }, []);

  // ── 手动刷新（当前Tab） ──
  const handleRefresh = useCallback(() => {
    if (isOperatingRef.current || !shopSystem) return;
    try {
      const s = shopSystem.getState?.()?.[activeTab];
      if (s && s.manualRefreshCount >= s.manualRefreshLimit) { showMessage('今日刷新次数已用完', 'error'); return; }
      const result = shopSystem.manualRefresh?.();
      if (result?.success) { loadedTabsRef.current.delete(activeTab); showMessage('🔄 商店已刷新', 'success'); setRefreshCooldown(3); }
      else showMessage(result?.reason ?? '刷新失败', 'error');
    } catch (e: any) { showMessage(e?.message ?? '刷新失败', 'error'); }
  }, [shopSystem, activeTab, showMessage]);

  // ── 购买商品（支持批量） ──
  const handleBuy = useCallback((defId: string, quantity: number = 1) => {
    if (isOperatingRef.current) return;
    isOperatingRef.current = true;
    if (!shopSystem) { isOperatingRef.current = false; return; }
    try {
      const fp = shopSystem.calculateFinalPrice?.(defId, activeTab);
      if (fp) {
        const bad: string[] = [];
        for (const [c, a] of Object.entries(fp)) {
          const totalCost = (a as number) * quantity;
          const bal = currencySystem?.getBalance?.(c) ?? 0;
          if (bal < totalCost) {
            bad.push(`${CUR_LABELS[c] ?? c}差${totalCost - bal}（有${bal}，需${totalCost}）`);
          }
        }
        if (bad.length > 0) {
          showMessage(`💰 ${bad.join('；')}，无法购买`, 'error');
          setBuyingId(null); isOperatingRef.current = false; return;
        }
      }
      const result = shopSystem.executeBuy?.({ goodsId: defId, quantity, shopType: activeTab });
      if (result?.success) {
        const qtyLabel = quantity > 1 ? ` ×${quantity}` : '';
        showMessage(`✅ 购买成功${qtyLabel}！`, 'success');
        setBuySuccessId(defId);
        setTimeout(() => setBuySuccessId(null), 600);
      } else showMessage(result?.reason ?? '购买失败', 'error');
    } catch (e: any) { showMessage(e?.message ?? '购买失败', 'error'); }
    setBuyingId(null);
    setBuyQuantity(1);
    setTimeout(() => { isOperatingRef.current = false; }, 500);
  }, [shopSystem, activeTab, currencySystem, showMessage]);

  const handleToggleFavorite = useCallback((defId: string) => {
    setFavorites(prev => { const n = new Set(prev); n.has(defId) ? n.delete(defId) : n.add(defId); return n; });
  }, []);

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId); setBuyingId(null); setBuyQuantity(1);
  }, []);

  // ── 渲染 ──
  return (
    <SharedPanel visible={visible} title="商店" icon="🏪" onClose={onClose} width="min(560px, 95vw)">
      <style>{skeletonKeyframe}</style>
      <div className="tk-shop-container shop-panel-mobile" data-testid="shop-panel">
        {/* Tab栏 */}
        <div className="tk-shop-tab-bar" data-testid="shop-panel-tabs">
          {SHOP_TABS.map(tab => (
            <button key={tab.id}
              className={`tk-shop-tab-btn${activeTab === tab.id ? ' tk-shop-tab-btn--active' : ''}`}
              onClick={() => handleTabChange(tab.id)} data-testid={`shop-panel-tab-${tab.id}`}>
              <span>{tab.icon}</span><span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* 货币 + 刷新 + 排序 */}
        <div className="tk-shop-toolbar">
          <div className="tk-shop-currency-row">
            {Object.keys(currencies).length > 0 && (
              <div className="tk-shop-currency-bar">
                {Object.entries(currencies).filter(([, a]) => a > 0).slice(0, 4).map(([c, a]) => (
                  <span key={c} className="tk-shop-currency-item">{CUR_LABELS[c] ?? c}: {a.toLocaleString()}</span>
                ))}
              </div>
            )}
            <button className={`tk-shop-refresh-btn${refreshInfo.count >= refreshInfo.limit ? ' tk-shop-refresh-btn--disabled' : ''}`}
              disabled={refreshInfo.count >= refreshInfo.limit || refreshCooldown > 0} onClick={handleRefresh}
              data-testid="shop-panel-refresh" title={`今日刷新: ${refreshInfo.count}/${refreshInfo.limit}`}>
              {refreshCooldown > 0 ? `⏳ ${refreshCooldown}s` : `🔄 ${refreshInfo.count}/${refreshInfo.limit}`}
            </button>
          </div>
          <div className="tk-shop-sort-row">
            <span className="tk-shop-sort-label">排序:</span>
            <div className="tk-shop-sort-options">
              {SORT_OPTIONS.map(opt => (
                <button key={opt.id}
                  className={`tk-shop-sort-btn${sortBy === opt.id ? ' tk-shop-sort-btn--active' : ''}`}
                  onClick={() => setSortBy(opt.id)} data-testid={`shop-panel-sort-${opt.id}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Toast */}
        {message && (
          <div className={`tk-shop-toast tk-shop-toast--${messageType}`} data-testid="shop-panel-toast">{message}</div>
        )}

        {/* 商品列表 / 骨架屏 */}
        <div className="tk-shop-goods-grid">
          {isLoading ? (
            Array.from({ length: 4 }, (_, i) => <SkeletonCard key={`sk-${i}`} />)
          ) : (
            sortedGoods.map((item: any) => {
              const def = getGoodsDef(item.defId);
              if (!def) return null;
              const outOfStock = item.stock !== -1 && item.stock <= 0;
              const dailyDone = item.dailyLimit > 0 && item.dailyPurchased >= item.dailyLimit;
              const lifetimeDone = item.lifetimeLimit > 0 && item.lifetimeLimit !== -1 && item.lifetimePurchased >= item.lifetimeLimit;
              const isSoldOut = outOfStock || dailyDone || lifetimeDone;
              const isDiscounted = item.discount < 1;
              const fp = shopSystem?.calculateFinalPrice?.(item.defId, activeTab) ?? def.basePrice;
              const isFav = favorites.has(item.defId);
              const isSuccess = buySuccessId === item.defId;
              return (
                <div key={item.defId}
                  className={`tk-shop-goods-card${isSoldOut ? ' tk-shop-goods-card--out-of-stock' : ''}${isSuccess ? ' tk-shop-goods-card--success' : ''}${isFav ? ' tk-shop-goods-card--favorite' : ''}`}
                  data-testid={`shop-panel-goods-${item.defId}`}>
                  {isDiscounted && <span className="tk-shop-discount-badge">-{Math.round((1 - item.discount) * 100)}%</span>}
                  <div className="tk-shop-goods-icon">{def.icon ?? '📦'}</div>
                  <div className="tk-shop-goods-info">
                    <div className="tk-shop-goods-name-row">
                      <span className="tk-shop-goods-name">{def.name}</span>
                      <button className="tk-shop-fav-btn" onClick={(e) => { e.stopPropagation(); handleToggleFavorite(item.defId); }}
                        data-testid={`shop-panel-fav-${item.defId}`} aria-label={isFav ? '取消收藏' : '收藏'}>
                        {isFav ? '⭐' : '☆'}
                      </button>
                    </div>
                    <div className="tk-shop-goods-desc">{def.description}</div>
                    <div className="tk-shop-price-row">
                      {isDiscounted && <span className="tk-shop-original-price">{formatPrice(def.basePrice)}</span>}
                      <span className={`tk-shop-price${isDiscounted ? ' tk-shop-price--discount' : ''}`}>{formatPrice(fp)}</span>
                    </div>
                    {(item.dailyLimit > 0 || (item.lifetimeLimit > 0 && item.lifetimeLimit !== -1)) && (
                      <div className="tk-shop-limit-info">
                        {item.dailyLimit > 0 && <span className={dailyDone ? 'tk-shop-limit-done' : ''}>今日: {item.dailyPurchased}/{item.dailyLimit}</span>}
                        {item.lifetimeLimit > 0 && item.lifetimeLimit !== -1 && (
                          <span style={{ marginLeft: item.dailyLimit > 0 ? 8 : 0 }} className={lifetimeDone ? 'tk-shop-limit-done' : ''}>
                            终身: {item.lifetimePurchased}/{item.lifetimeLimit}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <button className={`tk-shop-buy-btn${isSoldOut ? ' tk-shop-buy-btn--disabled' : ''}`}
                    disabled={isSoldOut} data-testid={`shop-panel-buy-${item.defId}`}
                    onClick={() => { setBuyingId(item.defId); setBuyQuantity(1); setTimeout(() => setConfirmVisible(true), 10); }}>
                    {isSoldOut ? '售罄' : '购买'}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {!isLoading && sortedGoods.length === 0 && (
          <div className="tk-shop-empty">
            <div className="tk-shop-empty-icon">🏪</div>
            {!shopSystem ? (
              <>
                <div>商店系统未加载</div>
                <div className="tk-shop-empty-hint">请稍后再试或刷新页面</div>
              </>
            ) : (
              <>
                <div>暂无商品</div>
                <div className="tk-shop-empty-hint">尝试刷新商店或切换其他商店类型</div>
              </>
            )}
          </div>
        )}

        {/* 购买确认弹窗 */}
        {buyingId && (() => {
          const bDef = getGoodsDef(buyingId);
          const bItem = goods.find((g: any) => g.defId === buyingId);
          const bPrice = bItem ? (shopSystem?.calculateFinalPrice?.(buyingId, activeTab) ?? bDef?.basePrice) : null;
          // 计算实际价格（单价 × 数量）
          const multipliedPrice = bPrice
            ? Object.fromEntries(Object.entries(bPrice).map(([c, a]) => [c, (a as number) * buyQuantity]))
            : null;
          const details = multipliedPrice ? formatPriceWithBalance(multipliedPrice) : [];
          // 计算最大可购买数量（考虑限购、库存、货币余额）
          const maxQty = (() => {
            if (!bItem) return 1;
            const dailyRemain = bItem.dailyLimit > 0 ? bItem.dailyLimit - bItem.dailyPurchased : 99;
            const lifetimeRemain = (bItem.lifetimeLimit > 0 && bItem.lifetimeLimit !== -1)
              ? bItem.lifetimeLimit - bItem.lifetimePurchased : 99;
            const stockRemain = bItem.stock !== -1 ? bItem.stock : 99;
            // 货币余额限制：计算每种货币能支持的最大购买数量
            let currencyRemain = 99;
            if (bPrice) {
              for (const [c, a] of Object.entries(bPrice)) {
                if ((a as number) > 0) {
                  const bal = currencies[c] ?? 0;
                  const maxByCurrency = Math.floor(bal / (a as number));
                  currencyRemain = Math.min(currencyRemain, maxByCurrency);
                }
              }
            }
            return Math.max(1, Math.min(dailyRemain, lifetimeRemain, stockRemain, currencyRemain));
          })();
          const closeConfirm = () => { setConfirmVisible(false); setTimeout(() => setBuyingId(null), 200); };
          return (
            <div className={`tk-shop-overlay${confirmVisible ? ' tk-shop-overlay--visible' : ''}`}
              onClick={closeConfirm} data-testid="shop-panel-confirm-overlay">
              <div className={`tk-shop-confirm-panel${confirmVisible ? ' tk-shop-confirm-panel--visible' : ''}`}
                onClick={(e) => e.stopPropagation()} data-testid="shop-panel-confirm-dialog">
                <div className="tk-shop-confirm-title">确认购买？</div>
                {bDef && <div className="tk-shop-confirm-goods-icon">{bDef.icon ?? '📦'}</div>}
                {bDef && <div className="tk-shop-confirm-goods-name">{bDef.name}</div>}
                {bDef?.description && <div className="tk-shop-confirm-goods-desc">{bDef.description}</div>}
                {/* 购买数量选择 */}
                {maxQty > 1 && (
                  <div className="tk-shop-quantity-selector">
                    <span className="tk-shop-quantity-label">数量:</span>
                    {[1, 5, 10].filter(q => q <= maxQty).map(q => (
                      <button key={q}
                        className={`tk-shop-quantity-btn${buyQuantity === q ? ' tk-shop-quantity-btn--active' : ''}`}
                        onClick={() => setBuyQuantity(q)} data-testid={`shop-panel-qty-${q}`}>
                        ×{q}
                      </button>
                    ))}
                    {![1, 5, 10].includes(maxQty) && maxQty > 1 && (
                      <button className={`tk-shop-quantity-btn${buyQuantity === maxQty ? ' tk-shop-quantity-btn--active' : ''}`}
                        onClick={() => setBuyQuantity(maxQty)} data-testid={`shop-panel-qty-max`}>
                        ×{maxQty}
                      </button>
                    )}
                  </div>
                )}
                {bItem && (bItem.dailyLimit > 0 || (bItem.lifetimeLimit > 0 && bItem.lifetimeLimit !== -1)) && (
                  <div className="tk-shop-confirm-limit-info">
                    {bItem.dailyLimit > 0 && <span>今日: {bItem.dailyPurchased}/{bItem.dailyLimit}</span>}
                    {bItem.lifetimeLimit > 0 && bItem.lifetimeLimit !== -1 && (
                      <span style={{ marginLeft: bItem.dailyLimit > 0 ? 10 : 0 }}>
                        终身: {bItem.lifetimePurchased}/{bItem.lifetimeLimit}
                      </span>
                    )}
                  </div>
                )}
                {details.length > 0 && (
                  <div className="tk-shop-confirm-price-details">
                    {details.map((d) => (
                      <div key={d.label} className="tk-shop-confirm-price-row">
                        <span className="tk-shop-confirm-price-label">{d.label}</span>
                        <span className="tk-shop-confirm-price-amount" style={{ color: d.sufficient ? '#7EC850' : '#ff6464' }}>
                          {d.amount.toLocaleString()}
                        </span>
                        <span className="tk-shop-confirm-price-balance">
                          {d.sufficient
                            ? <span style={{ color: '#7EC850' }}>✓ 余额 {d.balance.toLocaleString()}</span>
                            : <span style={{ color: '#ff6464' }}>✗ 余额 {d.balance.toLocaleString()}，差 {d.deficit.toLocaleString()}</span>
                          }
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="tk-shop-confirm-actions">
                  <button className="tk-shop-cancel-btn" data-testid="shop-panel-confirm-cancel" onClick={closeConfirm}>取消</button>
                  <button className={`tk-shop-confirm-btn${details.some(d => !d.sufficient) ? ' tk-shop-confirm-btn--insufficient' : ''}`}
                    data-testid="shop-panel-confirm-ok" onClick={() => handleBuy(buyingId, buyQuantity)}>
                    {details.some(d => !d.sufficient) ? '余额不足' : '确认购买'}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </SharedPanel>
  );
}
