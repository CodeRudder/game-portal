# Round 6 Report -- BLD Tavern Recruitment Flow Deepening

> **Date**: 2026-05-05
> **Scope**: FL-BLD-07 (Tavern Hero Recruitment)
> **Version**: v2 -> v3

## Summary

Deepened FL-BLD-07 from L2 to full L3+ depth across all 7 steps + 8 sub-steps, covering every edge case specified in the R6 task. The flow now has complete user perception triples (see->act->feedback), system behaviors, timing specs, spatial specs, and exception branches for every step. Major additions include: per-rarity animation specs with exact durations, probability breakdown tooltip with multiplicative formula visualization, 3-level network failure handling, pity counter display rules, free daily advanced recruit lifecycle, recruitment history filtering, tavern level unlock progression, resource shortage handling with deficit display, and duplicate hero conversion.

## Changes by Step

### FL-BLD-07-01 Enter Recruitment Tab (deepened)

| Area | What was added |
|------|---------------|
| Data loading detail | Added explicit API endpoint `GET /api/tavern/recruit/state` with response fields (card pool, probability, pity counter, free count, history summary) |
| Level-based UI rendering | Added explicit rules: Lv<6 shows advanced locked, Lv<11 hides friend recruit entirely, all based on tavern level |
| Optimistic UI | Added cached state display on tab switch with 300ms transition on data change |
| Timing breakdown | Added: data request 200-500ms (first) / <100ms (cached), tab animation 150ms, total <300ms to interactive |
| Spatial specs | Added: D area 420x696px, content area 420x520px, each type card ~396x120px, bottom buttons 120x44px each |

### FL-BLD-07-02 View Recruitment Types and Probabilities (significantly expanded)

| Area | What was added |
|------|---------------|
| 07-02a Three recruitment type overview | NEW sub-step: complete overview of all 3 types with probability bars, free count labels, pity progress bars |
| Probability bar rendering | Added: horizontal stacked bar chart (360x24px) with exact color values per quality (#ccc/#27ae60/#3498db/#9b59b6/#e67e22) |
| Quality pool restrictions per type | Added: normal = white/green/blue/purple only, advanced = blue/purple/orange only, friend = white/green/blue only |
| Locked state for unreleased types | Added: semi-transparent gray overlay + lock icon + "Unlocks at Tavern LvXX" text |
| Pity progress bar | Added: 360x8px gold progress bar showing X/50 count (only visible when Lv16+) |
| 07-02b Probability detail Tooltip | NEW sub-step: complete tooltip with multiplicative formula breakdown per quality tier |
| Formula breakdown display | Added: step-by-step calculation showing base_rate x (1+tavern%) x (1+tech%) x (1+int%) = final_rate |
| Mobile Tooltip adaptation | Added: Bottom Sheet (40% height) on mobile instead of floating tooltip |
| Tooltip timing | Added: 120ms entrance animation (scale 0.95->1.0 + opacity 0->1) |

### FL-BLD-07-03 Select Recruitment Type (deepened)

| Area | What was added |
|------|---------------|
| Button visual states | Added: normal state, free-available state (green border + "Free" badge), locked state (opacity 0.4 + tooltip) |
| Free advanced recruit badge | Added: green border + sparkle icon + strikethrough price text when free count available |
| Double-click protection | Added: 300ms cooldown on button click |
| Press feedback | Added: 100ms scale 0.95 press animation |

### FL-BLD-07-04 Validate Recruitment Conditions (significantly expanded)

| Area | What was added |
|------|---------------|
| 07-04a Frontend pre-validation | NEW sub-step: complete frontend validation with priority order (tavern level -> resources -> free count -> card pool) |
| 07-04b Server complete validation | NEW sub-step: server validation with API spec `POST /api/tavern/recruit/validate`, 6-condition priority check |
| Optimistic lock | Added: player_version check as #1 priority on server |
| Daily recruit limit | Added: anti-abuse limits (normal 100/day, advanced 50/day, friend 100/day) |
| Resource deficit display | Added: exact deficit amount in toast with quick-navigation buttons ([Go to Market], [Go to Shop], [Recharge]) |
| Server response format | Added: complete success/failure JSON response examples |
| Version conflict handling | Added: 409 response -> force refresh player state -> re-validate |

### FL-BLD-07-05 Execute Recruitment (significantly expanded)

| Area | What was added |
|------|---------------|
| 07-05a Server recruitment transaction | NEW sub-step: complete 6-step atomic transaction detail (lock -> deduct -> pity check -> random quality -> select hero -> create instance) |
| API spec | Added: `POST /api/tavern/recruit/execute` with complete request/response JSON |
| Duplicate hero handling | Added: already-owned heroes convert to "hero shards x30" (awakening material), marked in result display |
| Pity trigger behavior | Added: counter resets to 0, result marked with `pityTriggered: true` |
| Free count usage | Added: server marks free count as used, client updates free label to gray |
| Client state update | Added: explicit list of local cache updates (resource balance, pity counter, free count) |
| 07-05b Network failure 3-level handling | NEW sub-step: complete L1/L2/L3 escalation handling |
| L1 auto-retry | Added: 3 retries with exponential backoff (1s/2s/3s), toast "Network unstable, retrying..." |
| L2 result query | Added: `GET /api/tavern/recruit/last-result` to recover potentially completed recruitment |
| L3 forced refresh | Added: `GET /api/player/state` full state sync, resource balance comparison to determine outcome |
| Data integrity guarantee | Added: no resource loss, no result miss, no double deduction |

### FL-BLD-07-06 Recruitment Animation and Result Display (significantly expanded)

| Area | What was added |
|------|---------------|
| 07-06a Quality animation | NEW sub-step: complete per-rarity animation specs with exact durations |
| White (0ms) | Instant display, no animation |
| Green (1.0s) | Card area micro-flash (300ms) -> slight shake (200ms) -> flip reveal (500ms) |
| Blue (2.0s) | Content area light diffusion (600ms) -> card flip (800ms) -> quality glow (600ms) |
| Purple (3.0s) | Full-screen purple overlay (300ms) -> particles converge (1200ms) -> card rise + flip (1000ms) -> purple ring (500ms) |
| Orange (5.0s) | Full-screen gold explosion (500ms) -> dragon/phoenix pattern (1000ms) -> screen shake 4px (200ms) -> card rise + gold pillar (2000ms) -> gold particles + SFX (1300ms) |
| Animation resource preloading | Added: white/green/blue preloaded on tab enter, purple/orange loaded on-demand (~200KB each) |
| Animation resource failure | Added: degrade to instant display (0ms) with toast |
| Mobile animation compression | Added: 20% duration reduction, no screen shake (replaced by flash) |
| UI interaction blocking | Added: all clicks disabled during animation, button stays disabled |
| 07-06b Hero card reveal | NEW sub-step: complete card layout with hero portrait, quality border, attributes, skills, duplicate marker |
| Hero portrait loading | Added: preloading starts when server responds, quality-color placeholder if not loaded |
| Duplicate hero display | Added: "[Already Owned] -> Convert to Shards x30" marker on card |
| 07-06c Result confirmation and navigation | NEW sub-step: confirm/redirect behavior |
| Cross-system navigation | Added: [View Details] -> close tavern panel -> open hero system detail page with heroId params |
| Pity trigger toast | Added: "Pity triggered! Counter reset" toast on confirm |
| Button state recovery | Added: button must be immediately re-enabled after confirm |

### FL-BLD-07-07 View Recruitment Records (deepened)

| Area | What was added |
|------|---------------|
| API endpoint | Added: `GET /api/tavern/recruit/history?limit=50` |
| Filtering | Added: type filter (All/Normal/Advanced/Friend) + quality filter (All/White/Green/Blue/Purple/Orange), AND relationship |
| Local filtering | Added: client-side filter, no re-request, <50ms switch |
| New record auto-insert | Added: new records auto-prepend to list head without refresh |
| Empty list | Added: "No recruitment records yet" placeholder |
| Record expandable | Added: tap record to expand hero attribute snapshot |
| Mobile layout | Added: full-screen Bottom Sheet, 396x48px per record, horizontally scrollable filter tabs |

### Tavern Level Effects Section (NEW)

| Area | What was added |
|------|---------------|
| Level unlock table | Complete table: Lv1-5 (normal only), Lv6-10 (+advanced +daily free), Lv11-15 (+friend), Lv16-20 (+pity) |
| Level-up panel refresh | Added: behavior when tavern levels up while on recruit tab (unlock animation: lock shatter 200ms + card fade-in 300ms) |
| Off-tab level-up | Added: red dot on overview tab, animation plays when switching to recruit tab |

## Exception Flow Expansion

**Before (R2)**: 4 exception IDs (E-07-01 through E-07-04)
**After (R6)**: 17 exception IDs (E-07-01 through E-07-17)

New exceptions added:
- E-07-03: Gem insufficient (advanced, non-free) with [Recharge] button
- E-07-05: Tavern level insufficient (explicit per-type check)
- E-07-06: Card pool empty (with refresh hint)
- E-07-07: Daily recruit limit exhausted (with reset time hint)
- E-07-08: Version conflict (409) with forced refresh
- E-07-09: Server transaction failure with auto-rollback
- E-07-10: L1 network timeout with auto-retry
- E-07-11: L2 result query success (skip animation, show result)
- E-07-12: L2 result query confirmed failure
- E-07-13: L3 forced refresh with resource balance comparison
- E-07-14: Animation resource load failure (degrade to instant)
- E-07-15: Hero portrait load failure (placeholder)
- E-07-16: Free/non-free button state transition
- E-07-17: Tavern level-up unlocks new recruit type

## Metrics

| Metric | FL-BLD-07 (R2/v2) | FL-BLD-07 (R6/v3) |
|--------|:-----------------:|:-----------------:|
| Steps | 7 | 7 |
| Sub-steps | 0 | 8 (02a, 02b, 04a, 04b, 05a, 05b, 06a, 06b, 06c) |
| Exception IDs | 4 | 17 |
| Lines of doc | ~157 | ~520 |
| Timing specs | Partial (2 steps) | Full (every step) |
| Spatial specs | Partial (1 step) | Full (every step) |
| Mobile detail | Minimal (1 mention) | Full (every step) |
| API endpoints | 0 | 5 (state, validate, execute, last-result, history) |

## Cross-Flow References

| From Flow | To Flow | Reference Point |
|-----------|---------|----------------|
| FL-BLD-07-06b [View Details] | Hero System | Cross-system navigation with heroId |
| FL-BLD-07-04a [Go to Market] | FL-BLD-?? (Market) | Resource shortage quick-nav |
| FL-BLD-07-05a | Hero System | Hero instance creation / shard conversion |
| FL-BLD-07-01 | FL-BLD-02 (Tavern Upgrade) | Level-up triggers panel refresh |
| FL-BLD-07-05a | FL-BLD-?? (Shop) | Scroll/token purchase flow |
