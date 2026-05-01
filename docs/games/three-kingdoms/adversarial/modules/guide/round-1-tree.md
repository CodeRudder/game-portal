# Guide R1 测试分支树

> Builder Agent | 2026-05-01

## 树概览

基于 Guide 模块 15 个源文件、18 个功能点构建的完整测试分支树。

## T1: TutorialStateMachine — 引导状态机 (#1)

```
T1-ROOT: TutorialStateMachine
├── T1-N1: 初始状态
│   └── currentPhase=not_started, completedSteps=[], isFirstLaunch=true
├── T1-N2: 合法转换路径
│   ├── T1-N2a: not_started → first_enter → core_guiding
│   ├── T1-N2b: core_guiding → step6_complete → free_explore
│   ├── T1-N2c: core_guiding → skip_to_explore → free_explore
│   ├── T1-N2d: free_explore → explore_done → free_play
│   ├── T1-N2e: free_play → condition_trigger → mini_tutorial
│   ├── T1-N2f: mini_tutorial → mini_done → free_play
│   ├── T1-N2g: free_play → non_first_enter → free_play
│   └── T1-N2h: 完整路径 not_started→core_guiding→free_explore→free_play
├── T1-N3: 非法转换拒绝
│   ├── T1-N3a: not_started + step6_complete → FAIL
│   ├── T1-N3b: not_started + explore_done → FAIL
│   ├── T1-N3c: core_guiding + explore_done → FAIL
│   ├── T1-N3d: free_play + first_enter → FAIL
│   └── T1-N3e: mini_tutorial + first_enter → FAIL
├── T1-N4: 事件发射
│   ├── T1-N4a: transition → tutorial:phaseChanged
│   ├── T1-N4b: explore_done到达free_play → tutorial:completed
│   └── T1-N4c: first_enter → tutorialStartTime + protectionStartTime
├── T1-N5: 进度管理
│   ├── T1-N5a: completeStep 去重
│   ├── T1-N5b: completeStoryEvent 去重
│   ├── T1-N5c: advanceSubStep 正常推进
│   ├── T1-N5d: advanceSubStep 到末尾标记完成
│   └── T1-N5e: getCompletedCoreStepCount 统计
├── T1-N6: 序列化/反序列化
│   ├── T1-N6a: serialize 包含完整数据
│   └── T1-N6b: loadSaveData 恢复所有字段
├── T1-N7: 冲突解决 (#9)
│   ├── T1-N7a: completedSteps 并集
│   ├── T1-N7b: completedEvents 并集
│   ├── T1-N7c: 取更高阶段
│   └── T1-N7d: tutorialStartTime 取非null
├── T1-N8: 新手保护 (#18)
│   ├── T1-N8a: first_enter 后保护激活
│   ├── T1-N8b: enterAsReturning 不激活保护
│   └── T1-N8c: update() 检测保护过期
└── T1-N9: reset
    └── 恢复到初始状态
```

## T2: TutorialStepManager — 步骤管理 (#2-4)

```
T2-ROOT: TutorialStepManager
├── T2-N1: getNextStep
│   ├── T2-N1a: 无状态机 → null
│   ├── T2-N1b: 返回第一个未完成核心步骤
│   ├── T2-N1c: 前置步骤未完成 → 跳过
│   └── T2-N1d: 核心全完成 → 返回扩展步骤
├── T2-N2: startStep
│   ├── T2-N2a: 无状态机 → FAIL
│   ├── T2-N2b: 不存在的步骤 → FAIL
│   ├── T2-N2c: 前置步骤未完成 → FAIL
│   ├── T2-N2d: 已完成步骤(非重玩) → FAIL
│   └── T2-N2e: 正常启动 → SUCCESS
├── T2-N3: advanceSubStep
│   ├── T2-N3a: 无活跃步骤 → 空结果
│   ├── T2-N3b: 未到最后子步骤 → 推进
│   └── T2-N3c: 到最后子步骤 → completeCurrentStep
├── T2-N4: completeCurrentStep
│   ├── T2-N4a: 记录完成到状态机
│   ├── T2-N4b: 发放步骤奖励
│   ├── T2-N4c: 发放阶段奖励(如有)
│   └── T2-N4d: 清理活跃步骤状态
├── T2-N5: 超时降级
│   ├── T2-N5a: 30s超时 → 自动advanceSubStep
│   └── T2-N5b: 超时事件发射
└── T2-N6: 重玩委托
    ├── T2-N6a: startReplay 委托 executor
    └── T2-N6b: endReplay 委托 executor
```

## T3: TutorialStepExecutor — 执行器 (#10,11,13,7)

```
T3-ROOT: TutorialStepExecutor
├── T3-N1: 加速机制 (#10)
│   ├── T3-N1a: 无活跃步骤 → FAIL
│   ├── T3-N1b: 不可跳过步骤 + story_skip → FAIL
│   ├── T3-N1c: 不可跳过步骤 + quick_complete → FAIL
│   ├── T3-N1d: 不可跳过步骤 + dialogue_tap → SUCCESS
│   ├── T3-N1e: 不可跳过步骤 + animation_speed → SUCCESS
│   └── T3-N1f: 正常加速 → SUCCESS + emit
├── T3-N2: 不可跳过 (#11)
│   ├── T3-N2a: step1/step2/step4 不可跳过
│   └── T3-N2b: 子步骤 unskippable 检测
├── T3-N3: 重玩 (#13)
│   ├── T3-N3a: startReplay 成功
│   ├── T3-N3b: 超过每日限制 → FAIL
│   ├── T3-N3c: 日期切换重置计数
│   ├── T3-N3d: endReplay 发放奖励
│   └── T3-N3e: getRemainingReplayCount 计算
└── T3-N4: 触发检测 (#7)
    ├── T3-N4a: building_level 条件
    ├── T3-N4b: hero_count 条件
    ├── T3-N4c: battle_count 条件
    ├── T3-N4d: alliance_joined 条件
    ├── T3-N4e: bag_capacity 条件
    └── T3-N4f: 已完成步骤不触发
```

## T4: StoryEventPlayer — 剧情播放 (#5,6,12)

```
T4-ROOT: StoryEventPlayer
├── T4-N1: startEvent
│   ├── T4-N1a: 不存在的eventId → FAIL
│   ├── T4-N1b: 已有剧情播放中 → FAIL
│   └── T4-N1c: 正常启动 → SUCCESS
├── T4-N2: tap 推进 (#6)
│   ├── T4-N2a: 非播放状态 → complete
│   ├── T4-N2b: 行未完成 → reveal_line
│   ├── T4-N2c: 行完成+还有下一行 → next_line
│   └── T4-N2d: 最后一行完成 → complete
├── T4-N3: 打字机效果 (#6)
│   ├── T4-N3a: 正常速度推进字符
│   ├── T4-N3b: 加速模式(3x)
│   └── T4-N3c: 行完成后 lineComplete=true
├── T4-N4: 自动播放 (#6)
│   ├── T4-N4a: 5秒后自动推进
│   └── T4-N4b: 行未完成不触发
├── T4-N5: 跳过机制 (#12)
│   ├── T4-N5a: requestSkip → requireConfirm=true
│   ├── T4-N5b: confirmSkip → ink_wash + rewards
│   ├── T4-N5c: cancelSkip → 清除确认状态
│   └── T4-N5d: 未请求直接confirm → FAIL
├── T4-N6: 暂停/恢复
│   ├── T4-N6a: pause → paused
│   └── T4-N6b: resume → playing
└── T4-N7: 触发检测 (#7)
    ├── T4-N7a: checkTriggerConditions 遍历
    └── T4-N7b: checkStepTrigger 匹配
```

## T5: TutorialStorage — 存储 (#8,9,17)

```
T5-ROOT: TutorialStorage
├── T5-N1: save/load
│   ├── T5-N1a: save 序列化到存储
│   ├── T5-N1b: load 解析存档
│   ├── T5-N1c: load 无数据 → success+undefined
│   └── T5-N1d: load 格式无效 → FAIL
├── T5-N2: restore 断点续引
│   ├── T5-N2a: 有数据 → loadSaveData
│   └── T5-N2b: 无数据 → 不恢复
├── T5-N3: 内存回退
│   ├── T5-N3a: localStorage不可用 → 内存回退
│   └── T5-N3b: 运行时降级
├── T5-N4: 冲突解决
│   ├── T5-N4a: mergeRemoteData
│   └── T5-N4b: resolveConflict 委托状态机
├── T5-N5: 重置
│   ├── T5-N5a: fullReset 清除存储+状态机
│   └── T5-N5b: resetStepsOnly 保留部分
├── T5-N6: 首次启动标记
│   ├── T5-N6a: detectFirstLaunch
│   ├── T5-N6b: markLaunched
│   └── T5-N6c: clearLaunchMark
└── T5-N7: 查询
    ├── T5-N7a: hasSaveData
    └── T5-N7b: getSaveDataSize
```

## T6: TutorialMaskSystem — 遮罩 (#15,16)

```
T6-ROOT: TutorialMaskSystem
├── T6-N1: activate/deactivate
│   ├── T6-N1a: activate 设置active=true
│   ├── T6-N1b: deactivate 清除所有状态
│   └── T6-N1c: activateAsBackup 检查GuideOverlay
├── T6-N2: 高亮目标
│   ├── T6-N2a: 未激活时setHighlightTarget → FAIL
│   ├── T6-N2b: boundsProvider返回null → FAIL
│   ├── T6-N2c: 正常设置+padding应用
│   └── T6-N2d: clearHighlightTarget
├── T6-N3: 气泡控制
│   ├── T6-N3a: showBubble
│   ├── T6-N3b: hideBubble
│   └── T6-N3c: setupForSubStep
├── T6-N4: 渲染数据
│   ├── T6-N4a: getRenderData 完整数据
│   ├── T6-N4b: 简化模式(重玩)
│   ├── T6-N4c: 自动定位(bottom/top/right)
│   └── T6-N4d: 手指动画目标计算
└── T6-N5: 简化模式
    └── setSimplifiedMode(opacity=0.5, noHandAnim)
```

## T7: FirstLaunchDetector — 首次启动 (#17,18)

```
T7-ROOT: FirstLaunchDetector
├── T7-N1: detectFirstLaunch
│   ├── T7-N1a: 首次 → isFirstLaunch=true
│   └── T7-N1b: 非首次 → isFirstLaunch=false
├── T7-N2: executeFirstLaunchFlow
│   ├── T7-N2a: 非首次 → skipped
│   ├── T7-N2b: 首次完整流程(4步)
│   └── T7-N2c: 无权限回调 → 默认授权
├── T7-N3: handleReturningUser
│   └── enterAsReturning + skipped
├── T7-N4: 画质检测
│   ├── T7-N4a: high (8核+8GB)
│   ├── T7-N4b: medium (4核+4GB)
│   └── T7-N4c: low (2核+2GB)
├── T7-N5: 新手保护 (#18)
│   ├── T7-N5a: getProtectionState
│   ├── T7-N5b: getResourceCostDiscount
│   ├── T7-N5c: getBattleDifficultyFactor
│   ├── T7-N5d: isPositiveEventsOnly
│   ├── T7-N5e: applyResourceDiscount
│   └── T7-N5f: applyBattleDifficulty
└── T7-N6: 语言检测
    └── 使用注入的 languageDetector
```

## 维度覆盖矩阵

| 树 | F-Normal | F-Boundary | F-Error | F-Cross | F-Lifecycle |
|----|----------|------------|---------|---------|-------------|
| T1 | N2,N4,N5 | N8 | N3 | N7 | N6,N9 |
| T2 | N1,N2,N3,N4 | N5 | N2a-c | N6 | — |
| T3 | N1,N3 | N2 | N1a | N4 | N3 |
| T4 | N1,N2,N3,N4 | — | N1a,N5d | N7 | N6 |
| T5 | N1,N2 | N3 | N1d | N4 | N5,N6 |
| T6 | N1,N2,N3 | N5 | N2a,N2b | — | — |
| T7 | N1,N2,N3,N4 | N4 | — | N5 | — |

**节点总数**: 118 | **维度覆盖**: 5/5
