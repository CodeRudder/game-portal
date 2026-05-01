# Tutorial R2 — Builder 测试树（精简）

> Builder: agent | 日期: 2026-05-01
> 基于 R1 修复后源码精简，标注 R1 已覆盖（✅）和 R2 新增/深化（🆕）

## 精简原则

- R1 已修复的 P0/P1 路径标记 ✅，不再重复展开
- 保留验证修复穿透的回归节点（叶节点级别）
- 新增 R1 verdict 建议维度：版本迁移、奖励防重、双引导交互
- 精简后节点数 ≤ 30（R1 为 42）

---

## T1: 初始化流程 [3 节点]

| ID | 路径 | 状态 | 备注 |
|----|------|------|------|
| T1-1 | new TutorialSystem() → 初始状态正确 | ✅ R1 | completedSteps=[], skipped=false |
| T1-2 | init(deps) → deps 绑定 | ✅ R1 | |
| T1-3 | init(deps) 多次调用 → 幂等 | ✅ R1 | |

## T2: 步骤推进（Normal Flow）[4 节点]

| ID | 路径 | 状态 | 备注 |
|----|------|------|------|
| T2-1 | completeCurrentStep('claim_newbie_pack') → 成功 | ✅ R1 | 步骤1 |
| T2-2 | completeCurrentStep('first_recruit') → 成功 | ✅ R1 | 步骤2 |
| T2-3 | completeCurrentStep('view_hero') → 成功 | ✅ R1 | 步骤3 |
| T2-4 | completeCurrentStep('add_to_formation') → 成功 + 引导完成事件 | ✅ R1 | 步骤4 |

## T3: 步骤推进（Boundary/Error）[5 节点]

| ID | 路径 | 状态 | 备注 |
|----|------|------|------|
| T3-1 | action 不匹配当前步骤 → 失败 | ✅ R1 | |
| T3-2 | 引导完成后 completeCurrentStep → 失败 | ✅ R1 | |
| T3-3 | 跳过后 completeCurrentStep → 失败 | ✅ R1 | |
| T3-4 | init 前调用 completeCurrentStep → 安全返回 | ✅ R1 FIX-T03 | 回归验证 |
| T3-5 | 乱序完成（跳过步骤1直接完成步骤2）→ 失败 | ✅ R1 | |

## T4: 跳过流程 [3 节点]

| ID | 路径 | 状态 | 备注 |
|----|------|------|------|
| T4-1 | skipTutorial() → skipped=true + emit | ✅ R1 | |
| T4-2 | 重复 skipTutorial() → 无二次 emit | ✅ R1 FIX-T06 | 回归验证 |
| T4-3 | 引导完成后 skipTutorial() → 无操作 | ✅ R1 | |

## T5: 序列化/反序列化 [6 节点]

| ID | 路径 | 状态 | 备注 |
|----|------|------|------|
| T5-1 | serialize() 包含全部字段 | ✅ R1 FIX-T01 | version, completedSteps, skipped, stepCompletionTimes, startedAt |
| T5-2 | loadSaveData(null) → 安全初始化 | ✅ R1 FIX-T02 | 回归验证 |
| T5-3 | loadSaveData(含非法stepId) → 过滤 | ✅ R1 FIX-T05 | |
| T5-4 | loadSaveData(旧存档无stepCompletionTimes) → 默认{} | ✅ R1 FIX-T01 | |
| T5-5 | serialize → loadSaveData 往返一致性 | ✅ R1 | |
| T5-6 | 🆕 loadSaveData(version不匹配) → 降级处理 | **R2 新增** | R1 verdict 建议版本迁移 |

## T6: engine-save 集成 [4 节点]

| ID | 路径 | 状态 | 备注 |
|----|------|------|------|
| T6-1 | buildSaveCtx() 包含 tutorialGuide | ✅ R1 FIX-T04 | 回归验证 |
| T6-2 | buildSaveData() 序列化 tutorialGuide | ✅ R1 FIX-T04 | |
| T6-3 | applySaveData() 反序列化 tutorialGuide | ✅ R1 FIX-T04 | |
| T6-4 | 🆕 engine-save 全链路：save → load → tutorial状态一致 | **R2 新增** | 端到端验证 |

## T7: 查询 API [3 节点]

| ID | 路径 | 状态 | 备注 |
|----|------|------|------|
| T7-1 | getCurrentStep() → 首次调用记录 startedAt | ✅ R1 | |
| T7-2 | getProgress() → 百分比计算正确 | ✅ R1 | |
| T7-3 | getTutorialStats() → avgCompletionTimeMs 计算 | ✅ R1 | |

## T8: 奖励与事件 [2 节点]

| ID | 路径 | 状态 | 备注 |
|----|------|------|------|
| T8-1 | 步骤1完成 → rewards 包含 recruitToken+100, copper+5000, skillBook+1 | ✅ R1 | |
| T8-2 | 🆕 存档丢失后重新 loadSaveData → completeCurrentStep 不重复发奖 | **R2 新增** | R1 verdict 建议奖励防重 |

---

## 统计

| 类别 | 数量 |
|------|------|
| ✅ R1 回归验证 | 24 |
| 🆕 R2 新增 | 4 |
| **总节点** | **28** |

## R2 新增节点说明

1. **T5-6 版本迁移**: `loadSaveData` 当前无 version 检查。若未来 version 升级，旧存档需降级处理。验证当前 version=1 的行为。
2. **T6-4 全链路**: 验证 engine-save 的 save→序列化→反序列化→apply 全链路 tutorial 数据不丢失。
3. **T8-2 奖励防重**: 验证 completedSteps 已包含某 stepId 时，completeCurrentStep 不会再次返回该步骤的 rewards。

## 精简效果

- R1 节点数: 42 → R2 节点数: 28（精简 33%）
- 移除: 重复的边界条件展开、已验证的 P0 路径的中间节点
- 新增: 4 个 R1 verdict 建议的深化维度
