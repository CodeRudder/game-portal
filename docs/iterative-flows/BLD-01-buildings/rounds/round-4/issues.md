# Round 4 Issues — BLD Upgrade & Queue Flow Deepening

> **Date**: 2026-05-05
> **Reviewer**: Integrator (R4 depth pass)

## Issues Found During R4 Deepening

### P0 Issues (Critical — Fixed in-place during R4)

| ID | Flow | Step | Issue | Fix Applied |
|----|------|------|-------|-------------|
| R4-01 | FL-BLD-03 | 03-03 | Instant vs timed upgrade paths were described at concept level only, missing complete sub-step flows with independent see/act/feedback, system behavior, timing, and spatial details | Split into 03-03a (instant: server atomic op, 500ms total animation, no queue) and 03-03b (timed: server transaction, queue occupation, progress bar, panel switch) |
| R4-02 | FL-BLD-03 | 03-05 | No upgrade completion notification beyond Toast — missing global notification center, Tab Badge, navigation icon badge | Added 3-channel notification: global notification center (persistent), Tab Badge (red dot+count, click to clear), nav icon badge (when not on building page) |
| R4-03 | FL-BLD-03 | 03-03 | No main city upgrade special flow — missing special prerequisites, queue slot expansion trigger, global bonus refresh, unlock cascade | Added main city special behavior: special prerequisite table (Lv4->5: 任一建筑Lv4, Lv9->10: 任一建筑Lv9), queue slot expansion on completion, +2%/level global bonus refresh, building unlock cascade |
| R4-04 | FL-BLD-03 | 03-03 | No upgrade failure path classification — all failures treated uniformly | Added 3-level failure: L1 (transient, auto-retry 3x), L2 (server error, error code+retry button), L3 (data conflict, forced refresh). Added optimistic locking with version field |
| R4-05 | FL-BLD-06 | 06-04 | Cancel upgrade treated as single behavior regardless of task state — active and waiting tasks should have different refund rates and confirmation dialogs | Split into active cancel (80% refund, detailed resource breakdown dialog) and waiting cancel (100% refund, simplified dialog) |
| R4-06 | FL-BLD-06 | 06-03 | Speed-up flow lacked per-method detail — no fee calculation examples, no daily cap for destiny, no stacking rules | Added per-method specs: copper (formula+example), destiny (1pt/3x day+acquisition sources), gems (formula+example). Added stacking rules and 300ms cooldown |
| R4-07 | FL-BLD-06 | -- | No queue slot expansion step — expansion rules, timing, animation, and cascade effects were completely absent | Added new step 06-06: expansion rules table (Lv5/10/20 thresholds), blue ring animation, auto-assignment of waiting tasks, cascade with auto-upgrade |
| R4-08 | FL-BLD-06 | -- | No offline queue settlement step — 1.2x efficiency coefficient mentioned but no detailed simulation algorithm | Added new step 06-07: 4-step simulation algorithm, 1.2x application method, cascade handling (main city -> slot -> continue), settlement dialog, 72-hour cap |
| R4-09 | FL-BLD-06 | 06-05 | Auto-upgrade trigger conditions and building selection algorithm not specified — only priority mentioned | Added 5-condition trigger checklist, 4-step selection algorithm (filter->sort->select->execute), priority sorting rules (level->cost->time->fixed order), exclusion list management panel |
| R4-10 | FL-BLD-06 | -- | No queue item state machine — states were implied but never formalized | Added state machine with ASCII diagram: waiting->active->completing->completed, state duration specs, transition triggers |

### P1 Issues (Fixed in-place during R4)

| ID | Flow | Step | Issue | Fix Applied |
|----|------|------|-------|-------------|
| R4-11 | FL-BLD-03 | 03-06 | One-click max-level confirmation dialog lacked calculation algorithm — only described display | Added 4-step calculation algorithm (snapshot->cap check->per-level loop->summary) with instant/timed split consideration |
| R4-12 | FL-BLD-03 | 03-05 | Main city upgrade completion had no cascade behavior detail — missing slot expansion, bonus refresh, unlock check | Added cascade: queue slot expansion (with toast), global +2% bonus refresh (all buildings), level cap update, unlock check (Lv2->兵营, Lv3->工坊/书院, etc.) |
| R4-13 | FL-BLD-03 | 03-02 | Server validation priority list was incomplete — missing optimistic lock version check | Added version check as priority 5 (after special prerequisites), 409 Conflict handling |
| R4-14 | FL-BLD-06 | 06-03 | Speed-up panel had no layout spec | Added ASCII layout for 3-method panel (300x360px PC, Bottom Sheet 50% mobile) with per-method fee display, balance check, button states |
| R4-15 | FL-BLD-06 | 06-04 | Cancel confirmation dialog had no layout spec | Added ASCII layout for active-cancel dialog (280x240px) with resource breakdown and waiting-cancel dialog |
| R4-16 | FL-BLD-06 | 06-05 | Exclusion list had no management UI spec | Added ASCII layout for exclusion list panel (300x400px) with per-building toggle |
| R4-17 | FL-BLD-06 | 06-07 | Offline settlement had no dialog layout spec | Added ASCII layout for settlement report (400x450px) with completed/in-progress/waiting sections |

### P2 Issues (Noted, deferred to R5+)

| ID | Flow | Issue | Rationale |
|----|------|-------|-----------|
| R4-P2-01 | FL-BLD-03 | Speed-up cost formulas use "remaining time(秒)" but progress bar updates every second — potential rounding discrepancy for gem cost (should it be ceil or floor?) | Minor edge case, needs confirmation during implementation |
| R4-P2-02 | FL-BLD-06 | Auto-upgrade priority uses "fixed building order" as tiebreaker but this order is not in PRD — it is an assumption based on game balance | Needs game design confirmation |
| R4-P2-03 | FL-BLD-06 | Offline queue settlement 72-hour cap is arbitrary — PRD does not specify a cap | Needs PRD alignment or product decision |
| R4-P2-04 | FL-BLD-06 | Queue slot expansion "never decreases" even if main city level is lowered (hypothetical scenario) — not covered in PRD | Edge case for potential game mechanics (level-down items) |
| R4-P2-05 | FL-BLD-03 | One-click max-level batch request timeout handling — if server processes some levels but response is lost, client and server may disagree on how many levels were created | Rare edge case, server idempotency key recommended |
| R4-P2-06 | FL-BLD-06 | Auto-upgrade log retention (50 entries) is not specified in PRD | Minor UX detail, can be decided during implementation |

## Completeness Check Results

### Scenario Coverage

| Scenario | FL-BLD-03 | FL-BLD-06 |
|----------|:---------:|:---------:|
| Normal upgrade (happy path) | Covered (03-03a/b) | N/A |
| Main city upgrade special flow | Covered (03-01/03-03) | N/A |
| Instant upgrade path | Covered (03-03a) | N/A |
| Timed upgrade path | Covered (03-03b) | N/A |
| One-click max-level | Covered (03-06) | N/A |
| Main city completion cascade | Covered (03-05) | Covered (06-06) |
| Upgrade completion notification | Covered (03-05) | N/A |
| Queue float window | N/A | Covered (06-01) |
| Queue detail panel | N/A | Covered (06-02) |
| Copper speed-up | N/A | Covered (06-03) |
| Destiny speed-up | N/A | Covered (06-03) |
| Gem instant complete | N/A | Covered (06-03) |
| Cancel active task (80%) | N/A | Covered (06-04) |
| Cancel waiting task (100%) | N/A | Covered (06-04) |
| Auto-upgrade trigger | N/A | Covered (06-05) |
| Auto-upgrade selection algorithm | N/A | Covered (06-05) |
| Exclusion list management | N/A | Covered (06-05) |
| Queue slot expansion | N/A | Covered (06-06) |
| Queue state machine | N/A | Covered (06-06) |
| Offline queue settlement | N/A | Covered (06-07) |
| Offline cascade (main city) | N/A | Covered (06-07) |
| Network failure (L1/L2/L3) | Covered (03-03) | Covered (06-03/04) |
| Optimistic lock conflict | Covered (03-02/03) | N/A |
| Concurrent modification | Covered (03-02/03) | N/A |

### Edge Case Coverage

| Edge Case | Handled In |
|----------|-----------|
| Main city upgrade with special prerequisite not met | FL-BLD-03-01/02 |
| Instant upgrade with server latency > 1s | FL-BLD-03-03a |
| Server response lost after task creation | FL-BLD-03-03b |
| Speed-up during completion moment | FL-BLD-06-03 |
| Cancel during completion moment | FL-BLD-06-04 |
| Auto-upgrade all candidates excluded | FL-BLD-06-05 |
| Auto-upgrade all resources insufficient | FL-BLD-06-05 |
| Multiple slots becoming available simultaneously | FL-BLD-06-06 |
| Offline settlement exceeding 72 hours | FL-BLD-06-07 |
| Offline main city level-up cascade | FL-BLD-06-07 |
| One-click max-level with main city upgrade during dialog | FL-BLD-03-06 |
| Multiple upgrades completing simultaneously | FL-BLD-03-05 |
| WebSocket disconnect during active upgrade | FL-BLD-03-04 |
| Client crash during active upgrade | FL-BLD-03-04 / FL-BLD-06-01 |
