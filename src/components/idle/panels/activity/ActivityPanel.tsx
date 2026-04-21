/**
 * 活动系统面板 — 活动列表、任务、里程碑
 *
 * 读取引擎 ActivitySystem 数据。
 *
 * @module panels/activity/ActivityPanel
 */
import React, { useState, useMemo, useCallback } from 'react';

interface ActivityPanelProps {
  engine: any;
}

export default function ActivityPanel({ engine }: ActivityPanelProps) {
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const activitySystem = engine?.getActivitySystem?.() ?? engine?.activity;
  const state = activitySystem?.getState?.();

  // 活跃活动
  const activities = useMemo(() => {
    if (!state?.activities) return [];
    return Object.entries(state.activities)
      .filter(([, a]: [string, any]) => a.status === 'ACTIVE')
      .map(([id, a]: [string, any]) => ({ id, ...a }));
  }, [state]);

  // 签到状态
  const signIn = state?.signIn;
  const consecutiveDays = signIn?.consecutiveDays ?? 0;
  const todaySigned = signIn?.todaySigned ?? false;

  // 选中的活动
  const selectedActivity = selectedActivityId
    ? activities.find(a => a.id === selectedActivityId)
    : null;

  // 领取任务奖励
  const handleClaimTask = useCallback((activityId: string, taskDefId: string) => {
    try {
      const result = activitySystem?.claimTaskReward?.(state, activityId, taskDefId);
      if (result) {
        setMessage(`🎉 获得${result.points}积分 +${result.tokens}代币`);
      }
    } catch (e: any) {
      setMessage(e?.message ?? '领取失败');
    }
    setTimeout(() => setMessage(null), 2000);
  }, [activitySystem, state]);

  // 领取里程碑
  const handleClaimMilestone = useCallback((activityId: string, milestoneId: string) => {
    try {
      const result = activitySystem?.claimMilestone?.(state, activityId, milestoneId);
      if (result) {
        setMessage('🎉 里程碑奖励已领取！');
      }
    } catch (e: any) {
      setMessage(e?.message ?? '领取失败');
    }
    setTimeout(() => setMessage(null), 2000);
  }, [activitySystem, state]);

  return (
    <div style={styles.container}>
      {message && <div style={styles.toast}>{message}</div>}

      {/* 签到卡片 */}
      {signIn && (
        <div style={styles.signInCard}>
          <div style={styles.signInTitle}>📅 每日签到</div>
          <div style={styles.signInInfo}>连续签到 {consecutiveDays} 天</div>
          <button
            style={{ ...styles.signInBtn, ...(todaySigned ? styles.signInBtnDone : {}) }}
            disabled={todaySigned}
          >
            {todaySigned ? '✅ 今日已签' : '签到'}
          </button>
        </div>
      )}

      {/* 活动列表 */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>⚡ 活跃活动 ({activities.length})</div>
        <div style={styles.activityList}>
          {activities.map(act => (
            <div
              key={act.id}
              style={{
                ...styles.activityCard,
                borderColor: selectedActivityId === act.id ? '#d4a574' : 'rgba(255,255,255,0.08)',
              }}
              onClick={() => setSelectedActivityId(act.id)}
            >
              <div style={styles.activityName}>{act.defId ?? act.id}</div>
              <div style={styles.activityPoints}>
                积分: {act.points ?? 0} · 代币: {act.tokens ?? 0}
              </div>

              {/* 任务列表 */}
              {(act.tasks ?? []).map((task: any) => (
                <div key={task.defId} style={styles.taskItem}>
                  <div style={styles.taskInfo}>
                    <span>{task.taskType ?? '任务'}</span>
                    <span style={{ color: '#888', fontSize: 11 }}>
                      {task.currentProgress}/{task.targetCount}
                    </span>
                  </div>
                  <div style={styles.taskBar}>
                    <div style={{
                      ...styles.taskFill,
                      width: `${Math.min(100, (task.currentProgress / Math.max(1, task.targetCount)) * 100)}%`,
                    }} />
                  </div>
                  {task.status === 'COMPLETED' && (
                    <button
                      style={styles.taskClaimBtn}
                      onClick={e => { e.stopPropagation(); handleClaimTask(act.id, task.defId); }}
                    >领取</button>
                  )}
                </div>
              ))}

              {/* 里程碑 */}
              {(act.milestones ?? []).filter((m: any) => m.status === 'UNLOCKED').map((m: any) => (
                <div key={m.id} style={styles.milestoneItem}>
                  <span style={{ color: '#d4a574', fontSize: 12 }}>🎯 里程碑 {m.requiredPoints}分</span>
                  <button
                    style={styles.milestoneClaimBtn}
                    onClick={e => { e.stopPropagation(); handleClaimMilestone(act.id, m.id); }}
                  >领取</button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {activities.length === 0 && (
        <div style={styles.empty}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎪</div>
          当前没有活跃活动
        </div>
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
  signInCard: {
    padding: 12, marginBottom: 12, borderRadius: 8, textAlign: 'center',
    background: 'rgba(212,165,116,0.08)', border: '1px solid rgba(212,165,116,0.2)',
  },
  signInTitle: { fontSize: 14, fontWeight: 600, color: '#d4a574', marginBottom: 4 },
  signInInfo: { fontSize: 12, color: '#a0a0a0', marginBottom: 8 },
  signInBtn: {
    padding: '6px 20px', border: '1px solid rgba(212,165,116,0.3)', borderRadius: 6,
    background: 'rgba(212,165,116,0.15)', color: '#d4a574', fontSize: 13, cursor: 'pointer',
  },
  signInBtnDone: { background: 'transparent', color: '#666', borderColor: 'rgba(255,255,255,0.06)', cursor: 'default' },
  section: { marginBottom: 16 },
  sectionHeader: { fontSize: 14, fontWeight: 600, color: '#d4a574', marginBottom: 8 },
  activityList: { display: 'flex', flexDirection: 'column', gap: 8 },
  activityCard: {
    padding: 12, background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, cursor: 'pointer',
  },
  activityName: { fontSize: 14, fontWeight: 600, marginBottom: 4 },
  activityPoints: { fontSize: 12, color: '#a0a0a0', marginBottom: 8 },
  taskItem: { marginBottom: 6, padding: '6px 0' },
  taskInfo: { display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 },
  taskBar: { height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 4 },
  taskFill: { height: '100%', borderRadius: 2, background: '#7EC850' },
  taskClaimBtn: {
    padding: '3px 10px', border: '1px solid rgba(212,165,116,0.3)', borderRadius: 4,
    background: 'rgba(212,165,116,0.15)', color: '#d4a574', fontSize: 10, cursor: 'pointer',
  },
  milestoneItem: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '6px 8', marginTop: 4, background: 'rgba(212,165,116,0.06)', borderRadius: 4,
  },
  milestoneClaimBtn: {
    padding: '3px 10px', border: '1px solid rgba(212,165,116,0.3)', borderRadius: 4,
    background: 'rgba(212,165,116,0.15)', color: '#d4a574', fontSize: 10, cursor: 'pointer',
  },
  empty: { textAlign: 'center', padding: 30, color: '#666', fontSize: 13 },
};
