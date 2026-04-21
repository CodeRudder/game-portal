/**
 * 任务系统面板 — 每日/主线/支线任务、活跃度里程碑、一键领取
 *
 * 读取引擎 QuestSystem 数据。
 * 已迁移至 SharedPanel 统一弹窗容器。
 *
 * @module panels/quest/QuestPanel
 */
import React, { useState, useMemo, useCallback } from 'react';
import SharedPanel from '@/components/idle/components/SharedPanel';

interface QuestPanelProps {
  engine: any;
  /** 是否显示面板 */
  visible?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
}

type QTab = 'daily' | 'main' | 'side';
const TABS: { id: QTab; label: string; icon: string }[] = [
  { id: 'daily', label: '日常', icon: '📅' },
  { id: 'main', label: '主线', icon: '📖' },
  { id: 'side', label: '支线', icon: '📜' },
];

export default function QuestPanel({ engine, visible = true, onClose }: QuestPanelProps) {
  const [tab, setTab] = useState<QTab>('daily');
  const [message, setMessage] = useState<string | null>(null);

  const qs = engine?.getQuestSystem?.() ?? engine?.quest;
  const quests = useMemo(() => {
    if (!qs) return [];
    if (tab === 'daily') return qs.getDailyQuests?.() ?? [];
    return qs.getActiveQuestsByCategory?.(tab) ?? [];
  }, [qs, tab]);

  const act = qs?.getActivityState?.();
  const actPts = act?.currentPoints ?? 0;
  const actMax = act?.maxPoints ?? 100;
  const milestones: any[] = act?.milestones ?? [];

  const flash = useCallback((msg: string) => { setMessage(msg); setTimeout(() => setMessage(null), 2000); }, []);

  const handleClaim = useCallback((id: string) => {
    const quest = qs?.getQuest?.(id) ?? quests.find((q: any) => q.instanceId === id);
    if (!quest || quest.status !== 'completed') {
      flash('📋 任务尚未完成，无法领取奖励');
      return;
    }
    if (quest.rewardClaimed) {
      flash('📋 奖励已领取，请勿重复操作');
      return;
    }
    const r = qs?.claimReward?.(id);
    flash(r ? '🎉 奖励已领取！' : '领取失败');
  }, [qs, flash, quests]);

  const handleClaimAll = useCallback(() => {
    const rs = qs?.claimAllRewards?.();
    flash(rs?.length > 0 ? `🎉 领取${rs.length}个奖励` : '无可领取');
  }, [qs, flash]);

  const handleMilestone = useCallback((idx: number) => {
    const r = qs?.claimActivityMilestone?.(idx);
    if (r) flash('🎉 里程碑奖励已领取！');
  }, [qs, flash]);

  return (
    <SharedPanel visible={visible} title="任务" icon="📋" onClose={onClose} width="520px">
    <div style={s.wrap}>
      {message && <div style={s.toast}>{message}</div>}
      {/* 活跃度 */}
      <div style={s.actBox}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#d4a574' }}>⚡ 活跃度</span>
          <span style={{ fontSize: 12, color: '#a0a0a0' }}>{actPts}/{actMax}</span>
        </div>
        <div style={s.barBg}><div style={{ ...s.barFill, width: `${(actPts / actMax) * 100}%` }} /></div>
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          {milestones.map((m: any, i: number) => (
            <button key={i} style={{
              ...s.msBtn,
              ...(actPts >= m.points ? { borderColor: '#d4a574' } : {}),
              ...(m.claimed ? { background: 'rgba(126,200,80,0.15)', color: '#7EC850' } : {}),
            }} disabled={m.claimed || actPts < m.points} onClick={() => handleMilestone(i)}>
              {m.points}分{m.claimed ? ' ✓' : ''}
            </button>
          ))}
        </div>
      </div>
      {/* Tab + 一键领取 */}
      <div style={s.tabs}>
        {TABS.map(t => (
          <button key={t.id} style={{ ...s.tab, ...(tab === t.id ? s.tabOn : {}) }} onClick={() => setTab(t.id)}>
            {t.icon} {t.label}
          </button>
        ))}
        <button style={s.claimAll} onClick={handleClaimAll}>一键领取</button>
      </div>
      {/* 任务列表 */}
      {quests.map((q: any) => {
        const done = q.status === 'completed';
        const claimed = q.rewardClaimed;
        const objs: any[] = q.objectives ?? [];
        return (
          <div key={q.instanceId} style={{ ...s.card, opacity: claimed ? 0.5 : 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
              {q.questDefId ?? '任务'}{done && <span style={{ color: '#7EC850', marginLeft: 6 }}>✅</span>}
            </div>
            {objs.map((o: any) => (
              <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ flex: 1, height: 4, borderRadius: 'var(--tk-radius-sm)' as any, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 'var(--tk-radius-sm)' as any, background: '#7EC850', width: `${Math.min(100, (o.currentCount / o.targetCount) * 100)}%` }} />
                </div>
                <span style={{ fontSize: 11, color: '#888', minWidth: 44, textAlign: 'right' }}>{o.currentCount}/{o.targetCount}</span>
              </div>
            ))}
            {done && !claimed && <button style={s.btn} onClick={() => handleClaim(q.instanceId)}>领取奖励</button>}
          </div>
        );
      })}
      {quests.length === 0 && <div style={s.empty}>暂无{TABS.find(t => t.id === tab)?.label ?? ''}任务</div>}
    </div>
    </SharedPanel>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { padding: 12, color: '#e8e0d0', minHeight: '100%' },
  toast: { padding: '8px 12px', marginBottom: 8, borderRadius: 'var(--tk-radius-md)' as any, background: 'rgba(212,165,116,0.2)', color: '#d4a574', fontSize: 12, textAlign: 'center' },
  actBox: { padding: 10, marginBottom: 12, borderRadius: 'var(--tk-radius-lg)' as any, background: 'rgba(212,165,116,0.08)', border: '1px solid rgba(212,165,116,0.2)' },
  barBg: { height: 6, borderRadius: 'var(--tk-radius-sm)' as any, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 'var(--tk-radius-sm)' as any, background: 'linear-gradient(90deg, #d4a574, #e8c49a)' },
  msBtn: { padding: '3px 8px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--tk-radius-sm)' as any, background: 'transparent', color: '#888', fontSize: 10, cursor: 'pointer' },
  tabs: { display: 'flex', gap: 4, marginBottom: 12, alignItems: 'center' },
  tab: { padding: '6px 12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--tk-radius-md)' as any, background: 'transparent', color: '#a0a0a0', fontSize: 12, cursor: 'pointer' },
  tabOn: { background: 'rgba(212,165,116,0.2)', color: '#d4a574', borderColor: '#d4a574' },
  claimAll: { marginLeft: 'auto', padding: '5px 10px', border: '1px solid rgba(212,165,116,0.3)', borderRadius: 'var(--tk-radius-md)' as any, background: 'rgba(212,165,116,0.1)', color: '#d4a574', fontSize: 11, cursor: 'pointer' },
  card: { padding: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--tk-radius-lg)' as any, marginBottom: 6 },
  btn: { marginTop: 6, padding: '5px 14px', border: '1px solid rgba(212,165,116,0.3)', borderRadius: 'var(--tk-radius-md)' as any, background: 'rgba(212,165,116,0.15)', color: '#d4a574', fontSize: 12, cursor: 'pointer' },
  empty: { textAlign: 'center', padding: 24, color: '#666', fontSize: 13 },
};
