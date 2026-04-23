# 技术审查报告 — Round 9: v9.0~v12.0

> **审查日期**: 2025-07-11
> **审查范围**: engine/offline · equipment · expedition · social · leaderboard
> **审查基线**: 文件≤500行 · ISubsystem 100% · `as any` 零容忍 · 门面导出无违规 · jest 残留检查

---

## 一、总览

| 模块 | 版本 | 文件数 | 总行数 | ISubsystem | `as any` | 状态 |
|------|------|--------|--------|------------|----------|------|
| `engine/offline` | v9.0 离线收益 | 9 | 2,240 | 3/3 ✅ | 0 ✅ | 🟢 PASS |
| `engine/equipment` | v10.0 兵强马壮 | 9 | 2,363 | 5/5 ✅ | 0 ✅ | 🟢 PASS |
| `engine/expedition` | v11.0/v12.0 群雄逐鹿/远征天下 | 7 | 2,159 | 4/4 ✅ | 0 ✅ | 🟡 WARN |
| `engine/social` | v11.0 群雄逐鹿 | 6 | 1,661 | 3/5 ⚠️ | 0 ✅ | 🟡 WARN |
| `engine/leaderboard` | v11.0 排行榜 | 2 | 348 | 1/1 ✅ | 0 ✅ | 🟢 PASS |

---

## 二、逐项审查

### 2.1 文件行数 ≤ 500 行

**结论: ✅ 全部通过，但有 3 个文件接近警戒线**

| 文件 | 行数 | 状态 |
|------|------|------|
| `expedition/AutoExpeditionSystem.ts` | **470** | ⚡ 接近上限 |
| `expedition/ExpeditionSystem.ts` | **456** | ⚡ 接近上限 |
| `social/LeaderboardSystem.ts` | **454** | ⚡ 接近上限 |
| `offline/OfflineSnapshotSystem.ts` | 434 | OK |
| `equipment/EquipmentSystem.ts` | 412 | OK |
| `offline/OfflineRewardSystem.ts` | 383 | OK |
| `expedition/ExpeditionRewardSystem.ts` | 381 | OK |
| `social/ChatSystem.ts` | 390 | OK |
| `social/FriendSystem.ts` | 428 | OK |
| `expedition/ExpeditionBattleSystem.ts` | 338 | OK |
| `leaderboard/LeaderboardSystem.ts` | 332 | OK |

> **建议**: `AutoExpeditionSystem.ts`(470行) 和 `ExpeditionSystem.ts`(456行) 在后续迭代中极易突破 500 行，建议提前规划拆分方案。

---

### 2.2 ISubsystem 接口实现

**结论: ⚠️ social 模块存在 2 个未实现 ISubsystem 的 class**

#### ✅ 完全合规模块

| 模块 | System 文件 | implements ISubsystem |
|------|-------------|-----------------------|
| **offline** | OfflineRewardSystem | ✅ |
| | OfflineEstimateSystem | ✅ |
| | OfflineSnapshotSystem | ✅ |
| **equipment** | EquipmentSystem | ✅ |
| | EquipmentForgeSystem | ✅ |
| | EquipmentEnhanceSystem | ✅ |
| | EquipmentSetSystem | ✅ |
| | EquipmentRecommendSystem | ✅ |
| **expedition** | ExpeditionSystem | ✅ |
| | ExpeditionBattleSystem | ✅ |
| | ExpeditionRewardSystem | ✅ |
| | AutoExpeditionSystem | ✅ |
| **leaderboard** | LeaderboardSystem | ✅ |

#### ⚠️ social 模块缺失项

| 文件 | class 名称 | implements ISubsystem | 说明 |
|------|------------|-----------------------|------|
| `FriendInteractionSubsystem.ts` | `FriendInteractionSubsystem` | ❌ 未实现 | 纯逻辑 class，无生命周期方法 |
| `BorrowHeroSubsystem.ts` | `BorrowHeroSubsystem` | ❌ 未实现 | 纯逻辑 class，无生命周期方法 |

**分析**: 这两个 class 是从 `FriendSystem` 拆分出的辅助模块，不包含 `init/update/destroy` 生命周期方法，属于无状态的工具类。但命名以 `Subsystem` 结尾，容易造成混淆。

**建议**:
- 方案 A: 如果确实不需要生命周期管理，重命名为 `FriendInteractionHelper` / `BorrowHeroHelper`，与项目中其他 Helper 命名一致
- 方案 B: 如果未来需要独立生命周期，补充 `implements ISubsystem`

---

### 2.3 `as any` 零容忍

**结论: ✅ 全部通过**

| 模块 | `as any` 出现次数 |
|------|--------------------|
| offline | 0 |
| equipment | 0 |
| expedition | 0 |
| social | 0 |
| leaderboard | 0 |

> 五个模块均无 `as any` 使用，类型安全合规。

---

### 2.4 门面导出（Facade Pattern）

**结论: ✅ 全部通过**

- 所有 5 个模块均有 `index.ts` 统一导出入口
- UI 层 (`src/components/`, `src/games/three-kingdoms/ui/`) 无绕过 `index.ts` 的直接导入
- 各 `index.ts` 导出结构清晰，包含类型导出（`export type`）和值导出

**门面导出结构**:

```
engine/offline/index.ts      → 3 个 System + OfflineRewardEngine 纯函数 + 类型
engine/equipment/index.ts    → 5 个 System + BagManager + ForgePityManager + Generator + 类型
engine/expedition/index.ts   → 4 个 System + config 常量 + 类型
engine/social/index.ts       → 3 个 System + 2 个 Subsystem + 类型 + 常量
engine/leaderboard/index.ts  → 1 个 System + 类型
```

---

### 2.5 Jest 残留检查

**结论: ✅ 全部通过**

- 5 个模块的 `.test.ts` 文件中均未发现 `jest.` 或 `jest(` 调用
- 项目使用 Vitest 测试框架，无 Jest 依赖残留

---

### 2.6 附加检查：模块间耦合

**结论: ✅ 零耦合**

5 个模块之间无相互导入，各模块完全独立：

```
offline     → 不依赖 equipment/expedition/social/leaderboard
equipment   → 不依赖 offline/expedition/social/leaderboard
expedition  → 不依赖 offline/equipment/social/leaderboard
social      → 不依赖 offline/equipment/expedition/leaderboard
leaderboard → 不依赖 offline/equipment/expedition/social
```

---

### 2.7 附加发现：LeaderboardSystem 重复

**结论: ⚠️ 需关注**

存在两个不同的 `LeaderboardSystem`：

| 文件 | 行数 | 职责 |
|------|------|------|
| `engine/leaderboard/LeaderboardSystem.ts` | 332 | 多维度排名管理、实时/每日刷新、每日奖励发放 |
| `engine/social/LeaderboardSystem.ts` | 454 | 全服排行榜管理、排名计算、赛季重置、奖励发放 |

两者职责描述不同但功能高度重叠，存在概念混淆风险。

**建议**: 明确两者边界，考虑合并为一个系统或明确区分（如 `social/LeaderboardSystem` 负责社交排名，`leaderboard/LeaderboardSystem` 负责通用排名引擎）。

---

## 三、审查汇总

### 通过项 ✅

| # | 检查项 | 结果 |
|---|--------|------|
| 1 | 文件行数 ≤ 500 | ✅ 无超标文件 |
| 2 | `as any` 零容忍 | ✅ 0 处违规 |
| 3 | 门面导出无违规 | ✅ 无绕过 index.ts 的导入 |
| 4 | Jest 残留 | ✅ 无残留 |
| 5 | 模块间零耦合 | ✅ 5 模块完全独立 |

### 需改进项 ⚠️

| # | 问题 | 严重度 | 模块 | 建议 |
|---|------|--------|------|------|
| 1 | `FriendInteractionSubsystem` 未实现 ISubsystem | 中 | social | 重命名为 Helper 或补充接口 |
| 2 | `BorrowHeroSubsystem` 未实现 ISubsystem | 中 | social | 重命名为 Helper 或补充接口 |
| 3 | `AutoExpeditionSystem.ts` 470 行接近上限 | 低 | expedition | 提前规划拆分 |
| 4 | `ExpeditionSystem.ts` 456 行接近上限 | 低 | expedition | 提前规划拆分 |
| 5 | `social/LeaderboardSystem.ts` 454 行接近上限 | 低 | social | 提前规划拆分 |
| 6 | 双 LeaderboardSystem 概念重叠 | 中 | social+leaderboard | 明确职责边界或合并 |

---

## 四、架构评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 代码规范 | ⭐⭐⭐⭐⭐ | 行数控制严格，命名规范一致 |
| 类型安全 | ⭐⭐⭐⭐⭐ | 零 `as any`，类型导出完整 |
| 模块化 | ⭐⭐⭐⭐⭐ | 零耦合，门面模式规范 |
| 接口一致性 | ⭐⭐⭐⭐ | social 模块 2 个 Subsystem 命名不一致 |
| 可维护性 | ⭐⭐⭐⭐ | 3 个文件接近 500 行上限，需关注 |

**综合评分: 4.6 / 5.0** 🟢

---

*审查人: Architect Agent · Round 9*
