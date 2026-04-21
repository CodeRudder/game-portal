/**
 * 传承系统面板 — 武将/装备/经验传承、转生加速
 *
 * 读取引擎 HeritageSystem 数据。
 *
 * @module panels/heritage/HeritagePanel
 */
import React, { useState, useMemo, useCallback } from 'react';

interface HeritagePanelProps {
  engine: any;
}

type HeritageTab = 'hero' | 'equipment' | 'experience' | 'acceleration';

const TABS: { id: HeritageTab; label: string; icon: string }[] = [
  { id: 'hero', label: '武将传承', icon: '⚔️' },
  { id: 'equipment', label: '装备传承', icon: '🛡️' },
  { id: 'experience', label: '经验传承', icon: '✨' },
  { id: 'acceleration', label: '转生加速', icon: '🚀' },
];

export default function HeritagePanel({ engine }: HeritagePanelProps) {
  const [tab, setTab] = useState<HeritageTab>('hero');
  const [message, setMessage] = useState<string | null>(null);

  const heritageSystem = engine?.getHeritageSystem?.() ?? engine?.heritage;
  const state = heritageSystem?.getState?.();
  const accelState = heritageSystem?.getAccelerationState?.();

  // 传承统计
  const heroCount = state?.heroHeritageCount ?? 0;
  const equipCount = state?.equipmentHeritageCount ?? 0;
  const expCount = state?.experienceHeritageCount ?? 0;
  const dailyCount = state?.dailyHeritageCount ?? 0;
  const dailyLimit = 3; // DAILY_HERITAGE_LIMIT

  // 转生解锁
  const rebirthUnlocks = heritageSystem?.getRebirthUnlocks?.() ?? [];

  // 领取初始资源
  const handleClaimGift = useCallback(() => {
    const result = heritageSystem?.claimInitialGift?.();
    setMessage(result?.success ? `🎉 获得初始资源！` : result?.reason ?? '领取失败');
    setTimeout(() => setMessage(null), 2000);
  }, [heritageSystem]);

  // 一键重建
  const handleRebuild = useCallback(() => {
    const result = heritageSystem?.executeRebuild?.();
    setMessage(result?.success ? `🏗️ 重建完成！升级了${result.upgradedBuildings.length}座建筑` : result?.reason ?? '重建失败');
    setTimeout(() => setMessage(null), 2000);
  }, [heritageSystem]);

  return (
    <div style={styles.container}>
      {message && <div style={styles.toast}>{message}</div>}

      {/* 统计概览 */}
      <div style={styles.overview}>
        <div style={styles.statItem}>
          <span style={styles.statValue}>{heroCount}</span>
          <span style={styles.statLabel}>武将传承</span>
        </div>
        <div style={styles.statItem}>
          <span style={styles.statValue}>{equipCount}</span>
          <span style={styles.statLabel}>装备传承</span>
        </div>
        <div style={styles.statItem}>
          <span style={styles.statValue}>{expCount}</span>
          <span style={styles.statLabel}>经验传承</span>
        </div>
        <div style={styles.statItem}>
          <span style={{ ...styles.statValue, color: dailyCount >= dailyLimit ? '#ff6464' : '#7EC850' }}>
            {dailyCount}/{dailyLimit}
          </span>
          <span style={styles.statLabel}>今日次数</span>
        </div>
      </div>

      {/* Tab栏 */}
      <div style={styles.tabBar}>
        {TABS.map(t => (
          <button
            key={t.id}
            style={{ ...styles.tabBtn, ...(tab === t.id ? styles.activeTab : {}) }}
            onClick={() => setTab(t.id)}
          >{t.icon} {t.label}</button>
        ))}
      </div>

      {/* 传承Tab内容 */}
      {(tab === 'hero' || tab === 'equipment' || tab === 'experience') && (
        <div style={styles.placeholder}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>
            {tab === 'hero' ? '⚔️' : tab === 'equipment' ? '🛡️' : '✨'}
          </div>
          <div style={{ color: '#a0a0a0', marginBottom: 8 }}>
            {tab === 'hero' ? '选择源武将和目标武将进行传承' :
              tab === 'equipment' ? '选择源装备和目标装备进行传承' :
                '选择源武将和目标武将进行经验传承'}
          </div>
          {/* TODO: 完整的传承操作UI — 需要选择源/目标武将或装备 */}
          <div style={{ color: '#666', fontSize: 12 }}>
            请在武将/装备面板中选择传承对象
          </div>
        </div>
      )}

      {/* 转生加速 */}
      {tab === 'acceleration' && (
        <div style={styles.accelSection}>
          {/* 初始资源 */}
          <div style={styles.accelCard}>
            <div style={styles.accelTitle}>🎁 转生初始资源</div>
            <div style={styles.accelDesc}>转生后可获得初始资源赠送</div>
            <button
              style={{ ...styles.accelBtn, ...(accelState?.initialGiftClaimed ? styles.accelBtnDone : {}) }}
              disabled={accelState?.initialGiftClaimed}
              onClick={handleClaimGift}
            >
              {accelState?.initialGiftClaimed ? '已领取' : '领取'}
            </button>
          </div>

          {/* 一键重建 */}
          <div style={styles.accelCard}>
            <div style={styles.accelTitle}>🏗️ 一键重建</div>
            <div style={styles.accelDesc}>按优先级自动升级建筑</div>
            <button
              style={{ ...styles.accelBtn, ...(accelState?.rebuildCompleted ? styles.accelBtnDone : {}) }}
              disabled={accelState?.rebuildCompleted}
              onClick={handleRebuild}
            >
              {accelState?.rebuildCompleted ? '已重建' : '重建'}
            </button>
          </div>

          {/* 转生解锁 */}
          {rebirthUnlocks.length > 0 && (
            <div style={styles.unlockSection}>
              <div style={styles.sectionHeader}>🔓 转生次数解锁</div>
              {rebirthUnlocks.map((u: any) => (
                <div key={u.unlockId} style={{
                  ...styles.unlockItem,
                  opacity: u.unlocked ? 1 : 0.5,
                }}>
                  <span>{u.unlocked ? '✅' : '🔒'} {u.description}</span>
                  <span style={{ fontSize: 11, color: '#888' }}>转生{u.rebirthCount}次</span>
                </div>
              ))}
            </div>
          )}
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
  overview: {
    display: 'flex', gap: 8, padding: 10, marginBottom: 12, borderRadius: 8,
    background: 'rgba(212,165,116,0.08)', border: '1px solid rgba(212,165,116,0.2)',
  },
  statItem: { flex: 1, textAlign: 'center' },
  statValue: { display: 'block', fontSize: 18, fontWeight: 700, color: '#e8e0d0' },
  statLabel: { display: 'block', fontSize: 10, color: '#888', marginTop: 2 },
  tabBar: { display: 'flex', gap: 3, marginBottom: 12, flexWrap: 'wrap' },
  tabBtn: {
    padding: '5px 8px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
    background: 'transparent', color: '#888', fontSize: 11, cursor: 'pointer',
  },
  activeTab: { background: 'rgba(212,165,116,0.2)', color: '#d4a574', borderColor: '#d4a574' },
  placeholder: {
    padding: 30, textAlign: 'center', borderRadius: 8,
    background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.08)',
  },
  accelSection: { display: 'flex', flexDirection: 'column', gap: 8 },
  accelCard: {
    padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(212,165,116,0.15)',
  },
  accelTitle: { fontSize: 14, fontWeight: 600, color: '#d4a574', marginBottom: 4 },
  accelDesc: { fontSize: 12, color: '#888', marginBottom: 8 },
  accelBtn: {
    padding: '6px 16px', border: '1px solid rgba(212,165,116,0.3)', borderRadius: 6,
    background: 'rgba(212,165,116,0.15)', color: '#d4a574', fontSize: 12, cursor: 'pointer',
  },
  accelBtnDone: { background: 'transparent', color: '#666', borderColor: 'rgba(255,255,255,0.06)', cursor: 'default' },
  unlockSection: { marginTop: 8 },
  sectionHeader: { fontSize: 14, fontWeight: 600, color: '#d4a574', marginBottom: 8 },
  unlockItem: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 10', marginBottom: 4, background: 'rgba(255,255,255,0.03)', borderRadius: 6, fontSize: 13,
  },
};
