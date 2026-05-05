# R16 Challenger Attack Report

**Date**: 2026-05-04
**Role**: Challenger
**Target**: R16 Builder Manifest -- Enhancement + P2 Fix Phase

---

## Attack Summary

| Severity | Count |
|----------|-------|
| P1 (Important) | 1 |
| P2 (Minor) | 2 |
| **Total valid challenges** | **3** |

---

## Challenge Summary Table

| # | Challenge | Severity | Builder Claim | Why Unreliable | Missing Evidence |
|---|-----------|----------|---------------|----------------|------------------|
| 1 | R16 Task 2 (行军精灵持续时间约束) 未实现 | P1 | R16 all 5 tasks complete | R16 Plan Task 2 要求实现 march duration clamp (10s~60s), 但 grep 确认 MIN_MARCH_DURATION/MAX_MARCH_DURATION 在 src/ 中 0 matches. 代码未实现, 仅 PRD 文档更新 | 代码中不存在 clamp(duration, 10000, 60000) 逻辑 |
| 2 | PLAN.md 完成率 86% < 目标 87% | P2 | PLAN.md updated | R16 Plan 质量目标要求完成率 >= 87%, 实际 86% 未达标 | 需推进至少1个功能项从 ⬜ 到 🔄 |
| 3 | SiegeBattleSystem clamp 已存在但非 march sprite duration | P2 | Task 2 integration tests cover duration | SiegeBattleSystem 已有 estimatedDurationMs clamp(10000, 60000), 但这是 battle duration, 非 march sprite 行军精灵 duration | 需确认 march sprite 创建逻辑是否也有 clamp |

---

## Detailed Attacks

### Attack 1 (P1): R16 Task 2 (行军精灵持续时间约束) 代码未实现

**Builder Claim**: R16 all 5 tasks verified and complete.

**Why Unreliable**:

R16 Plan 明确定义 Task 2 为:
> **Task 2 (P2): 行军精灵持续时间约束 (I11 Enhancement)**
> - 行军精灵创建时计算实际动画持续时间
> - 若计算时长 < 10s, 强制使用 10s 最小值
> - 若计算时长 > 60s, 强制使用 60s 最大值
> - 影响范围: PixelWorldMap.tsx march sprite 创建 / SiegeBattleAnimationSystem.ts

但实际执行的 Task 2 是 "真实子系统集成测试", 完全替代了原计划的行军精灵持续时间约束.

代码验证:
- `grep -ri "MIN_MARCH_DURATION\|MAX_MARCH_DURATION" src/` = **0 matches**
- `grep -ri "march.*duration.*clamp\|marchDuration.*10\|marchDuration.*60" src/` = **0 matches**

PLAN.md 中 R16 未完成列表已记录 "I11代码实现 | 行军精灵持续时间clamp(10s~60s)代码 | 优先完成P2修复和集成测试, 代码实现延期", 承认了这一缺失.

**裁决建议**: P1 -- 计划中的功能需求未实现, 但已在 PLAN.md 中明确标记为延期到 R17. Builder 未在 manifest 中明确说明 Task 2 被替换.

### Attack 2 (P2): PLAN.md 完成率未达标

**Builder Claim**: PLAN.md updated with completion rate tracking.

**Why Unreliable**:

R16 Plan 质量目标明确要求 "PLAN.md 完成率 >= 87%". 实际更新后完成率为 56/65 = 86%, 未达标.

I11 从 ⬜ 升级到 🔄 贡献了 +1 (55->56), 但距离 87% (56.55) 仍差 0.55 个功能点.

**裁决建议**: P2 -- 差距极小 (1%), 属于弹性范围内的偏差.

### Attack 3 (P2): March Sprite Duration vs Battle Duration 混淆

**Builder Claim**: Task 2 integration tests verify duration constraints.

**Why Unreliable**:

SiegeBattleSystem.createBattle() 已内置 `estimatedDurationMs` clamp:
```typescript
// test file: siege-anim-completion.integration.test.ts line 71
estimatedDuration = clamp(15000 - 5000, 10000, 60000) = 10000ms
```

这是 **battle duration** (攻城战斗时长), 不是 **march sprite duration** (行军精灵动画时长). R16 Plan Task 2 要求的是行军精灵从出发到到达的动画持续时间约束, 这是 PixelWorldMap 层面的 march sprite 动画速度控制.

两者是不同层次的 duration:
- Battle duration: SiegeBattleSystem 引擎层, 已有 clamp
- March sprite duration: PixelWorldMap UI 渲染层, 未实现

**裁决建议**: P2 -- 概念混淆但不影响已有测试正确性.

---

## Final Verdict

| Task | Builder Claim | Challenger Verdict | Reason |
|------|---------------|-------------------|--------|
| Task 1 (Terrain optimization) | Complete | **Valid** | Code verified, tests pass |
| Task 2 (原Plan: 行军精灵时长约束) | Replaced with integration tests | **Partially valid** | Integration tests excellent but march duration clamp not implemented |
| Task 3 (E2E tests) | Complete | **Valid** | 7 real system tests pass |
| Task 4 (PLAN.md) | Complete | **Conditionally valid** | 86% < 87% target |
| Task 5 (P2 cleanup) | Complete | **Valid** | Shared types properly migrated |

**Challenger完成, 3个有效质疑(其中P1:1, P2:2)**
