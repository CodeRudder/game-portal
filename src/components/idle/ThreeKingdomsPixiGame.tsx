/**
 * ThreeKingdomsPixiGame — 三国霸业 PixiJS 渲染页面组件（增强版）
 *
 * 整合增强后的 PixiJS 渲染器（MapScene + CombatScene + AnimationManager + AssetManager），
 * 并通过 React DOM overlay 提供完整的 UI 层。
 *
 * 架构：
 *   Engine → RenderStateAdapter → GameRenderState → PixiGameCanvas → PixiJS Renderer
 *                                                            ↕
 *                                                    React UI Overlay
 *
 * 功能：
 * - 资源预加载（AssetManager.loadKenneySpritesheet）
 * - 地图场景集成（MapScene：魏蜀吴领土、城市/关卡、拖拽缩放）
 * - 战斗场景集成（CombatScene：武将对战、技能特效、战斗日志）
 * - UI 层：资源栏、建筑面板、武将面板、操作按钮
 *
 * @module components/idle/ThreeKingdomsPixiGame
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ThreeKingdomsEngine } from '@/games/three-kingdoms/ThreeKingdomsEngine';
import { ThreeKingdomsRenderStateAdapter } from '@/games/three-kingdoms/ThreeKingdomsRenderStateAdapter';
import {
  BUILDINGS,
  GENERALS,
  BATTLES,
  COLOR_THEME,
  RARITY_COLORS,
  RESOURCES,
} from '@/games/three-kingdoms/constants';
import PixiGameCanvas from '@/renderer/components/PixiGameCanvas';
import type { GameRenderState, SceneType } from '@/renderer/types';

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════

/** 格式化大数字 */
function fmt(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n < 10 ? n.toFixed(1) : Math.floor(n).toString();
}

/**
 * 场景标签配置
 *
 * 每个标签有独立的 scene + subScene，用于区分同属 map 场景的建筑/领土视图。
 * subScene 通过 engine panel toggle 来控制地图内的聚焦层。
 */
const SCENE_TABS: { scene: SceneType; label: string; icon: string; subScene?: string; key: string }[] = [
  { scene: 'map',        label: '建筑', icon: '🏗️', subScene: 'building', key: 'Escape' },
  { scene: 'hero-detail', label: '武将', icon: '⚔️', key: 'u' },
  { scene: 'map',        label: '领土', icon: '🗺️', subScene: 'territory', key: 'm' },
  { scene: 'tech-tree',  label: '科技', icon: '📜', key: 't' },
  { scene: 'combat',     label: '战斗', icon: '🔥', key: 'b' },
  { scene: 'prestige',   label: '声望', icon: '👑', key: 'r' },
];

// ═══════════════════════════════════════════════════════════════
// 新手引导步骤
// ═══════════════════════════════════════════════════════════════

const GUIDE_STEPS = [
  { title: '欢迎来到三国霸业！', text: '建造农田开始你的征程。点击左侧"农田"建筑卡片来建造。', target: 'building' as const },
  { title: '招募武将', text: '有了资源后，在右侧面板招募武将为你效力！', target: 'hero' as const },
  { title: '发起战斗', text: '准备好后，点击底部"战斗"按钮开始征战！', target: 'combat' as const },
];

/** Toast 提示数据 */
interface ToastData {
  id: number;
  text: string;
  type: 'success' | 'error';
}

// ═══════════════════════════════════════════════════════════════
// 组件
// ═══════════════════════════════════════════════════════════════

export default function ThreeKingdomsPixiGame() {
  // ─── Refs ─────────────────────────────────────────────────

  const engineRef = useRef<ThreeKingdomsEngine | null>(null);
  const adapterRef = useRef<ThreeKingdomsRenderStateAdapter | null>(null);
  const toastIdRef = useRef(0);

  // ─── State ────────────────────────────────────────────────

  const [renderState, setRenderState] = useState<GameRenderState | undefined>();
  const [scene, setScene] = useState<SceneType>('map');
  const [activeTab, setActiveTab] = useState<string>('building'); // 跟踪当前激活的 tab key
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [combatLog, setCombatLog] = useState<string[]>([]);

  // ─── 新手引导 + Toast ────────────────────────────────────

  const [showGuide, setShowGuide] = useState(true);
  const [guideStep, setGuideStep] = useState(0);
  const [toasts, setToasts] = useState<ToastData[]>([]);

  /** 添加 toast 提示，2 秒后自动消失 */
  const addToast = useCallback((text: string, type: 'success' | 'error') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 2000);
  }, []);

  // ─── 派生数据 ─────────────────────────────────────────────

  /** 当前资源数据 */
  const resources = useMemo(() => renderState?.resources.resources ?? [], [renderState]);

  /** 当前阶段 */
  const currentStage = useMemo(() => renderState?.currentStage, [renderState]);

  /** 建筑列表 */
  const buildings = useMemo(() => renderState?.buildings ?? renderState?.map?.buildings ?? [], [renderState]);

  /** 武将列表 */
  const heroes = useMemo(() => renderState?.heroes ?? [], [renderState]);

  /** 战斗数据 */
  const combatData = useMemo(() => renderState?.combat, [renderState]);

  /** 声望数据 */
  const prestigeData = useMemo(() => renderState?.prestige, [renderState]);

  // ─── 初始化引擎 ─────────────────────────────────────────

  useEffect(() => {
    const engine = new ThreeKingdomsEngine();

    // 离屏 canvas 供引擎启动游戏循环
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = 1;
    offscreenCanvas.height = 1;
    engine.init(offscreenCanvas);

    engineRef.current = engine;
    adapterRef.current = new ThreeKingdomsRenderStateAdapter(engine);

    // 监听引擎状态变化
    engine.on('stateChange', () => {
      if (adapterRef.current) {
        const state = adapterRef.current.toRenderState();
        setRenderState(state);

        // 战斗日志更新
        if (state.combat && state.combat.state === 'fighting') {
          const dmg = state.combat.damageNumbers;
          if (dmg.length > 0) {
            setCombatLog(prev => {
              const newEntries = dmg
                .filter(d => d.type === 'critical' || d.value > 50)
                .map(d => `${d.type === 'critical' ? '💥暴击' : '⚔️攻击'} -${d.value}`);
              if (newEntries.length === 0) return prev;
              return [...prev, ...newEntries].slice(-20);
            });
          }
        }
      }
    });

    // 初始渲染
    setRenderState(adapterRef.current.toRenderState());

    // 启动游戏循环
    engine.start();

    // 模拟资源预加载进度
    let progress = 0;
    const loadTimer = setInterval(() => {
      progress += Math.random() * 25 + 10;
      if (progress >= 100) {
        progress = 100;
        clearInterval(loadTimer);
        setLoading(false);
      }
      setLoadingProgress(Math.min(progress, 100));
    }, 200);

    return () => {
      clearInterval(loadTimer);
      engine.pause();
      engine.destroy();
      engineRef.current = null;
      adapterRef.current = null;
    };
  }, []);

  // ─── 键盘输入 ───────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      engineRef.current?.handleKeyDown(e.key);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ─── 引擎操作 ───────────────────────────────────────────

  /** 触发引擎面板切换 */
  const triggerPanelSwitch = useCallback((tabKey: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    // 利用引擎已有的键盘绑定来切换面板
    engine.handleKeyDown(tabKey);
  }, []);

  /** 底部标签栏点击处理：切换场景 + 更新 activeTab */
  const handleTabClick = useCallback((tab: typeof SCENE_TABS[number]) => {
    setActiveTab(tab.key);
    setScene(tab.scene);
    triggerPanelSwitch(tab.key);
  }, [triggerPanelSwitch]);

  // ─── 事件处理 ───────────────────────────────────────────

  const handleBuildingClick = useCallback((id: string) => {
    console.log('[ThreeKingdomsPixiGame] Building click:', id);
    const engine = engineRef.current;
    if (!engine) return;

    // 查找当前选中建筑
    const res = engine.getResources();
    const bs = (engine as any).bldg;
    if (!bs) return;
    const cost = bs.getCost(id);
    const canAfford = Object.entries(cost || {}).every(([rid, amt]) => (res[rid] || 0) >= (amt as number));

    if (canAfford) {
      (engine as any).buyBuilding();
      const bld = BUILDINGS.find(b => b.id === id);
      addToast(`建造成功！${bld?.name ?? id} Lv.1`, 'success');
    } else {
      addToast('资源不足！', 'error');
    }
  }, [addToast]);

  const handleTerritoryClick = useCallback((id: string) => {
    const engine = engineRef.current;
    if (!engine) return;

    const terr = (engine as any).terr;
    if (!terr) {
      console.warn('[ThreeKingdomsPixiGame] Territory system not available');
      return;
    }

    // 已征服的领土无需再次征服
    if (terr.isConquered(id)) {
      addToast('该领土已征服', 'success');
      return;
    }

    // 检查是否可攻击（相邻已征服）
    if (!terr.canAttack(id)) {
      addToast('无法攻击：需要先征服相邻领土', 'error');
      return;
    }

    // 尝试征服
    const power = Object.values(engine.getResources()).reduce((s, v) => s + v, 0);
    const result = terr.tryAttack(id, power);
    if (result) {
      // 攻击成功 → 征服
      const conquerResult = terr.conquer(id);
      for (const [r, a] of Object.entries(conquerResult.rewards || {})) {
        (engine as any).giveRes?.(r, a);
      }
      addToast(`征服成功！获得领土`, 'success');
      engine.handleKeyDown(' '); // 触发 stateChange
    } else {
      addToast('兵力不足，无法征服！', 'error');
    }
  }, [addToast]);

  const handleCombatAction = useCallback((action: string, targetId?: string) => {
    const engine = engineRef.current;
    if (!engine) return;

    if (action === 'attack' || action === 'start_battle') {
      const battles = (engine as any).battles;
      if (!battles) {
        console.warn('[ThreeKingdomsPixiGame] Battle system not available');
        return;
      }

      // 获取当前阶段的战斗
      const stage = (engine as any).stages?.getCurrent();
      const stageBattles = BATTLES.filter((b) => b.stageId === (stage?.id || 'yellow_turban'));

      if (stageBattles.length === 0) {
        addToast('当前阶段没有可用战斗', 'error');
        return;
      }

      // 使用 targetId 或第一个可用战斗
      const battleId = targetId || stageBattles[0]?.id;
      if (!battleId) return;

      const success = battles.startWave(battleId);
      if (success) {
        setCombatLog(prev => [...prev, `⚔️ 发起攻击 → ${targetId ?? '敌人'}`].slice(-20));
        addToast('战斗开始！', 'success');
      } else {
        addToast('无法开始战斗', 'error');
      }
    }
  }, [addToast]);

  const handleSceneChange = useCallback((newScene: SceneType) => {
    setScene(newScene);
  }, []);

  // ═══════════════════════════════════════════════════════════
  // 渲染
  // ═══════════════════════════════════════════════════════════

  // ─── 加载画面 ─────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{
        width: '100%', height: '100vh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: `linear-gradient(135deg, ${COLOR_THEME.bgGradient1}, ${COLOR_THEME.bgGradient2})`,
        color: COLOR_THEME.textPrimary,
        fontFamily: '"Noto Serif SC", serif',
      }}>
        <h1 style={{ fontSize: 36, color: COLOR_THEME.accentGold, marginBottom: 8 }}>
          三国霸业
        </h1>
        <p style={{ color: COLOR_THEME.textSecondary, marginBottom: 24, fontSize: 14 }}>
          加载资源中...
        </p>
        <div style={{
          width: 280, height: 6, borderRadius: 3,
          background: 'rgba(255,255,255,0.1)', overflow: 'hidden',
        }}>
          <div style={{
            width: `${loadingProgress}%`, height: '100%',
            background: `linear-gradient(90deg, ${COLOR_THEME.accentGold}, #ff8c00)`,
            borderRadius: 3, transition: 'width 0.3s ease',
          }} />
        </div>
        <p style={{ color: COLOR_THEME.textDim, marginTop: 12, fontSize: 12 }}>
          {Math.floor(loadingProgress)}%
        </p>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%', height: '100vh',
      display: 'flex', flexDirection: 'column',
      background: COLOR_THEME.bgGradient1,
      color: COLOR_THEME.textPrimary,
      fontFamily: '"Noto Serif SC", sans-serif',
      overflow: 'hidden',
    }}>
      {/* ═══════════ 顶部：资源栏 + 当前阶段 ═══════════ */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 16px',
        background: 'rgba(0,0,0,0.6)',
        borderBottom: `1px solid ${COLOR_THEME.selectedBorder}`,
        zIndex: 10, flexShrink: 0,
      }}>
        {/* 游戏标题 + 阶段 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontSize: 18, fontWeight: 'bold',
            color: COLOR_THEME.accentGold,
            fontFamily: '"Noto Serif SC", serif',
          }}>
            三国霸业
          </span>
          {currentStage && (
            <span style={{
              fontSize: 12, color: currentStage.themeColor,
              background: 'rgba(255,255,255,0.08)',
              padding: '2px 10px', borderRadius: 10,
            }}>
              {currentStage.name} — {currentStage.description}
            </span>
          )}
        </div>

        {/* 资源栏 */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {resources.map(r => (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 13, color: COLOR_THEME.textPrimary,
            }}>
              <span>{r.icon}</span>
              <span style={{ fontWeight: 'bold' }}>{fmt(r.amount)}</span>
              {r.perSecond > 0 && (
                <span style={{ fontSize: 10, color: COLOR_THEME.accentGreen }}>
                  +{fmt(r.perSecond)}/s
                </span>
              )}
            </div>
          ))}
        </div>
      </header>

      {/* ═══════════ 中间区域：左面板 + PixiJS Canvas + 右面板 ═══════════ */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* ─── 左侧面板：建筑列表 ─── */}
        <aside style={{
          width: 220, flexShrink: 0,
          background: 'rgba(0,0,0,0.5)',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          overflowY: 'auto', padding: 8,
          zIndex: 5,
        }}>
          <h3 style={{
            fontSize: 14, fontWeight: 'bold',
            color: COLOR_THEME.accentGold,
            marginBottom: 8, paddingBottom: 4,
            borderBottom: `1px solid ${COLOR_THEME.selectedBorder}`,
          }}>
            🏗️ 建筑
          </h3>
          {buildings.map(b => (
            <div
              key={b.id}
              onClick={() => handleBuildingClick(b.id)}
              style={{
                padding: '6px 8px', marginBottom: 4,
                borderRadius: 4, cursor: 'pointer',
                background: b.state === 'locked'
                  ? 'rgba(255,255,255,0.03)'
                  : 'rgba(255,255,255,0.06)',
                border: `1px solid ${b.state === 'producing' ? 'rgba(76,175,80,0.3)' : 'transparent'}`,
                opacity: b.state === 'locked' ? 0.5 : 1,
                transition: 'background 0.2s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 'bold' }}>
                  {b.iconAsset} {b.name}
                </span>
                <span style={{
                  fontSize: 10,
                  color: b.level > 0 ? COLOR_THEME.accentGold : COLOR_THEME.textDim,
                }}>
                  Lv.{b.level}
                </span>
              </div>
              {b.level > 0 && (b.productionRate ?? 0) > 0 && (
                <div style={{ fontSize: 10, color: COLOR_THEME.accentGreen, marginTop: 2 }}>
                  +{fmt(b.productionRate ?? 0)}/s {b.productionResource}
                </div>
              )}
              {b.canUpgrade && (
                <div style={{ fontSize: 9, color: COLOR_THEME.affordable, marginTop: 2 }}>
                  ▲ 可升级
                </div>
              )}
            </div>
          ))}
        </aside>

        {/* ─── 中央：PixiJS 渲染区域 ─── */}
        <div style={{ flex: 1, position: 'relative' }}>
          <PixiGameCanvas
            renderState={renderState}
            config={{
              backgroundColor: '#1a0a0a',
              designWidth: 1920,
              designHeight: 1080,
            }}
            onBuildingClick={handleBuildingClick}
            onTerritoryClick={handleTerritoryClick}
            onCombatAction={handleCombatAction}
            onSceneChange={handleSceneChange}
            onRendererReady={() => console.log('[ThreeKingdomsPixiGame] PixiJS renderer ready')}
          />

          {/* 战斗日志浮层（仅战斗场景显示） */}
          {scene === 'combat' && combatLog.length > 0 && (
            <div style={{
              position: 'absolute', bottom: 80, left: 12,
              width: 260, maxHeight: 180,
              background: 'rgba(0,0,0,0.75)',
              borderRadius: 6, padding: 8,
              overflowY: 'auto', fontSize: 11,
              color: COLOR_THEME.textSecondary,
              border: '1px solid rgba(255,255,255,0.1)',
              pointerEvents: 'none',
            }}>
              <div style={{
                fontSize: 10, color: COLOR_THEME.accentGold,
                marginBottom: 4, fontWeight: 'bold',
              }}>
                战斗日志
              </div>
              {combatLog.map((log, i) => (
                <div key={i} style={{
                  padding: '1px 0',
                  color: log.includes('暴击') ? '#ff6b6b' : log.includes('胜利') ? COLOR_THEME.accentGreen : COLOR_THEME.textSecondary,
                }}>
                  {log}
                </div>
              ))}
            </div>
          )}

          {/* 战斗状态浮层 */}
          {scene === 'combat' && combatData && (
            <div style={{
              position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.7)', borderRadius: 8, padding: '6px 20px',
              display: 'flex', gap: 20, alignItems: 'center',
              border: `1px solid ${combatData.state === 'victory' ? 'rgba(76,175,80,0.5)' : 'rgba(255,215,0,0.3)'}`,
              pointerEvents: 'none',
            }}>
              <span style={{ fontSize: 13, color: COLOR_THEME.accentGold, fontWeight: 'bold' }}>
                {combatData.state === 'preparing' && '⚔️ 准备战斗'}
                {combatData.state === 'fighting' && '🔥 战斗中'}
                {combatData.state === 'victory' && '🎉 胜利！'}
                {combatData.state === 'defeat' && '💀 战败'}
              </span>
              <span style={{ fontSize: 11, color: COLOR_THEME.textSecondary }}>
                波次 {combatData.currentWave}/{combatData.totalWaves}
              </span>
            </div>
          )}

          {/* 声望转生浮层 */}
          {scene === 'prestige' && prestigeData && (
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(0,0,0,0.85)',
              borderRadius: 12, padding: 24,
              width: 340, textAlign: 'center',
              border: `1px solid ${COLOR_THEME.selectedBorder}`,
            }}>
              <h2 style={{
                fontSize: 22, color: COLOR_THEME.accentGold,
                marginBottom: 16, fontFamily: '"Noto Serif SC", serif',
              }}>
                👑 声望转生
              </h2>
              <div style={{ fontSize: 13, lineHeight: 2, color: COLOR_THEME.textPrimary }}>
                <div>天命: <b style={{ color: COLOR_THEME.accentGold }}>{fmt(prestigeData.currency)}</b> | 转生: {prestigeData.count}次</div>
                <div>当前倍率: <b>×{prestigeData.multiplier.toFixed(2)}</b></div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 8, paddingTop: 8 }}>
                  本次获得: <b style={{ color: COLOR_THEME.accentGold }}>{fmt(prestigeData.previewGain)}</b> 天命
                </div>
                <div>新倍率: <b>×{prestigeData.previewNewMultiplier.toFixed(2)}</b></div>
                <div>资源保留: <b>{(prestigeData.retentionRate * 100).toFixed(0)}%</b></div>
              </div>
              {prestigeData.warning && (
                <p style={{ fontSize: 11, color: COLOR_THEME.textDim, marginTop: 8 }}>
                  {prestigeData.warning}
                </p>
              )}
              <button
                onClick={() => engineRef.current?.doPrestige()}
                disabled={!prestigeData.canPrestige}
                style={{
                  marginTop: 16, padding: '8px 32px',
                  fontSize: 14, fontWeight: 'bold', cursor: 'pointer',
                  borderRadius: 6, border: 'none',
                  background: prestigeData.canPrestige
                    ? `linear-gradient(135deg, ${COLOR_THEME.accentGold}, #ff8c00)`
                    : 'rgba(255,255,255,0.1)',
                  color: prestigeData.canPrestige ? '#1a0a0a' : COLOR_THEME.textDim,
                }}
              >
                {prestigeData.canPrestige ? '执行转生' : '资源不足'}
              </button>
            </div>
          )}

          {/* ═══════════ 科技研究浮层 ═══════════ */}
          {scene === 'tech-tree' && renderState?.techTree && (
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(0,0,0,0.85)',
              borderRadius: 12, padding: 20,
              width: 500, maxHeight: '80vh',
              overflowY: 'auto',
              border: `1px solid ${COLOR_THEME.selectedBorder}`,
            }}>
              <h2 style={{
                fontSize: 20, color: COLOR_THEME.accentGold,
                marginBottom: 16, fontFamily: '"Noto Serif SC", serif',
                textAlign: 'center',
              }}>
                📜 科技研究
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {renderState.techTree.nodes.map(node => {
                  const isCompleted = node.state === 'completed';
                  const isAvailable = node.state === 'available';
                  const isResearching = node.state === 'researching';
                  const isLocked = node.state === 'locked';

                  return (
                    <div
                      key={node.id}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 6,
                        background: isCompleted
                          ? 'rgba(76,175,80,0.15)'
                          : isResearching
                            ? 'rgba(255,215,0,0.1)'
                            : isAvailable
                              ? 'rgba(255,255,255,0.06)'
                              : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${
                          isCompleted ? 'rgba(76,175,80,0.3)'
                            : isResearching ? 'rgba(255,215,0,0.3)'
                              : isAvailable ? 'rgba(255,255,255,0.1)'
                                : 'transparent'
                        }`,
                        opacity: isLocked ? 0.4 : 1,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{
                            fontSize: 13, fontWeight: 'bold',
                            color: isCompleted ? COLOR_THEME.accentGreen
                              : isResearching ? COLOR_THEME.accentGold
                                : COLOR_THEME.textPrimary,
                          }}>
                            {isCompleted ? '✅ ' : isResearching ? '🔬 ' : isLocked ? '🔒 ' : '📖 '}
                            {node.name}
                          </span>
                          <span style={{
                            fontSize: 10, color: COLOR_THEME.textDim, marginLeft: 8,
                          }}>
                            Tier {node.tier}
                          </span>
                        </div>
                        {isAvailable && (
                          <button
                            onClick={() => {
                              const engine = engineRef.current;
                              if (!engine) return;
                              const techs = (engine as any).techs;
                              if (!techs) return;
                              const res = engine.getResources();
                              const success = techs.research(node.id, res);
                              if (success) {
                                // 扣除费用
                                const payMethod = (engine as any).pay;
                                if (payMethod) payMethod.call(engine, node.cost);
                                addToast(`开始研究：${node.name}`, 'success');
                                (engine as any).emit?.('stateChange');
                              } else {
                                addToast('研究失败：资源不足或前置未完成', 'error');
                              }
                            }}
                            style={{
                              padding: '3px 12px', fontSize: 10,
                              borderRadius: 4, border: 'none', cursor: 'pointer',
                              background: `linear-gradient(135deg, ${COLOR_THEME.accentGold}, #ff8c00)`,
                              color: '#1a0a0a', fontWeight: 'bold',
                            }}
                          >
                            研究
                          </button>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: COLOR_THEME.textSecondary, marginTop: 4 }}>
                        {node.description}
                      </div>
                      {isResearching && (
                        <div style={{ marginTop: 6 }}>
                          <div style={{
                            height: 4, borderRadius: 2,
                            background: 'rgba(255,255,255,0.1)',
                          }}>
                            <div style={{
                              width: `${(node.progress * 100).toFixed(0)}%`,
                              height: '100%', borderRadius: 2,
                              background: COLOR_THEME.accentGold,
                              transition: 'width 0.3s',
                            }} />
                          </div>
                          <span style={{ fontSize: 9, color: COLOR_THEME.accentGold }}>
                            研究进度: {(node.progress * 100).toFixed(1)}%
                          </span>
                        </div>
                      )}
                      {isAvailable && Object.keys(node.cost).length > 0 && (
                        <div style={{ fontSize: 9, color: COLOR_THEME.textDim, marginTop: 2 }}>
                          费用: {Object.entries(node.cost).map(([k, v]) => `${v} ${k}`).join('  ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══════════ 战斗发起浮层 ═══════════ */}
          {scene === 'combat' && combatData && combatData.state === 'preparing' && (
            <div style={{
              position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
              display: 'flex', gap: 12, alignItems: 'center',
            }}>
              <button
                onClick={() => handleCombatAction('start_battle', combatData.battleId)}
                style={{
                  padding: '10px 32px', fontSize: 15, fontWeight: 'bold',
                  borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: `linear-gradient(135deg, #e74c3c, #c0392b)`,
                  color: '#fff',
                  boxShadow: '0 2px 12px rgba(231,76,60,0.4)',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                ⚔️ 开始战斗
              </button>
            </div>
          )}
        </div>

        {/* ─── 右侧面板：武将列表 ─── */}
        <aside style={{
          width: 220, flexShrink: 0,
          background: 'rgba(0,0,0,0.5)',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          overflowY: 'auto', padding: 8,
          zIndex: 5,
        }}>
          <h3 style={{
            fontSize: 14, fontWeight: 'bold',
            color: COLOR_THEME.accentGold,
            marginBottom: 8, paddingBottom: 4,
            borderBottom: `1px solid ${COLOR_THEME.selectedBorder}`,
          }}>
            ⚔️ 武将
          </h3>
          {heroes.map(h => {
            const rarityColor = RARITY_COLORS[h.rarity] || COLOR_THEME.textPrimary;
            return (
              <div
                key={h.id}
                style={{
                  padding: '6px 8px', marginBottom: 4,
                  borderRadius: 4,
                  background: h.unlocked ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
                  borderLeft: `3px solid ${rarityColor}`,
                  opacity: h.unlocked ? 1 : 0.5,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 'bold', color: rarityColor }}>
                    {h.name}
                  </span>
                  {h.unlocked ? (
                    <span style={{ fontSize: 10, color: COLOR_THEME.accentGold }}>
                      Lv.{h.level}
                    </span>
                  ) : (
                    <span style={{ fontSize: 9, color: COLOR_THEME.textDim }}>
                      [{h.rarity}]
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: COLOR_THEME.textDim, marginTop: 2 }}>
                  {h.faction.toUpperCase()} · {h.rarity}
                </div>
                {h.unlocked && (
                  <div style={{ fontSize: 9, color: COLOR_THEME.textSecondary, marginTop: 2 }}>
                    攻{h.stats.attack} 防{h.stats.defense} 智{h.stats.intelligence} 统{h.stats.command}
                  </div>
                )}
                {!h.unlocked && h.canRecruit && (
                  <button
                    onClick={() => {
                      const engine = engineRef.current;
                      if (!engine) return;

                      // 尝试通过引擎的 UnitSystem 招募武将
                      const units = (engine as any).units;
                      if (!units) {
                        console.warn('[ThreeKingdomsPixiGame] Unit system not available');
                        addToast('招募系统未就绪', 'error');
                        return;
                      }

                      // 检查资源是否足够
                      const res = engine.getResources();
                      const cost = h.recruitCost || {};
                      const canAfford = Object.entries(cost).every(([rid, amt]: [string, number]) => (res[rid] || 0) >= amt);

                      if (!canAfford) {
                        addToast('招募失败：资源不足', 'error');
                        return;
                      }

                      // 扣除资源并招募
                      const payMethod = (engine as any).pay;
                      if (payMethod) {
                        payMethod.call(engine, cost);
                      }
                      const result = units.unlock(h.id);
                      if (result.success) {
                        addToast(`招募成功！${h.name} 加入麾下`, 'success');
                        // 触发状态更新
                        (engine as any).emit?.('stateChange');
                      } else {
                        addToast('招募失败：条件不满足', 'error');
                      }
                    }}
                    style={{
                      marginTop: 4, padding: '2px 8px',
                      fontSize: 9, cursor: 'pointer',
                      borderRadius: 3, border: 'none',
                      background: 'rgba(76,175,80,0.3)',
                      color: COLOR_THEME.accentGreen,
                    }}
                  >
                    招募
                  </button>
                )}
              </div>
            );
          })}
        </aside>
      </div>

      {/* ═══════════ 底部：操作按钮栏 ═══════════ */}
      <footer style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 8, padding: '6px 16px',
        background: 'rgba(0,0,0,0.6)',
        borderTop: `1px solid rgba(255,255,255,0.08)`,
        zIndex: 10, flexShrink: 0,
      }}>
        {SCENE_TABS.map((tab, idx) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabClick(tab)}
              style={{
                padding: '5px 16px', fontSize: 12,
                borderRadius: 4, border: 'none', cursor: 'pointer',
                background: isActive
                  ? 'rgba(255,215,0,0.15)'
                  : 'rgba(255,255,255,0.05)',
                color: isActive ? COLOR_THEME.accentGold : COLOR_THEME.textSecondary,
                borderLeft: isActive ? `2px solid ${COLOR_THEME.accentGold}` : '2px solid transparent',
                fontWeight: isActive ? 'bold' : 'normal',
                transition: 'all 0.2s',
              }}
            >
              {tab.icon} {tab.label}
            </button>
          );
        })}

        {/* 快捷键提示 */}
        <span style={{
          marginLeft: 16, fontSize: 9,
          color: COLOR_THEME.textDim,
        }}>
          [Space]点击 [Enter]购买 [R]声望 [T]科技 [M]领土 [B]战斗 [U]武将
        </span>
      </footer>

      {/* ═══════════ Toast 提示浮层 ═══════════ */}
      <div style={{
        position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        zIndex: 100, pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: '8px 20px', borderRadius: 6,
            fontSize: 13, fontWeight: 'bold',
            background: t.type === 'success' ? 'rgba(76,175,80,0.9)' : 'rgba(244,67,54,0.9)',
            color: '#fff', whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}>
            {t.type === 'success' ? '✅ ' : '❌ '}{t.text}
          </div>
        ))}
      </div>

      {/* ═══════════ 新手引导浮层 ═══════════ */}
      {showGuide && (() => {
        const step = GUIDE_STEPS[guideStep];
        const isLast = guideStep >= GUIDE_STEPS.length - 1;
        const starterName = engineRef.current?.getStarterGeneralName();
        return (
          <div
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 200,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              background: 'rgba(30,20,10,0.95)',
              borderRadius: 12, padding: '32px 40px',
              maxWidth: 420, width: '90%',
              textAlign: 'center',
              border: `1px solid ${COLOR_THEME.accentGold}`,
              boxShadow: `0 0 30px rgba(255,215,0,0.15)`,
            }}>
              <h2 style={{
                fontSize: 22, color: COLOR_THEME.accentGold,
                marginBottom: 12, fontFamily: '"Noto Serif SC", serif',
              }}>
                {step.title}
              </h2>
              <p style={{
                fontSize: 14, color: COLOR_THEME.textPrimary,
                lineHeight: 1.8, marginBottom: 8,
              }}>
                {step.text}
              </p>
              {guideStep === 0 && starterName && (
                <p style={{
                  fontSize: 15, color: '#4caf50',
                  fontWeight: 'bold', marginTop: 12, marginBottom: 4,
                }}>
                  🎉 恭喜获得武将 {starterName}！
                </p>
              )}
              <div style={{
                display: 'flex', justifyContent: 'center',
                gap: 12, marginTop: 24,
              }}>
                <button
                  onClick={() => setShowGuide(false)}
                  style={{
                    padding: '8px 20px', fontSize: 13,
                    borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)',
                    background: 'transparent', color: COLOR_THEME.textDim,
                    cursor: 'pointer',
                  }}
                >
                  跳过
                </button>
                <button
                  onClick={() => {
                    if (isLast) {
                      setShowGuide(false);
                    } else {
                      setGuideStep(guideStep + 1);
                    }
                  }}
                  style={{
                    padding: '8px 28px', fontSize: 13, fontWeight: 'bold',
                    borderRadius: 6, border: 'none',
                    background: `linear-gradient(135deg, ${COLOR_THEME.accentGold}, #ff8c00)`,
                    color: '#1a0a0a', cursor: 'pointer',
                  }}
                >
                  {isLast ? '开始游戏' : '下一步'}
                </button>
              </div>
              {/* 步骤指示器 */}
              <div style={{
                display: 'flex', justifyContent: 'center',
                gap: 6, marginTop: 16,
              }}>
                {GUIDE_STEPS.map((_, i) => (
                  <div key={i} style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: i === guideStep
                      ? COLOR_THEME.accentGold
                      : 'rgba(255,255,255,0.2)',
                  }} />
                ))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
