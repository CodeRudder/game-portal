# v18.0 新手引导 — Play 文档 (Round 2)

> 版本: v18.0 新手引导 | 引擎域: engine/guide/(7子系统)
> 日期: 2025-07-23 | 轮次: Round 2

## P1: 首次启动 → 语言检测 → 画质推荐 → E1桃园结义 → Step1主城概览

```
1. TutorialStorage.detectFirstLaunch()
   → FIRST_LAUNCH_KEY=null → isFirstLaunch=true
2. FirstLaunchDetector.startFlow()
   → step='detect_language' → 'zh-CN'
   → step='detect_quality' → DeviceHardwareInfo{cpuCores:8, memoryGB:16} → 'high'
   → step='request_permissions' → [storage,network,notification]
   → step='ready' → markLaunched()
3. TutorialStateMachine.transition('first_enter')
   → not_started → core_guiding
   → tutorialStartTime=Date.now(), protectionStartTime=Date.now()
4. StoryEventPlayer.startEvent('e1_peach_garden')
   → 打字机30ms/字 → tap()跳过打字 → tap()推进下一行
   → 5秒无操作 → updateAutoPlay()自动推进
   → completeEvent(false) → completedEvents=['e1_peach_garden']
5. TutorialStepManager.startStep('step1_castle_overview')
   → subSteps[0] = '介绍主界面布局' → advanceSubStep() × 5
   → completeCurrentStep() → reward=[铜钱×500]
```
**验证**: 首次启动5步流程完整, 新手保护**30分钟**启动

## P2: 6步核心引导 → 步骤推进 → 阶段奖励 → 自由探索过渡

```
1. Step2建造农田: startStep('step2_build_farm')
   → subSteps[0..4] → completeStep → reward=[粮草×300]
2. Step3招募武将: startStep('step3_recruit_hero')
   → completeStep → StoryEventPlayer.checkStepTrigger('step3') → E2黄巾之乱触发
3. Step4首次出征: isUnskippable('step4_first_battle') → **true, 不可跳过**
   → activateAcceleration('quick_complete') → **失败, 不可跳过步骤**
   → advanceSubStep() × 5 → completeCurrentStep()
4. Step5查看资源 → Step6科技研究
   → completeCurrentStep() → TUTORIAL_PHASE_REWARDS匹配
   → reward=[铜钱×2000, 粮草×1000, 招贤榜×1] 「初出茅庐」礼包
5. TutorialStateMachine.transition('step6_complete')
   → core_guiding → free_explore
   → getFreeExploreData() → recommendedActions(3项) + unlockedFeatures(5项)
```
**验证**: 6步完成 → 阶段奖励**正确发放** → 自由探索**3个推荐行动**

## P3: 剧情跳过 → 二次确认 → 水墨晕染 → 奖励不受影响

```
1. StoryEventPlayer.startEvent('e4_borrow_arrows')
   → playState='playing', typewriter={lineIndex:0, charIndex:0}
2. requestSkip() → requireConfirm=true, skipConfirmPending=true
3. confirmSkip()
   → transitionEffect='ink_wash'
   → completeEvent(skipped=true) → rewards=[...] **跳过不影响奖励**
   → playState='completed'
4. TutorialStateMachine.isStoryEventCompleted('e4_borrow_arrows') → true
```
**验证**: 跳过后奖励**完整保留**, 水墨晕染过渡**触发**

## P4: 跨设备冲突解决 → 取并集最大进度 → 存档恢复

```
1. 本地: completedSteps=[step1,step2,step3], currentPhase='core_guiding'
   远程: completedSteps=[step1,step2,step4], currentPhase='core_guiding'
2. TutorialStorage.resolveConflict(local, remote)
   → TutorialStateMachine.resolveConflict()
   → mergedSteps = Set([step1,step2,step3,step4]) — **取并集**
   → phaseOrder: core_guiding vs core_guiding → 保持
3. mergeRemoteData(remote) → loadSaveData(merged) → save()
4. TutorialStorage.load() → validateSaveData() → 恢复成功
```
**验证**: 冲突解决 → **4步并集**, 进度**不丢失**

## P5: 引导重玩 → 观看模式 → 每日3次限制 → 铜钱×100奖励

```
1. TutorialStepManager.startReplay('watch')
   → dailyReplayCount=0 < GUIDE_REPLAY_DAILY_LIMIT(3) → success
   → replayMode='watch', dailyReplayCount=1
2. startStep('step1_castle_overview') → 观看模式不影响进度
   → completeCurrentStep() → **不调用completeStep**(replayMode)
3. endReplay() → reward=GUIDE_REPLAY_REWARD(铜钱×100)
4. getRemainingReplayCount() → 3-1=**2次剩余**
5. 连续重玩3次后: startReplay() → **失败, 今日次数已达上限**
```
**验证**: 每日3次限制**生效**, 观看模式**不影响正式进度**

---

## 交叉验证矩阵

| 流程 | StateMachine | StepManager | StepExecutor | StoryPlayer | Storage | MaskSystem | FirstLaunch |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| P1   | ✅ | ✅ | — | ✅ | ✅ | — | ✅ |
| P2   | ✅ | ✅ | ✅ | ✅ | — | ✅ | — |
| P3   | ✅ | — | — | ✅ | — | — | — |
| P4   | ✅ | — | — | — | ✅ | — | — |
| P5   | — | ✅ | ✅ | — | — | — | — |
