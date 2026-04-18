# 三国霸业 — 建筑体系重新设计

> 版本：v2.0  
> 日期：2025-07-11  
> 策划：系统策划师

---

## 一、问题诊断

### 当前建筑配置问题清单

| # | 问题 | 严重度 | 说明 |
|---|------|--------|------|
| 1 | 缺少伐木场基础产出 | ❌ 已修复 | 当前代码已有 `lumberyard`，但产出 0.8/s 偏低 |
| 2 | 缺少矿场 | ❌ 未修复 | `iron` 仅靠 `smithy` 产出，而 smithy 依赖 barracks → 死锁风险 |
| 3 | smithy 依赖 barracks | 🔴 错误 | 铁匠铺是资源加工建筑，不应依赖军事建筑 |
| 4 | wall 产出 troops | 🟡 不合理 | 城防消耗木材，不应产出兵力 |
| 5 | beacon_tower 产出 iron | 🔴 错误 | 烽火台是预警功能建筑，不应产出铁矿 |
| 6 | 初始解锁 6 个建筑 | 🟡 偏多 | 新手信息过载，建议 4-5 个 |
| 7 | 依赖链最深 4 层 | 🟡 过深 | barracks→smithy→forge→beacon_tower→wall，需精简 |

### 死锁风险分析

**当前依赖链：**
```
barracks (需 grain:200 解锁)
  └→ smithy (需 barracks Lv.3，产出 iron)
       └→ forge (需 smithy Lv.4)
wall (需 lumberyard Lv.3，消耗 wood 建造)
  └→ beacon_tower (需 wall Lv.3，消耗 iron 建造)
```

**死锁场景：** 如果玩家没有及时解锁 barracks，iron 产出为零，导致所有需要 iron 的建筑无法升级。

---

## 二、设计原则

### 核心设计理念

```
资源采集(T1) → 资源加工(T2) → 军事/民生(T3) → 高级/特殊(T4)
```

### 依赖链规则

1. **T1 资源采集建筑**：无前置依赖，仅消耗 grain/gold，初始解锁
2. **T2 加工建筑**：依赖 T1 建筑，产出进阶资源
3. **T3 军事/民生建筑**：依赖 T1/T2，产出 troops/morale/destiny
4. **T4 高级建筑**：依赖 T2/T3，产出高级倍率资源
5. **依赖链深度 ≤ 3 层**（从初始解锁建筑算起）

### 资源产出矩阵

每种基础资源至少有一个 T1 建筑直接产出：

| 资源 | T1 基础产出 | T2 加工产出 | T3/T4 高级产出 |
|------|------------|------------|---------------|
| grain | 🌾 屯田 | 🏚️ 粮仓 | — |
| gold | 💰 商行 | 🏛️ 钱庄 | — |
| wood | 🪓 伐木场 | — | — |
| iron | ⛏️ 矿场 | 🔨 铁匠铺 | ⚒️ 锻兵坊 |
| troops | ⚔️ 军营 | — | — |
| morale | 💊 药庐 | 🍵 茶馆 | — |
| destiny | 📚 太学 | 🏯 招贤馆 | — |

---

## 三、完整建筑配置表（15 个建筑）

### 3.1 T1 资源采集层（初始解锁，4 个）

| # | id | name | icon | category | 产出资源 | 基础产出/s | 升级费用(baseCost) | 费用倍率 | 依赖(requires) | 解锁条件 | 初始解锁 |
|---|----|----|------|----------|---------|-----------|-------------------|---------|---------------|---------|---------|
| 1 | farm | 屯田 | 🌾 | resource | grain | 1.0 | {grain:12, gold:5} | 1.15 | — | 初始解锁 | ✅ |
| 2 | market | 商行 | 💰 | economic | gold | 0.8 | {grain:80, gold:30} | 1.15 | — | 初始解锁 | ✅ |
| 3 | lumberyard | 伐木场 | 🪓 | resource | wood | 0.8 | {grain:40, gold:20} | 1.12 | — | 初始解锁 | ✅ |
| 4 | clinic | 药庐 | 💊 | civilian | morale | 1.2 | {gold:80, grain:60} | 1.08 | — | 初始解锁 | ✅ |

### 3.2 T2 加工/军事层（需解锁，5 个）

| # | id | name | icon | category | 产出资源 | 基础产出/s | 升级费用(baseCost) | 费用倍率 | 依赖(requires) | 解锁条件 | 初始解锁 |
|---|----|----|------|----------|---------|-----------|-------------------|---------|---------------|---------|---------|
| 5 | barracks | 军营 | ⚔️ | military | troops | 0.5 | {grain:30, gold:20} | 1.09 | — | 累计200粮草 | ❌ |
| 6 | mine | 矿场 | ⛏️ | resource | iron | 0.6 | {grain:50, gold:30, wood:10} | 1.12 | — | 累计300铜钱 | ❌ |
| 7 | academy | 太学 | 📚 | civilian | destiny | 0.5 | {gold:200} | 1.12 | — | 累计1000铜钱 | ❌ |
| 8 | smithy | 铁匠铺 | 🔨 | resource | iron | 1.0 | {gold:50, grain:30, iron:10} | 1.10 | [mine] | 矿场Lv.3 | ❌ |
| 9 | wall | 城防 | 🏰 | military | troops | 0.3 | {gold:120, grain:60, wood:20} | 1.15 | [lumberyard] | 伐木场Lv.3 | ❌ |

### 3.3 T3 进阶层（需前置建筑，4 个）

| # | id | name | icon | category | 产出资源 | 基础产出/s | 升级费用(baseCost) | 费用倍率 | 依赖(requires) | 解锁条件 | 初始解锁 |
|---|----|----|------|----------|---------|-----------|-------------------|---------|---------------|---------|---------|
| 10 | granary | 粮仓 | 🏚️ | resource | grain | 1.5 | {grain:200, gold:100} | 1.10 | [farm] | 屯田Lv.5 | ❌ |
| 11 | mint | 钱庄 | 🏛️ | economic | gold | 1.8 | {gold:400, grain:200} | 1.14 | [market] | 商行Lv.5 | ❌ |
| 12 | teahouse | 茶馆 | 🍵 | civilian | morale | 1.5 | {gold:150, grain:100} | 1.09 | [clinic] | 药庐Lv.3 | ❌ |
| 13 | beacon_tower | 烽火台 | 🔥 | military | morale | 0.8 | {gold:150, wood:30, iron:15} | 1.12 | [wall] | 城防Lv.3 | ❌ |

### 3.4 T4 高级层（需高级前置，2 个）

| # | id | name | icon | category | 产出资源 | 基础产出/s | 升级费用(baseCost) | 费用倍率 | 依赖(requires) | 解锁条件 | 初始解锁 |
|---|----|----|------|----------|---------|-----------|-------------------|---------|---------------|---------|---------|
| 14 | tavern | 招贤馆 | 🏯 | civilian | destiny | 1.5 | {gold:500, destiny:50} | 1.18 | [academy] | 太学Lv.3 | ❌ |
| 15 | forge | 锻兵坊 | ⚒️ | military | iron | 1.5 | {gold:300, iron:80, wood:30} | 1.11 | [smithy] | 铁匠铺Lv.4 | ❌ |

---

## 四、变更对比表

### 4.1 新增建筑

| id | name | 变更 | 说明 |
|----|------|------|------|
| mine | 矿场 | 🆕 新增 | T2 资源建筑，iron 基础产出 0.6/s，解决 iron 无基础产出问题 |

### 4.2 修改建筑

| id | name | 旧值 | 新值 | 原因 |
|----|------|------|------|------|
| smithy | 铁匠铺 | requires:[barracks] | requires:[mine] | 铁匠铺是加工建筑，应依赖矿场 |
| smithy | 铁匠铺 | baseCost:{gold:50, grain:30} | baseCost:{gold:50, grain:30, iron:10} | 铁匠铺加工铁矿，消耗 iron 合理 |
| smithy | 铁匠铺 | unlockCondition:"军营Lv.3" | unlockCondition:"矿场Lv.3" | 匹配新依赖 |
| wall | 城防 | productionResource:troops | productionResource:troops | 保留兵力产出（守军驻扎合理） |
| wall | 城防 | baseCost:{gold:120, grain:60, wood:15} | baseCost:{gold:120, grain:60, wood:20} | 城防消耗木材，适当提高 wood 消耗 |
| beacon_tower | 烽火台 | productionResource:iron | productionResource:morale | 烽火台预警安民，产出民心合理 |
| beacon_tower | 烽火台 | baseCost:{gold:150, iron:20, troops:30, wood:30} | baseCost:{gold:150, wood:30, iron:15} | 简化费用，去掉 troops 消耗（避免循环依赖） |
| barracks | 军营 | 初始解锁 | 资源阈值解锁(累计200粮草) | 降低新手信息量 |
| academy | 太学 | 初始解锁 | 资源阈值解锁(累计1000铜钱) | 降低新手信息量 |

### 4.3 初始解锁变更

**旧（6个）：** farm, market, barracks, clinic, academy, lumberyard  
**新（4个）：** farm, market, lumberyard, clinic

---

## 五、依赖关系图

```
╔══════════════════════════════════════════════════════════════════════════╗
║                    三国霸业 — 建筑依赖关系图 v2.0                        ║
╚══════════════════════════════════════════════════════════════════════════╝

  ┌─────────────────────────────────────────────────────────────────────┐
  │  T1 资源采集层（初始解锁）                                            │
  │                                                                     │
  │   🌾 屯田          💰 商行         🪓 伐木场        💊 药庐          │
  │   grain 1.0/s     gold 0.8/s     wood 0.8/s      morale 1.2/s     │
  │   {grain,gold}    {grain,gold}   {grain,gold}    {gold,grain}     │
  └──────┬──────────────┬──────────────┬──────────────┬────────────────┘
         │              │              │              │
         │         ┌────┴────┐         │         ┌────┘
         │         │         │         │         │
  ┌──────┴─────────┴────┐    │  ┌──────┴─────┐   │  ┌──────────────────┐
  │  T2 加工/军事层       │    │  │            │   │  │                  │
  │                      │    │  │            │   │  │                  │
  │  ⚔️ 军营    📚 太学   │    │  │ 🏰 城防    │   └─→ 🍵 茶馆 (T3)    │
  │  troops    destiny   │    │  │ troops     │      morale 1.5/s     │
  │  {grain,gold}        │    │  │ {gold,     │      {gold,grain}     │
  │  累计200grain解锁     │    │  │   grain,   │      需药庐Lv.3       │
  │                      │    │  │   wood}    │                         │
  │  ⛏️ 矿场             │    │  │ 需伐木场    │                         │
  │  iron 0.6/s          │    │  │  Lv.3      │                         │
  │  {grain,gold,wood}   │    │  └─────┬──────┘                         │
  │  累计300gold解锁      │    │        │                                │
  │         │            │    │  ┌──────┴──────┐                         │
  │         ▼            │    │  │  🔥 烽火台   │                         │
  │  🔨 铁匠铺 (T2)      │    │  │  morale     │                         │
  │  iron 1.0/s          │    │  │  0.8/s      │                         │
  │  {gold,grain,iron}   │    │  │  {gold,     │                         │
  │  需矿场Lv.3          │    │  │   wood,iron}│                         │
  │         │            │    │  │  需城防Lv.3  │                         │
  └─────────┼────────────┘    │  └─────────────┘                         │
            │                 │                                          │
  ┌─────────┼─────────────────┼──────────────────────────────────────┐   │
  │  T3 进阶层               │                                      │   │
  │                          │                                      │   │
  │  🏚️ 粮仓      🏛️ 钱庄   │                                      │   │
  │  grain 1.5/s  gold 1.8/s │                                      │   │
  │  {grain,gold} {gold,     │                                      │   │
  │  需屯田Lv.5    grain}    │                                      │   │
  │                需商行Lv.5 │                                      │   │
  └──────────────────────────┼──────────────────────────────────────┘   │
                             │                                          │
  ┌──────────────────────────┼──────────────────────────────────────────┐
  │  T4 高级层               │                                          │
  │                          │                                          │
  │  ⚒️ 锻兵坊    🏯 招贤馆   │                                          │
  │  iron 1.5/s  destiny 1.5/s                                          │
  │  {gold,iron,  {gold,                                                │
  │   wood}        destiny}                                             │
  │  需铁匠铺Lv.4  需太学Lv.3                                            │
  └─────────────────────────────────────────────────────────────────────┘
```

### 简化依赖路径图

```
farm ──────────────────────→ granary (T3, 粮仓)
market ────────────────────→ mint (T3, 钱庄)
lumberyard ────────────────→ wall (T2, 城防) ──→ beacon_tower (T3, 烽火台)
clinic ────────────────────→ teahouse (T3, 茶馆)
[资源阈值: grain≥200] ────→ barracks (T2, 军营)
[资源阈值: gold≥300] ────→ mine (T2, 矿场) ──→ smithy (T2, 铁匠铺) ──→ forge (T4, 锻兵坊)
[资源阈值: gold≥1000] ───→ academy (T2, 太学) ──→ tavern (T4, 招贤馆)
```

---

## 六、资源产出平衡分析

### 6.1 各资源产出路径

| 资源 | 产出建筑数 | T1产出 | T2产出 | T3/T4产出 | 总基础产出/s (全Lv.1) |
|------|-----------|--------|--------|-----------|---------------------|
| grain | 2 | 屯田 1.0 | — | 粮仓 1.5 | 2.5 |
| gold | 2 | 商行 0.8 | — | 钱庄 1.8 | 2.6 |
| wood | 1 | 伐木场 0.8 | — | — | 0.8 |
| iron | 3 | — | 矿场 0.6, 铁匠铺 1.0 | 锻兵坊 1.5 | 3.1 |
| troops | 2 | — | 军营 0.5, 城防 0.3 | — | 0.8 |
| morale | 3 | 药庐 1.2 | — | 茶馆 1.5, 烽火台 0.8 | 3.5 |
| destiny | 2 | — | 太学 0.5 | 招贤馆 1.5 | 2.0 |

### 6.2 前期资源流（前 5 分钟）

```
时间线：
t=0s    解锁: farm, market, lumberyard, clinic (4个)
        初始资源: grain=500, gold=400, iron=30, wood=50, troops=200, destiny=100, morale=50

t=30s   玩家建造: farm Lv.1 → grain +1.0/s
        玩家建造: market Lv.1 → gold +0.8/s
        玩家建造: lumberyard Lv.1 → wood +0.8/s

t=60s   累计 grain ≈ 560 → 接近 barracks 解锁阈值(200累计)
        实际: 初始500 + 60s产出 ≈ 已远超200
        ✅ barracks 解锁！

t=120s  累计 gold ≈ 500+ → 接近 mine 解锁阈值(300累计)  
        ✅ mine 解锁！iron 开始有基础产出

t=180s  累计 gold ≈ 600+ → 接近 academy 解锁阈值(1000累计)
        继续积累...
        
t=300s  累计 gold ≈ 800+ → academy 接近解锁
        mine Lv.3 达成 → smithy 可解锁
```

### 6.3 死锁验证

| 场景 | 是否死锁 | 说明 |
|------|---------|------|
| iron 无产出 | ✅ 安全 | mine 仅需 {grain,gold,wood}，不依赖 iron |
| wood 无产出 | ✅ 安全 | lumberyard 初始解锁，仅需 {grain,gold} |
| troops 无产出 | ✅ 安全 | barracks 仅需 {grain,gold}，grain 阈值解锁 |
| wall 无法建造 | ✅ 安全 | wall 需 lumberyard Lv.3，lumberyard 初始解锁 |
| forge 无法建造 | ✅ 安全 | forge 依赖链: lumberyard→mine→smithy→forge，无循环 |

---

## 七、解锁条件详细设计

### 7.1 资源阈值解锁（无 requires 的建筑）

| 建筑ID | 阈值条件 | 预计解锁时间 |
|--------|---------|------------|
| barracks | grain ≥ 200 | ~0s（初始500已满足） |
| mine | gold ≥ 300 | ~0s（初始400已满足） |
| academy | gold ≥ 1000 | ~120s |

> **注意：** 由于初始资源 grain=500, gold=400，barracks 和 mine 在游戏开始时即可解锁。
> 但为了教学节奏，建议在 UI 层面做延迟提示（如完成第一个任务后弹出解锁提示）。

### 7.2 建筑依赖解锁（有 requires 的建筑）

| 建筑ID | 前置建筑 | 所需等级 | 预计达成时间 |
|--------|---------|---------|------------|
| smithy | mine | Lv.3 | ~180s |
| wall | lumberyard | Lv.3 | ~120s |
| granary | farm | Lv.5 | ~300s |
| mint | market | Lv.5 | ~300s |
| teahouse | clinic | Lv.3 | ~180s |
| beacon_tower | wall | Lv.3 | ~360s |
| tavern | academy | Lv.3 | ~420s |
| forge | smithy | Lv.4 | ~480s |

---

## 八、升级费用成长曲线

### 8.1 费用公式

```
cost(level) = floor(baseCost * costMultiplier ^ level)
```

### 8.2 各建筑升级费用示例（Lv.1 → Lv.10）

#### T1 建筑：屯田 (costMultiplier: 1.15)
| Lv | grain | gold | 总价值 |
|----|-------|------|--------|
| 1 | 12 | 5 | 17 |
| 3 | 16 | 7 | 23 |
| 5 | 21 | 9 | 30 |
| 10 | 42 | 17 | 59 |

#### T2 建筑：矿场 (costMultiplier: 1.12)
| Lv | grain | gold | wood | 总价值 |
|----|-------|------|------|--------|
| 1 | 50 | 30 | 10 | 90 |
| 3 | 63 | 38 | 13 | 114 |
| 5 | 79 | 47 | 16 | 142 |
| 10 | 155 | 93 | 31 | 279 |

#### T4 建筑：锻兵坊 (costMultiplier: 1.11)
| Lv | gold | iron | wood | 总价值 |
|----|------|------|------|--------|
| 1 | 300 | 80 | 30 | 410 |
| 3 | 370 | 99 | 37 | 506 |
| 5 | 456 | 122 | 46 | 624 |
| 10 | 762 | 203 | 76 | 1041 |

---

## 九、配置代码（TypeScript）

```typescript
// ═══════════════════════════════════════════════════════════════
// 建筑系统 (15个) — v2.0 重新设计
// ═══════════════════════════════════════════════════════════════

export const BUILDING_DESCRIPTIONS: Record<string, string> = {
  farm: '曹操推行屯田制，兵农合一，粮草源源不断',
  market: '天下商贾汇聚，互通有无，富国强兵',
  lumberyard: '深山伐木，广积材用，筑城建军皆所需',
  clinic: '悬壶济世，妙手回春，保百姓安居乐业',
  barracks: '练兵千日，用兵一时，铁血铸就精锐之师',
  mine: '开山采矿，百炼成钢，铸造兵器之根本',
  academy: '太学兴教，传承经典，培育经天纬地之才',
  smithy: '千锤百炼，铸造神兵利器，武装三军将士',
  wall: '高城深池，驻军守备，固若金汤守四方',
  granary: '仓廪实而知礼节，粮草丰足军心稳',
  mint: '天下财富汇聚于此，铜钱滚滚而来',
  teahouse: '品茗论天下，坊间传闻皆可知',
  beacon_tower: '烽火连天，预警四方，安定民心',
  tavern: '天下英雄尽入吾彀中，招贤纳士聚英才',
  forge: '千锤百炼出精钢，神兵利器由此来',
};

export const BUILDINGS: BuildingDef[] = [
  // ── T1 资源采集层（初始解锁） ──────────────────────────────
  {
    id: 'farm', name: '屯田', icon: '🌾', category: 'resource',
    baseCost: { grain: 12, gold: 5 }, costMultiplier: 1.15, maxLevel: 0,
    productionResource: 'grain', baseProduction: 1.0,
    unlockCondition: '初始解锁',
  },
  {
    id: 'market', name: '商行', icon: '💰', category: 'economic',
    baseCost: { grain: 80, gold: 30 }, costMultiplier: 1.15, maxLevel: 0,
    productionResource: 'gold', baseProduction: 0.8,
    unlockCondition: '初始解锁',
  },
  {
    id: 'lumberyard', name: '伐木场', icon: '🪓', category: 'resource',
    baseCost: { grain: 40, gold: 20 }, costMultiplier: 1.12, maxLevel: 0,
    productionResource: 'wood', baseProduction: 0.8,
    unlockCondition: '初始解锁',
  },
  {
    id: 'clinic', name: '药庐', icon: '💊', category: 'civilian',
    baseCost: { gold: 80, grain: 60 }, costMultiplier: 1.08, maxLevel: 0,
    productionResource: 'morale', baseProduction: 1.2,
    unlockCondition: '初始解锁',
  },

  // ── T2 加工/军事层（资源阈值解锁） ──────────────────────────
  {
    id: 'barracks', name: '军营', icon: '⚔️', category: 'military',
    baseCost: { grain: 30, gold: 20 }, costMultiplier: 1.09, maxLevel: 0,
    productionResource: 'troops', baseProduction: 0.5,
    unlockCondition: '累计 200 粮草',
  },
  {
    id: 'mine', name: '矿场', icon: '⛏️', category: 'resource',
    baseCost: { grain: 50, gold: 30, wood: 10 }, costMultiplier: 1.12, maxLevel: 0,
    productionResource: 'iron', baseProduction: 0.6,
    unlockCondition: '累计 300 铜钱',
  },
  {
    id: 'academy', name: '太学', icon: '📚', category: 'civilian',
    baseCost: { gold: 200 }, costMultiplier: 1.12, maxLevel: 0,
    productionResource: 'destiny', baseProduction: 0.5,
    unlockCondition: '累计 1000 铜钱',
  },
  {
    id: 'smithy', name: '铁匠铺', icon: '🔨', category: 'resource',
    baseCost: { gold: 50, grain: 30, iron: 10 }, costMultiplier: 1.10, maxLevel: 0,
    productionResource: 'iron', baseProduction: 1.0,
    requires: ['mine'],
    unlockCondition: '矿场 Lv.3',
  },
  {
    id: 'wall', name: '城防', icon: '🏰', category: 'military',
    baseCost: { gold: 120, grain: 60, wood: 20 }, costMultiplier: 1.15, maxLevel: 0,
    productionResource: 'troops', baseProduction: 0.3,
    requires: ['lumberyard'],
    unlockCondition: '伐木场 Lv.3',
  },

  // ── T3 进阶层（建筑依赖解锁） ──────────────────────────────
  {
    id: 'granary', name: '粮仓', icon: '🏚️', category: 'resource',
    baseCost: { grain: 200, gold: 100 }, costMultiplier: 1.10, maxLevel: 0,
    productionResource: 'grain', baseProduction: 1.5,
    requires: ['farm'],
    unlockCondition: '屯田 Lv.5',
  },
  {
    id: 'mint', name: '钱庄', icon: '🏛️', category: 'economic',
    baseCost: { gold: 400, grain: 200 }, costMultiplier: 1.14, maxLevel: 0,
    productionResource: 'gold', baseProduction: 1.8,
    requires: ['market'],
    unlockCondition: '商行 Lv.5',
  },
  {
    id: 'teahouse', name: '茶馆', icon: '🍵', category: 'civilian',
    baseCost: { gold: 150, grain: 100 }, costMultiplier: 1.09, maxLevel: 0,
    productionResource: 'morale', baseProduction: 1.5,
    requires: ['clinic'],
    unlockCondition: '药庐 Lv.3',
  },
  {
    id: 'beacon_tower', name: '烽火台', icon: '🔥', category: 'military',
    baseCost: { gold: 150, wood: 30, iron: 15 }, costMultiplier: 1.12, maxLevel: 0,
    productionResource: 'morale', baseProduction: 0.8,
    requires: ['wall'],
    unlockCondition: '城防 Lv.3',
  },

  // ── T4 高级层（高级前置） ──────────────────────────────────
  {
    id: 'tavern', name: '招贤馆', icon: '🏯', category: 'civilian',
    baseCost: { gold: 500, destiny: 50 }, costMultiplier: 1.18, maxLevel: 0,
    productionResource: 'destiny', baseProduction: 1.5,
    requires: ['academy'],
    unlockCondition: '太学 Lv.3',
  },
  {
    id: 'forge', name: '锻兵坊', icon: '⚒️', category: 'military',
    baseCost: { gold: 300, iron: 80, wood: 30 }, costMultiplier: 1.11, maxLevel: 0,
    productionResource: 'iron', baseProduction: 1.5,
    requires: ['smithy'],
    unlockCondition: '铁匠铺 Lv.4',
  },
];

// ═══════════════════════════════════════════════════════════════
// 初始解锁建筑（4个，降低新手信息量）
// ═══════════════════════════════════════════════════════════════

export const INITIALLY_UNLOCKED: string[] = [
  'farm',       // 屯田 — 产出粮草
  'market',     // 商行 — 产出铜钱
  'lumberyard', // 伐木场 — 产出木材
  'clinic',     // 药庐 — 产出民心
];

// ═══════════════════════════════════════════════════════════════
// 资源阈值解锁配置
// ═══════════════════════════════════════════════════════════════

// 引擎中 RESOURCE_UNLOCK_THRESHOLDS 需更新为：
private static readonly RESOURCE_UNLOCK_THRESHOLDS: Record<string, Record<string, number>> = {
  barracks: { grain: 200 },    // 累计 200 粮草
  mine: { gold: 300 },         // 累计 300 铜钱
  academy: { gold: 1000 },     // 累计 1000 铜钱
};
```

---

## 十、变更影响评估

### 10.1 代码变更范围

| 文件 | 变更类型 | 影响范围 |
|------|---------|---------|
| `constants.ts` | 修改 | BUILDINGS 数组、BUILDING_DESCRIPTIONS、INITIALLY_UNLOCKED |
| `ThreeKingdomsEngine.ts` | 修改 | RESOURCE_UNLOCK_THRESHOLDS 新增 mine |
| 测试文件 | 修改 | 建筑数量断言、初始解锁断言、依赖关系测试 |

### 10.2 存档兼容性

| 场景 | 处理方式 |
|------|---------|
| 旧存档有 lumberyard 等级 | ✅ 兼容，ID 不变 |
| 旧存档有 beacon_tower 产出 iron | ⚠️ 需迁移：产出改为 morale |
| 旧存档无 mine | ✅ 新建筑默认 Lv.0，不影响 |
| 旧存档有 academy 初始解锁 | ✅ 降级为非初始解锁，但已解锁状态保留 |

### 10.3 测试用例清单

```
✅ 初始解锁建筑为 4 个
✅ 所有 15 个建筑有唯一 ID
✅ mine 不依赖任何建筑，仅资源阈值解锁
✅ smithy 依赖 mine（非 barracks）
✅ beacon_tower 产出 morale（非 iron）
✅ wall 消耗 wood（baseCost 含 wood）
✅ 依赖链最深 3 层（farm→granary, lumberyard→wall→beacon_tower）
✅ 无循环依赖
✅ 所有 T1 建筑费用仅含 grain/gold
✅ 初始资源满足第一个建筑建造
```

---

## 十一、后续优化建议

1. **mine 图标**：当前使用 ⛏️，可考虑程序化绘制矿场图标
2. **beacon_tower 功能增强**：可增加"预警"被动效果，如减少被攻击时的资源损失
3. **wall 消耗 wood 机制**：可增加每级持续 wood 消耗（维护费），增强策略深度
4. **建筑分类筛选**：UI 增加按 category（resource/economic/military/civilian）筛选
5. **依赖链可视化**：在建筑详情弹窗中显示前置建筑链
