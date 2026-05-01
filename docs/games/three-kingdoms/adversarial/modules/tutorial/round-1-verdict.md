# Tutorial R1 — Arbiter 裁决报告

> Arbiter: agent | 日期: 2026-05-01
> 裁决对象: Builder `round-1-tree.md` + Challenger `round-1-challenges.md`

## 裁决总览

| 指标 | 值 |
|------|-----|
| Builder 节点总数 | 42 |
| Challenger P0 数量 | 5 |
| Challenger P1 数量 | 3 |
| 裁决确认 P0 | 5 |
| 裁决确认 P1 | 2 |
| 裁决驳回 P1 | 1 |
| 要求修复 | 5 P0 + 2 P1 |

## P0 裁决（逐项）

### P0-1: serialize() 丢失 stepCompletionTimes 和 startedAt — ✅ 确认

**Builder**: FS-01, FS-02  
**Challenger**: P0-1  
**裁决**: 确认。`TutorialGuideSaveData` 接口和 `serialize()` 方法均不包含 `stepCompletionTimes` 和 `startedAt`，数据丢失是事实。  
**修复要求**: 扩展 `TutorialGuideSaveData` 接口，serialize() 保存这两个字段。

### P0-2: loadSaveData() 无null防护 — ✅ 确认

**Builder**: FE-01, FE-02  
**Challenger**: P0-2  
**裁决**: 确认。`loadSaveData(null)` 和 `loadSaveData({completedSteps: undefined})` 均会崩溃。  
**修复要求**: loadSaveData 入口添加 null/undefined 防护。

### P0-3: completeCurrentStep() 在 init() 前调用崩溃 — ✅ 确认

**Builder**: FE-04  
**Challenger**: P0-3  
**裁决**: 确认。`this.deps!` 非空断言不提供运行时保护。  
**修复要求**: completeCurrentStep 入口添加 `this.deps` 存在性检查，或在使用前安全访问。

### P0-4: TutorialSystem 未接入 engine-save 系统 — ✅ 确认

**Builder**: FC-01, FC-02, FS-04  
**Challenger**: P0-4  
**裁决**: 确认。这是本轮最严重的系统性缺陷。`buildSaveCtx()` 不包含 `tutorialGuide`，`engine-save.ts` 中零 `tutorial` 引用。  
**修复要求**: 
1. `buildSaveCtx()` 添加 `tutorialGuide: this.tutorialGuide`
2. `SaveContext` 类型添加 `tutorialGuide` 字段
3. `buildSaveData()` 添加 tutorial 序列化
4. `applyLoadedState()` 添加 tutorial 反序列化

### P0-5: loadSaveData 不恢复 stepCompletionTimes 和 startedAt — ✅ 确认

**Builder**: FS-03  
**Challenger**: P0-5  
**裁决**: 确认。即使 serialize 保存了这两个字段，loadSaveData 也不恢复。需与 P0-1 一并修复。  
**修复要求**: loadSaveData 恢复 stepCompletionTimes 和 startedAt，缺失时使用安全默认值。

## P1 裁决（逐项）

### P1-1: loadSaveData 不验证 completedSteps 内容 — ✅ 确认

**裁决**: 确认。恶意存档可注入无效 stepId 导致 `isTutorialComplete()` 误判。  
**修复要求**: loadSaveData 过滤无效 stepId。

### P1-2: skipTutorial() 无防重复emit — ⚠️ 部分驳回

**裁决**: 部分确认。分析代码后发现：
- 首次调用 `skipTutorial()`: `skipped=false` → `isTutorialComplete()=false` → 设置 `skipped=true` → emit
- 再次调用: `skipped=true` → `isTutorialComplete()=false` → 设置 `skipped=true`(已设) → **再次emit**

确实存在重复 emit 问题，但严重度降为 P2，因为跳过是低频操作，重复 emit 影响有限。  
**修复要求**: 添加 `if (this.state.skipped) return;` 前置检查。

### P1-3: 双引导系统并存无交互 — ✅ 确认但不修复

**裁决**: 确认事实。但这是架构设计问题，不在 R1 修复范围内。记录为技术债务。  
**修复要求**: 无（记录到 R2 待办）。

## 修复清单

| FIX ID | P0/P1 | 修复内容 | 文件 |
|--------|--------|----------|------|
| FIX-T01 | P0-1/P0-5 | 扩展 TutorialGuideSaveData + serialize + loadSaveData | tutorial-config.ts, tutorial-system.ts |
| FIX-T02 | P0-2 | loadSaveData null/undefined 防护 | tutorial-system.ts |
| FIX-T03 | P0-3 | completeCurrentStep init 前防护 | tutorial-system.ts |
| FIX-T04 | P0-4 | TutorialSystem 接入 engine-save | ThreeKingdomsEngine.ts, engine-save.ts |
| FIX-T05 | P1-1 | loadSaveData 过滤无效 stepId | tutorial-system.ts |
| FIX-T06 | P1-2 | skipTutorial 防重复 emit | tutorial-system.ts |

## 评分

| 维度 | 分数 | 说明 |
|------|------|------|
| Builder 覆盖率 | 8.5/10 | Normal/Boundary 充分，Error/Serialize 发现关键问题 |
| Challenger 深度 | 9/10 | P0-4 发现存档系统级遗漏，P0-1/P0-5 完整追踪数据流 |
| 总体评分 | **B+** | 5个P0全部确认，Tutorial模块存在系统性存档遗漏 |

## R2 建议

1. P1-3 双引导系统交互问题
2. 版本迁移（loadSaveData version检查）
3. 引导奖励重复领取防护（completeCurrentStep 第1步有奖励，存档丢失后可能重复）
