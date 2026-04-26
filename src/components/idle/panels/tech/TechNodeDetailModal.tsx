/**
 * TechNodeDetailModal — 科技节点详情弹窗
 *
 * 功能：
 * - 节点信息（名称/描述/效果/消耗）
 * - 前置依赖列表
 * - 互斥分支提示
 * - 研究/加速按钮
 *
 * PC端：右侧滑入 420px 面板
 * 手机端：底部上滑全屏面板
 */

import React, { useMemo, useCallback } from 'react';
import type { TechNodeDef, TechNodeState, TechNodeStatus } from '@/games/three-kingdoms/engine';
import {
  TECH_PATH_LABELS,
  TECH_PATH_ICONS,
  TECH_PATH_COLORS,
  TECH_NODE_MAP,
} from '@/games/three-kingdoms/engine';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import SharedPanel from '../../components/SharedPanel';
import './TechNodeDetailModal.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface TechNodeDetailModalProps {
  nodeDef: TechNodeDef;
  nodeState: TechNodeState;
  engine: ThreeKingdomsEngine;
  onClose: () => void;
  onStartResearch: (techId: string) => void;
  snapshotVersion: number;
  tick: number;
}

// ─────────────────────────────────────────────
// 状态文本映射
// ─────────────────────────────────────────────
const STATUS_TEXT: Record<TechNodeStatus, string> = {
  completed: '已完成',
  researching: '研究中',
  available: '可研究',
  locked: '未解锁',
};

// ─────────────────────────────────────────────
// 效果类型中文映射
// ─────────────────────────────────────────────
const EFFECT_TYPE_LABELS: Record<string, string> = {
  resource_production: '资源产出',
  troop_attack: '攻击力',
  troop_defense: '防御力',
  troop_hp: '生命值',
  building_production: '建筑产出',
  hero_exp: '武将经验',
  research_speed: '研究速度',
  march_speed: '行军速度',
  resource_cap: '资源上限',
  recruit_discount: '招募折扣',
};

const TARGET_LABELS: Record<string, string> = {
  all: '全军',
  cavalry: '骑兵',
  infantry: '步兵',
  grain: '粮草',
  gold: '铜钱',
};

// ─────────────────────────────────────────────
// 格式化时间
// ─────────────────────────────────────────────
function formatDuration(seconds: number): string {
  if (seconds <= 0) return '已完成';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}小时`);
  if (m > 0) parts.push(`${m}分钟`);
  if (s > 0 && h === 0) parts.push(`${s}秒`);
  return parts.join('') || '0秒';
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const TechNodeDetailModal: React.FC<TechNodeDetailModalProps> = ({
  nodeDef,
  nodeState,
  engine,
  onClose,
  onStartResearch,
  snapshotVersion,
  tick,
}) => {
  const treeSystem = engine.getTechTreeSystem();
  const pointSystem = engine.getTechPointSystem();
  const researchSystem = engine.getTechResearchSystem();

  // ── 计算数据 ──
  const status = nodeState.status;

  const currentPoints = useMemo(
    () => pointSystem.getCurrentPoints(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshotVersion, tick],
  );

  const canAfford = currentPoints >= nodeDef.costPoints;

  // 前置依赖
  const prerequisites = useMemo(() => {
    return (nodeDef.prerequisites || []).map((preId) => {
      const def = TECH_NODE_MAP.get(preId);
      const state = treeSystem.getNodeState(preId);
      return {
        id: preId,
        name: def?.name ?? preId,
        met: state?.status === 'completed',
      };
    });
  }, [nodeDef, treeSystem]);

  const allPrereqsMet = prerequisites.every((p) => p.met);

  // 互斥替代节点
  const mutexAlternatives = useMemo(() => {
    return treeSystem.getMutexAlternatives(nodeDef.id).map((altId) => {
      const def = TECH_NODE_MAP.get(altId);
      return { id: altId, name: def?.name ?? altId };
    });
  }, [nodeDef.id, treeSystem]);

  const isMutexLocked = treeSystem.isMutexLocked(nodeDef.id);

  // 研究进度
  const researchProgress = useMemo(
    () => (status === 'researching' ? researchSystem.getResearchProgress(nodeDef.id) : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, snapshotVersion, tick],
  );

  const remainingTime = useMemo(
    () => (status === 'researching' ? researchSystem.getRemainingTime(nodeDef.id) : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, snapshotVersion, tick],
  );

  // 加速费用计算
  const ingotCost = useMemo(
    () => (status === 'researching' ? researchSystem.calculateIngotCost(nodeDef.id) : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, snapshotVersion, tick],
  );

  const mandateCost = useMemo(
    () => (status === 'researching' ? researchSystem.calculateMandateCost(nodeDef.id) : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, snapshotVersion, tick],
  );

  // ── 是否可以开始研究 ──
  const canStart = useMemo(() => {
    if (status !== 'available') return false;
    if (!canAfford) return false;
    if (!allPrereqsMet) return false;
    if (isMutexLocked) return false;
    return true;
  }, [status, canAfford, allPrereqsMet, isMutexLocked]);

  // ── 处理开始研究 ──
  const [researching, setResearching] = React.useState(false);
  const handleStart = useCallback(() => {
    if (!canStart || researching) return;
    setResearching(true);
    onStartResearch(nodeDef.id);
    onClose();
  }, [canStart, researching, nodeDef.id, onStartResearch, onClose]);

  // ── 处理加速 ──
  const handleSpeedUp = useCallback(
    (method: 'mandate' | 'ingot') => {
      if (status !== 'researching') return;
      const cost = method === 'mandate' ? mandateCost : ingotCost;
      if (cost <= 0) return;
      researchSystem.speedUp(nodeDef.id, method, cost);
    },
    [status, nodeDef.id, mandateCost, ingotCost, researchSystem],
  );

  // ── 处理取消研究 ──
  const handleCancel = useCallback(() => {
    if (status !== 'researching') return;
    researchSystem.cancelResearch(nodeDef.id);
    onClose();
  }, [status, nodeDef.id, researchSystem, onClose]);

  // ── 渲染效果列表 ──
  const renderEffects = () => (
    <div className="tk-tech-detail-section">
      <div className="tk-tech-detail-section-title">效果预览</div>
      <div className="tk-tech-detail-effects">
        {nodeDef.effects.map((eff, idx) => {
          const sign = eff.value >= 0 ? '+' : '';
          return (
            <div key={idx} className="tk-tech-detail-effect">
              <span className="tk-tech-detail-effect-icon">
                {EFFECT_TYPE_LABELS[eff.type] ? '⚡' : '✨'}
              </span>
              <span className="tk-tech-detail-effect-text">
                {EFFECT_TYPE_LABELS[eff.type] ?? eff.type}
                {eff.target !== 'all' && eff.target
                  ? ` (${TARGET_LABELS[eff.target] ?? eff.target})`
                  : ''}
              </span>
              <span className="tk-tech-detail-effect-value">
                {sign}{eff.value}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <SharedPanel title={nodeDef.name} onClose={onClose} visible={true} data-testid="tech-detail-overlay">
        {/* 可滚动内容 */}
        <div className="tk-tech-detail-body">
          {/* 信息头部 */}
          <div className="tk-tech-detail-info">
            <div className="tk-tech-detail-icon">{nodeDef.icon}</div>
            <div className="tk-tech-detail-meta">
              <div className="tk-tech-detail-name">{nodeDef.name}</div>
              <div
                className="tk-tech-detail-path"
                style={{ color: TECH_PATH_COLORS[nodeDef.path] }}
              >
                {TECH_PATH_ICONS[nodeDef.path]} {TECH_PATH_LABELS[nodeDef.path]}路线 · 层级 {nodeDef.tier}
              </div>
              <div>
                <span className={`tk-tech-detail-status tk-tech-detail-status--${status}`}>
                  {STATUS_TEXT[status]}
                </span>
              </div>
            </div>
          </div>

          {/* 描述 */}
          <div className="tk-tech-detail-section">
            <div className="tk-tech-detail-section-title">科技描述</div>
            <div className="tk-tech-detail-desc">{nodeDef.description}</div>
          </div>

          {/* 效果 */}
          {renderEffects()}

          {/* 研究消耗 */}
          <div className="tk-tech-detail-section">
            <div className="tk-tech-detail-section-title">研究消耗</div>
            <div className="tk-tech-detail-costs">
              <div className="tk-tech-detail-cost">
                <span className="tk-tech-detail-cost-label">📚 科技点</span>
                <span
                  className={`tk-tech-detail-cost-value ${
                    canAfford ? 'tk-tech-detail-cost-value--enough' : 'tk-tech-detail-cost-value--not-enough'
                  }`}
                >
                  {nodeDef.costPoints} / {Math.floor(currentPoints)}
                  {canAfford ? ' ✅' : ' ❌'}
                </span>
              </div>
              <div className="tk-tech-detail-cost">
                <span className="tk-tech-detail-cost-label">⏱️ 研究时间</span>
                <span className="tk-tech-detail-cost-value">
                  {formatDuration(nodeDef.researchTime)}
                </span>
              </div>
            </div>
          </div>

          {/* 前置条件 */}
          {prerequisites.length > 0 && (
            <div className="tk-tech-detail-section">
              <div className="tk-tech-detail-section-title">前置条件</div>
              <div className="tk-tech-detail-prereqs">
                {prerequisites.map((pre) => (
                  <div key={pre.id} className="tk-tech-detail-prereq">
                    <span
                      className={`tk-tech-detail-prereq-icon ${
                        pre.met
                          ? 'tk-tech-detail-prereq-icon--met'
                          : 'tk-tech-detail-prereq-icon--unmet'
                      }`}
                    >
                      {pre.met ? '✅' : '❌'}
                    </span>
                    <span
                      className={`tk-tech-detail-prereq-name ${
                        !pre.met ? 'tk-tech-detail-prereq-name--unmet' : ''
                      }`}
                    >
                      {pre.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 互斥分支提示 */}
          {mutexAlternatives.length > 0 && (
            <div className="tk-tech-detail-mutex" data-testid="tech-detail-mutex">
              <div className="tk-tech-detail-mutex-title">⚠️ 互斥分支</div>
              <div>
                选择此科技后，以下科技将永久锁定：
                {mutexAlternatives.map((alt) => (
                  <span key={alt.id} className="tk-tech-detail-mutex-alt">
                    {' '}{alt.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 研究中进度 */}
          {status === 'researching' && (
            <div className="tk-tech-detail-section">
              <div className="tk-tech-detail-section-title">研究进度</div>
              <div className="tk-tech-detail-costs">
                <div className="tk-tech-detail-cost">
                  <span className="tk-tech-detail-cost-label">进度</span>
                  <span className="tk-tech-detail-cost-value" style={{ color: '#3498db' }}>
                    {Math.round(researchProgress * 100)}%
                  </span>
                </div>
                <div className="tk-tech-detail-cost">
                  <span className="tk-tech-detail-cost-label">剩余时间</span>
                  <span className="tk-tech-detail-cost-value">
                    {formatDuration(remainingTime)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="tk-tech-detail-footer">
          {status === 'available' && (
            <button
              className="tk-tech-detail-btn tk-tech-detail-btn--primary"
              disabled={!canStart || researching}
              onClick={handleStart}
              data-testid="tech-detail-start"
            >
              {researching ? '研究中...' : `开始研究 ${nodeDef.icon}`}
            </button>
          )}

          {status === 'researching' && (
            <>
              <button
                className="tk-tech-detail-btn tk-tech-detail-btn--speedup"
                onClick={() => handleSpeedUp('mandate')}
                disabled={mandateCost <= 0}
                data-testid="tech-detail-speedup-mandate"
              >
                天命加速 (👑{mandateCost})
              </button>
              <button
                className="tk-tech-detail-btn tk-tech-detail-btn--speedup"
                onClick={() => handleSpeedUp('ingot')}
                disabled={ingotCost <= 0}
                data-testid="tech-detail-speedup-ingot"
              >
                元宝秒完成 (💎{ingotCost})
              </button>
              <button
                className="tk-tech-detail-btn tk-tech-detail-btn--cancel"
                onClick={handleCancel}
                data-testid="tech-detail-cancel"
              >
                取消研究
              </button>
            </>
          )}

          {status === 'completed' && (
            <>
              <button
                className="tk-tech-detail-btn tk-tech-detail-btn--secondary"
                disabled
              >
                已完成 ✅
              </button>
              <div
                className="tk-tech-detail-effect-active-hint"
                data-testid="tech-detail-effect-active"
              >
                ✨ 效果已生效 — 以下加成已应用到您的势力
              </div>
            </>
          )}

          {status === 'locked' && (
            <button
              className="tk-tech-detail-btn tk-tech-detail-btn--secondary"
              disabled
            >
              条件未满足 🔒
            </button>
          )}
        </div>
    </SharedPanel>
  );
};

export default TechNodeDetailModal;
