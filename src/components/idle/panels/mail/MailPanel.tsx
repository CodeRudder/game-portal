/**
 * 邮件系统面板 — 分类Tab、邮件列表、附件领取
 *
 * 读取引擎 MailSystem 数据。
 * 已迁移至 SharedPanel 统一弹窗容器。
 * R2修复：分类色左边框、已读灰化、容量条、删除确认、资源名称翻译
 *
 * @module panels/mail/MailPanel
 */
import React, { useState, useMemo, useCallback } from 'react';
import SharedPanel from '@/components/idle/components/SharedPanel';

interface MailPanelProps {
  engine: any;
  /** 是否显示面板 */
  visible?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
}

type MailTab = 'all' | 'system' | 'battle' | 'social' | 'reward';

const MAIL_TABS: { id: MailTab; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'system', label: '系统 📜' },
  { id: 'battle', label: '战斗 ⚔️' },
  { id: 'social', label: '社交 🕊️' },
  { id: 'reward', label: '奖励 🎁' },
];

/** R2修复：分类色映射 */
const CATEGORY_COLORS: Record<string, string> = {
  system: '#C6A456',
  battle: '#B8372D',
  combat: '#B8372D',
  social: '#4A8C6F',
  reward: '#D4A843',
  trade: '#7C4DFF',
  alliance: '#42A5F5',
};

/** R2修复：资源名称翻译映射 */
const RESOURCE_NAMES: Record<string, string> = {
  gold: '💰 铜钱', grain: '🌾 粮草', wood: '🪵 木材', iron: '⛏️ 铁矿',
  exp: '⭐ 经验', recruitToken: '🎫 招贤令', gem: '💎 元宝', troops: '⚔️ 兵力',
  strengthenStone: '🧪 强化石', heroFragment: '🧩 武将碎片', equipment: '📦 装备',
};

/** 邮箱容量上限 */
const MAILBOX_CAPACITY = 100;

export default function MailPanel({ engine, visible = true, onClose }: MailPanelProps) {
  const [tab, setTab] = useState<MailTab>('all');
  const [selectedMailId, setSelectedMailId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const mailSystem = engine?.getMailSystem?.() ?? engine?.mail;

  // 获取邮件列表
  const mails = useMemo(() => {
    if (!mailSystem) return [];
    const raw = mailSystem.getMails?.({ category: tab === 'all' ? undefined : tab }) ?? [];
    return Array.isArray(raw) ? raw : raw ? Object.values(raw as Record<string, any>) : [];
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

  // R2修复：删除邮件（带确认）
  const handleDeleteMail = useCallback((id: string) => {
    if (deleteConfirmId === id) {
      // 二次确认 → 执行删除
      mailSystem?.deleteMail?.(id);
      setDeleteConfirmId(null);
      if (selectedMailId === id) setSelectedMailId(null);
      setMessage('邮件已删除');
      setTimeout(() => setMessage(null), 2000);
    } else {
      // 首次点击 → 请求确认
      setDeleteConfirmId(id);
      setTimeout(() => setDeleteConfirmId(null), 3000); // 3秒后自动取消确认
    }
  }, [mailSystem, deleteConfirmId, selectedMailId]);

  // 格式化时间
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // R2修复：获取分类色
  const getCategoryColor = (category: string, isRead: boolean) => {
    if (!isRead) return '#d4a574'; // 未读统一用古铜金
    return CATEGORY_COLORS[category] || '#444';
  };

  // R2修复：资源名称翻译
  const getResourceName = (type: string) => RESOURCE_NAMES[type] || type;

  return (
    <SharedPanel visible={visible} title="邮件" icon="📬" onClose={onClose} width="520px">
    <div data-testid="mail-panel" style={styles.container}>
      {message && <div style={styles.toast}>{message}</div>}

      {/* 操作栏 */}
      <div style={styles.actionBar}>
        <span style={styles.unreadInfo}>📬 {unreadCount} 封未读</span>
        <div style={styles.actionBtns}>
          <button style={styles.actionBtn} onClick={handleMarkAllRead} data-testid="mail-batch-read-btn">全部已读</button>
          <button style={styles.actionBtn} onClick={handleClaimAll} data-testid="mail-batch-claim-btn">一键领取</button>
        </div>
      </div>

      {/* 分类Tab */}
      <div style={styles.tabBar}>
        {MAIL_TABS.map(t => (
          <button
            key={t.id}
            style={{ ...styles.tabBtn, ...(tab === t.id ? styles.activeTab : {}) }}
            onClick={() => setTab(t.id)}
            data-testid={`mail-tab-${t.id}`}
          >{t.label}</button>
        ))}
      </div>

      {/* 邮件列表 */}
      <div style={styles.mailList} data-testid="mail-list">
        {mails.map((mail: any) => (
          <div
            key={mail.id}
            data-testid={`mail-item-${mail.id}`}
            style={{
              ...styles.mailItem,
              ...(selectedMailId === mail.id ? styles.mailItemSelected : {}),
              // R2修复：分类色左边框
              borderLeft: `3px solid ${getCategoryColor(mail.category, mail.isRead)}`,
              // R2修复：已读已领灰化效果
              opacity: mail.status === 'read_claimed' ? 0.6 : 1,
            }}
            onClick={() => handleSelectMail(mail.id)}
          >
            <div style={styles.mailHeader}>
              <span style={styles.mailTitle}>
                {!mail.isRead && <span style={{ color: '#ff4444' }}>● </span>}
                {mail.title}
              </span>
              <span style={styles.mailTime}>{formatTime(mail.sendTime)}</span>
            </div>
            <div style={styles.mailSender}>{mail.sender}</div>
            {mail.attachments?.length > 0 && !mail.attachments.every((a: any) => a.claimed) && (
              <span style={styles.attachmentBadge}>📎 有附件 ({mail.attachments.filter((a: any) => !a.claimed).length})</span>
            )}
          </div>
        ))}
      </div>

      {mails.length === 0 && <div style={styles.empty}>暂无邮件</div>}

      {/* R2修复：邮箱容量条 */}
      <div style={styles.capacityBar}>
        <div style={styles.capacityInfo}>
          <span style={{ fontSize: 10, color: '#888' }}>邮箱容量</span>
          <span style={{ fontSize: 10, color: mails.length > 80 ? '#f44336' : '#888' }}>{mails.length}/{MAILBOX_CAPACITY}</span>
        </div>
        <div style={styles.capacityTrack}>
          <div style={{
            ...styles.capacityFill,
            width: `${Math.min(100, (mails.length / MAILBOX_CAPACITY) * 100)}%`,
            background: mails.length > 80 ? '#f44336' : '#7EC850',
          }} />
        </div>
      </div>

      {/* 邮件详情 */}
      {selectedMail && (
        <div style={styles.detailOverlay} onClick={() => setSelectedMailId(null)}>
          <div style={styles.detailPanel} onClick={e => e.stopPropagation()} data-testid="mail-detail">
            <div style={styles.detailTitle}>{selectedMail.title}</div>
            <div style={styles.detailMeta}>
              {selectedMail.sender} · {formatTime(selectedMail.sendTime)}
            </div>
            <div style={styles.detailContent}>{selectedMail.content}</div>
            {selectedMail.attachments?.length > 0 && (
              <div style={styles.attachmentSection}>
                <div style={styles.attachmentLabel}>附件</div>
                {(selectedMail.attachments.map || []).map((att: any) => (
                  <div key={att.id} style={styles.attachmentItem}>
                    {/* R2修复：资源名称翻译 */}
                    <span>{getResourceName(att.resourceType)} ×{att.amount}</span>
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
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {/* R2修复：删除按钮（带确认） */}
              <button
                style={{
                  ...styles.deleteBtn,
                  ...(deleteConfirmId === selectedMail.id ? styles.deleteBtnConfirm : {}),
                }}
                onClick={() => handleDeleteMail(selectedMail.id)}
                data-testid="mail-delete-btn"
              >
                {deleteConfirmId === selectedMail.id ? '⚠️ 确认删除？' : '🗑️ 删除'}
              </button>
              <button style={styles.closeBtn} onClick={() => setSelectedMailId(null)}>关闭</button>
            </div>
          </div>
        </div>
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
  actionBar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
  },
  unreadInfo: { fontSize: 13, color: '#a0a0a0' },
  actionBtns: { display: 'flex', gap: 6 },
  actionBtn: {
    padding: '4px 10px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--tk-radius-sm)' as any,
    background: 'transparent', color: '#a0a0a0', fontSize: 11, cursor: 'pointer',
  },
  tabBar: { display: 'flex', gap: 3, marginBottom: 10 },
  tabBtn: {
    padding: '5px 10px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--tk-radius-md)' as any,
    background: 'transparent', color: '#888', fontSize: 11, cursor: 'pointer',
  },
  activeTab: { background: 'rgba(212,165,116,0.2)', color: '#d4a574', border: '1px solid #d4a574' },
  mailList: { display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto', maxHeight: '55vh' },
  mailItem: {
    padding: '8px 10px', background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)', borderRadius: 'var(--tk-radius-md)' as any, cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  mailItemSelected: { border: '1px solid #d4a574', background: 'rgba(212,165,116,0.06)' },
  mailHeader: { display: 'flex', justifyContent: 'space-between' },
  mailTitle: { fontSize: 13, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  mailTime: { fontSize: 10, color: '#666', marginLeft: 8, whiteSpace: 'nowrap' },
  mailSender: { fontSize: 11, color: '#888', marginTop: 2 },
  attachmentBadge: { fontSize: 10, color: '#d4a574', marginTop: 2 },
  empty: { textAlign: 'center', padding: 24, color: '#666', fontSize: 13 },
  // R2修复：容量条样式
  capacityBar: { marginTop: 8, padding: '4px 0' },
  capacityInfo: { display: 'flex', justifyContent: 'space-between', marginBottom: 2 },
  capacityTrack: { height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' },
  capacityFill: { height: '100%', borderRadius: 2, transition: 'width 0.3s' },
  detailOverlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 'var(--tk-z-modal)' as any,
  },
  detailPanel: {
    background: '#1a1a2e', border: '1px solid #d4a574', borderRadius: 'var(--tk-radius-xl)' as any,
    padding: 20, minWidth: 300, maxWidth: 420, color: '#e8e0d0',
  },
  detailTitle: { fontSize: 16, fontWeight: 600, marginBottom: 4 },
  detailMeta: { fontSize: 11, color: '#888', marginBottom: 12 },
  detailContent: { fontSize: 13, lineHeight: 1.6, marginBottom: 12, minHeight: 60 },
  attachmentSection: {
    padding: 10, marginBottom: 10, borderRadius: 'var(--tk-radius-md)' as any,
    background: 'rgba(212,165,116,0.06)', border: '1px solid rgba(212,165,116,0.15)',
  },
  attachmentLabel: { fontSize: 12, color: '#d4a574', marginBottom: 6 },
  attachmentItem: { display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 },
  claimBtn: {
    marginTop: 8, padding: '6px 14px', border: '1px solid rgba(212,165,116,0.3)', borderRadius: 'var(--tk-radius-md)' as any,
    background: 'rgba(212,165,116,0.15)', color: '#d4a574', fontSize: 12, cursor: 'pointer', width: '100%',
  },
  // R2修复：删除按钮样式
  deleteBtn: {
    padding: '6px 14px', border: '1px solid rgba(184,55,45,0.3)', borderRadius: 'var(--tk-radius-md)' as any,
    background: 'transparent', color: '#B8372D', fontSize: 12, cursor: 'pointer',
  },
  deleteBtnConfirm: {
    background: 'rgba(184,55,45,0.2)', fontWeight: 600,
  },
  closeBtn: {
    display: 'block', margin: '0 auto', padding: '6px 20px',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--tk-radius-md)' as any,
    background: 'transparent', color: '#a0a0a0', cursor: 'pointer', flex: 1,
  },
};
