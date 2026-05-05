# Round 3 Issues — BLD Core Flows L3+ Depth Review

> **Date**: 2026-05-05
> **Reviewer**: Integrator (R3 depth pass)

## Issues Found During R3 Deepening

### P1 Issues (Fixed in-place during R3)

| ID | Flow | Step | Issue | Fix Applied |
|----|------|------|-------|-------------|
| R3-01 | FL-BLD-02 | 02-01 | Missing see/act/feedback triple; no skeleton screen detail; no precise timeout values | Added full L3 triple, skeleton animation spec (1.2s pulse), timeout 3s |
| R3-02 | FL-BLD-02 | 02-02 | No exception branches; no precise grid dimension calculation | Added E-02-05/E-02-06, calculated total grid dimensions (1200x828px) |
| R3-03 | FL-BLD-02 | 02-03 | No timing for refresh intervals; no mobile virtual scroll spec; no lock reason distinction | Added per-second refresh, 30s server sync, virtual scroll, lock reason split |
| R3-04 | FL-BLD-02 | 02-04 | Missing space details for tooltip; no edge-position handling | Added tooltip max-width 240px, auto-flip for edge cards |
| R3-05 | FL-BLD-02 | 02-05 | No detail for lock reason split (main level vs prereq); no panel-loading behavior during upgrade | Added two lock types, upgrade-in-progress panel behavior, offline mode |
| R3-06 | FL-BLD-02 | 02-06 | Missing decorative-plot interaction; no empty-state handling for all-built scenario | Added decorative plot spec, all-built empty state |
| R3-07 | FL-BLD-03 | 03-01 | Missing instant-upgrade indicator; no max-level edge case in preview | Added "instant" green label, max-level display |
| R3-08 | FL-BLD-03 | 03-02 | Missing "building already upgrading" check; no server/client mismatch handling | Added upgrade-in-progress check, server-authority rule |
| R3-09 | FL-BLD-03 | 03-03 | No instant vs timed path differentiation; no concurrent resource deduction handling | Added instant path (<=5s) vs timed path (>5s) with distinct UX |
| R3-10 | FL-BLD-03 | 03-04 | No panel behavior during upgrade; no multi-queue display; no reconnection progress recalc | Added panel upgrade-state area, multi-queue display, reconnection handling |
| R3-11 | FL-BLD-03 | 03-05 | No appearance cross-fade animation for tier transitions; no multi-completion handling | Added cross-fade for tier change, sequential completion animation |
| R3-12 | FL-BLD-03 | 03-06 | No detail for confirmation dialog layout/scroll; no resource-change-during-dialog handling | Added dialog 500x480px spec, inner scroll for 6+ levels, resource change alert |
| R3-13 | FL-BLD-04 | 04-01 | No filter/tab for build list; no resource pre-check flow timing | Added filter tab [All/Buildable/Locked], pre-check <50ms |
| R3-14 | FL-BLD-04 | 04-02 | No expand interaction for insufficient-resource items | Added expand detail with shortage amount + acquisition tips |
| R3-15 | FL-BLD-04 | 04-03 | Missing global-uniqueness check priority; no concurrent-build handling | Added uniqueness as priority 1, concurrent build detection |
| R3-16 | FL-BLD-04 | 04-04 | No build-in-progress empty-lot visual spec | Added hammer animation + green progress bar on empty lot |
| R3-17 | FL-BLD-04 | 04-05 | No birth animation sequence detail | Added 3-phase birth animation: fade-out + glow + bounce (800ms total) |
| R3-18 | FL-BLD-04 | 04-06 | No re-open-during-close-edge-case | Added wait-for-close animation before re-open |
| R3-19 | FL-BLD-05 | 05-01 | No precise bubble update frequency; no near-capacity warning color | Added per-second local + 30s server sync, orange warning near cap |
| R3-20 | FL-BLD-05 | 05-02 | No animation timeline sequence; no concurrent-already-collected handling | Added precise 6-phase timeline, concurrent collection response |
| R3-21 | FL-BLD-05 | 05-03 | No Bezier curve spec; no stagger timing; no arrival burst effect | Added curve spec, 80ms stagger, burst particle effect |
| R3-22 | FL-BLD-05 | 05-04 | No overflow detail per resource; no VIP3+ offline auto-collect flow | Added per-resource overflow display, VIP3+ offline income dialog |

### P2 Issues (Noted, deferred to R4+)

| ID | Flow | Issue | Rationale |
|----|------|-------|-----------|
| R3-P2-01 | FL-BLD-03 | Queue cancel flow not in this flow's scope (belongs to FL-BLD-06) | Queue management is a separate sub-flow |
| R3-P2-02 | FL-BLD-03 | Acceleration options (copper/destiny/gems) not detailed here | Belongs to FL-BLD-06 queue acceleration flow |
| R3-P2-03 | FL-BLD-04 | Build-cost formula "same as Lv.0->Lv.1" needs explicit table reference | PRD table alignment check deferred |
| R3-P2-04 | FL-BLD-05 | VIP3+ offline auto-collect trigger timing needs server event spec | Depends on offline system design |
| R3-P2-05 | FL-BLD-02 | Mobile list left-swipe menu behavior not fully specified for all building states | Belongs to FL-BLD-14 mobile adaptation |
| R3-P2-06 | FL-BLD-03 | One-click max-level: what happens if player levels up main city mid-batch? | Rare edge case, needs server atomic guarantee |
| R3-P2-07 | FL-BLD-05 | Collection animation: what if player navigates away mid-animation? | Animation should complete but not block navigation |

## Completeness Check Results

### Scenario Coverage

| Scenario | FL-BLD-02 | FL-BLD-03 | FL-BLD-04 | FL-BLD-05 |
|----------|:---------:|:---------:|:---------:|:---------:|
| Normal flow (happy path) | Covered | Covered | Covered | Covered |
| Locked building interaction | Covered (02-05) | N/A | N/A | N/A |
| Empty plot types | Covered (02-06) | N/A | N/A | N/A |
| Upgrade-in-progress state | Covered (02-03/05) | Covered (03-04) | N/A | N/A |
| Instant vs timed upgrade | N/A | Covered (03-03) | N/A | N/A |
| One-click max-level | N/A | Covered (03-06) | N/A | N/A |
| Build filtering/selection | N/A | N/A | Covered (04-01/02) | N/A |
| Build-in-progress visual | N/A | N/A | Covered (04-04) | N/A |
| Birth animation | N/A | N/A | Covered (04-05) | N/A |
| Collection animation timing | N/A | N/A | N/A | Covered (05-03) |
| Resource overflow | N/A | N/A | N/A | Covered (05-04) |
| VIP3+ auto-collect | N/A | N/A | N/A | Covered (05-04) |
| Network failure | Covered | Covered | Covered | Covered |
| Double-click protection | Covered | Covered | Covered | Covered |
| Mobile adaptation | Covered | Covered | Covered | Covered |

### Exception Path Coverage

| Exception Type | FL-BLD-02 | FL-BLD-03 | FL-BLD-04 | FL-BLD-05 |
|---------------|:---------:|:---------:|:---------:|:---------:|
| Network timeout | E-02-01/03 | E-03-08 | E-04-06 | E-05-03 |
| Server maintenance | E-02-02 | -- | -- | -- |
| Data anomaly | E-02-04/05/06 | E-03-06/10 | E-04-04/09/10 | E-05-04 |
| Resource insufficient | -- | E-03-01 | E-04-02 | -- |
| Queue full | -- | E-03-03 | E-04-03 | -- |
| Concurrent operation | -- | E-03-06 | E-04-04 | E-05-04 |
| Client/server mismatch | -- | E-03-06 | E-04-10 | E-05-01 |
| Low-end device | -- | -- | -- | E-05-06 |
| Max level reached | -- | E-03-04 | -- | -- |
| All overflow | -- | -- | -- | E-05-07 |

### State Transitions

| Transition | Defined In |
|-----------|-----------|
| Normal -> Upgrading | FL-BLD-03-03 (300ms border gradient) |
| Upgrading -> Complete | FL-BLD-03-05 (bounce + cross-fade) |
| Normal -> Upgradeable | FL-BLD-02-03 (300ms border gradient) |
| Locked -> Built | FL-BLD-04-05 (birth animation 800ms) |
| Empty -> Building | FL-BLD-04-04 (hammer + progress bar) |
| Collecting -> Collected | FL-BLD-05-04 (number animation) |

### Edge Cases

| Edge Case | Handled In |
|----------|-----------|
| First entry with no cache | FL-BLD-02-01 (E-02-03) |
| All buildings already built | FL-BLD-02-06 / FL-BLD-04-01 (E-04-07) |
| All buildings locked | FL-BLD-04-01 (E-04-08) |
| Multiple upgrades complete simultaneously | FL-BLD-03-05 (E-03-11) |
| Resource changes during one-click dialog | FL-BLD-03-06 (E-03-13) |
| Grid position conflict on build complete | FL-BLD-04-05 (E-04-09) |
| All resources overflow on collect | FL-BLD-05-04 (E-05-07) |
| WebSocket disconnect during upgrade | FL-BLD-03-04 (E-03-09) |
| Building already upgrading when clicked | FL-BLD-03-02 (E-03-06) |
