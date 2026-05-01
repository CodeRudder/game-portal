# Guide 模块源码分析

> Builder Agent | 2026-05-01

## 模块概览

Guide 模块是新手引导系统，覆盖18个功能点（#1~#18），管理从首次启动到新手保护的全生命周期。

## 文件清单

| 文件 | 行数 | 职责 |
|------|------|------|
| TutorialStateMachine.ts | 364 | #1 引导状态机 — 5状态+转换规则 |
| TutorialTransitions.ts | 63 | 转换规则表+内部状态类型 |
| tutorial-state-config.ts | 20 | 状态配置常量（已废弃，被TutorialTransitions替代） |
| TutorialStepManager.ts | 393 | #2-4 步骤管理+奖励+超时降级 |
| TutorialStepExecutor.ts | 270 | #10 加速/#11 不可跳过/#13 重玩/#7 触发检测 |
| TutorialStorage.ts | 379 | #8 存储持久化/#9 冲突解决/#17 首次启动标记 |
| StoryEventPlayer.ts | 392 | #5 8段剧情播放/#6 交互规则/#12 跳过确认 |
| StoryEventPlayer.types.ts | 210 | 剧情播放器类型+纯函数（打字机/自动播放/完成逻辑） |
| StoryEventPlayer.helpers.ts | 143 | 剧情播放器辅助纯函数 |
| StoryTriggerEvaluator.ts | 123 | #7 剧情触发条件评估器 |
| TutorialMaskSystem.ts | 365 | #15 聚焦遮罩/#16 引导气泡 |
| tutorial-mask-types.ts | 108 | 遮罩系统类型定义 |
| FirstLaunchDetector.ts | 351 | #17 首次启动检测/#18 新手保护 |
| first-launch-types.ts | 129 | 首次启动类型+常量 |
| index.ts | 44 | 统一导出 |

**总计**: ~3,417 行源码

## 子系统依赖关系

```
FirstLaunchDetector ──→ TutorialStateMachine ←── TutorialStorage
                              ↑
                     TutorialStepManager ←── TutorialStepExecutor
                              ↑
                     StoryEventPlayer ←── StoryTriggerEvaluator
                              ↑
                     TutorialMaskSystem
```

## 核心数据流

1. **首次启动**: FirstLaunchDetector.detectFirstLaunch() → TutorialStateMachine.transition('first_enter')
2. **步骤执行**: TutorialStepManager.startStep() → advanceSubStep() → completeCurrentStep()
3. **剧情播放**: StoryEventPlayer.startEvent() → tap()/update() → completeEvent()
4. **持久化**: TutorialStorage.save()/load() → localStorage / 内存回退
5. **遮罩高亮**: TutorialMaskSystem.activate() → setHighlightTarget() → getRenderData()

## 功能点覆盖

| # | 功能 | 主文件 | 辅文件 |
|---|------|--------|--------|
| #1 | 引导状态机 | TutorialStateMachine | TutorialTransitions |
| #2 | 6步核心引导 | TutorialStepManager | — |
| #3 | 6步扩展引导 | TutorialStepManager | — |
| #4 | 阶段奖励 | TutorialStepManager | — |
| #5 | 8段剧情事件 | StoryEventPlayer | — |
| #6 | 剧情交互规则 | StoryEventPlayer | StoryEventPlayer.types |
| #7 | 剧情触发时机 | StoryTriggerEvaluator | StoryEventPlayer |
| #8 | 引导进度存储 | TutorialStorage | TutorialStateMachine |
| #9 | 冲突解决 | TutorialStateMachine | TutorialStorage |
| #10 | 加速机制 | TutorialStepExecutor | — |
| #11 | 不可跳过内容 | TutorialStepExecutor | — |
| #12 | 剧情跳过规则 | StoryEventPlayer | — |
| #13 | 引导重玩 | TutorialStepExecutor | — |
| #14 | 自由探索过渡 | TutorialStateMachine | — |
| #15 | 聚焦遮罩 | TutorialMaskSystem | — |
| #16 | 引导气泡 | TutorialMaskSystem | — |
| #17 | 首次启动流程 | FirstLaunchDetector | TutorialStorage |
| #18 | 新手保护机制 | FirstLaunchDetector | TutorialStateMachine |
