/**
 * 声望系统面板 — 声望等级、产出加成、等级奖励
 *
 * 读取引擎 PrestigeSystem 数据。
 *
 * @module panels/prestige/PrestigePanel
 */
import React, { useState, useMemo, useCallback } from 'react';

interface PrestigePanelProps {
  engine: any;
}

export default function PrestigePanel({ engine }: PrestigePanelProps) {
  const [message, setMessage] = useState<string | null>(null);

  const prestigeSystem = engine?.getPrestigeSystem?.() ?? engine?.prestige;
  const panel = prestigeSystem?.getPrestigePanel?.();
  const levelInfo = prestigeSystem?.getCurrentLevelInfo?.();
  const levelRewards = prestigeSystem?.getLevelRewards?.() ?? [];
  const sourceConfigs = prestigeSystem?.getSourceConfigs?.() ?? [];

  const currentLevel = panel?.currentLevel ?? 1;
  const currentPoints = panel?.currentPoints ?? 0;
  const nextLevelPoints = panel?.nextLevelPoints ?? 0;
  const productionBonus = panel?.productionBonus ?? 1.0;
  const title = levelInfo?.title ?? '布衣';

  // 进度百分比
  const prevLevelPoints = currentLevel > 1 ? levelInfo?.requiredPoints ?? 0 : 0;
  const progressPercent = nextLevelPoints > prevLevelPoints
    ? Math.min(100, ((currentPoints - prevLevelPoints) / (nextLevelPoints - prevLevelPoints)) * 100)
    : 100;

  // 领取等级奖励
  const handleClaimReward = useCallback((level: number) => {
    const result = prestigeSystem?.claimLevelReward?.(level);
    if (result?.success) {
      setMessage('🎉 奖励已领取！');
    } else {
      setMessage(result?.reason ?? '领取失败');
    }
    setTimeout(() => setMessage(null), 2000);
  }, [prestigeSystem]);

  return (
    <div style={styles.container}>
      {message && <div style={styles.toast}>{message}</div>}

      {/* 声望等级卡片 */}
      <div style={styles.levelCard}>
        <div style={styles.levelBadge}>🏅 {title}</div>
        <div style={styles.levelNumber}>Lv.{currentLevel}</div>
        <div style={styles.bonusText}>产出加成 ×{productionBonus.toFixed(2)}</div>

        {/* 进度条 */}
        <div style={styles.progressBar}>
          <div style={{ ...styles.progressFill, width: `${progressPercent}%` }} />
        </div>
        <div style={styles.progressText}>
          {currentPoints} / {nextLevelPoints} 声望
        </div>
      </div>

      {/* 声望获取途径 */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>📊 获取途径</div>
        <div style={styles.sourceList}>
          {sourceConfigs.map((cfg: any, i: number) => (
            <div key={i} style={styles.sourceItem}>
              <span style={styles.sourceName}>{cfg.label ?? cfg.type}</span>
              <span style={styles.sourceCap}>
                每日上限: {cfg.dailyCap > 0 ? cfg.dailyCap : '无限制'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 等级奖励 */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>🎁 等级奖励</div>
        <div style={styles.rewardList}>
          {levelRewards.map((reward: any) => (
            <div key={reward.level} style={styles.rewardItem}>
              <div style={styles.rewardLevel}>
                <span>Lv.{reward.level}</span>
                {reward.level <= currentLevel && (
                  <span style={{ color: '#7EC850', fontSize: 11 }}>✓ 已达成</span>
                )}
              </div>
              <div style={styles.rewardDesc}>
                {reward.description ?? `声望等级${reward.level}奖励`}
              </div>
              <button
                style={{
                  ...styles.claimBtn,
                  ...(reward.claimed ? styles.claimedBtn : {}),
                  ...(reward.level > currentLevel ? styles.lockedBtn : {}),
                }}
                disabled={reward.claimed || reward.level > currentLevel}
                onClick={() => !reward.claimed && handleClaimReward(reward.level)}
              >
                {reward.claimed ? '已领取' : reward.level > currentLevel ? '未解锁' : '领取'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: 12, color: '#e8e0d0', minHeight: '100%' },
  toast: {
    padding: '8px 12px', marginBottom: 8, borderRadius: 6,
    background: 'rgba(212,165,116,0.2)', color: '#d4a574', fontSize: 12, textAlign: 'center',
  },
  levelCard: {
    padding: 16, marginBottom: 16, borderRadius: 10, textAlign: 'center',
    background: 'linear-gradient(135deg, rgba(212,165,116,0.12), rgba(212,165,116,0.04))',
    border: '1px solid rgba(212,165,116,0.25)',
  },
  levelBadge: { fontSize: 20, fontWeight: 600, color: '#d4a574' },
  levelNumber: { fontSize: 28, fontWeight: 700, color: '#e8e0d0', margin: '6px 0' },
  bonusText: { fontSize: 13, color: '#7EC850', marginBottom: 12 },
  progressBar: {
    height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 4,
  },
  progressFill: { height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, #d4a574, #e8c49a)' },
  progressText: { fontSize: 11, color: '#a0a0a0' },
  section: { marginBottom: 16 },
  sectionHeader: { fontSize: 14, fontWeight: 600, color: '#d4a574', marginBottom: 8 },
  sourceList: { display: 'flex', flexDirection: 'column', gap: 4 },
  sourceItem: {
    display: 'flex', justifyContent: 'space-between', padding: '6px 10',
    background: 'rgba(255,255,255,0.03)', borderRadius: 6, fontSize: 12,
  },
  sourceName: { color: '#e8e0d0' },
  sourceCap: { color: '#888' },
  rewardList: { display: 'flex', flexDirection: 'column', gap: 6 },
  rewardItem: {
    display: 'flex', alignItems: 'center', gap: 8, padding: 10,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8,
  },
  rewardLevel: { fontSize: 13, fontWeight: 600, width: 60, display: 'flex', flexDirection: 'column', gap: 2 },
  rewardDesc: { flex: 1, fontSize: 12, color: '#a0a0a0' },
  claimBtn: {
    padding: '4px 12px', border: '1px solid rgba(212,165,116,0.3)', borderRadius: 4,
    background: 'rgba(212,165,116,0.15)', color: '#d4a574', fontSize: 11, cursor: 'pointer',
  },
  claimedBtn: { background: 'transparent', color: '#666', borderColor: 'rgba(255,255,255,0.06)', cursor: 'default' },
  lockedBtn: { background: 'transparent', color: '#444', borderColor: 'rgba(255,255,255,0.04)', cursor: 'default' },
};
