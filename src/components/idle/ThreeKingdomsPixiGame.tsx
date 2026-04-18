/**
 * 三国霸业 v2.0「基业初立」— 放置策略游戏 UI 组件
 *
 * 纯 React + CSS 实现（无 Canvas / PixiJS）。
 * 固定尺寸 1280×800，居中显示。
 *
 * 布局：
 * - 顶部资源栏：1280 × 56px (y=0)
 * - 导航Tab栏：1280 × 48px (y=56)
 * - 中央场景区：1280 × 696px (y=104)
 *
 * 架构：
 * - ThreeKingdomsEngine 驱动游戏逻辑
 * - React state 驱动 UI 渲染
 * - 引擎事件 stateChange → 同步资源/建筑到 React state
 * - setInterval 驱动引擎 update()（因 GameEngine.start() 需要 canvas）
 * - 5 秒自动存档到 localStorage
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import './ThreeKingdomsPixiGame.css';
import { ThreeKingdomsEngine } from '@/games/three-kingdoms/ThreeKingdomsEngine';
import {
  BUILDINGS,
  RESOURCES,
  type BuildingDef,
} from '@/games/three-kingdoms/constants';

// ═══════════════════════════════════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════════════════════════════════

/** 资源显示配置：引擎资源ID → UI 展示信息 */
const RESOURCE_UI: Record<string, { name: string; icon: string; color: string; hasCap: boolean; capId?: string }> = {
  grain:   { name: '粮草', icon: '🌾', color: '#7EC850', hasCap: true,  capId: 'grain_cap' },
  gold:    { name: '铜钱', icon: '💰', color: '#C9A84C', hasCap: false },
  troops:  { name: '兵力', icon: '⚔️', color: '#B8423A', hasCap: true,  capId: 'troops_cap' },
  destiny: { name: '天命', icon: '🏆', color: '#9B6FD0', hasCap: false },
};

/** 顶部栏显示的资源顺序 */
const TOP_RESOURCES = ['grain', 'gold', 'troops', 'destiny'];

/**
 * 资源图标映射（用于费用显示）
 * 优先从 RESOURCES 常量构建，同时提供硬编码 fallback 确保不遗漏
 */
const RESOURCE_ICONS: Record<string, string> = {
  grain: '🌾', gold: '💰', iron: '⛏️', wood: '🪵',
  troops: '⚔️', destiny: '👑', morale: '🏮',
  copper: '🪙',
};
for (const r of RESOURCES) {
  RESOURCE_ICONS[r.id] = r.icon;
}

/** 8个核心建筑ID（设计稿要求 4×2 网格） */
const CORE_BUILDING_IDS = [
  'farm',         // 屯田
  'market',       // 商行
  'barracks',     // 军营
  'smithy',       // 铁匠铺
  'academy',      // 太学
  'wall',         // 城墙（城防）
  'beacon_tower', // 烽火台
  'granary',      // 官府（粮仓）
];

/** 建筑功能描述（卡片小字） */
const BUILDING_DESC: Record<string, string> = {
  farm: '生产粮草',
  market: '赚取铜钱',
  barracks: '训练兵力',
  smithy: '锻造装备',
  academy: '研究科技',
  wall: '防御城池',
  beacon_tower: '预警侦察',
  granary: '储存粮草',
};

/** 建筑分类筛选 */
type BuildingCategory = '全部' | '民生' | '军事' | '文教' | '防御' | '核心';

/** 建筑分类映射（引擎 category → 中文分类） */
const CATEGORY_MAP: Record<string, BuildingCategory> = {
  resource: '民生',
  economic: '民生',
  military: '军事',
  civilian: '文教',
};

/** Tab 定义 */
const TABS = [
  { key: 'world',    label: '🌍 天下' },
  { key: 'campaign', label: '⚔️ 出征' },
  { key: 'generals', label: '🗡️ 武将' },
  { key: 'tech',     label: '📜 科技' },
  { key: 'buildings',label: '🏗️ 建筑' },
  { key: 'prestige', label: '🏆 声望' },
  { key: 'more',     label: '更多▼' },
];

/** 新手引导步骤 */
const GUIDE_STEPS = [
  { title: '欢迎来到三国霸业！', desc: '这是一款三国主题的放置策略游戏。点击建筑可以升级，提升资源产出。让我们开始吧！' },
  { title: '升级建筑', desc: '点击任意建筑卡片，查看升级详情。消耗资源升级建筑，提升对应资源的产出速率。' },
  { title: '查看资源', desc: '顶部资源栏实时显示粮草、铜钱、兵力、天命四种资源。进度条会根据存储量变色预警。' },
];

/** 新手任务定义（设计稿要求的4个任务） */
const INITIAL_TASKS = [
  { id: 1, title: '建造第一座建筑',    type: 'building' as const, target: 'farm',    targetLevel: 1,  reward: '粮草+50' },
  { id: 2, title: '升级建筑到2级',      type: 'building' as const, target: 'farm',    targetLevel: 2,  reward: '铜钱+100' },
  { id: 3, title: '招募第一位武将',     type: 'total' as const,    target: 'total',    targetLevel: 99, reward: '天命+10' },
  { id: 4, title: '完成第一个关卡',     type: 'total' as const,    target: 'total',    targetLevel: 99, reward: '全资源+50' },
];

/** 武将阵营筛选 */
type GeneralFaction = '全部' | '蜀' | '魏' | '吴';

// ═══════════════════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════════════════

/** 格式化大数 */
function fmtNum(n: number): string {
  if (n < 0) return '-' + fmtNum(-n);
  if (!isFinite(n)) return '∞';
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9)  return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6)  return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3)  return (n / 1e3).toFixed(1) + 'K';
  return n < 10 ? n.toFixed(1) : Math.floor(n).toString();
}

/** 进度条颜色 */
function barColor(ratio: number): string {
  if (ratio > 0.95) return '#E05545';
  if (ratio > 0.80) return '#E8B830';
  return '#8ED860';
}

/** 获取建筑分类 */
function getCategory(def: BuildingDef): BuildingCategory {
  if (def.id === 'farm' || def.id === 'granary') return '民生';
  return CATEGORY_MAP[def.category ?? ''] ?? '核心';
}

/** 获取缺失资源的获取途径提示 */
function getResourceTip(resourceId: string): string {
  switch (resourceId) {
    case 'grain': return '升级屯田增加粮草产出';
    case 'gold': return '升级商行增加铜钱产出';
    case 'troops': return '升级军营增加兵力产出';
    case 'iron': return '升级铁匠铺增加铁矿产出（需先建军营）';
    case 'wood': return '升级城防增加木材产出（需先建军营）';
    case 'destiny': return '升级太学增加天命产出';
    case 'morale': return '升级药庐增加民心产出';
    default: return '';
  }
}

/** 资源中文名映射 */
const RESOURCE_NAMES: Record<string, string> = {
  grain: '粮草', gold: '铜钱', iron: '铁矿', wood: '木材',
  troops: '兵力', destiny: '天命', morale: '民心', copper: '铜币',
};
for (const r of RESOURCES) {
  RESOURCE_NAMES[r.id] = r.name;
}

// ═══════════════════════════════════════════════════════════════════════════
// Toast 类型
// ═══════════════════════════════════════════════════════════════════════════

interface Toast {
  id: number;
  msg: string;
  type: 'success' | 'error' | 'info';
}

// ═══════════════════════════════════════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════════════════════════════════════

const ThreeKingdomsPixiGame: React.FC = () => {
  // ─── 引擎 ───
  const engineRef = useRef<ThreeKingdomsEngine | null>(null);
  const toastIdRef = useRef(0);

  // ─── UI 状态 ───
  const [resources, setResources] = useState<Record<string, number>>({});
  const [rates, setRates] = useState<Record<string, number>>({});
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [unlocked, setUnlocked] = useState<Record<string, boolean>>({});

  const [activeTab, setActiveTab] = useState('buildings');
  const [tabFade, setTabFade] = useState(false);
  const switchTab = useCallback((key: string) => {
    if (key === activeTab) return;
    setTabFade(true);
    setTimeout(() => { setActiveTab(key); setTabFade(false); }, 150);
  }, [activeTab]);
  const [category, setCategory] = useState<BuildingCategory>('全部');
  const [showUpgradeable, setShowUpgradeable] = useState(false);
  const [upgradeModal, setUpgradeModal] = useState<string | null>(null);

  const [showGuide, setShowGuide] = useState(() => localStorage.getItem('tk_guide_done') !== 'true');
  const [guideStep, setGuideStep] = useState(0);

  const [tasks, setTasks] = useState(INITIAL_TASKS.map(t => ({ ...t, done: false, progress: 0 })));
  const [toasts, setToasts] = useState<Toast[]>([]);

  // ─── 资源飘字 ───
  const prevResourcesRef = useRef<Record<string, number>>({});
  const [floatTexts, setFloatTexts] = useState<{ id: number; text: string; color: string }[]>([]);

  // ─── Toast ───
  const addToast = useCallback((msg: string, type: Toast['type'] = 'info') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  // ─── 引擎初始化 ───
  useEffect(() => {
    const engine = new ThreeKingdomsEngine();
    engineRef.current = engine;

    // 加载存档
    const saved = localStorage.getItem('tk_autosave');
    if (saved) {
      try {
        engine.deserialize(JSON.parse(saved));
      } catch {
        /* 存档损坏则忽略 */
      }
    }

    // 初始化引擎（不传 canvas，因为纯 React UI）
    engine.init();

    // 手动设置状态为 playing（因 GameEngine.start() 需要 canvas，此处绕过）
    (engine as any)._status = 'playing';

    // 手动启动游戏循环（因 GameEngine.start() 需要 canvas）
    // 直接通过 setInterval 驱动 update()
    const TICK_MS = 100; // 100ms 刷新一次
    const tickTimer = setInterval(() => {
      try {
        engine.update(TICK_MS);
      } catch {
        /* update 可能因内部状态异常报错 */
      }
    }, TICK_MS);

    // 监听引擎状态变化 → 同步到 React state
    const syncState = () => {
      if (!engine) return;
      const res = engine.getResources();
      const rts = engine.getProductionCache();
      const bldg = engine.getBuildingSystem();

      const lvls: Record<string, number> = {};
      const unlk: Record<string, boolean> = {};
      for (const def of BUILDINGS) {
        lvls[def.id] = bldg.getLevel(def.id);
        unlk[def.id] = bldg.isUnlocked(def.id);
      }

      setResources(res);
      setRates(rts);
      setLevels(lvls);
      setUnlocked(unlk);
    };

    engine.on('stateChange', syncState);
    syncState(); // 初始同步

    // 自动存档（5 秒）
    const saveTimer = setInterval(() => {
      try {
        const data = engine.serialize();
        localStorage.setItem('tk_autosave', JSON.stringify(data));
      } catch {
        /* 存储满或不可用 */
      }
    }, 5000);

    return () => {
      clearInterval(tickTimer);
      clearInterval(saveTimer);
      engine.off('stateChange', syncState);
      // 最终存档
      try {
        const data = engine.serialize();
        localStorage.setItem('tk_autosave', JSON.stringify(data));
      } catch { /* ignore */ }
    };
  }, []);

  // ─── 任务进度检查 ───
  // 用 ref 记录已触发 Toast 的任务 ID，避免与 handleUpgrade 的建造成功 Toast 重复
  const toastedTaskIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    setTasks(prev =>
      prev.map(task => {
        if (task.done) return task;
        let progress = 0;
        if (task.type === 'building') {
          const lv = levels[task.target] ?? 0;
          progress = Math.min(1, lv / task.targetLevel);
          if (lv >= task.targetLevel) {
            if (!toastedTaskIdsRef.current.has(task.id)) {
              toastedTaskIdsRef.current.add(task.id);
              addToast(`任务完成：${task.title} — ${task.reward}`, 'success');
            }
            return { ...task, done: true, progress: 1 };
          }
        } else if (task.type === 'total') {
          const total = Object.values(levels).reduce((s, v) => s + v, 0);
          progress = Math.min(1, total / task.targetLevel);
          if (total >= task.targetLevel) {
            if (!toastedTaskIdsRef.current.has(task.id)) {
              toastedTaskIdsRef.current.add(task.id);
              addToast(`任务完成：${task.title} — ${task.reward}`, 'success');
            }
            return { ...task, done: true, progress: 1 };
          }
        }
        return { ...task, progress };
      }),
    );
  }, [levels, addToast]);

  // ─── 资源飘字动效 ───
  const floatColorsRef = useRef<Record<string, string>>({
    grain: '#7EC850', gold: '#C9A84C', troops: '#B8423A', destiny: '#9B6FD0',
  });

  useEffect(() => {
    const prev = prevResourcesRef.current;
    const floats: { id: number; text: string; color: string }[] = [];

    TOP_RESOURCES.forEach(key => {
      const val = resources[key] ?? 0;
      const prevVal = prev[key];
      if (prevVal !== undefined && val > prevVal) {
        const diff = Math.floor(val - prevVal);
        if (diff > 0) {
          floats.push({
            id: Date.now() + Math.random(),
            text: `+${diff}`,
            color: floatColorsRef.current[key] ?? '#C9A84C',
          });
        }
      }
    });

    prevResourcesRef.current = { ...resources };

    if (floats.length > 0) {
      setFloatTexts(floats);
      setTimeout(() => setFloatTexts([]), 1200);
    }
  }, [resources]);

  // ─── ESC 关闭弹窗 ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUpgradeModal(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ─── 建筑升级 ───
  const handleUpgrade = useCallback(
    (buildingId: string) => {
      const engine = engineRef.current;
      if (!engine) return;

      const bldg = engine.getBuildingSystem();
      const def = bldg.getDef(buildingId);
      if (!def) return;

      const currentLevel = bldg.getLevel(buildingId);
      let success: boolean;

      if (currentLevel < 1) {
        success = engine.buyBuildingById(buildingId);
      } else {
        success = engine.upgradeBuilding(buildingId);
      }

      if (success) {
        // 更醒目的Toast消息，包含产出提升信息
        const nextLevel = currentLevel + 1;
        const nextRate = nextLevel * def.baseProduction;
        const currentRate = currentLevel * def.baseProduction;
        const pctIncrease = currentRate > 0 ? Math.round(((nextRate - currentRate) / currentRate) * 100) : 100;
        const resourceName = RESOURCE_UI[def.productionResource]?.name ?? '';
        addToast(`🎉 ${def.name}升级到Lv.${nextLevel}！${resourceName}产出+${pctIncrease}%`, 'success');
        setUpgradeModal(null);

        // 升级成功后给对应建筑卡片添加闪烁动画
        setTimeout(() => {
          const card = document.querySelector(`[data-building-id="${buildingId}"]`);
          if (card) {
            card.classList.add('tk-upgrade-flash');
            setTimeout(() => card.classList.remove('tk-upgrade-flash'), 600);
          }
        }, 50);
      } else {
        const bldgSys = engine.getBuildingSystem();
        const cost = bldgSys.getCost(buildingId);
        const res = engine.getResources();
        const shortage = Object.entries(cost).find(([rid, amt]) => (res[rid] ?? 0) < amt);
        const tipMap: Record<string, string> = { grain: '升级屯田增加粮草产出', gold: '升级商行增加铜钱产出', troops: '升级军营增加兵力', iron: '升级铁匠铺增加铁矿产出', wood: '升级城墙增加木材产出' };
        const tip = tipMap[shortage?.[0] ?? ''] ?? '升级对应产出建筑';
        const nameMap: Record<string, string> = { grain: '粮草', gold: '铜钱', troops: '兵力', iron: '铁矿', wood: '木材' };
        addToast(`${nameMap[shortage?.[0] ?? ''] ?? '资源'}不足，${tip}`, 'error');
      }
    },
    [addToast],
  );

  // ─── 筛选建筑（仅显示8个核心建筑） ───
  const filteredBuildings = BUILDINGS.filter(def => {
    if (!CORE_BUILDING_IDS.includes(def.id)) return false;
    if (category !== '全部' && getCategory(def) !== category) return false;
    if (showUpgradeable && !unlocked[def.id]) return false;
    return true;
  });

  // ─── 当前任务 ───
  const currentTask = tasks.find(t => !t.done);
  const completedTasks = tasks.filter(t => t.done).length;

  // ─── 主公等级计算 ───
  const totalLevel = Object.values(levels).reduce((s, v) => s + v, 0);
  const lordLevel = Math.floor(totalLevel / 10);
  const progressInLevel = totalLevel % 10;
  const lordProgressPercent = Math.min(100, (progressInLevel / 10) * 100);

  // ═══════════════════════════════════════════════════════════════════════════
  // 渲染
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className={`tk-container ${showGuide && guideStep < GUIDE_STEPS.length ? `tk-guide-step-${guideStep}` : ''}`}>

      {/* ═══════ 1. 顶部资源栏 (1280 × 56px) ═══════ */}
      <div className="tk-resource-bar">
        <span className="tk-game-title">三国霸业</span>

        <div className="tk-lord-info">
          <span className="tk-lord-level">Lv.{lordLevel}</span>
          <div className="tk-lord-bar-track">
            <div className="tk-lord-bar-fill" style={{ width: `${lordProgressPercent}%` }} />
          </div>
          <span className="tk-lord-progress-text">{progressInLevel}/10</span>
        </div>

        <div className="tk-resources">
          {TOP_RESOURCES.map(id => {
            const ui = RESOURCE_UI[id];
            if (!ui) return null;
            const val = resources[id] ?? 0;
            const rate = rates[id] ?? 0;
            const cap = ui.hasCap ? (resources[ui.capId ?? ''] ?? 999) : 0;
            const rawRatio = ui.hasCap && cap > 0 ? Math.min(1, val / cap) : 0;
            const barRatio = ui.hasCap ? Math.max(rawRatio, val > 0 ? 0.02 : 0) : 0;
            return (
              <div key={id} className="tk-resource-item" style={{ position: 'relative' }}>
                <span className="tk-resource-icon">{ui.icon}</span>
                <span className="tk-resource-value" style={{ color: ui.color }}>
                  {fmtNum(val)}
                </span>
                {ui.hasCap && (
                  <span className="tk-resource-cap">/{fmtNum(cap)}</span>
                )}
                {ui.hasCap && (
                  <div className="tk-resource-bar-track">
                    <div
                      className="tk-resource-bar-fill"
                      style={{
                        width: `${barRatio * 100}%`,
                        background: `linear-gradient(90deg, ${barColor(barRatio)}aa, ${barColor(barRatio)})`,
                      }}
                    />
                  </div>
                )}
                <span className={`tk-resource-rate ${rate <= 0 ? 'tk-resource-rate-zero' : ''}`}>
                  +{fmtNum(rate)}/s
                </span>
                {/* 资源飘字 */}
                {floatTexts.filter(f => f.color === ui.color).map(f => (
                  <span
                    key={f.id}
                    className="tk-float-text"
                    style={{ color: f.color, top: -4, left: 10 }}
                  >
                    {f.text}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════ 2. 导航 Tab 栏 (1280 × 48px) ═══════ */}
      <div className="tk-nav-bar">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`tk-tab ${activeTab === tab.key ? 'tk-tab-active' : ''}`}
            onClick={() => switchTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════ 3. 中央场景区 (1280 × 696px) ═══════ */}
      <div className={`tk-scene${tabFade ? ' tk-scene-fade' : ''}`}>

        {/* ─── 建筑 Tab ─── */}
        {activeTab === 'buildings' && (
          <div className="tk-building-scene">
            {/* 左侧：筛选 + 建筑网格 */}
            <div className="tk-building-main">
              <div className="tk-building-title">城 池 建 设</div>

              <div className="tk-building-filter">
                <div className="tk-filter-categories">
                  {(['全部', '民生', '军事', '文教', '防御', '核心'] as BuildingCategory[]).map(cat => (
                    <button
                      key={cat}
                      className={`tk-filter-btn ${category === cat ? 'tk-filter-active' : ''}`}
                      onClick={() => setCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <label className="tk-filter-upgrade">
                  <input
                    type="checkbox"
                    checked={showUpgradeable}
                    onChange={e => setShowUpgradeable(e.target.checked)}
                  />
                  可升级
                </label>
              </div>

              <div className="tk-building-grid">
                {filteredBuildings.map(def => {
                  const lv = levels[def.id] ?? 0;
                  const isUnlocked = unlocked[def.id] ?? false;
                  const rate = lv > 0 ? rates[def.productionResource] ?? 0 : 0;
                  const bldg = engineRef.current?.getBuildingSystem();
                  const cost = bldg?.getCost(def.id) ?? {};
                  const canAfford = Object.entries(cost).every(
                    ([rid, amt]) => (resources[rid] ?? 0) >= amt,
                  );

                  return (
                    <div
                      key={def.id}
                      className={`tk-building-card ${!isUnlocked ? 'tk-building-locked' : ''}`}
                      data-category={getCategory(def)}
                      data-type={def.id}
                      data-built={lv > 0 ? 'true' : undefined}
                      data-building-id={def.id}
                      data-level={lv > 0 ? String(lv) : undefined}
                      onClick={() => isUnlocked && setUpgradeModal(def.id)}
                    >
                      <div className="tk-building-icon" data-icon-cat={getCategory(def)}>
                        {def.icon}
                        {lv >= 3 && <span className="tk-star">✨</span>}
                        {lv >= 6 && <span className="tk-star">🌟</span>}
                      </div>
                      <div className="tk-building-info">
                        <div className="tk-building-name">
                          {def.name}
                          {lv > 0 && <span className="tk-building-level">Lv.{lv}</span>}
                        </div>
                        <div className="tk-building-desc">{BUILDING_DESC[def.id] ?? ''}</div>
                        {isUnlocked ? (
                          <>
                            {lv > 0 && def.productionResource && (
                              <div className="tk-building-rate">
                                +{fmtNum(rate)}/s {RESOURCE_ICONS[def.productionResource] ?? ''}
                              </div>
                            )}
                            {lv > 0 && lv < 10 && (() => {
                              /* 等级进度条：以当前等级在当前段的进度表示 */
                              const tierStart = lv <= 2 ? 1 : lv <= 5 ? 3 : 6;
                              const tierEnd = lv <= 2 ? 2 : lv <= 5 ? 5 : 10;
                              const progress = Math.min(100, ((lv - tierStart) / Math.max(1, tierEnd - tierStart)) * 100);
                              return (
                                <div className="tk-building-progress">
                                  <div className="tk-building-progress-bar" style={{ width: `${progress}%` }} />
                                </div>
                              );
                            })()}
                            {lv === 0 && (
                              <div className="tk-building-unbuilt">
                                <span className="tk-building-unbuilt-icon">🏗️</span>
                                <span>未建造</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="tk-building-lock-info">
                            {(() => {
                              const engine = engineRef.current;
                              if (!engine) return <>🔒 {def.unlockCondition ?? '条件未满足'}</>;
                              const details = engine.getUnlockConditionDetails(def.id);
                              if (details.length === 0) {
                                return <>🔒 {def.unlockCondition ?? '条件未满足'}</>;
                              }
                              return (
                                <div className="tk-unlock-condition">
                                  <div className="tk-unlock-title">🔒 解锁条件</div>
                                  {details.map(d => (
                                    <div key={d.buildingId} className={d.met ? 'tk-condition-met' : 'tk-condition-unmet'}>
                                      {d.met ? '✅' : '❌'} {d.buildingName} Lv.{d.requiredLevel}
                                      {!d.met && d.currentLevel > 0 && (
                                        <span className="tk-condition-detail"> (当前 Lv.{d.currentLevel}，还需升级{d.requiredLevel - d.currentLevel}级)</span>
                                      )}
                                      {!d.met && d.currentLevel === 0 && (
                                        <span className="tk-condition-detail"> (未建造)</span>
                                      )}
                                      {d.met && d.currentLevel > d.requiredLevel && (
                                        <span className="tk-condition-detail"> (当前 Lv.{d.currentLevel})</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                      {isUnlocked && (
                        <button
                          className={`tk-building-upgrade-btn ${!canAfford ? 'tk-btn-disabled' : ''}`}
                          onClick={e => {
                            e.stopPropagation();
                            if (canAfford) setUpgradeModal(def.id);
                            else {
                              const res = engineRef.current?.getResources() ?? {};
                              const cost2 = bldg?.getCost(def.id) ?? {};
                              const shortage = Object.entries(cost2).find(([rid, amt]) => (res[rid] ?? 0) < amt);
                              const nameMap: Record<string, string> = { grain: '粮草', gold: '铜钱', troops: '兵力', iron: '铁矿', wood: '木材' };
                              const tipMap: Record<string, string> = { grain: '升级屯田', gold: '升级商行', troops: '升级军营', iron: '升级铁匠铺', wood: '升级城墙' };
                              addToast(`${nameMap[shortage?.[0] ?? ''] ?? '资源'}不足，${tipMap[shortage?.[0] ?? ''] ?? '升级产出建筑'}`, 'error');
                            }
                          }}
                        >
                          升级{' '}
                          {Object.entries(cost)
                            .map(([rid, amt]) => `${RESOURCE_ICONS[rid] ?? rid}${fmtNum(amt)}`)
                            .join(' ')}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 右侧：任务面板 — flex 并排，不浮在建筑上方 */}
            <div className="tk-task-panel">
              <div className="tk-task-title">📜 新手任务</div>
              {tasks.map(task => {
                const progressText = task.type === 'building'
                  ? `${Math.min(levels[task.target] ?? 0, task.targetLevel)}/${task.targetLevel}`
                  : task.done ? '1/1' : '0/1';
                return (
                  <div key={task.id} className={`tk-task-item ${task.done ? 'tk-task-item-done' : ''}`}>
                    <div className="tk-task-name">
                      {task.done ? '✅' : '⬜'} {task.title} ({progressText})
                    </div>
                    {!task.done && task.progress > 0 && (
                      <div className="tk-task-progress-text">{Math.round(task.progress * 100)}%</div>
                    )}
                    <div className="tk-task-progress-bar">
                      <div
                        className="tk-task-progress-fill"
                        style={{ width: `${Math.max(task.progress * 100, task.progress > 0 ? 2 : 0)}%` }}
                      />
                    </div>
                    <div className="tk-task-reward">
                      🎁 {task.reward}
                      {task.done && <span className="tk-task-completed"> 已领取</span>}
                    </div>
                  </div>
                );
              })}
              <div className="tk-task-count">
                {completedTasks}/{tasks.length}
              </div>
            </div>
          </div>
        )}

        {/* ─── 天下 Tab — 世界地图占位，绝对不显示武将信息 ─── */}
        {activeTab === 'world' && (
          <div className="tk-world-scene">
            <div className="tk-world-map-frame">
              <div className="tk-placeholder-icon-lg">🗺️</div>
              <div className="tk-placeholder-title">天下大势系统</div>
              <div className="tk-placeholder-subtitle">查看三国地图，征战天下，群雄逐鹿</div>
              <div className="tk-placeholder-badge">即将开放</div>
              <button
                className="tk-placeholder-nav-btn"
                onClick={() => switchTab('buildings')}
              >
                前往建筑Tab开始建设 →
              </button>
            </div>
          </div>
        )}

        {/* ─── 武将 Tab — 武将名册只在这里显示 ─── */}
        {activeTab === 'generals' && (
          <div className="tk-generals-scene">
            <div className="tk-generals-title">武 将 名 册</div>
            <div className="tk-generals-filter">
              {(['全部', '蜀', '魏', '吴'] as GeneralFaction[]).map(faction => (
                <button
                  key={faction}
                  className={`tk-filter-btn ${faction === '全部' ? 'tk-filter-active' : ''}`}
                >
                  {faction}
                </button>
              ))}
            </div>
            <div className="tk-generals-grid">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="tk-general-slot">
                  武将系统开发中
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── 出征 Tab ─── */}
        {activeTab === 'campaign' && (
          <div className="tk-placeholder-enhanced">
            <div className="tk-placeholder-deco">⚔️</div>
            <div className="tk-placeholder-icon-lg">🗡️</div>
            <div className="tk-placeholder-title">出征系统</div>
            <div className="tk-placeholder-subtitle">率军征战四方，开疆拓土，攻城略地</div>
            <div className="tk-placeholder-badge">即将开放</div>
            <button
              className="tk-placeholder-nav-btn"
              onClick={() => switchTab('buildings')}
            >
              前往建筑Tab开始建设 →
            </button>
          </div>
        )}

        {/* ─── 科技 Tab ─── */}
        {activeTab === 'tech' && (
          <div className="tk-placeholder-enhanced">
            <div className="tk-placeholder-deco">📜</div>
            <div className="tk-placeholder-icon-lg">🔬</div>
            <div className="tk-placeholder-title">科技系统</div>
            <div className="tk-placeholder-subtitle">研习兵法，提升国力，解锁奇术</div>
            <div className="tk-placeholder-badge">即将开放</div>
            <button
              className="tk-placeholder-nav-btn"
              onClick={() => switchTab('buildings')}
            >
              前往建筑Tab开始建设 →
            </button>
          </div>
        )}

        {/* ─── 声望 Tab ─── */}
        {activeTab === 'prestige' && (
          <div className="tk-placeholder-enhanced">
            <div className="tk-placeholder-deco">👑</div>
            <div className="tk-placeholder-icon-lg">🏆</div>
            <div className="tk-placeholder-title">声望系统</div>
            <div className="tk-placeholder-subtitle">威震天下，名扬四海，成就霸业</div>
            <div className="tk-placeholder-badge">即将开放</div>
            <button
              className="tk-placeholder-nav-btn"
              onClick={() => switchTab('buildings')}
            >
              前往建筑Tab开始建设 →
            </button>
          </div>
        )}

        {/* ─── 更多 Tab ─── */}
        {activeTab === 'more' && (
          <div className="tk-placeholder-enhanced">
            <div className="tk-placeholder-deco">⚙️</div>
            <div className="tk-placeholder-icon-lg">🔧</div>
            <div className="tk-placeholder-title">更多功能</div>
            <div className="tk-placeholder-subtitle">持续更新中</div>
            <div className="tk-placeholder-badge">即将开放</div>
          </div>
        )}
      </div>

      {/* ═══════ 4. 升级确认弹窗（条件渲染） ═══════ */}
      {upgradeModal && (() => {
        const engine = engineRef.current;
        if (!engine) return null;
        const bldg = engine.getBuildingSystem();
        const def = bldg.getDef(upgradeModal);
        if (!def) return null;

        const lv = bldg.getLevel(upgradeModal);
        const cost = bldg.getCost(upgradeModal);
        const res = engine.getResources();
        const canAfford = Object.entries(cost).every(
          ([rid, amt]) => (res[rid] ?? 0) >= amt,
        );
        const currentRate = lv > 0 ? rates[def.productionResource] ?? 0 : 0;
        const nextRate = (lv + 1) * def.baseProduction;
        const pctIncrease = currentRate > 0 ? Math.round(((nextRate - currentRate) / currentRate) * 100) : 0;

        return (
          <div className="tk-modal-overlay" onClick={() => setUpgradeModal(null)}>
            <div className="tk-modal" onClick={e => e.stopPropagation()}>
              <button className="tk-modal-close" onClick={() => setUpgradeModal(null)}>
                ✕
              </button>
              <h3 className="tk-modal-title">升级 {def.name}</h3>
              <div className="tk-modal-body">
                <div className="tk-modal-level">
                  <span>Lv.{lv}</span>
                  <span className="tk-modal-arrow">→</span>
                  <span className="tk-modal-next">Lv.{lv + 1}</span>
                </div>
                <div className="tk-modal-rate">
                  产出：{fmtNum(currentRate)}/s → <strong style={{ color: '#7EC850' }}>{fmtNum(nextRate)}/s</strong>
                  {currentRate > 0 ? (
                    <span className="tk-rate-pct">(+{pctIncrease}%)</span>
                  ) : (
                    <span className="tk-rate-pct">新增 (+100%)</span>
                  )}
                </div>
                <div className="tk-modal-cost">
                  <div className="tk-modal-cost-title">资源消耗</div>
                  {Object.entries(cost).map(([rid, amt]) => {
                    const have = res[rid] ?? 0;
                    const enough = have >= amt;
                    const tip = getResourceTip(rid);
                    return (
                      <div key={rid}>
                        <div className={`tk-modal-cost-item ${enough ? 'tk-modal-cost-item-enough' : 'tk-modal-cost-item-lacking'}`}>
                          <span className={enough ? 'tk-cost-enough' : 'tk-cost-lacking'}>
                            {enough ? '✅' : '❌'} {RESOURCE_ICONS[rid] ?? rid} {fmtNum(amt)}
                          </span>
                          {!enough && (
                            <span className="tk-cost-lacking">
                              {' '}(拥有 {fmtNum(have)}/{fmtNum(amt)})
                            </span>
                          )}
                          {enough && (
                            <span className="tk-cost-enough">
                              {' '}✓ {fmtNum(have)}/{fmtNum(amt)}
                            </span>
                          )}
                        </div>
                        {!enough && tip && (
                          <div className="tk-cost-tip">💡 {tip}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="tk-modal-actions">
                  <button className="tk-btn-cancel" onClick={() => setUpgradeModal(null)}>
                    取消
                  </button>
                  <button
                    className="tk-btn-confirm"
                    disabled={!canAfford}
                    onClick={() => handleUpgrade(upgradeModal)}
                  >
                    确认升级
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════ 5. 新手引导（条件渲染） ═══════ */}
      {showGuide && guideStep < GUIDE_STEPS.length && (
        <div className="tk-guide-overlay" data-step={guideStep}>
          <div className="tk-guide-panel">
            <button
              className="tk-guide-skip"
              onClick={() => {
                setShowGuide(false);
                localStorage.setItem('tk_guide_done', 'true');
              }}
            >
              跳过
            </button>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>
              {guideStep === 0 && '🏗️'}
              {guideStep === 1 && '📊'}
              {guideStep === 2 && '🗺️'}
            </div>
            <h3 className="tk-guide-title">{GUIDE_STEPS[guideStep].title}</h3>
            <p className="tk-guide-desc">{GUIDE_STEPS[guideStep].desc}</p>
            <div className="tk-guide-dots">
              {GUIDE_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`tk-guide-dot ${i === guideStep ? 'tk-guide-dot-active' : ''}`}
                />
              ))}
            </div>
            <button
              className="tk-guide-next"
              onClick={() => {
                if (guideStep < GUIDE_STEPS.length - 1) {
                  setGuideStep(guideStep + 1);
                } else {
                  setShowGuide(false);
                  localStorage.setItem('tk_guide_done', 'true');
                }
              }}
            >
              {guideStep < GUIDE_STEPS.length - 1 ? '下一步' : '开始游戏'}
            </button>
          </div>
        </div>
      )}

      {/* ═══════ 6. Toast 通知 ═══════ */}
      <div className="tk-toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`tk-toast ${toast.type === 'error' ? 'tk-toast-error' : ''} ${toast.type === 'success' ? 'tk-toast-success' : ''}`}>
            {toast.msg}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ThreeKingdomsPixiGame;
