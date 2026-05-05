# Round 5 Issues -- BLD Build Flow Deepening

> **Date**: 2026-05-05
> **Reviewer**: Integrator (R5 depth pass)

## Issues Found During R5 Deepening

### P0 Issues (Critical -- Fixed in-place during R5)

| ID | Flow | Step | Issue | Fix Applied |
|----|------|------|-------|-------------|
| R5-01 | FL-BLD-04 | 04-04 | Build cancellation flow completely absent -- R5 constraints mentioned "build cancel returns 80% resources" but no step detail existed. No cancel confirmation dialog, no server cancel API, no client animation sequence | Added new sub-step 04-04c: complete cancel flow with confirmation dialog (280x200px), resource breakdown, server atomic cancel operation, client animation sequence (progress bar disappear 100ms + dashed border restore 150ms) |
| R5-02 | FL-BLD-04 | 04-04 | Build-in-progress interaction missing -- clicking a building-in-progress empty plot had no specified behavior. Only said "opens build status panel" in exception table of 04-01 but no panel spec existed | Added new sub-step 04-04b: build status panel (200x140px PC float, 40% Bottom Sheet mobile) with progress, countdown, speed-up, and cancel buttons |
| R5-03 | FL-BLD-04 | 04-05 | Unlock chain trigger completely absent -- no specification for what happens when a building that unlocks a new system completes construction. Missing subsystem unlock notifications, Tab Badge updates, production start triggers | Added new sub-step 04-05b: complete unlock chain per building type (barracks->formation, workshop->equipment, academy->tech, tavern->hero, wall->defense), Tab Badge red dot, notification center entry, production start |
| R5-04 | FL-BLD-04 | 04-05 | First-build tutorial completely absent -- R5 constraints mentioned "tutorial guidance bubble for first building" but no layout, content, or behavior was specified | Added new sub-step 04-05c: tutorial bubble (280x100px PC), per-building customized guidance text (6 variants), [Got it]/[Don't show again] buttons, tutorial_disabled global flag, mobile Bottom Sheet variant |
| R5-05 | FL-BLD-04 | 04-07 | Decorative state step was listed in flow structure but had zero content -- no transition animation, no landscape icons, no environment animations, no interaction rules | Added complete L3+ step: 5-step transition animation (500ms), 10-landscape icon pool with non-adjacent repeat, 5 environment animations, 60s+jitter scheduler, mobile adaptation, performance degradation |
| R5-06 | FL-BLD-04 | 04-03 | Network failure 3-level handling mentioned in R5 constraints but not detailed in any step -- no L1 auto-retry specs, no L2 error dialog layout, no L3 forced refresh flow | Added complete 3-level network failure handling in 04-03b: L1 (auto-retry 3x with exponential backoff 1s/2s/3s), L2 (error dialog 200x120px with error code + retry button), L3 (forced refresh GET /api/player/state) |

### P1 Issues (Fixed in-place during R5)

| ID | Flow | Step | Issue | Fix Applied |
|----|------|------|-------|-------------|
| R5-07 | FL-BLD-04 | 04-01 | Empty plot state transitions not formalized -- no enter/exit conditions, no algorithm for determining state, locked->buildable transition had no animation spec | Added state determination algorithm (pseudocode), explicit enter/exit conditions for all 3 states, locked->buildable transition animation (lock-chain break 200ms + dashed gold 150ms = 350ms) |
| R5-08 | FL-BLD-04 | 04-01 | Mobile Bottom Sheet behavior underspecified -- no drag-to-resize, no velocity-based close, no snap points, no elastic rebound | Added drag-to-resize with 65%/90% snap points, velocity-based close (velocity > 1px/ms triggers close even if < 80px drag), elastic rebound on incomplete drag, overshoot 5% bounce |
| R5-09 | FL-BLD-04 | 04-02 | Queue-full items indistinguishable from resource-insufficient items -- both showed as orange but reasons and available actions differ | Added queue-full item visual distinction: shows "queue full" label instead of resource deficit, no [Quick Buy] button, orange button text differs |
| R5-10 | FL-BLD-04 | 04-02 | Quick-buy gem conversion formula not explicit -- no per-resource ratios, no ceil/floor specification, no multi-resource example | Added explicit conversion table: 1 gem = 100 grain / 80 copper / 60 ore / 60 wood, ceil per resource, sum across resources. Added example: 200 grain + 100 copper = 2+2 = 4 gems |
| R5-11 | FL-BLD-04 | 04-03 | Server validation priority order incorrect -- version check was #5 but should be #1 (prevent wasted computation on stale data). Position check was missing entirely | Reordered: version check -> global unique -> main city level -> resources -> queue slot -> position. Added position check as #6 |
| R5-12 | FL-BLD-04 | 04-04 | Build time and cost for each building not specified -- only said "5-30 seconds, check PRD" with no concrete data | Added complete build time reference table with all 10 buildings: exact build time (5s-30s) and resource costs from PRD Lv.0->Lv.1 data |
| R5-13 | FL-BLD-04 | 04-05 | Birth animation sequence incomplete -- only described as "3 steps in 800ms" without detailed sub-step durations | Expanded to 7-step animation sequence with exact durations per step, mobile compression (20% faster = ~640ms), optimistic UI pattern |
| R5-14 | FL-BLD-04 | 04-05 | No handling for completion while user is on another page or app is in background | Added: completion on other page -> global notification center + Tab Badge red dot + delayed birth animation on return. Completion in background -> system push notification + auto-refresh on return |
| R5-15 | FL-BLD-04 | 04-06 | Mobile close behavior underspecified -- no velocity-based close, no elastic rebound on incomplete drag, no search state cleanup | Added velocity-based close, elastic rebound, explicit state cleanup (clear search, reset filter, collapse items) |

### P2 Issues (Noted, deferred to R6+)

| ID | Flow | Issue | Rationale |
|----|------|-------|-----------|
| R5-P2-01 | FL-BLD-04 | Build cost uses PRD Lv.0->Lv.1 upgrade cost as "build cost" -- this is an interpretation. PRD BLD-2 shows upgrade tables starting from Lv.1->Lv.2, not Lv.0->Lv.1. Need PRD clarification on whether build cost = first upgrade cost or a separate cost table | Needs PRD alignment |
| R5-P2-02 | FL-BLD-04 | Quick-buy gem conversion ratios (1 gem = 100 grain / 80 copper / 60 ore / 60 wood) are assumed values not in PRD. Actual conversion rates should be confirmed with game design | Needs game design confirmation |
| R5-P2-03 | FL-BLD-04 | Build cancel returns 80% resources with floor() per resource -- what happens if floor() reduces a resource to 0 for a resource that was partially consumed? Player might perceive unfairness | Minor UX edge case, needs game balance review |
| R5-P2-04 | FL-BLD-04 | First-build tutorial shows once globally -- but players who skip tutorial and later build their first解锁-building might miss important system guidance. Consider per-system first-time tutorials | UX enhancement, can be added post-launch |
| R5-P2-05 | FL-BLD-04 | Decorative state environment animation timer (60s+0-10s jitter) continues even when building page is not visible. Should pause when page is hidden for performance | Performance optimization, can be addressed during implementation |
| R5-P2-06 | FL-BLD-04 | Build-in-progress status panel (04-04b) shows speed-up button but speed-up behavior for build tasks is not detailed. Assumes same speed-up methods as upgrade (copper/destiny/gem) via FL-BLD-06-03 | Needs cross-reference validation with FL-BLD-06 |

## Completeness Check Results

### Scenario Coverage

| Scenario | Coverage |
|----------|:--------:|
| Normal build (happy path) | Covered (04-01 through 04-05) |
| Empty plot: buildable state | Covered (04-01 State A) |
| Empty plot: locked state | Covered (04-01 State B) |
| Empty plot: decorative state | Covered (04-01 State C + 04-07) |
| Locked->buildable transition | Covered (04-01) |
| Build selection popup: filter/sort/search | Covered (04-02) |
| Resource-insufficient item: expand + quick-buy | Covered (04-02) |
| Queue-full item distinction | Covered (04-02) |
| Front-end resource pre-check | Covered (04-03a) |
| Server validation (6 conditions) | Covered (04-03b) |
| Network failure: L1 auto-retry | Covered (04-03b) |
| Network failure: L2 server error | Covered (04-03b) |
| Network failure: L3 version conflict | Covered (04-03b) |
| Build execution (server atomic) | Covered (04-04a) |
| Build-in-progress interaction | Covered (04-04b) |
| Build cancellation (80% refund) | Covered (04-04c) |
| Build completion: birth animation | Covered (04-05a) |
| Build completion: unlock chain | Covered (04-05b) |
| Build completion: first-build tutorial | Covered (04-05c) |
| Completion while on other page | Covered (04-05a) |
| Completion while app in background | Covered (04-05a) |
| Close popup (PC/mobile) | Covered (04-06) |
| All buildings built: decorative conversion | Covered (04-07) |
| Optimistic lock conflict | Covered (04-03b) |
| Concurrent build attempt | Covered (04-03b E-04-04) |
| Cancel during completion moment | Covered (04-04c E-04-14) |

### Edge Case Coverage

| Edge Case | Handled In |
|----------|-----------|
| All buildings already built (empty popup) | 04-01 E-04-07 |
| All buildings locked (gray popup) | 04-01 E-04-08 |
| Decorative plot clicked | 04-01 (no response) |
| Build-in-progress plot clicked | 04-04b |
| Popup already open + click another plot | 04-01 (blocked by mask) |
| Double-click protection | 04-01 (300ms cooldown) |
| Main city level-up during popup | 04-01 (unlock animation) |
| Search returns no results | 04-02 |
| Quick-buy with insufficient gems | 04-02 E-04-15 |
| Resource change during popup | 04-02 (silent refresh) |
| Version conflict (409) | 04-03b L3 |
| Position already occupied | 04-03b E-04-12 |
| Front-end pre-check pass but server fails | 04-03b (server wins) |
| Build cancel during completion | 04-04c E-04-14 |
| Short build (>80% progress) cancel warning | 04-04c |
| Server confirm failure | 04-05a E-04-09 |
| Server confirm delay >5s | 04-05a (syncing overlay) |
| Building appearance resource load failure | 04-05 E-04-16 |
| Position occupied (anomaly) | 04-05a (nearest empty slot) |
| Last building completion | 04-05 E-04-17 -> 04-07 |
| Completion while on other page | 04-05 E-04-18 |
| Completion while app in background | 04-05 E-04-19 |
| Mobile mid-drag rebound | 04-06 E-04-20 |
| Mobile decorative animation performance | 04-07 (auto-downgrade) |
