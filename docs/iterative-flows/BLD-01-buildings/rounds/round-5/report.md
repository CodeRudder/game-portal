# Round 5 Report -- BLD Building Build Flow Deepening

> **Date**: 2026-05-05
> **Scope**: FL-BLD-04 (Build New Building)
> **Version**: v5 -> v6

## Summary

Deepened FL-BLD-04 from L3 to full L3+ depth across all 7 steps, covering every edge case specified in the R5 task. The flow now has complete user perception triples (see->act->feedback), system behaviors, timing specs, spatial specs, and exception branches for every step. Major additions include: build cancellation flow, build-in-progress interaction, unlock chain triggers, first-build tutorial, decorative state conversion, and network failure 3-level handling.

## Changes by Step

### FL-BLD-04-01 Empty Plot Interaction (deepened)

| Area | What was added |
|------|---------------|
| Empty plot state transitions | Added explicit enter/exit conditions for all 3 states (buildable, locked, decorative). Added state determination algorithm (pseudocode). Locked->buildable transition on main city level-up with lock-chain-breaking animation (350ms) |
| Build-in-progress plot | Clicking a building-in-progress plot now shows a build status panel (not the build selection popup). Added dedicated sub-path 04-04b |
| Mobile Bottom Sheet behavior | Added drag-to-resize (65%/90% snap points), velocity-based close gesture, overshoot bounce, elastic rebound on incomplete drag |
| Double-click protection | Added 300ms cooldown with pressed state visual |
| Popup already open | Added handling for clicking another plot while popup is open (blocked by mask) |

### FL-BLD-04-02 Browse & Filter Build List (deepened)

| Area | What was added |
|------|---------------|
| Queue-full distinction | Queue-full items now show as orange with "queue full" label (distinct from resource-insufficient orange). No quick-buy button for queue-full items |
| Search loading indicator | Added 12px spinner in search box during 200ms debounce |
| Search highlight | Matching text highlighted with gold background |
| Quick-buy gem conversion table | Added explicit per-resource conversion ratios with ceil formula and multi-resource summation example |
| Bottom gradient | Added scrollable list bottom gradient mask (20px) |
| Resource change during popup | Added handling for resource changes while popup is open (silent status refresh, no list rebuild) |
| Search cleared on close | Added explicit state cleanup behavior |

### FL-BLD-04-03 Build Validation (deepened)

| Area | What was added |
|------|---------------|
| Server validation priority reordered | Version check moved to #1 priority (was #5). Position check added as #6 |
| Build cost reference table | Added explicit cost for all 10 buildings from PRD Lv.0->Lv.1 data |
| Resource deficit calculation formula | Added pseudocode for per-resource deficit and total gem conversion |
| Network failure 3-level handling | Complete L1/L2/L3 specification with retry intervals, error dialogs, forced refresh |
| Front-end secondary pre-check | Added explicit behavior: if secondary check fails, skip server request entirely |
| Error code retry strategy | Added per-error-code retry strategy column (L3/no-retry) |
| App background during request | Added handling: request continues, refresh on return |

### FL-BLD-04-04 Execute Build (significantly expanded)

| Area | What was added |
|------|---------------|
| 04-04a Build execution main flow | Complete server atomic operation detail (6-step transaction), client response handling, player_version update |
| Build time reference table | Added all 10 buildings with exact build time (5s-30s) and resource costs from PRD |
| Build-in-progress state detail | Added explicit build-in-progress visual: blue border, blue background, hammer animation, progress bar, countdown text |
| 04-04b Build-in-progress interaction | NEW sub-step: clicking building-in-progress plot shows status panel (200x140px PC float, 40% Bottom Sheet mobile) with progress, countdown, speed-up, and cancel buttons |
| 04-04c Build cancellation flow | NEW sub-step: complete cancel flow with confirmation dialog (280x200px), resource breakdown (80% return with floor calculation), server atomic cancel operation, client animation sequence |
| Cancel timing edge cases | Added handling for cancel during completion moment (BUILD_ALREADY_DONE), short build time warning |

### FL-BLD-04-05 Build Completion Feedback (significantly expanded)

| Area | What was added |
|------|---------------|
| 04-05a Birth animation | Detailed 7-step animation sequence with exact durations, mobile compression (20% faster), optimistic UI pattern |
| 04-05b Unlock chain trigger | NEW sub-step: complete unlock chain per building type (barracks->formation, workshop->equipment, academy->tech, tavern->hero, wall->defense), Tab Badge red dot, notification center entry |
| 04-05c First build tutorial | NEW sub-step: complete tutorial bubble layout (280x100px), per-building customized guidance text (6 variants), tutorial_disabled global flag, mobile Bottom Sheet variant |
| Server confirmation delay | Added "syncing..." overlay for >5s confirmation delay |
| Completion while on other page | Added delayed birth animation on return, global notification center entry |
| Completion while app in background | Added system push notification (if authorized), auto-refresh on return |

### FL-BLD-04-06 Close Popup (deepened)

| Area | What was added |
|------|---------------|
| Close trigger detail | Explicit listing of all close triggers for PC and mobile |
| Velocity-based close | Added fast swipe close on mobile (velocity > 1px/ms) |
| Animation lock | Added 200ms animation lock to prevent close/open conflicts |
| State cleanup | Explicit: clear search, reset filter to [All], collapse all expanded items |
| Mid-drag cancel on mobile | Added elastic rebound animation (200ms ease-out) |

### FL-BLD-04-07 All Buildings Built / Decorative State (NEW)

| Area | What was added |
|------|---------------|
| Complete step | Previously only listed in flow structure (no content). Now a full L3+ step |
| Transition animation | 5-step sequence (500ms total): gold flash, dashed border fade-out, landscape icon fade-in+scale, thin border fade-in, glow pulse start |
| Landscape icon pool | 10 unique icons with non-adjacent repeat rule |
| Environment animation pool | 5 animations (butterfly, falling leaves, fireflies, petals, glimmer) with durations |
| Environment animation scheduler | 60s+0-10s random jitter interval, single-animation-at-a-time rule |
| Mobile adaptation | Simplified animation (fade-in only), 120s interval, compact 355x40px list items |
| Performance degradation | Auto-downgrade on mobile performance issues |

## Exception Flow Expansion

**Before (R3)**: 10 exception IDs (E-04-01 through E-04-10)
**After (R5)**: 21 exception IDs (E-04-01 through E-04-21)

New exceptions added:
- E-04-11: Version conflict (409) with forced refresh
- E-04-12: Target position already occupied
- E-04-13: Build cancel request failure
- E-04-14: Cancel during completion moment
- E-04-15: Quick-buy gem insufficient
- E-04-16: Building appearance resource load failure
- E-04-17: Last building completion (triggers decorative state)
- E-04-18: Completion while user on other page
- E-04-19: Completion while app in background
- E-04-20: Mobile mid-drag cancel rebound
- E-04-21: Main city level-up unlocks new plots

## Metrics

| Metric | FL-BLD-04 (R3/v5) | FL-BLD-04 (R5/v6) |
|--------|:-----------------:|:-----------------:|
| Steps | 7 (1 empty) | 7 (all complete) |
| Sub-steps | 2 (03a, 03b) | 8 (03a, 03b, 04a, 04b, 04c, 05a, 05b, 05c) |
| Exception IDs | 10 | 21 |
| Lines of doc | ~452 | ~852 |
| Timing specs | Partial | Full (every step) |
| Spatial specs | Partial | Full (every step) |
| Mobile detail | Partial | Full (every step) |

## Cross-Flow References

| From Flow | To Flow | Reference Point |
|-----------|---------|----------------|
| FL-BLD-04-04a | FL-BLD-06 | Build task shared queue slot |
| FL-BLD-04-04c | FL-BLD-06-04 | Cancel build = cancel upgrade (80% refund) |
| FL-BLD-04-05a | FL-BLD-06 | Queue auto-advance on completion |
| FL-BLD-04-05b | FL-BLD-07/08/09/10/11/12/13 | Unlock chain to subsystems |
| FL-BLD-04-07 | FL-BLD-02 | Decorative state changes grid browsing |
