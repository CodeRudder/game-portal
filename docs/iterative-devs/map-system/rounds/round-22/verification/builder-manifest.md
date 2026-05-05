# Builder 客观审核清单 — Round 22 Phase 1 攻占准备 (P1~P5)

> 审核日期: 2026-05-05
> 审核角色: Builder (客观审核者)
> 计划文件: docs/iterative-devs/map-system/rounds/round-22/plan.md

## 1. 总览

| 统计 | 数量 |
|------|------|
| 总检查项 | 27 |
| 已完成 (含实现+测试通过+测试有效) | 21 |
| 部分完成 (实现存在但有缺陷) | 4 |
| 未完成 | 2 |
| 测试有效性存疑 | 2 |

---

## 2. 逐项审核结果

### Stage P1: 选择攻城目标

| 计划任务ID | 完成状态 | 实现位置 | 测试文件 | 测试结果 | 测试有效性 | 覆盖场景 |
|:----------:|:--------:|----------|----------|:--------:|:----------:|----------|
| P1-1 城池点击交互 | ✅完成 | WorldMapTab.tsx:920-967 (handleTerritoryClick) | TerritoryInfoPanel.test.tsx (19/19 pass) | PASS | 有效 | 点击不同归属城池触发不同行为，非mock |
| P1-2 己方城池分流 | ✅完成 | TerritoryInfoPanel.tsx:61-63 (isPlayerOwned判断) + 131-139 (升级按钮) | TerritoryInfoPanel.test.tsx | PASS | 有效 | 己方显示升级按钮、不显示攻城按钮 |
| P1-3 资源点分流 | ✅完成 | TerritoryInfoPanel.tsx:149-158 (neutral显示占领按钮) | TerritoryInfoPanel.test.tsx | PASS | 有效 | 中立领土显示"占领"而非"攻城" |
| P1-4 攻占按钮 | ✅完成 | TerritoryInfoPanel.tsx:141-148 (敌方显示攻城按钮) | TerritoryInfoPanel.test.tsx | PASS | 有效 | 敌方领土有攻城按钮、onClick触发onSiege |

### Stage P2: 攻城确认弹窗

| 计划任务ID | 完成状态 | 实现位置 | 测试文件 | 测试结果 | 测试有效性 | 覆盖场景 |
|:----------:|:--------:|----------|----------|:--------:|:----------:|----------|
| P2-1 条件校验(领土相邻) | ✅完成 | SiegeSystem.ts:251-253 (canAttackTerritory检查) | SiegeSystem.test.ts:117-161 (NOT_ADJACENT测试) | PASS | 有效 | 使用真实TerritorySystem,非mock相邻判定 |
| P2-2 条件校验(兵力门槛) | ✅完成 | SiegeSystem.ts:257-259 (INSUFFICIENT_TROOPS) | SiegeSystem.test.ts:120-129 | PASS | 有效 | 兵力不足返回正确errorCode |
| P2-3 条件校验(粮草充足) | ✅完成 | SiegeSystem.ts:260-262 (INSUFFICIENT_GRAIN) | SiegeSystem.test.ts:131-137 | PASS | 有效 | 粮草不足返回正确errorCode |
| P2-4 条件校验(每日次数) | ✅完成 | SiegeSystem.ts:276-278 (DAILY_LIMIT_REACHED, 3次/天) | SiegeSystem.test.ts:475-558 (P1-4每日次数) | PASS | 有效 | 6个测试覆盖初始/消耗/跨天重置/同天不重置/序列化/用完拒绝 |
| P2-5 条件校验(攻城冷却) | ✅完成 | SiegeSystem.ts:281-289 (CAPTURE_COOLDOWN, 24h) | SiegeSystem.test.ts中覆盖 | PASS | 有效 | 冷却时间检查、剩余时间计算均有测试 |
| P2-6 条件校验(并发上限) | 🔄部分完成 | SiegeTaskManager.ts:240 (activeCount getter), 但SiegeSystem.checkSiegeConditions中**未检查并发上限**。ExpeditionSystem.ts:33,141有MAX_EXPEDITION_FORCES=3限制编队数量，但非SiegeSystem层限制 | 无专门测试 | N/A | 缺失 | SiegeSystem的6条校验中缺少并发上限检查，仅靠ExpeditionSystem间接限制 |
| P2-7 校验失败提示 | ✅完成 | SiegeConfirmModal.tsx:94-158 (getConditions函数) + 385-389 (错误消息区域) | SiegeConfirmModal.test.tsx:86-121 | PASS | 有效 | 条件不通过时显示红色错误、包含具体原因 |
| P2-8 多条失败推荐 | 🔄部分完成 | SiegeConfirmModal.tsx:94-158 (getConditions返回所有条件项，含通过/失败) | SiegeConfirmModal.test.tsx | PASS | 部分有效 | UI展示所有条件状态(通过/失败)，但无"按优先级推荐解决方案"的排序逻辑 |

### Stage P3: 选择/创建编队

| 计划任务ID | 完成状态 | 实现位置 | 测试文件 | 测试结果 | 测试有效性 | 覆盖场景 |
|:----------:|:--------:|----------|----------|:--------:|:----------:|----------|
| P3-1 编队选择面板 | ✅完成 | SiegeConfirmModal.tsx:465-475 (嵌入ExpeditionForcePanel) | SiegeConfirmModal.test.tsx | PASS | 有效 | 当有可用将领时显示编队面板 |
| P3-2 将领选择 | ✅完成 | ExpeditionForcePanel.tsx:17-31 (HeroInfo类型) + 将领选择UI | ui-interaction.integration.test.tsx | PASS | 有效 | 支持选择可用将领 |
| P3-3 兵力分配 | ✅完成 | SiegeConfirmModal.tsx:346-368 (兵力滑块) + ExpeditionForcePanel.tsx | SiegeConfirmModal.test.tsx | PASS | 有效 | 滑块范围[最低消耗, 可用兵力] |
| P3-4 战力预览 | 🔄部分完成 | ExpeditionSystem.ts:336-339 (calculateEffectivePower) + SiegeSystem.ts:788-789 (使用effectivePower) | ExpeditionSystem.test.ts | PASS | 有效性存疑 | calculateEffectivePower是Facade方法，直接委托给calculateRemainingPower，无将领技能等额外战力计算。测试未验证"实时显示编队战力"的UI渲染 |
| P3-5 空状态处理 | ✅完成 | ExpeditionForcePanel.tsx: 受伤将领UI标记 (injuryLevel/injuryRecoveryTime) | ui-interaction.integration.test.tsx | PASS | 有效 | 受伤将领显示恢复倒计时 |

### Stage P4: 选择攻城策略

| 计划任务ID | 完成状态 | 实现位置 | 测试文件 | 测试结果 | 测试有效性 | 覆盖场景 |
|:----------:|:--------:|----------|----------|:--------:|:----------:|----------|
| P4-1 4种策略卡片 | ✅完成 | SiegeConfirmModal.tsx:393-450 (4策略卡片渲染) + siege-enhancer.types.ts:163-212 (SIEGE_STRATEGY_CONFIGS) | SiegeStrategy.test.ts:69-118 (配置完整性) | PASS | 有效 | 4策略配置完整、四维差异化均有验证 |
| P4-2 策略效果预览 | ✅完成 | SiegeConfirmModal.tsx:417-428 (显示时间/损耗/奖励倍率) | SiegeStrategy.test.ts:123-189 | PASS | 有效 | 修正系数和胜率截断测试完整 |
| P4-3 夜袭令道具检查 | ✅完成 | SiegeSystem.ts:264-268 (STRATEGY_ITEM_MISSING) + SiegeConfirmModal.tsx:242-244 (nightRaidTokenCount检查) | SiegeStrategy.test.ts:99-106 (requiredItem=item-night-raid-token) | PASS | 有效 | 无夜袭令时卡片置灰、SiegeSystem校验拒绝 |
| P4-4 内应信三态 | ✅完成 | SiegeSystem.ts:269-274 (INSIDER_EXPOSED检查) + InsiderLetterSystem.ts + SiegeConfirmModal.tsx:233-241 (三态判定) | InsiderLetterSystem.test.ts (21/21 pass) + SiegeStrategy.test.ts:242-293 | PASS | 有效 | 可点击/暴露冷却/道具不足三态测试完整 |
| P4-5 策略选择确认 | ✅完成 | SiegeConfirmModal.tsx:407 (onClick回调onStrategyChange) + WorldMapTab.tsx:selectedStrategy状态管理 | SiegeStrategy.test.ts:214-238 | PASS | 有效 | 选择策略后更新消耗计算和确认弹窗 |

### Stage P5: 创建攻城任务

| 计划任务ID | 完成状态 | 实现位置 | 测试文件 | 测试结果 | 测试有效性 | 覆盖场景 |
|:----------:|:--------:|----------|----------|:--------:|:----------:|----------|
| P5-1 任务创建原子性 | 🔄部分完成 | SiegeTaskManager.ts:91-136 (createTask) + SiegeSystem.ts:633-644 (deductSiegeResources) | SiegeTaskManager.test.ts:16-73 | PASS | 有效性存疑 | createTask无事务机制，资源扣减依赖deductSiegeResources的try-catch，扣费失败时**无回滚**。测试未验证扣费失败回滚场景 |
| P5-2 SiegeTask状态 | ✅完成 | SiegeTaskManager.ts:144-180 (advanceStatus + 状态转换表) | SiegeTaskManager.test.ts:77-111 | PASS | 有效 | preparing->marching全链路合法转换+非法转换拒绝 |
| P5-3 任务面板更新 | ✅完成 | SiegeTaskPanel.tsx (任务卡片渲染) + WorldMapTab.tsx:1198 (setActiveSiegeTasks) | SiegeTaskPanel.test.tsx (73/73 pass) | PASS | 有效 | 73个测试覆盖活跃/已完成任务展示、编队摘要、状态图标 |
| P5-4 攻城中标记 | ✅完成 | SiegeTaskManager.ts:234-237 (isTargetUnderSiege) + SiegeTaskManager.lock.test.ts | SiegeTaskManager.lock.test.ts (13/13 pass) | PASS | 有效 | 目标锁定/解锁状态正确标记 |
| P5-5 攻城锁定 | ✅完成 | SiegeTaskManager.ts:394-406 (acquireSiegeLock) + 104 (createTask中获取锁) | SiegeTaskManager.lock.test.ts:78-103 | PASS | 有效 | 同目标二次攻城被拒绝、不同阶段仍锁定 |
| P5-6 过渡动画 | ⬜未完成 | WorldMapTab.tsx:1200 (setSiegeVisible(false)关闭弹窗) + 1218-1243 (聚焦路线/平移视窗) | 无专门测试 | N/A | 缺失 | 无Toast通知、无精灵高亮动画。仅有视窗平移(setSelectedId)和行军路线高亮。缺失弹窗关闭动画和Toast |

---

## 3. 测试运行结果

### 引擎层测试

```
SiegeTaskManager.test.ts          16 tests  PASS
SiegeTaskManager.lock.test.ts     13 tests  PASS
SiegeTaskManager.interrupt.test.ts (存在但未在本次计划范围内)
SiegeTaskManager.chain.test.ts    (存在但未在本次计划范围内)
SiegeSystem.test.ts               40 tests  PASS
SiegeEnhancer.test.ts             30 tests  PASS
SiegeStrategy.test.ts             28 tests  PASS
CooldownManager.test.ts           17 tests  PASS
InsiderLetterSystem.test.ts       21 tests  PASS

总计: 165/165 PASS
```

### UI组件测试

```
SiegeConfirmModal.test.tsx        16 tests  PASS
SiegeTaskPanel.test.tsx           73 tests  PASS
TerritoryInfoPanel.test.tsx       19 tests  PASS

总计: 108/108 PASS
```

---

## 4. 测试有效性评估

### 有效测试 (关键路径无mock)

| 测试文件 | 有效性 | 说明 |
|----------|--------|------|
| SiegeSystem.test.ts | **有效** | 使用真实TerritorySystem + SiegeSystem联动，非mock核心逻辑 |
| SiegeStrategy.test.ts | **有效** | 使用真实TerritorySystem/WorldMapSystem/GarrisonSystem/SiegeSystem四系统联动 |
| SiegeTaskManager.test.ts | **有效** | 直接测试SiegeTaskManager状态机逻辑，eventBus仅mock emit |
| SiegeTaskManager.lock.test.ts | **有效** | 直接测试攻城锁机制，无mock |
| SiegeEnhancer.test.ts | **有效** | 使用真实Territory/Siege/Garrison三系统联动 |
| CooldownManager.test.ts | **有效** | 直接测试冷却管理逻辑 |
| InsiderLetterSystem.test.ts | **有效** | 直接测试内应信生命周期 |
| TerritoryInfoPanel.test.tsx | **有效** | React组件渲染测试，验证UI条件分支 |
| SiegeTaskPanel.test.tsx | **有效** | React组件渲染测试，73个用例覆盖全面 |
| SiegeConfirmModal.test.tsx | **有效** | React组件渲染测试，验证条件显示和交互 |

### 有效性存疑

| 测试文件 | 问题 | 影响 |
|----------|------|------|
| ExpeditionSystem.test.ts | calculateEffectivePower是Facade方法，无将领技能加成测试 | P3-4战力预览可能不准确 |
| SiegeTaskManager.test.ts | createTask无事务回滚测试，deductSiegeResources失败场景未测试 | P5-1原子性无法保证 |

### 端到端测试覆盖

**结论: 无完整端到端集成测试。** P1到P5的完整链路(选城->点击攻占->弹框->校验->编队->策略->创建任务->显示信息)分散在WorldMapTab.tsx中，但无自动化集成测试验证完整流程。各子系统之间的真实串联依赖于组件内部逻辑，测试覆盖率由子系统级别的单元测试组合而成。

---

## 5. 对抗性评测重点逐项核查

| 评测重点 | 核查结果 |
|----------|----------|
| P2条件校验的完整性和顺序(6条校验) | **5/6完成**。SiegeSystem.checkSiegeConditions实现了5条(相邻/兵力/粮草/每日次数/冷却)，缺少并发上限(activeCount<3)检查 |
| P3编队与P4策略的数据流是否真实串联 | **基本完成**。WorldMapTab.tsx:1144-1166中createTask接收expeditionSelection和selectedStrategy，传递到SiegeTaskManager |
| P5任务创建的原子性(资源扣费失败时回滚) | **未完成**。deductSiegeResources使用try-catch静默处理失败，无回滚机制 |
| Phase 1->Phase 2过渡(P5->P6状态流转) | **部分完成**。SiegeTaskManager有preparing->marching转换，但依赖WorldMapTab手动调用advanceStatus |
| 异常分支覆盖(ERR-S01~S05) | **大部分完成**。NaN防护(FIX-701/702/703)、null防护(FIX-705)、边界条件有专门测试 |

---

## 6. 未完成/部分完成任务详细说明

### P2-6 并发上限 (部分完成)
- **现状**: SiegeSystem.checkSiegeConditions缺少"活跃任务<3"的检查
- **间接限制**: ExpeditionSystem有MAX_EXPEDITION_FORCES=3，限制了编队创建数量
- **风险**: SiegeSystem的6条校验不完整，绕过ExpeditionSystem可直接调用SiegeSystem创建超过3个并发攻城

### P2-8 多条失败推荐 (部分完成)
- **现状**: getConditions函数返回所有条件项(含通过/失败状态)，UI渲染所有项
- **缺失**: 无"按优先级排序推荐解决方案"逻辑，条件列表按固定顺序展示

### P3-4 战力预览 (部分完成)
- **现状**: calculateEffectivePower方法存在，但只是calculateRemainingPower的Facade
- **缺失**: 无将领技能/兵种克制等高级战力计算

### P5-1 任务创建原子性 (部分完成)
- **现状**: createTask + deductSiegeResources分两步执行
- **缺失**: 资源扣减失败时无回滚机制(任务已创建但资源未扣减)

### P5-6 过渡动画 (未完成)
- **现状**: 仅有视窗平移(setSelectedId)和行军路线高亮
- **缺失**: 无Toast通知、无精灵高亮动画、无弹窗关闭动画

---

*Builder 客观审核完成 | 2026-05-05*
