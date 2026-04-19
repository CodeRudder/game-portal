import React, { useState, useEffect, useCallback, useRef } from 'react';
import './ThreeKingdomsPixiGame.css';
import { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine';
import type {
  BuildingType,
  EngineSnapshot,
  Resources,
  ProductionRate,
  ResourceCap,
  UpgradeCost,
} from '@/games/three-kingdoms/shared/types';

/* ============================================================
 * 三国霸业 v1.0「基业初立」— 严格按UI设计稿
 * 固定尺寸 1280×800，居中显示
 * 适配新引擎 API（grain/gold/troops/mandate）
 * ============================================================ */

// ─── 建筑定义（映射到引擎 BuildingType） ───
const BUILDINGS: {
  id: BuildingType;
  name: string;
  icon: string;
  category: string;
  produces: string | null;
}[] = [
  { id: 'castle', name: '主城', icon: '🏛️', category: '核心', produces: null },
  { id: 'farmland', name: '农田', icon: '🌾', category: '民生', produces: 'grain' },
  { id: 'market', name: '市集', icon: '💰', category: '民生', produces: 'gold' },
  { id: 'barracks', name: '兵营', icon: '⚔️', category: '军事', produces: 'troops' },
  { id: 'smithy', name: '铁匠铺', icon: '🔨', category: '军事', produces: null },
  { id: 'academy', name: '书院', icon: '📚', category: '文教', produces: null },
  { id: 'clinic', name: '医馆', icon: '🏥', category: '文教', produces: null },
  { id: 'wall', name: '城墙', icon: '🏯', category: '防御', produces: null },
];

// ─── 资源定义（映射到引擎 ResourceType） ───
const RESOURCE_DEFS: Record<string, { name: string; icon: string; color: string; hasCap: boolean }> = {
  grain:   { name: '粮草', icon: '🌾', color: '#7EC850', hasCap: true },
  gold:    { name: '铜钱', icon: '💰', color: '#C9A84C', hasCap: false },
  troops:  { name: '兵力', icon: '⚔️', color: '#B8423A', hasCap: true },
  mandate: { name: '天命', icon: '👑', color: '#7B5EA7', hasCap: false },
};

// ─── 任务定义 ───
const INITIAL_TASKS = [
  { id: 1, title: '升级农田到Lv.3', type: 'building' as const, target: 'farmland' as BuildingType, targetLevel: 3, reward: '粮草+50', rewardData: { grain: 50 } },
  { id: 2, title: '建造市集', type: 'building' as const, target: 'market' as BuildingType, targetLevel: 1, reward: '铜钱+100', rewardData: { gold: 100 } },
  { id: 3, title: '升级兵营到Lv.2', type: 'building' as const, target: 'barracks' as BuildingType, targetLevel: 2, reward: '兵力+30', rewardData: { troops: 30 } },
  { id: 4, title: '总建筑等级达到Lv.10', type: 'total' as const, target: 'total' as string, targetLevel: 10, reward: '全资源+50', rewardData: { grain: 50, gold: 50, troops: 50 } },
];

const TABS = [
  { key: 'world', label: '天下' },
  { key: 'campaign', label: '出征' },
  { key: 'hero', label: '武将' },
  { key: 'tech', label: '科技' },
  { key: 'building', label: '建筑' },
  { key: 'prestige', label: '声望' },
  { key: 'more', label: '更多▼' },
];

const GUIDE_STEPS = [
  { title: '欢迎来到三国霸业！', desc: '点击左侧建筑卡片进行升级，提升资源产出。先从「农田」开始吧！', target: 'building' },
  { title: '资源自动增长', desc: '升级建筑后，资源会自动产出。顶部资源栏实时显示当前资源和产出速率。', target: 'resource' },
  { title: '探索更多功能', desc: '后续可招募武将、研究科技、征战天下！点击底部Tab切换不同功能。', target: 'nav' },
];

// ─── 组件 ───
const ThreeKingdomsPixiGame: React.FC = () => {
  // === State ===
  const [activeTab, setActiveTab] = useState('building');
  const [resources, setResources] = useState<Resources>({ grain: 0, gold: 0, troops: 0, mandate: 0 });
  const [rates, setRates] = useState<ProductionRate>({ grain: 0, gold: 0, troops: 0, mandate: 0 });
  const [caps, setCaps] = useState<ResourceCap>({ grain: 2000, gold: null, troops: 500, mandate: null });
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState('全部');
  const [showUpgradeOnly, setShowUpgradeOnly] = useState(false);
  const [upgradeTarget, setUpgradeTarget] = useState<BuildingType | null>(null);
  const [showGuide, setShowGuide] = useState(() => localStorage.getItem('tk_guide_done') !== 'true');
  const [guideStep, setGuideStep] = useState(0);
  const [tasks, setTasks] = useState(INITIAL_TASKS.map(t => ({ ...t, done: false, progress: 0 })));
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: string }[]>([]);
  const engineRef = useRef<ThreeKingdomsEngine | null>(null);
  const toastId = useRef(0);

  // === 从引擎快照同步状态 ===
  const syncFromEngine = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || !engine.isInitialized()) return;

    const snap: EngineSnapshot = engine.getSnapshot();
    setResources({ ...snap.resources });
    setRates({ ...snap.productionRates });
    setCaps({ ...snap.caps });

    const lvls: Record<string, number> = {};
    for (const [bt, state] of Object.entries(snap.buildings)) {
      lvls[bt] = state.level;
    }
    setLevels(lvls);
  }, []);

  // === 引擎初始化 ===
  useEffect(() => {
    const engine = new ThreeKingdomsEngine();
    engineRef.current = engine;

    // 尝试加载存档
    if (engine.hasSaveData()) {
      try {
        engine.load();
      } catch { /* ignore */ }
    }

    engine.init();

    // 监听引擎事件 → 同步 UI 状态
    const onResourceChanged = () => syncFromEngine();
    const onRateChanged = () => syncFromEngine();
    const onBuildingUpgraded = () => syncFromEngine();

    engine.on('resource:changed', onResourceChanged);
    engine.on('resource:rate-changed', onRateChanged);
    engine.on('building:upgraded', onBuildingUpgraded);
    engine.on('building:upgrade-start', onBuildingUpgraded);

    // 初始同步
    syncFromEngine();

    // 每500ms同步一次（确保资源实时更新）
    const syncTimer = setInterval(syncFromEngine, 500);

    // 自动保存（引擎内部已有自动保存机制，此处额外做 localStorage 备份）
    const saveTimer = setInterval(() => {
      try {
        engine.save();
      } catch { /* ignore */ }
    }, 5000);

    return () => {
      clearInterval(syncTimer);
      clearInterval(saveTimer);
      engine.off('resource:changed', onResourceChanged);
      engine.off('resource:rate-changed', onRateChanged);
      engine.off('building:upgraded', onBuildingUpgraded);
      engine.off('building:upgrade-start', onBuildingUpgraded);
    };
  }, [syncFromEngine]);

  // === 任务检查 ===
  useEffect(() => {
    setTasks(prev => prev.map(task => {
      if (task.done) return task;
      let progress = 0;
      if (task.type === 'building') {
        const lv = levels[task.target] ?? 0;
        progress = Math.min(1, lv / task.targetLevel);
        if (lv >= task.targetLevel) {
          addToast(`任务完成：${task.title}，奖励 ${task.reward}`, 'success');
          return { ...task, done: true, progress: 1 };
        }
      } else if (task.type === 'total') {
        const total = Object.values(levels).reduce((s, v) => s + v, 0);
        progress = Math.min(1, total / task.targetLevel);
        if (total >= task.targetLevel) {
          addToast(`任务完成：${task.title}，奖励 ${task.reward}`, 'success');
          return { ...task, done: true, progress: 1 };
        }
      }
      return { ...task, progress };
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levels]);

  // === 升级操作 ===
  const handleUpgrade = useCallback((buildingType: BuildingType) => {
    const engine = engineRef.current;
    if (!engine) return;

    try {
      engine.upgradeBuilding(buildingType);
      const b = BUILDINGS.find(x => x.id === buildingType);
      const newLevel = (levels[buildingType] ?? 0) + 1;
      addToast(`${b?.name ?? buildingType} 升级到 Lv.${newLevel}`, 'success');
    } catch (err: any) {
      addToast(err?.message ?? '升级失败', 'error');
    }
    setUpgradeTarget(null);
  }, [levels]);

  // === Toast ===
  const addToast = useCallback((msg: string, type = 'success') => {
    const id = ++toastId.current;
    setToasts(prev => [...prev.slice(-2), { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  // === 引导关闭 ===
  const closeGuide = useCallback(() => {
    setShowGuide(false);
    localStorage.setItem('tk_guide_done', 'true');
  }, []);

  // === 建筑是否解锁 ===
  const isUnlocked = (buildingId: BuildingType): boolean => {
    const b = BUILDINGS.find(x => x.id === buildingId);
    if (!b) return false;
    if (b.id === 'castle' || b.id === 'farmland') return true;
    // 检查引擎的解锁状态
    const engine = engineRef.current;
    if (!engine) return false;
    const snap = engine.getSnapshot();
    const castleLevel = snap.buildings.castle.level;
    const unlockMap: Record<string, number> = {
      castle: 0, farmland: 0, market: 2, barracks: 2,
      smithy: 3, academy: 3, clinic: 4, wall: 5,
    };
    return castleLevel >= (unlockMap[buildingId] ?? 0);
  };

  // === 获取升级费用（从引擎获取） ===
  const getCostForBuilding = (buildingType: BuildingType): UpgradeCost | null => {
    const engine = engineRef.current;
    if (!engine) return null;
    return engine.getUpgradeCost(buildingType);
  };

  // === 检查是否可升级 ===
  const canUpgradeBuilding = (buildingType: BuildingType): boolean => {
    const engine = engineRef.current;
    if (!engine) return false;
    const check = engine.checkUpgrade(buildingType);
    return check.canUpgrade;
  };

  // === 获取建筑产出速率 ===
  const getRate = (buildingId: BuildingType): string => {
    const b = BUILDINGS.find(x => x.id === buildingId);
    if (!b || !b.produces) return '';
    const rate = rates[b.produces as keyof ProductionRate] ?? 0;
    if (rate <= 0) return '';
    return `+${rate.toFixed(1)}/s`;
  };

  // === 格式化费用 ===
  const formatUpgradeCost = (cost: UpgradeCost): string => {
    const parts: string[] = [];
    if (cost.grain > 0) parts.push(`🌾${cost.grain}`);
    if (cost.gold > 0) parts.push(`💰${cost.gold}`);
    if (cost.troops > 0) parts.push(`⚔️${cost.troops}`);
    return parts.join(' ');
  };

  // === 筛选建筑 ===
  const filteredBuildings = BUILDINGS.filter(b => {
    if (filter !== '全部' && b.category !== filter) return false;
    if (showUpgradeOnly) {
      if (!isUnlocked(b.id)) return false;
      const lv = levels[b.id] ?? 0;
      const maxLv = b.id === 'castle' ? 30 : b.id === 'farmland' || b.id === 'market' || b.id === 'barracks' ? 25 : 20;
      if (lv >= maxLv) return false;
      return canUpgradeBuilding(b.id);
    }
    return true;
  });

  // === 渲染 ===
  return (
    <div className="tk-container">
      {/* ── 顶部资源栏 1280×56px ── */}
      <header className="tk-resource-bar">
        <div className="tk-game-title">三国霸业</div>
        <div className="tk-resources">
          {Object.entries(RESOURCE_DEFS).map(([id, def]) => {
            const amount = resources[id as keyof Resources] ?? 0;
            const rate = rates[id as keyof ProductionRate] ?? 0;
            const cap = caps[id as keyof ResourceCap];
            const pct = cap ? Math.min(100, (amount / cap) * 100) : null;
            const barColor = pct === null ? def.color : pct > 95 ? '#B8423A' : pct > 80 ? '#D4A017' : def.color;
            return (
              <div key={id} className="tk-resource-item">
                <span className="tk-resource-icon">{def.icon}</span>
                <span className="tk-resource-value" style={{ color: def.color }}>
                  {Math.floor(amount).toLocaleString()}
                </span>
                {cap && (
                  <>
                    <span className="tk-resource-cap">/{cap.toLocaleString()}</span>
                    <div className="tk-resource-bar-track">
                      <div className="tk-resource-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
                    </div>
                  </>
                )}
                {rate > 0 && <span className="tk-resource-rate">+{rate.toFixed(1)}/s</span>}
              </div>
            );
          })}
        </div>
      </header>

      {/* ── 导航Tab栏 1280×48px ── */}
      <nav className="tk-nav-bar">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`tk-tab ${activeTab === tab.key ? 'tk-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* ── 中央场景区 1280×696px ── */}
      <main className="tk-scene">
        {activeTab === 'building' ? renderBuildingScene() : renderPlaceholder()}
      </main>

      {/* ── 升级确认弹窗 ── */}
      {upgradeTarget && renderUpgradeModal()}

      {/* ── 任务面板（建筑场景右上角） ── */}
      {activeTab === 'building' && renderTaskPanel()}

      {/* ── 新手引导 ── */}
      {showGuide && renderGuide()}

      {/* ── Toast通知 ── */}
      <div className="tk-toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`tk-toast tk-toast-${t.type}`}>{t.msg}</div>
        ))}
      </div>
    </div>
  );

  // ─── 建筑场景 ───
  function renderBuildingScene() {
    const categories = ['全部', '民生', '军事', '文教', '防御', '核心'];
    return (
      <div className="tk-building-scene">
        {/* 筛选栏 */}
        <div className="tk-building-filter">
          <div className="tk-filter-categories">
            {categories.map(c => (
              <button key={c} className={`tk-filter-btn ${filter === c ? 'tk-filter-active' : ''}`}
                onClick={() => setFilter(c)}>{c}</button>
            ))}
          </div>
          <label className="tk-filter-upgrade">
            <input type="checkbox" checked={showUpgradeOnly} onChange={e => setShowUpgradeOnly(e.target.checked)} />
            <span>可升级</span>
          </label>
        </div>

        {/* 建筑网格 */}
        <div className="tk-building-grid">
          {filteredBuildings.map(b => {
            const lv = levels[b.id] ?? 0;
            const unlocked = isUnlocked(b.id);
            const maxLv = b.id === 'castle' ? 30 : b.id === 'farmland' || b.id === 'market' || b.id === 'barracks' ? 25 : 20;
            const canAfford = canUpgradeBuilding(b.id);
            const maxed = lv >= maxLv;
            const rate = getRate(b.id);
            const cost = getCostForBuilding(b.id);

            return (
              <div key={b.id} className={`tk-building-card ${!unlocked ? 'tk-building-locked' : ''}`}>
                <div className="tk-building-icon">{b.icon}</div>
                <div className="tk-building-info">
                  <div className="tk-building-name">
                    {b.name}
                    <span className="tk-building-level">Lv.{lv}</span>
                  </div>
                  {rate && <div className="tk-building-rate">{rate} {RESOURCE_DEFS[b.produces!]?.name ?? ''}</div>}
                </div>
                {!unlocked ? (
                  <div className="tk-building-lock-info">
                    🔒 需要主城Lv.{({ market: 2, barracks: 2, smithy: 3, academy: 3, clinic: 4, wall: 5 } as Record<string, number>)[b.id] ?? 0}
                  </div>
                ) : maxed ? (
                  <div className="tk-building-maxed">已满级</div>
                ) : (
                  <button
                    className={`tk-building-upgrade-btn ${!canAfford ? 'tk-btn-disabled' : ''}`}
                    onClick={() => setUpgradeTarget(b.id)}
                    disabled={!canAfford}
                  >
                    ▲ 升级 {cost ? formatUpgradeCost(cost) : ''}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── 升级弹窗 ───
  function renderUpgradeModal() {
    const b = BUILDINGS.find(x => x.id === upgradeTarget);
    if (!b) return null;
    const lv = levels[b.id] ?? 0;
    const cost = getCostForBuilding(b.id);
    const canAfford = canUpgradeBuilding(b.id);
    const currentRate = b.produces ? (rates[b.produces as keyof ProductionRate] ?? 0) : 0;

    return (
      <div className="tk-modal-overlay" onClick={() => setUpgradeTarget(null)}>
        <div className="tk-modal" onClick={e => e.stopPropagation()}>
          <button className="tk-modal-close" onClick={() => setUpgradeTarget(null)}>✕</button>
          <h3 className="tk-modal-title">升级 {b.icon} {b.name}</h3>
          <div className="tk-modal-body">
            <div className="tk-modal-level">
              <span>Lv.{lv}</span>
              <span className="tk-modal-arrow">→</span>
              <span className="tk-modal-next">Lv.{lv + 1}</span>
            </div>
            {b.produces && (
              <div className="tk-modal-rate">
                当前产出：+{currentRate.toFixed(1)}/s
              </div>
            )}
            {cost && (
              <div className="tk-modal-cost">
                <div className="tk-modal-cost-title">消耗：</div>
                {cost.grain > 0 && (
                  <div className={`tk-modal-cost-item ${resources.grain < cost.grain ? 'tk-text-red' : ''}`}>
                    🌾 {cost.grain} ({Math.floor(resources.grain)})
                  </div>
                )}
                {cost.gold > 0 && (
                  <div className={`tk-modal-cost-item ${resources.gold < cost.gold ? 'tk-text-red' : ''}`}>
                    💰 {cost.gold} ({Math.floor(resources.gold)})
                  </div>
                )}
                {cost.troops > 0 && (
                  <div className={`tk-modal-cost-item ${resources.troops < cost.troops ? 'tk-text-red' : ''}`}>
                    ⚔️ {cost.troops} ({Math.floor(resources.troops)})
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="tk-modal-actions">
            <button className="tk-btn-cancel" onClick={() => setUpgradeTarget(null)}>取消</button>
            <button className="tk-btn-confirm" disabled={!canAfford} onClick={() => handleUpgrade(b.id)}>
              确认升级
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── 任务面板 ───
  function renderTaskPanel() {
    const currentTask = tasks.find(t => !t.done);
    const doneCount = tasks.filter(t => t.done).length;
    return (
      <div className="tk-task-panel">
        <div className="tk-task-title">📋 当前任务</div>
        {currentTask ? (
          <>
            <div className="tk-task-name">{currentTask.title}</div>
            <div className="tk-task-progress-bar">
              <div className="tk-task-progress-fill" style={{ width: `${currentTask.progress * 100}%` }} />
            </div>
            <div className="tk-task-reward">🎁 {currentTask.reward}</div>
          </>
        ) : (
          <div className="tk-task-done">🎉 所有任务已完成！</div>
        )}
        <div className="tk-task-count">{doneCount}/{tasks.length} 完成</div>
      </div>
    );
  }

  // ─── 占位Tab ───
  function renderPlaceholder() {
    const tab = TABS.find(t => t.key === activeTab);
    return (
      <div className="tk-placeholder">
        <div className="tk-placeholder-icon">🏗️</div>
        <div className="tk-placeholder-text">{tab?.label ?? ''}功能即将开放</div>
        <div className="tk-placeholder-sub">敬请期待下个版本更新</div>
      </div>
    );
  }

  // ─── 新手引导 ───
  function renderGuide() {
    const step = GUIDE_STEPS[guideStep];
    return (
      <div className="tk-guide-overlay">
        <div className="tk-guide-panel">
          <button className="tk-guide-skip" onClick={closeGuide}>✕ 跳过</button>
          <h3 className="tk-guide-title">{step.title}</h3>
          <p className="tk-guide-desc">{step.desc}</p>
          <div className="tk-guide-dots">
            {GUIDE_STEPS.map((_, i) => (
              <span key={i} className={`tk-guide-dot ${i === guideStep ? 'tk-guide-dot-active' : ''}`} />
            ))}
          </div>
          <button className="tk-guide-next" onClick={() => {
            if (guideStep < GUIDE_STEPS.length - 1) setGuideStep(guideStep + 1);
            else closeGuide();
          }}>
            {guideStep < GUIDE_STEPS.length - 1 ? '下一步' : '开始游戏'}
          </button>
        </div>
      </div>
    );
  }
};

export default ThreeKingdomsPixiGame;
