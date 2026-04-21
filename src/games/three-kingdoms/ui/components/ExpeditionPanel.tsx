/**
 * 三国霸业 — 远征面板组件
 *
 * 路线选择 + 队伍配置 + 进度展示。
 * 支持多条路线浏览、队伍编组、节点进度可视化。
 *
 * @module ui/components/ExpeditionPanel
 */

import { useState, useCallback, useMemo } from 'react';
import { useDebouncedAction } from '../hooks/useDebouncedAction';
import { useToast } from './ToastProvider';
import {
  DIFFICULTY_LABELS,
  DIFFICULTY_STARS,
  FORMATION_LABELS,
  NodeStatus,
  NodeType,
} from '../../core/expedition/expedition.types';
import type {
  ExpeditionRoute,
  ExpeditionTeam,
  ExpeditionRegion,
  RouteDifficulty,
  ExpeditionNode,
  FormationType,
} from '../../core/expedition/expedition.types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

const NODE_TYPE_ICONS: Record<NodeType, string> = {
  [NodeType.BANDIT]: '🗡️',
  [NodeType.HAZARD]: '⛰️',
  [NodeType.BOSS]: '👹',
  [NodeType.TREASURE]: '📦',
  [NodeType.REST]: '🏕️',
};

const NODE_TYPE_LABELS: Record<NodeType, string> = {
  [NodeType.BANDIT]: '山贼',
  [NodeType.HAZARD]: '天险',
  [NodeType.BOSS]: 'Boss',
  [NodeType.TREASURE]: '宝箱',
  [NodeType.REST]: '休息点',
};

const DIFFICULTY_COLORS: Record<RouteDifficulty, string> = {
  EASY: '#7EC850',
  NORMAL: '#5B9BD5',
  HARD: '#D4A574',
  AMBUSH: '#B8423A',
};

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface ExpeditionPanelProps {
  /** 路线列表 */
  routes: ExpeditionRoute[];
  /** 区域列表 */
  regions: ExpeditionRegion[];
  /** 队伍列表 */
  teams: ExpeditionTeam[];
  /** 已解锁队伍数 */
  unlockedSlots: number;
  /** 选择路线回调 */
  onRouteSelect?: (routeId: string) => void;
  /** 开始远征回调 */
  onStartExpedition?: (routeId: string, teamId: string) => void;
  /** 额外类名 */
  className?: string;
}

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

function getProgress(route: ExpeditionRoute): number {
  const nodes = Object.values(route.nodes);
  if (!nodes.length) return 0;
  const cleared = nodes.filter((n) => n.status === NodeStatus.CLEARED).length;
  return cleared / nodes.length;
}

function formatPower(n: number): string {
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}万`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.floor(n).toString();
}

// ─────────────────────────────────────────────
// 子组件：路线卡片
// ─────────────────────────────────────────────

interface RouteCardProps {
  route: ExpeditionRoute;
  progress: number;
  onSelect: () => void;
}

function RouteCard({ route, progress, onSelect }: RouteCardProps) {
  const color = DIFFICULTY_COLORS[route.difficulty];
  const stars = DIFFICULTY_STARS[route.difficulty];
  const isLocked = !route.unlocked;

  return (
    <div
      style={{
        ...cardStyles.container,
        borderColor: isLocked ? 'rgba(255,255,255,0.06)' : color + '40',
        opacity: isLocked ? 0.5 : 1,
      }}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-label={`${route.name} ${DIFFICULTY_LABELS[route.difficulty]}`}
    >
      {/* 难度标签 */}
      <div style={cardStyles.header}>
        <span style={{ ...cardStyles.difficulty, color }}>{DIFFICULTY_LABELS[route.difficulty]}</span>
        <span style={cardStyles.stars}>{'⭐'.repeat(stars)}</span>
      </div>

      {/* 路线名 */}
      <div style={cardStyles.routeName}>{route.name}</div>

      {/* 进度条 */}
      <div style={cardStyles.barBg}>
        <div style={{ ...cardStyles.barFill, width: `${progress * 100}%`, backgroundColor: color }} />
      </div>

      {/* 推荐战力 */}
      <div style={cardStyles.power}>
        推荐战力：{formatPower(route.powerMultiplier * 1000)}
      </div>

      {isLocked && <div style={cardStyles.lockedTag}>🔒 未解锁</div>}
    </div>
  );
}

// ─────────────────────────────────────────────
// 子组件：队伍选择
// ─────────────────────────────────────────────

interface TeamSelectorProps {
  teams: ExpeditionTeam[];
  unlockedSlots: number;
  selectedTeamId: string | null;
  onSelect: (teamId: string) => void;
}

function TeamSelector({ teams, unlockedSlots, selectedTeamId, onSelect }: TeamSelectorProps) {
  return (
    <div style={teamStyles.container}>
      <div style={teamStyles.title}>选择队伍</div>
      <div style={teamStyles.grid}>
        {teams.slice(0, unlockedSlots).map((team) => (
          <div
            key={team.id}
            style={{
              ...teamStyles.card,
              borderColor: selectedTeamId === team.id ? '#d4a574' : 'rgba(255,255,255,0.1)',
            }}
            onClick={() => onSelect(team.id)}
            role="button"
            tabIndex={0}
          >
            <div style={teamStyles.teamName}>{team.name}</div>
            <div style={teamStyles.teamPower}>⚔️ {formatPower(team.totalPower)}</div>
            <div style={teamStyles.teamFormation}>{FORMATION_LABELS[team.formation]}</div>
            {team.isExpeditioning && <div style={teamStyles.busyTag}>远征中</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

/**
 * ExpeditionPanel — 远征面板
 *
 * @example
 * ```tsx
 * <ExpeditionPanel
 *   routes={routes}
 *   regions={regions}
 *   teams={teams}
 *   unlockedSlots={2}
 *   onRouteSelect={(id) => console.log(id)}
 * />
 * ```
 */
export function ExpeditionPanel({
  routes,
  regions,
  teams,
  unlockedSlots,
  onRouteSelect,
  onStartExpedition,
  className,
}: ExpeditionPanelProps) {
  const { addToast } = useToast();
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [isStartingExpedition, setIsStartingExpedition] = useState(false);

  const selectedRoute = useMemo(
    () => routes.find((r) => r.id === selectedRouteId) ?? null,
    [routes, selectedRouteId],
  );

  const routeProgress = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of routes) map.set(r.id, getProgress(r));
    return map;
  }, [routes]);

  const handleRouteSelect = useCallback((id: string) => {
    setSelectedRouteId(id);
    onRouteSelect?.(id);
  }, [onRouteSelect]);

  const handleStart = useCallback(() => {
    if (!selectedRouteId || !selectedTeamId) {
      // R16: 资源不足/条件不满足提示
      if (!selectedRouteId) addToast('请先选择远征路线', 'warning');
      if (!selectedTeamId) addToast('请先选择远征队伍', 'warning');
      return;
    }
    // R16: 检查队伍是否已在远征中
    const team = teams.find((t) => t.id === selectedTeamId);
    if (team?.isExpeditioning) {
      addToast('该队伍正在远征中', 'warning');
      return;
    }
    setIsStartingExpedition(true);
    try {
      onStartExpedition?.(selectedRouteId, selectedTeamId);
      addToast('远征出发！', 'success');
    } catch (error) {
      console.error('远征出发失败:', error);
      addToast('远征出发失败', 'error');
    } finally {
      setTimeout(() => setIsStartingExpedition(false), 600);
    }
  }, [selectedRouteId, selectedTeamId, onStartExpedition, teams, addToast]);

  // P0-UI-02: 防抖包裹
  const { action: debouncedStart, isActing: isStarting } = useDebouncedAction(handleStart, 500);

  // 按区域分组
  const groupedRoutes = useMemo(() => {
    const groups: { region: ExpeditionRegion; routes: ExpeditionRoute[] }[] = [];
    const sortedRegions = [...regions].sort((a, b) => a.order - b.order);
    for (const region of sortedRegions) {
      const regionRoutes = routes.filter((r) => r.regionId === region.id);
      if (regionRoutes.length > 0) {
        groups.push({ region, routes: regionRoutes });
      }
    }
    return groups;
  }, [routes, regions]);

  return (
    <div
      style={styles.container}
      className={`tk-expedition-panel ${className ?? ''}`.trim()}
      role="region"
      aria-label="远征面板"
    >
      <div style={styles.title}>🗺️ 远征天下</div>

      {/* 路线列表 */}
      {groupedRoutes.map(({ region, routes: regionRoutes }) => (
        <div key={region.id} style={styles.regionBlock}>
          <div style={styles.regionTitle}>{region.name}</div>
          <div style={styles.routeGrid}>
            {regionRoutes.map((route) => (
              <RouteCard
                key={route.id}
                route={route}
                progress={routeProgress.get(route.id) ?? 0}
                onSelect={() => handleRouteSelect(route.id)}
              />
            ))}
          </div>
        </div>
      ))}

      {/* 选中路线的节点详情 */}
      {selectedRoute && (
        <div style={styles.detailPanel}>
          <div style={styles.detailTitle}>
            {selectedRoute.name} — 节点进度
          </div>
          <div style={styles.nodeList}>
            {Object.values(selectedRoute.nodes).map((node) => (
              <div
                key={node.id}
                style={{
                  ...styles.nodeItem,
                  opacity: node.status === NodeStatus.LOCKED ? 0.4 : 1,
                }}
              >
                <span>{NODE_TYPE_ICONS[node.type]}</span>
                <span style={styles.nodeName}>{node.name}</span>
                <span style={{
                  ...styles.nodeStatus,
                  color: node.status === NodeStatus.CLEARED ? '#7EC850' : '#a0a0a0',
                }}>
                  {node.status === NodeStatus.CLEARED ? '✅' : node.status === NodeStatus.MARCHING ? '🏃' : '🔒'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 队伍选择 */}
      <TeamSelector
        teams={teams}
        unlockedSlots={unlockedSlots}
        selectedTeamId={selectedTeamId}
        onSelect={setSelectedTeamId}
      />

      {/* 出发按钮 */}
      <button
        style={{
          ...styles.startBtn,
          opacity: selectedRouteId && selectedTeamId && !isStarting && !isStartingExpedition ? 1 : 0.4,
        }}
        disabled={!selectedRouteId || !selectedTeamId || isStarting || isStartingExpedition}
        onClick={debouncedStart}
      >
        {isStartingExpedition ? '出发中...' : '🚀 出发远征'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// 样式
// ─────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '12px',
    color: '#e8e0d0',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#d4a574',
    marginBottom: '12px',
  },
  regionBlock: { marginBottom: '12px' },
  regionTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#a0a0a0',
    marginBottom: '6px',
  },
  routeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '8px',
  },
  detailPanel: {
    padding: '10px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '8px',
    marginBottom: '12px',
  },
  detailTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#d4a574',
    marginBottom: '8px',
  },
  nodeList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  nodeItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    padding: '4px 0',
  },
  nodeName: { flex: 1 },
  nodeStatus: { fontSize: '14px' },
  startBtn: {
    width: '100%',
    padding: '12px',
    border: 'none',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #d4a574, #B8423A)',
    color: '#fff',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: '12px',
  },
};

const cardStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '8px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(212, 165, 116, 0.2)',
    borderRadius: '8px',
    cursor: 'pointer',
    position: 'relative',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  difficulty: { fontSize: '12px', fontWeight: 600 },
  stars: { fontSize: '10px' },
  routeName: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#e8e0d0',
    marginBottom: '4px',
  },
  barBg: {
    width: '100%',
    height: '4px',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 0.3s ease',
  },
  power: { fontSize: '10px', color: '#a0a0a0' },
  lockedTag: {
    fontSize: '10px',
    color: '#666',
    textAlign: 'center',
    marginTop: '2px',
  },
};

const teamStyles: Record<string, React.CSSProperties> = {
  container: { marginBottom: '8px' },
  title: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#d4a574',
    marginBottom: '6px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: '6px',
  },
  card: {
    padding: '8px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    cursor: 'pointer',
    textAlign: 'center',
    position: 'relative',
  },
  teamName: { fontSize: '12px', fontWeight: 600, color: '#e8e0d0' },
  teamPower: { fontSize: '11px', color: '#d4a574', margin: '2px 0' },
  teamFormation: { fontSize: '10px', color: '#a0a0a0' },
  busyTag: {
    position: 'absolute',
    top: '2px',
    right: '4px',
    fontSize: '9px',
    color: '#d4a017',
  },
};
