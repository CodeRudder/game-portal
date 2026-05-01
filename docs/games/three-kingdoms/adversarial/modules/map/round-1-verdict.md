# Map R1 Arbiter 仲裁裁决

> Arbiter: v1.6 | Time: 2026-05-01
> 模块: map | Builder节点: 340 | Challenger质疑: 45

## 评分

| 维度 | 权重 | 得分 | 加权 |
|------|------|------|------|
| 完备性 | 25% | 7.5 | 1.88 |
| 准确性 | 25% | 7.0 | 1.75 |
| 优先级 | 15% | 8.0 | 1.20 |
| 可测试性 | 15% | 8.5 | 1.28 |
| 挑战应对 | 20% | 7.5 | 1.50 |
| **总分** | | | **7.61** |

> **判定: CONTINUE**（远低于封版线9.0）

### 评分说明

- **完备性 7.5**: API覆盖率约74%，F-Cross仅75%（4/16 uncovered），F-Lifecycle有4个P0未覆盖
- **准确性 7.0**: 虚报率8.9% > 5%阈值，扣0.5分；covered标注待验证
- **优先级 8.0**: P0/P1/P2分配基本合理，NaN系统性问题正确提升为P0
- **可测试性 8.5**: 大部分节点可转化为测试用例，纯函数系统（MapFilter/MapDataRenderer）可测试性高
- **挑战应对 7.5**: Builder识别了23个特别关注项，但Challenger发现了额外的架构级问题（P0-024）

---

## P0 裁决

### 确认P0（22个）

| # | ID | 子系统 | 描述 | 裁决 | 优先修复 |
|---|-----|--------|------|------|---------|
| 1 | P0-001 | SiegeSystem | NaN绕过兵力检查 | **确认** | FIX-701 |
| 2 | P0-002 | SiegeSystem | NaN绕过粮草检查 | **确认** | FIX-701（合并） |
| 3 | P0-003 | SiegeSystem | defenseValue=NaN->cost=NaN | **确认** | FIX-702 |
| 4 | P0-004 | SiegeSystem | defenseValue负值->负消耗 | **确认** | FIX-702（合并） |
| 5 | P0-005 | SiegeSystem | computeWinRate NaN | **确认** | FIX-703 |
| 6 | P0-006 | SiegeEnhancer | computeWinRate NaN（重复） | **确认** | FIX-703（对称修复） |
| 7 | P0-007 | SiegeSystem | serialize不保存captureTimestamps | **确认** | FIX-704 |
| 8 | P0-008 | WorldMapSystem | deserialize(null)崩溃 | **确认** | FIX-705 |
| 9 | P0-009 | TerritorySystem | deserialize(null)崩溃 | **确认** | FIX-705（同类） |
| 10 | P0-010 | SiegeSystem | deserialize(null)崩溃 | **确认** | FIX-705（同类） |
| 11 | P0-011 | SiegeEnhancer | deserialize(null)崩溃 | **确认** | FIX-705（同类） |
| 12 | P0-012 | WorldMapSystem | upgradeLandmark level=NaN | **确认** | FIX-706 |
| 13 | P0-013 | WorldMapSystem | setZoom(NaN)->NaN | **确认** | FIX-707 |
| 14 | P0-014 | MapDataRenderer | computeVisibleRange zoom=0除零 | **确认** | FIX-708 |
| 15 | P0-015 | MapFilterSystem | filter(tiles=null)崩溃 | **确认** | FIX-709 |
| 16 | P0-016 | MapFilterSystem | filter(criteria=null)崩溃 | **确认** | FIX-709（合并） |
| 17 | P0-017 | TerritorySystem | deserialize level=NaN | **确认** | FIX-710 |
| 18 | P0-018 | TerritorySystem | captureTerritory(null) | **确认** | FIX-711 |
| 19 | P0-019 | GarrisonSystem | calculateBonus defense=NaN | **确认** | FIX-712 |
| 20 | P0-020 | GarrisonSystem | calculateBonus production=NaN | **确认** | FIX-712（合并） |
| 21 | P0-021 | TerritorySystem | getPlayerProductionSummary NaN累加 | **确认** | FIX-713 |
| 22 | P0-022 | SiegeSystem | resolveSiege cost=NaN传播 | **确认** | 上游FIX-702覆盖 |

### 降级P0->P1（2个）

| # | ID | 原因 |
|---|-----|------|
| 1 | P0-023 | deductSiegeResources NaN传播。上游FIX-702修复calculateSiegeCost后，cost不会为NaN。且deductSiegeResources有try-catch保护。降级为P1 |
| 2 | P0-024 | engine-save覆盖验证。需源码验证，当前为推测性P0。降级为P1，R2专项验证 |

---

## 修复方案汇总

### FIX-701: SiegeSystem.checkSiegeConditions NaN防护
- **文件**: SiegeSystem.ts
- **位置**: checkSiegeConditions方法入口
- **方案**: 添加 `if (!Number.isFinite(availableTroops) || !Number.isFinite(availableGrain)) return { canSiege: false, errorCode: availableTroops < cost.troops ? 'INSUFFICIENT_TROOPS' : 'INSUFFICIENT_GRAIN', errorMessage: '兵力或粮草数据异常' }`
- **覆盖P0**: P0-001, P0-002

### FIX-702: SiegeSystem.calculateSiegeCost 防御值防护
- **文件**: SiegeSystem.ts
- **位置**: calculateSiegeCost方法
- **方案**: 添加 `if (!Number.isFinite(territory.defenseValue) || territory.defenseValue <= 0) return { troops: MIN_SIEGE_TROOPS, grain: GRAIN_FIXED_COST }`
- **覆盖P0**: P0-003, P0-004, P0-022(间接)

### FIX-703: computeWinRate NaN防护（对称修复）
- **文件**: SiegeSystem.ts + SiegeEnhancer.ts
- **位置**: 两处computeWinRate方法
- **方案**: 添加 `if (!Number.isFinite(attackerPower) || !Number.isFinite(defenderPower)) return WIN_RATE_MIN`
- **覆盖P0**: P0-005, P0-006
- **对称验证**: SiegeSystem和SiegeEnhancer两处同步修复（AR-012规则）

### FIX-704: SiegeSystem.serialize 保存captureTimestamps
- **文件**: SiegeSystem.ts
- **位置**: serialize/deserialize方法 + SiegeSaveData类型
- **方案**: 
  - serialize: 添加 `captureTimestamps: Object.fromEntries(this.captureTimestamps)`
  - deserialize: 恢复 `this.captureTimestamps = new Map(Object.entries(data.captureTimestamps ?? {}))`
  - SiegeSaveData类型: 添加 `captureTimestamps: Record<string, number>`
- **覆盖P0**: P0-007

### FIX-705: 四系统deserialize(null)防护
- **文件**: WorldMapSystem.ts, TerritorySystem.ts, SiegeSystem.ts, SiegeEnhancer.ts
- **位置**: 各deserialize方法入口
- **方案**: 添加 `if (!data) return`
- **覆盖P0**: P0-008, P0-009, P0-010, P0-011

### FIX-706: WorldMapSystem.upgradeLandmark NaN防护
- **文件**: WorldMapSystem.ts
- **位置**: upgradeLandmark方法
- **方案**: `if (!landmark || !Number.isFinite(landmark.level) || landmark.level >= 5) return false`
- **覆盖P0**: P0-012

### FIX-707: WorldMapSystem.setZoom NaN防护
- **文件**: WorldMapSystem.ts
- **位置**: setZoom方法
- **方案**: `if (!Number.isFinite(zoom)) return`
- **覆盖P0**: P0-013

### FIX-708: MapDataRenderer.computeVisibleRange 除零防护
- **文件**: MapDataRenderer.ts
- **位置**: computeVisibleRange方法入口
- **方案**: `const safeZoom = (!zoom || !Number.isFinite(zoom)) ? VIEWPORT_CONFIG.defaultZoom : zoom;` 后续使用safeZoom
- **覆盖P0**: P0-014

### FIX-709: MapFilterSystem.filter null防护
- **文件**: MapFilterSystem.ts
- **位置**: filter静态方法入口
- **方案**: `tiles = tiles ?? []; landmarks = landmarks ?? []; criteria = criteria ?? {};`
- **覆盖P0**: P0-015, P0-016

### FIX-710: TerritorySystem.deserialize level NaN防护
- **文件**: TerritorySystem.ts
- **位置**: deserialize方法中level恢复
- **方案**: `if (!Number.isFinite(level) || level < 1) level = 1 as LandmarkLevel;`
- **覆盖P0**: P0-017

### FIX-711: TerritorySystem.captureTerritory null防护
- **文件**: TerritorySystem.ts
- **位置**: captureTerritory方法入口
- **方案**: `if (!newOwner) return false`
- **覆盖P0**: P0-018

### FIX-712: GarrisonSystem.calculateBonus NaN防护
- **文件**: GarrisonSystem.ts
- **位置**: calculateBonus方法
- **方案**: 
  - `const defense = Number.isFinite(general.baseStats.defense) ? general.baseStats.defense : 0;`
  - 各产出项: `grain: Math.round((Number.isFinite(baseProduction.grain) ? baseProduction.grain : 0) * qualityBonus * 100) / 100`
- **覆盖P0**: P0-019, P0-020

### FIX-713: TerritorySystem.getPlayerProductionSummary NaN累加防护
- **文件**: TerritorySystem.ts
- **位置**: getPlayerProductionSummary方法
- **方案**: 累加前检查 `const grain = Number.isFinite(t.currentProduction.grain) ? t.currentProduction.grain : 0;`
- **覆盖P0**: P0-021

---

## 收敛判断

| 指标 | 值 | 阈值 | 状态 |
|------|-----|------|------|
| 评分 | 7.61 | >= 9.0 | ❌ |
| API覆盖率 | 74% | >= 90% | ❌ |
| F-Cross覆盖率 | 75% | >= 75% | ✅ |
| F-Lifecycle覆盖率 | 60% | >= 70% | ❌ |
| P0覆盖 | 22/24 | 100% | ❌ |
| 虚报数 | 4 | 0 | ❌ |
| 新P0 | 24 | 0 | ❌ |

**结论: CONTINUE** — 需要R2迭代，首要修复13个FIX项

---

## 三Agent复盘

### Builder表现: 7.5/10
- **优点**: 23模式扫描全面，特别关注项识别准确，跨系统链路枚举到位
- **不足**: 覆盖率74%偏低，86个uncovered节点需补充
- **改进**: 提升covered标注的源码验证比例

### Challenger表现: 7.0/10
- **优点**: NaN系统性问题挖掘深入，P0-007（captureTimestamps数据丢失）是高质量发现
- **不足**: 虚报率8.9%偏高，4个虚报中2个可提前排除
- **改进**: 静态方法null防护类质疑应考虑调用方责任

### Arbiter独立发现
1. **SiegeSystem.update跨天重置逻辑**: lastSiegeDate在update中检查跨天重置，但update可能不被调用（依赖引擎循环），导致dailySiegeCount永不重置。建议在checkSiegeConditions中也检查。
2. **MapEventSystem.eventIdCounter全局变量**: 模块级let变量，多次实例化或reset后ID不连续，测试可能不稳定。

### 规则进化建议
1. 新增规则BR-024: **序列化完整性验证** — 每个子系统的所有运行时状态（Map/Set/计数器/时间戳）必须在serialize中体现，否则视为P0
2. 新增规则CR-024: **状态字段枚举** — Challenger应枚举每个子系统的所有private字段，逐一验证是否被serialize覆盖
3. 新增模式24: **全局可变状态** — 模块级let/var变量在多次实例化或reset后行为异常
