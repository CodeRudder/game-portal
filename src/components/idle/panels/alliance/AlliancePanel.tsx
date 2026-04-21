/**
 * 联盟系统面板 — 联盟信息、成员列表、联盟任务、加入/退出
 *
 * 读取引擎 AllianceSystem / AllianceTaskSystem 数据。
 *
 * @module panels/alliance/AlliancePanel
 */
import React, { useState, useCallback } from 'react';

interface AlliancePanelProps {
  engine: any;
}

type AllianceTab = 'info' | 'members' | 'tasks';

export default function AlliancePanel({ engine }: AlliancePanelProps) {
  const [tab, setTab] = useState<AllianceTab>('info');
  const [message, setMessage] = useState<string | null>(null);
  const [allianceName, setAllianceName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const allianceSystem = engine?.getAllianceSystem?.() ?? engine?.alliance;
  const taskSystem = engine?.getAllianceTaskSystem?.() ?? engine?.allianceTask;
  const alliance: any = allianceSystem?.getAlliance?.() ?? null;
  const playerState: any = allianceSystem?.getPlayerState?.() ?? null;
  const isInAlliance = !!playerState?.allianceId;
  const members: any[] = alliance ? Object.values(alliance.members ?? {}) : [];
  const bonuses = alliance ? allianceSystem?.getBonuses?.(alliance) : null;
  const allianceTasks: any[] = taskSystem?.getActiveTasks?.() ?? [];

  const flash = useCallback((msg: string) => { setMessage(msg); setTimeout(() => setMessage(null), 2500); }, []);

  const handleCreate = useCallback(() => {
    const name = allianceName.trim();
    if (!name || name.length < 2 || name.length > 8) {
      flash('联盟名称需2-8个字');
      return;
    }
    if (!allianceSystem?.createAlliance) {
      flash('联盟系统暂未开放');
      return;
    }
    try {
      const result = allianceSystem.createAlliance(name);
      if (result?.success) {
        flash(`联盟「${name}」创建成功！`);
        setShowCreateForm(false);
        setAllianceName('');
      } else {
        flash(result?.reason ?? '创建失败');
      }
    } catch (e: any) {
      flash(e?.message ?? '创建失败');
    }
  }, [allianceName, allianceSystem, flash]);

  if (!isInAlliance) {
    return (
      <div style={s.wrap}>
        {message && <div style={s.toast}>{message}</div>}
        <div style={s.empty}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏰</div>
          <div style={{ color: '#a0a0a0', marginBottom: 16 }}>你尚未加入联盟</div>
          {!showCreateForm ? (
            <button style={s.btn} onClick={() => setShowCreateForm(true)}>创建联盟</button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <input
                style={s.input}
                value={allianceName}
                onChange={e => setAllianceName(e.target.value)}
                placeholder="输入联盟名称（2-8字）"
                maxLength={8}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={s.btn} onClick={handleCreate}>确认创建</button>
                <button style={{ ...s.btn, background: 'transparent' }} onClick={() => setShowCreateForm(false)}>取消</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={s.wrap}>
      {message && <div style={s.toast}>{message}</div>}
      {/* 联盟头部 */}
      <div style={s.header}>
        <div style={s.name}>{alliance?.name ?? '联盟'}</div>
        <div style={s.meta}>Lv.{alliance?.level ?? 1} · 成员 {members.length}/{allianceSystem?.getMaxMembers?.(alliance?.level ?? 1) ?? 20}</div>
        {bonuses && <div style={s.bonus}>资源+{bonuses.resourceBonus}% · 远征+{bonuses.expeditionBonus}%</div>}
      </div>
      {/* Tab */}
      <div style={s.tabs}>
        {(['info', 'members', 'tasks'] as const).map(t => (
          <button key={t} style={{ ...s.tab, ...(tab === t ? s.tabOn : {}) }} onClick={() => setTab(t)}>
            {{ info: '📋 信息', members: '👥 成员', tasks: '🎯 任务' }[t]}
          </button>
        ))}
      </div>
      {/* 信息 */}
      {tab === 'info' && (
        <div style={s.block}>
          <div style={s.label}>宣言</div><div style={s.val}>{alliance?.declaration ?? '暂无'}</div>
          <div style={s.label}>经验</div><div style={s.val}>{alliance?.experience ?? 0} EXP</div>
        </div>
      )}
      {/* 成员 */}
      {tab === 'members' && members.map((m: any) => (
        <div key={m.playerId} style={s.row}>
          <span style={{ flex: 1, fontWeight: 600 }}>{m.playerName}</span>
          <span style={{ fontSize: 11, color: m.role === 'LEADER' ? '#d4a574' : m.role === 'ADVISOR' ? '#7EC850' : '#a0a0a0' }}>
            {({ LEADER: '盟主', ADVISOR: '军师', MEMBER: '成员' } as Record<string, string>)[m.role] ?? m.role}
          </span>
          <span style={{ fontSize: 11, color: '#888', marginLeft: 8 }}>战力 {m.power ?? 0}</span>
        </div>
      ))}
      {/* 联盟任务 */}
      {tab === 'tasks' && (allianceTasks.length > 0 ? allianceTasks.map((task: any) => {
        const def = taskSystem?.getTaskDef?.(task.defId);
        const progress = taskSystem?.getTaskProgress?.(task.defId);
        const pct = progress?.percent ?? 0;
        return (
          <div key={task.defId} style={s.card}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{def?.name ?? task.defId}</div>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>{def?.description ?? ''}</div>
            <div style={s.bar}><div style={{ ...s.fill, width: `${pct}%` }} /></div>
            <div style={{ fontSize: 10, color: '#a0a0a0' }}>{progress?.current ?? 0}/{progress?.target ?? 0} · {task.status === 'completed' ? '✅' : '进行中'}</div>
          </div>
        );
      }) : <div style={s.emptySmall}>暂无联盟任务</div>)}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { padding: 12, color: '#e8e0d0', minHeight: '100%' },
  empty: { padding: '40px 20px', textAlign: 'center' },
  emptySmall: { textAlign: 'center', padding: 20, color: '#666', fontSize: 13 },
  btn: { padding: '10px 24px', border: '1px solid rgba(212,165,116,0.3)', borderRadius: 'var(--tk-radius-lg)' as any, background: 'rgba(212,165,116,0.15)', color: '#d4a574', fontSize: 14, cursor: 'pointer' },
  input: {
    padding: '8px 12px', border: '1px solid rgba(212,165,116,0.3)', borderRadius: 'var(--tk-radius-md)' as any,
    background: 'rgba(255,255,255,0.06)', color: '#e8e0d0', fontSize: 14, width: 200, outline: 'none',
  },
  toast: { padding: '8px 12px', marginBottom: 8, borderRadius: 'var(--tk-radius-md)' as any, background: 'rgba(212,165,116,0.2)', color: '#d4a574', fontSize: 12, textAlign: 'center' },
  header: { padding: 12, marginBottom: 12, borderRadius: 'var(--tk-radius-lg)' as any, background: 'rgba(212,165,116,0.08)', border: '1px solid rgba(212,165,116,0.2)' },
  name: { fontSize: 18, fontWeight: 600, color: '#d4a574' },
  meta: { fontSize: 12, color: '#a0a0a0', marginTop: 4 },
  bonus: { fontSize: 12, color: '#7EC850', marginTop: 6 },
  tabs: { display: 'flex', gap: 4, marginBottom: 12 },
  tab: { flex: 1, padding: '6px 8px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--tk-radius-md)' as any, background: 'transparent', color: '#a0a0a0', fontSize: 12, cursor: 'pointer', textAlign: 'center' },
  tabOn: { background: 'rgba(212,165,116,0.2)', color: '#d4a574', borderColor: '#d4a574' },
  block: { padding: 8 },
  label: { fontSize: 12, color: '#d4a574', marginBottom: 2, marginTop: 8 },
  val: { fontSize: 13, color: '#e8e0d0' },
  row: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--tk-radius-md)' as any, fontSize: 13, marginBottom: 4 },
  card: { padding: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--tk-radius-lg)' as any, marginBottom: 6 },
  bar: { height: 4, borderRadius: 'var(--tk-radius-sm)' as any, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 4 },
  fill: { height: '100%', borderRadius: 'var(--tk-radius-sm)' as any, background: '#7EC850' },
};
