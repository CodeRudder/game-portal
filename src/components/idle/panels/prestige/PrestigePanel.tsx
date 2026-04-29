/**
 * 声望系统面板 — 声望等级、进度条、产出加成、等级奖励领取、
 *                 声望商店、转生系统、声望任务
 *
 * 读取引擎 PrestigeSystem / PrestigeShopSystem / RebirthSystem 数据。
 * NEW-R5: 使用 SharedPanel 统一弹窗容器。
 * P0修复: 补齐声望商店/转生/任务UI Tab
 *
 * @module panels/prestige/PrestigePanel
 */
import React, { useState, useCallback } from 'react';
import SharedPanel from '@/components/idle/components/SharedPanel';

interface PrestigePanelProps {
  engine: any;
  /** 是否显示面板 */
  visible?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
}

type PrestigeTab = 'level' | 'shop' | 'rebirth' | 'quests';


const s: Record<string, React.CSSProperties> = {
  wrap: { padding: 12, color: '#e8e0d0', minHeight: '100%' },
  toast: { padding: '8px 12px', marginBottom: 8, borderRadius: 'var(--tk-radius-md)' as any, background: 'rgba(212,165,116,0.2)', color: '#d4a574', fontSize: 12, textAlign: 'center' },
  card: { padding: 16, marginBottom: 16, borderRadius: 'var(--tk-radius-lg)' as any, textAlign: 'center', background: 'linear-gradient(135deg, rgba(212,165,116,0.12), rgba(212,165,116,0.04))', border: '1px solid rgba(212,165,116,0.25)' },
  badge: { fontSize: 20, fontWeight: 600, color: '#d4a574' },
  lvNum: { fontSize: 28, fontWeight: 700, color: '#e8e0d0', margin: '6px 0' },
  bonusText: { fontSize: 13, color: '#7EC850', marginBottom: 12 },
  barBg: { height: 8, borderRadius: 'var(--tk-radius-sm)' as any, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 4 },
  barFill: { height: '100%', borderRadius: 'var(--tk-radius-sm)' as any, background: 'linear-gradient(90deg, #d4a574, #e8c49a)' },
  progText: { fontSize: 11, color: '#a0a0a0' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: 600, color: '#d4a574', marginBottom: 8 },
  srcRow: { display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--tk-radius-md)' as any, fontSize: 12, marginBottom: 4 },
  rwItem: { display: 'flex', alignItems: 'center', gap: 8, padding: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 'var(--tk-radius-lg)' as any, marginBottom: 6 },
  claimBtn: { padding: '4px 12px', border: '1px solid rgba(212,165,116,0.3)', borderRadius: 'var(--tk-radius-sm)' as any, background: 'rgba(212,165,116,0.15)', color: '#d4a574', fontSize: 11, cursor: 'pointer' },
  claimedBtn: { background: 'transparent', color: '#666', border: '1px solid rgba(255,255,255,0.06)', cursor: 'default' },
  lockedBtn: { background: 'transparent', color: '#444', border: '1px solid rgba(255,255,255,0.04)', cursor: 'default' },
  tabs: { display: 'flex', gap: 4, marginBottom: 12 },
  tab: { flex: 1, padding: '6px 8px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--tk-radius-md)' as any, background: 'transparent', color: '#a0a0a0', fontSize: 12, cursor: 'pointer', textAlign: 'center' },
  tabOn: { background: 'rgba(212,165,116,0.2)', color: '#d4a574', border: '1px solid #d4a574' },
  shopCard: { padding: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--tk-radius-lg)' as any, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 },
  shopIcon: { fontSize: 24, width: 36, textAlign: 'center' as const },
  shopInfo: { flex: 1 },
  shopName: { fontSize: 13, fontWeight: 600, color: '#e8e0d0' },
  shopDesc: { fontSize: 11, color: '#888', marginTop: 2 },
  shopCost: { fontSize: 11, color: '#d4a574', marginTop: 2 },
  shopBtn: { padding: '4px 12px', border: '1px solid rgba(212,165,116,0.3)', borderRadius: 'var(--tk-radius-sm)' as any, background: 'rgba(212,165,116,0.15)', color: '#d4a574', fontSize: 11, cursor: 'pointer' },
  shopBtnDisabled: { background: 'transparent', color: '#555', border: '1px solid rgba(255,255,255,0.06)', cursor: 'default' },
  rebirthCard: { padding: 16, background: 'linear-gradient(135deg, rgba(126,200,80,0.08), rgba(126,200,80,0.02))', border: '1px solid rgba(126,200,80,0.2)', borderRadius: 'var(--tk-radius-lg)' as any, marginBottom: 12, textAlign: 'center' as const },
  conditionRow: { display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--tk-radius-md)' as any, fontSize: 12, marginBottom: 4 },
  conditionMet: { color: '#7EC850' },
  conditionUnmet: { color: '#e05050' },
  questCard: { padding: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--tk-radius-lg)' as any, marginBottom: 6 },
};

export default function PrestigePanel({ engine, visible = true, onClose }: PrestigePanelProps) {
  const [tab, setTab] = useState<PrestigeTab>('level');
  const [message, setMessage] = useState<string | null>(null);

  const ps = engine?.getPrestigeSystem?.() ?? engine?.prestige;
  const panel = ps?.getPrestigePanel?.();
  const levelInfo = ps?.getCurrentLevelInfo?.();
  const rewards: any[] = ps?.getLevelRewards?.() ?? [];
  const sources: any[] = ps?.getSourceConfigs?.() ?? [];

  // 声望商店系统
  const shopSystem = engine?.getPrestigeShopSystem?.() ?? engine?.prestigeShop;
  const shopGoods: any[] = shopSystem?.getAllGoods?.() ?? [];

  // 转生系统
  const rebirthSystem = engine?.getRebirthSystem?.() ?? engine?.rebirth;
  const rebirthCheck = rebirthSystem?.checkRebirthConditions?.();
  const rebirthState = rebirthSystem?.getState?.();
  const rebirthAcceleration = rebirthSystem?.getAcceleration?.();

  // 声望任务
  const prestigeQuests: any[] = ps?.getPrestigeQuests?.() ?? [];

  const level = panel?.currentLevel ?? 1;
  const points = panel?.currentPoints ?? 0;
  const nextPts = panel?.nextLevelPoints ?? 0;
  const prevPts = level > 1 ? (levelInfo?.requiredPoints ?? 0) : 0;
  const bonus = panel?.productionBonus ?? 1.0;
  const title = levelInfo?.title ?? '布衣';
  const pct = nextPts > prevPts ? Math.min(100, ((points - prevPts) / (nextPts - prevPts)) * 100) : 100;

  const flash = useCallback((msg: string) => { setMessage(msg); setTimeout(() => setMessage(null), 2000); }, []);

  const handleClaim = useCallback((lv: number) => {
    const r = ps?.claimLevelReward?.(lv);
    flash(r?.success ? '🎉 奖励已领取！' : r?.reason ?? '领取失败');
  }, [ps, flash]);

  const handleBuyShopGoods = useCallback((goodsId: string) => {
    const r = shopSystem?.buyGoods?.(goodsId);
    flash(r?.success ? '✅ 购买成功！' : r?.reason ?? '购买失败');
  }, [shopSystem, flash]);

  const handleRebirth = useCallback(() => {
    const r = rebirthSystem?.executeRebirth?.();
    flash(r?.success ? `🔄 转生成功！第${r.newCount}次转生，倍率×${r.multiplier?.toFixed(1)}` : r?.reason ?? '转生失败');
  }, [rebirthSystem, flash]);

  const handleClaimQuest = useCallback((questId: string) => {
    const r = ps?.checkPrestigeQuestCompletion?.(questId);
    flash(r ? '🎉 任务完成！奖励已领取' : '任务条件未满足');
  }, [ps, flash]);

  return (
    <SharedPanel
      visible={visible}
      title="声望"
      icon="📊"
      onClose={onClose}
      width="520px"
    >
      <div style={s.wrap} data-testid="prestige-panel">
        {message && <div style={s.toast} data-testid="prestige-panel-toast">{message}</div>}

        {/* Tab导航 */}
        <div style={s.tabs} data-testid="prestige-panel-tabs">
          {([
            { id: 'level' as const, label: '🏅 等级' },
            { id: 'shop' as const, label: '🛒 商店' },
            { id: 'rebirth' as const, label: '🔄 转生' },
            { id: 'quests' as const, label: '📋 任务' },
          ]).map(t => (
            <button key={t.id} style={{ ...s.tab, ...(tab === t.id ? s.tabOn : {}) }}
              onClick={() => setTab(t.id)} data-testid={`prestige-panel-tab-${t.id}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ─── 等级Tab ─── */}
        {tab === 'level' && (
          <>
            {/* 声望等级卡片 */}
            <div style={s.card} data-testid="prestige-panel-level-card">
              <div style={s.badge}>🏅 {title}</div>
              <div style={s.lvNum}>Lv.{level}</div>
              <div style={s.bonusText}>产出加成 ×{(bonus ?? 1.0).toFixed(2)}</div>
              <div style={s.barBg}><div style={{ ...s.barFill, width: `${pct}%` }} /></div>
              <div style={s.progText}>{points} / {nextPts} 声望</div>
            </div>
            {/* 获取途径 */}
            <div style={s.section}>
              <div style={s.sectionTitle}>📊 获取途径</div>
              {sources.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 16, color: '#666', fontSize: 12 }}>暂无数据</div>
              ) : (
                sources.map((cfg: any, i: number) => (
                  <div key={i} style={s.srcRow}>
                    <span>{cfg.label ?? cfg.type}</span>
                    <span style={{ color: '#888' }}>每日上限: {cfg.dailyCap > 0 ? cfg.dailyCap : '无限'}</span>
                  </div>
                ))
              )}
            </div>
            {/* 等级奖励 */}
            <div style={s.section}>
              <div style={s.sectionTitle}>🎁 等级奖励</div>
              {rewards.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 16, color: '#666', fontSize: 12 }}>暂无数据</div>
              ) : (
                rewards.map((rw: any) => {
                const unlocked = rw.level <= level;
                const claimed = rw.claimed;
                return (
                  <div key={rw.level} style={s.rwItem} data-testid={`prestige-panel-reward-${rw.level}`}>
                    <div style={{ width: 56 }}>
                      <span style={{ fontWeight: 600 }}>Lv.{rw.level}</span>
                      {unlocked && <span style={{ color: '#7EC850', fontSize: 10, marginLeft: 4 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1, fontSize: 12, color: '#a0a0a0' }}>{rw.description ?? `声望等级${rw.level}奖励`}</div>
                    <button
                      style={{ ...s.claimBtn, ...(claimed ? s.claimedBtn : {}), ...(!unlocked ? s.lockedBtn : {}) }}
                      disabled={claimed || !unlocked}
                      onClick={() => handleClaim(rw.level)}
                    >{claimed ? '已领' : !unlocked ? '🔒' : '领取'}</button>
                  </div>
                );
              })
              )}
            </div>
          </>
        )}

        {/* ─── 声望商店Tab ─── */}
        {tab === 'shop' && (
          <div data-testid="prestige-panel-shop">
            <div style={{ fontSize: 12, color: '#a0a0a0', marginBottom: 8 }}>
              声望值: <span style={{ color: '#d4a574', fontWeight: 600 }}>{points}</span> · 声望等级: <span style={{ color: '#d4a574' }}>Lv.{level}</span>
            </div>
            {shopGoods.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#666', fontSize: 12 }}>声望商店暂无商品</div>
            ) : shopGoods.map((g: any) => {
              const canBuy = g.canBuy;
              const locked = level < g.requiredLevel;
              const limitReached = g.purchaseLimit > 0 && g.purchased >= g.purchaseLimit;
              return (
                <div key={g.id} style={s.shopCard} data-testid={`prestige-panel-shop-item-${g.id}`}>
                  <div style={s.shopIcon}>{g.icon ?? '📦'}</div>
                  <div style={s.shopInfo}>
                    <div style={s.shopName}>{g.name}{locked && <span style={{ color: '#555', fontSize: 10, marginLeft: 4 }}>🔒 Lv.{g.requiredLevel}</span>}</div>
                    <div style={s.shopDesc}>{g.description}</div>
                    <div style={s.shopCost}>消耗 {g.costPoints} 声望值{g.purchaseLimit > 0 ? ` · 限购${g.purchaseLimit}次(已购${g.purchased})` : ''}</div>
                  </div>
                  <button
                    style={{ ...s.shopBtn, ...(!canBuy ? s.shopBtnDisabled : {}) }}
                    disabled={!canBuy}
                    onClick={() => handleBuyShopGoods(g.id)}
                    data-testid={`prestige-panel-shop-buy-${g.id}`}
                  >{locked ? '🔒' : limitReached ? '已购' : '购买'}</button>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── 转生Tab ─── */}
        {tab === 'rebirth' && (
          <div data-testid="prestige-panel-rebirth">
            {rebirthState && (
              <div style={s.rebirthCard}>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#7EC850', marginBottom: 4 }}>🔄 转生次数: {rebirthState.rebirthCount ?? 0}</div>
                <div style={{ fontSize: 13, color: '#e8e0d0' }}>当前倍率: ×{(rebirthState.currentMultiplier ?? 1.0).toFixed(1)}</div>
                {rebirthAcceleration?.active && (
                  <div style={{ fontSize: 12, color: '#d4a574', marginTop: 4 }}>⚡ 加速中，剩余 {rebirthAcceleration.daysLeft} 天</div>
                )}
              </div>
            )}
            {/* 转生条件 */}
            <div style={s.section}>
              <div style={s.sectionTitle}>📋 转生条件</div>
              {rebirthCheck ? Object.entries(rebirthCheck.conditions).map(([key, cond]: [string, any]) => (
                <div key={key} style={s.conditionRow} data-testid={`prestige-panel-rebirth-cond-${key}`}>
                  <span>{{ prestigeLevel: '声望等级', castleLevel: '主城等级', heroCount: '武将数量', totalPower: '总战力' }[key] ?? key}</span>
                  <span style={cond.met ? s.conditionMet : s.conditionUnmet}>
                    {cond.current}/{cond.required} {cond.met ? '✓' : '✗'}
                  </span>
                </div>
              )) : <div style={{ textAlign: 'center', padding: 16, color: '#666', fontSize: 12 }}>转生系统未加载</div>}
            </div>
            {/* 转生说明 */}
            <div style={s.section}>
              <div style={s.sectionTitle}>📖 转生说明</div>
              <div style={{ fontSize: 12, color: '#a0a0a0', lineHeight: 1.6 }}>
                <div>✅ 保留: 武将、装备、科技点、声望、成就、VIP</div>
                <div>🔄 重置: 建筑、资源、地图、任务、战役</div>
                <div>⚡ 加速: 建筑×1.5、科技×1.5、资源×2.0、经验×2.0（持续7天）</div>
              </div>
            </div>
            {/* 转生按钮 */}
            <button
              style={{ ...s.claimBtn, width: '100%', padding: '10px 0', fontSize: 14, marginTop: 8, ...(rebirthCheck?.canRebirth ? {} : s.shopBtnDisabled) }}
              disabled={!rebirthCheck?.canRebirth}
              onClick={handleRebirth}
              data-testid="prestige-panel-rebirth-btn"
            >{rebirthCheck?.canRebirth ? '🔄 确认转生' : '条件未满足'}</button>
          </div>
        )}

        {/* ─── 声望任务Tab ─── */}
        {tab === 'quests' && (
          <div data-testid="prestige-panel-quests">
            {prestigeQuests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#666', fontSize: 12 }}>暂无可用声望任务</div>
            ) : prestigeQuests.map((q: any) => {
              const progress = ps?.getPrestigeQuestProgress?.(q.id) ?? 0;
              const completed = ps?.getState?.()?.completedPrestigeQuests?.includes(q.id) ?? false;
              const pct = q.targetCount > 0 ? Math.min(100, (progress / q.targetCount) * 100) : 0;
              return (
                <div key={q.id} style={s.questCard} data-testid={`prestige-panel-quest-${q.id}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#e8e0d0' }}>{q.title}</span>
                    {completed && <span style={{ color: '#7EC850', fontSize: 11 }}>✅ 已完成</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>{q.description}</div>
                  <div style={s.barBg}><div style={{ ...s.barFill, width: `${pct}%` }} /></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: '#a0a0a0' }}>{progress}/{q.targetCount}</span>
                    {!completed && progress >= q.targetCount && (
                      <button style={s.claimBtn} onClick={() => handleClaimQuest(q.id)} data-testid={`prestige-panel-quest-claim-${q.id}`}>领取奖励</button>
                    )}
                    {!completed && progress < q.targetCount && (
                      <span style={{ fontSize: 10, color: '#666' }}>进行中</span>
                    )}
                  </div>
                  {q.rewards && (
                    <div style={{ fontSize: 10, color: '#d4a574', marginTop: 4 }}>
                      奖励: {q.rewards.prestigePoints ? `${q.rewards.prestigePoints}声望 ` : ''}{q.rewards.resources ? Object.entries(q.rewards.resources).map(([k, v]) => `${k}×${v}`).join(' ') : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SharedPanel>
  );
}