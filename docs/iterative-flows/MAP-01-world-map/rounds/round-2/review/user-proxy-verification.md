# R2 User Proxy Verification Report

> **Reviewer**: User Proxy (End-User Simulation)
> **Date**: 2026-05-05
> **Scope**: All 18 flow documents (FL-MAP-01 through FL-MAP-18) + INDEX.md + map-interfaces.md
> **Method**: Walk through each flow as an end user; identify confusion points, stuck states, and missing feedback

---

## Summary Statistics

| Priority | Count | Description |
|:--------:|:-----:|-------------|
| **P0** | 0 | No show-stopping issues found |
| **P1** | 2 | Issues that would confuse or frustrate a significant fraction of users |
| **P2** | 4 | Polish items that improve user experience |
| **P3** | 2 | Minor suggestions |
| **Total New** | 8 | |

---

## R2 Fix Verification Results

### P1-R2-01: Tutorial step 3 enemy city lookup algorithm (FL-MAP-01-SP01)
**Status: PASS**

The algorithm is fully specified in FL-MAP-01-SP01 under "步骤3敌方城池查找算法（P1-R2-01）":
1. Iterate all non-player-faction city-type territories
2. Filter those adjacent to player territories (adjacentIds contains player territory ID)
3. Sort by Euclidean distance ascending
4. Take the first as tutorial target with reduced difficulty (defense x0.5)
5. Fallback: if no adjacent enemy city, skip step 3 entirely and mark it as "no target, skipped"

The algorithm is clear, deterministic, and has a proper fallback. A user would not get stuck here.

### P1-R2-02: Cancelled state force cleanup (FL-MAP-09-08 and FL-MAP-16)
**Status: PASS**

FL-MAP-09-08 SiegeTask state machine table now includes a row:
> `[P1-R2-02] cancelled编队清理 | 任务取消时同步执行：编队状态→销毁（兵力归还unallocated，将领释放为available），行军精灵立即移除。详见FL-MAP-16编队映射表`

FL-MAP-16 编队状态映射表 confirms:
> `[XC-002] 编队销毁 [P1-R2-02] | cancelled | 编队销毁（兵力归还unallocated，将领释放为available）`

Both locations are consistent. The user's troops and generals are properly returned when a siege is cancelled.

### P1-R2-03: Reward claim text updated in FL-MAP-11
**Status: PASS**

FL-MAP-11-01 step detail now includes:
> `[V-021] [P1-R2-03]` 弹窗底部显示'请点击领取奖励，24h内未领取将自动发放至背包'及倒计时（格式: "24h后自动发放 HH:MM:SS"）

This clearly encourages active claiming and provides urgency through the countdown timer.

### P1-R2-04: Casualty formula implementation note added to FL-MAP-07 S7
**Status: PASS**

FL-MAP-07 S7 now includes:
> `[P1-R2-04] 实施备注`: 建议将伤亡计算提取为共享工具函数 `calculateCasualties(result, troops)`，FL-MAP-07 和 FL-MAP-17 均调用同一函数，确保参数变更同步。此为实施建议而非流程变更。

The note also clarifies: `伤亡计算说明（XC-008修复）: 征服伤亡使用与FL-MAP-17 S2相同的公式和参数，虽内联执行而非显式调用FL-MAP-17`

This ensures developers understand the casualty systems are consistent.

### P1-R2-05: Strategy modifier constants table added to map-interfaces.md
**Status: PASS**

map-interfaces.md now contains a dedicated "策略修正系数常量表" section with two clearly separated tables:
1. **城防衰减策略修正**: assault=1.2, surround=0.8, night_raid=1.5, insider=1.3
2. **编队战力策略修正**: assault=1.5, surround=0.8, night_raid=1.2, insider=2.0

The section includes a clear warning note: "两组参数含义不同。城防衰减修正影响每回合城防减少量，编队战力修正影响编队总战力计算。"

The inline TypeScript constants are also present at the top of the file.

### P1-R2-06: Version migration strategy added to map-interfaces.md
**Status: PASS**

map-interfaces.md now includes:
- A `migrateGameState()` function definition in the storage section
- A `[P1-R2-06]` comment block explaining the migration strategy:
  - Version check on load
  - Incremental migration by version number chain
  - Cross-major-version incompatibility prompt
  - Post-migration version update

### P1-R2-07: Loading progress percentage display verified in FL-MAP-01-02
**Status: PASS**

FL-MAP-01-02 user perception text reads:
> 看到 全屏地图轮廓骨架屏 + "天下加载中..."文字 + 进度条（含百分比数字，如"加载中 67%"）+ 预计剩余时间（如"预计还需2秒"） → 操作 等待 → 反馈 骨架屏渐进填充（每批10%进度条）

The progress display includes percentage, estimated remaining time, and progressive fill feedback. This is clear for end users.

---

## Overall R2 Fix Assessment

| Fix ID | Description | Result |
|--------|------------|:------:|
| P1-R2-01 | Tutorial step 3 enemy city lookup | PASS |
| P1-R2-02 | Cancelled state force cleanup | PASS |
| P1-R2-03 | Reward claim text | PASS |
| P1-R2-04 | Casualty formula implementation note | PASS |
| P1-R2-05 | Strategy modifier constants table | PASS |
| P1-R2-06 | Version migration strategy | PASS |
| P1-R2-07 | Loading progress percentage | PASS |

**All 7 R2 fixes verified: 7/7 PASS**

---

## New Findings

### Finding 1: FL-MAP-01-02 Loading timeout user guidance lacks estimated progress

| # | Flow | Issue | Priority | Suggestion |
|---|------|-------|:--------:|------------|
| 1 | FL-MAP-01-02 | The 15s timeout dialog offers "Continue waiting" or "Cancel" but does not indicate current progress percentage or what percentage is remaining. A user at 90% loading might cancel unnecessarily, while a user at 10% might wait indefinitely. | P1 | When the 15s timeout dialog appears, display the current loading progress percentage (e.g., "Data loading slow (67% loaded), continue waiting?"). This helps the user make an informed decision. |

### Finding 2: FL-MAP-07 S8 Victory auto-garrison notification conflicts with FL-MAP-08 flow entry description

| # | Flow | Issue | Priority | Suggestion |
|---|------|-------|:--------:|------------|
| 2 | FL-MAP-07 / FL-MAP-08 | FL-MAP-07 S8 states victory triggers auto-garrison with Toast "已自动驻防 {Y} 兵力" + optional [管理驻防] button. FL-MAP-08 S1 describes three trigger scenarios including "征服后驻防(FL-MAP-07胜利)". However, there is no explicit statement in FL-MAP-08 about what happens when the user clicks [管理驻防] from the victory popup versus manually navigating to garrison. If auto-garrison already allocated troops, the user entering FL-MAP-08 would see the already-adjusted values. The transition behavior should be explicitly described: clicking [管理驻防] from victory popup opens FL-MAP-08 with the troop slider pre-set to the auto-garrison amount, allowing the user to adjust. | P1 | Add an explicit transition note to FL-MAP-08 S1: "When entering from FL-MAP-07/09 victory popup [管理驻防] button, the slider is pre-set to the auto-garrison amount. The user can adjust up or down from this starting point. No additional confirmation is needed for the auto-garrison itself." |

### Finding 3: FL-MAP-09 P8 Retreat button tooltip may mislead about troop loss

| # | Flow | Issue | Priority | Suggestion |
|---|------|-------|:--------:|------------|
| 3 | FL-MAP-09 P8 | The retreat button tooltip says "确认撤退？将损失约 20%~40% 兵力", but the actual P0-V07 rules state that sieging-stage retreat preserves 100% of troops and only refunds 50% resources (粮草+道具). The 20%~40% troop loss applies only to the retreat's settling settlement (which calculates casualty at defeat level). The tooltip conflates resource loss with troop loss, which would confuse a user deciding whether to retreat. | P2 | Split the tooltip into two lines: "确认撤退？\n- 兵力：全部保留\n- 粮草/道具：退还50%\n- 每日攻城次数：消耗1次\n- 冷却：5分钟" This matches the P0-V07 unified cancel rules and gives the user accurate information. |

### Finding 4: FL-MAP-13 lacks explicit user perception for data staleness indicator

| # | Flow | Issue | Priority | Suggestion |
|---|------|-------|:--------:|------------|
| 4 | FL-MAP-13 | Step 2 mentions "数据时效性指示: '数据更新于 X 分钟前'" at the bottom of the panel, but this is only in system behavior, not in user perception. A user might not notice a stale-data indicator at the bottom. If statistics are more than 5 minutes old and the user is making strategic decisions (e.g., which territory to attack), stale data could lead to poor choices. | P2 | Add to user perception: "看到 面板底部显示数据更新时间（如'数据更新于 3 分钟前'），超过 5 分钟时文字变为黄色警告". Also add a refresh button or auto-refresh on panel open. |

### Finding 5: FL-MAP-08-01 Abandon territory cooldown applies to player but not AI

| # | Flow | Issue | Priority | Suggestion |
|---|------|-------|:--------:|------------|
| 5 | FL-MAP-08-01 | S4 states "冷却期内仅放弃者本人不可重新占领，AI阵营不受限制可占领该领土（V-020修复）". This means a player who abandons a territory for strategic reasons cannot reclaim it for 4 hours, but AI can take it immediately. A user might abandon expecting to reclaim quickly and find AI has taken it. The confirmation dialog (S2) should explicitly warn about this asymmetric risk. | P2 | In the abandon confirmation dialog (S2), add explicit text: "注意：放弃后 4 小时内您不可重新占领此领土，但敌方势力可能立即占领。放弃前请确认己方有足够防御资源守住相邻领土。" |

### Finding 6: FL-MAP-12-02 Event battle troop source uses a different formula than FL-MAP-07/09

| # | Flow | Issue | Priority | Suggestion |
|---|------|-------|:--------:|------------|
| 6 | FL-MAP-12-02 | Event battle troop calculation uses `min(最近己方领土驻防兵力×80%, 全局未分配兵力×50%)` and borrows from the global pool without deduction. This is a different paradigm than FL-MAP-07/09 where troops are explicitly allocated. A user who just fought an event battle might see their garrison unchanged but unallocated troops reduced (on loss). The relationship between "borrowed" troops and actual losses is not clearly communicated in the result panel. | P2 | Add to S5b failure handling: "失败Toast中明确显示'损失兵力 XXX（从全局兵力池扣除）'，并显示剩余全局未分配兵力数量，避免用户困惑为何领土驻防未受影响。" |

### Finding 7: FL-MAP-01-SP01 Tutorial step 3 skip silently adjusts progress tracking

| # | Flow | Issue | Priority | Suggestion |
|---|------|-------|:--------:|------------|
| 7 | FL-MAP-01-SP01 | When step 3 is skipped due to no adjacent enemy city, the tutorial marks it as "当前无目标，已跳过" in progress. However, the user perception for this transition is not described. The user was in step 2 (conquest), and suddenly jumps to step 4 (garrison) with no explanation visible to the user. The user might think the tutorial is broken or they missed something. | P3 | Add explicit user perception for step 3 skip: "看到 引导气泡文案'附近暂无敌方城池可攻略，已自动跳过攻城教学，后续可在地图上自行体验' → 反馈 引导箭头移至步骤4（驻防引导），进度指示器中步骤3标记为虚线（已跳过）" |

### Finding 8: FL-MAP-18 Bottom Sheet modal close confirmation may not cover all modal types

| # | Flow | Issue | Priority | Suggestion |
|---|------|-------|:--------:|------------|
| 8 | FL-MAP-18 S4 | The modal Bottom Sheet close confirmation text is "确认放弃当前操作？数据将不会保存". However, some modal sheets (like the casualty report in FL-MAP-17) are purely informational -- there is no "operation" to abandon and no data to lose. Showing "data will not be saved" for a read-only report would confuse users. | P3 | Differentiate modal close confirmation by type: (1) For action modals (siege confirm, formation create): "确认放弃当前操作？数据将不会保存"; (2) For informational modals (casualty report, statistics): No confirmation needed, or simple "关闭" without warning text. |

---

## Cross-Cutting Observations (Not Defects)

These are positive observations from the user-proxy review:

1. **Consistent user perception pattern**: Every step in every flow follows the "see -> act -> feedback" pattern. This is well-maintained across all 18 documents.

2. **Error recovery is thorough**: Each flow has detailed exception/abnormal handling tables with clear user-facing messages, system behavior, and recovery steps. Users should rarely feel stuck.

3. **Mobile adaptation is comprehensive**: FL-MAP-18 provides a detailed adaptation table for all 18 flows, and the long-press context menu with dynamic items based on territory type is well-designed for touch interaction.

4. **Formula consistency**: After R2 fixes, all formulas (casualty, victory rate, siege power, resource consumption) are consistent across documents, with clear cross-references (e.g., FL-MAP-07 referencing FL-MAP-17, FL-MAP-09 referencing FL-MAP-16).

5. **Siege lifecycle is complete**: The 18-step siege lifecycle (FL-MAP-09) covers every user-visible stage from target selection to return march, with clear time constraints at each phase.

6. **Offline handling is well-specified**: FL-MAP-15 provides clear "offline" definition (300s threshold), dual counters for online/offline events, and three processing options with explicit reward trade-offs.

---

## Verification Methodology

Each flow was evaluated against 6 criteria:

| Criterion | Result |
|-----------|--------|
| 1. User perception (see->act->feedback per step) | All 18 flows PASS |
| 2. Flow continuity (no dead ends or stuck states) | All 18 flows PASS |
| 3. Error recovery (all error paths handled with user guidance) | All 18 flows PASS |
| 4. Visual clarity (UI elements and positions described) | All 18 flows PASS |
| 5. Mobile experience (touch interactions defined) | All 18 flows PASS |
| 6. R2 fixes (each of the 7 fixes properly applied) | 7/7 PASS |

---

*User Proxy Verification Report v1 | 2026-05-05 | R2 Verification Complete*
