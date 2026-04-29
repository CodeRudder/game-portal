# 三国霸业引擎测试覆盖率基线报告

> **生成时间**: 2025-01-24  
> **扫描范围**: `src/games/three-kingdoms/engine/`  
> **方法论版本**: v1.0

---

## 1. 总体概览

| 指标 | 数值 |
|------|------|
| 引擎源文件总数 | 340 |
| 非平凡源文件数 | 247 |
| 测试文件总数 | 499 |
| 单元/模块测试文件 | 221 |
| 集成测试文件 | 278 |
| 对抗测试文件 | 0 |
| 混沌测试文件 | 0 |
| 总断言数 (expect) | 32,553 |
| 导出函数/类/常量 | 876 |
| 引擎模块数 | 33 |

### 核心度量

| 度量 | 公式 | 值 | 等级 |
|------|------|------|------|
| **盲区指数 (BSI)** | 无测试源文件数 / 非平凡源文件数 | 110/247 = **44.5%** | 🔴 危险 |
| **测试深度 (TD)** | 总断言数 / 导出函数数 | 32553/876 = **37.2** | 🏆 穷举级 |
| **测试密度 (文件比)** | 测试文件 / 非平凡源文件 | 499/247 = **2.02** | 🟢 良好 |
| **交叉验证率 (CVR)** | 有集成测试的模块 / 总模块 | 待计算 | — |

### 诊断

> **核心矛盾**: 测试深度极高 (TD=37.2)，但盲区指数也很高 (BSI=44.5%)。  
> **含义**: 已覆盖的模块被测试得非常充分，但仍有近半数源文件完全没有测试。  
> **策略**: Phase 2 应聚焦**广度覆盖**，优先消灭零覆盖文件。

---

## 2. 模块级覆盖分析

### 2.1 模块健康度矩阵

> 格式: `模块名 | 非平凡源文件 | 测试文件 | 未覆盖数 | BSI | 状态`

| 模块 | 源文件 | 测试文件 | 未覆盖 | BSI | 状态 |
|------|--------|----------|--------|-----|------|
| **achievement** | 2 | 1 | 1 | 50% | 🟡 |
| **activity** | 7 | 5 | 5 | 71% | 🔴 |
| **advisor** | 2 | 1 | 1 | 50% | 🟡 |
| **alliance** | 6 | 5 | 2 | 33% | 🟡 |
| **battle** | 14 | 16 | 5 | 36% | 🟡 |
| **bond** | 1 | 2 | 0 | 0% | 🏆 |
| **building** | 4 | 3 | 3 | 75% | 🔴 |
| **calendar** | 1 | 2 | 0 | 0% | 🏆 |
| **campaign** | 15 | 10 | 12 | 80% | 🔴 |
| **currency** | 1 | 1 | 0 | 0% | 🏆 |
| **equipment** | 12 | 4 | 11 | 92% | 🔴 |
| **event** | 16 | 11 | 9 | 56% | 🔴 |
| **expedition** | 6 | 5 | 2 | 33% | 🟡 |
| **guide** | 10 | 7 | 4 | 40% | 🟡 |
| **heritage** | 3 | 2 | 2 | 67% | 🔴 |
| **hero** | 18 | 35 | 3 | 17% | 🟢 |
| **mail** | 5 | 4 | 3 | 60% | 🔴 |
| **map** | 8 | 9 | 1 | 13% | 🟢 |
| **npc** | 13 | 11 | 6 | 46% | 🔴 |
| **offline** | 7 | 11 | 1 | 14% | 🟢 |
| **prestige** | 4 | 4 | 0 | 0% | 🏆 |
| **pvp** | 7 | 7 | 1 | 14% | 🟢 |
| **quest** | 7 | 4 | 4 | 57% | 🔴 |
| **resource** | 5 | 3 | 2 | 40% | 🟡 |
| **responsive** | 6 | 7 | 1 | 17% | 🟢 |
| **season** | 1 | 1 | 1 | 100% | 🔴 |
| **settings** | 11 | 7 | 4 | 36% | 🟡 |
| **social** | 5 | 3 | 2 | 40% | 🟡 |
| **tech** | 11 | 15 | 2 | 18% | 🟢 |
| **trade** | 4 | 5 | 0 | 0% | 🏆 |
| **tutorial** | 1 | 2 | 0 | 0% | 🏆 |
| **unification** | 19 | 12 | 7 | 37% | 🟡 |
| **shop** | 1 | 7 | 0 | 0% | 🏆 |

### 2.2 根级引擎文件

| 文件 | 有测试 | 风险评估 |
|------|--------|----------|
| `engine-tick.ts` | ❌ | 🔴 高 — 核心游戏循环 |
| `engine-save.ts` | ❌ | 🔴 高 — 存档系统 |
| `engine-save-migration.ts` | ❌ | 🔴 高 — 存档迁移 |
| `engine-getters.ts` | ❌ | 🟡 中 — 访问器 |
| `engine-building-ops.ts` | ❌ | 🟡 中 — 建筑操作 |
| `engine-campaign-deps.ts` | ❌ | 🟢 低 — 依赖注入 |
| `engine-event-deps.ts` | ❌ | 🟢 低 — 依赖注入 |
| `engine-extended-deps.ts` | ❌ | 🟢 低 — 依赖注入 |
| `engine-guide-deps.ts` | ❌ | 🟢 低 — 依赖注入 |
| `engine-hero-deps.ts` | ❌ | 🟢 低 — 依赖注入 |
| `engine-map-deps.ts` | ❌ | 🟢 低 — 依赖注入 |
| `engine-offline-deps.ts` | ❌ | 🟢 低 — 依赖注入 |
| `engine-tech-deps.ts` | ❌ | 🟢 低 — 依赖注入 |

---

## 3. 未覆盖文件详细清单

### 🔴 P0 — 高优先级（核心游戏逻辑，影响玩家体验）

#### equipment (11个未覆盖)
```
equipment/EquipmentGenerator.ts        — 装备生成核心算法
equipment/EquipmentForgeSystem.ts      — 锻造系统
equipment/EquipmentEnhanceSystem.ts    — 强化系统
equipment/EquipmentSetSystem.ts        — 套装系统
equipment/EquipmentBagManager.ts       — 背包管理
equipment/EquipmentDecomposer.ts       — 分解系统
equipment/EquipmentRecommendSystem.ts  — 推荐系统
equipment/EquipmentDropWeights.ts      — 掉落权重
equipment/EquipmentGenHelper.ts        — 生成辅助
equipment/ForgePityManager.ts          — 锻造保底
equipment/equipment-reexports.ts       — 重导出
```

#### campaign (12个未覆盖)
```
campaign/ChallengeStageSystem.ts       — 挑战关卡系统
campaign/CampaignSerializer.ts         — 关卡序列化
campaign/AutoPushExecutor.ts           — 自动推图
campaign/VIPSystem.ts                  — VIP系统
campaign/challenge-stages.ts           — 挑战关卡配置
campaign/campaign-utils.ts             — 关卡工具函数
campaign/campaign-chapter1~6.ts        — 章节数据 (6个)
```

#### event (9个未覆盖)
```
event/EventConditionEvaluator.ts       — 事件条件评估
event/EventProbabilityCalculator.ts    — 事件概率计算
event/EventTriggerConditions.ts        — 触发条件
event/EventTriggerLifecycle.ts         — 触发器生命周期
event/EventTriggerSerialization.ts     — 触发器序列化
event/EventTriggerSystem.helpers.ts    — 触发系统辅助
event/EventUINotification.ts           — UI通知
event/OfflineEventHandler.ts           — 离线事件处理
event/ReturnAlertHelpers.ts            — 回归提醒
```

### 🟡 P1 — 中优先级（辅助系统，影响部分玩法）

#### npc (6个未覆盖)
```
npc/NPCSpawnSystem.ts                  — NPC生成系统
npc/NPCSpawnManager.ts                 — NPC生成管理
npc/NPCTrainingSystem.ts               — NPC训练系统
npc/NPCDialogHelpers.ts                — 对话辅助
npc/GiftPreferenceCalculator.ts        — 礼物偏好计算
npc/PatrolPathCalculator.ts            — 巡逻路径计算
```

#### quest (4个未覆盖)
```
quest/QuestSystem.helpers.ts           — 任务辅助
quest/QuestDailyManager.ts             — 每日任务
quest/QuestActivityManager.ts          — 活动任务
quest/QuestSerialization.ts            — 任务序列化
```

#### unification (7个未覆盖)
```
unification/EndingSystem.ts            — 结局系统
unification/GlobalStatisticsSystem.ts  — 全局统计
unification/BalanceUtils.ts            — 平衡工具
unification/BalanceValidatorHelpers.ts — 平衡验证
unification/IntegrationValidatorHelper.ts — 集成验证
unification/InteractionRules.defaults.ts  — 交互规则默认值
unification/VisualSpecDefaults.ts      — 视觉规格默认值
```

#### settings (4个未覆盖)
```
settings/CloudSaveCrypto.ts            — 云存档加密
settings/AudioSceneHelper.ts           — 音频场景
settings/account-delete-flow.ts        — 账号删除流程
settings/animation-defaults.ts         — 动画默认值
```

### 🟢 P2 — 低优先级（工具/辅助/配置）

#### building (3个未覆盖)
```
building/BuildingBatchOps.ts           — 批量建筑操作
building/BuildingStateHelpers.ts       — 状态辅助
building/BuildingRecommender.ts        — 建筑推荐
```

#### hero (3个未覆盖)
```
hero/AwakeningSystem.ts                — 觉醒系统
hero/HeroRecruitUpManager.ts           — 招募UP管理
hero/SkillStrategyRecommender.ts       — 技能策略推荐
```

#### 其他零散未覆盖
```
achievement/AchievementHelpers.ts      — 成就辅助
activity/TokenShopSystem.ts            — 代币商店
activity/ActivityFactory.ts            — 活动工厂
activity/TimedActivitySystem.ts        — 限时活动
activity/SeasonHelper.ts               — 赛季辅助
activity/ActivityOfflineCalculator.ts  — 活动离线计算
advisor/AdvisorTriggerDetector.ts      — 顾问触发检测
alliance/alliance-constants.ts         — 联盟常量
alliance/AllianceHelper.ts             — 联盟辅助
battle/BattleStatistics.ts             — 战斗统计
battle/battle-helpers.ts               — 战斗辅助
battle/BattleTargetSelector.ts         — 目标选择
battle/BattleFragmentRewards.ts        — 碎片奖励
battle/battle-effect-presets.ts        — 效果预设
expedition/expedition-helpers.ts       — 远征辅助
expedition/ExpeditionTeamHelper.ts     — 远征组队辅助
guide/StoryTriggerEvaluator.ts         — 故事触发评估
guide/StoryEventPlayer.helpers.ts      — 故事播放辅助
guide/TutorialTransitions.ts           — 教程转换
guide/TutorialStorage.ts               — 教程存储
heritage/HeritageSimulation.ts         — 传承模拟
heritage/HeritageHelpers.ts            — 传承辅助
mail/MailPersistence.ts                — 邮件持久化
mail/MailConstants.ts                  — 邮件常量
mail/MailFilterHelpers.ts              — 邮件过滤辅助
map/MapEventSystem.ts                  — 地图事件系统
offline/offline-utils.ts               — 离线工具
pvp/ArenaSystem.helpers.ts             — 竞技场辅助
resource/OfflineEarningsCalculator.ts  — 离线收益计算
resource/resource-calculator.ts        — 资源计算器
responsive/PowerSaveSystem.ts          — 省电系统
season/SeasonSystem.ts                 — 赛季系统
social/BorrowHeroHelper.ts             — 借将辅助
social/FriendInteractionHelper.ts      — 好友互动辅助
tech/FusionLinkManager.ts              — 融合链接管理
tech/FusionTechSystem.links.ts         — 融合科技链接
```

---

## 4. 测试金字塔现状分析

```
当前分布:                          目标分布:
                                   
     ┌──────┐  0                   ┌──────┐  ~10
     │ 混沌  │                      │ 混沌  │
    ┌┴──────┴┐ 0                  ┌┴──────┴┐
    │ 对抗   │                    │ 对抗   │ ~15
   ┌┴────────┴┐ 278              ┌┴────────┴┐
   │ 集成     │ ████████         │ 场景     │ ~20
  ┌┴──────────┴┐                 ┌┴──────────┴┐
  │ 模块       │                 │ 集成       │ ~50
 ┌┴────────────┴┐ 221           ┌┴────────────┴┐
 │ 单元         │ ██████        │ 模块         │ ~100
└──────────────┘                ┌┴──────────────┴┐
                                │ 单元           │ ~300
                                └────────────────┘
```

**问题诊断**:
1. **L5 对抗层和 L6 混沌层完全空白** — 系统缺乏对极端场景的防御
2. **L3 集成层占比过高 (278/499 = 55.7%)** — 集成测试过多，单元测试不足
3. **L4 场景层缺失** — 没有独立的场景测试文件
4. **金字塔严重倒挂** — 集成测试多于单元测试，维护成本高

---

## 5. 盲区维度分析

| 盲区维度 | 严重程度 | 关键发现 |
|----------|----------|----------|
| **功能盲区** | 🔴 高 | 110个源文件零覆盖，equipment/campaign/event三大核心模块大面积空白 |
| **边界盲区** | 🟡 中 | 已有测试中边界测试不足，缺乏极端值和临界条件测试 |
| **集成盲区** | 🟢 低 | 278个集成测试文件提供了较好的跨模块覆盖 |
| **时序盲区** | 🟡 中 | 缺乏离线/在线切换、赛季切换等时序场景的专项测试 |
| **数据盲区** | 🔴 高 | 序列化/反序列化测试不足，存档迁移无覆盖，异常数据无测试 |

---

## 6. 行动计划

### Phase 2: 广度覆盖 (Round 1-5) — 消灭零覆盖

**目标**: BSI 从 44.5% → < 15%

| 轮次 | 重点模块 | 预计新增测试 | 预计BSI |
|------|----------|-------------|---------|
| R1 | equipment (11) + campaign (12) | ~46 | 25.5% |
| R2 | event (9) + npc (6) + quest (4) | ~38 | 10.1% |
| R3 | unification (7) + settings (4) + guide (4) | ~30 | 0% |
| R4 | 剩余零散文件 + root-level 文件 | ~27 | 0% |
| R5 | 补充遗漏 + 回归验证 | ~20 | 0% |

### Phase 3: 深度覆盖 (Round 6-10)

**目标**: BC > 80%, TD 持续 > 10

### Phase 4: 对抗验证 (Round 11-15)

**目标**: MK > 75%, 首次引入 L5/L6 测试

---

## 7. 附录：数据采集命令

```bash
# 非平凡源文件数
find src/games/three-kingdoms/engine -name "*.ts" \
  ! -name "*.test.*" ! -name "*.spec.*" ! -path "*__tests__*" \
  ! -name "index.ts" ! -name "*Types.ts" ! -name "*types.ts" \
  ! -name "*.types.ts" ! -name "*-types.ts" ! -name "*Config.ts" \
  ! -name "*-config.ts" ! -name "*.config.ts" ! -name "*.d.ts" | wc -l

# 测试文件总数
find src/games/three-kingdoms/engine -name "*.test.ts" -o -name "*.spec.ts" | wc -l

# 总断言数
grep -rc "expect(" src/games/three-kingdoms/engine --include="*.test.ts" | \
  awk -F: '{sum+=$NF} END {print sum}'

# 导出函数/类/常量数
grep -rE "export\s+(function|const|class|async\s+function)" \
  src/games/three-kingdoms/engine --include="*.ts" | \
  grep -v "__tests__" | grep -v ".test." | wc -l
```
