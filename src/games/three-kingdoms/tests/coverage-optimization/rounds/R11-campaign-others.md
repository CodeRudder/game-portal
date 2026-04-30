# R11 覆盖率优化 — Campaign 章节与其他模块

> 日期：2025-01-XX
> 轮次：R11-campaign-others
> 状态：✅ 全部通过 (238/238)

---

## 📋 覆盖文件清单

### Campaign 模块 (6个关卡数据文件)

| # | 源文件 | 测试文件 | 用例数 |
|---|--------|----------|--------|
| 1 | `campaign/campaign-chapter1.ts` | `__tests__/campaign-chapters-1to3.test.ts` | 12 |
| 2 | `campaign/campaign-chapter2.ts` | 同上 | 12 |
| 3 | `campaign/campaign-chapter3.ts` | 同上 | 12 |
| 4 | `campaign/campaign-chapter4.ts` | `__tests__/campaign-chapters-4to6.test.ts` | 12 |
| 5 | `campaign/campaign-chapter5.ts` | 同上 | 12 |
| 6 | `campaign/campaign-chapter6.ts` | 同上 | 12 |

### 其他模块 (5个)

| # | 源文件 | 测试文件 | 用例数 |
|---|--------|----------|--------|
| 7 | `engine-extended-deps.ts` | `__tests__/engine-extended-deps.test.ts` | 12 |
| 8 | `engine-getters.ts` | `__tests__/engine-getters.test.ts` | 59 |
| 9 | `event/EventUINotification.ts` | `event/__tests__/EventUINotification.test.ts` | 35 |
| 10 | `guide/StoryTriggerEvaluator.ts` | `guide/__tests__/StoryTriggerEvaluator.test.ts` | 17 |
| 11 | `offline/OfflineRewardSystem.ts` | `offline/__tests__/OfflineRewardSystem.extended.test.ts` | 40 |

**总计：11个源文件 → 7个测试文件 → 238个用例**

---

## 🧪 测试策略

### Campaign 章节 (75个用例)

每章验证：
- **数据结构完整性**：id/name/type/chapterId/order/enemyFormation/rewards/dropTable
- **关卡类型分布**：3普通 + 1精英 + 1BOSS
- **难度递增**：recommendedPower 严格递增
- **order连续性**：1~5 无间断
- **BOSS关特性**：三星倍率≥2.0、保底掉落
- **精英关特性**：三星倍率≥1.5
- **碎片掉落映射**：验证关键武将碎片存在
- **首通奖励**：firstClearRewards > baseRewards
- **跨章一致性**：ID全局唯一、章节间战力递增
- **敌方单位**：属性正数、站位合法、兵种合法

### engine-extended-deps (12个用例)

- `createR11Systems`：41个子系统全部创建、name属性存在、自定义EquipmentSystem注入
- `registerR11Systems`：40+子系统注册到Registry、实例引用一致
- `initR11Systems`：deps注入不抛异常
- `resetR11Systems`：幂等重置、初始化后重置
- **完整生命周期**：创建→注册→初始化→重置

### engine-getters (59个用例)

- **Mixin模式验证**：applyGetters混入原型方法
- **武将系统getter**：hero/heroRecruit/heroLevel/heroFormation等
- **资源API**：getResourceAmount代理
- **阵型API**：getFormations/createFormation/setFormation/addToFormation/removeFromFormation
- **招募API**：recruit(1次/10次)/freeRecruit/canFreeRecruit
- **R11子系统getter**：mail/shop/currency/equipment/arena/alliance/prestige/quest/achievement等
- **事件子系统getter**：trigger/uiNotification/log
- **离线子系统getter**：offlineReward/offlineEstimate/offlineSnapshot
- **引导子系统getter**：tutorialStateMachine/storyEventPlayer/firstLaunchDetector
- **战役API**：completeBattle/getCampaignProgress/getStageList/getChapters
- **科技系统getter**：treeSystem/pointSystem/researchSystem/getTechState/startResearch/cancelResearch/speedUp
- **地图系统getter**：worldMap/territory/siege/garrison/mapEvent

### EventUINotification (35个用例)

- **ISubsystem生命周期**：name/init/update/reset
- **急报横幅创建**：直接显示/队列加入/图标映射/优先级时长
- **横幅事件总线**：event:banner_created事件发送
- **队列优先级排序**：pending按优先级降序
- **横幅已读/关闭**：markCurrentBannerRead/dismissCurrentBanner
- **遭遇弹窗**：createEncounterModal/createEncounterModals/isUrgent
- **序列化**：serialize/deserialize/undefined安全
- **边界条件**：expired最多50条/pending溢出

### StoryTriggerEvaluator (17个用例)

- **evaluateStoryTrigger**：first_enter/after_step/all_steps_complete返回false、first_recruit/castle_level/battle_count/first_alliance/tech_count条件评估、未知类型
- **checkTriggerConditions**：遍历检测/已完成跳过/不满足返回null
- **checkStepTrigger**：步骤匹配/已完成跳过
- **边界条件**：undefined value不崩溃/battle_count=0/纯函数无副作用

### OfflineRewardSystem 扩展 (40个用例)

- **handleDegradationNotice**：有/无快照、mailSystem发送邮件、重复通知防抖、恢复后重新发送
- **calculateSiegeResult**：成功无损失/失败30%损失/战利品/向下取整
- **updateProductionRatesAfterTech**：按时间排序/加成叠加/空列表/乱序输入
- **calculateWithSnapshotBonus**：无加成/有加成/多来源叠加/0秒
- **calculateCrossSystemReward**：三系统独立/总收益=三系统之和/noDuplicates/0秒
- **updateReputationBonus**：基础系数/递增关系
- **processExpiredMailCompensation**：gold补偿/非gold无补偿/多封独立
- **经验系统注册**：registerExpSystem/handleExpRegistrationFailure
- **经验状态管理**：setExpState/getExpState/初始值
- **calculateOfflineExp**：正常计算/0秒/加成效果/加成上限
- **reset**：完整状态重置

---

## ✅ 执行结果

```
Test Files  7 passed (7)
     Tests  238 passed (238)
  Duration  3.48s
```

---

## 📁 新增测试文件清单

```
src/games/three-kingdoms/engine/campaign/__tests__/campaign-chapters-1to3.test.ts  (75 cases)
src/games/three-kingdoms/engine/campaign/__tests__/campaign-chapters-4to6.test.ts  (included above)
src/games/three-kingdoms/engine/__tests__/engine-extended-deps.test.ts             (12 cases)
src/games/three-kingdoms/engine/__tests__/engine-getters.test.ts                   (59 cases)
src/games/three-kingdoms/engine/event/__tests__/EventUINotification.test.ts        (35 cases)
src/games/three-kingdoms/engine/guide/__tests__/StoryTriggerEvaluator.test.ts      (17 cases)
src/games/three-kingdoms/engine/offline/__tests__/OfflineRewardSystem.extended.test.ts (40 cases)
```
