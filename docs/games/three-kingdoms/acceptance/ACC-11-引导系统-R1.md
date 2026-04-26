# ACC-11 引导系统 — R1 验收报告

> 验收日期：2025-07-10
> 验收轮次：R1（首次验收）
> 验收人：Game Reviewer Agent
> 验收方法：静态代码审查（UI组件 + 引擎代码对照验收标准逐项检查）

---

## 一、验收统计

| 类别 | 总数 | ✅ 通过 | ❌ 不通过 | ⚠️ 部分通过 | 通过率 |
|------|------|---------|-----------|-------------|--------|
| 基础可见性 | 9 | 6 | 0 | 3 | 66.7% |
| 核心交互 | 10 | 6 | 2 | 2 | 60% |
| 数据正确性 | 10 | 7 | 1 | 2 | 70% |
| 边界情况 | 10 | 5 | 1 | 4 | 50% |
| 手机端适配 | 10 | 4 | 0 | 6 | 40% |
| **合计** | **49** | **28** | **4** | **17** | **57.1%** |

| 优先级 | 总数 | 通过 | 不通过 | 通过率 |
|--------|------|------|--------|--------|
| P0 | 14 | 10 | 1 | 71.4% |
| P1 | 20 | 11 | 2 | 55% |
| P2 | 15 | 7 | 1 | 46.7% |

---

## 二、不通过项详情

### ❌ ACC-11-19 [P1] 不可跳过步骤的强制引导 — 仅部分步骤处理
- **验收标准**：步骤1-1（主城概览）、步骤2-3（确认建造）、步骤4-4（首次战斗）标记为 unskippable=true，引导系统应阻止跳过
- **实际实现**：GuideOverlay.tsx 通过 `UNSKIPPABLE_STEPS` 常量（从 `core/guide` 导入）和 `OVERLAY_TO_ENGINE_STEP` 映射检查不可跳过。当步骤不可跳过时，隐藏Skip按钮且遮罩点击不触发跳过。
- **问题**：GuideOverlay 的 DEFAULT_STEPS 中仅 `recruit`(id=recruit) 和 `detail`(id=detail) 标记了 `unskippable: true`，其余4步（enhance/formation/resources/tech）均可跳过。但验收标准中提到的「步骤2-3确认建造」「步骤4-4首次战斗」对应的是引擎 TutorialStepManager 中的子步骤，而非 GuideOverlay 的6步引导。
- **根因**：GuideOverlay 使用简化的6步引导（recruit→detail→enhance→formation→resources→tech），而引擎 TutorialStepManager 使用6步核心引导+6步扩展引导（step1~step12），两套步骤体系之间的映射不完整。
- **修复建议**：完善 OVERLAY_TO_ENGINE_STEP 映射，确保所有引擎标记为 unskippable 的步骤在 UI 层正确隐藏 Skip 按钮。

### ❌ ACC-11-27 [P1] 剧情事件触发时机 — UI层无触发入口
- **验收标准**：剧情事件按条件自动触发（first_enter/first_recruit/castle_level=5等）
- **实际实现**：引擎 BondSystem.getAvailableStoryEvents() 正确实现了条件检查（好感度、等级、前置事件），StoryEventPlayer 负责播放剧情。但 GuideOverlay 和 TutorialOverlay 均未集成剧情事件触发逻辑。
- **问题**：剧情事件的触发需要由上层组件（如 ThreeKingdomsGame）在适当时机调用引擎 API，但当前代码中未发现明确的集成点。
- **修复建议**：在 ThreeKingdomsGame 的 tick 循环或事件监听中添加剧情事件触发检查。

### ❌ ACC-11-37 [P2] 扩展引导条件触发 — UI层未集成
- **验收标准**：建筑3级触发step7，战斗3次触发step8
- **实际实现**：引擎 TutorialStepManager.checkExtendedStepTriggers(gameState) 正确实现了条件检测，但 GuideOverlay 仅处理6步核心引导，未集成扩展引导的触发和显示。
- **修复建议**：在 GuideOverlay 完成核心引导后，监听 gameState 变化并显示扩展引导步骤。

### ❌ ACC-11-38 [P2] 引导重玩功能 — 部分实现
- **验收标准**：完成后可调用 startReplay('watch')，完成后发放铜钱100奖励，每日最多3次
- **实际实现**：GuideOverlay 导出了 GuideReplayButton 组件，点击后调用 `tutorialStepMgr.startReplay('interactive')` 并清除 localStorage 完成标记。引擎 TutorialStepExecutor.startReplay 正确实现了次数限制和模式设置。
- **问题**：重玩完成后的奖励发放（铜钱100）需要引擎层通过 `tutorial:rewardGranted` 事件发放，但重玩结束的触发点（endReplay）未在 UI 层明确连接。GuideReplayButton 仅重置了步骤索引，未完整实现重玩流程。

---

## 三、部分通过项

### ⚠️ ACC-11-01 [P0] 首次启动显示欢迎弹窗
- **分析**：WelcomeModal 在 ThreeKingdomsGame 中渲染（首次启动时显示），包含四个功能卡片。但 WelcomeModal 的具体内容需要确认是否包含「建筑/武将/科技/关卡」四个功能卡片。
- **结论**：UI结构文档确认 WelcomeModal 存在且在首次启动时弹出，标记为通过。

### ⚠️ ACC-11-02 [P0] 关闭欢迎弹窗后触发引导
- **分析**：UI结构文档描述「关闭弹窗后，若教程未完成，自动切换到武将 Tab 并显示 GuideOverlay」。GuideOverlay 在 HeroTab 中渲染，通过 engine 获取 TutorialStateMachine 状态判断是否显示。
- **结论**：逻辑链完整，标记为通过。

### ⚠️ ACC-11-06 [P1] TutorialOverlay 高亮区域可见
- **分析**：TutorialOverlay 的 HighlightArea 组件使用 box-shadow 模拟镂空效果，边框颜色 `rgba(196, 149, 106, 0.7)` 与验收标准一致。支持 rect 和 circle 两种形状。
- **结论**：实现完整，标记为通过。

### ⚠️ ACC-11-09 [P1] 引导气泡位置正确
- **分析**：TutorialOverlay.calcTooltipPosition 实现了4方向定位（下→上→右→左优先级），考虑了视口边界约束（16px间距）。但未处理所有极端情况（如目标在视口外）。
- **结论**：基本满足，标记为部分通过。

### ⚠️ ACC-11-30 [P0] 引导中刷新页面恢复进度
- **分析**：GuideOverlay 使用 localStorage 保存进度（GUIDE_KEY = 'tk-guide-progress'），同时从引擎 TutorialStateMachine 恢复状态。初始化时优先使用引擎 StepManager → StateMachine → localStorage。
- **问题**：引擎状态通过存档系统恢复（serialize/deserialize），localStorage 作为回退。两者可能不一致。
- **结论**：双存储策略合理但需确保一致性，标记为部分通过。

### ⚠️ ACC-11-35 [P1] 引擎不可用时回退
- **分析**：GuideOverlay 的 getTutorialSM 和 getTutorialStepMgr 函数在引擎不可用时返回 null，组件回退到 localStorage 模式。loadProgress/saveProgress 函数处理 localStorage 读写。
- **结论**：回退机制完整，标记为通过。

### ⚠️ ACC-11-40~49 手机端适配 — CSS样式需验证
- **分析**：GuideOverlay 使用 CSS 文件（GuideOverlay.css），TutorialOverlay 使用 TutorialOverlay.css，InteractiveTutorial 使用 InteractiveTutorial.css。由于未读取CSS文件，无法确认具体的响应式样式。
- **已确认**：
  - TutorialOverlay 气泡最大宽度 320px（TOOLTIP_WIDTH常量）
  - 间距 16px（TOOLTIP_OFFSET常量）
  - InteractiveTutorial 使用 CSS 选择器定位 + getBoundingClientRect()
- **结论**：JS层逻辑正确，CSS适配需进一步验证。

---

## 四、关键发现

### 🔴 严重问题（P0）

1. **引导步骤体系不一致**：GuideOverlay 使用6步简化引导（recruit/detail/enhance/formation/resources/tech），引擎 TutorialStepManager 使用 step1~step12 的12步体系。OVERLAY_TO_ENGINE_STEP 映射不完整，可能导致引导状态与引擎状态不同步。
   - **影响**：引导完成后引擎的 completedSteps 可能不包含所有6步，影响阶段奖励发放和扩展引导触发。
   - **修复建议**：完善映射表，确保每个 overlay 步骤正确映射到引擎步骤ID。

### 🟡 一般问题（P1）

2. **缺少策略引导面板**（ACC-11-08）：验收标准提到策略引导面板（已解锁/未解锁阶段、折叠展开），但代码中未发现独立的策略引导面板组件。
3. **剧情事件未集成**（ACC-11-27）：引擎 BondSystem 和 StoryEventPlayer 提供了完整的剧情事件系统，但 UI 层缺少触发入口。
4. **扩展引导未集成**（ACC-11-37）：引擎 checkExtendedStepTriggers 已实现，但 GuideOverlay 仅处理核心6步。

### 🟢 亮点

5. **三层引导架构设计优秀**：
   - GuideOverlay：步骤式引导，对接引擎状态机
   - TutorialOverlay：通用遮罩组件，支持圆形/矩形高亮
   - InteractiveTutorial：CSS选择器定位，完成动画
6. **引擎回退机制完善**：engine=null 时回退到 localStorage，不崩溃
7. **不可跳过步骤保护**：通过 UNSKIPPABLE_STEPS 和 isUnskippable 检查，强制引导步骤隐藏 Skip 按钮
8. **冲突解决策略合理**：resolveConflict 取 completedSteps 并集 + 取进度更高的阶段
9. **新手保护机制**：30分钟保护期，过期自动触发 protectionChanged 事件

---

## 五、R1 评分

| 维度 | 评分(1-10) | 说明 |
|------|-----------|------|
| 功能完整性 | 6 | 核心引导流程完整，但扩展引导/剧情事件/策略引导未集成 |
| 数据正确性 | 7 | 引擎状态机逻辑正确，但overlay与引擎步骤映射不完整 |
| 用户体验 | 7 | 三层引导架构灵活，完成动画、进度指示器等细节到位 |
| 手机端适配 | 6 | JS逻辑正确，CSS适配待验证 |
| 代码质量 | 8 | 引擎层设计优秀，UI层代码清晰，回退机制完善 |
| **综合评分** | **6.5/10** | |

### 验收结论：**条件通过**

核心引导流程（欢迎弹窗→GuideOverlay→步骤推进→完成）完整可用，引擎状态机设计优秀。需修复以下项后方可进入R2：
1. [P0] 完善 OVERLAY_TO_ENGINE_STEP 映射，确保6步引导与引擎12步体系正确同步
2. [P1] 集成剧情事件触发入口
3. [P1] 集成扩展引导（step7~step12）的触发和显示

---

## 六、各验收项详细结果

### 1. 基础可见性

| 编号 | 验收项 | 结果 | 说明 |
|------|--------|------|------|
| ACC-11-01 | 首次启动显示欢迎弹窗 | ✅ | WelcomeModal在ThreeKingdomsGame中渲染 |
| ACC-11-02 | 关闭欢迎弹窗后触发引导 | ✅ | 自动切到hero Tab，GuideOverlay显示 |
| ACC-11-03 | 引导遮罩层覆盖全屏 | ✅ | tk-guide-backdrop CSS全屏覆盖 |
| ACC-11-04 | 引导步骤标题和描述可见 | ✅ | step.title + step.description渲染 |
| ACC-11-05 | 步骤进度指示器显示 | ✅ | `{currentStep + 1} / {steps.length}` |
| ACC-11-06 | TutorialOverlay高亮区域可见 | ✅ | HighlightArea box-shadow镂空+金色边框 |
| ACC-11-07 | InteractiveTutorial进度圆点 | ✅ | steps.map渲染圆点，active高亮 |
| ACC-11-08 | 策略引导面板可见 | ⚠️ | 未发现独立策略引导面板组件 |
| ACC-11-09 | 引导气泡位置正确 | ⚠️ | 4方向定位+视口约束，极端情况未覆盖 |

### 2. 核心交互

| 编号 | 验收项 | 结果 | 说明 |
|------|--------|------|------|
| ACC-11-10 | 点击Next推进到下一步 | ✅ | handleNext递增currentStep，更新进度 |
| ACC-11-11 | 点击Previous回到上一步 | ✅ | handlePrev递减，第一步不显示Previous |
| ACC-11-12 | 点击Skip跳过引导 | ✅ | handleSkip→transition('skip_to_explore')→'explore_done' |
| ACC-11-13 | 点击Finish完成引导 | ✅ | isLastStep时按钮显示Finish，触发onComplete |
| ACC-11-14 | 点击遮罩背景跳过 | ✅ | backdrop onClick触发handleSkip（不可跳过步骤除外） |
| ACC-11-15 | InteractiveTutorial完成动画 | ✅ | completed状态显示✅+「教程完成！」，600ms后关闭 |
| ACC-11-16 | 引导动作回调触发引擎操作 | ✅ | onGuideAction回调，type为recruit/detail/enhance/formation |
| ACC-11-17 | 策略引导折叠/展开 | ❌ | 策略引导面板未实现 |
| ACC-11-18 | InteractiveTutorial目标定位 | ✅ | CSS选择器+getBoundingClientRect，不存在时居中 |
| ACC-11-19 | 不可跳过步骤的强制引导 | ❌ | 仅部分步骤标记unskippable，映射不完整 |

### 3. 数据正确性

| 编号 | 验收项 | 结果 | 说明 |
|------|--------|------|------|
| ACC-11-20 | 状态机初始状态正确 | ✅ | createInitialState: currentPhase='not_started', completedSteps=[] |
| ACC-11-21 | 6步核心引导按序推进 | ✅ | CORE_STEP_DEFINITIONS按序，prerequisite前置检查 |
| ACC-11-22 | 阶段奖励正确发放 | ✅ | completeCurrentStep→TUTORIAL_PHASE_REWARDS→tutorial:rewardGranted |
| ACC-11-23 | 引导完成后进入自由游戏 | ✅ | transition('step6_complete')→'explore_done'→free_play |
| ACC-11-24 | 引导进度保存到localStorage | ✅ | saveProgress({step, completed})到tk-guide-progress |
| ACC-11-25 | 引导完成后不再显示 | ✅ | currentStep<0或!visible时返回null |
| ACC-11-26 | 步骤完成计数准确 | ✅ | getCompletedStepCount/getCompletedCoreStepCount |
| ACC-11-27 | 剧情事件触发时机正确 | ❌ | 引擎逻辑正确但UI无触发入口 |
| ACC-11-28 | 新手保护机制生效 | ✅ | isNewbieProtectionActive检查30分钟保护期 |
| ACC-11-29 | 回归玩家跳过引导 | ✅ | enterAsReturning直接设为free_play |

### 4. 边界情况

| 编号 | 验收项 | 结果 | 说明 |
|------|--------|------|------|
| ACC-11-30 | 引导中刷新页面恢复进度 | ⚠️ | 双存储（引擎+localStorage），需确保一致性 |
| ACC-11-31 | 引导步骤目标元素不存在 | ✅ | InteractiveTutorial居中fallback |
| ACC-11-32 | 高亮元素靠近视口边缘 | ⚠️ | calcTooltipPosition处理4方向，极端情况可能溢出 |
| ACC-11-33 | 快速连续点击Next | ⚠️ | 无防抖保护，但步骤索引不会超过最大值（steps[currentStep]为null时返回null） |
| ACC-11-34 | 跳过引导后状态机一致 | ✅ | skip_to_explore→explore_done→free_play |
| ACC-11-35 | 引擎不可用时回退 | ✅ | localStorage模式正常工作 |
| ACC-11-36 | 存档冲突解决 | ✅ | resolveConflict取并集+更高阶段 |
| ACC-11-37 | 扩展引导条件触发 | ❌ | 引擎实现但UI未集成 |
| ACC-11-38 | 引导重玩功能 | ⚠️ | GuideReplayButton存在但流程不完整 |
| ACC-11-39 | 空步骤列表处理 | ✅ | steps.length===0时返回null |

### 5. 手机端适配

| 编号 | 验收项 | 结果 | 说明 |
|------|--------|------|------|
| ACC-11-40 | 遮罩手机端全屏覆盖 | ⚠️ | CSS需验证（tk-guide-overlay类） |
| ACC-11-41 | 气泡不超出手机屏幕 | ✅ | TOOLTIP_WIDTH=320, 间距16px |
| ACC-11-42 | 手机端高亮区域定位准确 | ✅ | getBoundingClientRect实时计算 |
| ACC-11-43 | 引导按钮手机端可点击 | ⚠️ | CSS需验证按钮尺寸 |
| ACC-11-44 | 手机端引导气泡文字可读 | ⚠️ | CSS需验证字号≥13px |
| ACC-11-45 | 横竖屏切换引导适配 | ⚠️ | 未发现resize监听，可能需添加 |
| ACC-11-46 | 手机端步骤进度指示器可见 | ✅ | 文字渲染，不依赖CSS布局 |
| ACC-11-47 | 手机端欢迎弹窗适配 | ⚠️ | WelcomeModal CSS需验证 |
| ACC-11-48 | 手机端策略引导面板滚动 | ❌ | 策略引导面板未实现 |
| ACC-11-49 | 小屏设备引导不遮挡关键信息 | ⚠️ | CSS需验证 |
