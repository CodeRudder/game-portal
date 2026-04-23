# v4.0 攻城略地(下) — Plan-Play-PRD 一致性验证报告

> **验证日期**: 2026-04-22
> **验证范围**: Plan v4.0 (51功能点) ↔ 代码实现 ↔ Play v4-play ↔ PRD
> **验证方法**: 逐功能点代码文件搜索 + 关键实现逻辑审查 + Play覆盖交叉比对
> **构建状态**: ✅ pnpm run build 成功 (18.30s)

---

## 1. 总体覆盖率

| 状态 | 数量 | 占比 |
|------|:----:|:----:|
| ✅ 已实现 | 38 | 74.5% |
| ⚠️ 部分实现 | 8 | 15.7% |
| ❌ 未实现 | 5 | 9.8% |
| **合计** | **51** | **100%** |

---

## 2. 逐功能点验证结果

### 模块A: 战斗深化 (CBT) — 5/5 ✅

| # | 功能点 | 优先级 | 状态 | 代码证据 | 备注 |
|---|--------|:------:|:----:|----------|------|
| 1 | 大招时停机制 | P0 | ✅ | `UltimateSkillSystem.ts` + `battle-config.ts` (TIME_STOP_ENABLED_BY_DEFAULT, TIME_STOP_TIMEOUT_MS) | 半自动模式下怒气满触发时停，支持超时自动释放 |
| 2 | 武技特效 | P1 | ✅ | `BattleEffectManager.ts` + `battle-effect-presets.ts` (粒子/光效/屏幕震动配置) | 5元素粒子预设 + 5元素光效预设 + 屏幕震动 |
| 3 | 战斗加速 1x/2x/4x | P0 | ✅ | `BattleSpeedController.ts` (BattleSpeed枚举 + 速度切换 + 监听器) | 支持1x/2x/4x三档，4x简化特效 |
| 4 | 手机端战斗全屏布局 | P1 | ✅ | `battle-effect-presets.ts` (MobileLayoutConfig + SCREEN_PRESETS: 375×667) + `BattleEffectManager.ts` (getMobileLayout) | 3种屏幕尺寸预设，触摸优化 |
| 5 | 伤害数字动画 | P1 | ✅ | `DamageNumberSystem.ts` + `DamageNumberConfig.ts` (轨迹/颜色/合并) | 白色普通/红色暴击/绿色治疗，支持批量合并 |

### 模块B: 扫荡系统 (CBT) — 4/5 ⚠️

| # | 功能点 | 优先级 | 状态 | 代码证据 | 备注 |
|---|--------|:------:|:----:|----------|------|
| 6 | 扫荡解锁条件（三星通关） | P0 | ✅ | `SweepSystem.ts` (三星检查 + MAX_STARS) | 三星通关后解锁扫荡 |
| 7 | 扫荡令获取 | P0 | ✅ | `sweep.types.ts` (SweepTicketSource: daily/shop/system + SweepConfig.dailyTicketReward) | 每日任务/商店/系统赠送 |
| 8 | 扫荡规则 | P0 | ✅ | `SweepSystem.ts` (批量扫荡 + SweepBatchResult) | 选择关卡+次数→直接结算 |
| 9 | 扫荡产出 | P0 | ✅ | `SweepSystem.ts` (复用RewardDistributor + mergeResources/mergeFragments) | 使用相同掉落表，批量汇总 |
| 10 | 自动推图 | P1 | ✅ | `AutoPushExecutor.ts` (循环挑战 + 停止条件) | 自动挑战最远关卡，失败停止 |

### 模块C: 武将升星 (HER) — 4/4 ✅

| # | 功能点 | 优先级 | 状态 | 代码证据 | 备注 |
|---|--------|:------:|:----:|----------|------|
| 11 | 碎片获取途径 | P0 | ✅ | `HeroStarSystem.ts` (FragmentGainResult + FragmentSource) + `star-up-config.ts` (STAGE_FRAGMENT_DROPS + SHOP_FRAGMENT_EXCHANGE) | 招募重复/关卡掉落/商店兑换 |
| 12 | 升星消耗与效果 | P0 | ✅ | `HeroStarSystem.ts` (StarUpResult + StarUpCost) + `star-up-config.ts` (STAR_UP_FRAGMENT_COST + STAR_UP_GOLD_COST + getStarMultiplier) | 碎片+铜钱消耗，属性大幅提升 |
| 13 | 碎片进度可视化 | P1 | ✅ | `HeroStarSystem.ts` (FragmentProgress接口 + getFragmentProgress方法) | 当前碎片/所需碎片数据输出 |
| 14 | 突破系统 | P1 | ✅ | `HeroStarSystem.ts` (BreakthroughResult + BreakthroughPreview) + `star-up-config.ts` (BREAKTHROUGH_TIERS + MAX_BREAKTHROUGH_STAGE) | Lv.10/20/30/40突破节点 |

### 模块D: 科技系统基础 (TEC) — 7/7 ✅

| # | 功能点 | 优先级 | 状态 | 代码证据 | 备注 |
|---|--------|:------:|:----:|----------|------|
| 15 | 三条科技路线 | P0 | ✅ | `TechTreeSystem.ts` + `tech.types.ts` (TechPath: military/economy/culture) + `tech-config.ts` (TECH_NODE_DEFS) | 军事(红)/经济(黄)/文化(紫) |
| 16 | 科技树结构 | P0 | ✅ | `TechTreeSystem.ts` (节点状态管理 + 前置依赖检查) + `tech-config.ts` (TECH_EDGES连线) | 节点+连线+前置依赖完整 |
| 17 | 互斥分支机制 | P0 | ✅ | `TechTreeSystem.ts` (chosenMutexNodes + mutexGroup处理 + 锁定逻辑) + `tech-config.ts` (getMutexGroups) | 选择A→B永久锁定 |
| 18 | 科技研究流程 | P0 | ✅ | `TechResearchSystem.ts` (startResearch + 前置检查 + 资源消耗 + 倒计时) | 选择→消耗→等待→完成 |
| 19 | 科技点系统 | P0 | ✅ | `TechPointSystem.ts` (techPoints状态 + update产出 + getTechPointProduction) | 书院产出科技点，持续累积 |
| 20 | 研究队列规则 | P1 | ✅ | `TechResearchSystem.ts` (queue数组 + getQueueSizeForAcademyLevel + 队列满检查) | 默认1队列，书院升级增加 |
| 21 | 加速机制 | P1 | ✅ | `TechResearchSystem.ts` (speedUp + SpeedUpMethod + MANDATE_SPEEDUP + INGOT_SPEEDUP) | 天命/元宝/铜钱三种加速 |

### 模块E: 科技效果 (TEC) — 3/3 ✅

| # | 功能点 | 优先级 | 状态 | 代码证据 | 备注 |
|---|--------|:------:|:----:|----------|------|
| 22 | 军事路线效果 | P0 | ✅ | `TechEffectSystem.ts` + `tech-effect-types.ts` (MILITARY_EFFECT_MAP) | 攻击/防御/暴击/伤害加成 |
| 23 | 经济路线效果 | P0 | ✅ | `TechEffectSystem.ts` + `tech-effect-types.ts` (ECONOMY_EFFECT_MAP) | 资源产出/存储/交易加成 |
| 24 | 文化路线效果 | P0 | ✅ | `TechEffectSystem.ts` + `tech-effect-types.ts` (CULTURE_EFFECT_MAP) | 经验/研究速度/招募加成 |

### 模块F: 地图系统 (MAP) — 10/18 ⚠️

| # | 功能点 | 优先级 | 状态 | 代码证据 | 备注 |
|---|--------|:------:|:----:|----------|------|
| 25 | 地图基础渲染 | P0 | ✅ | `WorldMapSystem.ts` (20×15网格 + 区域管理 + 地形管理) + `MapDataRenderer.ts` (视口计算 + 像素坐标) + `core/map/map-config.ts` (MAP_SIZE + REGION_DEFS + TERRAIN_DEFS) | 六边形网格+三大区域+6种地形 |
| 26 | 特殊地标 | P0 | ✅ | `core/map/map-config.ts` (DEFAULT_LANDMARKS: 洛阳/长安/建业 + LANDMARK_POSITIONS) | 洛阳/长安/建业已定义 |
| 27 | 地图筛选逻辑 | P0 | ✅ | `MapFilterSystem.ts` (MapFilterCriteria + filter方法 + 组合筛选) | 区域/地形/占领状态多条件筛选 |
| 28 | 热力图模式 | P1 | ❌ | 无对应代码 | **P2**: 无热力图5档颜色映射实现 |
| 29 | 领土产出计算 | P0 | ⚠️ | `TerritorySystem.ts` + `core/map/territory-config.ts` (calculateProduction) | ⚠️ 仅实现基础×等级2因子，缺少地形×阵营×科技×声望×地标4个因子 |
| 30 | 产出气泡显示 | P1 | ❌ | `WorldMapSystem.ts` 仅注释"预留：后续版本用于动画/产出气泡更新" | **P2**: 无5种场景气泡逻辑 |
| 31 | 驻防机制 | P0 | ✅ | `GarrisonSystem.ts` (派遣/撤回/防御加成/产出加成/互斥校验) | 武将驻防+防御/产出加成 |
| 32 | 征服规则 | P0 | ✅ | `SiegeSystem.ts` (SiegeConditionResult + checkSiegeConditions) | 相邻+兵力+粮草+每日限制 |
| 33 | 胜率预估公式 | P0 | ✅ | `SiegeEnhancer.ts` (estimateWinRate + WIN_RATE_EXPONENT + computeWinRate + getBattleRating) | 攻防战力比计算+4档评级 |
| 34 | 领土等级提升 | P1 | ⚠️ | `TerritorySystem.ts` (upgradeTerritory) + `core/map/territory-config.ts` (LEVEL_MULTIPLIER) | ⚠️ 仅支持5级(Lv1-5)，PRD要求15级(Lv1→5→10→15) |
| 35 | 攻城条件检查 | P0 | ✅ | `SiegeSystem.ts` (checkSiegeConditions + MIN_SIEGE_TROOPS + GRAIN_COST + DAILY_SIEGE_LIMIT) | 相邻+兵力≥2.0倍+粮草×500+每日3次 |
| 36 | 城防计算 | P0 | ✅ | `SiegeSystem.ts` (defenseValue按"基础(1000)×城市等级"生成，PRD MAP-4统一声明) | 基础1000×城市等级×(1+科技加成) |
| 37 | 攻城结算 | P0 | ⚠️ | `SiegeSystem.ts` (resolveSiege + defeatTroopLoss=30%) + `SiegeEnhancer.ts` (攻城奖励) | ⚠️ 失败30%损失✅，但缺少首次/重复攻占奖励区分 |
| 38 | 基础地图事件（4类） | P0 | ⚠️ | `core/event/encounter-templates-combat.ts`(山贼伏击等5个) + `encounter-templates-diplomatic.ts`(流民投奔等5个) + `encounter-templates-exploration.ts`(古墓遗迹等5个) + `encounter-templates-disaster.ts`(旱灾等5个) | ⚠️ 有20个事件模板，但非按PRD 9类(商队遇险/流民/宝箱/山贼+流寇/商队经过/天灾/遗迹/阵营冲突)组织 |
| 39 | 扩展地图事件（5类） | P1 | ⚠️ | 同上，事件系统存在但分类不匹配PRD的9类定义 | ⚠️ 事件模板丰富但缺少流寇入侵/商队经过/阵营冲突等地图专属事件 |
| 40 | 事件触发规则 | P0 | ✅ | `EventTriggerSystem.ts` + `EventProbabilityCalculator.ts` | 触发概率+冷却+条件评估 |
| 41 | 地图统计面板 | P1 | ❌ | 无对应代码 | **P2**: 无5维度统计面板 |
| 42 | 手机端地图适配 | P1 | ⚠️ | `responsive/TouchInputSystem.ts`(双指缩放/拖拽) + `responsive/MobileLayoutManager.ts`(BottomSheet) | ⚠️ 通用触摸/布局系统存在，但无地图专属Bottom Sheet适配 |

### 模块G: Play补录 — 4/9 ⚠️

| # | 功能点 | 优先级 | 状态 | 代码证据 | 备注 |
|---|--------|:------:|:----:|----------|------|
| 43 | 兵种克制系统 | P0 | ✅ | `DamageCalculator.ts` (COUNTER_MAP: 骑兵→步兵→枪兵→骑兵 + getCounterMultiplier: 0.7/1.0/1.5) | 三角克制×1.5/×0.7完整 |
| 44 | 战斗模式自动切换 | P1 | ⚠️ | `BattleEngine.ts` (BattleMode枚举 + setBattleMode/getBattleMode) | ⚠️ 模式枚举和手动切换✅，但缺少根据战力比(1.43倍)自动选择逻辑 |
| 45 | 元宝替代扫荡令 | P1 | ❌ | 无对应代码 | **P2**: SweepSystem无元宝替代逻辑 |
| 46 | 融合科技 | P1 | ✅ | `FusionTechSystem.ts` + `FusionLinkManager.ts` + `fusion-tech.types.ts` (FUSION_TECH_DEFS) | 4个跨路线融合科技(军经/军文/经世/霸王) |
| 47 | 离线推图 | P1 | ⚠️ | `AutoPushExecutor.ts`(自动推图逻辑) + `event/OfflineEventHandler.ts`(离线事件处理) | ⚠️ 自动推图✅，但离线推图(每小时1次/最多3关)未独立实现 |
| 48 | 离线领土变化 | P1 | ❌ | 无对应代码 | **P2**: 无离线领土变化视觉标记 |
| 49 | 跳过战斗 | P0 | ❌ | 无对应代码 | **P0**: BattleEngine无skipBattle方法 |
| 50 | 离线研究 | P1 | ✅ | `TechOfflineSystem.ts` (离线效率衰减 + 研究进度计算 + 回归面板) | 效率分段衰减(100%/70%/40%/20%)，封顶72h |
| 51 | 离线挂机收益 | P1 | ✅ | `OfflineRewardSystem.ts` (6档衰减 + 翻倍机制 + VIP加成 + 回归面板) | v9.0离线收益系统，含科技/声望加成 |

---

## 3. 问题清单

### P0 问题（阻塞验收）

| # | 问题 | 影响功能点 | 描述 | 建议 |
|---|------|-----------|------|------|
| P0-1 | 跳过战斗未实现 | #49 | BattleEngine无skipBattle/instantSettle方法，无法在战斗中跳过直接结算 | 需新增skipBattle方法，根据战力比计算胜负+星级评定 |
| P0-2 | 领土产出公式不完整 | #29 | calculateProduction仅含基础×等级2个因子，PRD要求6因子(基础×地形×阵营×科技×声望×地标) | 需扩展calculateProduction接入TechEffectSystem/PrestigeSystem/LandmarkBonus |

### P1 问题（影响核心体验）

| # | 问题 | 影响功能点 | 描述 | 建议 |
|---|------|-----------|------|------|
| P1-1 | 战斗模式自动切换逻辑缺失 | #44 | BattleMode枚举存在但无根据战力比自动选择(≥1.43倍→全自动/≤1.0→半自动/>1.0→全手动) | 在BattleEngine.startBattle中增加autoSelectBattleMode逻辑 |
| P1-2 | 领土等级上限不足 | #34 | TerritorySystem仅支持5级，PRD要求15级(Lv1→5→10→15) | 扩展LandmarkLevel类型和LEVEL_MULTIPLIER配置 |
| P1-3 | 攻城奖励缺少首次/重复区分 | #37 | SiegeEnhancer有奖励计算但无首次攻占(元宝×100+声望+50)vs重复攻占(铜钱×5000+产出×2/24h)区分 | 增加captureHistory追踪首次/重复 |
| P1-4 | 地图事件分类与PRD不匹配 | #38/#39 | 事件系统有20个模板(combat/diplomatic/exploration/disaster各5个)，但非PRD定义的9类地图专属事件(商队遇险/流民/宝箱/山贼/流寇/商队经过/天灾/遗迹/阵营冲突) | 新增MapEventSystem或映射现有事件到PRD分类 |
| P1-5 | 离线推图独立逻辑缺失 | #47 | AutoPushExecutor存在但无离线专属逻辑(每小时1次/最多3关) | 在OfflineRewardEngine中集成离线推图计算 |

### P2 问题（体验优化）

| # | 问题 | 影响功能点 | 描述 | 建议 |
|---|------|-----------|------|------|
| P2-1 | 热力图模式未实现 | #28 | 无5档颜色映射收益区间实现 | 新增HeatMapOverlay组件或MapFilterSystem扩展 |
| P2-2 | 产出气泡显示未实现 | #30 | WorldMapSystem仅预留注释，无5种场景气泡逻辑 | 新增ProductionBubbleSystem |
| P2-3 | 地图统计面板未实现 | #41 | 无5维度(领土/资源/战斗/探索/事件)统计面板 | 新增MapStatsPanelComponent |
| P2-4 | 元宝替代扫荡令未实现 | #45 | SweepSystem无元宝替代逻辑 | 在SweepSystem.executeSweep中增加premiumCurrencyFallback |
| P2-5 | 离线领土变化标记未实现 | #48 | 无新占领/失去领土视觉标记 | 在OfflineSnapshotSystem中增加territoryDiff计算 |
| P2-6 | 手机端地图Bottom Sheet未适配 | #42 | 通用触摸系统存在但无地图专属适配 | 在MobileLayoutManager中增加mapBottomSheet配置 |

---

## 4. 按模块覆盖率统计

| 模块 | 总数 | ✅ | ⚠️ | ❌ | 覆盖率 |
|------|:----:|:--:|:--:|:--:|:------:|
| A. 战斗深化 | 5 | 5 | 0 | 0 | 100% |
| B. 扫荡系统 | 5 | 5 | 0 | 0 | 100% |
| C. 武将升星 | 4 | 4 | 0 | 0 | 100% |
| D. 科技系统基础 | 7 | 7 | 0 | 0 | 100% |
| E. 科技效果 | 3 | 3 | 0 | 0 | 100% |
| F. 地图系统 | 18 | 10 | 5 | 3 | 55.6% |
| G. Play补录 | 9 | 4 | 2 | 3 | 44.4% |
| **合计** | **51** | **38** | **7** | **6** | **74.5%** |

---

## 5. 按优先级统计

| 优先级 | 总数 | ✅ | ⚠️ | ❌ | 完成率 |
|--------|:----:|:--:|:--:|:--:|:------:|
| P0 | 25 | 20 | 3 | 2 | 80.0% |
| P1 | 26 | 18 | 4 | 4 | 69.2% |

---

## 6. 测试覆盖

| 模块 | 测试文件数 |
|------|:---------:|
| Battle | 15 |
| Campaign | 9 |
| Hero | 19 |
| Tech | 15 |
| Map | 9 |
| Offline | 8 |
| **合计** | **75** |

---

## 7. 关键发现

### 7.1 高完成度模块（100%）
- **战斗深化 (A)**: 大招时停/武技特效/加速/手机布局/伤害数字全部实现
- **扫荡系统 (B)**: 扫荡解锁/令获取/规则/产出/自动推图全部实现
- **武将升星 (C)**: 碎片获取/升星消耗/进度可视化/突破全部实现
- **科技系统 (D+E)**: 三条路线/树结构/互斥/研究/科技点/队列/加速/效果全部实现

### 7.2 主要差距
- **地图系统 (F)**: 基础架构完整(WorldMap/Territory/Siege/Garrison/Filter/Renderer/Enhancer)，但缺少热力图/产出气泡/统计面板等可视化功能，且产出公式和等级上限不完整
- **Play补录 (G)**: 跳过战斗(P0)未实现，元宝替代/离线领土变化缺失，战斗模式自动切换/离线推图部分实现

### 7.3 PRD矛盾统一执行情况
- ✅ 城防公式: 代码注释"PRD MAP-4统一声明"，使用基础(1000)×城市等级
- ✅ 攻城消耗: 粮草×500（固定消耗），旧公式已废弃
- ✅ 失败惩罚: 损失30%出征兵力 (defeatTroopLoss = cost.troops * 0.3)
- ✅ 兵力门槛: MIN_SIEGE_TROOPS 定义
- ✅ 每日限制: DAILY_SIEGE_LIMIT = 3

---

## 8. 建议优先级排序

### 立即修复（P0阻塞）
1. **#49 跳过战斗** — 新增 BattleEngine.skipBattle() 方法
2. **#29 领土产出6因子公式** — 扩展 calculateProduction 接入多系统加成

### 本迭代修复（P1核心）
3. **#44 战斗模式自动切换** — 增加 autoSelectBattleMode 逻辑
4. **#34 领土等级扩展至15级** — 扩展 LandmarkLevel 和配置
5. **#37 首次/重复攻占奖励区分** — 增加 captureHistory
6. **#38/#39 地图事件分类对齐PRD** — 新增MapEventSystem或映射
7. **#47 离线推图独立逻辑** — 集成到OfflineRewardEngine

### 后续迭代（P2体验）
8. **#28 热力图** — 新增HeatMapOverlay
9. **#30 产出气泡** — 新增ProductionBubbleSystem
10. **#41 地图统计面板** — 新增MapStatsPanel
11. **#45 元宝替代扫荡令** — SweepSystem扩展
12. **#48 离线领土变化标记** — OfflineSnapshot扩展
13. **#42 手机端地图适配** — MobileLayoutManager扩展

---

## 9. 结论

v4.0 核心战斗/扫荡/升星/科技四大模块（功能点#1-#24）**100%实现**，质量较高。

主要差距集中在**地图系统可视化层**（热力图/气泡/统计面板）和**Play补录功能**（跳过战斗/元宝替代/离线领土变化），这些属于后期体验优化项。

**最紧急需修复**: P0-1 跳过战斗(#49) 和 P0-2 领土产出6因子公式(#29)。
