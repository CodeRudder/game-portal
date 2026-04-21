/**
 * 任务系统面板 — 主线/支线/日常任务、活跃度
 *
 * 读取引擎 QuestSystem 数据。
 *
 * @module panels/quest/QuestPanel
 */
import React, { useState, useMemo, useCallback } from 'react';

interface QuestPanelProps {
  engine: any;
}

type QuestTab = 'daily' | 'main' | 'side';

const TAB_CONFIG: { id: QuestTab; label: string; icon: string }[] = [
  { id: 'daily', label: '日常', icon: '📅' },
  { id: 'main', label: '主线', icon: '📖' },
  { id: 'side', label: '支线', icon: '📜' },
];

export default function QuestPanel({ engine }: QuestPanelProps) {
  const [tab, setTab] = useState<QuestTab>('daily');
  const [message, setMessage] = useState<string | null>(null);

  const questSystem = engine?.getQuestSystem?.() ?? engine?.quest;

  // 获取任务列表
  const quests = useMemo(() => {
    if (!questSystem) return [];
    switch (tab) {
      case 'daily': return questSystem.getDailyQuests?.() ?? [];
      case 'main': return questSystem.getActiveQuestsByCategory?.('main') ?? [];
      case 'side': return questSystem.getActiveQuestsByCategory?.('side') ?? [];
      default: return questSystem.getActiveQuests?.() ?? [];
    }
  }, [questSystem, tab]);

  // 活跃度
  const activityState = questSystem?.getActivityState?.();
  const activityPoints = activityState?.currentPoints ?? 0;
  const maxActivityPoints = activityState?.maxPoints ?? 100;
  const milestones = activityState?.milestones ?? [];

  // 领取奖励
  const handleClaimReward = useCallback((instanceId: string) => {
    const reward = questSystem?.claimReward?.(instanceId);
    if (reward) {
      setMessage('🎉 奖励已领取！');
    } else {
      setMessage('领取失败');
    }
    setTimeout(() => setMessage(null), 2000);
  }, [questSystem]);

  // 一键领取
  const handleClaimAll = useCallback(() => {
    const rewards = questSystem?.claimAllRewards?.();
    setMessage(rewards?.length > 0 ? `🎉 领取了${rewards.length}个任务奖励` : '无可领取奖励');
    setTimeout(() => setMessage(null), 2000);
  }, [questSystem]);

  // 领取活跃度里程碑
  const handleClaimMilestone = useCallback((index: number) => {
    const result = questSystem?.claimActivityMilestone?.(index);
    if (result) {
      setMessage('🎉 里程碑奖励已领取！');
    }
    setTimeout(() => setMessage(null), 2000);
  }, [questSystem]);

  return (
    <div style={styles.container}>
      {message && <div style={styles.toast}>{message}</div>}

      {/* 活跃度条 */}
      <div style={styles.activityBar}>
        <div style={styles.activityHeader}>
          <span style={styles.activityTitle}>⚡ 活跃度</span>
          <span style={styles.activityCount}>{activityPoints}/{maxActivityPoints}</span>
        </div>
        <div style={styles.progressBar}>
          <div style={{ ...styles.progressFill, width: `${(activityPoints / maxActivityPoints) * 100}%` }} />
        </div>
        <div style={styles.milestoneRow}>
          {milestones.map((m: any, i: number) => (
            <button
              key={i}
              style={{
                ...styles.milestoneBtn,
                ...(activityPoints >= m.points ? { borderColor: '#d4a574' } : {}),
                ...(m.claimed ? { background: 'rgba(126,200,80,0.15)', color: '#7EC850' } : {}),
              }}
              disabled={m.claimed || activityPoints < m.points}
              onClick={() => handleClaimMilestone(i)}
            >
              {m.points}分 {m.claimed ? '✓' : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Tab栏 */}
      <div style={styles.tabBar}>
        {TAB_CONFIG.map(t => (
          <button
            key={t.id}
            style={{ ...styles.tabBtn, ...(tab === t.id ? styles.activeTab : {}) }}
            onClick={() => setTab(t.id)}
          >{t.icon} {t.label}</button>
        ))}
        <button style={styles.claimAllBtn} onClick={handleClaimAll}>一键领取</button>
      </div>

      {/* 任务列表 */}
      <div style={styles.questList}>
        {quests.map((quest: any) => {
          const isCompleted = quest.status === 'completed';
          const isClaimed = quest.rewardClaimed;
          const isActive = quest.status === 'active';
          const objectives: any[] = quest.objectives ?? [];
          const allDone = objectives.every((o: any) => o.currentCount >= o.targetCount);

          return (
            <div key={quest.instanceId} style={{
              ...styles.questCard,
              opacity: isClaimed ? 0.5 : 1,
            }}>
              <div style={styles.questName}>
                {quest.questDefId ?? '任务'}
                {isCompleted && <span style={{ color: '#7EC850', marginLeft: 6 }}>✅</span>}
              </div>
              {/* 目标进度 */}
              {objectives.map((obj: any) => (
                <div key={obj.id} style={styles.objective}>
                  <div style={styles.objBar}>
                    <div style={{
                      ...styles.objFill,
                      width: `${Math.min(100, (obj.currentCount / obj.targetCount) * 100)}%`,
                    }} />
                  </div>
                  <span style={styles.objText}>{obj.currentCount}/{obj.targetCount}</span>
                </div>
              ))}
              {/* 操作按钮 */}
              {isCompleted && !isClaimed && (
                <button style={styles.claimBtn} onClick={() => handleClaimReward(quest.instanceId)}>
                  领取奖励
                </button>
              )}
            </div>
          );
        })}
      </div>

      {quests.length === 0 && (
        <div style={styles.empty}>暂无{TAB_CONFIG.find(t => t.id === tab)?.label ?? ''}任务</div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: 12, color: '#e8e0d0', minHeight: '100%' },
  toast: {
    padding: '8px 12px', marginBottom: 8, borderRadius: 6,
    background: 'rgba(212,165,116,0.2)', color: '#d4a574', fontSize: 12, textAlign: 'center',
  },
  activityBar: {
    padding: 10, marginBottom: 12, borderRadius: 8,
    background: 'rgba(212,165,116,0.08)', border: '1px solid rgba(212,165,116,0.2)',
  },
  activityHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: 6 },
  activityTitle: { fontSize: 13, fontWeight: 600, color: '#d4a574' },
  activityCount: { fontSize: 12, color: '#a0a0a0' },
  progressBar: { height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, #d4a574, #e8c49a)' },
  milestoneRow: { display: 'flex', gap: 4 },
  milestoneBtn: {
    padding: '3px 8px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4,
    background: 'transparent', color: '#888', fontSize: 10, cursor: 'pointer',
  },
  tabBar: { display: 'flex', gap: 4, marginBottom: 12, alignItems: 'center' },
  tabBtn: {
    padding: '6px 12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
    background: 'transparent', color: '#a0a0a0', fontSize: 12, cursor: 'pointer',
  },
  activeTab: { background: 'rgba(212,165,116,0.2)', color: '#d4a574', borderColor: '#d4a574' },
  claimAllBtn: {
    marginLeft: 'auto', padding: '5px 10px', border: '1px solid rgba(212,165,116,0.3)', borderRadius: 6,
    background: 'rgba(212,165,116,0.1)', color: '#d4a574', fontSize: 11, cursor: 'pointer',
  },
  questList: { display: 'flex', flexDirection: 'column', gap: 6 },
  questCard: {
    padding: 10, background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
  },
  questName: { fontSize: 14, fontWeight: 600, marginBottom: 6 },
  objective: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
  objBar: { flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  objFill: { height: '100%', borderRadius: 2, background: '#7EC850' },
  objText: { fontSize: 11, color: '#888', minWidth: 50, textAlign: 'right' },
  claimBtn: {
    marginTop: 6, padding: '5px 14px', border: '1px solid rgba(212,165,116,0.3)', borderRadius: 6,
    background: 'rgba(212,165,116,0.15)', color: '#d4a574', fontSize: 12, cursor: 'pointer',
  },
  empty: { textAlign: 'center', padding: 24, color: '#666', fontSize: 13 },
};
