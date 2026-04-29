/**
 * QuestTrackerPanel — 主界面任务追踪面板
 *
 * P2-6修复：在主界面常驻显示当前追踪任务的进度。
 * 显示最多3个追踪任务的简要信息（标题+进度条）。
 *
 * @module components/idle/panels/quest/QuestTrackerPanel
 */

import React, { useMemo } from 'react';

interface QuestTrackerPanelProps {
  /** 引擎实例 */
  engine: any;
  /** 快照版本号（用于触发重渲染） */
  snapshotVersion?: number;
  /** 点击任务项回调（可选，用于打开完整任务面板） */
  onClickQuest?: (instanceId: string) => void;
}

/** 资源名称映射 */
const RESOURCE_LABELS: Record<string, string> = {
  gold: '铜钱', grain: '粮草', gem: '元宝', experience: '经验',
  strengthening_stone: '强化石', recruit_token: '招募令',
  troops: '兵力', activityPoints: '活跃度',
};

const s: Record<string, React.CSSProperties> = {
  wrap: {
    padding: '8px 12px',
    background: 'rgba(0,0,0,0.3)',
    borderRadius: 'var(--tk-radius-lg)' as any,
    border: '1px solid rgba(212,165,116,0.15)',
    maxWidth: 280,
  },
  title: {
    fontSize: 11,
    fontWeight: 600,
    color: '#d4a574',
    marginBottom: 6,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  item: {
    padding: '4px 0',
    marginBottom: 4,
    cursor: 'pointer',
    borderRadius: 4,
    transition: 'background 0.15s',
  },
  itemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  questName: {
    fontSize: 11,
    color: '#e8e0d0',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    maxWidth: 180,
  },
  progress: {
    fontSize: 10,
    color: '#888',
    flexShrink: 0,
  },
  barBg: {
    height: 3,
    borderRadius: 'var(--tk-radius-sm)' as any,
    background: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 'var(--tk-radius-sm)' as any,
    background: 'linear-gradient(90deg, #7EC850, #a0d870)',
    transition: 'width 0.3s ease',
  },
  barFillDone: {
    background: 'linear-gradient(90deg, #d4a574, #e8c49a)',
  },
  empty: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center' as const,
    padding: '4px 0',
  },
  done: {
    color: '#7EC850',
    fontSize: 10,
  },
};

export default function QuestTrackerPanel({ engine, snapshotVersion, onClickQuest }: QuestTrackerPanelProps) {
  const qs = engine?.getQuestSystem?.() ?? engine?.quest;

  const trackedQuests = useMemo(() => {
    if (!qs) return [];
    return qs.getTrackedQuests?.() ?? [];
  }, [qs, snapshotVersion]);

  // 获取任务定义
  const getDef = (questDefId: string) => qs?.getQuestDef?.(questDefId);

  if (trackedQuests.length === 0) {
    return (
      <div style={s.wrap} data-testid="quest-tracker-panel">
        <div style={s.title}>📋 任务追踪</div>
        <div style={s.empty}>暂无追踪任务</div>
      </div>
    );
  }

  return (
    <div style={s.wrap} data-testid="quest-tracker-panel">
      <div style={s.title}>📋 任务追踪</div>
      {trackedQuests.map((q: any) => {
        const def = getDef(q.questDefId);
        const title = def?.title ?? q.questDefId ?? '任务';
        const done = q.status === 'completed';
        const claimed = q.rewardClaimed;
        const objs: any[] = q.objectives ?? [];

        // 计算总体进度
        const totalProgress = objs.length > 0
          ? objs.reduce((sum: number, o: any) => sum + Math.min(o.currentCount, o.targetCount), 0) /
            objs.reduce((sum: number, o: any) => sum + o.targetCount, 0)
          : 0;
        const pct = Math.min(100, Math.round(totalProgress * 100));

        return (
          <div
            key={q.instanceId}
            style={s.item}
            data-testid={`quest-tracker-item-${q.instanceId}`}
            onClick={() => onClickQuest?.(q.instanceId)}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
          >
            <div style={s.itemHeader}>
              <span style={s.questName}>
                {done && <span style={s.done}>✅ </span>}
                {title}
              </span>
              <span style={s.progress}>
                {done ? (claimed ? '已领取' : '可领取') : `${pct}%`}
              </span>
            </div>
            <div style={s.barBg}>
              <div style={{
                ...s.barFill,
                ...(done ? s.barFillDone : {}),
                width: `${pct}%`,
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
