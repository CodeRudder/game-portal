# Season 流程分支树 Round 1

> Builder: TreeBuilder v1.8 | Time: 2026-05-01
> 模块: season | 文件: 3 | 源码: 551行 | API: ~18

## 统计

| 子系统 | 节点数 | API数 | covered | uncovered | todo | P0 | P1 |
|--------|--------|-------|---------|-----------|------|----|----|
| SeasonSystem | 72 | 15 | 48 | 24 | 0 | 10 | 14 |
| season-config | 18 | 3 | 16 | 2 | 0 | 1 | 1 |
| index.ts | 4 | 0 | 4 | 0 | 0 | 0 | 0 |
| **总计** | **94** | **18** | **68** | **26** | **0** | **11** | **15** |

## 子系统覆盖

| 子系统 | 文件 | 行数 | API数 | 节点数 | covered | uncovered | 覆盖率 |
|--------|------|------|-------|--------|---------|-----------|--------|
| SeasonSystem | SeasonSystem.ts | 415 | 15 | 72 | 48 | 24 | 66.7% |
| season-config | season-config.ts | 120 | 3 | 18 | 16 | 2 | 88.9% |
| index.ts | index.ts | 16 | 0 | 4 | 4 | 0 | 100% |

## 跨系统链路覆盖

| 链路域 | 链路数 | covered | uncovered |
|--------|--------|---------|-----------|
| Season↔EventBus（赛季创建/结算事件） | 4 | 4 | 0 |
| Season↔Save（serialize/deserialize） | 4 | 3 | 1 |
| Season↔Engine（ISubsystem生命周期） | 3 | 2 | 1 |
| Season↔Config（奖励阶梯查询） | 2 | 2 | 0 |
| **总计** | **13** | **11** | **2** |

---

## 1. SeasonSystem（SeasonSystem.ts — 415行）

### 1.1 构造器 & ISubsystem 适配

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| SS-001 | `constructor()` | 初始 state = { currentSeason:null, scores:[], history:[], settledSeasonIds:[] } | P1 | ✅ covered | season-system.test.ts:初始化 |
| SS-002 | `init(deps)` | deps 注入后 eventBus 可用 | P1 | ✅ covered | season-system.test.ts:mockDeps |
| SS-003 | `update(dt)` | 空操作不抛错 | P1 | ✅ covered | season-system.test.ts:update()不抛错 |
| SS-004 | `getState()` | 返回深拷贝快照 | P1 | ✅ covered | season-system.test.ts:getState |
| SS-005 | `reset()` | 清除所有状态 + seasonCounter=0 | P1 | ✅ covered | season-system.test.ts:reset |
| SS-006 | `init(deps)` | deps=null 时 eventBus?.emit 不崩溃 | P0 | ⚠️ uncovered | 无null-deps测试 |

### 1.2 赛季创建

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| SS-010 | `createSeason(name)` | 正常创建，返回SeasonInfo | P1 | ✅ covered | season-system.test.ts:创建赛季 |
| SS-011 | `createSeason(name, durationDays)` | 自定义持续天数 | P1 | ✅ covered | season-system.test.ts:自定义持续天数 |
| SS-012 | `createSeason(name)` | 触发 season:created 事件 | P1 | ✅ covered | season-system.test.ts:事件触发 |
| SS-013 | `createSeason(name)` | 有活跃旧赛季时自动结算 | P1 | ✅ covered | season-system.test.ts:自动结算 |
| SS-014 | `createSeason(name, NaN)` | durationDays=NaN → endTime=NaN → 赛季永久活跃 | **P0** | ⚠️ uncovered | 无NaN测试 |
| SS-015 | `createSeason(name, 0)` | durationDays=0 → endTime=now → 赛季立即过期 | P1 | ⚠️ uncovered | 无0天测试 |
| SS-016 | `createSeason(name, -1)` | durationDays=-1 → endTime=过去 → 赛季已过期 | P1 | ⚠️ uncovered | 无负数测试 |
| SS-017 | `createSeason(name, Infinity)` | durationDays=Infinity → endTime=Infinity → 序列化问题 | **P0** | ⚠️ uncovered | BR-19: Infinity序列化 |
| SS-018 | `createSeason('')` | name=空字符串 → 创建成功但无意义 | P2 | ⚠️ uncovered | 低优先级 |

### 1.3 赛季查询

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| SS-020 | `getCurrentSeason()` | 无赛季 → null | P1 | ✅ covered | season-system.test.ts |
| SS-021 | `getCurrentSeason()` | 有赛季 → 动态计算 isActive | P1 | ✅ covered | season-system.test.ts |
| SS-022 | `getCurrentSeason()` | 赛季过期 → isActive=false | P1 | ⚠️ uncovered | 无过期isActive测试 |
| SS-023 | `getRemainingDays()` | 正常剩余天数 | P1 | ✅ covered | season-system.test.ts |
| SS-024 | `getRemainingDays()` | 赛季过期 → 0 | P1 | ✅ covered | season-system.test.ts |
| SS-025 | `getRemainingDays()` | 无赛季 → 0 | P1 | ✅ covered | season-system.test.ts |
| SS-026 | `getRemainingDays()` | endTime=NaN → NaN-Date.now()=NaN → Math.max(0,NaN)=NaN | **P0** | ⚠️ uncovered | SS-014的下游影响 |
| SS-027 | `getElapsedDays()` | 正常已过天数 | P1 | ✅ covered | season-system.test.ts |
| SS-028 | `getElapsedDays()` | 无赛季 → 0 | P1 | ✅ covered | season-system.test.ts |

### 1.4 积分系统

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| SS-030 | `addScore(heroId, score)` | 正常添加积分 | P1 | ✅ covered | season-system.test.ts |
| SS-031 | `addScore(heroId, score)` | 累加积分 | P1 | ✅ covered | season-system.test.ts |
| SS-032 | `addScore(heroId, 0)` | 忽略0值 | P1 | ✅ covered | season-system.test.ts |
| SS-033 | `addScore(heroId, -10)` | 忽略负值 | P1 | ✅ covered | season-system.test.ts |
| SS-034 | `addScore(heroId, NaN)` | NaN <= 0 → false → NaN通过 → score+=NaN | **P0** | ⚠️ uncovered | BR-01/BR-06: NaN绕过 |
| SS-035 | `addScore(heroId, Infinity)` | Infinity <= 0 → false → Infinity通过 → score=Infinity | **P0** | ⚠️ uncovered | BR-17: 战斗数值安全 |
| SS-036 | `addScore(heroId, score)` | 无活跃赛季抛错 | P1 | ✅ covered | season-system.test.ts |
| SS-037 | `addScore(heroId, score)` | 过期赛季抛错 | P1 | ✅ covered | season-system.test.ts |
| SS-038 | `addScore(heroId, 1e15)` | 极大值 → score溢出 | P1 | ⚠️ uncovered | 无上限常量 |
| SS-039 | `setScore(heroId, score)` | 覆盖积分 | P1 | ✅ covered | season-system.test.ts |
| SS-040 | `setScore(heroId, NaN)` | NaN直接写入score | **P0** | ⚠️ uncovered | 无NaN检查 |
| SS-041 | `setScore(heroId, -1)` | 负值直接写入score | P1 | ⚠️ uncovered | 无负值检查 |
| SS-042 | `setScore(heroId, score)` | 无活跃赛季抛错 | P1 | ⚠️ uncovered | 无测试 |
| SS-043 | `getScore(heroId)` | 存在 → 返回score | P1 | ✅ covered | season-system.test.ts |
| SS-044 | `getScore(heroId)` | 不存在 → 0 | P1 | ✅ covered | season-system.test.ts |

### 1.5 排行榜

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| SS-050 | `getLeaderboard()` | 按积分降序排列 | P1 | ✅ covered | season-system.test.ts |
| SS-051 | `getLeaderboard(limit)` | 限制返回条数 | P1 | ✅ covered | season-system.test.ts |
| SS-052 | `getLeaderboard()` | 排名包含正确奖励 | P1 | ✅ covered | season-system.test.ts |
| SS-053 | `getLeaderboard()` | scores含NaN → 排序不稳定 | P1 | ⚠️ uncovered | NaN比较导致排序异常 |
| SS-054 | `getLeaderboard(Infinity)` | settleSeason使用Infinity作为limit | P1 | ✅ covered | settleSeason隐含 |
| SS-055 | `getLeaderboard(NaN)` | NaN作为limit → slice(0, NaN)返回空数组 | P1 | ⚠️ uncovered | 无NaN-limit测试 |
| SS-056 | `getLeaderboard(-1)` | 负数limit → slice(0, -1)去掉最后一个 | P1 | ⚠️ uncovered | 无负limit测试 |
| SS-057 | `getHeroRank(heroId)` | 正确排名 | P1 | ✅ covered | season-system.test.ts |
| SS-058 | `getHeroRank(heroId)` | 未上榜 → -1 | P1 | ✅ covered | season-system.test.ts |

### 1.6 赛季结算

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| SS-060 | `settleSeason()` | 正常结算返回排行榜 | P1 | ✅ covered | season-system.test.ts |
| SS-061 | `settleSeason()` | 结算后currentSeason=null | P1 | ✅ covered | season-system.test.ts |
| SS-062 | `settleSeason()` | 结算后积分清零 | P1 | ✅ covered | season-system.test.ts |
| SS-063 | `settleSeason()` | 触发 season:settled 事件 | P1 | ✅ covered | season-system.test.ts |
| SS-064 | `settleSeason()` | 无赛季抛错 | P1 | ✅ covered | season-system.test.ts |
| SS-065 | `settleSeason()` | 结算后排行榜为空 | P1 | ✅ covered | season-system.test.ts |
| SS-066 | `settleSeason()` | 结算归档到history | P1 | ✅ covered | season-system.test.ts |
| SS-067 | `settleSeason()` | settledSeasonIds记录 | P1 | ✅ covered | season-system.test.ts |
| SS-068 | `settleSeason()` | 0参与者结算 → rankings=[] → rankings[0]=undefined → emit topRank=undefined | P1 | ⚠️ uncovered | 无0人结算测试 |

### 1.7 赛季历史

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| SS-070 | `getSeasonHistory()` | 返回历史列表 | P1 | ✅ covered | season-system.test.ts |
| SS-071 | `getSeasonHistory()` | 多赛季按时间升序 | P1 | ✅ covered | season-system.test.ts |
| SS-072 | `getSettledSeasonCount()` | 正确计数 | P1 | ✅ covered | season-system.test.ts |
| SS-073 | `isSeasonSettled(seasonId)` | 已结算 → true | P1 | ✅ covered | season-system.test.ts |
| SS-074 | `isSeasonSettled(seasonId)` | 未结算 → false | P1 | ✅ covered | season-system.test.ts |

### 1.8 奖励查询

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| SS-076 | `getSeasonRewards(rank)` | 委托 getRewardsForRank | P1 | ✅ covered | season-system.test.ts |

### 1.9 序列化 / 反序列化

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| SS-080 | `serialize()` | 返回有效存档数据 | P1 | ✅ covered | season-system.test.ts |
| SS-081 | `serialize()` | 与 getSaveData 一致 | P1 | ✅ covered | season-system.test.ts |
| SS-082 | `getSaveData()` | 正确序列化所有字段 | P1 | ✅ covered | season-system.test.ts |
| SS-083 | `loadSaveData(data)` | 恢复赛季状态 | P1 | ✅ covered | season-system.test.ts |
| SS-084 | `loadSaveData(data)` | 恢复历史记录 | P1 | ✅ covered | season-system.test.ts |
| SS-085 | `loadSaveData(data)` | 版本不匹配时忽略 | P1 | ✅ covered | season-system.test.ts |
| SS-086 | `loadSaveData(data)` | JSON round-trip一致 | P1 | ✅ covered | season-system.test.ts |
| SS-087 | `loadSaveData(null)` | null输入 → 访问null属性崩溃 | **P0** | ⚠️ uncovered | 无null防护 |
| SS-088 | `loadSaveData(data)` | data.state=null → scores.map崩溃 | **P0** | ⚠️ uncovered | 无state-null防护 |
| SS-089 | `loadSaveData(data)` | data.state.scores含NaN → NaN恢复 | P1 | ⚠️ uncovered | 无NaN过滤 |
| SS-090 | `loadSaveData(data)` | seasonCounter恢复逻辑：仅从history.length恢复 | P1 | ⚠️ uncovered | 若有currentSeason但无history，counter不恢复 |
| SS-091 | `getSaveData()` | endTime=Infinity → JSON.stringify(Infinity)="null" → 反序列化后endTime=null | **P0** | ⚠️ uncovered | BR-19: Infinity序列化 |

---

## 2. season-config（season-config.ts — 120行）

### 2.1 常量

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| SC-001 | `DEFAULT_SEASON_DURATION_DAYS` | 值为30 | P1 | ✅ covered | season-system.test.ts |
| SC-002 | `SEASON_SAVE_VERSION` | 值为1 | P1 | ✅ covered | season-system.test.ts |
| SC-003 | `DEFAULT_LEADERBOARD_LIMIT` | 值为50 | P1 | ✅ covered | 隐含 |
| SC-004 | `SEASON_REWARD_TIERS` | 5个阶梯 | P1 | ✅ covered | season-system.test.ts |

### 2.2 getRewardsForRank

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| SC-010 | `getRewardsForRank(1)` | 第1名奖励 | P1 | ✅ covered | season-system.test.ts |
| SC-011 | `getRewardsForRank(2)` | 第2名奖励 | P1 | ✅ covered | season-system.test.ts |
| SC-012 | `getRewardsForRank(4)` | 第4名奖励 | P1 | ✅ covered | season-system.test.ts |
| SC-013 | `getRewardsForRank(20)` | 第20名奖励 | P1 | ✅ covered | season-system.test.ts |
| SC-014 | `getRewardsForRank(100)` | 参与奖 | P1 | ✅ covered | season-system.test.ts |
| SC-015 | `getRewardsForRank(0)` | rank=0 → fallback参与奖 | P1 | ✅ covered | season-system.test.ts |
| SC-016 | `getRewardsForRank(NaN)` | NaN比较 → 所有条件false → fallback参与奖 | P1 | ⚠️ uncovered | NaN rank处理 |
| SC-017 | `getRewardsForRank(-1)` | rank=-1 → fallback参与奖 | P1 | ⚠️ uncovered | 负rank处理 |
| SC-018 | `getRewardsForRank(Infinity)` | Infinity → tier.maxRank=-1分支: Infinity>=51 → 参与奖 | P1 | ⚠️ uncovered | Infinity rank |

### 2.3 配置一致性

| # | 检查项 | 优先级 | 状态 | 来源 |
|---|--------|--------|------|------|
| SC-020 | 奖励阶梯 minRank/maxRank 无间隙 | P1 | ✅ covered | 1,2-3,4-10,11-50,51+ 无间隙 |
| SC-021 | 奖励金额 amount 全部 > 0 | P1 | ✅ covered | 配置验证 |
| SC-022 | SEASON_REWARD_TIERS 按 minRank 升序排列 | P1 | ✅ covered | 配置验证 |
