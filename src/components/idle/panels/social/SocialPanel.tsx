/**
 * 社交系统面板 — 好友列表、互动、聊天
 *
 * 读取引擎 FriendSystem / ChatSystem 数据。
 *
 * @module panels/social/SocialPanel
 */
import React, { useState, useMemo, useCallback } from 'react';
import SharedPanel from '@/components/idle/components/SharedPanel';

interface SocialPanelProps {
  engine: any;
  /** 是否显示面板 */
  visible?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
}

type SocialTab = 'friends' | 'chat' | 'rank';

const TABS: { id: SocialTab; label: string; icon: string }[] = [
  { id: 'friends', label: '好友', icon: '👥' },
  { id: 'chat', label: '聊天', icon: '💬' },
  { id: 'rank', label: '排行', icon: '🏆' },
];

/** 聊天子面板 */
function ChatSection({ engine, friendSystem, socialState }: { engine: any; friendSystem: any; socialState: any }) {
  const [chatInput, setChatInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const chatSystem = engine?.getChatSystem?.() ?? engine?.chatSystem;
  const messages: any[] = useMemo(() => {
    if (!chatSystem || !socialState) return [];
    try { return chatSystem.getMessages(socialState, 'WORLD') ?? []; } catch { return []; }
  }, [chatSystem, socialState]);

  const handleSend = useCallback(() => {
    if (!chatInput.trim()) return;
    try {
      if (chatSystem?.sendMessage) {
        chatSystem.sendMessage(socialState, 'WORLD', 'player', '玩家', chatInput.trim(), Date.now());
        setMessage('✅ 发送成功');
      } else {
        setMessage('⚠️ 聊天系统暂未开放');
      }
    } catch (e: any) {
      setMessage(e?.message ?? '发送失败');
    }
    setChatInput('');
    setTimeout(() => setMessage(null), 2000);
  }, [chatInput, chatSystem, socialState]);

  return (
    <div style={styles.chatContainer}>
      {message && <div style={styles.toast}>{message}</div>}
      <div style={styles.chatMessages}>
        {messages.slice(-20).map((m: any) => (
          <div key={m.id} style={styles.chatMsg}>
            <span style={styles.chatSender}>{m.senderName ?? '未知'}</span>
            <span style={styles.chatContent}>{m.content}</span>
          </div>
        ))}
        {messages.length === 0 && <div style={styles.empty}>暂无消息</div>}
      </div>
      <div style={styles.chatInputRow}>
        <input
          style={styles.chatInput}
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="输入消息..."
        />
        <button style={styles.chatSendBtn} onClick={handleSend}>发送</button>
      </div>
    </div>
  );
}

/** 排行榜子面板 */
function RankSection({ engine }: { engine: any }) {
  const leaderboardSystem = engine?.getLeaderboardSystem?.() ?? engine?.leaderboardSystem;
  const top10: any[] = useMemo(() => {
    if (!leaderboardSystem?.getTopN) return [];
    try { return leaderboardSystem.getTopN('power', 10); } catch { return []; }
  }, [leaderboardSystem]);

  if (!leaderboardSystem) {
    return <div style={styles.empty}><div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>排行榜系统暂未开放</div>;
  }

  return (
    <div style={styles.rankList}>
      {top10.map((entry: any) => (
        <div key={entry.playerId} style={{
          ...styles.rankItem,
          background: entry.rank <= 3 ? 'rgba(212,165,116,0.1)' : 'rgba(255,255,255,0.03)',
        }}>
          <span style={{
            ...styles.rankNum,
            color: entry.rank === 1 ? '#FFD700' : entry.rank === 2 ? '#C0C0C0' : entry.rank === 3 ? '#CD7F32' : '#888',
          }}>
            {entry.rank <= 3 ? ['🥇','🥈','🥉'][entry.rank - 1] : `#${entry.rank}`}
          </span>
          <span style={styles.rankName}>{entry.playerName ?? entry.playerId}</span>
          <span style={styles.rankScore}>{(entry.score ?? 0).toLocaleString()}</span>
        </div>
      ))}
      {top10.length === 0 && <div style={styles.empty}>暂无排行数据</div>}
    </div>
  );
}

export default function SocialPanel({ engine, visible = true, onClose }: SocialPanelProps) {
  const [tab, setTab] = useState<SocialTab>('friends');
  const [message, setMessage] = useState<string | null>(null);

  const friendSystem = engine?.getFriendSystem?.() ?? engine?.social?.friendSystem;
  const socialState = friendSystem?.getState?.();

  const friends: any[] = useMemo(() => {
    if (!socialState) return [];
    try {
      return friendSystem?.getFriendList?.(socialState) ?? Object.values(socialState.friends ?? {});
    } catch {
      return [];
    }
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
    <SharedPanel
      visible={visible}
      title="社交"
      icon="👥"
      onClose={onClose}
      width="520px"
    >
    <div style={styles.container} data-testid="social-panel">
      {message && <div style={styles.toast} data-testid="social-panel-toast">{message}</div>}

      {/* 概览 */}
      <div style={styles.overview} data-testid="social-panel-overview">
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
      <div style={styles.tabBar} data-testid="social-panel-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            style={{ ...styles.tabBtn, ...(tab === t.id ? styles.activeTab : {}) }}
            onClick={() => setTab(t.id)}
            data-testid={`social-panel-tab-${t.id}`}
          >{t.icon} {t.label}</button>
        ))}
      </div>

      {/* 好友列表 */}
      {tab === 'friends' && (
        <div style={styles.friendList}>
          {friends.map((f: any) => (
            <div key={f.playerId} style={styles.friendCard} data-testid={`social-panel-friend-${f.playerId}`}>
              <div style={styles.friendInfo}>
                <div style={styles.friendName}>
                  <span style={{
                    display: 'inline-block', width: 6, height: 6, borderRadius: 'var(--tk-radius-full)' as any,
                    background: f.status === 'online' ? '#7EC850' : '#666', marginRight: 6,
                  }} />
                  {f.playerName}
                </div>
                <div style={styles.friendMeta}>
                  战力 {f.power ?? 0} · {f.lastOnline ? `最后在线 ${new Date(f.lastOnline).toLocaleDateString()}` : ''}
                </div>
              </div>
              <div style={styles.friendActions}>
                <button style={styles.smallBtn} data-testid={`social-panel-gift-${f.playerId}`} onClick={() => handleGift(f.playerId)}>🎁</button>
                <button style={styles.smallBtn} data-testid={`social-panel-visit-${f.playerId}`} onClick={() => handleVisit(f.playerId)}>🏠</button>
              </div>
            </div>
          ))}
          {friends.length === 0 && <div style={styles.empty}>暂无好友</div>}
        </div>
      )}

      {/* 聊天 */}
      {tab === 'chat' && (
        <ChatSection engine={engine} friendSystem={friendSystem} socialState={socialState} />
      )}

      {/* 排行榜 */}
      {tab === 'rank' && (
        <RankSection engine={engine} />
      )}
    </div>
    </SharedPanel>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: 12, color: '#e8e0d0', minHeight: '100%' },
  toast: {
    padding: '8px 12px', marginBottom: 8, borderRadius: 'var(--tk-radius-md)' as any,
    background: 'rgba(212,165,116,0.2)', color: '#d4a574', fontSize: 12, textAlign: 'center',
  },
  overview: {
    display: 'flex', gap: 14, padding: 10, marginBottom: 10, borderRadius: 'var(--tk-radius-lg)' as any,
    background: 'rgba(212,165,116,0.08)', border: '1px solid rgba(212,165,116,0.2)',
    fontSize: 12, color: '#a0a0a0',
  },
  requestBar: {
    padding: '6px 10', marginBottom: 8, borderRadius: 'var(--tk-radius-md)' as any,
    background: 'rgba(212,165,116,0.1)', color: '#d4a574', fontSize: 12,
  },
  tabBar: { display: 'flex', gap: 4, marginBottom: 12 },
  tabBtn: {
    flex: 1, padding: '6px 8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--tk-radius-md)' as any,
    background: 'transparent', color: '#a0a0a0', fontSize: 12, cursor: 'pointer', textAlign: 'center',
  },
  activeTab: { background: 'rgba(212,165,116,0.2)', color: '#d4a574', borderColor: '#d4a574' },
  friendList: { display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', maxHeight: '60vh' },
  friendCard: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: 10, background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--tk-radius-lg)' as any,
  },
  friendInfo: { flex: 1 },
  friendName: { fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center' },
  friendMeta: { fontSize: 11, color: '#888', marginTop: 2 },
  friendActions: { display: 'flex', gap: 4 },
  smallBtn: {
    width: 30, height: 30, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--tk-radius-md)' as any,
    background: 'transparent', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  empty: { textAlign: 'center', padding: 30, color: '#666', fontSize: 13 },
  chatContainer: { display: 'flex', flexDirection: 'column', height: '50vh' },
  chatMessages: { flex: 1, overflowY: 'auto', marginBottom: 8, padding: 4 },
  chatMsg: { padding: '4px 0', fontSize: 12, display: 'flex', gap: 6 },
  chatSender: { color: '#d4a574', fontWeight: 600, whiteSpace: 'nowrap' },
  chatContent: { color: '#e8e0d0', wordBreak: 'break-all' },
  chatInputRow: { display: 'flex', gap: 6 },
  chatInput: {
    flex: 1, padding: '6px 10', borderRadius: 'var(--tk-radius-md)' as any, border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.06)', color: '#e8e0d0', fontSize: 12, outline: 'none',
  },
  chatSendBtn: {
    padding: '6px 14', borderRadius: 'var(--tk-radius-md)' as any, border: '1px solid rgba(212,165,116,0.3)',
    background: 'rgba(212,165,116,0.15)', color: '#d4a574', fontSize: 12, cursor: 'pointer',
  },
  rankList: { display: 'flex', flexDirection: 'column', gap: 4 },
  rankItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 10', borderRadius: 'var(--tk-radius-md)' as any, border: '1px solid rgba(255,255,255,0.06)',
  },
  rankNum: { width: 32, fontSize: 16, textAlign: 'center' },
  rankName: { flex: 1, fontSize: 13, fontWeight: 600 },
  rankScore: { fontSize: 12, color: '#a0a0a0' },
};
