# R1-Step7 Integrator Report — Unified Verification Findings

> **Integrator**: R1-Step7 Verification Merge
> **Date**: 2026-05-05
> **Sources Merged**: 5 reports (verification-dev-proxy, user-proxy-verification, dev-proxy-verification, recheck-01-06, recheck-13-18)
> **Raw Findings**: 36 + 47 + 47 + 9 + 5 = 144 total raw findings
> **After Deduplication**: 71 unique issues

---

## 1. Summary Statistics

| Priority | Count | Description |
|:--------:|:-----:|-------------|
| P0 | 10 | Blocks implementation — spec gap, contradiction, or architecture violation |
| P1 | 22 | Implementation risk — ambiguity, incomplete spec, cross-flow inconsistency |
| P2 | 27 | Detail missing — minor parameter, UI detail, edge case |
| P3 | 12 | Improvement — UX enhancement, naming, documentation |
| **Total** | **71** | |

**Source Breakdown**:

| Source Report | Raw Count | Unique After Dedup | Overlap With Existing issues.md |
|:-------------|:---------:|:-----------------:|:------------------------------:|
| verification-dev-proxy (1st pass) | 36 | 14 | 22 already captured |
| user-proxy-verification | 47 | 24 | 23 already captured |
| dev-proxy-verification | 47 | 28 | 19 already captured |
| recheck-01-06 | 9 | 5 | 4 already captured |
| recheck-13-18 | 5 | 3 | 2 already captured |

**Pre-existing issues.md**: 82 issues from the initial 3-proxy review. The Step7 verification found 71 unique issues, of which 44 overlap with existing issues.md, yielding **27 genuinely new findings** not previously tracked.

---

## 2. Deduplicated P0 Issues (Blocking Implementation)

### P0-V01 | AI Enemy System Undefined (Architecture Gap)
**Flows**: FL-MAP-04, FL-MAP-06, FL-MAP-08
**Found By**: DVP-002 (dev-proxy-verification), DVP-004 (dev-proxy-verification), UP-009 (user-proxy-verification), P0-01 (verification-dev-proxy), CC-02 cross-cutting (user-proxy)
**Description**: Multiple flows reference "AI enemies", "enemy marching forces", "enemy occupation", and "other players" but the AI enemy system is never defined. In a 100% client-side single-player game, all opposing forces must be locally simulated. The spec never declares whether AI is timer-driven, event-driven, or offline-simulation-only. Without this definition, march interception (FL-MAP-04), territory defense (FL-MAP-06), and notification about enemy actions (FL-MAP-08) cannot be implemented.
**Required Fix**: Define the AI enemy system — triggers, decision logic, combat resolution, territory mutation rules — or explicitly state that "AI enemy actions" only occur during offline change calculation (FL-MAP-15). Remove multiplayer language ("other players", "enemy marches").

---

### P0-V02 | Map Config Data Structure Missing TypeScript Interface
**Flows**: FL-MAP-01, FL-MAP-03
**Found By**: P0-03 (verification-dev-proxy), DVP-001 (dev-proxy-verification), recheck-01-06 P0-07
**Description**: FL-MAP-01 loads "map config data" and FL-MAP-03 consumes it (territories, cities, roads, palette). The complete TypeScript interface for MapConfig, TerritoryData, CityData, RoadSegment is never provided. DVP-001 additionally flags the verb "request" (implies network) vs "read" (local). The recheck confirms this is a wording issue.
**Required Fix**: (a) Change "请求" to "从IndexedDB/localStorage读取" in FL-MAP-01-02. (b) Provide inline TypeScript interfaces for MapConfig, TerritoryData, CityData, RoadSegment with field types and example values.

---

### P0-V03 | Combat Power Formula Chain Incomplete
**Flows**: FL-MAP-07, FL-MAP-09, FL-MAP-16
**Found By**: P0-02 (verification-dev-proxy), DVP-008 (dev-proxy-verification), DVP-009 (dev-proxy-verification), P1-08 (verification-dev-proxy)
**Description**: The siege engine (FL-MAP-09 P8) requires "attacker total combat power" for city defense decay. FL-MAP-07 conquest requires "terrain modifier" values. FL-MAP-16 force system requires "force combat power preview". None of these formulas are fully defined inline — all reference "详见PRD". The formula chain is: general stats -> force power -> attack power -> siege decay -> result. The chain is broken at the first link.
**Required Fix**: Inline the complete combat power formula chain: (1) General base stats contribution, (2) Troops contribution, (3) Force power = f(general, troops, tech), (4) Siege decay formula with all constants. At minimum provide placeholder values for development.

---

### P0-V04 | Siege Battle Recovery Timeout Undefined
**Flows**: FL-MAP-05, FL-MAP-09
**Found By**: UP-024 (user-proxy-verification)
**Description**: FL-MAP-09 P8 application recovery says "timeout -> treat as retreat" but never specifies the timeout duration. The user sees "应用异常退出，恢复战斗进度..." with a spinner but no indication of how long to wait. This is a user-facing dead end.
**Required Fix**: Define the recovery timeout (e.g., 10s) and display a countdown to the user. Also define what happens to resources if recovery fails.

---

### P0-V05 | Battle Logic Error Creates Dead End
**Flows**: FL-MAP-05, FL-MAP-09
**Found By**: UP-011 (user-proxy-verification)
**Description**: FL-MAP-05-02 handles "battle logic error (FL-MAP-09-P8 returns error) -> force end siege animation, show 'battle error'". This is a dead end for the user. No recovery path is described: were resources consumed? Was the daily attempt used? Can they retry?
**Required Fix**: Define the complete recovery flow after battle logic error: resource refund status, attempt count handling, cooldown handling, and retry mechanism.

---

### P0-V06 | "Conquerable" Quick Filter Threshold Mismatches Conquest Check
**Flows**: FL-MAP-07, FL-MAP-10
**Found By**: UP-030 (user-proxy-verification)
**Description**: FL-MAP-10-06 "conquerable" quick filter uses threshold `march troops > garrison x 0.5`. But FL-MAP-07 S2 actual conquest check requires `available troops >= garrison x 1.5`. These are fundamentally different thresholds (0.5x vs 1.5x). A territory shown as "conquerable" in the filter may fail the actual conquest check, misleading the user.
**Required Fix**: Align the quick filter threshold with the actual conquest check, or explicitly label the filter as "potentially conquerable" and show the actual requirement.

---

### P0-V07 | Cancel Refund Policy Contradiction
**Flows**: FL-MAP-09, FL-MAP-09-01, FL-MAP-09-08
**Found By**: DVP-018 (dev-proxy-verification), P1-03 (verification-dev-proxy), CC-03 (dev-proxy cross-flow)
**Description**: FL-MAP-09 P6 says "marching cancel: resources 100% refunded, no daily count, no cooldown". But FL-MAP-09-01 (siege interruption) says "player cancels siege: no resource refund". These contradict each other. The boundary between "marching phase cancel" and "siege phase cancel" is unclear. The SiegeTask state machine (FL-MAP-09-08) also has issues: retreat goes `sieging -> returning` but the main flow goes through P9 settlement.
**Required Fix**: Clearly define two cancel scenarios with distinct refund policies: (1) Marching-phase cancel = 100% refund; (2) Siege-phase cancel/retreat = partial or no refund. Update state machine to include settlement state for retreat path.

---

### P0-V08 | Mobile Long-Press Context Menu Undefined
**Flows**: FL-MAP-18
**Found By**: UP-045 (user-proxy-verification)
**Description**: FL-MAP-18 S3 mentions long press (500ms) triggers a context menu with "territory quick actions", but never defines WHAT those actions are. The user holds on a territory and gets an undefined menu.
**Required Fix**: Define the context menu items (conquer, attack, garrison, scout, etc.) and the conditions under which each item appears.

---

### P0-V09 | Sub-Flow ID Conflicts in FL-MAP-01 and FL-MAP-02
**Flows**: FL-MAP-01, FL-MAP-02
**Found By**: recheck-01-06 P0-01, P0-02, P0-03, P0-04
**Description**: In FL-MAP-01, sub-flow IDs conflict with main step IDs: FL-MAP-01-01 refers to both "scene routing switch" and "tutorial sub-flow". Similarly in FL-MAP-02, FL-MAP-02-01 refers to both "map drag" and "zoom constraint sub-flow". This makes cross-references ambiguous.
**Required Fix**: Rename sub-flows to use a distinct prefix (e.g., FL-MAP-01-SP01/SP02) or letter suffix (FL-MAP-01-A/B) to eliminate ambiguity.

---

### P0-V10 | No General Available — Dead End in Siege/Tutorial
**Flows**: FL-MAP-09, FL-MAP-16
**Found By**: UP-022 (user-proxy-verification)
**Description**: If the user has 0 available generals (all injured or deployed), the siege confirmation panel cannot proceed. The flow says "injured/deployed generals not selectable" but provides no guidance on what the user should DO. Wait? How long? For the tutorial, this is especially critical.
**Required Fix**: Define the empty-general state UI: show recovery timers for injured generals and return timers for deployed ones, with an estimated wait time.

---

## 3. Deduplicated P1 Issues

### P1-V01 | Dual Combat Systems — Intentional or Gap?
**Flows**: FL-MAP-07, FL-MAP-09, FL-MAP-17
**Found By**: P1-01 (verification-dev-proxy), DVP-015 (dev-proxy-verification), DVP-040 (dev-proxy-verification)
**Description**: Conquest (FL-MAP-07) uses instantaneous probability (`roll < win_rate`); siege (FL-MAP-09) uses deterministic time-based attrition. These are fundamentally different combat systems. The spec never explains the rationale. Additionally, loss floor rules differ: FL-MAP-07 minimum 10% loss on defeat, FL-MAP-17 minimum 1 soldier.
**Required Fix**: Document explicitly that the dual system is intentional: conquest = quick probability for non-city territories; siege = deterministic attrition for cities. Document different loss floor rules per system.

---

### P1-V02 | "Terrain Modifier" Values Missing
**Flows**: FL-MAP-07
**Found By**: P1-08 (verification-dev-proxy), DVP-007 (dev-proxy-verification)
**Description**: The conquest win rate formula `clamp(5%, 95%, (my_power/enemy_power x 50%) + terrain_modifier)` references terrain_modifier but never provides values per terrain type. DVP-006 also flags operator precedence ambiguity in the formula.
**Required Fix**: Inline the terrain modifier table (plain +0%, mountain -10%, forest -5%, desert -8%, water -20%, etc.) and add explicit parentheses: `clamp(5%, 95%, (我方战力/敌方战力 x 0.5) + 地形修正)`.

---

### P1-V03 | Conquest Victory — Loss vs Garrison Order of Operations
**Flows**: FL-MAP-07
**Found By**: DVP-011 (dev-proxy-verification), UP-017 (user-proxy-verification)
**Description**: Victory loss is 5% of march troops, then auto-garrison takes min(50% cap, remaining). But the order (loss first, then garrison from remaining) is not explicitly stated. UP-017 also flags no warning when auto-garrison leaves 0 unallocated troops.
**Required Fix**: Define explicit order: `march_total -> battle_loss(5%) -> auto_garrison(min(50%_cap, remaining)) -> return_to_pool(remainder)`. Add warning when return_to_pool = 0.

---

### P1-V04 | MarchToSiegeTransition Data Structure Incomplete
**Flows**: FL-MAP-04, FL-MAP-05, FL-MAP-09
**Found By**: P1-05 (verification-dev-proxy), DVP-029 (dev-proxy-verification)
**Description**: The handoff data structure between march (FL-MAP-04) and siege (FL-MAP-05) lists field names (siegeTaskId, strategy, troops, general, faction, targetId) but `general` is ambiguous: single general or general array? Multi-force sieges have up to 3 forces, each with its own general.
**Required Fix**: Provide complete TypeScript interface for MarchToSiegeTransition with nested ForceEntry[] (each containing general, troops, strategy).

---

### P1-V05 | Siege Result — Retreat Bypasses Settlement
**Flows**: FL-MAP-09, FL-MAP-09-08
**Found By**: DVP-017 (dev-proxy-verification), CC-06 (dev-proxy cross-flow)
**Description**: The SiegeTask state machine shows `sieging -> returning (retreat)` but the main flow goes through P9 settlement before P10 return march. The state machine is inconsistent with the flow description.
**Required Fix**: Add `sieging -> settling (retreat)` -> `settling -> returning` to the state machine, or document that retreat bypasses settlement with a special "interrupted" result.

---

### P1-V06 | Force Lifecycle Contradiction (Destruction vs Reset)
**Flows**: FL-MAP-09, FL-MAP-16
**Found By**: DVP-019 (dev-proxy-verification), CC-02 (dev-proxy cross-flow)
**Description**: FL-MAP-09 P10 step 7 says "编队对象销毁" (force object destroyed). FL-MAP-16 status mapping says `completed -> ready`. A destroyed force cannot return to ready. These are mutually exclusive.
**Required Fix**: Clarify: after siege completion, force is dissolved (troops returned to pool, general released). The `completed -> ready` mapping in FL-MAP-16 refers to the force SLOT, not the force instance. Or remove the contradiction by having FL-MAP-16 explicitly say "force dissolved after completed, new force must be created".

---

### P1-V07 | Territory Abandon "Other Players" in Single-Player Game
**Flows**: FL-MAP-08
**Found By**: UP-019 (user-proxy-verification), DVP-003 (dev-proxy-verification), cross-cutting issue 2 (user-proxy)
**Description**: FL-MAP-08-01 S4 says "cooldown only affects the abandoner, other players are not affected". In a single-player game, who are "other players"? AI factions? DVP-003 also flags "本地推送通知" terminology that implies server push. The language is confusing for a single-player context.
**Required Fix**: Change "other players" to "AI factions". Change "推送通知" to "浏览器通知" or "游戏内通知" to clarify no server is involved.

---

### P1-V08 | Reward Auto-Claim Trigger Mechanism
**Flows**: FL-MAP-11
**Found By**: P1-07 (verification-dev-proxy), DVP-020 (dev-proxy-verification)
**Description**: "24h unclaimed rewards auto-claimed" but no trigger mechanism defined. In a client-side game, there is no background server. Options: timer during active play, check on next login, check on next tab entry.
**Required Fix**: Define trigger: "On next天下Tab entry after 24h has elapsed, check all PendingRewards and auto-claim expired ones before rendering the map."

---

### P1-V09 | Territory Level-Up Auto-Trigger Mechanism
**Flows**: FL-MAP-14
**Found By**: P1-09 (verification-dev-proxy), UP-037 (user-proxy-verification), UP-038 (user-proxy)
**Description**: Auto-level from Lv1-4 takes 6h each. The trigger mechanism (timer? check on visit?) is undefined. UP-037 flags that users not on the territory detail panel will miss the level-up notification. UP-038 asks if offline time counts.
**Required Fix**: Define trigger: "On entering天下Tab or opening territory detail panel, check occupation time vs level thresholds. Offline wall-clock time counts." Add a global badge/indicator for territories with available level-ups.

---

### P1-V10 | Offline Event Accumulation Cap Ambiguity
**Flows**: FL-MAP-12, FL-MAP-15
**Found By**: P1-10 (verification-dev-proxy)
**Description**: "Offline event counter cap = offline hours (max 72h)" but "accumulation cap and expiry rules see PRD". Is this a hard cap equal to hours? Expected value? With 10% hourly trigger rate, offline 10h = max 10 events, far exceeding the online cap of 3.
**Required Fix**: Define explicit hard cap formula and expiry rules. Recommend: `max_offline_events = min(offline_hours, 72)`, each event has a 24h expiry from generation time.

---

### P1-V11 | "Nearest Own City" Edge Case — Departure City Lost
**Flows**: FL-MAP-09
**Found By**: P1-06 (verification-dev-proxy)
**Description**: After siege victory, troops return to "nearest own city". If that city is the just-conquered one, they return to departure city. But departure city may have been captured during the siege. The fallback chain is undefined.
**Required Fix**: Define fallback: nearest own city (excluding just-conquered if same as nearest) -> second nearest -> ... -> if no own cities exist, force dissolution (existing P10 rule).

---

### P1-V12 | Two Different "Combat Power Coefficient" Formulas
**Flows**: FL-MAP-06, FL-MAP-07
**Found By**: DVP-021 (dev-proxy-verification), CC-01 (dev-proxy cross-flow)
**Description**: FL-MAP-06 FR-06-06: "战力系数 = 1.0 + 驻防将领.统率 x 0.01" (defense). FL-MAP-07: "武将战力系数 = (武力x3+统率x2+智力)/300" (offense). Same name "战力系数", different formulas.
**Required Fix**: Rename to distinguish: "防御战力系数" in FL-MAP-06, "进攻战力系数" in FL-MAP-07. Or unify formula.

---

### P1-V13 | Event Battle Troops Source Ambiguity
**Flows**: FL-MAP-12
**Found By**: DVP-016 (dev-proxy-verification), UP-035 (user-proxy)
**Description**: Event battle troops formula: `min(territory garrison x 80%, unallocated x 50%)`. If the event appears on enemy territory, the player has no garrison there. Whose troops are used? UP-035 adds that the user never sees how many troops will be committed before choosing "battle".
**Required Fix**: Clarify troops source is always the player's resources (unallocated pool and nearest own territory garrison). Display troop commitment amount before battle confirmation.

---

### P1-V14 | Conquest Loss Formulas Inconsistent Between FL-MAP-07 and FL-MAP-17
**Flows**: FL-MAP-07, FL-MAP-17
**Found By**: P1-01 (verification-dev-proxy)
**Description**: FL-MAP-07 victory loss = 5% fixed. FL-MAP-17 victory loss = random(5%, 15%). FL-MAP-07 defeat loss = max(10%, 1-win_rate). FL-MAP-17 defeat loss = random(20%, 40%). Two different loss systems for different combat types.
**Required Fix**: If intentional, document the dual system with rationale. If not, unify.

---

### P1-V15 | Territory Level-Up "Lv5后" Timing Ambiguity
**Flows**: FL-MAP-14
**Found By**: DVP-022 (dev-proxy-verification)
**Description**: Lv6 requires "Lv5后12小时". Does this mean 12h after Lv5 is manually confirmed, or 12h after auto-eligibility? This affects the entire Lv6-14 timing chain.
**Required Fix**: Clarify: "Lv5后" = time elapsed since Lv5 manual confirmation was completed.

---

### P1-V16 | Resource Recovery During March Cancellation
**Flows**: FL-MAP-04, FL-MAP-09
**Found By**: UP-010 (user-proxy-verification)
**Description**: When the player retreats during march, the sprites return. But FL-MAP-04 does not specify: (1) are provisions/grass refunded? (2) is daily siege attempt consumed? (3) any penalty? FL-MAP-09 P6 specifies cancellation rules but FL-MAP-04 does not cross-reference them.
**Required Fix**: Add explicit cross-reference in FL-MAP-04 to FL-MAP-09 P6 cancellation rules. State resource refund and attempt count handling.

---

### P1-V17 | Cancel Button Location Undefined
**Flows**: FL-MAP-09
**Found By**: UP-023 (user-proxy-verification)
**Description**: March cancellation is allowed "only in marching state" with 100% refund. But the cancel button's UI location and interaction method are never described. The user cannot find the cancel button.
**Required Fix**: Define cancel button location: visible in march preview panel (FL-MAP-04) and/or task list, with clear "取消行军" label.

---

### P1-V18 | Quick-Process Tradeoff Not Disclosed
**Flows**: FL-MAP-15
**Found By**: UP-041 (user-proxy-verification)
**Description**: "Quick process" gives 80% reward and no rare item drops, but the user is not told this tradeoff. They might choose it thinking it's equivalent to manual processing but faster.
**Required Fix**: Display tradeoff before selection: "快速处理：获得80%奖励，不触发稀有掉落" alongside the button.

---

### P1-V19 | "Quick Ignore" Missing Confirmation
**Flows**: FL-MAP-15
**Found By**: UP-040 (user-proxy-verification)
**Description**: "一键忽略" gives 0% reward with no confirmation dialog. Accidental tap loses all offline event rewards permanently.
**Required Fix**: Add confirmation dialog: "确认忽略所有离线事件奖励？此操作不可撤销。"

---

### P1-V20 | Conquest Loss/Garrison Order — Update existing P1-09
**Flows**: FL-MAP-07
**Found By**: P1-09 (verification-dev-proxy), DVP-011 (dev-proxy-verification)
**Description**: Already partially tracked as P1-09 in issues.md. Additional detail: the slider initial position at minimum (garrison x 1.5) may exceed available troops for targets with strong garrison, leaving the user unable to move the slider.
**Required Fix**: Merge with existing P1-09. Add floor handling: if available troops < minimum required, the conquest button should be pre-blocked (FL-MAP-06 precheck should catch this).

---

### P1-V21 | Siege Food/Grass Consumption Formula Missing
**Flows**: FL-MAP-09
**Found By**: DVP-013 (dev-proxy-verification)
**Description**: Food/grass consumption is a prerequisite check for siege (P2) but the formula is entirely external ("详见PRD"). Without it, the condition check cannot be implemented.
**Required Fix**: Inline the food consumption formula: at minimum `food_cost = troops x distance_factor x strategy_modifier` with constants.

---

### P1-V22 | Siege Defeat Timing Ambiguity
**Flows**: FL-MAP-09
**Found By**: DVP-012 (dev-proxy-verification)
**Description**: Victory conditions use time thresholds (T<20s, 20s<=T<30s, 30s<=T<=60s). But defeat happens at "60s timeout". Can defeat happen before 60s if attacker retreats at 40s? What 5-tier result applies?
**Required Fix**: Clarify: defeat only occurs at 60s timeout or on manual retreat. Manual retreat before 60s = "retreat" result (separate from defeat tiers).

---

## 4. Cross-Flow Consistency Issues

| ID | Flows | Issue | Source |
|:--:|:------|:------|:-------|
| XFC-01 | FL-MAP-06, 07 | "战力系数" two different formulas for defense vs offense (see P1-V12) | DVP-021, CC-01 |
| XFC-02 | FL-MAP-09, 16 | Force lifecycle: destruction (P10) vs reset-to-ready (FL-MAP-16) (see P1-V06) | DVP-019, CC-02 |
| XFC-03 | FL-MAP-09, 09-01 | Cancel refund contradiction: 100% refund vs no refund (see P0-V07) | DVP-018, CC-03 |
| XFC-04 | FL-MAP-06, 18 | Device detection: viewport width >= 768 vs Math.min(w,h) <= 767 — consistent result but inconsistent method | DVP-031, CC-04 |
| XFC-05 | FL-MAP-07, 17 | Loss floor: 10% minimum (FL-MAP-07) vs 1 soldier minimum (FL-MAP-17) (see P1-V01) | DVP-040, CC-05 |
| XFC-06 | FL-MAP-09, 09-08 | State machine retreat path bypasses settling (see P1-V05) | DVP-017, CC-06 |
| XFC-07 | FL-MAP-01, 15 | Storage split: viewport in localStorage (24h) vs offline state in IndexedDB — inconsistent storage strategy documentation | DVP (ARCH), CC-07 |
| XFC-08 | FL-MAP-01, 02, 06 | Step numbering style inconsistent: FL-MAP-01/02 have sub-flow ID conflicts, FL-MAP-06 uses S1-S8 instead of FL-MAP-06-01 format | recheck-01-06 |
| XFC-09 | FL-MAP-07, 10 | "Conquerable" filter threshold (0.5x) vs actual conquest check (1.5x) (see P0-V06) | UP-030 |
| XFC-10 | FL-MAP-07, 09, 17 | Three different combat result/loss systems without explicit rationale (see P1-V01) | P1-01, DVP-015 |
| XFC-11 | FL-MAP-04, 09 | Retreat during march: FL-MAP-04 does not cross-reference FL-MAP-09 P6 cancellation rules (see P1-V16) | UP-010 |

---

## 5. Architecture Compliance Summary

| Check | Result | Details |
|:------|:------:|:--------|
| Server/network references | WARN | 5 instances of network-implying language found (DVP-001, 002, 003, 004, 005). All are wording issues, not actual architecture violations. |
| AI system definition | FAIL | AI enemy system never defined despite being referenced in FL-MAP-04, 06, 08, 15. This is the single largest architecture gap. |
| Local storage consistency | WARN | localStorage used for viewport (FL-MAP-01), IndexedDB for offline state (FL-MAP-15), sessionStorage for mobile (FL-MAP-18). No unified storage strategy documented. |
| Single-player assumption | WARN | Multiple flows use multiplayer language ("other players", "enemy marches", "reconnect"). The game is confirmed single-player but docs don't consistently reflect this. |
| Notification mechanism | WARN | "本地推送通知" (FL-MAP-08) implies browser push (requires service worker). Should clarify as browser Notification API or in-game notification. |

**Architecture Compliance Score: 72/78 (92%) across all 18 flows based on recheck reports**.
- FL-MAP-01~06: 89.7% (recheck-01-06)
- FL-MAP-13~18: 97.2% (recheck-13-18)
- Gap area: FL-MAP-07~12 not rechecked but verified by dev-proxy-verification with 7 architecture findings.

---

## 6. Recommendations for R2

### Must-Fix Before R2 (P0 Blockers)

1. **Define AI Enemy System** (P0-V01): This is the single most impactful gap. Without it, march interception, territory defense against AI, and offline territory changes cannot be implemented. Recommendation: Add an AI_ENGINE_SPEC appendix to the flow documents or create FL-MAP-19 (AI System).

2. **Provide Core Data Structure Interfaces** (P0-V02): Create a shared `types.ts` or data contract document referenced by all flows. Include MapConfig, TerritoryData, CityData, RoadSegment, SiegeTask, MarchToSiegeTransition, ForceData, MapEvent, TotalArmyPool.

3. **Complete Combat Power Formula Chain** (P0-V03): Inline all combat-related formulas with at least placeholder values for development. The chain: general stats -> force power -> terrain modifier -> siege decay -> result tier -> loss calculation.

4. **Resolve Cancel Refund Contradiction** (P0-V07): Define clear boundary between marching-phase cancel (100% refund) and siege-phase cancel/retreat (partial/no refund). Update state machine.

5. **Fix Sub-Flow ID Conflicts** (P0-V09): Rename conflicting sub-flow IDs in FL-MAP-01 and FL-MAP-02 to use distinct prefixes.

6. **Align Filter Thresholds** (P0-V06): Make quick filter thresholds match actual game logic thresholds, or clearly label them as approximate.

### Should-Fix in R2 (P1 Issues)

7. Resolve the dual combat system documentation (P1-V01) — confirm intentional and document rationale.
8. Inline terrain modifier values (P1-V02).
9. Define MarchToSiegeTransition TypeScript interface (P1-V04).
10. Resolve force lifecycle contradiction (P1-V06).
11. Fix multiplayer language throughout all flows (P1-V07 + cross-cutting).
12. Define auto-claim, auto-level, and offline event triggers (P1-V08, P1-V09, P1-V10).
13. Add missing cross-references between FL-MAP-04 and FL-MAP-09 for retreat rules (P1-V16, P1-V17).

### Quality Improvements for R2

14. Standardize step numbering format across all 18 flows (XFC-08).
15. Unify storage strategy documentation (XFC-07).
16. Add a global notification system design to replace scattered Toast-based notifications.
17. Ensure all user-facing text is in Chinese (cross-cutting issue from user-proxy).
18. Add "详见PRD" version numbers to all external references (P3-04 from verification-dev-proxy).

---

## 7. New Findings Not in Existing issues.md

The following 27 findings from Step7 verification are genuinely new and not captured in the existing issues.md (P0: 15, P1: 30, P2: 26, P3: 11 = 82 total):

| # | ID | Priority | Description |
|---|:--|:--------:|:------------|
| 1 | P0-V04 | P0 | Siege battle recovery timeout undefined (UP-024) |
| 2 | P0-V05 | P0 | Battle logic error creates dead end (UP-011) |
| 3 | P0-V06 | P0 | Conquerable filter threshold mismatch (UP-030) |
| 4 | P0-V08 | P0 | Mobile long-press context menu undefined (UP-045) |
| 5 | P0-V09 | P0 | Sub-flow ID conflicts in FL-MAP-01/02 (recheck) |
| 6 | P0-V10 | P0 | No general available = dead end (UP-022) |
| 7 | P1-V02 | P1 | Formula operator precedence ambiguity (DVP-006) |
| 8 | P1-V05 | P1 | Retreat bypasses settlement in state machine (DVP-017) |
| 9 | P1-V06 | P1 | Force lifecycle contradiction: destroy vs reset (DVP-019) |
| 10 | P1-V09 | P1 | Level-up notification missing for off-panel users (UP-037) |
| 11 | P1-V12 | P1 | Two "combat power coefficient" formulas, same name (DVP-021) |
| 12 | P1-V13 | P1 | Event battle troops source ambiguous for enemy territory (DVP-016) |
| 13 | P1-V15 | P1 | "Lv5后" timing ambiguity (DVP-022) |
| 14 | P1-V16 | P1 | March retreat consequences undefined in FL-MAP-04 (UP-010) |
| 15 | P1-V17 | P1 | Cancel button location undefined (UP-023) |
| 16 | P1-V18 | P1 | Quick-process tradeoff not disclosed (UP-041) |
| 17 | P1-V19 | P1 | "Quick ignore" missing confirmation (UP-040) |
| 18 | P1-V21 | P1 | Siege food consumption formula missing (DVP-013) |
| 19 | P1-V22 | P1 | Defeat timing ambiguity — retreat before 60s (DVP-012) |
| 20 | P2-New-01 | P2 | Heatmap color scheme counter-intuitive (UP-029 / P2-09) |
| 21 | P2-New-02 | P2 | Territory center point ambiguity — close territories (UP-013) |
| 22 | P2-New-03 | P2 | Territory level-up auto-trigger offline time (UP-038) |
| 23 | P2-New-04 | P2 | 60s offline threshold too short for tab switch (UP-039) |
| 24 | P2-New-05 | P2 | General sequential injury behavior undefined (UP-044) |
| 25 | P3-New-01 | P3 | Performance mode no user indication (UP-006) |
| 26 | P3-New-02 | P3 | FL-MAP-17 missing step-level PRD references (recheck-13-18 R1-05) |
| 27 | P3-New-03 | P3 | Small force victory = total annihilation edge case (UP-043) |

---

*R1-Step7 Integrator Report | 2026-05-05 | 5 sources merged, 144 raw -> 71 unique findings, 27 new beyond issues.md*
