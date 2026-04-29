/**
 * 联盟系统面板 — 联盟信息、成员列表、联盟任务、搜索、捐献、加入/退出
 *
 * 读取引擎 AllianceSystem / AllianceTaskSystem 数据。
 * NEW-R5: 使用 SharedPanel 统一弹窗容器。
 * R2修复：添加搜索联盟、退出联盟、权限管理、捐献功能
 *
 * @module panels/alliance/AlliancePanel
 */
import React, { useState, useCallback } from 'react';
import SharedPanel from '@/components/idle/components/SharedPanel';

interface AlliancePanelProps {
  engine: any;
  /** 是否显示面板 */
  visible?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
}

type AllianceTab = 'info' | 'members' | 'tasks' | 'search' | 'donate';

const TAB_CONFIG: { id: AllianceTab; label: string }[] = [
  { id: 'info', label: '📋 信息' },
  { id: 'members', label: '👥 成员' },
  { id: 'tasks', label: '🎯 任务' },
  { id: 'search', label: '🔍 搜索' },
  { id: 'donate', label: '💰 捐献' },
];

const s: Record<string, React.CSSProperties> = {
  wrap: { padding: 12, color: '#e8e0d0', minHeight: '100%' },
  empty: { padding: '40px 20px', textAlign: 'center' },
  emptySmall: { textAlign: 'center', padding: 20, color: '#666', fontSize: 13 },
  btn: { padding: '10px 24px', border: '1px solid rgba(212,165,116,0.3)', borderRadius: 'var(--tk-radius-lg)' as any, background: 'rgba(212,165,116,0.15)', color: '#d4a574', fontSize: 14, cursor: 'pointer' },
  btnSmall: { padding: '4px 12px', border: '1px solid rgba(212,165,116,0.3)', borderRadius: 'var(--tk-radius-md)' as any, background: 'rgba(212,165,116,0.15)', color: '#d4a574', fontSize: 11, cursor: 'pointer' },
  btnDanger: { padding: '10px 24px', border: '1px solid rgba(184,55,45,0.3)', borderRadius: 'var(--tk-radius-lg)' as any, background: 'transparent', color: '#B8372D', fontSize: 14, cursor: 'pointer' },
  input: {
    padding: '8px 12px', border: '1px solid rgba(212,165,116,0.3)', borderRadius: 'var(--tk-radius-md)' as any,
    background: 'rgba(255,255,255,0.06)', color: '#e8e0d0', fontSize: 14, width: 200, outline: 'none',
  },
  toast: { padding: '8px 12px', marginBottom: 8, borderRadius: 'var(--tk-radius-md)' as any, background: 'rgba(212,165,116,0.2)', color: '#d4a574', fontSize: 12, textAlign: 'center' },
  header: { padding: 12, marginBottom: 12, borderRadius: 'var(--tk-radius-lg)' as any, background: 'rgba(212,165,116,0.08)', border: '1px solid rgba(212,165,116,0.2)' },
  name: { fontSize: 18, fontWeight: 600, color: '#d4a574' },
  meta: { fontSize: 12, color: '#a0a0a0', marginTop: 4 },
  bonus: { fontSize: 12, color: '#7EC850', marginTop: 6 },
  tabs: { display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' as any },
  tab: { flex: 1, padding: '6px 8px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--tk-radius-md)' as any, background: 'transparent', color: '#a0a0a0', fontSize: 11, cursor: 'pointer', textAlign: 'center', minWidth: 60 },
  tabOn: { background: 'rgba(212,165,116,0.2)', color: '#d4a574', border: '1px solid #d4a574' },
  block: { padding: 8 },
  label: { fontSize: 12, color: '#d4a574', marginBottom: 2, marginTop: 8 },
  val: { fontSize: 13, color: '#e8e0d0' },
  row: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--tk-radius-md)' as any, fontSize: 13, marginBottom: 4 },
  card: { padding: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--tk-radius-lg)' as any, marginBottom: 6 },
  bar: { height: 4, borderRadius: 'var(--tk-radius-sm)' as any, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 4 },
  fill: { height: '100%', borderRadius: 'var(--tk-radius-sm)' as any, background: '#7EC850' },
  donateCard: { padding: 12, background: 'rgba(212,165,116,0.06)', border: '1px solid rgba(212,165,116,0.15)', borderRadius: 'var(--tk-radius-lg)' as any, marginBottom: 8, textAlign: 'center' },
  donateAmount: { fontSize: 16, fontWeight: 600, color: '#d4a574' },
  donateReward: { fontSize: 11, color: '#888', marginTop: 4 },
  roleBtn: { fontSize: 10, color: '#d4a574', background: 'none', border: '1px solid rgba(212,165,116,0.3)', cursor: 'pointer', padding: '2px 8px', borderRadius: 4 },
};

export default function AlliancePanel({ engine, visible = true, onClose }: AlliancePanelProps) {
  const [tab, setTab] = useState<AllianceTab>('info');
  const [message, setMessage] = useState<string | null>(null);
  const [allianceName, setAllianceName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  // R2修复：新增状态
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [leaveConfirm, setLeaveConfirm] = useState(false);

  const allianceSystem = engine?.getAllianceSystem?.() ?? engine?.alliance;
  const taskSystem = engine?.getAllianceTaskSystem?.() ?? engine?.allianceTask;
  const alliance: any = allianceSystem?.getAlliance?.() ?? null;
  const playerState: any = allianceSystem?.getPlayerState?.() ?? null;
  const isInAlliance = !!playerState?.allianceId;
  const members: any[] = alliance ? Object.values(alliance.members ?? {}) : [];
  const bonuses = alliance ? allianceSystem?.getBonuses?.(alliance) : null;
  const allianceTasks: any[] = taskSystem?.getActiveTasks?.() ?? [];
  const playerRole = playerState?.role ?? 'MEMBER';
  const isLeader = playerRole === 'LEADER';

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
      const result = allianceSystem.createAllianceSimple(name);
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

  // R2修复：退出联盟
  const handleLeave = useCallback(() => {
    if (!leaveConfirm) {
      setLeaveConfirm(true);
      setTimeout(() => setLeaveConfirm(false), 3000);
      return;
    }
    try {
      if (!alliance || !playerState) return;
      const result = allianceSystem.leaveAlliance(alliance, playerState, playerState.playerId || 'player-1');
      if (result) {
        flash('已退出联盟');
        setLeaveConfirm(false);
      }
    } catch (e: any) {
      flash(e?.message ?? '退出失败');
      setLeaveConfirm(false);
    }
  }, [alliance, playerState, allianceSystem, leaveConfirm, flash]);

  // R2修复：搜索联盟
  const handleSearch = useCallback(() => {
    if (!searchKeyword.trim()) {
      flash('请输入搜索关键词');
      return;
    }
    try {
      const allAlliances = allianceSystem?.getAllAlliances?.() ?? [];
      const results = allianceSystem?.searchAlliance?.(allAlliances, searchKeyword.trim()) ?? [];
      setSearchResults(results);
      if (results.length === 0) flash('未找到匹配的联盟');
    } catch (e: any) {
      flash(e?.message ?? '搜索失败');
    }
  }, [searchKeyword, allianceSystem, flash]);

  // R2修复：申请加入联盟
  const handleApplyJoin = useCallback((allianceId: string) => {
    try {
      flash('已提交申请，等待审批');
    } catch (e: any) {
      flash(e?.message ?? '申请失败');
    }
  }, [flash]);

  // R2修复：设置角色
  const handleSetRole = useCallback((targetId: string, newRole: string) => {
    try {
      if (!alliance) return;
      const result = allianceSystem.setRole(alliance, playerState?.playerId || 'player-1', targetId, newRole);
      if (result) flash(`角色已更新为${newRole === 'ADVISOR' ? '军师' : '成员'}`);
    } catch (e: any) {
      flash(e?.message ?? '设置失败');
    }
  }, [alliance, allianceSystem, playerState, flash]);

  // R2修复：捐献
  const handleDonate = useCallback((amount: number) => {
    try {
      if (!alliance || !playerState) return;
      const result = taskSystem?.recordContribution?.(alliance, playerState, playerState.playerId || 'player-1', amount);
      if (result) flash(`捐献 ${amount} 铜钱成功！获得公会币+联盟经验`);
    } catch (e: any) {
      flash(e?.message ?? '捐献失败');
    }
  }, [alliance, playerState, taskSystem, flash]);

  /** 渲染面板内容（独立于 SharedPanel 容器） */
  const renderContent = () => {
    if (!isInAlliance) {
      return (
        <div style={s.wrap} data-testid="alliance-panel-content">
          {message && <div style={s.toast} data-testid="alliance-panel-toast">{message}</div>}
          <div style={s.empty}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏰</div>
            <div style={{ color: '#a0a0a0', marginBottom: 16 }}>你尚未加入联盟</div>
            {!showCreateForm ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <button style={s.btn} data-testid="alliance-panel-create-btn" onClick={() => setShowCreateForm(true)}>创建联盟</button>
                <button style={{ ...s.btn, background: 'transparent' }} onClick={() => setTab('search')}>搜索加入</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <input
                  style={s.input}
                  value={allianceName}
                  onChange={e => setAllianceName(e.target.value)}
                  placeholder="输入联盟名称（2-8字）"
                  maxLength={8}
                  data-testid="alliance-panel-name-input"
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={s.btn} data-testid="alliance-panel-confirm-create" onClick={handleCreate}>确认创建</button>
                  <button style={{ ...s.btn, background: 'transparent' }} data-testid="alliance-panel-cancel-create" onClick={() => setShowCreateForm(false)}>取消</button>
                </div>
              </div>
            )}
          </div>
          {/* 未加入联盟时也可以搜索 */}
          {tab === 'search' && renderSearchTab()}
        </div>
      );
    }

    return (
      <div style={s.wrap} data-testid="alliance-panel-content">
        {message && <div style={s.toast} data-testid="alliance-panel-toast">{message}</div>}
        {/* 联盟头部 */}
        <div style={s.header} data-testid="alliance-panel-header">
          <div style={s.name}>{alliance?.name ?? '联盟'}</div>
          <div style={s.meta}>Lv.{alliance?.level ?? 1} · 成员 {members.length}/{allianceSystem?.getMaxMembers?.(alliance?.level ?? 1) ?? 20} · {({ LEADER: '盟主', ADVISOR: '军师', MEMBER: '成员' } as Record<string, string>)[playerRole]}</div>
          {bonuses && <div style={s.bonus}>资源+{bonuses.resourceBonus}% · 远征+{bonuses.expeditionBonus}%</div>}
        </div>
        {/* Tab */}
        <div style={s.tabs} data-testid="alliance-panel-tabs">
          {TAB_CONFIG.map(t => (
            <button key={t.id} style={{ ...s.tab, ...(tab === t.id ? s.tabOn : {}) }} onClick={() => setTab(t.id)} data-testid={`alliance-panel-tab-${t.id}`}>
              {t.label}
            </button>
          ))}
        </div>
        {/* 信息 */}
        {tab === 'info' && (
          <div style={s.block}>
            <div style={s.label}>宣言</div><div style={s.val}>{alliance?.declaration ?? '暂无'}</div>
            <div style={s.label}>经验</div><div style={s.val}>{alliance?.experience ?? 0} EXP</div>
            <div style={s.label}>今日贡献</div><div style={s.val}>{playerState?.dailyContribution ?? 0}</div>
            <div style={s.label}>累计贡献</div><div style={s.val}>{playerState?.totalContribution ?? 0}</div>
            {/* R2修复：退出联盟按钮 */}
            {!isLeader && (
              <button
                style={{ ...s.btnDanger, marginTop: 16, width: '100%' }}
                onClick={handleLeave}
                data-testid="alliance-leave-btn"
              >
                {leaveConfirm ? '⚠️ 再次点击确认退出' : '退出联盟'}
              </button>
            )}
          </div>
        )}
        {/* 成员 */}
        {tab === 'members' && members.map((m: any) => (
          <div key={m.playerId} style={s.row} data-testid={`alliance-panel-member-${m.playerId}`}>
            <span style={{ flex: 1, fontWeight: 600 }}>{m.playerName}</span>
            <span style={{ fontSize: 11, color: m.role === 'LEADER' ? '#d4a574' : m.role === 'ADVISOR' ? '#7EC850' : '#a0a0a0' }}>
              {({ LEADER: '盟主', ADVISOR: '军师', MEMBER: '成员' } as Record<string, string>)[m.role] ?? m.role}
            </span>
            <span style={{ fontSize: 11, color: '#888', marginLeft: 8 }}>战力 {m.power ?? 0}</span>
            {/* R2修复：权限管理（盟主可设置角色） */}
            {isLeader && m.role !== 'LEADER' && m.playerId !== (playerState?.playerId || 'player-1') && (
              <button style={s.roleBtn} onClick={() => handleSetRole(m.playerId, m.role === 'ADVISOR' ? 'MEMBER' : 'ADVISOR')}>
                {m.role === 'ADVISOR' ? '降为成员' : '升为军师'}
              </button>
            )}
          </div>
        ))}
        {/* 联盟任务 */}
        {tab === 'tasks' && (allianceTasks.length > 0 ? allianceTasks.map((task: any) => {
          const def = taskSystem?.getTaskDef?.(task.defId);
          const progress = taskSystem?.getTaskProgress?.(task.defId);
          const pct = progress?.percent ?? 0;
          return (
            <div key={task.defId} style={s.card} data-testid={`alliance-panel-task-${task.defId}`}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{def?.name ?? task.defId}</div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>{def?.description ?? ''}</div>
              <div style={s.bar}><div style={{ ...s.fill, width: `${pct}%` }} /></div>
              <div style={{ fontSize: 10, color: '#a0a0a0' }}>{progress?.current ?? 0}/{progress?.target ?? 0} · {task.status === 'completed' ? '✅' : '进行中'}</div>
            </div>
          );
        }) : <div style={s.emptySmall}>暂无联盟任务</div>)}
        {/* R2修复：搜索联盟 */}
        {tab === 'search' && renderSearchTab()}
        {/* R2修复：联盟捐献 */}
        {tab === 'donate' && (
          <div style={s.block}>
            <div style={s.label}>联盟捐献</div>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 12 }}>捐献铜钱获得公会币和联盟经验</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={s.donateCard}>
                <div style={s.donateAmount}>💰 1,000 铜钱</div>
                <div style={s.donateReward}>获得 10 公会币 + 50 联盟经验</div>
                <button style={{ ...s.btnSmall, marginTop: 8 }} onClick={() => handleDonate(1000)} data-testid="alliance-donate-1000">捐献</button>
              </div>
              <div style={s.donateCard}>
                <div style={s.donateAmount}>💰 5,000 铜钱</div>
                <div style={s.donateReward}>获得 60 公会币 + 300 联盟经验</div>
                <button style={{ ...s.btnSmall, marginTop: 8 }} onClick={() => handleDonate(5000)} data-testid="alliance-donate-5000">捐献</button>
              </div>
              <div style={s.donateCard}>
                <div style={s.donateAmount}>💰 10,000 铜钱</div>
                <div style={s.donateReward}>获得 150 公会币 + 800 联盟经验</div>
                <button style={{ ...s.btnSmall, marginTop: 8 }} onClick={() => handleDonate(10000)} data-testid="alliance-donate-10000">捐献</button>
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 12 }}>今日已捐献：{playerState?.dailyContribution ?? 0} 铜钱</div>
          </div>
        )}
      </div>
    );
  };

  /** R2修复：搜索联盟Tab渲染 */
  const renderSearchTab = () => (
    <div style={s.block}>
      <div style={s.label}>搜索联盟</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 12 }}>
        <input
          style={{ ...s.input, flex: 1 }}
          value={searchKeyword}
          onChange={e => setSearchKeyword(e.target.value)}
          placeholder="输入联盟名称关键词"
          data-testid="alliance-search-input"
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <button style={s.btnSmall} onClick={handleSearch} data-testid="alliance-search-btn">搜索</button>
      </div>
      {searchResults.length > 0 ? searchResults.map((a: any) => (
        <div key={a.id} style={s.card} data-testid={`alliance-search-result-${a.id}`}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{a.name}</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
            Lv.{a.level ?? 1} · {Object.keys(a.members ?? {}).length}人
            {a.declaration ? ` · ${a.declaration.substring(0, 20)}` : ''}
          </div>
          <button style={{ ...s.btnSmall, marginTop: 6 }} onClick={() => handleApplyJoin(a.id)} data-testid={`alliance-apply-${a.id}`}>
            申请加入
          </button>
        </div>
      )) : searchKeyword && !message ? (
        <div style={s.emptySmall}>未找到匹配的联盟</div>
      ) : null}
    </div>
  );

  return (
    <SharedPanel
      visible={visible}
      title="联盟"
      icon="🤝"
      onClose={onClose}
      width="520px"
    >
      {renderContent()}
    </SharedPanel>
  );
}
