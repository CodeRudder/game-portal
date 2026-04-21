/**
 * 成就系统面板 — 5维度成就(战斗/建设/收集/社交/转生)、进度、奖励领取
 *
 * 读取引擎 AchievementSystem 数据。
 * 已迁移至 SharedPanel 统一弹窗容器。
 *
 * @module panels/achievement/AchievementPanel
 */
import React, { useState, useMemo, useCallback } from 'react';
import SharedPanel from '@/components/idle/components/SharedPanel';

interface AchievementPanelProps {
  engine: any;
  /** 是否显示面板 */
  visible?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
}

type Dim = 'battle' | 'building' | 'collection' | 'social' | 'rebirth';
const DIMS: { id: Dim; label: string; icon: string }[] = [
  { id: 'battle', label: '战斗', icon: '⚔️' },
  { id: 'building', label: '建设', icon: '🏗️' },
  { id: 'collection', label: '收集', icon: '📦' },
  { id: 'social', label: '社交', icon: '👥' },
  { id: 'rebirth', label: '转生', icon: '🔄' },
];

export default function AchievementPanel({ engine, visible = true, onClose }: AchievementPanelProps) {
  const [tab, setTab] = useState<Dim>('battle');
  const [message, setMessage] = useState<string | null>(null);

  const ach = engine?.getAchievementSystem?.() ?? engine?.achievement;
  const achievements = useMemo(() => ach?.getAchievementsByDimension?.(tab) ?? [], [ach, tab]);
  const dimStats = ach?.getDimensionStats?.() ?? {};
  const totalPts = ach?.getTotalPoints?.() ?? 0;
  const claimable: string[] = ach?.getClaimableAchievements?.() ?? [];

  const flash = useCallback((msg: string) => { setMessage(msg); setTimeout(() => setMessage(null), 2000); }, []);

  const handleClaim = useCallback((id: string) => {
    const r = ach?.claimReward?.(id);
    flash(r?.success ? `🎉 +${r.reward?.achievementPoints ?? 0}积分` : r?.reason ?? '领取失败');
  }, [ach, flash]);

  return (
    <SharedPanel visible={visible} title="成就" icon="🏆" onClose={onClose} width="520px">
    <div style={s.wrap}>
      {message && <div style={s.toast}>{message}</div>}
      {/* 总览 */}
      <div style={s.summary}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#d4a574' }}>🏆 成就积分</span>
        <span style={{ fontSize: 22, fontWeight: 700 }}>{totalPts}</span>
        {claimable.length > 0 && <span style={s.badge}>{claimable.length}个可领</span>}
      </div>
      {/* 维度Tab */}
      <div style={s.tabs}>
        {DIMS.map(t => {
          const st = dimStats[t.id];
          return (
            <button key={t.id} style={{ ...s.tab, ...(tab === t.id ? s.tabOn : {}) }} onClick={() => setTab(t.id)}>
              {t.icon} {t.label}
              {st && <span style={{ fontSize: 9, color: '#666', marginLeft: 2 }}>{st.completedCount}/{st.totalCount}</span>}
            </button>
          );
        })}
      </div>
      {/* 成就列表 */}
      {achievements.map((a: any) => {
        const inst = a.instance;
        const isCompleted = inst?.status === 'completed';
        const isClaimed = inst?.status === 'claimed';
        const isLocked = inst?.status === 'locked';
        const conds: any[] = a.conditions ?? [];
        const pct = conds.length > 0
          ? conds.reduce((sum: number, c: any) => sum + Math.min(1, (inst?.progress?.[c.type] ?? 0) / c.targetValue), 0) / conds.length
          : 0;
        return (
          <div key={a.id} style={{ ...s.card, opacity: isLocked ? 0.4 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{a.name}</span>
              <span style={{ fontSize: 11, color: isClaimed ? '#666' : isCompleted ? '#d4a574' : !isLocked ? '#7EC850' : '#888' }}>
                {isClaimed ? '已领取' : isCompleted ? '可领取' : !isLocked ? '进行中' : '🔒'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 3, marginBottom: 6 }}>{a.description}</div>
            {!isLocked && <div style={s.barBg}><div style={{ ...s.barFill, width: `${pct * 100}%` }} /></div>}
            <div style={{ fontSize: 11, color: '#d4a574', marginTop: 4 }}>积分: {a.rewards?.achievementPoints ?? 0}</div>
            {isCompleted && !isClaimed && <button style={s.btn} onClick={() => handleClaim(a.id)}>领取奖励</button>}
          </div>
        );
      })}
      {achievements.length === 0 && <div style={s.empty}>暂无成就</div>}
    </div>
    </SharedPanel>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { padding: 12, color: '#e8e0d0', minHeight: '100%' },
  toast: { padding: '8px 12px', marginBottom: 8, borderRadius: 'var(--tk-radius-md)' as any, background: 'rgba(212,165,116,0.2)', color: '#d4a574', fontSize: 12, textAlign: 'center' },
  summary: { display: 'flex', alignItems: 'center', gap: 10, padding: 10, marginBottom: 12, borderRadius: 'var(--tk-radius-lg)' as any, background: 'rgba(212,165,116,0.08)', border: '1px solid rgba(212,165,116,0.2)' },
  badge: { marginLeft: 'auto', padding: '2px 8px', borderRadius: 'var(--tk-radius-lg)' as any, background: 'rgba(212,165,116,0.2)', color: '#d4a574', fontSize: 11 },
  tabs: { display: 'flex', gap: 3, marginBottom: 12, flexWrap: 'wrap' },
  tab: { display: 'flex', alignItems: 'center', gap: 3, padding: '5px 8px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--tk-radius-md)' as any, background: 'transparent', color: '#a0a0a0', fontSize: 11, cursor: 'pointer' },
  tabOn: { background: 'rgba(212,165,116,0.2)', color: '#d4a574', borderColor: '#d4a574' },
  card: { padding: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--tk-radius-lg)' as any, marginBottom: 6 },
  barBg: { height: 4, borderRadius: 'var(--tk-radius-sm)' as any, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 'var(--tk-radius-sm)' as any, background: '#7EC850' },
  btn: { marginTop: 6, padding: '4px 12px', border: '1px solid rgba(212,165,116,0.3)', borderRadius: 'var(--tk-radius-sm)' as any, background: 'rgba(212,165,116,0.15)', color: '#d4a574', fontSize: 11, cursor: 'pointer' },
  empty: { textAlign: 'center', padding: 24, color: '#666', fontSize: 13 },
};
