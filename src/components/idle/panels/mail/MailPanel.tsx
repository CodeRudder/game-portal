/**
 * 邮件系统面板 — 分类Tab、邮件列表、附件领取
 *
 * 读取引擎 MailSystem 数据。
 *
 * @module panels/mail/MailPanel
 */
import React, { useState, useMemo, useCallback } from 'react';

interface MailPanelProps {
  engine: any;
}

type MailTab = 'all' | 'system' | 'battle' | 'social' | 'reward';

const MAIL_TABS: { id: MailTab; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'system', label: '系统' },
  { id: 'battle', label: '战斗' },
  { id: 'social', label: '社交' },
  { id: 'reward', label: '奖励' },
];

export default function MailPanel({ engine }: MailPanelProps) {
  const [tab, setTab] = useState<MailTab>('all');
  const [selectedMailId, setSelectedMailId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const mailSystem = engine?.getMailSystem?.() ?? engine?.mail;

  // 获取邮件列表
  const mails = useMemo(() => {
    if (!mailSystem) return [];
    return mailSystem.getMails?.({ category: tab === 'all' ? undefined : tab }) ?? [];
  }, [mailSystem, tab]);

  // 未读数
  const unreadCount = mailSystem?.getUnreadCount?.() ?? 0;

  // 选中邮件
  const selectedMail = selectedMailId ? mailSystem?.getMail?.(selectedMailId) : null;

  // 标记已读
  const handleSelectMail = useCallback((id: string) => {
    mailSystem?.markRead?.(id);
    setSelectedMailId(id);
  }, [mailSystem]);

  // 领取附件
  const handleClaimAttachments = useCallback((id: string) => {
    const claimed = mailSystem?.claimAttachments?.(id);
    if (claimed && Object.keys(claimed).length > 0) {
      setMessage('🎉 附件已领取！');
    }
    setTimeout(() => setMessage(null), 2000);
  }, [mailSystem]);

  // 一键领取全部
  const handleClaimAll = useCallback(() => {
    const result = mailSystem?.claimAllAttachments?.();
    if (result && result.count > 0) {
      setMessage(`🎉 领取了${result.count}封邮件的附件`);
    } else {
      setMessage('无可领取附件');
    }
    setTimeout(() => setMessage(null), 2000);
  }, [mailSystem]);

  // 一键已读
  const handleMarkAllRead = useCallback(() => {
    const count = mailSystem?.markAllRead?.();
    setMessage(`已读 ${count ?? 0} 封邮件`);
    setTimeout(() => setMessage(null), 2000);
  }, [mailSystem]);

  // 格式化时间
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div style={styles.container}>
      {message && <div style={styles.toast}>{message}</div>}

      {/* 操作栏 */}
      <div style={styles.actionBar}>
        <span style={styles.unreadInfo}>📬 {unreadCount} 封未读</span>
        <div style={styles.actionBtns}>
          <button style={styles.actionBtn} onClick={handleMarkAllRead}>全部已读</button>
          <button style={styles.actionBtn} onClick={handleClaimAll}>一键领取</button>
        </div>
      </div>

      {/* 分类Tab */}
      <div style={styles.tabBar}>
        {MAIL_TABS.map(t => (
          <button
            key={t.id}
            style={{ ...styles.tabBtn, ...(tab === t.id ? styles.activeTab : {}) }}
            onClick={() => setTab(t.id)}
          >{t.label}</button>
        ))}
      </div>

      {/* 邮件列表 */}
      <div style={styles.mailList}>
        {mails.map((mail: any) => (
          <div
            key={mail.id}
            style={{
              ...styles.mailItem,
              ...(selectedMailId === mail.id ? styles.mailItemSelected : {}),
              ...(mail.status === 'unread' ? { borderLeft: '3px solid #d4a574' } : {}),
            }}
            onClick={() => handleSelectMail(mail.id)}
          >
            <div style={styles.mailHeader}>
              <span style={styles.mailTitle}>
                {!mail.isRead && <span style={{ color: '#d4a574' }}>● </span>}
                {mail.title}
              </span>
              <span style={styles.mailTime}>{formatTime(mail.sendTime)}</span>
            </div>
            <div style={styles.mailSender}>{mail.sender}</div>
            {mail.attachments?.length > 0 && !mail.attachments.every((a: any) => a.claimed) && (
              <span style={styles.attachmentBadge}>📎 有附件</span>
            )}
          </div>
        ))}
      </div>

      {mails.length === 0 && <div style={styles.empty}>暂无邮件</div>}

      {/* 邮件详情 */}
      {selectedMail && (
        <div style={styles.detailOverlay} onClick={() => setSelectedMailId(null)}>
          <div style={styles.detailPanel} onClick={e => e.stopPropagation()}>
            <div style={styles.detailTitle}>{selectedMail.title}</div>
            <div style={styles.detailMeta}>
              {selectedMail.sender} · {formatTime(selectedMail.sendTime)}
            </div>
            <div style={styles.detailContent}>{selectedMail.content}</div>
            {selectedMail.attachments?.length > 0 && (
              <div style={styles.attachmentSection}>
                <div style={styles.attachmentLabel}>附件</div>
                {selectedMail.attachments.map((att: any) => (
                  <div key={att.id} style={styles.attachmentItem}>
                    <span>{att.resourceType}: {att.amount}</span>
                    <span>{att.claimed ? '✅' : '未领取'}</span>
                  </div>
                ))}
                {!selectedMail.attachments.every((a: any) => a.claimed) && (
                  <button style={styles.claimBtn} onClick={() => handleClaimAttachments(selectedMail.id)}>
                    领取附件
                  </button>
                )}
              </div>
            )}
            <button style={styles.closeBtn} onClick={() => setSelectedMailId(null)}>关闭</button>
          </div>
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
  actionBar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
  },
  unreadInfo: { fontSize: 13, color: '#a0a0a0' },
  actionBtns: { display: 'flex', gap: 6 },
  actionBtn: {
    padding: '4px 10px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4,
    background: 'transparent', color: '#a0a0a0', fontSize: 11, cursor: 'pointer',
  },
  tabBar: { display: 'flex', gap: 3, marginBottom: 10 },
  tabBtn: {
    padding: '5px 10px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
    background: 'transparent', color: '#888', fontSize: 11, cursor: 'pointer',
  },
  activeTab: { background: 'rgba(212,165,116,0.2)', color: '#d4a574', borderColor: '#d4a574' },
  mailList: { display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto', maxHeight: '60vh' },
  mailItem: {
    padding: '8px 10', background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, cursor: 'pointer',
  },
  mailItemSelected: { borderColor: '#d4a574', background: 'rgba(212,165,116,0.06)' },
  mailHeader: { display: 'flex', justifyContent: 'space-between' },
  mailTitle: { fontSize: 13, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  mailTime: { fontSize: 10, color: '#666', marginLeft: 8, whiteSpace: 'nowrap' },
  mailSender: { fontSize: 11, color: '#888', marginTop: 2 },
  attachmentBadge: { fontSize: 10, color: '#d4a574', marginTop: 2 },
  empty: { textAlign: 'center', padding: 24, color: '#666', fontSize: 13 },
  detailOverlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 'var(--tk-z-modal)' as any,
  },
  detailPanel: {
    background: '#1a1a2e', border: '1px solid #d4a574', borderRadius: 12,
    padding: 20, minWidth: 300, maxWidth: 420, color: '#e8e0d0',
  },
  detailTitle: { fontSize: 16, fontWeight: 600, marginBottom: 4 },
  detailMeta: { fontSize: 11, color: '#888', marginBottom: 12 },
  detailContent: { fontSize: 13, lineHeight: 1.6, marginBottom: 12 },
  attachmentSection: {
    padding: 10, marginBottom: 10, borderRadius: 6,
    background: 'rgba(212,165,116,0.06)', border: '1px solid rgba(212,165,116,0.15)',
  },
  attachmentLabel: { fontSize: 12, color: '#d4a574', marginBottom: 6 },
  attachmentItem: { display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 },
  claimBtn: {
    marginTop: 8, padding: '6px 14px', border: '1px solid rgba(212,165,116,0.3)', borderRadius: 6,
    background: 'rgba(212,165,116,0.15)', color: '#d4a574', fontSize: 12, cursor: 'pointer', width: '100%',
  },
  closeBtn: {
    display: 'block', margin: '0 auto', padding: '6px 20px',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
    background: 'transparent', color: '#a0a0a0', cursor: 'pointer',
  },
};
