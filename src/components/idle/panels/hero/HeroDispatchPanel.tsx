/**
 * HeroDispatchPanel — 武将派遣面板
 *
 * 功能：
 * - 左侧：可派遣武将列表（等级≥20 + 品质≥RARE 筛选）
 * - 右侧：建筑列表，显示名称/等级/当前派遣武将
 * - 点击派遣流程：选择武将 → 选择建筑 → 确认派遣
 * - 已派遣建筑显示武将信息 + 加成效果 + 召回按钮
 * - 召回冷却提示（24小时内不可重复派驻）
 */

import React, { useState, useMemo, useCallback } from 'react';
import { HERO_QUALITY_COLORS } from '../../common/constants';
import { QualityBadge, StarDisplay } from './atoms';
import { toQualityLiteral } from './hero-ui.types';
import './HeroDispatchPanel.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

/** 武将简要数据 */
export interface HeroBrief {
  id: string;
  name: string;
  level: number;
  quality: string;
  stars: number;
}

/** 建筑简要数据 */
export interface BuildingBrief {
  id: string;
  name: string;
  level: number;
  dispatchHeroId: string | null;
}

export interface HeroDispatchPanelProps {
  /** 武将列表（外部传入优先） */
  heroes?: HeroBrief[];
  /** 建筑列表（外部传入优先） */
  buildings?: BuildingBrief[];
  /** 派遣回调（外部传入优先） */
  onDispatch?: (heroId: string, buildingId: string) => void;
  /** 召回回调（外部传入优先） */
  onRecall?: (buildingId: string) => void;
  /** 关闭回调 */
  onClose: () => void;
  /**
   * 引擎数据源（P1-1 桥接）
   * 当提供此参数时，heroes/buildings/onDispatch/onRecall
   * 从引擎数据自动获取，无需手动传入。
   */
  engineDataSource?: {
    heroes: HeroBrief[];
    buildings: BuildingBrief[];
    dispatchHero: (heroId: string, buildingId: string) => void;
    recallHero: (buildingId: string) => void;
  };
}

// ─────────────────────────────────────────────
// 品质排序权重
// ─────────────────────────────────────────────
const QUALITY_ORDER: Record<string, number> = {
  LEGENDARY: 5,
  EPIC: 4,
  RARE: 3,
  FINE: 2,
  COMMON: 1,
};

/** 判断品质是否 ≥ RARE */
function isQualityAtLeastRare(quality: string): boolean {
  return (QUALITY_ORDER[quality] ?? 0) >= QUALITY_ORDER.RARE;
}

/** 判断是否处于冷却期 */
function isInCooldown(lastRecallTime: number | undefined): boolean {
  if (!lastRecallTime) return false;
  return Date.now() - lastRecallTime < 24 * 60 * 60 * 1000;
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

const HeroDispatchPanel: React.FC<HeroDispatchPanelProps> = ({
  heroes: externalHeroes,
  buildings: externalBuildings,
  onDispatch: externalOnDispatch,
  onRecall: externalOnRecall,
  onClose,
  engineDataSource,
}) => {
  // 优先使用外部传入数据，否则使用引擎数据源
  const heroes = externalHeroes ?? engineDataSource?.heroes ?? [];
  const buildings = externalBuildings ?? engineDataSource?.buildings ?? [];
  const onDispatch = externalOnDispatch ?? engineDataSource?.dispatchHero ?? (() => {});
  const onRecall = externalOnRecall ?? engineDataSource?.recallHero ?? (() => {});

  // ── Props 校验：过滤非法数据 ──
  const validHeroes = useMemo(() =>
    heroes.filter((h) =>
      h.id && typeof h.id === 'string' &&
      h.name && typeof h.name === 'string' &&
      typeof h.level === 'number' && h.level >= 1 &&
      h.quality && typeof h.quality === 'string' &&
      typeof h.stars === 'number' && h.stars >= 1,
    ),
  [heroes]);

  const validBuildings = useMemo(() =>
    buildings.filter((b) =>
      b.id && typeof b.id === 'string' &&
      b.name && typeof b.name === 'string' &&
      typeof b.level === 'number' && b.level >= 1,
    ),
  [buildings]);
  // 选中的武将ID和建筑ID
  const [selectedHeroId, setSelectedHeroId] = useState<string | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  // 建筑冷却记录：buildingId → 上次召回时间戳
  const [cooldownMap, setCooldownMap] = useState<Record<string, number>>({});

  // ── 筛选可派遣武将：等级≥20 且 品质≥RARE ──
  const dispatchableHeroes = useMemo(() => {
    return validHeroes
      .filter((h) => h.level >= 20 && isQualityAtLeastRare(h.quality))
      .sort((a, b) => {
        // 先按品质降序，再按等级降序
        const qDiff = (QUALITY_ORDER[b.quality] ?? 0) - (QUALITY_ORDER[a.quality] ?? 0);
        if (qDiff !== 0) return qDiff;
        return b.level - a.level;
      });
  }, [validHeroes]);

  // ── 已派遣武将ID集合 ──
  const dispatchedHeroIds = useMemo(() => {
    const ids = new Set<string>();
    validBuildings.forEach((b) => {
      if (b.dispatchHeroId) ids.add(b.dispatchHeroId);
    });
    return ids;
  }, [validBuildings]);

  // ── 武将ID → 武将数据映射 ──
  const heroMap = useMemo(() => {
    const map = new Map<string, HeroBrief>();
    validHeroes.forEach((h) => map.set(h.id, h));
    return map;
  }, [validHeroes]);

  // ── 计算加成百分比（模拟引擎算法） ──
  const calcBonus = useCallback(
    (heroId: string): number => {
      const hero = heroMap.get(heroId);
      if (!hero) return 0;
      const qualityBonus: Record<string, number> = {
        COMMON: 1, FINE: 2, RARE: 3, EPIC: 5, LEGENDARY: 8,
      };
      const base = hero.level * 0.5 + (qualityBonus[hero.quality] ?? 0);
      return Math.round(base * 10) / 10;
    },
    [heroMap],
  );

  // ── 选择武将 ──
  const handleSelectHero = useCallback(
    (heroId: string) => {
      if (dispatchedHeroIds.has(heroId)) return;
      setSelectedHeroId((prev) => (prev === heroId ? null : heroId));
      setSelectedBuildingId(null);
    },
    [dispatchedHeroIds],
  );

  // ── 选择建筑 ──
  const handleSelectBuilding = useCallback(
    (buildingId: string) => {
      if (!selectedHeroId) return;
      if (isInCooldown(cooldownMap[buildingId])) return;
      setSelectedBuildingId((prev) => (prev === buildingId ? null : buildingId));
    },
    [selectedHeroId, cooldownMap],
  );

  // ── 确认派遣 ──
  const handleConfirmDispatch = useCallback(() => {
    if (!selectedHeroId || !selectedBuildingId) return;
    onDispatch(selectedHeroId, selectedBuildingId);
    setSelectedHeroId(null);
    setSelectedBuildingId(null);
  }, [selectedHeroId, selectedBuildingId, onDispatch]);

  // ── 召回武将 ──
  const handleRecall = useCallback(
    (buildingId: string) => {
      onRecall(buildingId);
      setCooldownMap((prev) => ({ ...prev, [buildingId]: Date.now() }));
    },
    [onRecall],
  );

  // ── 确认栏信息 ──
  const selectedHero = selectedHeroId ? heroMap.get(selectedHeroId) : null;
  const selectedBuilding = selectedBuildingId
    ? validBuildings.find((b) => b.id === selectedBuildingId)
    : null;

  return (
    <div className="tk-dispatch-panel" data-testid="hero-dispatch-panel">
      {/* 头部 */}
      <div className="tk-dispatch-header">
        <span className="tk-dispatch-title">武将派遣</span>
        <button className="tk-dispatch-close-btn" onClick={onClose} data-testid="dispatch-close-btn">
          关闭
        </button>
      </div>

      {/* 主体双栏 */}
      <div className="tk-dispatch-body">
        {/* 左侧：武将列表 */}
        <div className="tk-dispatch-hero-list">
          <div className="tk-dispatch-section-title">
            可派遣武将（等级≥20 品质≥稀有）
          </div>

          {dispatchableHeroes.length === 0 ? (
            <div className="tk-dispatch-empty" data-testid="dispatch-hero-empty">
              暂无满足条件的武将
            </div>
          ) : (
            dispatchableHeroes.map((hero) => {
              const isDispatched = dispatchedHeroIds.has(hero.id);
              const isSelected = selectedHeroId === hero.id;
              return (
                <div
                  key={hero.id}
                  className={[
                    'tk-dispatch-hero-item',
                    isSelected ? 'tk-dispatch-hero-item--selected' : '',
                    isDispatched ? 'tk-dispatch-hero-item--dispatched' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => handleSelectHero(hero.id)}
                  data-testid={`dispatch-hero-${hero.id}`}
                >
                  <QualityBadge quality={toQualityLiteral(hero.quality)} size="small" />
                  <span className="tk-dispatch-hero-name">{hero.name}</span>
                  <StarDisplay stars={hero.stars} size="small" />
                  <span className="tk-dispatch-hero-level">Lv.{hero.level}</span>
                </div>
              );
            })
          )}
        </div>

        {/* 右侧：建筑列表 */}
        <div className="tk-dispatch-building-list">
          <div className="tk-dispatch-section-title">建筑列表</div>

          {validBuildings.map((building) => {
            const hero = building.dispatchHeroId
              ? heroMap.get(building.dispatchHeroId)
              : null;
            const isOccupied = !!building.dispatchHeroId;
            const isBuildingSelected = selectedBuildingId === building.id;
            const coolingDown = isInCooldown(cooldownMap[building.id]);

            return (
              <div
                key={building.id}
                className={[
                  'tk-dispatch-building-item',
                  isOccupied ? 'tk-dispatch-building-item--occupied' : '',
                  isBuildingSelected ? 'tk-dispatch-building-item--selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                data-testid={`dispatch-building-${building.id}`}
              >
                {/* 建筑头部 */}
                <div className="tk-dispatch-building-header">
                  <span className="tk-dispatch-building-name">{building.name}</span>
                  <span className="tk-dispatch-building-level">Lv.{building.level}</span>
                </div>

                {/* 已派遣武将 */}
                {hero ? (
                  <div className="tk-dispatch-building-hero">
                    <span className="tk-dispatch-building-hero-name">{hero.name}</span>
                    <span className="tk-dispatch-building-bonus">
                      +{calcBonus(hero.id)}%
                    </span>
                    <button
                      className="tk-dispatch-recall-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRecall(building.id);
                      }}
                      data-testid={`recall-btn-${building.id}`}
                    >
                      召回
                    </button>
                  </div>
                ) : (
                  <div
                    className="tk-dispatch-building-empty"
                    onClick={() => handleSelectBuilding(building.id)}
                    data-testid={`dispatch-empty-${building.id}`}
                  >
                    {coolingDown ? '冷却中...' : '点击派遣'}
                  </div>
                )}

                {/* 冷却提示 */}
                {coolingDown && !hero && (
                  <div className="tk-dispatch-cooldown-tip" data-testid={`cooldown-tip-${building.id}`}>
                    ⏳ 24小时内不可重复派驻
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 确认派遣栏 */}
      {selectedHero && selectedBuilding && (
        <div className="tk-dispatch-confirm-bar" data-testid="dispatch-confirm-bar">
          <span className="tk-dispatch-confirm-info">
            派遣 <strong>{selectedHero.name}</strong> → <strong>{selectedBuilding.name}</strong>
            <span style={{ marginLeft: 8, color: 'var(--tk-green)' }}>
              +{calcBonus(selectedHero.id)}% 加成
            </span>
          </span>
          <button
            className="tk-dispatch-confirm-btn"
            onClick={handleConfirmDispatch}
            data-testid="dispatch-confirm-btn"
          >
            确认派遣
          </button>
        </div>
      )}
    </div>
  );
};

export default HeroDispatchPanel;
