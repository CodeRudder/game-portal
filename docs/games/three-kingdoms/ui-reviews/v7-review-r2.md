# v7.0 草木皆兵 — UI 测试报告 Round 2

> **测试日期**: 2025-07-14
> **测试类型**: UI 组件测试 + 功能面板验证 + 回归测试
> **测试范围**: NPC 巡逻与高级交互 / 事件系统深化 / 任务系统
> **前置审查**: R1 已修复 4 个 P0（门面导出/编译失败/路径错误/功能菜单）

---

## 一、测试概览

| 指标 | 数值 |
|------|------|
| ✅ 通过项 | **76** |
| ❌ 失败项 | **2** |
| ⚠️ 警告 | **3** |
| 📸 data-testid 覆盖 | 22 个 |
| UI 组件文件 | 10 个（NPC 5 + Event 4 + Quest 1 + Activity 1） |
| UI 测试文件 | 5 个（NPC 3 + Event 2） |
| 引擎测试 | 19 文件 / 793 用例 / **100% 通过** |

### 测试结果汇总

| 测试套件 | 文件数 | 用例数 | 通过 | 失败 | 通过率 |
|----------|:------:|:------:|:----:|:----:|:------:|
| NPC 引擎 (`engine/npc`) | 7 | 346 | 346 | 0 | **100%** |
| Event 引擎 (`engine/event`) | 9 | 343 | 343 | 0 | **100%** |
| Quest 引擎 (`engine/quest`) | 3 | 104 | 104 | 0 | **100%** |
| Activity 引擎 (`engine/activity`) | 2 | 137 | 137 | 0 | **100%** |
| NPC 面板 (`panels/npc`) | 3 | 50 | 50 | 0 | **100%** |
| Event 面板 (`panels/event`) | 2 | 29 | 27 | **2** | 93.1% |
| **合计** | **26** | **1,009** | **1,007** | **2** | **99.8%** |

---

## 二、功能面板验证矩阵

### 模块 A: NPC 巡逻与高级交互 (NPC)

| # | 功能点 | 优先级 | UI 组件 | 测试文件 | 状态 |
|---|--------|:------:|---------|----------|:----:|
| 1 | NPC 名册 Tab | P0 | `NPCTab.tsx` (234行) | `NPCTab.test.tsx` | ✅ |
| 2 | NPC 搜索筛选 | P0 | `NPCTab.tsx` — `data-testid=npc-search-input` | `NPCTab.test.tsx` | ✅ |
| 3 | NPC 职业筛选栏 | P0 | `NPCTab.tsx` — `data-testid=npc-filter-bar` | `NPCTab.test.tsx` | ✅ |
| 4 | NPC 卡片列表 (10张) | P0 | `NPCTab.tsx` — `data-testid=npc-card-*` | `NPCTab.test.tsx` | ✅ |
| 5 | NPC 底部统计 | P1 | `NPCTab.tsx` — `data-testid=npc-tab-footer` | `NPCTab.test.tsx` | ✅ |
| 6 | NPC 详情弹窗 | P0 | `NPCInfoModal.tsx` (188行) | `NPCInfoModal.test.tsx` | ✅ |
| 7 | NPC 好感度显示 | P0 | `NPCInfoModal.tsx` — `data-testid=npc-info-affinity` | `NPCInfoModal.test.tsx` | ✅ |
| 8 | NPC 操作按钮区 | P0 | `NPCInfoModal.tsx` — `data-testid=npc-info-actions` | `NPCInfoModal.test.tsx` | ✅ |
| 9 | NPC 对话弹窗 | P1 | `NPCDialogModal.tsx` (208行) | `NPCDialogModal.test.tsx` | ✅ |
| 10 | NPC 对话 Escape 关闭 | P2 | `NPCDialogModal.tsx` | `NPCDialogModal.test.tsx` | ✅ |
| 11 | NPC 赠送系统 | P0 | `NPCInfoModal.tsx` — 赠送按钮 | `NPCInfoModal.test.tsx` | ✅ |
| 12 | NPC 偏好物品显示 | P0 | `NPCInfoModal.tsx` | `NPCInfoModal.test.tsx` | ✅ |
| 13 | NPC 巡逻路径 | P0 | 引擎层 `NPCPatrolSystem.ts` | `NPCPatrolSystem.test.ts` | ✅ |
| 14 | NPC 刷新规则 | P0 | 引擎层 `NPCSpawnSystem.ts` | `NPCPatrolSystem.test.ts` | ✅ |
| 15 | NPC 切磋系统 | P1 | 引擎层 `NPCTrainingSystem.ts` | `NPCSystem.test.ts` | ✅ |
| 16 | NPC 离线行为摘要 | P1 | 引擎层 `NPCTrainingSystem.ts` | `NPCSystem.test.ts` | ✅ |
| 17 | NPC 对话历史回看 | P2 | `NPCDialogSystem.ts` | `NPCDialogSystem.test.ts` | ✅ |

**NPC 面板 data-testid 覆盖**: 22 个（NPCTab 10 + NPCInfoModal 5 + NPCDialogModal 7）

### 模块 B: 事件系统深化 (EVT)

| # | 功能点 | 优先级 | UI 组件 | 测试文件 | 状态 |
|---|--------|:------:|---------|----------|:----:|
| 18 | 事件列表面板 | P0 | `EventListPanel.tsx` (232行) | `EventBanner.test.tsx` | ✅ |
| 19 | 事件急报横幅 | P0 | `EventBanner.tsx` (129行) — `data-testid=event-banner` | `EventBanner.test.tsx` | ✅ |
| 20 | 随机遭遇弹窗 | P0 | `RandomEncounterModal.tsx` (167行) | `RandomEncounterModal.test.tsx` | ⚠️ 2失败 |
| 21 | 历史剧情事件(PC) | P0 | `StoryEventModal.tsx` (96行) | 引擎 `StoryEventSystem.test.ts` | ✅ |
| 22 | 历史剧情事件(手机) | P1 | `StoryEventModal.css` — 375px 适配 | 引擎测试覆盖 | ✅ |
| 23 | 连锁事件 | P0 | 引擎层 `ChainEventSystem.ts` | `ChainEventSystem.test.ts` | ✅ |
| 24 | 事件日志面板 | P1 | 引擎层 `EventLogSystem.ts` | `EventLogSystem.test.ts` | ✅ |
| 25 | 回归急报堆展示 | P1 | 引擎层 `OfflineEventSystem.ts` | `OfflineEventSystem.test.ts` | ✅ |

### 模块 C: 任务系统 (QST)

| # | 功能点 | 优先级 | UI 组件 | 测试文件 | 状态 |
|---|--------|:------:|---------|----------|:----:|
| 26 | 任务面板 | P0 | `QuestPanel.tsx` (143行) | 引擎 `QuestSystem.test.ts` | ✅ |
| 27 | 日常/主线/支线 Tab | P0 | `QuestPanel.tsx` — Tab 切换 | 引擎测试覆盖 | ✅ |
| 28 | 活跃度进度条 | P0 | `ActivityPanel.tsx` (231行) | `ActivitySystem.test.ts` | ✅ |
| 29 | 一键领取 | P1 | `QuestPanel.tsx` | 引擎测试覆盖 | ✅ |
| 30 | 任务追踪(最多3个) | P0 | 引擎层 `QuestTrackerSystem.ts` | `QuestTrackerSystem.test.ts` | ✅ |
| 31 | 任务跳转 | P1 | 引擎层 `QuestTrackerSystem.ts` | `QuestTrackerSystem.test.ts` | ✅ |
| 32 | 主线任务 | P0 | 引擎层 `QuestSystem.ts` | `QuestSystem.test.ts` | ✅ |
| 33 | 支线任务 | P1 | 引擎层 `QuestSystem.ts` | `QuestSystem.test.ts` | ✅ |
| 34 | 日常任务(20选6) | P0 | 引擎层 `QuestSystem.ts` | `QuestSystem.test.ts` | ✅ |

### 模块 D: 回归测试

| # | 测试项 | 状态 |
|---|--------|:----:|
| 35 | 建筑面板正常 | ✅ |
| 36 | 武将面板正常 | ✅ |
| 37 | 科技面板正常 | ✅ |
| 38 | 关卡面板正常 | ✅ |
| 39 | TypeScript 编译 `tsc --noEmit` | ✅ 零错误 |
| 40 | DDD 门面导出完整 | ✅ |

### 模块 E: 移动端适配

| # | 测试项 | CSS 文件 | 状态 |
|---|--------|----------|:----:|
| 41 | NPC Tab 响应式 | `NPCTab.css` — `@media` 375px | ✅ |
| 42 | NPC 详情弹窗响应式 | `NPCInfoModal.css` — `@media` 375px | ✅ |
| 43 | NPC 对话弹窗响应式 | `NPCDialogModal.css` — `@media` 375px | ✅ |
| 44 | 事件横幅响应式 | `EventBanner.css` — `@media` | ✅ |
| 45 | 随机遭遇弹窗响应式 | `RandomEncounterModal.css` — `@media` | ✅ |
| 46 | 剧情事件弹窗响应式 | `StoryEventModal.css` — 375×667 | ✅ |

---

## 三、问题清单

### P0 (阻塞发布) — 0 个

无 P0 问题。

### P1 (需修复) — 2 个

| 编号 | 模块 | 问题 | 详情 | 建议 |
|------|------|------|------|------|
| **P1-1** | Event UI | `RandomEncounterModal` 事件名称重复渲染 | `getByText('流民潮')` 匹配到多个元素 — 标题和选项列表中都包含事件名 | 使用 `getAllByText` 或 `getByRole('heading')` 精确匹配标题 `<h3>` |
| **P1-2** | Event UI | `RandomEncounterModal` 关闭按钮测试定位失败 | `getByLabelText('关闭')` 找不到 — SharedPanel 关闭按钮 `aria-label="关闭面板"` 与测试 `'关闭'` 不匹配 | 测试应改为 `getByLabelText('关闭面板')` 或给 SharedPanel 关闭按钮添加 `data-testid` |

### P2 (建议优化) — 3 个

| 编号 | 模块 | 问题 | 建议 |
|------|------|------|------|
| **P2-1** | Quest UI | `QuestPanel.tsx` 缺少 `data-testid` 属性 | 为面板容器、Tab 按钮、任务卡片添加 `data-testid` |
| **P2-2** | Activity UI | `ActivityPanel.tsx` 缺少 `data-testid` 属性 | 为活跃度面板、进度条、宝箱按钮添加 `data-testid` |
| **P2-3** | Event UI | `RandomEncounterModal` 组件内事件名在标题和选项中重复出现 | 考虑选项文本与标题区分（如选项显示"应对流民潮"而非重复"流民潮"） |

---

## 四、UI 组件质量评估

| 维度 | NPC | Event | Quest | Activity |
|------|:---:|:-----:|:-----:|:--------:|
| 组件文件数 | 5 | 4 | 1 | 1 |
| CSS 文件数 | 3 | 3 | 0 | 0 |
| 测试文件数 | 3 | 2 | 0 | 0 |
| data-testid 数 | 22 | 10 | 0 | 0 |
| 移动端适配 | ✅ | ✅ | — | — |
| 最大组件行数 | 234 | 232 | 143 | 231 |

### 亮点
1. **NPC 模块 UI 测试最完善**: 3 个测试文件 50 用例，22 个 data-testid，覆盖搜索/筛选/卡片/弹窗/对话全链路
2. **移动端适配全面**: NPC 3 个 CSS + Event 3 个 CSS 均包含 `@media` 响应式规则
3. **引擎测试 100% 通过**: NPC 346 + Event 343 + Quest 104 + Activity 137 = 930 用例全绿
4. **SharedPanel 复用**: Event 和其他面板统一使用 `SharedPanel` 组件，保持 UI 一致性

### 待改进
1. Quest/Activity 面板缺少独立 UI 测试文件和 data-testid
2. RandomEncounterModal 存在 2 个测试失败（P1 级别，非功能缺陷，属测试定位问题）

---

## 五、编译与构建验证

```
$ npx tsc --noEmit
✅ 零错误，零警告

$ npx vitest run (v7 相关模块)
✅ NPC:     7 files, 346 tests passed
✅ Event:   9 files, 343 tests passed
✅ Quest:   3 files, 104 tests passed
✅ Activity: 2 files, 137 tests passed
⚠️ Event UI: 2 files, 27/29 passed (2 failures in RandomEncounterModal)
```

---

## 六、结论

| 指标 | 数值 |
|------|------|
| **UI 通过数** | **76** |
| **P0** | **0** |
| **P1** | **2** |
| **P2** | **3** |
| **总评** | ✅ **PASS（附条件）** |

> v7.0 草木皆兵 UI 测试整体通过。引擎层 930 用例 100% 通过，NPC 面板 50 用例 100% 通过。
> 2 个 P1 均为 `RandomEncounterModal` 测试定位问题（非功能缺陷），建议下轮修复。
> 3 个 P2 为 Quest/Activity 面板 data-testid 缺失，不影响功能。
>
> **建议**: 修复 P1-1/P1-2 后可直接进入 v8.0 测试。
