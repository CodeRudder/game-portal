# Tutorial R1 — Builder 测试分支树

> 模块: `engine/tutorial` | 文件: `tutorial-system.ts`, `tutorial-config.ts`
> Builder: agent | 日期: 2026-05-01

## 公开 API 清单

| # | API | 类型 | 参数 |
|---|-----|------|------|
| 1 | `init(deps)` | 生命周期 | ISystemDeps |
| 2 | `update(dt)` | 生命周期 | number |
| 3 | `getState()` | 查询 | — |
| 4 | `reset()` | 生命周期 | — |
| 5 | `getCurrentStep()` | 核心 | — |
| 6 | `completeCurrentStep(action)` | 核心 | string |
| 7 | `getAllSteps()` | 查询 | — |
| 8 | `isTutorialComplete()` | 查询 | — |
| 9 | `getProgress()` | 查询 | — |
| 10 | `skipTutorial()` | 核心 | — |
| 11 | `isSkipped()` | 查询 | — |
| 12 | `isStepCompleted(stepId)` | 查询 | TutorialGuideStepId |
| 13 | `getStepById(stepId)` | 查询 | TutorialGuideStepId |
| 14 | `getStepStatus(stepId)` | 查询 | TutorialGuideStepId |
| 15 | `getCurrentStepOrder()` | 查询 | — |
| 16 | `getCurrentStepAction()` | 查询 | — |
| 17 | `getStepHint(stepId)` | 查询 | TutorialGuideStepId |
| 18 | `getTutorialStats()` | 查询 | — |
| 19 | `serialize()` | 序列化 | — |
| 20 | `loadSaveData(data)` | 序列化 | TutorialGuideSaveData |

## 测试分支树

### F-Normal（正常流程）

| 节点ID | API | 场景 | 状态 |
|--------|-----|------|------|
| FN-01 | init | 正常注入deps，eventBus可用 | covered: tutorial-system.test.ts L55 |
| FN-02 | getCurrentStep | 初始状态返回第1步 claim_newbie_pack | covered: tutorial-system.test.ts |
| FN-03 | completeCurrentStep | 按顺序完成4步，每步返回正确nextStep | covered: tutorial-system.test.ts |
| FN-04 | completeCurrentStep | 完成最后一步后nextStep=null，emit completed事件 | covered: tutorial-system.test.ts |
| FN-05 | skipTutorial | 跳过后getCurrentStep返回null | covered: tutorial-system.test.ts |
| FN-06 | serialize | 完成部分步骤后序列化，completedSteps正确 | covered: tutorial-system.test.ts |
| FN-07 | loadSaveData | 从存档恢复后状态一致 | covered: tutorial-system.test.ts |
| FN-08 | getAllSteps | 返回4步，每步isCompleted正确 | covered: tutorial-system.test.ts |
| FN-09 | getProgress | 完成n步后返回{n,4,n*25} | covered: tutorial-system.test.ts |
| FN-10 | getStepStatus | 未完成/当前/已完成三态正确 | covered: tutorial-system.test.ts |
| FN-11 | getTutorialStats | 完成步骤后统计正确 | covered: tutorial-system-enhanced.test.ts |
| FN-12 | getStepHint | 返回步骤hint文本 | covered: tutorial-system-enhanced.test.ts |
| FN-13 | getCurrentStepAction | 返回当前步骤triggerAction | covered: tutorial-system-enhanced.test.ts |
| FN-14 | getCurrentStepOrder | 返回1-based序号 | covered: tutorial-system-enhanced.test.ts |
| FN-15 | reset | 重置后状态回到初始 | covered: tutorial-system.test.ts |
| FN-16 | update | 调用不报错 | covered: tutorial-system.test.ts |

### F-Boundary（边界条件）

| 节点ID | API | 场景 | 状态 |
|--------|-----|------|------|
| FB-01 | completeCurrentStep | action不匹配当前步骤 → success=false | covered: tutorial-system.test.ts |
| FB-02 | completeCurrentStep | 引导已完成后调用 → success=false | covered: tutorial-system.test.ts |
| FB-03 | completeCurrentStep | 引导已跳过后调用 → success=false | covered: tutorial-system.test.ts |
| FB-04 | skipTutorial | 引导已完成后再skip → 不变 | covered: tutorial-system.test.ts |
| FB-05 | isStepCompleted | 传入无效stepId → false | covered: tutorial-system.test.ts |
| FB-06 | getStepById | 传入无效stepId → null | covered: tutorial-system.test.ts |
| FB-07 | getStepHint | 传入无效stepId → null | covered: tutorial-system-enhanced.test.ts |
| FB-08 | getProgress | 初始状态 → {0,4,0} | covered: tutorial-system.test.ts |
| FB-09 | completeCurrentStep | 同一步骤重复完成 → 第二次失败 | covered: tutorial-system.test.ts |
| FB-10 | getCurrentStepOrder | 完成后返回-1，跳过返回-2 | covered: tutorial-system-enhanced.test.ts |

### F-Error（错误路径）

| 节点ID | API | 场景 | 严重度 | 状态 |
|--------|-----|------|--------|------|
| FE-01 | loadSaveData | data=null → 崩溃 | P0 | **未覆盖** |
| FE-02 | loadSaveData | data.completedSteps=undefined → 崩溃 | P0 | **未覆盖** |
| FE-03 | loadSaveData | data.completedSteps包含无效ID → 污染状态 | P1 | **未覆盖** |
| FE-04 | completeCurrentStep | deps未init → this.deps为undefined → 崩溃 | P0 | **未覆盖** |
| FE-05 | serialize | 状态含NaN stepCompletionTimes → JSON序列化异常 | P1 | **未覆盖** |
| FE-06 | loadSaveData | data.skipped=undefined → falsy，视为未跳过 | P1 | **未覆盖** |

### F-Serialize（序列化路径）

| 节点ID | API | 场景 | 严重度 | 状态 |
|--------|-----|------|--------|------|
| FS-01 | serialize | 不保存stepCompletionTimes → 反序列化后丢失 | P0 | **未覆盖** |
| FS-02 | serialize | 不保存startedAt → 反序列化后getTutorialStats错误 | P0 | **未覆盖** |
| FS-03 | loadSaveData | 不恢复stepCompletionTimes → getTutorialStats除零 | P0 | **未覆盖** |
| FS-04 | serialize/loadSaveData | TutorialSystem未接入engine-save → 存档丢失引导进度 | P0 | **未覆盖** |
| FS-05 | loadSaveData | version不匹配 → 无版本迁移 | P1 | **未覆盖** |

### F-CrossSystem（跨系统链路）

| 节点ID | 链路 | 场景 | 严重度 | 状态 |
|--------|------|------|--------|------|
| FC-01 | TutorialSystem ↔ ThreeKingdomsEngine | buildSaveCtx不包含tutorialGuide → 存档不保存引导状态 | P0 | **未覆盖** |
| FC-02 | TutorialSystem ↔ engine-save | buildSaveData不包含tutorial字段 → 完整存档丢失引导 | P0 | **未覆盖** |
| FC-03 | TutorialSystem ↔ guide系统 | 两套引导系统并存，TutorialSystem与guide/TutorialStateMachine无交互 | P1 | **未覆盖** |
| FC-04 | completeCurrentStep → eventBus | emit事件后其他子系统能否正确响应 | P1 | **未覆盖** |
| FC-05 | init → deps.registry | TutorialSystem不使用registry，但ISubsystem接口要求 | P2 | 已覆盖(无操作) |

## 统计

| 类别 | 总数 | 已覆盖 | 未覆盖 | 覆盖率 |
|------|------|--------|--------|--------|
| F-Normal | 16 | 16 | 0 | 100% |
| F-Boundary | 10 | 10 | 0 | 100% |
| F-Error | 6 | 0 | 6 | 0% |
| F-Serialize | 5 | 0 | 5 | 0% |
| F-CrossSystem | 5 | 0 | 5 | 0% |
| **合计** | **42** | **26** | **16** | **62%** |

## P0 汇总

| P0 ID | 节点 | 问题 | 源码位置 |
|-------|------|------|----------|
| P0-1 | FS-01 | serialize不保存stepCompletionTimes | tutorial-system.ts L262-266 |
| P0-2 | FS-02 | serialize不保存startedAt | tutorial-system.ts L262-266 |
| P0-3 | FS-03 | loadSaveData不恢复stepCompletionTimes | tutorial-system.ts L272-275 |
| P0-4 | FS-04/FC-01/FC-02 | TutorialSystem未接入engine-save系统 | ThreeKingdomsEngine.ts L842-877 |
| P0-5 | FE-01 | loadSaveData(null)崩溃 | tutorial-system.ts L272 |
| P0-6 | FE-02 | loadSaveData({completedSteps:undefined})崩溃 | tutorial-system.ts L273 |
| P0-7 | FE-04 | completeCurrentStep在init前调用崩溃 | tutorial-system.ts L136 |
