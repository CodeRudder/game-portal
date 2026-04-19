/**
 * 三国霸业 v1.0「基业初立」— React UI 组件
 *
 * 严格遵循 UI 设计文档：
 *   - PLAN: plans/v1.0-基业初立.md
 *   - UI: ui-layout/NAV-main.md (主界面 A/B/C区)
 *   - UI: ui-layout/BLD-buildings.md (建筑系统)
 *   - UI: ui-layout/RES-resources.md (资源系统)
 *   - UI: ui-layout/SPEC-global.md (全局规范)
 *
 * PC端 1280×800 (A区56 + B区48 + C区696)
 *
 * @version 1.0.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ThreeKingdomsEngine,
  type Resources,
  type BuildingId,
  type BuildingState,
  type EngineSaveData,
} from '@/games/three-kingdoms/ThreeKingdomsEngine';
import './ThreeKingdomsPixiGame.css';

// ═══════════════════════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════════════════════

/** PRD RES-1: 资源显示配置 */
const RESOURCE_CONFIG = [
  { type: 'food' as const, name: '粮草', icon: '🌾', color: '#7EC850' },
  { type: 'gold' as const, name: '铜钱', icon: '💰', color: '#C9A84C' },
  { type: 'troops' as const, name: '兵力', icon: '⚔️', color: '#B8423A' },
  { type: 'destiny' as const, name: '天命', icon: '👑', color: '#7B5EA7' },
] as const;

/** PRD NAV-2: Tab配置 */
const TAB_CONFIG = [
  { id: 'building' as const, label: '建筑', icon: '🏛️' },
  { id: 'general' as const, label: '武将', icon: '⚔️' },
  { id: 'tech' as const, label: '科技', icon: '📚' },
  { id: 'campaign' as const, label: '关卡', icon: '🗺️' },
] as const;

type TabId = typeof TAB_CONFIG[number]['id'];

/** 容量警告阈值 — PRD RES-4 */
const CAPACITY_WARN_THRESHOLD = 0.7;
const CAPACITY_DANGER_THRESHOLD = 0.9;
const CAPACITY_FULL_THRESHOLD = 1.0;

/** 格式化数字 */
function fmt(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n < 10 ? n.toFixed(1) : Math.floor(n).toString();
}

/** 格式化时间 */
function fmtTime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${Math.floor(seconds % 60)}秒`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}时${m}分`;
}

// ═══════════════════════════════════════════════════════════════
// Toast 类型
// ═══════════════════════════════════════════════════════════════

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'warning' | 'danger' | 'info';
}

// ═══════════════════════════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════════════════════════

export default function ThreeKingdomsPixiGame() {
  // ─── 引擎 ─────────────────────────────────────────────
  const engineRef = useRef<ThreeKingdomsEngine>(new ThreeKingdomsEngine());
  const [resources, setResources] = useState<Resources>(() => engineRef.current.getResources());
  const [productionRate, setProductionRate] = useState<Resources>(() => engineRef.current.getProductionRate());
  const [resourceCaps, setResourceCaps] = useState<Resources>(() => engineRef.current.getResourceCaps());
  const [buildings, setBuildings] = useState<BuildingState[]>(() => engineRef.current.getBuildings());

  // ─── UI状态 ────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('building');
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingId | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [offlineReward, setOfflineReward] = useState<Resources | null>(null);
  const [offlineSeconds, setOfflineSeconds] = useState(0);
  const [showOfflineModal, setShowOfflineModal] = useState(false);

  const toastIdRef = useRef(0);
  const gameLoopRef = useRef<number>(0);
  const lastTickRef = useRef<number>(Date.now());

  // ─── Toast ─────────────────────────────────────────────
  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2000);
  }, []);

  // ─── 初始化：加载存档+离线收益 ──────────────────────────
  useEffect(() => {
    const engine = engineRef.current;
    const { loaded, offlineSeconds: offSec } = engine.loadSave();

    if (loaded && offSec > 300) { // >5分钟显示离线收益
      const reward = engine.applyOfflineProgress(offSec);
      setOfflineReward(reward);
      setOfflineSeconds(offSec);
      setShowOfflineModal(true);
    }

    // 更新UI状态
    setResources(engine.getResources());
    setProductionRate(engine.getProductionRate());
    setResourceCaps(engine.getResourceCaps());
    setBuildings(engine.getBuildings());
  }, []);

  // ─── 游戏主循环 ─────────────────────────────────────────
  useEffect(() => {
    const loop = () => {
      const now = Date.now();
      const dt = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;

      if (dt > 0 && dt < 10) {
        engineRef.current.tick(dt);
      }

      setResources(engineRef.current.getResources());
      setProductionRate(engineRef.current.getProductionRate());
      setResourceCaps(engineRef.current.getResourceCaps());
      setBuildings(engineRef.current.getBuildings());

      gameLoopRef.current = requestAnimationFrame(loop);
    };

    gameLoopRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(gameLoopRef.current);
  }, []);

  // ─── 自动保存 每30秒 ────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      engineRef.current.autoSave();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // ─── 建筑升级 ──────────────────────────────────────────
  const handleUpgrade = useCallback((id: BuildingId) => {
    const result = engineRef.current.upgradeBuilding(id);
    if (result.success) {
      addToast(`${engineRef.current.getBuildingName(id)} 升级成功！`, 'success');
      setBuildings(engineRef.current.getBuildings());
      setResources(engineRef.current.getResources());
      setProductionRate(engineRef.current.getProductionRate());
      setResourceCaps(engineRef.current.getResourceCaps());
    } else {
      addToast(result.reason || '升级失败', 'danger');
    }
  }, [addToast]);

  // ─── 领取离线收益 ──────────────────────────────────────
  const handleClaimOffline = useCallback(() => {
    setShowOfflineModal(false);
    addToast('离线收益已领取！', 'success');
  }, [addToast]);

  // ─── 获取容量状态CSS类 ─────────────────────────────────
  const getCapacityClass = (type: keyof Resources): string => {
    const cap = resourceCaps[type];
    if (!isFinite(cap)) return '';
    const pct = resources[type] / cap;
    if (pct >= CAPACITY_FULL_THRESHOLD) return 'tk-cap-full';
    if (pct >= CAPACITY_DANGER_THRESHOLD) return 'tk-cap-danger';
    if (pct >= CAPACITY_WARN_THRESHOLD) return 'tk-cap-warn';
    return '';
  };

  // ═════════════════════════════════════════════════════════
  // 渲染
  // ═════════════════════════════════════════════════════════

  return (
    <div className="tk-game">
      {/* ── A区：资源栏 56px ── */}
      <div className="tk-resource-bar">
        {RESOURCE_CONFIG.map(rc => {
          const cap = resourceCaps[rc.type];
          const hasCap = isFinite(cap) && cap > 0;
          const pct = hasCap ? resources[rc.type] / cap : 0;
          return (
            <div key={rc.type} className={`tk-resource-item ${getCapacityClass(rc.type)}`}>
              <span className="tk-res-icon">{rc.icon}</span>
              <span className="tk-res-name">{rc.name}</span>
              <span className="tk-res-value">{fmt(resources[rc.type])}</span>
              {hasCap && (
                <div className="tk-cap-bar">
                  <div className="tk-cap-fill" style={{ width: `${Math.min(100, pct * 100)}%` }} />
                  <span className="tk-cap-text">{fmt(resources[rc.type])}/{fmt(cap)}</span>
                </div>
              )}
              <span className="tk-res-rate">+{fmt(productionRate[rc.type])}/s</span>
            </div>
          );
        })}
      </div>

      {/* ── B区：Tab导航 48px ── */}
      <div className="tk-tab-bar">
        {TAB_CONFIG.map(tab => (
          <button
            key={tab.id}
            className={`tk-tab ${activeTab === tab.id ? 'tk-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tk-tab-icon">{tab.icon}</span>
            <span className="tk-tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── C区：场景区 696px ── */}
      <div className="tk-scene">
        {activeTab === 'building' && (
          <div className="tk-building-grid">
            {buildings.map(bld => {
              const isUnlocked = engineRef.current.isBuildingUnlocked(bld.id);
              const canUpgrade = engineRef.current.isBuildingUpgradeAllowed(bld.id);
              const cost = engineRef.current.getUpgradeCost(bld.id);
              const name = engineRef.current.getBuildingName(bld.id);
              const icon = engineRef.current.getBuildingIcon(bld.id);
              const desc = engineRef.current.getBuildingDescription(bld.id);

              return (
                <div
                  key={bld.id}
                  className={`tk-building-card ${!isUnlocked ? 'tk-locked' : ''} ${selectedBuilding === bld.id ? 'tk-selected' : ''}`}
                  onClick={() => isUnlocked && setSelectedBuilding(bld.id)}
                >
                  <div className="tk-bld-icon">{icon}</div>
                  <div className="tk-bld-info">
                    <div className="tk-bld-name">{name}</div>
                    <div className="tk-bld-level">Lv.{bld.level}</div>
                    {!isUnlocked && (
                      <div className="tk-bld-lock">
                        需要主城 Lv.{engineRef.current.isBuildingUnlocked(bld.id) ? '' : ''}
                      </div>
                    )}
                  </div>
                  {isUnlocked && bld.level > 0 && (
                    <button
                      className={`tk-upgrade-btn ${!canUpgrade ? 'tk-btn-disabled' : ''}`}
                      onClick={(e) => { e.stopPropagation(); canUpgrade && handleUpgrade(bld.id); }}
                      disabled={!canUpgrade}
                    >
                      {canUpgrade ? '升级' : '已满'}
                    </button>
                  )}
                  {isUnlocked && bld.level === 0 && (
                    <button
                      className="tk-upgrade-btn tk-btn-build"
                      onClick={(e) => { e.stopPropagation(); handleUpgrade(bld.id); }}
                    >
                      建造
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab !== 'building' && (
          <div className="tk-placeholder">
            <span className="tk-placeholder-icon">
              {TAB_CONFIG.find(t => t.id === activeTab)?.icon}
            </span>
            <span className="tk-placeholder-text">
              {TAB_CONFIG.find(t => t.id === activeTab)?.label}系统将在后续版本开放
            </span>
          </div>
        )}
      </div>

      {/* ── D区：建筑详情面板（右侧滑入360px） ── */}
      {selectedBuilding && (
        <div className="tk-detail-panel">
          <button className="tk-panel-close" onClick={() => setSelectedBuilding(null)}>✕</button>
          {(() => {
            const bld = buildings.find(b => b.id === selectedBuilding)!;
            const name = engineRef.current.getBuildingName(selectedBuilding);
            const icon = engineRef.current.getBuildingIcon(selectedBuilding);
            const desc = engineRef.current.getBuildingDescription(selectedBuilding);
            const maxLv = engineRef.current.getBuildingMaxLevel(selectedBuilding);
            const canUpgrade = engineRef.current.isBuildingUpgradeAllowed(selectedBuilding);
            const cost = engineRef.current.getUpgradeCost(selectedBuilding);
            const rate = engineRef.current.getProductionRate();

            return (
              <>
                <div className="tk-panel-header">
                  <span className="tk-panel-icon">{icon}</span>
                  <div>
                    <div className="tk-panel-name">{name}</div>
                    <div className="tk-panel-level">等级 {bld.level} / {maxLv}</div>
                  </div>
                </div>
                <div className="tk-panel-desc">{desc}</div>

                {/* 产出信息 */}
                <div className="tk-panel-section">
                  <div className="tk-section-title">产出</div>
                  {selectedBuilding === 'farm' && (
                    <div className="tk-production-info">
                      🌾 粮草 +{fmt(1.0 + 0.5 * bld.level)}/秒
                    </div>
                  )}
                  {selectedBuilding === 'market' && (
                    <div className="tk-production-info">
                      💰 铜钱 +{fmt(0.8 + 0.4 * bld.level)}/秒
                    </div>
                  )}
                  {selectedBuilding === 'barracks' && (
                    <div className="tk-production-info">
                      ⚔️ 兵力 +{fmt(0.5 + 0.3 * bld.level)}/秒
                    </div>
                  )}
                  {selectedBuilding === 'castle' && (
                    <div className="tk-production-info">
                      🏛️ 全资源 +{bld.level * 2}% 加成
                    </div>
                  )}
                  {!['farm', 'market', 'barracks', 'castle'].includes(selectedBuilding) && (
                    <div className="tk-production-info">后续版本开放产出</div>
                  )}
                </div>

                {/* 升级费用 */}
                {canUpgrade && cost && (
                  <div className="tk-panel-section">
                    <div className="tk-section-title">升级费用</div>
                    <div className="tk-cost-list">
                      {cost.food && (
                        <div className={`tk-cost-item ${resources.food < cost.food ? 'tk-insufficient' : ''}`}>
                          🌾 {fmt(cost.food)}
                        </div>
                      )}
                      {cost.gold && (
                        <div className={`tk-cost-item ${resources.gold < cost.gold ? 'tk-insufficient' : ''}`}>
                          💰 {fmt(cost.gold)}
                        </div>
                      )}
                      {cost.troops && (
                        <div className={`tk-cost-item ${resources.troops < cost.troops ? 'tk-insufficient' : ''}`}>
                          ⚔️ {fmt(cost.troops)}
                        </div>
                      )}
                      <div className="tk-cost-item tk-cost-time">⏱️ {fmtTime(cost.time)}</div>
                    </div>
                  </div>
                )}

                {/* 升级按钮 */}
                <button
                  className={`tk-panel-upgrade ${!canUpgrade ? 'tk-btn-disabled' : ''}`}
                  onClick={() => canUpgrade && handleUpgrade(selectedBuilding)}
                  disabled={!canUpgrade}
                >
                  {canUpgrade ? `升级到 Lv.${bld.level + 1}` : '无法升级'}
                </button>
              </>
            );
          })()}
        </div>
      )}

      {/* ── E区：离线收益弹窗 ── */}
      {showOfflineModal && offlineReward && (
        <div className="tk-modal-overlay">
          <div className="tk-modal">
            <div className="tk-modal-title">离线收益</div>
            <div className="tk-modal-subtitle">您离开了 {fmtTime(offlineSeconds)}</div>
            <div className="tk-modal-rewards">
              {RESOURCE_CONFIG.map(rc => {
                const amount = offlineReward[rc.type];
                if (amount <= 0) return null;
                return (
                  <div key={rc.type} className="tk-reward-item">
                    <span>{rc.icon} {rc.name}</span>
                    <span className="tk-reward-amount">+{fmt(amount)}</span>
                  </div>
                );
              })}
            </div>
            <button className="tk-modal-btn" onClick={handleClaimOffline}>领取</button>
          </div>
        </div>
      )}

      {/* ── F区：Toast提示 ── */}
      <div className="tk-toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`tk-toast tk-toast-${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
