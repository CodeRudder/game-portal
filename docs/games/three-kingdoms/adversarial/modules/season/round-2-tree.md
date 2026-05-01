# Season 流程分支树 Round 2（精简版）

> Builder: TreeBuilder v2.0 | Date: 2026-05-01
> 基于: R1 verdict + R1 fixes (5 FIX, 7 P0 resolved)
> 策略: R1 P0 节点标记为 ✅ FIX-VERIFIED，R1 uncovered P1/P2 重新评估

## 统计

| 子系统 | R1节点 | R1 P0已修 | R2保留 | R2新增 | R2总节点 |
|--------|--------|----------|--------|--------|---------|
| SeasonSystem | 72 | 7→FIX | 52 | 4 | 56 |
| season-config | 18 | 1→FIX | 17 | 1 | 18 |
| **总计** | **94** | **8→FIX** | **69** | **5** | **74** |

---

## 1. SeasonSystem

### 1.1 构造器 & ISubsystem 适配

| # | API | 分支条件 | 优先级 | R1状态 | R2状态 |
|---|-----|---------|--------|--------|--------|
| SS-001 | `constructor()` | 初始 state 正确 | P1 | ✅ covered | ✅ RETAIN |
| SS-002 | `init(deps)` | deps 注入后 eventBus 可用 | P1 | ✅ covered | ✅ RETAIN |
| SS-003 | `update(dt)` | 空操作不抛错 | P1 | ✅ covered | ✅ RETAIN |
| SS-004 | `getState()` | 返回深拷贝快照 | P1 | ✅ covered | ✅ RETAIN |
| SS-005 | `reset()` | 清除所有状态 + counter=0 | P1 | ✅ covered | ✅ RETAIN |
| SS-006 | `init(deps)` | deps=null 时 eventBus?.emit 不崩溃 | P0 | ⚠️ uncovered | 🔍 R2-VERIFY: 可选链 `this.deps?.eventBus?.emit` 是否安全 |

### 1.2 赛季创建

| # | API | 分支条件 | 优先级 | R1状态 | R2状态 |
|---|-----|---------|--------|--------|--------|
| SS-010 | `createSeason(name)` | 正常创建 | P1 | ✅ covered | ✅ RETAIN |
| SS-011 | `createSeason(name, dur)` | 自定义持续天数 | P1 | ✅ covered | ✅ RETAIN |
| SS-012 | `createSeason(name)` | 触发 season:created 事件 | P1 | ✅ covered | ✅ RETAIN |
| SS-013 | `createSeason(name)` | 有活跃旧赛季时自动结算 | P1 | ✅ covered | ✅ RETAIN |
| SS-014 | `createSeason(name, NaN)` | durationDays=NaN | **P0** | ⚠️ uncovered | ✅ **FIX-S03 VERIFIED** — `!Number.isFinite(NaN)` → 回退默认值 |
| SS-015 | `createSeason(name, 0)` | durationDays=0 | P1 | ⚠️ uncovered | ✅ **FIX-S03 COVERED** — `0 <= 0` → 回退默认值 |
| SS-016 | `createSeason(name, -1)` | durationDays=-1 | P1 | ⚠️ uncovered | ✅ **FIX-S03 COVERED** — `-1 <= 0` → 回退默认值 |
| SS-017 | `createSeason(name, Infinity)` | durationDays=Infinity | **P0** | ⚠️ uncovered | ✅ **FIX-S03 VERIFIED** — `!Number.isFinite(Infinity)` → 回退默认值 |
| SS-018 | `createSeason('')` | name=空字符串 | P2 | ⚠️ uncovered | 🟡 DEFER — 策略层校验，非引擎职责 |

### 1.3 赛季查询

| # | API | 分支条件 | 优先级 | R1状态 | R2状态 |
|---|-----|---------|--------|--------|--------|
| SS-020 | `getCurrentSeason()` | 无赛季 → null | P1 | ✅ covered | ✅ RETAIN |
| SS-021 | `getCurrentSeason()` | 有赛季 → isActive 计算 | P1 | ✅ covered | ✅ RETAIN |
| SS-022 | `getCurrentSeason()` | 赛季过期 → isActive=false | P1 | ⚠️ uncovered | 🔍 R2-VERIFY: 需确认过期场景 |
| SS-023 | `getRemainingDays()` | 正常 | P1 | ✅ covered | ✅ RETAIN |
| SS-024 | `getRemainingDays()` | 赛季过期 → 0 | P1 | ✅ covered | ✅ RETAIN |
| SS-025 | `getRemainingDays()` | 无赛季 → 0 | P1 | ✅ covered | ✅ RETAIN |
| SS-026 | `getRemainingDays()` | endTime=NaN → NaN | **P0** | ⚠️ uncovered | ✅ **FIX-S03 VERIFIED** — endTime不再可能为NaN |
| SS-027 | `getElapsedDays()` | 正常 | P1 | ✅ covered | ✅ RETAIN |
| SS-028 | `getElapsedDays()` | 无赛季 → 0 | P1 | ✅ covered | ✅ RETAIN |

### 1.4 积分系统

| # | API | 分支条件 | 优先级 | R1状态 | R2状态 |
|---|-----|---------|--------|--------|--------|
| SS-030 | `addScore(heroId, score)` | 正常添加 | P1 | ✅ covered | ✅ RETAIN |
| SS-031 | `addScore(heroId, score)` | 累加积分 | P1 | ✅ covered | ✅ RETAIN |
| SS-032 | `addScore(heroId, 0)` | 忽略0值 | P1 | ✅ covered | ✅ RETAIN |
| SS-033 | `addScore(heroId, -10)` | 忽略负值 | P1 | ✅ covered | ✅ RETAIN |
| SS-034 | `addScore(heroId, NaN)` | NaN穿透 | **P0** | ⚠️ uncovered | ✅ **FIX-S01 VERIFIED** — `!Number.isFinite(NaN)` → return |
| SS-035 | `addScore(heroId, Infinity)` | Infinity穿透 | **P0** | ⚠️ uncovered | ✅ **FIX-S01 VERIFIED** — `!Number.isFinite(Infinity)` → return |
| SS-036 | `addScore(heroId, score)` | 无活跃赛季抛错 | P1 | ✅ covered | ✅ RETAIN |
| SS-037 | `addScore(heroId, score)` | 过期赛季抛错 | P1 | ✅ covered | ✅ RETAIN |
| SS-038 | `addScore(heroId, 1e15)` | 极大值溢出 | P1 | ⚠️ uncovered | 🟡 DEFER — 需策划定义 MAX_SCORE (P1-02) |
| SS-039 | `setScore(heroId, score)` | 覆盖积分 | P1 | ✅ covered | ✅ RETAIN |
| SS-040 | `setScore(heroId, NaN)` | NaN写入 | **P0** | ⚠️ uncovered | ✅ **FIX-S02 VERIFIED** — `!Number.isFinite(NaN)` → return |
| SS-041 | `setScore(heroId, -1)` | 负值写入 | P1 | ⚠️ uncovered | ✅ **FIX-S02 VERIFIED** — `score < 0` → return |
| SS-042 | `setScore(heroId, score)` | 无活跃赛季抛错 | P1 | ⚠️ uncovered | 🔍 R2-VERIFY: ensureActiveSeason() 应覆盖 |
| SS-043 | `getScore(heroId)` | 存在 → score | P1 | ✅ covered | ✅ RETAIN |
| SS-044 | `getScore(heroId)` | 不存在 → 0 | P1 | ✅ covered | ✅ RETAIN |

### 1.5 排行榜

| # | API | 分支条件 | 优先级 | R1状态 | R2状态 |
|---|-----|---------|--------|--------|--------|
| SS-050 | `getLeaderboard()` | 降序排列 | P1 | ✅ covered | ✅ RETAIN |
| SS-051 | `getLeaderboard(limit)` | 限制条数 | P1 | ✅ covered | ✅ RETAIN |
| SS-052 | `getLeaderboard()` | 含奖励 | P1 | ✅ covered | ✅ RETAIN |
| SS-053 | `getLeaderboard()` | scores含NaN排序 | P1 | ⚠️ uncovered | ✅ **FIX-S01/S02 VERIFIED** — NaN无法进入scores |
| SS-054 | `getLeaderboard(Infinity)` | settleSeason使用 | P1 | ✅ covered | ✅ RETAIN |
| SS-055 | `getLeaderboard(NaN)` | NaN limit | P1 | ⚠️ uncovered | 🔍 R2-VERIFY: `slice(0, NaN)` → `[]` |
| SS-056 | `getLeaderboard(-1)` | 负数limit | P1 | ⚠️ uncovered | 🔍 R2-VERIFY: `slice(0, -1)` → 去尾 |
| SS-057 | `getHeroRank(heroId)` | 正确排名 | P1 | ✅ covered | ✅ RETAIN |
| SS-058 | `getHeroRank(heroId)` | 未上榜 → -1 | P1 | ✅ covered | ✅ RETAIN |

### 1.6 赛季结算

| # | API | 分支条件 | 优先级 | R1状态 | R2状态 |
|---|-----|---------|--------|--------|--------|
| SS-060 | `settleSeason()` | 正常结算 | P1 | ✅ covered | ✅ RETAIN |
| SS-061 | `settleSeason()` | 结算后currentSeason=null | P1 | ✅ covered | ✅ RETAIN |
| SS-062 | `settleSeason()` | 积分清零 | P1 | ✅ covered | ✅ RETAIN |
| SS-063 | `settleSeason()` | season:settled事件 | P1 | ✅ covered | ✅ RETAIN |
| SS-064 | `settleSeason()` | 无赛季抛错 | P1 | ✅ covered | ✅ RETAIN |
| SS-065 | `settleSeason()` | 结算后排行榜为空 | P1 | ✅ covered | ✅ RETAIN |
| SS-066 | `settleSeason()` | 归档history | P1 | ✅ covered | ✅ RETAIN |
| SS-067 | `settleSeason()` | settledSeasonIds记录 | P1 | ✅ covered | ✅ RETAIN |
| SS-068 | `settleSeason()` | 0参与者 → topRank=null | P1 | ⚠️ uncovered | ✅ **VERIFIED** — `rankings[0] ?? null` 已防护 |

### 1.7 赛季历史

| # | API | 分支条件 | 优先级 | R1状态 | R2状态 |
|---|-----|---------|--------|--------|--------|
| SS-070 | `getSeasonHistory()` | 返回历史列表 | P1 | ✅ covered | ✅ RETAIN |
| SS-071 | `getSeasonHistory()` | 多赛季按时间升序 | P1 | ✅ covered | ✅ RETAIN |
| SS-072 | `getSettledSeasonCount()` | 正确计数 | P1 | ✅ covered | ✅ RETAIN |
| SS-073 | `isSeasonSettled(id)` | 已结算 → true | P1 | ✅ covered | ✅ RETAIN |
| SS-074 | `isSeasonSettled(id)` | 未结算 → false | P1 | ✅ covered | ✅ RETAIN |

### 1.8 奖励查询

| # | API | 分支条件 | 优先级 | R1状态 | R2状态 |
|---|-----|---------|--------|--------|--------|
| SS-076 | `getSeasonRewards(rank)` | 委托 getRewardsForRank | P1 | ✅ covered | ✅ RETAIN |

### 1.9 序列化 / 反序列化

| # | API | 分支条件 | 优先级 | R1状态 | R2状态 |
|---|-----|---------|--------|--------|--------|
| SS-080 | `serialize()` | 返回有效存档 | P1 | ✅ covered | ✅ RETAIN |
| SS-081 | `serialize()` | 与 getSaveData 一致 | P1 | ✅ covered | ✅ RETAIN |
| SS-082 | `getSaveData()` | 正确序列化 | P1 | ✅ covered | ✅ RETAIN |
| SS-083 | `loadSaveData(data)` | 恢复赛季状态 | P1 | ✅ covered | ✅ RETAIN |
| SS-084 | `loadSaveData(data)` | 恢复历史记录 | P1 | ✅ covered | ✅ RETAIN |
| SS-085 | `loadSaveData(data)` | 版本不匹配忽略 | P1 | ✅ covered | ✅ RETAIN |
| SS-086 | `loadSaveData(data)` | JSON round-trip | P1 | ✅ covered | ✅ RETAIN |
| SS-087 | `loadSaveData(null)` | null输入崩溃 | **P0** | ⚠️ uncovered | ✅ **FIX-S04 VERIFIED** — `if (!data)` → return |
| SS-088 | `loadSaveData(data)` | state=null崩溃 | **P0** | ⚠️ uncovered | ✅ **FIX-S04 VERIFIED** — `if (!data.state)` → return |
| SS-089 | `loadSaveData(data)` | scores含NaN恢复 | **P0** | ⚠️ uncovered | ✅ **FIX-S05 VERIFIED** — `.filter(s => s && Number.isFinite(s.score) && s.score >= 0)` |
| SS-090 | `loadSaveData(data)` | seasonCounter恢复 | P1 | ⚠️ uncovered | 🔍 R2-VERIFY: counter从history.length恢复 |
| SS-091 | `getSaveData()` | endTime=Infinity序列化 | **P0** | ⚠️ uncovered | ✅ **FIX-S03 VERIFIED** — endTime不再可能为Infinity |

### 1.10 R2 新增节点（跨系统/边界）

| # | API | 分支条件 | 优先级 | R2状态 |
|---|-----|---------|--------|--------|
| SS-100 | `createSeason()` 连续创建 | 3个赛季连续创建+结算，history正确 | P1 | 🔍 R2-NEW: 多赛季生命周期 |
| SS-101 | `loadSaveData()` → `addScore()` | 反序列化后立即添加积分 | P1 | 🔍 R2-NEW: 状态恢复后操作一致性 |
| SS-102 | `loadSaveData()` → `settleSeason()` | 恢复含currentSeason的存档后结算 | P1 | 🔍 R2-NEW: 恢复-结算链路 |
| SS-103 | `reset()` → `createSeason()` | reset后创建新赛季，counter从0开始 | P1 | 🔍 R2-NEW: reset-创建链路 |
| SS-104 | `settleSeason()` → `createSeason()` → `addScore()` | 完整生命周期 | P1 | 🔍 R2-NEW: 端到端流程 |

---

## 2. season-config

| # | API | 分支条件 | 优先级 | R1状态 | R2状态 |
|---|-----|---------|--------|--------|--------|
| SC-001~SC-004 | 常量 | 值验证 | P1 | ✅ covered | ✅ RETAIN |
| SC-010~SC-015 | `getRewardsForRank` | 正常排名 | P1 | ✅ covered | ✅ RETAIN |
| SC-016 | `getRewardsForRank(NaN)` | NaN rank | P1 | ⚠️ uncovered | 🔍 R2-VERIFY: fallback参与奖 |
| SC-017 | `getRewardsForRank(-1)` | 负rank | P1 | ⚠️ uncovered | 🔍 R2-VERIFY: fallback参与奖 |
| SC-018 | `getRewardsForRank(Infinity)` | Infinity rank | P1 | ⚠️ uncovered | 🔍 R2-VERIFY: fallback参与奖 |
| SC-020~SC-022 | 配置一致性 | 间隙/金额/排序 | P1 | ✅ covered | ✅ RETAIN |

---

## FIX 穿透验证矩阵

| R1 P0 | FIX | R2 验证方法 | 结果 |
|-------|-----|------------|------|
| VER-001 addScore NaN | FIX-S01 | `grep "Number.isFinite" L200-201` | ✅ 源码确认 |
| VER-002 setScore NaN/负值 | FIX-S02 | `grep "Number.isFinite" L219-220` | ✅ 源码确认 |
| VER-003 createSeason NaN | FIX-S03 | `grep "Number.isFinite" L132-133` | ✅ 源码确认 |
| VER-004 createSeason Infinity | FIX-S03 | 同上（合并修复） | ✅ 源码确认 |
| VER-005 loadSaveData null | FIX-S04 | `grep "!data" L385-386` | ✅ 源码确认 |
| VER-006 loadSaveData state=null | FIX-S04 | `grep "!data.state" L386` | ✅ 源码确认 |
| VER-007 loadSaveData scores NaN | FIX-S05 | `grep "filter.*isFinite" L391` | ✅ 源码确认 |

**穿透率: 100% — 所有7个P0已通过源码验证**

---

## R2 待验证清单（Challenger 重点）

| ID | 节点 | 验证项 | 风险 |
|----|------|--------|------|
| V-01 | SS-006 | init(null) 是否安全 | 中 |
| V-02 | SS-022 | 过期赛季 isActive=false | 低 |
| V-03 | SS-042 | setScore 无赛季抛错 | 低 |
| V-04 | SS-055 | getLeaderboard(NaN) → [] | 低 |
| V-05 | SS-056 | getLeaderboard(-1) → 去尾 | 低 |
| V-06 | SS-090 | seasonCounter 恢复 | 低 |
| V-07 | SC-016/17/18 | getRewardsForRank 边界值 | 低 |
| V-08 | SS-100~104 | 多步骤生命周期 | 中 |
