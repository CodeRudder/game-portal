# Round 6 Issues -- BLD Tavern Recruitment Flow Deepening

> **Date**: 2026-05-05
> **Reviewer**: Integrator (R6 depth pass)

## Issues Found During R6 Deepening

### P0 Issues (Critical -- Fixed in-place during R6)

| ID | Flow | Step | Issue | Fix Applied |
|----|------|------|-------|-------------|
| R6-01 | FL-BLD-07 | 07-05 | Network failure handling was superficial -- original said "server rollback + client reconnect query" but no L1/L2/L3 escalation, no retry intervals, no result recovery API, no resource balance comparison | Added complete 3-level network failure handling in 07-05b: L1 auto-retry 3x (1s/2s/3s backoff), L2 result query via `GET /api/tavern/recruit/last-result`, L3 forced refresh via `GET /api/player/state` with resource balance comparison |
| R6-02 | FL-BLD-07 | 07-06 | Recruitment animation had no per-rarity spec -- only said "1-2s animation" and "rare heroes have special effects" with no quality-specific durations, no animation breakdown, no resource loading strategy | Added complete 07-06a sub-step: 5-tier animation spec (white 0ms / green 1.0s / blue 2.0s / purple 3.0s / orange 5.0s) with per-phase breakdown, resource preloading strategy, mobile compression (20% faster), and degradation on load failure |
| R6-03 | FL-BLD-07 | 07-02 | Probability display had no tooltip/detail -- showed "per-tier rates" but no formula breakdown, no multiplicative calculation visualization, no way for player to understand how bonuses stack | Added 07-02b Probability Detail Tooltip: step-by-step multiplicative formula breakdown per quality tier, showing base_rate x (1+tavern%) x (1+tech%) x (1+int%) = final_rate with actual numbers |
| R6-04 | FL-BLD-07 | 07-05 | Duplicate hero handling completely absent -- no spec for what happens when player recruits a hero they already own | Added explicit duplicate handling: already-owned heroes convert to "hero shards x30" (awakening material), displayed in result card with "[Already Owned] -> Convert to Shards x30" marker |
| R6-05 | FL-BLD-07 | 07-04 | Resource shortage handling only had generic toast -- no deficit amount, no quick-nav to resource source, no per-resource-type differentiation | Added detailed per-resource-type shortage handling: exact deficit display in toast, type-specific quick-nav buttons ([Go to Market] for copper, [Go to Shop] for scrolls, [Recharge] for gems) |
| R6-06 | FL-BLD-07 | 07-06 | Result display had no cross-system navigation -- "view details" mentioned but no spec for how to navigate to hero system, what params to pass, or panel transition | Added 07-06c sub-step: [View Details] closes tavern panel, opens hero system detail page with `{ system: "hero", action: "detail", heroId }` navigation params |

### P1 Issues (Fixed in-place during R6)

| ID | Flow | Step | Issue | Fix Applied |
|----|------|------|-------|-------------|
| R6-07 | FL-BLD-07 | 07-03 | Free advanced recruit visual state missing -- no spec for how the button looks when free count is available vs used, no visual distinction | Added free-state button design: green border + "Free" sparkle badge + price strikethrough when free available; gray label when used |
| R6-08 | FL-BLD-07 | 07-02 | Quality pool restrictions per recruit type not explicit -- probability bar could show impossible combinations (e.g., orange in friend recruit) | Added explicit quality pool restrictions: normal = white/green/blue/purple, advanced = blue/purple/orange, friend = white/green/blue. Probability bars must only show applicable qualities |
| R6-09 | FL-BLD-07 | 07-01 | Tavern level unlock progression not in flow -- PRD defines Lv1-5/6-10/11-15/16-20 unlock tiers but no step showed how this affects UI rendering | Added complete Tavern Level Effects section: level unlock table, level-up panel refresh behavior (lock shatter 200ms + card fade-in 300ms), off-tab red dot notification |
| R6-10 | FL-BLD-07 | 07-07 | Recruitment history had no filtering -- only showed "last 50 records" with no ability to filter by type or quality | Added dual-dimension filtering: type filter (All/Normal/Advanced/Friend) x quality filter (All/White/Green/Blue/Purple/Orange), AND relationship, client-side filtering <50ms |
| R6-11 | FL-BLD-07 | 07-04 | No daily recruit limit -- no anti-abuse mechanism for any recruit type, players could theoretically recruit thousands of times per day | Added daily limits: normal 100/day, advanced 50/day, friend 100/day. Server-side enforcement with toast showing reset time "明日00:00刷新" |
| R6-12 | FL-BLD-07 | 07-06 | Animation resource loading strategy missing -- large animation files (purple/orange ~200KB each) could cause lag or blank screen on slow connections | Added tiered preloading: white/green/blue preloaded on tab enter; purple/orange loaded on-demand with quality-color placeholder fallback |
| R6-13 | FL-BLD-07 | 07-06 | Mobile animation behavior not specified -- desktop animation specs don't directly translate (screen shake problematic, 5s animation too long on mobile) | Added mobile compression: 20% duration reduction, screen shake replaced by flash effect, animation specs per-tier for mobile |
| R6-14 | FL-BLD-07 | 07-02 | Probability bar color values and dimensions not specified -- no way to ensure consistent rendering across implementations | Added exact specs: 360x24px bar, color values per quality (white=#ccc, green=#27ae60, blue=#3498db, purple=#9b59b6, orange=#e67e22), 4px border-radius |
| R6-15 | FL-BLD-07 | 07-05 | Server transaction only described conceptually -- no API spec, no request/response format, no step-by-step transaction detail | Added complete 6-step atomic transaction spec with API endpoint `POST /api/tavern/recruit/execute`, request/response JSON examples, and explicit rollback behavior per step |

### P2 Issues (Noted, deferred to R9+)

| ID | Flow | Issue | Rationale |
|----|------|-------|-----------|
| R6-P2-01 | FL-BLD-07 | Duplicate hero conversion rate (30 shards) is assumed -- not specified in PRD. Actual conversion rate and shard economy should be confirmed with game design | Needs game design confirmation |
| R6-P2-02 | FL-BLD-07 | Daily recruit limits (100/50/100) are assumed anti-abuse values -- not in PRD. Actual limits should balance player experience with server load | Needs game balance + infrastructure review |
| R6-P2-03 | FL-BLD-07 | Free advanced recruit resets at server 00:00 -- timezone not specified. For global players, should clarify if this is server local time, UTC, or player's local time | Needs server architecture decision |
| R6-P2-04 | FL-BLD-07 | Orange animation (5s) may feel too long for players who do many recruitments -- consider a "skip animation" setting option for experienced players, or auto-skip after 10+ orange pulls | UX enhancement, post-launch consideration |
| R6-P2-05 | FL-BLD-07 | Pity counter at 49/50 combined with daily free recruit creates a "save free recruit for pity" strategy -- not necessarily bad but worth verifying this is intended game design | Game balance consideration |
| R6-P2-06 | FL-BLD-07 | Animation resource files (~200KB for purple/orange) loaded on-demand could cause 1-2s delay on slow mobile connections -- consider background preloading after advanced recruit validation passes | Performance optimization during implementation |
| R6-P2-07 | FL-BLD-07 | L3 forced refresh compares resource balances to determine if recruitment succeeded -- but other concurrent resource changes (simultaneous building upgrade, trade income) could cause false comparison | Edge case, unlikely in practice but theoretically possible. Server `last-result` API in L2 should handle most cases |

## Completeness Check Results

### Scenario Coverage

| Scenario | Coverage |
|----------|:--------:|
| Normal recruit (happy path) | Covered (07-01 through 07-06) |
| Advanced recruit (paid) | Covered (07-01 through 07-06) |
| Advanced recruit (free daily) | Covered (07-03 + 07-04 + 07-05) |
| Friend recruit | Covered (07-01 through 07-06) |
| Probability display with bonuses | Covered (07-02a + 07-02b) |
| Probability breakdown tooltip | Covered (07-02b) |
| Pity counter at X/50 | Covered (07-02a display + 07-05a logic) |
| Pity trigger (50th pull) | Covered (07-05a + 07-06c toast) |
| Pity not unlocked (Lv<16) | Covered (Tavern Level Effects section) |
| Free daily recruit: available | Covered (07-03 green badge) |
| Free daily recruit: used | Covered (07-03 gray label) |
| Free daily recruit: reset at 00:00 | Covered (07-04b daily limit) |
| White quality animation | Covered (07-06a: 0ms instant) |
| Green quality animation | Covered (07-06a: 1.0s) |
| Blue quality animation | Covered (07-06a: 2.0s) |
| Purple quality animation | Covered (07-06a: 3.0s) |
| Orange quality animation | Covered (07-06a: 5.0s) |
| Duplicate hero -> shards | Covered (07-05a + 07-06b) |
| Hero card reveal | Covered (07-06b) |
| View Details -> Hero system | Covered (07-06c) |
| Recruitment history: list | Covered (07-07) |
| Recruitment history: type filter | Covered (07-07) |
| Recruitment history: quality filter | Covered (07-07) |
| Copper shortage | Covered (E-07-01) |
| Scroll shortage | Covered (E-07-02) |
| Gem shortage | Covered (E-07-03) |
| Friendship point shortage | Covered (E-07-04) |
| Tavern level insufficient | Covered (E-07-05) |
| Card pool empty | Covered (E-07-06) |
| Daily limit exhausted | Covered (E-07-07) |
| Network failure: L1 auto-retry | Covered (07-05b) |
| Network failure: L2 result query | Covered (07-05b) |
| Network failure: L3 forced refresh | Covered (07-05b) |
| Version conflict (409) | Covered (E-07-08) |
| Animation resource load failure | Covered (E-07-14) |
| Hero portrait load failure | Covered (E-07-15) |
| Tavern level-up unlocks new type | Covered (E-07-17) |

### Edge Case Coverage

| Edge Case | Handled In |
|----------|-----------|
| All 3 types available (Lv16+) | 07-01 (normal rendering) |
| Only normal available (Lv1-5) | 07-01 (locked states) |
| Free recruit used + click advanced | 07-03 (normal state, no badge) |
| Free recruit available + click advanced | 07-03 (green badge + no resource deduct) |
| Pity at 49/50 + next advanced recruit | 07-05a (counter hits 50, pity triggers) |
| Pity triggers with purple result | 07-06c (pity trigger toast) |
| Duplicate hero (already owned) | 07-05a (convert to shards) + 07-06b (marker) |
| Double-click on recruit button | 07-03 (300ms cooldown) |
| Tab switch during recruit animation | 07-06a (blocked, all clicks disabled) |
| App background during recruit | 07-05b (L1/L2/L3 recovery) |
| Network returns mid-L3 refresh | 07-05b (resource comparison resolves) |
| Animation file fails to load | 07-06a (degrade to instant) |
| Hero portrait fails to load | 07-06b (quality-color placeholder) |
| Tavern levels up while on recruit tab | E-07-17 (unlock animation) |
| Tavern levels up while on overview tab | Tavern Level Effects (red dot) |
| Daily limit at 99/100 + recruit twice fast | 07-04b (server enforces, second fails with E-07-07) |
| Player has exact resource amount (no surplus) | 07-04a (passes validation, deducts to 0) |
| Probability total exceeds 100% after bonuses | 07-02a (white segment = 100% - others sum) |
| Empty card pool for specific quality tier | 07-04b (server selects from available heroes in tier) |
| Orange animation on low-end mobile | 07-06a (20% compression + no shake) |
