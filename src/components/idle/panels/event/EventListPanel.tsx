/**
 * 事件列表面板 — 活跃事件、已完成事件记录
 *
 * 从引擎 EventTriggerSystem 获取真实事件数据。
 * 已迁移至 SharedPanel 统一弹窗容器。
 *
 * @module panels/event/EventListPanel
 */
import React, { useMemo } from 'react';
import SharedPanel from '@/components/idle/components/SharedPanel';
import { RESOURCE_LABELS } from '@/games/three-kingdoms/engine';

// ─── Props ──────────────────────────────────
interface EventListPanelProps {
  engine: any;
  snapshotVersion: number;
  /** 是否显示面板 */
  visible?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
}

// ─── 事件常量 ────────────────────────────────

const EVENT_CATEGORY_ICONS: Record<string, string> = {
  military: '⚔️',
  diplomatic: '🤝',
  economic: '💰',
  natural: '🌊',
  social: '👥',
  mystery: '❓',
};

/** 事件紧急程度颜色 */
const EVENT_URGENCY_COLORS: Record<string, string> = {
  low: '#7ec850',
  medium: '#e8a735',
  high: '#e67e22',
  critical: '#e74c3c',
};

/** 事件触发类型标签 */
const EVENT_TRIGGER_LABELS: Record<string, string> = {
  random: '随机',
  fixed: '固定',
  chain: '连锁',
};

// ─── 主组件 ──────────────────────────────────

export default function EventListPanel({ engine, snapshotVersion, visible = true, onClose }: EventListPanelProps) {
  // 从引擎获取活跃事件和事件定义
  const { activeEvents, eventDefs, completedIds } = useMemo(() => {
    void snapshotVersion; // 触发重渲染
    const registry = engine?.getSubsystemRegistry?.();

    // 尝试从 EventTriggerSystem 获取数据
    const triggerSys = registry?.get?.('eventTrigger');
    const eventEngine = registry?.get?.('eventEngine');

    // 优先使用 EventTriggerSystem
    const sys = triggerSys ?? eventEngine;
    const active = sys?.getActiveEvents?.() ?? [];
    const defs = sys?.getAllEventDefs?.() ?? [];
    const completed = sys?.getCompletedEventIds?.() ?? [];

    return { activeEvents: active, eventDefs: defs, completedIds: completed };
  }, [engine, snapshotVersion]);

  // 将 EventInstance 与 EventDef 关联，构建显示数据
  const displayEvents = useMemo(() => {
    return activeEvents.map((inst: any) => {
      const def = eventDefs.find((d: any) => d.id === inst.eventDefId);
      return {
        instanceId: inst.instanceId,
        eventDefId: inst.eventDefId,
        title: def?.title ?? def?.name ?? '未知事件',
        description: def?.description ?? '',
        urgency: def?.urgency ?? 'medium',
        category: def?.category ?? 'mystery',
        triggerType: def?.triggerType ?? 'random',
        options: def?.options ?? [],
        expireTurn: inst.expireTurn,
        status: inst.status,
      };
    });
  }, [activeEvents, eventDefs]);

  const hasActive = displayEvents.length > 0;
  const hasCompleted = completedIds.length > 0;

  return (
    <SharedPanel visible={visible} title="事件" icon="⚡" onClose={onClose} width="520px">
    <div style={{ padding: '16px', color: '#e8e0d0' }} data-testid="event-list-panel">
      {/* 活跃事件 */}
      <div style={{ fontSize: '14px', fontWeight: 600, color: '#d4a574', marginBottom: '12px' }}>
        📨 当前事件 ({displayEvents.length})
      </div>

      {hasActive ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {displayEvents.map((evt: any) => (
            <div
              key={evt.instanceId}
              data-testid={`event-card-${evt.instanceId}`}
              style={{
                padding: '12px',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 'var(--tk-radius-lg)' as any,
                borderLeft: `3px solid ${EVENT_URGENCY_COLORS[evt.urgency] ?? '#666'}`,
              }}
            >
              {/* 事件头部 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span>{EVENT_CATEGORY_ICONS[evt.category] ?? '❓'}</span>
                <span style={{ fontWeight: 600, fontSize: '14px', flex: 1 }}>{evt.title}</span>
                <span
                  style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: 'var(--tk-radius-sm)' as any,
                    background: `${EVENT_URGENCY_COLORS[evt.urgency] ?? '#666'}22`,
                    color: EVENT_URGENCY_COLORS[evt.urgency] ?? '#666',
                    fontWeight: 600,
                  }}
                >
                  {EVENT_TRIGGER_LABELS[evt.triggerType] ?? evt.triggerType}
                </span>
              </div>

              {/* 事件描述 */}
              <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#aaa', lineHeight: 1.5 }}>
                {evt.description}
              </p>

              {/* 选项预览 */}
              {evt.options.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {(evt.options.map || []).map((opt: any) => {
                    // 解析后果中的资源变化
                    const resChanges: string[] = [];
                    if (opt.consequences?.resourceChanges) {
                      for (const [key, val] of Object.entries(opt.consequences.resourceChanges)) {
                        const numVal = val as number;
                        const label = RESOURCE_LABELS[key as keyof typeof RESOURCE_LABELS] ?? key;
                        resChanges.push(`${label}${numVal >= 0 ? '+' : ''}${numVal}`);
                      }
                    }
                    // v6.0 格式：consequences 是数组
                    if (Array.isArray(opt.consequences)) {
                      for (const c of opt.consequences) {
                        if (c.type === 'resource_change') {
                          const label = RESOURCE_LABELS[c.target as keyof typeof RESOURCE_LABELS] ?? c.target;
                          resChanges.push(`${label}${c.value >= 0 ? '+' : ''}${c.value}`);
                        } else {
                          resChanges.push(c.description ?? '');
                        }
                      }
                    }

                    return (
                      <div
                        key={opt.id}
                        style={{
                          fontSize: '11px',
                          padding: '4px 8px',
                          background: 'rgba(255,255,255,0.03)',
                          borderRadius: 'var(--tk-radius-sm)' as any,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ color: '#ccc' }}>{opt.text}</span>
                        {resChanges.length > 0 && (
                          <span style={{ color: '#888', fontSize: '10px' }}>
                            {resChanges.join(' ')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '24px', color: '#666', fontSize: '13px' }}>
          暂无活跃事件
          <div style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>
            随着游戏进行，随机事件将自动触发
          </div>
        </div>
      )}

      {/* 已完成事件记录 */}
      {hasCompleted && (
        <>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#d4a574', margin: '16px 0 8px' }}>
            ✅ 已完成事件 ({completedIds.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {completedIds.slice(0, 10).map((id: string) => {
              const def = eventDefs.find((d: any) => d.id === id);
              return (
                <span
                  key={id}
                  style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: 'var(--tk-radius-sm)' as any,
                    color: '#888',
                  }}
                >
                  {def?.title ?? def?.name ?? id}
                </span>
              );
            })}
            {completedIds.length > 10 && (
              <span style={{ fontSize: '11px', color: '#666', padding: '3px 8px' }}>
                ...等{completedIds.length}个
              </span>
            )}
          </div>
        </>
      )}
    </div>
    </SharedPanel>
  );
}
