/**
 * 声望系统面板 — 声望等级、进度条、产出加成、等级奖励领取
 *
 * 读取引擎 PrestigeSystem 数据。
 *
 * @module panels/prestige/PrestigePanel
 */
import React, { useState, useCallback } from 'react';

interface PrestigePanelProps {
  engine: any;
}

export default function PrestigePanel({ engine }: PrestigePanelProps) {
  const [message, setMessage] = useState<string | null>(null);

  const ps = engine?.getPrestigeSystem?.() ?? engine?.prestige;
  const panel = ps?.getPrestigePanel?.();
  const levelInfo = ps?.getCurrentLevelInfo?.();
  const rewards: any[] = ps?.getLevelRewards?.() ?? [];
  const sources: any[] = ps?.getSourceConfigs?.() ?? [];

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

  return (
    <div style={s.wrap}>
      {message && <div style={s.toast}>{message}</div>}
      {/* 声望等级卡片 */}
      <div style={s.card}>
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
            <div key={rw.level} style={s.rwItem}>
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
    </div>
  );
}

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
  claimedBtn: { background: 'transparent', color: '#666', borderColor: 'rgba(255,255,255,0.06)', cursor: 'default' },
  lockedBtn: { background: 'transparent', color: '#444', borderColor: 'rgba(255,255,255,0.04)', cursor: 'default' },
};
