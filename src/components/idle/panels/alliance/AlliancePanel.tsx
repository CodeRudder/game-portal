/**
 * 联盟系统面板 — 联盟信息、成员列表、公告
 *
 * 读取引擎 AllianceSystem 数据。
 *
 * @module panels/alliance/AlliancePanel
 */
import React, { useState, useMemo, useCallback } from 'react';

interface AlliancePanelProps {
  engine: any;
}

export default function AlliancePanel({ engine }: AlliancePanelProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<'info' | 'members' | 'announce'>('info');

  const allianceSystem = engine?.getAllianceSystem?.() ?? engine?.alliance;
  const alliance: any = allianceSystem?.getAlliance?.() ?? null;
  const playerState: any = allianceSystem?.getPlayerState?.() ?? null;

  const isInAlliance = !!playerState?.allianceId;
  const members: any[] = alliance ? Object.values(alliance.members ?? {}) : [];
  const announcements: any[] = alliance?.announcements ?? [];
  const bonuses = alliance ? allianceSystem?.getBonuses?.(alliance) : null;

  const handleCreateAlliance = useCallback(() => {
    const name = prompt('输入联盟名称（2-8字）:');
    if (!name) return;
    try {
      // TODO: 调用引擎创建联盟 — 需传入playerId/playerName
      setMessage(`联盟「${name}」创建成功！`);
    } catch (e: any) {
      setMessage(e?.message ?? '创建失败');
    }
    setTimeout(() => setMessage(null), 3000);
  }, []);

  if (!isInAlliance) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 12 }}>🏰</div>
          <div style={{ textAlign: 'center', color: '#a0a0a0', marginBottom: 16 }}>
            你尚未加入联盟
          </div>
          <button style={styles.createBtn} onClick={handleCreateAlliance}>
            创建联盟
          </button>
          {/* TODO: 搜索/申请加入联盟 */}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {message && <div style={styles.toast}>{message}</div>}

      {/* 联盟信息 */}
      <div style={styles.allianceHeader}>
        <div style={styles.allianceName}>{alliance?.name ?? '联盟'}</div>
        <div style={styles.allianceMeta}>
          Lv.{alliance?.level ?? 1} · 成员 {members.length}/{allianceSystem?.getMaxMembers?.(alliance?.level ?? 1) ?? 20}
        </div>
        {bonuses && (
          <div style={styles.bonusRow}>
            <span>资源加成 +{bonuses.resourceBonus}%</span>
            <span>远征加成 +{bonuses.expeditionBonus}%</span>
          </div>
        )}
      </div>

      {/* Tab栏 */}
      <div style={styles.tabBar}>
        {(['info', 'members', 'announce'] as const).map(t => (
          <button
            key={t}
            style={{ ...styles.tabBtn, ...(tab === t ? styles.activeTab : {}) }}
            onClick={() => setTab(t)}
          >
            {{ info: '📋 信息', members: '👥 成员', announce: '📢 公告' }[t]}
          </button>
        ))}
      </div>

      {/* Tab内容 */}
      {tab === 'info' && (
        <div style={styles.infoSection}>
          <div style={styles.infoLabel}>宣言</div>
          <div style={styles.infoValue}>{alliance?.declaration ?? '暂无宣言'}</div>
          <div style={styles.infoLabel}>经验</div>
          <div style={styles.infoValue}>{alliance?.experience ?? 0} EXP</div>
        </div>
      )}

      {tab === 'members' && (
        <div style={styles.memberList}>
          {members.map((m: any) => (
            <div key={m.playerId} style={styles.memberItem}>
              <span style={styles.memberName}>{m.playerName}</span>
              <span style={{
                ...styles.memberRole,
                color: m.role === 'LEADER' ? '#d4a574' : m.role === 'ADVISOR' ? '#7EC850' : '#a0a0a0',
              }}>
                {{ LEADER: '盟主', ADVISOR: '军师', MEMBER: '成员' }[m.role] ?? m.role}
              </span>
              <span style={styles.memberPower}>战力 {m.power ?? 0}</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'announce' && (
        <div style={styles.announceList}>
          {announcements.length > 0 ? announcements.map((a: any) => (
            <div key={a.id} style={styles.announceItem}>
              <div style={styles.announceAuthor}>{a.authorName} {a.pinned ? '📌' : ''}</div>
              <div style={styles.announceContent}>{a.content}</div>
            </div>
          )) : (
            <div style={styles.empty}>暂无公告</div>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: 12, color: '#e8e0d0', minHeight: '100%' },
  emptyState: { padding: '40px 20px', textAlign: 'center' },
  createBtn: {
    padding: '10px 24px', border: '1px solid rgba(212,165,116,0.3)', borderRadius: 8,
    background: 'rgba(212,165,116,0.15)', color: '#d4a574', fontSize: 14, cursor: 'pointer',
  },
  toast: {
    padding: '8px 12px', marginBottom: 8, borderRadius: 6,
    background: 'rgba(212,165,116,0.2)', color: '#d4a574', fontSize: 12, textAlign: 'center',
  },
  allianceHeader: {
    padding: 12, marginBottom: 12, borderRadius: 8,
    background: 'rgba(212,165,116,0.08)', border: '1px solid rgba(212,165,116,0.2)',
  },
  allianceName: { fontSize: 18, fontWeight: 600, color: '#d4a574' },
  allianceMeta: { fontSize: 12, color: '#a0a0a0', marginTop: 4 },
  bonusRow: { display: 'flex', gap: 16, fontSize: 12, color: '#7EC850', marginTop: 6 },
  tabBar: { display: 'flex', gap: 4, marginBottom: 12 },
  tabBtn: {
    flex: 1, padding: '6px 8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
    background: 'transparent', color: '#a0a0a0', fontSize: 12, cursor: 'pointer', textAlign: 'center',
  },
  activeTab: { background: 'rgba(212,165,116,0.2)', color: '#d4a574', borderColor: '#d4a574' },
  infoSection: { padding: 8 },
  infoLabel: { fontSize: 12, color: '#d4a574', marginBottom: 2, marginTop: 8 },
  infoValue: { fontSize: 13, color: '#e8e0d0' },
  memberList: { display: 'flex', flexDirection: 'column', gap: 4 },
  memberItem: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10',
    background: 'rgba(255,255,255,0.04)', borderRadius: 6, fontSize: 13,
  },
  memberName: { flex: 1, fontWeight: 600 },
  memberRole: { fontSize: 11 },
  memberPower: { fontSize: 11, color: '#888' },
  announceList: { display: 'flex', flexDirection: 'column', gap: 6 },
  announceItem: {
    padding: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.06)',
  },
  announceAuthor: { fontSize: 12, color: '#d4a574', marginBottom: 4 },
  announceContent: { fontSize: 13, color: '#e8e0d0' },
  empty: { textAlign: 'center', padding: 20, color: '#666', fontSize: 13 },
};
