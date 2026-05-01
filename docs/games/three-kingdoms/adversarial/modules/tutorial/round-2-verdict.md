# Tutorial R2 — Arbiter 裁决报告（封版判定）

> Arbiter: agent | 日期: 2026-05-02
> 裁决对象: Builder `round-2-tree.md` + Challenger `round-2-challenges.md`
> 裁决性质: **封版轮次**

## 裁决总览

| 指标 | R1 | R2 |
|------|-----|-----|
| Builder 节点总数 | 42 | 36 |
| Challenger P0 数量 | 5 | 0 |
| Challenger P1 数量 | 3 | 3 |
| Challenger P2 数量 | 0 | 3 |
| 裁决确认 P0 | 5 | 0 |
| 裁决确认 P1 | 2 | 2 |
| 裁决确认 P2 | — | 2 |
| 裁决驳回 | 1 | 1 |
| 要求修复 | 5P0+2P1 | 0P0+2P1 |

## R1 修复穿透评估

| FIX ID | 穿透状态 | 回归风险 |
|--------|----------|----------|
| FIX-601 null防护 | ✅ 完整 | 无 |
| FIX-602 ID校验 | ✅ 完整 | 无 |
| FIX-603 times/startedAt恢复 | ✅ 完整 | 无 |
| FIX-604 serialize输出 | ✅ 完整 | 无 |
| FIX-T03 deps检查 | ✅ 完整 | 无 |
| FIX-T04 engine-save接入 | ✅ 完整 | 无 |
| FIX-T06 skip防重复 | ✅ 完整 | 无 |

**穿透评分: 10/10** — 零回归。

## R2 P1 裁决（逐项）

### R2-P1-1: stepCompletionTimes 值类型未校验 — ✅ 确认

**Builder**: FD-01  
**Challenger**: R2-P1-1  
**裁决**: 确认。`typeof data.stepCompletionTimes === 'object'` 不验证值的类型。恶意存档注入字符串值会导致 `getTutorialStats()` 返回 NaN。  
**修复要求**: loadSaveData 中 `stepCompletionTimes` 值增加 `typeof v === 'number' && Number.isFinite(v)` 过滤。  
**封版判定**: **不阻塞封版**。影响统计展示，不影响核心引导流程。记录为 R3 待办。

### R2-P1-2: startedAt 值合理性未校验 — ✅ 确认

**Builder**: FD-02  
**Challenger**: R2-P1-2  
**裁决**: 确认。与 P1-1 同类问题。`startedAt` 可被注入非数字值。  
**修复要求**: loadSaveData 中 `startedAt` 增加 `typeof === 'number' && Number.isFinite(v) && v > 0` 检查。  
**封版判定**: **不阻塞封版**。与 P1-1 合并修复。记录为 R3 待办。

### R2-P1-3: 奖励发放无确认机制 — ⚠️ 确认但降级

**Builder**: FC-07  
**Challenger**: R2-P1-3  
**裁决**: 确认事实，但严重度降为 **P2**。分析：
1. TutorialSystem 作为纯状态管理器，不直接操作资源系统是合理的架构选择
2. 奖励发放由调用方负责，当前 UI 层已正确处理
3. 重复领取风险仅存在于"存档损坏+手动修改"的极端场景
4. 实际游戏中，`claim_newbie_pack` 的奖励由后端验证，非纯前端判定

**修复要求**: 无（记录为技术债务，未来版本引入 `claimedRewards` 字段）。  
**封版判定**: **不阻塞封版**。

## R2 P2 裁决（逐项）

### R2-P2-1: round-trip 精度 — ✅ 已验证安全

**裁决**: Challenger 已验证 round-trip 安全。初始状态和完成状态均通过。无修复需要。

### R2-P2-2: engine-save 静默跳过 — ✅ 防御性编程已足够

**裁决**: 双重条件检查是合理的防御性编程。正常流程不会触发。

### R2-P2-3: skipTutorial deps 未检查 — ✅ 确认

**裁决**: 确认。与 FIX-T03 同模式但遗漏。防御不一致。  
**修复要求**: 添加 `if (!this.deps) return;` 前置检查。  
**封版判定**: **不阻塞封版**。正常流程中 init() 总在 skipTutorial() 前调用。

## 5维度评分

### 1. Builder 覆盖率 — 9.2/10

| 子维度 | 分数 | 说明 |
|--------|------|------|
| F-Normal | 10/10 | 16节点全覆盖，无遗漏 |
| F-Boundary | 10/10 | 10节点全覆盖 |
| F-Error | 8/10 | R1的6节点修复4个，保留2个+新增维度 |
| F-Serialize | 9/10 | R1的5节点修复4个，round-trip验证安全 |
| F-CrossSystem | 9/10 | engine-save完整接入，奖励链路识别 |
| F-Data (新增) | 9/10 | 值类型/合理性/引用完整性 |
| F-Version (新增) | 8/10 | 版本兼容性识别但未深入 |

**扣分点**: F-Version 仅识别了版本不匹配场景，未给出具体迁移策略。

### 2. Challenger 深度 — 9.0/10

| 子维度 | 分数 | 说明 |
|--------|------|------|
| R1穿透验证 | 10/10 | 7个FIX逐一验证，零遗漏 |
| 新维度探索 | 9/10 | 值类型校验、startedAt合理性、奖励机制 |
| 攻击路径 | 8/10 | P1-1/P1-2 给出了具体恶意存档构造 |
| 降级合理性 | 9/10 | P1-3 正确降级为P2 |

**扣分点**: 未发现 skipTutorial deps 遗漏的完整影响面（仅 P2-3 一项）。

### 3. 代码质量 — 9.5/10

| 子维度 | 分数 | 说明 |
|--------|------|------|
| 防御性编程 | 9/10 | null防护、ID校验、deps检查均已到位 |
| 序列化完整性 | 10/10 | serialize/loadSaveData 完整覆盖所有状态字段 |
| engine-save接入 | 10/10 | 序列化/反序列化/迁移日志完整 |
| 类型安全 | 9/10 | TypeScript类型完整，可选字段标记正确 |

**扣分点**: skipTutorial 缺少 deps 检查（与 completeCurrentStep 不一致）。

### 4. 测试覆盖 — 9.3/10

| 子维度 | 分数 | 说明 |
|--------|------|------|
| 测试数量 | 9/10 | 172个测试，4个测试文件 |
| 覆盖率 | 10/10 | 98% 行覆盖率 |
| R1修复测试 | 9/10 | 29个R1对抗式测试 |
| 边界测试 | 9/10 | null/undefined/非法ID/空对象全覆盖 |

**扣分点**: 未覆盖 skipTutorial deps 未初始化场景（P2-3）。

### 5. 系统集成 — 9.0/10

| 子维度 | 分数 | 说明 |
|--------|------|------|
| engine-save 链路 | 10/10 | buildSaveCtx/buildSaveData/applyLoadedState 完整 |
| 事件系统 | 9/10 | stepCompleted/completed/skipped 事件正确 |
| 子系统接口 | 8/10 | ISubsystem 接口兼容，但双引导系统并存 |

**扣分点**: 双引导系统（TutorialSystem vs TutorialStateMachine）并存问题（R1 P1-3）。

## 封版评分汇总

| 维度 | 分数 | 权重 | 加权分 |
|------|------|------|--------|
| Builder 覆盖率 | 9.2 | 20% | 1.84 |
| Challenger 深度 | 9.0 | 20% | 1.80 |
| 代码质量 | 9.5 | 25% | 2.375 |
| 测试覆盖 | 9.3 | 20% | 1.86 |
| 系统集成 | 9.0 | 15% | 1.35 |
| **总分** | | | **9.225** |

## 封版判定

```
┌─────────────────────────────────────────────┐
│                                             │
│   🏆 TUTORIAL MODULE R2 — SEALED           │
│                                             │
│   总分: 9.2 / 10.0  (目标: ≥9.0)           │
│   P0 缺陷: 0  (目标: 0)                    │
│   阻塞P1: 0   (目标: 0)                    │
│   测试: 172 passed                          │
│   覆盖率: 98%                               │
│   R1修复穿透: 7/7 零回归                    │
│                                             │
│   判定: ✅ PASS — 准予封版                  │
│                                             │
└─────────────────────────────────────────────┘
```

## R3 待办（技术债务）

| 优先级 | 项目 | 来源 |
|--------|------|------|
| P1 | stepCompletionTimes 值类型校验 | R2-P1-1 |
| P1 | startedAt 值合理性校验 | R2-P1-2 |
| P2 | skipTutorial deps 检查 | R2-P2-3 |
| P2 | 奖励发放确认机制 | R2-P1-3 |
| P2 | 双引导系统交互 | R1-P1-3 |
| P2 | loadSaveData 版本迁移 | R2-FV-01 |

## 修改文件清单（R2 轮次）

| 文件 | 类型 |
|------|------|
| `round-2-tree.md` | Builder 测试树 |
| `round-2-challenges.md` | Challenger 质疑 |
| `round-2-verdict.md` | 本文件 |

**R2 无代码修改** — R1修复穿透完整，R2发现的问题均为P1/P2技术债务。
