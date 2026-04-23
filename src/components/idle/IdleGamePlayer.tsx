/**
 * IdleGamePlayer — 放置游戏播放器容器
 *
 * 包含 Canvas + ResourceBar + UpgradePanel + Tab切换。
 * PC: 左侧Canvas + 右侧面板
 * 手机: 上方Canvas + 下方Tab切换(资源/升级/攻略/排名/存档)
 */
import { useRef, useEffect, useState, useCallback } from 'react';
import type { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { Resource, Upgrade, OfflineReport, StrategyPhase, SaveData } from '@/types/idle';
import IdleResourceBar from './IdleResourceBar';
import IdleUpgradePanel from './IdleUpgradePanel';
import IdleOfflineReport from './IdleOfflineReport';
import IdleSaveManager from './IdleSaveManager';
import Leaderboard from './Leaderboard';
import StrategyGuide from './StrategyGuide';

interface IdleGamePlayerProps {
  engine: IdleGameEngine;
  /** 排名维度 */
  leaderboardDimensions?: { key: string; label: string }[];
  /** 攻略阶段 */
  strategyPhases?: StrategyPhase[];
  /** 获取资源名称 */
  getResourceName: (id: string) => string;
}

type TabKey = 'resources' | 'upgrades' | 'strategy' | 'leaderboard' | 'save';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'resources', label: '资源', icon: '💰' },
  { key: 'upgrades', label: '升级', icon: '⬆️' },
  { key: 'strategy', label: '攻略', icon: '📖' },
  { key: 'leaderboard', label: '排名', icon: '🏆' },
  { key: 'save', label: '存档', icon: '💾' },
];

export default function IdleGamePlayer({
  engine,
  leaderboardDimensions,
  strategyPhases,
  getResourceName,
}: IdleGamePlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [upgrades, setUpgrades] = useState<Upgrade[]>([]);
  const [offlineReport, setOfflineReport] = useState<OfflineReport | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('upgrades');
  const [status, setStatus] = useState(engine.status);

  // 绑定引擎
  useEffect(() => {
    if (!canvasRef.current) return;
    engine.setCanvas(canvasRef.current);
    engine.init();

    // 监听状态变化
    engine.on('stateChange', () => {
      const state = engine.getState() as Record<string, unknown>;
      const resData = state.resources as Record<string, { amount: number; perSecond: number; unlocked: boolean }>;
      const upgData = state.upgrades as Record<string, { level: number; unlocked: boolean }>;

      const resList: Resource[] = [];
      for (const [id, r] of Object.entries(resData || {})) {
        const original = engine.getResource(id);
        resList.push({
          id,
          name: original?.name ?? id,
          amount: r.amount,
          perSecond: r.perSecond,
          maxAmount: original?.maxAmount ?? Infinity,
          unlocked: r.unlocked,
        });
      }
      setResources(resList);

      const upgList: Upgrade[] = [];
      // 获取所有升级（包括未解锁的）
      const available = engine.getAvailableUpgrades();
      const availableIds = new Set(available.map((u) => u.id));
      for (const u of available) {
        upgList.push(u);
      }
      // 也包含已购买但满级的
      for (const [id, u] of Object.entries(upgData || {})) {
        if (!availableIds.has(id) && u.level > 0) {
          // 已满级的升级不显示
        }
      }
      setUpgrades(upgList);
    });

    engine.on('statusChange', (s: string) => {
      setStatus(s as typeof status);
    });

    engine.on('offlineEarnings', (report: OfflineReport) => {
      setOfflineReport(report);
    });

    // 开始游戏
    engine.start();

    return () => {
      engine.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePurchase = useCallback(
    (id: string) => {
      engine.purchaseUpgrade(id);
    },
    [engine]
  );

  const handleCollectOffline = useCallback(() => {
    setOfflineReport(null);
  }, []);

  const handleLoad = useCallback(
    (data: SaveData) => {
      engine.load(data);
    },
    [engine]
  );

  const handleImport = useCallback(
    (encoded: string) => {
      return engine.importSave(encoded);
    },
    [engine]
  );

  const handleReset = useCallback(() => {
    engine.reset();
    engine.start();
  }, [engine]);

  return (
    <div className="flex flex-col gap-4 lg:flex-row" data-testid="idle-game-player">
      {/* 左侧/上方: Canvas */}
      <div className="flex flex-col gap-3 lg:w-1/2">
        {/* 资源栏（PC 上方常驻） */}
        <div className="hidden lg:block">
          <IdleResourceBar
            resources={resources}
            formatNumber={(n) => engine.formatNumber(n)}
          />
        </div>

        {/* Canvas */}
        <div className="relative w-full overflow-hidden rounded-xl border-2 border-gp-accent/30 bg-[#0d0d20] shadow-lg shadow-gp-accent/10">
          <canvas
            ref={canvasRef}
            width={480}
            height={640}
            className="block h-full w-full"
            style={{ aspectRatio: '480 / 640' }}
          />
        </div>

        {/* 操作提示 */}
        <div className="text-center text-xs text-gray-500">
          点击/空格 互动 · 游戏自动保存
        </div>
      </div>

      {/* 右侧/下方: 面板 */}
      <div className="flex flex-col gap-3 lg:w-1/2">
        {/* 手机端 Tab 切换 */}
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-gp-card/80 p-1 lg:hidden">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs transition ${
                activeTab === tab.key
                  ? 'bg-gp-accent text-white'
                  : 'text-gray-400 hover:bg-white/5'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* PC 端：所有面板垂直排列；手机端：只显示当前 Tab */}
        <div className="hidden lg:flex lg:flex-col lg:gap-4">
          <IdleResourceBar
            resources={resources}
            formatNumber={(n) => engine.formatNumber(n)}
          />
          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-300">⬆️ 升级</h3>
            <IdleUpgradePanel
              upgrades={upgrades}
              getUpgradeCost={(id) => engine.getUpgradeCost(id)}
              canAfford={(cost) => engine.canAfford(cost)}
              formatNumber={(n) => engine.formatNumber(n)}
              getResourceName={getResourceName}
              onPurchase={handlePurchase}
            />
          </div>
          {strategyPhases && strategyPhases.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-gray-300">📖 攻略</h3>
              <StrategyGuide phases={strategyPhases} />
            </div>
          )}
          {leaderboardDimensions && leaderboardDimensions.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-gray-300">🏆 排名</h3>
              <Leaderboard
                gameId={engine.gameId}
                dimensions={leaderboardDimensions}
                formatNumber={(n) => engine.formatNumber(n)}
              />
            </div>
          )}
          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-300">💾 存档</h3>
            <IdleSaveManager
              gameId={engine.gameId}
              currentSave={() => engine.save()}
              formatNumber={(n) => engine.formatNumber(n)}
              onLoad={handleLoad}
              onImport={handleImport}
              onReset={handleReset}
            />
          </div>
        </div>

        {/* 手机端内容 */}
        <div className="lg:hidden">
          {activeTab === 'resources' && (
            <IdleResourceBar
              resources={resources}
              formatNumber={(n) => engine.formatNumber(n)}
            />
          )}
          {activeTab === 'upgrades' && (
            <IdleUpgradePanel
              upgrades={upgrades}
              getUpgradeCost={(id) => engine.getUpgradeCost(id)}
              canAfford={(cost) => engine.canAfford(cost)}
              formatNumber={(n) => engine.formatNumber(n)}
              getResourceName={getResourceName}
              onPurchase={handlePurchase}
            />
          )}
          {activeTab === 'strategy' && strategyPhases && (
            <StrategyGuide phases={strategyPhases} />
          )}
          {activeTab === 'leaderboard' && leaderboardDimensions && (
            <Leaderboard
              gameId={engine.gameId}
              dimensions={leaderboardDimensions}
              formatNumber={(n) => engine.formatNumber(n)}
            />
          )}
          {activeTab === 'save' && (
            <IdleSaveManager
              gameId={engine.gameId}
              currentSave={() => engine.save()}
              formatNumber={(n) => engine.formatNumber(n)}
              onLoad={handleLoad}
              onImport={handleImport}
              onReset={handleReset}
            />
          )}
        </div>
      </div>

      {/* 离线收益弹窗 */}
      {offlineReport && (
        <IdleOfflineReport
          report={offlineReport}
          formatNumber={(n) => engine.formatNumber(n)}
          getResourceName={getResourceName}
          onCollect={handleCollectOffline}
        />
      )}
    </div>
  );
}
