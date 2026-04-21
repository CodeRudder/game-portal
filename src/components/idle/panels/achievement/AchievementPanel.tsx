/**
 * 成就系统面板 — 5维度成就、进度、奖励
 *
 * 读取引擎 AchievementSystem 数据。
 *
 * @module panels/achievement/AchievementPanel
 */
import React, { useState, useMemo, useCallback } from 'react';

interface AchievementPanelProps {
  engine: any;
}

type Dimension = 'battle' | 'building' | 'collection' | 'social' | 'rebirth';

const DIMENSION_TABS: { id: Dimension; label: string; icon: string }[] = [
  { id: 'battle', label: '战斗', icon: '⚔️' },
  { id: 'building', label: '建设', icon: '🏗️' },
  { id: 'collection', label: '收集', icon: '📦' },
  { id: 'social', label: '社交', icon: '👥' },
  { id: 'rebirth', label: '转生', icon: '🔄' },
];

export default function AchievementPanel({ engine }: AchievementPanelProps) {
  const [tab, setTab] = useState<Dimension>('battle');
  const [message, setMessage] = useState<string | null>(null);

  const achievementSystem = engine?.getAchievementSystem?.() ?? engine?.achievement;

  // 成就列表
  const achievements = useMemo(
    () => achievementSystem?.getAchievementsByDimension?.(tab) ?? [],
    [achievementSystem, tab],
  );

  // 维度统计
  const dimensionStats = achievementSystem?.getDimensionStats?.() ?? {};
  const totalPoints = achievementSystem?.getTotalPoints?.() ?? 0;
  const claimableIds = achievementSystem?.getClaimableAchievements?.() ?? [];

  // 领取奖励
  const handleClaim = useCallback((id: string) => {
    const result = achievementSystem?.claimReward?.(id);
    if (result?.success) {
      setMessage(`🎉 领取成功！+${result.reward?.achievementPoints ?? 0}积分`);
    } else {
      setMessage(result?.reason ?? '领取失败');
    }
    setTimeout(() => setMessage(null), 2000);
  }, [achievementSystem]);

  return (
    <div style={styles.container}>
      {message && <div style={styles.toast}>{message}</div>}

      {/* 总览 */}
      <div style={styles.summary}>
        <span style={styles.summaryTitle}>🏆 成就积分</span>
        <span style={styles.summaryPoints}>{totalPoints}</span>
        {claimableIds.length > 0 && (
          <span style={styles.claimableBadge}>{claimableIds.length}个可领取</span>
        )}
      </div>

      {/* 维度Tab */}
      <div style={styles.tabBar}>
        {DIMENSION_TABS.map(t => {
          const stat = dimensionStats[t.id];
          return (
            <button
              key={t.id}
              style={{ ...styles.tabBtn, ...(tab === t.id ? styles.activeTab : {}) }}
              onClick={() => setTab(t.id)}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
              {stat && <span style={styles.tabCount}>{stat.completedCount}/{stat.totalCount}</span>}
            </button>
          );
        })}
      </div>

      {/* 成就列表 */}
      <div style={styles.achievementList}>
        {achievements.map((ach: any) => {
          const inst = ach.instance;
          const isCompleted = inst?.status === 'completed';
          const isClaimed = inst?.status === 'claimed';
          const isInProgress = inst?.status === 'in_progress';
          const isLocked = inst?.status === 'locked';

          // 计算总体进度
          const conditions = ach.conditions ?? [];
          const totalProgress = conditions.length > 0
            ? conditions.reduce((sum: number, c: any) => {
              const current = inst?.progress?.[c.type] ?? 0;
              return sum + Math.min(1, current / c.targetValue);
            }, 0) / conditions.length
            : 0;

          return (
            <div key={ach.id} style={{
              ...styles.achievementCard,
              opacity: isLocked ? 0.4 : 1,
            }}>
              <div style={styles.achHeader}>
                <span style={styles.achName}>{ach.name}</span>
                <span style={{
                  ...styles.achStatus,
                  color: isClaimed ? '#666' : isCompleted ? '#d4a574' : isInProgress ? '#7EC850' : '#888',
                }}>
                  {isClaimed ? '已领取' : isCompleted ? '可领取' : isInProgress ? '进行中' : '🔒'}
                </span>
              </div>
              <div style={styles.achDesc}>{ach.description}</div>
              {/* 进度条 */}
              {!isLocked && (
                <div style={styles.progressBar}>
                  <div style={{ ...styles.progressFill, width: `${totalProgress * 100}%` }} />
                </div>
              )}
              {/* 奖励信息 */}
              <div style={styles.achReward}>
                积分: {ach.rewards?.achievementPoints ?? 0}
              </div>
              {/* 领取按钮 */}
              {isCompleted && !isClaimed && (
                <button style={styles.claimBtn} onClick={() => handleClaim(ach.id)}>
                  领取奖励
                </button>
              )}
            </div>
          );
        })}
      </div>

      {achievements.length === 0 && (
        <div style={styles.empty}>暂无成就</div>
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
  summary: {
    display: 'flex', alignItems: 'center', gap: 10, padding: 10, marginBottom: 12, borderRadius: 8,
    background: 'rgba(212,165,116,0.08)', border: '1px solid rgba(212,165,116,0.2)',
  },
  summaryTitle: { fontSize: 14, fontWeight: 600, color: '#d4a574' },
  summaryPoints: { fontSize: 22, fontWeight: 700, color: '#e8e0d0' },
  claimableBadge: {
    marginLeft: 'auto', padding: '2px 8px', borderRadius: 10,
    background: 'rgba(212,165,116,0.2)', color: '#d4a574', fontSize: 11,
  },
  tabBar: { display: 'flex', gap: 3, marginBottom: 12, flexWrap: 'wrap' },
  tabBtn: {
    display: 'flex', alignItems: 'center', gap: 3, padding: '5px 8',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
    background: 'transparent', color: '#a0a0a0', fontSize: 11, cursor: 'pointer',
  },
  activeTab: { background: 'rgba(212,165,116,0.2)', color: '#d4a574', borderColor: '#d4a574' },
  tabCount: { fontSize: 9, color: '#666' },
  achievementList: { display: 'flex', flexDirection: 'column', gap: 6 },
  achievementCard: {
    padding: 10, background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
  },
  achHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  achName: { fontSize: 14, fontWeight: 600 },
  achStatus: { fontSize: 11 },
  achDesc: { fontSize: 12, color: '#888', marginTop: 3, marginBottom: 6 },
  progressBar: { height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 4 },
  progressFill: { height: '100%', borderRadius: 2, background: '#7EC850' },
  achReward: { fontSize: 11, color: '#d4a574' },
  claimBtn: {
    marginTop: 6, padding: '4px 12px', border: '1px solid rgba(212,165,116,0.3)', borderRadius: 4,
    background: 'rgba(212,165,116,0.15)', color: '#d4a574', fontSize: 11, cursor: 'pointer',
  },
  empty: { textAlign: 'center', padding: 24, color: '#666', fontSize: 13 },
};
