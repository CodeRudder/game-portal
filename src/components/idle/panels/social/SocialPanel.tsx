/**
 * 社交系统面板 — 好友列表、互动、聊天
 *
 * 读取引擎 FriendSystem / ChatSystem 数据。
 *
 * @module panels/social/SocialPanel
 */
import React, { useState, useMemo, useCallback } from 'react';

interface SocialPanelProps {
  engine: any;
}

type SocialTab = 'friends' | 'chat' | 'rank';

const TABS: { id: SocialTab; label: string; icon: string }[] = [
  { id: 'friends', label: '好友', icon: '👥' },
  { id: 'chat', label: '聊天', icon: '💬' },
  { id: 'rank', label: '排行', icon: '🏆' },
];

export default function SocialPanel({ engine }: SocialPanelProps) {
  const [tab, setTab] = useState<SocialTab>('friends');
  const [message, setMessage] = useState<string | null>(null);

  const friendSystem = engine?.getFriendSystem?.() ?? engine?.social?.friendSystem;
  const socialState = friendSystem?.getState?.();

  const friends: any[] = useMemo(() => {
    if (!socialState) return [];
    return friendSystem?.getFriendList?.(socialState) ?? Object.values(socialState.friends ?? {});
  }, [friendSystem, socialState]);

  const onlineFriends = useMemo(
    () => friends.filter((f: any) => f.status === 'online'),
    [friends],
  );
  const friendshipPoints = socialState?.friendshipPoints ?? 0;
  const pendingRequests: any[] = socialState?.pendingRequests ?? [];

  // 互动操作
  const handleGift = useCallback((friendId: string) => {
    try {
      const result = friendSystem?.giftTroops?.(socialState, friendId, Date.now());
      setMessage(result ? `🎁 赠送成功！友情+${result.friendshipEarned}` : '赠送失败');
    } catch (e: any) {
      setMessage(e?.message ?? '操作失败');
    }
    setTimeout(() => setMessage(null), 2000);
  }, [friendSystem, socialState]);

  const handleVisit = useCallback((friendId: string) => {
    try {
      const result = friendSystem?.visitCastle?.(socialState, friendId, Date.now());
      setMessage(result ? `🏠 拜访成功！获得${result.copperReward}铜钱` : '拜访失败');
    } catch (e: any) {
      setMessage(e?.message ?? '操作失败');
    }
    setTimeout(() => setMessage(null), 2000);
  }, [friendSystem, socialState]);

  return (
    <div style={styles.container}>
      {message && <div style={styles.toast}>{message}</div>}

      {/* 概览 */}
      <div style={styles.overview}>
        <span>👥 好友 {friends.length}</span>
        <span>🟢 在线 {onlineFriends.length}</span>
        <span>💎 友情点 {friendshipPoints}</span>
      </div>

      {/* 待处理申请 */}
      {pendingRequests.length > 0 && (
        <div style={styles.requestBar}>
          📬 {pendingRequests.length} 条好友申请待处理
        </div>
      )}

      {/* Tab */}
      <div style={styles.tabBar}>
        {TABS.map(t => (
          <button
            key={t.id}
            style={{ ...styles.tabBtn, ...(tab === t.id ? styles.activeTab : {}) }}
            onClick={() => setTab(t.id)}
          >{t.icon} {t.label}</button>
        ))}
      </div>

      {/* 好友列表 */}
      {tab === 'friends' && (
        <div style={styles.friendList}>
          {friends.map((f: any) => (
            <div key={f.playerId} style={styles.friendCard}>
              <div style={styles.friendInfo}>
                <div style={styles.friendName}>
                  <span style={{
                    display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                    background: f.status === 'online' ? '#7EC850' : '#666', marginRight: 6,
                  }} />
                  {f.playerName}
                </div>
                <div style={styles.friendMeta}>
                  战力 {f.power ?? 0} · {f.lastOnline ? `最后在线 ${new Date(f.lastOnline).toLocaleDateString()}` : ''}
                </div>
              </div>
              <div style={styles.friendActions}>
                <button style={styles.smallBtn} onClick={() => handleGift(f.playerId)}>🎁</button>
                <button style={styles.smallBtn} onClick={() => handleVisit(f.playerId)}>🏠</button>
              </div>
            </div>
          ))}
          {friends.length === 0 && <div style={styles.empty}>暂无好友</div>}
        </div>
      )}

      {/* 聊天 */}
      {tab === 'chat' && (
        <div style={styles.empty}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
          聊天功能开发中
          {/* TODO: 对接 ChatSystem */}
        </div>
      )}

      {/* 排行榜 */}
      {tab === 'rank' && (
        <div style={styles.empty}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
          排行榜功能开发中
          {/* TODO: 对接 LeaderboardSystem */}
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
    display: 'flex', gap: 14, padding: 10, marginBottom: 10, borderRadius: 8,
    background: 'rgba(212,165,116,0.08)', border: '1px solid rgba(212,165,116,0.2)',
    fontSize: 12, color: '#a0a0a0',
  },
  requestBar: {
    padding: '6px 10', marginBottom: 8, borderRadius: 6,
    background: 'rgba(212,165,116,0.1)', color: '#d4a574', fontSize: 12,
  },
  tabBar: { display: 'flex', gap: 4, marginBottom: 12 },
  tabBtn: {
    flex: 1, padding: '6px 8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
    background: 'transparent', color: '#a0a0a0', fontSize: 12, cursor: 'pointer', textAlign: 'center',
  },
  activeTab: { background: 'rgba(212,165,116,0.2)', color: '#d4a574', borderColor: '#d4a574' },
  friendList: { display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', maxHeight: '60vh' },
  friendCard: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: 10, background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
  },
  friendInfo: { flex: 1 },
  friendName: { fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center' },
  friendMeta: { fontSize: 11, color: '#888', marginTop: 2 },
  friendActions: { display: 'flex', gap: 4 },
  smallBtn: {
    width: 30, height: 30, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
    background: 'transparent', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  empty: { textAlign: 'center', padding: 30, color: '#666', fontSize: 13 },
};
