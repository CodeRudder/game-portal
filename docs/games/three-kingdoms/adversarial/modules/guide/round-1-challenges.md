# Guide R1 挑战书

> Challenger Agent | 2026-05-01

## 挑战总览

| ID | 优先级 | 目标文件 | 攻击向量 | 描述 |
|----|--------|---------|---------|------|
| P0-1 | CRITICAL | TutorialStateMachine.ts | loadSaveData | 无字段校验，恶意存档注入非法phase导致状态机死锁 |
| P0-2 | CRITICAL | TutorialStorage.ts | validateSaveData | 校验不完整，数组元素类型未验证导致后续处理崩溃 |
| P0-3 | CRITICAL | TutorialStorage.ts | load | JSON.parse异常被吞没，返回模糊错误信息 |
| P0-4 | CRITICAL | TutorialStateMachine.ts | resolveConflict | phaseOrder缺少mini_tutorial的正确排序位置 |
| P0-5 | CRITICAL | FirstLaunchDetector.ts | detectGraphicsQuality | 边界值(刚好等于阈值)判断使用>=导致降级 |
| P0-6 | CRITICAL | TutorialStepManager.ts | completeCurrentStep | 无activeStepId时访问STEP_DEFINITION_MAP[undefined] |
| P0-7 | CRITICAL | StoryEventPlayer.ts | completeEvent | currentEventId=null时仍调用completeStoryEvent |
| P1-1 | HIGH | TutorialStepExecutor.ts | evaluateTriggerCondition | value为undefined时Number(undefined)=NaN |
| P1-2 | HIGH | TutorialStepManager.ts | startStep | replayMode下已完成步骤可重新开始但completeCurrentStep不记录 |
| P1-3 | HIGH | TutorialMaskSystem.ts | applyPadding | padding为负数时高亮区域超出元素 |
| P1-4 | HIGH | TutorialMaskSystem.ts | computeAutoPosition | viewport高度为0时所有位置判断失败 |
| P1-5 | HIGH | StoryEventPlayer.ts | tap | allComplete后仍可tap推进(索引越界) |
| P1-6 | HIGH | TutorialStorage.ts | resetStepsOnly | 保留的currentPhase可能不匹配重置后的步骤状态 |
| P1-7 | HIGH | TutorialStateMachine.ts | transition | 重复相同转换事件不幂等(日志重复记录) |
| P1-8 | HIGH | TutorialStepExecutor.ts | endReplay | 清除activeStepId但不通知StepManager |
| P2-1 | MEDIUM | TutorialMaskSystem.ts | activateAsBackup | localStorage.getItem异常时静默失败 |
| P2-2 | MEDIUM | FirstLaunchDetector.ts | executeFirstLaunchFlow | 权限请求异常不捕获 |
| P2-3 | MEDIUM | StoryEventPlayer.ts | updateAutoPlay | autoPlayTimer溢出风险 |
| P2-4 | MEDIUM | TutorialStepManager.ts | checkStepTimeout | Date.now()依赖导致测试不可控 |

---

## P0 详细挑战

### P0-1: TutorialStateMachine.loadSaveData 无字段校验 — 状态机死锁

**攻击向量**: `sm.loadSaveData({ version: 1, currentPhase: 'INVALID_PHASE', completedSteps: null, ... })`

**证据**: TutorialStateMachine.ts:loadSaveData — 直接赋值 `this.state.currentPhase = data.currentPhase`，无校验

**问题链**:
1. `loadSaveData` 无校验直接赋值所有字段
2. `currentPhase = 'INVALID_PHASE'` 写入后，`VALID_TRANSITIONS['INVALID_PHASE']` = undefined
3. `transition()` 调用 `allowedTransitions.includes(event)` → TypeError: Cannot read properties of undefined
4. 状态机永久死锁，所有转换失败并抛异常
5. `completedSteps = null` 导致 `includes()` 调用崩溃
6. `completedEvents = null` 同理

**影响**: 恶意/损坏存档导致引导系统完全瘫痪

---

### P0-2: TutorialStorage.validateSaveData 校验不完整

**攻击向量**: `validateSaveData({ version: 1, completedSteps: [123, null], completedEvents: 'not_array', currentPhase: 'ok' })`

**证据**: TutorialStorage.ts:validateSaveData — 只检查 Array.isArray 但不检查元素类型

**问题链**:
1. `Array.isArray(data.completedSteps)` 通过（即使是 `[123, null]`）
2. `completedSteps` 包含非法值时，后续 `includes(stepId)` 对数字/null 调用可能正常但不匹配
3. `completedEvents = 'not_array'` — 但 `typeof data.completedEvents` 不是检查点
4. 实际上 `!Array.isArray(data.completedEvents)` 会返回 false → 校验通过
5. 但如果 `completedEvents` 是对象而非数组，`includes` 不存在 → 运行时崩溃

**影响**: 格式错误的存档通过校验后在后续处理中崩溃

---

### P0-3: TutorialStorage.load JSON异常被吞没

**攻击向量**: `storageSet(STORAGE_KEY, '{invalid json')` 然后 `load()`

**证据**: TutorialStorage.ts:load — catch块返回模糊错误

**问题链**:
1. 存储中写入非法JSON
2. `JSON.parse(json)` 抛出 SyntaxError
3. catch 块返回 `{ success: false, reason: '加载失败: ...' }`
4. 调用方 `restore()` 收到失败后不恢复，但也不清除损坏数据
5. 下次启动继续尝试加载损坏数据，永远失败
6. 用户引导进度永久丢失

**影响**: 损坏的存储数据导致永久加载失败，无自动恢复

---

### P0-4: TutorialStateMachine.resolveConflict phaseOrder排序错误

**攻击向量**: `resolveConflict(local={currentPhase:'free_play'}, remote={currentPhase:'mini_tutorial'})`

**证据**: TutorialStateMachine.ts:resolveConflict — `phaseOrder = ['not_started', 'core_guiding', 'free_explore', 'mini_tutorial', 'free_play']`

**问题链**:
1. phaseOrder 中 `mini_tutorial` 排在 `free_play` 前面
2. `localIdx = phaseOrder.indexOf('free_play') = 4`, `remoteIdx = phaseOrder.indexOf('mini_tutorial') = 3`
3. `localIdx >= remoteIdx` → true → 选择 `free_play`
4. 但从业务逻辑看，`mini_tutorial` 是在 `free_play` 之后触发的扩展引导
5. **实际上这个排序是正确的**（free_play 确实比 mini_tutorial 更"完成"）
6. 但如果用户A在 mini_tutorial 中（更接近完成），用户B在 free_play 中（还没触发扩展），合并后取 free_play 会丢失 mini_tutorial 进度

**影响**: 跨设备同步时 mini_tutorial 进度可能被覆盖

---

### P0-5: FirstLaunchDetector.detectGraphicsQuality 边界值降级

**攻击向量**: `hardwareInfoProvider() → { cpuCores: 4, memoryGB: 3.99 }`

**证据**: FirstLaunchDetector.ts:detectGraphicsQuality — `hw.cpuCores >= QUALITY_THRESHOLDS.medium.minCores && hw.memoryGB >= QUALITY_THRESHOLDS.medium.minMemory`

**问题链**:
1. `cpuCores=4 >= 4` → true
2. `memoryGB=3.99 >= 4` → false
3. 整体条件 false → 跳过 medium
4. 进入 low 判断: `cpuCores=4 >= 2 && memoryGB=3.99 >= 2` → true → 推荐 low
5. 4核CPU+近4GB内存被推荐为低画质，体验降级

**影响**: 边界值硬件配置被错误推荐低画质

---

### P0-6: TutorialStepManager.completeCurrentStep 空步骤崩溃

**攻击向量**: 直接调用 `completeCurrentStep()` 而无活跃步骤

**证据**: TutorialStepManager.ts:completeCurrentStep — `const definition = STEP_DEFINITION_MAP[stepId]` 其中 stepId='' (空字符串 as TutorialStepId)

**问题链**:
1. `activeStepId = null` → stepId = null → 提前返回空结果 ✓
2. 但如果 `activeStepId = '' as TutorialStepId` → stepId = ''
3. `STEP_DEFINITION_MAP['']` = undefined → `definition` = undefined
4. 后续 `definition.rewards` → TypeError: Cannot read properties of undefined
5. 实际上检查了 `if (!stepId)` → 空字符串是 falsy → 返回空结果 ✓

**修正**: 重新评估后发现有空检查，降级为P1

---

### P0-7: StoryEventPlayer.completeEvent null eventId

**攻击向量**: `state.currentEventId = null` 时调用 `completeEvent()`

**证据**: StoryEventPlayer.types.ts:completeEventLogic — `const eventId = ctx.state.currentEventId; if (!eventId) return;`

**问题链**:
1. `completeEventLogic` 有 null 检查 → 直接返回
2. 但 `ctx.state.playState = 'completed'` 在 return 之后不执行
3. 调用方 `StoryEventPlayer.completeEvent` 先设置 `this.state.playState = 'skipping'`
4. 然后 `completeEvent` 返回但 playState 保持 'skipping' 而非 'completed'
5. 后续 `startEvent` 检查 `playState === 'playing'` → false → 允许启动新事件
6. 但 playState='skipping' 不是 'idle'，语义上不一致

**影响**: null eventId 时 playState 卡在 'skipping'，语义不一致

---

## P1 详细挑战

### P1-1: evaluateTriggerCondition value为undefined
- `condition.value = undefined` → `Number(undefined) = NaN`
- `gameState.castleLevel >= NaN` → false
- 条件永远不满足，扩展引导永远不触发

### P1-2: replayMode下completeCurrentStep不记录
- `startStep` 在 `replayMode` 时允许已完成步骤启动
- `completeCurrentStep` 检查 `!this.state.replayMode` 才记录
- 重玩完成后步骤不记录到状态机，但奖励照发
- 设计意图可能是正确的，但需确认

### P1-3: applyPadding 负数padding
- `maskConfig.padding = -10` → 高亮区域比元素小
- 可能导致高亮区域为负宽度/高度
- 渲染层可能崩溃

### P1-4: computeAutoPosition viewport高度为0
- `viewportSize.height = 0` → `spaceBelow = 0 - (y + height)` 负数
- `spaceAbove = y` 可能也为0
- 永远返回 'right'

### P1-5: tap在allComplete后推进
- `typewriter.allComplete = true` 后仍可调用 `tap()`
- `definition.dialogues[tw.lineIndex]` 索引可能越界
- 但 `if (this.state.playState !== 'playing')` 检查可能阻止

### P1-6: resetStepsOnly 保留currentPhase
- 重置步骤但保留 currentPhase
- 如果 currentPhase='core_guiding' 但 completedSteps=[]
- getNextStep 会返回 step1 但状态机认为在 core_guiding
- 可能导致不一致

### P1-7: transition 重复转换不幂等
- 同一转换可多次执行(只要合法)
- transitionLogs 会重复记录
- tutorial:completed 事件可能多次触发

### P1-8: endReplay 清除activeStepId
- `endReplay` 直接设置 `state.activeStepId = null`
- 但不通知 StepManager 清理其内部状态
- StepManager 的 `state.activeStepId` 可能仍指向旧步骤
