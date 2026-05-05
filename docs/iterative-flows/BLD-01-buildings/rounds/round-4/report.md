# Round 4 Report — BLD Building Upgrade & Queue Flow Deepening

> **Date**: 2026-05-05
> **Scope**: FL-BLD-03 (Building Upgrade) + FL-BLD-06 (Upgrade Queue Management)
> **Version**: v3 -> v4 for both flows

## Summary

Deepened FL-BLD-03 and FL-BLD-06 from L2/L3 to full L3+ depth, covering all edge cases specified in the R4 task. Both flows now have complete user perception triples (see->act->feedback), system behaviors, timing specs, spatial specs, and exception branches for every step.

## Changes by Flow

### FL-BLD-03 Building Upgrade (v3 -> v4)

**Steps deepened**: 6 steps (03-01 through 03-06)

| Area | What was added |
|------|---------------|
| Main city upgrade special flow | Added special prerequisite display ("任一建筑Lv4" for 4->5, "任一建筑Lv9" for 9->10), queue slot expansion trigger on completion, global resource bonus refresh (+2%/level), building unlock cascade, building level cap refresh |
| Instant upgrade path (03-03a) | Separated into dedicated sub-step with complete flow: server atomic operation, client animation sequence (bounce 300ms, number scroll 200ms), no queue occupation, no WebSocket start event, immediate completion notification |
| Timed upgrade path (03-03b) | Separated into dedicated sub-step: server transaction (validate->deduct->create task), queue slot occupation, progress bar animation, panel state switch, WebSocket upgrade_started event |
| One-click max-level details | Added 4-step calculation algorithm, confirmation dialog layout with per-level breakdown, queue space consideration (instant vs timed split), snapshot-based resource calculation, edge cases for main city level cap and resource change during dialog |
| Upgrade failure paths | Added 3-level failure handling: L1 (retry 3x with exponential backoff), L2 (server error with error code + retry button), L3 (version conflict with forced refresh). Added optimistic locking via version field |
| Completion notification | Added global notification center entry, Tab Badge with red dot + count, navigation icon badge when not on building page. Added main city completion cascade: queue slot expansion with animation, global resource bonus refresh, building unlock check |
| Optimistic locking | Added If-Match: {version} header on upgrade requests, 409 Conflict handling with auto-refresh |

**Exception count**: 14 (R3) -> 25 (R4), added 11 new edge cases

### FL-BLD-06 Upgrade Queue Management (v2 -> v4)

**Steps**: Restructured from 5 to 7 steps (06-01 through 06-07)

| Area | What was added |
|------|---------------|
| Queue slot expansion (06-06) | New step: expansion rules (Lv5->6, Lv10->11, Lv20->21), immediate availability, blue ring animation 300ms, auto-assignment of waiting tasks, cascade with auto-upgrade trigger |
| Cancel upgrade flow (06-04) | Full L3+ detail with state distinction: active cancel (80% refund + confirmation dialog with resource breakdown) vs waiting cancel (100% refund + simplified dialog). Added refund calculation formula |
| Speed-up flow (06-03) | 3 methods with complete specs: copper (fee formula, 30% reduction, unlimited use), destiny (1 point, 50% reduction, 3x/day cap, acquisition sources), gems (fee formula, instant completion). Added multi-acceleration stacking rules, 300ms cooldown, smooth progress bar transition |
| Auto-upgrade flow (06-05) | Complete trigger condition checklist, 4-step building selection algorithm (filter->sort->select->execute), priority sorting rules, exclusion list management panel, auto-upgrade log, silent skip on insufficient resources |
| Queue item states (06-06) | State machine: waiting->active->completing->completed with ASCII diagram, state duration specs, multi-task parallel execution rules, FIFO waiting queue, slot-based task assignment |
| Multiple queue items (06-06) | Independent per-slot execution, completion-triggered slot release + next task assignment (500ms delay), one-click max-level batch queue handling |
| Offline queue settlement (06-07) | New step: 4-step simulation algorithm, 1.2x efficiency coefficient application (time only, not resources), cascade handling (main city upgrade -> slot expansion -> continue simulation), settlement report dialog with completed/in-progress/waiting sections, 72-hour cap |

**Exception count**: 3 (R3) -> 17 (R4), added 14 new edge cases

## Completeness Check

### User Perception Coverage

| Step | See | Act | Feedback | Status |
|------|-----|-----|----------|--------|
| 03-01 Preview | Covered | Covered | Covered | Complete |
| 03-02 Validate | Covered | Covered | Covered | Complete |
| 03-03 Execute (instant) | Covered | Covered | Covered | Complete |
| 03-03 Execute (timed) | Covered | Covered | Covered | Complete |
| 03-04 In-progress | Covered | Covered | Covered | Complete |
| 03-05 Completion | Covered | Covered | Covered | Complete |
| 03-06 One-click max | Covered | Covered | Covered | Complete |
| 06-01 Queue float | Covered | Covered | Covered | Complete |
| 06-02 Queue detail | Covered | Covered | Covered | Complete |
| 06-03 Speed-up | Covered | Covered | Covered | Complete |
| 06-04 Cancel | Covered | Covered | Covered | Complete |
| 06-05 Auto-upgrade | Covered | Covered | Covered | Complete |
| 06-06 Slot expansion | Covered | Covered | Covered | Complete |
| 06-07 Offline settle | Covered | Covered | Covered | Complete |

### Exception Path Coverage

| Exception Type | FL-BLD-03 | FL-BLD-06 |
|---------------|:---------:|:---------:|
| Network timeout | E-03-07/08 | E-06-05/10 |
| Server error (5xx) | E-03-09 | E-06-12 |
| Version conflict (409) | E-03-10 | -- |
| Resource insufficient | E-03-01 | E-06-01/02/03/11 |
| Queue full | E-03-03 | E-06-14 |
| Concurrent operation | E-03-06/11 | E-06-06 |
| Client/server mismatch | E-03-02 | E-06-17 |
| WebSocket disconnect | E-03-12 | -- |
| Client crash | E-03-14 | -- |
| Max level reached | E-03-04 | -- |
| Prerequisite fail | E-03-05 | -- |
| Cancel during completion | -- | E-06-04/09 |
| Auto-upgrade failure | -- | E-06-11/12/13 |
| Offline edge cases | -- | E-06-15/16 |

### Cross-Flow References

| From Flow | To Flow | Reference Point |
|-----------|---------|----------------|
| FL-BLD-03-05 | FL-BLD-06 | Main city upgrade -> queue slot expansion |
| FL-BLD-06-04 | FL-BLD-06-05 | Cancel -> auto-upgrade trigger check |
| FL-BLD-06-06 | FL-BLD-06-05 | Slot expansion -> auto-upgrade trigger |
| FL-BLD-06-07 | FL-BLD-03-05 | Offline main city completion -> cascade |

## Metrics

| Metric | FL-BLD-03 (R3) | FL-BLD-03 (R4) | FL-BLD-06 (R3) | FL-BLD-06 (R4) |
|--------|:--------------:|:--------------:|:--------------:|:--------------:|
| Steps | 6 | 8 (incl sub-steps) | 5 | 7 |
| Exception IDs | 14 | 25 | 3 | 17 |
| Lines of doc | ~326 | ~580 | ~127 | ~620 |
| Timing specs | Partial | Full (every step) | Partial | Full (every step) |
| Spatial specs | Partial | Full (every step) | Partial | Full (every step) |
